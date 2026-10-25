const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const T = require('../../taxonomy');
const { buildModel, buildPages, composePage, writeDiscoveryPages, route, sectionPageCount, monthGroups, leadHtml, SITE, headHtml } = require('../discovery');

const REPO = path.resolve(__dirname, '..', '..', '..');
const deps = {
    storyImage: post => post.thumbnail || '',
    renderStoryImage: (post, image) => `<img src="${image}" alt="">`
};
const post = (id, date, categories = ['News'], extra = {}) => ({
    id, title: `Story ${id}`, author: 'Georgios Balatzis', date, categories, excerpt: `About ${id}.`, readingTime: '4 min', thumbnail: '', ...extra
});
// A quarter of stories, newest first, one a day, rotating through four categories.
const CATEGORIES = [['News'], ['Technical'], ['History', 'Drivers'], ['Opinion']];
const synthetic = (count, from = '2026-10-12') => Array.from({ length: count }, (_, index) => post(`s${index}`, T.addDays(from, -index), CATEGORIES[index % 4]));
const build = (posts, options = {}) => buildPages(posts, { today: '2026-10-12', deps, ...options });
const byFile = result => Object.fromEntries(result.pages.map(page => [page.file, page]));
const links = html => new Set([...html.matchAll(/href="\/blog-module\/blog-entries\/([^/"]+)\/article\.html"/g)].map(match => match[1]));

test('approved topic navigation follows the category table inside the unfiltered journal only', () => {
    const topic = { href: '/blog-module/blog/entities/drivers/lando-norris/', label: 'Λάντο Νόρις', count: 4 };
    const baseline = build(synthetic(40));
    const result = build(synthetic(40), { hubLinks: [topic] });
    const html = result.pages[0].main;
    const block = html.match(/<nav class="ed-aside__block" aria-labelledby="ed-topics-title">[\s\S]*?<\/nav>/)[0];
    assert.match(block, /<h2 class="ed-label" id="ed-topics-title">Θέματα<\/h2><ul/);
    assert.ok(block.includes(`<li><a href="${topic.href}"><span>Λάντο Νόρις</span><span class="ed-num">4 άρθρα</span></a></li>`));
    assert.equal(html.split(`href="${topic.href}"`).length - 1, 1);
    assert.ok(html.includes(`</ol></section>${block}`), 'directly after the category table');
    assert.ok(html.indexOf(block) > html.indexOf('id="journal-edition"'));
    assert.ok(html.indexOf(block) < html.indexOf('id="journal-archive"'));
    assert.equal(html.replace(block, ''), baseline.pages[0].main, 'the block is the only archive change');
    assert.deepEqual(result.pages.slice(1), baseline.pages.slice(1), 'other discovery pages are unchanged');
    const css = fs.readFileSync(path.join(REPO, 'blog-module/blog/archive-editorial.css'), 'utf8');
    assert.match(css, /html\[data-journal-filtered\] \.edition #journal-edition \{ display: none; \}/);
});

test('zero approved topics omits the entire navigation landmark and heading', () => {
    for (const options of [{}, { hubLinks: [] }]) {
        assert.doesNotMatch(build(synthetic(4), options).pages[0].main, /ed-topics-title|Θέματα/);
    }
});

test('multiple topics are deduplicated and ordered by canonical route without mutating descriptors', () => {
    const a = { href: '/blog-module/blog/entities/drivers/a/', label: 'A', count: 3 };
    const z = { href: '/blog-module/blog/entities/teams/z/', label: 'Z', count: 5 };
    const hubLinks = [z, a, z];
    const before = JSON.stringify(hubLinks);
    const first = build(synthetic(4), { hubLinks }).pages[0].main;
    const second = build(synthetic(4), { hubLinks: [a, z, a] }).pages[0].main;
    assert.equal(first, second);
    assert.ok(first.indexOf(`href="${a.href}"`) < first.indexOf(`href="${z.href}"`));
    assert.equal(first.split(`href="${z.href}"`).length - 1, 1);
    assert.equal(JSON.stringify(hubLinks), before);
});

test('a section lists an approved topic only when one of its approved stories is in that section', () => {
    // synthetic(8): s0, s4 News · s1, s5 Technical · s2, s6 History+Drivers · s3, s7 Opinion.
    const topic = { href: '/blog-module/blog/entities/drivers/lando-norris/', label: 'Λάντο Νόρις', count: 2, articleIds: ['s2', 's4'] };
    const baseline = byFile(build(synthetic(8)));
    const result = byFile(build(synthetic(8), { hubLinks: [topic] }));
    const block = html => (html.match(/<nav class="ed-aside__block" aria-labelledby="ed-topics-title">[\s\S]*?<\/nav>/) || [''])[0];
    for (const kind of ['news', 'history', 'drivers']) {
        const html = result[`section/${kind}/index.html`].main;
        assert.ok(block(html).includes(`<li><a href="${topic.href}"><span>Λάντο Νόρις</span><span class="ed-num">2 άρθρα</span></a></li>`), kind);
        assert.equal(html.split(`href="${topic.href}"`).length - 1, 1, `${kind}: linked once`);
        assert.ok(html.includes(`</ol></nav>${block(html)}<p class="ed-aside__block">`), `${kind}: between the other sections and the archive link`);
        assert.equal(html.replace(block(html), ''), baseline[`section/${kind}/index.html`].main, `${kind}: the block is the only change`);
    }
    for (const kind of ['technical', 'opinion']) {
        assert.equal(result[`section/${kind}/index.html`].main, baseline[`section/${kind}/index.html`].main, `${kind}: no approved story, no topic`);
    }
    for (const [file, page] of Object.entries(result)) if (file.startsWith('archive/')) assert.equal(page.main, baseline[file].main, file);
});

test('a topic without approved story ids stays on the blog index only', () => {
    const topic = { href: '/blog-module/blog/entities/drivers/lando-norris/', label: 'Λάντο Νόρις', count: 4 };
    const baseline = build(synthetic(8));
    const result = build(synthetic(8), { hubLinks: [topic] });
    assert.deepEqual(result.pages.slice(1), baseline.pages.slice(1));
});

test('topic navigation escapes dynamic labels and attributes', () => {
    const html = build(synthetic(4), { hubLinks: [{ href: '/subject/"<&', label: '<Νόρις> & "οδηγός"', count: 4 }] }).pages[0].main;
    assert.match(html, /href="\/subject\/&quot;&lt;&amp;"/);
    assert.match(html, /<span>&lt;Νόρις&gt; &amp; &quot;οδηγός&quot;<\/span>/);
    assert.doesNotMatch(html, /<Νόρις>/);
});

// The real archive, from the committed compact index (the same data the browser loads).
function realPosts() {
    const data = JSON.parse(fs.readFileSync(path.join(REPO, 'blog-module', 'blog-index-data.json'), 'utf8'));
    return data.p.map(row => ({
        id: row[0], title: row[1], author: data.a[row[2]], date: row[3], excerpt: row[6], readingTime: row[7],
        categories: row[8].map(index => data.c[index]), thumbnail: `/blog-module/blog-entries/${row[0]}/1-card.webp`
    }));
}

// ── The week, the lead and ΝΕΟ ───────────────────────────
test('the week is the seven days ending on the newest published story', () => {
    const model = buildModel(synthetic(12), '2026-10-12');
    assert.equal(model.reference, '2026-10-12');
    assert.equal(model.weekFrom, '2026-10-06');
    assert.deepEqual(model.week.map(item => item.id), ['s0', 's1', 's2', 's3', 's4', 's5', 's6']);
});

test('the week lead falls back to the newest story without a selection', () => {
    const model = buildModel(synthetic(12), '2026-10-12', {});
    assert.equal(model.lead.id, 's0');
    assert.deepEqual(model.warnings, []);
});

test('an editor-selected lead leads the week; unknown or out-of-week ids are dropped with a warning', () => {
    const posts = synthetic(12);
    assert.equal(buildModel(posts, '2026-10-12', { lead: 's4' }).lead.id, 's4');
    const unknown = buildModel(posts, '2026-10-12', { lead: 'deleted-story' });
    assert.equal(unknown.lead.id, 's0');
    assert.equal(unknown.warnings.length, 1);
    const old = buildModel(posts, '2026-10-12', { lead: 's10' });
    assert.equal(old.lead.id, 's0');
    assert.match(old.warnings[0], /not one of the week's stories/);
    assert.equal(buildModel(posts, '2026-10-12', { lead: '' }).warnings.length, 0);
});

test('ΝΕΟ marks only stories of the last seven days, never a featured position', () => {
    const posts = [post('fresh', '2026-10-12'), post('edge', '2026-10-06'), post('old', '2026-10-05'), post('older', '2026-09-01')];
    const index = build(posts).pages[0].main;
    const marks = html => [...html.matchAll(/ed-new" data-new-until="([^"]+)">ΝΕΟ/g)].length;
    assert.equal(marks(index), 2, 'fresh and edge');
    assert.match(index, /data-new-until="2026-10-18">ΝΕΟ/);
    // The build reads no clock: marks are relative to the newest story, so the HTML is a pure function of the data.
    // A page cached past the window loses them in the browser: the rule it applies says the story is no longer NEW.
    const quiet = build([post('quiet', '2026-09-01'), post('quieter', '2026-08-20')]);
    assert.match(quiet.pages[0].main, /data-new-until="2026-09-07">ΝΕΟ/);
    assert.equal(marks(quiet.pages[0].main), 1, 'only the story inside the window, not the second one for being second');
    assert.equal(T.isNewStory('2026-09-01', '2026-10-12'), false);
});

test('a future-dated story is neither NEW, nor the reference, nor in a month page', () => {
    const posts = [post('future', '2026-10-30'), post('now', '2026-10-12'), post('bad', '2026-02-31'), post('none', ''), post('earlier', '2026-10-01')];
    const model = buildModel(posts, '2026-10-12');
    assert.equal(model.reference, '2026-10-12');
    assert.deepEqual(model.monthKeys, ['2026-10']);
    assert.deepEqual(model.months.get('2026-10').map(item => item.id), ['now', 'earlier']);
    const { pages } = build(posts);
    assert.ok(!pages.some(page => page.path === route.month('2026-02')), 'no page for an impossible month');
    assert.ok(!links(pages.find(page => page.path === route.month('2026-10')).main).has('future'), 'no future story in the month');
    assert.ok(!links(pages[0].main).has('future'), 'nor on the front page');
    assert.equal((pages[0].main.match(/ed-new"/g) || []).length, 1, 'only "now" is NEW: not the future story, not the one outside the week');
});

test('build output is a pure function of the data (deterministic)', () => {
    const posts = realPosts();
    const first = build(posts);
    const second = build(posts);
    assert.deepEqual(first.pages.map(page => [page.file, page.head, page.main]), second.pages.map(page => [page.file, page.head, page.main]));
});

// ── Sections ─────────────────────────────────────────────
test('sections come from the taxonomy: only categories with stories, counted with secondary categories', () => {
    const posts = synthetic(40);
    const model = buildModel(posts, '2026-10-12');
    assert.deepEqual(model.sections.map(section => section.name), ['News', 'Technical', 'History', 'Opinion', 'Drivers'].sort((a, b) => T.PUBLIC_CATEGORIES.indexOf(a) - T.PUBLIC_CATEGORIES.indexOf(b)));
    assert.equal(model.sections.find(section => section.name === 'Drivers').posts.length, 10, 'a secondary category counts');
    assert.equal(model.sections.find(section => section.name === 'History').posts.length, 10);
    assert.ok(!model.sections.some(section => section.name === 'Betting'), 'an empty category gets no page');
});

test('a section is paginated into stable, disjoint pages that cover every story once', () => {
    const posts = Array.from({ length: 75 }, (_, index) => post(`n${index}`, T.addDays('2026-10-12', -index)));
    const result = build(posts);
    const files = byFile(result);
    const section = result.model.sections[0];
    assert.equal(sectionPageCount(section), 3, '4 on the front + 30 + 30 + 11');
    assert.ok(files['section/news/index.html'] && files['section/news/page/2/index.html'] && files['section/news/page/3/index.html']);
    assert.ok(!files['section/news/page/1/index.html'] && !files['section/news/page/4/index.html'], 'no duplicate first page, no empty page');
    const seen = [];
    for (const file of ['section/news/index.html', 'section/news/page/2/index.html', 'section/news/page/3/index.html']) seen.push(...links(files[file].main));
    assert.equal(new Set(seen).size, seen.length, 'a story appears on one page of the section only');
    assert.deepEqual(seen, posts.map(item => item.id), 'in order, none missing');
    assert.equal(links(files['section/news/index.html'].main).size, 4 + 30);
    // The list's range counts its own rows; the front's four stories are named as sitting above it.
    assert.match(files['section/news/index.html'].main, /ed-sechead__note ed-num">5–34 από 75 · 1–4 παραπάνω</);
    assert.match(files['section/news/page/2/index.html'].main, /ed-sechead__note ed-num">35–64 από 75</);
    assert.match(files['section/news/page/3/index.html'].main, /ed-sechead__note ed-num">65–75 από 75</);
    // Pager: current page is not a link; prev/next are real links with rel.
    assert.match(files['section/news/page/2/index.html'].main, /aria-current="page"><span class="visually-hidden">Σελίδα <\/span>2</);
    assert.match(files['section/news/page/2/index.html'].main, /rel="prev" href="\/blog-module\/blog\/section\/news\/"/);
    assert.match(files['section/news/page/2/index.html'].main, /rel="next" href="\/blog-module\/blog\/section\/news\/page\/3\/"/);
    assert.match(files['section/news/page/3/index.html'].main, /class="ed-pages__step is-off">Παλαιότερες/);
});

test('a sparse section is one page that leads with all of its stories', () => {
    const result = build([post('a', '2026-10-12', ['Betting']), post('b', '2026-10-11', ['Betting']), post('c', '2026-10-01')]);
    const files = byFile(result);
    assert.ok(files['section/betting/index.html']);
    assert.equal(links(files['section/betting/index.html'].main).size, 2);
    assert.doesNotMatch(files['section/betting/index.html'].main, /ed-pages|id="articles-grid"/);
});

// ── Months and the archive ───────────────────────────────
test('month pages exist only for months with published stories, newest first, with prev/next', () => {
    const posts = [post('a', '2026-10-02'), post('b', '2026-10-01'), post('c', '2026-08-15'), post('d', '2026-02-03')];
    const result = build(posts);
    const files = byFile(result);
    assert.deepEqual(Object.keys(files).filter(file => file.startsWith('archive/')).sort(),
        ['archive/2026/02/index.html', 'archive/2026/08/index.html', 'archive/2026/10/index.html', 'archive/index.html']);
    const october = files['archive/2026/10/index.html'].main;
    assert.ok(october.indexOf('Story a') < october.indexOf('Story b'), 'newest first');
    assert.match(october, /2 ιστορίες αυτόν τον μήνα/);
    // Neighbours skip the empty months (March to July have none).
    assert.match(files['archive/2026/08/index.html'].main, /href="\/blog-module\/blog\/archive\/2026\/10\/"><span>Νεότερος<\/span>Οκτώβριος 2026/);
    assert.match(files['archive/2026/08/index.html'].main, /href="\/blog-module\/blog\/archive\/2026\/02\/"><span>Παλαιότερος<\/span>Φεβρουάριος 2026/);
    assert.doesNotMatch(october, /<span>Νεότερος<\/span>/, 'the newest month has nothing newer');
    assert.ok(!files['archive/2026/03/index.html']);
});

test('month rows group by month, carry the category signal and a screen-reader year', () => {
    const rows = [
        { id: 'a', title: 'A', author: 'Themis Charvalis', date: '2026-09-02', categories: ['History'], readingTime: '4 min' },
        { id: 'b', title: 'B', author: 'Themis Charvalis', date: '2026-08-31', categories: ['Analysis', 'Drivers'], readingTime: '1 min' }
    ];
    const ctx = { model: buildModel(rows, '2026-10-12'), deps };
    const html = monthGroups(rows, ctx, {});
    assert.equal((html.match(/class="ed-month__title"/g) || []).length, 2);
    assert.match(html, /Σεπτέμβριος 2026[\s\S]*Αύγουστος 2026/);
    assert.match(html, /data-kind="analysis"[\s\S]*ΑΝΑΛΥΣΗ/);
    assert.match(html, /2 ΣΕΠ<span class="visually-hidden"> 2026<\/span>/);
    assert.match(html, /Θέμης Χαρβάλης<\/span><span>1 λεπτό/);
});

test('a lead renders as text when the story has no image', () => {
    const ctx = { model: buildModel([post('p0', '2026-10-12', ['Technical'])], '2026-10-12'), deps };
    const html = leadHtml(ctx.model.posts[0], ctx, {});
    assert.match(html, /class="ed-lead ed-lead--text" data-kind="technical"/);
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /<span class="ed-kicker">ΤΕΧΝΙΚΑ/);
});

test('the year-ago shelf is real stories near the same day last year, and absent when there are none', () => {
    const near = build([post('now', '2026-10-12'), post('ya1', '2025-10-10'), post('ya2', '2025-10-20'), post('late', '2025-10-30'), post('far', '2025-06-01')]);
    // Within 15 days of 12 Oct 2025 (not 'late', 18 days on, nor 'far'), newest first.
    assert.deepEqual(near.model.yearAgo.map(item => item.id), ['ya2', 'ya1']);
    assert.match(near.pages[0].main, /Πριν από ένα χρόνο/);
    const none = build([post('now', '2026-10-12'), post('far', '2025-06-01')]);
    assert.deepEqual(none.model.yearAgo, []);
    assert.doesNotMatch(none.pages[0].main, /Πριν από ένα χρόνο/);
});

// ── Canonicals, sitemap, safety ──────────────────────────
test('every page has its own canonical; the blog index keeps its established one', () => {
    const { pages } = build(realPosts());
    const canonicals = pages.map(page => (/<link rel="canonical" href="([^"]+)">/.exec(page.head) || [])[1]);
    assert.ok(canonicals.every(Boolean));
    assert.equal(new Set(canonicals).size, pages.length, 'no two pages share a canonical');
    assert.equal(canonicals[0], `${SITE}/blog-module/blog/index.html`);
    pages.slice(1).forEach((page, index) => assert.equal(canonicals[index + 1], `${SITE}${page.path}`));
    pages.forEach(page => assert.equal((page.head.match(/rel="canonical"/g) || []).length, 1));
    assert.ok(!pages.slice(1).some(page => /rel="canonical" href="[^"]*index\.html"/.test(page.head)));
});

test('paginated and month pages say what they are in title and description', () => {
    const { pages } = build(realPosts());
    const files = byFile({ pages });
    assert.match(files['section/news/index.html'].head, /<title>Ειδήσεις Formula 1 \| F1 Stories<\/title>/);
    assert.match(files['section/news/page/2/index.html'].head, /<title>Ειδήσεις Formula 1 · Σελίδα 2 \| F1 Stories<\/title>/);
    assert.match(files['section/news/page/2/index.html'].head, /rel="prev" href="https:\/\/f1-stories\.gr\/blog-module\/blog\/section\/news\/"/);
    assert.match(files['archive/2026/10/index.html'].head, /<title>Οκτώβριος 2026 — Αρχείο F1 Stories<\/title>/);
    assert.equal(new Set(pages.map(page => /<title>(.*)<\/title>/.exec(page.head)[1])).size, pages.length, 'unique titles');
});

test('home and composed discovery pages have one aligned metadata set and distinct descriptions', () => {
    const home = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
    const shell = fs.readFileSync(path.join(REPO, 'blog-module/blog/index.html'), 'utf8');
    const { pages } = build(realPosts());
    const descriptions = [];
    for (const html of [home, ...pages.map(page => composePage(shell, page))]) {
        const titles = [...html.matchAll(/<title>([^<]*)<\/title>/g)];
        assert.equal(titles.length, 1);
        const meta = key => {
            const tags = (html.match(/<meta\b[^>]*>/g) || [])
                .filter(tag => tag.includes(`name="${key}"`) || tag.includes(`property="${key}"`));
            assert.equal(tags.length, 1, key);
            const value = /content="([^"]*)"/.exec(tags[0])?.[1];
            assert.ok(value, key);
            return value;
        };
        const description = meta('description');
        descriptions.push(description);
        assert.equal(meta('og:title'), titles[0][1]);
        assert.equal(meta('twitter:title'), titles[0][1]);
        assert.equal(meta('og:description'), description);
        assert.equal(meta('twitter:description'), description);
        const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]*)">/g)];
        assert.equal(canonicals.length, 1);
        assert.equal(meta('og:url'), canonicals[0][1]);
    }
    assert.equal(new Set(descriptions).size, descriptions.length);
    assert.match(home, /<title>F1 Stories \| Formula 1 στα ελληνικά — Νέα και Ανάλυση<\/title>/);
});

test('the homepage names the paper in its one h1 and declares one linked publisher identity', () => {
    const home = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
    const footer = fs.readFileSync(path.join(REPO, 'partials/footer.html'), 'utf8');
    // The lead story changes daily; the page heading does not.
    const h1s = [...home.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
    assert.equal(h1s.length, 1);
    assert.equal(h1s[0][1].trim(), 'F1 Stories — Formula 1 στα ελληνικά');
    assert.match(home, /<h2 id="hero-title"[\s>]/);

    const blocks = [...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    assert.equal(blocks.length, 1);
    const graph = blocks[0]['@graph'];
    const [org, site] = ['Organization', 'WebSite'].map(type => {
        const nodes = graph.filter(node => node['@type'] === type);
        assert.equal(nodes.length, 1, type);
        return nodes[0];
    });
    const canonical = /<link rel="canonical" href="([^"]*)">/.exec(home)[1];
    assert.equal(org['@id'], `${canonical}#organization`);
    assert.equal(site['@id'], `${canonical}#website`);
    assert.deepEqual([org.name, org.url, site.name, site.url], ['F1 Stories', canonical, 'F1 Stories', canonical]);
    assert.deepEqual(site.publisher, { '@id': org['@id'] });
    assert.equal(site.inLanguage, 'el-GR');
    assert.match(org.logo.url, /^https:\/\/f1-stories\.gr\/\S+\.png$/);
    for (const key of ['alternateName', 'potentialAction', 'founder', 'foundingDate']) {
        assert.ok(!(key in org) && !(key in site), key);
    }
    // sameAs declares exactly the profiles the site itself links as its own.
    const social = /<div class="social-media">([\s\S]*?)<\/div>/.exec(footer)[1];
    assert.deepEqual([...org.sameAs].sort(), [...social.matchAll(/href="(https:\/\/[^"]+)"/g)].map(match => match[1]).sort());
});

test('monthly descriptions handle all Greek month names and a single story naturally', () => {
    const posts = Array.from({ length: 12 }, (_, index) => post(`m${index}`, `2026-${String(index + 1).padStart(2, '0')}-01`));
    const { pages } = build(posts, { today: '2026-12-31' });
    for (const page of pages.filter(item => /^archive\/2026\//.test(item.file))) {
        assert.match(page.head, /: 1 ιστορία\. Περιηγηθείτε/);
        assert.doesNotMatch(page.head, /τον [Α-Ω]/);
    }
    assert.equal(pages.filter(item => /^archive\/2026\//.test(item.file)).length, 12);
});

test('metadata escapes Greek, apostrophes, quotes and long input without truncation or extra elements', () => {
    const title = `Ελληνικά "Formula 1" & τ' αγωνιστικά <script>alert('x')</script> ${'μεγάλος τίτλος '.repeat(100)}`;
    const description = `Η άποψη του O'Connor: "νέα" & <μονοθέσια>.`;
    const canonical = `${SITE}/?q="Ελλάδα"&author=O'Connor`;
    const html = headHtml({ title, description, path: '/', canonical, prev: '/?q="πριν"&page=1', next: '/?q="μετά"&page=3' });
    // Parse the generated head as XML with explicitly closed HTML void elements.
    const { XMLParser } = require('fast-xml-parser');
    const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', trimValues: false })
        .parse(`<head>${html.replace(/<(meta|link)([^>]*?)>/g, '<$1$2/>')}</head>`).head;
    assert.equal(parsed.title, title);
    const meta = key => parsed.meta.find(item => item.name === key || item.property === key).content;
    for (const key of ['og:title', 'twitter:title']) assert.equal(meta(key), title);
    for (const key of ['description', 'og:description', 'twitter:description']) assert.equal(meta(key), description);
    assert.equal(meta('og:url'), canonical);
    assert.equal(parsed.link.find(item => item.rel === 'canonical').href, canonical);
    assert.equal(parsed.link.find(item => item.rel === 'prev').href, `${SITE}/?q="πριν"&page=1`);
    assert.equal(parsed.link.find(item => item.rel === 'next').href, `${SITE}/?q="μετά"&page=3`);
    assert.equal((html.match(/<title>/g) || []).length, 1);
    assert.equal((html.match(/<meta /g) || []).length, 10);
    assert.equal((html.match(/<link /g) || []).length, 3);
    assert.doesNotMatch(html, /<script>|<μονοθέσια>/);
});

test('every generated route is a sitemap entry; later section pages rank below the first', () => {
    const { pages } = build(realPosts());
    const edition = pages.filter(page => page.file !== 'index.html');
    // Written the way generateSitemap does, into a scratch file.
    const sitemapPath = path.join(os.tmpdir(), `f1s-sitemap-${process.pid}.xml`);
    const shared = require('../shared');
    const original = shared.CONFIG.SITEMAP_PATH;
    shared.CONFIG.SITEMAP_PATH = sitemapPath;
    try {
        require('../sitemap').generateSitemap([], edition);
        const xml = fs.readFileSync(sitemapPath, 'utf8');
        const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
        edition.forEach(page => assert.ok(locs.includes(`${SITE}${page.path}`), `${page.path} is in the sitemap`));
        assert.equal(new Set(locs).size, locs.length, 'no URL twice');
        assert.ok(locs.includes(`${SITE}/blog-module/blog/index.html`), 'the blog index entry is kept');
        assert.match(xml, /section\/news\/<\/loc>\s*<lastmod>[\d-]+<\/lastmod>\s*<changefreq>weekly<\/changefreq>\s*<priority>0\.7</);
        assert.match(xml, /section\/news\/page\/2\/<\/loc>\s*<lastmod>[\d-]+<\/lastmod>\s*<changefreq>weekly<\/changefreq>\s*<priority>0\.4</);
        assert.match(xml, /archive\/2026\/10\/<\/loc>\s*<lastmod>2026-10-12<\/lastmod>/);
    } finally {
        shared.CONFIG.SITEMAP_PATH = original;
        fs.rmSync(sitemapPath, { force: true });
    }
});

test('missing metadata never leaks undefined, null or NaN into a page', () => {
    const posts = [
        { id: 'bare', title: 'Bare', date: '2026-10-12', categories: ['News'] },
        { id: 'nodate', title: 'No date', author: 'Guest Writer', date: '', categories: [] },
        { id: 'weird', title: 'Weird <b>"title"</b> & more', date: '2026-10-11', categories: ['Technical'], author: 'Nobody', excerpt: '<script>alert(1)</script>' }
    ];
    const { pages } = build(posts);
    pages.forEach(page => {
        assert.doesNotMatch(page.main, /undefined|null|NaN/, page.file);
        assert.doesNotMatch(page.main + page.head, /<script>alert/, page.file);
    });
    assert.match(pages[0].main, /Weird &lt;b&gt;&quot;title&quot;&lt;\/b&gt; &amp; more/);
});

test('a page with no stories at all still renders', () => {
    const { pages } = build([]);
    assert.equal(pages.length, 1);
    assert.doesNotMatch(pages[0].main, /undefined|NaN/);
});

test('real archive: counts agree across contents, section pages and month pages', () => {
    const posts = realPosts();
    const result = build(posts);
    const files = byFile(result);
    const index = files['index.html'].main;
    const published = result.model.published.length;
    for (const section of result.model.sections) {
        const expected = posts.filter(item => item.categories.includes(section.name)).length;
        assert.equal(section.posts.length, expected);
        assert.ok(index.includes(`href="${route.section(section.kind)}"`), `${section.kind} linked from the contents`);
        assert.match(files[`section/${section.kind}/index.html`].main, new RegExp(`${expected} ιστορ`));
        const seen = new Set();
        for (let page = 1; page <= sectionPageCount(section); page += 1) {
            const file = path.posix.join('section', section.kind, page > 1 ? `page/${page}` : '', 'index.html');
            links(files[file].main).forEach(id => seen.add(id));
        }
        assert.equal(seen.size, expected, `${section.kind}: every story on a section page`);
    }
    let inMonths = 0;
    for (const key of result.model.monthKeys) {
        const file = `archive/${key.slice(0, 4)}/${key.slice(5)}/index.html`;
        assert.equal(links(files[file].main).size, result.model.months.get(key).length, key);
        inMonths += links(files[file].main).size;
    }
    assert.equal(inMonths, published, 'month pages together list every published story once');
});

// The weakness this work removes: before the Edition Index only the first 34 stories (front + first ledger page)
// were reachable from static HTML; the rest needed JavaScript. Now every story is a link on a static page.
test('every story is reachable from static HTML without JavaScript', () => {
    const posts = realPosts();
    const { pages } = build(posts);
    const reachable = new Set();
    pages.forEach(page => links(page.main).forEach(id => reachable.add(id)));
    const missing = posts.filter(item => T.isDay(item.date) && item.date <= '2026-12-31' && !reachable.has(item.id));
    assert.deepEqual(missing.map(item => item.id), []);
    assert.ok(reachable.size > 34, `more than the old 34 (${reachable.size})`);
});

test('every published article keeps its URL and its own canonical', () => {
    const posts = realPosts();
    const { pages } = build(posts);
    const all = pages.map(page => page.main).join('\n');
    for (const item of posts) {
        const file = path.join(REPO, 'blog-module', 'blog-entries', item.id, 'article.html');
        assert.ok(fs.existsSync(file), `${item.id} still has its page`);
        const html = fs.readFileSync(file, 'utf8');
        const canonical = (/<link rel="canonical" href="([^"]+)">/.exec(html) || [])[1];
        assert.equal(canonical, `https://f1-stories.gr/blog-module/blog-entries/${encodeURI(item.id)}/article.html`, item.id);
        assert.ok(all.includes(`/blog-module/blog-entries/${item.id}/article.html`) || !T.isDay(item.date), `${item.id} is linked`);
    }
});

// ── Writing pages ────────────────────────────────────────
test('pages are written into the shell and pages that no longer exist are removed', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-edition-'));
    try {
        const shell = fs.readFileSync(path.join(REPO, 'blog-module', 'blog', 'index.html'), 'utf8');
        fs.writeFileSync(path.join(dir, 'index.html'), shell);
        const first = build([post('a', '2026-10-12'), post('b', '2026-02-01', ['Betting'])]);
        writeDiscoveryPages(dir, first);
        assert.ok(fs.existsSync(path.join(dir, 'archive', '2026', '02', 'index.html')));
        assert.ok(fs.existsSync(path.join(dir, 'section', 'betting', 'index.html')));
        const written = fs.readFileSync(path.join(dir, 'section', 'news', 'index.html'), 'utf8');
        assert.match(written, /<title>Ειδήσεις Formula 1 \| F1 Stories<\/title>/);
        assert.equal((written.match(/<main /g) || []).length, 1);
        assert.equal(written, composePage(shell, byFile(first)['section/news/index.html']), 'the shell around <main> is untouched');
        const second = build([post('a', '2026-10-12')]);
        writeDiscoveryPages(dir, second);
        assert.ok(!fs.existsSync(path.join(dir, 'archive', '2026', '02')), 'the empty month folder is gone');
        assert.ok(!fs.existsSync(path.join(dir, 'section', 'betting')), 'the empty section is gone');
        assert.ok(fs.existsSync(path.join(dir, 'archive', '2026', '10', 'index.html')));
        assert.ok(fs.existsSync(path.join(dir, 'archive')), 'the generated root stays');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
