const { Worker } = require('worker_threads');
const { execFileSync } = require('child_process');
const os = require('os');
const {
    fs,
    path,
    CONFIG,
    utils,
    escapeHtmlAttribute,
    getCardThumbnailPath,
    getImageDimensionsForPublicPath
} = require('./shared');
const { generateSitemap } = require('./sitemap');
const { htmlToPlainText } = require('./metadata');
const { injectRelatedArticles } = require('./related');
const { injectPrevNextLinks } = require('./nav');
const { renderArticleHtml, refreshArticleTaxonomy } = require('./article-render');
const { injectAuthorsDirectory } = require('./authors-page');
const {
    PUBLIC_CATEGORIES, AUTHORS, authorThumb, getPostTaxonomy, categoryLabel, categoryKind, authorLabel, greekUpper, formatDate, ledgerDate,
    formatReadingTime, cardImageSrcset, CARD_SIZES, JOURNAL_LAYOUT, isLedgerPicture
} = require('../taxonomy');

const EDITORIAL_SELECTION_PATH = path.join(__dirname, '..', 'editorial-selection.json');

function parseBuildOptions(argv = process.argv, env = process.env) {
    const forceRebuild = argv.includes('--force') || argv.includes('-f');
    const maxWorkers = Math.min(parseInt(env.BLOG_WORKERS || '0', 10) || os.cpus().length, os.cpus().length);
    return { forceRebuild, maxWorkers };
}

function readJsonIfExists(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_) {
        return null;
    }
}

function generateMissingImageVariants() {
    const generatorPath = path.join(__dirname, '..', 'generate-image-variants.js');
    if (!fs.existsSync(generatorPath)) return;
    execFileSync(process.execPath, [generatorPath, '--run', '--cards-only'], { stdio: 'inherit' });
}

function sameJsonExceptKey(left, right, key) {
    if (!left || !right) return false;
    const a = { ...left };
    const b = { ...right };
    delete a[key];
    delete b[key];
    return JSON.stringify(a) === JSON.stringify(b);
}

function runWorker(entryPath) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, 'worker.js'), {
            workerData: { entryPath }
        });
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', code => {
            if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
        });
    });
}

async function runWorkerPool(entryPaths, concurrency) {
    const results = [];
    const failures = [];
    let index = 0;

    async function next() {
        if (index >= entryPaths.length) return;
        const currentIndex = index++;
        const entryPath = entryPaths[currentIndex];
        const folderName = path.basename(entryPath);

        try {
            const result = await runWorker(entryPath);
            if (result.ok && result.postData) {
                results.push(result.postData);
                console.log(`✅ [worker] ${folderName}`);
            } else {
                failures.push({ entryPath, error: result.error || 'no data' });
                console.warn(`❌ [worker] ${folderName}: ${result.error || 'no data'}`);
            }
        } catch (error) {
            failures.push({ entryPath, error: error.message });
            console.error(`❌ [worker] ${folderName}: ${error.message}`);
        }

        await next();
    }

    await Promise.all(Array.from({ length: concurrency }, () => next()));
    return { results, failures };
}

function fixMissingAuthors(blogPosts) {
    blogPosts.forEach(post => {
        if (!post.author || post.author === 'F1 Stories Team') {
            const lastChar = post.id.charAt(post.id.length - 1);
            if (Object.prototype.hasOwnProperty.call(CONFIG.AUTHOR_MAP, lastChar)) {
                post.author = CONFIG.AUTHOR_MAP[lastChar];
            }
        }
    });
}

async function buildIndexPosts(blogPosts) {
    return Promise.all(blogPosts.map(async post => {
        const { category, categories: ordered, tags } = getPostTaxonomy(post);
        // The primary category leads the list; it is the one that carries the colour signal.
        const categories = [category, ...ordered.filter(value => value !== category)];
        const thumbnail = getCardThumbnailPath(post.image);
        const thumbnailDimensions = await getImageDimensionsForPublicPath(thumbnail);
        return {
            id: post.id,
            title: post.title,
            author: post.author,
            date: post.date,
            thumbnail,
            thumbnailWidth: thumbnailDimensions && thumbnailDimensions.width ? thumbnailDimensions.width : 400,
            thumbnailHeight: thumbnailDimensions && thumbnailDimensions.height ? thumbnailDimensions.height : 188,
            excerpt: compactExcerpt(post.excerpt),
            readingTime: post.readingTime,
            categories,
            tags,
            hasSource: fs.existsSync(path.join(CONFIG.BLOG_DIR, post.id, 'source.txt'))
        };
    }));
}

function compactExcerpt(value, maxLength = 120) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) return text;
    const clipped = text.slice(0, maxLength).replace(/\s+\S*$/, '').trim();
    return `${clipped || text.slice(0, maxLength).trim()}...`;
}

function formatBlogIndexDate(post) {
    return formatDate(post.date || '') || post.displayDate || '';
}

function jsonKb(value) {
    return Math.round(Buffer.byteLength(JSON.stringify(value)) / 1024);
}

// Run-length encodes a per-post boolean: comma-separated runs of a 0/1 marker
// followed by the run length in base36.
function runLengthFlags(posts, predicate) {
    const runs = [];
    let previous = null;
    let length = 0;
    posts.forEach(post => {
        const value = predicate(post);
        if (previous !== null && value === previous) {
            length += 1;
            return;
        }
        if (previous !== null) runs.push((previous ? '1' : '0') + length.toString(36));
        previous = value;
        length = 1;
    });
    if (previous !== null) runs.push((previous ? '1' : '0') + length.toString(36));
    return runs.join(',');
}

