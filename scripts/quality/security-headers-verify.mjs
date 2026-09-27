#!/usr/bin/env node
// security-headers-verify.mjs - check the deployed site's security headers.
//
// For each page it reports, per header, whether the response carries the
// policy from scripts/build/security-policy.mjs, whether an HTML <meta>
// fallback covers it, or whether the hosting layer cannot supply it at all
// (GitHub Pages serves no custom response headers; it ignores dist/_headers).
//
//   npm run security:headers                     # https://f1stories.gr
//   node scripts/quality/security-headers-verify.mjs --base-url https://example.org --json
//
// Exit codes: 0 = every header is served, or covered by the meta fallback, or
// impossible on the detected host (reported, not failed; --strict fails them);
// 1 = a header is wrong, the meta fallback drifted, or a header the host could
// serve is missing; 2 = the site could not be fetched.

import { pathToFileURL } from 'node:url';
import {
    PERMISSIONS_POLICY,
    REFERRER_POLICY,
    X_CONTENT_TYPE_OPTIONS,
    contentSecurityPolicyFor,
    cspProfileForPath,
    parseCsp
} from '../build/security-policy.mjs';

export const DEFAULT_BASE_URL = 'https://f1stories.gr';
export const DEFAULT_PATHS = [
    '/',
    '/blog-module/blog/index.html',
    '/standings/',
    '/generate.html',
    '/housekeeping.html',
    '/analytics/',
    '/statistics.html'
];
export const MIN_HSTS_MAX_AGE = 31536000;

// What each hosting layer can do with response headers. GitHub Pages only
// serves its own fixed header set; `_headers` files are a Netlify/Cloudflare
// Pages convention it ignores.
const HOSTS = {
    'github-pages': { label: 'GitHub Pages', customHeaders: false },
    cloudflare: { label: 'Cloudflare', customHeaders: true },
    netlify: { label: 'Netlify', customHeaders: true },
    unknown: { label: 'unknown host', customHeaders: true }
};

export function detectHost(headers) {
    const server = String(headers.get('server') || '').toLowerCase();
    if (headers.get('cf-ray') || server === 'cloudflare') return 'cloudflare';
    if (headers.get('x-nf-request-id') || server === 'netlify') return 'netlify';
    if (server === 'github.com' || headers.get('x-github-request-id')) return 'github-pages';
    return 'unknown';
}

