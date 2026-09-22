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
        + '<span>Θέση</span><span>' + esc(identityLabel) + '</span><span>Βαθμοί</span>'
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
        { label: 'Πρωτοπόρος', value: leaderName || 'Δεν έχει οριστεί', note: pointsText(leader && leader.points) + ' βαθ.' },
        {
            label: 'Πιο κοντινή μάχη',
            value: closest && closest.current && closest.current.Driver ? closest.current.Driver.familyName + ' vs ' + closest.ahead.Driver.familyName : 'Δεν έχει οριστεί',
            note: closest ? pointsText(closest.gap) + ' βαθ. διαφορά' : 'Χωρίς ενεργή διαφορά'
        },
        { label: 'Τελευταία ενημέρωση', value: formatStandingsDate(meta && meta.updatedAt), note: 'Σεζόν ' + (year || '') },
        { label: 'Πηγή', value: meta && meta.source ? meta.source : 'Jolpica F1', note: 'Πρωτάθλημα οδηγών' }
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
        sidePanelHeaderHTML('Αγωνιστικό δελτίο', 'Πλαίσιο πρωταθλήματος οδηγών')
        + sideCardHTML('Διαφορές από το προπορευόμενο μονοθέσιο', sideItems)
        + sideCardHTML('Πλαίσιο', [
            { label: 'Πρωτοπόρος ομάδα', value: topTeam || 'Δεν έχει οριστεί' },
            { label: 'Καταταγμένοι οδηγοί', value: String((standings || []).length) },
            { label: 'Πηγή', value: meta && meta.source ? meta.source : 'Jolpica F1' }
        ]),
        'driver standings side panel'
    );
}

export function renderConstructorStandingsPolish(standings, teamDrivers, meta, year) {
    const closest = findClosestBattle(standings);
    const leader = standings && standings[0];

    renderSummaryCards(constructorsSummaryRow, [
        { label: 'Πρωτοπόρος', value: leader && leader.Constructor ? leader.Constructor.name : 'Δεν έχει οριστεί', note: pointsText(leader && leader.points) + ' βαθ.' },
        {
            label: 'Πιο κοντινή μάχη',
            value: closest && closest.current && closest.current.Constructor ? closest.current.Constructor.name + ' vs ' + closest.ahead.Constructor.name : 'Δεν έχει οριστεί',
            note: closest ? pointsText(closest.gap) + ' βαθ. διαφορά' : 'Χωρίς ενεργή διαφορά'
        },
        { label: 'Τελευταία ενημέρωση', value: formatStandingsDate(meta && meta.updatedAt), note: 'Σεζόν ' + (year || '') },
        { label: 'Πηγή', value: meta && meta.source ? meta.source : 'Jolpica F1', note: 'Πρωτάθλημα κατασκευαστών' }
    ]);

    if (!constructorsSidePanel) return;
    const sideItems = (standings || []).slice(1, 5).map(function(row, index) {
        const prev = standings[index];
        const team = row.Constructor || {};
        const gapAhead = Math.max(0, normalizePoints(prev && prev.points) - normalizePoints(row.points));
        return {
            label: team.name || 'Δεν έχει οριστεί',
            value: '+' + pointsText(gapAhead),
            color: getCanonicalTeamColor(team.constructorId || '', team.name || '', '')
        };
    });
    const driverSplit = (standings || []).slice(0, 4).map(function(row) {
        const team = row.Constructor || {};
        const drivers = teamDrivers && teamDrivers[team.constructorId] ? teamDrivers[team.constructorId] : [];
        return {
            label: team.name || 'Δεν έχει οριστεί',
            value: drivers.length ? drivers.join(' / ') : 'Δεν έχει οριστεί',
            color: getCanonicalTeamColor(team.constructorId || '', team.name || '', '')
        };
    });
    renderTrustedHtml(constructorsSidePanel,
        sidePanelHeaderHTML('Αγωνιστικό δελτίο', 'Πλαίσιο πρωταθλήματος κατασκευαστών')
        + sideCardHTML('Διαφορές από την προπορευόμενη ομάδα', sideItems)
        + sideCardHTML('Κατανομή ομάδων', driverSplit)
        + sideCardHTML('Πηγή', [
            { label: 'Πάροχος', value: meta && meta.source ? meta.source : 'Jolpica F1' },
            { label: 'Ενημέρωση', value: formatStandingsDate(meta && meta.updatedAt) }
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

// The headline battle is fought at the sharp end: adjacent pairs within the
// top 10 where both have scored. Falls back to P1–P2 when nothing qualifies.
export function findClosestBattle(rows) {
    if (!rows || rows.length < 2) return null;
    let best = null;
    for (let i = 1; i < Math.min(rows.length, 10); i++) {
        if (normalizePoints(rows[i].points || rows[i].points_current) <= 0) continue;
        const current = normalizePoints(rows[i].points || rows[i].points_current);
        const ahead = normalizePoints(rows[i - 1].points || rows[i - 1].points_current);
        const gap = Math.max(0, ahead - current);
        if (!best || gap < best.gap) best = { gap: gap, ahead: rows[i - 1], current: rows[i] };
    }
    if (best) return best;
    const leader = normalizePoints(rows[0].points || rows[0].points_current);
    return { gap: Math.max(0, leader - normalizePoints(rows[1].points || rows[1].points_current)), ahead: rows[0], current: rows[1] };
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
