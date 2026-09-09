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

const AUTHOR_PROFILE_SLUGS = Object.freeze({
    'Georgios Balatzis': 'georgios-balatzis',
    'Giannis Poulikidis': 'giannis-poulikidis',
    'Thanasis Batalas': 'thanasis-batalas',
    'Themis Charvalis': 'themis-charvalis',
    'Dimitris Keramidiotis': 'dimitris-keramidiotis'
});

// A story's visual treatment follows its public section. These are deliberately
// editorial labels rather than more raw metadata: they appear in the masthead,
// rail and source block, so readers can tell what kind of piece they are in.
const EDITORIAL_PROFILES = Object.freeze([
    { category: 'Technical', kind: 'technical', label: 'ΤΕΧΝΙΚΟ ΔΕΛΤΙΟ' },
    { category: 'Analysis', kind: 'analysis', label: 'ΑΝΑΛΥΣΗ ΑΓΩΝΑ' },
    { category: 'History', kind: 'history', label: 'ΑΠΟ ΤΟ ΑΡΧΕΙΟ' },
    { category: 'Opinion', kind: 'opinion', label: 'ΣΗΜΕΙΩΜΑ ΓΝΩΜΗΣ' },
    { category: 'Betting', kind: 'betting', label: 'BETCAST NOTE' },
    { category: 'Drivers', kind: 'drivers', label: 'ΠΡΟΣΩΠΟ ΤΟΥ GRID' },
    { category: 'Teams', kind: 'teams', label: 'ΟΜΑΔΑ ΣΤΟ GRID' },
    { category: 'News', kind: 'news', label: 'ΡΕΠΟΡΤΑΖ' },
    { category: '2026', kind: 'season', label: 'ΣΕΖΟΝ 2026' }
]);

const DEFAULT_EDITORIAL_PROFILE = Object.freeze({ kind: 'journal', label: 'F1 STORIES JOURNAL' });

function authorProfileHref(author) {
    const slug = AUTHOR_PROFILE_SLUGS[String(author || '')];
    return slug ? `/authors/?author=${slug}` : '/authors/';
}

function getEditorialProfile(categories) {
    const selected = new Set(Array.isArray(categories) ? categories : []);
    return EDITORIAL_PROFILES.find(profile => selected.has(profile.category)) || DEFAULT_EDITORIAL_PROFILE;
}