// URL path → the dist-relative HTML file the build wrote for it.
export function relPathForUrlPath(urlPath) {
    let rel = decodeURIComponent(String(urlPath || '/').split(/[?#]/)[0]).replace(/^\/+/, '');
    if (!rel || rel.endsWith('/')) rel += 'index.html';
    else if (!/\.[a-z0-9]+$/i.test(rel)) rel += '.html';
    return rel;
}

function metaContent(html, attrName, attrValue) {
    const tags = String(html || '').match(/<meta\b[^>]*>/gi) || [];
    for (const tag of tags) {
        const attr = tag.match(new RegExp(`\\b${attrName}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
        if (!attr || attr[2].toLowerCase() !== attrValue.toLowerCase()) continue;
        const content = tag.match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i);
        return content ? decodeEntities(content[2]) : '';
    }
    return null;
}

function decodeEntities(value) {
    return String(value)
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

function normalizeList(value) {
    return String(value || '').split(',').map(part => part.trim().toLowerCase()).filter(Boolean).sort().join(', ');
}

// Directive-level diff, so a report says what is broader or missing.
export function cspDiff(expected, actual) {
    const want = parseCsp(expected);
    const got = parseCsp(actual);
    const diffs = [];
    for (const name of new Set([...want.keys(), ...got.keys()])) {
        const a = new Set(want.get(name) || []);
        const b = new Set(got.get(name) || []);
        if (!want.has(name)) { diffs.push(`+${name}`); continue; }
        if (!got.has(name)) { diffs.push(`-${name}`); continue; }
        const extra = [...b].filter(token => !a.has(token));
        const missing = [...a].filter(token => !b.has(token));
        if (extra.length) diffs.push(`${name} +${extra.join(' +')}`);
        if (missing.length) diffs.push(`${name} -${missing.join(' -')}`);
    }
    return diffs;
}

function sameCsp(expected, actual) {
    return cspDiff(expected, actual).length === 0;
}

function hstsMaxAge(value) {
    const match = String(value || '').match(/max-age\s*=\s*"?(\d+)"?/i);
    return match ? Number(match[1]) : null;
}

// One page response → one row per header. Pure, so tests need no network.
export function evaluatePage({ urlPath, protocol = 'https:', headers, body, host }) {
    const hostInfo = HOSTS[host] || HOSTS.unknown;
    const relPath = relPathForUrlPath(urlPath);
    const expectedCsp = contentSecurityPolicyFor(relPath);
    const rows = [];

    function unsupported(name, detail) {
        return hostInfo.customHeaders
            ? { header: name, status: 'missing', ok: false, detail: `${detail}; ${hostInfo.label} can serve it, so configure it there` }
            : { header: name, status: 'host-limit', ok: true, detail: `${detail}; ${hostInfo.label} cannot serve custom response headers` };
    }

    const csp = headers.get('content-security-policy');
    const metaCsp = metaContent(body, 'http-equiv', 'Content-Security-Policy');
    if (csp) {
        const diff = cspDiff(expectedCsp, csp);
        rows.push(diff.length
            ? { header: 'Content-Security-Policy', status: 'mismatch', ok: false, detail: `header differs from the ${cspProfileForPath(relPath)} policy: ${diff.join('; ')}` }
            : { header: 'Content-Security-Policy', status: 'pass', ok: true, detail: `header matches the ${cspProfileForPath(relPath)} policy` });
    } else if (metaCsp != null && sameCsp(expectedCsp, metaCsp)) {
        rows.push({
            header: 'Content-Security-Policy',
            status: 'meta-fallback',
            ok: true,
            detail: `no header; the <meta> ${cspProfileForPath(relPath)} policy applies (meta cannot express frame-ancestors, sandbox or reporting)`
                + (hostInfo.customHeaders ? `; ${hostInfo.label} could serve it as a header` : `; ${hostInfo.label} cannot serve custom response headers`)
        });
    } else {
        rows.push({
            header: 'Content-Security-Policy',
            status: 'mismatch',
            ok: false,
            detail: metaCsp == null
                ? 'no header and no <meta> fallback'
                : `no header, and the <meta> fallback differs from the ${cspProfileForPath(relPath)} policy: ${cspDiff(expectedCsp, metaCsp).join('; ')}`
        });
    }

    const referrer = headers.get('referrer-policy');
    const metaReferrer = metaContent(body, 'name', 'referrer');
    if (referrer) {
        const ok = normalizeList(referrer).split(', ').pop() === REFERRER_POLICY;
        rows.push({ header: 'Referrer-Policy', status: ok ? 'pass' : 'mismatch', ok, detail: ok ? REFERRER_POLICY : `got "${referrer}", want "${REFERRER_POLICY}"` });
    } else if (metaReferrer === REFERRER_POLICY) {
        rows.push({ header: 'Referrer-Policy', status: 'meta-fallback', ok: true, detail: `no header; <meta name="referrer"> sets ${REFERRER_POLICY}` });
    } else {
        rows.push({ header: 'Referrer-Policy', status: 'mismatch', ok: false, detail: `no header and ${metaReferrer == null ? 'no' : 'a different'} <meta name="referrer">` });
    }

    const xcto = headers.get('x-content-type-options');
    if (xcto) {
        const ok = xcto.trim().toLowerCase() === X_CONTENT_TYPE_OPTIONS;
        rows.push({ header: 'X-Content-Type-Options', status: ok ? 'pass' : 'mismatch', ok, detail: ok ? X_CONTENT_TYPE_OPTIONS : `got "${xcto}"` });
    } else {
        rows.push(unsupported('X-Content-Type-Options', 'no header (there is no <meta> equivalent)'));
    }

    const permissions = headers.get('permissions-policy');
    if (permissions) {
        const ok = normalizeList(permissions) === normalizeList(PERMISSIONS_POLICY);
        rows.push({ header: 'Permissions-Policy', status: ok ? 'pass' : 'mismatch', ok, detail: ok ? 'matches security-policy.mjs' : `got "${permissions}"` });
    } else {
        rows.push(unsupported('Permissions-Policy', 'no header (there is no <meta> equivalent)'));
    }

    const hsts = headers.get('strict-transport-security');
    if (protocol !== 'https:') {
        rows.push({ header: 'Strict-Transport-Security', status: 'not-applicable', ok: true, detail: 'browsers ignore HSTS on plain-HTTP responses' });
    } else if (hsts) {
        const maxAge = hstsMaxAge(hsts);
        const ok = maxAge != null && maxAge >= MIN_HSTS_MAX_AGE;
        rows.push({ header: 'Strict-Transport-Security', status: ok ? 'pass' : 'weak', ok, detail: ok ? hsts : `"${hsts}": max-age below ${MIN_HSTS_MAX_AGE}` });
    } else {
        rows.push(unsupported('Strict-Transport-Security', 'no header (there is no <meta> equivalent)'));
    }

    return { urlPath, relPath, profile: cspProfileForPath(relPath), host, rows };
}

export async function verifySite({ baseUrl = DEFAULT_BASE_URL, paths = DEFAULT_PATHS, fetchImpl = fetch } = {}) {
    const base = new URL(baseUrl);
    const pages = [];
    let host = 'unknown';

    for (const urlPath of paths) {
        const url = new URL(urlPath, base);
        const response = await fetchImpl(url, { redirect: 'follow', headers: { 'user-agent': 'f1stories-security-headers-verify' } });
        const body = await response.text();
        if (!response.ok) throw new Error(`${url.href}: HTTP ${response.status}`);
        host = detectHost(response.headers);
        pages.push(evaluatePage({ urlPath, protocol: new URL(response.url || url.href).protocol, headers: response.headers, body, host }));
    }

    // Plain HTTP must redirect to HTTPS before HSTS can take over.
    let redirect = null;
    if (base.protocol === 'https:') {
        const httpUrl = new URL('/', base);
        httpUrl.protocol = 'http:';
        try {
            const response = await fetchImpl(httpUrl, { redirect: 'manual' });
            const location = response.headers.get('location') || '';
            const ok = response.status >= 300 && response.status < 400 && location.startsWith('https://');
            redirect = { ok, detail: ok ? `${httpUrl.href} → ${response.status} ${location}` : `${httpUrl.href} → HTTP ${response.status} without an HTTPS redirect` };
        } catch (error) {
            redirect = { ok: false, detail: `${httpUrl.href}: ${error.message}` };
        }
    }

    return { baseUrl: base.href, host, hostLabel: (HOSTS[host] || HOSTS.unknown).label, pages, redirect };
}

export function summarize(report, { strict = false } = {}) {
    const failures = [];
    const limits = [];
    for (const page of report.pages) {
        for (const row of page.rows) {
            const line = `${page.urlPath} ${row.header}: ${row.detail}`;
            if (!row.ok) failures.push(line);
            else if (row.status === 'host-limit' || row.status === 'meta-fallback') limits.push(line);
        }
    }
    if (report.redirect && !report.redirect.ok) failures.push(`HTTP→HTTPS: ${report.redirect.detail}`);
    const exitCode = failures.length || (strict && limits.length) ? 1 : 0;
    return { failures, limits, exitCode };
}

function printReport(report, summary) {
    console.log(`Security headers for ${report.baseUrl} (host: ${report.hostLabel})`);
    for (const page of report.pages) {
        console.log(`\n${page.urlPath}  [CSP profile: ${page.profile}]`);
        for (const row of page.rows) {
            console.log(`  ${row.ok ? (row.status === 'pass' ? '✓' : '·') : '✗'} ${row.header.padEnd(26)} ${row.status.padEnd(14)} ${row.detail}`);
        }
    }
    if (report.redirect) console.log(`\n${report.redirect.ok ? '✓' : '✗'} HTTP→HTTPS  ${report.redirect.detail}`);

    const hostLimited = summary.limits.some(line => /cannot serve custom response headers/.test(line));
    if (hostLimited) {
        console.log(`\n${report.hostLabel} cannot add response headers, so HSTS, X-Content-Type-Options and`
            + ' Permissions-Policy are not served, and CSP/Referrer-Policy rely on the <meta> fallback.'
            + ' To serve them: proxy the domain through Cloudflare and add the values from dist/_headers as a'
            + ' Response Header Transform Rule, or deploy dist/ to a host that applies _headers.');
    }
    console.log(summary.failures.length
        ? `\n✗ ${summary.failures.length} problem(s)`
        : `\n✓ no drift; ${summary.limits.length} item(s) limited by the hosting layer or covered by <meta>`);
}

function parseArgs(argv) {
    const args = { baseUrl: DEFAULT_BASE_URL, paths: null, json: false, strict: false };
    for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--base-url') args.baseUrl = argv[++i];
        else if (arg === '--path') (args.paths = args.paths || []).push(argv[++i]);
        else if (arg === '--json') args.json = true;
        else if (arg === '--strict') args.strict = true;
    }
    return args;
}

async function main() {
    const args = parseArgs(process.argv);
    let report;
    try {
        report = await verifySite({ baseUrl: args.baseUrl, paths: args.paths || DEFAULT_PATHS });
    } catch (error) {
        console.error(`✗ could not fetch ${args.baseUrl}: ${error.cause?.message || error.message}`);
        process.exit(2);
    }
    const summary = summarize(report, { strict: args.strict });
    if (args.json) console.log(JSON.stringify({ ...report, ...summary }, null, 2));
    else printReport(report, summary);
    process.exit(summary.exitCode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main();
}
