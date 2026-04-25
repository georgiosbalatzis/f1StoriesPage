// Dirty Air tab — standalone ES module (Phase 6C, step 6).
//
// Extracted from standings.legacy.js so direct landings on
// ?tab=dirty-air no longer need the legacy bundle. The module owns its own
// DOM query (#dirty-air-table), cache-bundle reuse, live OpenF1 telemetry
// fetch path, session select, and summary/timeline view toggle. The
// orchestrator (standings.js) imports this lazily, wires onRendered /
// onSessionChange once via initDirtyAir(), and syncs deep links through
// getSelectedSession() / setSelectedSession().

import { esc } from '../core/format.js';
import { getCanonicalTeamColor, getCanonicalTeamName } from '../core/teams.js';
import {
    fetchJSON,
    fetchJSONWithTimeout,
    fetchOpenF1BySessionKeys,
    fetchOpenF1ByDriverNumbers
} from '../core/fetchers.js';
import { parseNumberValue, isFiniteNumber, parseTimeSeconds } from './_shared.js';

const OPENF1 = 'https://api.openf1.org/v1';
const DIRTY_AIR_CACHE_URL = 'dirty-air-cache.json';
const YEAR = new Date().getFullYear();

const dirtyAirTable = document.getElementById('dirty-air-table');

const state = {
    loaded: false,
    loading: false,
    pendingReload: false,
    sessions: [],
    selectedSessionKey: '',
    activeView: 'summary',
    sessionCache: {},
    cacheBundle: null,
    cachePromise: null,
    cacheAttempted: false
};

let DIRTY_AIR_MINISECTORS = 30;
const DIRTY_AIR_CATEGORIES = [
    { key: 'drs', label: 'DRS', range: '<= 1.0s', color: 'ef4444' },
    { key: 'heavy', label: 'Heavy', range: '1.0-2.0s', color: 'f97316' },
    { key: 'low', label: 'Low', range: '2.0-4.0s', color: 'eab308' },
    { key: 'clean', label: 'Clean Air', range: '> 4.0s', color: '22c55e' }
];

let onRendered = null;
let onSessionChange = null;
let listenersBound = false;

