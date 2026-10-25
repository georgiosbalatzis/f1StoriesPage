import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inventory, assemble, prepareMain, validateSite } from './assemble.mjs';
import { assertReleasable, buildMode, checkLock, checkScript, checkSource, nodeEnvironment } from './release.mjs';
import { extraNode } from './toolchain.mjs';
import { legacyStubs } from './redirects.mjs';

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
    'production source map': [{ betcast: { 'assets/app.js.map': '{}' } }, /source map/],
    'internal documentation': [{ ghostcar: { 'README.md': '# notes' } }, /Internal documentation/],
    'development credentials': [{ tyres: { '.env': 'TOKEN=x' } }, /Credential-like file/],
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
test('the dry run cannot publish, and the publisher never builds a rehearsal', () => {
    const dryRun = read('.github/workflows/aggregate-dry-run.yml');
    assert.doesNotMatch(dryRun, /uses:\s*actions\/(?:deploy-pages|upload-pages-artifact|configure-pages)|uses:\s*\.\/\.github\/(?:workflows\/deploy-pages|actions\/build-pages)|pages:\s*write|id-token|contents:\s*write/);
    assert.match(dryRun, /permissions:\n  contents: read\n/);
    assert.match(dryRun, /build:ecosystem -- --rehearsal --node-bin "\$F1S_NODE_BIN"/);
    assert.match(dryRun, /rehearsal: 'true'/);
    for (const publisher of ['.github/actions/build-pages/action.yml', '.github/workflows/deploy-pages.yml', '.github/workflows/publish-blog.yml']) {
        assert.doesNotMatch(read(publisher), /--rehearsal|--local|--allow-dirty|rehearsal: 'true'/, publisher);
    }
});

test('the dry run reports every endpoint the tools read at runtime, from the new origin', async () => {
    const { ENDPOINTS, readable } = await import('./live-read.mjs');
    assert.deepEqual(ENDPOINTS.map(([, , url]) => new URL(url).host), ['api.openf1.org', 'api.multiviewer.app', 'api.jolpi.ca', 'docs.google.com']);
    assert.equal(readable(200, '*'), true);
    assert.equal(readable(200, 'https://f1-stories.gr'), true);
    assert.equal(readable(200, 'https://f1stories.gr'), false);
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