function buildCompactIndexData(posts) {
    const authors = Array.from(new Set(posts.map(post => post.author || 'F1 Stories')));
    const categories = PUBLIC_CATEGORIES;
    const tags = Array.from(new Set(posts.flatMap(post => post.tags || [])));
    const thumbnailFlags = runLengthFlags(posts, post => !!(post.thumbnail && /-card\.webp(?:\?.*)?$/i.test(post.thumbnail)));
    const sourceFlags = runLengthFlags(posts, post => !!post.hasSource);

    return {
        v: 2,
        a: authors,
        c: categories,
        t: tags,
        // Run-length encoded thumbnail variants. Each comma-separated run is
        // a 0/1 marker followed by its length in base36; 1 means the smaller
        // -card.webp file exists. Keeping this as a top-level field preserves
        // the 10-field post row and the compact feed budget.
        h: thumbnailFlags,
        // Same encoding; 1 means the folder has a source.txt the author tools
        // can edit. Source-less (legacy) articles are read-only there.
        s: sourceFlags,
        p: posts.map(post => [
            post.id,
            post.title,
            authors.indexOf(post.author || 'F1 Stories'),
            post.date,
            post.thumbnailWidth === 400 ? 0 : post.thumbnailWidth,
            post.thumbnailHeight,
            post.excerpt,
            post.readingTime,
            (post.categories || []).map(category => categories.indexOf(category)),
            (post.tags || []).map(tag => tags.indexOf(tag))
        ])
    };
}

function loadEditorialSelection(filePath = EDITORIAL_SELECTION_PATH) {
    if (!fs.existsSync(filePath)) return {};
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch (error) {
        console.warn(`⚠️  ${path.basename(filePath)} is not valid JSON; the Journal front falls back to the newest stories (${error.message})`);
        return {};
    }
}

// The Journal front: one lead, two secondary stories, a short recent list and
// optional deep reads. Explicit picks come from editorial-selection.json; every
// empty or invalid slot falls back to the newest story not already shown, so the
// front is valid with no selection file at all. `posts` must be newest first.
function resolveJournalFront(posts, selection = {}) {
    const byId = new Map(posts.map(post => [post.id, post]));
    const used = new Set();
    const warnings = [];
    function pick(value, limit) {
        const picked = [];
        (Array.isArray(value) ? value : [value]).forEach(id => {
            if (typeof id !== 'string' || !id.trim()) return;
            const post = byId.get(id.trim());
            if (!post) warnings.push(`unknown article id "${id}"`);
            else if (!used.has(post.id) && picked.length < limit) {
                used.add(post.id);
                picked.push(post);
            }
        });
        return picked;
    }
    function fill(picked, limit) {
        for (const post of posts) {
            if (picked.length >= limit) break;
            if (used.has(post.id)) continue;
            used.add(post.id);
            picked.push(post);
        }
        return picked;
    }
    const lead = pick(selection.lead, 1);
    const secondary = pick(selection.secondary, JOURNAL_LAYOUT.secondary);
    const deepReads = pick(selection.deepReads, JOURNAL_LAYOUT.deepReads);
    fill(lead, 1);
    fill(secondary, JOURNAL_LAYOUT.secondary);
    const recent = fill([], JOURNAL_LAYOUT.recent);
    return { lead: lead[0] || null, secondary, recent, deepReads, ids: [...used], warnings };
}

function storyUrl(post) {
    return post.url || `/blog-module/blog-entries/${post.id}/article.html`;
}

function primaryCategory(post) {
    return (post.categories && post.categories[0]) || 'News';
}

// The card-sized image, or '' when the article folder does not ship it.
function storyImage(post) {
    const image = post.thumbnail || post.image || '';
    if (!image || !image.startsWith('/blog-module/blog-entries/')) return image;
    return fs.existsSync(path.join(CONFIG.BLOG_DIR, post.id, path.posix.basename(image))) ? image : '';
}

function storyReadingTime(post) {
    let readingTime = post.readingTime || post.readTime || '';
    if (!readingTime && post.wordCount) readingTime = `${Math.max(1, Math.ceil(post.wordCount / 200))} min`;
    return formatReadingTime(readingTime);
}

// Story images sit inside a link that already carries the headline, so alt stays empty.
function renderStoryImage(post, image, { sizes, full = false, eager = false }) {
    const srcset = cardImageSrcset(image, full);
    const width = parseInt(post.thumbnailWidth, 10) || 400;
    const height = parseInt(post.thumbnailHeight, 10) || 188;
    return `<img src="${escapeHtmlAttribute(image)}"`
        + (srcset ? ` srcset="${escapeHtmlAttribute(srcset)}" sizes="${sizes}"` : '')
        + ` width="${width}" height="${height}"`
        + (eager ? ' loading="eager" fetchpriority="high"' : ' loading="lazy"')
        + ` decoding="async" alt="" data-fallback-src="${CONFIG.DEFAULT_BLOG_IMAGE}">`;
}

function renderStoryCategory(post, withSecondary = false) {
    const [primary, ...rest] = post.categories && post.categories.length ? post.categories : ['News'];
    const more = withSecondary && rest.length
        ? `<span class="story-cats">${escapeHtmlAttribute(rest.map(categoryLabel).join(' · '))}</span>`
        : '';
    return `<p class="story-kicker"><span class="story-cat">${escapeHtmlAttribute(greekUpper(categoryLabel(primary)))}</span>${more}</p>`;
}

function renderStoryMeta(post, withDate) {
    const items = [`<span>${escapeHtmlAttribute(authorLabel(post.author || 'F1 Stories'))}</span>`];
    if (withDate) items.push(`<time datetime="${escapeHtmlAttribute(post.date || '')}">${escapeHtmlAttribute(formatBlogIndexDate(post))}</time>`);
    const readingTime = storyReadingTime(post);
    if (readingTime) items.push(`<span>${escapeHtmlAttribute(readingTime)}</span>`);
    return `<p class="story-meta">${items.join('')}</p>`;
}

