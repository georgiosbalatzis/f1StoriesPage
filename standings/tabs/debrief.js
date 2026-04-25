// Friday Debrief tab — standalone ES module (Phase 6C, step 8).
//
// Extracted from standings.legacy.js so direct landings on
// ?tab=debrief no longer need the legacy bundle. The module owns snapshot
// loading, round + view selection, ideal-chart subview state, and chart
// tooltip behavior. standings.js lazy-loads this module, wires
// onRendered / onRoundChange / onViewChange once via initDebrief(), and
// syncs deep links through getSelectedRound() / setSelectedRound() and
// getActiveView() / setActiveView().

import { esc, escAttr } from '../core/format.js';
import {
    getCanonicalTeamColor,
    getCanonicalTeamName,
    resolveTeamId
} from '../core/teams.js';
import {
    getCachedHeadshotResult,
    normalizeDriverLookupKey
} from '../core/drivers-meta.js';
import { fetchJSONNoCache } from '../core/fetchers.js';
import { parseNumberValue, isFiniteNumber, parseTimeSeconds } from './_shared.js';

const YEAR = new Date().getFullYear();
const DEBRIEF_CACHE_URL = 'debrief-cache.json';

const debriefTable = document.getElementById('debrief-table');
const debriefYear = document.getElementById('debrief-year');

const state = {
    loaded: false,
    loading: false,
    rounds: [],
    selectedRound: '',
    activeView: 'single-lap',
    idealChartView: 'classified',
    snapshot: null
};

let debriefTooltip = null;
let debriefTooltipTarget = null;
let onRendered = null;
let onRoundChange = null;
let onViewChange = null;
let listenersBound = false;
let globalListenersBound = false;

export function initDebrief(options) {
    if (options && typeof options.onRendered === 'function') onRendered = options.onRendered;
    if (options && typeof options.onRoundChange === 'function') onRoundChange = options.onRoundChange;
    if (options && typeof options.onViewChange === 'function') onViewChange = options.onViewChange;

    if (!listenersBound && debriefTable) {
        // Capture-phase binding stops the legacy bundle's own debrief
        // handlers from also re-rendering after the orchestrator hands
        // ownership of the tab to this module.
        debriefTable.addEventListener('mouseover', handleTableMouseOver, true);
        debriefTable.addEventListener('mousemove', handleTableMouseMove, true);
        debriefTable.addEventListener('mouseout', handleTableMouseOut, true);
        debriefTable.addEventListener('focusin', handleTableFocusIn, true);
        debriefTable.addEventListener('focusout', handleTableFocusOut, true);
        debriefTable.addEventListener('change', handleTableChange, true);
        debriefTable.addEventListener('click', handleTableClick, true);
        listenersBound = true;
    }

    if (!globalListenersBound) {
        document.addEventListener('click', handleDocumentClick, true);
        window.addEventListener('scroll', hideDebriefTooltip, true);
        window.addEventListener('resize', hideDebriefTooltip);
        globalListenersBound = true;
    }
}

export function getSelectedRound() {
    return state.selectedRound || '';
}

export function setSelectedRound(round) {
    const next = round == null ? '' : String(round);
    if (next === state.selectedRound) return;
    state.selectedRound = next;
    if (state.loaded && state.snapshot) renderDebrief(state.snapshot);
}

export function getActiveView() {
    return state.activeView || 'single-lap';
}

export function setActiveView(view) {
    const next = sanitizeDebriefView(view);
    if (next === state.activeView) return;
    state.activeView = next;
    if (state.loaded && state.snapshot) renderDebrief(state.snapshot);
}

export function ensureLoaded(forceReload) {
    if (!debriefTable) return;
    if (state.loading) return;
    if (state.loaded && state.snapshot && !forceReload) {
        renderDebrief(state.snapshot);
        return;
    }

    state.loading = true;
    debriefTable.innerHTML = '<div class="debrief-loading"><svg class="icon fa-spin" aria-hidden="true"><use href="#fa-circle-notch"/></svg><p>Loading Friday Debrief snapshot...</p></div>';

    fetchJSONNoCache(DEBRIEF_CACHE_URL, 8000).then(function(payload) {
        state.snapshot = normalizeDebriefSnapshot(payload);
        state.rounds = state.snapshot.rounds.slice();
        state.loaded = true;
        renderDebrief(state.snapshot);
    }).catch(function(error) {
        console.error('Friday Debrief error:', error);
        showDebriefError();
    }).finally(function() {
        state.loading = false;
    });
}

function fireRendered() {
    if (onRendered) onRendered('debrief');
}

function sanitizeDebriefView(value) {
    const valid = ['single-lap', 'long-run', 'tyre-deg', 'team-ideal', 'corners', 'race-pace'];
    return valid.indexOf(value) !== -1 ? value : 'single-lap';
}

function sanitizeDebriefIdealChartView(value) {
    return value === 'ideal' || value === 'gap' ? value : 'classified';
}

function deriveSnapshotAcronym(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'DRV';
    if (parts.length === 1) return parts[0].substring(0, 3).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0) + parts[parts.length - 1].charAt(1)).toUpperCase().slice(0, 3);
}

function formatRaceDate(race) {
    const value = race && race.date ? race.date : race;
    let date;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const parts = value.split('-');
        date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
        date = new Date(value);
    }
    return date.toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatLapTime(seconds, forceMinutes) {
    if (!isFiniteNumber(seconds)) return 'n/a';
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds - minutes * 60;
    let secText = remaining.toFixed(3);
    if (remaining < 10) secText = '0' + secText;
    if (forceMinutes || minutes > 0) return minutes + ':' + secText;
    return remaining.toFixed(3);
}

function getDebriefCompoundClass(compound) {
    const value = String(compound || '').toLowerCase();
    if (value.indexOf('soft') !== -1) return 'compound-soft';
    if (value.indexOf('medium') !== -1) return 'compound-medium';
    if (value.indexOf('hard') !== -1) return 'compound-hard';
    return '';
}

