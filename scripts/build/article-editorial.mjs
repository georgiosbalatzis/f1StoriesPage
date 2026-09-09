// Upgrade the article shell independently of archived editorial content.
// Called by stamp-html for cached articles that no longer have source documents.
export function applyArticleEditorial(html, assets) {
    if (!/class=["'][^"']*\barticle-page-wrapper\b/.test(html)) return html;
    let result = html.replace(/<body\b([^>]*)>/i, (tag, attrs) => {
        const existing = attrs.match(/\bclass=(["'])(.*?)\1/i);
        const classes = new Set((existing?.[2] || '').split(/\s+/).filter(Boolean));
        classes.add('editorial-page');
        classes.add('article-page');
        const attr = `class="${[...classes].join(' ')}"`;
        return `<body${existing ? attrs.replace(existing[0], attr) : `${attrs} ${attr}`}>`;
    });
    result = result.replace(/(<main\b[^>]*\bclass=["'])([^"']*)(["'])/i, (tag, before, classes, after) => {
        if (!classes.split(/\s+/).includes('article-page-wrapper')) return tag;
        return before + classes.split(/\s+/).filter(name => !['py-5', 'mt-5'].includes(name)).join(' ') + after;
    });
    result = result.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, head => {
        // Retain all content metadata, scripts, structural styles and image preloads.
        let next = head.replace(/^[ \t]*<link\b[^>]*\bhref=["']\/(?:theme-overrides|styles\/(?:fonts|home-fonts|editorial)|blog-module\/blog\/article-editorial)(?:\.min)?\.css(?:\?[^"']*)?["'][^>]*>[ \t]*\r?\n?/gm, '');
        // The retired critical block contains the former blue/Roboto shell.
        // Editorial styles are synchronous, so carrying it only adds a stale
        // first-paint cascade and several kilobytes to every archived story.
        next = next.replace(/^[ \t]*<!-- f1s:critical-css:begin -->[\s\S]*?^[ \t]*<!-- f1s:critical-css:end -->[ \t]*\r?\n?/gm, '');
        next = next.replace(/^<link rel="stylesheet"/gm, '    <link rel="stylesheet"');
        const styles = [assets.fonts, assets.shared, assets.article]
            .map(href => `    <link rel="stylesheet" href="${href}">`).join('\n');
        // A stable marker keeps repeated migrations byte-for-byte identical.
        next = next.replace(/\s*<!-- f1s:article-editorial:begin -->[\s\S]*?<!-- f1s:article-editorial:end -->\s*/g, '\n');
        return next.replace(/\s*<\/head>/i, `\n    <!-- f1s:article-editorial:begin -->\n${styles}\n    <!-- f1s:article-editorial:end -->\n</head>`);
    });
    if (!/class="home-nav-wordmark"/.test(result)) {
        result = result.replace(/(<a\b(?=[^>]*\bclass="blog-nav-brand")[^>]*>\s*<img\b[^>]*>)(\s*<\/a>)/i,
            '$1<span class="home-nav-wordmark">F1 STORIES<span class="home-nav-dot">.</span></span>$2');
    }
    if (!/class="article-edition"/.test(result)) {
        result = result.replace('<div class="article-header-overlay">', '<div class="article-header-overlay">\n                    <div class="article-edition"><span>F1 STORIES / Η ΕΚΔΟΣΗ</span><span>F1 STORIES JOURNAL</span></div>');
    }
    if (!/class="article-header-byline"/.test(result)) {
        const author = result.match(/<[^>]+\bclass="author-name"[^>]*>([\s\S]*?)<\/[a-z0-9]+>/i)?.[1]
            ?.replace(/<[^>]*>/g, '').trim();
        if (author) result = result.replace(/(<h1\b[^>]*\bclass="article-title"[^>]*>[\s\S]*?<\/h1>)/i,
            (_match, title) => `${title}\n                    <p class="article-header-byline"><span>Γράφει</span> ${author}</p>`);
    }
    if (!/class="author-profile-link"/.test(result)) {
        const authorHref = result.match(/<[^>]+\bclass="author-name"[^>]*>[\s\S]*?<a\s+href="([^"]+)"/i)?.[1] || '/authors/';
        const profileLink = `<a class="author-profile-link" href="${authorHref}">Προφίλ συντάκτη και όλες οι ιστορίες <span aria-hidden="true">↗</span></a>`;
        result = result.replace(/(<div\b[^>]*\bclass="author-bio"[^>]*>[\s\S]*?<\/div>)/i, `$1\n                            ${profileLink}`);
    }
    return result;
}