function renderJournalLead(post, deck) {
    const image = storyImage(post);
    // Long headlines step down a size so the deck and byline stay on the first screen;
    // qa:visual checks the live lead. ponytail: character count stands
    // in for rendered width (62 fits every current title at 360px); if qa:visual flags the lead, lower it.
    const long = post.title.length > 62 ? ' journal-lead--long' : '';
    return `<article class="journal-lead${image ? '' : ' journal-lead--text'}${long}" data-kind="${categoryKind(primaryCategory(post))}">`
        + `<a class="journal-lead__link" href="${escapeHtmlAttribute(storyUrl(post))}">`
        + (image ? `<div class="journal-lead__media">${renderStoryImage(post, image, { sizes: CARD_SIZES.archiveLead, full: true, eager: true })}</div>` : '')
        + `<div class="journal-lead__text">${renderStoryCategory(post, true)}`
        + `<h2 class="journal-lead__title">${escapeHtmlAttribute(post.title)}</h2>`
        + (deck ? `<p class="journal-lead__deck">${escapeHtmlAttribute(deck)}</p>` : '')
        + `${renderStoryMeta(post, true)}</div></a></article>`;
}

function renderJournalSecondary(post) {
    const image = storyImage(post);
    return `<article class="journal-second${image ? '' : ' journal-second--text'}" data-kind="${categoryKind(primaryCategory(post))}">`
        + `<a class="journal-second__link" href="${escapeHtmlAttribute(storyUrl(post))}">`
        + (image ? `<div class="journal-second__media">${renderStoryImage(post, image, { sizes: CARD_SIZES.archiveSecond })}</div>` : '')
        + `<div class="journal-second__text">${renderStoryCategory(post)}`
        + `<h2 class="journal-second__title">${escapeHtmlAttribute(post.title)}</h2>`
        + `${renderStoryMeta(post, false)}</div></a></article>`;
}

function renderJournalRecent(posts) {
    if (!posts.length) return '';
    const items = posts.map((post, index) => `<li class="journal-recent__item" data-kind="${categoryKind(primaryCategory(post))}">`
        + `<a class="journal-recent__link" href="${escapeHtmlAttribute(storyUrl(post))}">`
        + `<span class="journal-recent__num" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>`
        + `${renderStoryCategory(post)}<h3 class="journal-recent__title">${escapeHtmlAttribute(post.title)}</h3>`
        + `${renderStoryMeta(post, true)}</a></li>`);
    return '<section class="journal-recent" aria-labelledby="journal-recent-title">'
        + '<h2 class="journal-label" id="journal-recent-title">ΠΡΟΣΦΑΤΑ</h2>'
        + `<ol class="journal-recent__list">${items.join('')}</ol></section>`;
}

function renderJournalDeepReads(items) {
    if (!items.length) return '';
    const stories = items.map(({ post, deck }) => `<article class="journal-deep__item" data-kind="${categoryKind(primaryCategory(post))}">`
        + `<a class="journal-deep__link" href="${escapeHtmlAttribute(storyUrl(post))}">${renderStoryCategory(post, true)}`
        + `<h3 class="journal-deep__title">${escapeHtmlAttribute(post.title)}</h3>`
        + (deck ? `<p class="journal-deep__deck">${escapeHtmlAttribute(deck)}</p>` : '')
        + `${renderStoryMeta(post, true)}</a></article>`);
    return '<section class="journal-deep" aria-labelledby="journal-deep-title">'
        + `<h2 class="journal-label" id="journal-deep-title">ΓΙΑ ΑΡΓΗ ΑΝΑΓΝΩΣΗ</h2>${stories.join('')}</section>`;
}

function renderJournalFront(front, decks = {}) {
    const lead = front.lead ? renderJournalLead(front.lead, decks[front.lead.id] || front.lead.excerpt || '') : '';
    const secondary = front.secondary.map(renderJournalSecondary).join('');
    return `<section class="journal-front" aria-label="Πρωτοσέλιδο">`
        + `${lead}<div class="journal-front__side">${secondary}</div></section>`
        + '<div class="journal-shelf">'
        + renderJournalRecent(front.recent)
        + renderJournalDeepReads(front.deepReads.map(post => ({ post, deck: decks[post.id] || post.excerpt || '' })))
        + '</div>';
}

function renderLedgerRow(post, index) {
    const date = ledgerDate(post.date);
    const image = isLedgerPicture(index) ? storyImage(post) : '';
    const day = date
        ? `${date.day} ${date.month}<span class="visually-hidden"> ${date.year}</span>`
        : escapeHtmlAttribute(formatBlogIndexDate(post));
    return `<li class="ledger-row${image ? ' ledger-row--picture' : ''}" data-kind="${categoryKind(primaryCategory(post))}">`
        + `<a class="ledger-row__link" href="${escapeHtmlAttribute(storyUrl(post))}">`
        + `<time class="ledger-row__date" datetime="${escapeHtmlAttribute(post.date || '')}">${day}</time>`
        + renderStoryCategory(post)
        + (image ? `<span class="ledger-row__media">${renderStoryImage(post, image, { sizes: CARD_SIZES.archiveLedger })}</span>` : '')
        + `<h3 class="ledger-row__title">${escapeHtmlAttribute(post.title)}</h3>`
        + (image && post.excerpt ? `<p class="ledger-row__excerpt">${escapeHtmlAttribute(post.excerpt)}</p>` : '')
        + `${renderStoryMeta(post, false)}</a></li>`;
}

// Rows are grouped under month rules; each page opens with its month.
function renderLedgerRows(posts, startIndex = 0) {
    let month = '';
    const rows = [];
    posts.forEach((post, offset) => {
        const date = ledgerDate(post.date);
        if (date && date.key !== month) {
            month = date.key;
            rows.push(`<li class="ledger-month" aria-hidden="true">${date.monthTitle}</li>`);
        }
        rows.push(renderLedgerRow(post, startIndex + offset));
    });
    return rows.join('\n            ');
}

