const { fs, path, CONFIG } = require('./shared');

function injectPrevNextLinks(blogPosts) {
    blogPosts.forEach((post, index) => {
        const postHtmlPath = path.join(CONFIG.BLOG_DIR, post.id, 'article.html');
        if (!fs.existsSync(postHtmlPath)) return;

        let postHtml = fs.readFileSync(postHtmlPath, 'utf8');
        const prevPost = index < blogPosts.length - 1 ? blogPosts[index + 1] : null;
        const nextPost = index > 0 ? blogPosts[index - 1] : null;

        if (prevPost) {
            postHtml = postHtml.replace(/PREV_ARTICLE_URL/g, `/blog-module/blog-entries/${prevPost.id}/article.html`);
        } else {
            postHtml = postHtml.replace(/<a href="PREV_ARTICLE_URL"[^>]*>[\s\S]*?<\/a>/g, '');
        }

        if (nextPost) {
            postHtml = postHtml.replace(/NEXT_ARTICLE_URL/g, `/blog-module/blog-entries/${nextPost.id}/article.html`);
        } else {
            postHtml = postHtml.replace(/<a href="NEXT_ARTICLE_URL"[^>]*>[\s\S]*?<\/a>/g, '');
        }

        fs.writeFileSync(postHtmlPath, postHtml);
    });
}

module.exports = {
    injectPrevNextLinks
};
