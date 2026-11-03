const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { loadJourneyInputs, validateManifest, contentDigest, selectJourneys, journeysByArticle } = require('../journeys/model');

const today = '2026-11-03';
const options = { today, isPublic: () => true, retired: [] };
function fixture() {
    const articles = ['a', 'b', 'c'].map((id, i) => ({ id, date: `2026-10-0${i + 1}` }));
    const journey = { slug: 'test', status: 'published', title: 'Τίτλος', description: 'Περιγραφή',
        steps: articles.map((post, i) => ({ position: i + 1, articleId: post.id, ...(i < 2 ? { transition: `Μετά ${i}` } : {}) })),
        revised: '2026-10-04', review: { status: 'approved', kind: 'human', by: 'SYNTHETIC TEST', date: '2026-10-05', contentSha256: '' } };
    journey.review.contentSha256 = contentDigest(journey);
    return { manifest: { version: 1, journeys: [journey] }, articles, journey };
}
const select = f => selectJourneys(f.manifest, f.articles, options)[0];
const validate = f => validateManifest(f.manifest, { articles: f.articles, retired: [] });
const has = (result, code) => result.reasons.some(reason => reason.code === code);

test('approved selection preserves order, computes lastmod and maps eligible articles', () => {
    const f = fixture(), result = select(f), map = journeysByArticle([result]);
    assert.equal(result.eligible, true);
    assert.deepEqual(result.reasons, []);
    assert.deepEqual(result.steps.map(step => step.id), ['a', 'b', 'c']);
    assert.equal(result.lastmod, '2026-10-05');
    assert.deepEqual(map.get('b'), { selected: result, index: 1 });
    assert.throws(() => journeysByArticle([result, result]), /overlap/);
    f.articles[2].date = '2026-10-09'; assert.equal(select(f).lastmod, '2026-10-09');
    f.journey.review = { status: 'pending' };
    assert.ok(has(select(f), 'approval'));
    assert.equal(journeysByArticle([select(f)]).size, 0);
});

test('digest has exact key order and binds title, description, order and transitions', () => {
    const f = fixture(), j = f.journey;
    const canonical = { slug: j.slug, title: j.title, description: j.description,
        steps: j.steps.map(step => ({ position: step.position, articleId: step.articleId,
            ...(Object.hasOwn(step, 'transition') ? { transition: step.transition } : {}) })), revised: j.revised };
    assert.equal(contentDigest(j), createHash('sha256').update(JSON.stringify(canonical)).digest('hex'));
    for (const mutate of [j => j.title += '!', j => j.description += '!', j => j.steps[0].transition += '!', j => {
        [j.steps[0].articleId, j.steps[1].articleId] = [j.steps[1].articleId, j.steps[0].articleId];
    }]) {
        const changed = fixture(); mutate(changed.journey); assert.ok(has(select(changed), 'digest'));
    }
});

test('every member must be published and public', () => {
    for (const mutate of [p => p.date = '2026-12-01', p => p.draft = true, p => p.published = false, p => p.status = 'draft']) {
        const f = fixture(); mutate(f.articles[0]);
        assert.ok(has(select(f), 'member')); assert.equal(select(f).steps.length, 3);
    }
    const f = fixture();
    const result = selectJourneys(f.manifest, f.articles, { ...options, isPublic: post => post.id !== 'b' })[0];
    assert.equal(result.eligible, false); assert.match(result.reasons.find(r => r.code === 'member').detail, /\bb\b/);
});

test('future dates and retirement withhold', () => {
    const f = fixture(); f.journey.review.date = '2026-12-01';
    assert.ok(has(select(f), 'approval-date'));
    f.journey.revised = '2026-12-01'; f.journey.review.contentSha256 = contentDigest(f.journey);
    assert.ok(has(select(f), 'revised'));
    f.journey.status = 'retired'; assert.throws(() => validate(f), /retired block/);
    f.journey.retired = { date: today, reason: 'Απόσυρση' }; assert.ok(has(select(f), 'status'));
    f.manifest.journeys.push(structuredClone(f.journey)); assert.throws(() => validate(f), /duplicate slug/);
});

