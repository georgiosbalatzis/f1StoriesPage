const { fs, path, CONFIG, escapeHtmlAttribute } = require('./shared');

function scoreRelatedPosts(blogPosts, post, index) {
    const scored = blogPosts
        .filter((_, candidateIndex) => candidateIndex !== index)
        .map(candidate => {
            let score = 0;
            if (candidate.tag && candidate.tag === post.tag) score += 3;
            if (candidate.category && candidate.category === post.category) score += 2;
            if (candidate.author && candidate.author === post.author) score += 1;
            if (post.categories && candidate.categories) {
                const shared = post.categories.filter(category => candidate.categories.includes(category));
                score += shared.length;
            }
            const daysDiff = Math.abs(new Date(post.date) - new Date(candidate.date)) / (1000 * 60 * 60 * 24);
            if (daysDiff <= 30) score += 1;
            return { post: candidate, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || new Date(b.post.date) - new Date(a.post.date));

    let relatedPosts = scored.slice(0, 3).map(item => item.post);
    if (relatedPosts.length < 3) {
        const ids = new Set(relatedPosts.map(candidate => candidate.id));
        const fallbacks = blogPosts
            .filter((candidate, candidateIndex) => candidateIndex !== index && !ids.has(candidate.id))
            .slice(0, 3 - relatedPosts.length);
        relatedPosts = relatedPosts.concat(fallbacks);
    }
    return relatedPosts;
}

function buildRelatedPostsHtml(relatedPosts) {
    return relatedPosts.map(related => {
        const relatedImagePath = related.image.substring(related.image.lastIndexOf('/') + 1);
        const relDate = new Date(related.date);
        const relDateStr = relDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const relatedTitle = escapeHtmlAttribute(related.title);
        const relatedAuthor = escapeHtmlAttribute(related.author);
        const relatedReadTime = escapeHtmlAttribute(related.readingTime || '');
        const hoverMeta = relatedReadTime
            ? `<span class="related-card-hover-meta"><svg class="icon" aria-hidden="true"><use href="#fa-clock"/></svg> ${relatedReadTime}</span>`
            : '';

        return `
            <div class="col-md-4 mb-4">
                <a href="${related.url}" class="related-card-link" style="display:block;height:100%;">
                    <div class="related-article-card">
                        <div class="related-card-media">
                            <img src="/blog-module/blog-entries/${related.id}/${relatedImagePath}"
                                 alt="${relatedTitle}"
                                 loading="lazy"
                                 onerror="this.src='${CONFIG.DEFAULT_BLOG_IMAGE}';this.onerror=null;">
                            <div class="related-card-hover">
                                <span class="related-card-hover-label">Περισσότερα</span>
                                ${hoverMeta}
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="related-date-badge"><svg class="icon" aria-hidden="true"><use href="#fa-calendar-alt"/></svg> ${relDateStr}</div>
                            <h5>${relatedTitle}</h5>
                            <div class="related-card-footer">
                                <span class="related-card-read">Read More <svg class="icon" aria-hidden="true"><use href="#fa-arrow-right"/></svg></span>
                                <span class="related-card-author">${relatedAuthor}</span>
                            </div>
                        </div>
                    </div>
                </a>
            </div>`;
    }).join('');
}

function injectRelatedArticles(blogPosts) {
    blogPosts.forEach((post, index) => {
        const postHtmlPath = path.join(CONFIG.BLOG_DIR, post.id, 'article.html');
        if (!fs.existsSync(postHtmlPath)) return;

        const relatedPosts = scoreRelatedPosts(blogPosts, post, index);
        const relatedPostsHtml = buildRelatedPostsHtml(relatedPosts);
        const postHtml = fs.readFileSync(postHtmlPath, 'utf8').replace(/RELATED_ARTICLES/g, relatedPostsHtml || '');
        fs.writeFileSync(postHtmlPath, postHtml);
    });
}

module.exports = {
    scoreRelatedPosts,
    buildRelatedPostsHtml,
    injectRelatedArticles
};
