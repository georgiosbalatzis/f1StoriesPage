// Quali-Gaps tab — standalone ES module (Phase 6C, step 3).
//
// Self-contained implementation of the teammate qualifying-gaps panel.
// Owns its own DOM query (#qualifying-gaps-table), OpenF1 fetch state, the
// overview/race-detail view toggle, the race-session select, and the dot
// tooltip open/close behavior. The orchestrator (standings.js) imports this
// lazily the first time the quali-gaps tab is activated, calls initQualiGaps()
// once to hand over onRendered / onViewChange / onSessionChange hooks, then
// drives rendering via ensureLoaded() and syncs URL state via setActiveView()
// / setSelectedSession().

import { esc } from '../core/format.js';
import {
    normalizeHexColor,
    hexToRgbChannels
} from '../core/teams.js';
import { getCachedHeadshotResult } from '../core/drivers-meta.js';
import { fetchJSON, fetchOpenF1BySessionKeys } from '../core/fetchers.js';
import { isFiniteNumber, parseTimeSeconds } from './_shared.js';

const OPENF1 = 'https://api.openf1.org/v1';
const YEAR = new Date().getFullYear();

const qualifyingGapsTable = document.getElementById('qualifying-gaps-table');

const state = {
    loaded: false,
    loading: false,
    overviewRows: [],
    raceRows: [],
    activeView: 'overview',
    selectedSessionKey: ''
};

let onRendered = null;
let onViewChange = null;
let onSessionChange = null;
let listenersBound = false;
let documentClickBound = false;

export function sanitizeView(value) {
    return value === 'race-detail' ? 'race-detail' : 'overview';
}

export function initQualiGaps(options) {
    if (options && typeof options.onRendered === 'function') onRendered = options.onRendered;
    if (options && typeof options.onViewChange === 'function') onViewChange = options.onViewChange;
    if (options && typeof options.onSessionChange === 'function') onSessionChange = options.onSessionChange;

    if (!listenersBound && qualifyingGapsTable) {
        // Capture-phase binding + stopImmediatePropagation so the legacy
        // bundle's quali-gaps click/change handlers (no self-guards) cannot
        // also fire and re-render with stale qualifyingGapsState data.
        qualifyingGapsTable.addEventListener('click', handleTableClick, true);
        qualifyingGapsTable.addEventListener('change', handleRaceSelectChange, true);
        listenersBound = true;
    }

    if (!documentClickBound) {
        document.addEventListener('click', handleDocumentClick);
        documentClickBound = true;
    }
}

export function getActiveView() {
    return state.activeView;
}

export function getSelectedSession() {
    return state.selectedSessionKey;
}

export function setActiveView(view) {
    const next = sanitizeView(view);
    if (next === state.activeView) return;
    state.activeView = next;
    if (state.loaded) rerenderFromState();
}

export function setSelectedSession(sessionKey) {
    const next = sessionKey == null ? '' : String(sessionKey);
    if (next === state.selectedSessionKey) return;
    state.selectedSessionKey = next;
    if (state.loaded && state.activeView === 'race-detail') rerenderFromState();
}

export function ensureLoaded(forceReload) {
    if (!qualifyingGapsTable) return;
    if (state.loading) return;
    if (state.loaded && !forceReload) return;

    state.loading = true;
    qualifyingGapsTable.innerHTML = createQualifyingSkeletonRows(6);

    loadQualifyingGapRows().then(function(data) {
        renderQualifyingGaps(data);
        state.loaded = true;
    }).catch(function(error) {
        console.error('Qualifying gaps error:', error);
        showQualifyingError();
    }).finally(function() {
        state.loading = false;
    });
}

// ─── Event handlers ──────────────────────────────────────────────────────

function handleTableClick(event) {
    const viewTab = event.target.closest('[data-quali-view]');
    if (viewTab) {
        event.stopImmediatePropagation();
        const nextView = sanitizeView(viewTab.getAttribute('data-quali-view'));
        if (nextView !== state.activeView) {
            state.activeView = nextView;
            rerenderFromState();
            if (onViewChange) onViewChange(nextView);
        }
        return;
    }

    const dot = event.target.closest('.quali-dot');
    if (!dot) return;
    event.stopImmediatePropagation();
    const isActive = dot.classList.contains('is-active');
    closeActiveQualifyingDots();
    dot.classList.toggle('is-active', !isActive);
    dot.setAttribute('aria-expanded', !isActive ? 'true' : 'false');
    event.stopPropagation();
}

function handleRaceSelectChange(event) {
    const raceSelect = event.target.closest('[data-quali-race-select]');
    if (!raceSelect) return;
    event.stopImmediatePropagation();

    state.selectedSessionKey = raceSelect.value;
    if (state.activeView !== 'race-detail') state.activeView = 'race-detail';
    rerenderFromState();
    if (onSessionChange) onSessionChange(state.selectedSessionKey);
    if (onViewChange) onViewChange(state.activeView);
}

