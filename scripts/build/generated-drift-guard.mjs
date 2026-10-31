#!/usr/bin/env node
// generated-drift-guard.mjs - fail when a build changed committed artifacts.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'scripts', 'build', 'asset-manifest.json');

const GENERATED_EXACT = new Set([
    '404.html',
    'feed.xml',
    'assets/youtube-latest.json',
    'blog-module/blog/index.html',
    'blog-module/search-destinations.json',
    'scripts/author/research-catalog.json',
    'scripts/author/research-content/manifest.json',
    'blog-module/blog/template.html',
    'f1telemetry/index.html',
    'generate.html',
    'ghostcar/index.html',
    'tyres/index.html',
    'home.min.css',
    'housekeeping.html',
    'images/icons/sprite.svg',
    'index.html',
    'privacy/privacy.html',
    'privacy/terms.html',
    'scripts/build/asset-manifest.json',
    'standings/index.html',
    'standings/core/race-desk-links.generated.js',
    'styles.min.css',
    'styles/vendor/bootstrap.slim.css',
    'sw.js',
    'theme-overrides.min.css'
]);

function toPosix(relPath) {
    return relPath.split(path.sep).join('/');
}

function loadManifestFiles() {
    if (!fs.existsSync(MANIFEST_PATH)) return;
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    for (const info of Object.values(manifest.files || {})) {
        if (info?.min) GENERATED_EXACT.add(info.min);
    }
}

function isGeneratedPath(relPath) {
    if (GENERATED_EXACT.has(relPath)) return true;
    if (/^scripts\/author\/research-content\/\d{4}-(?:0[1-9]|1[0-2])\.json$/.test(relPath)) return true;
    if (/^blog-module\/blog-entries\/[^/]+\/article\.html$/i.test(relPath)) return true;
    if (/^blog-module\/blog\/(?:section|archive|entities)\/(?:[^/]+\/)*index\.html$/.test(relPath)) return true;
    return /\.min\.(?:css|js)$/i.test(relPath);
}

function parseStatus(output) {
    const entries = output.split('\0').filter(Boolean);
    const changed = [];

    for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i];
        const code = entry.slice(0, 2);
        const relPath = toPosix(entry.slice(3));
        if (isGeneratedPath(relPath)) changed.push({ code, relPath });

        if (code[0] === 'R' || code[0] === 'C') {
            i += 1;
        }
    }

    return changed;
}

function main() {
    loadManifestFiles();
    const directory = path.join(REPO_ROOT, 'scripts/author/research-content');
    const manifestFile = path.join(directory, 'manifest.json');
    if (fs.existsSync(manifestFile)) {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        const hash = data => createHash('sha256').update(data).digest('hex');
        if (manifest.version !== 1 || !Array.isArray(manifest.shards) || manifest.metadataSha256 !== hash(fs.readFileSync(path.join(REPO_ROOT, 'blog-module/blog-index-data.json')))) throw new Error('Invalid or stale research manifest');
        const names = new Set();
        for (const shard of manifest.shards) {
            if (!/^\d{4}-(?:0[1-9]|1[0-2])\.json$/.test(shard.file) || names.has(shard.file)) throw new Error('Invalid research shard name');
            names.add(shard.file);
            if (hash(fs.readFileSync(path.join(directory, shard.file))) !== shard.sha256) throw new Error('Research shard hash mismatch: ' + shard.file);
        }
        for (const name of fs.readdirSync(directory)) {
            if (/^\d{4}-(?:0[1-9]|1[0-2])\.json$/.test(name) && !names.has(name)) throw new Error('Unreferenced research shard: ' + name);
        }
    }
    const output = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], {
        cwd: REPO_ROOT,
        encoding: 'utf8'
    });
    const changed = parseStatus(output);

    if (!changed.length) {
        console.log('✓ generated artifacts synchronized');
        return;
    }

    console.error('✗ generated artifact drift detected after build.');
    console.error('  Run `npm run build:public`, review the changed generated files, and commit them.');
    changed.forEach(item => console.error(`  - ${item.code} ${item.relPath}`));
    process.exit(1);
}

main();
