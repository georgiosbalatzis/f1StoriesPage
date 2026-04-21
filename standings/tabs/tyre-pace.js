// Tyre Pace tab — standalone ES module (Phase 6C, step 5).
//
// Extracted from standings.legacy.js so direct landings on
// ?tab=tyre-pace no longer need the legacy bundle. The module owns its own
// DOM query (#tyre-pace-table), OpenF1 fetch/cache state, the race-session
// select, and the horizontal chart scrolling behavior. The orchestrator
// (standings.js) imports this lazily, wires onRendered / onSessionChange
// callbacks once via initTyrePace(), and syncs deep links through
// getSelectedSession() / setSelectedSession().

import { esc } from '../core/format.js';
import {
    normalizeHexColor,
    hexToRgbChannels,
    getCanonicalTeamColor
} from '../core/teams.js';
import { fetchJSON, fetchOpenF1BySessionKeys } from '../core/fetchers.js';
import { isFiniteNumber, parseTimeSeconds } from './_shared.js';

const OPENF1 = 'https://api.openf1.org/v1';
const YEAR = new Date().getFullYear();

const tyrePaceTable = document.getElementById('tyre-pace-table');

const state = {
    loaded: false,
    loading: false,
    sessions: [],
    selectedSessionKey: '',
    cache: {}
};

let onRendered = null;
let onSessionChange = null;
let listenersBound = false;

export function initTyrePace(options) {
    if (options && typeof options.onRendered === 'function') onRendered = options.onRendered;
    if (options && typeof options.onSessionChange === 'function') onSessionChange = options.onSessionChange;

    if (!listenersBound && tyrePaceTable) {
        // Capture-phase binding + stopImmediatePropagation so the legacy
        // bundle's tyre-pace change handler cannot also re-render using its
        // private tyrePaceState after the orchestrator takes ownership.
        tyrePaceTable.addEventListener('change', handleSessionChange, true);
        tyrePaceTable.addEventListener('wheel', handleHorizontalChartWheel, { passive: false });
        listenersBound = true;
    }
}

export function getSelectedSession() {
    return state.selectedSessionKey || '';
}

export function setSelectedSession(sessionKey) {
    const next = sessionKey == null ? '' : String(sessionKey);
    if (next === state.selectedSessionKey) return;
    state.selectedSessionKey = next;
    if (state.loaded && !state.loading) renderSelectedSession(true);
}

export function ensureLoaded(forceReload) {
    if (!tyrePaceTable) return;
    if (state.loading) return;
    if (state.loaded && !forceReload) {
        renderSelectedSession(false);
        return;
    }

    state.loading = true;
    tyrePaceTable.innerHTML = createTyrePaceSkeleton();

    getCompletedRaceAndSprintSessions().then(function(sessions) {
        state.sessions = sessions || [];
        if (!state.sessions.length) return null;
        ensureSelectedSessionExists();
        return loadTyrePaceSessionData(state.selectedSessionKey);
    }).then(function(data) {
        if (!state.sessions.length || !data) {
            renderTyrePace(null, null);
            state.loaded = true;
            return;
        }

        const selectedSession = getSelectedSessionRecord();
        renderTyrePace(data, selectedSession);
        state.loaded = true;
    }).catch(function(error) {
        console.error('Tyre pace error:', error);
        showTyrePaceError();
    }).finally(function() {
        state.loading = false;
    });
}

function fireRendered() {
    if (onRendered) onRendered('tyre-pace');
}

function ensureSelectedSessionExists() {
    if (!state.sessions.length) return '';
    const hasSelected = state.sessions.some(function(session) {
        return String(session.session_key) === String(state.selectedSessionKey);
    });
    if (!state.selectedSessionKey || !hasSelected) {
        state.selectedSessionKey = String(state.sessions[state.sessions.length - 1].session_key);
    }
    return state.selectedSessionKey;
}

