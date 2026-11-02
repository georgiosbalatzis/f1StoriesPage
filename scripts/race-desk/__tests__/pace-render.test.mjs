import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { renderPaceSection } from '../pace-render.mjs';
import { context } from './fixtures/pace-render/synthetic-context.mjs';
const render = c => renderPaceSection(c, { number: '04' });

test('unavailable states and invalid numbering', () => {
  for (const reason of ['unmapped', 'uncaptured', 'rights-unresolved']) assert.match(render({ schemaVersion: 1, raceId: 'synthetic', status: 'unavailable', reason }), /<section /);
  assert.throws(() => render({ schemaVersion: 1, raceId: 'synthetic', status: 'unavailable', reason: 'other' }), TypeError);
  for (const number of [4, '4', '004', null]) assert.throws(() => renderPaceSection(context(), { number }), TypeError);
});

test('accessible tables, caveats, attribution, escaping and formatting', () => {
  const html = render(context());
  assert.match(html, /ΡΥΘΜΟΣ ΑΓΩΝΑ &amp; STINTS/);
  assert.match(html, /Περιγραφική σύνοψη καταγεγραμμένων χρόνων γύρων\. Οι χρόνοι περιλαμβάνουν διαφορετικές συνθήκες, pit και πιθανή εξουδετέρωση\. Δεν αποτελούν σύγκριση οδηγών ή γομών\./);
  assert.match(html, /Δεν έχει τεκμηριωθεί η αντιστοίχιση των μηνυμάτων εξουδετέρωσης στους γύρους κάθε οδηγού\. Δεν παρουσιάζεται δείγμα επιβεβαιωμένων καθαρών γύρων\./);
  assert.match(html, /99,187 s/); assert.match(html, /100,050 s/); assert.match(html, /Μη διαθέσιμος/); assert.match(html, /Μη διαθέσιμη/); assert.match(html, /<td>0<\/td>/);
  assert.match(html, /&lt;script&gt;&quot;&amp;/); assert.doesNotMatch(html, /<script|secret-path|secret-capture|undefined|null|<svg|<img|\son\w+=/);
  assert.match(html, /https:\/\/openf1\.org\//); assert.match(html, /CC BY-NC-SA 4\.0/); assert.match(html, /<time datetime="2026-01-02">/); assert.match(html, /<time datetime="2026-01-03">/);
  // 1 section, 1 h2, 1 closed driver disclosure and 2 captioned tables (overview + the driver lap table).
  assert.equal((html.match(/<section\b/g) || []).length, 1); assert.equal((html.match(/<h2\b/g) || []).length, 1); assert.equal((html.match(/<details\b/g) || []).length, 1); assert.doesNotMatch(html, /<details[^>]*\bopen\b/); assert.equal((html.match(/<caption>/g) || []).length, 2);
  assert.doesNotMatch(html, /<th\b(?! scope="(?:col|row)")/);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]); assert.equal(ids.length, new Set(ids).size);
});

test('suppresses unsupported summaries and unverified identities', () => {
  for (const state of ['unverified', 'inconsistent', 'unknown']) {
    const c = context(); c.drivers[0].stints[0].integrity = state;
    const html = render(c); assert.doesNotMatch(html, /99,187 s \(n=/); assert.match(html, /99,187 s/);
  }
  const c = context(); c.drivers[0].identity = 'missing'; assert.doesNotMatch(render(c), /&lt;script&gt;/);
});

test('empty state, missing range and distinct source dates', () => {
  const c = context(); c.coverage = 'empty'; c.counts = { observed: 0, timed: 0, excluded: 0, unknown: 0, eligible: 0 }; c.drivers = [];
  assert.match(render(c), /χωρίς παρατηρήσεις/); assert.match(render(c), /Δείγμα: κενό/);
  assert.match(render(context()), /Γύροι που λείπουν: 3/);
});

test('rejects invalid context and metrics', () => {
  const mutations = [c => { c.counts.eligible = 1; }, c => { c.drivers[0].counts.unknown = 1; }, c => { c.drivers[0].stints[0].counts.excluded = 0; }, c => { c.drivers[0].laps[0].eligibility = 'ELIGIBLE'; }, c => { c.drivers[0].laps[0].reasonCodes = ['invented']; }, c => { c.coverageReasons = ['invented']; }, c => { c.drivers[0].stints[0].rawSummary.medianMs = 100000; }, c => { c.drivers[0].laps[1].durationMs = 0; }, c => { c.sources[0].observedAt = '2026-02-30T00:00:00Z'; }, c => { c.attribution.url += 'evil'; }, c => { c.drivers[0].stints[0].pitInLaps = [8]; }];
  for (const mutate of mutations) { const c = context(); mutate(c); assert.throws(() => render(c), TypeError); }
});

test('synthetic 22-driver by 62-lap size', t => {
  const c = context();
  c.drivers = Array.from({ length: 22 }, (_, i) => {
    const d = structuredClone(context().drivers[0]); d.driverNumber = i + 1; d.name = `Synthetic ${i + 1}`;
    d.laps = Array.from({ length: 62 }, (_, j) => ({ lapNumber: j + 1, stintNumber: 1, durationMs: 99187, eligibility: 'UNKNOWN', reasonCodes: ['neutralisation-unresolved'] }));
    // 62 observed = 0 excluded + 62 unknown + 0 eligible; all 62 timed.
    d.counts = { observed: 62, timed: 62, excluded: 0, unknown: 62, eligible: 0 }; d.lapRange = { first: 1, last: 62 }; d.missingLapRanges = [];
    d.stints[0].counts = { ...d.counts }; d.stints[0].lapEnd = 62; d.stints[0].missingLapRanges = []; d.stints[0].rawSummary = { count: 62, minMs: 99187, medianMs: 99187 };
    return d;
  });
  // 22 × 62 = 1,364 observed, timed and unknown laps.
  c.counts = { observed: 1364, timed: 1364, excluded: 0, unknown: 1364, eligible: 0 };
  const html = render(c); t.diagnostic(`synthetic HTML: ${Buffer.byteLength(html)} bytes raw, ${gzipSync(html).length} bytes gzip`);
});
