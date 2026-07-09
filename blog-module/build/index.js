const { Worker } = require('worker_threads');
const os = require('os');
const { updateDirtyAirCache } = require('../dirty-air-cache');
const { updateDestructorsCache } = require('../destructors-cache');
const { updateDebriefCache } = require('../../standings/debrief-cache');
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
const { injectRelatedArticles } = require('./related');
const { injectPrevNextLinks } = require('./nav');
const { renderArticleHtml } = require('./article-render');

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
        const categories = normalizeCategoryList([post.tag, post.category]);
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
            categories
        };
    }));
}

function normalizeCategoryList(values) {
    const categories = [];
    const seen = new Set();

    (Array.isArray(values) ? values : [values]).forEach(value => {
        String(value || '')
            .split(',')
            .flatMap(part => part.split(/\s+-\s+/))
            .map(part => part.replace(/^[\s,-]+|[\s,-]+$/g, '').trim())
            .filter(Boolean)
            .forEach(category => {
                if (seen.has(category)) return;
                seen.add(category);
                categories.push(category);
            });
    });

    return categories;
}

function formatCategoryToken(token) {
    const value = String(token || '').trim();
    const lower = value.toLowerCase();
    const acronyms = {
        f1: 'F1',
        gp: 'GP',
        amg: 'AMG',
        rb: 'RB',
        drs: 'DRS',
        v12: 'V12'
    };
    if (acronyms[lower]) return acronyms[lower];
    if (!value || /^\d/.test(value)) return value;
    if (value !== lower && value !== value.toUpperCase()) return value;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function formatCategoryLabel(value) {
    const raw = String(value || '').replace(/^[\s,-]+|[\s,-]+$/g, '').trim();
    if (!raw) return '';
    return raw.split(/-+/).filter(Boolean).map(formatCategoryToken).join(' ');
}

function compactExcerpt(value, maxLength = 140) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) return text;
    const clipped = text.slice(0, maxLength).replace(/\s+\S*$/, '').trim();
    return `${clipped || text.slice(0, maxLength).trim()}...`;
}

function formatBlogIndexDate(post) {
    const value = post.date || post.displayDate || '';
    const parsed = value ? new Date(value.length === 10 ? `${value}T12:00:00` : value) : null;
    if (parsed && !Number.isNaN(parsed.getTime())) {
        return new Intl.DateTimeFormat('el-GR', { day: 'numeric', month: 'long', year: 'numeric' }).format(parsed);
    }
    return post.displayDate || post.date || '';
}

function formatReadingTime(value) {
    return String(value || '').replace(/\bmin\b/gi, 'λεπ');
}

function getBlogIndexSummary(count) {
    return `${count} ${count === 1 ? 'άρθρο' : 'άρθρα'}`;
}

function jsonKb(value) {
    return Math.round(Buffer.byteLength(JSON.stringify(value)) / 1024);
}

function summarizeCategories(posts) {
    const counts = {};
    posts.forEach(post => {
        (post.categories || []).forEach(category => {
            const key = String(category || '').trim();
            if (!key) return;
            counts[key] = (counts[key] || 0) + 1;
        });
    });

    return Object.keys(counts)
        .sort((a, b) => {
            const diff = counts[b] - counts[a];
            return diff || a.localeCompare(b, 'el');
        })
        .map(name => ({ name, count: counts[name] }));
}

function buildCompactIndexData(posts) {
    const authors = Array.from(new Set(posts.map(post => post.author || 'F1 Stories')));
    const categories = Array.from(new Set(posts.flatMap(post => post.categories || [])));

    return {
        v: 2,
        a: authors,
        c: categories,
        p: posts.map(post => [
            post.id,
            post.title,
            authors.indexOf(post.author || 'F1 Stories'),
            post.date,
            post.thumbnailWidth === 400 ? 0 : post.thumbnailWidth,
            post.thumbnailHeight,
            post.excerpt,
            post.readingTime,
            (post.categories || []).map(category => categories.indexOf(category))
        ])
    };
}

