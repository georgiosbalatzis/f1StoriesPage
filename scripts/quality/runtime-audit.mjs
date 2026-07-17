#!/usr/bin/env node
// runtime-audit.mjs - validate the generated dist/ runtime boundary.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTENT_SECURITY_POLICY } from '../build/security-policy.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const DIST_ROOT = path.join(REPO_ROOT, 'dist');

const FORBIDDEN_DIST_PATHS = [
    /^node_modules\//,
    /^(?:generate|housekeeping|statistics)\.html$/,
    /^scripts\/author\//,
    /^scripts\/author\/__tests__(?:\/|$)/,
    /^scripts\/author\/serve-tools\.mjs$/,
    /^context\.md$/,
    /^appdev\.txt$/,
    /(?:^|\/)(?:nextsteps|laststeps)\.txt$/,
    /^blog-module\/blog-data\.json$/,
    /^scripts\/build(?:\/|$)/,
    /^\.github(?:\/|$)/,
    /^\.idea(?:\/|$)/
];

const FORBIDDEN_TEXT = [
    {
        pattern: /cdn\.jsdelivr\.net\/npm\/jszip/i,
        reason: 'remote JSZip CDN reference'
    },
    {
        pattern: /https:\/\/unpkg\.com/i,
        reason: 'remote unpkg runtime dependency'
    },
    {
        pattern: /https:\/\/fonts\.(?:googleapis|gstatic)\.com/i,
        reason: 'remote Google Fonts dependency'
    },
    {
        pattern: /https:\/\/cdnjs\.cloudflare\.com/i,
        reason: 'remote CDNJS dependency'
    },
    {
        pattern: /\/git\/refs\/heads\/main/i,
        reason: 'direct GitHub main branch mutation endpoint'
    }
];

const INLINE_SCRIPT_TYPES = new Set([
    '',
    'text/javascript',
    'application/javascript',
    'application/ecmascript',
    'text/ecmascript',
    'module'
]);

const errors = [];

function toPosix(relPath) {
    return relPath.split(path.sep).join('/');
}

function walk(dir, prefix = '') {
    const rows = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        const absPath = path.join(dir, entry.name);
        if (entry.isDirectory()) rows.push(...walk(absPath, relPath));
        else if (entry.isFile()) rows.push(toPosix(relPath));
    }
    return rows.sort();
}

function stripHtmlComments(text) {
    return String(text || '').replace(/<!--[\s\S]*?-->/g, '');
}

function attrValue(tag, name) {
    const match = String(tag).match(new RegExp(`\\b${name}=(["'])(.*?)\\1`, 'i'));
    return match ? match[2].trim().toLowerCase() : '';
}

function checkCsp() {
    const directives = new Map();
    CONTENT_SECURITY_POLICY.split(';').forEach(part => {
        const tokens = part.trim().split(/\s+/).filter(Boolean);
        if (tokens.length) directives.set(tokens[0], tokens.slice(1));
    });

    const scriptSrc = directives.get('script-src') || [];
    if (scriptSrc.includes("'unsafe-inline'")) {
        errors.push('scripts/build/security-policy.mjs: script-src must not allow unsafe-inline');
    }
    if (scriptSrc.includes('https://www.google-analytics.com')) {
        errors.push('scripts/build/security-policy.mjs: google-analytics.com must stay connect-only');
    }
    if ((directives.get('script-src-attr') || []).join(' ') !== "'none'") {
        errors.push('scripts/build/security-policy.mjs: script-src-attr must stay none');
    }

    [
        'https://api.github.com',
        'https://accounts.google.com',
        'https://analyticsdata.googleapis.com',
        'https://oauth2.googleapis.com',
        'blob:'
    ].forEach(source => {
        if (CONTENT_SECURITY_POLICY.includes(source)) {
            errors.push(`scripts/build/security-policy.mjs: visitor CSP must not include author-only source ${source}`);
        }
    });
}

function checkHtml(relPath, html) {
    const htmlWithoutScripts = stripHtmlComments(html).replace(/<script\b[\s\S]*?<\/script>/gi, '');
    const tags = htmlWithoutScripts.matchAll(/<([a-z][a-z0-9:-]*)(?:\s[^<>]*)?>/gi);
    for (const match of tags) {
        const attr = match[0].match(/\s(on[a-z][\w:-]*)\s*=\s*(["'])/i);
        if (attr) errors.push(`${relPath}: inline event handler "${attr[1]}" is not allowed in dist`);
    }

    let index = 0;
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        index += 1;
        const attrs = match[1] || '';
        if (/\bsrc\s*=/i.test(attrs)) continue;
        if (!INLINE_SCRIPT_TYPES.has(attrValue(attrs, 'type'))) continue;
        const body = stripHtmlComments(match[2] || '').trim();
        if (body) errors.push(`${relPath}: executable inline script #${index} is not allowed in dist`);
    }
}

function main() {
    if (!fs.existsSync(DIST_ROOT)) {
        errors.push('dist/: missing. Run npm run build:public before npm run audit:runtime.');
    } else {
        const files = walk(DIST_ROOT);
        for (const relPath of files) {
            for (const pattern of FORBIDDEN_DIST_PATHS) {
                if (pattern.test(relPath)) errors.push(`${relPath}: forbidden public artifact path`);
            }

            if (!/\.(?:html|js|css|json|xml|svg|txt|webmanifest)$/i.test(relPath)) continue;
            const text = fs.readFileSync(path.join(DIST_ROOT, relPath), 'utf8');
            for (const rule of FORBIDDEN_TEXT) {
                if (rule.pattern.test(text)) errors.push(`${relPath}: ${rule.reason}`);
            }
            if (/\.html$/i.test(relPath)) checkHtml(relPath, text);
        }
    }

    checkCsp();

    if (errors.length) {
        console.error('Runtime audit failed:');
        errors.forEach(error => console.error(`- ${error}`));
        process.exit(1);
    }

    console.log('Runtime audit passed: dist/ contains only visitor-facing files, no inline handlers, executable inline scripts, or banned remote runtime dependencies.');
}

main();
