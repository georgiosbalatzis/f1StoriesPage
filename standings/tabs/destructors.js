// Destructors tab — standalone ES module (Phase 6C, step 1).
//
// Owns its own DOM query (#destructors-table / #destructors-year), fetch
// state, and the teams↔flow view switch. The orchestrator (standings.js)
// imports this lazily on first destructors-tab activation, calls
// initDestructors() once to hand over onRendered / onViewChange hooks, then
// drives rendering via ensureLoaded() / setActiveView() / getActiveView().

import { esc } from '../core/format.js';
import {
    resolveTeamId,
    getCanonicalTeamName
} from '../core/teams.js';
import { fetchJSONNoCache } from '../core/fetchers.js';
import { parseNumberValue } from './_shared.js';

const DESTRUCTORS_CACHE_URL = 'destructors-cache.json';
const DESTRUCTORS_TEAM_ORDER = ['haas', 'mercedes', 'mclaren', 'red_bull', 'cadillac', 'williams', 'alpine', 'audi', 'ferrari', 'rb', 'aston_martin'];
const DESTRUCTORS_TEAM_META = {
    'haas':         { name: 'Haas',          chartLabel: 'HAAS',          color: '8f99aa' },
    'mercedes':     { name: 'Mercedes',      chartLabel: 'MERCEDES',      color: '18c9b8' },
    'mclaren':      { name: 'McLaren',       chartLabel: 'MCLAREN',       color: 'ffc20f' },
    'red_bull':     { name: 'Red Bull',      chartLabel: 'RED BULL',      color: '4c86d8' },
    'cadillac':     { name: 'Cadillac',      chartLabel: 'CADILLAC',      color: 'ffe300' },
    'williams':     { name: 'Williams',      chartLabel: 'WILLIAMS',      color: '4851c9' },
    'alpine':       { name: 'Alpine',        chartLabel: 'ALPINE',        color: 'eb3ce8' },
    'audi':         { name: 'Audi',          chartLabel: 'AUDI',          color: 'f2837d' },
    'ferrari':      { name: 'Ferrari',       chartLabel: 'FERRARI',       color: 'd85466' },
    'rb':           { name: 'Racing Bulls',  chartLabel: 'RACING BULLS',  color: '7f8ca9' },
    'aston_martin': { name: 'Aston Martin',  chartLabel: 'ASTON MARTIN',  color: '4a8f74' }
};

const destructorsTable = document.getElementById('destructors-table');
const destructorsYear  = document.getElementById('destructors-year');

const state = {
    loaded: false,
    loading: false,
    activeView: 'teams',
    snapshot: null
};

let onRendered = null;
let onViewChange = null;
let clickBound = false;

export function sanitizeView(value) {
    return value === 'flow' ? 'flow' : 'teams';
}

export function initDestructors(options) {
    if (options && typeof options.onRendered === 'function') onRendered = options.onRendered;
    if (options && typeof options.onViewChange === 'function') onViewChange = options.onViewChange;

    if (!clickBound && destructorsTable) {
        destructorsTable.addEventListener('click', function(event) {
            const viewTab = event.target.closest('[data-destructors-view]');
            if (!viewTab) return;
            const nextView = sanitizeView(viewTab.getAttribute('data-destructors-view'));
            if (!state.snapshot || nextView === state.activeView) return;
            state.activeView = nextView;
            renderDestructors(state.snapshot);
            if (onViewChange) onViewChange(nextView);
        });
        clickBound = true;
    }
}

export function getActiveView() {
    return state.activeView;
}

export function setActiveView(view) {
    const next = sanitizeView(view);
    if (next === state.activeView) return;
    state.activeView = next;
    if (state.snapshot) renderDestructors(state.snapshot);
}

