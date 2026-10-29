import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const context = vm.createContext({ window: {}, URL, Date });
vm.runInContext(fs.readFileSync(path.join(root, 'scripts/author/research-assistant.js'), 'utf8'), context);
const locate = context.window.F1S_RESEARCH.locateClaimAnchor;
const anchor = { quote: 'α\u0301', prefix: 'πριν ', suffix: ' μετά', start: 5, end: 7 };
const result = (content, value = anchor) => JSON.parse(JSON.stringify(locate(content, value)));

test('anchor location handles offsets, moves, repetition and removal exactly', () => {
    assert.deepEqual(result('πριν α\u0301 μετά'), { status: 'found', start: 5, end: 7 });
    assert.deepEqual(result('νέο πριν α\u0301 μετά'), { status: 'found', start: 9, end: 11 });
    assert.deepEqual(result('α\u0301 και πριν α\u0301 μετά'), { status: 'found', start: 12, end: 14 });
    assert.deepEqual(result('πριν α\u0301 μετά / πριν α\u0301 μετά', { ...anchor, start: 99, end: 101 }), { status: 'ambiguous' });
    assert.deepEqual(result('άλλο'), { status: 'missing' });
    assert.deepEqual(result('άλλο', null), { status: 'missing' });
});

const api = context.window.F1S_RESEARCH;
const clone = value => JSON.parse(JSON.stringify(value));
const form = () => ({ text: '', section: 'unverified', type: 'unverified', kind: 'general', verification: 'pending', sourceTitle: '', url: '', sourceDate: '', event: '', market: '', units: '', period: '', calculation: '', limitations: '' });
const workspace = (claims = []) => ({ version: 2, question: 'Ερώτημα α\u0301', anchor: '', season: '2026', round: '17', notes: [], form: form(), claims });
const source = overrides => ({ title: 'Πηγή', url: 'https://example.com/story?edition=1', locator: { kind: 'page', value: '2-3' }, sourceDate: '2026-10-29', excerpt: '<script>α\u0301</script>', independenceKey: 'publisher', stance: 'supports', ...overrides });
const claim = overrides => ({ id: '12345678-1234-4123-8123-123456789abc', text: '  Ισχυρισμός α\u0301  ', anchor: null, claimType: 'official-fact', status: 'unreviewed', sources: [source()], scope: { event: 'Monza', season: '2026', round: '17', session: 'race', period: { start: '', end: '' } }, numeric: null, review: null, ...overrides });
const envelope = research => ({ format: 'f1stories-research', version: 1, research });
const review = c => clone(api.assessClaim(c, 'reviewed-with-evidence', 'Αξιολόγηση πηγών', ''));

test('v1 and v2 migrate without mutation, empty normalizes to null, and imports demote reviews', () => {
    const original = workspace(), v1 = { ...original, version: 1 }; delete v1.claims;
    const saved = JSON.stringify(v1), migrated = clone(api.validateWorkspace(v1));
    assert.equal(migrated.version, 2); assert.deepEqual(migrated.claims, []); assert.equal(JSON.stringify(v1), saved);
    assert.deepEqual(clone(api.importResearch(envelope(v1))), migrated);
    const reviewed = review(claim()), v2 = workspace([reviewed]), imported = clone(api.importResearch(envelope(v2)));
    assert.equal(api.validateWorkspace(v2).claims[0].status, 'reviewed-with-evidence');
    assert.equal(imported.claims[0].status, 'stale'); assert.deepEqual(imported.claims[0].review, reviewed.review);
    assert.equal(v2.claims[0].status, 'reviewed-with-evidence');
    assert.equal(api.validateWorkspace(null), null); assert.equal(api.validateWorkspace(undefined), null);
    const empty = { ...workspace(), question: '', season: '', round: '' };
    assert.equal(api.validateWorkspace(empty), null);
    for (const bad of [{ ...v1, version: 3 }, { ...v1, claims: [] }, { ...v2, extra: 1 }, { ...envelope(v1), version: 2 }, { ...envelope(v1), extra: true }, envelope(null)]) {
        assert.throws(() => bad.format ? api.importResearch(bad) : api.validateWorkspace(bad));
    }
});