function getSelectedSessionRecord() {
    const sessionKey = ensureSelectedSessionExists();
    return state.sessions.filter(function(session) {
        return String(session.session_key) === String(sessionKey);
    })[0] || null;
}

function renderSelectedSession(showSkeleton) {
    const selectedSession = getSelectedSessionRecord();
    if (!selectedSession) {
        renderTyrePace(null, null);
        return;
    }

    const cacheKey = String(selectedSession.session_key);
    const cached = state.cache[cacheKey];
    if (cached) {
        renderTyrePace(cached, selectedSession);
        return;
    }

    state.loading = true;
    if (showSkeleton && tyrePaceTable) tyrePaceTable.innerHTML = createTyrePaceSkeleton();

    loadTyrePaceSessionData(cacheKey).then(function(data) {
        const currentSession = getSelectedSessionRecord();
        if (!currentSession || String(currentSession.session_key) !== cacheKey) return;
        renderTyrePace(data, currentSession);
    }).catch(function(error) {
        console.error('Tyre pace session change error:', error);
        showTyrePaceError();
    }).finally(function() {
        state.loading = false;
    });
}

function handleSessionChange(event) {
    const raceSelect = event.target.closest('[data-tyre-pace-select]');
    if (!raceSelect) return;

    event.stopImmediatePropagation();
    state.selectedSessionKey = raceSelect.value;
    if (onSessionChange) onSessionChange(state.selectedSessionKey);
    renderSelectedSession(true);
}

function handleHorizontalChartWheel(event) {
    const scrollShell = event.target.closest('[data-horizontal-chart-scroll]');
    if (!scrollShell) return;
    if (scrollShell.scrollWidth <= scrollShell.clientWidth + 4) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;

    scrollShell.scrollLeft += delta;
    event.preventDefault();
}

function isCompletedSession(session) {
    if (!session || session.is_cancelled) return false;
    const dateValue = session.date_end || session.date_start || session.date;
    return dateValue ? new Date(dateValue) <= new Date() : false;
}

function isSprintRaceSession(session) {
    const text = [
        session && session.session_type,
        session && session.session_name
    ].join(' ').toLowerCase();
    if (text.indexOf('shootout') !== -1 || text.indexOf('qualifying') !== -1 || text.indexOf('practice') !== -1) return false;
    return text.indexOf('sprint') !== -1;
}

function getCompletedRaceAndSprintSessions() {
    return fetchJSON(OPENF1 + '/sessions?year=' + YEAR).then(function(sessions) {
        return (sessions || []).filter(function(session) {
            const text = [
                session && session.session_type,
                session && session.session_name
            ].join(' ').toLowerCase();
            if (!isCompletedSession(session)) return false;
            if (text.indexOf('shootout') !== -1 || text.indexOf('qualifying') !== -1 || text.indexOf('practice') !== -1 || text.indexOf('test') !== -1) return false;
            return text.indexOf('race') !== -1 || isSprintRaceSession(session);
        }).sort(function(a, b) {
            return new Date(a.date_start || a.date || 0) - new Date(b.date_start || b.date || 0);
        });
    });
}

function getSessionLabel(session) {
    const meeting = session.meeting_name || session.country_name || session.location || 'Session';
    const sessionName = session.session_name || session.session_type || 'Qualifying';
    return meeting + ' · ' + sessionName;
}

function formatSessionDateShort(session) {
    const value = session && (session.date_start || session.date || session.date_end);
    const date = value ? new Date(value) : null;
    if (!date || isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short'
    }).replace(/\./g, '');
}

function getDriverDisplayName(driver) {
    return driver.fullName || [driver.firstName, driver.lastName].filter(Boolean).join(' ') || ('Οδηγός #' + (driver.driverNumber || '?'));
}

function deriveAcronym(driver) {
    if (driver.acronym) return driver.acronym;
    const name = getDriverDisplayName(driver).split(/\s+/).filter(Boolean);
    if (name.length >= 2) return (name[0].charAt(0) + name[name.length - 1].charAt(0) + name[name.length - 1].charAt(1)).toUpperCase().slice(0, 3);
    return (name[0] || 'DRV').substring(0, 3).toUpperCase();
}