function getDebriefDegClass(value) {
    const deg = parseNumberValue(value);
    if (deg && deg <= 0.045) return 'debrief-deg-good';
    if (deg && deg <= 0.060) return 'debrief-deg-mid';
    return 'debrief-deg-bad';
}

function buildDebriefDriverCellHTML(entry) {
    const headshot = getCachedHeadshotResult(entry.driverId, entry.fullName, entry.headshot || '');
    const teamColor = '#' + esc(entry.teamColor || '3b82f6');
    return '<div class="debrief-driver-cell" style="--debrief-team-color:' + teamColor + ';">'
        + '<span class="debrief-team-bar" style="background:' + teamColor + ';"></span>'
        + (headshot.url
            ? '<img src="' + esc(headshot.url) + '" alt="' + esc(entry.fullName) + '" width="44" height="44"' + headshot.style + ' loading="lazy" decoding="async">'
                + '<span class="debrief-avatar-fallback" style="display:none;">' + esc(entry.code) + '</span>'
            : '<span class="debrief-avatar-fallback">' + esc(entry.code) + '</span>')
        + '<div><div class="debrief-driver-code">' + esc(entry.code) + '</div><div class="debrief-driver-name">' + esc(entry.fullName) + ' · ' + esc(entry.teamName) + '</div></div>'
        + '</div>';
}

function deriveDebriefTeamCode(teamKey, teamName) {
    const key = resolveTeamId(teamKey, teamName);
    if (key === 'mclaren') return 'MCL';
    if (key === 'red_bull') return 'RBR';
    if (key === 'ferrari') return 'FER';
    if (key === 'mercedes') return 'MER';
    if (key === 'aston_martin') return 'AMR';
    if (key === 'alpine') return 'ALP';
    if (key === 'haas') return 'HAA';
    if (key === 'rb') return 'RB';
    if (key === 'williams') return 'WIL';
    if (key === 'audi') return 'AUD';
    if (key === 'cadillac') return 'CAD';
    return String(teamName || '').replace(/[^A-Za-z0-9]+/g, '').toUpperCase().slice(0, 3) || 'TM';
}

function normalizeDebriefSnapshot(payload) {
    function normalizeEntries(list) {
        if (!Array.isArray(list)) return [];
        return list.map(function(entry, index) {
            const fullName = String(entry && (entry.fullName || entry.name || entry.code) || 'Unknown Driver');
            const driverId = normalizeDriverLookupKey(entry && (entry.driverId || entry.code || fullName));
            const code = String(entry && (entry.code || deriveSnapshotAcronym(fullName)) || 'DRV').toUpperCase().slice(0, 3);
            const teamKey = resolveTeamId(entry && entry.teamKey || '', entry && entry.teamName || '');
            const teamName = getCanonicalTeamName(teamKey) || getCanonicalTeamName(entry && entry.teamName || '') || String(entry && entry.teamName || teamKey || 'Unknown');
            const teamColor = getCanonicalTeamColor(teamKey, teamName, entry && entry.teamColor || '');
            let degValue = '';
            if (entry && (entry.deg != null || entry.degPerLap != null)) {
                degValue = entry.deg != null ? entry.deg : entry.degPerLap;
            }
            return {
                order: index + 1,
                driverId: driverId,
                code: code,
                fullName: fullName,
                teamKey: teamKey,
                teamName: teamName,
                teamColor: teamColor,
                headshot: getCachedHeadshotResult(driverId, fullName, '').url,
                compound: String(entry && entry.compound || ''),
                lapTime: String(entry && (entry.lapTime || entry.time) || ''),
                s1: String(entry && entry.s1 || ''),
                s2: String(entry && entry.s2 || ''),
                s3: String(entry && entry.s3 || ''),
                idealLap: String(entry && entry.idealLap || ''),
                gap: String(entry && entry.gap != null ? entry.gap : ''),
                laps: parseInt(entry && entry.laps, 10) || 0,
                avgLap: String(entry && (entry.avgLap || entry.time) || ''),
                delta: String(entry && entry.delta != null ? entry.delta : ''),
                deg: String(degValue),
                stintLaps: parseInt(entry && (entry.stintLaps || entry.laps), 10) || 0,
                window: String(entry && entry.window || ''),
                sourceSession: String(entry && entry.sourceSession || '')
            };
        });
    }

    function normalizeTeamEntries(list) {
        if (!Array.isArray(list)) return [];
        return list.map(function(entry, index) {
            const teamKey = resolveTeamId(entry && entry.teamKey || '', entry && entry.teamName || '');
            const teamName = getCanonicalTeamName(entry && (entry.teamName || teamKey) || '') || String(entry && (entry.teamName || teamKey) || 'Unknown');
            const teamColor = getCanonicalTeamColor(teamKey, teamName, entry && entry.teamColor || '');
            return {
                pos: parseInt(entry && entry.pos, 10) || (index + 1),
                teamKey: teamKey,
                teamName: teamName,
                teamColor: teamColor,
                code: String(entry && entry.code || deriveDebriefTeamCode(teamKey, teamName)).toUpperCase().slice(0, 4),
                lapTime: String(entry && entry.lapTime || ''),
                s1: String(entry && entry.s1 || ''),
                s2: String(entry && entry.s2 || ''),
                s3: String(entry && entry.s3 || ''),
                idealLap: String(entry && entry.idealLap || ''),
                gapToFirst: entry && entry.gapToFirst != null ? String(entry.gapToFirst) : '',
                slowCorners: entry && entry.slowCorners != null ? String(entry.slowCorners) : '',
                mediumCorners: entry && entry.mediumCorners != null ? String(entry.mediumCorners) : '',
                fastCorners: entry && entry.fastCorners != null ? String(entry.fastCorners) : '',
                overall: entry && entry.overall != null ? String(entry.overall) : '',
                predictedLap: String(entry && entry.predictedLap || ''),
                strategy: String(entry && entry.strategy || '')
            };
        });
    }

    if (!payload || !Array.isArray(payload.rounds) || !payload.rounds.length) {
        throw new Error('No Friday Debrief snapshot available');
    }

    const rounds = payload.rounds.map(function(entry) {
        const round = parseInt(entry && entry.round, 10) || 0;
        return {
            round: round,
            grandPrix: String(entry && (entry.grandPrix || entry.name) || ('Round ' + round)),
            location: String(entry && entry.location || ''),
            date: String(entry && entry.date || ''),
            singleLap: normalizeEntries(entry && entry.singleLap),
            longRun: normalizeEntries(entry && entry.longRun),
            tyreDeg: normalizeEntries(entry && entry.tyreDeg),
            compoundUsage: [],
            teamIdealLap: normalizeTeamEntries(entry && entry.teamIdealLap),
            cornerPerformance: normalizeTeamEntries(entry && entry.cornerPerformance),
            racePacePrediction: normalizeTeamEntries(entry && entry.racePacePrediction)
        };
    }).filter(function(round) {
        return round.round > 0;
    });

    rounds.sort(function(a, b) {
        return a.round - b.round;
    });

    if (!rounds.length) {
        throw new Error('No Friday Debrief rounds available');
    }

    return {
        version: parseInt(payload.version, 10) || 1,
        season: parseInt(payload.season, 10) || YEAR,
        generatedAt: String(payload.generatedAt || ''),
        source: payload.source || {},
        rounds: rounds
    };
}

