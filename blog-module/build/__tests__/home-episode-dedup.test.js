// All three Cast articles and duplicate editions stay out of the Journal and supporting cover frames.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { selectCastArticles, isCastArticle } = require('../home-panels');
const { injectHomeJournal } = require('../index');
const { CONFIG } = require('../shared');

const post = (id, title, date, category) => ({ id, title, date, categories: [category], url: `/blog-module/blog-entries/${id}/article.html` });
const newestFirst = posts => [...posts].sort((a, b) => b.date.localeCompare(a.date));

function journalOf(posts, selection = {}) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-dedup-'));
    const original = CONFIG.BLOG_DIR;
    try {
        CONFIG.BLOG_DIR = path.join(temp, 'blog-module', 'blog-entries');
        fs.mkdirSync(CONFIG.BLOG_DIR, { recursive: true });
        const htmlPath = path.join(temp, 'index.html');
        fs.writeFileSync(htmlPath, '<!-- f1s:home-journal:begin --><!-- f1s:home-journal:end -->'
            + '<!-- f1s:home-cover-frames:begin --><!-- f1s:home-cover-frames:end -->'
            + '<section id="tech"><!-- f1s:home-tech:begin --><!-- f1s:home-tech:end --></section>');
        const sorted = newestFirst(posts);
        injectHomeJournal(sorted, sorted, selection);
        // The Journal and the cover frames: everything the home-tech spread does not render.
        return fs.readFileSync(htmlPath, 'utf8').replace(/<section id="tech">[\s\S]*?<\/section>/, '');
    } finally {
        CONFIG.BLOG_DIR = original;
        fs.rmSync(temp, { recursive: true, force: true });
    }
}

const cover = post('cover', 'Cover story', '2099-01-12', 'News');
const tech = post('tech', 'Technical story', '2099-01-08', 'Technical');
const bet = post('bet9999', 'BetCast #9999: Test GP', '2099-01-07', 'Betting');
const analysis = post('analysis', 'Analysis story', '2099-01-06', 'Analysis');
const olderBet = post('bet9998', 'BetCast #9998: Earlier GP', '2099-01-05', 'Betting');
const linkCount = (html, id) => (html.match(new RegExp(`blog-entries/${id}/article\\.html`, 'g')) || []).length;

test('all three Cast articles are excluded across categories; the next story leads the Journal', () => {
    const grid = post('grid2', 'GRIDCAST #02 : Singapore - Ανάλυση', '2099-01-09', 'Analysis');
    const analyst = post('analyst1', 'AnalystCast #1: Test GP', '2099-01-10', 'Opinion');
    const html = journalOf([cover, tech, bet, grid, analyst, analysis], { homeTech: 'tech' });
    for (const item of [cover, tech, bet, grid, analyst]) assert.equal(linkCount(html, item.id), 0);
    assert.match(html.match(/<article class="pd-analysis[\s\S]*?<\/article>/)[0], /blog-entries\/analysis\//);
});

test('a new Cast article enters automatically and the fourth becomes Journal eligible', () => {
    const grid = post('grid2', 'GridCast #2: GP', '2099-01-09', 'Analysis');
    const analyst = post('analyst1', 'AnalystCast #1: GP', '2099-01-10', 'Opinion');
    const posts = [cover, tech, bet, grid, analyst, analysis];
    assert.equal(linkCount(journalOf(posts), bet.id), 0);
    const newer = post('bet10000', 'BetCast #10000: Next GP', '2099-01-11', 'Betting');
    const html = journalOf([newer, ...posts]);
    assert.equal(linkCount(html, newer.id), 0);
    assert.match(html.match(/<article class="pd-analysis[\s\S]*?<\/article>/)[0], /blog-entries\/bet9999\//);
});

test('duplicate editions of the displayed articles are excluded, including legacy punctuation', () => {
    const duplicate = post('duplicate', 'BETCAST: 09999 — Same GP', '2099-01-06', 'Analysis');
    const html = journalOf([cover, tech, bet, duplicate, analysis]);
    assert.equal(linkCount(html, bet.id), 0);
    assert.equal(linkCount(html, duplicate.id), 0);
    const selected = selectCastArticles(newestFirst([bet, duplicate, olderBet]));
    assert.equal(isCastArticle(duplicate, selected), true);
    assert.equal(isCastArticle(analysis, selected), false);
    assert.equal(isCastArticle(undefined, selected), false);
    assert.equal(isCastArticle(bet), false);
});

test('Journal and cover frames render deterministically without changing cover or Technical picks', () => {
    const posts = [cover, tech, bet, analysis, olderBet];
    const html = journalOf(posts, { homeTech: 'tech' });
    for (const id of ['cover', 'tech', bet.id, olderBet.id]) assert.equal(linkCount(html, id), 0);
    assert.ok(linkCount(html, 'analysis') >= 1);
    assert.equal(journalOf(posts, { homeTech: 'tech' }), html);
    assert.equal(journalOf([...posts].reverse(), { homeTech: 'tech' }), html);
});
