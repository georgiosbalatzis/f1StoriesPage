import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../perf/edition-qa.mjs', import.meta.url));

test('Edition QA fails actionably on missing built output even with --no-fail', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-edition-prereq-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const run = () => spawnSync(process.execPath, [script, `--root=${root}`, '--no-fail'], {
        encoding: 'utf8', env: { ...process.env, CHROME_PATH: path.join(root, 'missing-chrome') }, timeout: 10000
    });
    const missingBuild = run();
    assert.equal(missingBuild.status, 1, missingBuild.stderr);
    assert.match(missingBuild.stderr, /needs built static output.*npm run build:public/);
    for (const file of ['_headers', '404.html', 'sitemap.xml', 'blog-module/blog/index.html', 'blog-module/blog-index-data.json']) {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), '');
    }
    const missingChrome = run();
    assert.equal(missingChrome.status, 1, missingChrome.stderr);
    assert.match(missingChrome.stderr, /cannot launch Chrome.*CHROME_PATH.*shared-library dependencies/);
});