function buildDebriefRoundSelector(rounds, selectedRound) {
    const options = rounds.map(function(round) {
        const roundKey = String(round.round);
        return '<option value="' + esc(roundKey) + '"' + (roundKey === String(selectedRound) ? ' selected' : '') + '>'
            + 'R' + esc(roundKey) + ' · ' + esc(round.grandPrix) + ' · ' + esc(formatRaceDate(round))
            + '</option>';
    }).join('');
    return '<div class="debrief-round-selector"><label class="debrief-round-picker"><span class="debrief-round-label">Select Grand Prix</span><select class="debrief-round-select" data-debrief-select aria-label="Select Friday Debrief round">' + options + '</select></label></div>';
}

function buildDebriefViewSwitch() {
    return '<div class="debrief-view-switch"><div class="debrief-view-tabs" role="tablist" aria-label="Friday Debrief views">'
        + '<button class="debrief-view-tab' + (state.activeView === 'single-lap' ? ' active' : '') + '" type="button" data-debrief-view="single-lap" role="tab" aria-selected="' + (state.activeView === 'single-lap' ? 'true' : 'false') + '"><svg class="icon" aria-hidden="true"><use href="#fa-stopwatch"/></svg> Single Lap</button>'
        + '<button class="debrief-view-tab' + (state.activeView === 'long-run' ? ' active' : '') + '" type="button" data-debrief-view="long-run" role="tab" aria-selected="' + (state.activeView === 'long-run' ? 'true' : 'false') + '"><svg class="icon" aria-hidden="true"><use href="#fa-wave-square"/></svg> Long Run</button>'
        + '<button class="debrief-view-tab' + (state.activeView === 'tyre-deg' ? ' active' : '') + '" type="button" data-debrief-view="tyre-deg" role="tab" aria-selected="' + (state.activeView === 'tyre-deg' ? 'true' : 'false') + '"><svg class="icon" aria-hidden="true"><use href="#fa-chart-line"/></svg> Tyre Deg</button>'
        + '<button class="debrief-view-tab' + (state.activeView === 'team-ideal' ? ' active' : '') + '" type="button" data-debrief-view="team-ideal" role="tab" aria-selected="' + (state.activeView === 'team-ideal' ? 'true' : 'false') + '"><svg class="icon" aria-hidden="true"><use href="#fa-users"/></svg> Team Ideal</button>'
        + '<button class="debrief-view-tab' + (state.activeView === 'corners' ? ' active' : '') + '" type="button" data-debrief-view="corners" role="tab" aria-selected="' + (state.activeView === 'corners' ? 'true' : 'false') + '"><svg class="icon" aria-hidden="true"><use href="#fa-road"/></svg> Corners</button>'
        + '<button class="debrief-view-tab' + (state.activeView === 'race-pace' ? ' active' : '') + '" type="button" data-debrief-view="race-pace" role="tab" aria-selected="' + (state.activeView === 'race-pace' ? 'true' : 'false') + '"><svg class="icon" aria-hidden="true"><use href="#fa-gauge-high"/></svg> Race Pace</button>'
        + '</div></div>';
}

function formatDebriefAxisTick(value) {
    return String(value.toFixed(1)).replace(/\.0$/, '');
}

function formatDebriefGapStat(gapSeconds, baseSeconds) {
    const pct = baseSeconds > 0 ? (gapSeconds / baseSeconds) * 100 : 0;
    return '+' + gapSeconds.toFixed(2) + ' (' + pct.toFixed(2) + '%)';
}

function buildDebriefTooltipText(parts) {
    return (parts || []).filter(function(part) {
        return part != null && String(part) !== '';
    }).join(' | ');
}

function ensureDebriefTooltip() {
    if (!document.body) return null;
    if (!debriefTooltip) {
        debriefTooltip = document.createElement('div');
        debriefTooltip.className = 'debrief-chart-tooltip';
        document.body.appendChild(debriefTooltip);
    }
    return debriefTooltip;
}

function hideDebriefTooltip() {
    if (!debriefTooltip) return;
    debriefTooltip.classList.remove('is-active');
    debriefTooltipTarget = null;
}

