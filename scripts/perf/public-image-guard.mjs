#!/usr/bin/env node
// public-image-guard.mjs - report public images over 300 KB and fail
// first-load/card regressions.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const DIST_ROOT = path.join(REPO_ROOT, 'dist');
const MAX_BYTES = Number(process.env.PUBLIC_IMAGE_MAX_BYTES || 300 * 1024);

const CARD_ALLOWLIST = new Set([
    // Keep intentional large card thumbnails explicit.
]);

function toPosix(relPath) {
    return relPath.split(path.sep).join('/');
}

function fmtBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function walk(absDir, visitor) {
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
        const abs = path.join(absDir, entry.name);
        if (entry.isDirectory()) {
            walk(abs, visitor);
        } else if (entry.isFile()) {
            visitor(abs, toPosix(path.relative(DIST_ROOT, abs)));
        }
    }
}

function isImage(relPath) {
    return /\.(?:avif|webp|png|jpe?g|svg)$/i.test(relPath);
}

function isArticleImage(relPath) {
    return /^blog-module\/blog-entries\/[^/]+\/[^/]+\.(?:avif|webp|png|jpe?g)$/i.test(relPath);
}

function isArticleCardImage(relPath) {
    return /^blog-module\/blog-entries\/[^/]+\/[^/]+-card\.webp$/i.test(relPath);
}

function isRawArticleImage(relPath) {
    return /^blog-module\/blog-entries\/[^/]+\/[^/]+\.(?:png|jpe?g)$/i.test(relPath);
}

function classify(relPath) {
    if (isArticleCardImage(relPath)) return 'article-card';
    if (isArticleImage(relPath)) return 'article-body';
    if (/^images\/bg\//i.test(relPath)) return 'hero-background';
    return 'global';
}

function printTable(title, rows, limit = 120) {
    if (!rows.length) return;
    console.log(title);
    rows.slice(0, limit).forEach(row => {
        console.log(`  ${row.kind.padEnd(16)} ${fmtBytes(row.size).padStart(9)}  ${row.relPath}`);
    });
    if (rows.length > limit) {
        console.log(`  ... ${rows.length - limit} more`);
    }
}

function main() {
    if (!fs.existsSync(DIST_ROOT)) {
        console.error('dist/ does not exist. Run `npm run build:public` first.');
        process.exit(1);
    }

    const oversized = [];
    const errors = [];

    walk(DIST_ROOT, (abs, relPath) => {
        if (!isImage(relPath)) return;
        const size = fs.statSync(abs).size;
        const kind = classify(relPath);

        if (isRawArticleImage(relPath)) {
            errors.push(`${relPath}: raw article image is present in dist/`);
        }

        if (size > MAX_BYTES) {
            const row = { relPath, size, kind };
            oversized.push(row);
            if (kind === 'article-card' && !CARD_ALLOWLIST.has(relPath)) {
                errors.push(`${relPath}: card image ${fmtBytes(size)} exceeds ${fmtBytes(MAX_BYTES)}`);
            } else if (kind !== 'article-body') {
                errors.push(`${relPath}: ${kind} image ${fmtBytes(size)} exceeds ${fmtBytes(MAX_BYTES)}`);
            }
        }
    });

    oversized.sort((a, b) => b.size - a.size || a.relPath.localeCompare(b.relPath));
    printTable(`Public images over ${fmtBytes(MAX_BYTES)}:`, oversized);

    if (errors.length) {
        console.error('public image budget failed:');
        errors.slice(0, 80).forEach(error => console.error(`  - ${error}`));
        if (errors.length > 80) console.error(`  ... ${errors.length - 80} more`);
        process.exit(1);
    }

    const largeArticleImages = oversized.filter(row => row.kind === 'article-body').length;
    const suffix = largeArticleImages
        ? `; ${largeArticleImages} full article image(s) listed for editorial optimization`
        : '';
    console.log(`public image budget passed: no card/global image exceeds ${fmtBytes(MAX_BYTES)}${suffix}`);
}

main();
