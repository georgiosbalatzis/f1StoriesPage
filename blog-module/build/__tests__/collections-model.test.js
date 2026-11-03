const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { loadCollectionInputs, validateManifest, contentDigest, selectCollections, publicCollectionFiles, GENERATED } = require('../collections/model');

const today = '2026-11-03';
const options = { today, isPublic: () => true, retired: [] };
function fixture() {
    const articles = ['a', 'b', 'c'].map((id, i) => ({ id, date: `2026-10-0${i + 1}` }));
    const collection = { slug: 'test', status: 'published', title: 'Τίτλος', description: 'Περιγραφή', introduction: ['Κείμενο'],
        items: articles.map((post, i) => ({ position: i + 1, articleId: post.id, reason: `Λόγος ${i}` })), revised: '2026-10-04',
        review: { status: 'approved', kind: 'human', by: 'Reviewer', date: '2026-10-05', contentSha256: '' } };
    collection.review.contentSha256 = contentDigest(collection);
    return { manifest: { version: 1, collections: [collection] }, articles, collection };
}
const select = f => selectCollections(f.manifest, f.articles, options)[0];
const validate = f => validateManifest(f.manifest, { articles: f.articles, retired: [] });

test('approved collection preserves order and computes lastmod and files', () => {
    const f = fixture(), result = select(f);
    assert.equal(result.eligible, true); assert.deepEqual(result.reasons, []);
    assert.deepEqual(result.posts.map(post => post.id), ['a', 'b', 'c']);
    assert.equal(result.lastmod, '2026-10-05');
    assert.deepEqual([...publicCollectionFiles(f, options)], ['blog-module/blog/collections/index.html', 'blog-module/blog/collections/test/index.html']);
    assert.ok(GENERATED.test('collections/index.html')); assert.ok(GENERATED.test('collections/test/index.html'));
    assert.ok(!GENERATED.test('collections/test/page/2/index.html'));
    f.articles[2].date = '2026-10-09'; assert.equal(select(f).lastmod, '2026-10-09');
});

test('digest has specified key order and binds text, reason and order', () => {
    const f = fixture(), c = f.collection;
    const canonical = { slug: c.slug, title: c.title, description: c.description, introduction: c.introduction,
        items: c.items.map(({ position, articleId, reason }) => ({ position, articleId, reason })), revised: c.revised };
    assert.equal(contentDigest(c), createHash('sha256').update(JSON.stringify(canonical)).digest('hex'));
    for (const mutate of [c => c.title += '!', c => c.items[0].reason += '!', c => {
        [c.items[0], c.items[1]] = [c.items[1], c.items[0]]; c.items.forEach((item, i) => item.position = i + 1);
    }]) {
        const changed = fixture(); mutate(changed.collection);
        assert.ok(select(changed).reasons.some(reason => reason.code === 'digest'));
    }
    delete c.items[0].reason;
    assert.notEqual(contentDigest(c), f.collection.review.contentSha256);
});

test('pending approvals and failed members withhold the whole collection', () => {
    const f = fixture(); f.collection.review = { status: 'pending' };
    assert.ok(select(f).reasons.some(reason => reason.code === 'approval'));
    assert.equal(publicCollectionFiles(f, options).size, 0);
    for (const mutate of [post => post.date = '2026-12-01', post => post.draft = true, post => post.published = false, post => post.status = 'draft']) {
        const changed = fixture(); mutate(changed.articles[0]);
        assert.equal(select(changed).eligible, false); assert.match(select(changed).reasons.find(r => r.code === 'member').detail, /a/);
        assert.equal(select(changed).posts.length, 3);
    }
    const removed = fixture();
    const result = selectCollections(removed.manifest, removed.articles, { ...options, isPublic: post => post.id !== 'b' })[0];
    assert.equal(result.eligible, false); assert.match(result.reasons.find(r => r.code === 'member').detail, /\bb\b/);
});