test('closed schemas reject malformed records, duplicate IDs, holes and unsafe sources', () => {
    const c = claim();
    const badClaims = [
        { ...c, id: '12345678-1234-1123-8123-123456789abc' }, { ...c, id: c.id.toUpperCase() }, { ...c, extra: 1 },
        { ...c, text: 2 }, { ...c, anchor: { quote: 'abc', prefix: '', suffix: '', start: 0, end: 2 } },
        { ...c, anchor: { quote: ' ', prefix: '', suffix: '', start: 0, end: 1 } },
        { ...c, sources: Array(1) }, { ...c, sources: [source({ url: 'javascript:alert(1)' })] },
        { ...c, sources: [source({ url: 'https://u:p@example.com/' })] }, { ...c, sources: [source({ sourceDate: '2026-02-30' })] },
        { ...c, sources: [source({ sourceDate: '2026-10-29T12:00:00' })] }, { ...c, sources: [source({ locator: { kind: 'bad', value: '' } })] },
        { ...c, sources: [source({ stance: 'unknown' })] }, { ...c, scope: { ...c.scope, round: '01' } },
        { ...c, scope: { ...c.scope, season: '', round: '1' } }, { ...c, scope: { ...c.scope, session: 'practice' } },
        { ...c, numeric: { metric: '', value: '', units: '', sample: '', method: '', originalValues: Array(1) } },
        { ...c, review: { rationale: '', reviewer: '', reviewedAt: '2026-10-29', fingerprint: '' } }
    ];
    for (const bad of badClaims) assert.throws(() => api.validateClaim(bad), JSON.stringify(bad));
    assert.throws(() => api.validateWorkspace(workspace([c, c])));
    assert.throws(() => api.validateWorkspace({ ...workspace(), claims: Array(1) }));
    const incomplete = claim({ text: '', sources: [source({ title: '', url: '', locator: { kind: '', value: '' }, sourceDate: '' })], numeric: { metric: '', value: '', units: '', sample: '', method: '', originalValues: [] } });
    assert.equal(api.validateWorkspace(workspace([incomplete])).claims[0].text, '');
});

test('review requires explicit action and usable supporting citation, with contradictions retained', () => {
    const c = claim(), checked = review(c);
    assert.equal(checked.status, 'reviewed-with-evidence'); assert.match(checked.review.reviewedAt, /^\d{4}-\d\d-\d\dT.*Z$/);
    assert.equal(c.review, null); assert.equal(clone(api.validateClaim({ ...c, status: 'reviewed-with-evidence' })).status, 'stale');
    for (const bad of [claim({ text: ' ' }), claim({ claimType: 'unsupported-hypothesis' }), claim({ sources: [] }),
        claim({ sources: [source({ title: ' ' })] }), claim({ sources: [source({ url: '' })] }),
        claim({ sources: [source({ locator: { kind: '', value: 'https://example.com' } })] }),
        claim({ sources: [source({ locator: { kind: 'page', value: '3-2' } })] }),
        claim({ sources: [source({ locator: { kind: 'paragraph', value: '0' } })] }),
        claim({ sources: [source({ locator: { kind: 'section', value: '!!' } })] }),
        claim({ sources: [source({ locator: { kind: 'timestamp', value: '1:00' } })] }),
        claim({ sources: [source({ stance: 'contradicts' })] })]) assert.throws(() => review(bad));
    assert.throws(() => api.assessClaim(c, 'reviewed-with-evidence', ' ', ''));
    for (const locator of [{ kind: 'section', value: 'P 33' }, { kind: 'row', value: 'α 12' }, { kind: 'paragraph', value: '1–2' }, { kind: 'timestamp', value: '01:02:03.500' }]) assert.equal(review(claim({ sources: [source({ locator })] })).status, 'reviewed-with-evidence');
    const predicted = claim({ claimType: 'prediction', sources: [source(), source({ stance: 'contradicts', sourceDate: '2026-10-30', excerpt: 'Αντίθετο' })] });
    const checkedPrediction = review(predicted); assert.equal(checkedPrediction.claimType, 'prediction'); assert.equal(checkedPrediction.sources[1].stance, 'contradicts');
    for (const status of ['disputed', 'insufficient']) assert.equal(api.assessClaim(c, status, 'Αιτιολογία', '').status, status);
});

