const { createHash } = require('crypto');
const { fs, path, CONFIG, escapeHtmlAttribute } = require('./shared');
const { seriesFor, supportedViews } = require('../widgets/betcast/widget-entry.cjs');

const BETCAST_RENDERER_VERSION = 1;
const SAFE_SNAPSHOT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const EXPECTED_SOURCES = {
    current: { sheetId: '16cz7p-hZIs3PrvhL9JJ1q1tqyVEupXQ2k8kN8F9mexc', gid: '796888004' },
    lastYear: { sheetId: '1nMytseR9C-GJNri0n5DAW25jijullNMVUcTj1mLEEYs', gid: null }
};
const ROW_FIELDS = [
    'id', 'week', 'betNumber', 'betLabel', 'betType', 'company',
    'odds', 'stake', 'result', 'profitLoss', 'cumulativeBudget'
];

function snapshotError(message) {
    const error = new Error(`BetCast snapshot: ${message}`);
    error.code = 'BETCAST_SNAPSHOT';
    return error;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function assertSafeSnapshotId(id) {
    if (typeof id !== 'string' || !SAFE_SNAPSHOT_ID.test(id)) {
        throw snapshotError('ID must contain 1–80 ASCII letters, numbers, underscores, or hyphens');
    }
    return id;
}

function normalizeSelection(selection) {
    if (!selection || typeof selection !== 'object' || Array.isArray(selection)) {
        throw snapshotError('selection must be an object');
    }
    const normalized = {};
    for (const key of ['from', 'to', 'week', 'cmpA', 'cmpB']) {
        const value = selection[key];
        if (value !== null && (!Number.isSafeInteger(value) || value < 1)) {
            throw snapshotError(`selection.${key} must be a positive integer or null`);
        }
        normalized[key] = value;
    }
    normalized.viz = selection.viz;
    normalized.season = selection.season;
    if (normalized.viz !== 'dataTable') throw snapshotError('only viz=dataTable snapshots are supported');
    if (!['current', 'lastYear'].includes(normalized.season)) throw snapshotError('selection.season is unknown');
    if (normalized.from != null && normalized.to != null && normalized.from > normalized.to) {
        throw snapshotError('selection.from must be less than or equal to selection.to');
    }
    return {
        viz: normalized.viz,
        season: normalized.season,
        from: normalized.from,
        to: normalized.to,
        week: normalized.week,
        cmpA: normalized.cmpA,
        cmpB: normalized.cmpB
    };
}

function validateSnapshot(snapshot, expectedId) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw snapshotError('must be a JSON object');
    if (snapshot.schemaVersion !== 1) throw snapshotError('schemaVersion must be 1');
    assertSafeSnapshotId(snapshot.id);
    if (snapshot.id !== expectedId) throw snapshotError(`file ID does not match snapshot ID "${snapshot.id}"`);
    if (typeof snapshot.capturedAt !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(snapshot.capturedAt) || !Number.isFinite(Date.parse(snapshot.capturedAt))) {
        throw snapshotError('capturedAt must be an ISO-8601 timestamp');
    }

    const { source, selection, rows } = snapshot;
    if (!source || !['current', 'lastYear'].includes(source.alias)) throw snapshotError('source.alias is unknown');
    const expectedSource = EXPECTED_SOURCES[source.alias];
    if (source.sheetId !== expectedSource.sheetId || (source.gid ?? null) !== expectedSource.gid) {
        throw snapshotError('source sheet/tab does not match the configured source alias');
    }
    if (typeof source.label !== 'string' || !source.label.trim() || source.label !== source.label.trim()) {
        throw snapshotError('source.label must be a verified, non-empty label');
    }
    if (typeof source.sheetId !== 'string' || !source.sheetId.trim()) throw snapshotError('source.sheetId is missing');
    if (source.gid !== null && typeof source.gid !== 'string') throw snapshotError('source.gid must be a string or null');
    if (!['verified-sheet', 'provided-csv'].includes(source.kind)) throw snapshotError('source.kind is invalid');
    if (typeof source.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(source.contentHash)) {
        throw snapshotError('source.contentHash must be a SHA-256 hex digest');
    }

    const normalizedSelection = normalizeSelection(selection);
    const selectionKeys = ['viz', 'season', 'from', 'to', 'week', 'cmpA', 'cmpB'];
    if (Object.keys(selection).length !== selectionKeys.length
        || selectionKeys.some(key => selection[key] !== normalizedSelection[key])) {
        throw snapshotError('selection must use explicit nullable filter values');
    }
    if (source.alias !== selection.season) throw snapshotError('source.alias does not match selection.season');
    if (!Array.isArray(rows)) throw snapshotError('rows must be an array');

    let previousId = 0;
    for (const [index, row] of rows.entries()) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw snapshotError(`row ${index + 1} must be an object`);
        for (const field of ROW_FIELDS) {
            if (!(field in row)) throw snapshotError(`row ${index + 1} is missing ${field}`);
        }
        for (const field of ['id', 'week', 'betNumber']) {
            if (!Number.isSafeInteger(row[field]) || row[field] < 1) throw snapshotError(`row ${index + 1} ${field} must be a positive integer`);
        }
        if (row.id <= previousId) throw snapshotError(`row ${index + 1} id is not in source order`);
        previousId = row.id;
        if ((selection.from != null && row.week < selection.from)
            || (selection.to != null && row.week > selection.to)
            || (selection.week != null && row.week !== selection.week)) {
            throw snapshotError(`row ${index + 1} does not match the selection filters`);
        }
        for (const field of ['odds', 'stake', 'profitLoss', 'cumulativeBudget']) {
            if (typeof row[field] !== 'number' || !Number.isFinite(row[field])) throw snapshotError(`row ${index + 1} ${field} must be a finite number`);
        }
        for (const field of ['betLabel', 'betType', 'company', 'result']) {
            if (typeof row[field] !== 'string') throw snapshotError(`row ${index + 1} ${field} must be text`);
        }
    }
    return snapshot;
}