function showDebriefTooltip(target, clientX, clientY) {
    const tooltip = ensureDebriefTooltip();
    if (!tooltip || !target) return;

    const text = target.getAttribute('data-debrief-tooltip') || '';
    if (!text) {
        hideDebriefTooltip();
        return;
    }

    debriefTooltipTarget = target;
    tooltip.textContent = String(text).replace(/ \| /g, '\n');
    tooltip.classList.add('is-active');
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';

    const rect = tooltip.getBoundingClientRect();
    const x = clampNumber(clientX, (rect.width / 2) + 14, window.innerWidth - (rect.width / 2) - 14);
    let y = clientY - rect.height - 16;

    if (y < 14) {
        y = Math.min(window.innerHeight - rect.height - 14, clientY + 18);
    }

    tooltip.style.left = x.toFixed(1) + 'px';
    tooltip.style.top = y.toFixed(1) + 'px';
}

function showDebriefTooltipFromElement(target) {
    if (!target) return;
    const rect = target.getBoundingClientRect();
    showDebriefTooltip(target, rect.left + (rect.width / 2), rect.top + Math.min(rect.height / 2, 24));
}

function buildDebriefPaceChartHTML(title, rows) {
    if (!rows || !rows.length) {
        return '<div class="debrief-empty"><svg class="icon" aria-hidden="true"><use href="#fa-chart-bar"/></svg><p>No chart data available for this round.</p></div>';
    }

    const fastest = rows[0].seconds;
    const maxGap = rows.reduce(function(max, entry) {
        return Math.max(max, entry.seconds - fastest);
    }, 0);
    const axisMax = Math.max(0.5, Math.ceil((maxGap + 0.35) * 2) / 2);
    const ticks = [];

    for (let tick = 0; tick <= axisMax + 0.001; tick += 0.5) {
        ticks.push(tick);
    }

    const rowsHTML = rows.map(function(entry) {
        const gap = entry.seconds - fastest;
        const width = gap > 0 ? Math.max(2, (gap / axisMax) * 100) : 0;
        const valueStyle = gap > 0
            ? 'left:calc(' + width.toFixed(3) + '% + 0.55rem);'
            : 'left:0.5rem;';
        const tooltip = buildDebriefTooltipText([
            entry.teamName,
            'Predicted lap ' + formatLapTime(entry.seconds, true),
            'Gap ' + formatDebriefGapStat(gap, fastest)
        ]);
        return '<div class="debrief-hchart-row">'
            + '<div class="debrief-hchart-label">' + esc(entry.teamName) + '</div>'
            + '<div class="debrief-hchart-plot debrief-chart-hit" tabindex="0" data-debrief-tooltip="' + escAttr(tooltip) + '" style="--debrief-grid-count:' + Math.max(1, ticks.length - 1) + ';">'
            + (gap > 0 ? '<div class="debrief-hchart-bar" style="width:' + width.toFixed(3) + '%;background:#' + esc(entry.teamColor) + ';"></div>' : '')
            + '<div class="debrief-hchart-value" style="' + valueStyle + '">' + esc(formatDebriefGapStat(gap, fastest)) + '</div>'
            + '</div>'
            + '</div>';
    }).join('');

    const axisHTML = ticks.map(function(value) {
        return '<span>' + esc(formatDebriefAxisTick(value)) + '</span>';
    }).join('');

    return '<div class="debrief-figure">'
        + '<div class="debrief-figure-title">' + esc(title) + '</div>'
        + '<div class="debrief-hchart-shell">'
        + rowsHTML
        + '<div class="debrief-hchart-axis">' + axisHTML + '</div>'
        + '<div class="debrief-hchart-xlabel">Gap to Fastest - Lap (s)</div>'
        + '</div></div>';
}

