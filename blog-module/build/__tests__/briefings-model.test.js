const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const T = require('../../taxonomy');
const { articleUrl } = require('../entities/hubs');
const { loadBriefingInputs, isoWeekPeriod, validateManifest, contentDigest, isDirectPublic, selectBriefings, publicBriefingFiles, GENERATED } = require('../briefings/model');

const options = { today: '2026-11-02', isPublic: () => true, retired: [] };
function fixture() {
    const articles = [{ id: 'a', date: '2026-10-26' }, { id: 'b', date: '2026-10-27' },
        { id: 'c', date: '2026-10-20' }, { id: 'd', date: '2026-10-28' }];
    const edition = { id: '2026-w44', status: 'published', title: 'Τίτλος', description: 'Περιγραφή', opening: ['Αρχή'],
        sections: [{ heading: 'Πρώτο', intro: 'Εισαγωγή', items: [{ articleId: 'a', rationale: 'Λόγος' }, { articleId: 'b', rationale: 'Λόγος β' }] },
            { heading: 'Δεύτερο', items: [{ articleId: 'c', rationale: 'Πλαίσιο', context: true }] }],
        closing: ['Τέλος'], revised: '2026-11-01', review: { status: 'approved', kind: 'human', by: 'SYNTHETIC TEST', date: '2026-11-02', contentSha256: '' } };
    edition.review.contentSha256 = contentDigest(edition);
    return { manifest: { version: 1, editions: [edition] }, articles, edition };
}
const validate = f => validateManifest(f.manifest, { articles: f.articles, retired: [] });
const select = (f, opts = options) => selectBriefings(f.manifest, f.articles, opts)[0];

test('ISO weeks use UTC calendar arithmetic and reject invalid weeks', () => {
    assert.deepEqual(isoWeekPeriod('2026-w53'), { year: 2026, week: 53, start: '2026-12-28', end: '2027-01-03' });
    assert.equal(isoWeekPeriod('2027-w01').start, '2027-01-04');
    assert.equal(isoWeekPeriod('2020-w53').start, '2020-12-28');
    for (const id of ['2021-w53', '2026-w00', '2026-w54', '2026-w1', '../x', '2026-W01']) assert.throws(() => isoWeekPeriod(id), /week/);
});

test('selection, files, pending, ordering and input immutability', () => {
    const f = fixture(), before = structuredClone(f);
    const item = select(f);
    assert.equal(item.eligible, true); assert.equal(item.lastmod, '2026-11-02');
    assert.deepEqual(item.posts.map(p => p.id), ['a', 'b', 'c']);
    assert.deepEqual([...publicBriefingFiles(f, options)], ['blog-module/blog/briefing/index.html', 'blog-module/blog/briefing/2026-w44/index.html']);
    assert.ok(GENERATED.test('briefing/index.html')); assert.ok(GENERATED.test('briefing/2026-w44/index.html'));
    assert.deepEqual(f, before);
    f.edition.review = { status: 'pending' }; assert.deepEqual(select(f).reasons.map(r => r.code), ['approval']);
    assert.equal(publicBriefingFiles(f, options).size, 0);
    const second = structuredClone(f.edition); second.id = '2026-w43'; second.status = 'retired'; second.retired = { date: '2026-11-02', reason: 'Τέλος' };
    f.manifest.editions.push(second);
    assert.deepEqual(selectBriefings(f.manifest, f.articles, options).map(x => x.edition.id), ['2026-w44', '2026-w43']);
    assert.throws(() => selectBriefings(f.manifest, f.articles, { retired: [] }), /valid publication day/);
});

