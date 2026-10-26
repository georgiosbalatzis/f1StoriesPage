// The current article URL contract (docs/search/article-url-policy.md): every published article lives at
// /blog-module/blog-entries/<folder id>/article.html and every surface names that one address.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { renderSitemap } = require('../sitemap');
const { renderFeed } = require('../feed');
const { route } = require('../discovery');
const { articleUrl } = require('../entities/hubs');
const { athensDay } = require('../../taxonomy');

const SITE = 'https://f1-stories.gr';
const ROOT = path.resolve(__dirname, '../../..');
const DIST = path.join(ROOT, 'dist');
const GREEK_IDS = ['20260227Τ', '20261101Λ']; // Greek capital Tau (a real folder) and Lambda
const legacy = id => `${SITE}/blog-module/blog-entries/${encodeURIComponent(id)}/article.html`;
const post = (id, extra = {}) => ({ id, date: '2026-10-20', title: 'Ιστορίες Formula 1', excerpt: 'Ανάλυση.',
    author: 'Themis Charvalis', categories: ['History'], url: `/blog-module/blog-entries/${id}/article.html`, ...extra });
const locs = xml => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(match => match[1]);
const feedItems = xml => [...xml.matchAll(/<link>([^<]*)<\/link>\s*<guid isPermaLink="true">([^<]*)<\/guid>/g)]
    .map(([, link, guid]) => ({ link, guid }));
const now = new Date('2026-10-21T12:00:00Z');

test('fixtures: every producer derives the same legacy URL from the folder id, Greek ids included', () => {
    const posts = ['20261020W', '20261020-2W', '20250505GF', ...GREEK_IDS].map(id => post(id));
    const sitemap = locs(renderSitemap(posts, [], { today: '2026-10-21' })).filter(loc => loc.includes('/blog-entries/'));
    const feed = feedItems(renderFeed(posts, { now }));
    for (const { id } of posts) {
        const url = legacy(id);
        assert.equal(articleUrl(post(id)), url, `${id}: hub and author links`);
        assert.equal(new URL(route.story(post(id)), SITE).href, url, `${id}: discovery links`);
        assert.equal(sitemap.filter(loc => loc === url).length, 1, `${id}: sitemap once, written exactly as the canonical`);
        assert.deepEqual(feed.filter(item => item.link === url), [{ link: url, guid: url }], `${id}: RSS link and GUID`);
    }
    assert.equal(legacy(GREEK_IDS[0]), `${SITE}/blog-module/blog-entries/20260227%CE%A4/article.html`);
    assert.notEqual(legacy(GREEK_IDS[0]), legacy('20260227T'), 'Tau is not Latin T');
});

test('fixtures: identity never comes from the title', () => {
    const urls = posts => [locs(renderSitemap(posts, [], { today: '2026-10-21' })), feedItems(renderFeed(posts, { now }))];
    assert.deepEqual(urls([post('20261020W', { title: 'Πρώτος τίτλος' })]), urls([post('20261020W', { title: 'Διορθωμένος τίτλος' })]));
    const sameTitle = feedItems(renderFeed([post('20261013D'), post('20261020D')], { now })).map(item => item.guid);
    assert.deepEqual(sameTitle.sort(), [legacy('20261013D'), legacy('20261020D')]);
});