function buildDebriefSingleLapHTML(round) {
    if (!round || !round.singleLap.length) {
        return '<div class="debrief-empty"><svg class="icon" aria-hidden="true"><use href="#fa-flag-checkered"/></svg><p>No single-lap data available for this round.</p></div>';
    }

    const rows = round.singleLap.map(function(entry, index) {
        const compoundClass = getDebriefCompoundClass(entry.compound);
        const gapText = (entry.gap && entry.gap !== 'null') ? entry.gap : (index === 0 ? 'Leader' : '');
        const gapClass = index === 0 ? 'debrief-delta-leader' : 'debrief-gap';
        return '<tr>'
            + '<td>' + (index + 1) + '</td>'
            + '<td>' + buildDebriefDriverCellHTML(entry) + '</td>'
            + '<td><span class="debrief-time">' + esc(entry.lapTime) + '</span></td>'
            + '<td><span class="' + gapClass + '">' + esc(gapText) + '</span></td>'
            + '<td><span class="compound-pill' + (compoundClass ? ' ' + compoundClass : '') + '">' + esc(entry.compound || 'n/a') + '</span></td>'
            + '<td>' + esc(String(entry.laps || 0)) + ' laps</td>'
            + '</tr>';
    }).join('');

    return '<div class="debrief-table"><table><thead><tr><th>P</th><th>Driver</th><th>Lap Time</th><th>Gap</th><th>Tyre</th><th>Laps</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function buildDebriefLongRunHTML(round) {
    if (!round || !round.longRun.length) {
        return '<div class="debrief-empty"><svg class="icon" aria-hidden="true"><use href="#fa-wave-square"/></svg><p>No long-run data available for this round.</p></div>';
    }

    const rows = round.longRun.map(function(entry, index) {
        const compoundClass = getDebriefCompoundClass(entry.compound);
        const deltaText = (entry.delta && entry.delta !== 'null') ? entry.delta : (index === 0 ? 'Leader' : '');
        return '<tr>'
            + '<td>' + (index + 1) + '</td>'
            + '<td>' + buildDebriefDriverCellHTML(entry) + '</td>'
            + '<td><span class="debrief-time">' + esc(entry.avgLap) + '</span></td>'
            + '<td><span class="debrief-gap">' + esc(deltaText) + '</span></td>'
            + '<td><span class="compound-pill' + (compoundClass ? ' ' + compoundClass : '') + '">' + esc(entry.compound || 'n/a') + '</span></td>'
            + '<td>' + esc(String(entry.stintLaps || 0)) + ' laps</td>'
            + '</tr>';
    }).join('');

    return '<div class="debrief-table"><table><thead><tr><th>P</th><th>Driver</th><th>Avg Lap</th><th>Delta</th><th>Tyre</th><th>Stint</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function buildDebriefTyreDegHTML(round) {
    if (!round || !round.tyreDeg.length) {
        return '<div class="debrief-empty"><svg class="icon" aria-hidden="true"><use href="#fa-chart-line"/></svg><p>No tyre-degradation data available for this round.</p></div>';
    }

    let leaderDeg = NaN;
    round.tyreDeg.forEach(function(entry) {
        const degValue = parseNumberValue(entry && entry.deg);
        if (!isFiniteNumber(degValue)) return;
        if (!isFiniteNumber(leaderDeg) || degValue < leaderDeg) {
            leaderDeg = degValue;
        }
    });

    const rows = round.tyreDeg.map(function(entry, index) {
        const compoundClass = getDebriefCompoundClass(entry.compound);
        const degValue = parseNumberValue(entry && entry.deg);
        const degText = entry.deg ? (entry.deg + ' s/lap') : 'n/a';
        const degClass = entry.deg ? getDebriefDegClass(entry.deg) : '';
        let deltaText = (entry.delta && entry.delta !== 'null') ? entry.delta : '';
        if (!deltaText && isFiniteNumber(degValue) && isFiniteNumber(leaderDeg)) {
            const deltaValue = degValue - leaderDeg;
            deltaText = deltaValue > 0.0004 ? ('+' + deltaValue.toFixed(3)) : '';
        }
        if (!deltaText && index === 0) {
            deltaText = 'Leader';
        }
        return '<tr>'
            + '<td>' + (index + 1) + '</td>'
            + '<td>' + buildDebriefDriverCellHTML(entry) + '</td>'
            + '<td><span class="debrief-time' + (degClass ? ' ' + degClass : '') + '">' + esc(degText) + '</span></td>'
            + '<td><span class="debrief-gap">' + esc(deltaText) + '</span></td>'
            + '<td><span class="compound-pill' + (compoundClass ? ' ' + compoundClass : '') + '">' + esc(entry.compound || 'n/a') + '</span></td>'
            + '<td>' + esc(String(entry.stintLaps || 0)) + ' laps</td>'
            + '</tr>';
    }).join('');

    return '<div class="debrief-table"><table><thead><tr><th>P</th><th>Driver</th><th>Deg Rate</th><th>Delta</th><th>Tyre</th><th>Stint</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function buildDebriefIdealScatterSVG(rows, title, xMin, xMax) {
    const width = 520;
    const left = 54;
    const right = 10;
    const top = 10;
    const bottom = 28;
    const rowGap = 16;
    const plotHeight = rows.length * rowGap;
    const height = top + bottom + plotHeight;
    const plotWidth = width - left - right;
    const range = Math.max(0.5, xMax - xMin);
    const ticks = [];

    for (let tick = xMin; tick <= xMax + 0.001; tick += 0.5) {
        ticks.push(tick);
    }

    const gridHTML = ticks.map(function(value) {
        const x = left + ((value - xMin) / range) * plotWidth;
        return '<line x1="' + x.toFixed(2) + '" y1="' + top + '" x2="' + x.toFixed(2) + '" y2="' + (top + plotHeight) + '" class="debrief-ideal-grid-line"></line>'
            + '<text x="' + x.toFixed(2) + '" y="' + (height - 6) + '" text-anchor="middle" class="debrief-ideal-tick">' + esc(formatDebriefAxisTick(value)) + '</text>';
    }).join('');

    const pointsHTML = rows.map(function(entry, index) {
        const y = top + index * rowGap + rowGap / 2;
        const x = left + ((entry.plotSeconds - xMin) / range) * plotWidth;
        const pointColor = entry.teamColor ? ('#' + entry.teamColor) : '#06b6d4';
        const tooltip = buildDebriefTooltipText([
            entry.code,
            'Lap ' + formatLapTime(entry.lapSeconds, true),
            'Ideal ' + formatLapTime(entry.idealSeconds, true),
            'Gap to ideal ' + (entry.lapSeconds > entry.idealSeconds ? '+' + (entry.lapSeconds - entry.idealSeconds).toFixed(3) : '+0.000')
        ]);
        return '<g class="debrief-chart-point" tabindex="0" data-debrief-tooltip="' + escAttr(tooltip) + '">'
            + '<text x="' + (left - 8) + '" y="' + (y + 4) + '" text-anchor="end" class="debrief-ideal-label">' + esc(entry.code) + '</text>'
            + '<circle class="debrief-chart-hit-area" cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="11"></circle>'
            + '<circle cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="4.8" fill="' + esc(pointColor) + '"></circle>'
            + '</g>';
    }).join('');

    return '<div class="debrief-ideal-panel">'
        + '<div class="debrief-ideal-panel-title">' + esc(title) + '</div>'
        + '<svg class="debrief-ideal-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + esc(title) + '">'
        + gridHTML + pointsHTML
        + '</svg>'
        + '<div class="debrief-ideal-axis-label">Lap Time (s)</div>'
        + '</div>';
}

