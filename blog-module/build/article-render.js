const { fs, path, CONFIG, utils, escapeHtmlAttribute, getImageDimensions, getImageDimensionsForPublicPath } = require('./shared');
const { truthfulSrcset } = require('./image-sizes');
const { mediaFor, slotOf, creditLineHtml, applyBodyMedia } = require('./media-meta');
const { getPostTaxonomy, categoryLabel, categoryKind, authorLabel, findAuthor, authorThumb, formatReadingTime } = require('../taxonomy');
const { readingTimeFromWords, wordsInHtml } = require('./reading-time');
const { transformBody, renderRunningOrder, coverVariant, COVER_SIZES } = require('./race-report');

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
    Betting: 'BETCAST NOTE', Drivers: 'ΠΡΟΣΩΠΟ ΤΟΥ GRID', Teams: 'ΟΜΑΔΑ ΣΤΟ GRID', News: 'ΡΕΠΟΡΤΑΖ'
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

// The cover byline on the signal rule: the writer's small portrait, "Γράφει", the
// name and their specialty. A writer without a record signs with the name alone.
function renderHeaderByline(post) {
    const author = findAuthor(post.author);
    const name = escapeHtmlText(authorLabel(post.author || 'F1 Stories'));
    const href = escapeHtmlAttribute(authorProfileHref(post.author));
    const avatar = author ? `<img src="${authorThumb(author)}" alt="" width="48" height="48" decoding="async">` : '';
    const specialty = author && author.specialty ? `<small>${escapeHtmlText(author.specialty)}</small>` : '';
    return `<div class="rr-cover__side${author ? '' : ' rr-cover__side--plain'}"${author ? ` data-author-slug="${author.slug}"` : ''}>${avatar}`
        + `<p><span>Γράφει</span> <a href="${href}" class="article-author-link">${name}</a>${specialty}</p></div>`;
}

// The signed ending of every story, on the ink pit wall: portrait, specialty, one line
// of biography and the way into the writer's archive. Unknown writers get the team.
function renderAuthorCard(post) {
    const author = findAuthor(post.author);
    if (!author) {
        return '<div class="rr-pitwall__author rr-pitwall__author--plain"><div>'
            + '<p class="rr-label">Γράφει</p>'
            + '<h2 class="rr-pitwall__name" id="author-card-name">Η ομάδα του F1 Stories</h2>'
            + '<p class="rr-pitwall__links"><a href="/authors/">Οι συντάκτες μας <span aria-hidden="true">→</span></a></p>'
            + '</div></div>';
    }
    const social = author.instagram
        ? `<a href="${escapeHtmlAttribute(author.instagram)}" target="_blank" rel="noopener">Instagram <span aria-hidden="true">↗</span></a>`
        : '';
    return `<div class="rr-pitwall__author" data-author-slug="${author.slug}">`
        + `<img src="${author.portrait}" alt="" width="132" height="132" loading="lazy" decoding="async"><div>`
        + '<p class="rr-label">Γράφει</p>'
        + `<h2 class="rr-pitwall__name" id="author-card-name"><a href="/authors/?author=${author.slug}">${escapeHtmlText(author.label)}</a></h2>`
        + `<p class="rr-pitwall__role">${escapeHtmlText(author.specialty)}</p>`
        + `<p class="rr-pitwall__bio">${escapeHtmlText(author.bio)}</p>`
        + `<p class="rr-pitwall__links"><a href="/blog-module/blog/index.html?author=${author.slug}">Όλα τα άρθρα του ${escapeHtmlText(author.genitive)} <span aria-hidden="true">→</span></a>${social}</p>`
        + '</div></div>';
}

// The partners strip is the homepage's own (labels, logos, roles and links), read from index.html so the two never
// drift apart. Only the ids change; the article styles it as the homepage's night edition in both themes.
let partnersHtml = null;
function renderPartners() {
    if (partnersHtml !== null) return partnersHtml;
    const home = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
    const section = (/<section id="home-sponsors"[\s\S]*?<\/section>/.exec(home) || [''])[0];
    const label = /<h2 class="sponsor-strip-label"[^>]*>([\s\S]*?)<\/h2>/.exec(section);
    const list = /<ul class="sponsor-logos">[\s\S]*?<\/ul>/.exec(section);
    if (!label || !list) throw new Error('index.html: the #home-sponsors partners block was not found');
    partnersHtml = `<div class="rr-partners__layout">\n            <h2 class="rr-partners__label" id="partners-heading">${label[1]}</h2>\n            ${list[0].replace(/\n\s*/g, '\n            ')}\n        </div>`;
    return partnersHtml;
}

