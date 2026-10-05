const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const { CONFIG, utils } = require('../shared');
const { extractEmbedPlaceholders } = require('../embeds');
const { buildEmbedHtml, resolveEmbedPlaceholders } = require('../embed-render');
const { convertTxtToHtml } = require('../parse-txt');
const {
    getAnalysisUrl,
    hasCurrentSnapshotMarkers,
    renderBetcastArticleBlock,
    renderBetcastChartBlock,
    validateSnapshot
} = require('../betcast');

const originalSnapshotDir = CONFIG.BETCAST_SNAPSHOT_DIR;
let snapshotDir;

function row(overrides = {}) {
    const id = overrides.id || 1;
    return {
        id,
        week: 16,
        betNumber: 1,
        betLabel: 'Verstappen νίκη',
        betType: 'Νικητής αγώνα',
        company: 'Stoiximan',
        odds: 2.35,
        stake: 10,
        result: 'Win',
        profitLoss: 13.5,
        cumulativeBudget: 113.5,
        ...overrides
    };
}

function snapshot(overrides = {}) {
    return {
        schemaVersion: 1,
        id: 'week16-fixture',
        capturedAt: '2026-10-05T12:00:00.000Z',
        source: {
            alias: 'current',
            label: 'Verified season label',
            sheetId: '16cz7p-hZIs3PrvhL9JJ1q1tqyVEupXQ2k8kN8F9mexc',
            gid: '796888004',
            kind: 'provided-csv',
            contentHash: 'a'.repeat(64)
        },
        selection: {
            viz: 'dataTable', season: 'current', from: null, to: null,
            week: 16, cmpA: 12, cmpB: 16
        },
        rows: [row()],
        ...overrides
    };
}

function writeSnapshot(value) {
    fs.writeFileSync(path.join(snapshotDir, `${value.id}.json`), JSON.stringify(value, null, 2));
}

beforeEach(() => {
    snapshotDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-betcast-snapshots-'));
    CONFIG.BETCAST_SNAPSHOT_DIR = snapshotDir;
    writeSnapshot(snapshot());
});

afterEach(() => {
    CONFIG.BETCAST_SNAPSHOT_DIR = originalSnapshotDir;
    fs.rmSync(snapshotDir, { recursive: true, force: true });
});

test('renders an escaped semantic native table with scope, timestamp and matching analysis link', () => {
    const value = snapshot({
        source: { ...snapshot().source, label: '<script>season</script>' },
        rows: [row({ betLabel: '<script>alert(1)</script>', company: 'A & B' })]
    });
    writeSnapshot(value);
    const html = renderBetcastArticleBlock(value.id, { baseUrl: 'https://f1stories.gr/betcast/' });

    for (const value of [
        '<section class="betcast-article-block"', '<table>', '<caption>Επιλογές στοιχήματος',
        '<th scope="col">Στοίχημα</th>', '&lt;script&gt;alert(1)&lt;/script&gt;', 'A &amp; B',
        'Σεζόν &lt;script&gt;season&lt;/script&gt; · Εβδομάδα 16', 'Δεδομένα snapshot καταγεγραμμένα στις',
        'https://f1stories.gr/betcast/?viz=dataTable&amp;season=current&amp;week=16&amp;cmpA=12&amp;cmpB=16'
    ]) assert.ok(html.includes(value), `Expected rendered block to include ${value}`);
    for (const value of ['<script>', 'embed=', 'theme=', 'chart-select']) assert.ok(!html.includes(value), `Unexpected rendered content: ${value}`);
    assert.equal(renderBetcastArticleBlock(value.id, { baseUrl: 'https://f1stories.gr/betcast/' }), html);
});

test('empty and long selections remain present in ordinary HTML without JavaScript', () => {
    const empty = snapshot({ rows: [] });
    writeSnapshot(empty);
    const emptyHtml = renderBetcastArticleBlock(empty.id);
    assert.ok(emptyHtml.includes('Δεν υπάρχουν στοιχήματα για αυτή την περίοδο.'));
    assert.ok(!emptyHtml.includes('<table>'));

    const long = snapshot({ rows: Array.from({ length: 18 }, (_, index) => row({
        id: index + 1, week: index + 1, betNumber: 1, betLabel: `Bet ${index + 1}`
    })), selection: { ...snapshot().selection, week: null, cmpA: null, cmpB: null } });
    writeSnapshot(long);
    const longHtml = renderBetcastArticleBlock(long.id);
    assert.ok(longHtml.includes('<details class="betcast-article-block__more">'));
    assert.ok(longHtml.includes('<summary>Προβολή 3 ακόμη επιλογών</summary>'));
    assert.equal((longHtml.match(/<td(?:\s|>)/g) || []).length / 9, 18);
    assert.ok(longHtml.includes('Bet 18'));
});

