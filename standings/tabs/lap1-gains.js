// Lap 1 gains per-tab module — Phase 6C step 4.
//
// Extracted from standings.legacy.js (~4178–4345 plus shared helpers) so the
// heavy tab no longer forces the legacy bundle to load when a visitor lands
// on ?tab=lap1-gains. Driver/session plumbing is duplicated here rather than
// pulled into _shared.js to match the step 3 scoping decision: each tab
// module keeps its own leaf helpers until a concrete consolidation target
// emerges.
//
// Event handlers bind in capture phase with stopImmediatePropagation(). The
// legacy click/change handlers at standings.legacy.js L4324–4345 have no
// self-guards — they re-render from their own lap1GainsState regardless of
// who last dispatched — so we intercept first when the module is active.

import { esc } from '../core/format.js';
import { hexToRgbChannels, getCanonicalTeamColor } from '../core/teams.js';
import { getCachedHeadshotResult } from '../core/drivers-meta.js';
import { fetchJSON, fetchOpenF1BySessionKeys } from '../core/fetchers.js';
import { isFiniteNumber } from './_shared.js';

const OPENF1 = 'https://api.openf1.org/v1';
const YEAR = new Date().getFullYear();

const lap1GainsTable = document.getElementById('lap1-gains-table');

const state = {
    loaded: false,
    loading: false,
    rows: [],
    activeView: 'overview',
    selectedSessionKey: ''
};

let onRendered = null;
let onViewChange = null;
let onSessionChange = null;
let listenersBound = false;

export function sanitizeView(value) {
    return value === 'race-detail' ? 'race-detail' : 'overview';
}

export function getActiveView() {
    return state.activeView === 'race-detail' ? 'race-detail' : 'overview';
}

export function getSelectedSession() {
    return state.selectedSessionKey || '';
}

export function setActiveView(value) {
    const next = sanitizeView(value);
    if (state.activeView === next) return;
    state.activeView = next;
    if (state.loaded && state.rows && state.rows.length) renderLap1Gains(state.rows);
}

export function setSelectedSession(value) {
    const next = value == null ? '' : String(value);
    if (state.selectedSessionKey === next) return;
    state.selectedSessionKey = next;
    if (state.loaded && state.rows && state.rows.length) renderLap1Gains(state.rows);
}

export function initLap1Gains(options) {
    if (options && typeof options.onRendered === 'function') onRendered = options.onRendered;
    if (options && typeof options.onViewChange === 'function') onViewChange = options.onViewChange;
    if (options && typeof options.onSessionChange === 'function') onSessionChange = options.onSessionChange;

    if (!listenersBound && lap1GainsTable) {
        lap1GainsTable.addEventListener('click', handleTableClick, true);
        lap1GainsTable.addEventListener('change', handleRaceSelectChange, true);
        lap1GainsTable.addEventListener('wheel', handleHorizontalChartWheel, { passive: false });
        listenersBound = true;
    }
}

function handleTableClick(event) {
    const viewTab = event.target.closest('[data-lap1-view]');
    if (!viewTab) return;

    const nextView = viewTab.getAttribute('data-lap1-view');
    if (!nextView || nextView === state.activeView) return;

    event.stopImmediatePropagation();
    state.activeView = nextView === 'race-detail' ? 'race-detail' : 'overview';
    renderLap1Gains(state.rows || []);
    if (onViewChange) onViewChange();
}

