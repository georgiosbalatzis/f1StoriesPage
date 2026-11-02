import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adaptJolpicaClassification, adaptChampionshipSnapshot, compareChampionshipSnapshots } from '../results.mjs';
import { renderResultsSection } from '../results-render.mjs';

const read = path => readFileSync(new URL(`../../../${path}`, import.meta.url));
const archive = JSON.parse(read('data/race-desk/results.v1.json'));
const registry = JSON.parse(read('data/race-desk/registry.v1.json'));
const snapshot = round => {
  const capture = archive.standings.find(c => c.round === round);
  return adaptChampionshipSnapshot({ season: 2026, round, capture, raw: read(capture.path) });
};
function context(id) {
  const binding = archive.bindings.find(b => b.raceId === id);
  const race = { ...registry.races.find(r => r.raceId === id), resultsBinding: binding };
  const classifications = Object.fromEntries(['race', 'qualifying', 'sprint'].map(sessionKind => {
    const capture = archive.captures.find(c => c.captureId === binding.captures[sessionKind]);
    return [sessionKind, adaptJolpicaClassification({ race, sessionKind, capture, raw: read(capture.path) })];
  }));
  return { classifications, comparison: compareChampionshipSnapshots({ before: snapshot(binding.round - 1), after: snapshot(binding.round) }) };
}
const count = (html, pattern) => [...html.matchAll(pattern)].length;

test('Singapore renders all classification and championship rows with accessible static tables and distinct sources', () => {
  const html = renderResultsSection(context('2026-singapore-gp'));
  assert.equal(count(html, /<tbody>/g), 5);
  assert.equal(count(html, /<tbody>[\s\S]*?<\/tbody>/g), 5);
  assert.equal(count(html, /<tr>/g), 22 * 3 + 23 + 11 + 5);
  assert.equal(count(html, /role="region" tabindex="0"/g), 5);
  assert.equal(count(html, /<caption>/g), 5);
  assert.match(html, /Κατάταξη από καταγεγραμμένη απόκριση Jolpica/);
  assert.match(html, /Καταγεγραμμένη απόκριση πηγής· δεν τεκμηριώνεται εδώ επίσημη ή οριστική κατάσταση ούτε ιστορικό τροποποιήσεων\. Η ανάκτηση δεν είναι χρόνος ισχύος αποτελέσματος\./);
  assert.match(html, /Η διαφορά μπορεί να περιλαμβάνει Sprint ή μεταβολές παλαιότερων στοιχείων· δεν αποδίδεται μόνο στον αγώνα\./);
  assert.match(html, /ανάκτηση απόκρισης:/);
  assert.match(html, /δημιουργία στιγμιοτύπου:/);
  assert.match(html, /2026-10-06T12:21:30\.084Z/);
  assert.match(html, /2026-10-12T11:47:19\.828Z/);
  assert.match(html, /github\.com\/georgiosbalatzis\/f1StoriesPage\/blob\/7b0ca4fa4b0641665e9a0d39b8e71c375f60158d\/standings\/rounds\/2026-16\.json/);
  assert.match(html, /URL περιβλήματος/); assert.match(html, /URL μέσα στα δεδομένα/);
  assert.doesNotMatch(html, /jolpica-2026-17-race|data\/race-desk\/captures/);
});

test('provider-empty and unmapped states remain visible and do not imply no sprint', () => {
  const html = renderResultsSection(context('2026-japanese-gp'));
  assert.match(html, /Δεν υπάρχουν διαθέσιμα αποτελέσματα στην καταγεγραμμένη απόκριση της πηγής/);
  assert.equal(count(html, /<tbody>/g), 4);
  const missing = { status: 'unavailable', reason: 'unmapped-race', source: null };
  const unavailable = renderResultsSection({ classifications: { race: missing, qualifying: missing, sprint: missing }, comparison: { status: 'unavailable', reason: 'missing-snapshot', source: null } });
  assert.equal(count(unavailable, /δεν υπάρχει διαθέσιμη αντιστοίχιση/gi), 3);
  assert.match(unavailable, /Δεν υπάρχουν διαθέσιμα και τα δύο στιγμιότυπα/);
  assert.doesNotMatch(unavailable, /<table|δεν έγινε sprint/i);
});

test('escaping, nulls and zeros are retained and invalid states fail the build', () => {
  const data = context('2026-japanese-gp');
  data.classifications.race.entries[0].driverName = '<script>alert(1)</script>';
  data.classifications.race.entries[0].time = null;
  data.classifications.race.entries[0].points = '0';
  data.classifications.race.source.requestUrl = 'javascript:alert(1)';
  const html = renderResultsSection(data);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>|href="javascript:/);
  assert.match(html, /<td>0<\/td>/); assert.match(html, /<td>—<\/td>/);
  assert.throws(() => renderResultsSection({ ...data, comparison: { status: 'invalid', errors: [] } }), TypeError);
  assert.throws(() => renderResultsSection({ ...data, comparison: undefined }), TypeError);
});