// Writers from the one author list; the slug carries each writer's accent (CSS) and
// the specialty feeds the archive's author view.
function renderAuthorFilterOptions() {
    const base = '/blog-module/blog/index.html';
    return [`<a class="filter-option" href="${base}" data-author="all" aria-current="true">Όλοι</a>`]
        .concat(AUTHORS.map(author => `<a class="filter-option filter-option--author" href="${base}?author=${author.slug}" data-author="${escapeHtmlAttribute(author.name)}" data-author-slug="${author.slug}" data-specialty="${escapeHtmlAttribute(author.specialty)}">`
            + `<img src="${authorThumb(author)}" alt="" width="48" height="48" loading="lazy" decoding="async">${escapeHtmlAttribute(author.label)}</a>`))
        .join('\n                            ');
}

function renderCategoryFilterOptions() {
    const base = '/blog-module/blog/index.html';
    return [`<a class="filter-option" href="${base}" data-category="all" aria-current="true">Όλα</a>`]
        .concat(PUBLIC_CATEGORIES.map(name => `<a class="filter-option" href="${base}?category=${encodeURIComponent(name)}" data-category="${escapeHtmlAttribute(name)}" data-kind="${categoryKind(name)}">${escapeHtmlAttribute(categoryLabel(name))}</a>`))
        .join('\n                        ');
}

function replaceMarkedBlock(html, begin, end, innerHtml) {
    const start = html.indexOf(begin);
    const finish = html.indexOf(end);
    if (start === -1 || finish === -1 || finish < start) return html;
    const lineStart = html.lastIndexOf('\n', start) + 1;
    const indentMatch = html.slice(lineStart, start).match(/^[ \t]*/);
    const indent = indentMatch ? indentMatch[0] : '';
    return html.slice(0, start + begin.length)
        + '\n'
        + innerHtml
        + '\n'
        + indent
        + html.slice(finish);
}