function handleRaceSelectChange(event) {
    const raceSelect = event.target.closest('[data-lap1-select]');
    if (!raceSelect) return;

    event.stopImmediatePropagation();
    state.selectedSessionKey = raceSelect.value;
    if (state.activeView !== 'race-detail') state.activeView = 'race-detail';
    renderLap1Gains(state.rows || []);
    if (onSessionChange) onSessionChange();
    else if (onViewChange) onViewChange();
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

function getRaceSessionTypeShort(session) {
    const name = [
        session && session.session_name,
        session && session.session_type
    ].join(' ').toLowerCase();
    return name.indexOf('sprint') !== -1 ? 'S' : 'R';
}

function getSessionLabel(session) {
    const meeting = session.meeting_name || session.country_name || session.location || 'Session';
    const sessionName = session.session_name || session.session_type || 'Race';
    return meeting + ' · ' + sessionName;
}

function formatSessionDateShort(session) {
    const value = session && (session.date_start || session.date || session.date_end);
    const date = value ? new Date(value) : null;
    if (!date || isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).replace(/\./g, '');
}

function groupRecordsBySession(records) {
    const grouped = {};
    (records || []).forEach(function(record) {
        if (!record || record.session_key == null) return;
        const key = String(record.session_key);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(record);
    });
    return grouped;
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
            headshot: getCachedHeadshotResult('', fullName, driver.headshot_url || '').url,
            teamName: driver.team_name || '',
            teamColor: getCanonicalTeamColor('', driver.team_name || '', driver.team_colour || ''),
            meetingKey: driver.meeting_key || ''
        };
    });
    return lookup;
}

function formatGainValue(gain) {
    if (!isFiniteNumber(gain)) return '0';
    return gain > 0 ? '+' + gain : String(gain);
}

function formatPositionTag(position) {
    return 'P' + position;
}

function buildLap1GainRows(sessions, drivers, positions, lapOneLaps, lapTwoLaps) {
    const driverLookup = buildDriverLookup(drivers);
    const positionsBySession = groupRecordsBySession(positions);
    const lapOneBySession = groupRecordsBySession(lapOneLaps);
    const lapTwoBySession = groupRecordsBySession(lapTwoLaps);

    return (sessions || []).map(function(session, index) {
        const sessionKey = String(session.session_key);
        const sessionPositions = (positionsBySession[sessionKey] || []).slice().sort(function(a, b) {
            return new Date(a.date) - new Date(b.date) || a.position - b.position;
        });
        const lapOne = (lapOneBySession[sessionKey] || []).slice();
        const lapTwo = (lapTwoBySession[sessionKey] || []).slice().sort(function(a, b) {
            return new Date(a.date_start) - new Date(b.date_start) || a.driver_number - b.driver_number;
        });

        if (!sessionPositions.length || !lapOne.length || !lapTwo.length) return null;

        const lapOneDrivers = {};
        lapOne.forEach(function(record) {
            if (record && record.driver_number != null) lapOneDrivers[record.driver_number] = true;
        });

        const firstSnapshotDate = sessionPositions[0].date;
        const startingRows = sessionPositions.filter(function(record) {
            return record.date === firstSnapshotDate && lapOneDrivers[record.driver_number];
        }).sort(function(a, b) {
            return a.position - b.position;
        });

        if (!startingRows.length) return null;

        const normalizedStartMap = {};
        startingRows.forEach(function(record, startIndex) {
            normalizedStartMap[record.driver_number] = startIndex + 1;
        });

        const seenLapTwo = {};
        const moves = [];
        lapTwo.forEach(function(record) {
            if (!record || record.driver_number == null) return;
            if (seenLapTwo[record.driver_number]) return;
            if (!normalizedStartMap[record.driver_number]) return;

            seenLapTwo[record.driver_number] = true;

            const driverMap = driverLookup[sessionKey] || {};
            const driver = driverMap[record.driver_number] || {
                driverNumber: record.driver_number,
                acronym: '#' + record.driver_number,
                fullName: 'Οδηγός #' + record.driver_number,
                headshot: '',
                teamName: '',
                teamColor: '3b82f6'
            };
            const startPosition = normalizedStartMap[record.driver_number];
            const afterPosition = moves.length + 1;
            const teamColor = getCanonicalTeamColor('', driver.teamName || '', driver.teamColor || '');

            moves.push({
                driverNumber: record.driver_number,
                acronym: deriveAcronym(driver),
                fullName: getDriverDisplayName(driver),
                headshot: driver.headshot || '',
                teamName: driver.teamName || '',
                teamColor: teamColor,
                startPosition: startPosition,
                afterPosition: afterPosition,
                gain: startPosition - afterPosition
            });
        });

        if (!moves.length) return null;

        moves.sort(function(a, b) {
            if (b.gain !== a.gain) return b.gain - a.gain;
            if (a.afterPosition !== b.afterPosition) return a.afterPosition - b.afterPosition;
            return a.acronym.localeCompare(b.acronym);
        });

        const maxGain = moves[0].gain;
        const winners = moves.filter(function(move) { return move.gain === maxGain; });

        return {
            sessionKey: sessionKey,
            index: index,
            meetingName: session.circuit_short_name || session.location || session.country_name || 'Session',
            sessionName: session.session_name || session.session_type || 'Race',
            sessionTypeShort: getRaceSessionTypeShort(session),
            sessionLabel: getSessionLabel(session),
            dateLabel: formatSessionDateShort(session),
            maxGain: maxGain,
            winnerCount: winners.length,
            primaryWinner: winners[0],
            winners: winners,
            moves: moves
        };
    }).filter(Boolean);
}

