(function (root, factory) {
    'use strict';
    const inline = factory();
    if (typeof module === 'object' && module.exports) module.exports = inline;
    else root.F1S_INLINE = inline;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Inline markup for article text, shared by the build (blog-module/build/parse-txt.js) and the author
    // preview (scripts/author/generate-page.js) so both render a source the same way.
    //
    //   **bold**  __bold__  *italic*  _italic_  [link text](https://example.com)

    // [label](url): the label is any text without "]"; the url may contain one level of balanced parentheses
    // (Wikipedia style) and no spaces. A leading "!" is left alone (not an image syntax of this format).
    const LINK_PATTERN = /(?<!!)\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;
    // Placeholders for links while emphasis runs, so "_" and "*" inside a URL are never treated as markup.
    const OPEN = '\u0001';
    const CLOSE = '\u0002';
    const SITE_HOSTS = new Set(['f1stories.gr', 'www.f1stories.gr']);

    function escapeHtml(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function applyEmphasis(escaped) {
        return escaped
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.+?)__/g, '<strong>$1</strong>')
            .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
            .replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>');
    }

    // Returns the url when it is safe to link to, otherwise ''.
    // Allowed: http(s), mailto, a site-relative path ("/standings/") and an in-page anchor ("#section").
    // Anything else (javascript:, data:, protocol-relative "//host", ...) is not turned into a link.
    function sanitizeLinkUrl(raw) {
        const url = String(raw == null ? '' : raw).trim();
        if (!url || /[\u0000-\u001f\u007f\s<>"]/.test(url)) return '';
        if (/^https?:\/\/[^/?#]+/i.test(url)) {
            try {
                const parsed = new URL(url);
                return parsed.username || parsed.password ? '' : url;
            } catch (_) {
                return '';
            }
        }
        if (/^mailto:[^\s@]+@[^\s@]+$/i.test(url)) return url;
        if (/^\/(?!\/)/.test(url)) return url;
        if (/^#[\w-]+$/.test(url)) return url;
        return '';
    }

    function isExternal(url) {
        if (!/^https?:/i.test(url)) return false;
        try {
            return !SITE_HOSTS.has(new URL(url).hostname.toLowerCase());
        } catch (_) {
            return false;
        }
    }

    function renderLink(label, url) {
        const attrs = isExternal(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
        return '<a href="' + escapeHtml(url) + '"' + attrs + '>' + applyEmphasis(escapeHtml(label)) + '</a>';
    }

    function formatInline(text) {
        const links = [];
        // The two control characters are the link placeholders; they never occur in real article text.
        const clean = String(text == null ? '' : text).replace(/[\u0001\u0002]/g, '');
        const tokenised = clean.replace(LINK_PATTERN, function (match, label, url) {
            const safeUrl = sanitizeLinkUrl(url);
            if (!safeUrl) return match;
            links.push({ label: label, url: safeUrl });
            return OPEN + (links.length - 1) + CLOSE;
        });

        const html = applyEmphasis(escapeHtml(tokenised));
        return html.replace(new RegExp(OPEN + '(\\d+)' + CLOSE, 'g'), function (_, index) {
            const link = links[Number(index)];
            return link ? renderLink(link.label, link.url) : '';
        });
    }

    return Object.freeze({ formatInline, sanitizeLinkUrl, escapeHtml });
}));
