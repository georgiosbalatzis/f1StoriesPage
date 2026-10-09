// P3A Batch 2B: the homepage's technical spread. Which story it shows (an editor's `homeTech` pick, else the
// newest Technical story that is not the cover), that the Journal then skips it, the `homeImage: graphic`
// treatment, and the no-break reading time.
// The build has no draft or future-date state: every built article is published, so "not a published article"
// (an id absent from the index) is the only ineligible-by-publication case.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { selectHomeStories, renderHomeJournal, renderHomeTech, injectHomeJournal } = require('../index');
const { processBlogEntry } = require('../worker');
const { CONFIG } = require('../shared');

// Newest first, as the build orders them. c0 is the cover; t1, t3 and t9 are Technical.
const post = (id, date, category, extra = {}) => ({
    id, title: `Story ${id}`, author: 'Georgios Balatzis', date, categories: [category], excerpt: 'Excerpt.', readingTime: '4 min', ...extra
});
const posts = [
    post('c0', '2026-10-09', 'News'), post('t1', '2026-10-08', 'Technical'), post('n2', '2026-10-07', 'Analysis'),
    post('t3', '2026-10-06', 'Technical'), post('n4', '2026-10-05', 'News'), post('n5', '2026-10-04', 'Opinion'),
    post('n6', '2026-10-03', 'News'), post('n7', '2026-10-02', 'News'), post('n8', '2026-10-01', 'News'),
    post('t9', '2026-09-30', 'Technical'), post('n10', '2026-09-29', 'News')
];
const ids = list => list.map(item => item.id);
const FALLBACK = 't1';

test('with no pick the spread takes the newest Technical story that is not the cover', () => {
    const { cover, tech, journal, warnings } = selectHomeStories(posts, {});
    assert.equal(cover.id, 'c0');
    assert.equal(tech.id, FALLBACK);
    assert.deepEqual(warnings, []);
    assert.deepEqual(ids(journal), ['n2', 't3', 'n4', 'n5', 'n6', 'n7', 'n8']);
});

test('a missing, empty or absent selection is not a warning', () => {
    for (const selection of [undefined, null, {}, { homeTech: '' }, { homeTech: null }, { lead: 'n2' }]) {
        const { tech, warnings } = selectHomeStories(posts, selection);
        assert.equal(tech.id, FALLBACK);
        assert.deepEqual(warnings, []);
    }
});

test('a valid homeTech pick wins over a newer Technical story, and a pick is not overridden by recency', () => {
    for (const pick of ['t3', 't9']) {
        const { tech, warnings } = selectHomeStories(posts, { homeTech: pick });
        assert.equal(tech.id, pick);
        assert.deepEqual(warnings, []);
    }
    // Whitespace around the id is tolerated, like the Journal front's ids.
    assert.equal(selectHomeStories(posts, { homeTech: '  t3 ' }).tech.id, 't3');
});

test('an unknown pick warns and falls back to the newest eligible Technical story', () => {
    const { tech, warnings } = selectHomeStories(posts, { homeTech: 'deleted-story' });
    assert.equal(tech.id, FALLBACK);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /homeTech "deleted-story" is not a published article/);
});

test('a pick of the wrong category warns and falls back', () => {
    const { tech, warnings } = selectHomeStories(posts, { homeTech: 'n2' });
    assert.equal(tech.id, FALLBACK);
    assert.match(warnings[0], /homeTech "n2" is not a Technical story/);
});

test('a pick of the cover story warns and falls back', () => {
    const technicalCover = [post('c0', '2026-10-09', 'Technical'), ...posts.slice(1)];
    const { cover, tech, warnings } = selectHomeStories(technicalCover, { homeTech: 'c0' });
    assert.equal(cover.id, 'c0');
    assert.equal(tech.id, 't1');
    assert.match(warnings[0], /homeTech "c0" is already the homepage cover/);
});

test('a pick that is not one id warns and falls back', () => {
    for (const homeTech of [42, ['t3'], { id: 't3' }, true]) {
        const { tech, warnings } = selectHomeStories(posts, { homeTech });
        assert.equal(tech.id, FALLBACK);
        assert.match(warnings[0], /homeTech must be one article id/);
    }
});

