const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const T = require('../../taxonomy');
const { isPublishedArticle, articleUrl } = require('../entities/hubs');
const { pageIsIndexable } = require('../html-attributes');
const { loadRetired } = require('../retired');

const ROOT = path.resolve(__dirname, '../../..');
const MANIFEST_FILE = path.join(ROOT, 'data/audience/briefings.v1.json');
const BRIEFINGS_PATH = '/blog-module/blog/briefing/';
const GENERATED = /^briefing\/(?:\d{4}-w\d{2}\/)?index\.html$/;
const editionPath = id => `${BRIEFINGS_PATH}${id}/`;
const own = (value, key) => Object.hasOwn(value, key);

function loadBriefingInputs() {
    return {
        manifest: JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8')),
        articles: JSON.parse(fs.readFileSync(path.join(ROOT, 'blog-module/blog-source-cache.json'), 'utf8')).posts
    };
}

function isoWeekPeriod(id) {
    const match = typeof id === 'string' && /^(\d{4})-w(0[1-9]|[1-4]\d|5[0-3])$/.exec(id);
    if (!match) throw new Error(`briefings: invalid ISO week ${id}`);
    const year = Number(match[1]), week = Number(match[2]);
    const jan4 = new Date(`${match[1]}-01-04T00:00:00Z`);
    const monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400000 + (week - 1) * 604800000);
    const thursday = new Date(monday.getTime() + 3 * 86400000);
    if (thursday.getUTCFullYear() !== year) throw new Error(`briefings: invalid ISO week ${id}`);
    const start = monday.toISOString().slice(0, 10), end = new Date(monday.getTime() + 6 * 86400000).toISOString().slice(0, 10);
    if (!T.isDay(start) || !T.isDay(end)) throw new Error(`briefings: invalid ISO week ${id}`);
    return { year, week, start, end };
}