const pad2 = value => String(value).padStart(2, '0');

function editionDate(post) {
    const [year, month, day] = String(post.dateISO || '').split('-');
    return year && month && day ? `${day}.${month}.${year}` : escapeHtmlText(post.displayDate || post.date || '');
}

// The timing strip: real metadata only. The fourth column counts the data tools when the
// story has any, otherwise its length in words.
function renderTiming(post, category, minutes, dataCount, words) {
    const [year, month, day] = String(post.dateISO || '').split('-');
    const date = year && month && day
        ? `<time datetime="${escapeHtmlAttribute(post.dateISO)}">${day}.${month}<small>.${year}</small></time>`
        : escapeHtmlText(post.displayDate || post.date || '');
    const fourth = dataCount
        ? `<div class="is-signal"><dt>Δεδομένα</dt><dd class="rr-num">${pad2(dataCount)}<small> ${dataCount === 1 ? 'εργαλείο' : 'εργαλεία'}</small></dd></div>`
        : words ? `<div><dt>Έκταση</dt><dd class="rr-num">${words.toLocaleString('el-GR')}<small> λέξεις</small></dd></div>` : '';
    return '<dl class="rr-timing">'
        + `<div><dt>Κατηγορία</dt><dd>${escapeHtmlText(categoryLabel(category))}</dd></div>`
        + `<div><dt>Δημοσίευση</dt><dd class="rr-num">${date}</dd></div>`
        + (minutes ? `<div><dt>Ανάγνωση</dt><dd class="rr-num">${pad2(minutes)}<small> ${minutes === 1 ? 'λεπτό' : 'λεπτά'}</small></dd></div>` : '')
        + `${fourth}</dl>`;
}