function buildDriverLookup(drivers) {
    const lookup = {};
    (drivers || []).forEach(function(driver) {
        if (!driver || driver.session_key == null || driver.driver_number == null) return;
        const sessionKey = String(driver.session_key);
        if (!lookup[sessionKey]) lookup[sessionKey] = {};
        lookup[sessionKey][driver.driver_number] = {
            driverNumber: driver.driver_number,
            fullName: driver.full_name || [driver.first_name, driver.last_name].filter(Boolean).join(' '),
            firstName: driver.first_name || '',
            lastName: driver.last_name || '',
            acronym: (driver.name_acronym || '').toUpperCase(),
            teamName: driver.team_name || '',
            teamColor: getCanonicalTeamColor('', driver.team_name || '', driver.team_colour || '')
        };
    });
    return lookup;
}

function formatLapTime(seconds, forceMinutes) {
    if (!isFiniteNumber(seconds)) return 'n/a';
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds - (minutes * 60);
    let secText = remaining.toFixed(3);
    if (remaining < 10) secText = '0' + secText;
    if (forceMinutes || minutes > 0) return minutes + ':' + secText;
    return remaining.toFixed(3);
}

function getCompoundMeta(compound) {
    const key = String(compound || '').toUpperCase();
    const map = {
        'SOFT': { label: 'Soft', hex: 'EF4444' },
        'MEDIUM': { label: 'Medium', hex: 'FACC15' },
        'HARD': { label: 'Hard', hex: 'F5F5F7' },
        'INTERMEDIATE': { label: 'Intermediate', hex: '10B981' },
        'WET': { label: 'Wet', hex: '3B82F6' }
    };
    return map[key] || { label: key || 'Unknown', hex: 'A1A1AA' };
}

function buildLapTimeAxisValues(minTime, maxTime) {
    if (!isFiniteNumber(minTime) || !isFiniteNumber(maxTime)) return [];
    const range = Math.max(1, maxTime - minTime);
    const step = range > 8 ? 2 : 1;
    const start = Math.floor(minTime / step) * step;
    const end = Math.ceil(maxTime / step) * step;
    const values = [];
    for (let value = start; value <= end + 0.0001; value += step) values.push(value);
    if (!values.length || values[values.length - 1] < maxTime) values.push(end + step);
    return values;
}

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function adjustHexColor(hex, delta) {
    const value = normalizeHexColor(hex);
    const rgb = [0, 2, 4].map(function(index) {
        return clampNumber(parseInt(value.slice(index, index + 2), 16) + delta, 0, 255);
    });
    return rgb.map(function(channel) {
        const str = channel.toString(16);
        return str.length === 1 ? '0' + str : str;
    }).join('');
}

function getCompoundForLap(lapNumber, stints) {
    for (let i = 0; i < (stints || []).length; i++) {
        const stint = stints[i];
        const lapEnd = stint && stint.lap_end != null ? stint.lap_end : Number.MAX_SAFE_INTEGER;
        if (stint && stint.lap_start <= lapNumber && lapEnd >= lapNumber) {
            return String(stint.compound || '').toUpperCase() || 'UNKNOWN';
        }
    }
    return 'UNKNOWN';
}

function createCenteredOffsets(count, maxOffset) {
    if (count <= 1) return [0];
    const offsets = [];
    for (let i = 0; i < count; i++) {
        offsets.push(-maxOffset + (2 * maxOffset * (count === 1 ? 0 : i / (count - 1))));
    }
    return offsets.sort(function(a, b) {
        return Math.abs(a) - Math.abs(b);
    });
}