test('fingerprint covers exact factual fields, ignores source order and anchor, and stale stays stale on reversion', () => {
    const c = claim({ sources: [source(), source({ url: 'https://example.org/a', stance: 'contradicts' })] }), checked = review(c), fingerprint = checked.review.fingerprint;
    assert.equal(api.claimFingerprint({ ...checked, sources: checked.sources.slice().reverse() }), fingerprint);
    assert.equal(api.claimFingerprint({ ...checked, anchor: { quote: 'α', prefix: '', suffix: '', start: 0, end: 1 }, id: 'other' }), fingerprint);
    const mutations = [
        x => x.text += ' ', x => x.claimType = 'prediction', x => x.scope.event += ' ', x => x.scope.season = '2025', x => x.scope.round = '1',
        x => x.scope.session = 'fp1', x => x.scope.period.start = '2026-01-01', x => x.scope.period.end = '2026-02-01',
        ...['title', 'url', 'sourceDate', 'excerpt', 'independenceKey', 'stance'].map(key => x => { x.sources[0][key] = key === 'url' ? 'https://different.example/a' : key === 'sourceDate' ? '2026-10-30' : key === 'stance' ? 'context' : x.sources[0][key] + 'x'; }),
        x => x.sources[0].locator.value = '4', x => x.sources[0].locator.kind = 'row',
        x => x.numeric = { metric: 'Χρόνος', value: '1.029', units: 's', sample: 'γύρος', method: 'διαφορά', originalValues: [{ label: 'α', value: '0,250' }] }
    ];
    for (const mutate of mutations) { const changed = clone(checked); mutate(changed); assert.notEqual(api.claimFingerprint(changed), fingerprint); assert.equal(api.validateClaim(changed).status, 'stale'); }
    const changed = clone(checked); changed.text += '!'; const stale = clone(api.validateClaim(changed)); stale.text = checked.text;
    assert.equal(api.validateClaim(stale).status, 'stale'); assert.equal(review(stale).status, 'reviewed-with-evidence');
    const sameURL = clone(checked); sameURL.sources[0].url = 'https://EXAMPLE.com:443/story?edition=1'; assert.equal(api.claimFingerprint(sameURL), fingerprint);
});

test('source groups merge URL and declared keys transitively without inferring corroboration', () => {
    const sources = [source({ url: 'https://example.com/story?a=1', independenceKey: 'a' }), source({ url: 'https://example.com/story?a=2#part', independenceKey: 'b' }),
        source({ url: 'https://other.example/story', independenceKey: 'b', stance: 'contradicts' }), source({ url: 'https://third.example/x', independenceKey: 'c' })];
    assert.equal(api.sourceKey(sources[0].url), 'https://example.com/story');
    assert.equal(api.newClaimSource(sources[0].url).independenceKey, 'https://example.com/story');
    assert.equal(api.newClaimSource('').independenceKey, '');
    assert.throws(() => api.newClaimSource('https://example.com/' + 'x'.repeat(200)));
    assert.deepEqual(clone(api.sourceGroups(sources)), [[0, 1, 2], [3]]);
    assert.equal(review(claim({ sources })).sources.length, 4);
});

