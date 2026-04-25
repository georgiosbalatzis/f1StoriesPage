// Track Dominance tab — standalone ES module (Phase 6C, step 7).
//
// Extracted from standings.legacy.js so direct landings on
// ?tab=track-dominance no longer need the legacy bundle. The module owns the
// session + driver selectors, fastest-lap telemetry fetch path, track map
// tooltip behavior, and cached comparison state. standings.js lazy-loads this
// module, wires onRendered / onSelectionChange once via initTrackDominance(),
// and syncs deep links through getSelectedSession() / getSelectedDriverKeys()
// and setSelection().

import { esc } from '../core/format.js';
import {
    getCanonicalTeamColor,
    getCanonicalTeamName,
    getTeamLogo,
    resolveTeamId,
    normalizeTeamName,
    normalizeHexColor,
    hexToRgbChannels
} from '../core/teams.js';
import {
    fetchJSON,
    fetchOpenF1BySessionKeys,
    fetchOpenF1ByDriverNumbers
} from '../core/fetchers.js';
import { parseNumberValue, isFiniteNumber, parseTimeSeconds } from './_shared.js';

const OPENF1 = 'https://api.openf1.org/v1';
const YEAR = new Date().getFullYear();

const trackDominanceTable = document.getElementById('track-dominance-table');

const state = {
    loaded: false,
    loading: false,
    pendingReload: false,
    sessions: [],
    selectedSessionKey: '',
    leftDriverKey: '',
    rightDriverKey: '',
    sessionCache: {},
    pairCache: {}
};

let onRendered = null;
let onSelectionChange = null;
let listenersBound = false;

export function initTrackDominance(options) {
    if (options && typeof options.onRendered === 'function') onRendered = options.onRendered;
    if (options && typeof options.onSelectionChange === 'function') onSelectionChange = options.onSelectionChange;

    if (!listenersBound && trackDominanceTable) {
        // Capture-phase listeners stop the legacy bundle from reacting to the
        // same controls after the orchestrator hands ownership to this module.
        trackDominanceTable.addEventListener('change', handleTableChange, true);
        trackDominanceTable.addEventListener('pointermove', handleTablePointerMove, true);
        trackDominanceTable.addEventListener('pointerleave', handleTablePointerLeave, true);
        listenersBound = true;
    }
}

export function getSelectedSession() {
    return state.selectedSessionKey || '';
}

export function getSelectedDriverKeys() {
    return {
        leftDriverKey: state.leftDriverKey || '',
        rightDriverKey: state.rightDriverKey || ''
    };
}

export function setSelection(selection) {
    const nextSessionKey = selection && selection.sessionKey != null ? String(selection.sessionKey) : '';
    const nextLeftDriverKey = selection && selection.leftDriverKey != null ? String(selection.leftDriverKey) : '';
    const nextRightDriverKey = selection && selection.rightDriverKey != null ? String(selection.rightDriverKey) : '';

    if (
        nextSessionKey === state.selectedSessionKey &&
        nextLeftDriverKey === state.leftDriverKey &&
        nextRightDriverKey === state.rightDriverKey
    ) {
        return;
    }

    state.selectedSessionKey = nextSessionKey;
    state.leftDriverKey = nextLeftDriverKey;
    state.rightDriverKey = nextRightDriverKey;

    if (state.loading) {
        state.pendingReload = true;
        return;
    }
    if (state.loaded) renderSelectedComparison(true);
}

export function ensureLoaded(forceReload) {
    if (!trackDominanceTable) return;
    if (state.loading) return;
    if (state.loaded && !forceReload) {
        renderSelectedComparison(false);
        return;
    }
    loadAndRenderTrackDominance(true);
}

function fireRendered() {
    if (onRendered) onRendered('track-dominance');
}

function notifySelectionChange() {
    if (onSelectionChange) {
        onSelectionChange({
            sessionKey: state.selectedSessionKey || '',
            leftDriverKey: state.leftDriverKey || '',
            rightDriverKey: state.rightDriverKey || ''
        });
    }
}

function ensureSelectedSessionExists() {
    if (!state.sessions.length) return '';
    const hasSelected = state.sessions.some(function(item) {
        return String(item.session_key) === String(state.selectedSessionKey);
    });
    if (!state.selectedSessionKey || !hasSelected) {
        state.selectedSessionKey = String(state.sessions[state.sessions.length - 1].session_key);
    }
    return state.selectedSessionKey;
}

function getSelectedSessionRecord() {
    const selectedSessionKey = ensureSelectedSessionExists();
    return state.sessions.filter(function(item) {
        return String(item.session_key) === String(selectedSessionKey);
    })[0] || null;
}

function renderSelectedComparison(useSkeleton) {
    if (!trackDominanceTable) return;
    if (state.loading) {
        state.pendingReload = true;
        return;
    }

    const selectedSession = getSelectedSessionRecord();
    if (!selectedSession) {
        renderTrackDominance(null, null, null);
        return;
    }

    const sessionCacheKey = String(selectedSession.session_key);
    const sessionData = state.sessionCache[sessionCacheKey];
    if (!sessionData) {
        state.loaded = false;
        loadAndRenderTrackDominance(useSkeleton);
        return;
    }

    const selection = resolveTrackDominanceSelection(sessionData, state.leftDriverKey, state.rightDriverKey);
    state.leftDriverKey = selection.leftDriverKey;
    state.rightDriverKey = selection.rightDriverKey;

    if (!selection.leftDriverKey || !selection.rightDriverKey) {
        state.loaded = true;
        renderTrackDominance(sessionData, null, selectedSession);
        return;
    }

    const pairCacheKey = [selectedSession.session_key, selection.leftDriverKey, selection.rightDriverKey].join('|');
    const pairData = state.pairCache[pairCacheKey];
    if (pairData) {
        state.loaded = true;
        renderTrackDominance(sessionData, pairData, selectedSession);
        return;
    }

    state.loaded = false;
    loadAndRenderTrackDominance(useSkeleton);
}

