#!/usr/bin/env node
// validate-public-artifact.mjs — fail if dist/ contains private/source clutter.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { buildSync } from 'esbuild';
import search from '../../blog-module/search-destinations.js';
import hubs from '../../blog-module/build/entities/hubs.js';
import articleDates from '../../blog-module/build/article-dates.js';
import retired from '../../blog-module/build/retired.js';
import taxonomy from '../../blog-module/taxonomy.js';
import { REFERRER_POLICY, contentSecurityPolicyFor, cspProfileForPath, injectSecurityMeta, securityHeadersText } from './security-policy.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const DIST_ROOT = path.join(REPO_ROOT, 'dist');
const BUILD_MANIFEST_PATH = path.join(REPO_ROOT, 'scripts', 'build', 'asset-manifest.json');
const SITE_ORIGIN = 'https://f1-stories.gr';
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
    'scripts/build/asset-manifest.json'
]);

const REQUIRED_EXACT = [
    '.nojekyll',
    '_headers',
    '404.html',
    'CNAME',
    'generate.html',
    'housekeeping.html',
    'index.html',
    'robots.txt',
    'sitemap.xml',
    'feed.xml',
    'sw.js',
    'assets/youtube-latest.json',
    'blog-module/blog-index-data.json',
    'blog-module/search-destinations.json',
    'blog-module/search-destinations.min.js',
    'blog-module/home-latest.json',
    'blog-module/taxonomy.min.js',
    'blog-module/blog/index.html',
    'images/favicon.png',
    'images/icons/favicon-16.png',
    'images/icons/favicon-32.png',
    'images/icons/icon-512.png',
    'standings/index.html',
    'authors/index.html',
    ...taxonomy.AUTHORS.map(author => taxonomy.authorPath(author).slice(1) + 'index.html'),
    'standings/debrief-cache.json',
    'standings/dirty-air/index.json',
    'standings/standings-cache.json',
    'styles.min.css',
    'styles/editorial.min.css',
    'styles/home-fonts.min.css',
    'styles/authors.min.css',
    'blog-module/blog/archive-editorial.min.css',
    'blog-module/blog/article-editorial.min.css',
    'standings/standings-editorial.min.css',
    'styles/layers.css',
    'scripts/perf/error-beacon.min.js',
    'scripts/perf/web-vitals-beacon.min.js',
    'scripts/perf/web-vitals-collector.min.js',
    'assets/licenses/web-vitals-Apache-2.0.txt',
    'scripts/sw-cleanup.min.js',
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
];

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
    const isFontLicense = /^assets\/fonts\/licenses\/(?:barlowcondensed|gfsdidot|ibmplexsans)-OFL\.txt$/.test(relPath);
    if (/\.txt$/i.test(relPath) && relPath !== 'robots.txt' && !isFontLicense && relPath !== 'assets/licenses/web-vitals-Apache-2.0.txt') return 'raw text artifact';
    if (/^blog-module\/blog-entries\/.*\/(?:source|gallery)\.txt$/i.test(relPath)) return 'raw article source';
    if (/^blog-module\/blog-entries\/.*\.(?:jpe?g|png)$/i.test(relPath)) return 'raw article image';
    if (/^scripts\/build\//.test(relPath)) return 'build script';
    if (/^blog-module\/build\//.test(relPath)) return 'blog build script';
    if (/\.min\.(?:css|js)\.map$/i.test(relPath)) return 'source map';
    if (/^images\/bg\/bg(?:6|7|8|9)(?:-|\.|$)/i.test(relPath)) return 'unapproved hero background';
    if (/^images\/bg\/.*\.sh$/i.test(relPath)) return 'image build helper';
    if (/^images\/avatars\/(?:FAAM|Poulikidis)\.webp$/i.test(relPath)) return 'unused home avatar';
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
    try {
        const url = new URL(value, SITE_ORIGIN);
        if (url.origin !== SITE_ORIGIN) return '';
        let pathname = decodeURI(url.pathname || '/');
        if (pathname.endsWith('/index.html')) {
            pathname = pathname.slice(0, -'index.html'.length);
        }
        if (!pathname.startsWith('/')) pathname = '/' + pathname;
        return SITE_ORIGIN + pathname;
    } catch (_) {
        return '';
    }
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

function assertLocalRefExists(errors, fromRelPath, ref, { distRoot = DIST_ROOT, requireFile = false } = {}) {
    let rel;
    try {
        if (requireFile) {
            const url = new URL(ref, `${SITE_ORIGIN}/${fromRelPath}`);
            if (url.protocol !== 'https:' || url.origin !== SITE_ORIGIN) return;
            rel = decodeURIComponent(url.pathname).slice(1) || '.';
        } else {
            rel = resolvePublicPath(fromRelPath, ref);
        }
    } catch (_) {
        errors.push(`${fromRelPath}: invalid local reference ${ref}`);
        return;
    }
    if (!rel) return;
    const abs = path.resolve(distRoot, rel);
    const outside = path.relative(distRoot, abs);
    if (requireFile) {
        if (!outside.startsWith(`..${path.sep}`) && !path.isAbsolute(outside)
            && fs.statSync(abs, { throwIfNoEntry: false })?.isFile()) return;
    } else {
        if (fs.existsSync(abs)) return;
        if (!path.posix.extname(rel) && fs.existsSync(path.join(distRoot, rel, 'index.html'))) return;
    }
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

export function validateHtmlRefs(errors, abs, relPath, distRoot = DIST_ROOT) {
    // Inspect opening tags, never script bodies or commented-out markup.
    const html = fs.readFileSync(abs, 'utf8')
        .replace(/<!--[\s\S]*?-->|<script\b((?:"[^"]*"|'[^']*'|[^'">])*)>[\s\S]*?<\/script\s*>/gi, (_, attributes) => {
            if (attributes !== undefined) {
                const attrs = /([^\s"'=<>`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
                for (const match of attributes.matchAll(attrs)) {
                    if (match[1].toLowerCase() === 'src') {
                        assertLocalRefExists(errors, relPath, match[2] ?? match[3] ?? match[4] ?? '', { distRoot, requireFile: true });
                        break;
                    }
                }
            }
            return '';
        });
    const attrPattern = /\b(?:href|src|data-src)=["']([^"']+)["']/gi;
    for (const match of html.matchAll(attrPattern)) {
        assertLocalRefExists(errors, relPath, match[1], { distRoot });
    }

    const srcsetPattern = /\bsrcset=["']([^"']+)["']/gi;
    for (const match of html.matchAll(srcsetPattern)) {
        match[1].split(',').forEach(part => {
            const ref = part.trim().split(/\s+/)[0];
            assertLocalRefExists(errors, relPath, ref, { distRoot });
        });
    }
}

export function validateJsRefs(errors, files, distRoot = DIST_ROOT) {
    const entryPoints = files.filter(file => /\.js$/i.test(file));
    if (!entryPoints.length) return;
    try {
        // Parse emitted files once; no bundling, resolution, execution or output writes.
        const { metafile } = buildSync({
            absWorkingDir: distRoot,
            entryPoints,
            outbase: distRoot,
            outdir: path.join(distRoot, '__validate__'),
            bundle: false,
            write: false,
            metafile: true,
            sourcemap: false,
            logLevel: 'silent'
        });
        for (const output of Object.values(metafile.outputs)) {
            for (const dependency of output.imports) {
                if (!['import-statement', 'dynamic-import'].includes(dependency.kind)) continue;
                // With bundling disabled, even local imports are marked external.
                if (!/^(?:\.{1,2}\/|\/|https?:\/\/)/i.test(dependency.path)) continue;
                assertLocalRefExists(errors, toPosix(output.entryPoint), dependency.path, { distRoot, requireFile: true });
            }
        }
    } catch (error) {
        for (const detail of error.errors || [{ text: error.message }]) {
            errors.push(`${detail.location?.file || 'JavaScript'}: ${detail.text}`);
        }
    }
}

function validateCssRefs(errors, abs, relPath) {
    const css = fs.readFileSync(abs, 'utf8');
    if (relPath === 'styles.min.css' && /@import\b/i.test(css)) {
        errors.push(`${relPath}: local dependencies must be bundled; @import would add a render-blocking request`);
    }

    const importStringPattern = /@import\s+(["'])([^"']+)\1/gi;
    for (const match of css.matchAll(importStringPattern)) {
        assertLocalRefExists(errors, relPath, match[2]);
    }

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

const RESTRICTED_PAGES = new Set(['generate.html', 'housekeeping.html', 'f1telemetry/index.html', 'ghostcar/index.html', 'tyres/index.html']);

function isArticleDate(value) {
    if (articleDates.isCalendarDay(value)) return true;
    try {
        return articleDates.parseInstant(value, 'date').iso === value;
    } catch (_) {
        return false;
    }
}

// Search and sharing metadata: public pages carry one image-preview robots policy, locale and site name; restricted
// pages keep their noindex; an article's type, dates and section agree across JSON-LD and Open Graph.
export function validateSearchMetadata(errors, html, relPath) {
    const end = String(html).search(/<\/head>/i);
    const head = end === -1 ? String(html) : String(html).slice(0, end);
    const robots = findMetaTags(head, 'name', 'robots').map(tag => attrValue(tag, 'content'));
    if (robots.length > 1) errors.push(`${relPath}: expected at most one robots meta tag, found ${robots.length}`);
    if (RESTRICTED_PAGES.has(relPath)) {
        if (!robots.some(value => /\bnoindex\b/i.test(value))) errors.push(`${relPath}: restricted page lost its noindex`);
        return;
    }
    if (robots.some(value => /\bnoindex\b/i.test(value)) || !findLinkTags(head, 'canonical').length) return;

    if (robots[0] !== 'max-image-preview:large') errors.push(`${relPath}: public page robots must be "max-image-preview:large"`);
    const properties = Array.from(head.matchAll(/<meta\b[^>]*\bproperty=["']([^"']+)["'][^>]*>/gi)).map(match => match[1]);
    const duplicated = [...new Set(properties.filter((name, index) => properties.indexOf(name) !== index))];
    if (duplicated.length) errors.push(`${relPath}: duplicate Open Graph properties ${duplicated.join(', ')}`);
    if (firstMetaContent(head, 'property', 'og:locale') !== 'el_GR') errors.push(`${relPath}: og:locale must be el_GR`);
    if (firstMetaContent(head, 'property', 'og:site_name') !== 'F1 Stories') errors.push(`${relPath}: og:site_name must be F1 Stories`);
    if (!/blog-module\/blog-entries\/[^/]+\/article\.html$/i.test(relPath)) return;

    let article;
    try {
        article = Array.from(head.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
            .map(match => JSON.parse(match[1].trim()))
            .filter(data => ['Article', 'NewsArticle'].includes(data['@type']));
    } catch (_) {
        return; // validateJsonLd reports the invalid JSON.
    }
    if (article.length !== 1) {
        errors.push(`${relPath}: expected exactly one Article or NewsArticle JSON-LD block, found ${article.length}`);
        return;
    }
    const data = article[0];
    const section = firstMetaContent(head, 'property', 'article:section');
    if (firstMetaContent(head, 'property', 'og:type') !== 'article') errors.push(`${relPath}: og:type must be article`);
    if (!section || !(data.articleSection || []).includes(section)) errors.push(`${relPath}: article:section must be one of the JSON-LD articleSection values`);
    if (data['@type'] === 'NewsArticle' && section !== 'News') errors.push(`${relPath}: NewsArticle requires the News primary section`);
    if (data.publisher?.['@id'] !== `${SITE_ORIGIN}/#organization`) errors.push(`${relPath}: publisher must reference ${SITE_ORIGIN}/#organization`);
    for (const key of ['datePublished', 'dateModified']) {
        if (!isArticleDate(data[key])) errors.push(`${relPath}: ${key} "${data[key]}" is not a calendar date or an Athens-offset timestamp`);
    }
    const day = value => String(value || '').slice(0, 10);
    const instant = value => (articleDates.isCalendarDay(value) ? NaN : Date.parse(value));
    const earlier = Number.isNaN(instant(data.dateModified)) || Number.isNaN(instant(data.datePublished))
        ? day(data.dateModified) < day(data.datePublished) : instant(data.dateModified) < instant(data.datePublished);
    if (earlier) errors.push(`${relPath}: dateModified precedes datePublished`);
    if (firstMetaContent(head, 'property', 'article:published_time') !== data.datePublished) errors.push(`${relPath}: article:published_time must equal datePublished`);
    const modifiedTime = firstMetaContent(head, 'property', 'article:modified_time');
    if (modifiedTime && modifiedTime !== data.dateModified) errors.push(`${relPath}: article:modified_time must equal dateModified`);
    validateArticleBreadcrumb(errors, html, head, relPath, section);
}

// One hierarchy, Home → the primary section's page → this article, stated alike by the cover strip and BreadcrumbList.
function validateArticleBreadcrumb(errors, html, head, relPath, section) {
    const lists = Array.from(head.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
        .map(match => JSON.parse(match[1].trim())).filter(data => data['@type'] === 'BreadcrumbList');
    const items = lists.length === 1 ? lists[0].itemListElement || [] : [];
    const canonical = attrValue(findLinkTags(head, 'canonical')[0] || '', 'href');
    const sectionPage = taxonomy.sectionPath(section);
    const expected = [`${SITE_ORIGIN}/`, `${SITE_ORIGIN}${sectionPage}`, canonical];
    if (!sectionPage || items.length !== 3 || items.some((item, i) => item.position !== i + 1 || item.item !== expected[i] || !item.name)) {
        errors.push(`${relPath}: BreadcrumbList must be Home → ${sectionPage || 'a public section'} → the canonical article`);
        return;
    }
    const text = value => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const nav = /<nav class="rr-crumbs" aria-label="[^"]+"><ol>([\s\S]*?)<\/ol><\/nav>/.exec(html);
    const links = nav ? Array.from(nav[1].matchAll(/<a href="([^"]+)">([^<]*)<\/a>/g)).map(match => [match[1], text(match[2])]) : [];
    const current = nav && (/<li class="visually-hidden" aria-current="page">([^<]*)<\/li>/.exec(nav[1]) || [])[1];
    if (links.length !== 2 || links[0][0] !== '/' || links[1][0] !== sectionPage || links[1][1] !== items[1].name
        || current === undefined || text(current) !== items[2].name) {
        errors.push(`${relPath}: the visible breadcrumb must match BreadcrumbList (Home, ${items[1].name}, the article)`);
    }
}

function validateHtmlSecurityMeta(errors, html, relPath) {
    const cspTags = findMetaTags(html, 'http-equiv', 'Content-Security-Policy');
    if (cspTags.length !== 1) {
        errors.push(`${relPath}: expected exactly one Content-Security-Policy meta tag`);
    } else if (attrValue(cspTags[0], 'content') !== contentSecurityPolicyFor(relPath)) {
        errors.push(`${relPath}: Content-Security-Policy meta does not match the ${cspProfileForPath(relPath)} policy in scripts/build/security-policy.mjs`);
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
        if (/[?#]/.test(loc)) errors.push(`${relPath}: loc ${loc} must be a static route without a query or fragment`);
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
    if (value !== 'f1-stories.gr') errors.push(`${relPath}: expected f1-stories.gr`);
}

function loadEditorialAssetRefs(errors) {
    let files;
    try {
        files = JSON.parse(fs.readFileSync(BUILD_MANIFEST_PATH, 'utf8')).files;
    } catch (error) {
        errors.push(`asset manifest unavailable for editorial route validation (${error.message})`);
        return {};
    }

    const sources = [
        'home.css',
        'styles/home-fonts.css',
        'styles/editorial.css',
        'styles/authors.css',
        'blog-module/blog/archive-editorial.css',
        'blog-module/blog/article-editorial.css',
        'standings/standings-editorial.css'
    ];
    return Object.fromEntries(sources.map(source => {
        const entry = files?.[source];
        if (!entry?.min || !entry?.hash) {
            errors.push(`asset manifest missing editorial source ${source}`);
            return [source, ''];
        }
        return [source, `/${entry.min}?v=${entry.hash}`];
    }));
}

function countLiteral(text, value) {
    if (!value) return 0;
    return String(text).split(value).length - 1;
}

// Public pages carry their head CSS inline (inline-head-css.mjs); it must be the current file, byte for byte.
const inlineCssCache = new Map();
function currentInlineCss(ref) {
    if (!inlineCssCache.has(ref)) {
        const abs = path.join(DIST_ROOT, ref.split('?')[0]);
        inlineCssCache.set(ref, fs.existsSync(abs) ? `<style>${fs.readFileSync(abs, 'utf8').trim()}</style>` : '');
    }
    return inlineCssCache.get(ref);
}

function validateEditorialRefs(errors, html, relPath, sources, editorialRefs) {
    sources.forEach(source => {
        const ref = editorialRefs[source];
        if (!ref) return;
        const rooted = `href="${ref}"`;
        const relative = `href="${ref.slice(1)}"`;
        const count = countLiteral(html, rooted) + countLiteral(html, relative) + countLiteral(html, currentInlineCss(ref));
        if (count !== 1) {
            errors.push(`${relPath}: expected one current ${source} reference, found ${count}`);
        }
    });
}

function validateArchiveRuntime(errors) {
    const relPath = 'blog-module/blog/index.html';
    const abs = path.join(DIST_ROOT, relPath);
    if (!fs.existsSync(abs)) return;
    const html = fs.readFileSync(abs, 'utf8');
    const taxonomyRef = html.indexOf('/blog-module/taxonomy.min.js');
    const archiveRef = html.indexOf('/blog-module/blog-index.min.js');
    if (taxonomyRef === -1) {
        errors.push(`${relPath}: missing taxonomy runtime asset`);
    } else if (archiveRef === -1) {
        errors.push(`${relPath}: missing archive runtime asset`);
    } else if (taxonomyRef > archiveRef) {
        errors.push(`${relPath}: taxonomy runtime must load before the archive runtime`);
    }
}

function normalizeHeroRef(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        const url = new URL(raw, SITE_ORIGIN);
        if (url.origin !== SITE_ORIGIN) return raw.split('#')[0].split('?')[0];
        return url.pathname;
    } catch (_) {
        return raw.split('#')[0].split('?')[0];
    }
}

function extractElementAttribute(html, tagName, id, attribute) {
    const tag = String(tagName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const idPattern = String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const attr = String(attribute).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = html.match(new RegExp(
        `<${tag}\\b(?=[^>]*\\bid=["']${idPattern}["'])(?:[^>]*?)\\b${attr}=["']([^"']*)["'][^>]*>`,
        'i'
    ));
    return match ? match[1] : '';
}

export function validateHomepageHero(errors, distRoot = DIST_ROOT) {
    const relPath = 'index.html';
    const htmlPath = path.join(distRoot, relPath);
    const dataPath = path.join(distRoot, 'blog-module/home-latest.json');
    if (!fs.existsSync(htmlPath) || !fs.existsSync(dataPath)) return;
    const html = fs.readFileSync(htmlPath, 'utf8');

    let latest;
    try {
        const posts = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        latest = Array.isArray(posts) ? posts[0] : null;
    } catch (error) {
        errors.push(`${relPath}: cannot read home-latest.json for hero validation (${error.message})`);
        return;
    }
    if (!latest) {
        errors.push(`${relPath}: home-latest.json has no lead story for hero validation`);
        return;
    }

    const expectedImage = normalizeHeroRef(latest.heroImage || latest.image || latest.thumbnail);
    const allowedImages = new Set([expectedImage, normalizeHeroRef(latest.heroAvif)]);
    allowedImages.delete('');
    const image = normalizeHeroRef(extractElementAttribute(html, 'img', 'hero-image', 'src'));
    const webp = normalizeHeroRef(extractElementAttribute(html, 'source', 'hero-source-webp', 'srcset').split(/\s+/)[0]);
    const avif = normalizeHeroRef(extractElementAttribute(html, 'source', 'hero-source-avif', 'srcset').split(/\s+/)[0]);
    const preload = normalizeHeroRef(extractElementAttribute(html, 'link', 'hero-image-preload', 'href'));
    const link = normalizeHeroRef(extractElementAttribute(html, 'a', 'hero-story-link', 'href'));
    const expectedLink = `/blog-module/blog-entries/${encodeURIComponent(latest.slug || latest.id || '')}/article.html`;
    const titleMatch = html.match(/<h2\b[^>]*\bid=["']hero-title["'][^>]*>([\s\S]*?)<\/h2>/i);
    const title = titleMatch
        ? titleMatch[1].replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
        : '';

    if (!image || image !== expectedImage) errors.push(`${relPath}: hero image does not match the latest story image`);
    if (webp && !allowedImages.has(webp)) errors.push(`${relPath}: hero WebP source does not match the latest story image`);
    if (avif && !allowedImages.has(avif)) errors.push(`${relPath}: hero AVIF source does not match the latest story image`);
    if (preload && !allowedImages.has(preload)) errors.push(`${relPath}: hero preload does not match the latest story image`);
    if (!link || link !== expectedLink) errors.push(`${relPath}: hero story link does not match the latest story`);
    if (!title || !title.startsWith(String(latest.title || '').replace(/\s+/g, ' ').trim())) errors.push(`${relPath}: hero headline does not match the latest story`);

    const pictureMatch = html.match(/<picture\b[^>]*\bid=["']hero-picture["'][^>]*>([\s\S]*?)<\/picture>/i);
    if (pictureMatch && /\/images\/bg\//i.test(pictureMatch[1])) {
        errors.push(`${relPath}: hero picture still references a rotating background`);
    }
}

function validateRouteMarkers(errors, editorialRefs) {
    const checks = [
        {
            relPath: 'index.html',
            label: 'home',
            patterns: [/<main\b/i, /<body\b[^>]*class=["'][^"']*\beditorial-page\b/i, /<body\b[^>]*class=["'][^"']*\bhome-page\b/i, /id=["']about["']/i, /id=["']contact["']/i, /id=["']contact-form["']/i],
            editorialSources: ['styles/home-fonts.css', 'styles/editorial.css', 'home.css']
        },
        {
            relPath: 'blog-module/blog/index.html',
            label: 'blog index',
            patterns: [/<main\b/i, /<body\b[^>]*class=["'][^"']*\beditorial-page\b/i, /<body\b[^>]*class=["'][^"']*\barchive-page\b/i, /id=["']journal-archive["']/i, /class=["']ed-lead\b/i, /class=["']ed-row\b/i, /class=["']ed-contents\b/i],
            editorialSources: ['styles/home-fonts.css', 'styles/editorial.css', 'blog-module/blog/archive-editorial.css']
        },
        // The Edition Index's static routes: every public section page, the newest month and the archive hub.
        ...['section/technical/', 'section/news/page/2/', 'archive/', 'archive/2026/10/'].map(route => ({
            relPath: `blog-module/blog/${route}index.html`,
            label: `edition ${route}`,
            patterns: [/<main\b/i, /<body\b[^>]*class=["'][^"']*\barchive-page\b/i, /<h1\b[^>]*class=["']ed-section__title/i, /class=["']ed-contents\b/i, /rel=["']canonical["']/i],
            editorialSources: ['styles/home-fonts.css', 'styles/editorial.css', 'blog-module/blog/archive-editorial.css']
        })),
        {
            relPath: 'standings/index.html',
            label: 'standings',
            patterns: [/<main\b/i, /<body\b[^>]*class=["'][^"']*\beditorial-page\b/i, /<body\b[^>]*class=["'][^"']*\bstandings-page\b/i, /class=["'][^"']*standings-wrapper/i, /id=["']tab-drivers["']/i],
            editorialSources: ['styles/home-fonts.css', 'styles/editorial.css', 'standings/standings-editorial.css']
        },
        {
            relPath: 'authors/index.html',
            label: 'authors',
            patterns: [/<main\b/i, /<body\b[^>]*class=["'][^"']*\beditorial-page\b/i, /<body\b[^>]*class=["'][^"']*\bauthors-page\b/i, /class=["'][^"']*author-profile/i],
            editorialSources: ['styles/home-fonts.css', 'styles/editorial.css', 'styles/authors.css']
        },
        {
            relPath: '404.html',
            label: '404',
            patterns: [/<h1\b/i, /href=["']\//i]
        }
    ];

    const indexPath = path.join(DIST_ROOT, 'blog-module/blog-index-data.json');
    if (fs.existsSync(indexPath)) {
        try {
            const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
            const id = Array.isArray(index.p) && index.p[0] ? index.p[0][0] : null;
            if (id) {
                checks.push({
                    relPath: `blog-module/blog-entries/${encodeURIComponent(id)}/article.html`,
                    label: 'article',
                    patterns: [/<main\b/i, /<body\b[^>]*class=["'][^"']*\beditorial-page\b/i, /<body\b[^>]*class=["'][^"']*\barticle-page\b/i, /class=["'][^"']*article-content/i, /rel=["']canonical["']/i],
                    editorialSources: ['styles/home-fonts.css', 'styles/editorial.css', 'blog-module/blog/article-editorial.css']
                });
            }
        } catch (error) {
            errors.push(`blog-module/blog-index-data.json: invalid JSON for route crawl (${error.message})`);
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
        validateEditorialRefs(errors, html, check.relPath, check.editorialSources || [], editorialRefs);
    });
}

// Pages inline only the sprite symbols they use, so every icon reference must resolve in-page.
function validateSpriteRefs(errors, html, relPath) {
    const symbols = new Set([...html.matchAll(/<symbol id="([^"]+)"/g)].map(m => m[1]));
    const missing = [...new Set([...html.matchAll(/<use href="#([^"]+)"/g)].map(m => m[1]))].filter(id => !symbols.has(id));
    if (missing.length) errors.push(`${relPath}: icon symbols missing from the inlined sprite: ${missing.join(', ')}`);
}

function validateEditorialArticle(errors, html, relPath, editorialRefs) {
    if (!/^blog-module\/blog-entries\/[^/]+\/article\.html$/i.test(relPath)) return;
    if (!/<body\b[^>]*class=["'][^"']*\beditorial-page\b/i.test(html)
        || !/<body\b[^>]*class=["'][^"']*\barticle-page\b/i.test(html)) {
        errors.push(`${relPath}: missing editorial article body classes`);
    }
    validateEditorialRefs(errors, html, relPath, [
        'styles/home-fonts.css',
        'styles/editorial.css',
        'blog-module/blog/article-editorial.css'
    ], editorialRefs);
    if (countLiteral(html, '<!-- f1s:article-editorial:begin -->') !== 1
        || countLiteral(html, '<!-- f1s:article-editorial:end -->') !== 1) {
        errors.push(`${relPath}: expected one editorial marker pair`);
    }
    if (/<!-- f1s:critical-css:(?:begin|end) -->/.test(html)) {
        errors.push(`${relPath}: retains retired critical CSS`);
    }
}

// JSON links need explicit validation; the HTML reference crawl never sees them.
// ── Discovery link graph ─────────────────────────────────
// Read during the one HTML walk: each page's static anchors (for reachability), its NEXT UP stories, its cover-kicker
// topic links and any topic-hub links. Checked once the walk is done.
const ENTITY_HREF = /^\/blog-module\/blog\/entities\//;
function anchorPaths(html, relPath) {
    const out = [];
    for (const match of html.replace(/<script\b[\s\S]*?<\/script>|<!--[\s\S]*?-->/gi, '').matchAll(/<a\b[^>]*?\shref\s*=\s*(["'])(.*?)\1/gi)) {
        const href = match[2].replace(/&amp;/g, '&').trim();
        if (!href || href.startsWith('#')) continue;
        let url;
        try { url = new URL(href, `${SITE_ORIGIN}/${relPath}`); } catch (_) { continue; }
        if (url.origin !== SITE_ORIGIN) continue;
        let file = url.pathname;
        try { file = decodeURIComponent(file); } catch (_) { /* keep encoded */ }
        file = file.slice(1);
        out.push({ path: url.pathname, file: !file || file.endsWith('/') ? `${file}index.html` : file });
    }
    return out;
}
export function collectDiscovery(discovery, html, relPath) {
    const anchors = anchorPaths(html, relPath);
    discovery.anchors.set(relPath, anchors.map(anchor => anchor.file));
    const grid = html.indexOf('<div class="rr-next__grid">');
    const nextUp = grid < 0 ? [] : anchorPaths(html.slice(grid, html.indexOf('<div class="article-navigation"', grid)), relPath);
    const kicker = (/<p class="rr-kicker">[^\n]*?<span id="reading-time-value">/.exec(html) || [''])[0];
    const topicBlocks = [...html.matchAll(/<nav class="ed-aside__block" aria-labelledby="ed-topics-title">[\s\S]*?<\/nav>/g)].map(block => anchorPaths(block[0], relPath));
    discovery.pages.set(relPath, {
        nextUp, topics: anchorPaths(kicker, relPath).filter(anchor => ENTITY_HREF.test(anchor.path)), topicBlocks,
        hubLinks: anchors.filter(anchor => ENTITY_HREF.test(anchor.path)), redirect: /<meta[^>]+http-equiv=["']refresh["']/i.test(html)
    });
}
export function newDiscovery() {
    return { anchors: new Map(), pages: new Map() };
}
// Every generated discovery link is a real, published, direct destination; approved hubs only; nothing duplicated
// within one region; every sitemap page reachable from the homepage through static links.
export function validateDiscoveryGraph(errors, discovery, sitemapUrls, {
    distRoot = DIST_ROOT, approvedFiles = hubs.publicHubFiles(), today = taxonomy.athensDay()
} = {}) {
    const dates = new Map();
    try {
        const data = JSON.parse(fs.readFileSync(path.join(distRoot, 'blog-module/blog-index-data.json'), 'utf8'));
        (data.p || []).forEach(row => dates.set(`blog-module/blog-entries/${row[0]}/article.html`, row[3]));
    } catch (error) {
        errors.push(`discovery graph: cannot read blog-index-data.json (${error.message})`);
    }
    const duplicates = (anchors, label, relPath) => {
        const seen = new Set();
        anchors.forEach(anchor => {
            if (seen.has(anchor.file)) errors.push(`${relPath}: duplicate ${label} link ${anchor.path}`);
            seen.add(anchor.file);
        });
    };
    for (const [relPath, page] of discovery.pages) {
        duplicates(page.nextUp, 'NEXT UP', relPath);
        duplicates(page.topics, 'topic', relPath);
        page.topicBlocks.forEach(block => duplicates(block, 'topic list', relPath));
        for (const anchor of page.nextUp) {
            const date = dates.get(anchor.file);
            if (anchor.file === relPath) errors.push(`${relPath}: NEXT UP links the story itself`);
            else if (!date) errors.push(`${relPath}: NEXT UP links ${anchor.path}, which is not a published story`);
            else if (!taxonomy.isDay(date) || date > today) errors.push(`${relPath}: NEXT UP links ${anchor.path}, dated ${date}`);
            else if (discovery.pages.get(anchor.file)?.redirect) errors.push(`${relPath}: NEXT UP links the redirect page ${anchor.path}`);
        }
        for (const anchor of page.hubLinks) {
            if (!approvedFiles.has(anchor.file)) errors.push(`${relPath}: links ${anchor.path}, which is not an approved public topic hub`);
        }
    }
    for (const file of approvedFiles) {
        const links = (discovery.anchors.get(file) || []).filter(target => /^blog-module\/blog-entries\/[^/]+\/article\.html$/.test(target));
        if (!links.length) errors.push(`${file}: an approved topic hub must list its stories`);
    }
    // Reachability over static links from the homepage.
    const reached = new Set(['index.html']);
    const queue = ['index.html'];
    while (queue.length) for (const next of discovery.anchors.get(queue.shift()) || []) {
        if (!reached.has(next) && discovery.anchors.has(next)) { reached.add(next); queue.push(next); }
    }
    for (const url of sitemapUrls) {
        const pathname = new URL(url).pathname;
        let file = pathname;
        try { file = decodeURIComponent(file); } catch (_) { /* keep encoded */ }
        file = file.slice(1);
        if (!file || file.endsWith('/')) file += 'index.html';
        if (discovery.anchors.has(file) && !reached.has(file)) errors.push(`sitemap.xml: ${url} is not reachable from the homepage through static links`);
    }
}

export function validateSearchDestinations(errors, distRoot = DIST_ROOT, approvedFiles = hubs.publicHubFiles()) {
    const rel = 'blog-module/search-destinations.json';
    try {
        const data = search.validateIndex(JSON.parse(fs.readFileSync(path.join(distRoot, rel), 'utf8')));
        for (const record of data.records) {
            const url = new URL(search.destination(record));
            if (url.origin !== SITE_ORIGIN) continue;
            const file = url.pathname.slice(1) + 'index.html';
            if (!fs.existsSync(path.join(distRoot, file))) throw new Error(`Missing destination: ${file}`);
            if (record.type === 'entity' && !approvedFiles.has(file)) throw new Error(`Unapproved hub: ${file}`);
            const html = fs.readFileSync(path.join(distRoot, file), 'utf8');
            if (!html.includes(`rel="canonical" href="${url.href}"`) || /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html)
                || /<meta[^>]+http-equiv=["']refresh["']/i.test(html)) throw new Error(`Noncanonical destination: ${file}`);
        }
        const actual = new Set(data.records.filter(record => record.type === 'entity').map(record => record.href.slice(1) + 'index.html'));
        const expected = [...approvedFiles].filter(file => !file.includes('/page/'));
        if (actual.size !== expected.length || expected.some(file => !actual.has(file))) throw new Error('Search hub records do not match approved public hubs');
    } catch (error) { errors.push(`${rel}: ${error.message}`); }
}

// A retired duplicate is exactly its hand-over page, to an article that is published and listed; it is never listed itself.
function validateRetiredPage(errors, html, relPath, entry, sitemapUrls, indexedArticleUrls) {
    if (html !== injectSecurityMeta(retired.stubHtml(entry), relPath)) errors.push(`${relPath}: retired article must be its hand-over page to ${entry.target}`);
    const target = normalizeSiteUrl(retired.articleUrl(entry.target));
    if (!indexedArticleUrls.has(target) || !sitemapUrls.has(target)) errors.push(`${relPath}: hands over to ${entry.target}, which is not a published article`);
    const own = normalizeSiteUrl(retired.articleUrl(entry.id));
    if (indexedArticleUrls.has(own) || sitemapUrls.has(own)) errors.push(`${relPath}: a retired article must not be listed in the index or sitemap`);
}

function main() {
    if (!fs.existsSync(DIST_ROOT)) {
        console.error('✗ dist/ does not exist. Run `node scripts/build/public-artifact.mjs` first.');
        process.exit(1);
    }

    const errors = [];
    const files = [];
    const editorialRefs = loadEditorialAssetRefs(errors);
    const sitemapUrls = loadSitemapUrls(errors);
    const indexedArticleUrls = loadIndexedArticleUrls(errors);
    const retiredPages = new Map(retired.loadRetired().map(entry => [retired.articlePath(entry.id), entry]));
    for (const relPath of retiredPages.keys()) {
        if (!fs.existsSync(path.join(DIST_ROOT, relPath))) errors.push(`missing retired article hand-over page: ${relPath}`);
    }

    for (const relPath of REQUIRED_EXACT) {
        if (!fs.existsSync(path.join(DIST_ROOT, relPath))) {
            errors.push(`missing required public file: ${relPath}`);
        }
    }

    validateSecurityHeadersFile(errors);
    validateRobots(errors);
    validateCname(errors);
    validateArchiveRuntime(errors);
    validateSearchDestinations(errors);
    validateHomepageHero(errors);
    validateRouteMarkers(errors, editorialRefs);
    const discovery = newDiscovery();

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

        if (/\.html$/i.test(relPath) && retiredPages.has(relPath)) {
            validateRetiredPage(errors, fs.readFileSync(abs, 'utf8'), relPath, retiredPages.get(relPath), sitemapUrls, indexedArticleUrls);
        } else if (/\.html$/i.test(relPath)) {
            const html = fs.readFileSync(abs, 'utf8');
            validateEditorialArticle(errors, html, relPath, editorialRefs);
            validateHtmlSecurityMeta(errors, html, relPath);
            validateHtmlMetadata(errors, html, relPath, sitemapUrls, indexedArticleUrls);
            validateSearchMetadata(errors, html, relPath);
            validateHtmlRefs(errors, abs, relPath);
            validateSpriteRefs(errors, html, relPath);
            collectDiscovery(discovery, html, relPath);
        }
        if (/\.css$/i.test(relPath)) validateCssRefs(errors, abs, relPath);
    });
    validateDiscoveryGraph(errors, discovery, sitemapUrls);
    validateJsRefs(errors, files);

    if (errors.length) {
        console.error('✗ public artifact validation failed:');
        errors.slice(0, 80).forEach(error => console.error(`  - ${error}`));
        if (errors.length > 80) console.error(`  ... ${errors.length - 80} more`);
        process.exit(1);
    }

    const bytes = files.reduce((sum, relPath) => sum + fs.statSync(path.join(DIST_ROOT, relPath)).size, 0);
    console.log(`✓ public artifact validated: ${files.length} files, ${fmtBytes(bytes)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) main();
