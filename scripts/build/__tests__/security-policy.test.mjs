// Guards the per-page Content-Security-Policy profiles.
//
// The tool pages (generate, housekeeping, statistics) handle credentials: the
// GitHub token or a Google OAuth access token. Their policies are pinned here
// source by source. Widening one fails this test until the pinned list below
// is changed in the same review, with the reason next to the new origin.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    AUTHOR_GENERATE_CSP,
    AUTHOR_TOOLS_CSP,
    CONTENT_SECURITY_POLICY,
    CSP_PROFILES,
    PAGE_CSP_PROFILES,
    REFERRER_POLICY,
    STATISTICS_CSP,
    contentSecurityPolicyFor,
    cspProfileForPath,
    injectSecurityMeta,
    parseCsp,
    securityHeadersText,
    securityMetaHtml
} from '../security-policy.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const TOOL_BASE = {
    'default-src': ["'self'"],
    'base-uri': ["'none'"],
    'object-src': ["'none'"],
    'form-action': ["'none'"],
    'script-src-attr': ["'none'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'style-src-attr': ["'unsafe-inline'"],
    'font-src': ["'self'"],
    'worker-src': ["'none'"],
    'manifest-src': ["'none'"],
    'media-src': ["'none'"],
    'upgrade-insecure-requests': []
};

// The reviewed allowlists. Keep sorted.
const REVIEWED = {
    'author-tools': {
        ...TOOL_BASE,
        'script-src': ["'self'"],
        'img-src': ["'self'", 'blob:', 'data:'],
        'connect-src': ["'self'", 'https://api.github.com'],
        'frame-src': ["'none'"]
    },
    'author-generate': {
        ...TOOL_BASE,
        // Embed SDKs of the live preview (processSocialEmbeds in generate-page.js).
        'script-src': ["'self'", 'https://connect.facebook.net', 'https://platform.twitter.com', 'https://www.instagram.com', 'https://www.threads.net'],
        'img-src': ["'self'", 'blob:', 'data:'],
        'connect-src': [
            "'self'",
            'https://*.twitter.com',
            'https://*.x.com',
            'https://api.github.com',
            'https://connect.facebook.net',
            'https://platform.twitter.com',
            'https://syndication.twitter.com',
            'https://twitter.com',
            'https://www.facebook.com',
            'https://www.instagram.com',
            'https://www.threads.net',
            'https://x.com'
        ],
        // YouTube, IFRAME_WHITELIST in generate-page.js, and the SDK iframes.
        'frame-src': [
            'https://codepen.io',
            'https://datawrapper.dwcdn.net',
            'https://f1stories.gr',
            'https://facebook.com',
            'https://georgiosbalatzis.github.io',
            'https://instagram.com',
            'https://open.spotify.com',
            'https://platform.twitter.com',
            'https://player.vimeo.com',
            'https://sketchfab.com',
            'https://syndication.twitter.com',
            'https://threads.net',
            'https://www.f1stories.gr',
            'https://www.facebook.com',
            'https://www.instagram.com',
            'https://www.sketchfab.com',
            'https://www.threads.net',
            'https://www.youtube.com',
            'https://youtube.com'
        ]
    },
    statistics: {
        ...TOOL_BASE,
        'script-src': ["'self'", 'https://accounts.google.com'],
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'", 'https://analyticsdata.googleapis.com', 'https://api.github.com', 'https://oauth2.googleapis.com'],
        'frame-src': ['https://accounts.google.com']
    }
};

const TOOL_PROFILES = Object.keys(REVIEWED);

// Without these, a missing directive is unrestricted (no default-src fallback)
// or silently falls back to default-src; tool policies spell every one out.
const REQUIRED_DIRECTIVES = Object.keys(REVIEWED['author-tools']);

// Origins whose code or beacons have no business on a page holding a token.
const FORBIDDEN_ON_TOOL_PAGES = [
    /googletagmanager\.com/,
    /google-analytics\.com/,
    /analytics\.google\.com/,
    /doubleclick\.net/,
    /disqus/,
    /formspree\.io/,
    /jsdelivr\.net/,
    /unpkg\.com/,
    /cdnjs\./,
    /jolpi\.ca/,
    /openf1\.org/
];

function asObject(policy) {
    return Object.fromEntries([...parseCsp(policy)].map(([name, tokens]) => [name, [...tokens].sort()]));
}

// Every source a tool directive allows must also be allowed, literally, by the
// same public directive ('none' allows nothing). Directive-less keywords pass.
function notBroaderThanPublic(profilePolicy) {
    const pub = parseCsp(CONTENT_SECURITY_POLICY);
    const problems = [];
    for (const [name, tokens] of parseCsp(profilePolicy)) {
        if (!tokens.length || (tokens.length === 1 && tokens[0] === "'none'")) continue;
        const allowed = new Set(pub.get(name) || pub.get('default-src') || []);
        tokens.filter(token => !allowed.has(token)).forEach(token => problems.push(`${name} ${token}`));
    }
    return problems;
}