export function ensureLoaded(forceReload) {
    if (!destructorsTable) return;
    if (state.loading) return;
    if (state.loaded && state.snapshot && !forceReload) {
        renderDestructors(state.snapshot);
        return;
    }

    state.loading = true;
    destructorsTable.innerHTML = '<div class="destructors-card"><div class="destructors-loading"><svg class="icon fa-spin" aria-hidden="true"><use href="#fa-circle-notch"/></svg><p>Loading destructors snapshot...</p></div></div>';

    fetchJSONNoCache(DESTRUCTORS_CACHE_URL, 8000).then(function(payload) {
        state.snapshot = normalizeSnapshot(payload);
        state.loaded = true;
        renderDestructors(state.snapshot);
    }).catch(function(error) {
        console.error('Destructors error:', error);
        showDestructorsError();
    }).finally(function() {
        state.loading = false;
    });
}

function fireRendered() {
    if (onRendered) onRendered('destructors');
}

function formatUsdAmount(value) {
    const rounded = Math.max(0, Math.round(parseNumberValue(value) || 0));
    return '$' + rounded.toLocaleString('en-US');
}

function formatUsdCompact(value) {
    const amount = Math.max(0, parseNumberValue(value) || 0);
    if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(3).replace(/\.?0+$/, '') + 'M';
    if (amount >= 1000) return '$' + (amount / 1000).toFixed(amount >= 100000 ? 0 : 1).replace(/\.?0+$/, '') + 'K';
    return '$' + Math.round(amount);
}

function deriveSnapshotAcronym(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'DRV';
    if (parts.length === 1) return parts[0].substring(0, 3).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0) + parts[parts.length - 1].charAt(1)).toUpperCase().slice(0, 3);
}

function getTeamMeta(teamKey) {
    const key = resolveTeamId(teamKey, '');
    const meta = DESTRUCTORS_TEAM_META[key];
    if (meta) return { key: key, name: meta.name, chartLabel: meta.chartLabel, color: meta.color };
    return {
        key: key || '',
        name: getCanonicalTeamName(key) || 'Unknown',
        chartLabel: (getCanonicalTeamName(key) || 'UNKNOWN').toUpperCase(),
        color: '7f8ca9'
    };
}

function normalizeSnapshot(payload) {
    if (!payload || !Array.isArray(payload.drivers) || !payload.drivers.length) {
        throw new Error('No destructors snapshot available');
    }

    const drivers = [];
    const teamsByKey = {};
    let totalDamage = 0;

    DESTRUCTORS_TEAM_ORDER.forEach(function(teamKey) {
        const meta = getTeamMeta(teamKey);
        teamsByKey[teamKey] = {
            key: teamKey,
            name: meta.name,
            chartLabel: meta.chartLabel,
            color: meta.color,
            total: 0,
            drivers: []
        };
    });

    payload.drivers.forEach(function(entry, index) {
        const teamMeta = getTeamMeta(entry.teamKey);
        const damage = Math.max(0, Math.round(parseNumberValue(entry.damage) || 0));
        const driver = {
            order: index,
            acronym: String(entry.acronym || deriveSnapshotAcronym(entry.fullName)).toUpperCase().slice(0, 3),
            fullName: String(entry.fullName || entry.acronym || 'Unknown Driver'),
            teamKey: teamMeta.key,
            teamName: teamMeta.name,
            color: teamMeta.color,
            damage: damage
        };
        drivers.push(driver);
        totalDamage += damage;

        if (!teamsByKey[teamMeta.key]) {
            teamsByKey[teamMeta.key] = {
                key: teamMeta.key,
                name: teamMeta.name,
                chartLabel: teamMeta.chartLabel,
                color: teamMeta.color,
                total: 0,
                drivers: []
            };
        }
        teamsByKey[teamMeta.key].total += damage;
        teamsByKey[teamMeta.key].drivers.push(driver);
    });

    (payload.zeroTeams || []).forEach(function(teamKey) {
        if (teamsByKey[teamKey]) return;
        const meta = getTeamMeta(teamKey);
        teamsByKey[teamKey] = {
            key: meta.key,
            name: meta.name,
            chartLabel: meta.chartLabel,
            color: meta.color,
            total: 0,
            drivers: []
        };
    });

    const teams = DESTRUCTORS_TEAM_ORDER.map(function(teamKey) {
        return teamsByKey[teamKey] || null;
    }).filter(Boolean);
    const nonZeroTeams = teams.filter(function(team) { return team.total > 0; });
    const maxTeamTotal = teams.reduce(function(max, team) {
        return Math.max(max, team.total || 0);
    }, 0);

    return {
        season: parseInt(payload.season, 10) || new Date().getFullYear(),
        snapshotLabel: String(payload.snapshotLabel || ''),
        source: payload.source || {},
        drivers: drivers,
        teams: teams,
        nonZeroTeams: nonZeroTeams,
        totalDamage: totalDamage,
        maxTeamTotal: maxTeamTotal || 1
    };
}