function handleDocumentClick(event) {
    if (event.target.closest('#qualifying-gaps-table .quali-dot')) return;
    closeActiveQualifyingDots();
}

function closeActiveQualifyingDots(exceptDot) {
    if (!qualifyingGapsTable) return;
    qualifyingGapsTable.querySelectorAll('.quali-dot.is-active').forEach(function(dot) {
        if (dot !== exceptDot) dot.classList.remove('is-active');
        dot.setAttribute('aria-expanded', dot === exceptDot ? 'true' : 'false');
    });
}

function rerenderFromState() {
    renderQualifyingGaps({
        overviewRows: state.overviewRows || [],
        raceRows: state.raceRows || []
    });
}

// ─── Session helpers ─────────────────────────────────────────────────────

function isQualifyingSession(session) {
    const text = [
        session && session.session_type,
        session && session.session_name,
        session && session.session_key,
        session && session.meeting_name
    ].join(' ').toLowerCase();
    return text.indexOf('qualifying') !== -1 || text.indexOf('shootout') !== -1;
}

function isCompletedSession(session) {
    if (!session || session.is_cancelled) return false;
    const dateValue = session.date_end || session.date_start || session.date;
    return dateValue ? new Date(dateValue) <= new Date() : false;
}

function isSprintShootoutSession(session) {
    const text = [
        session && session.session_type,
        session && session.session_name,
        session && session.meeting_name
    ].join(' ').toLowerCase();
    return text.indexOf('shootout') !== -1;
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

// ─── Driver helpers ──────────────────────────────────────────────────────

function safeDriverNumber(driver) {
    return driver && driver.driverNumber != null ? String(driver.driverNumber) : '';
}

function getDriverDisplayName(driver) {
    return driver.fullName
        || [driver.firstName, driver.lastName].filter(Boolean).join(' ')
        || ('Οδηγός #' + (driver.driverNumber || '?'));
}

function deriveAcronym(driver) {
    if (driver.acronym) return driver.acronym;
    const name = getDriverDisplayName(driver).split(/\s+/).filter(Boolean);
    if (name.length >= 2) return (name[0].charAt(0) + name[name.length - 1].charAt(0) + name[name.length - 1].charAt(1)).toUpperCase().slice(0, 3);
    return (name[0] || 'DRV').substring(0, 3).toUpperCase();
}

function buildPairKey(driverA, driverB, teamKey) {
    return [teamKey, safeDriverNumber(driverA), safeDriverNumber(driverB)].sort().join('|');
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
            headshot: getCachedHeadshotResult('', fullName, driver.headshot_url || '').url,
            teamName: driver.team_name || '',
            teamColor: driver.team_colour || '',
            meetingKey: driver.meeting_key || ''
        };
    });
    return lookup;
}

// ─── Qualifying stage helpers ────────────────────────────────────────────

function getBestQualifyingTime(result) {
    const candidates = [result && result.duration];
    ['q1', 'q2', 'q3', 'lap_duration', 'best_lap_time', 'best_lap_duration'].forEach(function(key) {
        if (result && result[key] != null) candidates.push(result[key]);
    });
    const parsed = candidates.map(parseTimeSeconds).filter(isFiniteNumber);
    return parsed.length ? Math.min.apply(null, parsed) : NaN;
}

function getFirstQualifyingStageTime(result, keys) {
    const parsed = (keys || []).map(function(key) {
        return parseTimeSeconds(result && result[key]);
    }).filter(isFiniteNumber);
    return parsed.length ? Math.min.apply(null, parsed) : NaN;
}

function getQualifyingStageTimes(result) {
    return {
        q1: getFirstQualifyingStageTime(result, ['q1', 'q1_time', 'q1_lap_time', 'sq1', 'sq1_time', 'sq1_lap_time']),
        q2: getFirstQualifyingStageTime(result, ['q2', 'q2_time', 'q2_lap_time', 'sq2', 'sq2_time', 'sq2_lap_time']),
        q3: getFirstQualifyingStageTime(result, ['q3', 'q3_time', 'q3_lap_time', 'sq3', 'sq3_time', 'sq3_lap_time']),
        bestTime: getBestQualifyingTime(result)
    };
}

function getQualifyingStageLabel(stageKey, session) {
    if (!stageKey || stageKey === 'best') return 'Best';
    const prefix = isSprintShootoutSession(session) ? 'SQ' : 'Q';
    return prefix + stageKey.slice(1);
}