function normalizeSourceReferences(value) {
    const entries = Array.isArray(value) ? value : String(value || '').split(';');
    const seen = new Set();

    return entries.map(entry => {
        if (entry && typeof entry === 'object') {
            return {
                label: String(entry.label || entry.title || entry.name || entry.url || '').trim(),
                url: String(entry.url || '').trim()
            };
        }

        const raw = String(entry || '').trim();
        if (!raw) return null;
        const parts = raw.split('|').map(part => part.trim()).filter(Boolean);
        const url = parts.length > 1 ? parts[parts.length - 1] : raw;
        const label = parts.length > 1 ? parts.slice(0, -1).join(' · ') : raw;
        return { label, url };
    }).filter(reference => {
        if (!reference || !reference.url || !/^https?:\/\//i.test(reference.url)) return false;
        try {
            const parsed = new URL(reference.url);
            if (!['http:', 'https:'].includes(parsed.protocol)) return false;
            const key = parsed.href;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        } catch (_) {
            return false;
        }
    }).map(reference => ({
        label: reference.label || reference.url,
        url: reference.url
    }));
}

function renderArticleSources(sources, profile) {
    const references = normalizeSourceReferences(sources);
    if (references.length) {
        return `<span class="article-trust__source-list">${references.slice(0, 5).map(reference =>
            `<a href="${escapeHtmlAttribute(reference.url)}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(reference.label)}</a>`
        ).join(' · ')}</span>`;
    }

    const context = profile.kind === 'opinion' || profile.kind === 'betting'
        ? 'Πρόκειται για συντακτικό σημείωμα. Όπου αναφέρονται εξωτερικά στοιχεία, οι παραπομπές προστίθενται με την επόμενη επιμέλεια.'
        : 'Το αρχείο δεν έχει ακόμη ξεχωριστό κατάλογο πηγών. Οι τεκμηριωμένες παραπομπές προστίθενται σε αυτή την καρτέλα με κάθε συντακτική ενημέρωση.';

    return `<span class="article-trust__pending">${escapeHtmlText(context)}</span>`;
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

function formatArticleDate(post) {
    const value = post && (post.dateISO || post.date);
    const parsed = value ? new Date(`${value}T00:00:00Z`) : null;
    return parsed && !Number.isNaN(parsed.getTime())
        ? parsed.toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
        : String(post && (post.displayDate || value) || '');
}

function renderArticleUpdateStatus(post) {
    if (!post || !post.updatedDateISO) {
        return '<span class="article-trust__update">Δεν έχει καταγραφεί νεότερη ενημέρωση.</span>';
    }

    const date = formatArticleDate({ dateISO: post.updatedDateISO, date: post.updatedDateISO });
    return `<span class="article-trust__update">Ενημέρωση: <time datetime="${escapeHtmlAttribute(post.updatedDateISO)}">${escapeHtmlText(date)}</time></span>`;
}

function renderArticleTrust(post, categories) {
    const profile = getEditorialProfile(categories);
    const articleDate = formatArticleDate(post);
    const author = escapeHtmlText(post.author || 'F1 Stories');
    const authorHref = escapeHtmlAttribute(authorProfileHref(post.author));

    return `<section class="article-trust" aria-label="Συντακτική ταυτότητα, τεκμηρίωση και διορθώσεις">
                        <div class="article-trust__authorship"><span class="article-trust__label">ΣΥΝΤΑΚΤΗΣ</span><strong><a href="${authorHref}">${author}</a></strong><span>Δημοσίευση: <time datetime="${escapeHtmlAttribute(post.dateISO || post.date || '')}">${escapeHtmlText(articleDate)}</time></span>${renderArticleUpdateStatus(post)}</div>
                        <div class="article-trust__sources"><span class="article-trust__label">ΠΗΓΕΣ &amp; ΕΛΕΓΧΟΣ</span>${renderArticleSources(post.sources, profile)}</div>
                        <div class="article-trust__corrections"><span class="article-trust__label">ΔΙΟΡΘΩΣΕΙΣ</span><span>Διορθώνουμε δημόσια τεκμηριωμένα factual λάθη.</span><span><a href="/privacy/terms.html#terms-corrections">Πολιτική διορθώσεων</a> · <a href="mailto:myf1stories@gmail.com?subject=Διόρθωση%20άρθρου">Στείλε διόρθωση ↗</a></span></div>
                    </section>`;
}

function applyArticleEditorialIdentity(html, profile) {
    let updated = String(html || '');
    updated = updated.replace(/<article\b[^>]*\bclass=(["'])[^"']*\barticle-container\b[^"']*\1[^>]*>/i, tag => {
        let next = tag
            .replace(/\sdata-article-kind=(["'])[^"']*\1/gi, '')
            .replace(/\bclass=(["'])([^"']*)\1/i, (_match, quote, classes) => {
                const normalized = classes.split(/\s+/)
                    .filter(Boolean)
                    .filter(className => !/^article-container--/.test(className));
                normalized.push(`article-container--${profile.kind}`);
                return `class=${quote}${normalized.join(' ')}${quote}`;
            });
        return next.replace(/>$/, ` data-article-kind="${escapeHtmlAttribute(profile.kind)}">`);
    });
    updated = updated.replace(/<div\b[^>]*\bclass=(["'])[^"']*\barticle-header\b[^"']*\1[^>]*>/i, tag => {
        const next = tag.replace(/\sdata-article-dossier=(["'])[^"']*\1/gi, '');
        return next.replace(/>$/, ` data-article-dossier="${escapeHtmlAttribute(profile.label)}">`);
    });
    return updated;
}

// Older entries can lack source documents. Update only template-owned metadata
// slots so their body, embedded media, and editorial changes remain byte intact.
function refreshArticleTaxonomy(html, post) {
    html = html.replace(/Φόρτωση\.\.\./g, 'Επόμενο GP')
        .replace(/(<span class="countdown-timer" id="race-countdown">)--(<\/span>)/g, '$1Σύντομα$2')
        .replace(/(<span id="race-countdown-mobile">)--(<\/span>)/g, '$1Σύντομα$2');
    const { category, categories } = getPostTaxonomy(post);
    const primary = escapeHtmlText(category);
    const profile = getEditorialProfile(categories);
    const trustPanel = renderArticleTrust(post, categories);
    let updated = html
        .replace(/F1 STORIES \/ THE JOURNAL/g, 'F1 STORIES / Η ΕΚΔΟΣΗ')
        .replace(/(<span class="article-mini-bar__category">)[\s\S]*?(<\/span>)/, `$1${primary}$2`)
        .replace(/(<span class="article-category-pill">)[\s\S]*?(<\/span>)/, `$1${primary}$2`)
        .replace(/(<div class="article-meta">[\s\S]*?<span><svg class="icon" aria-hidden="true"><use href="#fa-tag"\/><\/svg> )[\s\S]*?(<\/span>)/, `$1${renderCategoryLinks(categories)}$2`)
        .replace(/(<div class="article-rail-meta-list">\s*<span><svg class="icon" aria-hidden="true"><use href="#fa-tag"\/><\/svg> )[\s\S]*?(<\/span>)/, `$1${primary}$2`)
        .replace(/<div class="article-rail-card article-rail-tags"[^>]*>[\s\S]*?<div class="article-tag-list"[^>]*>[\s\S]*?<\/div>\s*<\/div>/, renderCategoryRail(categories))
        .replace(/(<span class="article-mini-bar__category">)[\s\S]*?(<\/span>)/, `$1${primary}$2`)
        .replace(/(<div class="article-edition"><span>[\s\S]*?<\/span><span>)[\s\S]*?(<\/span><\/div>)/, `$1${escapeHtmlText(profile.label)}$2`)
        .replace(/(<span class="article-rail-label">)Article(<\/span>)/i, `$1${escapeHtmlText(profile.label)}$2`)
        .replace(/(<span class="article-rail-label">)Related(<\/span>)/i, '$1ΣΧΕΤΙΚΕΣ ΙΣΤΟΡΙΕΣ$2');

    updated = applyArticleEditorialIdentity(updated, profile);
    const trustPattern = /<(?:div|section)\b[^>]*\bclass=(["'])[^"']*\barticle-trust\b[^"']*\1[^>]*>[\s\S]*?(?=\s*<div\b[^>]*\bclass=(["'])[^"']*\barticle-content\b[^"']*\2[^>]*>)/i;
    if (trustPattern.test(updated)) {
        updated = updated.replace(trustPattern, trustPanel);
    } else {
        updated = updated.replace(/(<div\b[^>]*\bclass=(["'])[^"']*\barticle-content\b[^"']*\2[^>]*>)/i, `${trustPanel}\n                    $1`);
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
    const editorialProfile = getEditorialProfile(taxonomy.categories);
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
        ARTICLE_AUTHOR_PROFILE_HREF: escapeHtmlAttribute(authorProfileHref(postData.author)),
        ARTICLE_DATE_ISO_JSON: jsonScriptLiteral(postData.dateISO),
        ARTICLE_DATE_ISO: escapeHtmlAttribute(postData.dateISO),
        ARTICLE_DATE: escapeHtmlText(formatArticleDate(postData)),
        ARTICLE_UPDATED_DATE_ISO_JSON: jsonScriptLiteral(postData.updatedDateISO || postData.dateISO),
        ARTICLE_UPDATED_DATE: escapeHtmlText(formatArticleDate({ dateISO: postData.updatedDateISO || postData.dateISO, date: postData.date, displayDate: postData.displayDate })),
        ARTICLE_SOURCES_HTML: renderArticleSources(postData.sources, editorialProfile),
        ARTICLE_TRUST_HTML: renderArticleTrust(postData, taxonomy.categories),
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
        ARTICLE_EDITORIAL_KIND: escapeHtmlAttribute(editorialProfile.kind),
        ARTICLE_EDITORIAL_LABEL: escapeHtmlText(editorialProfile.label),
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
    refreshArticleTaxonomy,
    getEditorialProfile,
    normalizeSourceReferences,
    renderArticleSources
};
