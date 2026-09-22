const { fs, path, CONFIG, escapeHtmlAttribute } = require('./shared');

// Each direction names the story it leads to, so the band reads as a
// "next read" rather than a lone arrow.
function renderNavLink(post, direction) {
    const isPrev = direction === 'prev';
    const icon = `<svg class="icon" aria-hidden="true"><use href="#fa-arrow-${isPrev ? 'left' : 'right'}"/></svg>`;
    const label = isPrev ? `${icon} Προηγούμενο` : `Επόμενο ${icon}`;
    return `<a href="/blog-module/blog-entries/${post.id}/article.html" id="${direction}-article-link" class="article-nav-link ${direction}">`
        + `<span class="article-nav-label">${label}</span>`
        + `<span class="article-nav-title">${escapeHtmlAttribute(post.title || '')}</span></a>`;
}

function renderArticleNavigation(prevPost, nextPost) {
    const links = [
        prevPost ? renderNavLink(prevPost, 'prev') : '',
        nextPost ? renderNavLink(nextPost, 'next') : ''
    ].filter(Boolean).map(link => `            ${link}`).join('\n');

    return `        <div class="article-navigation">
${links}
        </div>`;
}

function articleNavigationMatches(postHtml, prevPost, nextPost) {
    function hrefFor(id) {
        const anchor = postHtml.match(new RegExp(`<a[^>]*id="${id}"[^>]*>`, 'i'));
        if (!anchor) return '';
        const href = anchor[0].match(/\bhref="([^"]+)"/i);
        return href ? href[1] : '';
    }

    const expectedPrev = prevPost ? `/blog-module/blog-entries/${prevPost.id}/article.html` : '';
    const expectedNext = nextPost ? `/blog-module/blog-entries/${nextPost.id}/article.html` : '';
    const block = postHtml.match(/<div class="article-navigation">[\s\S]*?<\/div>/);
    const expectedBlock = renderArticleNavigation(prevPost, nextPost).trim();
    return hrefFor('prev-article-link') === expectedPrev
        && hrefFor('next-article-link') === expectedNext
        && Boolean(block) && expectedBlock.includes(block[0]);
}

function injectPrevNextLinks(blogPosts) {
    blogPosts.forEach((post, index) => {
        const postHtmlPath = path.join(CONFIG.BLOG_DIR, post.id, 'article.html');
        if (!fs.existsSync(postHtmlPath)) return;

        const originalHtml = fs.readFileSync(postHtmlPath, 'utf8');
        const prevPost = index < blogPosts.length - 1 ? blogPosts[index + 1] : null;
        const nextPost = index > 0 ? blogPosts[index - 1] : null;
        if (articleNavigationMatches(originalHtml, prevPost, nextPost)) return;

        // Template placeholders and older rendered blocks are both replaced wholesale.
        const postHtml = originalHtml.replace(
            /        <div class="article-navigation">[\s\S]*?        <\/div>/,
            renderArticleNavigation(prevPost, nextPost)
        );
        if (postHtml !== originalHtml) fs.writeFileSync(postHtmlPath, postHtml);
    });
}

module.exports = {
    renderArticleNavigation,
    articleNavigationMatches,
    injectPrevNextLinks
};
