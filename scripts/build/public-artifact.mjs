#!/usr/bin/env node
// public-artifact.mjs — build a clean GitHub Pages artifact in dist/.
//
// The repo root contains source files, notes, build scripts, and raw article
// assets. This script copies only files intended for public visitors.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { securityHeadersText, securityMetaHtml } from './security-policy.mjs';
import siteConfig from '../../config/site-config.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const DIST_ROOT = path.join(REPO_ROOT, 'dist');
const PUBLIC_LOGO_IMAGE = 'images/icons/icon-512.png';
const PUBLIC_IMAGE_MAX_BYTES = Number(process.env.PUBLIC_IMAGE_MAX_BYTES || 300 * 1024);
const PUBLIC_ARTICLE_IMAGE_MAX_WIDTH = Number(process.env.PUBLIC_ARTICLE_IMAGE_MAX_WIDTH || 1600);
const PUBLIC_IMAGE_QUALITY = {
    avif: [52, 48, 44, 40, 36, 32, 28, 24, 20],
    webp: [82, 78, 74, 70, 66, 62, 58, 54, 50, 46, 42, 38, 34, 30, 26]
};

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
    'blog-module/blog/article-comments.min.js',
    'blog-module/blog/article-rail.min.css',
    'blog-module/blog/article-rail.min.js',
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
    'standings/standings-polish.min.css',
    'standings/standings-polish.min.js',
    'standings/standings.min.js'
]);

const PAGE_OUTPUT_ROOT = path.join(REPO_ROOT, '.build', 'pages');
const PAGE_SHELL_FILES = new Set([
    ...siteConfig.artifact.owners.shell,
    'blog-module/blog/index.html',
    'standings/index.html'
]);

const HERO_BACKGROUND_FILES = new Set([
    'images/bg/bg1.avif',
    'images/bg/bg1.webp',
    'images/bg/bg1-mobile.avif',
    'images/bg/bg1-mobile.webp',
    'images/bg/bg2.avif',
    'images/bg/bg2.webp',
    'images/bg/bg2-mobile.avif',
    'images/bg/bg2-mobile.webp',
    'images/bg/bg3.avif',
    'images/bg/bg3.webp',
    'images/bg/bg3-mobile.avif',
    'images/bg/bg3-mobile.webp',
    'images/bg/bg4.avif',
    'images/bg/bg4.webp',
    'images/bg/bg4-mobile.avif',
    'images/bg/bg4-mobile.webp',
    'images/bg/bg5.avif',
    'images/bg/bg5.webp',
    'images/bg/bg5-mobile.avif',
    'images/bg/bg5-mobile.webp'
]);

const BLOG_ENTRY_PUBLIC_REFS = collectBlogEntryPublicRefs();
const PUBLIC_IMAGE_REFS = collectPublicImageRefs();

function sourcePathFor(relPath) {
    return PAGE_SHELL_FILES.has(relPath)
        ? path.join(PAGE_OUTPUT_ROOT, relPath)
        : path.join(REPO_ROOT, relPath);
}

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

function isPublicArticleImage(relPath) {
    return /^blog-module\/blog-entries\/[^/]+\/[^/]+\.(?:avif|webp)$/i.test(relPath);
}

function cleanPublicRef(ref) {
    let clean = String(ref || '').split('#')[0].split('?')[0].trim();
    if (!clean || clean.startsWith('#')) return '';
    if (/^(?:mailto|tel|javascript|data):/i.test(clean)) return '';
    if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(clean)) {
        try {
            const url = new URL(clean);
            if (!/^(?:www\.)?f1stories\.gr$/i.test(url.hostname)) return '';
            clean = url.pathname || '';
        } catch (_) {
            return '';
        }
    }
    return clean;
}

function addBlogEntryRef(refs, ref, fromRelPath = '') {
    const clean = cleanPublicRef(ref);
    if (!clean) return;

    let relPath = '';
    if (clean.startsWith('/')) {
        relPath = clean.slice(1);
    } else if (fromRelPath) {
        relPath = path.posix.normalize(path.posix.join(path.posix.dirname(fromRelPath), clean));
    } else {
        relPath = path.posix.normalize(clean);
    }

    if (!/^blog-module\/blog-entries\/[^/]+\/[^/]+$/i.test(relPath)) return;
    refs.add(relPath);
}

