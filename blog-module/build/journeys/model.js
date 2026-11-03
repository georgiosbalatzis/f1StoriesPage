const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const T = require('../../taxonomy');
const { isPublishedArticle, articleIsPublic } = require('../entities/hubs');
const { loadRetired } = require('../retired');

const ROOT = path.resolve(__dirname, '../../..');
const MANIFEST_FILE = path.join(ROOT, 'data/audience/reading-journeys.v1.json');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function loadJourneyInputs() {
    return {
        manifest: JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8')),
        articles: JSON.parse(fs.readFileSync(path.join(ROOT, 'blog-module/blog-source-cache.json'), 'utf8')).posts
    };
}

function validateManifest(manifest, { articles, retired = loadRetired() } = {}) {
    function check(condition, message) { if (!condition) throw new Error(`journeys: ${message}`); }
    function keys(value, allowed, label) {
        check(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
        for (const key of Object.keys(value)) check(allowed.includes(key), `${label}: unknown key ${key}`);
    }
    function string(value, label, max = Infinity) {
        check(typeof value === 'string' && value.length > 0 && value === value.trim()
            && !/[\u0000-\u001f\u007f-\u009f]/.test(value) && value.length <= max, `${label}: invalid string`);
    }
    function day(value, label) { check(T.isDay(value), `${label}: invalid date`); }
    keys(manifest, ['version', 'journeys'], 'manifest');
    check(manifest.version === 1, 'invalid version');
    check(Array.isArray(manifest.journeys), 'journeys must be an array');
    check(Array.isArray(articles), 'articles must be an array');
    const ids = new Set(articles.map(article => article.id));
    const retiredById = new Map(retired.map(entry => [entry.id, entry.target]));
    const slugs = new Set();
    const publishedMembers = new Set();
    for (const journey of manifest.journeys) {
        keys(journey, ['slug', 'status', 'title', 'description', 'steps', 'revised', 'review', 'retired'], 'journey');
        const { slug } = journey;
        string(slug, 'slug', 60);
        check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug), `invalid slug ${slug}`);
        check(!slugs.has(slug), `duplicate slug ${slug}`); slugs.add(slug);
        check(['draft', 'published', 'retired'].includes(journey.status), `${slug}: invalid status`);
        string(journey.title, `${slug}: title`, 90);
        string(journey.description, `${slug}: description`, 200);
        check(Array.isArray(journey.steps) && journey.steps.length >= 2 && journey.steps.length <= 6, `${slug}: invalid step count`);
        const members = new Set();
        journey.steps.forEach((step, index) => {
            keys(step, ['position', 'articleId', 'transition'], `${slug}: step`);
            check(step.position === index + 1, `${slug}: invalid position`);
            string(step.articleId, `${slug}: articleId`);
            check(/^[\p{L}\p{N}_-]+$/u.test(step.articleId), `${slug}: unsafe articleId ${step.articleId}`);
            check(!members.has(step.articleId), `${slug}: duplicate articleId ${step.articleId}`); members.add(step.articleId);
            check(!retiredById.has(step.articleId), `${slug}: retired article ${step.articleId}; replace with ${retiredById.get(step.articleId)}`);
            check(ids.has(step.articleId), `${slug}: unknown articleId ${step.articleId}`);
            check(Object.hasOwn(step, 'transition') === (index < journey.steps.length - 1), `${slug}: invalid transition`);
            if (Object.hasOwn(step, 'transition')) string(step.transition, `${slug}: transition`, 240);
            if (journey.status === 'published') {
                check(!publishedMembers.has(step.articleId), `${slug}: published overlap for article ${step.articleId}`);
                publishedMembers.add(step.articleId);
            }
        });
        day(journey.revised, `${slug}: revised`);
        keys(journey.review, ['status', 'kind', 'by', 'date', 'contentSha256'], `${slug}: review`);
        const review = journey.review;
        check(['pending', 'approved'].includes(review.status), `${slug}: invalid review status`);
        if (review.status === 'pending') check(Object.keys(review).length === 1, `${slug}: invalid pending review`);
        else {
            check(review.kind === 'human', `${slug}: approved review requires human kind`);
            string(review.by, `${slug}: reviewer`);
            day(review.date, `${slug}: review date`);
            check(review.date >= journey.revised, `${slug}: review date before revised`);
            check(typeof review.contentSha256 === 'string' && /^[a-f0-9]{64}$/.test(review.contentSha256), `${slug}: invalid approval digest`);
        }
        check(Object.hasOwn(journey, 'retired') === (journey.status === 'retired'), `${slug}: retired block required iff retired`);
        if (journey.status === 'retired') {
            keys(journey.retired, ['date', 'reason'], `${slug}: retired`);
            day(journey.retired.date, `${slug}: retired date`);
            string(journey.retired.reason, `${slug}: retired reason`);
        }
    }
}

