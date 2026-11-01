import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-size-budget-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const write = (file, value) => {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), value);
    };
    for (const dir of ['standings/tabs', 'standings/chunks']) fs.mkdirSync(path.join(root, dir), { recursive: true });
    write('scripts/perf/size-guard.mjs', fs.readFileSync(new URL('../size-guard.mjs', import.meta.url)));
    write('blog-module/search-destinations.json', '{}');
    write('blog-module/search-destinations.min.js', '');
    write('perf/size-budget.json', JSON.stringify({ thresholdPercent: 10, files: {
        'scripts/shared-nav.js': 100, 'standings/standings.min.js': 48 * 1024
    } }));
    return { root, write, run: (...args) => spawnSync(process.execPath, ['scripts/perf/size-guard.mjs', ...args], { cwd: root, encoding: 'utf8' }) };
}

test('the per-file budget still rejects growth above ten percent', t => {
    const { write, run } = fixture(t);
    write('scripts/shared-nav.js', 'x'.repeat(110));
    assert.equal(run().status, 0);
    write('scripts/shared-nav.js', 'x'.repeat(111));
    const result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /exceeded the \+10% budget/);
});

test('destination files have independent hard caps without changing existing tolerance', t => {
    const { write, run } = fixture(t);
    write('blog-module/search-destinations.json', 'x'.repeat(4097));
    assert.match(run().stderr, /destination search exceeds/);
    write('blog-module/search-destinations.json', '{}');
    write('blog-module/search-destinations.min.js', 'x'.repeat(5633));
    assert.match(run().stderr, /destination search exceeds/);
    write('blog-module/search-destinations.json', 'x'.repeat(3000));
    write('blog-module/search-destinations.min.js', 'x'.repeat(5000));
    assert.match(run().stderr, /destination search exceeds/);
    write('blog-module/search-destinations.json', 'x'.repeat(1000));
    write('blog-module/search-destinations.min.js', 'x'.repeat(4500));
    write('blog-module/blog/archive-editorial.min.css', 'x'.repeat(23830));
    assert.match(run().stderr, /destination search exceeds/, 'initial archive styling cannot bypass the combined cap');
});

test('the measured standings shell ceiling is enforced independently of per-file tolerance', t => {
    const { write, run } = fixture(t);
    write('standings/standings.min.js', 'x'.repeat(48 * 1024));
    assert.equal(run().status, 0);
    write('standings/standings.min.js', 'x'.repeat(48 * 1024 + 1));
    const result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /standings bundle budget exceeded/);
});

test('shared imports cannot hide an initial graph over the unchanged 68 KiB ceiling', t => {
    const { write, run } = fixture(t);
    const imports = 'import "./chunks/a.min.js";import "./chunks/b.min.js";';
    write('standings/standings.min.js', imports.padEnd(48 * 1024, ' '));
    for (const name of ['a', 'b']) write(`standings/chunks/${name}.min.js`, 'x'.repeat(11 * 1024));
    const result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /standings initial graph/);
});

test('the optional navigation entry obeys the existing lazy entry cap', t => {
    const { write, run } = fixture(t);
    write('standings/standings.min.js', 'x');
    write('standings/race-desk-navigation.min.js', 'x'.repeat(34 * 1024));
    assert.equal(run().status, 0);
    write('standings/race-desk-navigation.min.js', 'x'.repeat(34 * 1024 + 1));
    const result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /standings\/race-desk-navigation\.min\.js/);
});

test('the optional navigation entry cannot evade the combined lazy total', t => {
    const { write, run } = fixture(t);
    write('standings/standings.min.js', 'x');
    for (let index = 0; index < 5; index++) write(`standings/tabs/test-${index}.min.js`, 'x'.repeat(32 * 1024));
    write('standings/race-desk-navigation.min.js', 'x'.repeat(30 * 1024));
    assert.equal(run().status, 0);
    write('standings/race-desk-navigation.min.js', 'x'.repeat(30 * 1024 + 1));
    const result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /standings lazy total/);
});

const RELATED = 'blog-module/build/related.js', SCORE = 'blog-module/build/related-score.js', GROUP = 'NEXT UP (related.js + related-score.js)';
const withGroup = (write, group, files = {}) => write('perf/size-budget.json', JSON.stringify({ thresholdPercent: 10,
    files: { 'scripts/shared-nav.js': 100, [RELATED]: 1000, [SCORE]: 1000, ...files }, ...(group == null ? {} : { groups: { [GROUP]: group } }) }));

test('code moved between the NEXT UP files stays inside one combined budget', t => {
    const { write, run } = fixture(t);
    withGroup(write, 1000, { [RELATED]: 1000, [SCORE]: 1000 });
    write(RELATED, 'x'.repeat(500));
    write(SCORE, 'x'.repeat(600));
    assert.equal(run().status, 0, 'each file and the group within +10%');
    write(RELATED, 'x'.repeat(600));
    const result = run();
    assert.equal(result.status, 1, 'each file is within its own budget, the pair is not');
    assert.match(result.stdout, /NEXT UP \(related\.js \+ related-score\.js\).*OVER/);
});

test('a NEXT UP group without a reviewed baseline fails; missing files are reported, not failed', t => {
    const { write, run } = fixture(t);
    withGroup(write, null);
    assert.equal(run().status, 0, 'neither file exists here');
    write(RELATED, 'x');
    const result = run();
    assert.equal(result.status, 1);
    assert.match(result.stdout, /NO BUDGET/);
});

test('--update records the group with the files', t => {
    const { root, write, run } = fixture(t);
    write(RELATED, 'x'.repeat(30));
    write(SCORE, 'x'.repeat(12));
    assert.equal(run('--update').status, 0);
    const budget = JSON.parse(fs.readFileSync(path.join(root, 'perf/size-budget.json'), 'utf8'));
    assert.deepEqual([budget.files[RELATED], budget.files[SCORE], budget.groups[GROUP]], [30, 12, 42]);
    assert.equal(run().status, 0);
});
