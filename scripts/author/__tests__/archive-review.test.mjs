import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const context = vm.createContext({ window: { crypto: globalThis.crypto }, URL, Date, console, TextEncoder });
for (const file of ['blog-module/taxonomy.js', 'scripts/author/article-index.js', 'scripts/author/research-assistant.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
    if (file.includes('taxonomy')) context.window.F1S_TAXONOMY = context.F1S_TAXONOMY;
}
const api = context.window.F1S_RESEARCH;
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
// Values cross the vm realm; JSON makes them comparable with deepStrictEqual.
const clone = value => JSON.parse(JSON.stringify(value));
const cases = read('scripts/author/__tests__/fixtures/archive-review-cases.json').cases;
const posts = new Map(api.decodeIndex(read('blog-module/blog-index-data.json')).map(post => [post.id, post]));
const manifest = api.validateContentManifest(read('scripts/author/research-content/manifest.json'));
const content = new Map();
for (const descriptor of manifest.shards) {
    api.validateContentShard(read('scripts/author/research-content/' + descriptor.file), descriptor).articles.forEach(article => content.set(article.id, article));
}
const resolve = id => posts.has(id) && content.has(id) ? { post: posts.get(id), article: content.get(id) } : null;
const form = { text: '', section: 'unverified', type: 'unverified', kind: 'general', verification: 'pending', sourceTitle: '', url: '', sourceDate: '', event: '', market: '', units: '', period: '', calculation: '', limitations: '' };
let ids = 0;
const uuid = () => '00000000-0000-4000-8000-' + String(++ids).padStart(12, '0');
const noPeriod = scope => ({ ...scope, period: { start: '', end: '' } });

function draftClaim(spec) {
    const numeric = spec.numeric && { ...spec.numeric, originalValues: [{ label: 'Συνθετική τιμή', value: spec.numeric.value }] };
    const sources = spec.reviewed ? [{ title: 'Συνθετική πηγή χρονομέτρησης', url: 'https://example.com/timing', locator: { kind: 'page', value: '2' }, sourceDate: '2026-10-29', excerpt: '', independenceKey: 'https://example.com/timing', stance: 'supports' }] : [];
    let claim = api.validateClaim({ id: uuid(), text: spec.text, anchor: null, claimType: spec.claimType, status: 'unreviewed', sources, scope: noPeriod(spec.scope), numeric, review: null });
    if (spec.reviewed) claim = api.assessClaim(claim, 'reviewed-with-evidence', 'Συνθετικός έλεγχος με μεταγενέστερη πηγή.', '');
    return clone(claim);
}
function annotation(spec, claim) {
    const article = content.get(spec.postId), passage = article.passages.find(item => item.text.includes(spec.find));
    assert.ok(passage, spec.label + ': passage not found');
    return clone(api.makeComparison(claim, posts.get(spec.postId), article, passage, { quote: spec.quote, entities: spec.entities, claimType: spec.archive.claimType,
        scope: noPeriod(spec.archive.scope), numeric: spec.archive.numeric && { ...spec.archive.numeric, originalValues: [] } }));
}
const workspace = (claims, comparisons, dismissals = []) => clone(api.validateWorkspace({ version: 3, question: 'Συνθετικός έλεγχος', anchor: '', season: '', round: '', notes: [], form,
    claims, archiveReview: { comparisons, dismissals } }));
const emitted = result => clone(result.rows.flatMap(row => row.signals.map(signal => signal.kind))).sort();

test('13 labeled draft-to-archive pairs emit exactly the expected signals, with zero false positives', async t => {
    let truePositives = 0, falsePositives = 0, misses = 0;
    const categories = new Set();
    for (const spec of cases) {
        const claim = draftClaim(spec.claim), result = await api.reviewQueue(workspace([claim], [annotation(spec, claim)]), resolve);
        const got = emitted(result), expected = [...spec.expected].sort();
        truePositives += got.filter(kind => expected.includes(kind)).length;
        falsePositives += got.filter(kind => !expected.includes(kind)).length;
        misses += expected.filter(kind => !got.includes(kind)).length;
        assert.deepEqual(got, expected, spec.label);
        assert.equal(result.incomplete.length, spec.expectIncomplete ? 1 : 0, spec.label);
        categories.add(spec.category);
    }
    assert.equal(cases.length, 13);
    assert.deepEqual([...categories].sort(), ['Analysis', 'Betting', 'History', 'News', 'Technical']);
    assert.equal(falsePositives, 0); assert.equal(misses, 0); assert.equal(truePositives, 4);
    t.diagnostic(`emitted ${truePositives + falsePositives} signals, precision ${truePositives}/${truePositives + falsePositives}, misses ${misses}; fixed labeled set only, not a general accuracy measure`);
});

test('a dismissal hides only that exact signal; a changed claim or article text brings the pair back', async () => {
    const spec = cases.find(item => item.label === 'update-worthy');
    const claim = draftClaim(spec.claim), comparison = annotation(spec, claim);
    const first = await api.reviewQueue(workspace([claim], [comparison]), resolve);
    assert.deepEqual(emitted(first), ['possible-conflict', 'update-candidate']);
    const conflictKey = first.rows[0].signals.find(signal => signal.kind === 'possible-conflict').key;
    assert.match(conflictKey, /^[a-f0-9]{64}$/);
    const dismissed = [{ claimId: claim.id, key: conflictKey, dismissedAt: '2026-10-29T12:00:00.000Z' }];
    assert.deepEqual(emitted(await api.reviewQueue(workspace([claim], [comparison], dismissed), resolve)), ['update-candidate']);
    // Same comparison, claim re-recorded with another value: new fingerprint, so the old dismissal no longer applies.
    const edited = draftClaim({ ...spec.claim, numeric: { ...spec.claim.numeric, value: '0.575' } });
    edited.id = claim.id;
    assert.deepEqual(emitted(await api.reviewQueue(workspace([edited], [comparison], dismissed), resolve)), ['possible-conflict', 'update-candidate']);
    // The published text changed: the annotation needs re-recording and yields no signal meanwhile.
    const changed = id => { const found = resolve(id); return found && { post: found.post, article: { ...found.article, digest: 'f'.repeat(64) } }; };
    const stale = await api.reviewQueue(workspace([claim], [comparison]), changed);
    assert.equal(stale.rows.length, 0); assert.equal(stale.incomplete.length, 1); assert.equal(stale.incomplete[0].loaded, true);
    // Text not loaded in this session: reported, not fetched.
    const unloaded = await api.reviewQueue(workspace([claim], [comparison]), () => null);
    assert.equal(unloaded.rows.length, 0); assert.equal(unloaded.incomplete[0].loaded, false);
});

test('queue caps at four rows per claim and 24 overall, conflicts before overlaps', async () => {
    const digest = 'a'.repeat(64), post = { id: 'synthetic', date: '2026-01-01', title: 'Συνθετικό', url: '/blog-module/blog-entries/synthetic/article.html' };
    const passages = Array.from({ length: 40 }, (_, i) => ({ kind: 'paragraph', ordinal: i, heading: -1, text: 'Ο Norris και ο Hamilton, τιμή ' + i + '.' }));
    const article = { id: 'synthetic', digest, headings: [], passages };
    const scope = { event: 'Grand Prix Ουγγαρίας', season: '2026', round: '13', session: 'q3' };
    const numeric = value => ({ metric: 'διαφορά', value, units: 's', sample: 'Norris έναντι Hamilton', method: 'καλύτεροι γύροι' });
    const claims = Array.from({ length: 7 }, () => draftClaim({ text: 'Ο Norris και ο Hamilton, τιμή 999.', claimType: 'official-fact', scope, numeric: numeric('999') }));
    const comparisons = [];
    claims.forEach((claim, c) => {
        for (let k = 0; k < 5; k++) {
            const passage = passages[c * 5 + k];
            comparisons.push(clone(api.makeComparison(claim, post, article, passage, { quote: passage.text, entities: ['Norris', 'Hamilton'], claimType: 'official-fact',
                scope: noPeriod(scope), numeric: { ...numeric(String(c * 5 + k)), originalValues: [] } })));
        }
    });
    const result = await api.reviewQueue(workspace(claims, comparisons), id => id === 'synthetic' ? { post, article } : null);
    assert.equal(result.rows.length, 24); assert.equal(result.truncated, true);
    const perClaim = {};
    result.rows.forEach(row => { perClaim[row.claim.id] = (perClaim[row.claim.id] || 0) + 1; });
    assert.ok(Object.values(perClaim).every(count => count <= 4));
    assert.deepEqual(clone(result.rows.slice(0, 4).map(row => row.claim.id)), Array(4).fill(claims[0].id));
    const spec = cases.find(item => item.label === 'near-identical coverage'), overlapClaim = draftClaim(spec.claim);
    const mixed = await api.reviewQueue(workspace([overlapClaim, claims[0]], [annotation(spec, overlapClaim), comparisons[0]]), id => id === 'synthetic' ? { post, article } : resolve(id));
    assert.deepEqual(clone(mixed.rows.map(row => row.signals[0].kind)), ['possible-conflict', 'overlapping-coverage']);
});

test('workspace v1/v2 migrate to v3; comparisons must reference a claim and stay within limits', () => {
    const v2 = { version: 2, question: 'Ερώτημα', anchor: '', season: '', round: '', notes: [], form, claims: [] };
    assert.deepEqual(clone(api.validateWorkspace(v2)).archiveReview, { comparisons: [], dismissals: [] });
    const spec = cases[0], claim = draftClaim(spec.claim), comparison = annotation(spec, claim);
    assert.equal(workspace([claim], [comparison]).archiveReview.comparisons[0].quote, spec.quote);
    assert.throws(() => workspace([], [comparison]));
    assert.throws(() => workspace([claim], [{ ...comparison, entities: ['και'] }]));
    assert.throws(() => workspace([claim], [{ ...comparison, entities: ['α', 'β', 'γ', 'δ', 'ε'] }]));
    assert.throws(() => workspace([claim], [{ ...comparison, end: comparison.end + 1 }]));
    assert.throws(() => workspace([claim], Array(101).fill(comparison)));
    assert.throws(() => workspace([claim], [comparison], [{ claimId: claim.id, key: 'not-a-hash', dismissedAt: '2026-10-29T12:00:00.000Z' }]));
    assert.throws(() => api.makeComparison(claim, posts.get(spec.postId), content.get(spec.postId), { kind: 'paragraph', ordinal: 0, text: 'άλλο κείμενο' }, { quote: spec.quote }));
});