test('numeric review requires explicit result, complete scope and operands; spellings survive round-trip', () => {
    const numeric = { metric: 'Διαφορά α\u0301', value: '1.029', units: 's', sample: '17 γύροι', method: 'Χειροκίνητη διαφορά', originalValues: [{ label: 'Α', value: '0,250' }, { label: 'Β', value: '1:31.276' }] };
    const c = claim({ claimType: 'calculated-statistic', numeric });
    assert.deepEqual(clone(api.validateWorkspace(workspace([review(c)]))).claims[0].numeric, numeric);
    for (const bad of [{ ...numeric, value: '0,250' }, { ...numeric, value: '' }, { ...numeric, metric: '' }, { ...numeric, units: '' }, { ...numeric, sample: '' }, { ...numeric, method: '' }, { ...numeric, originalValues: [] }, { ...numeric, originalValues: [{ label: '', value: '1' }] }]) assert.throws(() => review({ ...c, numeric: bad }));
    const scopes = [
        { event: '', season: '2026', round: '', session: 'season', period: { start: '', end: '' } },
        { event: '', season: '', round: '', session: 'period', period: { start: '2025-01-01', end: '2026-01-01' } }
    ];
    for (const scope of scopes) assert.equal(review({ ...c, scope }).status, 'reviewed-with-evidence');
    const unfinished = { ...c, scope: { ...scopes[1], period: { start: '2025-', end: '' } } };
    assert.equal(api.validateClaim(unfinished).scope.period.start, '2025-');
    assert.throws(() => review(unfinished));
    for (const scope of [{ ...c.scope, event: '' }, { ...c.scope, session: '' }, { ...scopes[0], event: 'Monza' },
        { ...scopes[1], period: { start: '2026-01-01', end: '2025-01-01' } }, { ...scopes[1], period: { start: '2025-01-01', end: '2026-01-01T00:00:00Z' } }]) assert.throws(() => review({ ...c, scope }));
});

test('caps reject excess rather than truncate, including the UTF-8 envelope', () => {
    const c = claim();
    for (const bad of [{ ...c, text: 'x'.repeat(4001) }, { ...c, sources: Array(9).fill(source()) },
        { ...c, sources: [source({ title: 'x'.repeat(301) })] }, { ...c, sources: [source({ excerpt: 'x'.repeat(1001) })] },
        { ...c, anchor: { quote: 'x', prefix: 'x'.repeat(65), suffix: '', start: 0, end: 1 } },
        { ...c, numeric: { metric: '', value: '', units: '', sample: '', method: '', originalValues: Array(21).fill({ label: '', value: '' }) } }]) assert.throws(() => api.validateClaim(bad));
    assert.throws(() => api.validateWorkspace(workspace(Array(101).fill(c))));
    assert.throws(() => api.validateWorkspace({ ...workspace(), notes: Array(200).fill({ ...form(), text: 'α'.repeat(6000) }) }));
});

test('each numeric field and original value affects fingerprint in recorded order', () => {
    const numeric = { metric: 'Χρόνος', value: '1.029', units: 's', sample: 'δύο γύροι', method: 'αφαίρεση', originalValues: [{ label: 'Α', value: '0,250' }, { label: 'Β', value: '1:31.276' }] };
    const checked = review(claim({ numeric }));
    for (const key of ['metric', 'value', 'units', 'sample', 'method']) {
        const changed = clone(checked); changed.numeric[key] += '1';
        assert.notEqual(api.claimFingerprint(changed), checked.review.fingerprint);
        assert.equal(api.validateClaim(changed).status, 'stale');
    }
    for (const key of ['label', 'value']) {
        const changed = clone(checked); changed.numeric.originalValues[0][key] += '1';
        assert.equal(api.validateClaim(changed).status, 'stale');
    }
    const reordered = clone(checked); reordered.numeric.originalValues.reverse();
    assert.equal(api.validateClaim(reordered).status, 'stale');
    const provenance = clone(checked); provenance.review.rationale = 'διαφορετική αιτιολογία'; provenance.review.reviewer = 'όνομα';
    assert.equal(api.claimFingerprint(provenance), checked.review.fingerprint);
});