function buildSourceHTML(source) {
    const parts = [];
    if (source && source.upstreamHtml) {
        parts.push('Live source verified at <a href="' + esc(source.upstreamHtml) + '" target="_blank" rel="noopener">F1 Top App</a>');
    }
    if (source && source.referencePost) {
        parts.push('snapshot reference <a href="' + esc(source.referencePost) + '" target="_blank" rel="noopener">Reddit</a>');
    }
    return '<div class="destructors-source">'
        + (parts.length ? parts.join(' · ') + '. ' : '')
        + esc(source && source.note ? source.note : 'Local snapshot used because the upstream page does not expose a stable browser-safe API.')
        + '</div>';
}

function buildTeamChartHTML(data) {
    const rowsHTML = data.teams.map(function(team) {
        const pct = team.total > 0 ? (team.total / data.maxTeamTotal) * 100 : 0;
        const segmentsHTML = team.drivers.map(function(driver) {
            const share = team.total > 0 ? (driver.damage / team.total) * 100 : 0;
            const showLabel = driver.damage >= 140000 || share >= 22;
            return '<span class="destructors-team-segment" style="width:' + share.toFixed(4) + '%;background:#' + esc(team.color) + ';" title="' + esc(driver.acronym + ' - ' + formatUsdAmount(driver.damage)) + '">'
                + (showLabel ? '<em>' + esc(driver.acronym) + '</em>' : '')
                + '</span>';
        }).join('');

        return '<div class="destructors-team-row">'
            + '<div class="destructors-team-label">' + esc(team.chartLabel) + '</div>'
            + '<div class="destructors-team-visual" style="--team-pct:' + pct.toFixed(4) + '%;">'
            + (team.total > 0 ? '<div class="destructors-team-bar" style="width:' + pct.toFixed(4) + '%;">' + segmentsHTML + '</div>' : '')
            + '<div class="destructors-team-total">' + formatUsdAmount(team.total) + '</div>'
            + '</div>'
            + '</div>';
    }).join('');

    return '<div class="destructors-card">'
        + '<div class="destructors-card-head"><div><div class="destructors-card-kicker">Stacked Team Damage</div><h4 class="destructors-card-title">F1 Destructors Championship ' + esc(String(data.season)) + '</h4></div></div>'
        + '<div class="destructors-teams-chart">' + rowsHTML + '</div>'
        + '</div>';
}

