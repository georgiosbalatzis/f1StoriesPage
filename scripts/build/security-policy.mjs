export const REFERRER_POLICY = 'strict-origin-when-cross-origin';

export const PERMISSIONS_POLICY = [
    'accelerometer=()',
    'ambient-light-sensor=()',
    'camera=()',
    'display-capture=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
    'payment=()',
    'usb=()'
].join(', ');

export const X_CONTENT_TYPE_OPTIONS = 'nosniff';

export const STRICT_TRANSPORT_SECURITY = 'max-age=31536000; includeSubDomains';

// Public pages: articles, archive, standings, home, legal. Analytics (after
// consent), comments and social embeds need the third-party origins below.
export const CONTENT_SECURITY_POLICY = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self' https://formspree.io",
    "script-src 'self' https://www.googletagmanager.com https://accounts.google.com https://f1stories-gr.disqus.com https://*.disqus.com https://*.disquscdn.com https://connect.facebook.net https://platform.twitter.com https://www.instagram.com https://www.threads.net",
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://api.github.com https://api.jolpi.ca https://api.openf1.org https://analyticsdata.googleapis.com https://oauth2.googleapis.com https://formspree.io https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://stats.g.doubleclick.net https://f1stories-gr.disqus.com https://*.disqus.com https://*.disquscdn.com https://connect.facebook.net https://www.facebook.com https://platform.twitter.com https://syndication.twitter.com https://twitter.com https://*.twitter.com https://x.com https://*.x.com https://www.instagram.com https://www.threads.net",
    "frame-src 'self' https://accounts.google.com https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://open.spotify.com https://player.vimeo.com https://codepen.io https://datawrapper.dwcdn.net https://sketchfab.com https://www.sketchfab.com https://facebook.com https://www.facebook.com https://platform.twitter.com https://syndication.twitter.com https://www.instagram.com https://instagram.com https://threads.net https://www.threads.net https://f1stories.gr https://www.f1stories.gr https://georgiosbalatzis.github.io https://f1stories-gr.disqus.com https://disqus.com",
    "worker-src 'self' blob:",
    "manifest-src 'none'", // browser-only site: no installable app manifest
    "media-src 'self' https:",
    'upgrade-insecure-requests'
].join('; ');

// Directives shared by the privileged tool pages. No page here has a form,
// a <base>, a worker, media or a manifest, and none may run inline script.
const TOOL_BASE_DIRECTIVES = [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'none'",
    "script-src-attr 'none'",
    // Generated critical CSS and runtime style attributes (as on public pages).
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "font-src 'self'",
    "worker-src 'none'",
    "manifest-src 'none'",
    "media-src 'none'",
    'upgrade-insecure-requests'
];

// housekeeping.html: holds the GitHub token. It talks only to the GitHub REST
// API and shows local or just-picked (blob:) images. Nothing third-party runs.
export const AUTHOR_TOOLS_CSP = [
    ...TOOL_BASE_DIRECTIVES,
    "script-src 'self'",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://api.github.com",
    "frame-src 'none'"
].join('; ');

// generate.html: the same token boundary, plus the live article preview.
// The preview renders YouTube and whitelisted raw iframes (IFRAME_WHITELIST in
// scripts/author/generate-page.js) and loads the X, Instagram, Threads and
// Facebook embed SDKs (processSocialEmbeds). Those SDKs run in this page, so
// they are the reason script-src and connect-src are wider than housekeeping.
// Every origin here is also allowed by the public policy.
export const AUTHOR_GENERATE_CSP = [
    ...TOOL_BASE_DIRECTIVES,
    "script-src 'self' https://platform.twitter.com https://www.instagram.com https://www.threads.net https://connect.facebook.net",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://api.github.com https://platform.twitter.com https://syndication.twitter.com https://twitter.com https://*.twitter.com https://x.com https://*.x.com https://www.instagram.com https://www.threads.net https://connect.facebook.net https://www.facebook.com",
    "frame-src https://www.youtube.com https://youtube.com https://open.spotify.com https://player.vimeo.com https://codepen.io https://datawrapper.dwcdn.net https://sketchfab.com https://www.sketchfab.com https://facebook.com https://www.facebook.com https://platform.twitter.com https://syndication.twitter.com https://www.instagram.com https://instagram.com https://threads.net https://www.threads.net https://f1stories.gr https://www.f1stories.gr https://georgiosbalatzis.github.io"
].join('; ');

