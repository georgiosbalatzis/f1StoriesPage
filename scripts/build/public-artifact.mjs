#!/usr/bin/env node
// public-artifact.mjs — build a clean GitHub Pages artifact in dist/.
//
// The repo root contains source files, notes, build scripts, and raw article
// assets. This script copies only files intended for public visitors.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const DIST_ROOT = path.join(REPO_ROOT, 'dist');

const ROOT_FILES = new Set([
    '.nojekyll',
    '404.html',
    'CNAME',
    'index.html',
    'manifest.json',
    'offline.html',
    'robots.txt',
    'sitemap.xml',
    'sw.js',
    'home.min.css',
    'styles.min.css',
    'theme-overrides.min.css'
]);

const BLOG_PUBLIC_FILES = new Set([
    'blog-module/blog/index.html',
    'blog-module/blog/article-script.min.js',
    'blog-module/blog/article-styles.min.css',
    'blog-module/blog-fixes.min.js',
    'blog-module/blog-index-data.json',
    'blog-module/blog-index-page-1.json',
    'blog-module/blog-index.min.js',
    'blog-module/blog-loader.min.js',
    'blog-module/blog-styles.min.css',
    'blog-module/home-latest.json',
    'blog-module/images/default-blog.jpg'
]);

const STANDINGS_ROOT_FILES = new Set([
    'standings/debrief-cache.json',
    'standings/destructors-cache.json',
    'standings/dirty-air-cache.json',
    'standings/index.html',
    'standings/standings-cache.json',
    'standings/standings.min.css',
    'standings/standings.min.js'
]);

function toPosix(relPath) {
    return relPath.split(path.sep).join('/');
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function walk(absDir, visitor) {
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') continue;
        const abs = path.join(absDir, entry.name);
        if (entry.isDirectory()) {
            walk(abs, visitor);
        } else if (entry.isFile()) {
            visitor(abs, toPosix(path.relative(REPO_ROOT, abs)));
        }
    }
}

function isOptimizedImage(relPath) {
    return /\.(?:avif|webp)$/i.test(relPath);
}

function shouldCopyBlogEntry(relPath) {
    if (!relPath.startsWith('blog-module/blog-entries/')) return false;
    const name = path.posix.basename(relPath);
    return name === 'article.html' || isOptimizedImage(relPath);
}

function shouldCopyStandings(relPath) {
    if (STANDINGS_ROOT_FILES.has(relPath)) return true;
    if (/^standings\/core\/[^/]+\.min\.js$/i.test(relPath)) return true;
    if (/^standings\/tabs\/[^/]+\.min\.(?:css|js)$/i.test(relPath)) return true;
    return false;
}

function shouldCopy(relPath) {
    if (relPath.includes('/.DS_Store') || relPath.endsWith('/.DS_Store')) return false;
    if (ROOT_FILES.has(relPath)) return true;
    if (BLOG_PUBLIC_FILES.has(relPath)) return true;
    if (shouldCopyBlogEntry(relPath)) return true;
    if (shouldCopyStandings(relPath)) return true;

    if (/^(?:ghostcar|f1telemetry|privacy)\//.test(relPath)) {
        return /\.html$/i.test(relPath);
    }

    if (relPath.startsWith('assets/')) {
        return /\.(?:json|woff2)$/i.test(relPath);
    }

    if (relPath.startsWith('images/')) {
        return /\.(?:avif|webp|png|jpe?g|svg)$/i.test(relPath);
    }

    if (relPath.startsWith('scripts/')) {
        return /\.min\.js$/i.test(relPath);
    }

    if (relPath.startsWith('styles/')) {
        return /\.min\.css$/i.test(relPath) || relPath === 'styles/legal.css';
    }

    return false;
}

function copyFile(relPath) {
    const src = path.join(REPO_ROOT, relPath);
    const dest = path.join(DIST_ROOT, relPath);
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
}

function main() {
    fs.rmSync(DIST_ROOT, { recursive: true, force: true });
    ensureDir(DIST_ROOT);

    const copied = [];
    walk(REPO_ROOT, function (_, relPath) {
        if (!shouldCopy(relPath)) return;
        copyFile(relPath);
        copied.push(relPath);
    });

    copied.sort();
    const bytes = copied.reduce((sum, relPath) => sum + fs.statSync(path.join(DIST_ROOT, relPath)).size, 0);
    console.log(`✓ public artifact: ${copied.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MB → dist/`);
}

main();