function buildLap1AxisValues(maxGain) {
    if (maxGain <= 0) return [0];

    const values = [0];
    if (maxGain <= 4) {
        for (let value = 1; value <= maxGain; value++) values.push(value);
        return values;
    }

    const step = Math.max(1, Math.ceil(maxGain / 4));
    for (let current = step; current < maxGain; current += step) values.push(current);
    if (values[values.length - 1] !== maxGain) values.push(maxGain);
    return values;
}

function renderLap1Bubble(driver, extraBadge) {
    const winnerColor = hexToRgbChannels(driver.teamColor || '3b82f6');
    const headshot = getCachedHeadshotResult('', driver.fullName, driver.headshot || '');
    return '<div class="lap1-bubble" style="--winner-color:' + esc(winnerColor) + ';">'
        + (headshot.url
            ? '<img src="' + esc(headshot.url) + '" alt="' + esc(driver.fullName) + '" width="56" height="56"' + headshot.style + ' loading="lazy" decoding="async">'
                + '<div class="lap1-bubble-fallback" style="display:none;">' + esc(driver.acronym) + '</div>'
            : '<div class="lap1-bubble-fallback">' + esc(driver.acronym) + '</div>')
        + (extraBadge ? '<span class="lap1-bubble-badge">' + esc(extraBadge) + '</span>' : '')
        + '</div>';
}

function renderLap1DriverChip(driver) {
    const winnerColor = hexToRgbChannels(driver.teamColor || '3b82f6');
    const headshot = getCachedHeadshotResult('', driver.fullName, driver.headshot || '');
    return '<div class="lap1-driver-chip" style="--winner-color:' + esc(winnerColor) + ';">'
        + '<div class="lap1-driver-chip-avatar">'
        + (headshot.url
            ? '<img src="' + esc(headshot.url) + '" alt="' + esc(driver.fullName) + '" width="38" height="38"' + headshot.style + ' loading="lazy" decoding="async">'
                + '<div class="lap1-driver-chip-avatar-fallback" style="display:none;">' + esc(driver.acronym) + '</div>'
            : '<div class="lap1-driver-chip-avatar-fallback">' + esc(driver.acronym) + '</div>')
        + '</div>'
        + '<div class="lap1-driver-chip-meta"><div class="lap1-driver-chip-code">' + esc(driver.acronym) + '</div><div class="lap1-driver-chip-name">' + esc(driver.fullName) + '</div><div class="lap1-driver-chip-move">' + esc(formatPositionTag(driver.startPosition) + ' -> ' + formatPositionTag(driver.afterPosition)) + '</div></div>'
        + '</div>';
}

