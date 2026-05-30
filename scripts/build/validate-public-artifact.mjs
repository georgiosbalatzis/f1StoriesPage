#!/usr/bin/env node
// validate-public-artifact.mjs — fail if dist/ contains private/source clutter.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTENT_SECURITY_POLICY, REFERRER_POLICY } from './security-policy.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const DIST_ROOT = path.join(REPO_ROOT, 'dist');
const MAX_FILE_BYTES = Number(process.env.PUBLIC_ARTIFACT_MAX_BYTES || 2 * 1024 * 1024);

const FORBIDDEN_EXACT = new Set([
    'appdev.txt',
    'generate.html',
    'housekeeping.html',
    'laststeps.txt',
    'nextsteps.txt',
    'package-lock.json',
    'package.json',
    'README.md',
    'blog-module/blog/template.html',
    'blog-module/blog-data.json',
    'scripts/build/asset-manifest.json'
]);

const REQUIRED_EXACT = [
    '.nojekyll',
    '404.html',
    'index.html',
    'manifest.json',
    'offline.html',
    'robots.txt',
    'sitemap.xml',
    'sw.js',
    'blog-module/blog/index.html',
    'standings/index.html',
    'styles.min.css',
    'scripts/sw-register.min.js'
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
    if (/^blog-module\/blog-entries\/.*\/(?:source|gallery)\.txt$/i.test(relPath)) return 'raw article source';
    if (/^blog-module\/blog-entries\/.*\.(?:jpe?g|png)$/i.test(relPath)) return 'raw article image';
    if (/^scripts\/build\//.test(relPath)) return 'build script';
    if (/^blog-module\/build\//.test(relPath)) return 'blog build script';
    if (/\.min\.(?:css|js)\.map$/i.test(relPath)) return 'source map';
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

function assertLocalRefExists(errors, fromRelPath, ref) {
    const rel = resolvePublicPath(fromRelPath, ref);
    if (!rel) return;
    const abs = path.join(DIST_ROOT, rel);
    if (fs.existsSync(abs)) return;
    if (!path.posix.extname(rel) && fs.existsSync(path.join(DIST_ROOT, rel, 'index.html'))) return;
    errors.push(`${fromRelPath}: missing local reference ${ref}`);
}

function validateHtmlRefs(errors, abs, relPath) {
    const html = fs.readFileSync(abs, 'utf8');
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

function main() {
    if (!fs.existsSync(DIST_ROOT)) {
        console.error('✗ dist/ does not exist. Run `node scripts/build/public-artifact.mjs` first.');
        process.exit(1);
    }

    const errors = [];
    const files = [];

    for (const relPath of REQUIRED_EXACT) {
        if (!fs.existsSync(path.join(DIST_ROOT, relPath))) {
            errors.push(`missing required public file: ${relPath}`);
        }
    }

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
