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
const { htmlToPlainText, extractMetadata } = require('./metadata');
const { injectRelatedArticles } = require('./related');
const { injectPrevNextLinks } = require('./nav');
const { renderArticleHtml, refreshArticleTaxonomy } = require('./article-render');
const { readingTimeFromWords, readingTimeFromPage, articleBodyHtml } = require('./reading-time');
const { injectAuthorsDirectory, injectHomeTeam } = require('./authors-page');
const { featuredEpisode, isFeaturedEpisode, injectHomePanels, findTeamKey, latestDebriefRound, renderTelemetry, homeByline } = require('./home-panels');
const {
    PUBLIC_CATEGORIES, AUTHORS, authorThumb, findAuthor, getPostTaxonomy, categoryLabel, categoryKind, authorLabel, greekUpper, formatDate, ledgerDate,
    formatReadingTime, cardImageSrcset, CARD_SIZES, athensDay
} = require('../taxonomy');
const { buildPages, writeDiscoveryPages } = require('./discovery');

const { loadPublishTimes, comparePosts } = require('./publish-order');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
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

// The Edition Index: the blog index and its additive section, month and archive pages (see discovery.js). The
// pages are static files; blog-index.js only renders the ?category= / ?author= / ?q= views on top of them.
function injectEdition(indexPosts, selection = {}) {
    const blogDir = CONFIG.OUTPUT_HTML_DIR;
    if (!fs.existsSync(path.join(blogDir, 'index.html'))) {
        console.warn(`⚠️  Blog index HTML not found, Edition Index skipped: ${blogDir}`);
        return null;
    }
    const edition = buildPages(indexPosts, { today: athensDay(), selection, deps: { storyImage, renderStoryImage } });
    edition.model.warnings.forEach(warning => console.warn(`⚠️  editorial-selection.json: ${warning}; the week leads with its newest story`));
    writeDiscoveryPages(blogDir, edition);
    console.log(`Edition Index rendered: ${edition.pages.length} pages into ${blogDir}`);
    return edition;
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
    if (!readingTime && post.wordCount) readingTime = readingTimeFromWords(post.wordCount);
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

// Homepage journal (THE PADDOCK): every story after the cover and the technical spread, newest first.
// The two newest with a picture stand beside the cover photograph, the next is the analysis feature, then
// the opinion columns (VOICES), the History pieces (ARCHIVE) and the news desk (WIRE). Each slot takes the
// newest eligible stories, so a quiet desk shows fewer items rather than another desk's.
const HOME_PADDOCK = Object.freeze({ frames: 2, voices: 3, archive: 2, wire: 4 });
const WIRE_CATEGORIES = new Set(['News', 'Teams', 'Drivers']);

function homeDate(value) {
    return formatDate(value);
}

// "3 λεπτά" → "3 ΛΕΠΤΑ" with a no-break space, so a wrap never splits number from unit.
function homeReadingTime(post) {
    const readingTime = storyReadingTime(post);
    return readingTime ? greekUpper(readingTime).replace(/(\d) /, '$1\u00a0') : '';
}

// Desk and reading time: "ΑΝΑΛΥΣΗ" then "9 ΛΕΠΤΑ".
function homeStoryMeta(post, { withDate = false } = {}) {
    const items = [`<span class="home-story__kind">${escapeHtmlAttribute(greekUpper(categoryLabel(primaryCategory(post))))}</span>`];
    if (withDate) items.push(`<time datetime="${escapeHtmlAttribute(post.date || '')}">${homeDate(post.date)}</time>`);
    const readingTime = homeReadingTime(post);
    if (readingTime) items.push(`<span>${escapeHtmlAttribute(readingTime)}</span>`);
    return `<p class="home-story__meta">${items.join('')}</p>`;
}

function selectPaddock(pool = []) {
    const used = new Set();
    const take = (count, accept) => pool.filter(post => !used.has(post) && accept(post)).slice(0, count)
        .map(post => { used.add(post); return post; });
    const hasImage = post => Boolean(storyImage(post));
    const frames = take(HOME_PADDOCK.frames, hasImage);
    const feature = take(1, hasImage)[0] || take(1, () => true)[0] || null;
    const voices = take(HOME_PADDOCK.voices, post => primaryCategory(post) === 'Opinion');
    const archive = take(HOME_PADDOCK.archive, post => primaryCategory(post) === 'History');
    const wire = take(HOME_PADDOCK.wire, post => WIRE_CATEGORIES.has(primaryCategory(post)));
    return { frames, feature, voices, archive, wire };
}

// A cover frame's picture: the card, its 800px mobile copy and the original, with AVIF twins where they exist. The
// homepage is a reference source of scripts/build/public-artifact.mjs, so every file named here is published (and
// validate-public-artifact.mjs fails the build if one is not). `source` is the blog post: its image is the original.
function coverFrameSources(post, source = {}) {
    const has = name => fs.existsSync(path.join(CONFIG.BLOG_DIR, post.id, name));
    const url = name => `/blog-module/blog-entries/${post.id}/${name}`;
    const width = parseInt(source.imageWidth, 10) || 0;
    const height = parseInt(source.imageHeight, 10) || 0;
    // The original is offered at its measured width, and only when it is larger than the 800px copy.
    const original = /\/1\.webp$/.test(source.image || '') && width > 800 ? width : 0;
    const card = has('1-card.webp');
    const webp = [card && `${url('1-card.webp')} 400w`, card && has('1-mobile.webp') && `${url('1-mobile.webp')} 800w`,
        original && has('1.webp') && `${url('1.webp')} ${original}w`].filter(Boolean);
    // AVIF only as a complete set for the same widths, so the two formats never disagree on what is available.
    const avif = card && has('1-mobile.avif') && (!original || has('1.avif'))
        ? [`${url('1-mobile.avif')} 800w`, original && `${url('1.avif')} ${original}w`].filter(Boolean) : [];
    return { webp, avif, width, height };
}

// The two photographs beside the cover's: each frame is its story's link, captioned with desk and headline.
// The frames crop landscape photographs to tall boxes, so `sizes` asks for the box height times the picture's own
// proportions: the box is clamp(320px, 39vw, 600px) tall from 1100px, a 4:3 half-width box on tablets and 150px tall
// on phones. Above the fold but not the largest paint, so they load at once with low priority.
function renderCoverFrames(frames = [], sourceOf = () => ({})) {
    return frames.map(post => {
        const readingTime = homeReadingTime(post);
        const desk = greekUpper(categoryLabel(primaryCategory(post))) + (readingTime ? ` · ${readingTime}` : '');
        const { webp, avif, width, height } = coverFrameSources(post, sourceOf(post));
        const ratio = width && height ? width / height : (parseInt(post.thumbnailWidth, 10) || 16) / (parseInt(post.thumbnailHeight, 10) || 9);
        const r = ratio.toFixed(3);
        // Rounded down: a 150px-tall 16:9 frame needs 266.7px, and 267 at 3× would just miss the 800px copy.
        const sizes = `(max-width: ${Math.round(300 * ratio)}px) ${Math.floor(150 * ratio)}px, (max-width: 767px) 50vw, `
            + `(max-width: 1099px) ${ratio > 4 / 3 ? `calc(37.5vw * ${r})` : '50vw'}, (max-width: 1538px) calc(39vw * ${r}), ${Math.round(600 * ratio)}px`;
        const fallback = storyImage(post);
        const img = `<img src="${escapeHtmlAttribute(fallback)}" srcset="${escapeHtmlAttribute(webp.join(', '))}" sizes="${sizes}" `
            + `width="${width || parseInt(post.thumbnailWidth, 10) || 400}" height="${height || parseInt(post.thumbnailHeight, 10) || 225}" fetchpriority="low" decoding="async" alt="" data-fallback-src="${CONFIG.DEFAULT_BLOG_IMAGE}">`;
        // AVIF copies start at 800px; phones keep the 400px card, which already fills their 150px-tall frames.
        const picture = avif.length ? `<picture><source type="image/avif" media="(min-width: 768px)" srcset="${escapeHtmlAttribute(avif.join(', '))}" sizes="${sizes}">${img}</picture>` : img;
        return `\n        <a class="cover-frame" href="${escapeHtmlAttribute(storyUrl(post))}">${picture}`
            + `<span class="cover-frame__tag"><span>${escapeHtmlAttribute(desk)}</span>${escapeHtmlAttribute(post.title)}</span></a>`;
    }).join('') + (frames.length ? '\n        ' : '');
}

function renderHomeJournal({ feature = null, voices = [], archive = [], wire = [] } = {}, featureDek = '') {
    const esc = escapeHtmlAttribute;
    const link = (post, text = post.title) => `<a href="${esc(storyUrl(post))}">${esc(text)}</a>`;
    const kind = post => categoryKind(primaryCategory(post));
    const byline = post => `<p class="home-story__byline">${esc(homeByline(post.author))} · <time datetime="${esc(post.date || '')}">${homeDate(post.date)}</time></p>`;
    // Only the analysis feature is wide enough to need the full-size variant (as the old Journal lead did).
    const picture = (post, sizes, full = false) => {
        const image = storyImage(post);
        return image ? `<figure>${renderStoryImage(post, image, { sizes, full })}</figure>` : '';
    };
    const blocks = [];
    if (feature) {
        const figure = picture(feature, '(max-width: 1099px) 100vw, 64vw', true);
        blocks.push(`<article class="pd-analysis${figure ? '' : ' pd-analysis--text'}" data-kind="${kind(feature)}">${figure}`
            + `<div class="pd-analysis__panel">${homeStoryMeta(feature)}<h3 class="pd-analysis__title">${link(feature)}</h3>`
            + (featureDek ? `<p class="pd-analysis__dek">${esc(featureDek)}</p>` : '') + `${byline(feature)}</div></article>`);
    }
    const wireList = wire.length ? '<section class="pd-wire" aria-labelledby="wire-heading"><h3 class="pd-label" id="wire-heading">WIRE · ΕΙΔΗΣΕΙΣ</h3><ol>'
        + wire.map(post => {
            const date = ledgerDate(post.date);
            const day = date ? `<b>${date.day.padStart(2, '0')}</b>${date.month}<span class="visually-hidden"> ${date.year}</span>` : '';
            return `<li data-kind="${kind(post)}"><time class="pd-wire__date" datetime="${esc(post.date || '')}">${day}</time>`
                + `<div>${homeStoryMeta(post)}<h4 class="pd-wire__title">${link(post)}</h4></div></li>`;
        }).join('') + '</ol></section>' : '';
    // The first column carries its picture when it has one; the others are the writer and the headline.
    const voicesList = voices.length ? '<section class="pd-voices" aria-labelledby="voices-heading"><h3 class="pd-label" id="voices-heading">VOICES · ΑΠΟΨΗ</h3>'
        + voices.map((post, index) => {
            const author = findAuthor(post.author);
            const figure = index === 0 ? picture(post, '(max-width: 767px) 100vw, 26vw') : '';
            const face = author ? `<img src="${esc(authorThumb(author))}" alt="" width="96" height="96" loading="lazy" decoding="async">` : '';
            return `<article class="pd-voice${figure ? ' pd-voice--photo' : ''}" data-kind="${kind(post)}">${figure}`
                + `<div><p class="pd-voice__who">${face}${esc(greekUpper(authorLabel(post.author || 'F1 Stories')))}</p>`
                + `<h4 class="pd-voice__title">${link(post, `«${post.title}»`)}</h4>${homeStoryMeta(post, { withDate: true })}</div></article>`;
        }).join('') + '</section>' : '';
    const archiveBand = archive.length ? '\n    <section class="pd-archive" aria-labelledby="archive-heading"><div class="container"><h3 class="pd-label" id="archive-heading">ARCHIVE · ΑΠΟ ΤΟ ΑΡΧΕΙΟ</h3><div class="pd-archive__grid">'
        + archive.map(post => `<article class="pd-archive__item" data-kind="${kind(post)}">${picture(post, '(max-width: 767px) 100vw, 46vw')}`
            + `${homeStoryMeta(post)}<h4 class="pd-archive__title">${link(post)}</h4>`
            + (post.excerpt ? `<p class="pd-archive__excerpt">${esc(post.excerpt)}</p>` : '') + '</article>').join('')
        + '</div></div></section>' : '';
    const split = wireList || voicesList ? `\n        <div class="pd-split">${wireList}${voicesList}</div>` : '';
    if (!blocks.length && !split && !archiveBand) return '';
    return `\n    <div class="container">${blocks.map(block => `\n        ${block}`).join('')}${split}\n    </div>${archiveBand}\n    `;
}

// The dark technical spread: one technical story under the "TECHNICAL." mast, beside its picture, with
// Friday's numbers for the team it names in a strip underneath (home-panels.js). Nothing is laid over the
// picture; `graphic` (the article's `homeImage: graphic`) also shows artwork with printed type uncropped.
function renderHomeTech(post, dek, telemetry, teamName, { graphic = false } = {}) {
    const image = storyImage(post);
    const url = escapeHtmlAttribute(storyUrl(post));
    const date = String(post.date || '').slice(0, 10).split('-').reverse().join('.');
    const readingTime = homeReadingTime(post);
    const meta = [`<span class="home-story__kind">${escapeHtmlAttribute(greekUpper(categoryLabel(primaryCategory(post))))}</span>`]
        .concat(readingTime ? [`<span>${escapeHtmlAttribute(readingTime)}</span>`] : []).join('');
    return `
        <div class="container">
            <header class="pd-mast pd-mast--tech">
                <p class="pd-mast__word" aria-hidden="true">TECHNICAL<span>.</span></p>
                <p class="pd-mast__sub"><span>DEEP DIVE</span><span>ΤΕΧΝΙΚΗ ΑΝΑΛΥΣΗ</span></p>
            </header>
            <div class="tech-stage${graphic ? ' tech-stage--no-cross' : ''}" data-kind="${categoryKind(primaryCategory(post))}">
                <div class="tech-copy">
                    <p class="home-story__meta">${meta}</p>
                    <h2 class="tech-copy__title" id="tech-heading"><a href="${url}">${escapeHtmlAttribute(post.title)}</a></h2>`
        + (dek ? `\n                    <p class="tech-copy__dek">${escapeHtmlAttribute(dek)}</p>` : '')
        + `
                    <p class="home-story__byline">${escapeHtmlAttribute(homeByline(post.author))} · ${date}</p>
                    <a class="tech-copy__button" href="${url}">ΔΙΑΒΑΣΕ ΤΗΝ ΑΝΑΛΥΣΗ <span aria-hidden="true">→</span></a>
                </div>`
        + (image ? `
                <figure class="tech-photo">
                    <a class="tech-photo__media" href="${url}" tabindex="-1" aria-hidden="true">${renderStoryImage(post, image, { sizes: '(max-width: 1099px) 100vw, 58vw', full: true })}</a>
                    <figcaption>ΕΙΚΟΝΑ / ${escapeHtmlAttribute(greekUpper(teamName || 'F1 Stories'))}</figcaption>
                </figure>` : '')
        + `
            </div>`
        + (telemetry ? `\n${telemetry}` : '')
        + `
        </div>
        `;
}

// The homepage's story slots, with no story in two of them: the cover (the newest story), the
// technical spread and the Journal (every other story, newest first; selectPaddock places them). The
// spread is the editor's `homeTech` pick in editorial-selection.json when it is valid, otherwise the newest
// Technical story that is not the cover, and the Journal then skips it. `posts` is newest first
// (comparePosts), which also settles same-day ties.
function selectHomeStories(posts, selection = {}) {
    const warnings = [];
    const cover = posts[0] || null;
    const isTechnical = post => primaryCategory(post) === 'Technical';
    let tech = null;
    const requested = selection && selection.homeTech;
    if (requested !== undefined && requested !== null && requested !== '') {
        const id = typeof requested === 'string' ? requested.trim() : '';
        const pick = id && posts.find(post => post.id === id);
        if (!id) warnings.push('homeTech must be one article id');
        else if (!pick) warnings.push(`homeTech "${id}" is not a published article`);
        else if (!isTechnical(pick)) warnings.push(`homeTech "${id}" is not a Technical story`);
        else if (pick === cover) warnings.push(`homeTech "${id}" is already the homepage cover`);
        else tech = pick;
    }
    if (!tech) tech = posts.find(post => post !== cover && isTechnical(post)) || null;
    const journal = posts.filter(post => post !== cover && post !== tech);
    return { cover, tech, journal, warnings };
}

function injectHomeJournal(indexPosts, blogPosts, selection = {}) {
    const indexHtmlPath = path.join(CONFIG.BLOG_DIR, '..', '..', 'index.html');
    if (!fs.existsSync(indexHtmlPath)) return false;
    const html = fs.readFileSync(indexHtmlPath, 'utf8');
    if (!html.includes('<!-- f1s:home-journal:begin -->')) {
        console.warn('⚠️  index.html has no home-journal markers; the homepage journal was not rendered');
        return false;
    }
    // The cover story itself is rendered by injectHomepageHero; its reading time and the two frames beside it come from here.
    const { cover, tech, journal, warnings } = selectHomeStories(indexPosts, selection);
    // ON AIR already leads with this episode; the Journal moves on to the next story.
    const onAirEpisode = featuredEpisode(blogPosts);
    const posts = journal.filter(post => !isFeaturedEpisode(post, onAirEpisode));
    warnings.forEach(warning => console.warn(`⚠️  editorial-selection.json: ${warning}; the technical spread falls back to the newest Technical story`));
    const paddock = selectPaddock(posts);
    const featureSource = paddock.feature && blogPosts.find(post => post.id === paddock.feature.id);
    let updated = replaceInlineMarkers(html, 'home-journal', renderHomeJournal(paddock, featureSource ? featureSource.excerpt || '' : ''));
    updated = replaceInlineMarkers(updated, 'home-cover-frames', renderCoverFrames(paddock.frames, post => blogPosts.find(item => item.id === post.id) || {}));
    updated = replaceInlineMarkers(updated, 'home-cover-time', cover ? escapeHtmlAttribute(homeReadingTime(cover)) : '');
    if (tech && updated.includes('<!-- f1s:home-tech:begin -->')) {
        const source = blogPosts.find(post => post.id === tech.id) || tech;
        const teamKey = findTeamKey(tech.title, (tech.tags || []).join(' '));
        // Read explicit source provenance even when the article's cached metadata predates this contract.
        const sourcePath = path.join(CONFIG.BLOG_DIR, tech.id, 'source.txt');
        const metadata = fs.existsSync(sourcePath) ? extractMetadata(sourcePath, fs.readFileSync(sourcePath, 'utf8')) : {};
        const storyDate = String(tech.date || '').slice(0, 10);
        const season = metadata.debriefSeason;
        const round = latestDebriefRound(undefined, { season, date: storyDate, round: metadata.debriefRound, location: metadata.debriefLocation });
        const team = round && round.teamIdealLap.find(item => item.teamKey === teamKey);
        const telemetry = renderTelemetry(round, teamKey, { season });
        updated = replaceInlineMarkers(updated, 'home-tech', renderHomeTech(tech, source.excerpt || '', telemetry, team ? team.teamName : '', { graphic: source.homeImage === 'graphic' }));
    } else if (!tech && updated.includes('<!-- f1s:home-tech:begin -->')) {
        updated = replaceInlineMarkers(updated, 'home-tech', '\n');
    }
    if (updated.includes('<!-- f1s:home-tech:begin -->')) {
        // An empty eligible pool must not leave a previous feature visible; a later build restores the section.
        updated = updated.replace(/(<section id="tech")(?: hidden)?(?=\s)/, `$1${tech ? '' : ' hidden'}`);
    }
    if (updated === html) return false;
    fs.writeFileSync(indexHtmlPath, updated);
    console.log(`Homepage journal rendered into ${indexHtmlPath}`);
    return true;
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
    const image = post && (post.backgroundImage || post.image) || CONFIG.DEFAULT_BLOG_IMAGE;
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

// The cover headline steps down in size as it grows, so long titles keep to about four lines.
function heroTitleSizeClass(text) {
    const length = String(text || '').length;
    return length <= 30 ? 'is-short' : length <= 60 ? 'is-medium' : 'is-long';
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

const HOME_COVER_MIN_WIDTH = 1200;
const HOME_COVER_RENDER_WIDTH = 1100;

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
    // The cover renders up to ~1,100 CSS px wide (1920 viewport). An unmeasured image (no width) is not flagged.
    const measuredWidth = parseInt(hero.heroImageWidth, 10);
    if (measuredWidth > 0 && measuredWidth < HOME_COVER_MIN_WIDTH) {
        console.warn(`⚠️  Cover image ${image} (story ${storyId}) is ${measuredWidth}px wide; the homepage cover renders up to ~${HOME_COVER_RENDER_WIDTH}px, so it is upscaled ${(HOME_COVER_RENDER_WIDTH / measuredWidth).toFixed(2)}× at 1920 (double on 2× displays). Supply a ≥1,600px master (D8).`);
    }
    // The lead frame is the full width up to 1099px and half the page above it (the cover strip).
    const imageSizes = '(max-width: 1099px) 100vw, 50vw';
    const imageUrl = /^https?:\/\//i.test(image) ? image : `https://f1stories.gr${image}`;
    // A master wider than the 800px copy is offered at both widths, so a phone does not fetch the 1,600px file.
    const widths = width > 800 && /\/1\.webp$/.test(image) && /\/1\.avif$/.test(avif) ? coverFrameSources({ id: storyId }, { image, imageWidth: width }) : { webp: [], avif: [] };
    // Widest first: validate-public-artifact reads the first candidate as the story image.
    const avifSet = widths.avif.length > 1 ? [...widths.avif].reverse().join(', ') : '';
    const webpSet = widths.webp.length > 1 ? [...widths.webp].reverse().join(', ') : '';
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
    html = html.replace(
        /(<h1\b[^>]*\bid="hero-title"[^>]*)(>)/i,
        (match, attributes, closing) => setHtmlAttribute(attributes, 'class', heroTitleSizeClass(titlePresentation.text)) + closing
    );
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

    // The button and the cover photograph's frame both open the story.
    html = html.replace(
        /(<a\b[^>]*\bid="hero-(?:story|frame)-link"[^>]*\bhref=")[^"]*(")/gi,
        `$1${escapeHtmlAttribute(href)}$2`
    );
    html = updateElementById(html, 'hero-source-avif', attributes => {
        const updated = avif ? setHtmlAttribute(attributes, 'srcset', avifSet || avif) : removeHtmlAttribute(attributes, 'srcset');
        return avifSet ? setHtmlAttribute(updated, 'sizes', imageSizes) : removeHtmlAttribute(updated, 'sizes');
    });
    html = updateElementById(html, 'hero-source-webp', attributes => {
        const updated = webp ? setHtmlAttribute(attributes, 'srcset', webpSet || webp) : removeHtmlAttribute(attributes, 'srcset');
        return webpSet ? setHtmlAttribute(updated, 'sizes', imageSizes) : removeHtmlAttribute(updated, 'sizes');
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
        updated = avifSet ? setHtmlAttribute(updated, 'imagesrcset', avifSet) : removeHtmlAttribute(updated, 'imagesrcset');
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

// Cover copy comes from the article's opening paragraph and is cut only at sentence ends:
// `deck` gathers whole sentences up to 160 characters (or one opening sentence up to 240),
// `lede` is the next whole sentence.
function heroCopy(post) {
    let html = typeof post.content === 'string' ? post.content : '';
    if (!html) {
        try {
            html = articleBodyHtml(fs.readFileSync(path.join(CONFIG.BLOG_DIR, post.id, 'article.html'), 'utf8'))
                .replace(/<header class="rr-data__head">[\s\S]*?<\/header>/g, '');
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

// Posts carried over without their body (cache hits, source-less legacy pages) keep whatever reading time an older
// build stored. Measure the page that is actually served so the card, the index and the article badge agree.
function syncCachedReadingTimes(posts) {
    posts.forEach(post => {
        if (!post || !post.id || (typeof post.content === 'string' && post.content.trim())) return;
        const articlePath = path.join(CONFIG.BLOG_DIR, post.id, 'article.html');
        if (!fs.existsSync(articlePath)) return;
        const measured = readingTimeFromPage(fs.readFileSync(articlePath, 'utf8'));
        if (measured) post.readingTime = measured;
    });
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
            // Source-less articles keep their published body and media: the page around it is
            // rendered from the current template (race-report.js transforms are idempotent).
            const articlePath = path.join(entryPath, 'article.html');
            if (!fs.existsSync(articlePath)) continue;
            const html = fs.readFileSync(articlePath, 'utf8');
            const content = articleBodyHtml(html);
            if (content.trim()) {
                await renderArticleHtml({ ...post, content }, entryPath, post.id);
                rendered++;
                continue;
            }
            // A page without an article body: only owned taxonomy slots are migrated.
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
    syncCachedReadingTimes(blogPosts);
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

    // Same-day articles are ordered by when they reached main (see publish-order.js), not by author letter.
    const publishTimes = loadPublishTimes(REPO_ROOT);
    blogPosts.sort((a, b) => comparePosts(a, b, { publishTimes, existingOrderById }));

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

    const selection = loadEditorialSelection();
    const edition = injectEdition(indexPosts, selection);
    injectAuthorsDirectory(indexPosts);
    injectHomeTeam(indexPosts);

    const homeLatest = await buildHomeLatest(blogPosts);
    const homeLatestPath = path.join(CONFIG.BLOG_DIR, '..', 'home-latest.json');
    fs.writeFileSync(homeLatestPath, JSON.stringify(homeLatest, null, 0));
    console.log(`Home latest data saved to ${homeLatestPath} (${jsonKb(homeLatest)} KB)`);
    injectHomepageHero(homeLatest[0]);
    injectHomeJournal(indexPosts, blogPosts, selection);
    await injectHomePanels(undefined, blogPosts);

    generateSitemap(blogPosts, edition ? edition.pages.filter(page => page.file !== 'index.html') : []);
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
    injectEdition,
    renderHomeJournal,
    selectPaddock,
    renderCoverFrames,
    renderHomeTech,
    selectHomeStories,
    injectHomeJournal,
    injectHomepageHero,
    buildHomeLatest,
    loadExistingPosts,
    renderCachedArticlePages,
    classifyEntry,
    processBlogEntries
};