function handleTableChange(event) {
    const sessionSelect = event.target.closest('[data-track-dom-session]');
    if (sessionSelect) {
        event.stopImmediatePropagation();
        state.selectedSessionKey = sessionSelect.value;
        state.leftDriverKey = '';
        state.rightDriverKey = '';
        state.loaded = false;
        notifySelectionChange();
        loadAndRenderTrackDominance(true);
        return;
    }

    const driverSelect = event.target.closest('[data-track-dom-driver]');
    if (!driverSelect) return;

    event.stopImmediatePropagation();
    if (driverSelect.getAttribute('data-track-dom-driver') === 'left') {
        state.leftDriverKey = driverSelect.value;
        const cachedLeftSession = state.sessionCache[String(state.selectedSessionKey)];
        if (cachedLeftSession) {
            state.rightDriverKey = resolveTrackDominanceSelection(
                cachedLeftSession,
                state.leftDriverKey,
                state.rightDriverKey,
                'left'
            ).rightDriverKey;
        }
    } else {
        state.rightDriverKey = driverSelect.value;
        const cachedRightSession = state.sessionCache[String(state.selectedSessionKey)];
        if (cachedRightSession) {
            state.leftDriverKey = resolveTrackDominanceSelection(
                cachedRightSession,
                state.leftDriverKey,
                state.rightDriverKey,
                'right'
            ).leftDriverKey;
        }
    }

    state.loaded = false;
    notifySelectionChange();
    loadAndRenderTrackDominance(true);
}

function handleTablePointerMove(event) {
    event.stopImmediatePropagation();
    const target = event.target;
    const segment = target && target.classList && target.classList.contains('track-dom-segment') ? target : null;
    updateTrackDominanceTooltip(segment, event);
}

function handleTablePointerLeave(event) {
    event.stopImmediatePropagation();
    hideTrackDominanceTooltip();
}