function replaceInlineMarkedBlock(html, begin, end, value) {
    const start = html.indexOf(begin);
    const finish = html.indexOf(end, start + begin.length);
    if (start === -1 || finish === -1 || finish < start) return html;
    return html.slice(0, start + begin.length) + value + html.slice(finish);
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function setHtmlAttribute(attributes, name, value) {
    const pattern = new RegExp(`\\s${escapeRegExp(name)}\\s*=\\s*"[^"]*"`, 'i');
    const replacement = ` ${name}="${escapeHtmlAttribute(value)}"`;
    return pattern.test(attributes)
        ? attributes.replace(pattern, replacement)
        : attributes + replacement;
}

function removeHtmlAttribute(attributes, name) {
    return attributes.replace(new RegExp(`\\s${escapeRegExp(name)}\\s*=\\s*"[^"]*"`, 'i'), '');
}

function updateElementById(html, id, update) {
    const idPattern = escapeRegExp(id);
    const elementPattern = new RegExp(
        `(<(?:img|source|link)\\b(?=[^>]*\\bid="${idPattern}"[^>]*>)[^>]*)(\\/?>)`,
        'i'
    );
    return html.replace(elementPattern, (match, attributes, closing) => update(attributes) + closing);
}

function updateMetaContent(html, attributeName, attributeValue, value) {
    const attributeNamePattern = escapeRegExp(attributeName);
    const attributeValuePattern = escapeRegExp(attributeValue);
    const metaPattern = new RegExp(
        `(<meta\\b[^>]*\\b${attributeNamePattern}="${attributeValuePattern}"[^>]*\\bcontent=")[^"]*(")`,
        'i'
    );
    return html.replace(metaPattern, `$1${escapeHtmlAttribute(value)}$2`);
}

function getHomepageHeroVariant(image, extension) {
    const marker = '/blog-module/blog-entries/';
    if (!image || !image.startsWith(marker)) return '';
    const relative = image.slice(marker.length).split('?')[0];
    const parts = relative.split('/');
    if (parts.length < 2) return '';
    const entryId = parts.shift();
    const imageName = parts.pop();
    const variantName = `${path.parse(imageName).name}.${extension}`;
    const entryPath = path.join(CONFIG.BLOG_DIR, entryId);
    if (!fs.existsSync(path.join(entryPath, variantName))) return '';
    return `${marker}${entryId}/${variantName}`;
}

async function buildHomepageHeroData(post) {
    const image = post && (post.image || post.backgroundImage) || CONFIG.DEFAULT_BLOG_IMAGE;
    const dimensions = await getImageDimensionsForPublicPath(image);
    return {
        image,
        avif: getHomepageHeroVariant(image, 'avif'),
        width: dimensions && dimensions.width ? dimensions.width : 1920,
        height: dimensions && dimensions.height ? dimensions.height : 1080
    };
}

function replaceHomepageTextSlot(html, id, begin, end, value) {
    const hasMarkers = html.indexOf(begin) !== -1 && html.indexOf(end) !== -1;
    const updated = replaceInlineMarkedBlock(html, begin, end, value);
    if (hasMarkers) return updated;
    const idPattern = escapeRegExp(id);
    const tagName = id === 'hero-title' ? 'h1' : id === 'hero-category' ? 'span' : 'p';
    const elementPattern = new RegExp(
        `(<${tagName}\\b[^>]*\\bid="${idPattern}"[^>]*>)[\\s\\S]*?(</${tagName}>)`,
        'i'
    );
    return html.replace(elementPattern, (match, open, close) => open + value + close);
}

function heroTitlePresentation(value) {
    const title = String(value || '').trim();
    if (title.endsWith('.') && !title.endsWith('..')) {
        return { text: title.slice(0, -1), period: '.', showPeriod: true };
    }
    if (/[!?;…]$/.test(title) || title.endsWith('.')) {
        return { text: title, period: '', showPeriod: false };
    }
    return { text: title, period: '.', showPeriod: true };
}

function updateHomepageHeroPeriod(html, presentation) {
    return html.replace(
        /(<span\b[^>]*\bclass="[^"]*\bhero-period\b[^"]*"[^>]*)(>)[^<]*(<\/span>)/i,
        (match, attributes, opening, closing) => {
            let updatedAttributes = setHtmlAttribute(attributes, 'aria-hidden', 'true');
            updatedAttributes = presentation.showPeriod
                ? removeHtmlAttribute(updatedAttributes, 'hidden')
                : setHtmlAttribute(updatedAttributes, 'hidden', 'hidden');
            return updatedAttributes + opening + presentation.period + closing;
        }
    );
}

function injectHomepageHero(hero) {
    const indexHtmlPath = path.join(CONFIG.BLOG_DIR, '..', '..', 'index.html');
    if (!fs.existsSync(indexHtmlPath) || !hero) {
        console.warn(`⚠️  Homepage HTML not found, static lead render skipped: ${indexHtmlPath}`);
        return false;
    }

    const image = hero.heroImage || hero.image || CONFIG.DEFAULT_BLOG_IMAGE;
    const avif = hero.heroAvif || '';
    const webp = /\.webp(?:\?.*)?$/i.test(image) ? image : '';
    const titlePresentation = heroTitlePresentation(hero.title || 'F1 Stories');
    const title = escapeHtmlAttribute(titlePresentation.text);
    const category = escapeHtmlAttribute(greekUpper(categoryLabel(hero.category || 'News')));
    const deck = escapeHtmlAttribute(hero.deck || '');
    const lede = escapeHtmlAttribute(hero.lede || '');
    const byline = escapeHtmlAttribute(`${authorLabel(hero.author || 'F1 Stories')} · ${formatDate(hero.date || '', 'long')}`);
    const storyId = hero.slug || hero.id || '';
    const href = `/blog-module/blog-entries/${encodeURIComponent(storyId)}/article.html`;
    const width = parseInt(hero.heroImageWidth, 10) || 1920;
    const height = parseInt(hero.heroImageHeight, 10) || 1080;
    const imageSizes = '(max-width: 767px) 100vw, 55vw';
    const imageUrl = /^https?:\/\//i.test(image) ? image : `https://f1stories.gr${image}`;
    let html = fs.readFileSync(indexHtmlPath, 'utf8');
    const original = html;

    html = replaceHomepageTextSlot(
        html,
        'hero-category',
        '<!-- f1s:hero-category:begin -->',
        '<!-- f1s:hero-category:end -->',
        category
    );
    html = replaceHomepageTextSlot(
        html,
        'hero-title',
        '<!-- f1s:hero-title:begin -->',
        '<!-- f1s:hero-title:end -->',
        title
    );
    html = updateHomepageHeroPeriod(html, titlePresentation);
    html = replaceHomepageTextSlot(
        html,
        'hero-story-deck',
        '<!-- f1s:hero-deck:begin -->',
        '<!-- f1s:hero-deck:end -->',
        deck
    );
    html = replaceHomepageTextSlot(
        html,
        'hero-story-excerpt',
        '<!-- f1s:hero-excerpt:begin -->',
        '<!-- f1s:hero-excerpt:end -->',
        lede
    );
    html = replaceHomepageTextSlot(
        html,
        'hero-story-byline',
        '<!-- f1s:hero-byline:begin -->',
        '<!-- f1s:hero-byline:end -->',
        byline
    );

    html = html.replace(
        /(<a\b[^>]*\bid="hero-story-link"[^>]*\bhref=")[^"]*(")/i,
        `$1${escapeHtmlAttribute(href)}$2`
    );
    html = updateElementById(html, 'hero-source-avif', attributes => {
        return avif ? setHtmlAttribute(attributes, 'srcset', avif) : removeHtmlAttribute(attributes, 'srcset');
    });
    html = updateElementById(html, 'hero-source-webp', attributes => {
        return webp ? setHtmlAttribute(attributes, 'srcset', webp) : removeHtmlAttribute(attributes, 'srcset');
    });
    html = updateElementById(html, 'hero-image', attributes => {
        let updated = setHtmlAttribute(attributes, 'src', image);
        updated = removeHtmlAttribute(updated, 'srcset');
        updated = setHtmlAttribute(updated, 'alt', hero.title || 'F1 Stories');
        updated = setHtmlAttribute(updated, 'width', width);
        updated = setHtmlAttribute(updated, 'height', height);
        updated = setHtmlAttribute(updated, 'sizes', imageSizes);
        return updated;
    });
    html = updateElementById(html, 'hero-image-preload', attributes => {
        let updated = setHtmlAttribute(attributes, 'href', avif || image);
        updated = removeHtmlAttribute(updated, 'imagesrcset');
        updated = setHtmlAttribute(updated, 'imagesizes', imageSizes);
        return updated;
    });
    html = updateMetaContent(html, 'property', 'og:image', imageUrl);
    html = updateMetaContent(html, 'name', 'twitter:image', imageUrl);
    html = updateMetaContent(html, 'property', 'og:image:width', width);
    html = updateMetaContent(html, 'property', 'og:image:height', height);

    if (html !== original) {
        fs.writeFileSync(indexHtmlPath, html);
        console.log(`Homepage lead story rendered into ${indexHtmlPath}`);
        return true;
    }
    return false;
}

function replaceInlineMarkers(html, name, value) {
    const pattern = new RegExp(`(<!-- f1s:${name}:begin -->)[\\s\\S]*?(<!-- f1s:${name}:end -->)`, 'g');
    return html.replace(pattern, (match, begin, end) => begin + value + end);
}

// The archive ships as static HTML: the front, the category filters and the first
// ledger page, so the first screen needs no data request. The browser loads the
// compact index only for filters, search, sorting and later pages.
function injectBlogIndexFirstPage(indexPosts, front, decks = {}) {
    const indexHtmlPath = path.join(CONFIG.OUTPUT_HTML_DIR, 'index.html');
    if (!fs.existsSync(indexHtmlPath)) {
        console.warn(`⚠️  Blog index HTML not found, static first-page render skipped: ${indexHtmlPath}`);
        return false;
    }

    const shown = new Set(front.ids);
    const ledger = indexPosts.filter(post => !shown.has(post.id)).slice(0, JOURNAL_LAYOUT.page);
    const leadImage = front.lead ? storyImage(front.lead) : '';
    const leadSrcset = leadImage ? cardImageSrcset(leadImage, true) : '';
    // Mirror the lead image's srcset/sizes, or the preload fetches a candidate the <img> never uses.
    const preload = leadImage
        ? `<link rel="preload" as="image" href="${escapeHtmlAttribute(leadImage)}"${leadSrcset ? ` imagesrcset="${escapeHtmlAttribute(leadSrcset)}" imagesizes="${CARD_SIZES.archiveLead}"` : ''} fetchpriority="high">`
        : '';
    const edition = `<div class="journal-edition" id="journal-edition" data-story-ids="${escapeHtmlAttribute(front.ids.join(' '))}" data-total="${indexPosts.length}">`
        + renderJournalFront(front, decks)
        + '</div>';

    let html = fs.readFileSync(indexHtmlPath, 'utf8');
    const original = html;
    html = replaceMarkedBlock(html, '<!-- f1s:blog-index-preload:begin -->', '<!-- f1s:blog-index-preload:end -->', preload ? `    ${preload}` : '');
    html = replaceMarkedBlock(html, '<!-- f1s:journal-front:begin -->', '<!-- f1s:journal-front:end -->', `        ${edition}`);
    html = replaceMarkedBlock(html, '<!-- f1s:blog-categories:begin -->', '<!-- f1s:blog-categories:end -->', `                        ${renderCategoryFilterOptions()}`);
    html = replaceMarkedBlock(html, '<!-- f1s:blog-authors:begin -->', '<!-- f1s:blog-authors:end -->', `                            ${renderAuthorFilterOptions()}`);
    html = replaceMarkedBlock(html, '<!-- f1s:blog-first-page:begin -->', '<!-- f1s:blog-first-page:end -->', `            ${renderLedgerRows(ledger)}`);
    html = replaceInlineMarkers(html, 'journal-total', String(indexPosts.length));

    if (html !== original) {
        fs.writeFileSync(indexHtmlPath, html);
        console.log(`Blog first page rendered into ${indexHtmlPath}`);
        return true;
    }
    return false;
}

// Cover copy comes from the article's opening paragraph and is cut only at sentence ends:
// `deck` gathers whole sentences up to 160 characters (or one opening sentence up to 240),
// `lede` is the next whole sentence.
function heroCopy(post) {
    let html = typeof post.content === 'string' ? post.content : '';
    if (!html) {
        try {
            html = fs.readFileSync(path.join(CONFIG.BLOG_DIR, post.id, 'article.html'), 'utf8');
            html = html.slice(html.indexOf('class="article-content"'));
        } catch (_) { html = ''; }
    }
    const paragraph = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(html);
    const sentences = htmlToPlainText(paragraph ? paragraph[1] : '').match(/[^.!;;?…]+[.!;;?…]+(?=\s|$)/g) || [];
    const clean = sentences.map(sentence => sentence.trim()).filter(sentence => sentence && !/(\.\.\.|…)$/.test(sentence));
    let deck = '';
    let next = 0;
    while (next < clean.length && (deck ? deck.length + 1 : 0) + clean[next].length <= 160) {
        deck = deck ? `${deck} ${clean[next]}` : clean[next];
        next += 1;
    }
    if (!deck && clean[0] && clean[0].length <= 240) {
        deck = clean[0];
        next = 1;
    }
    const lede = clean[next] && clean[next].length <= 320 ? clean[next] : '';
    return { deck, lede };
}

async function buildHomeLatest(blogPosts) {
    // [0] is the homepage cover; [1..3] fill the journal so the cover story is not repeated.
    return Promise.all(blogPosts.slice(0, 4).map(async post => {
        const thumbnail = getCardThumbnailPath(post.image);
        const thumbnailDimensions = await getImageDimensionsForPublicPath(thumbnail);
        const hero = await buildHomepageHeroData(post);
        const copy = heroCopy(post);
        return {
            title: post.title,
            slug: post.id,
            date: post.date,
            author: post.author || 'F1 Stories',
            category: (post.categories && post.categories[0]) || 'News',
            categories: post.categories || ['News'],
            excerpt: post.excerpt,
            ...(copy.deck ? { deck: copy.deck } : {}),
            ...(copy.lede ? { lede: copy.lede } : {}),
            thumbnail,
            thumbnailWidth: thumbnailDimensions && thumbnailDimensions.width ? thumbnailDimensions.width : 400,
            thumbnailHeight: thumbnailDimensions && thumbnailDimensions.height ? thumbnailDimensions.height : 188,
            heroImage: hero.image,
            ...(hero.avif ? { heroAvif: hero.avif } : {}),
            heroImageWidth: hero.width,
            heroImageHeight: hero.height
        };
    }));
}

function loadExistingPosts() {
    loadExistingPosts.hasFullContent = false;
    const cachePath = fs.existsSync(CONFIG.SOURCE_CACHE_JSON)
        ? CONFIG.SOURCE_CACHE_JSON
        : CONFIG.OUTPUT_JSON;

    if (!cachePath || !fs.existsSync(cachePath)) return [];

    try {
        const existing = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        const posts = existing.posts || [];
        loadExistingPosts.hasFullContent =
            cachePath === CONFIG.OUTPUT_JSON && posts.some(post => typeof post.content === 'string' && post.content.trim());
        return posts;
    } catch (_) {
        console.warn(`⚠️  Could not read cached blog metadata from ${path.basename(cachePath)}, continuing without cached post metadata`);
        return [];
    }
}

async function renderCachedArticlePages(cachedPosts) {
    let rendered = 0;
    for (const post of cachedPosts) {
        if (!post || !post.id) continue;
        const entryPath = path.join(CONFIG.BLOG_DIR, post.id);
        if (!fs.existsSync(entryPath)) continue;
        if (typeof post.content === 'string' && post.content.trim()) {
            await renderArticleHtml(post, entryPath, post.id);
        } else {
            // Source-less articles retain their existing body and media. Only owned
            // taxonomy slots are migrated, including their structured metadata.
            const articlePath = path.join(entryPath, 'article.html');
            if (!fs.existsSync(articlePath)) continue;
            const html = fs.readFileSync(articlePath, 'utf8');
            const updated = refreshArticleTaxonomy(html, post);
            if (updated === html) continue;
            fs.writeFileSync(articlePath, updated);
        }
        rendered++;
    }
    if (rendered > 0) {
        console.log(`♻️  Rendered ${rendered} cached article page${rendered === 1 ? '' : 's'} from cached blog metadata`);
    }
}

function classifyEntry(entryPath, options = {}) {
    const folderName = path.basename(entryPath);
    const entryFiles = options.entryFiles || fs.readdirSync(entryPath);
    const cachedPostsById = options.cachedPostsById || new Map();
    const forceRebuild = Boolean(options.forceRebuild);
    const docFile = utils.findSourceDocument(entryFiles);
    const hasGalleryImages = utils.hasGalleryImages(entryPath, entryFiles);

    if (docFile) {
        return {
            folderName,
            kind: 'source-backed',
            action: utils.shouldSkip(entryPath, forceRebuild) ? 'skip' : 'build',
            hasSourceDocument: true,
            hasGalleryImages,
            cached: cachedPostsById.has(folderName)
        };
    }

    if (hasGalleryImages && !cachedPostsById.has(folderName)) {
        return {
            folderName,
            kind: 'image-only-gallery',
            action: utils.shouldSkip(entryPath, forceRebuild) ? 'skip' : 'build',
            hasSourceDocument: false,
            hasGalleryImages: true,
            cached: false
        };
    }

    if (cachedPostsById.has(folderName)) {
        return {
            folderName,
            kind: 'cached-only',
            action: 'reuse-cached',
            hasSourceDocument: false,
            hasGalleryImages,
            cached: true
        };
    }

    return {
        folderName,
        kind: 'ignored',
        action: 'ignore',
        hasSourceDocument: false,
        hasGalleryImages,
        cached: false
    };
}

async function processBlogEntries(options = {}) {
    const resolvedOptions = Object.assign(parseBuildOptions(), options);
    const { forceRebuild, maxWorkers } = resolvedOptions;

    if (!fs.existsSync(CONFIG.BLOG_DIR)) {
        console.error(`Blog entries directory not found: ${CONFIG.BLOG_DIR}`);
        return;
    }

    let entryFolders;
    try {
        entryFolders = fs.readdirSync(CONFIG.BLOG_DIR)
            .filter(folder => {
                try {
                    return fs.statSync(path.join(CONFIG.BLOG_DIR, folder)).isDirectory();
                } catch (_) {
                    return false;
                }
            })
            .map(folder => path.join(CONFIG.BLOG_DIR, folder));
    } catch (error) {
        console.error('Error reading blog directories:', error);
        entryFolders = [];
    }

    console.log(`Found ${entryFolders.length} potential blog entry folders`);

    const existingPosts = loadExistingPosts();
    const cachedPostsById = new Map(existingPosts.map(post => [post.id, post]));
    const existingOrderById = new Map(existingPosts.map((post, index) => [post.id, index]));

    const toBuild = [];
    const skipped = [];
    const reusedCached = [];
    const ignored = [];
    const classifications = new Map();
    entryFolders.forEach(entryPath => {
        const entryFiles = fs.readdirSync(entryPath);
        const classification = classifyEntry(entryPath, {
            entryFiles,
            cachedPostsById,
            forceRebuild
        });
        classifications.set(classification.folderName, classification);

        if (classification.action === 'build') {
            toBuild.push(entryPath);
            return;
        }

        if (classification.action === 'skip') {
            skipped.push(classification.folderName);
            return;
        }

        if (classification.action === 'reuse-cached') {
            reusedCached.push(classification.folderName);
            return;
        }

        ignored.push(classification.folderName);
    });

    if (skipped.length > 0) {
        console.log(`⏭️  Skipping ${skipped.length} up-to-date entries${forceRebuild ? '' : ' (use --force to rebuild all)'}:`);
        skipped.forEach(folder => console.log(`   ⏭️  ${folder}`));
    }
    if (reusedCached.length > 0) {
        console.log(
            `ℹ️  Reusing cached metadata for ${reusedCached.length} entr${reusedCached.length === 1 ? 'y' : 'ies'} ` +
            `without a source document in the repo.`
        );
    }
    if (ignored.length > 0) {
        console.log(`ℹ️  Ignoring ${ignored.length} non-buildable folder${ignored.length === 1 ? '' : 's'} without cached metadata.`);
    }

    if (toBuild.length === 0) console.log('Nothing to build — all entries are up to date.');

    console.log(`\n🔨 Building ${toBuild.length} entries with ${Math.min(maxWorkers, toBuild.length || 1)} workers...\n`);

    const concurrency = Math.min(maxWorkers, toBuild.length || 1);
    const freshBuild = toBuild.length > 0 ? await runWorkerPool(toBuild, concurrency) : { results: [], failures: [] };
    const freshPosts = freshBuild.results;
    const buildFailures = freshBuild.failures.slice();

    let cachedPosts = [];
    const cachedFolderNames = new Set(skipped.concat(reusedCached));
    if (cachedFolderNames.size > 0 && existingPosts.length > 0) {
        cachedPosts = existingPosts.filter(post => cachedFolderNames.has(post.id));
        console.log(`📦 Loaded ${cachedPosts.length} cached entries from blog metadata`);
    }

    let rebuiltSkippedPosts = [];
    const cachedIds = new Set(cachedPosts.map(post => post.id));
    const missingSkippedPaths = entryFolders.filter(entryPath => {
        const folderName = path.basename(entryPath);
        if (!skipped.includes(folderName) || cachedIds.has(folderName)) return false;
        const classification = classifications.get(folderName);
        return classification && (classification.kind === 'source-backed' || classification.kind === 'image-only-gallery');
    });

    if (missingSkippedPaths.length > 0) {
        console.log(`♻️  Rebuilding ${missingSkippedPaths.length} skipped entries because cached metadata was missing...`);
        const rebuiltSkippedBuild = await runWorkerPool(
            missingSkippedPaths,
            Math.min(maxWorkers, missingSkippedPaths.length)
        );
        rebuiltSkippedPosts = rebuiltSkippedBuild.results;
        buildFailures.push(...rebuiltSkippedBuild.failures);
    }

    const freshIds = new Set(freshPosts.concat(rebuiltSkippedPosts).map(post => post.id));
    const blogPosts = [
        ...freshPosts,
        ...rebuiltSkippedPosts,
        ...cachedPosts.filter(post => !freshIds.has(post.id))
    ];

    fixMissingAuthors(blogPosts);
    blogPosts.forEach(post => {
        Object.assign(post, getPostTaxonomy(post));
        delete post.tag;
    });
    console.log(`\n✅ Total: ${blogPosts.length} posts (${freshPosts.length} built, ${rebuiltSkippedPosts.length} rebuilt from skipped, ${cachedPosts.length} cached)`);

    if (blogPosts.length === 0) {
        console.error('No blog posts were successfully processed!');
        return;
    }

    if (buildFailures.length > 0) {
        const firstFailure = buildFailures[0];
        throw new Error(
            `Blog build failed for ${buildFailures.length} entr${buildFailures.length === 1 ? 'y' : 'ies'}. ` +
            `First failure: ${path.basename(firstFailure.entryPath)}: ${firstFailure.error}`
        );
    }

    blogPosts.sort((a, b) => {
        const dateDiff = new Date(b.date) - new Date(a.date);
        if (dateDiff !== 0) return dateDiff;
        if (existingOrderById.has(a.id) && existingOrderById.has(b.id)) {
            return existingOrderById.get(a.id) - existingOrderById.get(b.id);
        }
        return String(b.id).localeCompare(String(a.id));
    });

    const lastUpdated = new Date().toISOString();
    const blogData = {
        posts: blogPosts,
        lastUpdated
    };
    fs.writeFileSync(CONFIG.OUTPUT_JSON, JSON.stringify(blogData, null, 2));
    console.log(`Blog data saved to ${CONFIG.OUTPUT_JSON}`);

    const sourceCache = {
        posts: blogPosts.map(({ content, ...metadata }) => metadata),
        lastUpdated
    };
    const previousCache = readJsonIfExists(CONFIG.SOURCE_CACHE_JSON);
    if (sameJsonExceptKey(previousCache, sourceCache, 'lastUpdated') && previousCache.lastUpdated) {
        sourceCache.lastUpdated = previousCache.lastUpdated;
    }
    fs.writeFileSync(CONFIG.SOURCE_CACHE_JSON, JSON.stringify(sourceCache, null, 2));

    // Workers may have just converted newly supplied hero images to WebP.
    // Generate missing card variants now, before archive/home payloads resolve
    // their thumbnail paths, while the generator's existence checks keep this
    // incremental for an unchanged archive.
    generateMissingImageVariants();
    const indexPosts = await buildIndexPosts(blogPosts);
    const indexPath = path.join(CONFIG.BLOG_DIR, '..', 'blog-index-data.json');
    const compactIndexData = buildCompactIndexData(indexPosts);
    fs.writeFileSync(indexPath, JSON.stringify(compactIndexData, null, 0));
    console.log(`Blog index data saved to ${indexPath} (${jsonKb(compactIndexData)} KB)`);

    const front = resolveJournalFront(indexPosts, loadEditorialSelection());
    front.warnings.forEach(warning => console.warn(`⚠️  editorial-selection.json: ${warning}; the slot falls back to the newest story`));
    const postsById = new Map(blogPosts.map(post => [post.id, post]));
    const decks = {};
    [front.lead, ...front.deepReads].filter(Boolean).forEach(post => {
        decks[post.id] = heroCopy(postsById.get(post.id) || post).deck;
    });
    injectBlogIndexFirstPage(indexPosts, front, decks);
    injectAuthorsDirectory(indexPosts);

    const homeLatest = await buildHomeLatest(blogPosts);
    const homeLatestPath = path.join(CONFIG.BLOG_DIR, '..', 'home-latest.json');
    fs.writeFileSync(homeLatestPath, JSON.stringify(homeLatest, null, 0));
    console.log(`Home latest data saved to ${homeLatestPath} (${jsonKb(homeLatest)} KB)`);
    injectHomepageHero(homeLatest[0]);

    generateSitemap(blogPosts);
    await renderCachedArticlePages(freshPosts.concat(cachedPosts));
    await injectRelatedArticles(blogPosts);
    injectPrevNextLinks(blogPosts);

    // Standings caches are refreshed only by `npm run build:standings-data`.
    console.log('Blog processing complete');
}

if (require.main === module) {
    processBlogEntries().catch(error => {
        console.error('Blog processing failed:', error);
        process.exitCode = 1;
    });
}

module.exports = {
    parseBuildOptions,
    runWorker,
    runWorkerPool,
    fixMissingAuthors,
    buildIndexPosts,
    buildCompactIndexData,
    loadEditorialSelection,
    resolveJournalFront,
    renderJournalFront,
    renderLedgerRows,
    injectBlogIndexFirstPage,
    buildHomeLatest,
    loadExistingPosts,
    renderCachedArticlePages,
    classifyEntry,
    processBlogEntries
};
