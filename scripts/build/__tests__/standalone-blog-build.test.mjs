// `npm run build:blog` on its own leaves article pages in their committed (stamped) form, so entity evidence that is
// pinned to article.html line numbers stays valid across repeated standalone builds. The full two-build sequence runs
// in scripts/build/incremental-build-check.mjs (npm run test:incremental).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;

test('both blog-build scripts finish with the article stamping passes', () => {
    for (const name of ['build:blog', 'build:blog:force']) {
        assert.match(scripts[name], /^node blog-module\/build\/index\.js(?: --force)? && node scripts\/build\/stamp-html\.mjs --articles-only$/, name);
    }
});

test('article stamping is a no-op on built pages and leaves shell pages to build:assets', () => {
    if (!fs.existsSync(path.join(root, 'dist'))) return; // needs a built tree (CI runs build:public before test:build)
    const result = spawnSync(process.execPath, ['scripts/build/stamp-html.mjs', '--articles-only', '--dry'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /article\.html\s+→\s+[1-9]/, 'committed article pages are already in stamped form');
    assert.doesNotMatch(result.stdout, /^(?:index|blog-module\/blog\/index|standings\/index)\.html\s+→/m, 'no shell page is touched');
    assert.match(result.stdout, /0 rewrite\(s\), 0 critical op\(s\)/);
});