function renderLap1OverviewContent(rows) {
    const maxGain = rows.reduce(function(max, row) {
        return Math.max(max, row.maxGain);
    }, 0);
    const axisValues = buildLap1AxisValues(maxGain);
    const chartMinWidth = Math.max(620, 76 + rows.length * 84);
    let html = '<div class="lap1-overview-card">'
        + '<div class="lap1-overview-head"><div><h3 class="lap1-overview-title">Lap 1 Movers Overview</h3><p class="lap1-overview-note">Completed race και sprint sessions, ταξινομημένα χρονολογικά.</p></div><div class="lap1-overview-meta">' + rows.length + ' sessions</div></div>'
        + '<div class="lap1-chart-scroll" data-horizontal-chart-scroll><div class="lap1-chart-shell" style="min-width:' + chartMinWidth + 'px;">'
        + '<div class="lap1-axis"><span class="lap1-axis-title">Lap 1 Gain (Pos)</span><div class="lap1-axis-scale">';

    axisValues.forEach(function(value) {
        const bottom = maxGain > 0 ? (value / maxGain) * 100 : 0;
        html += '<span class="lap1-axis-label" style="bottom:' + bottom.toFixed(2) + '%;">' + esc(formatGainValue(value)) + '</span>';
    });

    html += '</div></div><div class="lap1-chart-body"><div class="lap1-chart-plot">';

    axisValues.forEach(function(value) {
        const bottom = maxGain > 0 ? (value / maxGain) * 100 : 0;
        html += '<div class="lap1-grid-line' + (value === 0 ? ' zero' : '') + '" style="bottom:' + bottom.toFixed(2) + '%;"></div>';
    });

    html += '<div class="lap1-chart-columns" style="grid-template-columns:repeat(' + rows.length + ', minmax(72px, 1fr));">';

    rows.forEach(function(row) {
        const primaryColor = hexToRgbChannels(row.primaryWinner.teamColor || '3b82f6');
        const bottom = maxGain > 0 ? (row.maxGain / maxGain) * 100 : 0;
        const tieBadge = row.winnerCount > 1 ? '+' + (row.winnerCount - 1) : '';

        html += '<article class="lap1-session-col">'
            + '<div class="lap1-session-plot"><div class="lap1-session-point" style="bottom:' + bottom.toFixed(2) + '%;--winner-color:' + esc(primaryColor) + ';">'
            + '<span class="lap1-gain-pill">' + esc(formatGainValue(row.maxGain)) + '</span>'
            + renderLap1Bubble(row.primaryWinner, tieBadge)
            + '<span class="lap1-primary-code">' + esc(row.primaryWinner.acronym) + (row.winnerCount > 1 ? ' tie' : '') + '</span>'
            + '</div></div>'
            + '<div class="lap1-session-footer"><span class="lap1-session-type">' + esc(row.sessionTypeShort) + '</span><span class="lap1-session-name">' + esc(row.meetingName) + '</span><span class="lap1-session-date">' + esc(row.dateLabel) + '</span></div>'
            + '</article>';
    });

    html += '</div></div></div></div></div><div class="lap1-gains-cards">';

    rows.forEach(function(row) {
        const primaryColor = hexToRgbChannels(row.primaryWinner.teamColor || '3b82f6');
        html += '<article class="lap1-gain-card" style="--winner-color:' + esc(primaryColor) + ';">'
            + '<div class="lap1-gain-card-head"><div class="lap1-gain-card-session"><span class="lap1-gain-card-type">' + esc(row.sessionTypeShort) + '</span><div class="lap1-gain-card-name">' + esc(row.meetingName) + '</div><div class="lap1-gain-card-date">' + esc(row.dateLabel + ' · ' + row.sessionName) + '</div></div><div><div class="lap1-gain-card-value">' + esc(formatGainValue(row.maxGain)) + '</div><div class="lap1-gain-card-sub">lap 1 gain</div></div></div>'
            + '<div class="lap1-driver-cluster">' + row.winners.map(renderLap1DriverChip).join('') + '</div>'
            + '<p class="lap1-card-meta">' + (row.winnerCount > 1
                ? esc('Ισοπαλία ' + row.winnerCount + ' οδηγών για το καλύτερο move μετά τον 1ο γύρο.')
                : esc(formatPositionTag(row.primaryWinner.startPosition) + ' -> ' + formatPositionTag(row.primaryWinner.afterPosition) + ' μέχρι το τέλος του 1ου γύρου.'))
            + '</p>'
            + '</article>';
    });

    return html + '</div>';
}