// The built site (CI runs npm run build:public before these tests).
function built(t) {
    if (fs.existsSync(path.join(DIST, 'sitemap.xml'))) return true;
    assert.ok(!process.env.CI, 'dist/ is missing: run npm run build:public');
    t.skip('no dist/ (run npm run build:public)');
    return false;
}
let cache;
function site() {
    if (cache) return cache;
    const entries = path.join(DIST, 'blog-module/blog-entries');
    const ids = fs.readdirSync(entries).filter(id => fs.existsSync(path.join(entries, id, 'article.html')));
    const pages = new Map(ids.map(id => [id, fs.readFileSync(path.join(entries, id, 'article.html'), 'utf8')]));
    const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'blog-module/blog-source-cache.json'), 'utf8')).posts;
    const sitemap = locs(fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8'));
    const feed = feedItems(fs.readFileSync(path.join(DIST, 'feed.xml'), 'utf8'));
    return (cache = { ids, pages, posts, sitemap, feed });
}
const tagValue = (html, pattern) => [...html.matchAll(pattern)].map(match => match[1]);
const nodes = html => tagValue(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
    .flatMap(block => { const data = JSON.parse(block); return data['@graph'] || [data]; });
const ref = value => typeof value === 'string' ? value : value && (value['@id'] || value.url);

test('artifact: one legacy page per published article, and only those', t => {
    if (!built(t)) return;
    const { ids, posts } = site();
    assert.ok(ids.length > 0);
    assert.deepEqual(ids.slice().sort(), posts.map(p => p.id).sort(), 'pages and published posts are the same set');
    for (const id of ids) assert.match(id, /^[\p{L}\p{N}_-]+$/u, `${id}: folder id`);
    assert.ok(ids.includes(GREEK_IDS[0]), 'the Greek-id article is still published at its legacy URL');
});

test('artifact: canonical, og:url, JSON-LD and breadcrumb name the page itself', t => {
    if (!built(t)) return;
    for (const [id, html] of site().pages) {
        const url = legacy(id);
        assert.deepEqual(tagValue(html, /<link rel="canonical" href="([^"]*)">/g), [url], `${id}: canonical`);
        assert.deepEqual(tagValue(html, /<meta property="og:url" content="([^"]*)">/g), [url], `${id}: og:url`);
        const graph = nodes(html);
        const article = graph.filter(node => /^(?:News)?Article$/.test(node['@type']));
        assert.equal(article.length, 1, `${id}: one Article node`);
        assert.equal(ref(article[0].mainEntityOfPage), url, `${id}: mainEntityOfPage`);
        if (article[0].url !== undefined) assert.equal(article[0].url, url, `${id}: Article url`);
        const crumbs = graph.find(node => node['@type'] === 'BreadcrumbList').itemListElement;
        assert.equal(ref(crumbs[crumbs.length - 1].item), url, `${id}: breadcrumb`);
    }
});

test('artifact: the sitemap lists each article exactly once and RSS GUIDs are the canonical URLs', t => {
    if (!built(t)) return;
    const { ids, sitemap, feed } = site();
    const articles = sitemap.filter(loc => loc.includes('/blog-entries/'));
    assert.deepEqual(articles.slice().sort(), ids.map(legacy).sort());
    assert.ok(feed.length > 0);
    for (const item of feed) {
        assert.equal(item.guid, item.link);
        assert.ok(ids.map(legacy).includes(item.link), `${item.link}: RSS item is a published page`);
    }
});

test('artifact: nothing unreleased or future-dated is public', t => {
    if (!built(t)) return;
    const today = athensDay();
    for (const p of site().posts) {
        assert.ok(p.date <= today, `${p.id}: dated ${p.date}, after ${today}; keep it off main until then (docs/rss-feed.md)`);
        assert.ok(![true, 'true'].includes(p.draft) && ![false, 'false'].includes(p.published)
            && (!p.status || p.status === 'published'), `${p.id}: not released`);
    }
});

test('artifact: same-title articles keep separate identities', t => {
    if (!built(t)) return;
    const byTitle = new Map();
    for (const p of site().posts) byTitle.set(p.title.trim(), [...(byTitle.get(p.title.trim()) || []), p.id]);
    for (const ids of byTitle.values()) {
        const canonicals = ids.map(id => tagValue(site().pages.get(id), /<link rel="canonical" href="([^"]*)">/g)[0]);
        assert.equal(new Set(canonicals).size, ids.length, `${ids.join(', ')}: one URL each`);
    }
});

test('artifact: author, section and topic links on articles reach published pages', t => {
    if (!built(t)) return;
    const targets = new Set();
    for (const html of site().pages.values()) {
        for (const href of tagValue(html, /href="((?:https:\/\/f1-stories\.gr)?\/(?:authors|blog-module\/blog\/(?:section|entities))\/[^"#?]*)"/g)) {
            targets.add(new URL(href, SITE).pathname);
        }
    }
    assert.ok(targets.size > 0);
    for (const pathname of targets) {
        const file = path.join(DIST, decodeURIComponent(pathname), pathname.endsWith('/') ? 'index.html' : '');
        assert.ok(fs.existsSync(file), `${pathname}: linked from an article but not published`);
    }
});

test('entity evidence stays anchored to the article folder it describes', () => {
    const { associations } = JSON.parse(fs.readFileSync(path.join(__dirname, '../entities/associations.json'), 'utf8'));
    assert.ok(associations.length > 0);
    for (const item of associations) {
        const evidence = item.evidence.path;
        assert.equal(evidence.normalize('NFC'), evidence);
        assert.ok([`blog-module/blog-entries/${item.articleId}/source.txt`, `blog-module/blog-entries/${item.articleId}/article.html`]
            .includes(evidence), `${item.articleId}: evidence ${evidence}`);
        assert.ok(fs.existsSync(path.join(ROOT, evidence)), `${evidence}: missing`);
    }
});

test('artifact: nothing is published or linked under /stories/', t => {
    if (!built(t)) return;
    assert.ok(!fs.existsSync(path.join(DIST, 'stories')));
    assert.ok(!site().sitemap.some(loc => new URL(loc).pathname.startsWith('/stories/')));
    for (const html of site().pages.values()) assert.ok(!/href="(?:https:\/\/f1-stories\.gr)?\/stories\//.test(html));
});