test('a Technical cover never doubles as the spread', () => {
    const technicalCover = [post('c0', '2026-10-09', 'Technical'), ...posts.slice(1)];
    const { cover, tech, journal } = selectHomeStories(technicalCover, {});
    assert.equal(cover.id, 'c0');
    assert.equal(tech.id, 't1');
    assert.ok(!ids(journal).includes('c0'));
});

test('same-day Technical stories resolve by the build order, the same way on every run', () => {
    const sameDay = [
        post('c0', '2026-10-09', 'News'), post('tB', '2026-10-08', 'Technical'), post('tA', '2026-10-08', 'Technical'),
        post('n1', '2026-10-07', 'News')
    ];
    const first = selectHomeStories(sameDay, {});
    assert.equal(first.tech.id, 'tB');
    assert.deepEqual(selectHomeStories(sameDay, {}), first);
    // The id does not break the tie: the build's order (publish-order.js) does.
    assert.equal(selectHomeStories([sameDay[0], sameDay[2], sameDay[1], sameDay[3]], {}).tech.id, 'tA');
});

test('with no Technical story there is no spread and the Journal still fills', () => {
    const none = posts.filter(item => item.categories[0] !== 'Technical');
    const { tech, journal, warnings } = selectHomeStories(none, {});
    assert.equal(tech, null);
    assert.deepEqual(warnings, []);
    assert.deepEqual(ids(journal), ['n2', 'n4', 'n5', 'n6', 'n7', 'n8', 'n10']);
    assert.equal(selectHomeStories([], {}).cover, null);
});

test('the Journal skips the spread story and keeps its seven stories (lead, two side, four recent)', () => {
    const fallback = selectHomeStories(posts, {});
    assert.ok(!ids(fallback.journal).includes(fallback.tech.id));
    assert.equal(fallback.journal.length, 7);
    // A pick that would have sat inside the Journal window leaves it, and the Journal reaches one story further.
    const picked = selectHomeStories(posts, { homeTech: 't3' });
    assert.deepEqual(ids(picked.journal), ['t1', 'n2', 'n4', 'n5', 'n6', 'n7', 'n8']);
    // A pick outside the window changes nothing in the Journal.
    assert.deepEqual(ids(selectHomeStories(posts, { homeTech: 't9' }).journal), ['t1', 'n2', 't3', 'n4', 'n5', 'n6', 'n7']);
});

test('no story appears twice across the cover, the spread and the Journal, and the input is untouched', () => {
    const before = JSON.stringify(posts);
    for (const selection of [{}, { homeTech: 't3' }, { homeTech: 't9' }, { homeTech: 'n2' }, { homeTech: 'c0' }]) {
        const { cover, tech, journal } = selectHomeStories(posts, selection);
        const shown = [cover, tech, ...journal].filter(Boolean).map(item => item.id);
        assert.equal(new Set(shown).size, shown.length);
        assert.deepEqual(selectHomeStories(posts, selection), selectHomeStories(posts, selection));
    }
    assert.equal(JSON.stringify(posts), before);
});

test('a short archive keeps what it has, with no story repeated', () => {
    const { tech, journal } = selectHomeStories(posts.slice(0, 4), {});
    assert.equal(tech.id, 't1');
    assert.deepEqual(ids(journal), ['n2', 't3']);
});