function buildTyrePaceSvg(laps, minTime, maxTime, teamColor) {
    if (!laps || !laps.length) return '';

    const viewWidth = 84;
    const viewHeight = 252;
    const centerX = viewWidth / 2;
    const topPad = 8;
    const bottomPad = 8;
    const plotHeight = viewHeight - topPad - bottomPad;
    const range = Math.max(0.4, maxTime - minTime);
    const binSize = Math.max(0.18, range / 14);
    const binCount = Math.max(6, Math.ceil(range / binSize) + 1);
    const bins = [];
    let maxCount = 0;

    function timeToY(value) {
        return topPad + ((maxTime - value) / range) * plotHeight;
    }

    for (let index = 0; index < binCount; index++) bins.push([]);

    laps.forEach(function(lap) {
        const binIndex = clampNumber(Math.round((lap.duration - minTime) / binSize), 0, binCount - 1);
        bins[binIndex].push(lap);
        if (bins[binIndex].length > maxCount) maxCount = bins[binIndex].length;
    });

    maxCount = Math.max(maxCount, 1);

    const leftPoints = [];
    const rightPoints = [];
    bins.forEach(function(bin, binIndex) {
        const centerTime = minTime + (binIndex * binSize);
        const width = bin.length ? 7 + ((bin.length / maxCount) * 18) : 5;
        const y = timeToY(centerTime);
        leftPoints.push((centerX - width).toFixed(2) + ',' + y.toFixed(2));
        rightPoints.unshift((centerX + width).toFixed(2) + ',' + y.toFixed(2));
    });

    const path = 'M ' + leftPoints.join(' L ') + ' L ' + rightPoints.join(' L ') + ' Z';
    const fillChannels = hexToRgbChannels(adjustHexColor(teamColor || '3b82f6', 12));
    const strokeChannels = hexToRgbChannels(teamColor || '3b82f6');
    let circles = '';

    bins.forEach(function(bin) {
        if (!bin.length) return;
        const binMin = Math.min.apply(null, bin.map(function(item) { return item.duration; }));
        const binMax = Math.max.apply(null, bin.map(function(item) { return item.duration; }));
        const localWidth = 7 + ((bin.length / maxCount) * 18);
        const offsets = createCenteredOffsets(bin.length, Math.max(3, localWidth - 4));

        bin.slice().sort(function(a, b) {
            if (a.duration !== b.duration) return a.duration - b.duration;
            return a.lapNumber - b.lapNumber;
        }).forEach(function(lap, lapIndex) {
            const ratio = binMax === binMin ? 0.5 : (lap.duration - binMin) / (binMax - binMin);
            let y = timeToY(lap.duration);
            if (bin.length > 1 && binMax !== binMin) y += (ratio - 0.5) * 6;
            const meta = getCompoundMeta(lap.compound);
            circles += '<circle class="tyre-pace-dot" cx="' + (centerX + offsets[lapIndex]).toFixed(2) + '" cy="' + y.toFixed(2) + '" r="4.2" fill="rgb(' + esc(hexToRgbChannels(meta.hex)) + ')">'
                + '<title>' + esc(lap.compound + ' · Lap ' + lap.lapNumber + ' · ' + formatLapTime(lap.duration, true)) + '</title>'
                + '</circle>';
        });
    });

    return '<svg class="tyre-pace-svg" viewBox="0 0 ' + viewWidth + ' ' + viewHeight + '" preserveAspectRatio="none" aria-hidden="true">'
        + '<path d="' + esc(path) + '" fill="rgba(' + esc(fillChannels) + ', 0.22)" stroke="rgba(' + esc(strokeChannels) + ', 0.42)" stroke-width="1.2"></path>'
        + circles
        + '</svg>';
}

