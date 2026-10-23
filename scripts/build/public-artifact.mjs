#!/usr/bin/env node
// public-artifact.mjs — build a clean GitHub Pages artifact in dist/.
//
// The repo root contains source files, notes, build scripts, and raw article
// assets. This script copies only files intended for public visitors.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import hubs from '../../blog-module/build/entities/hubs.js';
import { cspProfileForPath, injectSecurityMeta, securityHeadersText } from './security-policy.mjs';
import { inlineHeadStylesheets } from './inline-head-css.mjs';
import { optimizePublicArticleImage } from './public-article-images.mjs';
import { preservedPublicMedia, assertPreservedPublicMedia, rewriteOptimizedImageWidths } from './public-media-integrity.mjs';
import { buildSocialCards } from './social-cards.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const DIST_ROOT = path.join(REPO_ROOT, 'dist');
const PUBLIC_LOGO_IMAGE = 'images/icons/icon-512.png';
const PUBLIC_IMAGE_MAX_BYTES = Number(process.env.PUBLIC_IMAGE_MAX_BYTES || 300 * 1024);

const ROOT_FILES = new Set([
    '.nojekyll',
    '404.html',
    'CNAME',
    'generate.html',
    'housekeeping.html',
    'index.html',
    'robots.txt',
    'sitemap.xml',
    'feed.xml',
    'sw.js',
    'home.min.css',
    'styles.min.css',
    'theme-overrides.min.css'
]);

const AUTHOR_TOOL_FILES = new Set([
    'scripts/author/research-catalog.json',
    // Retain the author portrait fallback after preview markup moves into the renderer.
    'images/authors/default.webp',
    // The article preview stylesheet of generate.html / housekeeping.html (no public page loads it).
    'blog-module/blog-styles.min.css',
    'node_modules/jszip/dist/jszip.min.js',
    'scripts/author/article-index.js',
    'scripts/author/article-source.js',
    'scripts/author/dialogs.js',
    'scripts/author/dom-tools.js',
    'scripts/author/generate-page.js',
    'scripts/author/github-client.js',
    'scripts/author/housekeeping-page.js',
    'scripts/author/image-tools.js',
    'scripts/author/session-token.js',
    'styles/author/generate.css',
    'styles/author/housekeeping.css'
]);

const BLOG_PUBLIC_FILES = new Set([
    'blog-module/blog/index.html',
    'blog-module/blog/archive-editorial.min.css',
    'blog-module/blog/article-editorial.min.css',
    'blog-module/blog/article-embeds.min.js',
    'blog-module/blog/article-script.min.js',
    'blog-module/blog/article-styles.min.css',
    'blog-module/blog-fixes.min.js',
    'blog-module/blog-index-data.json',
    'blog-module/search-destinations.json',
    'blog-module/search-destinations.min.js',
    'blog-module/blog-index.min.js',
    'blog-module/taxonomy.min.js',
    'blog-module/inline-markup.min.js',
    'blog-module/home-latest.json',
    'blog-module/images/default-blog.jpg'
]);

const AUTHORS_PUBLIC_FILES = new Set([
    'authors/index.html'
]);

const STANDINGS_ROOT_FILES = new Set([
    'standings/debrief-cache.json',
    'standings/index.html',
    'standings/standings-cache.json',
    'standings/standings.min.css',
    'standings/standings-editorial.min.css',
    'standings/standings-polish.min.css',
    'standings/standings-polish.min.js',
    'standings/standings.min.js'
]);

const ENTITY_PUBLIC_FILES = hubs.publicHubFiles();

const BLOG_ENTRY_PUBLIC_REFS = collectBlogEntryPublicRefs();
const PUBLIC_IMAGE_REFS = collectPublicImageRefs();
const SMALL_ORIGINALS = await collectSmallOriginals();