function buildDebriefIdealGapBarsHTML(rows) {
    const maxGap = rows.reduce(function(max, entry) {
        return Math.max(max, entry.idealGap);
    }, 0);
    const axisMax = Math.max(0.1, Math.ceil((maxGap + 0.02) * 10) / 10);
    const tickStep = axisMax > 4 ? 1 : (axisMax > 2 ? 0.5 : (axisMax > 1 ? 0.2 : 0.1));
    const ticks = [];

    for (let tick = 0; tick <= axisMax + 0.001; tick += tickStep) {
        ticks.push(Number(tick.toFixed(3)));
    }

    const ticksHTML = ticks.map(function(value) {
        return '<span>' + esc(formatDebriefAxisTick(value)) + '</span>';
    }).join('');

    const barsHTML = rows.map(function(entry) {
        const height = axisMax > 0 ? (entry.idealGap / axisMax) * 100 : 0;
        const label = entry.idealGap > 0 ? '+' + entry.idealGap.toFixed(3) : '+0';
        const barColor = entry.teamColor ? ('#' + entry.teamColor) : '#f97316';
        const tooltip = buildDebriefTooltipText([
            entry.code,
            'Gap to ideal ' + label
        ]);
        return '<div class="debrief-ideal-bar-col debrief-chart-hit" tabindex="0" data-debrief-tooltip="' + escAttr(tooltip) + '">'
            + '<div class="debrief-ideal-bar-value">' + esc(label) + '</div>'
            + '<div class="debrief-ideal-bar-track"><div class="debrief-ideal-bar" style="height:' + height.toFixed(3) + '%;background:' + esc(barColor) + ';"></div></div>'
            + '<div class="debrief-ideal-bar-label">' + esc(entry.code) + '</div>'
            + '</div>';
    }).join('');

    return '<div class="debrief-ideal-bars-wrap">'
        + '<div class="debrief-ideal-panel-title">Gap to Ideal Lap</div>'
        + '<div class="debrief-ideal-bars-ytitle">Gap (s)</div>'
        + '<div class="debrief-ideal-bars-chart">'
        + '<div class="debrief-ideal-bars-axis">' + ticksHTML + '</div>'
        + '<div class="debrief-ideal-bars-grid" style="--debrief-grid-count:' + Math.max(1, ticks.length - 1) + ';">' + barsHTML + '</div>'
        + '</div>'
        + '</div>';
}

function buildDebriefTeamIdealHTML(round) {
    if (!round || !round.singleLap.length) {
        return '<div class="debrief-empty"><svg class="icon" aria-hidden="true"><use href="#fa-users"/></svg><p>No ideal-lap analysis available for this round.</p></div>';
    }

    const rows = round.singleLap.slice().map(function(entry, index) {
        return {
            pos: index + 1,
            code: entry.code || deriveSnapshotAcronym(entry.fullName),
            teamColor: entry.teamColor,
            lapSeconds: parseTimeSeconds(entry.lapTime),
            idealSeconds: parseTimeSeconds(entry.idealLap),
            plotSeconds: 0
        };
    }).filter(function(entry) {
        return isFiniteNumber(entry.lapSeconds) && isFiniteNumber(entry.idealSeconds);
    });

    if (!rows.length) {
        return '<div class="debrief-empty"><svg class="icon" aria-hidden="true"><use href="#fa-users"/></svg><p>No ideal-lap analysis available for this round.</p></div>';
    }

    const classified = rows.slice().sort(function(a, b) {
        if (a.pos && b.pos && a.pos !== b.pos) return a.pos - b.pos;
        return a.lapSeconds - b.lapSeconds;
    });
    const ideal = rows.slice().sort(function(a, b) {
        return a.idealSeconds - b.idealSeconds;
    });
    const leaderIdeal = ideal[0].idealSeconds;

    classified.forEach(function(entry) {
        entry.plotSeconds = entry.lapSeconds;
    });
    ideal.forEach(function(entry) {
        entry.plotSeconds = entry.idealSeconds;
    });

    const allTimes = classified.map(function(entry) { return entry.lapSeconds; }).concat(ideal.map(function(entry) { return entry.idealSeconds; }));
    const minTime = Math.floor(Math.min.apply(null, allTimes) * 2) / 2;
    const maxTime = Math.ceil((Math.max.apply(null, allTimes) + 0.2) * 2) / 2;
    const gapRows = ideal.slice().map(function(entry) {
        return {
            code: entry.code,
            teamColor: entry.teamColor,
            idealGap: Math.max(0, entry.idealSeconds - leaderIdeal)
        };
    }).sort(function(a, b) {
        return a.idealGap - b.idealGap;
    });
    const chartView = sanitizeDebriefIdealChartView(state.idealChartView);
    const tabsHTML = '<div class="debrief-ideal-switch"><div class="debrief-ideal-tabs" role="tablist" aria-label="Ideal lap analysis charts">'
        + '<button class="debrief-ideal-tab' + (chartView === 'classified' ? ' active' : '') + '" type="button" data-ideal-view="classified" role="tab" aria-selected="' + (chartView === 'classified' ? 'true' : 'false') + '">Classified Order</button>'
        + '<button class="debrief-ideal-tab' + (chartView === 'ideal' ? ' active' : '') + '" type="button" data-ideal-view="ideal" role="tab" aria-selected="' + (chartView === 'ideal' ? 'true' : 'false') + '">Ideal Order</button>'
        + '<button class="debrief-ideal-tab' + (chartView === 'gap' ? ' active' : '') + '" type="button" data-ideal-view="gap" role="tab" aria-selected="' + (chartView === 'gap' ? 'true' : 'false') + '">Gap to Ideal Lap</button>'
        + '</div></div>';
    const panelHTML = chartView === 'ideal'
        ? buildDebriefIdealScatterSVG(ideal, 'Ideal Order', minTime, maxTime)
        : (chartView === 'gap'
            ? buildDebriefIdealGapBarsHTML(gapRows)
            : buildDebriefIdealScatterSVG(classified, 'Classified Order', minTime, maxTime));

    return '<div class="debrief-figure">'
        + '<div class="debrief-figure-title">Ideal Lap Analysis</div>'
        + tabsHTML
        + panelHTML
        + '</div>';
}

