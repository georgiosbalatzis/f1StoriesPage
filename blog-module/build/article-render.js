const { fs, path, CONFIG, utils, escapeHtmlAttribute, getImageDimensionsForPublicPath } = require('./shared');
const { getPostTaxonomy } = require('../taxonomy');

function escapeHtmlText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function jsonScriptLiteral(value) {
    return JSON.stringify(String(value ?? ''))
        .replace(/</g, '\\u003C')
        .replace(/>/g, '\\u003E')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

function encodePathSegment(value) {
    return encodeURIComponent(String(value ?? ''));
}

function replaceTemplateTokens(templateHtml, tokens) {
    return Object.keys(tokens)
        .sort((a, b) => b.length - a.length)
        .reduce((html, token) => html.split(token).join(String(tokens[token])), templateHtml);
}

function renderCategoryLinks(categories, className = 'article-category-link') {
    return categories.map(category => {
        const href = `/blog-module/blog/index.html?category=${encodeURIComponent(category)}`;
        return `<a href="${escapeHtmlAttribute(href)}"${className ? ` class="${className}"` : ''}>${escapeHtmlText(category)}</a>`;
    }).join(' ');
}

function renderCategoryRail(categories) {
    return `<div class="article-rail-card article-rail-tags">
                            <span class="article-rail-label">Κατηγορίες</span>
                            <div class="article-tag-list">${renderCategoryLinks(categories, 'article-tag-chip')}</div>
                        </div>`;
}

function renderArticleSources(categories) {
    const evidenceCategories = new Set(['Technical', 'Analysis', 'History']);
    if (!categories.some(category => evidenceCategories.has(category))) {
        return 'Συντακτικό άρθρο και επιβεβαίωση στοιχείων από τις επίσημες ανακοινώσεις του πρωταθλήματος.';
    }
    return '<a href="https://www.fia.com/regulation/category/110" target="_blank" rel="noopener">FIA κανονισμοί</a> · ' +
        '<a href="https://www.formula1.com/en/results.html" target="_blank" rel="noopener">επίσημα αποτελέσματα και timing</a> · ' +
        'ανακοινώσεις ομάδων όπου αναφέρονται.';
}

function formatArticleDate(post) {
    const value = post && (post.dateISO || post.date);
    const parsed = value ? new Date(`${value}T00:00:00Z`) : null;
    return parsed && !Number.isNaN(parsed.getTime())
        ? parsed.toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
        : String(post && (post.displayDate || value) || '');
}

// Older entries can lack source documents. Update only template-owned metadata
// slots so their body, embedded media, and editorial changes remain byte intact.
function refreshArticleTaxonomy(html, post) {
    html = html.replace(/Φόρτωση\.\.\./g, 'Επόμενο GP')
        .replace(/(<span class="countdown-timer" id="race-countdown">)--(<\/span>)/g, '$1Σύντομα$2')
        .replace(/(<span id="race-countdown-mobile">)--(<\/span>)/g, '$1Σύντομα$2');
    const { category, categories } = getPostTaxonomy(post);
    const primary = escapeHtmlText(category);
    const articleDate = escapeHtmlText(formatArticleDate(post));
    const sources = renderArticleSources(categories);
    const trustPanel = `<div class="article-trust" aria-label="Συντακτική ταυτότητα και πηγές">
                        <div><span class="article-trust__label">ΣΥΝΤΑΚΤΙΚΗ ΚΑΡΤΕΛΑ</span><strong>${escapeHtmlText(post.author || 'F1 Stories')}</strong><span>Δημοσίευση: ${articleDate} · Ενημέρωση: ${articleDate}</span></div>
                        <div><span class="article-trust__label">ΠΗΓΕΣ</span><span>${sources}</span></div>
                        <div><span class="article-trust__label">ΔΙΟΡΘΩΣΕΙΣ</span><span>Διορθώνουμε δημόσια factual λάθη. <a href="mailto:myf1stories@gmail.com?subject=Διόρθωση%20άρθρου">Στείλε διόρθωση ↗</a></span></div>
                    </div>`;
    let updated = html
        .replace(/(<span class="article-mini-bar__category">)[\s\S]*?(<\/span>)/, `$1${primary}$2`)
        .replace(/(<span class="article-category-pill">)[\s\S]*?(<\/span>)/, `$1${primary}$2`)
        .replace(/(<div class="article-meta">[\s\S]*?<span><svg class="icon" aria-hidden="true"><use href="#fa-tag"\/><\/svg> )[\s\S]*?(<\/span>)/, `$1${renderCategoryLinks(categories)}$2`)
        .replace(/(<div class="article-rail-meta-list">\s*<span><svg class="icon" aria-hidden="true"><use href="#fa-tag"\/><\/svg> )[\s\S]*?(<\/span>)/, `$1${primary}$2`)
        .replace(/<div class="article-rail-card article-rail-tags"[^>]*>[\s\S]*?<div class="article-tag-list"[^>]*>[\s\S]*?<\/div>\s*<\/div>/, renderCategoryRail(categories))
        .replace(/(<span class="article-mini-bar__category">)[\s\S]*?(<\/span>)/, `$1${primary}$2`);

    if (!updated.includes('class="article-trust"')) {
        updated = updated.replace(/(<div class="article-content">)/, `${trustPanel}\n                    $1`);
    }

    updated = updated.replace(/(<script type="application\/ld\+json">)\s*([\s\S]*?)\s*(<\/script>)/g, (block, open, source, close) => {
        const data = JSON.parse(source);
        if (!['Article', 'NewsArticle', 'BlogPosting'].includes(data['@type'])) return block;
        if (JSON.stringify(data.articleSection) === JSON.stringify(categories) && !post.updatedDateISO) return block;
        data.articleSection = categories;
        data.dateModified = post.updatedDateISO || post.dateISO || post.date || data.dateModified;
        const json = JSON.stringify(data, null, 4).replace(/[<>&\u2028\u2029]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
        return `${open}\n${json}\n    ${close}`;
    });
    return updated;
}

async function renderArticleHtml(postData, entryPath, folderName = postData.id || path.basename(entryPath)) {
    const taxonomy = getPostTaxonomy(postData);
    const headerImage = postData.backgroundImage || postData.image || CONFIG.DEFAULT_BLOG_IMAGE;
    const bgImageFilename = headerImage.includes('/')
        ? headerImage.substring(headerImage.lastIndexOf('/') + 1)
        : headerImage;
    const heroAvifFile = `${path.parse(bgImageFilename).name}.avif`;
    const heroAvifSource = fs.existsSync(path.join(entryPath, heroAvifFile))
        ? `<source type="image/avif" srcset="${escapeHtmlAttribute(encodePathSegment(heroAvifFile))}">`
        : '';
    const authorImagePath = CONFIG.AUTHOR_AVATARS[postData.author] || CONFIG.AUTHOR_AVATARS.default;
    const authorImageDimensions = await getImageDimensionsForPublicPath(`/images/authors/${authorImagePath}`);
    const headerImageDimensions = postData.backgroundImageWidth && postData.backgroundImageHeight
        ? { width: postData.backgroundImageWidth, height: postData.backgroundImageHeight }
        : await getImageDimensionsForPublicPath(headerImage);
    const templateHtml = fs.readFileSync(CONFIG.TEMPLATE_PATH, 'utf8');
    const articleUrl = `https://f1stories.gr/blog-module/blog-entries/${encodePathSegment(folderName)}/article.html`;
    const imageFilePath = encodePathSegment(bgImageFilename);
    const imageUrl = `https://f1stories.gr/blog-module/blog-entries/${encodePathSegment(folderName)}/${imageFilePath}`;
    const renderTokens = {
        ARTICLE_TITLE_TEXT: escapeHtmlText(postData.title),
        ARTICLE_TITLE_ATTR: escapeHtmlAttribute(postData.title),
        ARTICLE_TITLE_JSON: jsonScriptLiteral(postData.title),
        ARTICLE_TITLE_PARAM: encodeURIComponent(String(postData.title ?? '')),
        ARTICLE_AUTHOR_TEXT: escapeHtmlText(postData.author),
        ARTICLE_AUTHOR_ATTR: escapeHtmlAttribute(postData.author),
        ARTICLE_AUTHOR_JSON: jsonScriptLiteral(postData.author),
        ARTICLE_DATE_ISO_JSON: jsonScriptLiteral(postData.dateISO),
        ARTICLE_DATE_ISO: escapeHtmlAttribute(postData.dateISO),
        ARTICLE_DATE: escapeHtmlText(formatArticleDate(postData)),
        ARTICLE_UPDATED_DATE_ISO_JSON: jsonScriptLiteral(postData.updatedDateISO || postData.dateISO),
        ARTICLE_UPDATED_DATE: escapeHtmlText(formatArticleDate({ dateISO: postData.updatedDateISO || postData.dateISO, date: postData.date, displayDate: postData.displayDate })),
        ARTICLE_SOURCES_HTML: renderArticleSources(taxonomy.categories),
        ARTICLE_EXCERPT_ATTR: escapeHtmlAttribute(postData.excerpt),
        ARTICLE_EXCERPT_JSON: jsonScriptLiteral(postData.excerpt),
        ARTICLE_COMMENTS: String(postData.comments || 0),
        ARTICLE_IMAGE_WIDTH: String(headerImageDimensions && headerImageDimensions.width ? headerImageDimensions.width : 848),
        ARTICLE_IMAGE_HEIGHT: String(headerImageDimensions && headerImageDimensions.height ? headerImageDimensions.height : 400),
        ARTICLE_IMAGE_ATTR: escapeHtmlAttribute(imageFilePath),
        ARTICLE_IMAGE_URL_ATTR: escapeHtmlAttribute(imageUrl),
        ARTICLE_IMAGE_URL_JSON: jsonScriptLiteral(imageUrl),
        ARTICLE_HERO_AVIF_SOURCE: heroAvifSource,
        ARTICLE_ID_JSON: jsonScriptLiteral(folderName),
        ARTICLE_ID: escapeHtmlAttribute(folderName),
        ARTICLE_CATEGORY_TEXT: escapeHtmlText(taxonomy.category),
        ARTICLE_CATEGORIES_JSON: JSON.stringify(taxonomy.categories),
        ARTICLE_CATEGORY_LINKS: renderCategoryLinks(taxonomy.categories),
        ARTICLE_CATEGORY_RAIL: renderCategoryRail(taxonomy.categories),
        ARTICLE_CONTENT: postData.content || '',
        ARTICLE_URL_ATTR: escapeHtmlAttribute(articleUrl),
        ARTICLE_URL_JSON: jsonScriptLiteral(articleUrl),
        ARTICLE_URL_PARAM: encodeURIComponent(articleUrl),
        ARTICLE_AUTHOR_IMAGE_WIDTH: String(authorImageDimensions && authorImageDimensions.width ? authorImageDimensions.width : 474),
        ARTICLE_AUTHOR_IMAGE_HEIGHT: String(authorImageDimensions && authorImageDimensions.height ? authorImageDimensions.height : 474)
    };

    const blogHtml = replaceTemplateTokens(templateHtml, renderTokens)
        .replace(/src="\/images\/authors\/default\.webp"/, `src="/images/authors/${escapeHtmlAttribute(authorImagePath)}"`);

    if (!fs.existsSync(CONFIG.OUTPUT_HTML_DIR)) utils.ensureDirectory(CONFIG.OUTPUT_HTML_DIR);
    const output = blogHtml.replace(/[ \t]+$/gm, '');
    fs.writeFileSync(path.join(entryPath, 'article.html'), output);
    return output;
}

module.exports = {
    renderArticleHtml,
    refreshArticleTaxonomy
};
