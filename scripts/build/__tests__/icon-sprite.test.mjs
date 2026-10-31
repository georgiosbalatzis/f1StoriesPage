import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { JS_INPUTS, STANDINGS_TAB_ENTRIES } from '../asset-sources.mjs';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

test('production sprite keeps runtime dependencies, articles and templates; local evidence cannot change bytes', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-icon-sprite-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const write = (file, text) => {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), text);
    };
    for (const file of ['asset-sources.mjs', 'icon-sources.mjs', 'build-icon-sprite.mjs']) {
        write(`scripts/build/${file}`, fs.readFileSync(new URL(`../${file}`, import.meta.url)));
    }
    for (const file of ['hub-files.mjs', 'hub-model.mjs', 'core/index.mjs', 'core/navigation.mjs', 'core/links.mjs']) {
        write(`scripts/race-desk/${file}`, fs.readFileSync(path.join(ROOT, 'scripts/race-desk', file)));
    }
    write('scripts/deployment/release.mjs', fs.readFileSync(path.join(ROOT, 'scripts/deployment/release.mjs')));
    write('data/race-desk/registry.v1.json', JSON.stringify({ schemaVersion: 1, sources: [], races: [] }));
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(root, 'node_modules'), 'dir');
    for (const file of [...JS_INPUTS, 'standings/standings.js', 'standings/standings-polish.js',
        ...STANDINGS_TAB_ENTRIES.map(name => `standings/tabs/${name}.js`)]) write(file, '');
    write('index.html', '<use href="#fa-home"/>');
    write('blog-module/blog/template.html', '<use href="#fa-calendar"/>');
    write('blog-module/blog-entries/story/article.html', '<i class="fab fa-spotify"></i>');
    write('blog-module/blog/archive/2026/10/index.html', '<use href="#fa-folder"/>');
    write('styles.css', '/* fas fa-coffee */');
    write('scripts/shared-nav.js', 'import "./navigation.js";');
    write('scripts/navigation.js', 'export const icon = \'<use href="#fa-moon"/>\'; export const factoryIcon = "fa-bolt"; export const animation = "fa-spin";');
    write('standings/tabs/debrief.js', 'import("../core/lazy.js");');
    write('standings/core/lazy.js', 'export const icon = \'<use href="#fa-gauge-high"/>\';');
    const build = () => {
        const result = spawnSync(process.execPath, ['scripts/build/build-icon-sprite.mjs'], { cwd: root, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
        return fs.readFileSync(path.join(root, 'images/icons/sprite.svg'));
    };
    const before = build();
    assert.deepEqual([...before.toString().matchAll(/<symbol id="fa-([^"]+)"/g)].map(m => m[1]),
        ['bolt', 'calendar', 'coffee', 'folder', 'gauge-high', 'home', 'moon', 'spotify']);
    for (const file of ['audit/old-dist/index.html', 'audits/evidence.js', 'scratchpad/probe.html',
        'tmp/local.css', 'scripts/perf/probe.js', 'blog-module/build/__tests__/fixture.html',
        'blog-module/blog-entries/story/extracted/local.html', 'dist/index.html', 'unused.html',
        'scripts/unused-runtime.js', 'standings/core/__tests__/fixture.js', 'scripts/shared-nav.min.js']) {
        write(file, '<use href="#fa-car-burst"/><i class="fas fa-share-alt"></i>');
    }
    assert.deepEqual(build(), before, 'irrelevant files never enter icon discovery');
    assert.deepEqual(build(), before, 'a repeat build is byte-identical');
    write('scripts/navigation.js', 'export const icon = \'<use href="#fa-sun"/>\';');
    const changed = build().toString();
    assert.match(changed, /id="fa-sun"/);
    assert.doesNotMatch(changed, /id="fa-moon"/);
});