test('future review and revised dates withhold, retired records reserve slugs', () => {
    const f = fixture(); f.collection.review.date = '2026-12-01';
    assert.ok(select(f).reasons.some(r => r.code === 'approval-date'));
    f.collection.revised = '2026-12-01'; f.collection.review.contentSha256 = contentDigest(f.collection);
    assert.ok(select(f).reasons.some(r => r.code === 'revised'));
    f.collection.status = 'retired'; assert.throws(() => validate(f), /retired block/);
    f.collection.retired = { date: today, reason: 'Αποσύρθηκε' }; assert.equal(select(f).eligible, false);
    f.manifest.collections.push(structuredClone(f.collection)); assert.throws(() => validate(f), /duplicate slug/);
});

test('structural errors fail closed', () => {
    const cases = [
        [f => f.manifest.version = 2, /version/], [f => f.manifest.extra = 1, /unknown key/],
        [f => f.collection.extra = 1, /unknown key/], [f => f.collection.items[0].extra = 1, /unknown key/],
        [f => f.collection.review.extra = 1, /unknown key/], [f => f.collection.review = { status: 'approved' }, /human/],
        [f => delete f.collection.review.by, /reviewer/], [f => delete f.collection.review.date, /date/],
        [f => delete f.collection.review.contentSha256, /digest/],
        [f => f.collection.review.date = '2026-10-03', /before revised/],
        [f => f.collection.revised = '2026-02-30', /date/], [f => f.collection.revised = '2026-1-1', /date/],
        [f => f.collection.title = ' title', /string/], [f => f.collection.introduction = [], /introduction/],
        [f => f.collection.items[1].articleId = 'a', /duplicate article/], [f => f.collection.items[1].articleId = 'missing', /unknown article/],
        [f => f.collection.items[0].position = 2, /position/], [f => f.collection.items.pop(), /item count/],
        [f => f.collection.items = [], /item count/], [f => f.collection.items = Array.from({ length: 13 }, () => ({})), /item count/],
        [f => f.collection.retired = { date: today, reason: 'x' }, /retired block/]
    ];
    for (const [mutate, error] of cases) { const f = fixture(); mutate(f); assert.throws(() => validate(f), error); }
    for (const id of ['../x', 'a/b', '%2e']) { const f = fixture(); f.collection.items[0].articleId = id; assert.throws(() => validate(f), /unsafe/); }
    const f = fixture(); f.collection.items[0].articleId = 'old';
    assert.throws(() => validateManifest(f.manifest, { articles: f.articles, retired: [{ id: 'old', target: 'survivor' }] }), /old.*survivor/);
});

test('selection sorts slugs deterministically and requires injected day', () => {
    const f = fixture(), second = structuredClone(f.collection); second.slug = 'alpha'; second.review.contentSha256 = contentDigest(second);
    f.manifest.collections.push(second);
    const a = selectCollections(f.manifest, f.articles, options);
    f.manifest.collections.reverse(); assert.deepEqual(selectCollections(f.manifest, f.articles, options), a);
    assert.deepEqual(a.map(item => item.collection.slug), ['alpha', 'test']);
    assert.throws(() => selectCollections(f.manifest, f.articles, { retired: [] }), /valid publication day/);
});

// CI guard (test:blog): a PR may not leave a collection marked published but withheld by the gate.
test('every published collection in the real manifest is eligible today', () => {
    const f = loadCollectionInputs();
    const withheld = selectCollections(f.manifest, f.articles, { today: require('../../taxonomy').athensDay() })
        .filter(item => item.collection.status === 'published' && !item.eligible);
    assert.deepEqual(withheld.map(item => [item.collection.slug, item.reasons]), []);
});

// Holds after a later human approval too: only published + approved records can ever be eligible.
test('real manifest validates and nothing unapproved or unpublished is eligible', () => {
    const f = loadCollectionInputs(); validateManifest(f.manifest, { articles: f.articles });
    for (const item of selectCollections(f.manifest, f.articles, { ...options, isPublic: () => true })) {
        if (item.collection.status !== 'published' || item.collection.review.status !== 'approved') assert.equal(item.eligible, false, item.collection.slug);
    }
});
