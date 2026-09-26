const { fs, path, CONFIG, utils, escapeHtmlAttribute, getImageDimensionsForPublicPath } = require('./shared');
const { getPostTaxonomy, categoryLabel, categoryKind, authorLabel, findAuthor, authorThumb } = require('../taxonomy');

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

// A story's visual treatment follows its primary public section (the author's
// chosen category, as everywhere else). These are deliberately editorial labels
// rather than more raw metadata: they appear in the masthead, rail and source
// block, so readers can tell what kind of piece they are in.
const EDITORIAL_LABELS = Object.freeze({
    Technical: 'ΤΕΧΝΙΚΟ ΔΕΛΤΙΟ', Analysis: 'ΑΝΑΛΥΣΗ ΑΓΩΝΑ', History: 'ΑΠΟ ΤΟ ΑΡΧΕΙΟ', Opinion: 'ΣΗΜΕΙΩΜΑ ΓΝΩΜΗΣ',
    Betting: 'BETCAST NOTE', Drivers: 'ΠΡΟΣΩΠΟ ΤΟΥ GRID', Teams: 'ΟΜΑΔΑ ΣΤΟ GRID', News: 'ΡΕΠΟΡΤΑΖ', '2026': 'ΣΕΖΟΝ 2026'
});

function authorProfileHref(name) {
    const author = findAuthor(name);
    return author ? `/authors/?author=${author.slug}` : '/authors/';
}

function getEditorialProfile(category) {
    return Object.prototype.hasOwnProperty.call(EDITORIAL_LABELS, category)
        ? { category, kind: categoryKind(category), label: EDITORIAL_LABELS[category] }
        : { kind: 'journal', label: 'F1 STORIES JOURNAL' };
}

// The cover byline: the writer's small portrait, then "Γράφει" and the name. The
// team (no author record) signs with the name alone.
function renderHeaderByline(post) {
    const author = findAuthor(post.author);
    const name = escapeHtmlText(authorLabel(post.author || 'F1 Stories'));
    const href = escapeHtmlAttribute(authorProfileHref(post.author));
    const avatar = author
        ? `<img class="article-header-byline__avatar" src="${authorThumb(author)}" alt="" width="32" height="32" decoding="async">`
        : '';
    return `<p class="article-header-byline"${author ? ` data-author-slug="${author.slug}"` : ''}>${avatar}<span>Γράφει</span> <a href="${href}" class="article-author-link">${name}</a></p>`;
}

// The signed ending of every story: portrait, specialty, one line of biography and
// the way into the writer's archive. The writer's accent ink comes from CSS via
// data-author-slug; unknown writers (the team) get a plain card with no accent.
function renderAuthorCard(post) {
    const author = findAuthor(post.author);
    if (!author) {
        return '<section class="author-card" aria-label="Συντάκτης">'
            + '<p class="author-card__label">ΓΡΑΦΕΙ</p>'
            + '<p class="author-card__name">Η ομάδα του F1 Stories</p>'
            + '<p class="author-card__links"><a href="/authors/">Οι συντάκτες μας <span aria-hidden="true">→</span></a></p>'
            + '</section>';
    }
    const social = author.instagram
        ? `<a class="author-card__social" href="${escapeHtmlAttribute(author.instagram)}" target="_blank" rel="noopener">Instagram <span aria-hidden="true">↗</span></a>`
        : '';
    return `<section class="author-card" data-author-slug="${author.slug}" aria-labelledby="author-card-name">`
        + '<p class="author-card__label">ΓΡΑΦΕΙ</p>'
        + `<div class="author-card__head"><img class="author-card__portrait" src="${author.portrait}" alt="" width="80" height="80" loading="lazy" decoding="async">`
        + `<div><p class="author-card__name" id="author-card-name"><a href="/authors/?author=${author.slug}">${escapeHtmlText(author.label)}</a></p>`
        + `<p class="author-card__specialty">${escapeHtmlText(author.specialty)}</p></div></div>`
        + `<p class="author-card__bio">${escapeHtmlText(author.bio)}</p>`
        + `<p class="author-card__links"><a href="/blog-module/blog/index.html?author=${author.slug}">Όλα τα άρθρα του ${escapeHtmlText(author.genitive)} <span aria-hidden="true">→</span></a>${social}</p>`
        + '</section>';
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
        return `<a href="${escapeHtmlAttribute(href)}"${className ? ` class="${className}"` : ''}>${escapeHtmlText(categoryLabel(category))}</a>`;
    }).join(' ');
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