export function initDirtyAir(options) {
    if (options && typeof options.onRendered === 'function') onRendered = options.onRendered;
    if (options && typeof options.onSessionChange === 'function') onSessionChange = options.onSessionChange;

    if (!listenersBound && dirtyAirTable) {
        // Capture-phase binding + stopImmediatePropagation so the legacy
        // bundle's click/change handlers cannot also re-render using its
        // private dirtyAirState after the orchestrator takes ownership.
        dirtyAirTable.addEventListener('click', handleTableClick, true);
        dirtyAirTable.addEventListener('change', handleSessionChange, true);
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
    if (state.loading) {
        state.pendingReload = true;
        return;
    }
    if (state.loaded) renderSelectedSession(true);
}

export function ensureLoaded(forceReload) {
    if (!dirtyAirTable) return;
    if (state.loading) return;
    if (state.loaded && !forceReload) {
        const cached = state.sessionCache[String(state.selectedSessionKey)];
        const selectedSession = getSelectedSessionRecord();
        if (cached && selectedSession) {
            renderDirtyAir(cached, selectedSession);
            return;
        }
    }
    loadAndRenderDirtyAir(true);
}

function fireRendered() {
    if (onRendered) onRendered('dirty-air');
}

function sanitizeView(value) {
    return value === 'timeline' ? 'timeline' : 'summary';
}

function applyViewState() {
    if (!dirtyAirTable) return;
    const activeView = sanitizeView(state.activeView);
    dirtyAirTable.querySelectorAll('[data-dirty-air-view]').forEach(function(btn) {
        const isActive = btn.getAttribute('data-dirty-air-view') === activeView;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    dirtyAirTable.querySelectorAll('[data-dirty-air-panel]').forEach(function(panel) {
        panel.classList.toggle('active', panel.getAttribute('data-dirty-air-panel') === activeView);
    });
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

function renderSelectedSession(useSkeleton) {
    if (!dirtyAirTable) return;
    if (state.loading) {
        state.pendingReload = true;
        return;
    }

    const selectedSession = getSelectedSessionRecord();
    if (!selectedSession) {
        renderDirtyAir(null, null);
        return;
    }

    const cacheKey = String(selectedSession.session_key);
    const cached = state.sessionCache[cacheKey];
    if (cached && shouldReuseDirtyAirSessionCache(cached)) {
        renderDirtyAir(cached, selectedSession);
        return;
    }

    state.loaded = false;
    loadAndRenderDirtyAir(useSkeleton);
}

function handleTableClick(event) {
    const viewTab = event.target.closest('[data-dirty-air-view]');
    if (!viewTab) return;

    const nextView = sanitizeView(viewTab.getAttribute('data-dirty-air-view'));
    if (nextView === state.activeView) return;

    event.stopImmediatePropagation();
    state.activeView = nextView;
    applyViewState();
}

function handleSessionChange(event) {
    const raceSelect = event.target.closest('[data-dirty-air-select]');
    if (!raceSelect) return;

    event.stopImmediatePropagation();
    state.selectedSessionKey = raceSelect.value;
    state.loaded = false;
    if (onSessionChange) onSessionChange(state.selectedSessionKey);
    loadAndRenderDirtyAir(true);
}

function isCompletedSession(session) {
    if (!session || session.is_cancelled) return false;
    const dateValue = session.date_end || session.date_start || session.date;
    return dateValue ? new Date(dateValue) <= new Date() : false;
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

function getCompletedRaceSessions() {
    return fetchJSON(OPENF1 + '/sessions?year=' + YEAR + '&session_type=Race').then(function(sessions) {
        return (sessions || []).filter(function(session) {
            const sessionName = ((session && session.session_name) || '').toLowerCase();
            return isCompletedSession(session) && sessionName.indexOf('sprint') === -1;
        }).sort(function(a, b) {
            return new Date(a.date_start || a.date || 0) - new Date(b.date_start || b.date || 0);
        });
    });
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
            teamColor: getCanonicalTeamColor('', driver.team_name || '', driver.team_colour || ''),
            meetingKey: driver.meeting_key || ''
        };
    });
    return lookup;
}

function getDirtyAirCategoryMeta(categoryKey) {
    for (let index = 0; index < DIRTY_AIR_CATEGORIES.length; index++) {
        if (DIRTY_AIR_CATEGORIES[index].key === categoryKey) return DIRTY_AIR_CATEGORIES[index];
    }
    return DIRTY_AIR_CATEGORIES[DIRTY_AIR_CATEGORIES.length - 1];
}

function getDirtyAirCategoryKey(gapSeconds) {
    if (!isFiniteNumber(gapSeconds) || gapSeconds > 4) return 'clean';
    if (gapSeconds <= 1) return 'drs';
    if (gapSeconds <= 2) return 'heavy';
    return 'low';
}

function getDirtyAirAxisStep(maxLaps) {
    if (maxLaps <= 18) return 2;
    if (maxLaps <= 40) return 4;
    if (maxLaps <= 70) return 4;
    return 5;
}

function buildDirtyAirSummarySegments(totalCells, counts) {
    const safeCounts = counts || {};
    const resolvedTotal = isFiniteNumber(totalCells) ? totalCells : DIRTY_AIR_CATEGORIES.reduce(function(sum, category) {
        return sum + (parseInt(safeCounts[category.key], 10) || 0);
    }, 0);
    let offset = 0;

    return DIRTY_AIR_CATEGORIES.map(function(category) {
        const categoryCount = parseInt(safeCounts[category.key], 10) || 0;
        const percentage = resolvedTotal ? (categoryCount / resolvedTotal) * 100 : 0;
        const segment = {
            key: category.key,
            label: category.label,
            color: category.color,
            percentage: percentage,
            offset: offset
        };
        offset += percentage;
        return segment;
    }).filter(function(segment) {
        return segment.percentage > 0;
    });
}

function parseDirtyAirInteger(value) {
    const parsed = parseInt(value, 10);
    return isFinite(parsed) ? parsed : 0;
}

function normalizeDirtyAirCachedLaps(laps) {
    return (laps || []).map(function(lap) {
        const lapNumber = parseDirtyAirInteger(lap && (lap.lapNumber != null ? lap.lapNumber : lap.lap_number));
        const cells = (lap && lap.cells || []).map(function(cell) {
            const rawCategoryKey = cell && (cell.categoryKey || cell.category_key || cell.bucket);
            const gapSeconds = parseFloat(cell && (cell.gapSeconds != null ? cell.gapSeconds : cell.gap_seconds));

            return {
                minisector: parseDirtyAirInteger(cell && (cell.minisector != null ? cell.minisector : cell.minisector_index)),
                categoryKey: rawCategoryKey ? getDirtyAirCategoryMeta(String(rawCategoryKey)).key : getDirtyAirCategoryKey(gapSeconds)
            };
        }).filter(function(cell) {
            return cell.minisector >= 0 && cell.minisector < DIRTY_AIR_MINISECTORS;
        }).sort(function(a, b) {
            return a.minisector - b.minisector;
        });

        return {
            lapNumber: lapNumber,
            cells: cells
        };
    }).filter(function(lap) {
        return lap.lapNumber > 0 && lap.cells.length;
    }).sort(function(a, b) {
        return a.lapNumber - b.lapNumber;
    });
}

function normalizeDirtyAirSummaryData(summary, counts, totalCells, cachedLaps) {
    const safeCounts = {};
    const derivedFromLaps = cachedLaps && cachedLaps.length ? buildDirtyAirSummary({ laps: cachedLaps }) : null;
    const summarySegments = summary && summary.segments || [];
    let resolvedTotal = parseDirtyAirInteger(summary && summary.totalCells) || parseDirtyAirInteger(totalCells);

    DIRTY_AIR_CATEGORIES.forEach(function(category) {
        let count = parseInt(
            summary && summary.counts ? summary.counts[category.key] : (counts && counts[category.key]),
            10
        ) || 0;

        if (!count) {
            summarySegments.some(function(segment) {
                const segmentKey = segment && segment.key ? String(segment.key) : '';
                if (segmentKey !== category.key) return false;
                count = parseDirtyAirInteger(segment && (segment.count != null ? segment.count : segment.totalCells));
                return count > 0;
            });
        }

        if (!count && derivedFromLaps) count = derivedFromLaps.counts[category.key] || 0;
        safeCounts[category.key] = count;
    });

    if (!resolvedTotal && summarySegments.length) {
        resolvedTotal = DIRTY_AIR_CATEGORIES.reduce(function(sum, category) {
            return sum + safeCounts[category.key];
        }, 0);
    }

    if (!resolvedTotal && derivedFromLaps) resolvedTotal = derivedFromLaps.totalCells || 0;

    if (!resolvedTotal) {
        resolvedTotal = DIRTY_AIR_CATEGORIES.reduce(function(sum, category) {
            return sum + safeCounts[category.key];
        }, 0);
    }

    if (resolvedTotal && !DIRTY_AIR_CATEGORIES.some(function(category) { return safeCounts[category.key] > 0; })) {
        summarySegments.forEach(function(segment) {
            const segmentKey = segment && segment.key ? String(segment.key) : '';
            const percentage = parseFloat(segment && (segment.percentage != null ? segment.percentage : segment.share));
            if (!segmentKey || !isFinite(percentage) || percentage <= 0) return;
            safeCounts[segmentKey] = Math.round((percentage / 100) * resolvedTotal);
        });
    }

    return {
        totalCells: resolvedTotal,
        counts: safeCounts,
        segments: buildDirtyAirSummarySegments(resolvedTotal, safeCounts)
    };
}

function normalizeDirtyAirTimelineSegments(segments, cachedLaps) {
    const normalized = (segments || []).map(function(segment) {
        const key = segment && segment.key ? segment.key : 'clean';
        return {
            key: key,
            color: segment && segment.color ? segment.color : getDirtyAirCategoryMeta(key).color,
            startIndex: parseInt(segment && segment.startIndex, 10) || 0,
            endIndex: parseInt(segment && segment.endIndex, 10) || 0
        };
    }).filter(function(segment) {
        return segment.endIndex > segment.startIndex;
    });

    if (normalized.length || !cachedLaps || !cachedLaps.length) return normalized;
    return buildDirtyAirTimelineSegments({ laps: cachedLaps });
}

function normalizeDirtyAirCacheSession(session) {
    if (!session || session.session_key == null || !(session.rows && session.rows.length)) return null;

    const normalized = {
        session_key: session.session_key,
        meeting_name: session.meeting_name || '',
        circuit_short_name: session.circuit_short_name || '',
        location: session.location || '',
        country_name: session.country_name || '',
        session_name: session.session_name || '',
        session_type: session.session_type || '',
        date_start: session.date_start || session.date || '',
        date_end: session.date_end || '',
        maxLaps: parseInt(session.maxLaps, 10) || 0,
        safetyCarSpans: (session.safetyCarSpans || []).map(function(span) {
            return {
                startLap: parseInt(span && span.startLap, 10) || 0,
                endLap: parseInt(span && span.endLap, 10) || 0
            };
        }).filter(function(span) {
            return span.startLap > 0 && span.endLap >= span.startLap;
        }),
        rows: []
    };

    normalized.rows = (session.rows || []).map(function(row) {
        const cachedLaps = normalizeDirtyAirCachedLaps(row && row.laps);
        const timelineSegments = normalizeDirtyAirTimelineSegments(row && row.timelineSegments, cachedLaps);
        const completedLaps = parseDirtyAirInteger(row && row.completedLaps)
            || cachedLaps.reduce(function(maxLap, lap) {
                return Math.max(maxLap, lap.lapNumber || 0);
            }, 0)
            || timelineSegments.reduce(function(maxLap, segment) {
                return Math.max(maxLap, Math.ceil((segment.endIndex || 0) / DIRTY_AIR_MINISECTORS));
            }, 0);

        return {
            driverNumber: row && row.driverNumber != null ? String(row.driverNumber) : '',
            position: parseInt(row && row.position, 10) || 999,
            acronym: row && row.acronym ? String(row.acronym).toUpperCase() : 'DRV',
            fullName: row && row.fullName ? String(row.fullName) : '',
            headshot: row && row.headshot ? String(row.headshot) : '',
            teamName: row && row.teamName ? String(row.teamName) : 'Team',
            teamColor: row && row.teamColor ? String(row.teamColor) : '3b82f6',
            completedLaps: completedLaps,
            summary: normalizeDirtyAirSummaryData(row && row.summary, row && row.counts, row && row.totalCells, cachedLaps),
            timelineSegments: timelineSegments
        };
    }).sort(function(a, b) {
        if (a.position !== b.position) return a.position - b.position;
        if (a.completedLaps !== b.completedLaps) return b.completedLaps - a.completedLaps;
        return a.acronym.localeCompare(b.acronym);
    });

    if (!normalized.maxLaps) {
        normalized.maxLaps = normalized.rows.reduce(function(maxLap, row) {
            return Math.max(maxLap, row.completedLaps || 0);
        }, 0);
    }

    return normalized;
}

function hasRenderableDirtyAirRows(sessionData) {
    return !!(sessionData && sessionData.rows || []).some(function(row) {
        return row && (
            (row.summary && row.summary.totalCells > 0)
            || (row.timelineSegments && row.timelineSegments.length > 0)
        );
    });
}

function shouldReuseDirtyAirSessionCache(sessionData) {
    if (!sessionData) return false;
    if (hasRenderableDirtyAirRows(sessionData)) return true;

    const rows = sessionData.rows || [];
    if (!rows.length) return false;

    return rows.some(function(row) {
        return row && (
            (row.completedLaps || 0) > 0
            || (row.summary && row.summary.totalCells > 0)
            || (row.timelineSegments && row.timelineSegments.length > 0)
        );
    });
}

function loadDirtyAirCacheBundle() {
    if (state.cacheBundle) return Promise.resolve(state.cacheBundle);
    if (state.cacheAttempted) return Promise.resolve(null);
    if (state.cachePromise) return state.cachePromise;

    state.cacheAttempted = true;
    state.cachePromise = fetchJSONWithTimeout(DIRTY_AIR_CACHE_URL, 12000).then(function(bundle) {
        if (parseDirtyAirInteger(bundle && bundle.minisectors) > 0) {
            DIRTY_AIR_MINISECTORS = parseDirtyAirInteger(bundle.minisectors);
        }
        const sessions = (bundle && bundle.sessions || []).map(normalizeDirtyAirCacheSession).filter(Boolean);
        state.cacheBundle = {
            version: bundle && bundle.version,
            year: bundle && bundle.year,
            generatedAt: bundle && bundle.generatedAt,
            minisectors: bundle && bundle.minisectors,
            sessions: sessions
        };

        if (sessions.length) {
            state.sessions = sessions;
            sessions.forEach(function(session) {
                state.sessionCache[String(session.session_key)] = session;
            });
        }

        return state.cacheBundle;
    }).catch(function(error) {
        console.warn('Dirty air cache unavailable:', error);
        return null;
    });

    return state.cachePromise;
}

function createDirtyAirSkeleton() {
    let summaryRows = '';
    let timelineRows = '';

    for (let i = 0; i < 8; i++) {
        summaryRows += '<div class="dirty-air-summary-row">'
            + '<div class="skel" style="width:44px;height:16px;border-radius:999px;"></div>'
            + '<div class="skel" style="width:100%;height:18px;border-radius:999px;"></div>'
            + '</div>';
    }

    for (let j = 0; j < 8; j++) {
        timelineRows += '<div class="dirty-air-timeline-row">'
            + '<div class="skel" style="width:44px;height:16px;border-radius:999px;"></div>'
            + '<div class="skel" style="width:100%;height:20px;border-radius:999px;"></div>'
            + '</div>';
    }

    return '<div class="dirty-air-skeleton-card">'
        + '<div class="dirty-air-skeleton-head"><div><div class="skel" style="width:220px;height:18px;"></div><div class="skel" style="width:280px;height:11px;margin-top:0.5rem;"></div></div><div class="skel" style="width:220px;height:46px;border-radius:12px;"></div></div>'
        + '<div class="skel" style="width:100%;height:88px;border-radius:16px;margin-bottom:1rem;"></div>'
        + '<div class="dirty-air-skeleton-block">' + summaryRows + '</div>'
        + '<div class="dirty-air-skeleton-block">' + timelineRows + '</div>'
        + '</div>';
}

function buildDirtyAirLapWindow(lap, extraMs) {
    const start = lap && lap.date_start ? new Date(lap.date_start) : null;
    const duration = parseTimeSeconds(lap && lap.lap_duration);
    if (!start || isNaN(start.getTime()) || !isFiniteNumber(duration) || duration <= 0) return null;
    const padding = typeof extraMs === 'number' ? extraMs : 900;
    return {
        start: start.getTime() - padding,
        end: start.getTime() + Math.round(duration * 1000) + padding
    };
}

function groupDirtyAirLocationSamples(records) {
    const grouped = {};

    (records || []).forEach(function(record) {
        if (!record || record.driver_number == null || !record.date) return;

        const time = new Date(record.date).getTime();
        const x = parseNumberValue(record.x);
        const y = parseNumberValue(record.y);
        if (!isFiniteNumber(time) || !isFiniteNumber(x) || !isFiniteNumber(y)) return;

        const driverKey = String(record.driver_number);
        if (!grouped[driverKey]) grouped[driverKey] = [];
        grouped[driverKey].push({ time: time, x: x, y: y });
    });

    Object.keys(grouped).forEach(function(driverKey) {
        grouped[driverKey].sort(function(a, b) {
            return a.time - b.time;
        });
    });

    return grouped;
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
            time: (((point.date.getTime() - baseTime) / 1000) / totalRawTime) * lapDuration
        });
    });

    if (cumulative <= 0.001) return null;

    let distance = 0;
    series.forEach(function(point, index) {
        if (index > 0) distance += Math.hypot(point.x - series[index - 1].x, point.y - series[index - 1].y);
        point.progress = distance / cumulative;
    });

    series[0].progress = 0;
    series[series.length - 1].progress = 1;
    return series;
}

