const { fs, path, CONFIG, utils, escapeHtmlAttribute, getImageDimensionsForPublicPath } = require('./shared');

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

async function renderArticleHtml(postData, entryPath, folderName = postData.id || path.basename(entryPath)) {
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
        ARTICLE_DATE: escapeHtmlText(postData.displayDate),
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
        ARTICLE_TAG_TEXT: escapeHtmlText(postData.tag),
        ARTICLE_CATEGORY_TEXT: escapeHtmlText(postData.category),
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
    renderArticleHtml
};