test('chart shortcode uses a pinned snapshot and keeps an SVG and analysis fallback', () => {
    const parsed = extractEmbedPlaceholders('BETCAST_CHART:week16-fixture|view=weeklyProfit', '/article', true);
    const info = Object.values(parsed.placeholders)[0];
    assert.deepEqual(info, { type: 'betcast-chart', value: 'week16-fixture', view: 'weeklyProfit' });
    const html = buildEmbedHtml(info);
    assert.ok(html.includes('data-f1s-betcast-widget="1"'));
    assert.ok(html.includes('betcast-chart-fallback__static'));
    assert.ok(html.includes('<svg viewBox="0 0 620 190"'));
    assert.ok(html.includes('href="https://georgiosbalatzis.github.io/BetCastVisualisation/?viz=dataTable&amp;season=current&amp;week=16&amp;cmpA=12&amp;cmpB=16"'));
    assert.ok(!html.includes('<script'));
    assert.throws(() => renderBetcastChartBlock('week16-fixture', 'unknown'), /unsupported article chart view/);
    const resolved = resolveEmbedPlaceholders(`<p>${Object.keys(parsed.placeholders)[0]}</p>`, parsed.placeholders);
    assert.ok(resolved.includes('data-f1s-betcast-widget="1"'));
});

test('analysis URLs preserve the complete selection and use only approved configured bases', () => {
    const value = snapshot({ selection: {
        viz: 'dataTable', season: 'lastYear', from: 4, to: 12, week: 7, cmpA: 5, cmpB: 7
    }, source: { ...snapshot().source, alias: 'lastYear' } });
    assert.equal(getAnalysisUrl(value, 'https://georgiosbalatzis.github.io/BetCastVisualisation/'),
        'https://georgiosbalatzis.github.io/BetCastVisualisation/?viz=dataTable&season=lastYear&from=4&to=12&week=7&cmpA=5&cmpB=7'
    );
    assert.throws(() => getAnalysisUrl(snapshot(), 'https://f1stories.gr/standings/'), /BETCAST_BASE_URL/);
});

test('only approved BetCast embed frames receive a managed sizing wrapper and analysis fallback', () => {
    const { getManagedBetCastUrl } = require('../embed-render');
    const managedUrl = 'https://georgiosbalatzis.github.io/BetCastVisualisation/?viz=budget&embed=1&presentation=article&theme=host';
    assert.equal(getManagedBetCastUrl(managedUrl).origin, 'https://georgiosbalatzis.github.io');
    assert.equal(getManagedBetCastUrl('https://f1stories.gr/standings/?embed=1'), null);
    const html = buildEmbedHtml({ type: 'iframe', value: `${managedUrl}|title=BetCast&height=960&style=width:100%;min-height:960px;border:0` });
    assert.match(html, /class="embed-container embed-iframe betcast-managed-embed"/);
    assert.match(html, /data-f1s-betcast-managed="true"/);
    assert.ok(html.includes('href="https://georgiosbalatzis.github.io/BetCastVisualisation/?viz=budget"'));
});

test('rejects malformed snapshots, scope mismatches, missing files and unsafe IDs', () => {
    assert.throws(() => validateSnapshot({ ...snapshot(), schemaVersion: 2 }, 'week16-fixture'), /schemaVersion/);
    assert.throws(() => validateSnapshot({ ...snapshot(), source: { ...snapshot().source, alias: 'lastYear' } }, 'week16-fixture'), /does not match/);
    assert.throws(() => validateSnapshot({ ...snapshot(), rows: [row({ week: 15 })] }, 'week16-fixture'), /selection filters/);
    assert.throws(() => renderBetcastArticleBlock('../week16-fixture'), /ID must/);
    assert.throws(() => renderBetcastArticleBlock('missing-snapshot'), /could not read/);
});