function renderLap1RaceDriverRow(move, index) {
    const winnerColor = hexToRgbChannels(move.teamColor || '3b82f6');
    const deltaTone = move.gain > 0 ? 'positive' : move.gain < 0 ? 'negative' : 'neutral';
    const headshot = getCachedHeadshotResult('', move.fullName, move.headshot || '');

    return '<article class="lap1-race-row" style="--winner-color:' + esc(winnerColor) + ';">'
        + '<div class="lap1-race-rank">' + (index + 1) + '</div>'
        + '<div class="lap1-race-driver">'
        + '<div class="lap1-race-avatar">'
        + (headshot.url
            ? '<img src="' + esc(headshot.url) + '" alt="' + esc(move.fullName) + '" width="42" height="42"' + headshot.style + ' loading="lazy" decoding="async">'
                + '<div class="lap1-race-avatar-fallback" style="display:none;">' + esc(move.acronym) + '</div>'
            : '<div class="lap1-race-avatar-fallback">' + esc(move.acronym) + '</div>')
        + '</div>'
        + '<div class="lap1-race-driver-meta"><div class="lap1-race-driver-top"><div class="lap1-race-driver-code">' + esc(move.acronym) + '</div><div class="lap1-race-driver-team">' + esc(move.teamName || 'F1') + '</div></div><div class="lap1-race-driver-name">' + esc(move.fullName) + '</div></div>'
        + '</div>'
        + '<div class="lap1-race-change"><span class="lap1-race-delta ' + deltaTone + '">' + esc(formatGainValue(move.gain)) + '</span><span class="lap1-race-move">' + esc(formatPositionTag(move.startPosition) + ' -> ' + formatPositionTag(move.afterPosition)) + '</span></div>'
        + '</article>';
}

function renderLap1RaceDetailContent(rows, selectedRow) {
    const summaryColor = hexToRgbChannels(selectedRow.primaryWinner.teamColor || '3b82f6');
    const topMoverLabel = selectedRow.winnerCount > 1
        ? selectedRow.winners.map(function(driver) { return driver.acronym; }).join(', ')
        : selectedRow.primaryWinner.acronym;
    const selectorOptions = rows.slice().reverse().map(function(row) {
        return '<option value="' + esc(row.sessionKey) + '"' + (String(row.sessionKey) === String(selectedRow.sessionKey) ? ' selected' : '') + '>' + esc(row.meetingName + ' · ' + row.sessionName + ' · ' + row.dateLabel) + '</option>';
    }).join('');

    return '<div class="lap1-race-card">'
        + '<div class="lap1-race-head"><div><h3 class="lap1-overview-title">Driver Gains By Session</h3><p class="lap1-overview-note">Διάλεξε race ή sprint και δες όλο το grid ταξινομημένο από το μεγαλύτερο gain στο μεγαλύτερο loss μετά τον 1ο γύρο.</p></div><label class="lap1-race-controls"><span class="lap1-race-controls-label">Available sessions</span><select class="lap1-race-select" data-lap1-select aria-label="Επιλογή session για Lap 1 gains">' + selectorOptions + '</select></label></div>'
        + '<div class="lap1-race-summary" style="--winner-color:' + esc(summaryColor) + ';">'
        + '<div class="lap1-race-summary-main"><span class="lap1-session-type">' + esc(selectedRow.sessionTypeShort) + '</span><div class="lap1-race-summary-copy"><div class="lap1-race-summary-title">' + esc(selectedRow.meetingName) + '</div><div class="lap1-race-summary-sub">' + esc(selectedRow.dateLabel + ' · ' + selectedRow.sessionName) + '</div></div></div>'
        + '<div class="lap1-race-summary-stats"><div class="lap1-race-summary-stat"><span class="lap1-race-summary-label">Top mover</span><span class="lap1-race-summary-value">' + esc(topMoverLabel) + '</span></div><div class="lap1-race-summary-stat"><span class="lap1-race-summary-label">Best gain</span><span class="lap1-race-summary-value">' + esc(formatGainValue(selectedRow.maxGain)) + '</span></div><div class="lap1-race-summary-stat"><span class="lap1-race-summary-label">Drivers</span><span class="lap1-race-summary-value">' + esc(String(selectedRow.moves.length)) + '</span></div></div>'
        + '</div>'
        + '<div class="lap1-race-rows">' + selectedRow.moves.map(renderLap1RaceDriverRow).join('') + '</div>'
        + '</div>';
}

