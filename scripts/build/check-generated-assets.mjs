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

console.log(`Generated asset check passed (${REQUIRED_ASSETS.length} required files).`);
