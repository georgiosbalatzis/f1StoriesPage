import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8');
const pages = read('.github/workflows/deploy-pages.yml');
const maintenance = read('.github/workflows/publish-blog.yml');
const preparation = read('.github/actions/build-pages/action.yml');
const setup = read('.github/actions/setup/action.yml');
const job = (workflow, name) => workflow.split(`\n  ${name}:\n`)[1].split(/\n  [a-z_]+:\n/)[0];

test('latest main always deploys: one queued Pages group, fresh main builds, no prebuilt hand-off', () => {
    // cancel-in-progress let a run that arrived late with an older prebuilt artifact cancel a newer build (2026-11-02).
    assert.match(pages, /\nconcurrency:\n  group: pages\n  cancel-in-progress: false\n/);
    assert.doesNotMatch(pages, /^    concurrency:/m);
    assert.match(job(pages, 'build'), /- name: Checkout main\n.*\n        with:\n          ref: main\n/);
    // Every Pages artifact is built inside Deploy Pages, from main as it is when the build starts.
    for (const text of [pages, maintenance, read('.github/workflows/auto-merge-dependencies.yml'), read('.github/workflows/auto-publish-author-pr.yml')]) {
        assert.doesNotMatch(text, /artifact_ready|dependency_hash/);
    }
    assert.doesNotMatch(maintenance, /uses: \.\/\.github\/actions\/build-pages/);
    assert.doesNotMatch(job(maintenance, 'publish_blog'), /pages: (read|write)|id-token:/);
    assert.match(job(pages, 'build'), /uses: \.\/\.github\/actions\/build-pages/);
    assert.doesNotMatch(preparation, /actions\/checkout|actions\/setup-node|inputs\./);
});

test('article generation runs straight from a plain checkout, with unchanged triggers and privileges', () => {
    const publisher = job(maintenance, 'publish_blog');
    // Skip decisions compare content digests (blog-module/build/input-digest.js), so no step restores file times.
    assert.equal(/mtime|touch -m|utimes/i.test(maintenance), false, 'no step restores file times');
    const steps = publisher.split('\n    steps:\n')[1];
    assert.match(steps, /^      - name: Checkout main\n.*\n        with:\n          ref: main\n          fetch-depth: 0\n          persist-credentials: false\n\n      - uses: \.\/\.github\/actions\/setup\n\n      - name: Run blog processor\n        run: node blog-module\/blog-processor\.js\n/);
    assert.match(maintenance, /\non:\n  schedule:\n[\s\S]*\n  push:\n    branches: \[main\]\n  workflow_call:\n[\s\S]*\n  workflow_dispatch:\n/);
    assert.match(maintenance, /\npermissions: \{\}\n/);
    assert.match(publisher, /^    needs: changes\n    permissions:\n      contents: write\n    if: >-\n/m);
    assert.match(publisher, /\n    concurrency:\n      group: content-publishing\n      queue: max\n/);
    assert.equal((maintenance.match(/contents: write/g) || []).length, 2, 'publish_blog and publish_data only');
});

test('scheduled runs build only when enabled; failed, cancelled or skipped builds cannot deploy', () => {
    const buildExpression = job(pages, 'build').match(/if: \$\{\{(.*?)\}\}/)[1];
    const deployExpression = job(pages, 'deploy').match(/if: \$\{\{(.*?)\}\}/)[1];
    const build = new Function('github', 'needs', 'cancelled', `return (${buildExpression});`);
    const deploy = new Function('needs', 'cancelled', `return (${deployExpression});`);
    const event = (name, enabled) => [{ event_name: name }, { gate: { outputs: enabled === undefined ? {} : { enabled } } }, () => false];
    for (const name of ['workflow_dispatch', 'workflow_call']) assert.equal(build(...event(name)), true);
    assert.equal(build({ event_name: 'workflow_dispatch' }, { gate: { outputs: {} } }, () => true), false);
    // Scheduled refreshes build only once the aggregate is enabled in the source lock.
    for (const enabled of ['true', 'false', '']) assert.equal(build(...event('schedule', enabled)), enabled === 'true');
    for (const result of ['success', 'skipped', 'failure', 'cancelled']) {
        assert.equal(deploy({ build: { result } }, () => false), result === 'success');
        assert.equal(deploy({ build: { result } }, () => true), false);
    }
});

test('both preparation modes retain validation and upload only validated dist', () => {
    assert.match(job(pages, 'build'), /uses: \.\/\.github\/actions\/build-pages/);
    assert.match(preparation, /- name: Reuse optimized article images\n\s+uses: actions\/cache@/);
    assert.ok(preparation.indexOf('name: Reuse optimized article images') < preparation.indexOf('name: Build pinned aggregate artifact'));
    assert.match(preparation, /run: npm run build:public/);
    assert.match(preparation, /run: npm run quality:static/);
    assert.match(preparation, /run: npm run audit:runtime/);
    assert.match(preparation, /run: npm run test:integration -- --site dist/);
    assert.match(preparation, /path: dist/);
    assert.ok(preparation.indexOf('run: npm run audit:runtime') < preparation.indexOf('name: Upload Pages artifact'));
    assert.ok(preparation.indexOf('run: npm run test:integration') < preparation.indexOf('name: Upload Pages artifact'));
});