function renderLap1Gains(rows) {
    if (!lap1GainsTable) return;
    state.rows = rows || [];

    if (!rows || !rows.length) {
        lap1GainsTable.innerHTML = '<div class="lap1-empty-card">'
            + '<svg class="icon" aria-hidden="true"><use href="#fa-arrow-trend-up"/></svg>'
            + '<p>Δεν υπάρχουν ακόμη διαθέσιμα δεδομένα για τα μεγαλύτερα gains μετά τον 1ο γύρο.</p>'
            + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το tab ενεργοποιείται μόλις υπάρξουν completed race ή sprint sessions με lap timing data.</p>'
            + '</div>';
        if (onRendered) onRendered('lap1-gains');
        return;
    }

    if (!state.activeView) state.activeView = 'overview';
    if (!state.selectedSessionKey || !rows.some(function(row) { return String(row.sessionKey) === String(state.selectedSessionKey); })) {
        state.selectedSessionKey = rows[rows.length - 1].sessionKey;
    }

    const selectedRow = rows.filter(function(row) {
        return String(row.sessionKey) === String(state.selectedSessionKey);
    })[0] || rows[rows.length - 1];
    const activeView = state.activeView === 'race-detail' ? 'race-detail' : 'overview';
    const viewContent = activeView === 'race-detail'
        ? renderLap1RaceDetailContent(rows, selectedRow)
        : renderLap1OverviewContent(rows);

    const html = '<div class="lap1-view-switch"><div class="lap1-view-tabs" role="tablist" aria-label="Lap 1 Gains views">'
        + '<button class="lap1-view-tab' + (activeView === 'overview' ? ' active' : '') + '" type="button" data-lap1-view="overview" role="tab" aria-selected="' + (activeView === 'overview' ? 'true' : 'false') + '">Overview</button>'
        + '<button class="lap1-view-tab' + (activeView === 'race-detail' ? ' active' : '') + '" type="button" data-lap1-view="race-detail" role="tab" aria-selected="' + (activeView === 'race-detail' ? 'true' : 'false') + '">By Session</button>'
        + '</div></div>'
        + viewContent;

    lap1GainsTable.innerHTML = html;
    if (onRendered) onRendered('lap1-gains');
}