test('the rendered Journal does not contain the spread story', () => {
    const { tech, journal } = selectHomeStories(posts, { homeTech: 't3' });
    const html = renderHomeJournal(journal, '');
    assert.doesNotMatch(html, new RegExp(`blog-entries/${tech.id}/`));
    assert.match(html, /blog-entries\/t1\//);
    assert.equal((html.match(/class="home-ledger__item"/g) || []).length, 4);
});

// A story whose card image ships in the repo, so storyImage() renders the figure.
const techStory = { id: '20261006F', title: 'Γιατί το νέο πάτωμα', author: 'F1 Stories', date: '2026-10-06', categories: ['Technical'], readingTime: '5 min', thumbnail: '/blog-module/blog-entries/20261006F/1-card.webp', thumbnailWidth: 400, thumbnailHeight: 267 };

test('the spread keeps the photograph composition unless the story is flagged as graphic', () => {
    const photo = renderHomeTech(techStory, 'Dek.', '', 'Mercedes');
    assert.match(photo, /<div class="tech-stage" data-kind="technical">/);
    assert.doesNotMatch(photo, /no-cross/);
    assert.match(photo, /<figure class="tech-photo">/);
    const graphic = renderHomeTech(techStory, 'Dek.', '', 'Mercedes', { graphic: true });
    assert.match(graphic, /<div class="tech-stage tech-stage--no-cross" data-kind="technical">/);
    // Only the class differs.
    assert.equal(graphic.replace(' tech-stage--no-cross', ''), photo);
    assert.equal(renderHomeTech(techStory, 'Dek.', '', 'Mercedes', {}), photo);
});

test('the spread keeps number and unit together in its reading time', () => {
    const html = renderHomeTech(techStory, 'Dek.', '', 'Mercedes');
    assert.match(html, /<span>5 ΛΕΠΤΑ<\/span>/);
    assert.doesNotMatch(html, /\d ΛΕΠΤΑ/);
    assert.match(renderHomeTech({ ...techStory, readingTime: '1 min' }, '', '', ''), /<span>1 ΛΕΠΤΟ<\/span>/);
    // No reading time, no empty span.
    assert.doesNotMatch(renderHomeTech({ ...techStory, readingTime: '' }, '', '', ''), /<span>\s*<\/span>/);
});

test('front matter `homeImage: graphic` reaches the post, and only that value does', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-home-image-'));
    const originalBlogDir = CONFIG.BLOG_DIR;
    const built = async (slug, line) => {
        const entryDir = path.join(tempDir, slug);
        fs.mkdirSync(entryDir, { recursive: true });
        fs.writeFileSync(path.join(entryDir, 'source.txt'), ['---', 'category: Technical', 'title: A technical story', ...(line ? [line] : []), '---', '', 'Body paragraph for the home image contract.'].join('\n'), 'utf8');
        return processBlogEntry(entryDir);
    };
    try {
        CONFIG.BLOG_DIR = tempDir;
        assert.equal((await built('20261101W', 'homeImage: graphic')).homeImage, 'graphic');
        assert.equal((await built('20261102W', 'homeImage: Graphic')).homeImage, 'graphic');
        for (const [slug, line] of [['20261103W', ''], ['20261104W', 'homeImage: photo'], ['20261105W', 'homeImage: true'], ['20261106W', 'homeimage: graphic']]) {
            assert.ok(!('homeImage' in await built(slug, line)), line || 'no flag');
        }
    } finally {
        CONFIG.BLOG_DIR = originalBlogDir;
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('an empty eligible Technical pool clears the previous spread, and a later build restores it', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-home-tech-empty-'));
    const originalBlogDir = CONFIG.BLOG_DIR;
    const homepage = path.join(tempDir, 'index.html');
    try {
        CONFIG.BLOG_DIR = path.join(tempDir, 'blog-module', 'blog-entries');
        fs.writeFileSync(homepage, '<!-- f1s:home-journal:begin -->old Journal<!-- f1s:home-journal:end -->\n<section id="tech" class="home-tech" aria-labelledby="tech-heading"><!-- f1s:home-tech:begin -->stale feature<!-- f1s:home-tech:end --></section>');
        const none = posts.filter(item => item.categories[0] !== 'Technical');
        assert.equal(injectHomeJournal(none, none), true);
        const empty = fs.readFileSync(homepage, 'utf8');
        assert.doesNotMatch(empty, /stale feature/);
        assert.match(empty, /<section id="tech" hidden /);
        assert.equal(injectHomeJournal(none, none), false);
        const eligible = [posts[0], techStory, ...none.slice(1)];
        assert.equal(injectHomeJournal(eligible, eligible), true);
        const restored = fs.readFileSync(homepage, 'utf8');
        assert.match(restored, /<section id="tech" class=/);
        assert.match(restored, /id="tech-heading"/);
        assert.match(restored, /20261006F\/article.html/);
        assert.equal(injectHomeJournal(eligible, eligible), false);
    } finally {
        CONFIG.BLOG_DIR = originalBlogDir;
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
