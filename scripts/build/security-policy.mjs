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

export const CONTENT_SECURITY_POLICY = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self' https://formspree.io",
    "script-src 'self' https://www.googletagmanager.com https://f1stories-gr.disqus.com https://*.disqus.com https://*.disquscdn.com https://connect.facebook.net https://platform.twitter.com https://www.instagram.com https://www.threads.net",
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.jolpi.ca https://api.openf1.org https://formspree.io https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://stats.g.doubleclick.net https://f1stories-gr.disqus.com https://*.disqus.com https://*.disquscdn.com https://connect.facebook.net https://www.facebook.com https://platform.twitter.com https://syndication.twitter.com https://twitter.com https://*.twitter.com https://x.com https://*.x.com https://www.instagram.com https://www.threads.net",
    "frame-src 'self' https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://open.spotify.com https://player.vimeo.com https://codepen.io https://datawrapper.dwcdn.net https://sketchfab.com https://www.sketchfab.com https://facebook.com https://www.facebook.com https://platform.twitter.com https://syndication.twitter.com https://www.instagram.com https://instagram.com https://threads.net https://www.threads.net https://f1stories.gr https://www.f1stories.gr https://georgiosbalatzis.github.io https://f1stories-gr.disqus.com https://disqus.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self' https:",
    'upgrade-insecure-requests'
].join('; ');

// Local editorial tools are served only by scripts/author/serve-tools.mjs.
// Keep their token, OAuth, and blob/image permissions out of visitor pages.
export const AUTHOR_CONTENT_SECURITY_POLICY = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'none'",
    "script-src 'self' https://accounts.google.com https://platform.twitter.com https://www.instagram.com https://www.threads.net",
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://api.github.com https://analyticsdata.googleapis.com https://oauth2.googleapis.com https://www.googleapis.com",
    "frame-src 'self' https://accounts.google.com https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com",
    "worker-src 'self' blob:",
    'upgrade-insecure-requests'
].join('; ');

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

export function securityHeadersText() {
    return [
        '/*',
        ...SECURITY_HEADERS.map(([name, value]) => `  ${name}: ${value}`)
    ].join('\n') + '\n';
}

export function securityMetaHtml(indent = '') {
    return [
        `${indent}<!-- f1s:security-meta:begin -->`,
        `${indent}<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttribute(CONTENT_SECURITY_POLICY)}">`,
        `${indent}<meta name="referrer" content="${escapeHtmlAttribute(REFERRER_POLICY)}">`,
        `${indent}<!-- f1s:security-meta:end -->`
    ].join('\n');
}

export function authorSecurityMetaHtml(indent = '') {
    return `${indent}<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttribute(AUTHOR_CONTENT_SECURITY_POLICY)}">`;
}