test('structural validation rejects malformed input and preserves retired ids', () => {
    const cases = [
        [f => f.manifest.version = 2, /version/], [f => f.manifest.extra = 1, /unknown key/],
        [f => f.edition.id = '../x', /week/], [f => f.edition.title = ' title', /string/],
        [f => f.edition.description = 'x\n', /string/], [f => f.edition.opening = [], /opening/],
        [f => f.edition.closing = [], /closing/], [f => f.edition.sections[0].intro = '', /intro/],
        [f => f.edition.sections[0].items[0].rationale = '', /rationale/],
        [f => f.edition.revised = '2026-02-30', /date/], [f => f.articles[0].date = '2026-02-30', /date/],
        [f => f.edition.sections[0].items[0].articleId = '../bad', /unsafe/],
        [f => f.edition.sections[0].items[0].articleId = 'unknown', /unknown/],
        [f => f.edition.sections[1].items[0].articleId = 'a', /duplicate/],
        [f => f.edition.sections[0].items[0].context = false, /context/],
        [f => f.edition.sections[0].items[0].context = true, /context/],
        [f => f.articles[0].date = '2026-11-02', /period/],
        [f => f.edition.sections[1].items[0].context = undefined, /context/],
        [f => delete f.edition.review.by, /reviewer/], [f => f.edition.review = { status: 'pending', by: 'SYNTHETIC TEST' }, /pending/],
        [f => f.edition.review.date = '2026-11-01', /week completed/],
        [f => f.edition.revised = '2026-11-03', /before revised/],
        [f => f.edition.retired = { date: '2026-11-02', reason: 'x' }, /retired block/]
    ];
    for (const [mutate, error] of cases) { const f = fixture(); mutate(f); assert.throws(() => validate(f), error); }
    const f = fixture(); f.edition.sections[0].items[0].articleId = 'old';
    assert.throws(() => validateManifest(f.manifest, { articles: f.articles, retired: [{ id: 'old', target: 'survivor' }] }), /old.*survivor/);
    f.edition.status = 'retired'; f.edition.retired = { date: '2026-11-02', reason: 'Τέλος' };
    validate(f); assert.equal(select(f).eligible, false); assert.equal(select(f).sections[0].items[0].articleId, 'old');
    f.manifest.editions.push(structuredClone(f.edition)); assert.throws(() => validate(f), /duplicate id/);
});

test('digest uses exact canonical key order and binds all editorial changes', () => {
    const f = fixture(), e = f.edition;
    const canonical = { id: e.id, title: e.title, description: e.description, opening: e.opening, sections: e.sections,
        closing: e.closing, revised: e.revised };
    assert.equal(contentDigest(e), createHash('sha256').update(JSON.stringify(canonical)).digest('hex'));
    const mutations = [e => e.title += '!', e => e.description += '!', e => e.opening[0] += '!', e => e.closing[0] += '!',
        e => e.sections[0].heading += '!', e => e.sections[0].intro += '!', e => e.sections.reverse(),
        e => e.sections[0].items.reverse(), e => e.sections[0].items[0].rationale += '!',
        e => { e.sections[1].items[0].articleId = 'd'; delete e.sections[1].items[0].context; },
        e => e.sections[0].items[0].articleId = 'd'];
    for (const mutate of mutations) { const changed = fixture(); mutate(changed.edition); assert.ok(select(changed).reasons.some(r => r.code === 'digest')); }
    const context = fixture(); delete context.edition.sections[1].items[0].context;
    assert.notEqual(contentDigest(context.edition), context.edition.review.contentSha256);
});

test('publication gates have fixed order and Athens approval boundary', () => {
    const f = fixture();
    assert.equal(select(f, { ...options, today: '2026-11-01' }).eligible, false);
    assert.deepEqual(select(f, { ...options, today: '2026-11-01' }).reasons.map(r => r.code), ['approval-date']);
    assert.equal(select(f).eligible, true);
    f.edition.status = 'draft'; f.edition.review.date = '2026-11-04'; f.edition.revised = '2026-11-03';
    f.articles[0].draft = true;
    assert.deepEqual(select(f).reasons.map(r => r.code), ['status', 'approval-date', 'digest', 'revised', 'member']);
    const future = fixture(); future.articles[0].date = '2026-11-01';
    assert.ok(select(future, { ...options, today: '2026-10-31' }).reasons.some(r => r.code === 'member'));
});

test('direct article page requires canonical, indexability and no refresh', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'briefings-test-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const article = { id: 'δοκιμή', date: '2026-10-26' }, url = articleUrl(article);
    const file = path.join(root, decodeURIComponent(new URL(url).pathname)); fs.mkdirSync(path.dirname(file), { recursive: true });
    assert.equal(isDirectPublic(article, root), false);
    const canonical = `<link rel="canonical" href="${url}">`;
    for (const [html, expected] of [[canonical, true], [canonical.replace(url, 'https://example.com/'), false],
        [canonical + '<meta name="robots" content="noindex">', false], [canonical + '<meta http-equiv="refresh" content="0">', false]]) {
        fs.writeFileSync(file, html); assert.equal(isDirectPublic(article, root), expected);
        const f = fixture(); f.articles[0] = article; f.edition.sections[0].items[0].articleId = article.id;
        assert.equal(select(f, { ...options, isPublic: post => post.id === article.id ? isDirectPublic(post, root) : true }).reasons.some(r => r.code === 'member'), !expected);
    }
});

test('real manifest validates and published editions are eligible today', () => {
    const f = loadBriefingInputs(); validateManifest(f.manifest, { articles: f.articles });
    const selected = selectBriefings(f.manifest, f.articles, { today: T.athensDay() });
    assert.deepEqual(selected.filter(x => x.edition.status === 'published' && !x.eligible).map(x => [x.edition.id, x.reasons]), []);
    for (const item of selected) if (item.edition.status !== 'published') assert.equal(item.eligible, false);
});
