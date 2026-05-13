const { Worker } = require('worker_threads');
const os = require('os');
const { updateDirtyAirCache } = require('../dirty-air-cache');
const { updateDestructorsCache } = require('../destructors-cache');
const { updateDebriefCache } = require('../../standings/debrief-cache');
const { fs, path, CONFIG, utils, getCardThumbnailPath, getImageDimensionsForPublicPath } = require('./shared');
const { generateSitemap } = require('./sitemap');
const { injectRelatedArticles } = require('./related');
const { injectPrevNextLinks } = require('./nav');

function parseBuildOptions(argv = process.argv, env = process.env) {
    const forceRebuild = argv.includes('--force') || argv.includes('-f');
    const maxWorkers = Math.min(parseInt(env.BLOG_WORKERS || '0', 10) || os.cpus().length, os.cpus().length);
    return { forceRebuild, maxWorkers };
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
        const categories = [];
        if (post.tag) categories.push(post.tag);
        if (post.category && String(post.category) !== post.tag) categories.push(String(post.category));
        const thumbnail = getCardThumbnailPath(post.image);
        const thumbnailDimensions = await getImageDimensionsForPublicPath(thumbnail);
        return {
            id: post.id,
            title: post.title,
            author: post.author,
            date: post.date,
            displayDate: post.displayDate,
            image: post.image,
            backgroundImage: post.backgroundImage,
            thumbnail,
            imageWidth: post.imageWidth,
            imageHeight: post.imageHeight,
            backgroundImageWidth: post.backgroundImageWidth,
            backgroundImageHeight: post.backgroundImageHeight,
            thumbnailWidth: thumbnailDimensions && thumbnailDimensions.width ? thumbnailDimensions.width : 400,
            thumbnailHeight: thumbnailDimensions && thumbnailDimensions.height ? thumbnailDimensions.height : 188,
            excerpt: post.excerpt,
            url: post.url,
            wordCount: post.wordCount,
            readingTime: post.readingTime,
            categories
        };
    }));
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
    if (!fs.existsSync(CONFIG.OUTPUT_JSON)) return [];

    try {
        const existing = JSON.parse(fs.readFileSync(CONFIG.OUTPUT_JSON, 'utf8'));
        return existing.posts || [];
    } catch (_) {
        console.warn('⚠️  Could not read cached blog-data.json, continuing without cached post metadata');
        return [];
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
        console.log(`📦 Loaded ${cachedPosts.length} cached entries from blog-data.json`);
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

    const blogData = {
        posts: blogPosts,
        lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(CONFIG.OUTPUT_JSON, JSON.stringify(blogData, null, 2));
    console.log(`Blog data saved to ${CONFIG.OUTPUT_JSON}`);

    const indexPosts = await buildIndexPosts(blogPosts);
    const indexPath = path.join(CONFIG.BLOG_DIR, '..', 'blog-index-data.json');
    fs.writeFileSync(indexPath, JSON.stringify({ posts: indexPosts }, null, 0));
    console.log(`Blog index data saved to ${indexPath} (${Math.round(JSON.stringify({ posts: indexPosts }).length / 1024)} KB)`);

    const homeLatest = await buildHomeLatest(blogPosts);
    const homeLatestPath = path.join(CONFIG.BLOG_DIR, '..', 'home-latest.json');
    fs.writeFileSync(homeLatestPath, JSON.stringify(homeLatest, null, 0));
    console.log(`Home latest data saved to ${homeLatestPath} (${Math.round(JSON.stringify(homeLatest).length / 1024)} KB)`);

    generateSitemap(blogPosts);
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

    try {
        const debriefResult = await updateDebriefCache({ force: forceRebuild });
        console.log(
            `Debrief cache saved to ${debriefResult.outputPath} ` +
            `(${debriefResult.roundCount} rounds, season ${debriefResult.season})`
        );
    } catch (error) {
        console.warn(`⚠️  Debrief cache update skipped: ${error.message}`);
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
    buildHomeLatest,
    loadExistingPosts,
    classifyEntry,
    processBlogEntries
};
