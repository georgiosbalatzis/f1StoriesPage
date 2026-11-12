import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inventory, assemble, prepareMain, validateSite } from './assemble.mjs';
import { assertReleasable, buildMode, checkLock, checkScript, checkSource, childCacheKey, nodeEnvironment, restoreChildCache, saveChildCache, seedImageCache } from './release.mjs';
import { extraNode } from './toolchain.mjs';
import { legacyStubs } from './redirects.mjs';
import { verifyPublic, verifyIdentity } from './verify-public.mjs';

const ORIGIN = 'https://f1-stories.gr';
const builtAt = '2026-10-25T12:00:00.000Z';
const here = path.dirname(fileURLToPath(import.meta.url));

function fixture(t, entries) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-path-test-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const [name, data] of Object.entries(entries)) {
        fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
        fs.writeFileSync(path.join(root, name), data);
    }
    return root;
}

const landing = (name, extra = '') => `<!doctype html><html lang="el"><head>
<link rel="canonical" href="${ORIGIN}/${name}/"><meta property="og:url" content="${ORIGIN}/${name}/">
<meta name="description" content="${name} for F1 Stories readers, with real data.">
<meta property="og:title" content="${name}"><meta property="og:description" content="${name} tool">
<meta property="og:image" content="${ORIGIN}/${name}/og.png"><meta property="og:locale" content="el_GR"><meta property="og:site_name" content="F1 Stories">
<link rel="stylesheet" href="assets/app.css"><script type="module" src="assets/app.js"></script>${extra}</head>
<body><nav><a href="/">Αρχική</a><a href="/tyres/">TYRES</a></nav><h1>${name}</h1></body></html>`;
const child = (name, entries = {}) => ({ 'index.html': landing(name), 'assets/app.js': 'import("./chunk.js")', 'assets/chunk.js': '', 'assets/app.css': '', 'og.png': 'png', ...entries });
const tyresData = (generatedAt = builtAt, retrievedAt = builtAt) => ({
    'data/manifest.json': JSON.stringify({ generatedAt, latest: '2026-us' }),
    'data/weekends/2026-us.json': JSON.stringify({ raceId: '2026-us', dates: ['2026-10-23', '2026-10-24', '2026-10-25'], weather: { kind: 'forecast', retrievedAt } }),
});
const tyresRace = `<!doctype html><html><head><link rel="canonical" href="${ORIGIN}/tyres/2026/austin/"><meta property="og:url" content="${ORIGIN}/tyres/2026/austin/"></head><body><h1>Austin</h1></body></html>`;
const tyresEmbed = `<!doctype html><html lang="en"><head><meta name="robots" content="noindex"><link rel="canonical" href="${ORIGIN}/tyres/2026/austin/"></head><body><p><a href="${ORIGIN}/tyres/2026/austin/">Open</a></p></body></html>`;
const main = (entries = {}) => ({
    'index.html': '<nav><a href="/standings/">Βαθμολογία</a></nav>', '404.html': 'Missing', 'standings/index.html': 'Grid', 'authors/index.html': 'Authors',
    'robots.txt': 'User-agent: *\nAllow: /', 'sitemap.xml': `<urlset>\n  <url><loc>${ORIGIN}/</loc></url>\n</urlset>`, ...entries,
});

/** A complete, valid four-tool site; each negative test changes exactly one thing. */
function site(t, overrides = {}) {
    const apps = [
        { application: 'main', path: '/', entries: main(overrides.main) },
        { application: 'telemetry', path: '/telemetry/', entries: child('telemetry', overrides.telemetry) },
        { application: 'ghostcar', path: '/ghostcar/', entries: child('ghostcar', overrides.ghostcar) },
        { application: 'tyres', path: '/tyres/', entries: child('tyres', { '2026/austin/index.html': tyresRace, 'embed/el/2026/austin/compounds/index.html': tyresEmbed, ...tyresData(), ...overrides.tyres }) },
        { application: 'betcast', path: '/betcast/', entries: child('betcast', overrides.betcast) },
    ].map(({ entries, ...app }) => ({ ...app, directory: fixture(t, Object.fromEntries(Object.entries(entries).filter(([, data]) => data !== null))) }));
    const destination = fixture(t, {});
    const reports = fixture(t, {});
    return { run: () => assemble(apps, destination, { builtAt }, reports), destination, reports };
}

test('a complete four-tool site assembles; tool roots and indexable race pages join the sitemap once', t => {
    const { run, destination } = site(t);
    const result = run();
    const sitemap = fs.readFileSync(path.join(destination, 'sitemap.xml'), 'utf8');
    for (const name of ['telemetry', 'ghostcar', 'tyres', 'betcast']) assert.equal(sitemap.split(`<loc>${ORIGIN}/${name}/</loc>`).length, 2, name);
    assert.ok(sitemap.includes(`<loc>${ORIGIN}/tyres/2026/austin/</loc>`));
    assert.ok(!sitemap.includes('/embed/'), 'noindex embeds stay out of the sitemap');
    assert.ok(!sitemap.includes('lastmod'), 'no invented modification dates');
    assert.deepEqual(result.nested.tyres, { pages: 3, indexable: 2, noindex: 1 });
    assert.deepEqual(result.freshness.warnings, []);
    const manifest = JSON.parse(fs.readFileSync(path.join(destination, 'deployment-manifest.json')));
    assert.deepEqual(manifest.applications.map(app => app.canonicalPath), ['/', '/telemetry/', '/ghostcar/', '/tyres/', '/betcast/']);
});

