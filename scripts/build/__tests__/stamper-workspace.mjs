// A scratch repository holding just what the real stamp-html.mjs needs, so tests can run the stamper on synthetic pages.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

export function stamperWorkspace(t, prefix = 'f1s-stamper-') {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const copy = rel => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.copyFileSync(path.join(ROOT, rel), path.join(root, rel));
    };
    for (const rel of ['stamp-html.mjs', 'article-editorial.mjs', 'article-scope.mjs', 'remove-retired-comments.mjs', 'asset-manifest.json']) copy(`scripts/build/${rel}`);
    for (const rel of ['hub-files.mjs', 'hub-model.mjs', 'hub-publication.mjs', 'core/index.mjs', 'core/navigation.mjs', 'core/links.mjs']) copy(`scripts/race-desk/${rel}`);
    copy('scripts/deployment/release.mjs');
    copy('data/race-desk/registry.v1.json');
    copy('data/race-desk/hub-evidence.v1.json');
    copy('blog-module/build/youtube-facade.js');
    copy('images/icons/sprite.svg');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts/build/asset-manifest.json')));
    for (const info of Object.values(manifest.files)) if (info.min) copy(info.min);
    const stamp = () => {
        const result = spawnSync(process.execPath, ['scripts/build/stamp-html.mjs'], { cwd: root, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
    };
    return { root, manifest, stamp };
}