function contentDigest(journey) {
    const { slug, title, description, revised } = journey;
    const steps = journey.steps.map(step => ({ position: step.position, articleId: step.articleId,
        ...(Object.hasOwn(step, 'transition') ? { transition: step.transition } : {}) }));
    return createHash('sha256').update(JSON.stringify({ slug, title, description, steps, revised }), 'utf8').digest('hex');
}

function selectJourneys(manifest, articles, { today, isPublic = articleIsPublic, retired = loadRetired() } = {}) {
    if (!T.isDay(today)) throw new Error('Journey generation requires a valid publication day');
    validateManifest(manifest, { articles, retired });
    const byId = new Map(articles.map(article => [article.id, article]));
    return manifest.journeys.slice().sort((a, b) => compare(a.slug, b.slug)).map(journey => {
        const reasons = [];
        const add = (code, detail) => reasons.push({ code, detail });
        if (journey.status !== 'published') add('status', `status is ${journey.status}`);
        if (journey.review.status !== 'approved') add('approval', 'human approval pending');
        else {
            if (journey.review.date > today) add('approval-date', `review date ${journey.review.date} is in the future`);
            if (journey.review.contentSha256 !== contentDigest(journey)) add('digest', 'content digest mismatch');
        }
        if (journey.revised > today) add('revised', `revised date ${journey.revised} is in the future`);
        const steps = journey.steps.map(step => ({ ...byId.get(step.articleId), position: step.position,
            ...(Object.hasOwn(step, 'transition') ? { transition: step.transition } : {}) }));
        for (const post of steps) if (!isPublishedArticle(post, today, isPublic)) add('member', `article ${post.id} is not public and published`);
        const lastmod = [journey.revised, journey.review.date, ...steps.map(post => post.date)]
            .filter(date => T.isDay(date) && date <= today).sort().pop() || '';
        return { journey, steps, lastmod, reasons, eligible: reasons.length === 0 };
    });
}

function journeysByArticle(selected) {
    const members = new Map();
    for (const item of selected) {
        if (!item.eligible) continue;
        item.steps.forEach((step, index) => {
            if (members.has(step.id)) throw new Error(`journeys: eligible overlap for article ${step.id}`);
            members.set(step.id, { selected: item, index });
        });
    }
    return members;
}

if (require.main === module) {
    try {
        // `npm run journeys:validate -- --digest <slug>` arrives as `--validate --digest <slug>`.
        let args = process.argv.slice(2);
        if (args[0] === '--validate' && args[1] === '--digest') args = args.slice(1);
        const inputs = loadJourneyInputs();
        if (args.length === 2 && args[0] === '--digest') {
            validateManifest(inputs.manifest, { articles: inputs.articles });
            const journey = inputs.manifest.journeys.find(item => item.slug === args[1]);
            if (!journey) throw new Error(`Unknown journey: ${args[1]}`);
            console.log(contentDigest(journey));
        } else if (args[0] === '--validate' && (args.length === 1 || (args.length === 2 && args[1] === '--strict'))) {
            const selected = selectJourneys(inputs.manifest, inputs.articles, { today: T.athensDay() });
            for (const item of selected) console.log(`${item.journey.slug} ${item.journey.status} eligible=${item.eligible ? 'yes' : 'no'} ${item.reasons.map(reason => `${reason.code}: ${reason.detail}`).join('; ')}`);
            if (args.includes('--strict') && selected.some(item => item.journey.status === 'published' && !item.eligible)) process.exitCode = 1;
        } else throw new Error('Usage: model.js --validate [--strict] | --digest <slug>');
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { MANIFEST_FILE, loadJourneyInputs, validateManifest, contentDigest, selectJourneys, journeysByArticle };