test('manifest accounting describes the assembled files', t => {
    const { run, destination } = site(t);
    const result = run();
    const manifestData = fs.readFileSync(path.join(destination, 'deployment-manifest.json'));
    const manifest = JSON.parse(manifestData);
    const children = ['telemetry', 'ghostcar', 'tyres', 'betcast'];
    const walk = (prefix = '') => fs.readdirSync(path.join(destination, prefix), { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
            const rel = path.posix.join(prefix, entry.name);
            return entry.isDirectory() ? walk(rel) : [rel];
        });
    const entries = walk().filter(rel => rel !== 'deployment-manifest.json').map(rel => {
        const data = fs.readFileSync(path.join(destination, rel));
        return { application: children.find(name => rel.startsWith(`${name}/`)) || 'main', path: rel, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
    });
    const ordered = ['main', ...children].flatMap(application => entries.filter(entry => entry.application === application));
    assert.equal(manifest.outputDigest, createHash('sha256').update(JSON.stringify(ordered)).digest('hex'));
    for (const app of manifest.applications) {
        const own = entries.filter(entry => entry.application === app.application);
        assert.equal(app.files, own.length, app.application);
        assert.equal(app.bytes, own.reduce((sum, entry) => sum + entry.bytes, 0), app.application);
    }
    assert.equal(result.bytes, entries.reduce((sum, entry) => sum + entry.bytes, 0) + manifestData.length);
});

const failures = {
    'wrong canonical': [{ ghostcar: { 'index.html': landing('ghostcar').replace(`canonical" href="${ORIGIN}/ghostcar/`, 'canonical" href="https://f1stories.gr/ghostcar/') } }, /ghostcar: incorrect canonical/],
    'duplicate canonical': [{ betcast: { 'index.html': landing('betcast', `<link rel="canonical" href="${ORIGIN}/betcast/">`) } }, /exactly one canonical/],
    'duplicate OG URL': [{ betcast: { 'index.html': landing('betcast', `<meta property="og:url" content="${ORIGIN}/betcast/">`) } }, /exactly one OG URL/],
    'landing without site name': [{ telemetry: { 'index.html': landing('telemetry').replace('<meta property="og:site_name" content="F1 Stories">', '') } }, /og:site_name/],
    'duplicate sitemap entry': [{ main: { 'sitemap.xml': `<urlset><url><loc>${ORIGIN}/</loc></url><url><loc>${ORIGIN}/</loc></url></urlset>` } }, /Duplicate sitemap entries/],
    'old host in sitemap': [{ main: { 'sitemap.xml': '<urlset><url><loc>https://georgiosbalatzis.github.io/Tyres/</loc></url></urlset>' } }, /outside the primary domain/],
    'missing JS chunk': [{ tyres: { 'assets/chunk.js': null } }, /tyres: missing chunk tyres\/assets\/chunk\.js/],
    'missing CSS': [{ ghostcar: { 'assets/app.css': null } }, /ghostcar: missing asset assets\/app\.css/],
    'asset escaping namespace': [{ telemetry: { 'index.html': landing('telemetry', '<script src="../betcast/assets/app.js"></script>') } }, /telemetry: asset escapes namespace/],
    'incorrect base path': [{ tyres: { 'index.html': landing('tyres', '<script type="module" src="/assets/app.js"></script>') } }, /tyres: asset escapes namespace: \/assets\/app\.js/],
    'missing social image': [{ betcast: { 'og.png': null } }, /missing social image/],
    'unsafe service-worker scope': [{ telemetry: { 'assets/app.js': 'navigator.serviceWorker.register("/sw.js", { scope: "/" })' } }, /telemetry: unsafe service-worker scope \//],
    'stale required data': [{ tyres: tyresData('2026-10-23T00:00:00.000Z') }, /tyres: stale data snapshot/],
    'missing required data manifest': [{ tyres: { 'data/manifest.json': null } }, /manifest\.json/],
    'production source map': [{ betcast: { 'assets/app.js.map': '{}' } }, /source map/],
    'internal documentation': [{ ghostcar: { 'README.md': '# notes' } }, /Internal documentation/],
    'development credentials': [{ tyres: { '.env': 'TOKEN=x' } }, /Credential-like file/],
    'hidden directory': [{ telemetry: { '.well-known/security.txt': 'contact' } }, /Hidden path \.well-known .*upload-pages-artifact.*hidden-file upload rule/],
    'test files': [{ tyres: { 'tests/unit/a.test.js': '' } }, /Source\/test content/],
    'nested page without policy': [{ tyres: { '2026/austin/index.html': '<h1>Austin</h1>' } }, /2026\/austin\/index\.html needs a self canonical or noindex/],
    'retired navigation link': [{ tyres: { 'index.html': landing('tyres').replace('<a href="/">', '<a href="https://f1stories.gr/">') } }, /Retired publisher links in navigation: tyres\/index\.html/],
    'old standalone tool link': [{ main: { 'index.html': '<nav><a href="https://georgiosbalatzis.github.io/ghostcar/">GHOST CAR</a></nav>' } }, /Retired publisher links/],
    'author pages removed': [{ main: { 'authors/index.html': null } }, /Missing Main-owned authors\/index\.html/],
    'output collision': [{ main: { 'tyres/index.html': 'Main stub' } }, /Output collisions/],
};
for (const [name, [overrides, error]] of Object.entries(failures)) test(`${name} prevents release, before anything is published`, t => {
    const { run, destination } = site(t, overrides);
    assert.throws(run, error);
    assert.ok(!fs.existsSync(path.join(destination, 'deployment-manifest.json')));
});

test('an old forecast is reported, not hidden; TYRES itself labels it stale', t => {
    const { run } = site(t, { tyres: tyresData(builtAt, '2026-10-22T08:27:26.810Z') });
    assert.deepEqual(run().freshness.warnings, ['2026-us: forecast 76 h old; TYRES labels it stale']);
});

test('a missing current forecast is reported in the release metadata', t => {
    const { run } = site(t, { tyres: { 'data/weekends/2026-us.json': JSON.stringify({ raceId: '2026-us', dates: ['2026-10-23', '2026-10-24', '2026-10-25'] }) } });
    assert.deepEqual(run().freshness.warnings, ['2026-us: forecast missing; TYRES labels it stale']);
});

test('a missing tool root fails validation', t => {
    const root = fixture(t, main());
    assert.throws(() => validateSite(root, [{ application: 'tyres', path: '/tyres/' }], { builtAt }), /tyres: missing tool root/);
});

test('duplicate output paths fail before any artifact is copied', t => {
    const mainDir = fixture(t, { 'telemetry/index.html': 'Main' });
    const childDir = fixture(t, { 'index.html': 'child' });
    const destination = fixture(t, {});
    const reports = fixture(t, {});
    assert.throws(() => assemble([{ application: 'main', path: '/', directory: mainDir }, { application: 'telemetry', path: '/telemetry/', directory: childDir }], destination, {}, reports), /Output collisions/);
    assert.deepEqual(fs.readdirSync(destination), []);
    assert.equal(JSON.parse(fs.readFileSync(path.join(reports, 'collision-report.json'))).collisions.length, 1);
});

test('parent-file and child-directory conflicts are detected', t => {
    const mainDir = fixture(t, { tyres: 'file' });
    const childDir = fixture(t, { 'index.html': 'app' });
    assert.equal(inventory([{ application: 'main', path: '/', directory: mainDir }, { application: 'tyres', path: '/tyres/', directory: childDir }]).collisions.length, 1);
});

test('identical filenames in separate product namespaces do not collide', t => {
    const root = fixture(t, { 'index.html': 'app', 'assets/app.js': 'script' });
    const report = inventory(['telemetry', 'ghostcar', 'tyres', 'betcast'].map(application => ({ application, path: `/${application}/`, directory: root })));
    assert.equal(report.collisions.length, 0);
    assert.equal(report.entries.length, 8);
});

test('an unknown namespace is refused', t => {
    const root = fixture(t, { 'index.html': 'app' });
    assert.throws(() => inventory([{ application: 'other', path: '/other/', directory: root }]), /Invalid output namespace/);
});

const stub = legacy => `<meta name="f1s-redirect-target" content="${legacy}"><a href="${legacy}">Άνοιξε</a>`;
test('the audited Ghost Car and TYRES redirect stubs are reserved; Telemetry compatibility stays', t => {
    const root = fixture(t, {
        'ghostcar/index.html': stub('https://georgiosbalatzis.github.io/ghostcar/'),
        'tyres/index.html': stub('https://georgiosbalatzis.github.io/Tyres/'),
        'f1telemetry/index.html': `<link rel="canonical" href="https://georgiosbalatzis.github.io/f1-telemetry-dashboard/"><meta property="og:url" content="https://f1-stories.gr/f1telemetry/">${stub('https://georgiosbalatzis.github.io/f1-telemetry-dashboard/')}`,
        'partials.html': '<nav><a href="https://georgiosbalatzis.github.io/Tyres/">TYRES</a><a href="https://f1-stories.gr/standings/">GRID</a></nav>',
        'sitemap.xml': '<urlset>\n</urlset>',
    });
    prepareMain(root);
    assert.ok(!fs.existsSync(path.join(root, 'ghostcar')) && !fs.existsSync(path.join(root, 'tyres')));
    const compatibility = fs.readFileSync(path.join(root, 'f1telemetry/index.html'), 'utf8');
    assert.ok(compatibility.includes('<link rel="canonical" href="https://f1-stories.gr/telemetry/">'));
    assert.ok(compatibility.includes('content="/telemetry/"'), 'redirect target is same-origin');
    assert.equal(fs.readFileSync(path.join(root, 'partials.html'), 'utf8'), '<nav><a href="/tyres/">TYRES</a><a href="/standings/">GRID</a></nav>');
    assert.ok(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8').includes(`<loc>${ORIGIN}/standings/</loc>`));
});

for (const namespace of ['ghostcar', 'tyres']) test(`unreviewed Main content cannot be silently replaced by ${namespace}`, t => {
    const root = fixture(t, { [`${namespace}/index.html`]: 'real content' });
    assert.throws(() => prepareMain(root), /not the audited legacy redirect/);
    assert.equal(fs.readFileSync(path.join(root, namespace, 'index.html'), 'utf8'), 'real content');
});

test('artifact symlinks are forbidden', t => {
    const root = fixture(t, { 'index.html': 'app' });
    fs.symlinkSync(path.join(root, 'index.html'), path.join(root, 'linked.html'));
    assert.throws(() => inventory([{ application: 'telemetry', path: '/telemetry/', directory: root }]), /Symbolic link forbidden/);
});

test('hard links cannot enter a Pages artifact', t => {
    const root = fixture(t, { 'index.html': 'app' });
    fs.linkSync(path.join(root, 'index.html'), path.join(root, 'hardlinked.html'));
    assert.throws(() => inventory([{ application: 'telemetry', path: '/telemetry/', directory: root }]), /Hard link forbidden/);
});

test('Main cannot occupy an unused child path even without an exact collision', t => {
    const root = fixture(t, { 'tyres/unexpected.txt': 'Main' });
    const destination = fixture(t, {});
    const reports = fixture(t, {});
    assert.throws(() => assemble([{ application: 'main', path: '/', directory: root }], destination, {}, reports), /Main writes into child namespace/);
    assert.deepEqual(fs.readdirSync(destination), []);
});

// Release gates (release.mjs). The committed lock itself must always pass.
const lock = () => JSON.parse(fs.readFileSync(path.join(here, 'sources.json')));
test('the committed source lock is valid and stays gated until release readiness', () => {
    const config = checkLock(lock());
    assert.equal(config.enabled && !config.releaseReady, false);
    assert.equal(config.applications.find(app => app.application === 'tyres').node, '24');
});
const lockFailures = {
    'invalid SHA': [config => { config.applications[3].sha = 'main'; }, /tyres: child source pins must be full commit SHAs/],
    'short SHA': [config => { config.applications[1].sha = config.applications[1].sha.slice(0, 12); }, /full commit SHAs/],
    'enabled before readiness': [config => { config.enabled = true; config.releaseReady = false; }, /cannot be enabled before releaseReady/],
    'reordered ownership': [config => { config.applications.reverse(); }, /Invalid source lock entry/],
    'tool moved to another path': [config => { config.applications[3].path = '/Tyres/'; }, /Invalid source lock entry/],
    'missing Node declaration': [config => { delete config.applications[4].node; }, /declare the Node major/],
    'data from a moving feature branch': [config => { config.applications[3].data.ref = 'data/pirelli-update'; }, /reviewed default branch/],
    'data path escaping the source': [config => { config.applications[3].data.paths = ['../src']; }, /unsafe data path/],
};
for (const [name, [mutate, error]] of Object.entries(lockFailures)) test(`source lock: ${name} is rejected`, () => {
    const config = lock();
    mutate(config);
    assert.throws(() => checkLock(config), error);
});

test('a release with unmet readiness conditions is refused; local and dry-run rehearsals are allowed', () => {
    assert.throws(() => assertReleasable({ releaseReady: false }, { local: false }), /Release pins are not ready/);
    assert.doesNotThrow(() => assertReleasable({ releaseReady: false }, { local: true }));
    assert.doesNotThrow(() => assertReleasable({ releaseReady: false }, { local: false, rehearsal: true }));
    assert.equal(buildMode({ local: false, rehearsal: false }), 'release');
    assert.equal(buildMode({ local: false, rehearsal: true }), 'rehearsal');
    // A rehearsal always builds the pinned sources, never a workspace checkout.
    assert.throws(() => buildMode({ local: true, rehearsal: true }), /cannot be combined with --local/);
});

const read = rel => fs.readFileSync(path.join(here, '../..', rel), 'utf8');
test('image cache seeding copies entries without reports or outside writes', t => {
    const root = fixture(t, {
        'source/image.webp': 'image', 'source/report.json': 'stale',
        'source/social-cards/card.jpg': 'card', 'source/social-cards/report.json': 'stale',
        'outside/keep': 'untouched',
    });
    const source = path.join(root, 'source'), destination = path.join(root, 'snapshot/.build/public-images');
    fs.symlinkSync(path.join(root, 'outside'), path.join(source, 'link'));
    seedImageCache(path.join(root, 'missing'), destination);
    assert.equal(fs.existsSync(destination), false);
    seedImageCache(source, destination);
    assert.equal(fs.readFileSync(path.join(destination, 'image.webp'), 'utf8'), 'image');
    assert.equal(fs.readFileSync(path.join(destination, 'social-cards/card.jpg'), 'utf8'), 'card');
    for (const file of ['report.json', 'social-cards/report.json', 'link']) assert.equal(fs.existsSync(path.join(destination, file)), false);
    assert.equal(fs.readFileSync(path.join(root, 'outside/keep'), 'utf8'), 'untouched');
    assert.equal(fs.readFileSync(path.join(source, 'report.json'), 'utf8'), 'stale');
});

test('verified child artifact cache reuses valid entries and fails closed on pin, data, freshness or file tampering', t => {
    const cacheRoot = fixture(t, {});
    const telemetryApp = lock().applications.find(app => app.application === 'telemetry');
    const telemetryOut = fixture(t, child('telemetry'));
    const telemetryMeta = {
        ...telemetryApp,
        sourceSha: telemetryApp.sha,
        sourceDigest: 'a'.repeat(64),
        dirty: false,
        version: '1.0.0',
        nodeVersion: 'v22.22.2',
    };
    const key = saveChildCache(cacheRoot, telemetryApp, telemetryMeta, telemetryOut);
    assert.ok(key?.startsWith('telemetry-'));
    // Valid restore succeeds and produces byte-identical output.
    const dest1 = path.join(cacheRoot, 'restored-1');
    const hit = restoreChildCache(cacheRoot, telemetryApp, dest1, { builtAt });
    assert.ok(hit && hit.cacheHit === true);
    assert.equal(hit.sourceSha, telemetryApp.sha);
    assert.equal(fs.readFileSync(path.join(dest1, 'index.html'), 'utf8'), landing('telemetry'));

    // Pin change misses cleanly.
    const changedPin = { ...telemetryApp, sha: 'f'.repeat(40) };
    assert.equal(restoreChildCache(cacheRoot, changedPin, path.join(cacheRoot, 'miss-pin'), { builtAt }), null);

    // Tampered file content in cache fails digest verification and returns null.
    fs.writeFileSync(path.join(cacheRoot, key, 'output/assets/app.js'), 'tampered();');
    assert.equal(restoreChildCache(cacheRoot, telemetryApp, path.join(cacheRoot, 'miss-tamper'), { builtAt }), null);

    // TYRES cache checks both remote data.sha and 6-hour freshness window.
    const tyresApp = lock().applications.find(app => app.application === 'tyres');
    const tyresBuiltAt = new Date().toISOString();
    const tyresOut = fixture(t, child('tyres', { '2026/austin/index.html': tyresRace, ...tyresData(tyresBuiltAt, tyresBuiltAt) }));
    const dataSha = 'd'.repeat(40);
    const tyresMeta = {
        ...tyresApp,
        sourceSha: tyresApp.sha,
        sourceDigest: 'b'.repeat(64),
        dirty: false,
        version: '0.1.0',
        nodeVersion: 'v24.15.0',
        data: {
            ref: 'main',
            paths: ['data'],
            sha: dataSha,
            digest: 'c'.repeat(64),
            refresh: { script: 'weekend:update', at: builtAt, digest: 'e'.repeat(64) },
        },
    };
    const tyresKey = saveChildCache(cacheRoot, tyresApp, tyresMeta, tyresOut, { dataSha });
    assert.ok(tyresKey?.startsWith('tyres-'));
    // Fresh TYRES cache with matching dataSha hits.
    const tyresDest = path.join(cacheRoot, 'snapshot-tyres', tyresApp.output);
    assert.equal(fs.existsSync(path.dirname(tyresDest)), false);
    const tyresHit = restoreChildCache(cacheRoot, tyresApp, tyresDest, { dataSha, builtAt: tyresBuiltAt });
    assert.ok(tyresHit && tyresHit.cacheHit === true);
    assert.equal(tyresHit.data.sha, dataSha);
    // Different remote dataSha misses.
    assert.equal(restoreChildCache(cacheRoot, tyresApp, path.join(cacheRoot, 'miss-data'), { dataSha: '9'.repeat(40), builtAt }), null);
    // The six-hour boundary is stale, and a changed TYRES pin also misses.
    const sixHoursLater = new Date(Date.parse(tyresBuiltAt) + 6 * 3600000).toISOString();
    assert.equal(restoreChildCache(cacheRoot, tyresApp, path.join(cacheRoot, 'miss-stale'), { dataSha, builtAt: sixHoursLater }), null);
    assert.equal(restoreChildCache(cacheRoot, { ...tyresApp, sha: 'f'.repeat(40) }, path.join(cacheRoot, 'miss-tyres-pin'), { dataSha, builtAt: tyresBuiltAt }), null);
    fs.writeFileSync(path.join(cacheRoot, tyresKey, 'output/index.html'), 'tampered');
    assert.equal(restoreChildCache(cacheRoot, tyresApp, path.join(cacheRoot, 'miss-tyres-tamper'), { dataSha, builtAt: tyresBuiltAt }), null);

    // .build/child-artifacts/ must be gitignored so restored caches never dirty main or trip rendering-sink-guard.
    const repoRoot = path.join(here, '../..');
    const probeDir = path.join(repoRoot, '.build/child-artifacts/telemetry-probe/output/assets');
    t.after(() => fs.rmSync(path.join(repoRoot, '.build/child-artifacts/telemetry-probe'), { recursive: true, force: true }));
    fs.mkdirSync(probeDir, { recursive: true });
    fs.writeFileSync(path.join(probeDir, 'vendor.js'), ['element', '.inner', 'HTML = "<p>vendor</p>";\n'].join(''));
    const ignoreCheck = spawnSync('git', ['check-ignore', '-q', '.build/child-artifacts/telemetry-probe/output/assets/vendor.js'], { cwd: repoRoot });
    assert.equal(ignoreCheck.status, 0, '.build/child-artifacts/ must be ignored by git');
    const sinkGuard = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/quality/rendering-sink-guard.mjs')], { cwd: repoRoot, encoding: 'utf8' });
    assert.equal(sinkGuard.status, 0, sinkGuard.stderr || sinkGuard.stdout);
});

test('the dry run cannot publish, and the publisher never builds a rehearsal', () => {
    const dryRun = read('.github/workflows/aggregate-dry-run.yml');
    assert.doesNotMatch(dryRun, /uses:\s*actions\/(?:deploy-pages|upload-pages-artifact|configure-pages)|uses:\s*\.\/\.github\/(?:workflows\/deploy-pages|actions\/build-pages)|pages:\s*write|id-token|contents:\s*write/);
    assert.match(dryRun, /permissions:\n  contents: read\n/);
    assert.match(dryRun, /build:ecosystem -- --rehearsal --node-bin "\$F1S_NODE_BIN"/);
    assert.match(dryRun, /rehearsal: 'true'/);
    assert.match(dryRun, /- uses: \.\/\.github\/actions\/restore-article-images\n\s+- name: Build the pinned aggregate \(rehearsal\)/);
    const restore = read('.github/actions/restore-article-images/action.yml');
    assert.match(restore, /uses: actions\/cache\/restore@/);
    assert.doesNotMatch(dryRun + restore, /actions\/cache@|actions\/cache\/save@/);
    for (const publisher of ['.github/actions/build-pages/action.yml', '.github/workflows/deploy-pages.yml', '.github/workflows/publish-blog.yml']) {
        assert.doesNotMatch(read(publisher), /--rehearsal|--local|--allow-dirty|rehearsal: 'true'/, publisher);
    }
});

test('the dry run runs every gate the publisher runs on an enabled aggregate', () => {
    const publisher = read('.github/actions/build-pages/action.yml');
    const dryRun = read('.github/workflows/aggregate-dry-run.yml');
    const gates = [...publisher.matchAll(/run: (npm run (?:quality:static|qa:media|audit:runtime)|node --test scripts\/build\/__tests__\/[^\n]+)/g)].map(match => match[1].trim());
    assert.equal(gates.length, 4);
    for (const gate of gates) assert.ok(dryRun.includes(`gate ${gate}`), `dry run lacks: ${gate}`);
});

test('the dry run reports every endpoint the tools read at runtime, from the new origin', async () => {
    const { ENDPOINTS, readable } = await import('./live-read.mjs');
    assert.deepEqual(ENDPOINTS.map(([, , url]) => new URL(url).host), ['api.openf1.org', 'api.multiviewer.app', 'api.jolpi.ca', 'docs.google.com']);
    assert.equal(readable(200, '*'), true);
    assert.equal(readable(200, 'https://f1-stories.gr'), true);
    assert.equal(readable(200, 'https://f1stories.gr'), false);
    assert.equal(readable(429, '*'), false);
    assert.equal(readable(500, '*'), false);
});

test('dirty or mismatched release sources are refused', () => {
    const app = { application: 'tyres', sha: 'a'.repeat(40) };
    assert.throws(() => checkSource(app, { sha: app.sha, dirty: true }, { allowDirty: false }), /tyres: dirty sources/);
    assert.throws(() => checkSource(app, { sha: 'b'.repeat(40), dirty: false }, { allowDirty: false }), /does not match reviewed pin/);
    assert.doesNotThrow(() => checkSource(app, { sha: app.sha, dirty: false }, { allowDirty: false }));
});

test('a pinned source without the build contract, or locked below its engines floor, is refused', () => {
    const app = { application: 'tyres', build: 'build:f1stories', node: '22', data: { refresh: 'weekend:update' } };
    assert.throws(() => checkScript(app, { scripts: { build: 'vite build' } }), /lacks build:f1stories/);
    assert.throws(() => checkScript(app, { scripts: { 'build:f1stories': 'x', 'weekend:update': 'y' }, engines: { node: '>=24' } }), /requires >=24/);
    assert.throws(() => checkScript({ ...app, node: '24' }, { scripts: { 'build:f1stories': 'x' }, engines: { node: '>=24' } }), /lacks weekend:update/);
});

test('the wrong Node environment is refused', t => {
    const current = process.versions.node.split('.')[0];
    assert.equal(nodeEnvironment({ application: 'main', node: current }, {}).version, process.version);
    assert.throws(() => nodeEnvironment({ application: 'tyres', node: '999' }, {}), /tyres: requires Node 999\.x .*--node-bin 999=/);
    const bin = fixture(t, { node: '#!/bin/sh\necho v20.19.0\n' });
    fs.chmodSync(path.join(bin, 'node'), 0o755);
    assert.throws(() => nodeEnvironment({ application: 'tyres', node: '999' }, { 999: bin }), /tyres: requires Node 999\.x, found v20\.19\.0/);
});

test('public integrity: every sitemap URL is a page canonical to itself, on the primary domain', t => {
    const page = url => `<link rel="canonical" href="${url}">`;
    const entries = {
        CNAME: 'f1-stories.gr\n', '404.html': '', 'robots.txt': 'User-agent: *\nAllow: /', 'feed.xml': '', 'index.html': page(`${ORIGIN}/`),
        'standings/index.html': '', 'authors/index.html': '', 'authors/a/index.html': '', 'blog-module/blog/index.html': '', 'blog-module/blog/section/news/index.html': '',
        'blog-module/blog/archive/2026/index.html': '', 'blog-module/blog/entities/drivers/x/index.html': '',
        'blog-module/blog-entries/1/article.html': page(`${ORIGIN}/blog-module/blog-entries/1/article.html`),
        'blog-module/blog-entries/20260227Τ/article.html': page(`${ORIGIN}/blog-module/blog-entries/20260227%CE%A4/article.html`),
        ...Object.fromEntries(['telemetry', 'ghostcar', 'tyres', 'betcast'].map(tool => [`${tool}/index.html`, page(`${ORIGIN}/${tool}/`)])),
        'sitemap.xml': ['/', '/blog-module/blog-entries/1/article.html', '/blog-module/blog-entries/20260227Τ/article.html', '/tyres/'].map(p => `<loc>${ORIGIN}${p}</loc>`).join(''),
    };
    const ok = verifyPublic(fixture(t, entries));
    assert.deepEqual(ok.problems, []);
    assert.equal(ok.notes.length, 1, 'the unencoded Greek article id is reported');
    const broken = verifyPublic(fixture(t, { ...entries, CNAME: 'f1stories.gr', 'sitemap.xml': entries['sitemap.xml'] + `<loc>${ORIGIN}/gone/</loc>`, 'tyres/index.html': page(`${ORIGIN}/Tyres/`) }));
    assert.deepEqual(broken.problems, ['CNAME does not name the primary domain', `${ORIGIN}/tyres/ declares canonical ${ORIGIN}/Tyres/`, `sitemap URL without a page: ${ORIGIN}/gone/`]);
});

test('prepared github.io compatibility pages keep the deep path, query and hash', t => {
    const { run, destination } = site(t);
    run();
    const stubs = legacyStubs(lock(), destination);
    const race = stubs['tyres/2026/austin/index.html'];
    assert.ok(race.includes(`<link rel="canonical" href="${ORIGIN}/tyres/2026/austin/">`));
    assert.ok(race.includes('location.search + location.hash'));
    assert.ok(stubs['tyres/embed/el/2026/austin/compounds/index.html'].includes(`${ORIGIN}/tyres/embed/el/2026/austin/compounds/`));
    // Old paths the aggregate does not list keep their path under the new tool, never the homepage.
    const fallback = stubs['tyres/404.html'];
    const script = fallback.match(/<script>([\s\S]*?)<\/script>/)[1];
    const location = { pathname: '/Tyres/2026/zandvoort/', search: '?x=1', hash: '#weather', replace: url => { location.to = url; } };
    let ready;
    new Function('location', 'document', 'addEventListener', script)(location, { getElementById: () => ({}) }, (_, fn) => { ready = fn; });
    ready();
    assert.equal(location.to, `${ORIGIN}/tyres/2026/zandvoort/?x=1#weather`);
    assert.ok(stubs['telemetry/index.html'].includes(`${ORIGIN}/telemetry/`) && stubs['betcast/404.html'].includes('"/BetCastVisualisation/"'));
});

test('CI provisions the TYRES Node toolchain only once aggregation is release-ready', () => {
    const config = lock();
    assert.equal(extraNode({ ...config, enabled: false, releaseReady: false }), '');
    assert.equal(extraNode({ ...config, releaseReady: true }), '24');
    assert.equal(extraNode({ ...config, releaseReady: true }, '22', { mainOnly: true }), '');
    assert.equal(extraNode({ ...config, releaseReady: true }, '22', { mainOnly: true, rehearsal: true }), '24');
    assert.equal(extraNode({ ...config, enabled: false, releaseReady: false }, '22', { rehearsal: true }), '24');
    config.applications[1].node = '20';
    assert.throws(() => extraNode({ ...config, releaseReady: true }), /One extra Node toolchain/);
});

test('a missing pinned source fails clearly instead of building something else', t => {
    const workspace = fixture(t, {});
    const result = spawnSync(process.execPath, [path.join(here, 'build.mjs'), '--local', '--workspace', workspace, '--output', path.join(workspace, 'site')], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /main: source checkout missing at/);
    assert.ok(!fs.existsSync(path.join(workspace, 'site')));
});


test('offline artifact identity detects contract mutations', async t => {
    const lock = JSON.parse(fs.readFileSync(path.join(here, 'sources.json')));
    const { run, destination, reports } = site(t, { main: {
        '.nojekyll': '', CNAME: 'f1-stories.gr', 'feed.xml': '', 'blog-module/blog/index.html': '',
        'authors/a/index.html': '', 'blog-module/blog/section/news/index.html': '', 'blog-module/blog/archive/2026/index.html': '',
        'blog-module/blog/entities/drivers/x/index.html': '', 'blog-module/blog-entries/1/article.html': '',
    }, telemetry: { '.nojekyll': '', 'interactive/.nojekyll': '' } });
    run();
    for (const rel of ['.nojekyll', 'telemetry/.nojekyll', 'telemetry/interactive/.nojekyll']) assert.equal(fs.existsSync(path.join(destination, rel)), false);
    assert.ok(JSON.parse(fs.readFileSync(path.join(reports, 'collision-report.json'))).entries.every(entry => !entry.path.includes('.nojekyll')));
    assert.deepEqual(verifyPublic(destination).problems, []);
    const manifestPath = path.join(destination, 'deployment-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath));
    Object.assign(manifest, { mode: 'release', releaseEligible: true, sourcesClean: true, lock: { enabled: true, releaseReady: true }, buildId: 'fixture', nodeVersion: 'v22.0.0' });
    for (const [i, record] of manifest.applications.entries()) {
        const app = lock.applications[i];
        Object.assign(record, { repository: app.repository, sourceSha: app.sha || 'a'.repeat(40), sourceDigest: 'b'.repeat(64), dirty: false, version: '1.0.0', build: app.build, nodeVersion: `v${app.node}.0.0` });
        if (app.data) record.data = { ref: app.data.ref, paths: app.data.paths, sha: 'c'.repeat(40), digest: 'd'.repeat(64), refresh: { script: app.data.refresh, at: builtAt, digest: 'e'.repeat(64) } };
    }
    const save = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    save();
    const verify = () => verifyIdentity(destination, lock, { expectedMainSha: 'a'.repeat(40), expectedTyresDataSha: 'c'.repeat(40) }).checks;
    const started = performance.now();
    const initial = verify();
    console.log(`offline identity fixture runtime: ${(performance.now() - started).toFixed(2)} ms`);
    assert.ok(initial.every(c => c.status !== 'FAIL'), JSON.stringify(initial));
    await t.test('CLI report destinations preserve artifact bytes', () => {
        const digestTree = () => {
            const walk = (dir, prefix = '') => fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
                const rel = path.join(prefix, entry.name);
                return entry.isDirectory() ? [[rel, 'directory'], ...walk(path.join(dir, entry.name), rel)] : [[rel, createHash('sha256').update(fs.readFileSync(path.join(dir, entry.name))).digest('hex')]];
            });
            return createHash('sha256').update(JSON.stringify(walk(destination))).digest('hex');
        };
        const invoke = report => spawnSync(process.execPath, [path.join(here, 'verify-public.mjs'), '--site', destination, '--lock', path.join(here, 'sources.json'), ...(report ? ['--report', report] : [])], { encoding: 'utf8' });
        const before = digestTree();
        const outside = path.join(reports, 'report.json');
        assert.equal(invoke(outside).status, 0);
        assert.ok(JSON.parse(fs.readFileSync(outside)).checks.every(check => check.status !== 'FAIL'));
        assert.equal(digestTree(), before);
        assert.equal(invoke(path.join(destination, 'report.json')).status, 2);
        assert.equal(digestTree(), before);
        const link = path.join(reports, 'link.json');
        fs.symlinkSync(path.join(destination, 'index.html'), link);
        assert.equal(invoke(link).status, 2);
        assert.equal(digestTree(), before);
        const parent = path.join(reports, 'alias');
        fs.symlinkSync(destination, parent);
        assert.equal(invoke(path.join(parent, 'report.json')).status, 2);
        assert.equal(digestTree(), before);
        const hardlink = path.join(reports, 'hardlink');
        fs.linkSync(path.join(destination, 'index.html'), hardlink);
        assert.equal(invoke(hardlink).status, 2);
        assert.equal(digestTree(), before);
        fs.unlinkSync(hardlink);
        assert.equal(invoke().status, 0);
        assert.equal(digestTree(), before);
    });
    const cases = [
        ['hidden marker added' , 'A-13', () => fs.writeFileSync(path.join(destination, '.nojekyll'), '')],
        ['changed child file', 'A-04/A-07', () => fs.appendFileSync(path.join(destination, 'ghostcar/assets/app.js'), 'changed')],
        ['deleted non-sitemap asset', 'A-09/A-10/A-06', () => fs.unlinkSync(path.join(destination, 'ghostcar/assets/app.css'))],
        ['missing manifest field', 'A-04', () => { delete manifest.buildId; save(); }],
        ['wrong child sourceSha', 'A-01/A-02', () => { manifest.applications[1].sourceSha = 'f'.repeat(40); save(); }],
        ['wrong repository', 'A-01/A-02', () => { manifest.applications[1].repository = 'wrong/repo'; save(); }],
        ['wrong build', 'A-01/A-02', () => { manifest.applications[1].build = 'wrong'; save(); }],
        ['wrong Node major', 'A-01/A-02', () => { manifest.applications[1].nodeVersion = 'v99.0.0'; save(); }],
        ['wrong namespace', 'A-01/A-02', () => { manifest.applications[1].canonicalPath = '/wrong/'; save(); }],
        ['missing refresh metadata', 'A-05/A-06', () => { delete manifest.applications[3].data.refresh; save(); }],
        ['missing app record', 'A-01/A-02', () => { manifest.applications.pop(); save(); }],
        ['missing child root', 'A-09/A-10/A-06', () => fs.unlinkSync(path.join(destination, 'ghostcar/index.html'))],
        ['wrong TYRES data identity', 'A-05/A-06', () => { manifest.applications[3].data.sha = 'f'.repeat(40); save(); }],
        ['freshness mismatch', 'A-05/A-06', () => { manifest.freshness.dataGeneratedAt = '2026-01-01T00:00:00Z'; save(); }],
        ['wrong canonical origin', 'A-09/A-10/A-06', () => { const p = path.join(destination, 'ghostcar/index.html'); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(`${ORIGIN}/ghostcar/`, 'https://evil.example/ghostcar/')); }],
        ['retired navigation link', 'A-09/A-10/A-06', () => fs.appendFileSync(path.join(destination, 'index.html'), '<nav><a href="https://f1stories.gr/">old</a></nav>')],
        ['forbidden child source path', 'A-08', () => { fs.mkdirSync(path.join(destination, 'tyres/src')); fs.writeFileSync(path.join(destination, 'tyres/src/example.js'), ''); }],
    ];
    for (const [name, id, mutate] of cases) await t.test(name, () => {
        const backup = fs.mkdtempSync(path.join(os.tmpdir(), 'p08-backup-'));
        fs.cpSync(destination, backup, { recursive: true });
        const before = structuredClone(manifest);
        try { mutate(); const result = verify(); assert.ok(result.some(c => c.id === id && c.status === 'FAIL' && c.diagnostic), JSON.stringify(result)); }
        finally { fs.rmSync(destination, { recursive: true }); fs.cpSync(backup, destination, { recursive: true }); fs.rmSync(backup, { recursive: true }); Object.keys(manifest).forEach(key => delete manifest[key]); Object.assign(manifest, before); }
    });
});

test('URL preservation detects removals and missing files while allowing additions', t => {
    const sitemap = urls => `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>${ORIGIN}/${url}</loc></url>`).join('')}</urlset>`;
    const previous = fixture(t, { 'sitemap.xml': sitemap(['old/']) });
    const current = fixture(t, { 'sitemap.xml': sitemap(['old/', 'new/']), 'old/index.html': 'old' });
    const run = (...extra) => spawnSync(process.execPath, [path.join(here, 'url-preservation.mjs'), '--previous', previous, '--current', current, ...extra], { encoding: 'utf8' });
    assert.equal(run().status, 0);
    assert.equal(run('--report', path.join(current, 'report.json')).status, 2);
    const reports = fixture(t, { 'target.json': 'keep' });
    fs.symlinkSync(path.join(reports, 'target.json'), path.join(reports, 'link.json'));
    assert.equal(run('--report', path.join(reports, 'link.json')).status, 2);
    fs.linkSync(path.join(reports, 'target.json'), path.join(reports, 'hardlink.json'));
    assert.equal(run('--report', path.join(reports, 'hardlink.json')).status, 2);
    assert.equal(fs.readFileSync(path.join(reports, 'target.json'), 'utf8'), 'keep');
    fs.writeFileSync(path.join(current, 'sitemap.xml'), sitemap(['new/']));
    assert.equal(run().status, 1);
    fs.writeFileSync(path.join(current, 'sitemap.xml'), sitemap(['old/', 'new/']));
    fs.unlinkSync(path.join(current, 'old/index.html'));
    assert.equal(run().status, 1);
});


test('URL preservation validates sitemap input and confined host resolution', t => {
    const ns = 'http://www.sitemaps.org/schemas/sitemap/0.9';
    const sitemap = url => `<s:urlset xmlns:s="${ns}"><s:url><s:loc> ${url} </s:loc></s:url></s:urlset>`;
    const previous = fixture(t, { 'sitemap.xml': sitemap(`${ORIGIN}/old/`) });
    const current = fixture(t, { 'sitemap.xml': sitemap(`${ORIGIN}/old/`), 'old/index.html': 'ok' });
    const run = () => spawnSync(process.execPath, [path.join(here, 'url-preservation.mjs'), '--previous', previous, '--current', current], { encoding: 'utf8' });
    const set = (site, content) => fs.writeFileSync(path.join(site, 'sitemap.xml'), content);
    for (const bad of ['not XML', `<urlset xmlns="${ns}"/>`, `<sitemapindex xmlns="${ns}"/>`, '<urlset><url></urlset>']) {
        set(previous, bad); assert.equal(run().status, 2, bad);
    }
    for (const bad of [`${ORIGIN}/%2e%2e%2foutside.html`, `${ORIGIN}/bad%ZZ`, 'https://example.com/']) {
        set(previous, sitemap(bad)); assert.equal(run().status, 2, bad);
    }
    set(previous, sitemap(`${ORIGIN}/old/`));
    fs.unlinkSync(path.join(current, 'old/index.html'));
    fs.writeFileSync(path.join(current, 'old/index.html.html'), 'wrong');
    assert.equal(run().status, 1);
    set(previous, sitemap(`${ORIGIN}/missing.html`)); set(current, sitemap(`${ORIGIN}/missing.html`));
    fs.writeFileSync(path.join(current, 'missing.html.html'), 'wrong'); assert.equal(run().status, 1);
    const outside = fixture(t, { 'outside.html': 'outside' });
    fs.symlinkSync(path.join(outside, 'outside.html'), path.join(current, 'escape.html'));
    set(previous, sitemap(`${ORIGIN}/escape.html`)); set(current, sitemap(`${ORIGIN}/escape.html`)); assert.equal(run().status, 1);
    fs.writeFileSync(path.join(current, 'café & tea.html'), 'ok');
    const encoded = `${ORIGIN}/caf%C3%A9%20%26%20tea.html?x=1&amp;y=&#50;`;
    set(previous, sitemap(encoded)); set(current, sitemap(encoded)); assert.equal(run().status, 0);
    fs.writeFileSync(path.join(current, 'old/index.html'), 'ok');
    set(previous, sitemap(`${ORIGIN}/old/`)); set(current, sitemap(`${ORIGIN}/old/`)); assert.equal(run().status, 0);
});