function readSnapshot(snapshotId) {
    const id = assertSafeSnapshotId(snapshotId);
    const snapshotPath = path.join(CONFIG.BETCAST_SNAPSHOT_DIR, `${id}.json`);
    let raw;
    try {
        raw = fs.readFileSync(snapshotPath);
    } catch (error) {
        throw snapshotError(`could not read "${id}.json" from betcast-snapshots (${error.code || error.message})`);
    }
    let snapshot;
    try {
        snapshot = JSON.parse(raw.toString('utf8'));
    } catch (_) {
        throw snapshotError(`"${id}.json" is not valid JSON`);
    }
    validateSnapshot(snapshot, id);
    return { snapshot, contentHash: createHash('sha256').update(raw).digest('hex') };
}

function getAnalysisUrl(snapshot, baseUrl = CONFIG.BETCAST_BASE_URL) {
    let base;
    try { base = new URL(baseUrl); } catch (_) { throw snapshotError('BETCAST_BASE_URL is not a valid absolute URL'); }
    const approved = (base.protocol === 'https:' && base.hostname === 'georgiosbalatzis.github.io'
            && base.pathname === '/BetCastVisualisation/')
        || (base.protocol === 'https:' && base.hostname === 'f1stories.gr' && base.pathname === '/betcast/');
    if (!approved || base.username || base.password || base.port || base.search || base.hash) {
        throw snapshotError('BETCAST_BASE_URL must be the approved GitHub Pages or /betcast/ URL');
    }
    const params = new URLSearchParams();
    const { selection } = snapshot;
    params.set('viz', selection.viz);
    params.set('season', selection.season);
    for (const key of ['from', 'to', 'week', 'cmpA', 'cmpB']) {
        if (selection[key] != null) params.set(key, String(selection[key]));
    }
    base.search = params.toString();
    return base.toString();
}

function formatNumber(value, fractionDigits) {
    return new Intl.NumberFormat('el-GR', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits
    }).format(value);
}

function formatMoney(value, signed = false) {
    const prefix = signed && value > 0 ? '+' : '';
    return `${prefix}${formatNumber(value, 2)} €`;
}

function resultLabel(result) {
    if (result === 'Win') return { text: 'Νίκη', className: 'betcast-article-block__result--win' };
    if (result === 'Lose') return { text: 'Ήττα', className: 'betcast-article-block__result--loss' };
    return { text: result || '—', className: '' };
}

