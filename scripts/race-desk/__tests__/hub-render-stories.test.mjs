import test from 'node:test';
import assert from 'node:assert/strict';
import { renderHub } from '../hub-render.mjs';

const model = stories => ({ path: '/race-desk/gp/test/', displayName: 'Test GP', season: 2026, venue: {}, sessions: [], tools: [], sources: [], stories });
const story = (id = 'first') => ({ articleId: id, url: `https://f1-stories.gr/blog-module/blog-entries/${id}/article.html`, title: `Τίτλος ${id}`, date: '2026-10-08' });
const section = html => html.match(/<section class="race-desk-section race-desk-related[^>]*>[\s\S]*?<\/section>/)[0];

test('renders a story with a heading, link and Greek long date', () => {
  const html = section(renderHub(model([story()])));
  assert.match(html, /aria-labelledby="related-title"/);
  assert.match(html, /<h2 id="related-title">Σχετικά άρθρα<\/h2>[\s\S]*<ol class="race-desk-stories"><li><h3><a href="https:\/\/f1-stories\.gr\/blog-module\/blog-entries\/first\/article\.html">Τίτλος first<\/a><\/h3><time datetime="2026-10-08">8 Οκτωβρίου 2026<\/time><\/li><\/ol>/);
  assert.match(html, /επιλογή δημοσιευμένων άρθρων/);
  assert.match(html, /δεν επαληθεύει κάθε ισχυρισμό/);
});

test('preserves story order and does not expose evidence', () => {
  const first = { ...story(), sha256: 'secret-hash', quote: 'secret-quote', path: 'source.txt', reviewedRevision: 'secret-revision' };
  const html = section(renderHub(model([first, story('second')])));
  assert.ok(html.indexOf('Τίτλος first') < html.indexOf('Τίτλος second'));
  assert.equal((html.match(/<li>/g) ?? []).length, 2);
  assert.doesNotMatch(html, /secret-hash|secret-quote|source\.txt|secret-revision|sha256|reviewedRevision/);
});

test('keeps an honest empty section and the correct section number', () => {
  const race = model([]), html = section(renderHub(race));
  assert.match(html, /03 \/ ΙΣΤΟΡΙΕΣ/);
  assert.match(html, /Δεν έχουν καταγραφεί ακόμη επιμελημένοι σύνδεσμοι/);
  assert.doesNotMatch(html, /<ol|δεν υπάρχουν σχετικά/i);
  const unavailable = { status: 'unavailable', reason: 'unmapped-race' };
  race.results = { classifications: { race: unavailable, qualifying: unavailable, sprint: unavailable }, comparison: { status: 'unavailable', reason: 'missing-snapshot' } };
  assert.match(section(renderHub(race)), /04 \/ ΙΣΤΟΡΙΕΣ/);
});

test('requires an array of stories', () => {
  for (const value of [undefined, null, {}, 'stories']) assert.throws(() => renderHub(model(value)), TypeError);
});

test('escapes story title HTML', () => {
  const html = section(renderHub(model([{ ...story(), title: '<script>alert("x")</script>' }])));
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('rejects unsafe or mismatched story URLs', () => {
  const path = '/blog-module/blog-entries/first/article.html';
  for (const url of ['javascript:alert(1)', `http://f1-stories.gr${path}`, `https://other.example${path}`, 'https://f1-stories.gr/blog-module/blog-entries/%2e%2e/first/article.html', `https://f1-stories.gr${path}?x=1`, `https://f1-stories.gr${path}#x`, `https://user@f1-stories.gr${path}`, `https://f1-stories.gr${path}?`]) {
    assert.throws(() => renderHub(model([{ ...story(), url }])), TypeError, url);
  }
  assert.doesNotThrow(() => renderHub(model([{ ...story(), url: `https://example.org${path}` }]), { origin: 'https://example.org' }));
});

test('rejects invalid dates and empty titles', () => {
  for (const date of ['2026-02-29', '2026-13-01', '2026-1-01', '']) assert.throws(() => renderHub(model([{ ...story(), date }])), TypeError);
  for (const title of ['', '  ', null]) assert.throws(() => renderHub(model([{ ...story(), title }])), TypeError);
});
