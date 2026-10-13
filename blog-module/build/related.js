const crypto = require('crypto');
const { fs, path, CONFIG, escapeHtmlAttribute, getCardThumbnailPath, getImageDimensionsForPublicPath } = require('./shared');
const { cardSrcset } = require('./image-sizes');
const { getPostTaxonomy, authorLabel, formatDate, formatReadingTime } = require('../taxonomy');
const { mediaAttributes, cardDisclosureHtml } = require('./media-meta');

// `picturesOf(post)` lists keys of the photographs a post shows (cover and card); a candidate whose card repeats the
// article's own cover or another chosen card is passed over, so one photograph appears once per page.
function scoreRelatedPosts(blogPosts, post, index, picturesOf = () => []) {
    const shown = new Set(picturesOf(post));
    const distinct = candidate => {
        const keys = picturesOf(candidate).slice(-1);
        if (keys.some(key => shown.has(key))) return false;
        keys.forEach(key => shown.add(key));
        return true;
    };
    const taxonomy = getPostTaxonomy(post);
    const genericTags = new Set(['f1', 'formula 1', 'racing', 'misc', 'random', 'images', 'gallery', 'gp']);
    const tags = new Set(taxonomy.tags.map(tag => tag.toLocaleLowerCase()).filter(tag => !genericTags.has(tag)));
    const scored = blogPosts
        .filter((_, candidateIndex) => candidateIndex !== index)
        .map(candidate => {
            let score = 0;
            const candidateTaxonomy = getPostTaxonomy(candidate);
            const sharedTags = candidateTaxonomy.tags.filter(tag => tags.has(tag.toLocaleLowerCase()));
            score += Math.min(sharedTags.length, 3) * 3;
            if (candidateTaxonomy.category === taxonomy.category) score += 2;
            if (candidate.author && candidate.author === post.author) score += 1;
            score += taxonomy.categories.filter(category => candidateTaxonomy.categories.includes(category)).length;
            const daysDiff = Math.abs(new Date(post.date) - new Date(candidate.date)) / (1000 * 60 * 60 * 24);
            if (daysDiff <= 30) score += 1;
            return { post: candidate, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || new Date(b.post.date) - new Date(a.post.date));

    const relatedPosts = [];
    for (const candidate of scored.map(item => item.post)) {
        if (relatedPosts.length === 3) break;
        if (distinct(candidate)) relatedPosts.push(candidate);
    }
    const ids = new Set(relatedPosts.map(candidate => candidate.id));
    for (const [candidateIndex, candidate] of blogPosts.entries()) {
        if (relatedPosts.length === 3) break;
        if (candidateIndex !== index && !ids.has(candidate.id) && distinct(candidate)) relatedPosts.push(candidate);
    }
    return relatedPosts;
}

// Content hashes of the post's cover file and card source (byte-identical reuse across stories counts as the same picture).
const pictureHashes = new Map();
function pictureKeysOf(post) {
    const files = [post.backgroundImage || post.image, post.image].map(image => {
        if (!image || !image.startsWith('/blog-module/blog-entries/')) return null;
        return path.join(CONFIG.BLOG_DIR, '..', image.replace(/^\/blog-module\//, ''));
    });
    return files.map(file => {
        if (!file || !fs.existsSync(file)) return null;
        if (!pictureHashes.has(file)) pictureHashes.set(file, crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex'));
        return pictureHashes.get(file);
    }).filter(Boolean);
}

// NEXT UP. (the article's Race Report ending): the best match leads with a large photograph,
// the others follow as a short list. Titles are the links' text, so the pictures carry alt="".
async function buildRelatedPostsHtml(relatedPosts) {
    const items = await Promise.all(relatedPosts.map(async (related, index) => {
        const lead = index === 0;
        const relatedImage = getCardThumbnailPath(related.image);
        const relatedImagePath = relatedImage.substring(relatedImage.lastIndexOf('/') + 1);
        const srcset = escapeHtmlAttribute(cardSrcset(`/blog-module/blog-entries/${related.id}/${relatedImagePath}`, lead));
        const imageDimensions = await getImageDimensionsForPublicPath(relatedImage);
        const hasImage = Boolean(relatedImage && relatedImage !== CONFIG.DEFAULT_BLOG_IMAGE && imageDimensions);
        const size = imageDimensions ? ` width="${imageDimensions.width}" height="${imageDimensions.height}"` : '';
        const image = hasImage
            ? `<img src="/blog-module/blog-entries/${related.id}/${relatedImagePath}"${srcset ? ` srcset="${srcset}" sizes="${lead ? '(max-width: 1099px) 100vw, 56vw' : '140px'}"` : ''} alt="" loading="lazy" decoding="async"${size}${mediaAttributes(related.id, relatedImagePath)} data-fallback-src="${CONFIG.DEFAULT_BLOG_IMAGE}">`
                + (lead ? cardDisclosureHtml(related.id, relatedImagePath) : '')
            : '';
        const readTime = formatReadingTime(related.readingTime);
        const meta = `<span class="rr-next__meta">${escapeHtmlAttribute(formatDate(related.date))}${readTime ? ` · ${escapeHtmlAttribute(readTime)}` : ''}</span>`;
        const title = escapeHtmlAttribute(related.title);
        const author = `<span class="rr-next__by">${escapeHtmlAttribute(authorLabel(related.author))}</span>`;
        return lead
            ? `<a href="${related.url}" class="rr-next__lead">${image}${meta}<span class="rr-next__title">${title}</span>${author}</a>`
            : `<li><a href="${related.url}"${hasImage ? '' : ' class="rr-next__noimg"'}>${image}<span>${meta}<span class="rr-next__small">${title}</span>${author}</span></a></li>`;
    }));
    const [lead, ...rest] = items;
    if (!lead) return '';
    return `${lead}\n            <ol class="rr-next__list">\n                ${rest.join('\n                ')}\n            </ol>`;
}

// Every article page is rendered from the template on each build, so the RELATED_ARTICLES
// slot is always fresh; pages without one (no article body) are left as they are.
async function injectRelatedArticles(blogPosts) {
    for (const [index, post] of blogPosts.entries()) {
        const postHtmlPath = path.join(CONFIG.BLOG_DIR, post.id, 'article.html');
        if (!fs.existsSync(postHtmlPath)) continue;
        const postHtml = fs.readFileSync(postHtmlPath, 'utf8');
        if (!/^[ \t]*RELATED_ARTICLES[ \t]*$/m.test(postHtml)) continue;

        const relatedPostsHtml = await buildRelatedPostsHtml(scoreRelatedPosts(blogPosts, post, index, pictureKeysOf));
        fs.writeFileSync(postHtmlPath, postHtml.replace(/^[ \t]*RELATED_ARTICLES[ \t]*$/gm, relatedPostsHtml ? `            ${relatedPostsHtml}` : ''));
    }
}

module.exports = {
    scoreRelatedPosts,
    buildRelatedPostsHtml,
    injectRelatedArticles
};
