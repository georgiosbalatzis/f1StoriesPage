#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cacheRevision, precacheAssets } from './sw-manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const swPath = path.join(root, 'sw.js');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts/build/asset-manifest.json'), 'utf8'));
const revision = cacheRevision(manifest);
const required = ['/scripts/site-config.js', '/offline.html', '/', '/assets/youtube-latest.json', '/standings/standings-cache.json'];
const assets = precacheAssets(manifest, required);
const generated = `// f1s:precache:begin\nvar CACHE_REVISION = '${revision}';\nvar SHELL_ASSETS = ${JSON.stringify(assets, null, 2)};\n// f1s:precache:end`;
const source = fs.readFileSync(swPath, 'utf8');
const next = source
  .replace(/\/\*\s*=+\s*[\s\S]*?\*\/\s*\n/, '')
  .replace(/\/\/ f1s:precache:begin[\s\S]*?\/\/ f1s:precache:end/, generated)
  .replace(/var SHELL_ASSETS_LEGACY = \[[\s\S]*?\];\n/, '');
if (!source.includes('// f1s:precache:begin')) throw new Error('sw.js precache markers are missing');
fs.writeFileSync(swPath, next, 'utf8');
console.log(`Generated service-worker precache (${assets.length} assets, revision ${revision}).`);
