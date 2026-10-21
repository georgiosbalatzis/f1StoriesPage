const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { renderFeed, publicationDate, FEED_LIMIT, FEED_URL } = require('../feed');
const { processBlogEntry } = require('../worker');

const now = new Date('2026-10-21T12:00:00Z');
const post = (id, date = '2026-10-20', extra = {}) => ({
    id, date, title: 'Ιστορίες Formula 1', excerpt: 'Ανάλυση από την πίστα.',
    author: 'Themis Charvalis', categories: ['History'], ...extra
});
function parse(xml) {
    assert.equal(XMLValidator.validate(xml), true);
    return new XMLParser({ ignoreAttributes: false, isArray: name => name === 'item' }).parse(xml).rss;
}
const items = (posts, options = { now }) => parse(renderFeed(posts, options)).channel.item || [];

test('RSS metadata and UTF-8 Greek, XML characters, entity-like text and controls round-trip', () => {
    const title = 'Ελλάδα & <F1> "Νίκη" \'οδηγού\' &amp; 🏁 ]]>';
    const xml = renderFeed([post('20261020W', '2026-10-20', { title: title + '\u0001\uFFFE\uD800', excerpt: title })], { now });
    const rss = parse(xml);
    assert.equal(rss['@_version'], '2.0');
    assert.equal(rss.channel.language, 'el');
    assert.equal(rss.channel['atom:link']['@_href'], FEED_URL);
    const item = rss.channel.item[0];
    assert.equal(item.title, title);
    assert.equal(item.description, title);
    assert.equal(item['dc:creator'], 'Θέμης Χαρβάλης');
    assert.equal(item.category, 'Ιστορία');
    assert.equal(item.link, 'https://f1-stories.gr/blog-module/blog-entries/20261020W/article.html');
    assert.equal(item.guid['#text'], item.link);
    assert.equal(item.guid['@_isPermaLink'], 'true');
    assert.equal(item.pubDate, 'Mon, 19 Oct 2026 21:00:00 GMT');
    assert.match(xml, /&amp; &lt;F1&gt;/);
    assert.equal(Buffer.from(xml, 'utf8').toString('utf8'), xml);
});

test('publication days use Athens midnight through winter, summer and DST changes', () => {
    for (const [day, utc] of [
        ['2026-01-12', '2026-01-11T22:00:00.000Z'],
        ['2026-07-12', '2026-07-11T21:00:00.000Z'],
        ['2026-03-29', '2026-03-28T22:00:00.000Z'],
        ['2026-03-30', '2026-03-29T21:00:00.000Z'],
        ['2026-10-25', '2026-10-24T21:00:00.000Z'],
        ['2026-10-26', '2026-10-25T22:00:00.000Z']
    ]) assert.equal(publicationDate(day).toISOString(), utc);
    assert.equal(publicationDate('2026-02-30'), null);
    assert.equal(publicationDate('bad'), null);
});

test('future dates, missing/invalid dates, drafts and unpublished statuses are excluded', () => {
    const excluded = [
        post('future', '2026-10-22'), post('invalid', '2026-02-30'), post('missing', ''),
        ...[true, 'true'].map((draft, i) => post(`draft${i}`, undefined, { draft })),
        ...[false, 'false'].map((published, i) => post(`hidden${i}`, undefined, { published })),
        ...['draft', 'unpublished', 'scheduled'].map(status => post(status, undefined, { status }))
    ];
    assert.deepEqual(items(excluded), []);
    assert.equal(items([post('live', undefined, { draft: 'false', published: 'true', status: 'published' })]).length, 1);
    const boundary = post('athens-tomorrow', '2026-10-22');
    assert.equal(items([boundary], { now: new Date('2026-10-21T20:59:59Z') }).length, 0);
    assert.equal(items([boundary], { now: new Date('2026-10-21T21:00:00Z') }).length, 1);
});

test('newest 30 publication days only, retaining authoritative same-day order', () => {
    const posts = Array.from({ length: 45 }, (_, i) => post(`entry${i}`, new Date(Date.UTC(2026, 8, i + 1)).toISOString().slice(0, 10)));
    const result = items([post('future', '2099-01-01'), ...posts]);
    assert.equal(result.length, FEED_LIMIT);
    assert.match(result[0].link, /entry44\/article.html$/);
    assert.match(result.at(-1).link, /entry15\/article.html$/);
    assert.ok(result.every((item, i) => !i || Date.parse(result[i - 1].pubDate) >= Date.parse(item.pubDate)));
    assert.match(items([post('first'), post('second')])[0].link, /first\/article.html$/);
});

test('GUIDs survive edits; duplicates fail and unknown authors are omitted', () => {
    const before = items([post('stable')])[0];
    const after = items([post('stable', undefined, { title: 'Νέος τίτλος', excerpt: 'Ενημέρωση', author: 'Unknown' })])[0];
    assert.equal(before.guid['#text'], after.guid['#text']);
    assert.equal(after['dc:creator'], undefined);
    assert.throws(() => renderFeed([post('duplicate'), post('duplicate')], { now }), /duplicate feed item/);
});

test('unchanged content produces identical bytes, including later builds', () => {
    const posts = [post('stable')];
    const first = renderFeed(posts, { now });
    assert.equal(renderFeed(posts, { now: new Date('2026-10-23T20:00:00Z') }), first);
    assert.equal(parse(renderFeed([], { now })).channel.lastBuildDate, undefined);
});

test('source processing preserves exclusion metadata in the authoritative records', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-feed-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const flag of ['draft: true', 'published: false', 'status: unpublished']) {
        const dir = path.join(root, '20261020W');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'source.txt'), `---\ntitle: Δοκιμή\n${flag}\n---\nΚείμενο δοκιμής.`);
        const processed = await processBlogEntry(dir);
        assert.ok(processed);
        assert.deepEqual(items([processed]), []);
    }
});

test('generated feed URLs match existing article canonicals and pages advertise discovery', () => {
    const root = path.resolve(__dirname, '../../..');
    const xml = fs.readFileSync(path.join(root, 'feed.xml'), 'utf8');
    const feedItems = parse(xml).channel.item;
    assert.ok(feedItems.length > 0 && feedItems.length <= FEED_LIMIT);
    assert.equal(new Set(feedItems.map(item => item.guid['#text'])).size, feedItems.length);
    const discovery = `<link rel="alternate" type="application/rss+xml" title="F1 Stories" href="${FEED_URL}">`;
    for (const file of ['index.html', 'blog-module/blog/index.html', ...feedItems.map(item => new URL(item.link).pathname.slice(1))]) {
        const html = fs.readFileSync(path.join(root, file), 'utf8');
        const head = html.slice(0, html.indexOf('</head>'));
        assert.equal(head.split(discovery).length - 1, 1, `${file}: feed discovery`);
        const item = feedItems.find(entry => new URL(entry.link).pathname.slice(1) === file);
        if (item) assert.ok(head.includes(`<link rel="canonical" href="${item.link}">`), file);
    }
});