test('all individual limits and closed nested records are enforced', () => {
    const c = claim();
    for (const [key, limit] of [['title', 300], ['url', 2048], ['sourceDate', 64], ['excerpt', 1000], ['independenceKey', 200]]) {
        assert.throws(() => api.validateClaim({ ...c, sources: [source({ [key]: 'x'.repeat(limit + 1) })] }), key);
    }
    for (const [key, limit] of [['metric', 160], ['value', 64], ['units', 32], ['sample', 500], ['method', 1000]]) {
        const numeric = { metric: '', value: '', units: '', sample: '', method: '', originalValues: [], [key]: 'x'.repeat(limit + 1) };
        assert.throws(() => api.validateClaim({ ...c, numeric }), key);
    }
    for (const [key, limit] of [['rationale', 4000], ['reviewer', 100], ['fingerprint', 65536]]) {
        const item = { rationale: '', reviewer: '', reviewedAt: '2026-10-29T12:00:00Z', fingerprint: '', [key]: 'x'.repeat(limit + 1) };
        assert.throws(() => api.validateClaim({ ...c, review: item }), key);
    }
    for (const bad of [
        { ...c, sources: [source({ locator: { kind: 'row', value: 'x'.repeat(501) } })] },
        { ...c, sources: [source({ locator: { kind: '', value: '', extra: 1 } })] },
        { ...c, scope: { ...c.scope, event: 'x'.repeat(201) } },
        { ...c, scope: { ...c.scope, period: { start: 'x'.repeat(65), end: '' } } },
        { ...c, scope: { ...c.scope, extra: 1 } },
        { ...c, numeric: { metric: '', value: '', units: '', sample: '', method: '', originalValues: [{ label: 'x'.repeat(101), value: '' }] } },
        { ...c, numeric: { metric: '', value: '', units: '', sample: '', method: '', originalValues: [{ label: '', value: 'x'.repeat(201) }] } },
        { ...c, anchor: { quote: 'x'.repeat(4001), prefix: '', suffix: '', start: 0, end: 4001 } },
        { ...c, anchor: { quote: 'x', prefix: '', suffix: 'x'.repeat(65), start: 0, end: 1 } }
    ]) assert.throws(() => api.validateClaim(bad));
});

test('pending decision migrates, is capped and cannot approve; weak locators cannot be reviewed', () => {
    const old = review(claim()); delete old.pendingDecision;
    const migrated = clone(api.validateClaim(old));
    assert.deepEqual(migrated.pendingDecision, { rationale: old.review.rationale, reviewer: old.review.reviewer });
    const pending = claim({ pendingDecision: { rationale: 'Εκκρεμεί', reviewer: 'Συντάκτης' } });
    assert.equal(api.validateWorkspace(workspace([pending])).claims[0].status, 'unreviewed');
    assert.throws(() => api.validateClaim({ ...pending, pendingDecision: { rationale: 'x'.repeat(4001), reviewer: '' } }));
    assert.throws(() => api.validateClaim({ ...pending, pendingDecision: { rationale: '', reviewer: '', extra: 1 } }));
    for (const kind of ['section', 'row']) for (const value of ['https://example.com/story', 'www.example.com/a', 'example.com/a', 'row', 'section', '  ']) {
        const weak = claim({ sources: [source({ locator: { kind, value } })] });
        assert.throws(() => review(weak), `${kind}: ${value}`);
        const forged = clone(review(claim())); forged.sources[0].locator = { kind, value };
        forged.review.fingerprint = api.claimFingerprint(forged);
        assert.equal(api.validateWorkspace(workspace([forged])).claims[0].status, 'stale');
        const imported = api.importResearch(envelope(workspace([forged]))).claims[0];
        assert.equal(imported.status, 'stale'); assert.throws(() => review(imported));
    }
});