function validateManifest(manifest, { articles, retired = loadRetired() } = {}) {
    function check(condition, message) { if (!condition) throw new Error(`briefings: ${message}`); }
    function keys(value, allowed, label) {
        check(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
        for (const key of Object.keys(value)) check(allowed.includes(key), `${label}: unknown key ${key}`);
    }
    function string(value, label, max = Infinity) {
        check(typeof value === 'string' && value.length > 0 && value === value.trim()
            && !/[\u0000-\u001f\u007f-\u009f]/.test(value) && value.length <= max, `${label}: invalid string`);
    }
    function day(value, label) { check(typeof value === 'string' && T.isDay(value), `${label}: invalid date`); }
    function paragraphs(value, label, min, max, length) {
        check(Array.isArray(value) && value.length >= min && value.length <= max, `${label}: invalid paragraphs`);
        value.forEach(text => string(text, label, length));
    }
    keys(manifest, ['version', 'editions'], 'manifest');
    check(manifest.version === 1, 'invalid version');
    check(Array.isArray(manifest.editions), 'editions must be an array');
    check(Array.isArray(articles), 'articles must be an array');
    const byId = new Map(articles.map(article => [article.id, article]));
    const retiredById = new Map(retired.map(entry => [entry.id, entry.target]));
    const ids = new Set();
    for (const edition of manifest.editions) {
        keys(edition, ['id', 'status', 'title', 'description', 'opening', 'sections', 'closing', 'revised', 'review', 'retired'], 'edition');
        const { id } = edition;
        const period = isoWeekPeriod(id);
        check(!ids.has(id), `duplicate id ${id}`); ids.add(id);
        check(['draft', 'published', 'retired'].includes(edition.status), `${id}: invalid status`);
        string(edition.title, `${id}: title`, 90);
        string(edition.description, `${id}: description`, 160);
        paragraphs(edition.opening, `${id}: opening`, 1, 3, 700);
        if (own(edition, 'closing')) paragraphs(edition.closing, `${id}: closing`, 1, 2, 500);
        check(Array.isArray(edition.sections) && edition.sections.length >= 1 && edition.sections.length <= 6, `${id}: invalid sections`);
        const members = new Set(); let count = 0;
        for (const section of edition.sections) {
            keys(section, ['heading', 'intro', 'items'], `${id}: section`);
            string(section.heading, `${id}: heading`, 80);
            if (own(section, 'intro')) string(section.intro, `${id}: intro`, 400);
            check(Array.isArray(section.items) && section.items.length >= 1 && section.items.length <= 6, `${id}: invalid items`);
            for (const item of section.items) {
                keys(item, ['articleId', 'rationale', 'context'], `${id}: item`);
                string(item.articleId, `${id}: articleId`);
                check(/^[\p{L}\p{N}_-]+$/u.test(item.articleId), `${id}: unsafe articleId ${item.articleId}`);
                check(!members.has(item.articleId), `${id}: duplicate articleId ${item.articleId}`); members.add(item.articleId); count++;
                string(item.rationale, `${id}: rationale`, 320);
                if (own(item, 'context')) check(item.context === true, `${id}: invalid context`);
                if (edition.status === 'retired') continue;
                check(!retiredById.has(item.articleId), `${id}: retired article ${item.articleId}; replace with ${retiredById.get(item.articleId)}`);
                check(byId.has(item.articleId), `${id}: unknown articleId ${item.articleId}`);
                const date = byId.get(item.articleId).date;
                day(date, `${id}: article ${item.articleId} publication date`);
                check(item.context === true ? date < period.start : date >= period.start && date <= period.end,
                    `${id}: article ${item.articleId} outside period or invalid context`);
            }
        }
        check(count >= 2 && count <= 15, `${id}: invalid total item count`);
        day(edition.revised, `${id}: revised`);
        keys(edition.review, ['status', 'kind', 'by', 'date', 'contentSha256'], `${id}: review`);
        const review = edition.review;
        check(['pending', 'approved'].includes(review.status), `${id}: invalid review status`);
        if (review.status === 'pending') check(Object.keys(review).length === 1, `${id}: invalid pending review`);
        else {
            check(review.kind === 'human', `${id}: approved review requires human kind`);
            string(review.by, `${id}: reviewer`);
            day(review.date, `${id}: review date`);
            check(review.date >= edition.revised, `${id}: review date before revised`);
            check(review.date >= T.addDays(period.end, 1), `${id}: review date before week completed`);
            check(typeof review.contentSha256 === 'string' && /^[a-f0-9]{64}$/.test(review.contentSha256), `${id}: invalid approval digest`);
        }
        check(own(edition, 'retired') === (edition.status === 'retired'), `${id}: retired block required iff retired`);
        if (edition.status === 'retired') {
            keys(edition.retired, ['date', 'reason'], `${id}: retired`);
            day(edition.retired.date, `${id}: retired date`);
            string(edition.retired.reason, `${id}: retired reason`);
        }
    }
}

function contentDigest(edition) {
    const { id, title, description, opening, revised } = edition;
    const sections = edition.sections.map(section => ({ heading: section.heading,
        ...(own(section, 'intro') ? { intro: section.intro } : {}),
        items: section.items.map(item => ({ articleId: item.articleId, rationale: item.rationale,
            ...(own(item, 'context') ? { context: item.context } : {}) })) }));
    return createHash('sha256').update(JSON.stringify({ id, title, description, opening, sections,
        ...(own(edition, 'closing') ? { closing: edition.closing } : {}), revised }), 'utf8').digest('hex');
}

function isDirectPublic(article, root = ROOT) {
    const url = articleUrl(article);
    const file = path.join(root, decodeURIComponent(new URL(url).pathname));
    if (!fs.existsSync(file)) return false;
    return pageIsIndexable(fs.readFileSync(file, 'utf8'), url, { direct: true });
}

function selectBriefings(manifest, articles, { today, isPublic = isDirectPublic, retired = loadRetired() } = {}) {
    if (typeof today !== 'string' || !T.isDay(today)) throw new Error('Briefing generation requires a valid publication day');
    validateManifest(manifest, { articles, retired });
    const byId = new Map(articles.map(article => [article.id, article]));
    return manifest.editions.slice().sort((a, b) => a.id < b.id ? 1 : a.id > b.id ? -1 : 0).map(edition => {
        const period = isoWeekPeriod(edition.id), reasons = [];
        const add = (code, detail) => reasons.push({ code, detail });
        if (edition.status !== 'published') add('status', `status is ${edition.status}`);
        if (edition.review.status !== 'approved') add('approval', 'human approval pending');
        else {
            if (edition.review.date > today) add('approval-date', `review date ${edition.review.date} is in the future`);
            if (edition.review.contentSha256 !== contentDigest(edition)) add('digest', 'content digest mismatch');
        }
        if (edition.revised > today) add('revised', `revised date ${edition.revised} is in the future`);
        const sections = edition.sections.map(section => ({ heading: section.heading,
            ...(own(section, 'intro') ? { intro: section.intro } : {}),
            items: section.items.map(item => edition.status === 'retired' ? { ...item } : {
                ...byId.get(item.articleId), rationale: item.rationale, ...(own(item, 'context') ? { context: item.context } : {}) }) }));
        const posts = sections.flatMap(section => section.items);
        if (edition.status !== 'retired') for (const post of posts) {
            if (!isPublishedArticle(post, today, isPublic)) add('member', `article ${post.id} is not public and published`);
        }
        const lastmod = [edition.revised, edition.review.date, ...(edition.status === 'retired' ? [] : posts.map(post => post.date))]
            .filter(date => typeof date === 'string' && T.isDay(date) && date <= today).sort().pop() || '';
        return { edition, period, sections, posts, lastmod, reasons, eligible: reasons.length === 0 };
    });
}

function publicBriefingFiles(inputs = loadBriefingInputs(), options = {}) {
    const selected = selectBriefings(inputs.manifest, inputs.articles, { today: T.athensDay(), ...options }).filter(item => item.eligible);
    return new Set(selected.length ? [BRIEFINGS_PATH.slice(1) + 'index.html',
        ...selected.map(item => editionPath(item.edition.id).slice(1) + 'index.html')] : []);
}

if (require.main === module) {
    try {
        let args = process.argv.slice(2);
        if (args[0] === '--validate' && args[1] === '--digest') args = args.slice(1);
        const inputs = loadBriefingInputs();
        if (args.length === 2 && args[0] === '--digest') {
            validateManifest(inputs.manifest, { articles: inputs.articles });
            const edition = inputs.manifest.editions.find(item => item.id === args[1]);
            if (!edition) throw new Error(`Unknown briefing: ${args[1]}`);
            console.log(contentDigest(edition));
        } else if (args[0] === '--validate' && (args.length === 1 || (args.length === 2 && args[1] === '--strict'))) {
            const selected = selectBriefings(inputs.manifest, inputs.articles, { today: T.athensDay() });
            for (const item of selected) console.log(`${item.edition.id} ${item.edition.status} eligible=${item.eligible ? 'yes' : 'no'} ${item.reasons.map(reason => `${reason.code}: ${reason.detail}`).join('; ')}`);
            if (args.includes('--strict') && selected.some(item => item.edition.status === 'published' && !item.eligible)) process.exitCode = 1;
        } else throw new Error('Usage: model.js --validate [--strict] | --digest <id>');
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { MANIFEST_FILE, BRIEFINGS_PATH, editionPath, GENERATED, loadBriefingInputs, isoWeekPeriod,
    validateManifest, contentDigest, isDirectPublic, selectBriefings, publicBriefingFiles };
