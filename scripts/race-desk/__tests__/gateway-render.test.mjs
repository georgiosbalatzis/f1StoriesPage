import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { renderHub } from '../hub-render.mjs';
import { renderGatewaySection, applyGatewayTargets } from '../gateway-render.mjs';
import { GATEWAY_SECTIONS } from '../hub-presentation.mjs';

const model = () => ({ path: '/race-desk/gp/test/', displayName: 'Test GP', season: 2026, venue: {}, sessions: [], tools: [], sources: [], stories: [], timeline: { status: 'unavailable', reason: 'unmapped' }, pace: { schemaVersion: 1, raceId: 'test', status: 'unavailable', reason: 'unmapped' } });
const article = { type: 'article', articleId: 'synthetic', url: 'https://example.org/article', title: `Article < > & " '`, date: '2026-10-08' };
const tool = (target, kind) => ({ type: 'tool', target, kind, url: 'https://example.org/tool?a=1&b=2', label: target.toUpperCase(), notice: 'Synthetic notice' });
const view = () => ({ raceId: 'test', title: `Title < > & " '`, intro: `Intro < > & " '`, perspectives: [
  { kind: 'before', text: `Text < > & " '`, links: [article, { type: 'section', section: 'schedule' }, tool('tyres', 'exact')] },
  { kind: 'weekend', text: 'Weekend', links: [tool('grid', 'generic')] },
  { kind: 'after', text: 'After', links: [{ type: 'section', section: 'pace' }, { type: 'section', section: 'stories' }] },
] });

test('renders escaped, structured reading guide and shared tool notes', () => {
  const html = renderGatewaySection(view());
  for (const text of ['Title', 'Intro', 'Text', 'Article']) assert.ok(html.includes(`${text} &lt; &gt; &amp; &quot; &#39;`));
  assert.match(html, /<h2 id="gateway-title">/);
  assert.equal((html.match(/<h2\b/g) ?? []).length, 1);
  assert.equal((html.match(/<h3\b/g) ?? []).length, 3);
  assert.match(html, /<time datetime="2026-10-08">8 Οκτωβρίου 2026<\/time>/);
  assert.match(html, /href="#gateway-target-schedule">Οι περίοδοι/);
  assert.match(html, /href="https:\/\/example.org\/tool\?a=1&amp;b=2" lang="en"/);
  assert.match(html, /Γενική προβολή/);
  assert.match(html, /Προεπισκόπηση TYRES, όχι μετρημένα αποτελέσματα αγώνα\./);
  assert.doesNotMatch(html, /<table|<img|<script|live|ζωντανά|σε εξέλιξη|↗/i);
  assert.doesNotMatch(html, /μόνο τις οπτικές/);
  assert.match(renderGatewaySection({ ...view(), perspectives: view().perspectives.slice(0, 2) }), /μόνο τις οπτικές/);
  assert.match(renderGatewaySection({ ...view(), perspectives: view().perspectives.slice(0, 1) }), /μόνο τις οπτικές/);
});

test('gateway changes only the inserted section and referenced section attributes', () => {
  const base = renderHub(model()), gateway = view(), html = renderHub({ ...model(), gateway });
  assert.ok(html.includes(`</header>${renderGatewaySection(gateway)}`));
  assert.ok(html.indexOf('<h1>') < html.indexOf('<h2 id="gateway-title">'));
  assert.ok(html.indexOf('<h2 id="gateway-title">') < html.indexOf('<h3>Πριν από τον αγώνα'));
  assert.equal((html.match(/ id="gateway-target-/g) ?? []).length, 3);
  let restored = html.replace(renderGatewaySection(gateway), '');
  for (const section of ['schedule', 'pace', 'stories']) restored = restored.replace(` id="gateway-target-${section}"`, '');
  assert.equal(restored, base);
  assert.equal(createHash('sha256').update(base).digest('hex'), '1f78b1d9d65885551160aa8116e83baf5d7477002bef17d785484ac6ff6e8dea');
});

test('section labels agree with a rendered hub', () => {
  const html = readFileSync(new URL('../../../race-desk/gp/2026-singapore-gp/index.html', import.meta.url), 'utf8');
  for (const { headingId, label } of Object.values(GATEWAY_SECTIONS)) {
    const heading = html.match(new RegExp(`<h2 id="${headingId}">([^<]+)</h2>`));
    assert.ok(heading, headingId);
    assert.equal(heading[1].replaceAll('&amp;', '&'), label);
  }
});

test('rejects invalid views and unsafe tool URLs', () => {
  const invalid = [null, {}, { ...view(), title: '' }, { ...view(), extra: true }, { ...view(), perspectives: [] }, { ...view(), perspectives: [{ kind: 'other', text: 'x', links: [] }] }];
  for (const value of invalid) assert.throws(() => renderGatewaySection(value), TypeError);
  for (const link of [{ type: 'section', section: 'bad' }, { type: 'other' }, ...['http://example.org', 'javascript:alert(1)', 'https://user:pass@example.org'].map(url => ({ ...tool('grid', 'exact'), url }))]) {
    const bad = view(); bad.perspectives[0].links = [link];
    assert.throws(() => renderGatewaySection(bad), TypeError);
  }
  const duplicate = view(); duplicate.perspectives[0].links = [tool('tyres', 'exact'), tool('tyres', 'generic')];
  assert.throws(() => renderGatewaySection(duplicate), TypeError);
});

test('target insertion fails for missing, duplicate, and preexisting targets', () => {
  const gateway = view(), base = renderHub(model());
  assert.throws(() => applyGatewayTargets(base.replace('aria-labelledby="schedule-title">', 'aria-labelledby="missing">'), gateway), TypeError);
  assert.throws(() => applyGatewayTargets(base + '<section class="race-desk-section" aria-labelledby="schedule-title">', gateway), TypeError);
  assert.throws(() => applyGatewayTargets(base + '<div id="gateway-target-schedule">', gateway), TypeError);
});