function renderArticleTrust(post, category) {
    const profile = getEditorialProfile(category);
    const articleDate = formatArticleDate(post);
    const author = escapeHtmlText(authorLabel(post.author || 'F1 Stories'));
    const authorHref = escapeHtmlAttribute(authorProfileHref(post.author));

    return `<details class="article-trust" aria-label="Συντακτική ταυτότητα, τεκμηρίωση και διορθώσεις"><summary>Συντακτική ταυτότητα &amp; πηγές</summary><div class="article-trust-grid">
                        <div class="article-trust__authorship"><span class="article-trust__label">ΣΥΝΤΑΚΤΗΣ</span><strong><a href="${authorHref}">${author}</a></strong><span>Δημοσίευση: <time datetime="${escapeHtmlAttribute(post.dateISO || post.date || '')}">${escapeHtmlText(articleDate)}</time></span>${renderArticleUpdateStatus(post)}</div>
                        <div class="article-trust__sources"><span class="article-trust__label">ΠΗΓΕΣ &amp; ΕΛΕΓΧΟΣ</span>${renderArticleSources(post.sources, profile)}</div>
                        <div class="article-trust__corrections"><span class="article-trust__label">ΔΙΟΡΘΩΣΕΙΣ</span><span>Διορθώνουμε δημόσια τεκμηριωμένα factual λάθη.</span><span><a href="/privacy/terms.html#terms-corrections">Πολιτική διορθώσεων</a> · <a href="mailto:myf1stories@gmail.com?subject=Διόρθωση%20άρθρου">Στείλε διόρθωση ↗</a></span></div>
                    </div></details>`;
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
    // The sticky mini-bar sits outside the article container; it carries the kind itself.
    updated = updated.replace(/<div class="article-mini-bar"[^>]*>/, tag => tag
        .replace(/\sdata-article-kind="[^"]*"/, '')
        .replace(/>$/, ` data-article-kind="${escapeHtmlAttribute(profile.kind)}">`));
    updated = updated.replace(/<div\b[^>]*\bclass=(["'])[^"']*\barticle-header\b[^"']*\1[^>]*>/i, tag => {
        const next = tag.replace(/\sdata-article-dossier=(["'])[^"']*\1/gi, '');
        return next.replace(/>$/, ` data-article-dossier="${escapeHtmlAttribute(profile.label)}">`);
    });
    return updated;
}

// The standfirst treatment is earned, not positional: only a real opening
// paragraph (before any heading, one or two sentences long, not a lead-in
// ending in ":") gets .article-lead. Longer openings are ordinary body text.
// Idempotent, so every build can re-evaluate old entries.
const LEAD_MIN_CHARS = 140;
const LEAD_MAX_CHARS = 240;
function markArticleLead(html) {
    const open = /<div\b[^>]*\bclass="[^"]*\barticle-content\b[^"]*"[^>]*>/.exec(html);
    if (!open) return html;
    let updated = html.replace(/(<p\b[^>]*?)\s+class="article-lead"/g, '$1');
    let pos = open.index + open[0].length;
    const blockRe = /<(p|h[1-6]|blockquote|figure|div|ul|ol|table)\b[^>]*>/g;
    for (let step = 0; step < 12; step += 1) {
        blockRe.lastIndex = pos;
        const block = blockRe.exec(updated);
        if (!block || /^h[1-3]$/.test(block[1])) return updated;
        if (block[1] === 'p') {
            const close = updated.indexOf('</p>', blockRe.lastIndex);
            const text = updated.slice(blockRe.lastIndex, close).replace(/<[^>]+>/g, '').replace(/&nbsp;|\s+/g, ' ').trim();
            if (close === -1 || text.length < LEAD_MIN_CHARS || text.length > LEAD_MAX_CHARS || /:$/.test(text)) return updated;
            if (/\bclass=/.test(block[0])) return updated; // authored classes stay untouched
            return updated.slice(0, block.index) + block[0].replace(/^<p\b/, '<p class="article-lead"') + updated.slice(block.index + block[0].length);
        }
        const end = updated.indexOf(`</${block[1]}>`, blockRe.lastIndex);
        if (end === -1) return updated;
        pos = end;
    }
    return updated;
}

// Older entries can lack source documents. Update only template-owned metadata
// slots so their body, embedded media, and editorial changes remain byte intact.
function refreshArticleTaxonomy(html, post) {
    html = html.replace(/Φόρτωση\.\.\./g, 'Επόμενο GP')
        .replace(/(<span class="countdown-timer" id="race-countdown">)--(<\/span>)/g, '$1Σύντομα$2')
        .replace(/(<span id="race-countdown-mobile">)--(<\/span>)/g, '$1Σύντομα$2');
    const { category, categories } = getPostTaxonomy(post);
    const primary = escapeHtmlText(categoryLabel(category));
    const profile = getEditorialProfile(category);
    const trustPanel = renderArticleTrust(post, category);
    const articleDate = escapeHtmlText(formatArticleDate(post));
    let updated = html
        .replace(/F1 STORIES \/ THE JOURNAL/g, 'F1 STORIES / Η ΕΚΔΟΣΗ')
        .replace(/(<span class="article-mini-bar__category">)[\s\S]*?(<\/span>)/, `$1${primary}$2`)
        .replace(/(<span class="article-category-pill">)[\s\S]*?(<\/span>)/, `$1${primary}$2`)
        .replace(/<a href="[^"]*" class="article-category-pill">[\s\S]*?<\/a>/, `<a href="${escapeHtmlAttribute(`/blog-module/blog/index.html?category=${encodeURIComponent(category)}`)}" class="article-category-pill">${primary}</a>`)
        .replace(/(<div class="article-meta">[\s\S]*?<span><svg class="icon" aria-hidden="true"><use href="#fa-tag"\/><\/svg> )[\s\S]*?(<\/span>)/, `$1${renderCategoryLinks(categories)}$2`)
        .replace(/(<div class="article-meta">[\s\S]*?fa-calendar-alt[^>]*><\/svg>\s*)[^<]*(<\/span>)/, `$1${articleDate}$2`)
        // The cover already carries category, date and reading time; the rail keeps
        // related stories and a short share set only.
        .replace(/\s*<div class="article-rail-card article-rail-tags"[^>]*>[\s\S]*?<div class="article-tag-list"[^>]*>[\s\S]*?<\/div>\s*<\/div>/, '')
        .replace(/\s*<div class="article-rail-card article-rail-meta">\s*<span class="article-rail-label">[^<]*<\/span>\s*<div class="article-rail-meta-list">[\s\S]*?<\/div>\s*<\/div>/, '')
        .replace(/\n[ \t]*<(?:a|button)\b[^\n]*class="share-btn (?:threads|instagram|telegram)"[^\n]*/g, '')
        .replace(/(<span class="article-mini-bar__category">)[\s\S]*?(<\/span>)/, `$1${primary}$2`)
        .replace(/(<div class="article-edition"><span>[\s\S]*?<\/span><span>)[\s\S]*?(<\/span><\/div>)/, `$1${escapeHtmlText(profile.label)}$2`)
        .replace(/(<span class="article-rail-label">)Article(<\/span>)/i, `$1${escapeHtmlText(profile.label)}$2`)
        .replace(/(<span class="article-rail-label">)Related(<\/span>)/i, '$1ΣΧΕΤΙΚΕΣ ΙΣΤΟΡΙΕΣ$2')
        .replace(/<p class="article-header-byline"[^>]*>[\s\S]*?<\/p>/, () => renderHeaderByline(post))
        // Every story ends on the current author card (all shapes of the old box included).
        .replace(/<(?:div class="article-author-footer"|section class="author-card")[\s\S]*?(?=\s*<div class="sponsor-strip">)/, () => renderAuthorCard(post));

    updated = applyArticleEditorialIdentity(updated, profile);
    updated = markArticleLead(updated);
    const trustPattern = /<(?:div|section|details)\b[^>]*\bclass=(["'])[^"']*\barticle-trust\b[^"']*\1[^>]*>[\s\S]*?(?=\s*<div\b[^>]*\bclass=(["'])[^"']*\barticle-content\b[^"']*\2[^>]*>)/i;
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
    const editorialProfile = getEditorialProfile(taxonomy.category);
    const headerImage = postData.backgroundImage || postData.image || CONFIG.DEFAULT_BLOG_IMAGE;
    const bgImageFilename = headerImage.includes('/')
        ? headerImage.substring(headerImage.lastIndexOf('/') + 1)
        : headerImage;
    const heroAvifFile = `${path.parse(bgImageFilename).name}.avif`;
    const heroBase = path.parse(bgImageFilename).name;
    const mobileWebp = `${heroBase}-mobile.webp`;
    const mobileAvif = `${heroBase}-mobile.avif`;
    const heroSizes = '(max-width: 820px) calc(100vw - 2rem), 770px';
    const heroAvifSrcset = fs.existsSync(path.join(entryPath, heroAvifFile))
        ? `${fs.existsSync(path.join(entryPath, mobileAvif)) ? `${encodePathSegment(mobileAvif)} 800w, ` : ''}${encodePathSegment(heroAvifFile)} 1600w`
        : '';
    const heroAvifSource = heroAvifSrcset
        ? `<source type="image/avif" srcset="${heroAvifSrcset}" sizes="${heroSizes}">`
        : '';
    const heroWebpSrcset = fs.existsSync(path.join(entryPath, mobileWebp))
        ? `${encodePathSegment(mobileWebp)} 800w, ${encodePathSegment(bgImageFilename)} 1600w`
        : encodePathSegment(bgImageFilename);
    // Preload the candidate the <picture> will actually pick: AVIF when it has an
    // AVIF source (browsers without AVIF skip the typed preload), otherwise WebP.
    const heroPreload = heroAvifSrcset
        ? `<link rel="preload" as="image" type="image/avif" href="${escapeHtmlAttribute(encodePathSegment(heroAvifFile))}" imagesrcset="${escapeHtmlAttribute(heroAvifSrcset)}" imagesizes="${heroSizes}" fetchpriority="high">`
        : `<link rel="preload" as="image" href="${escapeHtmlAttribute(encodePathSegment(bgImageFilename))}" imagesrcset="${escapeHtmlAttribute(heroWebpSrcset)}" imagesizes="${heroSizes}" fetchpriority="high">`;
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
        ARTICLE_AUTHOR_TEXT: escapeHtmlText(authorLabel(postData.author)),
        ARTICLE_AUTHOR_ATTR: escapeHtmlAttribute(authorLabel(postData.author)),
        ARTICLE_AUTHOR_JSON: jsonScriptLiteral(postData.author),
        ARTICLE_HEADER_BYLINE: renderHeaderByline(postData),
        ARTICLE_DATE_ISO_JSON: jsonScriptLiteral(postData.dateISO),
        ARTICLE_DATE_ISO: escapeHtmlAttribute(postData.dateISO),
        ARTICLE_DATE: escapeHtmlText(formatArticleDate(postData)),
        ARTICLE_UPDATED_DATE_ISO_JSON: jsonScriptLiteral(postData.updatedDateISO || postData.dateISO),
        ARTICLE_UPDATED_DATE: escapeHtmlText(formatArticleDate({ dateISO: postData.updatedDateISO || postData.dateISO, date: postData.date, displayDate: postData.displayDate })),
        ARTICLE_SOURCES_HTML: renderArticleSources(postData.sources, editorialProfile),
        ARTICLE_TRUST_HTML: renderArticleTrust(postData, taxonomy.category),
        ARTICLE_AUTHOR_CARD: renderAuthorCard(postData),
        ARTICLE_EXCERPT_ATTR: escapeHtmlAttribute(postData.excerpt),
        ARTICLE_EXCERPT_JSON: jsonScriptLiteral(postData.excerpt),
        ARTICLE_COMMENTS: String(postData.comments || 0),
        ARTICLE_IMAGE_WIDTH: String(headerImageDimensions && headerImageDimensions.width ? headerImageDimensions.width : 848),
        ARTICLE_IMAGE_HEIGHT: String(headerImageDimensions && headerImageDimensions.height ? headerImageDimensions.height : 400),
        ARTICLE_IMAGE_ATTR: escapeHtmlAttribute(imageFilePath),
        ARTICLE_IMAGE_SRCSET: escapeHtmlAttribute(heroWebpSrcset),
        ARTICLE_IMAGE_URL_ATTR: escapeHtmlAttribute(imageUrl),
        ARTICLE_IMAGE_URL_JSON: jsonScriptLiteral(imageUrl),
        ARTICLE_HERO_AVIF_SOURCE: heroAvifSource,
        ARTICLE_HERO_PRELOAD: heroPreload,
        ARTICLE_ID_JSON: jsonScriptLiteral(folderName),
        ARTICLE_ID: escapeHtmlAttribute(folderName),
        ARTICLE_CATEGORY_TEXT: escapeHtmlText(categoryLabel(taxonomy.category)),
        ARTICLE_CATEGORIES_JSON: JSON.stringify(taxonomy.categories),
        ARTICLE_EDITORIAL_KIND: escapeHtmlAttribute(editorialProfile.kind),
        ARTICLE_EDITORIAL_LABEL: escapeHtmlText(editorialProfile.label),
        ARTICLE_CATEGORY_LINKS: renderCategoryLinks(taxonomy.categories),
        ARTICLE_CONTENT: postData.content || '',
        ARTICLE_URL_ATTR: escapeHtmlAttribute(articleUrl),
        ARTICLE_URL_JSON: jsonScriptLiteral(articleUrl),
        ARTICLE_URL_PARAM: encodeURIComponent(articleUrl)
    };

    const blogHtml = replaceTemplateTokens(templateHtml, renderTokens);

    if (!fs.existsSync(CONFIG.OUTPUT_HTML_DIR)) utils.ensureDirectory(CONFIG.OUTPUT_HTML_DIR);
    const output = markArticleLead(blogHtml).replace(/[ \t]+$/gm, '');
    fs.writeFileSync(path.join(entryPath, 'article.html'), output);
    return output;
}

module.exports = {
    renderArticleHtml,
    refreshArticleTaxonomy,
    getEditorialProfile,
    renderAuthorCard,
    normalizeSourceReferences,
    renderArticleSources,
    markArticleLead
};