test('snapshot hash and renderer version invalidate only changed snapshot blocks', () => {
    const html = renderBetcastArticleBlock('week16-fixture');
    assert.equal(hasCurrentSnapshotMarkers(html), true);
    assert.equal(hasCurrentSnapshotMarkers(html.replace('renderer-1', 'renderer-0')), false);
    assert.equal(hasCurrentSnapshotMarkers(`${html}<!-- unrelated -->`), true);
    const changed = snapshot({ rows: [row({ company: 'Different bookmaker' })] });
    writeSnapshot(changed);
    assert.equal(hasCurrentSnapshotMarkers(html), false);
});

test('incremental article checks rebuild on snapshot edits while skipping unchanged snapshots', () => {
    const entryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-betcast-entry-'));
    try {
        const sourcePath = path.join(entryDir, 'source.txt');
        const articlePath = path.join(entryDir, 'article.html');
        fs.writeFileSync(sourcePath, 'BETCAST:week16-fixture\n');
        fs.writeFileSync(articlePath, `<img class="article-header-img" srcset="/hero-sm.webp 800w">\n${renderBetcastArticleBlock('week16-fixture')}`);
        const future = new Date(Date.now() + 10_000);
        fs.utimesSync(articlePath, future, future);
        assert.equal(utils.shouldSkip(entryDir, false), true);

        writeSnapshot(snapshot({ rows: [row({ company: 'Changed' })] }));
        assert.equal(utils.shouldSkip(entryDir, false), false);
    } finally {
        fs.rmSync(entryDir, { recursive: true, force: true });
    }
});

test('BETCAST shortcodes resolve through the existing placeholder path, including repeated blocks', () => {
    const { cleanedText, placeholders } = extractEmbedPlaceholders('Intro\n\nBETCAST:week16-fixture\n\nBETCAST:week16-fixture\n', '/article', true);
    const tokenBlocks = Object.entries(placeholders).map(([token]) => `<p>${token}</p>`).join('\n');
    const resolved = resolveEmbedPlaceholders(tokenBlocks, placeholders);
    assert.ok(cleanedText.includes('__EMBED_PLACEHOLDER_0__'));
    assert.equal(Object.keys(placeholders).length, 2);
    assert.equal((resolved.match(/class="betcast-article-block"/g) || []).length, 2);
    assert.ok(buildEmbedHtml({ type: 'betcast', value: 'week16-fixture' }).includes('<table>'));

    const docxResolved = resolveEmbedPlaceholders('<p>BETCAST:week16-fixture</p>', {
        'BETCAST:week16-fixture': { type: 'betcast', value: 'week16-fixture' }
    });
    assert.ok(docxResolved.includes('<section class="betcast-article-block"'));
});

test('natural prose beginning with Betcast is not parsed as a snapshot shortcode', () => {
    const parsed = extractEmbedPlaceholders('Betcast: 267 Austria GP: Προβλέπουμε χαμό ; ..\n\nBETCAST:20260627J', '/article', true);
    const betcast = Object.values(parsed.placeholders).filter(value => value.type === 'betcast');
    assert.deepEqual(betcast.map(value => value.value), ['20260627J']);
    assert.match(parsed.cleanedText, /Betcast: 267 Austria GP/);
});

test('source.txt authoring keeps the block between surrounding article paragraphs', async () => {
    const entryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-betcast-source-'));
    const sourcePath = path.join(entryDir, 'source.txt');
    fs.writeFileSync(sourcePath, '---\ncategory: Betting\ntitle: Fixture\n---\n\nBefore the table.\n\nBETCAST:week16-fixture\n\nAfter the table.\n');
    try {
        const html = await convertTxtToHtml(sourcePath);
        assert.ok(html.indexOf('<p>Before the table.</p>') < html.indexOf('<section class="betcast-article-block"'));
        assert.ok(html.indexOf('<section class="betcast-article-block"') < html.indexOf('<p>After the table.</p>'));
    } finally {
        fs.rmSync(entryDir, { recursive: true, force: true });
    }
});

test('article conversion surfaces missing snapshots as a clear build error', async () => {
    const entryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-betcast-missing-'));
    const sourcePath = path.join(entryDir, 'source.txt');
    fs.writeFileSync(sourcePath, '---\ncategory: Betting\ntitle: Fixture\n---\n\nBETCAST:missing-fixture\n');
    try {
        await assert.rejects(convertTxtToHtml(sourcePath), error => error.code === 'BETCAST_SNAPSHOT' && /could not read/.test(error.message));
    } finally {
        fs.rmSync(entryDir, { recursive: true, force: true });
    }
});