function buildDebriefCornerPanelHTML(title, rows, metricKey) {
    const chartRows = rows.map(function(entry) {
        const gap = parseNumberValue(entry[metricKey]);
        return {
            code: entry.code || deriveDebriefTeamCode(entry.teamKey, entry.teamName),
            teamColor: entry.teamColor,
            gap: isFiniteNumber(gap) && gap > 0 ? gap : 0
        };
    }).sort(function(a, b) {
        return a.gap - b.gap;
    });
    const maxGap = chartRows.reduce(function(max, entry) {
        return Math.max(max, entry.gap);
    }, 0);
    const axisMax = Math.max(0.1, Math.ceil((maxGap + 0.02) * 10) / 10);
    const tickStep = axisMax > 0.6 ? 0.2 : 0.1;
    const ticks = [];

    for (let tick = 0; tick <= axisMax + 0.001; tick += tickStep) {
        ticks.push(Number(tick.toFixed(3)));
    }

    const rowsHTML = chartRows.map(function(entry) {
        const width = entry.gap > 0 ? Math.max(2, (entry.gap / axisMax) * 100) : 0;
        const valueText = entry.gap > 0 ? '+' + entry.gap.toFixed(3) : 'Leader';
        const valueStyle = entry.gap > 0
            ? 'left:calc(' + width.toFixed(3) + '% + 0.45rem);'
            : 'left:0.4rem;';
        const tooltip = buildDebriefTooltipText([
            title,
            entry.code,
            entry.gap > 0 ? 'Gap ' + valueText : 'Leader'
        ]);
        return '<div class="debrief-corner-row">'
            + '<div class="debrief-corner-label">' + esc(entry.code) + '</div>'
            + '<div class="debrief-corner-plot debrief-chart-hit" tabindex="0" data-debrief-tooltip="' + escAttr(tooltip) + '" style="--debrief-grid-count:' + Math.max(1, ticks.length - 1) + ';">'
            + (entry.gap > 0 ? '<div class="debrief-corner-bar" style="width:' + width.toFixed(3) + '%;background:#' + esc(entry.teamColor) + ';"></div>' : '')
            + '<div class="debrief-corner-value" style="' + valueStyle + '">' + esc(valueText) + '</div>'
            + '</div>'
            + '</div>';
    }).join('');

    const ticksHTML = ticks.map(function(value) {
        return '<span>' + esc(value === 0 ? '0' : value.toFixed(1)) + '</span>';
    }).join('');

    return '<div class="debrief-corner-panel">'
        + '<div class="debrief-corner-title">' + esc(title) + '</div>'
        + '<div class="debrief-corner-shell">'
        + rowsHTML
        + '<div class="debrief-corner-axis">' + ticksHTML + '</div>'
        + '<div class="debrief-corner-xlabel">Gap to Best (s)</div>'
        + '</div>'
        + '</div>';
}

function buildDebriefCornerPerfHTML(round) {
    if (!round || !round.cornerPerformance.length) {
        return '<div class="debrief-empty"><svg class="icon" aria-hidden="true"><use href="#fa-road"/></svg><p>No corner-performance data available for this round.</p></div>';
    }

    return '<div class="debrief-figure">'
        + '<div class="debrief-figure-title">Corner Performance</div>'
        + '<div class="debrief-corner-grid">'
        + buildDebriefCornerPanelHTML('Slow Corners', round.cornerPerformance, 'slowCorners')
        + buildDebriefCornerPanelHTML('Medium Corners', round.cornerPerformance, 'mediumCorners')
        + buildDebriefCornerPanelHTML('Fast Corners', round.cornerPerformance, 'fastCorners')
        + buildDebriefCornerPanelHTML('Overall', round.cornerPerformance, 'overall')
        + '</div>'
        + '</div>';
}

function buildDebriefRacePaceHTML(round) {
    if (!round || !round.racePacePrediction.length) {
        return '<div class="debrief-empty"><svg class="icon" aria-hidden="true"><use href="#fa-gauge-high"/></svg><p>No race-pace prediction data available for this round.</p></div>';
    }

    const rows = round.racePacePrediction.map(function(entry) {
        return {
            teamName: entry.teamName,
            teamColor: entry.teamColor,
            seconds: parseTimeSeconds(entry.predictedLap)
        };
    }).filter(function(entry) {
        return isFiniteNumber(entry.seconds);
    }).sort(function(a, b) {
        return a.seconds - b.seconds;
    });

    return buildDebriefPaceChartHTML('Race Simulation Pace', rows);
}