function buildTyrePaceSessionData(session, drivers, laps, stints) {
    const sessionKey = String(session.session_key);
    const driverLookup = buildDriverLookup(drivers)[sessionKey] || {};
    const lapsByDriver = {};
    const stintsByDriver = {};
    const allRows = [];
    let validLapCount = 0;
    const compoundsPresent = {};

    (laps || []).forEach(function(lap) {
        if (!lap || lap.driver_number == null) return;
        const key = String(lap.driver_number);
        if (!lapsByDriver[key]) lapsByDriver[key] = [];
        lapsByDriver[key].push(lap);
    });

    (stints || []).forEach(function(stint) {
        if (!stint || stint.driver_number == null) return;
        const key = String(stint.driver_number);
        if (!stintsByDriver[key]) stintsByDriver[key] = [];
        stintsByDriver[key].push(stint);
    });

    Object.keys(stintsByDriver).forEach(function(driverKey) {
        stintsByDriver[driverKey].sort(function(a, b) {
            return a.stint_number - b.stint_number || a.lap_start - b.lap_start;
        });
    });

    Object.keys(driverLookup).forEach(function(driverKey) {
        const driver = driverLookup[driverKey];
        const driverLaps = (lapsByDriver[String(driver.driverNumber)] || []).slice().sort(function(a, b) {
            return a.lap_number - b.lap_number;
        });
        const driverStints = stintsByDriver[String(driver.driverNumber)] || [];
        const usableLaps = [];

        driverLaps.forEach(function(lap, lapIndex) {
            const duration = parseTimeSeconds(lap.lap_duration);
            const nextLap = driverLaps[lapIndex + 1];
            const isPitInLap = !!(nextLap && nextLap.is_pit_out_lap);
            if (!isFiniteNumber(duration) || duration <= 0 || lap.is_pit_out_lap || isPitInLap) return;

            usableLaps.push({
                lapNumber: lap.lap_number,
                duration: duration,
                compound: getCompoundForLap(lap.lap_number, driverStints)
            });
        });

        let filteredLaps = usableLaps.slice();
        if (usableLaps.length) {
            const bestLap = usableLaps.reduce(function(best, lap) {
                return Math.min(best, lap.duration);
            }, usableLaps[0].duration);
            filteredLaps = usableLaps.filter(function(lap) {
                return lap.duration <= bestLap + 12;
            });
            if (!filteredLaps.length) filteredLaps = usableLaps.slice();
        }

        filteredLaps.forEach(function(lap) {
            validLapCount += 1;
            compoundsPresent[lap.compound] = true;
        });

        allRows.push({
            driverNumber: driver.driverNumber,
            acronym: deriveAcronym(driver),
            fullName: getDriverDisplayName(driver),
            teamName: driver.teamName || '',
            teamColor: getCanonicalTeamColor('', driver.teamName || '', driver.teamColor || ''),
            laps: filteredLaps,
            bestLap: filteredLaps.length ? filteredLaps.reduce(function(best, lap) {
                return Math.min(best, lap.duration);
            }, filteredLaps[0].duration) : NaN
        });
    });

    allRows.sort(function(a, b) {
        const aHas = isFiniteNumber(a.bestLap);
        const bHas = isFiniteNumber(b.bestLap);
        if (aHas && bHas && a.bestLap !== b.bestLap) return a.bestLap - b.bestLap;
        if (aHas !== bHas) return aHas ? -1 : 1;
        return a.acronym.localeCompare(b.acronym);
    });

    const allDurations = [];
    allRows.forEach(function(row) {
        row.laps.forEach(function(lap) { allDurations.push(lap.duration); });
    });

    return {
        rows: allRows,
        validLapCount: validLapCount,
        driverCount: allRows.length,
        compounds: Object.keys(compoundsPresent),
        minTime: allDurations.length ? Math.min.apply(null, allDurations) : NaN,
        maxTime: allDurations.length ? Math.max.apply(null, allDurations) : NaN
    };
}

