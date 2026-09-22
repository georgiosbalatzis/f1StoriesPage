#!/usr/bin/env node
// check-generated-assets.mjs — verify the browser assets required by local preview exist.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');

const REQUIRED_ASSETS = [
    'styles.min.css',
    'home.min.css',
    'styles/editorial.min.css',
    'styles/shared-nav.min.css',
    'blog-module/blog-styles.min.css',
    'standings/standings.min.css',
    'styles/authors.min.css'
];

const missing = REQUIRED_ASSETS.filter(relPath => {
    const absPath = path.join(REPO_ROOT, relPath);
    return !fs.existsSync(absPath) || !fs.statSync(absPath).isFile();
});

if (missing.length) {
    console.error('Generated browser assets are missing:');
    missing.forEach(relPath => console.error(`- ${relPath}`));
    console.error('Run `npm run build:assets` before starting the local preview.');
    process.exit(1);
}

// Every <use href="#fa-*"> in a shell with an inlined sprite must resolve to a
// <symbol> in that same file; a stale sprite renders as an empty icon.
const SHELLS = [
    'index.html', 'offline.html', '404.html', 'authors/index.html', 'standings/index.html',
    'blog-module/blog/index.html', 'blog-module/blog/template.html', 'privacy/privacy.html',
    'privacy/terms.html', 'generate.html', 'housekeeping.html', 'statistics.html'
];
const unresolved = [];
for (const relPath of SHELLS) {
    const absPath = path.join(REPO_ROOT, relPath);
    if (!fs.existsSync(absPath)) continue;
    const html = fs.readFileSync(absPath, 'utf8');
    if (!html.includes('f1s:icon-sprite:begin')) continue;
    const symbols = new Set([...html.matchAll(/<symbol\s+id="(fa-[a-z0-9-]+)"/g)].map(m => m[1]));
    const used = new Set([...html.matchAll(/<use\s+href="#(fa-[a-z0-9-]+)"/g)].map(m => m[1]));
    for (const id of used) if (!symbols.has(id)) unresolved.push(`${relPath}: #${id}`);
}

if (unresolved.length) {
    console.error('Icon references without an inlined <symbol>:');
    unresolved.forEach(item => console.error(`- ${item}`));
    console.error('Run `npm run build:assets` to rebuild and re-inline the sprite.');
    process.exit(1);
}

console.log(`Generated asset check passed (${REQUIRED_ASSETS.length} required files, sprite references resolved).`);
