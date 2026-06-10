const { fs, path, CONFIG } = require('./shared');

function renderArticleNavigation(prevPost, nextPost) {
    const links = [
        prevPost
            ? `<a href="/blog-module/blog-entries/${prevPost.id}/article.html" id="prev-article-link" class="article-nav-link prev"><svg class="icon" aria-hidden="true"><use href="#fa-arrow-left"/></svg> Previous</a>`
            : '',
        nextPost
            ? `<a href="/blog-module/blog-entries/${nextPost.id}/article.html" id="next-article-link" class="article-nav-link next">Next <svg class="icon" aria-hidden="true"><use href="#fa-arrow-right"/></svg></a>`
            : ''
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
    return hrefFor('prev-article-link') === expectedPrev
        && hrefFor('next-article-link') === expectedNext;
}

function injectPrevNextLinks(blogPosts) {
    blogPosts.forEach((post, index) => {
        const postHtmlPath = path.join(CONFIG.BLOG_DIR, post.id, 'article.html');
        if (!fs.existsSync(postHtmlPath)) return;

        let postHtml = fs.readFileSync(postHtmlPath, 'utf8');
        const originalHtml = postHtml;
        const prevPost = index < blogPosts.length - 1 ? blogPosts[index + 1] : null;
        const nextPost = index > 0 ? blogPosts[index - 1] : null;

        if (postHtml.includes('PREV_ARTICLE_URL') || postHtml.includes('NEXT_ARTICLE_URL')) {
            if (prevPost) {
                postHtml = postHtml.replace(/PREV_ARTICLE_URL/g, `/blog-module/blog-entries/${prevPost.id}/article.html`);
            } else {
                postHtml = postHtml.replace(/^[ \t]*<a href="PREV_ARTICLE_URL"[^>]*>[\s\S]*?<\/a>[ \t]*\r?\n?/gm, '');
            }

            if (nextPost) {
                postHtml = postHtml.replace(/NEXT_ARTICLE_URL/g, `/blog-module/blog-entries/${nextPost.id}/article.html`);
            } else {
                postHtml = postHtml.replace(/^[ \t]*<a href="NEXT_ARTICLE_URL"[^>]*>[\s\S]*?<\/a>[ \t]*\r?\n?/gm, '');
            }
        } else {
            if (articleNavigationMatches(postHtml, prevPost, nextPost)) return;
            postHtml = postHtml.replace(
                /        <div class="article-navigation">[\s\S]*?        <\/div>/,
                renderArticleNavigation(prevPost, nextPost)
            );
        }

        if (postHtml !== originalHtml) fs.writeFileSync(postHtmlPath, postHtml);
    });
}

module.exports = {
    renderArticleNavigation,
    articleNavigationMatches,
    injectPrevNextLinks
};
