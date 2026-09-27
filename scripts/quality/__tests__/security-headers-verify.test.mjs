import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import {
    PERMISSIONS_POLICY,
    REFERRER_POLICY,
    STRICT_TRANSPORT_SECURITY,
    contentSecurityPolicyFor,
    securityMetaHtml
} from '../../build/security-policy.mjs';
import {
    cspDiff,
    detectHost,
    evaluatePage,
    relPathForUrlPath,
    summarize,
    verifySite
} from '../security-headers-verify.mjs';

function page(relPath, extraHead = '') {
    return `<!DOCTYPE html>\n<html>\n<head>\n    <meta charset="UTF-8">\n${securityMetaHtml('    ', relPath)}\n${extraHead}</head><body></body></html>`;
}

const GITHUB_PAGES = new Headers({ server: 'GitHub.com', 'x-github-request-id': 'A:B', 'content-type': 'text/html' });

function fullHeaders(relPath) {
    return new Headers({
        server: 'cloudflare',
        'cf-ray': '1',
        'content-security-policy': contentSecurityPolicyFor(relPath),
        'referrer-policy': REFERRER_POLICY,
        'permissions-policy': PERMISSIONS_POLICY,
        'x-content-type-options': 'nosniff',
        'strict-transport-security': STRICT_TRANSPORT_SECURITY
    });
}

function byHeader(result) {
    return Object.fromEntries(result.rows.map(row => [row.header, row]));
}

test('maps URL paths to the files the build wrote', () => {
    assert.equal(relPathForUrlPath('/'), 'index.html');
    assert.equal(relPathForUrlPath('/standings/'), 'standings/index.html');
    assert.equal(relPathForUrlPath('/generate'), 'generate.html');
    assert.equal(relPathForUrlPath('/generate.html?x=1'), 'generate.html');
    assert.equal(relPathForUrlPath('/blog-module/blog/index.html'), 'blog-module/blog/index.html');
});

test('detects the hosting layer', () => {
    assert.equal(detectHost(GITHUB_PAGES), 'github-pages');
    assert.equal(detectHost(new Headers({ 'cf-ray': 'x', server: 'cloudflare' })), 'cloudflare');
    assert.equal(detectHost(new Headers({ server: 'Netlify' })), 'netlify');
    assert.equal(detectHost(new Headers({ server: 'nginx' })), 'unknown');
});

test('GitHub Pages: meta fallback passes, unsupplied headers are reported as host limits', () => {
    for (const urlPath of ['/', '/generate.html', '/housekeeping.html', '/statistics.html']) {
        const relPath = relPathForUrlPath(urlPath);
        const result = evaluatePage({ urlPath, headers: GITHUB_PAGES, body: page(relPath), host: 'github-pages' });
        const rows = byHeader(result);
        assert.equal(rows['Content-Security-Policy'].status, 'meta-fallback', urlPath);
        assert.equal(rows['Referrer-Policy'].status, 'meta-fallback', urlPath);
        for (const header of ['X-Content-Type-Options', 'Permissions-Policy', 'Strict-Transport-Security']) {
            assert.equal(rows[header].status, 'host-limit', `${urlPath} ${header}`);
            assert.match(rows[header].detail, /GitHub Pages cannot serve custom response headers/);
        }
        assert.ok(result.rows.every(row => row.ok), urlPath);
    }
});

test('a tool page shipping the public CSP is a failure, with the broader sources named', () => {
    const result = evaluatePage({ urlPath: '/generate.html', headers: GITHUB_PAGES, body: page('index.html'), host: 'github-pages' });
    const csp = byHeader(result)['Content-Security-Policy'];
    assert.equal(csp.ok, false);
    assert.match(csp.detail, /script-src \+https:\/\/www\.googletagmanager\.com/);
});

test('missing meta and missing header fail', () => {
    const result = evaluatePage({ urlPath: '/', headers: GITHUB_PAGES, body: '<html><head></head></html>', host: 'github-pages' });
    const rows = byHeader(result);
    assert.equal(rows['Content-Security-Policy'].ok, false);
    assert.equal(rows['Referrer-Policy'].ok, false);
});

test('a header-capable host with every header passes; a missing one fails', () => {
    const all = evaluatePage({ urlPath: '/housekeeping.html', headers: fullHeaders('housekeeping.html'), body: page('housekeeping.html'), host: 'cloudflare' });
    assert.ok(all.rows.every(row => row.status === 'pass'), JSON.stringify(all.rows));

    const headers = fullHeaders('index.html');
    headers.delete('x-content-type-options');
    headers.set('strict-transport-security', 'max-age=600');
    const rows = byHeader(evaluatePage({ urlPath: '/', headers, body: page('index.html'), host: 'cloudflare' }));
    assert.equal(rows['X-Content-Type-Options'].status, 'missing');
    assert.equal(rows['X-Content-Type-Options'].ok, false);
    assert.equal(rows['Strict-Transport-Security'].status, 'weak');
});

test('HSTS is not expected on plain HTTP', () => {
    const rows = byHeader(evaluatePage({ urlPath: '/', protocol: 'http:', headers: GITHUB_PAGES, body: page('index.html'), host: 'github-pages' }));
    assert.equal(rows['Strict-Transport-Security'].status, 'not-applicable');
});

test('cspDiff names added and removed sources per directive', () => {
    assert.deepEqual(cspDiff("script-src 'self'; img-src 'self'", "script-src 'self' https://a.test; frame-src 'none'"), [
        'script-src +https://a.test',
        '-img-src',
        '+frame-src'
    ]);
});

test('summarize: host limits pass by default and fail with --strict', () => {
    const report = { pages: [evaluatePage({ urlPath: '/', headers: GITHUB_PAGES, body: page('index.html'), host: 'github-pages' })], redirect: { ok: true } };
    assert.equal(summarize(report).exitCode, 0);
    assert.ok(summarize(report).limits.length >= 3);
    assert.equal(summarize(report, { strict: true }).exitCode, 1);
    assert.equal(summarize({ ...report, redirect: { ok: false, detail: 'no redirect' } }).exitCode, 1);
});

test('verifySite fetches every page from a live server', async () => {
    const server = http.createServer((req, res) => {
        const relPath = relPathForUrlPath(req.url);
        res.writeHead(200, { server: 'GitHub.com', 'content-type': 'text/html' });
        res.end(page(relPath));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const report = await verifySite({ baseUrl: `http://127.0.0.1:${server.address().port}`, paths: ['/', '/generate.html', '/statistics.html'] });
        assert.equal(report.host, 'github-pages');
        assert.equal(report.pages.length, 3);
        assert.equal(report.redirect, null, 'no HTTP→HTTPS probe for an http base URL');
        assert.equal(summarize(report).exitCode, 0);
        assert.equal(report.pages[1].profile, 'author-generate');
    } finally {
        server.close();
    }
});
