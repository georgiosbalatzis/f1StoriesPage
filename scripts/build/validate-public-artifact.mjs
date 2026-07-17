#!/usr/bin/env node
// validate-public-artifact.mjs — fail if dist/ contains private/source clutter.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { CONTENT_SECURITY_POLICY, REFERRER_POLICY, securityHeadersText } from './security-policy.mjs';
import siteConfig from '../../config/site-config.mjs';
import { normalizeSiteUrl as normalizeReferenceUrl } from './reference-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const DIST_ROOT = path.join(REPO_ROOT, 'dist');
const SITE_ORIGIN = siteConfig.site.origin;
const MAX_FILE_BYTES = Number(process.env.PUBLIC_ARTIFACT_MAX_BYTES || 2 * 1024 * 1024);

const FORBIDDEN_EXACT = new Set([
    'appdev.txt',
    'laststeps.txt',
    'nextsteps.txt',
    'package-lock.json',
    'package.json',
    'README.md',
    'test.sql',
    'blog-module/blog/template.html',
    'blog-module/blog-data.json',
    'scripts/build/asset-manifest.json',
    'generate.html',
    'housekeeping.html',
    'statistics.html',
    'scripts/author'
]);

const REQUIRED_EXACT = [
    '.nojekyll',
    '_headers',
    '404.html',
    'CNAME',
    'index.html',
    'manifest.json',
    'offline.html',
    'robots.txt',
    'sitemap.xml',
    'sw.js',
    'assets/youtube-latest.json',
    'blog-module/blog-index-data.json',
    'blog-module/blog-index-page-1.json',
    'blog-module/home-latest.json',
    'blog-module/blog/index.html',
    'images/favicon.png',
    'images/icons/apple-touch-icon.png',
    'images/icons/favicon-16.png',
    'images/icons/favicon-32.png',
    'images/icons/icon-192.png',
    'images/icons/icon-512.png',
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
    'images/bg/bg5-mobile.webp',
    'standings/index.html',
    'standings/debrief-cache.json',
    'standings/destructors-cache.json',
    'standings/dirty-air-cache.json',
    'standings/standings-cache.json',
    'styles.min.css',
    'scripts/perf/error-beacon.min.js',
    'scripts/sw-register.min.js',
    'scripts/site-config.js'
];