function addPublicImageRef(refs, ref, fromRelPath = '') {
    const clean = cleanPublicRef(ref);
    if (!clean) return;

    const relPath = clean.startsWith('/')
        ? clean.slice(1)
        : fromRelPath
            ? path.posix.normalize(path.posix.join(path.posix.dirname(fromRelPath), clean))
            : path.posix.normalize(clean);

    if (!/^images\/[^?#]+/i.test(relPath)) return;
    if (!/\.(?:avif|webp|png|jpe?g|svg)$/i.test(relPath)) return;
    refs.add(relPath);
}

function collectRefsFromJsonValue(refs, value) {
    if (typeof value === 'string') {
        addBlogEntryRef(refs, value);
        return;
    }
    if (Array.isArray(value)) {
        value.forEach(item => collectRefsFromJsonValue(refs, item));
        return;
    }
    if (value && typeof value === 'object') {
        Object.values(value).forEach(item => collectRefsFromJsonValue(refs, item));
    }
}

function collectHtmlRefs(refs, html, relPath) {
    const attrPattern = /\b(?:href|src|data-src|data-full-src|content)=["']([^"']+)["']/gi;
    for (const match of String(html || '').matchAll(attrPattern)) {
        addBlogEntryRef(refs, match[1], relPath);
    }

    const srcsetPattern = /\bsrcset=["']([^"']+)["']/gi;
    for (const match of String(html || '').matchAll(srcsetPattern)) {
        match[1].split(',').forEach(part => {
            addBlogEntryRef(refs, part.trim().split(/\s+/)[0], relPath);
        });
    }

    const publicPathPattern = /(?:https:\/\/f1stories\.gr)?\/blog-module\/blog-entries\/[^"'()\s<>]+/gi;
    for (const match of String(html || '').matchAll(publicPathPattern)) {
        addBlogEntryRef(refs, match[0], relPath);
    }
}

function collectPublicImageRefsFromText(refs, text, relPath) {
    const attrPattern = /\b(?:href|src|data-src|data-full-src|content)=["']([^"']+)["']/gi;
    for (const match of String(text || '').matchAll(attrPattern)) {
        addPublicImageRef(refs, match[1], relPath);
    }

    const srcsetPattern = /\bsrcset=["']([^"']+)["']/gi;
    for (const match of String(text || '').matchAll(srcsetPattern)) {
        match[1].split(',').forEach(part => {
            addPublicImageRef(refs, part.trim().split(/\s+/)[0], relPath);
        });
    }

    const cssUrlPattern = /url\((["']?)([^"')]+)\1\)/gi;
    for (const match of String(text || '').matchAll(cssUrlPattern)) {
        addPublicImageRef(refs, match[2], relPath);
    }

    const publicImagePattern = /(?:https:\/\/f1stories\.gr)?\/images\/[^"'()\s<>]+/gi;
    for (const match of String(text || '').matchAll(publicImagePattern)) {
        addPublicImageRef(refs, match[0], relPath);
    }
}

function collectBlogEntryPublicRefs() {
    const refs = new Set();
    const dataSources = [
        'blog-module/blog/index.html',
        'blog-module/blog-index-data.json',
        'blog-module/blog-index-page-1.json',
        'blog-module/home-latest.json'
    ];

    dataSources.forEach(relPath => {
        const abs = sourcePathFor(relPath);
        if (!fs.existsSync(abs)) return;
        if (/\.json$/i.test(relPath)) {
            collectRefsFromJsonValue(refs, JSON.parse(fs.readFileSync(abs, 'utf8')));
        } else {
            collectHtmlRefs(refs, fs.readFileSync(abs, 'utf8'), relPath);
        }
    });

    const entriesRoot = path.join(REPO_ROOT, 'blog-module/blog-entries');
    if (fs.existsSync(entriesRoot)) {
        for (const entry of fs.readdirSync(entriesRoot, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const relPath = `blog-module/blog-entries/${entry.name}/article.html`;
            const abs = path.join(REPO_ROOT, relPath);
            if (!fs.existsSync(abs)) continue;
            collectHtmlRefs(refs, fs.readFileSync(abs, 'utf8'), relPath);
        }
    }

    return refs;
}

function collectPublicImageRefs() {
    const refs = new Set();
    const sourceFiles = new Set([
        ...PAGE_SHELL_FILES,
        'manifest.json',
        'sw.js'
    ]);

    const entriesRoot = path.join(REPO_ROOT, 'blog-module/blog-entries');
    if (fs.existsSync(entriesRoot)) {
        for (const entry of fs.readdirSync(entriesRoot, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            sourceFiles.add(`blog-module/blog-entries/${entry.name}/article.html`);
        }
    }

    for (const relPath of sourceFiles) {
        const abs = sourcePathFor(relPath);
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
        collectPublicImageRefsFromText(refs, fs.readFileSync(abs, 'utf8'), relPath);
    }

    return refs;
}

function shouldCopyBlogEntry(relPath) {
    if (!relPath.startsWith('blog-module/blog-entries/')) return false;
    const name = path.posix.basename(relPath);
    if (name === 'article.html') return true;
    if (name === '1-card.webp') return true;
    return isOptimizedImage(relPath) && BLOG_ENTRY_PUBLIC_REFS.has(relPath);
}

function shouldCopyStandings(relPath) {
    if (STANDINGS_ROOT_FILES.has(relPath)) return true;
    if (/^standings\/core\/[^/]+\.min\.js$/i.test(relPath)) return true;
    if (/^standings\/tabs\/[^/]+\.min\.(?:css|js)$/i.test(relPath)) return true;
    return false;
}

function shouldCopyPublicImage(relPath) {
    if (!/\.(?:avif|webp|png|jpe?g|svg)$/i.test(relPath)) return false;
    if (PUBLIC_IMAGE_REFS.has(relPath)) return true;
    if (/^images\/drivers\/[^/]+\.webp$/i.test(relPath)) return true;
    if (/^images\/teams\/[^/]+\.webp$/i.test(relPath)) return true;
    return false;
}

function shouldCopy(relPath) {
    if (relPath.includes('/.DS_Store') || relPath.endsWith('/.DS_Store')) return false;
    if (relPath === 'images/logo.png') return false;
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

    if (relPath.startsWith('images/bg/')) {
        return HERO_BACKGROUND_FILES.has(relPath);
    }

    if (relPath.startsWith('images/')) {
        return shouldCopyPublicImage(relPath);
    }

    if (relPath.startsWith('scripts/')) {
        if (relPath === 'scripts/site-config.js') return true;
        return /\.min\.js$/i.test(relPath);
    }

    if (relPath.startsWith('styles/')) {
        return /\.min\.css$/i.test(relPath) || relPath === 'styles/legal.css';
    }

    return false;
}

function stripSecurityMeta(html) {
    return String(html)
        .replace(/^[ \t]*<!-- f1s:security-meta:begin -->[\s\S]*?<!-- f1s:security-meta:end -->[ \t]*\r?\n?/gim, '')
        .replace(/^[ \t]*<meta\b(?=[^>]*\bhttp-equiv=["']Content-Security-Policy["'])[^>]*>[ \t]*\r?\n?/gim, '')
        .replace(/^[ \t]*<meta\b(?=[^>]*\bname=["']referrer["'])[^>]*>[ \t]*\r?\n?/gim, '');
}

function injectSecurityMeta(html) {
    const nextHtml = stripSecurityMeta(html);
    const block = securityMetaHtml('    ');

    if (/<meta\s+charset=["'][^"']+["']>/i.test(nextHtml)) {
        return nextHtml.replace(/(<meta\s+charset=["'][^"']+["']>)/i, `$1\n${block}`);
    }

    return nextHtml.replace(/(<head\b[^>]*>\s*)/i, `$1\n${block}\n`);
}

function writeSecurityHeadersFile() {
    const relPath = '_headers';
    fs.writeFileSync(path.join(DIST_ROOT, relPath), securityHeadersText(), 'utf8');
    return relPath;
}

function rewritePublicLogoRefs(html) {
    const origin = siteConfig.site.origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return String(html || '').replace(new RegExp(`${origin}\\/images\\/logo\\.png`, 'g'), `${siteConfig.site.origin}/${PUBLIC_LOGO_IMAGE}`);
}

async function optimizePublicArticleImage(src, dest, relPath) {
    if (!isPublicArticleImage(relPath)) return null;

    const originalSize = fs.statSync(src).size;
    if (originalSize <= PUBLIC_IMAGE_MAX_BYTES) return null;

    const ext = path.extname(relPath).slice(1).toLowerCase();
    const qualities = PUBLIC_IMAGE_QUALITY[ext];
    if (!qualities) return null;

    let best = null;
    for (const quality of qualities) {
        const pipeline = sharp(src)
            .rotate()
            .resize({
                width: PUBLIC_ARTICLE_IMAGE_MAX_WIDTH,
                withoutEnlargement: true
            });

        const buffer = ext === 'avif'
            ? await pipeline.avif({ quality, effort: 6 }).toBuffer()
            : await pipeline.webp({ quality, effort: 6 }).toBuffer();

        if (!best || buffer.length < best.buffer.length) {
            best = { buffer, quality };
        }

        if (buffer.length <= PUBLIC_IMAGE_MAX_BYTES) {
            fs.writeFileSync(dest, buffer);
            return {
                relPath,
                originalSize,
                outputSize: buffer.length,
                quality,
                withinBudget: true
            };
        }
    }

    fs.writeFileSync(dest, best.buffer);
    return {
        relPath,
        originalSize,
        outputSize: best.buffer.length,
        quality: best.quality,
        withinBudget: best.buffer.length <= PUBLIC_IMAGE_MAX_BYTES
    };
}

async function copyFile(relPath) {
    const src = sourcePathFor(relPath);
    const dest = path.join(DIST_ROOT, relPath);
    ensureDir(path.dirname(dest));
    if (/\.html$/i.test(relPath)) {
        fs.writeFileSync(dest, injectSecurityMeta(rewritePublicLogoRefs(fs.readFileSync(src, 'utf8'))), 'utf8');
        return null;
    }
    const optimized = await optimizePublicArticleImage(src, dest, relPath);
    if (optimized) return optimized;
    fs.copyFileSync(src, dest);
    return null;
}

async function main() {
    fs.rmSync(DIST_ROOT, { recursive: true, force: true });
    ensureDir(DIST_ROOT);

    const copied = [];
    const optimizedImages = [];
    walk(REPO_ROOT, function (_, relPath) {
        if (!shouldCopy(relPath)) return;
        copied.push(relPath);
    });
    PAGE_SHELL_FILES.forEach(relPath => {
        if (copied.includes(relPath)) return;
        if (fs.existsSync(sourcePathFor(relPath))) copied.push(relPath);
    });
    for (const relPath of copied) {
        const optimized = await copyFile(relPath);
        if (optimized) optimizedImages.push(optimized);
    }

    const publicFiles = copied.concat(writeSecurityHeadersFile()).sort();
    const bytes = publicFiles.reduce((sum, relPath) => sum + fs.statSync(path.join(DIST_ROOT, relPath)).size, 0);
    const savings = optimizedImages.reduce((sum, image) => sum + image.originalSize - image.outputSize, 0);
    const suffix = optimizedImages.length
        ? `; optimized ${optimizedImages.length} article image(s), saved ${(savings / 1024 / 1024).toFixed(2)} MB`
        : '';
    console.log(`✓ public artifact: ${publicFiles.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MB → dist/${suffix}`);

    const misses = optimizedImages.filter(image => !image.withinBudget);
    if (misses.length) {
        console.warn(`⚠ ${misses.length} optimized article image(s) still exceed ${(PUBLIC_IMAGE_MAX_BYTES / 1024).toFixed(0)} KB`);
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
