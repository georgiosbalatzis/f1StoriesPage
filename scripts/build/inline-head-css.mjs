// inline-head-css.mjs — dist-only: replace each render-blocking local stylesheet <link> in <head>
// with a <style> holding the complete file, in place, so first paint skips the CSS round trip.
// Order, and with it the cascade, is unchanged; nothing is subset. Sources keep their <link>s.
// Measured in issue #279 step 2: perf/sprint-279/step2-css.md.

import path from 'node:path';

const LINK = /^([ \t]*)<link rel="stylesheet" href="([^"]+)">$/gm;
const NOSCRIPT_LINK = /^[ \t]*<noscript><link rel="stylesheet" href="([^"]+)"><\/noscript>\n/gm;

// Inline CSS resolves url() against the page, not the stylesheet, so only page-independent URLs are allowed.
function assertInlineable(css, publicPath) {
    if (/<\/style/i.test(css)) throw new Error(`${publicPath}: contains "</style", cannot be inlined`);
    if (/@import/i.test(css)) throw new Error(`${publicPath}: @import cannot be inlined`);
    const relative = css.match(/url\(\s*(?!['"]?(?:data:|https?:|\/))['"]?[^'")\s]*/i);
    if (relative) throw new Error(`${publicPath}: relative ${relative[0]}) would resolve differently inline`);
}

// readCss(publicPath) returns the stylesheet text for a repo/dist-relative path such as "styles/editorial.min.css".
export function inlineHeadStylesheets(html, relPath, readCss) {
    const end = html.indexOf('</head>');
    if (end < 0) return html;
    const inlined = new Set();
    const head = html.slice(0, end).replace(LINK, (match, indent, href) => {
        if (/^(?:[a-z]+:)?\/\//i.test(href)) return match;
        const file = href.split(/[?#]/)[0];
        const publicPath = path.posix.normalize(file.startsWith('/') ? file.slice(1) : path.posix.join(path.posix.dirname(relPath), file));
        const css = readCss(publicPath).trim();
        assertInlineable(css, publicPath);
        inlined.add(href);
        return `${indent}<style>${css}</style>`;
    }).replace(NOSCRIPT_LINK, (match, href) => (inlined.has(href) ? '' : match));
    return head + html.slice(end);
}
