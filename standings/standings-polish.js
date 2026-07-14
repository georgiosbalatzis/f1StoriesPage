import { esc, escAttr } from './core/format.js';
import { getCanonicalTeamColor } from './core/teams.js';
import { renderTrustedHtml } from './core/rendering.js';

const driversSummaryRow = document.getElementById('drivers-summary-row');
const constructorsSummaryRow = document.getElementById('constructors-summary-row');
const driversSidePanel = document.getElementById('drivers-side-panel');
const constructorsSidePanel = document.getElementById('constructors-side-panel');

export function initStandingsPolish() {
    document.addEventListener('click', function(event) {
        const row = event.target.closest('.st-row[data-detail-target]');
        if (!row || event.target.closest('a, button')) return;
        toggleStandingsDetail(row);
    });

    document.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const row = event.target.closest('.st-row[data-detail-target]');
        if (!row) return;
        event.preventDefault();
        toggleStandingsDetail(row);
    });
}

export function normalizePoints(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
}

export function pointsText(value) {
    const n = normalizePoints(value);
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function tableHeadHTML(identityLabel) {
    return '<div class="st-table-head" aria-hidden="true">'
        + '<span>Pos</span><span>' + esc(identityLabel) + '</span><span>Points</span>'
        + '</div>';
}

export function detailRowHTML(id, items) {
    return '<div class="st-detail-row" id="' + escAttr(id) + '" aria-hidden="true">'
        + (items || []).map(function(item) {
            return '<div class="st-detail-item"><span class="st-detail-label">' + esc(item.label) + '</span><span class="st-detail-value">' + esc(item.value) + '</span></div>';
        }).join('')
        + '</div>';
}

export function renderDriverStandingsPolish(standings, meta, year) {
    const closest = findClosestBattle(standings);
    const leader = standings && standings[0];
    const leaderDriver = leader && leader.Driver ? leader.Driver : {};
    const leaderName = ((leaderDriver.givenName || '') + ' ' + (leaderDriver.familyName || '')).trim();

    renderSummaryCards(driversSummaryRow, [
        { label: 'Leader', value: leaderName || 'TBD', note: pointsText(leader && leader.points) + ' pts' },
        {
            label: 'Closest battle',
            value: closest && closest.current && closest.current.Driver ? closest.current.Driver.familyName + ' vs ' + closest.ahead.Driver.familyName : 'TBD',
            note: closest ? pointsText(closest.gap) + ' pts gap' : 'No active gap'
        },
        { label: 'Last updated', value: formatStandingsDate(meta && meta.updatedAt), note: 'Season ' + (year || '') },
        { label: 'Source', value: meta && meta.source ? meta.source : 'Jolpica F1', note: 'Drivers championship' }
    ]);

    if (!driversSidePanel) return;
    const sideItems = (standings || []).slice(1, 5).map(function(row, index) {
        const prev = standings[index];
        const driver = row.Driver || {};
        const constructor = row.Constructors && row.Constructors[0];
        const gapAhead = Math.max(0, normalizePoints(prev && prev.points) - normalizePoints(row.points));
        const teamName = constructor ? constructor.name : '';
        return {
            label: ((driver.givenName || '') + ' ' + (driver.familyName || '')).trim(),
            value: '+' + pointsText(gapAhead),
            color: getCanonicalTeamColor(constructor ? constructor.constructorId : '', teamName, '')
        };
    });
    const topTeam = leader && leader.Constructors && leader.Constructors[0] ? leader.Constructors[0].name : '';
    renderTrustedHtml(driversSidePanel,
        sidePanelHeaderHTML('Race desk', 'Drivers championship context')
        + sideCardHTML('Closest gaps to car ahead', sideItems)
        + sideCardHTML('Context', [
            { label: 'Leading team', value: topTeam || 'TBD' },
            { label: 'Classified drivers', value: String((standings || []).length) },
            { label: 'Source', value: meta && meta.source ? meta.source : 'Jolpica F1' }
        ]),
        'driver standings side panel'
    );
}

export function renderConstructorStandingsPolish(standings, teamDrivers, meta, year) {
    const closest = findClosestBattle(standings);
    const leader = standings && standings[0];

    renderSummaryCards(constructorsSummaryRow, [
        { label: 'Leader', value: leader && leader.Constructor ? leader.Constructor.name : 'TBD', note: pointsText(leader && leader.points) + ' pts' },
        {
            label: 'Closest battle',
            value: closest && closest.current && closest.current.Constructor ? closest.current.Constructor.name + ' vs ' + closest.ahead.Constructor.name : 'TBD',
            note: closest ? pointsText(closest.gap) + ' pts gap' : 'No active gap'
        },
        { label: 'Last updated', value: formatStandingsDate(meta && meta.updatedAt), note: 'Season ' + (year || '') },
        { label: 'Source', value: meta && meta.source ? meta.source : 'Jolpica F1', note: 'Constructors championship' }
    ]);

    if (!constructorsSidePanel) return;
    const sideItems = (standings || []).slice(1, 5).map(function(row, index) {
        const prev = standings[index];
        const team = row.Constructor || {};
        const gapAhead = Math.max(0, normalizePoints(prev && prev.points) - normalizePoints(row.points));
        return {
            label: team.name || 'TBD',
            value: '+' + pointsText(gapAhead),
            color: getCanonicalTeamColor(team.constructorId || '', team.name || '', '')
        };
    });
    const driverSplit = (standings || []).slice(0, 4).map(function(row) {
        const team = row.Constructor || {};
        const drivers = teamDrivers && teamDrivers[team.constructorId] ? teamDrivers[team.constructorId] : [];
        return {
            label: team.name || 'TBD',
            value: drivers.length ? drivers.join(' / ') : 'TBD',
            color: getCanonicalTeamColor(team.constructorId || '', team.name || '', '')
        };
    });
    renderTrustedHtml(constructorsSidePanel,
        sidePanelHeaderHTML('Race desk', 'Constructors championship context')
        + sideCardHTML('Closest gaps to team ahead', sideItems)
        + sideCardHTML('Team split', driverSplit)
        + sideCardHTML('Source', [
            { label: 'Provider', value: meta && meta.source ? meta.source : 'Jolpica F1' },
            { label: 'Updated', value: formatStandingsDate(meta && meta.updatedAt) }
        ]),
        'constructor standings side panel'
    );
}

function formatStandingsDate(value) {
    if (!value) return 'Μετά τον τελευταίο αγώνα';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Μετά τον τελευταίο αγώνα';
    return date.toLocaleDateString('el-GR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function findClosestBattle(rows) {
    if (!rows || rows.length < 2) return null;
    let best = null;
    for (let i = 1; i < rows.length; i++) {
        const current = normalizePoints(rows[i].points || rows[i].points_current);
        const ahead = normalizePoints(rows[i - 1].points || rows[i - 1].points_current);
        const gap = Math.max(0, ahead - current);
        if (!best || gap < best.gap) best = { gap: gap, ahead: rows[i - 1], current: rows[i] };
    }
    return best;
}

function renderSummaryCards(target, items) {
    if (!target) return;
    const html = (items || []).map(function(item) {
        return '<div class="standings-context-card">'
            + '<div class="standings-context-label">' + esc(item.label) + '</div>'
            + '<div class="standings-context-value">' + esc(item.value) + '</div>'
            + '<div class="standings-context-note">' + esc(item.note || '') + '</div>'
            + '</div>';
    }).join('');
    renderTrustedHtml(target, html, 'standings summary cards');
}

function sidePanelHeaderHTML(label, title) {
    return '<div class="standings-side-head">'
        + '<div class="standings-side-kicker">' + esc(label) + '</div>'
        + '<div class="standings-side-title">' + esc(title) + '</div>'
        + '</div>';
}

function sideCardHTML(label, items) {
    return '<div class="standings-side-card">'
        + '<div class="standings-side-label">' + esc(label) + '</div>'
        + '<div class="standings-side-list">'
        + (items || []).map(function(item) {
            const color = item.color ? ' style="--team-color:#' + esc(item.color) + ';"' : '';
            return '<div class="standings-side-item">'
                + '<span style="display:flex;gap:0.45rem;min-width:0;">'
                + (item.color ? '<span class="standings-side-swatch"' + color + '></span>' : '')
                + '<span>' + esc(item.label) + '</span></span>'
                + '<strong>' + esc(item.value) + '</strong>'
                + '</div>';
        }).join('')
        + '</div></div>';
}

function toggleStandingsDetail(row) {
    const targetId = row.getAttribute('data-detail-target');
    if (!targetId) return;
    const detail = document.getElementById(targetId);
    if (!detail) return;
    const open = row.getAttribute('aria-expanded') !== 'true';
    row.setAttribute('aria-expanded', open ? 'true' : 'false');
    row.classList.toggle('is-expanded', open);
    detail.classList.toggle('is-open', open);
    detail.setAttribute('aria-hidden', open ? 'false' : 'true');
}