// Desktop running-order tower and, below it, the phone/tablet contents list: both list
// exactly the sections and data stops the body contains, so either can be empty.
function renderRunningOrderBlocks(entries) {
    if (!entries.length) return '';
    const items = renderRunningOrder(entries);
    const tower = `<nav class="rr-tower" aria-label="Running order: ενότητες και δεδομένα">\n                <p class="rr-tower__label" aria-hidden="true">RUNNING ORDER</p>\n                <ol class="rr-ro">\n${items}\n                </ol>\n            </nav>`;
    if (entries.length < 3) return tower;
    return `${tower}\n            <details class="rr-contents">\n                <summary>Σε αυτό το άρθρο <span>${pad2(entries.length)}</span></summary>\n                <nav aria-label="Ενότητες άρθρου"><ol class="rr-ro">\n${items}\n                </ol></nav>\n            </details>`;
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

// Badge text such as "8 λεπτά ανάγνωσης": the same stored value the cards, index and homepage show (see reading-time.js).
function readingBadgeText(post) {
    const stored = post.readingTime || post.readTime
        || (post.wordCount ? readingTimeFromWords(post.wordCount) : '')
        || (post.content ? readingTimeFromWords(wordsInHtml(post.content)) : '');
    const minutes = formatReadingTime(stored);
    return minutes ? `${minutes} ανάγνωσης` : '';
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
    let updated = html.replace(/<p\b[^>]*>/gi, tag => tag.replace(/\s+class=(["'])(.*?)\1/i, (_match, quote, classes) => {
        const cleaned = classes.split(/\s+/).filter(className => className && className !== 'article-lead');
        return cleaned.length ? ` class=${quote}${cleaned.join(' ')}${quote}` : '';
    }));
    const updatedOpen = /<div\b[^>]*\bclass="[^"]*\barticle-content\b[^"]*"[^>]*>/.exec(updated);
    const bodyStart = updatedOpen.index + updatedOpen[0].length;
    const authoredLead = /<p\b[^>]*\bdata-article-lead="true"[^>]*>/i.exec(updated.slice(bodyStart));
    if (authoredLead) {
        const tag = authoredLead[0].replace(/\s+class=(["'])(.*?)\1/i, (_match, quote, classes) => {
            const names = classes.split(/\s+/).filter(Boolean);
            if (!names.includes('article-lead')) names.push('article-lead');
            return ` class=${quote}${names.join(' ')}${quote}`;
        }).replace(/^<p\b(?![^>]*\bclass=)/i, '<p class="article-lead"');
        return updated.slice(0, bodyStart + authoredLead.index) + tag + updated.slice(bodyStart + authoredLead.index + authoredLead[0].length);
    }
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
        .replace(/(<span id="reading-time-value">)[^<]*(<\/span>)/, (block, open, close) => {
            const badge = readingBadgeText(post);
            return badge ? `${open}${escapeHtmlText(badge)}${close}` : block;
        })
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

// Older published bodies declare widths their files no longer have (a 1600px file as "2048w"). Each width descriptor of
// a story's own file is rewritten to the file's measured width; anything else is left as written. Idempotent.
async function measureBodySrcsets(html, entryPath, id) {
    const names = new Set();
    for (const set of html.matchAll(/\bsrcset="([^"]+)"/g)) {
        for (const part of set[1].split(',')) {
            const [name, descriptor] = part.trim().split(/\s+/);
            if (/^\d+w$/.test(descriptor || '') && /^[\w.-]+$/.test(name)) names.add(name);
        }
    }
    const widths = new Map();
    await Promise.all([...names].map(async name => {
        const size = fs.existsSync(path.join(entryPath, name)) ? await getImageDimensions(path.join(entryPath, name)) : null;
        if (size) widths.set(name, size.width);
    }));
    // A same-path editorial replacement can change the original's proportions, too.
    const images = new Map();
    for (const tag of html.matchAll(/<img\b[^>]*\bclass="article-content-img"[^>]*>/g)) {
        const name = (/\ssrc="([^"]+)"/.exec(tag[0]) || [])[1];
        if (name && /^[\w.-]+$/.test(name) && mediaFor(id, slotOf(name))?.type === 'graphic') images.set(name, await getImageDimensions(path.join(entryPath, name)));
    }
    html = html.replace(/<img\b[^>]*\bclass="article-content-img"[^>]*>/g, tag => {
        const size = images.get((/\ssrc="([^"]+)"/.exec(tag) || [])[1]);
        return size ? tag.replace(/\bwidth="\d+"/, `width="${size.width}"`).replace(/\bheight="\d+"/, `height="${size.height}"`) : tag;
    });
    return html.replace(/\bsrcset="([^"]+)"/g, (match, set) => {
        const parts = set.split(',').map(part => part.trim().split(/\s+/));
        const wrong = parts.some(([name, descriptor]) => widths.has(name) && /^\d+w$/.test(descriptor || '') && descriptor !== `${widths.get(name)}w`);
        if (!wrong) return match;
        // Two copies that turn out to be the same width are one candidate (the first, lighter one stays).
        const seen = new Set();
        return `srcset="${parts.map(([name, descriptor]) => (widths.has(name) && /^\d+w$/.test(descriptor || '') ? `${name} ${widths.get(name)}w` : [name, descriptor].filter(Boolean).join(' ')))
            .filter(candidate => { const w = candidate.split(' ')[1]; if (!w || !w.endsWith('w')) return true; if (seen.has(w)) return false; seen.add(w); return true; })
            .join(', ')}"`;
    });
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
    const replacementDimensions = mediaFor(folderName, slotOf(bgImageFilename))?.type === 'graphic'
        ? await getImageDimensionsForPublicPath(headerImage) : null;
    const headerImageDimensions = replacementDimensions || (postData.backgroundImageWidth && postData.backgroundImageHeight
        ? { width: postData.backgroundImageWidth, height: postData.backgroundImageHeight }
        : await getImageDimensionsForPublicPath(headerImage));
    const coverWidth = headerImageDimensions && headerImageDimensions.width;
    const cover = coverVariant(coverWidth, headerImageDimensions && headerImageDimensions.height);
    const heroSizes = COVER_SIZES[cover];
    // Width descriptors are the files' measured widths (a small original's "mobile" copy is not 800px, and an
    // older full AVIF can be wider than 1600px), so the browser picks from what really exists.
    const measured = new Map();
    await Promise.all([mobileAvif, heroAvifFile, mobileWebp, bgImageFilename].map(async name => {
        const file = path.join(entryPath, name);
        if (fs.existsSync(file)) measured.set(file, await getImageDimensions(file));
    }));
    const dimensionsOf = file => measured.get(file) || null;
    const heroAvifSrcset = measured.get(path.join(entryPath, heroAvifFile))
        ? truthfulSrcset(entryPath, [mobileAvif, heroAvifFile], encodePathSegment, dimensionsOf)
        : '';
    const heroAvifSource = heroAvifSrcset
        ? `<source type="image/avif" srcset="${heroAvifSrcset}" sizes="${heroSizes}">`
        : '';
    const heroWebpSrcset = truthfulSrcset(entryPath, [mobileWebp, bgImageFilename], encodePathSegment, dimensionsOf)
        || encodePathSegment(bgImageFilename);
    // The editors' record for the cover file (media-metadata.json): presentation type, focal point, caption/credit
    // line and verified alt. Nothing is printed or changed without an entry.
    const coverMeta = headerImage.startsWith('/blog-module/blog-entries/') ? mediaFor(folderName, slotOf(bgImageFilename)) : null;
    const coverStyle = [
        coverWidth && cover !== 'split' ? `--cover-${cover === 'bleed' ? 'max' : 'w'}: ${coverWidth}px` : '',
        coverMeta && coverMeta.focus ? `--focus: ${coverMeta.focus}` : ''
    ].filter(Boolean).join('; ');
    const coverLine = creditLineHtml(coverMeta);
    // Preload the candidate the <picture> will actually pick: AVIF when it has an
    // AVIF source (browsers without AVIF skip the typed preload), otherwise WebP.
    // The href is the widest candidate the srcset really lists (a small original's copies collapse to one file).
    const widest = set => set.split(', ').pop().split(' ')[0];
    const heroPreload = heroAvifSrcset
        ? `<link rel="preload" as="image" type="image/avif" href="${escapeHtmlAttribute(widest(heroAvifSrcset))}" imagesrcset="${escapeHtmlAttribute(heroAvifSrcset)}" imagesizes="${heroSizes}" fetchpriority="high">`
        : `<link rel="preload" as="image" href="${escapeHtmlAttribute(widest(heroWebpSrcset))}" imagesrcset="${escapeHtmlAttribute(heroWebpSrcset)}" imagesizes="${heroSizes}" fetchpriority="high">`;
    const body = transformBody(await measureBodySrcsets(applyBodyMedia(postData.content || '', folderName), entryPath, folderName));
    const badge = readingBadgeText(postData);
    const minutes = parseInt(badge, 10) || 1;
    const titleText = String(postData.title || '');
    const templateHtml = fs.readFileSync(CONFIG.TEMPLATE_PATH, 'utf8');
    const articleUrl = `https://f1-stories.gr/blog-module/blog-entries/${encodePathSegment(folderName)}/article.html`;
    const imageFilePath = encodePathSegment(bgImageFilename);
    const imageUrl = `https://f1-stories.gr/blog-module/blog-entries/${encodePathSegment(folderName)}/${imageFilePath}`;
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
        ARTICLE_READING_TIME: escapeHtmlText(readingBadgeText(postData) || '1 λεπτό ανάγνωσης'),
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
        ARTICLE_CATEGORY_HREF: escapeHtmlAttribute(`/blog-module/blog/index.html?category=${encodeURIComponent(taxonomy.category)}`),
        ARTICLE_EDITION_DATE: editionDate(postData),
        ARTICLE_COVER_VARIANT: cover,
        ARTICLE_COVER_SIZES: heroSizes,
        // The photograph's own width: a bleed never stretches past it on very wide screens, and an inset
        // reserves its box before the file arrives (no layout shift).
        // A graphic, diagram or archival print is marked so the cover shows it whole instead of cropping it.
        ARTICLE_COVER_STYLE: (coverMeta && coverMeta.type && coverMeta.type !== 'photo' ? ` data-media="${coverMeta.type}"` : '')
            + (coverStyle ? ` style="${coverStyle}"` : ''),
        ARTICLE_COVER_CAPTION: coverLine ? `<figcaption class="rr-cover__caption">${coverLine}</figcaption>` : '',
        ARTICLE_COVER_ALT: escapeHtmlAttribute(coverMeta && coverMeta.alt ? coverMeta.alt : postData.title),
        // Long titles step down a size; a title that ends in its own punctuation gets no signal full stop.
        ARTICLE_TITLE_CLASS: titleText.length > 64 ? 'rr-title rr-title--long' : 'rr-title',
        ARTICLE_TITLE_PERIOD: /[.!?;…»"”)]$/.test(titleText.trim()) ? '' : '<span class="rr-period" aria-hidden="true">.</span>',
        ARTICLE_TIMING_HTML: renderTiming(postData, taxonomy.category, minutes, body.dataCount, Number(postData.wordCount) || wordsInHtml(body.html)),
        ARTICLE_SECTOR_SEGMENTS: body.sections ? `<ol class="rr-sectorbar__segs" aria-hidden="true">${'<li></li>'.repeat(body.sections)}</ol>` : '',
        ARTICLE_RUNNING_ORDER: renderRunningOrderBlocks(body.entries),
        ARTICLE_SPONSORS: renderPartners(),
        ARTICLE_CONTENT: body.html,
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