function renderTyrePace(data, session) {
    if (!tyrePaceTable) return;

    if (!data || !session || !data.rows || !data.rows.length) {
        tyrePaceTable.innerHTML = '<div class="tyre-pace-empty-card">'
            + '<svg class="icon" aria-hidden="true"><use href="#fa-wave-square"/></svg>'
            + '<p>Δεν υπάρχουν ακόμη διαθέσιμα lap distributions για το επιλεγμένο session.</p>'
            + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το tab ενεργοποιείται μόλις υπάρξουν race ή sprint laps μαζί με stint data.</p>'
            + '</div>';
        fireRendered();
        return;
    }

    const axisValues = buildLapTimeAxisValues(data.minTime, data.maxTime);
    const chartMinWidth = Math.max(1360, 96 + (data.rows.length * 80));
    const compounds = data.compounds.length ? data.compounds.slice().sort(function(a, b) {
        const order = { 'SOFT': 0, 'MEDIUM': 1, 'HARD': 2, 'INTERMEDIATE': 3, 'WET': 4 };
        return (order[a] != null ? order[a] : 10) - (order[b] != null ? order[b] : 10);
    }) : ['SOFT', 'MEDIUM', 'HARD'];

    const selectOptions = state.sessions.slice().reverse().map(function(race) {
        return '<option value="' + esc(race.session_key) + '"' + (String(race.session_key) === String(session.session_key) ? ' selected' : '') + '>'
            + esc((race.circuit_short_name || race.location || race.country_name || 'Session') + ' · ' + (race.session_name || race.session_type || 'Race') + (formatSessionDateShort(race) ? ' · ' + formatSessionDateShort(race) : ''))
            + '</option>';
    }).join('');

    let html = '<div class="tyre-pace-card">'
        + '<div class="tyre-pace-head"><div class="tyre-pace-head-copy"><h3 class="tyre-pace-head-title">Tyre Compound Lap Time Distributions</h3><p class="tyre-pace-head-note">Dry-compound colours: hard white, medium yellow, soft red. Out laps, in laps και πολύ αργοί outlier laps αφαιρούνται για πιο καθαρό pace picture.</p></div><label class="tyre-pace-controls"><span class="tyre-pace-controls-label">Available sessions</span><select class="tyre-pace-select" data-tyre-pace-select aria-label="Επιλογή session για tyre pace">' + selectOptions + '</select></label></div>'
        + '<div class="tyre-pace-summary"><div><div class="tyre-pace-summary-title">' + esc(session.meeting_name || getSessionLabel(session)) + '</div><div class="tyre-pace-summary-sub">' + esc(formatSessionDateShort(session) + ' · ' + (session.session_name || session.session_type || 'Race')) + '</div></div><div class="tyre-pace-summary-stats"><div class="tyre-pace-summary-stat"><span class="tyre-pace-summary-label">Drivers</span><span class="tyre-pace-summary-value">' + esc(String(data.driverCount)) + '</span></div><div class="tyre-pace-summary-stat"><span class="tyre-pace-summary-label">Valid laps</span><span class="tyre-pace-summary-value">' + esc(String(data.validLapCount)) + '</span></div><div class="tyre-pace-summary-stat"><span class="tyre-pace-summary-label">Best lap</span><span class="tyre-pace-summary-value">' + esc(formatLapTime(data.rows[0] && data.rows[0].bestLap, true)) + '</span></div></div></div>'
        + '<div class="tyre-pace-legend"><span class="tyre-pace-legend-title">Tyre Compound</span>';

    compounds.forEach(function(compound) {
        const meta = getCompoundMeta(compound);
        html += '<span class="tyre-pace-legend-item"><span class="tyre-pace-legend-dot" style="--compound-color:' + esc(hexToRgbChannels(meta.hex)) + ';"></span>' + esc(meta.label.toUpperCase()) + '</span>';
    });

    html += '</div>'
        + '<div class="tyre-pace-chart-scroll" data-horizontal-chart-scroll><div class="tyre-pace-chart-shell" style="min-width:' + chartMinWidth + 'px;">'
        + '<div class="tyre-pace-axis"><span class="tyre-pace-axis-title">Lap Time (s)</span>';

    axisValues.forEach(function(value) {
        const bottom = data.maxTime > data.minTime ? ((value - data.minTime) / (data.maxTime - data.minTime)) * 100 : 0;
        html += '<span class="tyre-pace-axis-label" style="bottom:' + bottom.toFixed(2) + '%;">' + esc(formatLapTime(value, true)) + '</span>';
    });

    html += '</div><div class="tyre-pace-chart-body">';

    axisValues.forEach(function(value) {
        const bottom = data.maxTime > data.minTime ? ((value - data.minTime) / (data.maxTime - data.minTime)) * 100 : 0;
        html += '<div class="tyre-pace-grid-line" style="bottom:' + bottom.toFixed(2) + '%;"></div>';
    });

    html += '<div class="tyre-pace-columns" style="grid-template-columns:repeat(' + data.rows.length + ', minmax(68px, 1fr));">';

    data.rows.forEach(function(row) {
        html += '<article class="tyre-pace-col">';
        if (row.laps.length) {
            html += '<div class="tyre-pace-plot">' + buildTyrePaceSvg(row.laps, data.minTime, data.maxTime, row.teamColor) + '</div>'
                + '<div class="tyre-pace-best">' + esc(formatLapTime(row.bestLap, true)) + '</div>';
        } else {
            html += '<div class="tyre-pace-no-data">No laps</div><div class="tyre-pace-best">n/a</div>';
        }
        html += '<div class="tyre-pace-code">' + esc(row.acronym) + '</div><div class="tyre-pace-name">' + esc(row.fullName) + '</div></article>';
    });

    html += '</div></div></div></div><p class="tyre-pace-footnote">Source: OpenF1 `laps` + `stints`. Compounds are mapped from stint ranges to each valid race lap.</p></div>';

    tyrePaceTable.innerHTML = html;
    fireRendered();
}