export const CSP_PROFILES = Object.freeze({
    public: CONTENT_SECURITY_POLICY,
    'author-tools': AUTHOR_TOOLS_CSP,
    'author-generate': AUTHOR_GENERATE_CSP
});

// dist-relative HTML path → CSP profile. Everything else is public.
export const PAGE_CSP_PROFILES = Object.freeze({
    'generate.html': 'author-generate',
    'housekeeping.html': 'author-tools'
});

export function cspProfileForPath(relPath) {
    const clean = String(relPath || '').replace(/^\/+/, '');
    return PAGE_CSP_PROFILES[clean] || 'public';
}

export function contentSecurityPolicyFor(relPath) {
    return CSP_PROFILES[cspProfileForPath(relPath)];
}

// "a b; c d" → Map { a => [b], c => [d] }. Directive names are lower-cased;
// the first occurrence of a directive wins, as in browsers.
export function parseCsp(policy) {
    const directives = new Map();
    String(policy || '').split(';').forEach(part => {
        const tokens = part.trim().split(/\s+/).filter(Boolean);
        if (!tokens.length) return;
        const name = tokens[0].toLowerCase();
        if (!directives.has(name)) directives.set(name, tokens.slice(1));
    });
    return directives;
}

export const SECURITY_HEADERS = [
    ['Content-Security-Policy', CONTENT_SECURITY_POLICY],
    ['Referrer-Policy', REFERRER_POLICY],
    ['Permissions-Policy', PERMISSIONS_POLICY],
    ['X-Content-Type-Options', X_CONTENT_TYPE_OPTIONS],
    ['Strict-Transport-Security', STRICT_TRANSPORT_SECURITY]
];

function escapeHtmlAttribute(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Netlify / Cloudflare Pages `_headers`. GitHub Pages ignores this file.
// A tool page also matches `/*`; hosts then send both CSP headers and browsers
// enforce both, so each tool page gets its own, narrower policy.
export function securityHeadersText() {
    const blocks = [[
        '/*',
        ...SECURITY_HEADERS.map(([name, value]) => `  ${name}: ${value}`)
    ].join('\n')];
    for (const [relPath, profile] of Object.entries(PAGE_CSP_PROFILES)) {
        const route = `/${relPath}`;
        for (const pattern of [route, route.replace(/\.html$/, '')]) {
            blocks.push(`${pattern}\n  Content-Security-Policy: ${CSP_PROFILES[profile]}`);
        }
    }
    return blocks.join('\n') + '\n';
}

export function securityMetaHtml(indent = '', relPath = '') {
    return [
        `${indent}<!-- f1s:security-meta:begin -->`,
        `${indent}<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttribute(contentSecurityPolicyFor(relPath))}">`,
        `${indent}<meta name="referrer" content="${escapeHtmlAttribute(REFERRER_POLICY)}">`,
        `${indent}<!-- f1s:security-meta:end -->`
    ].join('\n');
}

export function stripSecurityMeta(html) {
    return String(html)
        .replace(/^[ \t]*<!-- f1s:security-meta:begin -->[\s\S]*?<!-- f1s:security-meta:end -->[ \t]*\r?\n?/gim, '')
        .replace(/^[ \t]*<meta\b(?=[^>]*\bhttp-equiv=["']Content-Security-Policy["'])[^>]*>[ \t]*\r?\n?/gim, '')
        .replace(/^[ \t]*<meta\b(?=[^>]*\bname=["']referrer["'])[^>]*>[ \t]*\r?\n?/gim, '');
}

// Replace whatever security meta a page carries with the policy for its path,
// so a tool page never ships with the broader public policy.
export function injectSecurityMeta(html, relPath = '') {
    const nextHtml = stripSecurityMeta(html);
    const block = securityMetaHtml('    ', relPath);

    if (/<meta\s+charset=["'][^"']+["']>/i.test(nextHtml)) {
        return nextHtml.replace(/(<meta\s+charset=["'][^"']+["']>)/i, `$1\n${block}`);
    }

    return nextHtml.replace(/(<head\b[^>]*>\s*)/i, `$1\n${block}\n`);
}