// Pages describe images at their measured widths, so a small original (no wider than its "800px" mobile copy, which
// is then the same picture at the same width) is named through the lighter copy only. Its own URL was published
// before and stays published: originals whose mobile copy is as wide as they are.
async function collectSmallOriginals() {
    const root = path.join(REPO_ROOT, 'blog-module/blog-entries');
    const found = new Set();
    await Promise.all(fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).flatMap(entry =>
        fs.readdirSync(path.join(root, entry.name)).map(name => /^(\d+)-mobile\.(webp|avif)$/.exec(name)).filter(Boolean).map(async ([, base, ext]) => {
            const dir = path.join(root, entry.name);
            if (!fs.existsSync(path.join(dir, `${base}.${ext}`))) return;
            const [original, mobile] = await Promise.all([`${base}.${ext}`, `${base}-mobile.${ext}`].map(name => sharp(path.join(dir, name)).metadata()));
            if (original.width <= mobile.width) found.add(`blog-module/blog-entries/${entry.name}/${base}.${ext}`);
        })));
    return found;
}

function toPosix(relPath) {
    return relPath.split(path.sep).join('/');
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function walk(absDir, visitor) {
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
        if (entry.name === '.git' || entry.name === '.build' || entry.name === 'node_modules' || entry.name === 'dist') continue;
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

function cleanPublicRef(ref) {
    let clean = String(ref || '').split('#')[0].split('?')[0].trim();
    if (!clean || clean.startsWith('#')) return '';
    if (/^(?:mailto|tel|javascript|data):/i.test(clean)) return '';
    if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(clean)) {
        try {
            const url = new URL(clean);
            if (!/^(?:www\.)?f1-stories\.gr$/i.test(url.hostname)) return '';
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

    if (!/^blog-module\/blog-entries\/[^/]+\/(?:[^/]+|embeds\/telemetry-[a-f\d]{20}-(?:narrowLight|wideLight|narrowDark|wideDark)\.svg|embeds\/telemetry-[a-f\d]{20}-data\.json)$/i.test(relPath)) return;
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
    const attrPattern = /\b(?:href|src|data-src|data-full-src|data-telemetry-data|content)=["']([^"']+)["']/gi;
    for (const match of String(html || '').matchAll(attrPattern)) {
        addBlogEntryRef(refs, match[1], relPath);
    }

    const srcsetPattern = /\bsrcset=["']([^"']+)["']/gi;
    for (const match of String(html || '').matchAll(srcsetPattern)) {
        match[1].split(',').forEach(part => {
            addBlogEntryRef(refs, part.trim().split(/\s+/)[0], relPath);
        });
    }

    const publicPathPattern = /(?:https:\/\/f1-stories\.gr)?\/blog-module\/blog-entries\/[^"'()\s<>]+/gi;
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

    const publicImagePattern = /(?:https:\/\/f1-stories\.gr)?\/images\/[^"'()\s<>]+/gi;
    for (const match of String(text || '').matchAll(publicImagePattern)) {
        addPublicImageRef(refs, match[0], relPath);
    }
}

function collectBlogEntryPublicRefs() {
    const refs = new Set();
    const dataSources = [
        // The homepage cover asks for full-size originals of its supporting photographs (P3A-R3).
        'index.html',
        'blog-module/blog/index.html',
        'blog-module/blog-index-data.json',
        'blog-module/home-latest.json'
    ];

    dataSources.forEach(relPath => {
        const abs = path.join(REPO_ROOT, relPath);
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
        ...ROOT_FILES,
        ...BLOG_PUBLIC_FILES,
        ...STANDINGS_ROOT_FILES
    ]);

    const entriesRoot = path.join(REPO_ROOT, 'blog-module/blog-entries');
    if (fs.existsSync(entriesRoot)) {
        for (const entry of fs.readdirSync(entriesRoot, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            sourceFiles.add(`blog-module/blog-entries/${entry.name}/article.html`);
        }
    }

    ['authors', 'ghostcar', 'f1telemetry', 'tyres', 'privacy'].forEach(dir => {
        const absDir = path.join(REPO_ROOT, dir);
        if (!fs.existsSync(absDir)) return;
        for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
            if (entry.isFile() && /\.html$/i.test(entry.name)) {
                sourceFiles.add(`${dir}/${entry.name}`);
            }
        }
    });

    for (const relPath of sourceFiles) {
        const abs = path.join(REPO_ROOT, relPath);
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
        collectPublicImageRefsFromText(refs, fs.readFileSync(abs, 'utf8'), relPath);
    }

    return refs;
}

// Posts whose card can be the archive or home lead (srcset includes 1600w).
const LEAD_CARD_REFS = (() => {
    try {
        const posts = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'blog-module/home-latest.json'), 'utf8'));
        return new Set(posts.map(post => String(post.thumbnail || '').replace(/^\//, '')).filter(ref => /-card\.webp$/.test(ref)));
    } catch (_) {
        return new Set();
    }
})();

function shouldCopyBlogEntry(relPath) {
    if (!relPath.startsWith('blog-module/blog-entries/')) return false;
    if (Object.hasOwn(preservedPublicMedia, relPath)) return true;
    if (/^blog-module\/blog-entries\/[^/]+\/embeds\/telemetry-[a-f\d]{20}-(?:narrowLight|wideLight|narrowDark|wideDark)\.svg$/i.test(relPath)) {
        return BLOG_ENTRY_PUBLIC_REFS.has(relPath);
    }
    if (/^blog-module\/blog-entries\/[^/]+\/embeds\/telemetry-[a-f\d]{20}-data\.json$/i.test(relPath)) {
        return BLOG_ENTRY_PUBLIC_REFS.has(relPath);
    }
    const name = path.posix.basename(relPath);
    if (name === 'article.html') return true;
    // Card srcsets advertise "<base>-mobile.webp 800w" (and "<base>.webp 1600w"
    // for lead cards); ship those siblings whenever their card ships.
    const sibling = /^(.+?)(-mobile)?\.webp$/.exec(name);
    if (sibling && !/-card$/.test(sibling[1])) {
        const cardRel = path.posix.join(path.posix.dirname(relPath), `${sibling[1]}-card.webp`);
        const cardShips = fs.existsSync(path.join(REPO_ROOT, cardRel)) && shouldCopyBlogEntry(cardRel);
        if (cardShips && (sibling[2] || LEAD_CARD_REFS.has(cardRel))) return true;
    }
    if (SMALL_ORIGINALS.has(relPath) && shouldCopyBlogEntry(relPath.replace(/\.(webp|avif)$/, '-mobile.$1'))) return true;
    // Compact archive cards advertise the smaller variant through their
    // thumbnail run map. Entries without that variant still need their first
    // source image available when the archive reconstructs the card. Article
    // pages may also use 1.webp as their hero, so retain explicitly referenced
    // originals even when a card variant exists.
    if (name === '1.webp') {
        return BLOG_ENTRY_PUBLIC_REFS.has(relPath)
            || !fs.existsSync(path.join(path.dirname(path.join(REPO_ROOT, relPath)), '1-card.webp'));
    }
    if (name === '1-card.webp') return true;
    return isOptimizedImage(relPath) && BLOG_ENTRY_PUBLIC_REFS.has(relPath);
}

function shouldCopyStandings(relPath) {
    if (STANDINGS_ROOT_FILES.has(relPath)) return true;
    if (/^standings\/tabs\/[^/]+\.min\.(?:css|js)$/i.test(relPath)) return true;
    if (/^standings\/chunks\/[^/]+\.min\.js$/i.test(relPath)) return true;
    // Dirty air ships as an index plus per-session files; the whole bundle stays source-only.
    if (/^standings\/dirty-air\/[^/]+\.json$/i.test(relPath)) return true;
    if (/^standings\/rounds\/\d{4}-\d{1,2}\.json$/.test(relPath)) return true;
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
    if (AUTHOR_TOOL_FILES.has(relPath)) return true;
    if (AUTHORS_PUBLIC_FILES.has(relPath)) return true;
    if (BLOG_PUBLIC_FILES.has(relPath)) return true;
    if (ENTITY_PUBLIC_FILES.has(relPath)) return true;
    // The Edition Index's static section and month pages (blog-module/build/discovery.js).
    if (/^blog-module\/blog\/(?:section|archive)\/(?:[^/]+\/)*index\.html$/.test(relPath)) return true;
    if (shouldCopyBlogEntry(relPath)) return true;
    if (shouldCopyStandings(relPath)) return true;

    if (/^(?:ghostcar|f1telemetry|tyres|privacy)\//.test(relPath)) {
        return /\.html$/i.test(relPath);
    }

    if (relPath.startsWith('assets/')) {
        if (relPath === 'assets/licenses/web-vitals-Apache-2.0.txt') return true;
        if (/^assets\/fonts\/licenses\/(?:barlowcondensed|gfsdidot|ibmplexsans)-OFL\.txt$/.test(relPath)) return true;
        return /\.(?:json|woff2)$/i.test(relPath);
    }

    if (relPath.startsWith('images/')) {
        return shouldCopyPublicImage(relPath);
    }

    if (relPath.startsWith('scripts/')) {
        return /\.min\.js$/i.test(relPath);
    }

    if (relPath.startsWith('styles/')) {
        return /\.min\.css$/i.test(relPath)
            || relPath === 'styles/legal.css'
            || relPath === 'styles/layers.css';
    }

    return false;
}

function writeSecurityHeadersFile() {
    const relPath = '_headers';
    fs.writeFileSync(path.join(DIST_ROOT, relPath), securityHeadersText(), 'utf8');
    return relPath;
}

function rewritePublicLogoRefs(html) {
    return String(html || '').replace(/https:\/\/f1-stories\.gr\/images\/logo\.png/g, `https://f1-stories.gr/${PUBLIC_LOGO_IMAGE}`);
}

async function copyFile(relPath) {
    const src = path.join(REPO_ROOT, relPath);
    const dest = path.join(DIST_ROOT, relPath);
    ensureDir(path.dirname(dest));
    if (/\.html$/i.test(relPath)) {
        // Each page gets the CSP of its profile (public or an author tool); public pages inline their head CSS.
        let html = rewritePublicLogoRefs(fs.readFileSync(src, 'utf8'));
        if (cspProfileForPath(relPath) === 'public') html = inlineHeadStylesheets(html, relPath, rel => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
        fs.writeFileSync(dest, injectSecurityMeta(html, relPath), 'utf8');
        return null;
    }
    const optimized = Object.hasOwn(preservedPublicMedia, relPath) ? null : await optimizePublicArticleImage(src, dest, relPath);
    if (optimized) return optimized;
    fs.copyFileSync(src, dest);
    return null;
}

async function main() {
    assertPreservedPublicMedia(REPO_ROOT);
    fs.rmSync(DIST_ROOT, { recursive: true, force: true });
    ensureDir(DIST_ROOT);

    const copied = [];
    const optimizedImages = [];
    walk(REPO_ROOT, function (_, relPath) {
        if (!shouldCopy(relPath)) return;
        copied.push(relPath);
    });
    AUTHOR_TOOL_FILES.forEach(relPath => {
        if (copied.includes(relPath)) return;
        if (fs.existsSync(path.join(REPO_ROOT, relPath))) copied.push(relPath);
    });

    for (const relPath of copied) {
        const optimized = await copyFile(relPath);
        if (optimized) optimizedImages.push(optimized);
    }

    const optimizedWidths = new Map(await Promise.all(optimizedImages.map(async image => {
        const meta = await sharp(path.join(DIST_ROOT, image.relPath)).metadata();
        return [image.relPath, meta.width];
    })));
    for (const relPath of copied.filter(file => /\.html$/i.test(file))) {
        const dest = path.join(DIST_ROOT, relPath);
        const html = fs.readFileSync(dest, 'utf8');
        const rewritten = rewriteOptimizedImageWidths(html, relPath, optimizedWidths);
        if (rewritten !== html) fs.writeFileSync(dest, rewritten);
    }
    assertPreservedPublicMedia(DIST_ROOT);

    const social = await buildSocialCards({ repoRoot: REPO_ROOT, distRoot: DIST_ROOT, htmlFiles: copied, maxBytes: PUBLIC_IMAGE_MAX_BYTES });
    const publicFiles = copied.concat(social.files, writeSecurityHeadersFile()).sort();
    console.log(`✓ social cards: ${social.files.length} JPEG files, ${social.records.filter(r => r.cacheHit).length} reused, ${social.records.filter(r => r.error).length} fallbacks, ${social.elapsedMs}ms`);
    const bytes = publicFiles.reduce((sum, relPath) => sum + fs.statSync(path.join(DIST_ROOT, relPath)).size, 0);
    const savings = optimizedImages.reduce((sum, image) => sum + image.originalSize - image.outputSize, 0);
    const reused = optimizedImages.filter(image => image.cacheHit).length;
    const suffix = optimizedImages.length
        ? `; optimized ${optimizedImages.length} article image(s) (${reused} reused, ${optimizedImages.length - reused} encoded), saved ${(savings / 1024 / 1024).toFixed(2)} MB`
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