for (const route of siteConfig.routes.public) {
    const rel = route.replace(/^\//, '').replace(/\/$/, '') || 'index.html';
    const candidate = rel.endsWith('.html') ? rel : `${rel}/index.html`;
    if (!REQUIRED_EXACT.includes(candidate)) REQUIRED_EXACT.push(candidate);
}

const SIZE_ALLOWLIST = new Set([
    // Keep intentional large files explicit if one is ever needed.
]);

function toPosix(relPath) {
    return relPath.split(path.sep).join('/');
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

function fmtBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function forbiddenReason(relPath) {
    const base = path.posix.basename(relPath);
    if (FORBIDDEN_EXACT.has(relPath) || FORBIDDEN_EXACT.has(base)) return 'internal file';
    if (/\.(?:bak|docx|map|odt)$/i.test(relPath)) return 'source/backup artifact';
    if (/\.sql$/i.test(relPath)) return 'database/source artifact';
    if (/\.txt$/i.test(relPath) && relPath !== 'robots.txt') return 'raw text artifact';
    if (/^blog-module\/blog-entries\/.*\/(?:source|gallery)\.txt$/i.test(relPath)) return 'raw article source';
    if (/^blog-module\/blog-entries\/.*\.(?:jpe?g|png)$/i.test(relPath)) return 'raw article image';
    if (/^scripts\/build\//.test(relPath)) return 'build script';
    if (/^scripts\/author\//.test(relPath)) return 'author tool';
    if (/^node_modules\//.test(relPath)) return 'dependency artifact';
    if (/^blog-module\/build\//.test(relPath)) return 'blog build script';
    if (/\.min\.(?:css|js)\.map$/i.test(relPath)) return 'source map';
    if (/^images\/bg\/bg(?:6|7|8|9)(?:-|\.|$)/i.test(relPath)) return 'unapproved hero background';
    if (/^images\/bg\/.*\.sh$/i.test(relPath)) return 'image build helper';
    if (/^images\/avatars\/(?:FA|FAAM|Poulikidis)\.webp$/i.test(relPath)) return 'unused home avatar';
    if (/^images\/authors\/(?:CSW|FAAM)\.webp$/i.test(relPath)) return 'unused author image';
    if (/^images\/icons\/.*\.webp$/i.test(relPath)) return 'unused icon variant';
    if (relPath === 'images/icons/sprite.svg') return 'build-only icon sprite';
    if (/^images\/sponsors\/.*\.avif$/i.test(relPath)) return 'unused sponsor image variant';
    if (relPath === 'images/logo.png') return 'raw logo source';
    return '';
}

function resolvePublicPath(fromRelPath, ref) {
    const clean = String(ref || '').split('#')[0].split('?')[0].trim();
    if (!clean || clean.startsWith('#')) return '';
    if (clean.startsWith('/cdn-cgi/')) return '';
    if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(clean)) return '';
    if (/^(?:mailto|tel|javascript|data):/i.test(clean)) return '';

    const rel = clean.startsWith('/')
        ? clean.slice(1)
        : path.posix.normalize(path.posix.join(path.posix.dirname(fromRelPath), clean));
    if (!rel || rel === '.') return 'index.html';
    return rel.endsWith('/') ? rel + 'index.html' : rel;
}

function publicPathFromSiteUrl(value) {
    try {
        const url = new URL(value);
        if (url.origin !== SITE_ORIGIN) return '';
        let pathname = decodeURI(url.pathname || '/');
        if (pathname === '/') return 'index.html';
        pathname = pathname.replace(/^\/+/, '');
        if (pathname.endsWith('/')) return pathname + 'index.html';
        return pathname;
    } catch (_) {
        return '';
    }
}

function normalizeSiteUrl(value) {
    return normalizeReferenceUrl(value, SITE_ORIGIN) || '';
}

function expectedRouteUrl(relPath) {
    if (relPath === 'index.html') return `${SITE_ORIGIN}/`;
    if (relPath.endsWith('/index.html')) {
        return `${SITE_ORIGIN}/${relPath.slice(0, -'index.html'.length)}`;
    }
    return `${SITE_ORIGIN}/${relPath}`;
}

function distPathExistsForPublicPath(relPath) {
    if (!relPath) return false;
    if (fs.existsSync(path.join(DIST_ROOT, relPath))) return true;
    if (!path.posix.extname(relPath) && fs.existsSync(path.join(DIST_ROOT, relPath, 'index.html'))) return true;
    return false;
}

function assertLocalRefExists(errors, fromRelPath, ref) {
    const rel = resolvePublicPath(fromRelPath, ref);
    if (!rel) return;
    const abs = path.join(DIST_ROOT, rel);
    if (fs.existsSync(abs)) return;
    if (!path.posix.extname(rel) && fs.existsSync(path.join(DIST_ROOT, rel, 'index.html'))) return;
    errors.push(`${fromRelPath}: missing local reference ${ref}`);
}

function assertSiteUrlExists(errors, fromRelPath, value, label) {
    const rel = publicPathFromSiteUrl(value);
    if (!rel) {
        errors.push(`${fromRelPath}: ${label} must use ${SITE_ORIGIN}`);
        return;
    }
    if (!distPathExistsForPublicPath(rel)) {
        errors.push(`${fromRelPath}: ${label} points to missing public path ${value}`);
    }
}

function validateHtmlRefs(errors, abs, relPath) {
    const source = fs.readFileSync(abs, 'utf8');
    if (/\bhref=["']\/(?:generate|housekeeping|statistics)\.html(?:[?#][^"']*)?["']/i.test(source)) {
        errors.push(`${relPath}: visitor HTML must not link to local author tools`);
    }
    const html = source
        .replace(/<script\b[\s\S]*?<\/script>/gi, '');
    const attrPattern = /\b(?:href|src|data-src)=["']([^"']+)["']/gi;
    for (const match of html.matchAll(attrPattern)) {
        assertLocalRefExists(errors, relPath, match[1]);
    }

    const srcsetPattern = /\bsrcset=["']([^"']+)["']/gi;
    for (const match of html.matchAll(srcsetPattern)) {
        match[1].split(',').forEach(part => {
            const ref = part.trim().split(/\s+/)[0];
            assertLocalRefExists(errors, relPath, ref);
        });
    }
}

function validateCssRefs(errors, abs, relPath) {
    const css = fs.readFileSync(abs, 'utf8');
    const urlPattern = /url\((["']?)([^"')]+)\1\)/gi;
    for (const match of css.matchAll(urlPattern)) {
        assertLocalRefExists(errors, relPath, match[2]);
    }
}

function attrValue(tag, name) {
    const match = String(tag).match(new RegExp(`\\b${name}=(["'])(.*?)\\1`, 'i'));
    return match ? match[2] : '';
}

function findMetaTags(html, attrName, attrValueExpected) {
    return Array.from(String(html).matchAll(/<meta\b[^>]*>/gi))
        .map(match => match[0])
        .filter(tag => attrValue(tag, attrName).toLowerCase() === attrValueExpected.toLowerCase());
}

function findLinkTags(html, relExpected) {
    return Array.from(String(html).matchAll(/<link\b[^>]*>/gi))
        .map(match => match[0])
        .filter(tag => {
            const rel = attrValue(tag, 'rel').toLowerCase().split(/\s+/);
            return rel.includes(relExpected.toLowerCase());
        });
}

function firstMetaContent(html, attrName, attrValueExpected) {
    const tags = findMetaTags(html, attrName, attrValueExpected);
    return tags.length ? attrValue(tags[0], 'content') : '';
}

function sameOriginUrl(value) {
    try {
        return new URL(value).origin === SITE_ORIGIN;
    } catch (_) {
        return false;
    }
}

function collectJsonLdUrls(value, urls) {
    if (Array.isArray(value)) {
        value.forEach(item => collectJsonLdUrls(item, urls));
        return;
    }
    if (!value || typeof value !== 'object') return;

    Object.entries(value).forEach(([key, item]) => {
        if (typeof item === 'string' && /^(?:@id|url|item|image|contentUrl|embedUrl|thumbnailUrl)$/i.test(key)) {
            urls.push(item);
        }
        collectJsonLdUrls(item, urls);
    });
}

function validateJsonLd(errors, html, relPath, canonicalUrl) {
    const blocks = Array.from(String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
    const allUrls = [];
    blocks.forEach((match, index) => {
        let parsed;
        try {
            parsed = JSON.parse(match[1].trim());
        } catch (error) {
            errors.push(`${relPath}: JSON-LD block ${index + 1} is invalid JSON (${error.message})`);
            return;
        }

        const urls = [];
        collectJsonLdUrls(parsed, urls);
        urls.forEach(value => allUrls.push(value));
        urls.forEach(value => {
            if (!sameOriginUrl(value)) return;
            assertSiteUrlExists(errors, relPath, value, 'JSON-LD URL');
        });
    });

    const mainEntityUrl = allUrls.find(value => normalizeSiteUrl(value) === normalizeSiteUrl(canonicalUrl));
    if (canonicalUrl && blocks.length && /blog-module\/blog-entries\/[^/]+\/article\.html$/i.test(relPath)) {
        if (!mainEntityUrl) errors.push(`${relPath}: JSON-LD does not reference the canonical article URL`);
    }
}

function validateHtmlMetadata(errors, html, relPath, sitemapUrls, indexedArticleUrls) {
    const canonicalTags = findLinkTags(html, 'canonical');
    const canonicalUrl = canonicalTags.length ? attrValue(canonicalTags[0], 'href') : '';
    const normalizedExpected = normalizeSiteUrl(expectedRouteUrl(relPath));

    if (canonicalTags.length > 1) {
        errors.push(`${relPath}: expected at most one canonical link`);
    }

    if (canonicalUrl && sameOriginUrl(canonicalUrl)) {
        const normalizedCanonical = normalizeSiteUrl(canonicalUrl);
        if (normalizedCanonical !== normalizedExpected) {
            errors.push(`${relPath}: canonical ${canonicalUrl} does not match output route ${expectedRouteUrl(relPath)}`);
        }
        const isArticle = /blog-module\/blog-entries\/[^/]+\/article\.html$/i.test(relPath);
        const shouldBeInSitemap = !isArticle || indexedArticleUrls.has(normalizedCanonical);
        if (shouldBeInSitemap && sitemapUrls && !sitemapUrls.has(normalizedCanonical)) {
            errors.push(`${relPath}: canonical ${canonicalUrl} is missing from sitemap.xml`);
        }
        assertSiteUrlExists(errors, relPath, canonicalUrl, 'canonical URL');
    }

    const ogUrl = firstMetaContent(html, 'property', 'og:url');
    if (ogUrl && sameOriginUrl(ogUrl)) {
        const normalizedOg = normalizeSiteUrl(ogUrl);
        const comparisonUrl = canonicalUrl && sameOriginUrl(canonicalUrl) ? normalizeSiteUrl(canonicalUrl) : normalizedExpected;
        if (normalizedOg !== comparisonUrl) {
            errors.push(`${relPath}: og:url ${ogUrl} does not match canonical/output route`);
        }
        assertSiteUrlExists(errors, relPath, ogUrl, 'og:url');
    }

    ['og:image', 'twitter:image'].forEach(metaName => {
        const attrName = metaName.startsWith('og:') ? 'property' : 'name';
        const imageUrl = firstMetaContent(html, attrName, metaName);
        if (imageUrl && sameOriginUrl(imageUrl)) {
            assertSiteUrlExists(errors, relPath, imageUrl, metaName);
        }
    });

    validateJsonLd(errors, html, relPath, canonicalUrl);
}

function validateHtmlSecurityMeta(errors, html, relPath) {
    const cspTags = findMetaTags(html, 'http-equiv', 'Content-Security-Policy');
    if (cspTags.length !== 1) {
        errors.push(`${relPath}: expected exactly one Content-Security-Policy meta tag`);
    } else if (attrValue(cspTags[0], 'content') !== CONTENT_SECURITY_POLICY) {
        errors.push(`${relPath}: Content-Security-Policy meta does not match scripts/build/security-policy.mjs`);
    }

    const referrerTags = findMetaTags(html, 'name', 'referrer');
    if (referrerTags.length !== 1) {
        errors.push(`${relPath}: expected exactly one referrer meta tag`);
    } else if (attrValue(referrerTags[0], 'content') !== REFERRER_POLICY) {
        errors.push(`${relPath}: referrer meta does not match scripts/build/security-policy.mjs`);
    }
}

function validateSecurityHeadersFile(errors) {
    const relPath = '_headers';
    const abs = path.join(DIST_ROOT, relPath);
    if (!fs.existsSync(abs)) return;
    const actual = fs.readFileSync(abs, 'utf8');
    const expected = securityHeadersText();
    if (actual !== expected) {
        errors.push(`${relPath}: does not match scripts/build/security-policy.mjs`);
    }
}

function loadSitemapUrls(errors) {
    const relPath = 'sitemap.xml';
    const abs = path.join(DIST_ROOT, relPath);
    const urls = new Set();
    if (!fs.existsSync(abs)) return urls;

    let parsed;
    try {
        parsed = new XMLParser({ ignoreAttributes: false }).parse(fs.readFileSync(abs, 'utf8'));
    } catch (error) {
        errors.push(`${relPath}: invalid XML (${error.message})`);
        return urls;
    }

    const entries = parsed?.urlset?.url;
    const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
    if (!list.length) errors.push(`${relPath}: must contain at least one URL`);

    list.forEach((entry, index) => {
        const loc = entry && entry.loc ? String(entry.loc) : '';
        if (!loc) {
            errors.push(`${relPath}: url[${index}] missing loc`);
            return;
        }
        if (!sameOriginUrl(loc)) {
            errors.push(`${relPath}: url[${index}] loc must use ${SITE_ORIGIN}`);
            return;
        }
        const normalized = normalizeSiteUrl(loc);
        if (urls.has(normalized)) errors.push(`${relPath}: duplicate loc ${loc}`);
        urls.add(normalized);
        assertSiteUrlExists(errors, relPath, loc, 'sitemap loc');

        if (entry.lastmod && !/^\d{4}-\d{2}-\d{2}$/.test(String(entry.lastmod))) {
            errors.push(`${relPath}: url[${index}] lastmod must be YYYY-MM-DD`);
        }
    });

    return urls;
}

function loadIndexedArticleUrls(errors) {
    const relPath = 'blog-module/blog-index-data.json';
    const abs = path.join(DIST_ROOT, relPath);
    const urls = new Set();
    if (!fs.existsSync(abs)) return urls;

    let data;
    try {
        data = JSON.parse(fs.readFileSync(abs, 'utf8'));
    } catch (error) {
        errors.push(`${relPath}: invalid JSON while loading indexed article routes (${error.message})`);
        return urls;
    }

    if (data && data.v === 2 && Array.isArray(data.p)) {
        data.p.forEach(row => {
            const id = row && row[0];
            if (!id) return;
            urls.add(normalizeSiteUrl(`${SITE_ORIGIN}/blog-module/blog-entries/${encodeURIComponent(id)}/article.html`));
        });
        return urls;
    }

    const posts = data && Array.isArray(data.posts) ? data.posts : [];
    posts.forEach(post => {
        const id = post && (post.id || post.slug);
        const url = post && post.url ? post.url : id ? `/blog-module/blog-entries/${encodeURIComponent(id)}/article.html` : '';
        if (url) urls.add(normalizeSiteUrl(new URL(url, SITE_ORIGIN).href));
    });

    return urls;
}

function validateRobots(errors) {
    const relPath = 'robots.txt';
    const abs = path.join(DIST_ROOT, relPath);
    if (!fs.existsSync(abs)) return;
    const text = fs.readFileSync(abs, 'utf8');
    if (!new RegExp(`^Sitemap:\\s*${SITE_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\/sitemap\\.xml\\s*$`, 'mi').test(text)) {
        errors.push(`${relPath}: missing production sitemap declaration`);
    }
}

function validateCname(errors) {
    const relPath = 'CNAME';
    const abs = path.join(DIST_ROOT, relPath);
    if (!fs.existsSync(abs)) return;
    const value = fs.readFileSync(abs, 'utf8').trim();
    if (value !== 'f1stories.gr') errors.push(`${relPath}: expected f1stories.gr`);
}

function validateManifestRefs(errors) {
    const relPath = 'manifest.json';
    const abs = path.join(DIST_ROOT, relPath);
    if (!fs.existsSync(abs)) return;
    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(abs, 'utf8'));
    } catch (error) {
        errors.push(`${relPath}: invalid JSON (${error.message})`);
        return;
    }

    if (!manifest.name || !manifest.short_name || !manifest.start_url || !manifest.scope) {
        errors.push(`${relPath}: missing required app manifest fields`);
    }

    (Array.isArray(manifest.icons) ? manifest.icons : []).forEach((icon, index) => {
        if (!icon || !icon.src) {
            errors.push(`${relPath}: icons[${index}] missing src`);
            return;
        }
        assertLocalRefExists(errors, relPath, icon.src);
    });

    (Array.isArray(manifest.shortcuts) ? manifest.shortcuts : []).forEach((shortcut, index) => {
        if (!shortcut || !shortcut.url) {
            errors.push(`${relPath}: shortcuts[${index}] missing url`);
        } else {
            assertLocalRefExists(errors, relPath, shortcut.url);
        }
        (Array.isArray(shortcut?.icons) ? shortcut.icons : []).forEach((icon, iconIndex) => {
            if (!icon || !icon.src) {
                errors.push(`${relPath}: shortcuts[${index}].icons[${iconIndex}] missing src`);
                return;
            }
            assertLocalRefExists(errors, relPath, icon.src);
        });
    });
}

function collectStringArrayValues(js, name) {
    const match = js.match(new RegExp(`var\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
    if (!match) return [];
    return Array.from(match[1].matchAll(/'([^']+)'/g)).map(item => item[1]);
}

function validateServiceWorkerRefs(errors) {
    const relPath = 'sw.js';
    const abs = path.join(DIST_ROOT, relPath);
    if (!fs.existsSync(abs)) return;
    const js = fs.readFileSync(abs, 'utf8');
    const refs = new Set();

    const offlineMatch = js.match(/var\s+OFFLINE_URL\s*=\s*'([^']+)'/);
    if (offlineMatch) refs.add(offlineMatch[1]);
    collectStringArrayValues(js, 'SHELL_ASSETS').forEach(ref => refs.add(ref));
    collectStringArrayValues(js, 'STANDINGS_DATA_ASSETS').forEach(ref => refs.add(ref));
    Array.from(js.matchAll(/jsonFrom\('([^']+)'\)/g)).forEach(match => refs.add(match[1]));

    refs.forEach(ref => assertLocalRefExists(errors, relPath, ref));
}

function validateRouteMarkers(errors) {
    const checks = [
        {
            relPath: 'index.html',
            label: 'home',
            patterns: [/<main\b/i, /id=["']about["']/i, /id=["']contact["']/i, /id=["']contact-form["']/i]
        },
        {
            relPath: 'blog-module/blog/index.html',
            label: 'blog index',
            patterns: [/<main\b/i, /id=["']articles-grid["']/i, /article-card/i]
        },
        {
            relPath: 'standings/index.html',
            label: 'standings',
            patterns: [/<main\b/i, /class=["'][^"']*standings-wrapper/i, /id=["']tab-drivers["']/i]
        },
        {
            relPath: '404.html',
            label: '404',
            patterns: [/<h1\b/i, /href=["']\//i]
        }
    ];

    const pageOnePath = path.join(DIST_ROOT, 'blog-module/blog-index-page-1.json');
    if (fs.existsSync(pageOnePath)) {
        try {
            const pageOne = JSON.parse(fs.readFileSync(pageOnePath, 'utf8'));
            const first = Array.isArray(pageOne.posts) ? pageOne.posts[0] : null;
            const id = first && (first.id || first.slug);
            if (id) {
                checks.push({
                    relPath: `blog-module/blog-entries/${encodeURIComponent(id)}/article.html`,
                    label: 'article',
                    patterns: [/<main\b/i, /class=["'][^"']*article-content/i, /rel=["']canonical["']/i]
                });
            }
        } catch (error) {
            errors.push(`blog-module/blog-index-page-1.json: invalid JSON for route crawl (${error.message})`);
        }
    }

    checks.forEach(check => {
        const abs = path.join(DIST_ROOT, check.relPath);
        if (!fs.existsSync(abs)) {
            errors.push(`route crawl ${check.label}: missing ${check.relPath}`);
            return;
        }
        const html = fs.readFileSync(abs, 'utf8');
        check.patterns.forEach(pattern => {
            if (!pattern.test(html)) errors.push(`route crawl ${check.label}: ${check.relPath} missing ${pattern}`);
        });
    });
}

function main() {
    if (!fs.existsSync(DIST_ROOT)) {
        console.error('✗ dist/ does not exist. Run `node scripts/build/public-artifact.mjs` first.');
        process.exit(1);
    }

    const errors = [];
    const files = [];
    const sitemapUrls = loadSitemapUrls(errors);
    const indexedArticleUrls = loadIndexedArticleUrls(errors);

    for (const relPath of REQUIRED_EXACT) {
        if (!fs.existsSync(path.join(DIST_ROOT, relPath))) {
            errors.push(`missing required public file: ${relPath}`);
        }
    }

    validateSecurityHeadersFile(errors);
    validateRobots(errors);
    validateCname(errors);
    validateManifestRefs(errors);
    validateServiceWorkerRefs(errors);
    validateRouteMarkers(errors);

    walk(DIST_ROOT, function (abs, relPath) {
        files.push(relPath);
        const reason = forbiddenReason(relPath);
        if (reason) {
            errors.push(`${relPath}: ${reason}`);
        }

        const size = fs.statSync(abs).size;
        if (size > MAX_FILE_BYTES && !SIZE_ALLOWLIST.has(relPath)) {
            errors.push(`${relPath}: ${fmtBytes(size)} exceeds max ${fmtBytes(MAX_FILE_BYTES)}`);
        }

        if (/\.html$/i.test(relPath)) {
            const html = fs.readFileSync(abs, 'utf8');
            validateHtmlSecurityMeta(errors, html, relPath);
            validateHtmlMetadata(errors, html, relPath, sitemapUrls, indexedArticleUrls);
            validateHtmlRefs(errors, abs, relPath);
        }
        if (/\.css$/i.test(relPath)) validateCssRefs(errors, abs, relPath);
    });

    if (errors.length) {
        console.error('✗ public artifact validation failed:');
        errors.slice(0, 80).forEach(error => console.error(`  - ${error}`));
        if (errors.length > 80) console.error(`  ... ${errors.length - 80} more`);
        process.exit(1);
    }

    const bytes = files.reduce((sum, relPath) => sum + fs.statSync(path.join(DIST_ROOT, relPath)).size, 0);
    console.log(`✓ public artifact validated: ${files.length} files, ${fmtBytes(bytes)}`);
}

main();