function showTyrePaceError() {
    if (!tyrePaceTable) return;
    tyrePaceTable.innerHTML = '<div class="tyre-pace-empty-card">'
        + '<svg class="icon" aria-hidden="true"><use href="#fa-exclamation-triangle"/></svg>'
        + '<p>Δεν ήταν δυνατή η φόρτωση του tyre pace chart.</p>'
        + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το OpenF1 endpoint ίσως να μην είναι διαθέσιμο προσωρινά.</p>'
        + '<button class="retry-btn" type="button" onclick="window.__retryTyrePace && window.__retryTyrePace()"><svg class="icon" aria-hidden="true"><use href="#fa-redo"/></svg> Νέα προσπάθεια</button>'
        + '</div>';
    fireRendered();
}

function createTyrePaceSkeleton() {
    return '<div class="tyre-pace-skeleton-card">'
        + '<div class="tyre-pace-skeleton-head"><div><div class="skel" style="width:210px;height:18px;"></div><div class="skel" style="width:260px;height:11px;margin-top:0.5rem;"></div></div><div class="skel" style="width:220px;height:46px;border-radius:12px;"></div></div>'
        + '<div class="skel" style="width:320px;height:12px;margin-bottom:1rem;"></div>'
        + '<div class="skel tyre-pace-skeleton-chart"></div>'
        + '<div class="skel" style="width:68%;height:10px;margin-top:0.9rem;"></div>'
        + '</div>';
}

function loadTyrePaceSessionData(sessionKey) {
    const session = state.sessions.filter(function(item) {
        return String(item.session_key) === String(sessionKey);
    })[0];
    if (!session) return Promise.reject(new Error('Unknown race session'));

    const cacheKey = String(sessionKey);
    if (state.cache[cacheKey]) return Promise.resolve(state.cache[cacheKey]);

    return Promise.all([
        fetchOpenF1BySessionKeys(OPENF1, 'drivers', [session.session_key]),
        fetchOpenF1BySessionKeys(OPENF1, 'laps', [session.session_key]),
        fetchOpenF1BySessionKeys(OPENF1, 'stints', [session.session_key])
    ]).then(function(payload) {
        const built = buildTyrePaceSessionData(session, payload[0], payload[1], payload[2]);
        state.cache[cacheKey] = built;
        return built;
    });
}

window.__retryTyrePace = function() {
    state.loaded = false;
    ensureLoaded(true);
};
