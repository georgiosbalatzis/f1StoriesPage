// The episode ON AIR leads with is never also a Journal story (P3A integration: Betcast #276 was both).
// Dates are in 2099 so these posts outrank whatever the real YouTube snapshot holds.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { featuredEpisode, isFeaturedEpisode } = require('../home-panels');
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

test('the featured episode is not the Journal lead; the next distinct story is', () => {
    const html = journalOf([cover, tech, bet, analysis, olderBet], { homeTech: 'tech' });
    assert.equal(linkCount(html, 'bet9999'), 0);
    assert.match(html.match(/<article class="pd-analysis[\s\S]*?<\/article>/)[0], /blog-entries\/analysis\//);
});

test('a future featured episode is excluded instead, and the previous one becomes eligible again', () => {
    const newer = post('bet10000', 'BetCast #10000: Next GP', '2099-01-10', 'Betting');
    const html = journalOf([newer, cover, tech, bet, analysis], { homeTech: 'tech' });
    assert.equal(linkCount(html, 'bet10000'), 0);
    // #9999 is no longer the ON AIR lead; the Journal's feature is the newest remaining story, not the cover.
    assert.match(html.match(/<article class="pd-analysis[\s\S]*?<\/article>/)[0], /blog-entries\/bet9999\//);
});

test('non-featured podcast articles stay eligible', () => {
    const html = journalOf([cover, tech, bet, olderBet], { homeTech: 'tech' });
    assert.equal(linkCount(html, 'bet9999'), 0);
    assert.match(html.match(/<article class="pd-analysis[\s\S]*?<\/article>/)[0], /blog-entries\/bet9998\//);
});

test('no story is shown twice and the build order is stable', () => {
    const posts = [cover, tech, bet, analysis, olderBet];
    const html = journalOf(posts, { homeTech: 'tech' });
    assert.equal(linkCount(html, 'cover'), 0);
    assert.equal(linkCount(html, 'tech'), 0);
    assert.ok(linkCount(html, 'analysis') >= 1);
    assert.equal(journalOf(posts, { homeTech: 'tech' }), html);
    assert.equal(journalOf([...posts].reverse(), { homeTech: 'tech' }), html);
});

test('a video of the same numbered series excludes its article too', () => {
    const snapshot = { videos: [{ id: 'abcdefghijk', title: 'BetCast #9999: Test GP', publishedAt: '2099-01-11T10:00:00Z' }] };
    const featured = featuredEpisode([bet, analysis], snapshot);
    assert.deepEqual(featured, { id: '', series: 'betcast #9999' });
    assert.equal(isFeaturedEpisode(bet, featured), true);
    assert.equal(isFeaturedEpisode(olderBet, featured), false);
    assert.equal(isFeaturedEpisode(analysis, featured), false);
});

test('missing episode metadata fails safe', () => {
    assert.equal(featuredEpisode([], { videos: [] }), null);
    assert.equal(featuredEpisode([{ id: 'x' }, { title: 'BetCast #1' }], null), null);
    assert.equal(isFeaturedEpisode(bet, null), false);
    assert.equal(isFeaturedEpisode(undefined, { id: 'a', series: '' }), false);
    assert.equal(isFeaturedEpisode({ id: 'b' }, { id: '', series: 'betcast #1' }), false);
    // An unnumbered video has no series: only an identical article id could match.
    const unnumbered = featuredEpisode([], { videos: [{ id: 'abcdefghijk', title: 'Season review', publishedAt: '2099-01-01T00:00:00Z' }] });
    assert.deepEqual(unnumbered, { id: '', series: '' });
    assert.equal(isFeaturedEpisode(bet, unnumbered), false);
});
