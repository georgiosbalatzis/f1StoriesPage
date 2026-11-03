import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateRegistry } from '../core/index.mjs';
import { gatewayDigest, selectGateways, validateGatewayManifest } from '../gateway.mjs';

const read = file => JSON.parse(readFileSync(new URL(`../../../${file}`, import.meta.url)));
const registry = read('data/race-desk/registry.v1.json');
const realEditorial = read('data/race-desk/editorial.v1.json');
const realManifest = read('data/audience/race-gateways.v1.json');
const raceId = '2026-singapore-gp';
const editorialManifest = { schemaVersion: 1, associations: [{ articleId: 'synthetic-article', raceId }] };
const model = id => ({ raceId: id, sessions: [{}], stories: [{ articleId: 'synthetic-article', url: '/synthetic/', title: 'Synthetic', date: '2026-01-01' }], timeline: { status: 'available' }, pace: { status: 'available' }, results: { classifications: { race: { status: 'available' } } }, tools: ['grid', 'telemetry', 'ghostcar', 'tyres'].map(target => ({ target, label: target, kind: 'exact', url: `https://example.test/${target}`, notice: null })) });
const gateway = () => ({ raceId, status: 'published', title: 'Synthetic title', intro: 'Synthetic intro.', perspectives: [
  { kind: 'before', text: 'Synthetic before.', links: [{ ref: 'article', articleId: 'synthetic-article' }, { ref: 'tool', target: 'tyres', kind: 'exact' }] },
  { kind: 'weekend', text: 'Synthetic weekend.', links: [{ ref: 'section', section: 'schedule' }, { ref: 'section', section: 'results' }] },
  { kind: 'after', text: 'Synthetic after.', links: [{ ref: 'section', section: 'timeline' }, { ref: 'section', section: 'pace' }, { ref: 'section', section: 'stories' }, { ref: 'section', section: 'sources' }] },
], revised: '2026-01-01', review: { status: 'approved', kind: 'human', by: 'SYNTHETIC TEST', date: '2026-01-01', contentSha256: '0'.repeat(64) } });
const approve = g => { g.review.contentSha256 = gatewayDigest(g); return g; };
const inputs = () => ({ manifest: { version: 1, gateways: [approve(gateway())] }, registry, editorialManifest, models: [model(raceId)], today: '2026-11-03' });
const select = input => selectGateways(input)[0];
const codes = input => select(input).reasons.map(reason => reason.code);
const invalid = change => { const input = inputs(); change(input.manifest.gateways[0], input); assert.throws(() => select(input), /gateways:/); };

test('eligible gateway resolves copied links without mutating inputs', () => {
  const input = inputs(), before = structuredClone(input), result = select(input);
  assert.equal(result.eligible, true);
  assert.deepEqual(result.view.perspectives[0].links[0], { type: 'article', articleId: 'synthetic-article', url: '/synthetic/', title: 'Synthetic', date: '2026-01-01' });
  result.view.perspectives[0].links[0].title = 'changed';
  assert.deepEqual(input, before);
});

test('real draft manifest validates and is withheld', () => {
  validateGatewayManifest(realManifest, { registry, editorialManifest: realEditorial });
  const models = realManifest.gateways.map(g => model(g.raceId));
  const selected = selectGateways({ manifest: realManifest, registry, editorialManifest: realEditorial, models, today: '2026-11-03' });
  // Production eligibility is gated in gateway-publication.test.mjs on the real models; here only drafts are checked.
  assert.ok(selected.filter(item => item.status !== 'published').every(item => !item.eligible && item.reasons.some(reason => reason.code === 'status')));
});

test('strict structural validation', () => {
  const mutations = [
    g => { g.extra = true; }, g => { g.title = 'x'.repeat(91); }, g => { g.intro = 'x\n'; },
    g => { g.title = ' title'; }, (g, i) => { i.manifest.version = 2; },
    g => { g.raceId = '2026-unknown-gp'; }, g => { g.perspectives.reverse(); },
    g => { g.perspectives[1].kind = 'before'; },
    g => { g.perspectives[0].links = Array(6).fill({ ref: 'section', section: 'sources' }); },
    g => { g.perspectives[0].links = [{ ref: 'section', section: 'results' }]; },
    g => { g.perspectives[0].links = [{ ref: 'tool', target: 'tyres', kind: 'exact' }, { ref: 'tool', target: 'tyres', kind: 'generic' }]; },
    g => { delete g.review; }, g => { delete g.review.by; }, g => { g.review.date = '2025-12-31'; },
    g => { g.perspectives[0].links[0].articleId = 'missing'; },
    (g, i) => { i.manifest.gateways.push({ ...structuredClone(g), status: 'retired', retired: { date: '2026-01-02', reason: 'Synthetic' } }); },
    g => { g.revised = '2026-02-30'; },
  ];
  for (const mutation of mutations) invalid(mutation);
});