function buildDirtyAirReferenceTrack(laps, locationMap) {
    const candidates = (laps || []).filter(function(lap) {
        const duration = parseTimeSeconds(lap && lap.lap_duration);
        return lap && lap.driver_number != null && lap.date_start && isFiniteNumber(duration) && duration > 45 && duration < 220 && !lap.is_pit_out_lap;
    }).sort(function(a, b) {
        return parseTimeSeconds(a.lap_duration) - parseTimeSeconds(b.lap_duration);
    });

    for (let index = 0; index < candidates.length; index++) {
        const lap = candidates[index];
        const window = buildDirtyAirLapWindow(lap, 1000);
        const samples = (locationMap[String(lap.driver_number)] || []).filter(function(sample) {
            return sample.time >= window.start && sample.time <= window.end;
        });
        const series = buildTrackDominanceSeries(samples, parseTimeSeconds(lap.lap_duration));
        if (!series || series.length < 16) continue;

        const bounds = series.reduce(function(acc, point) {
            return {
                minX: Math.min(acc.minX, point.x),
                maxX: Math.max(acc.maxX, point.x),
                minY: Math.min(acc.minY, point.y),
                maxY: Math.max(acc.maxY, point.y)
            };
        }, { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
        const width = Math.max(1, bounds.maxX - bounds.minX);
        const height = Math.max(1, bounds.maxY - bounds.minY);

        return {
            points: series.map(function(point) {
                return {
                    x: point.x,
                    y: point.y,
                    progress: point.progress
                };
            }),
            maxProjectionDistance: Math.max(width, height) * 0.18
        };
    }

    return null;
}

function projectDirtyAirPointToReference(reference, x, y, hintIndex) {
    if (!reference || !reference.points || reference.points.length < 2) return null;

    const points = reference.points;
    const segmentCount = points.length - 1;
    let best = null;

    function evaluateSegment(segmentIndex) {
        if (segmentIndex < 0 || segmentIndex >= segmentCount) return;

        const start = points[segmentIndex];
        const end = points[segmentIndex + 1];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const segmentLengthSq = dx * dx + dy * dy;
        if (segmentLengthSq <= 0.000001) return;

        const ratio = clampNumber(((x - start.x) * dx + (y - start.y) * dy) / segmentLengthSq, 0, 1);
        const projectedX = start.x + dx * ratio;
        const projectedY = start.y + dy * ratio;
        const distSq = Math.pow(x - projectedX, 2) + Math.pow(y - projectedY, 2);
        if (best && distSq >= best.distSq) return;

        best = {
            distSq: distSq,
            progress: start.progress + ((end.progress - start.progress) * ratio),
            index: segmentIndex
        };
    }

    function scanRange(from, to) {
        for (let segmentIndex = from; segmentIndex <= to; segmentIndex++) {
            evaluateSegment(segmentIndex);
        }
    }

    if (typeof hintIndex === 'number' && isFiniteNumber(hintIndex)) {
        const windowStart = Math.max(0, Math.floor(hintIndex) - 14);
        const windowEnd = Math.min(segmentCount - 1, Math.floor(hintIndex) + 14);
        scanRange(windowStart, windowEnd);
        if (!best || Math.sqrt(best.distSq) > reference.maxProjectionDistance) {
            scanRange(0, segmentCount - 1);
        }
    } else {
        scanRange(0, segmentCount - 1);
    }

    return best ? {
        progress: best.progress,
        index: best.index,
        distance: Math.sqrt(best.distSq)
    } : null;
}

function buildDirtyAirProjectedSamples(reference, samples) {
    if (!reference || !samples || !samples.length) return [];

    const projected = [];
    let hintIndex = 0;

    samples.forEach(function(sample) {
        const projection = projectDirtyAirPointToReference(reference, sample.x, sample.y, hintIndex);
        if (!projection || projection.distance > reference.maxProjectionDistance) return;
        hintIndex = projection.index;

        projected.push({
            time: sample.time,
            progress: projection.progress
        });
    });

    return projected;
}

function buildDirtyAirLapCells(lap, lapSamples) {
    if (!lap || !lapSamples || lapSamples.length < 6) {
        return {
            lapNumber: parseInt(lap && lap.lap_number, 10) || 0,
            cells: []
        };
    }

    const usable = lapSamples.slice().sort(function(a, b) {
        return a.time - b.time;
    });
    const normalized = [];
    let wrapOffset = 0;
    let previousUnwrapped = usable[0].progress;

    usable.forEach(function(sample, index) {
        let progress = sample.progress;
        if (index > 0 && progress + wrapOffset < previousUnwrapped - 0.45) {
            wrapOffset += 1;
        }

        let unwrapped = progress + wrapOffset;
        if (unwrapped < previousUnwrapped) unwrapped = previousUnwrapped;
        previousUnwrapped = unwrapped;

        normalized.push({
            time: sample.time,
            progress: unwrapped
        });
    });

    const firstProgress = normalized[0].progress;
    const lastProgress = normalized[normalized.length - 1].progress;
    const span = lastProgress - firstProgress;
    if (!isFiniteNumber(span) || span < 0.55) {
        return {
            lapNumber: parseInt(lap.lap_number, 10) || 0,
            cells: []
        };
    }

    const rescaled = normalized.map(function(sample) {
        return {
            time: sample.time,
            progress: clampNumber((sample.progress - firstProgress) / span, 0, 1)
        };
    });

    const boundaryTimes = [];
    let cursor = 0;

    for (let boundaryIndex = 0; boundaryIndex <= DIRTY_AIR_MINISECTORS; boundaryIndex++) {
        const target = boundaryIndex / DIRTY_AIR_MINISECTORS;
        if (boundaryIndex === 0) {
            boundaryTimes.push(rescaled[0].time);
            continue;
        }
        if (boundaryIndex === DIRTY_AIR_MINISECTORS) {
            boundaryTimes.push(rescaled[rescaled.length - 1].time);
            continue;
        }

        while (cursor < rescaled.length - 2 && rescaled[cursor + 1].progress < target) cursor += 1;
        const start = rescaled[cursor];
        const end = rescaled[Math.min(cursor + 1, rescaled.length - 1)];
        const delta = end.progress - start.progress;
        if (!isFiniteNumber(delta) || delta <= 0) {
            return {
                lapNumber: parseInt(lap.lap_number, 10) || 0,
                cells: []
            };
        }

        const ratio = clampNumber((target - start.progress) / delta, 0, 1);
        boundaryTimes.push(start.time + ((end.time - start.time) * ratio));
    }

    const cells = [];
    for (let minisectorIndex = 0; minisectorIndex < DIRTY_AIR_MINISECTORS; minisectorIndex++) {
        const startTime = boundaryTimes[minisectorIndex];
        const endTime = boundaryTimes[minisectorIndex + 1];
        if (!isFiniteNumber(startTime) || !isFiniteNumber(endTime) || endTime <= startTime) continue;

        cells.push({
            minisector: minisectorIndex,
            time: (startTime + endTime) / 2,
            startTime: startTime,
            endTime: endTime,
            gapSeconds: Infinity,
            categoryKey: 'clean'
        });
    }

    return {
        lapNumber: parseInt(lap.lap_number, 10) || 0,
        cells: cells
    };
}

function buildDirtyAirDriverLapCells(laps, projectedSamples) {
    const sortedLaps = (laps || []).filter(function(lap) {
        return lap && lap.lap_number != null && lap.date_start && isFiniteNumber(parseTimeSeconds(lap.lap_duration));
    }).sort(function(a, b) {
        return (a.lap_number || 0) - (b.lap_number || 0);
    });

    const rows = [];
    let sampleCursor = 0;

    sortedLaps.forEach(function(lap) {
        const window = buildDirtyAirLapWindow(lap, 450);
        if (!window) return;

        while (sampleCursor < projectedSamples.length && projectedSamples[sampleCursor].time < window.start) sampleCursor += 1;

        const lapSamples = [];
        let captureIndex = sampleCursor;
        while (captureIndex < projectedSamples.length && projectedSamples[captureIndex].time <= window.end) {
            lapSamples.push(projectedSamples[captureIndex]);
            captureIndex += 1;
        }

        rows.push(buildDirtyAirLapCells(lap, lapSamples));
    });

    return rows;
}

function annotateDirtyAirLapCells(driverLapMap) {
    const timelines = [];
    for (let minisectorIndex = 0; minisectorIndex < DIRTY_AIR_MINISECTORS; minisectorIndex++) timelines.push([]);

    Object.keys(driverLapMap || {}).forEach(function(driverNumber) {
        (driverLapMap[driverNumber] || []).forEach(function(lap) {
            (lap.cells || []).forEach(function(cell) {
                timelines[cell.minisector].push({
                    driverNumber: String(driverNumber),
                    time: cell.time,
                    cell: cell
                });
            });
        });
    });

    timelines.forEach(function(events) {
        events.sort(function(a, b) {
            return a.time - b.time;
        });

        events.forEach(function(event, index) {
            let gapSeconds = Infinity;
            for (let back = index - 1; back >= 0; back--) {
                if (events[back].driverNumber === event.driverNumber) continue;
                gapSeconds = (event.time - events[back].time) / 1000;
                break;
            }

            event.cell.gapSeconds = gapSeconds;
            event.cell.categoryKey = getDirtyAirCategoryKey(gapSeconds);
        });
    });
}

function getDirtyAirResultPosition(result) {
    const position = parseInt(result && (result.position || result.position_classified || result.classified_position || result.position_text), 10);
    return isFiniteNumber(position) && position > 0 ? position : 999;
}

function buildDirtyAirSummary(row) {
    const counts = {};
    let totalCells = 0;
    let offset = 0;

    DIRTY_AIR_CATEGORIES.forEach(function(category) {
        counts[category.key] = 0;
    });

    (row.laps || []).forEach(function(lap) {
        (lap.cells || []).forEach(function(cell) {
            if (!cell.categoryKey) return;
            counts[cell.categoryKey] += 1;
            totalCells += 1;
        });
    });

    return {
        totalCells: totalCells,
        counts: counts,
        segments: DIRTY_AIR_CATEGORIES.map(function(category) {
            const percentage = totalCells ? (counts[category.key] / totalCells) * 100 : 0;
            const segment = {
                key: category.key,
                label: category.label,
                color: category.color,
                percentage: percentage,
                offset: offset
            };
            offset += percentage;
            return segment;
        }).filter(function(segment) {
            return segment.percentage > 0;
        })
    };
}

function buildDirtyAirTimelineSegments(row) {
    const segments = [];
    let current = null;

    (row.laps || []).forEach(function(lap) {
        (lap.cells || []).forEach(function(cell) {
            if (!cell.categoryKey) return;

            const startIndex = ((lap.lapNumber || 1) - 1) * DIRTY_AIR_MINISECTORS + cell.minisector;
            if (current && current.key === cell.categoryKey && current.endIndex === startIndex) {
                current.endIndex += 1;
                return;
            }

            current = {
                key: cell.categoryKey,
                color: getDirtyAirCategoryMeta(cell.categoryKey).color,
                startIndex: startIndex,
                endIndex: startIndex + 1
            };
            segments.push(current);
        });
    });

    return segments;
}

function buildDirtyAirSafetyCarSpans(messages, maxLaps) {
    const laps = [];

    (messages || []).forEach(function(message) {
        const lapNumber = parseInt(message && message.lap_number, 10);
        const text = [message && message.category, message && message.message].join(' ').toUpperCase();
        if (!isFiniteNumber(lapNumber) || lapNumber <= 0) return;
        if (text.indexOf('SAFETY CAR') === -1 || text.indexOf('VIRTUAL') !== -1) return;
        laps.push(lapNumber);
    });

    const uniqueLaps = Array.from(new Set(laps)).sort(function(a, b) { return a - b; });
    if (!uniqueLaps.length) return [];

    const spans = [];
    let current = { startLap: uniqueLaps[0], endLap: uniqueLaps[0] };

    for (let index = 1; index < uniqueLaps.length; index++) {
        if (uniqueLaps[index] <= current.endLap + 1) {
            current.endLap = uniqueLaps[index];
            continue;
        }
        spans.push(current);
        current = { startLap: uniqueLaps[index], endLap: uniqueLaps[index] };
    }
    spans.push(current);

    return spans.map(function(span) {
        return {
            startLap: clampNumber(span.startLap, 1, Math.max(maxLaps, 1)),
            endLap: clampNumber(span.endLap, 1, Math.max(maxLaps, 1))
        };
    }).filter(function(span) {
        return span.endLap >= span.startLap;
    });
}

function buildDirtyAirRows(sessionKey, drivers, results, driverLapMap) {
    const driverLookup = buildDriverLookup(drivers)[sessionKey] || {};
    const resultLookup = {};

    (results || []).forEach(function(result) {
        if (!result || result.driver_number == null) return;
        resultLookup[String(result.driver_number)] = result;
    });

    return Object.keys(driverLapMap || {}).map(function(driverNumber) {
        const driver = driverLookup[driverNumber] || {};
        const result = resultLookup[driverNumber] || {};
        const teamName = getCanonicalTeamName(driver.teamName || result.team_name || '') || driver.teamName || result.team_name || '';
        const teamColor = getCanonicalTeamColor('', teamName, driver.teamColor || result.team_colour || '');
        const laps = (driverLapMap[driverNumber] || []).sort(function(a, b) {
            return a.lapNumber - b.lapNumber;
        });
        const completedLaps = laps.reduce(function(maxLap, lap) {
            return Math.max(maxLap, lap.lapNumber || 0);
        }, 0);

        return {
            driverNumber: driverNumber,
            position: getDirtyAirResultPosition(result),
            acronym: deriveAcronym(driver),
            fullName: getDriverDisplayName(driver),
            headshot: driver.headshot || '',
            teamName: teamName || 'Team',
            teamColor: teamColor,
            laps: laps,
            completedLaps: completedLaps,
            summary: null,
            timelineSegments: []
        };
    }).filter(function(row) {
        return row.completedLaps > 0;
    }).sort(function(a, b) {
        if (a.position !== b.position) return a.position - b.position;
        if (a.completedLaps !== b.completedLaps) return b.completedLaps - a.completedLaps;
        return a.acronym.localeCompare(b.acronym);
    });
}

function buildDirtyAirSessionData(session, drivers, laps, results, raceControl, locations) {
    const sessionKey = String(session.session_key);
    const locationMap = groupDirtyAirLocationSamples(locations);
    const referenceTrack = buildDirtyAirReferenceTrack(laps, locationMap);
    if (!referenceTrack) {
        return {
            session: session,
            rows: [],
            maxLaps: 0,
            safetyCarSpans: []
        };
    }

    const lapsByDriver = {};
    (laps || []).forEach(function(lap) {
        if (!lap || lap.driver_number == null || lap.lap_number == null || !lap.date_start) return;
        const duration = parseTimeSeconds(lap.lap_duration);
        if (!isFiniteNumber(duration) || duration <= 0 || duration > 400) return;

        const driverKey = String(lap.driver_number);
        if (!lapsByDriver[driverKey]) lapsByDriver[driverKey] = [];
        lapsByDriver[driverKey].push(lap);
    });

    const driverLapMap = {};
    Object.keys(lapsByDriver).forEach(function(driverKey) {
        const projectedSamples = buildDirtyAirProjectedSamples(referenceTrack, locationMap[driverKey] || []);
        driverLapMap[driverKey] = buildDirtyAirDriverLapCells(lapsByDriver[driverKey], projectedSamples);
    });

    annotateDirtyAirLapCells(driverLapMap);

    const rows = buildDirtyAirRows(sessionKey, drivers, results, driverLapMap);
    const maxLaps = rows.reduce(function(maxLap, row) {
        return Math.max(maxLap, row.completedLaps);
    }, 0);

    rows.forEach(function(row) {
        row.summary = buildDirtyAirSummary(row);
        row.timelineSegments = buildDirtyAirTimelineSegments(row);
    });

    return {
        session: session,
        rows: rows,
        maxLaps: maxLaps,
        safetyCarSpans: buildDirtyAirSafetyCarSpans(raceControl, maxLaps)
    };
}

function renderDirtyAir(sessionData, session) {
    if (!dirtyAirTable) return;

    const sessionOptions = state.sessions.slice().reverse().map(function(item) {
        return '<option value="' + esc(item.session_key) + '"' + (String(item.session_key) === String(state.selectedSessionKey) ? ' selected' : '') + '>'
            + esc((item.meeting_name || item.circuit_short_name || item.location || 'Race') + ' · ' + (formatSessionDateShort(item) ? formatSessionDateShort(item) : getSessionLabel(item)))
            + '</option>';
    }).join('');

    if (!sessionData || !session) {
        dirtyAirTable.innerHTML = '<div class="dirty-air-empty-card">'
            + '<svg class="icon" aria-hidden="true"><use href="#fa-wind"/></svg>'
            + '<p>Δεν υπάρχουν ακόμη completed races για dirty air analysis.</p>'
            + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το tab ενεργοποιείται μόλις υπάρχουν διαθέσιμα race telemetry samples.</p>'
            + '</div>';
        fireRendered();
        return;
    }

    if (!hasRenderableDirtyAirRows(sessionData)) {
        dirtyAirTable.innerHTML = '<div class="dirty-air-card">'
            + '<div class="dirty-air-head"><div class="dirty-air-head-copy"><h3 class="dirty-air-head-title">Dirty Air Proximity Breakdown</h3><p class="dirty-air-head-note">Clean air σημαίνει ότι δεν υπάρχει κανένα μονοθέσιο μπροστά μέσα σε 4.0s στο ίδιο minisector. Τα backmarkers που ετοιμάζονται να δεχτούν γύρο μετρούν κανονικά ως traffic.</p></div><label class="dirty-air-controls"><span class="dirty-air-controls-label">Available races</span><select class="dirty-air-select" data-dirty-air-select aria-label="Επιλογή αγώνα για dirty air analysis">' + sessionOptions + '</select></label></div>'
            + '<div class="dirty-air-summary"><div><div class="dirty-air-summary-title">' + esc(session.meeting_name || getSessionLabel(session)) + '</div><div class="dirty-air-summary-sub">' + esc(formatSessionDateShort(session) + ' · ' + (session.session_name || 'Race')) + '</div></div><div class="dirty-air-summary-stats"><div class="dirty-air-summary-stat"><span class="dirty-air-summary-label">Drivers</span><span class="dirty-air-summary-value">0</span></div><div class="dirty-air-summary-stat"><span class="dirty-air-summary-label">MiniSectors</span><span class="dirty-air-summary-value">' + esc(String(DIRTY_AIR_MINISECTORS)) + '</span></div></div></div>'
            + '<div class="dirty-air-empty-card">'
            + '<svg class="icon" aria-hidden="true"><use href="#fa-wind"/></svg>'
            + '<p>Δεν υπάρχουν ακόμη αρκετά race telemetry samples για το συγκεκριμένο race.</p>'
            + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Διάλεξε άλλο completed Grand Prix ή δοκίμασε ξανά αργότερα όταν το OpenF1 έχει περισσότερα location samples.</p>'
            + '</div>'
            + '</div>';
        fireRendered();
        return;
    }

    const legendHTML = DIRTY_AIR_CATEGORIES.map(function(category) {
        return '<span class="dirty-air-legend-item"><span class="dirty-air-legend-swatch" style="background:#' + esc(category.color) + ';"></span>' + esc(category.label) + ' <em>' + esc(category.range) + '</em></span>';
    }).join('');

    const summaryRowsHTML = sessionData.rows.map(function(row) {
        const segmentsHTML = row.summary.segments.map(function(segment) {
            return '<span class="dirty-air-summary-segment" style="left:' + segment.offset.toFixed(4) + '%;width:' + segment.percentage.toFixed(4) + '%;background:#' + esc(segment.color) + ';" title="' + esc(segment.label + ' · ' + segment.percentage.toFixed(1) + '%') + '"></span>';
        }).join('');

        return '<div class="dirty-air-summary-row">'
            + '<div class="dirty-air-driver-tag"><span class="dirty-air-driver-dot" style="background:#' + esc(row.teamColor) + ';"></span><span class="dirty-air-driver-code">' + esc(row.acronym) + '</span></div>'
            + '<div class="dirty-air-summary-bar">' + segmentsHTML + '</div>'
            + '</div>';
    }).join('');

    const maxLaps = Math.max(sessionData.maxLaps, 1);
    const chartWidth = Math.max(780, maxLaps * (maxLaps > 60 ? 24 : 28));
    const chartUnits = maxLaps * DIRTY_AIR_MINISECTORS;
    let lapGridHTML = '';
    for (let lapGrid = 1; lapGrid < maxLaps; lapGrid++) {
        lapGridHTML += '<span class="dirty-air-lap-line" style="left:' + ((lapGrid / maxLaps) * 100).toFixed(4) + '%;"></span>';
    }

    const scBandsHTML = (sessionData.safetyCarSpans || []).map(function(span) {
        const startPct = (((span.startLap - 1) * DIRTY_AIR_MINISECTORS) / chartUnits) * 100;
        const widthPct = (((span.endLap - span.startLap + 1) * DIRTY_AIR_MINISECTORS) / chartUnits) * 100;
        return '<span class="dirty-air-sc-band" style="left:' + startPct.toFixed(4) + '%;width:' + widthPct.toFixed(4) + '%;"></span>';
    }).join('');
    const scOverlayHTML = scBandsHTML ? '<div class="dirty-air-timeline-overlays">' + scBandsHTML + '</div>' : '';
    const scMarkerBandsHTML = (sessionData.safetyCarSpans || []).map(function(span) {
        const startPct = (((span.startLap - 1) * DIRTY_AIR_MINISECTORS) / chartUnits) * 100;
        const widthPct = (((span.endLap - span.startLap + 1) * DIRTY_AIR_MINISECTORS) / chartUnits) * 100;
        return '<span class="dirty-air-sc-band" style="left:' + startPct.toFixed(4) + '%;width:' + widthPct.toFixed(4) + '%;"><em>SC</em></span>';
    }).join('');
    const scMarkerRowHTML = scMarkerBandsHTML
        ? '<div class="dirty-air-timeline-row dirty-air-sc-row">'
            + '<div class="dirty-air-driver-tag sticky dirty-air-sc-marker"><span class="dirty-air-driver-code">SC</span></div>'
            + '<div class="dirty-air-timeline-bar dirty-air-sc-marker-bar">' + scMarkerBandsHTML + '</div>'
            + '</div>'
        : '';

    const timelineRowsHTML = sessionData.rows.map(function(row) {
        const segmentsHTML = row.timelineSegments.map(function(segment) {
            const startPct = (segment.startIndex / chartUnits) * 100;
            const widthPct = ((segment.endIndex - segment.startIndex) / chartUnits) * 100;
            return '<span class="dirty-air-timeline-segment" style="left:' + startPct.toFixed(4) + '%;width:' + widthPct.toFixed(4) + '%;background:#' + esc(segment.color) + ';"></span>';
        }).join('');

        return '<div class="dirty-air-timeline-row">'
            + '<div class="dirty-air-driver-tag sticky"><span class="dirty-air-driver-dot" style="background:#' + esc(row.teamColor) + ';"></span><span class="dirty-air-driver-code">' + esc(row.acronym) + '</span></div>'
            + '<div class="dirty-air-timeline-bar">' + lapGridHTML + segmentsHTML + '</div>'
            + '</div>';
    }).join('');

    const axisStep = getDirtyAirAxisStep(maxLaps);
    let axisLabels = '<span class="dirty-air-axis-label start" style="left:0%;">0</span>';
    for (let lap = axisStep; lap <= maxLaps; lap += axisStep) {
        axisLabels += '<span class="dirty-air-axis-label" style="left:' + ((lap / maxLaps) * 100).toFixed(4) + '%;">' + esc(String(lap)) + '</span>';
    }
    if (maxLaps % axisStep !== 0) {
        axisLabels += '<span class="dirty-air-axis-label end" style="left:100%;">' + esc(String(maxLaps)) + '</span>';
    }

    const activeView = sanitizeView(state.activeView);
    const viewSwitchHTML = '<div class="dirty-air-view-switch"><div class="dirty-air-view-tabs" role="tablist" aria-label="Dirty air views">'
        + '<button class="dirty-air-view-tab' + (activeView === 'summary' ? ' active' : '') + '" type="button" data-dirty-air-view="summary" role="tab" aria-selected="' + (activeView === 'summary' ? 'true' : 'false') + '">% By Proximity</button>'
        + '<button class="dirty-air-view-tab' + (activeView === 'timeline' ? ' active' : '') + '" type="button" data-dirty-air-view="timeline" role="tab" aria-selected="' + (activeView === 'timeline' ? 'true' : 'false') + '">Per Lap Timeline</button>'
        + '</div></div>';

    const html = '<div class="dirty-air-card">'
        + '<div class="dirty-air-head"><div class="dirty-air-head-copy"><h3 class="dirty-air-head-title">Dirty Air Proximity Breakdown</h3><p class="dirty-air-head-note">Clean air σημαίνει ότι δεν υπάρχει κανένα μονοθέσιο μπροστά μέσα σε 4.0s στο ίδιο minisector. Τα backmarkers που ετοιμάζονται να δεχτούν γύρο μετρούν κανονικά ως traffic.</p></div><label class="dirty-air-controls"><span class="dirty-air-controls-label">Available races</span><select class="dirty-air-select" data-dirty-air-select aria-label="Επιλογή αγώνα για dirty air analysis">' + sessionOptions + '</select></label></div>'
        + '<div class="dirty-air-summary"><div><div class="dirty-air-summary-title">' + esc(session.meeting_name || getSessionLabel(session)) + '</div><div class="dirty-air-summary-sub">' + esc(formatSessionDateShort(session) + ' · ' + (session.session_name || 'Race') + ' · ' + sessionData.maxLaps + ' laps') + '</div></div><div class="dirty-air-summary-stats"><div class="dirty-air-summary-stat"><span class="dirty-air-summary-label">Drivers</span><span class="dirty-air-summary-value">' + esc(String(sessionData.rows.length)) + '</span></div><div class="dirty-air-summary-stat"><span class="dirty-air-summary-label">MiniSectors</span><span class="dirty-air-summary-value">' + esc(String(DIRTY_AIR_MINISECTORS)) + '</span></div><div class="dirty-air-summary-stat"><span class="dirty-air-summary-label">SC Periods</span><span class="dirty-air-summary-value">' + esc(String((sessionData.safetyCarSpans || []).length)) + '</span></div></div></div>'
        + '<div class="dirty-air-legend">' + legendHTML + '</div>'
        + viewSwitchHTML
        + '<div class="dirty-air-view-panel' + (activeView === 'summary' ? ' active' : '') + '" data-dirty-air-panel="summary"><section class="dirty-air-section"><div class="dirty-air-section-head"><div><h4 class="dirty-air-section-title">% Of Race By Proximity</h4><p class="dirty-air-section-note">Share of valid race minisectors spent in each traffic bucket.</p></div></div><div class="dirty-air-summary-list">' + summaryRowsHTML + '</div></section></div>'
        + '<div class="dirty-air-view-panel' + (activeView === 'timeline' ? ' active' : '') + '" data-dirty-air-panel="timeline"><section class="dirty-air-section"><div class="dirty-air-section-head"><div><h4 class="dirty-air-section-title">Per Lap Timeline</h4><p class="dirty-air-section-note">Every lap is split into 30 equal minisectors. Safety Car laps are highlighted across the chart.</p></div></div><div class="dirty-air-timeline-scroll"><div class="dirty-air-timeline-body" style="--dirty-air-chart-width:' + chartWidth + 'px;"><div class="dirty-air-timeline-track">' + scOverlayHTML + scMarkerRowHTML + timelineRowsHTML + '</div><div class="dirty-air-axis-row"><div class="dirty-air-axis-spacer"></div><div class="dirty-air-axis-track">' + axisLabels + '</div></div></div></div></section></div>'
        + '<p class="dirty-air-footnote">Source: OpenF1 `location`, `laps`, `session_result` και `race_control`. Το nearest car ahead μετριέται ανά minisector χρησιμοποιώντας το πιο πρόσφατο crossing στο ίδιο κομμάτι της πίστας.</p>'
        + '</div>';

    dirtyAirTable.innerHTML = html;
    fireRendered();
}

function showDirtyAirError() {
    if (!dirtyAirTable) return;
    dirtyAirTable.innerHTML = '<div class="dirty-air-empty-card">'
        + '<svg class="icon" aria-hidden="true"><use href="#fa-exclamation-triangle"/></svg>'
        + '<p>Δεν ήταν δυνατή η φόρτωση του dirty air analysis.</p>'
        + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το OpenF1 telemetry endpoint ίσως να μην είναι διαθέσιμο προσωρινά.</p>'
        + '<button class="retry-btn" type="button" onclick="window.__retryDirtyAir && window.__retryDirtyAir()"><svg class="icon" aria-hidden="true"><use href="#fa-redo"/></svg> Νέα προσπάθεια</button>'
        + '</div>';
    fireRendered();
}

function loadDirtyAirSessionData(sessionKey) {
    const cacheKey = String(sessionKey);
    const session = (state.sessions || []).filter(function(item) {
        return String(item.session_key) === cacheKey;
    })[0];
    if (!session) return Promise.reject(new Error('Unknown dirty air session'));
    if (shouldReuseDirtyAirSessionCache(state.sessionCache[cacheKey])) {
        return Promise.resolve(state.sessionCache[cacheKey]);
    }

    return fetchOpenF1BySessionKeys(OPENF1, 'drivers', [session.session_key]).then(function(driversPayload) {
        return fetchOpenF1BySessionKeys(OPENF1, 'laps', [session.session_key]).then(function(lapsPayload) {
            return fetchOpenF1BySessionKeys(OPENF1, 'session_result', [session.session_key]).then(function(resultsPayload) {
                return fetchOpenF1BySessionKeys(OPENF1, 'race_control', [session.session_key]).then(function(raceControlPayload) {
                    return [driversPayload, lapsPayload, resultsPayload, raceControlPayload];
                });
            });
        });
    }).then(function(payload) {
        const driverNumbers = Array.from(new Set((payload[1] || []).map(function(lap) {
            return lap && lap.driver_number != null ? String(lap.driver_number) : '';
        }).filter(Boolean)));

        return fetchOpenF1ByDriverNumbers(OPENF1, 'location', session.session_key, driverNumbers).then(function(locations) {
            const built = buildDirtyAirSessionData(session, payload[0], payload[1], payload[2], payload[3], locations);
            state.sessionCache[cacheKey] = built;
            return built;
        });
    });
}

function loadAndRenderDirtyAir(useSkeleton) {
    if (!dirtyAirTable) return;
    if (state.loading) {
        state.pendingReload = true;
        return;
    }

    state.loading = true;
    state.pendingReload = false;
    if (useSkeleton) dirtyAirTable.innerHTML = createDirtyAirSkeleton();

    const sessionsPromise = state.sessions.length
        ? Promise.resolve(state.sessions)
        : loadDirtyAirCacheBundle().then(function() {
            if (state.sessions.length) return state.sessions;
            return getCompletedRaceSessions().then(function(sessions) {
                state.sessions = sessions;
                return sessions;
            });
        });

    sessionsPromise.then(function(sessions) {
        if (!sessions.length) return { session: null, sessionData: null };

        if (!state.selectedSessionKey || !sessions.some(function(item) { return String(item.session_key) === String(state.selectedSessionKey); })) {
            state.selectedSessionKey = String(sessions[sessions.length - 1].session_key);
        }

        const selectedSession = sessions.filter(function(item) {
            return String(item.session_key) === String(state.selectedSessionKey);
        })[0];

        return loadDirtyAirSessionData(state.selectedSessionKey).then(function(sessionData) {
            return {
                session: selectedSession,
                sessionData: sessionData
            };
        });
    }).then(function(payload) {
        renderDirtyAir(payload.sessionData, payload.session);
        state.loaded = true;
    }).catch(function(error) {
        console.error('Dirty air error:', error);
        showDirtyAirError();
    }).finally(function() {
        state.loading = false;
        if (state.pendingReload) {
            state.pendingReload = false;
            loadAndRenderDirtyAir(true);
        }
    });
}

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

window.__retryDirtyAir = function() {
    state.loaded = false;
    loadAndRenderDirtyAir(true);
};