function buildFlowChartHTML(data) {
    const drivers = data.drivers.slice();
    const teams = data.nonZeroTeams.slice();
    if (!drivers.length || !teams.length) {
        return '<div class="destructors-card"><div class="destructors-empty"><svg class="icon" aria-hidden="true"><use href="#fa-car-side"/></svg><p>No destructors data available for this snapshot.</p></div></div>';
    }

    const width = 920;
    const height = 680;
    const chartTop = 56;
    const chartHeight = 560;
    const leftX = 110;
    const rightX = 720;
    const nodeWidth = 18;
    const curve = 180;
    const driverGap = 10;
    const teamGap = 22;
    const totalDamage = Math.max(1, data.totalDamage);
    const scale = (chartHeight - driverGap * (drivers.length - 1)) / totalDamage;
    const leftNodes = [];
    const rightNodes = [];
    const teamMap = {};
    const links = [];
    let leftCursor = chartTop;
    const rightUsedHeight = teams.reduce(function(sum, team) { return sum + team.total * scale; }, 0) + teamGap * (teams.length - 1);
    let rightCursor = chartTop + Math.max(0, (chartHeight - rightUsedHeight) / 2);

    drivers.forEach(function(driver) {
        const heightPx = driver.damage * scale;
        leftNodes.push({
            key: driver.acronym,
            label: driver.acronym,
            fullName: driver.fullName,
            color: driver.color,
            damage: driver.damage,
            x: leftX,
            y: leftCursor,
            height: heightPx
        });
        leftCursor += heightPx + driverGap;
    });

    teams.forEach(function(team) {
        const heightPx = team.total * scale;
        const node = {
            key: team.key,
            label: team.name,
            color: team.color,
            total: team.total,
            x: rightX,
            y: rightCursor,
            height: heightPx,
            offset: 0
        };
        rightNodes.push(node);
        teamMap[team.key] = node;
        rightCursor += heightPx + teamGap;
    });

    leftNodes.forEach(function(node, index) {
        const driver = drivers[index];
        const target = teamMap[driver.teamKey];
        const targetY = target.y + target.offset;
        target.offset += node.height;
        links.push({
            color: driver.color,
            driverName: driver.fullName,
            teamName: target.label,
            damage: driver.damage,
            x1: node.x + nodeWidth,
            y1: node.y,
            x2: target.x,
            y2: targetY,
            height: node.height
        });
    });

    function buildFlowPath(link) {
        const x1 = link.x1;
        const y1 = link.y1;
        const x2 = link.x2;
        const y2 = link.y2;
        const h = link.height;
        return 'M' + x1 + ' ' + y1
            + ' C' + (x1 + curve) + ' ' + y1 + ', ' + (x2 - curve) + ' ' + y2 + ', ' + x2 + ' ' + y2
            + ' L' + x2 + ' ' + (y2 + h)
            + ' C' + (x2 - curve) + ' ' + (y2 + h) + ', ' + (x1 + curve) + ' ' + (y1 + h) + ', ' + x1 + ' ' + (y1 + h)
            + ' Z';
    }

    const linkHTML = links.map(function(link) {
        return '<path class="destructors-flow-link" d="' + buildFlowPath(link) + '" fill="#' + esc(link.color) + '" fill-opacity="0.82">'
            + '<title>' + esc(link.driverName + ' -> ' + link.teamName + ' - ' + formatUsdAmount(link.damage)) + '</title>'
            + '</path>';
    }).join('');

    const leftNodesHTML = leftNodes.map(function(node) {
        return '<g class="destructors-flow-node"><rect x="' + node.x + '" y="' + node.y + '" width="' + nodeWidth + '" height="' + node.height + '" rx="3" fill="#' + esc(node.color) + '"></rect>'
            + '<text x="' + (node.x - 10) + '" y="' + (node.y + node.height / 2 + 4) + '" text-anchor="end">' + esc(node.label) + '</text>'
            + '<title>' + esc(node.fullName + ' - ' + formatUsdAmount(node.damage)) + '</title></g>';
    }).join('');

    const rightNodesHTML = rightNodes.map(function(node) {
        return '<g class="destructors-flow-node"><rect x="' + node.x + '" y="' + node.y + '" width="' + nodeWidth + '" height="' + node.height + '" rx="3" fill="#' + esc(node.color) + '"></rect>'
            + '<text x="' + (node.x + nodeWidth + 10) + '" y="' + (node.y + node.height / 2 + 4) + '" text-anchor="start">' + esc(node.label) + '</text>'
            + '<title>' + esc(node.label + ' - ' + formatUsdAmount(node.total)) + '</title></g>';
    }).join('');

    return '<div class="destructors-card">'
        + '<div class="destructors-card-head"><div><div class="destructors-card-kicker">Driver To Constructor Flow</div><h4 class="destructors-card-title">F1 ' + esc(String(data.season)) + ' Destructors World Championship</h4></div></div>'
        + '<div class="destructors-flow-scroll">'
        + '<svg class="destructors-flow-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Driver to team destructors flow chart">'
        + '<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="transparent"></rect>'
        + linkHTML + leftNodesHTML + rightNodesHTML
        + '</svg></div>'
        + '</div>';
}