function renderDebrief(snapshot) {
    if (!debriefTable) return;
    hideDebriefTooltip();
    if (debriefYear) debriefYear.textContent = snapshot.season;

    state.snapshot = snapshot;
    state.rounds = snapshot.rounds.slice();
    state.activeView = sanitizeDebriefView(state.activeView);

    let selectedRound = null;
    for (let index = 0; index < snapshot.rounds.length; index++) {
        if (String(snapshot.rounds[index].round) === String(state.selectedRound)) {
            selectedRound = snapshot.rounds[index];
            break;
        }
    }
    if (!selectedRound) selectedRound = snapshot.rounds[snapshot.rounds.length - 1];
    state.selectedRound = String(selectedRound.round);

    const singleLapLeader = selectedRound.singleLap[0] || null;
    const longRunLeader = selectedRound.longRun[0] || null;
    const tyreDegLeader = selectedRound.tyreDeg[0] || null;
    const summaryParts = [];

    summaryParts.push(selectedRound.location + ' · ' + formatRaceDate(selectedRound));
    if (singleLapLeader) summaryParts.push('Single lap: ' + singleLapLeader.code + ' ' + singleLapLeader.lapTime);
    if (longRunLeader) summaryParts.push('Long run: ' + longRunLeader.code + ' ' + longRunLeader.avgLap);
    if (tyreDegLeader) summaryParts.push('Tyre deg: ' + tyreDegLeader.code + ' ' + tyreDegLeader.deg + ' s/lap');
    if (snapshot.source && snapshot.source.note) summaryParts.push(String(snapshot.source.note));

    const summaryHTML = '<div class="debrief-summary">'
        + '<div class="debrief-summary-main"><div class="debrief-summary-title">Round ' + esc(String(selectedRound.round)) + ' · ' + esc(selectedRound.grandPrix) + '</div><div class="debrief-summary-sub">' + esc(summaryParts.join(' · ')) + '</div></div>'
        + '<div class="debrief-summary-stats">'
        + '<div class="debrief-summary-stat"><div class="debrief-summary-label">Single Lap</div><div class="debrief-summary-value">' + selectedRound.singleLap.length + '</div></div>'
        + '<div class="debrief-summary-stat"><div class="debrief-summary-label">Long Run</div><div class="debrief-summary-value">' + selectedRound.longRun.length + '</div></div>'
        + '<div class="debrief-summary-stat"><div class="debrief-summary-label">Tyre Deg</div><div class="debrief-summary-value">' + selectedRound.tyreDeg.length + '</div></div>'
        + '</div></div>';

    debriefTable.innerHTML = summaryHTML
        + buildDebriefRoundSelector(snapshot.rounds, state.selectedRound)
        + buildDebriefViewSwitch()
        + '<div class="debrief-view-panel' + (state.activeView === 'single-lap' ? ' active' : '') + '" data-debrief-panel="single-lap">' + buildDebriefSingleLapHTML(selectedRound) + '</div>'
        + '<div class="debrief-view-panel' + (state.activeView === 'long-run' ? ' active' : '') + '" data-debrief-panel="long-run">' + buildDebriefLongRunHTML(selectedRound) + '</div>'
        + '<div class="debrief-view-panel' + (state.activeView === 'tyre-deg' ? ' active' : '') + '" data-debrief-panel="tyre-deg">' + buildDebriefTyreDegHTML(selectedRound) + '</div>'
        + '<div class="debrief-view-panel' + (state.activeView === 'team-ideal' ? ' active' : '') + '" data-debrief-panel="team-ideal">' + buildDebriefTeamIdealHTML(selectedRound) + '</div>'
        + '<div class="debrief-view-panel' + (state.activeView === 'corners' ? ' active' : '') + '" data-debrief-panel="corners">' + buildDebriefCornerPerfHTML(selectedRound) + '</div>'
        + '<div class="debrief-view-panel' + (state.activeView === 'race-pace' ? ' active' : '') + '" data-debrief-panel="race-pace">' + buildDebriefRacePaceHTML(selectedRound) + '</div>';

    fireRendered();
}

function showDebriefError() {
    if (!debriefTable) return;
    debriefTable.innerHTML = '<div class="debrief-empty"><svg class="icon" aria-hidden="true"><use href="#fa-exclamation-triangle"/></svg><p>Failed to load the Friday Debrief snapshot.</p></div>';
    fireRendered();
}

function handleTableMouseOver(event) {
    const chartItem = event.target.closest('[data-debrief-tooltip]');
    if (!chartItem) return;
    event.stopImmediatePropagation();
    showDebriefTooltip(chartItem, event.clientX, event.clientY);
}

function handleTableMouseMove(event) {
    event.stopImmediatePropagation();
    const chartItem = event.target.closest('[data-debrief-tooltip]');
    if (!chartItem) {
        hideDebriefTooltip();
        return;
    }
    showDebriefTooltip(chartItem, event.clientX, event.clientY);
}

function handleTableMouseOut(event) {
    const current = event.target.closest('[data-debrief-tooltip]');
    if (!current) return;
    event.stopImmediatePropagation();
    const next = event.relatedTarget && event.relatedTarget.closest ? event.relatedTarget.closest('[data-debrief-tooltip]') : null;
    if (current !== next) hideDebriefTooltip();
}

function handleTableFocusIn(event) {
    const chartItem = event.target.closest('[data-debrief-tooltip]');
    if (!chartItem) return;
    event.stopImmediatePropagation();
    showDebriefTooltipFromElement(chartItem);
}

function handleTableFocusOut(event) {
    event.stopImmediatePropagation();
    const next = event.relatedTarget && event.relatedTarget.closest ? event.relatedTarget.closest('[data-debrief-tooltip]') : null;
    if (!next) hideDebriefTooltip();
}

function handleTableChange(event) {
    const roundSelect = event.target.closest('[data-debrief-select]');
    if (!roundSelect) return;

    event.stopImmediatePropagation();
    if (!state.snapshot || !roundSelect.value || roundSelect.value === state.selectedRound) return;
    state.selectedRound = roundSelect.value;
    renderDebrief(state.snapshot);
    if (onRoundChange) onRoundChange(state.selectedRound);
}

function handleTableClick(event) {
    const chartItem = event.target.closest('[data-debrief-tooltip]');
    if (chartItem) {
        event.stopImmediatePropagation();
        showDebriefTooltipFromElement(chartItem);
    }

    const idealTab = event.target.closest('[data-ideal-view]');
    if (idealTab) {
        event.stopImmediatePropagation();
        const nextIdealView = sanitizeDebriefIdealChartView(idealTab.getAttribute('data-ideal-view'));
        if (!state.snapshot || nextIdealView === state.idealChartView) return;
        state.idealChartView = nextIdealView;
        renderDebrief(state.snapshot);
        return;
    }

    const roundButton = event.target.closest('[data-debrief-round]');
    if (roundButton) {
        event.stopImmediatePropagation();
        const nextRound = roundButton.getAttribute('data-debrief-round') || '';
        if (state.snapshot && nextRound && nextRound !== state.selectedRound) {
            state.selectedRound = nextRound;
            renderDebrief(state.snapshot);
            if (onRoundChange) onRoundChange(state.selectedRound);
        }
        return;
    }

    const viewTab = event.target.closest('[data-debrief-view]');
    if (!viewTab) return;

    event.stopImmediatePropagation();
    const nextView = sanitizeDebriefView(viewTab.getAttribute('data-debrief-view'));
    if (!state.snapshot || nextView === state.activeView) return;
    state.activeView = nextView;
    renderDebrief(state.snapshot);
    if (onViewChange) onViewChange(state.activeView);
}

function handleDocumentClick(event) {
    const target = event.target;
    if (!target || !target.closest || !target.closest('[data-debrief-tooltip]')) hideDebriefTooltip();
}

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