function renderBlogCategoryFilters(categories) {
    const buttons = [
        '<button class="category-chip active" data-category="all" aria-pressed="true">Όλες</button>'
    ];

    categories.forEach(category => {
        const name = typeof category === 'string' ? category : category.name;
        if (!name) return;
        const label = formatCategoryLabel(name);
        buttons.push(
            `<button class="category-chip" data-category="${escapeHtmlAttribute(name)}" aria-pressed="false">${escapeHtmlAttribute(label)}</button>`
        );
    });

    return buttons.join('\n                    ');
}

function renderBlogCardCategories(categories) {
    const list = categories || [];
    const chips = list
        .slice(0, 2)
        .map(category => `<span class="article-card-cat">${escapeHtmlAttribute(formatCategoryLabel(category))}</span>`);
    if (list.length > 2) {
        chips.push(`<span class="article-card-cat article-card-cat-more">+${list.length - 2}</span>`);
    }
    return chips.join('');
}

function renderBlogIndexCard(post, idx) {
    const categories = renderBlogCardCategories(post.categories);
    const url = post.url || `/blog-module/blog-entries/${post.id}/article.html`;
    const image = post.thumbnail || post.image || '';
    const imagePath = image && image.startsWith('/blog-module/blog-entries/')
        ? path.join(CONFIG.BLOG_DIR, post.id, path.posix.basename(image))
        : null;
    const hasImage = Boolean(image && (!imagePath || fs.existsSync(imagePath)));
    const author = post.author || 'F1 Stories';
    const excerpt = post.excerpt || '';
    let readingTime = post.readingTime || post.readTime || '';
    if (!readingTime && post.wordCount) readingTime = `${Math.max(1, Math.ceil(post.wordCount / 200))} min`;
    if (!readingTime && excerpt) readingTime = `${Math.max(2, Math.ceil(Math.round(excerpt.split(/\s+/).length * 10) / 200))} min`;
    readingTime = formatReadingTime(readingTime);
    const readBadge = readingTime
        ? `<span>·</span><span class="article-card-reading-time"><svg class="icon" aria-hidden="true"><use href="#fa-clock"/></svg> ${escapeHtmlAttribute(readingTime)}</span>`
        : '';
    const imageWidth = parseInt(post.thumbnailWidth, 10) || 400;
    const imageHeight = parseInt(post.thumbnailHeight, 10) || 188;
    const isLcpImage = idx === 0 && hasImage;
    const imageClass = `article-card-img${isLcpImage ? ' loaded' : ''}`;
    const imageAttrs = !hasImage
        ? ' hidden'
        : isLcpImage
        ? ` src="${escapeHtmlAttribute(image)}" loading="eager" fetchpriority="high"`
        : ` data-src="${escapeHtmlAttribute(image)}" loading="lazy"`;
    const stagger = 0.06;
    const animationDelay = Math.round(idx * stagger * 100) / 100;

    return '<article class="article-card-wrap">'
        + `<a href="${escapeHtmlAttribute(url)}" class="article-card${hasImage ? '' : ' article-card--no-image'}" style="animation-delay:${animationDelay}s">`
        + `<div class="article-card-img-wrap${hasImage ? '' : ' img-ready'}"><img class="${imageClass}" width="${imageWidth}" height="${imageHeight}"${imageAttrs} decoding="async" alt="${escapeHtmlAttribute(post.title)}" data-fallback-src="${CONFIG.DEFAULT_BLOG_IMAGE}"></div>`
        + '<div class="article-card-body">'
        + `<div class="article-card-meta"><span class="author-tag">${escapeHtmlAttribute(author)}</span><span>·</span><time class="article-card-date" datetime="${escapeHtmlAttribute(post.date || '')}">${escapeHtmlAttribute(formatBlogIndexDate(post))}</time>${readBadge}</div>`
        + `<h2 class="article-card-title">${escapeHtmlAttribute(post.title)}</h2>`
        + `<p class="article-card-excerpt">${escapeHtmlAttribute(excerpt)}</p>`
        + '</div>'
        + `<div class="article-card-footer"><span class="article-card-read">Διαβάστε περισσότερα <svg class="icon" aria-hidden="true"><use href="#fa-arrow-right"/></svg></span><div class="article-card-cats">${categories}</div></div>`
        + '</a>'
        + '</article>';
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

function injectBlogIndexFirstPage(indexPosts, pageOneData) {
    const indexHtmlPath = path.join(CONFIG.OUTPUT_HTML_DIR, 'index.html');
    if (!fs.existsSync(indexHtmlPath)) {
        console.warn(`⚠️  Blog index HTML not found, static first-page render skipped: ${indexHtmlPath}`);
        return false;
    }

    const firstPagePosts = pageOneData.posts || indexPosts.slice(0, 12);
    const firstImage = firstPagePosts[0] && (firstPagePosts[0].thumbnail || firstPagePosts[0].image);
    const preloadBlock = [
        '<link rel="preload" href="/blog-module/blog-index-page-1.json" as="fetch" crossorigin>',
        firstImage ? `<link rel="preload" as="image" href="${escapeHtmlAttribute(firstImage)}" fetchpriority="high">` : ''
    ].filter(Boolean).join('\n    ');
    const cards = firstPagePosts.map((post, idx) => renderBlogIndexCard(post, idx)).join('\n            ');
    const categories = renderBlogCategoryFilters(pageOneData.categories || summarizeCategories(indexPosts));
    const count = getBlogIndexSummary(pageOneData.totalCount || indexPosts.length);

    let html = fs.readFileSync(indexHtmlPath, 'utf8');
    const original = html;

    html = html.replace(
        /[ \t]*<link rel="preload" href="\/blog-module\/blog-index-data\.json" as="fetch" crossorigin>\n?/,
        '    <!-- f1s:blog-index-preload:begin -->\n    <!-- f1s:blog-index-preload:end -->\n'
    );
    html = replaceMarkedBlock(
        html,
        '<!-- f1s:blog-index-preload:begin -->',
        '<!-- f1s:blog-index-preload:end -->',
        `    ${preloadBlock}`
    );

    html = html.replace(
        /(<div class="category-strip" id="category-strip" aria-label="Φίλτρο κατηγορίας">)([\s\S]*?)(<\/div>)/,
        `$1\n                    <!-- f1s:blog-categories:begin -->\n                    ${categories}\n                    <!-- f1s:blog-categories:end -->\n                $3`
    );
    html = replaceMarkedBlock(
        html,
        '<!-- f1s:blog-categories:begin -->',
        '<!-- f1s:blog-categories:end -->',
        `                    ${categories}`
    );

    html = html.replace(
        /(<div class="post-count" id="post-count" aria-live="polite">)([\s\S]*?)(<\/div>)/,
        `$1<!-- f1s:blog-count:begin -->${escapeHtmlAttribute(count)}<!-- f1s:blog-count:end -->$3`
    );

    html = html.replace(
        /(<div class="articles-grid" id="articles-grid">)([\s\S]*?)(\n\s*<\/div>\n\s*<nav class="blog-pagination" id="blog-pagination")/,
        `$1\n            <!-- f1s:blog-first-page:begin -->\n            ${cards}\n            <!-- f1s:blog-first-page:end -->$3`
    );
    html = replaceMarkedBlock(
        html,
        '<!-- f1s:blog-first-page:begin -->',
        '<!-- f1s:blog-first-page:end -->',
        `            ${cards}`
    );

    if (html !== original) {
        fs.writeFileSync(indexHtmlPath, html);
        console.log(`Blog first page rendered into ${indexHtmlPath}`);
        return true;
    }

    return false;
}

async function buildHomeLatest(blogPosts) {
    return Promise.all(blogPosts.slice(0, 3).map(async post => {
        const thumbnail = getCardThumbnailPath(post.image);
        const thumbnailDimensions = await getImageDimensionsForPublicPath(thumbnail);
        return {
        title: post.title,
        slug: post.id,
        date: post.date,
        excerpt: post.excerpt,
        thumbnail,
        thumbnailWidth: thumbnailDimensions && thumbnailDimensions.width ? thumbnailDimensions.width : 400,
        thumbnailHeight: thumbnailDimensions && thumbnailDimensions.height ? thumbnailDimensions.height : 188
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
    if (!loadExistingPosts.hasFullContent) return;

    let rendered = 0;
    for (const post of cachedPosts) {
        if (!post || !post.id) continue;
        if (typeof post.content !== 'string' || !post.content.trim()) continue;
        const entryPath = path.join(CONFIG.BLOG_DIR, post.id);
        if (!fs.existsSync(entryPath)) continue;
        await renderArticleHtml(post, entryPath, post.id);
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

    const indexPosts = await buildIndexPosts(blogPosts);
    const indexPath = path.join(CONFIG.BLOG_DIR, '..', 'blog-index-data.json');
    const compactIndexData = buildCompactIndexData(indexPosts);
    fs.writeFileSync(indexPath, JSON.stringify(compactIndexData, null, 0));
    console.log(`Blog index data saved to ${indexPath} (${jsonKb(compactIndexData)} KB)`);

    const pageOneData = {
        posts: indexPosts.slice(0, 12),
        categories: summarizeCategories(indexPosts),
        totalCount: indexPosts.length,
        lastUpdated
    };
    const pageOnePath = path.join(CONFIG.BLOG_DIR, '..', 'blog-index-page-1.json');
    const existingPageOneData = readJsonIfExists(pageOnePath);
    if (sameJsonExceptKey(existingPageOneData, pageOneData, 'lastUpdated') && existingPageOneData.lastUpdated) {
        pageOneData.lastUpdated = existingPageOneData.lastUpdated;
    }
    fs.writeFileSync(pageOnePath, JSON.stringify(pageOneData, null, 0));
    console.log(`Blog first-page data saved to ${pageOnePath} (${jsonKb(pageOneData)} KB)`);
    injectBlogIndexFirstPage(indexPosts, pageOneData);

    const homeLatest = await buildHomeLatest(blogPosts);
    const homeLatestPath = path.join(CONFIG.BLOG_DIR, '..', 'home-latest.json');
    fs.writeFileSync(homeLatestPath, JSON.stringify(homeLatest, null, 0));
    console.log(`Home latest data saved to ${homeLatestPath} (${jsonKb(homeLatest)} KB)`);

    generateSitemap(blogPosts);
    await renderCachedArticlePages(cachedPosts);
    await injectRelatedArticles(blogPosts);
    injectPrevNextLinks(blogPosts);

    try {
        const dirtyAirResult = await updateDirtyAirCache({ force: forceRebuild });
        console.log(
            `Dirty air cache saved to ${dirtyAirResult.outputPath} ` +
            `(${dirtyAirResult.sessionCount} sessions, ${dirtyAirResult.rebuiltCount} rebuilt, ${dirtyAirResult.reusedCount} reused, ${dirtyAirResult.failedCount} failed)`
        );
    } catch (error) {
        console.warn(`⚠️  Dirty air cache update skipped: ${error.message}`);
    }

    try {
        const destructorsResult = await updateDestructorsCache({ force: forceRebuild });
        console.log(
            `Destructors cache saved to ${destructorsResult.outputPath} ` +
            `(${destructorsResult.driverCount} drivers, ${destructorsResult.activeTeamCount} active teams${destructorsResult.unchanged ? ', unchanged' : ''})`
        );
    } catch (error) {
        console.warn(`⚠️  Destructors cache update skipped: ${error.message}`);
    }

    if (process.env.BLOG_BUILD_REFRESH_DEBRIEF === '1') {
        try {
            const debriefResult = await updateDebriefCache({ force: forceRebuild });
            console.log(
                `Debrief cache saved to ${debriefResult.outputPath} ` +
                `(${debriefResult.roundCount} rounds, season ${debriefResult.season})`
            );
        } catch (error) {
            console.warn(`⚠️  Debrief cache update skipped: ${error.message}`);
        }
    } else {
        console.log('Debrief cache refresh skipped during blog build; set BLOG_BUILD_REFRESH_DEBRIEF=1 to refresh it.');
    }

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
    summarizeCategories,
    buildCompactIndexData,
    renderBlogIndexCard,
    injectBlogIndexFirstPage,
    buildHomeLatest,
    loadExistingPosts,
    renderCachedArticlePages,
    classifyEntry,
    processBlogEntries
};