function getSharedQualifyingComparison(entryA, entryB, session) {
    if (!entryA || !entryB) return null;

    const stages = ['q3', 'q2', 'q1'];
    let stageKey = 'best';
    let timeA = NaN;
    let timeB = NaN;

    for (let i = 0; i < stages.length; i++) {
        const candidateStage = stages[i];
        const candidateA = entryA.stageTimes ? entryA.stageTimes[candidateStage] : NaN;
        const candidateB = entryB.stageTimes ? entryB.stageTimes[candidateStage] : NaN;
        if (isFiniteNumber(candidateA) && isFiniteNumber(candidateB)) {
            stageKey = candidateStage;
            timeA = candidateA;
            timeB = candidateB;
            break;
        }
    }

    if (!isFiniteNumber(timeA) || !isFiniteNumber(timeB)) {
        timeA = entryA.bestTime;
        timeB = entryB.bestTime;
        stageKey = 'best';
    }

    if (!isFiniteNumber(timeA) || !isFiniteNumber(timeB)) return null;

    let fasterEntry = entryA;
    let slowerEntry = entryB;
    let fasterTime = timeA;
    let slowerTime = timeB;

    if (timeB < timeA || (Math.abs(timeA - timeB) <= 0.000001 && deriveAcronym(entryB.driver).localeCompare(deriveAcronym(entryA.driver)) < 0)) {
        fasterEntry = entryB;
        slowerEntry = entryA;
        fasterTime = timeB;
        slowerTime = timeA;
    }

    const gap = slowerTime - fasterTime;
    if (!isFiniteNumber(gap) || gap < 0) return null;

    return {
        fasterEntry: fasterEntry,
        slowerEntry: slowerEntry,
        gap: gap,
        stageKey: stageKey,
        stageLabel: getQualifyingStageLabel(stageKey, session)
    };
}

// ─── Formatting + color helpers (local) ──────────────────────────────────

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function roundUp(value, step) {
    return Math.ceil(value / step) * step;
}