test('structural errors fail closed', () => {
    const cases = [
        [f => f.manifest.version = 2, /version/], [f => f.manifest.extra = 1, /unknown key/],
        [f => f.journey.extra = 1, /unknown key/], [f => f.journey.steps[0].extra = 1, /unknown key/],
        [f => f.journey.review.extra = 1, /unknown key/], [f => delete f.journey.review.kind, /human/],
        [f => delete f.journey.review.by, /reviewer/], [f => delete f.journey.review.date, /date/],
        [f => delete f.journey.review.contentSha256, /digest/], [f => f.journey.review.date = '2026-10-03', /before revised/],
        [f => f.journey.revised = '2026-02-30', /date/], [f => f.journey.revised = '2026-1-1', /date/],
        [f => f.journey.slug = 'Bad_slug', /slug/], [f => f.journey.title = ' title', /string/],
        [f => f.journey.description = 'x'.repeat(201), /string/], [f => f.journey.steps[0].transition = 'x'.repeat(241), /string/],
        [f => f.journey.steps[1].articleId = 'a', /duplicate article/], [f => f.journey.steps[1].articleId = 'missing', /unknown article/],
        [f => f.journey.steps[0].articleId = '../x', /unsafe/], [f => f.journey.steps[0].position = 2, /position/],
        [f => f.journey.steps = f.journey.steps.slice(0, 1), /step count/],
        [f => f.journey.steps = Array.from({ length: 7 }, () => ({})), /step count/],
        [f => delete f.journey.steps[0].transition, /transition/], [f => f.journey.steps[2].transition = 'x', /transition/],
        [f => f.journey.retired = { date: today, reason: 'x' }, /retired block/],
        [f => { f.journey.status = 'retired'; f.journey.retired = { date: today, reason: 'x', extra: 1 }; }, /unknown key/],
        [f => f.journey.review = { status: 'pending', by: 'SYNTHETIC TEST' }, /pending review/]
    ];
    for (const [mutate, error] of cases) { const f = fixture(); mutate(f); assert.throws(() => validate(f), error); }
    const f = fixture(); f.journey.steps[0].articleId = 'old';
    assert.throws(() => validateManifest(f.manifest, { articles: f.articles, retired: [{ id: 'old', target: 'survivor' }] }), /old.*survivor/);
});

test('published overlap is rejected, draft overlap allowed and ordering deterministic', () => {
    const f = fixture(), second = structuredClone(f.journey); second.slug = 'alpha';
    second.review.contentSha256 = contentDigest(second); f.manifest.journeys.push(second);
    assert.throws(() => validate(f), /overlap/);
    second.status = 'draft'; validate(f);
    const selected = selectJourneys(f.manifest, f.articles, options);
    f.manifest.journeys.reverse(); assert.deepEqual(selectJourneys(f.manifest, f.articles, options), selected);
    assert.deepEqual(selected.map(item => item.journey.slug), ['alpha', 'test']);
    assert.throws(() => selectJourneys(f.manifest, f.articles, { retired: [] }), /valid publication day/);
});

test('real manifest is structurally valid and published journeys are eligible today', () => {
    const f = loadJourneyInputs(); validateManifest(f.manifest, { articles: f.articles });
    const selected = selectJourneys(f.manifest, f.articles, { today: require('../../taxonomy').athensDay() });
    for (const item of selected) {
        if (item.journey.status !== 'published' || item.journey.review.status !== 'approved') assert.equal(item.eligible, false);
    }
    assert.deepEqual(selected.filter(item => item.journey.status === 'published' && !item.eligible)
        .map(item => [item.journey.slug, item.reasons]), []);
});