function selectionScope(selection) {
    const constraints = [];
    if (selection.week != null) constraints.push(`Εβδομάδα ${selection.week}`);
    if (selection.from != null || selection.to != null) {
        if (selection.from != null && selection.to != null) constraints.push(`Εύρος ${selection.from}–${selection.to}`);
        else if (selection.from != null) constraints.push(`Από την εβδομάδα ${selection.from}`);
        else constraints.push(`Έως την εβδομάδα ${selection.to}`);
    }
    return constraints.length ? constraints.join(' · ') : 'Όλη η σεζόν';
}

function renderRows(rows) {
    return rows.map(row => {
        const result = resultLabel(row.result);
        return `<tr>
            <td class="betcast-article-block__number">${row.betNumber}</td>
            <td>${escapeHtml(row.betLabel || '—')}</td>
            <td>${escapeHtml(row.betType || '—')}</td>
            <td>${escapeHtml(row.company || '—')}</td>
            <td class="betcast-article-block__numeric">${formatNumber(row.odds, 2)}</td>
            <td class="betcast-article-block__numeric">${formatMoney(row.stake)}</td>
            <td><span class="betcast-article-block__result ${result.className}">${escapeHtml(result.text)}</span></td>
            <td class="betcast-article-block__numeric ${row.profitLoss >= 0 ? 'betcast-article-block__profit' : 'betcast-article-block__loss'}">${formatMoney(row.profitLoss, true)}</td>
            <td class="betcast-article-block__numeric">${formatMoney(row.cumulativeBudget)}</td>
        </tr>`;
    }).join('\n');
}

function renderTable(rows, caption, snapshotId) {
    const headers = ['#', 'Στοίχημα', 'Τύπος', 'Εταιρία', 'Απόδοση', 'Ποντάρισμα', 'Αποτέλεσμα', 'Κέρδος/Ζημία', 'Budget'];
    const headerHtml = headers.map((label, index) => `<th scope="col"${index === 0 ? ' class="betcast-article-block__number"' : ''}>${label}</th>`).join('');
    return `<div class="betcast-article-block__table-region" role="region" aria-label="Πίνακας επιλογών BetCast ${escapeHtml(snapshotId)}" tabindex="0">
        <p class="betcast-article-block__scroll-hint">Ο πίνακας συνεχίζεται οριζόντια όπου χρειάζεται.</p>
        <table>
            <caption>${escapeHtml(caption)}</caption>
            <thead><tr>${headerHtml}</tr></thead>
            <tbody>${renderRows(rows)}</tbody>
        </table>
    </div>`;
}

function renderBetcastSnapshot(snapshot, contentHash, baseUrl) {
    const scope = selectionScope(snapshot.selection);
    const timestamp = new Date(snapshot.capturedAt).toLocaleString('el-GR', {
        dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Athens'
    });
    const firstRows = snapshot.rows.slice(0, 15);
    const remainingRows = snapshot.rows.slice(15);
    const tables = snapshot.rows.length
        ? `${renderTable(firstRows, 'Επιλογές στοιχήματος από το καταγεγραμμένο snapshot του BetCast.', snapshot.id)}${remainingRows.length ? `<details class="betcast-article-block__more"><summary>Προβολή ${remainingRows.length} ακόμη επιλογών</summary>${renderTable(remainingRows, `Επιλογές ${firstRows.length + 1}–${snapshot.rows.length}.`, snapshot.id)}</details>` : ''}`
        : '<p class="betcast-article-block__empty">Δεν υπάρχουν στοιχήματα για αυτή την περίοδο.</p>';
    const marker = `<!-- betcast-snapshot:${snapshot.id}:${contentHash}:renderer-${BETCAST_RENDERER_VERSION} -->`;
    const analysisUrl = escapeHtmlAttribute(getAnalysisUrl(snapshot, baseUrl));

    return `${marker}
    <section class="betcast-article-block" aria-label="BetCast — ${escapeHtml(scope)}">
        <p class="betcast-article-block__brand">BETCAST <span aria-hidden="true">·</span> F1 STORIES</p>
        <h2 class="betcast-article-block__title">Οι επιλογές μας — ${escapeHtml(scope)}</h2>
        <p class="betcast-article-block__scope">Σεζόν ${escapeHtml(snapshot.source.label)} · ${escapeHtml(scope)}</p>
        ${tables}
        <p class="betcast-article-block__freshness"><time datetime="${escapeHtml(snapshot.capturedAt)}">Δεδομένα snapshot καταγεγραμμένα στις ${escapeHtml(timestamp)}</time></p>
        <p class="betcast-article-block__analysis"><a href="${analysisUrl}" target="_blank" rel="noopener noreferrer">Πλήρης ανάλυση στο BetCast <span aria-hidden="true">↗</span></a></p>
    </section>`;
}