test('approval and digest changes with content and ordering', () => {
  let input = inputs(); input.manifest.gateways[0].review = { status: 'pending' }; assert.ok(codes(input).includes('approval'));
  for (const mutate of [g => { g.title += '!'; }, g => { g.perspectives[0].links.reverse(); }, g => { g.perspectives[0].links[1].kind = 'generic'; }]) {
    input = inputs(); mutate(input.manifest.gateways[0]); assert.ok(codes(input).includes('digest'));
  }
  input = inputs(); input.manifest.gateways[0].review.date = '2026-12-31'; assert.ok(codes(input).includes('approval-date'));
  input = inputs(); input.manifest.gateways[0].revised = '2026-12-01'; input.manifest.gateways[0].review.date = '2026-12-01'; assert.ok(codes(input).includes('revised'));
  input = inputs(); input.manifest.gateways[0].review.date = '2026-12-31'; input.today = '2027-01-01'; assert.equal(select(input).eligible, true);
  input.today = 'invalid'; assert.throws(() => select(input), /gateways:/);
});

test('retirement reserves identity but skips association and reference resolution', () => {
  const input = inputs(), g = input.manifest.gateways[0];
  g.status = 'retired'; g.retired = { date: '2026-01-02', reason: 'Synthetic' }; g.perspectives[0].links[0].articleId = 'gone';
  input.models = []; assert.deepEqual(codes(input), ['status', 'digest']);
});

test('section and article evidence is required for the entire gateway', () => {
  for (const mutate of [m => { m.stories = []; }, m => { m.sessions = []; }, m => { delete m.results; }, m => { m.timeline.status = 'unavailable'; }, m => { m.pace.status = 'unavailable'; }]) {
    const input = inputs(); mutate(input.models[0]); assert.ok(codes(input).includes('evidence')); assert.equal(select(input).view, null);
  }
  const input = inputs(); delete input.models[0].timeline; assert.throws(() => select(input), /missing public model context/);
});

test('tool expectations match planner kind and safe HTTPS URL', () => {
  for (const kind of ['partial', 'generic']) {
    const input = inputs(); input.models[0].tools.find(t => t.target === 'tyres').kind = kind;
    assert.ok(codes(input).includes('tool'));
    input.manifest.gateways[0].perspectives[0].links[1].kind = kind; approve(input.manifest.gateways[0]); assert.equal(select(input).eligible, true);
  }
  for (const url of ['http://example.test/', 'https://user:pass@example.test/', 'javascript:alert(1)']) {
    const input = inputs(); input.models[0].tools[3].url = url; assert.ok(codes(input).includes('tool'));
  }
  const input = inputs(); input.models[0].tools.forEach(t => { t.kind = 'generic'; }); assert.ok(codes(input).includes('tool'));
  input.manifest.gateways[0].perspectives[0].links[1].kind = 'generic'; approve(input.manifest.gateways[0]); assert.equal(select(input).eligible, true);
});

test('registered non-public race is withheld and reasons are ordered', () => {
  const input = inputs(), extra = structuredClone(registry.races[0]); extra.raceId = '2026-synthetic-gp'; extra.sourceKeys = { openf1MeetingKey: null, jolpica: null, tyresRaceId: null, tyresSlug: null }; extra.evidence = extra.evidence.filter(claim => !claim.field.startsWith('sourceKeys.'));
  const extended = structuredClone(registry); extended.races.push(extra);
  assert.equal(validateRegistry(extended).valid, true);
  input.registry = extended; const g = input.manifest.gateways[0]; g.raceId = extra.raceId; g.status = 'draft'; g.review = { status: 'pending' }; g.revised = '2026-12-01'; g.perspectives[0].links.shift();
  assert.deepEqual(codes(input), ['status', 'approval', 'revised', 'hub']);
});

test('selection is sorted and reason categories remain ordered', () => {
  const input = inputs(), second = structuredClone(input.manifest.gateways[0]); second.raceId = '2026-mexican-gp'; second.perspectives[0].links.shift(); second.status = 'draft'; second.review = { status: 'pending' }; input.manifest.gateways.unshift(second); input.models.push(model(second.raceId));
  assert.deepEqual(selectGateways(input).map(item => item.raceId), ['2026-mexican-gp', raceId]);
  const g = input.manifest.gateways[1]; g.status = 'draft'; g.review.date = '2026-12-01'; g.title += '!'; g.revised = '2026-12-01'; input.models[0].sessions = []; input.models[0].tools[3].kind = 'generic';
  const result = selectGateways(input)[1]; assert.deepEqual(result.reasons.map(r => r.code), ['status', 'approval-date', 'digest', 'revised', 'evidence', 'tool']);
});
