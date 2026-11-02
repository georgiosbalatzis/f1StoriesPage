import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTimelineSection } from '../timeline-render.mjs';

// Synthetic contexts and events; none describe actual race history.
const event = (overrides = {}) => ({ schemaVersion: 1, eventId: `tl-${'a'.repeat(64)}`, raceId: 'synthetic-gp', sessionKind: 'race', eventType: 'race-control-observation', provider: 'openf1', timestampUtc: '2026-10-25T00:59:59.123456Z', lapNumber: 1, driverNumber: null, category: 'Other', label: 'Μήνυμα', detail: 'Synthetic', sourceRefs: [{ captureId: 'synthetic-capture', recordIndex: 0 }], coverage: 'full', ...overrides });
const context = (overrides = {}) => ({ status: 'available', coverage: 'full', provider: 'openf1', session: { kind: 'race', meetingKey: 1, sessionKey: 2, windowStartUtc: '2026-10-25T00:00:00Z', windowEndUtc: '2026-10-25T03:00:00Z' }, sources: [{ endpoint: 'race_control', requestUrl: 'https://secret.example/requestUrl', observedAt: '2026-10-26T12:00:00Z', rowCount: 1, path: 'secret-path', sha256: 'secret-sha256' }], counts: { raceControl: 1, pit: 0, outOfWindow: 0, duplicates: 0 }, attribution: { name: 'OpenF1', url: 'https://openf1.org/', license: 'CC BY-NC-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' }, events: [event()], ...overrides });
const render = value => renderTimelineSection(value, { number: '03' });

test('each unavailable reason has its own text and section heading', () => {
  for (const [reason, message] of Object.entries({ unmapped: 'Δεν υπάρχει εγκεκριμένη αντιστοίχιση πηγής', uncaptured: 'Δεν υπάρχει καταγεγραμμένη απόκριση πηγής', 'rights-unresolved': 'Η δημοσίευση δεδομένων της πηγής δεν έχει εγκριθεί' })) {
    const html = render({ status: 'unavailable', reason });
    assert.ok(html.includes(message));
    assert.equal((html.match(/<h2 id="gp-timeline-title">/g) || []).length, 1);
    assert.match(html, /03 \/ ΧΡΟΝΟΛΟΓΙΟ ΑΓΩΝΑ/);
    assert.doesNotMatch(html, /<details/);
  }
});

test('empty and partial contexts explain coverage and use Greek counts', () => {
  const empty = render(context({ coverage: 'empty', counts: { raceControl: 0, pit: 0, outOfWindow: 0, duplicates: 0 }, events: [] }));
  assert.match(empty, /Οι καταγεγραμμένες αποκρίσεις δεν περιέχουν παρατηρήσεις/);
  assert.match(empty, /0 μηνύματα αγωνοδιεύθυνσης, 0 διελεύσεις/);
  assert.match(empty, /Εμφάνιση όλων των 0 καταγραφών/);
  const partial = render(context({ coverage: 'partial', counts: { raceControl: 1, pit: 1, outOfWindow: 2, duplicates: 0 } }));
  assert.match(partial, /1 μήνυμα αγωνοδιεύθυνσης, 1 διέλευση από το pit lane, 2 εκτός παραθύρου συνεδρίας/);
  assert.match(partial, /μερική/);
  assert.match(partial, /Εμφάνιση της 1 καταγραφής/);
});

test('full synthetic rows escape text, omit nulls and format Athens DST and microseconds', () => {
  const data = context({ counts: { raceControl: 1, pit: 1, outOfWindow: 0, duplicates: 0 }, events: [event({ label: '<script>label</script>', detail: '<script>detail</script>', lapNumber: null }), event({ eventType: 'pit-lane-visit', timestampUtc: '2026-10-25T01:00:00.987654Z', lapNumber: 2, driverNumber: 7, label: 'Διέλευση από το pit lane', detail: 'Χρόνος στο pit lane: 24,048 s' })] });
  const html = render(data);
  assert.equal(render(data), html);
  assert.equal((html.match(/<h2 id="gp-timeline-title">/g) || []).length, 1);
  assert.match(html, /<details class="gp-timeline-details"><summary>Εμφάνιση όλων των 2 καταγραφών<\/summary><ol class="gp-timeline-list" role="list">/);
  assert.doesNotMatch(html, /<details[^>]*\sopen(?:\s|=|>)/);
  assert.match(html, /2026-10-25T00:59:59\.123456Z">03:59:59/);
  assert.match(html, /2026-10-25T01:00:00\.987654Z">03:00:00/);
  assert.match(html, /Γύρος 2 · #7/);
  assert.doesNotMatch(html, /Γύρος null|#null|<script>/);
  assert.match(html, /&lt;script&gt;label&lt;\/script&gt;/);
  assert.match(html, /&lt;script&gt;detail&lt;\/script&gt;/);
  assert.doesNotMatch(html, /secret|sha256|captureId|requestUrl|synthetic-capture/);
  assert.match(html, /href="https:\/\/openf1\.org\/"/);
  assert.match(html, /href="https:\/\/creativecommons\.org\/licenses\/by-nc-sa\/4\.0\/"/);
});

test('invalid states, event fields, numbers and attribution URLs throw', () => {
  for (const state of [null, { status: 'unknown' }, { status: 'unavailable', reason: 'unknown' }]) assert.throws(() => render(state), TypeError);
  for (const number of ['3', '003', 3, 'a3', null]) assert.throws(() => renderTimelineSection(context(), { number }), TypeError);
  for (const bad of [{ timestampUtc: null }, { timestampUtc: 'invalid' }, { timestampUtc: '2026-10-25T00:00:00.123Z' }, { label: null }, { detail: 3 }, { lapNumber: -1 }, { driverNumber: 100 }, { eventType: 'unknown' }, { sourceRefs: [] }]) assert.throws(() => render(context({ events: [event(bad)] })), TypeError);
  for (const [key, value] of [['url', 'http://openf1.org/'], ['url', 'https://openf1.org.evil.test/'], ['url', 'https://user@openf1.org/'], ['licenseUrl', 'https://evil.test/'], ['licenseUrl', 'javascript:alert(1)']]) assert.throws(() => render(context({ attribution: { ...context().attribution, [key]: value } })), TypeError);
  assert.throws(() => render(context({ coverage: 'unknown' })), TypeError);
});