test('the public policy is unchanged by the profile split', () => {
    assert.equal(CSP_PROFILES.public, CONTENT_SECURITY_POLICY);
    assert.match(CONTENT_SECURITY_POLICY, /^default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self' https:\/\/formspree\.io;/);
});

test('tool pages map to their own profiles; everything else is public', () => {
    assert.deepEqual({ ...PAGE_CSP_PROFILES }, {
        'generate.html': 'author-generate',
        'housekeeping.html': 'author-tools',
        'statistics.html': 'statistics',
        'analytics/index.html': 'statistics'
    });
    assert.equal(contentSecurityPolicyFor('generate.html'), AUTHOR_GENERATE_CSP);
    assert.equal(contentSecurityPolicyFor('/housekeeping.html'), AUTHOR_TOOLS_CSP);
    assert.equal(contentSecurityPolicyFor('statistics.html'), STATISTICS_CSP);
    for (const relPath of ['index.html', '404.html', 'standings/index.html', 'blog-module/blog-entries/20260926G/article.html', 'privacy/generate.html', '']) {
        assert.equal(cspProfileForPath(relPath), 'public', relPath);
    }
});

for (const profile of TOOL_PROFILES) {
    test(`${profile}: matches the reviewed allowlist exactly`, () => {
        assert.deepEqual(asObject(CSP_PROFILES[profile]), REVIEWED[profile],
            `${profile} CSP changed. If intended, update REVIEWED in this test with the reason for each new source.`);
    });

    test(`${profile}: sets every directive that would otherwise be open or implicit`, () => {
        const directives = parseCsp(CSP_PROFILES[profile]);
        for (const name of REQUIRED_DIRECTIVES) assert.ok(directives.has(name), `${profile} must set ${name}`);
    });

    test(`${profile}: is never broader than the public policy`, () => {
        assert.deepEqual(notBroaderThanPublic(CSP_PROFILES[profile]), []);
    });

    test(`${profile}: allows no inline, eval, scheme-wide or wildcard script`, () => {
        const directives = parseCsp(CSP_PROFILES[profile]);
        for (const name of ['script-src', 'default-src']) {
            for (const token of directives.get(name) || []) {
                assert.doesNotMatch(token, /^'(?:unsafe-inline|unsafe-eval|unsafe-hashes|wasm-unsafe-eval|strict-dynamic)'$/, `${name} ${token}`);
                assert.doesNotMatch(token, /^(?:\*|https?:|data:|blob:|filesystem:)$/, `${name} ${token}`);
                assert.doesNotMatch(token, /\*/, `${name} ${token}`);
            }
        }
        for (const name of ['connect-src', 'frame-src', 'img-src']) {
            for (const token of directives.get(name) || []) {
                assert.doesNotMatch(token, /^(?:\*|https?:|http:\/\/.*)$/, `${name} ${token}`);
            }
        }
    });

    test(`${profile}: loads nothing from analytics, ads, comments, CDNs or F1 data APIs`, () => {
        for (const pattern of FORBIDDEN_ON_TOOL_PAGES) {
            assert.doesNotMatch(CSP_PROFILES[profile], pattern);
        }
    });
}

test('only author tools and the analytics token gate may reach the GitHub API', () => {
    for (const profile of ['author-tools', 'author-generate', 'statistics']) {
        assert.ok(parseCsp(CSP_PROFILES[profile]).get('connect-src').includes('https://api.github.com'), profile);
    }
    assert.match(STATISTICS_CSP, /api\.github\.com/);
    assert.deepEqual(parseCsp(AUTHOR_TOOLS_CSP).get('connect-src'), ["'self'", 'https://api.github.com']);
});

test('injectSecurityMeta gives each page its own policy and drops any other', () => {
    const publicBlock = securityMetaHtml('    ', 'index.html');
    const pages = {
        'with public block': `<!DOCTYPE html>\n<html>\n<head>\n    <meta charset="UTF-8">\n${publicBlock}\n    <title>x</title>\n</head>\n</html>\n`,
        'with bare meta': `<!DOCTYPE html>\n<html>\n<head>\n    <meta charset="UTF-8">\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">\n    <meta name="referrer" content="no-referrer">\n</head>\n</html>\n`,
        'without meta': '<!DOCTYPE html>\n<html>\n<head>\n    <title>x</title>\n</head>\n</html>\n'
    };
    for (const [label, html] of Object.entries(pages)) {
        for (const relPath of ['generate.html', 'housekeeping.html', 'statistics.html', 'index.html']) {
            const out = injectSecurityMeta(html, relPath);
            const csps = [...out.matchAll(/http-equiv="Content-Security-Policy" content="([^"]*)"/g)].map(m => m[1]);
            assert.deepEqual(csps, [contentSecurityPolicyFor(relPath)], `${label} / ${relPath}`);
            assert.equal([...out.matchAll(/<meta name="referrer" content="([^"]*)"/g)].map(m => m[1]).join(), REFERRER_POLICY, `${label} / ${relPath}`);
            // Every shipped page has <meta charset>; the no-charset fallback only inserts.
            if (/<meta charset/.test(html)) assert.equal(injectSecurityMeta(out, relPath), out, `idempotent: ${label} / ${relPath}`);
        }
    }
});

test('tool page sources carry the same security block the artifact ships', () => {
    for (const relPath of Object.keys(PAGE_CSP_PROFILES)) {
        const html = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
        assert.ok(html.includes(securityMetaHtml('    ', relPath)), `${relPath}: run injectSecurityMeta on the source`);
        assert.equal((html.match(/http-equiv="Content-Security-Policy"/g) || []).length, 1, relPath);
    }
});

test('_headers keeps the public rule and adds each tool page policy', () => {
    const text = securityHeadersText();
    assert.ok(text.startsWith(`/*\n  Content-Security-Policy: ${CONTENT_SECURITY_POLICY}\n`));
    for (const [relPath, profile] of Object.entries(PAGE_CSP_PROFILES)) {
        for (const route of [`/${relPath}`, `/${relPath.replace(/\.html$/, '')}`]) {
            assert.ok(text.includes(`\n${route}\n  Content-Security-Policy: ${CSP_PROFILES[profile]}\n`), route);
        }
    }
});
