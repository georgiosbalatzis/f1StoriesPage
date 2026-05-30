export const REFERRER_POLICY = 'strict-origin-when-cross-origin';

export const CONTENT_SECURITY_POLICY = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self' https://formspree.io",
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://unpkg.com https://f1stories-gr.disqus.com https://*.disqus.com https://*.disquscdn.com https://connect.facebook.net https://platform.twitter.com https://www.instagram.com https://www.threads.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://api.jolpi.ca https://api.openf1.org https://formspree.io https://fonts.googleapis.com https://fonts.gstatic.com https://cdnjs.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://stats.g.doubleclick.net https://f1stories-gr.disqus.com https://*.disqus.com https://*.disquscdn.com https://connect.facebook.net https://www.facebook.com https://platform.twitter.com https://syndication.twitter.com https://twitter.com https://*.twitter.com https://x.com https://*.x.com https://www.instagram.com https://www.threads.net",
    "frame-src 'self' https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://open.spotify.com https://player.vimeo.com https://codepen.io https://datawrapper.dwcdn.net https://sketchfab.com https://www.sketchfab.com https://facebook.com https://www.facebook.com https://platform.twitter.com https://syndication.twitter.com https://www.instagram.com https://instagram.com https://threads.net https://www.threads.net https://f1stories.gr https://www.f1stories.gr https://georgiosbalatzis.github.io https://f1stories-gr.disqus.com https://disqus.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' https:",
    'upgrade-insecure-requests'
].join('; ');

function escapeHtmlAttribute(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function securityMetaHtml(indent = '') {
    return [
        `${indent}<!-- f1s:security-meta:begin -->`,
        `${indent}<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttribute(CONTENT_SECURITY_POLICY)}">`,
        `${indent}<meta name="referrer" content="${escapeHtmlAttribute(REFERRER_POLICY)}">`,
        `${indent}<!-- f1s:security-meta:end -->`
    ].join('\n');
}
