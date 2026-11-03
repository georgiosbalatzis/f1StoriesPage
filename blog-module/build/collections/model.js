const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const T = require('../../taxonomy');
const { isPublishedArticle, articleIsPublic } = require('../entities/hubs');
const { loadRetired } = require('../retired');

const ROOT = path.resolve(__dirname, '../../..');
const MANIFEST_FILE = path.join(ROOT, 'data/audience/collections.v1.json');
const COLLECTIONS_PATH = '/blog-module/blog/collections/';
const GENERATED = /^collections\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)?index\.html$/;
const collectionPath = slug => `${COLLECTIONS_PATH}${slug}/`;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function loadCollectionInputs() {
    return {
        manifest: JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8')),
        articles: JSON.parse(fs.readFileSync(path.join(ROOT, 'blog-module/blog-source-cache.json'), 'utf8')).posts
    };
}

function validateManifest(manifest, { articles, retired = loadRetired() } = {}) {
    function check(condition, message) { if (!condition) throw new Error(`collections: ${message}`); }
    function keys(value, allowed, label) {
        check(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
        for (const key of Object.keys(value)) check(allowed.includes(key), `${label}: unknown key ${key}`);
    }
    function string(value, label, max = Infinity) {
        check(typeof value === 'string' && value.length > 0 && value === value.trim()
            && !/[\u0000-\u001f\u007f-\u009f]/.test(value) && value.length <= max, `${label}: invalid string`);
    }
    function day(value, label) { check(T.isDay(value), `${label}: invalid date`); }
    keys(manifest, ['version', 'collections'], 'manifest');
    check(manifest.version === 1, 'invalid version');
    check(Array.isArray(manifest.collections), 'collections must be an array');
    check(Array.isArray(articles), 'articles must be an array');
    const ids = new Set(articles.map(article => article.id));
    const retiredById = new Map(retired.map(entry => [entry.id, entry.target]));
    const slugs = new Set();
    for (const collection of manifest.collections) {
        keys(collection, ['slug', 'status', 'title', 'description', 'introduction', 'items', 'revised', 'review', 'retired'], 'collection');
        const { slug } = collection;
        string(slug, 'slug', 60);
        check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug), `invalid slug ${slug}`);
        check(!slugs.has(slug), `duplicate slug ${slug}`); slugs.add(slug);
        check(['draft', 'published', 'retired'].includes(collection.status), `${slug}: invalid status`);
        string(collection.title, `${slug}: title`, 90);
        string(collection.description, `${slug}: description`, 160);
        check(Array.isArray(collection.introduction) && collection.introduction.length >= 1 && collection.introduction.length <= 4, `${slug}: invalid introduction`);
        collection.introduction.forEach(text => string(text, `${slug}: introduction`, 700));
        check(Array.isArray(collection.items) && collection.items.length >= 3 && collection.items.length <= 12, `${slug}: invalid item count`);
        const members = new Set();
        collection.items.forEach((item, index) => {
            keys(item, ['position', 'articleId', 'reason'], `${slug}: item`);
            check(item.position === index + 1, `${slug}: invalid position`);
            string(item.articleId, `${slug}: articleId`);
            check(/^[\p{L}\p{N}_-]+$/u.test(item.articleId), `${slug}: unsafe articleId ${item.articleId}`);
            check(!members.has(item.articleId), `${slug}: duplicate articleId ${item.articleId}`); members.add(item.articleId);
            check(!retiredById.has(item.articleId), `${slug}: retired article ${item.articleId}; replace with ${retiredById.get(item.articleId)}`);
            check(ids.has(item.articleId), `${slug}: unknown articleId ${item.articleId}`);
            if (Object.hasOwn(item, 'reason')) string(item.reason, `${slug}: reason`, 280);
        });
        day(collection.revised, `${slug}: revised`);
        keys(collection.review, ['status', 'kind', 'by', 'date', 'contentSha256'], `${slug}: review`);
        const review = collection.review;
        check(['pending', 'approved'].includes(review.status), `${slug}: invalid review status`);
        if (review.status === 'pending') check(Object.keys(review).length === 1, `${slug}: invalid pending review`);
        else {
            check(review.kind === 'human', `${slug}: approved review requires human kind`);
            string(review.by, `${slug}: reviewer`);
            day(review.date, `${slug}: review date`);
            check(review.date >= collection.revised, `${slug}: review date before revised`);
            check(typeof review.contentSha256 === 'string' && /^[a-f0-9]{64}$/.test(review.contentSha256), `${slug}: invalid approval digest`);
        }
        check(Object.hasOwn(collection, 'retired') === (collection.status === 'retired'), `${slug}: retired block required iff retired`);
        if (collection.status === 'retired') {
            keys(collection.retired, ['date', 'reason'], `${slug}: retired`);
            day(collection.retired.date, `${slug}: retired date`);
            string(collection.retired.reason, `${slug}: retired reason`);
        }
    }
}

