import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { inventory, assemble, prepareMain, validateSite } from './assemble.mjs';

function fixture(t, entries) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-path-test-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const [name, data] of Object.entries(entries)) {
        fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
        fs.writeFileSync(path.join(root, name), data);
    }
    return root;
}

for (const duplicate of ['canonical', 'OG URL']) test(`duplicate ${duplicate} metadata prevents release`, t => {
    const canonical = '<link rel="canonical" href="https://f1stories.gr/telemetry/">';
    const og = '<meta property="og:url" content="https://f1stories.gr/telemetry/">';
    const root = fixture(t, {
        'index.html': 'Main', '404.html': 'Missing', 'standings/index.html': 'Grid',
        'robots.txt': 'User-agent: *\nAllow: /',
        'sitemap.xml': '<urlset><url><loc>https://f1stories.gr/telemetry/</loc></url></urlset>',
        'telemetry/index.html': canonical + og + (duplicate === 'canonical' ? canonical : og),
    });
    assert.throws(() => validateSite(root, [{ application: 'telemetry', path: '/telemetry/' }]), /must have exactly one/);
});

test('duplicate output paths fail before any artifact is copied', t => {
    const main = fixture(t, { 'telemetry/index.html': 'Main' });
    const child = fixture(t, { 'index.html': 'child' });
    const destination = fixture(t, {});
    const reports = fixture(t, {});
    assert.throws(() => assemble([{ application: 'main', path: '/', directory: main }, { application: 'telemetry', path: '/telemetry/', directory: child }], destination, {}, reports), /Output collisions/);
    assert.deepEqual(fs.readdirSync(destination), []);
    assert.equal(JSON.parse(fs.readFileSync(path.join(reports, 'collision-report.json'))).collisions.length, 1);
});

test('parent-file and child-directory conflicts are detected', t => {
    const main = fixture(t, { telemetry: 'file' });
    const child = fixture(t, { 'index.html': 'app' });
    assert.equal(inventory([{ application: 'main', path: '/', directory: main }, { application: 'telemetry', path: '/telemetry/', directory: child }]).collisions.length, 1);
});

test('identical filenames in separate product namespaces do not collide', t => {
    const root = fixture(t, { 'index.html': 'app', 'assets/app.js': 'script' });
    const report = inventory(['telemetry', 'ghostcar', 'betcast'].map(application => ({ application, path: `/${application}/`, directory: root })));
    assert.equal(report.collisions.length, 0);
    assert.equal(report.entries.length, 6);
});

test('unreviewed Main content cannot be silently replaced by Ghost Car', t => {
    const root = fixture(t, { 'ghostcar/index.html': 'real content' });
    assert.throws(() => prepareMain(root), /not the audited legacy redirect/);
    assert.equal(fs.readFileSync(path.join(root, 'ghostcar/index.html'), 'utf8'), 'real content');
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
    const root = fixture(t, { 'telemetry/unexpected.txt': 'Main' });
    const destination = fixture(t, {});
    const reports = fixture(t, {});
    assert.throws(() => assemble([{ application: 'main', path: '/', directory: root }], destination, {}, reports), /Main writes into child namespace/);
    assert.deepEqual(fs.readdirSync(destination), []);
});
