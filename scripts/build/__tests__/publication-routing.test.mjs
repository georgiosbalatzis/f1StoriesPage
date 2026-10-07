import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const maintenance = fs.readFileSync(new URL('../../../.github/workflows/publish-blog.yml', import.meta.url), 'utf8');
const pages = fs.readFileSync(new URL('../../../.github/workflows/deploy-pages.yml', import.meta.url), 'utf8');
const job = name => maintenance.split(`\n  ${name}:\n`)[1].split(/\n  [a-z_]+:\n/)[0];
const routeScript = job('changes').split('        run: |\n')[1].split('\n').map(line => line.slice(10)).join('\n');

test('main pushes have a single deployment owner', () => {
    assert.doesNotMatch(pages, /^  push:/m);
    assert.match(maintenance, /^  push:\n    branches: \[main\]/m);
    assert.equal((maintenance.match(/uses: \.\/\.github\/workflows\/deploy-pages.yml/g) || []).length, 1);
});

test('push routing detects mixed changes, deletions and renames without overlooking large pushes', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-publish-routing-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const bin = path.join(root, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'gh'), '#!/bin/sh\nif [ "$API_FAILURE" = true ]; then exit 1; fi\ncat "$COMPARISON_FILE"\n', { mode: 0o755 });
    const comparison = path.join(root, 'fixture.json');
    const output = path.join(root, 'output');
    const cases = [
        { files: [{ filename: 'styles.css' }], blog: false },
        { files: [{ filename: 'blog-module/blog-entries/entry/source.txt' }], blog: true },
        { files: [{ filename: 'styles.css' }, { filename: 'blog-module/blog/template.html' }], blog: true },
        { files: [{ filename: 'blog-module/blog-entries/deleted/article.html', status: 'removed' }], blog: true },
        { files: [{ filename: 'archive/source.txt', previous_filename: 'blog-module/blog-entries/moved/source.txt' }], blog: true },
        { files: [{ filename: 'blog-module/blog-processor.js' }], blog: true },
        // The generator itself decides article order and markup, so changing it must regenerate; its tests need not.
        { files: [{ filename: 'blog-module/build/index.js' }], blog: true },
        { files: [{ filename: 'blog-module/build/publish-order.js' }], blog: true },
        { files: [{ filename: 'blog-module/build/__tests__/publish-order.test.js' }], blog: false },
        // The category vocabulary shapes every card, filter and article masthead.
        { files: [{ filename: 'blog-module/taxonomy.js' }], blog: true },
        { files: [{ filename: 'blog-module/taxonomy.min.js' }], blog: false },
        { files: [{ filename: '.github/workflows/publish-blog.yml' }], blog: true },
        { files: Array.from({ length: 300 }, (_, i) => ({ filename: `docs/${i}.md` })), blog: true },
        { files: [], apiFailure: true, blog: true },
        { files: [], before: '0'.repeat(40), blog: true }
    ];
    for (const c of cases) {
        fs.writeFileSync(comparison, JSON.stringify({ files: c.files }));
        fs.writeFileSync(output, '');
        const result = spawnSync('bash', ['-c', routeScript], {
            cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`,
                REPO: 'example/site', BEFORE: c.before || '1'.repeat(40), AFTER: '2'.repeat(40),
                COMPARISON_FILE: comparison, GITHUB_OUTPUT: output, API_FAILURE: String(Boolean(c.apiFailure)) }
        });
        assert.equal(result.status, 0, result.stderr);
        assert.equal(fs.readFileSync(output, 'utf8').trim(), `blog=${c.blog}`);
    }
});

// These workflow conditions use the same boolean/string operators as JavaScript.
function condition(name, github, needs, inputs = {}, cancelled = false) {
    const expression = job(name).match(/if: >-\n\s+\$\{\{([\s\S]*?)\}\}/)[1];
    return new Function('github', 'needs', 'inputs', 'cancelled', `return (${expression});`)(
        github, needs, inputs, () => cancelled
    );
}

test('deployment waits for regeneration, survives skipped jobs and stops on push failures', () => {
    const needs = {
        changes: { result: 'success', outputs: { blog: 'true' } },
        publish_blog: { result: 'success', outputs: { changed: 'true' } },
        publish_data: { result: 'skipped', outputs: {} },
        refresh_youtube: { result: 'skipped', outputs: {} },
        refresh_standings_data: { result: 'skipped', outputs: {} }
    };
    assert.equal(condition('publish_blog', { event_name: 'push' }, needs), true);
    assert.equal(condition('deploy', { event_name: 'push' }, needs), true);
    needs.changes.outputs.blog = 'false';
    needs.publish_blog = { result: 'skipped', outputs: {} };
    assert.equal(condition('publish_blog', { event_name: 'push' }, needs), false);
    assert.equal(condition('deploy', { event_name: 'push' }, needs), true);
    needs.publish_blog = { result: 'success', outputs: { changed: 'false' } };
    assert.equal(condition('deploy', { event_name: 'push' }, needs), true);
    needs.publish_blog.result = 'failure';
    assert.equal(condition('deploy', { event_name: 'push' }, needs), false);
    // Artifact preparation can fail after the generated commit was pushed.
    needs.publish_blog.outputs.changed = 'true';
    assert.equal(condition('deploy', { event_name: 'push' }, needs), false);
    assert.equal(condition('deploy', { event_name: 'workflow_dispatch' }, needs), false);
    needs.publish_blog.result = 'skipped';
    needs.changes.result = 'failure';
    assert.equal(condition('deploy', { event_name: 'push' }, needs), false);
    needs.changes.result = 'success';
    assert.equal(condition('deploy', { event_name: 'push' }, needs, {}, true), false);
});

test('automatic, scheduled and manual publishers deploy only changed maintenance content', () => {
    const needs = {
        changes: { result: 'skipped', outputs: {} },
        publish_blog: { result: 'success', outputs: { changed: 'true' } },
        publish_data: { result: 'skipped', outputs: {} },
        refresh_youtube: { result: 'skipped', outputs: {} },
        refresh_standings_data: { result: 'skipped', outputs: {} }
    };
    for (const event_name of ['workflow_run', 'schedule', 'workflow_dispatch']) {
        assert.equal(condition('publish_blog', { event_name }, needs, { task: 'blog' }), true);
        assert.equal(condition('deploy', { event_name }, needs), true);
        needs.publish_blog.outputs.changed = 'false';
        assert.equal(condition('deploy', { event_name }, needs), false);
        needs.publish_blog.outputs.changed = 'true';
    }
    needs.publish_blog = { result: 'skipped', outputs: {} };
    assert.equal(condition('publish_blog', { event_name: 'schedule' }, needs), false);
    needs.publish_data = { result: 'success', outputs: { changed: 'true' } };
    assert.equal(condition('deploy', { event_name: 'schedule' }, needs), true);
    needs.publish_data.outputs.changed = 'false';
    assert.equal(condition('deploy', { event_name: 'schedule' }, needs), false);
    needs.publish_data.outputs.changed = 'true';
    assert.equal(condition('deploy', { event_name: 'workflow_dispatch' }, needs), true);
});

test('fetch jobs cannot deploy data before its publishing job has pushed it', () => {
    const needs = {
        changes: { result: 'skipped', outputs: {} },
        publish_blog: { result: 'skipped', outputs: {} },
        publish_data: { result: 'skipped', outputs: {} },
        refresh_youtube: { result: 'skipped', outputs: {} },
        refresh_standings_data: { result: 'success', outputs: { patch: 'true' } }
    };
    assert.equal(condition('publish_data', { event_name: 'schedule' }, needs), true);
    assert.equal(condition('deploy', { event_name: 'schedule' }, needs), false);
    needs.publish_data = { result: 'failure', outputs: {} };
    assert.equal(condition('deploy', { event_name: 'schedule' }, needs), false);
    needs.publish_data.outputs.changed = 'true';
    assert.equal(condition('deploy', { event_name: 'schedule' }, needs), false);
    needs.refresh_standings_data.result = 'failure';
    assert.equal(condition('publish_data', { event_name: 'schedule' }, needs), false);
    needs.refresh_standings_data = { result: 'success', outputs: { patch: 'false' } };
    assert.equal(condition('publish_data', { event_name: 'schedule' }, needs), false);
    needs.refresh_youtube = { result: 'success', outputs: { patch: 'true' } };
    assert.equal(condition('publish_data', { event_name: 'workflow_dispatch' }, needs), true);
    assert.equal(condition('publish_data', { event_name: 'workflow_dispatch' }, needs, {}, true), false);
});