function contentDigest(collection) {
    const { slug, title, description, introduction, revised } = collection;
    const items = collection.items.map(item => ({ position: item.position, articleId: item.articleId,
        ...(Object.hasOwn(item, 'reason') ? { reason: item.reason } : {}) }));
    return createHash('sha256').update(JSON.stringify({ slug, title, description, introduction, items, revised }), 'utf8').digest('hex');
}

function selectCollections(manifest, articles, { today, isPublic = articleIsPublic, retired = loadRetired() } = {}) {
    if (!T.isDay(today)) throw new Error('Collection generation requires a valid publication day');
    validateManifest(manifest, { articles, retired });
    const byId = new Map(articles.map(article => [article.id, article]));
    return manifest.collections.slice().sort((a, b) => compare(a.slug, b.slug)).map(collection => {
        const reasons = [];
        const add = (code, detail) => reasons.push({ code, detail });
        if (collection.status !== 'published') add('status', `status is ${collection.status}`);
        if (collection.review.status !== 'approved') add('approval', 'human approval pending');
        else {
            if (collection.review.date > today) add('approval-date', `review date ${collection.review.date} is in the future`);
            if (collection.review.contentSha256 !== contentDigest(collection)) add('digest', 'content digest mismatch');
        }
        if (collection.revised > today) add('revised', `revised date ${collection.revised} is in the future`);
        const posts = collection.items.map(item => ({ ...byId.get(item.articleId), position: item.position,
            ...(Object.hasOwn(item, 'reason') ? { reason: item.reason } : {}) }));
        for (const post of posts) if (!isPublishedArticle(post, today, isPublic)) add('member', `article ${post.id} is not public and published`);
        const lastmod = [collection.revised, collection.review.date, ...posts.map(post => post.date)]
            .filter(date => T.isDay(date) && date <= today).sort().pop() || '';
        return { collection, posts, lastmod, reasons, eligible: reasons.length === 0 };
    });
}

function publicCollectionFiles(inputs = loadCollectionInputs(), options = {}) {
    const selected = selectCollections(inputs.manifest, inputs.articles, { today: T.athensDay(), ...options }).filter(item => item.eligible);
    return new Set(selected.length ? [COLLECTIONS_PATH.slice(1) + 'index.html',
        ...selected.map(item => collectionPath(item.collection.slug).slice(1) + 'index.html')] : []);
}

if (require.main === module) {
    try {
        // `npm run collections:validate -- --digest <slug>` arrives as `--validate --digest <slug>`.
        let args = process.argv.slice(2);
        if (args[0] === '--validate' && args[1] === '--digest') args = args.slice(1);
        const inputs = loadCollectionInputs();
        if (args.length === 2 && args[0] === '--digest') {
            validateManifest(inputs.manifest, { articles: inputs.articles });
            const collection = inputs.manifest.collections.find(item => item.slug === args[1]);
            if (!collection) throw new Error(`Unknown collection: ${args[1]}`);
            console.log(contentDigest(collection));
        } else if (args[0] === '--validate' && (args.length === 1 || (args.length === 2 && args[1] === '--strict'))) {
            const selected = selectCollections(inputs.manifest, inputs.articles, { today: T.athensDay() });
            for (const item of selected) console.log(`${item.collection.slug} ${item.collection.status} eligible=${item.eligible ? 'yes' : 'no'} ${item.reasons.map(reason => `${reason.code}: ${reason.detail}`).join('; ')}`);
            if (args.includes('--strict') && selected.some(item => item.collection.status === 'published' && !item.eligible)) process.exitCode = 1;
        } else throw new Error('Usage: model.js --validate [--strict] | --digest <slug>');
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { MANIFEST_FILE, loadCollectionInputs, validateManifest, contentDigest, selectCollections,
    COLLECTIONS_PATH, collectionPath, GENERATED, publicCollectionFiles };