function showLap1GainsError() {
    if (!lap1GainsTable) return;
    lap1GainsTable.innerHTML = '<div class="lap1-empty-card">'
        + '<svg class="icon" aria-hidden="true"><use href="#fa-exclamation-triangle"/></svg>'
        + '<p>Δεν ήταν δυνατή η φόρτωση των Lap 1 gains.</p>'
        + '<p style="font-size:0.82rem;margin:0.35rem 0 0;">Το OpenF1 endpoint ίσως να μην είναι διαθέσιμο προσωρινά.</p>'
        + '<button class="retry-btn" type="button" onclick="window.__retryLap1Gains && window.__retryLap1Gains()"><svg class="icon" aria-hidden="true"><use href="#fa-redo"/></svg> Νέα προσπάθεια</button>'
        + '</div>';
    if (onRendered) onRendered('lap1-gains');
}

function createLap1SkeletonRows(count) {
    let html = '<div class="lap1-overview-card">'
        + '<div class="lap1-overview-head"><div><div class="skel" style="width:180px;height:18px;"></div><div class="skel" style="width:220px;height:11px;margin-top:0.5rem;"></div></div><div class="skel" style="width:110px;height:30px;border-radius:999px;"></div></div>'
        + '<div class="skel" style="width:100%;height:300px;border-radius:16px;"></div>'
        + '</div>'
        + '<div class="lap1-gains-cards">';

    for (let i = 0; i < count; i++) {
        html += '<div class="lap1-skeleton-card">'
            + '<div class="lap1-skeleton-head"><div><div class="skel" style="width:28px;height:24px;border-radius:999px;"></div><div class="skel" style="width:110px;height:15px;margin-top:0.55rem;"></div><div class="skel" style="width:80px;height:10px;margin-top:0.45rem;"></div></div><div><div class="skel" style="width:52px;height:24px;margin-left:auto;"></div><div class="skel" style="width:58px;height:10px;margin-top:0.35rem;margin-left:auto;"></div></div></div>'
            + '<div class="lap1-skeleton-chip-row">'
            + '<div class="lap1-skeleton-driver"><div class="skel skel-circle" style="width:38px;height:38px;"></div><div><div class="skel" style="width:48px;height:11px;"></div><div class="skel" style="width:92px;height:10px;margin-top:0.32rem;"></div></div></div>'
            + '<div class="lap1-skeleton-driver"><div class="skel skel-circle" style="width:38px;height:38px;"></div><div><div class="skel" style="width:48px;height:11px;"></div><div class="skel" style="width:82px;height:10px;margin-top:0.32rem;"></div></div></div>'
            + '</div>'
            + '<div class="skel" style="width:70%;height:10px;margin-top:0.8rem;"></div>'
            + '</div>';
    }

    return html + '</div>';
}

function loadLap1GainRows() {
    return getCompletedRaceAndSprintSessions().then(function(raceSessions) {
        if (!raceSessions.length) return [];

        const sessionKeys = raceSessions.map(function(session) {
            return session.session_key;
        });

        return Promise.all([
            fetchOpenF1BySessionKeys(OPENF1, 'drivers', sessionKeys),
            fetchOpenF1BySessionKeys(OPENF1, 'position', sessionKeys),
            fetchOpenF1BySessionKeys(OPENF1, 'laps', sessionKeys, 'lap_number=1'),
            fetchOpenF1BySessionKeys(OPENF1, 'laps', sessionKeys, 'lap_number=2')
        ]).then(function(payload) {
            return buildLap1GainRows(raceSessions, payload[0], payload[1], payload[2], payload[3]);
        });
    });
}

export function ensureLoaded(forceReload) {
    if (!lap1GainsTable) return;
    if (state.loading) return;
    if (state.loaded && !forceReload) return;

    state.loading = true;
    lap1GainsTable.innerHTML = createLap1SkeletonRows(4);

    loadLap1GainRows().then(function(rows) {
        renderLap1Gains(rows);
        state.loaded = true;
    }).catch(function(error) {
        console.error('Lap 1 gains error:', error);
        showLap1GainsError();
    }).finally(function() {
        state.loading = false;
    });
}

window.__retryLap1Gains = function() {
    state.loaded = false;
    ensureLoaded(true);
};