function hashString(input) {
    const value = (input || '').toString();
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
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

function getDriverAccentColor(driver, teamColor, fallbackShift) {
    const shifts = [-38, -12, 22, 46];
    const hash = hashString((driver.acronym || '') + ':' + (driver.driverNumber || '') + ':' + (driver.fullName || ''));
    let shift = shifts[hash % shifts.length];
    if (typeof fallbackShift === 'number') shift = fallbackShift;
    return adjustHexColor(teamColor, shift);
}

function formatSignedGap(gap, withUnit) {
    if (!isFiniteNumber(gap)) return 'n/a';
    const sign = gap > 0 ? '+' : gap < 0 ? '-' : '±';
    const value = Math.abs(gap).toFixed(3);
    return sign + value + (withUnit ? 's' : '');
}

function formatScaleValue(value) {
    if (!isFiniteNumber(value)) return '0';
    return (value >= 1 ? value.toFixed(1) : value.toFixed(2)).replace(/\.?0+$/, '');
}

function formatSessionCount(count) {
    return count + ' Q/SQ';
}

// ─── Data pipeline ───────────────────────────────────────────────────────

function loadQualifyingGapRows() {
    return fetchJSON(OPENF1 + '/sessions?year=' + YEAR).then(function(sessions) {
        const qualifyingSessions = (sessions || []).filter(function(session) {
            return isQualifyingSession(session) && isCompletedSession(session);
        }).sort(function(a, b) {
            return new Date(a.date_start || a.date || 0) - new Date(b.date_start || b.date || 0);
        });

        if (!qualifyingSessions.length) {
            return { overviewRows: [], raceRows: [] };
        }

        const sessionKeys = qualifyingSessions.map(function(session) {
            return session.session_key;
        });

        return Promise.all([
            fetchOpenF1BySessionKeys(OPENF1, 'drivers', sessionKeys),
            fetchOpenF1BySessionKeys(OPENF1, 'session_result', sessionKeys)
        ]).then(function(payload) {
            const built = buildQualifyingSessionTeams(qualifyingSessions, payload[0], payload[1]);
            return {
                overviewRows: buildQualifyingGapOverviewRows(built.sessionMap, built.sessionTeams),
                raceRows: buildQualifyingGapRaceRows(built.sessionMap, built.sessionTeams)
            };
        });
    });
}

function createPairRecord(teamName, teamKey, teamColor, driverA, driverB) {
    const pair = {
        teamName: teamName,
        teamKey: teamKey,
        teamColor: normalizeHexColor(teamColor || '3b82f6'),
        drivers: {},
        sessions: [],
        totalGap: 0
    };
    [driverA, driverB].forEach(function(driver) {
        const key = safeDriverNumber(driver);
        pair.drivers[key] = {
            driverNumber: driver.driverNumber,
            acronym: deriveAcronym(driver),
            fullName: getDriverDisplayName(driver),
            headshot: driver.headshot || '',
            teamName: driver.teamName || teamName,
            wins: 0,
            signedTotal: 0
        };
    });
    return pair;
}

function buildQualifyingSessionTeams(sessions, drivers, results) {
    const sessionMap = {};
    const sessionTeams = {};
    const driverLookup = buildDriverLookup(drivers);

    (sessions || []).forEach(function(session, index) {
        sessionMap[String(session.session_key)] = {
            session: session,
            index: index
        };
    });

    (results || []).forEach(function(result) {
        const sessionKey = String(result.session_key);
        if (!sessionMap[sessionKey]) return;

        const driverMap = driverLookup[sessionKey] || {};
        const sourceDriver = driverMap[result.driver_number];
        const stageTimes = getQualifyingStageTimes(result);
        if (!sourceDriver || !sourceDriver.teamName || !isFiniteNumber(stageTimes.bestTime)) return;

        if (!sessionTeams[sessionKey]) sessionTeams[sessionKey] = {};

        const teamKey = (sourceDriver.teamName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const driver = {
            driverNumber: sourceDriver.driverNumber != null ? sourceDriver.driverNumber : result.driver_number,
            fullName: sourceDriver.fullName || '',
            firstName: sourceDriver.firstName || '',
            lastName: sourceDriver.lastName || '',
            acronym: sourceDriver.acronym || '',
            headshot: sourceDriver.headshot || '',
            teamName: sourceDriver.teamName || '',
            teamColor: sourceDriver.teamColor || '3b82f6',
            meetingKey: sourceDriver.meetingKey || ''
        };
        const driverKey = safeDriverNumber(driver);

        if (!sessionTeams[sessionKey][teamKey]) sessionTeams[sessionKey][teamKey] = {};

        const existingEntry = sessionTeams[sessionKey][teamKey][driverKey];
        if (!existingEntry || stageTimes.bestTime < existingEntry.bestTime) {
            sessionTeams[sessionKey][teamKey][driverKey] = {
                driver: driver,
                bestTime: stageTimes.bestTime,
                stageTimes: stageTimes
            };
        }
    });

    return {
        sessionMap: sessionMap,
        sessionTeams: sessionTeams
    };
}

function buildQualifyingGapOverviewRows(sessionMap, sessionTeams) {
    const pairs = {};

    Object.keys(sessionTeams).forEach(function(sessionKey) {
        const teamGroups = sessionTeams[sessionKey];
        const sessionInfo = sessionMap[sessionKey] || {};

        Object.keys(teamGroups).forEach(function(teamKey) {
            const entries = Object.keys(teamGroups[teamKey]).map(function(driverKey) {
                return teamGroups[teamKey][driverKey];
            }).sort(function(a, b) {
                return a.bestTime - b.bestTime;
            });
            if (entries.length !== 2) return;

            const comparison = getSharedQualifyingComparison(entries[0], entries[1], sessionInfo.session || {});
            if (!comparison) return;

            const faster = comparison.fasterEntry;
            const slower = comparison.slowerEntry;
            const pairKey = buildPairKey(faster.driver, slower.driver, teamKey);

            if (!pairs[pairKey]) {
                pairs[pairKey] = createPairRecord(
                    faster.driver.teamName || slower.driver.teamName,
                    teamKey,
                    faster.driver.teamColor || slower.driver.teamColor,
                    faster.driver,
                    slower.driver
                );
            }

            const pair = pairs[pairKey];
            const fasterKey = safeDriverNumber(faster.driver);
            const slowerKey = safeDriverNumber(slower.driver);

            pair.sessions.push({
                sessionKey: sessionKey,
                sessionIndex: sessionInfo.index || 0,
                label: getSessionLabel(sessionInfo.session || {}) + ' · ' + comparison.stageLabel,
                gap: comparison.gap,
                fasterDriverNumber: fasterKey,
                slowerDriverNumber: slowerKey,
                stageLabel: comparison.stageLabel
            });
            pair.totalGap += comparison.gap;
            pair.drivers[fasterKey].wins += 1;
            pair.drivers[fasterKey].signedTotal -= comparison.gap;
            pair.drivers[slowerKey].signedTotal += comparison.gap;
        });
    });

    return Object.keys(pairs).map(function(key) {
        const pair = pairs[key];
        const driverKeys = Object.keys(pair.drivers);
        if (driverKeys.length !== 2 || !pair.sessions.length) return null;

        const first = pair.drivers[driverKeys[0]];
        const second = pair.drivers[driverKeys[1]];
        let left = first;
        let right = second;
        const diff = first.signedTotal - second.signedTotal;

        if (diff > 0.000001 || (Math.abs(diff) <= 0.000001 && first.wins < second.wins)) {
            left = second;
            right = first;
        } else if (Math.abs(diff) <= 0.000001 && first.wins === second.wins && first.acronym > second.acronym) {
            left = second;
            right = first;
        }

        const avgGap = pair.totalGap / pair.sessions.length;

        return {
            teamName: pair.teamName,
            teamColor: pair.teamColor,
            avgGap: avgGap,
            left: left,
            right: right,
            sessionCount: pair.sessions.length,
            dots: pair.sessions.sort(function(a, b) {
                return a.sessionIndex - b.sessionIndex;
            }).map(function(session, index) {
                return {
                    signedGap: session.fasterDriverNumber === safeDriverNumber(left) ? -session.gap : session.gap,
                    winner: session.fasterDriverNumber === safeDriverNumber(left) ? 'left' : 'right',
                    label: session.label,
                    index: index
                };
            })
        };
    }).filter(Boolean).sort(function(a, b) {
        if (a.avgGap !== b.avgGap) return a.avgGap - b.avgGap;
        return a.teamName.localeCompare(b.teamName);
    });
}

function buildQualifyingGapRaceRows(sessionMap, sessionTeams) {
    return Object.keys(sessionMap).map(function(sessionKey) {
        const sessionInfo = sessionMap[sessionKey] || {};
        const session = sessionInfo.session || {};
        const teamGroups = sessionTeams[sessionKey] || {};
        const pairs = [];

        Object.keys(teamGroups).forEach(function(teamKey) {
            const entries = Object.keys(teamGroups[teamKey]).map(function(driverKey) {
                return teamGroups[teamKey][driverKey];
            }).sort(function(a, b) {
                return a.bestTime - b.bestTime;
            });
            if (entries.length !== 2) return;

            const comparison = getSharedQualifyingComparison(entries[0], entries[1], session);
            if (!comparison) return;

            const faster = comparison.fasterEntry.driver;
            const slower = comparison.slowerEntry.driver;
            const teamName = faster.teamName || slower.teamName || 'Team';
            const teamColor = faster.teamColor || slower.teamColor || '3b82f6';

            pairs.push({
                teamKey: teamKey,
                teamName: teamName,
                teamColor: teamColor,
                gap: comparison.gap,
                stageLabel: comparison.stageLabel,
                faster: {
                    driverNumber: faster.driverNumber,
                    acronym: deriveAcronym(faster),
                    fullName: getDriverDisplayName(faster),
                    headshot: faster.headshot || '',
                    teamName: teamName
                },
                slower: {
                    driverNumber: slower.driverNumber,
                    acronym: deriveAcronym(slower),
                    fullName: getDriverDisplayName(slower),
                    headshot: slower.headshot || '',
                    teamName: teamName
                }
            });
        });

        pairs.sort(function(a, b) {
            if (a.gap !== b.gap) return a.gap - b.gap;
            return a.teamName.localeCompare(b.teamName);
        });

        if (!pairs.length) return null;

        const totalGap = pairs.reduce(function(sum, pair) {
            return sum + pair.gap;
        }, 0);

        return {
            sessionKey: sessionKey,
            index: sessionInfo.index || 0,
            meetingName: session.meeting_name || session.circuit_short_name || session.country_name || session.location || 'Qualifying',
            sessionName: session.session_name || session.session_type || 'Qualifying',
            sessionLabel: getSessionLabel(session),
            dateLabel: formatSessionDateShort(session),
            pairCount: pairs.length,
            avgGap: totalGap / pairs.length,
            smallestGap: pairs[0].gap,
            biggestGap: pairs[pairs.length - 1].gap,
            pairs: pairs
        };
    }).filter(Boolean).sort(function(a, b) {
        return a.index - b.index;
    });
}

// ─── Rendering ───────────────────────────────────────────────────────────

function createQualifyingSkeletonRows(count) {
    let html = '<div class="quali-gaps-list">';
    for (let i = 0; i < count; i++) {
        html += '<div class="quali-skeleton-card"><div class="quali-skeleton-grid">'
            + '<div class="quali-skeleton-side left"><div class="skel skel-circle"></div><div style="flex:1;min-width:0;"><div class="skel" style="width:40px;height:18px;"></div><div class="skel" style="width:70px;height:11px;margin-top:6px;"></div><div class="skel" style="width:90px;height:10px;margin-top:6px;"></div></div></div>'
            + '<div class="quali-skeleton-track-wrap"><div class="skel" style="width:120px;height:10px;margin-bottom:0.7rem;"></div><div class="skel quali-skeleton-track"></div><div class="skel" style="width:100%;height:10px;margin-top:0.7rem;"></div></div>'
            + '<div class="quali-skeleton-side right" style="justify-content:flex-end;"><div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-end;"><div class="skel" style="width:40px;height:18px;"></div><div class="skel" style="width:70px;height:11px;margin-top:6px;"></div><div class="skel" style="width:90px;height:10px;margin-top:6px;"></div></div><div class="skel skel-circle"></div></div>'
            + '</div></div>';
    }
    return html + '</div>';
}

function renderQualifyingGapOverview(rows) {
    const maxSessionGap = rows.reduce(function(max, row) {
        const rowMax = row.dots.reduce(function(acc, dot) {
            return Math.max(acc, Math.abs(dot.signedGap));
        }, 0);
        return Math.max(max, rowMax);
    }, 0);
    const scale = Math.max(0.2, roundUp(maxSessionGap || 0.2, 0.05));
    const laneOffsets = [28, 40, 52, 64, 34, 58];
    let html = '<div class="quali-gaps-list">';

    rows.forEach(function(row) {
        let leftColor = getDriverAccentColor(row.left, row.teamColor, 30);
        let rightColor = getDriverAccentColor(row.right, row.teamColor, -20);
        if (leftColor === rightColor) rightColor = adjustHexColor(row.teamColor, -42);

        const pairColor = hexToRgbChannels(row.teamColor);
        const leftChannels = hexToRgbChannels(leftColor);
        const rightChannels = hexToRgbChannels(rightColor);
        const leftHeadshot = getCachedHeadshotResult('', row.left.fullName, row.left.headshot || '');
        const rightHeadshot = getCachedHeadshotResult('', row.right.fullName, row.right.headshot || '');

        html += '<div class="quali-gap-card">'
            + '<div class="quali-gap-card-inner" style="--pair-color:' + esc(pairColor) + ';--left-color:' + esc(leftChannels) + ';--right-color:' + esc(rightChannels) + ';">'
            + '<div class="quali-side left">'
            + '<div class="quali-side-top"><span class="quali-h2h-count">' + row.left.wins + '</span><span class="quali-h2h-label">H2H</span></div>'
            + '<div class="quali-gap-avg fast">' + esc(formatSignedGap(-row.avgGap, false)) + '</div>'
            + '<div class="quali-driver">'
            + (leftHeadshot.url
                ? '<img class="quali-headshot" src="' + esc(leftHeadshot.url) + '" alt="' + esc(row.left.fullName) + '" width="48" height="48"' + leftHeadshot.style + ' loading="lazy" decoding="async">'
                    + '<div class="quali-avatar-fallback" style="display:none;--driver-color:' + esc(leftChannels) + ';">' + esc(row.left.acronym) + '</div>'
                : '<div class="quali-avatar-fallback" style="--driver-color:' + esc(leftChannels) + ';">' + esc(row.left.acronym) + '</div>')
            + '<div class="quali-driver-meta"><div class="quali-driver-code">' + esc(row.left.acronym) + '</div><div class="quali-driver-name">' + esc(row.left.fullName) + '</div></div>'
            + '</div>'
            + '</div>'
            + '<div class="quali-track-wrap">'
            + '<div class="quali-track-meta"><span class="quali-track-team">' + esc(row.teamName) + '</span><span class="quali-track-note">' + esc(formatSessionCount(row.sessionCount)) + ' · avg gap ' + esc(row.avgGap.toFixed(3)) + 's</span></div>'
            + '<div class="quali-track">'
            + '<div class="quali-zero-line" aria-hidden="true"></div>'
            + '<div class="quali-dots">';

        row.dots.forEach(function(dot, dotIndex) {
            const leftPct = 50 + (dot.signedGap / scale) * 50;
            const top = laneOffsets[dotIndex % laneOffsets.length];
            const gapLabel = formatSignedGap(dot.signedGap, true);
            const tooltipSide = top <= 34 ? ' tooltip-bottom' : '';
            html += '<button type="button" class="quali-dot' + tooltipSide + '" aria-label="' + esc(dot.label + ' · ' + gapLabel) + '" aria-expanded="false" style="left:' + clampNumber(leftPct, 2, 98).toFixed(2) + '%;top:' + top + '%;--dot-color:' + esc(dot.winner === 'left' ? leftChannels : rightChannels) + ';">'
                + '<span class="quali-dot-tooltip" role="tooltip"><span class="quali-dot-tooltip-gap">' + esc(gapLabel) + '</span><span class="quali-dot-tooltip-session">' + esc(dot.label) + '</span></span>'
                + '</button>';
        });

        html += '</div></div>'
            + '<div class="quali-track-scale"><span>' + esc(formatScaleValue(scale)) + 's</span><span>0</span><span>' + esc(formatScaleValue(scale)) + 's</span></div>'
            + '</div>'
            + '<div class="quali-side right">'
            + '<div class="quali-side-top"><span class="quali-h2h-count">' + row.right.wins + '</span><span class="quali-h2h-label">H2H</span></div>'
            + '<div class="quali-gap-avg slow">' + esc(formatSignedGap(row.avgGap, false)) + '</div>'
            + '<div class="quali-driver">'
            + (rightHeadshot.url
                ? '<img class="quali-headshot" src="' + esc(rightHeadshot.url) + '" alt="' + esc(row.right.fullName) + '" width="48" height="48"' + rightHeadshot.style + ' loading="lazy" decoding="async">'
                    + '<div class="quali-avatar-fallback" style="display:none;--driver-color:' + esc(rightChannels) + ';">' + esc(row.right.acronym) + '</div>'
                : '<div class="quali-avatar-fallback" style="--driver-color:' + esc(rightChannels) + ';">' + esc(row.right.acronym) + '</div>')
            + '<div class="quali-driver-meta"><div class="quali-driver-code">' + esc(row.right.acronym) + '</div><div class="quali-driver-name">' + esc(row.right.fullName) + '</div></div>'
            + '</div>'
            + '</div>'
            + '</div>'
            + '</div>';
    });

    return html + '</div>';
}

function renderQualifyingRaceDriverPin(driver, topPct, driverChannels) {
    const headshot = getCachedHeadshotResult('', driver.fullName, driver.headshot || '');
    return '<div class="quali-race-driver-pin" style="top:' + topPct.toFixed(2) + '%;--driver-color:' + esc(driverChannels) + ';">'
        + '<div class="quali-race-avatar">'
        + (headshot.url
            ? '<img src="' + esc(headshot.url) + '" alt="' + esc(driver.fullName) + '" width="58" height="58"' + headshot.style + ' loading="lazy" decoding="async">'
                + '<div class="quali-race-avatar-fallback" style="display:none;">' + esc(driver.acronym) + '</div>'
            : '<div class="quali-race-avatar-fallback">' + esc(driver.acronym) + '</div>')
        + '</div>'
        + '<span class="quali-race-code">' + esc(driver.acronym) + '</span>'
        + '<span class="quali-race-name">' + esc(driver.fullName) + '</span>'
        + '</div>';
}

function renderQualifyingGapRaceView(rows, selectedRow) {
    const selectorOptions = rows.slice().reverse().map(function(row) {
        return '<option value="' + esc(row.sessionKey) + '"' + (String(row.sessionKey) === String(selectedRow.sessionKey) ? ' selected' : '') + '>' + esc(row.meetingName + ' · ' + row.sessionName + (row.dateLabel ? ' · ' + row.dateLabel : '')) + '</option>';
    }).join('');
    const maxGap = selectedRow.pairs.reduce(function(max, pair) {
        return Math.max(max, pair.gap);
    }, 0);
    const chartMinWidth = Math.max(980, selectedRow.pairs.length * 116);
    let html = '<div class="quali-race-card">'
        + '<div class="quali-race-head"><div class="quali-race-head-copy"><h3 class="quali-race-head-title">Teammate Gaps By Session</h3><p class="quali-race-head-note">Ο ταχύτερος teammate είναι επάνω, ο πιο αργός κάτω, και τα teams ταξινομούνται από το μικρότερο στο μεγαλύτερο gap.</p></div><label class="quali-race-controls"><span class="quali-race-controls-label">Available sessions</span><select class="quali-race-select" data-quali-race-select aria-label="Επιλογή qualifying session για teammate gaps">' + selectorOptions + '</select></label></div>'
        + '<div class="quali-race-summary"><div><div class="quali-race-summary-title">' + esc(selectedRow.meetingName) + '</div><div class="quali-race-summary-sub">' + esc(selectedRow.sessionName + (selectedRow.dateLabel ? ' · ' + selectedRow.dateLabel : '')) + '</div></div><div class="quali-race-summary-stats"><div class="quali-race-summary-stat"><span class="quali-race-summary-label">Teams</span><span class="quali-race-summary-value">' + esc(String(selectedRow.pairCount)) + '</span></div><div class="quali-race-summary-stat"><span class="quali-race-summary-label">Smallest</span><span class="quali-race-summary-value">' + esc(formatSignedGap(selectedRow.smallestGap, true)) + '</span></div><div class="quali-race-summary-stat"><span class="quali-race-summary-label">Biggest</span><span class="quali-race-summary-value">' + esc(formatSignedGap(selectedRow.biggestGap, true)) + '</span></div><div class="quali-race-summary-stat"><span class="quali-race-summary-label">Average</span><span class="quali-race-summary-value">' + esc(formatSignedGap(selectedRow.avgGap, true)) + '</span></div></div></div>'
        + '<div class="quali-race-chart-scroll"><div class="quali-race-chart" style="--pair-count:' + selectedRow.pairCount + ';min-width:' + chartMinWidth + 'px;">';

    selectedRow.pairs.forEach(function(pair) {
        const fasterColor = getDriverAccentColor(pair.faster, pair.teamColor, 24);
        const slowerColor = getDriverAccentColor(pair.slower, pair.teamColor, -18);
        const topColor = fasterColor;
        const bottomColor = slowerColor === fasterColor ? adjustHexColor(pair.teamColor, -40) : slowerColor;
        const topChannels = hexToRgbChannels(topColor);
        const bottomChannels = hexToRgbChannels(bottomColor);
        const spanPct = maxGap > 0 ? 18 + (pair.gap / maxGap) * 58 : 18;
        const topPct = 12;
        const bottomPct = clampNumber(topPct + spanPct, topPct + 18, 88);
        const badgePct = (topPct + bottomPct) / 2;

        html += '<article class="quali-race-pair" style="--top-color:' + esc(topChannels) + ';--bottom-color:' + esc(bottomChannels) + ';">'
            + renderQualifyingRaceDriverPin(pair.faster, topPct, topChannels)
            + '<div class="quali-race-gap-line" style="top:' + topPct.toFixed(2) + '%;height:' + (bottomPct - topPct).toFixed(2) + '%;"></div>'
            + '<div class="quali-race-gap-badge" style="top:' + badgePct.toFixed(2) + '%;"><span class="quali-race-gap-value">' + esc(formatSignedGap(pair.gap, true)) + '</span><span class="quali-race-gap-stage">(' + esc(pair.stageLabel) + ')</span></div>'
            + renderQualifyingRaceDriverPin(pair.slower, bottomPct, bottomChannels)
            + '<div class="quali-race-team">' + esc(pair.teamName) + '</div>'
            + '</article>';
    });

    return html + '</div></div></div>';
}

function renderQualifyingGaps(data) {
    state.overviewRows = data && data.overviewRows ? data.overviewRows : [];
    state.raceRows = data && data.raceRows ? data.raceRows : [];

    const overviewRows = state.overviewRows;
    const raceRows = state.raceRows;

    if ((!overviewRows || !overviewRows.length) && (!raceRows || !raceRows.length)) {
        qualifyingGapsTable.innerHTML = '<div class="quali-empty-card">'
            + '<svg class="icon" aria-hidden="true"><use href="#fa-stopwatch"/></svg>'
            + '<p>Δεν υπάρχουν ακόμη αρκετά qualifying δεδομένα για teammate gaps.</p>'
            + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το tab ενεργοποιείται μόλις υπάρξουν completed qualifying ή sprint shootout sessions.</p>'
            + '</div>';
        if (onRendered) onRendered('quali-gaps');
        return;
    }

    if (!state.activeView) state.activeView = 'overview';
    if (!raceRows.length) state.activeView = 'overview';
    if (raceRows.length && (!state.selectedSessionKey || !raceRows.some(function(row) { return String(row.sessionKey) === String(state.selectedSessionKey); }))) {
        state.selectedSessionKey = raceRows[raceRows.length - 1].sessionKey;
    }

    const selectedRow = raceRows.filter(function(row) {
        return String(row.sessionKey) === String(state.selectedSessionKey);
    })[0] || raceRows[raceRows.length - 1];

    if (!overviewRows.length && selectedRow) state.activeView = 'race-detail';

    const activeView = state.activeView === 'race-detail' && selectedRow ? 'race-detail' : 'overview';
    const viewContent = activeView === 'race-detail'
        ? renderQualifyingGapRaceView(raceRows, selectedRow)
        : renderQualifyingGapOverview(overviewRows);
    let html = '';

    if (raceRows.length) {
        html = '<div class="quali-view-switch"><div class="quali-view-tabs" role="tablist" aria-label="Qualifying gaps views">'
            + '<button class="quali-view-tab' + (activeView === 'overview' ? ' active' : '') + '" type="button" data-quali-view="overview" role="tab" aria-selected="' + (activeView === 'overview' ? 'true' : 'false') + '">Overview</button>'
            + '<button class="quali-view-tab' + (activeView === 'race-detail' ? ' active' : '') + '" type="button" data-quali-view="race-detail" role="tab" aria-selected="' + (activeView === 'race-detail' ? 'true' : 'false') + '">By Race</button>'
            + '</div></div>';
    }

    qualifyingGapsTable.innerHTML = html + viewContent;
    if (onRendered) onRendered('quali-gaps');
}

function showQualifyingError() {
    qualifyingGapsTable.innerHTML = '<div class="quali-empty-card">'
        + '<svg class="icon" aria-hidden="true"><use href="#fa-exclamation-triangle"/></svg>'
        + '<p>Δεν ήταν δυνατή η φόρτωση των teammate qualifying gaps.</p>'
        + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το OpenF1 endpoint ίσως να μην είναι διαθέσιμο προσωρινά.</p>'
        + '<button class="retry-btn" type="button" onclick="window.__retryQualifyingGaps && window.__retryQualifyingGaps()"><svg class="icon" aria-hidden="true"><use href="#fa-redo"/></svg> Νέα προσπάθεια</button>'
        + '</div>';
    if (onRendered) onRendered('quali-gaps');
}

window.__retryQualifyingGaps = function() {
    state.loaded = false;
    ensureLoaded(true);
};