function renderBetcastArticleBlock(snapshotId, options = {}) {
    const { snapshot, contentHash } = readSnapshot(snapshotId);
    return renderBetcastSnapshot(snapshot, contentHash, options.baseUrl);
}

function renderBetcastChartBlock(snapshotId, view = 'budget', options = {}) {
    const { snapshot, contentHash } = readSnapshot(snapshotId);
    if (!supportedViews.includes(view)) throw snapshotError(`unsupported article chart view "${view}"`);
    const series = seriesFor(snapshot.rows, view);
    const max = Math.max(0, ...series.map(point => point.value));
    const min = Math.min(0, ...series.map(point => point.value));
    const span = max - min || 1;
    const plot = series.map((point, index) => {
        const slot = 560 / Math.max(1, series.length);
        const barWidth = Math.max(2, Math.min(24, slot * 0.68));
        const x = 36 + index * slot + (slot - barWidth) / 2;
        const zeroY = 150 - max / span * 120;
        const valueY = 30 + (max - point.value) / span * 120;
        const title = `${view === 'budget' ? 'Στοίχημα' : 'Εβδομάδα'} ${point.label}: ${point.value.toLocaleString('el-GR', { maximumFractionDigits: 2 })}`;
        return `<g><title>${escapeHtml(title)}</title><rect x="${x.toFixed(2)}" y="${Math.min(valueY, zeroY).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${Math.max(1, Math.abs(zeroY - valueY)).toFixed(2)}" rx="2" class="bar${point.value < 0 ? ' bar--negative' : ''}"/><text x="${(x + barWidth / 2).toFixed(2)}" y="169" text-anchor="middle">${escapeHtml(point.label)}</text></g>`;
    }).join('');
    const config = escapeHtmlAttribute(JSON.stringify({ rows: snapshot.rows, view }));
    const analysisUrl = escapeHtmlAttribute(getAnalysisUrl(snapshot, options.baseUrl));
    const label = view === 'budget' ? 'Budget ανά στοίχημα' : view === 'weeklyProfit' ? 'Κέρδος ανά εβδομάδα'
        : view === 'weeklyRoi' ? 'ROI ανά εβδομάδα' : 'Ποσοστό νικών ανά εβδομάδα';
    const marker = `<!-- betcast-widget:${snapshot.id}:${contentHash}:${view}:renderer-1 -->`;
    return `${marker}<figure class="betcast-chart-fallback" data-f1s-betcast-widget="1" data-f1s-betcast-config="${config}" aria-label="${escapeHtmlAttribute(label)}">
        <figcaption>${escapeHtml(label)} · Σεζόν ${escapeHtml(snapshot.source.label)}</figcaption>
        <div class="betcast-chart-fallback__static"><svg viewBox="0 0 620 190" role="img" aria-label="${escapeHtmlAttribute(`${label}, στατικό γράφημα`)}"><line x1="36" y1="150" x2="596" y2="150" class="axis"/>${plot || '<text x="310" y="100" text-anchor="middle">Δεν υπάρχουν δεδομένα για το γράφημα.</text>'}</svg>
        <a href="${analysisUrl}" target="_blank" rel="noopener noreferrer">Άνοιγμα πλήρους ανάλυσης BetCast ↗</a></div>
    </figure>`;
}

function hasCurrentSnapshotMarkers(articleHtml) {
    const markerRegex = /<!-- betcast-snapshot:([A-Za-z0-9][A-Za-z0-9_-]{0,79}):([a-f0-9]{64}):renderer-(\d+) -->/g;
    let match;
    while ((match = markerRegex.exec(String(articleHtml || ''))) !== null) {
        let current;
        try { current = readSnapshot(match[1]); } catch (_) { return false; }
        if (current.contentHash !== match[2] || Number(match[3]) !== BETCAST_RENDERER_VERSION) return false;
    }
    return true;
}

module.exports = {
    BETCAST_RENDERER_VERSION,
    assertSafeSnapshotId,
    validateSnapshot,
    getAnalysisUrl,
    renderBetcastArticleBlock,
    renderBetcastChartBlock,
    renderBetcastSnapshot,
    hasCurrentSnapshotMarkers
};