function renderDestructors(snapshot) {
    if (!destructorsTable) return;
    if (destructorsYear) destructorsYear.textContent = snapshot.season;

    const leader = snapshot.teams.filter(function(team) { return team.total > 0; })[0];
    const summaryHTML = '<div class="destructors-summary">'
        + '<div class="destructors-summary-main"><div class="destructors-summary-title">' + esc(snapshot.snapshotLabel || ('Season ' + snapshot.season + ' snapshot')) + '</div>'
        + '<div class="destructors-summary-sub">' + (leader ? esc(leader.name + ' lead the chart with ' + formatUsdAmount(leader.total) + '.') : 'No non-zero destructors entries yet.') + '</div></div>'
        + '<div class="destructors-summary-stats">'
        + '<div class="destructors-summary-stat"><div class="destructors-summary-label">Total Damage</div><div class="destructors-summary-value">' + formatUsdCompact(snapshot.totalDamage) + '</div></div>'
        + '<div class="destructors-summary-stat"><div class="destructors-summary-label">Drivers</div><div class="destructors-summary-value">' + snapshot.drivers.length + '</div></div>'
        + '<div class="destructors-summary-stat"><div class="destructors-summary-label">Teams Hit</div><div class="destructors-summary-value">' + snapshot.nonZeroTeams.length + '</div></div>'
        + '</div></div>';

    const switchHTML = '<div class="destructors-view-switch"><div class="destructors-view-tabs" role="tablist" aria-label="Destructors views">'
        + '<button class="destructors-view-tab' + (state.activeView === 'teams' ? ' active' : '') + '" type="button" data-destructors-view="teams" role="tab" aria-selected="' + (state.activeView === 'teams' ? 'true' : 'false') + '"><svg class="icon" aria-hidden="true"><use href="#fa-chart-bar"/></svg> Team Damage</button>'
        + '<button class="destructors-view-tab' + (state.activeView === 'flow' ? ' active' : '') + '" type="button" data-destructors-view="flow" role="tab" aria-selected="' + (state.activeView === 'flow' ? 'true' : 'false') + '"><svg class="icon" aria-hidden="true"><use href="#fa-diagram-project"/></svg> Driver Flow</button>'
        + '</div></div>';

    destructorsTable.innerHTML = summaryHTML
        + switchHTML
        + '<div class="destructors-view-panel' + (state.activeView === 'teams' ? ' active' : '') + '" data-destructors-panel="teams">' + buildTeamChartHTML(snapshot) + '</div>'
        + '<div class="destructors-view-panel' + (state.activeView === 'flow' ? ' active' : '') + '" data-destructors-panel="flow">' + buildFlowChartHTML(snapshot) + '</div>'
        + buildSourceHTML(snapshot.source);

    fireRendered();
}

function showDestructorsError() {
    if (!destructorsTable) return;
    destructorsTable.innerHTML = '<div class="destructors-card"><div class="destructors-empty">'
        + '<svg class="icon" aria-hidden="true"><use href="#fa-exclamation-triangle"/></svg><p>Failed to load the destructors snapshot.</p>'
        + '</div></div>';
    fireRendered();
}