function isCompletedSession(session) {
    if (!session || session.is_cancelled) return false;
    const dateValue = session.date_end || session.date_start || session.date;
    return dateValue ? new Date(dateValue) <= new Date() : false;
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
        const fullName = driver.full_name || [driver.first_name, driver.last_name].filter(Boolean).join(' ');
        lookup[sessionKey][driver.driver_number] = {
            driverNumber: driver.driver_number,
            fullName: fullName,
            firstName: driver.first_name || '',
            lastName: driver.last_name || '',
            acronym: (driver.name_acronym || '').toUpperCase(),
            headshot: driver.headshot_url || '',
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

function getCompletedTrackDominanceSessions() {
    return fetchJSON(OPENF1 + '/sessions?year=' + YEAR).then(function(sessions) {
        return (sessions || []).filter(function(session) {
            if (!isCompletedSession(session)) return false;
            const name = [
                session && session.session_name,
                session && session.session_type,
                session && session.meeting_name
            ].join(' ').toLowerCase();
            if (name.indexOf('test') !== -1) return false;
            return name.indexOf('practice') !== -1
                || name.indexOf('qualifying') !== -1
                || name.indexOf('shootout') !== -1
                || name.indexOf('sprint') !== -1
                || name.indexOf('race') !== -1;
        }).sort(function(a, b) {
            return new Date(a.date_start || a.date || 0) - new Date(b.date_start || b.date || 0);
        });
    });
}

function getTrackDominanceShortName(teamName) {
    const text = String(teamName || '').replace(/[^A-Za-z0-9]+/g, ' ').trim();
    if (!text) return 'TEAM';
    const parts = text.split(/\s+/);
    if (parts.length > 1) return (parts[0].charAt(0) + parts[1].charAt(0) + (parts[1].charAt(1) || '')).toUpperCase().slice(0, 3);
    return parts[0].substring(0, 3).toUpperCase();
}

function getTrackDominanceSectorDuration(lap, sectorIndex) {
    return parseTimeSeconds(
        lap && (lap['duration_sector_' + sectorIndex]
            || lap['sector_' + sectorIndex + '_time']
            || lap['sector' + sectorIndex + '_time'])
    );
}

function getTrackDominanceSpeedMetric(lap, keys) {
    for (let index = 0; index < keys.length; index++) {
        const value = parseNumberValue(lap && lap[keys[index]]);
        if (isFiniteNumber(value)) return value;
    }
    return NaN;
}

function buildTrackDominanceSessionData(session, drivers, laps) {
    const sessionKey = String(session.session_key);
    const driverLookup = buildDriverLookup(drivers)[sessionKey] || {};
    const teamMap = {};
    const driverMap = {};

    Object.keys(driverLookup).forEach(function(driverKey) {
        const driver = driverLookup[driverKey];
        if (!driver || !driver.teamName) return;

        const teamId = resolveTeamId('', driver.teamName || '');
        const teamKey = teamId || normalizeTeamName(driver.teamName || '').replace(/\s+/g, '-');
        if (!teamKey) return;

        if (!teamMap[teamKey]) {
            const teamName = getCanonicalTeamName(driver.teamName || '') || driver.teamName || 'Team';
            const teamColor = getCanonicalTeamColor(teamId, teamName, driver.teamColor || '');
            teamMap[teamKey] = {
                teamKey: teamKey,
                teamId: teamId,
                teamName: teamName,
                teamColor: teamColor,
                logo: teamId ? getTeamLogo(teamId, teamName) : '',
                drivers: []
            };
        }

        const driverEntry = {
            driverKey: String(driver.driverNumber),
            driverNumber: driver.driverNumber,
            acronym: deriveAcronym(driver),
            fullName: getDriverDisplayName(driver),
            headshot: driver.headshot || '',
            teamKey: teamKey,
            teamName: teamMap[teamKey].teamName,
            teamColor: teamMap[teamKey].teamColor,
            logo: teamMap[teamKey].logo,
            bestLap: null
        };
        driverMap[driverEntry.driverKey] = driverEntry;
        teamMap[teamKey].drivers.push(driverEntry);
    });

    (laps || []).forEach(function(lap) {
        if (!lap || lap.driver_number == null) return;
        const driver = driverLookup[String(lap.driver_number)];
        if (!driver || !driver.teamName) return;

        const duration = parseTimeSeconds(lap.lap_duration);
        if (!isFiniteNumber(duration) || duration <= 0 || duration > 240 || lap.is_pit_out_lap) return;

        const teamId = resolveTeamId('', driver.teamName || '');
        const teamKey = teamId || normalizeTeamName(driver.teamName || '').replace(/\s+/g, '-');
        const driverEntry = driverMap[String(driver.driverNumber)];
        if (!driverEntry || !teamMap[teamKey]) return;

        const candidate = {
            driverNumber: driver.driverNumber,
            acronym: deriveAcronym(driver),
            fullName: getDriverDisplayName(driver),
            headshot: driver.headshot || '',
            teamKey: teamKey,
            teamName: driverEntry.teamName,
            teamColor: driverEntry.teamColor,
            lapNumber: lap.lap_number,
            dateStart: lap.date_start || '',
            duration: duration,
            sector1: getTrackDominanceSectorDuration(lap, 1),
            sector2: getTrackDominanceSectorDuration(lap, 2),
            sector3: getTrackDominanceSectorDuration(lap, 3),
            speedI1: getTrackDominanceSpeedMetric(lap, ['i1_speed']),
            speedI2: getTrackDominanceSpeedMetric(lap, ['i2_speed']),
            speedTrap: getTrackDominanceSpeedMetric(lap, ['st_speed', 'speed_trap']),
            lap: lap
        };

        if (!driverEntry.bestLap || candidate.duration < driverEntry.bestLap.duration) {
            driverEntry.bestLap = candidate;
        }
    });

    const teams = Object.keys(teamMap).map(function(teamKey) {
        const team = teamMap[teamKey];
        team.drivers = (team.drivers || []).filter(function(driver) {
            return driver.bestLap && !!driver.bestLap.dateStart;
        }).sort(function(a, b) {
            if (a.bestLap.duration !== b.bestLap.duration) return a.bestLap.duration - b.bestLap.duration;
            return a.fullName.localeCompare(b.fullName);
        });
        if (!team.drivers.length) return null;
        team.bestLap = team.drivers[0].bestLap;
        return team;
    }).filter(function(team) {
        return !!team;
    }).sort(function(a, b) {
        if (a.bestLap.duration !== b.bestLap.duration) return a.bestLap.duration - b.bestLap.duration;
        return a.teamName.localeCompare(b.teamName);
    });

    const driverEntries = teams.reduce(function(acc, team) {
        return acc.concat(team.drivers);
    }, []);

    return {
        session: session,
        teams: teams,
        drivers: driverEntries,
        driverMap: driverEntries.reduce(function(acc, driver) {
            acc[driver.driverKey] = driver;
            return acc;
        }, {}),
        teamMap: teams.reduce(function(acc, team) {
            acc[team.teamKey] = team;
            return acc;
        }, {})
    };
}

function findTrackDominanceAlternateDriverKey(sessionData, driverKey) {
    const selected = sessionData && sessionData.driverMap ? sessionData.driverMap[driverKey] : null;
    if (selected && selected.teamKey) {
        const team = sessionData.teamMap ? sessionData.teamMap[selected.teamKey] : null;
        const teammate = team && (team.drivers || []).filter(function(driver) {
            return driver.driverKey !== driverKey;
        })[0];
        if (teammate) return teammate.driverKey;
    }

    const fallback = (sessionData && sessionData.drivers ? sessionData.drivers : []).filter(function(driver) {
        return driver.driverKey !== driverKey;
    })[0];
    return fallback ? fallback.driverKey : '';
}

function getTrackDominanceDriverShortLabel(driver) {
    if (!driver) return 'Driver';
    if (driver.acronym) return driver.acronym;
    if (driver.fullName) return driver.fullName;
    return '#' + (driver.driverNumber || '?');
}

function buildTrackDominanceVisualPalette(leftDriver, rightDriver) {
    const leftHex = normalizeHexColor(leftDriver && leftDriver.teamColor ? leftDriver.teamColor : '3b82f6');
    let rightHex = normalizeHexColor(rightDriver && rightDriver.teamColor ? rightDriver.teamColor : '3b82f6');
    const sameTeam = !!(leftDriver && rightDriver && leftDriver.teamKey && rightDriver.teamKey && leftDriver.teamKey === rightDriver.teamKey);
    if (sameTeam || leftHex === rightHex) rightHex = adjustHexColor(rightHex, -34);
    return {
        sameTeam: sameTeam,
        leftHex: leftHex,
        rightHex: rightHex,
        leftChannels: hexToRgbChannels(leftHex),
        rightChannels: hexToRgbChannels(rightHex)
    };
}

function resolveTrackDominanceSelection(sessionData, preferredLeftKey, preferredRightKey, changedSide) {
    const drivers = sessionData && sessionData.drivers ? sessionData.drivers : [];
    const keys = drivers.map(function(driver) { return driver.driverKey; });
    if (keys.length < 2) return { leftDriverKey: '', rightDriverKey: '' };

    let leftDriverKey = keys.indexOf(preferredLeftKey) !== -1 ? preferredLeftKey : keys[0];
    let rightDriverKey = keys.indexOf(preferredRightKey) !== -1 ? preferredRightKey : keys[1];

    if (leftDriverKey === rightDriverKey) {
        if (changedSide === 'left') {
            rightDriverKey = findTrackDominanceAlternateDriverKey(sessionData, leftDriverKey);
        } else if (changedSide === 'right') {
            leftDriverKey = findTrackDominanceAlternateDriverKey(sessionData, rightDriverKey);
        } else {
            rightDriverKey = findTrackDominanceAlternateDriverKey(sessionData, leftDriverKey);
        }
    }

    return {
        leftDriverKey: leftDriverKey,
        rightDriverKey: rightDriverKey
    };
}

function buildTrackDominanceTooltipText(delta, leftName, rightName) {
    if (!isFiniteNumber(delta)) return 'Telemetry delta unavailable';
    if (Math.abs(delta) < 0.004) return 'Drivers are level at this point of the lap';
    const leader = delta <= 0 ? leftName : rightName;
    const trailer = delta <= 0 ? rightName : leftName;
    return leader + ' -' + Math.abs(delta).toFixed(3) + 's on ' + trailer;
}

function getTrackDominanceLapWindow(lapInfo, extraMs) {
    const start = new Date(lapInfo && lapInfo.dateStart);
    if (!lapInfo || !isFiniteNumber(lapInfo.duration) || !start || isNaN(start.getTime())) return null;
    const offset = typeof extraMs === 'number' ? extraMs : 260;
    return {
        start: new Date(start.getTime() - offset).toISOString(),
        end: new Date(start.getTime() + Math.round(lapInfo.duration * 1000) + offset).toISOString()
    };
}

function loadTrackDominanceLocationSamples(sessionKey, lapInfo) {
    if (!lapInfo || !lapInfo.driverNumber) return Promise.resolve([]);

    function fetchWindow(windowRange) {
        return fetchOpenF1ByDriverNumbers(
            OPENF1,
            'location',
            sessionKey,
            [lapInfo.driverNumber],
            'date>=' + encodeURIComponent(windowRange.start) + '&date<=' + encodeURIComponent(windowRange.end)
        );
    }

    const narrowWindow = getTrackDominanceLapWindow(lapInfo, 260);
    if (!narrowWindow) return Promise.resolve([]);

    return fetchWindow(narrowWindow).then(function(records) {
        if ((records || []).length >= 10) return records;
        const wideWindow = getTrackDominanceLapWindow(lapInfo, 850);
        return wideWindow ? fetchWindow(wideWindow) : [];
    });
}

function buildTrackDominanceSeries(samples, lapDuration) {
    const filtered = (samples || []).map(function(sample) {
        const dateValue = sample && (sample.date || sample.time);
        return {
            x: parseNumberValue(sample && sample.x),
            y: parseNumberValue(sample && sample.y),
            date: dateValue ? new Date(dateValue) : null
        };
    }).filter(function(sample) {
        return isFiniteNumber(sample.x) && isFiniteNumber(sample.y) && sample.date && !isNaN(sample.date.getTime());
    }).sort(function(a, b) {
        return a.date - b.date;
    });

    if (filtered.length < 6 || !isFiniteNumber(lapDuration) || lapDuration <= 0) return null;

    const baseTime = filtered[0].date.getTime();
    let cumulative = 0;
    const totalRawTime = Math.max((filtered[filtered.length - 1].date.getTime() - baseTime) / 1000, 0.001);
    const series = [];

    filtered.forEach(function(point, index) {
        if (index > 0) {
            const prev = filtered[index - 1];
            cumulative += Math.hypot(point.x - prev.x, point.y - prev.y);
        }

        series.push({
            x: point.x,
            y: point.y,
            progress: 0,
            time: ((point.date.getTime() - baseTime) / 1000) / totalRawTime * lapDuration
        });
    });

    if (cumulative <= 0.001) return null;

    let distance = 0;
    series.forEach(function(point, index) {
        if (index > 0) distance += Math.hypot(point.x - series[index - 1].x, point.y - series[index - 1].y);
        point.progress = distance / cumulative;
    });

    series[0].progress = 0;
    series[0].time = 0;
    series[series.length - 1].progress = 1;
    series[series.length - 1].time = lapDuration;
    return series;
}

function createTrackDominanceInterpolator(series) {
    let index = 0;
    return function(progress) {
        if (!series || !series.length) return null;
        if (progress <= 0) return series[0];
        if (progress >= 1) return series[series.length - 1];

        while (index < series.length - 2 && series[index + 1].progress < progress) index += 1;

        const start = series[index];
        const end = series[Math.min(index + 1, series.length - 1)];
        const span = end.progress - start.progress;
        const ratio = span > 0 ? (progress - start.progress) / span : 0;

        return {
            x: start.x + (end.x - start.x) * ratio,
            y: start.y + (end.y - start.y) * ratio,
            time: start.time + (end.time - start.time) * ratio
        };
    };
}

function orientTrackDominancePoints(points) {
    let oriented = (points || []).map(function(point) {
        return {
            x: point.x,
            y: point.y,
            delta: point.delta,
            progress: point.progress
        };
    });

    function getBounds(localPoints) {
        return localPoints.reduce(function(bounds, point) {
            return {
                minX: Math.min(bounds.minX, point.x),
                maxX: Math.max(bounds.maxX, point.x),
                minY: Math.min(bounds.minY, point.y),
                maxY: Math.max(bounds.maxY, point.y)
            };
        }, { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
    }

    if (!oriented.length) {
        return { points: [], viewWidth: 760, viewHeight: 580, pathD: '', startLine: null };
    }

    let bounds = getBounds(oriented);
    let width = Math.max(1, bounds.maxX - bounds.minX);
    let height = Math.max(1, bounds.maxY - bounds.minY);

    if (width > height) {
        oriented = oriented.map(function(point) {
            return { x: -point.y, y: point.x, delta: point.delta, progress: point.progress };
        });
        bounds = getBounds(oriented);
        height = Math.max(1, bounds.maxY - bounds.minY);
    }

    const midY = bounds.minY + (bounds.maxY - bounds.minY) / 2;
    if (oriented[0].y < midY) {
        oriented = oriented.map(function(point) {
            return { x: point.x, y: -point.y, delta: point.delta, progress: point.progress };
        });
        bounds = getBounds(oriented);
    }

    const viewWidth = 760;
    const viewHeight = 580;
    const padding = 48;
    const sourceWidth = Math.max(1, bounds.maxX - bounds.minX);
    const sourceHeight = Math.max(1, bounds.maxY - bounds.minY);
    const scale = Math.min(
        (viewWidth - padding * 2) / sourceWidth,
        (viewHeight - padding * 2) / sourceHeight
    );
    const offsetX = (viewWidth - sourceWidth * scale) / 2;
    const offsetY = (viewHeight - sourceHeight * scale) / 2;

    const scaledPoints = oriented.map(function(point) {
        return {
            x: offsetX + (point.x - bounds.minX) * scale,
            y: offsetY + (point.y - bounds.minY) * scale,
            delta: point.delta,
            progress: point.progress
        };
    });

    const pathD = scaledPoints.map(function(point, index) {
        return (index ? 'L' : 'M') + point.x.toFixed(2) + ' ' + point.y.toFixed(2);
    }).join(' ');

    let startLine = null;
    if (scaledPoints.length > 1) {
        for (let index = 1; index < scaledPoints.length; index++) {
            const dx = scaledPoints[index].x - scaledPoints[0].x;
            const dy = scaledPoints[index].y - scaledPoints[0].y;
            const length = Math.hypot(dx, dy);
            if (length <= 0.001) continue;

            const halfLength = 15;
            const perpX = -dy / length;
            const perpY = dx / length;
            startLine = {
                x1: scaledPoints[0].x - perpX * halfLength,
                y1: scaledPoints[0].y - perpY * halfLength,
                x2: scaledPoints[0].x + perpX * halfLength,
                y2: scaledPoints[0].y + perpY * halfLength
            };
            break;
        }
    }

    return {
        points: scaledPoints,
        viewWidth: viewWidth,
        viewHeight: viewHeight,
        pathD: pathD,
        startLine: startLine
    };
}

function buildTrackDominanceTrackMap(leftDriver, rightDriver, leftLocations, rightLocations) {
    const leftSeries = buildTrackDominanceSeries(leftLocations, leftDriver.bestLap.duration);
    const rightSeries = buildTrackDominanceSeries(rightLocations, rightDriver.bestLap.duration);
    if (!leftSeries || !rightSeries) return null;

    const sampleCount = 220;
    const leftInterpolator = createTrackDominanceInterpolator(leftSeries);
    const rightInterpolator = createTrackDominanceInterpolator(rightSeries);
    const rawPoints = [];
    let peakDelta = 0;
    const visualPalette = buildTrackDominanceVisualPalette(leftDriver, rightDriver);

    for (let index = 0; index < sampleCount; index++) {
        const progress = index / (sampleCount - 1);
        const leftPoint = leftInterpolator(progress);
        const rightPoint = rightInterpolator(progress);
        if (!leftPoint || !rightPoint) continue;

        const delta = leftPoint.time - rightPoint.time;
        rawPoints.push({
            x: (leftPoint.x + rightPoint.x) / 2,
            y: (leftPoint.y + rightPoint.y) / 2,
            delta: delta,
            progress: progress
        });

        if (!peakDelta || Math.abs(delta) > Math.abs(peakDelta)) peakDelta = delta;
    }

    const oriented = orientTrackDominancePoints(rawPoints);
    const segments = [];
    let leftLeadCount = 0;
    let rightLeadCount = 0;
    const leftChannels = visualPalette.leftChannels;
    const rightChannels = visualPalette.rightChannels;

    for (let segmentIndex = 0; segmentIndex < oriented.points.length - 1; segmentIndex++) {
        const start = oriented.points[segmentIndex];
        const end = oriented.points[segmentIndex + 1];
        const deltaMid = (start.delta + end.delta) / 2;
        const leader = deltaMid <= 0 ? 'left' : 'right';
        if (leader === 'left') leftLeadCount += 1;
        else rightLeadCount += 1;

        segments.push({
            x1: start.x,
            y1: start.y,
            x2: end.x,
            y2: end.y,
            colorChannels: leader === 'left' ? leftChannels : rightChannels,
            tooltip: buildTrackDominanceTooltipText(deltaMid, getTrackDominanceDriverShortLabel(leftDriver), getTrackDominanceDriverShortLabel(rightDriver)),
            leader: leader
        });
    }

    const totalSegments = Math.max(segments.length, 1);
    return {
        viewWidth: oriented.viewWidth,
        viewHeight: oriented.viewHeight,
        pathD: oriented.pathD,
        startLine: oriented.startLine,
        segments: segments,
        leftLeadPct: (leftLeadCount / totalSegments) * 100,
        rightLeadPct: (rightLeadCount / totalSegments) * 100,
        finishDelta: leftDriver.bestLap.duration - rightDriver.bestLap.duration,
        peakDelta: peakDelta
    };
}

function createTrackDominanceSkeleton() {
    return '<div class="track-dom-skeleton-card">'
        + '<div class="track-dom-skeleton-head"><div><div class="skel" style="width:200px;height:18px;"></div><div class="skel" style="width:250px;height:11px;margin-top:0.48rem;"></div></div><div class="skel" style="width:220px;height:46px;border-radius:12px;"></div></div>'
        + '<div class="track-dom-skeleton-selectors"><div class="skel" style="height:76px;border-radius:18px;"></div><div class="skel" style="height:76px;border-radius:18px;"></div></div>'
        + '<div class="track-dom-skeleton-duel"><div class="skel" style="height:160px;border-radius:20px;"></div><div class="skel" style="height:160px;border-radius:20px;"></div></div>'
        + '<div class="skel track-dom-skeleton-track"></div>'
        + '<div class="skel" style="width:72%;height:10px;margin-top:0.9rem;"></div>'
        + '</div>';
}

function buildTrackDominanceMetricComparison(leftLap, rightLap) {
    const definitions = [
        { key: 'speedTrap', label: 'TS', higherIsBetter: true, tolerance: 0.5, format: function(value) { return isFiniteNumber(value) ? String(Math.round(value)) : 'n/a'; } },
        { key: 'sector1', label: 'S1', higherIsBetter: false, tolerance: 0.001, format: function(value) { return formatLapTime(value, false); } },
        { key: 'sector2', label: 'S2', higherIsBetter: false, tolerance: 0.001, format: function(value) { return formatLapTime(value, false); } },
        { key: 'sector3', label: 'S3', higherIsBetter: false, tolerance: 0.001, format: function(value) { return formatLapTime(value, false); } }
    ];

    return definitions.reduce(function(acc, definition) {
        const leftValue = leftLap ? leftLap[definition.key] : NaN;
        const rightValue = rightLap ? rightLap[definition.key] : NaN;
        let leftState = 'na';
        let rightState = 'na';

        if (isFiniteNumber(leftValue) && isFiniteNumber(rightValue)) {
            const diff = leftValue - rightValue;
            if (Math.abs(diff) <= definition.tolerance) {
                leftState = 'level';
                rightState = 'level';
            } else {
                const leftIsBetter = definition.higherIsBetter ? diff > 0 : diff < 0;
                leftState = leftIsBetter ? 'better' : 'worse';
                rightState = leftIsBetter ? 'worse' : 'better';
            }
        } else if (isFiniteNumber(leftValue)) {
            leftState = 'level';
        } else if (isFiniteNumber(rightValue)) {
            rightState = 'level';
        }

        acc[definition.key] = {
            label: definition.label,
            leftText: definition.format(leftValue),
            rightText: definition.format(rightValue),
            leftState: leftState,
            rightState: rightState
        };
        return acc;
    }, {});
}

function renderTrackDominanceMetricStrip(side, comparison) {
    const order = side === 'right'
        ? ['sector1', 'sector2', 'sector3', 'speedTrap']
        : ['speedTrap', 'sector1', 'sector2', 'sector3'];
    const textKey = side === 'right' ? 'rightText' : 'leftText';
    const stateKey = side === 'right' ? 'rightState' : 'leftState';
    let html = '<div class="track-dom-team-metrics ' + side + '">';

    order.forEach(function(metricKey) {
        const metric = comparison && comparison[metricKey] ? comparison[metricKey] : null;
        const valueText = metric ? metric[textKey] : 'n/a';
        const state = metric ? metric[stateKey] : 'na';

        html += '<div class="track-dom-team-metric">'
            + '<span class="track-dom-team-metric-label">' + esc(metric ? metric.label : metricKey.toUpperCase()) + '</span>'
            + '<span class="track-dom-team-metric-value is-' + esc(state) + '">' + esc(valueText) + '</span>'
            + '</div>';
    });

    return html + '</div>';
}

function renderTrackDominanceDriverCard(side, driver, colorChannels, metricComparison) {
    const lap = driver.bestLap;
    const logoMarkup = driver.logo
        ? '<img src="' + esc(driver.logo) + '" alt="' + esc(driver.teamName) + '" width="46" height="46" loading="lazy" decoding="async"><div class="track-dom-team-logo-fallback" style="display:none;">' + esc(getTrackDominanceShortName(driver.teamName)) + '</div>'
        : '<div class="track-dom-team-logo-fallback">' + esc(getTrackDominanceShortName(driver.teamName)) + '</div>';

    return '<article class="track-dom-team-card ' + side + '" style="--team-color:' + esc(colorChannels) + ';">'
        + '<div class="track-dom-team-top"><div class="track-dom-team-logo">' + logoMarkup + '</div><div class="track-dom-team-copy"><div class="track-dom-team-name">' + esc(driver.fullName || getTrackDominanceDriverShortLabel(driver)) + '</div><div class="track-dom-team-driver">' + esc(driver.teamName + ' · ' + getTrackDominanceDriverShortLabel(driver) + ' · Lap ' + lap.lapNumber) + '</div></div></div>'
        + '<div class="track-dom-team-time">' + esc(formatLapTime(lap.duration, true)) + '</div>'
        + renderTrackDominanceMetricStrip(side, metricComparison)
        + '</article>';
}

function renderTrackDominance(sessionData, pairData, session) {
    if (!trackDominanceTable) return;

    if (!sessionData || !session || !sessionData.drivers || sessionData.drivers.length < 2) {
        trackDominanceTable.innerHTML = '<div class="track-dom-empty-card">'
            + '<svg class="icon" aria-hidden="true"><use href="#fa-route"/></svg>'
            + '<p>Δεν υπάρχουν ακόμη αρκετά telemetry laps για driver comparison.</p>'
            + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το tab ενεργοποιείται μόλις υπάρξουν completed sessions με valid fastest laps για τουλάχιστον δύο οδηγούς.</p>'
            + '</div>';
        fireRendered();
        return;
    }

    const sessionOptions = state.sessions.slice().reverse().map(function(item) {
        return '<option value="' + esc(item.session_key) + '"' + (String(item.session_key) === String(state.selectedSessionKey) ? ' selected' : '') + '>' + esc((item.meeting_name || item.circuit_short_name || item.location || 'Session') + ' · ' + (item.session_name || item.session_type || 'Session') + (formatSessionDateShort(item) ? ' · ' + formatSessionDateShort(item) : '')) + '</option>';
    }).join('');

    const leftDriverOptions = sessionData.teams.map(function(team) {
        return '<optgroup label="' + esc(team.teamName) + '">' + team.drivers.map(function(driver) {
            return '<option value="' + esc(driver.driverKey) + '"' + (driver.driverKey === state.leftDriverKey ? ' selected' : '') + '>' + esc(driver.fullName + ' · ' + getTrackDominanceDriverShortLabel(driver) + ' · ' + formatLapTime(driver.bestLap.duration, true)) + '</option>';
        }).join('') + '</optgroup>';
    }).join('');
    const rightDriverOptions = sessionData.teams.map(function(team) {
        return '<optgroup label="' + esc(team.teamName) + '">' + team.drivers.map(function(driver) {
            return '<option value="' + esc(driver.driverKey) + '"' + (driver.driverKey === state.rightDriverKey ? ' selected' : '') + '>' + esc(driver.fullName + ' · ' + getTrackDominanceDriverShortLabel(driver) + ' · ' + formatLapTime(driver.bestLap.duration, true)) + '</option>';
        }).join('') + '</optgroup>';
    }).join('');

    const leftDriver = sessionData.driverMap[state.leftDriverKey];
    const rightDriver = sessionData.driverMap[state.rightDriverKey];
    if (!leftDriver || !rightDriver) {
        trackDominanceTable.innerHTML = '<div class="track-dom-empty-card">'
            + '<svg class="icon" aria-hidden="true"><use href="#fa-route"/></svg>'
            + '<p>Δεν ήταν δυνατή η φόρτωση των selected drivers για το session.</p>'
            + '</div>';
        fireRendered();
        return;
    }

    const visualPalette = buildTrackDominanceVisualPalette(leftDriver, rightDriver);
    const leftChannels = visualPalette.leftChannels;
    const rightChannels = visualPalette.rightChannels;
    const metricComparison = buildTrackDominanceMetricComparison(leftDriver.bestLap, rightDriver.bestLap);
    const finishDelta = pairData ? pairData.finishDelta : leftDriver.bestLap.duration - rightDriver.bestLap.duration;
    const finishLeader = finishDelta <= 0 ? getTrackDominanceDriverShortLabel(leftDriver) : getTrackDominanceDriverShortLabel(rightDriver);
    const finishTrailer = finishDelta <= 0 ? getTrackDominanceDriverShortLabel(rightDriver) : getTrackDominanceDriverShortLabel(leftDriver);

    let html = '<div class="track-dom-card">'
        + '<div class="track-dom-head"><div class="track-dom-head-copy"><h3 class="track-dom-head-title">Fastest-Lap Track Dominance</h3><p class="track-dom-head-note">Η γραμμή χρωματίζεται με βάση το ποιος οδηγός είναι μπροστά στο ίδιο σημείο του γύρου, χρησιμοποιώντας το fastest lap κάθε selected driver στο session.</p></div><label class="track-dom-controls"><span class="track-dom-controls-label">Available sessions</span><select class="track-dom-select" data-track-dom-session aria-label="Επιλογή session για track dominance">' + sessionOptions + '</select></label></div>'
        + '<div class="track-dom-team-pickers">'
        + '<label class="track-dom-controls"><span class="track-dom-controls-label">Driver 1</span><select class="track-dom-select" data-track-dom-driver="left" aria-label="Επιλογή πρώτου οδηγού για track dominance">' + leftDriverOptions + '</select></label>'
        + '<label class="track-dom-controls"><span class="track-dom-controls-label">Driver 2</span><select class="track-dom-select" data-track-dom-driver="right" aria-label="Επιλογή δεύτερου οδηγού για track dominance">' + rightDriverOptions + '</select></label>'
        + '</div>'
        + '<div class="track-dom-duel">'
        + renderTrackDominanceDriverCard('left', leftDriver, leftChannels, metricComparison)
        + '<div class="track-dom-vs-card"><div class="track-dom-vs-label">Session</div><div class="track-dom-vs-title">' + esc(session.meeting_name || session.circuit_short_name || session.location || 'Track') + '</div><div class="track-dom-vs-sub">' + esc((session.session_name || session.session_type || 'Session') + (formatSessionDateShort(session) ? ' · ' + formatSessionDateShort(session) : '')) + '</div><div class="track-dom-vs-delta">' + esc(finishLeader + ' -' + Math.abs(finishDelta).toFixed(3) + 's') + '</div><div class="track-dom-vs-note">on ' + esc(finishTrailer) + '</div></div>'
        + renderTrackDominanceDriverCard('right', rightDriver, rightChannels, metricComparison)
        + '</div>';

    if (!pairData || !pairData.pathD || !pairData.segments.length) {
        html += '<div class="track-dom-map-empty"><svg class="icon" aria-hidden="true"><use href="#fa-location-crosshairs"/></svg><p>Υπάρχουν lap times αλλά όχι αρκετά location samples για να χτιστεί το track map αυτής της σύγκρισης.</p></div>';
    } else {
        let svg = '<svg class="track-dom-track-svg" viewBox="0 0 ' + pairData.viewWidth + ' ' + pairData.viewHeight + '" preserveAspectRatio="xMidYMid meet" aria-label="Track dominance comparison map">'
            + '<path class="track-dom-track-base" d="' + esc(pairData.pathD) + '"></path>';

        pairData.segments.forEach(function(segment) {
            svg += '<line class="track-dom-segment" x1="' + segment.x1.toFixed(2) + '" y1="' + segment.y1.toFixed(2) + '" x2="' + segment.x2.toFixed(2) + '" y2="' + segment.y2.toFixed(2) + '" style="--team-color:' + esc(segment.colorChannels) + ';" data-tooltip="' + esc(segment.tooltip) + '"><title>' + esc(segment.tooltip) + '</title></line>';
        });

        if (pairData.startLine) {
            svg += '<line class="track-dom-track-start-line-backdrop" x1="' + pairData.startLine.x1.toFixed(2) + '" y1="' + pairData.startLine.y1.toFixed(2) + '" x2="' + pairData.startLine.x2.toFixed(2) + '" y2="' + pairData.startLine.y2.toFixed(2) + '"></line>'
                + '<line class="track-dom-track-start-line" x1="' + pairData.startLine.x1.toFixed(2) + '" y1="' + pairData.startLine.y1.toFixed(2) + '" x2="' + pairData.startLine.x2.toFixed(2) + '" y2="' + pairData.startLine.y2.toFixed(2) + '"></line>'
                + '<line class="track-dom-track-start-line-checker" x1="' + pairData.startLine.x1.toFixed(2) + '" y1="' + pairData.startLine.y1.toFixed(2) + '" x2="' + pairData.startLine.x2.toFixed(2) + '" y2="' + pairData.startLine.y2.toFixed(2) + '"></line>';
        }

        svg += '</svg>';

        html += '<div class="track-dom-map-card">'
            + '<div class="track-dom-map-meta"><div class="track-dom-map-title">Track Dominance Map</div><div class="track-dom-map-note">Hover το track για live delta tooltip · η checkered γραμμή δείχνει το start/finish.</div></div>'
            + '<div class="track-dom-track-shell" data-track-dom-shell>' + svg + '<div class="track-dom-tooltip" data-track-dom-tooltip></div></div>'
            + '<div class="track-dom-advantage">'
            + '<div class="track-dom-advantage-head"><span class="track-dom-advantage-team left" style="--team-color:' + esc(leftChannels) + ';">' + esc(getTrackDominanceDriverShortLabel(leftDriver)) + ' ahead ' + esc(Math.round(pairData.leftLeadPct)) + '%</span><span class="track-dom-advantage-team right" style="--team-color:' + esc(rightChannels) + ';">' + esc(getTrackDominanceDriverShortLabel(rightDriver)) + ' ahead ' + esc(Math.round(pairData.rightLeadPct)) + '%</span></div>'
            + '<div class="track-dom-advantage-bar"><span class="track-dom-advantage-fill left" style="--team-color:' + esc(leftChannels) + ';width:' + pairData.leftLeadPct.toFixed(2) + '%;"></span><span class="track-dom-advantage-fill right" style="--team-color:' + esc(rightChannels) + ';width:' + pairData.rightLeadPct.toFixed(2) + '%;"></span></div>'
            + '<div class="track-dom-advantage-note">' + esc(finishLeader + ' -' + Math.abs(finishDelta).toFixed(3) + 's on ' + finishTrailer) + ' · peak swing ' + esc(Math.abs(pairData.peakDelta).toFixed(3)) + 's</div>'
            + '</div>'
            + '</div>';
    }

    html += '<p class="track-dom-footnote">Source: OpenF1 `laps` + `location`. Κάθε selected driver εκπροσωπείται από το single fastest lap του στο session.</p></div>';

    trackDominanceTable.innerHTML = html;
    fireRendered();
}

function showTrackDominanceError() {
    if (!trackDominanceTable) return;
    trackDominanceTable.innerHTML = '<div class="track-dom-empty-card">'
        + '<svg class="icon" aria-hidden="true"><use href="#fa-exclamation-triangle"/></svg>'
        + '<p>Δεν ήταν δυνατή η φόρτωση του track dominance chart.</p>'
        + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το OpenF1 telemetry endpoint ίσως να μην είναι διαθέσιμο προσωρινά.</p>'
        + '<button class="retry-btn" type="button" onclick="window.__retryTrackDominance && window.__retryTrackDominance()"><svg class="icon" aria-hidden="true"><use href="#fa-redo"/></svg> Νέα προσπάθεια</button>'
        + '</div>';
    fireRendered();
}

function loadTrackDominanceSessionData(sessionKey) {
    const cacheKey = String(sessionKey);
    const session = (state.sessions || []).filter(function(item) {
        return String(item.session_key) === cacheKey;
    })[0];
    if (!session) return Promise.reject(new Error('Unknown track dominance session'));
    if (state.sessionCache[cacheKey]) return Promise.resolve(state.sessionCache[cacheKey]);

    return Promise.all([
        fetchOpenF1BySessionKeys(OPENF1, 'drivers', [session.session_key]),
        fetchOpenF1BySessionKeys(OPENF1, 'laps', [session.session_key])
    ]).then(function(payload) {
        const built = buildTrackDominanceSessionData(session, payload[0], payload[1]);
        state.sessionCache[cacheKey] = built;
        return built;
    });
}

function loadTrackDominancePairData(session, sessionData, leftDriverKey, rightDriverKey) {
    const cacheKey = [session.session_key, leftDriverKey, rightDriverKey].join('|');
    if (state.pairCache[cacheKey]) return Promise.resolve(state.pairCache[cacheKey]);

    const leftDriver = sessionData.driverMap[leftDriverKey];
    const rightDriver = sessionData.driverMap[rightDriverKey];
    if (!leftDriver || !rightDriver) return Promise.resolve(null);

    return Promise.all([
        loadTrackDominanceLocationSamples(session.session_key, leftDriver.bestLap),
        loadTrackDominanceLocationSamples(session.session_key, rightDriver.bestLap)
    ]).then(function(payload) {
        const built = buildTrackDominanceTrackMap(leftDriver, rightDriver, payload[0], payload[1]);
        state.pairCache[cacheKey] = built;
        return built;
    });
}

function loadAndRenderTrackDominance(useSkeleton) {
    if (!trackDominanceTable) return;
    if (state.loading) {
        state.pendingReload = true;
        return;
    }

    state.loading = true;
    state.pendingReload = false;
    if (useSkeleton) trackDominanceTable.innerHTML = createTrackDominanceSkeleton();

    const sessionsPromise = state.sessions.length
        ? Promise.resolve(state.sessions)
        : getCompletedTrackDominanceSessions().then(function(sessions) {
            state.sessions = sessions;
            return sessions;
        });

    sessionsPromise.then(function(sessions) {
        if (!sessions.length) return { session: null, sessionData: null, pairData: null };

        if (!state.selectedSessionKey || !sessions.some(function(item) { return String(item.session_key) === String(state.selectedSessionKey); })) {
            state.selectedSessionKey = String(sessions[sessions.length - 1].session_key);
        }

        const selectedSession = sessions.filter(function(item) {
            return String(item.session_key) === String(state.selectedSessionKey);
        })[0];

        return loadTrackDominanceSessionData(state.selectedSessionKey).then(function(sessionData) {
            const selection = resolveTrackDominanceSelection(sessionData, state.leftDriverKey, state.rightDriverKey);
            state.leftDriverKey = selection.leftDriverKey;
            state.rightDriverKey = selection.rightDriverKey;

            if (!selection.leftDriverKey || !selection.rightDriverKey) {
                return {
                    session: selectedSession,
                    sessionData: sessionData,
                    pairData: null
                };
            }

            return loadTrackDominancePairData(selectedSession, sessionData, selection.leftDriverKey, selection.rightDriverKey).then(function(pairData) {
                return {
                    session: selectedSession,
                    sessionData: sessionData,
                    pairData: pairData
                };
            });
        });
    }).then(function(payload) {
        renderTrackDominance(payload.sessionData, payload.pairData, payload.session);
        state.loaded = true;
    }).catch(function(error) {
        console.error('Track dominance error:', error);
        showTrackDominanceError();
    }).finally(function() {
        state.loading = false;
        if (state.pendingReload) {
            state.pendingReload = false;
            loadAndRenderTrackDominance(true);
        }
    });
}

function hideTrackDominanceTooltip() {
    if (!trackDominanceTable) return;
    trackDominanceTable.querySelectorAll('[data-track-dom-tooltip]').forEach(function(tooltip) {
        tooltip.classList.remove('is-active');
    });
}

function updateTrackDominanceTooltip(segment, event) {
    if (!segment) {
        hideTrackDominanceTooltip();
        return;
    }

    const shell = segment.closest('[data-track-dom-shell]');
    const tooltip = shell ? shell.querySelector('[data-track-dom-tooltip]') : null;
    if (!shell || !tooltip) return;

    const rect = shell.getBoundingClientRect();
    const x = clampNumber(event.clientX - rect.left, 72, rect.width - 72);
    const y = clampNumber(event.clientY - rect.top, 56, rect.height - 28);

    tooltip.textContent = segment.getAttribute('data-tooltip') || '';
    tooltip.style.left = x.toFixed(1) + 'px';
    tooltip.style.top = y.toFixed(1) + 'px';
    tooltip.classList.add('is-active');
}

window.__retryTrackDominance = function() {
    state.loaded = false;
    loadAndRenderTrackDominance(true);
};
