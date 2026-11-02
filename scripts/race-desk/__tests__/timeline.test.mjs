import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildTimelineContext } from '../timeline.mjs';

// All identities, timestamps, and messages below are synthetic.
const identity = { meeting_key: 1, session_key: 2 };
const race = () => ({ raceId: 'synthetic-gp', sourceKeys: { openf1MeetingKey: 1 }, sessions: [{ kind: 'race', openf1SessionKey: 2 }] });
const control = (date = '2026-01-01T12:00:12Z', extra = {}) => ({ ...identity, date, lap_number: 1, driver_number: null, category: 'Flag', message: 'synthetic', ...extra });
const pit = (date = '2026-01-01T12:00:12Z', extra = {}) => ({ ...identity, date, lap_number: 1, driver_number: 1, lane_duration: 24.048, stop_duration: 2.5, ...extra });
function input(rc = [], p = []) {
  const records = { sessions: [{ ...identity, session_name: 'Race', session_type: 'Race', date_start: '2026-01-01T12:00:00Z', date_end: '2026-01-01T13:00:00+00:00' }], race_control: rc, pit: p };
  return { race: race(), rights: { providers: { openf1: { status: 'approved' } } }, receipts: Object.entries(records).map(([endpoint, rows]) => ({ synthetic: true, captureId: `synthetic-${endpoint}`, endpoint, raceId: 'synthetic-gp', sessionKind: 'race', provider: 'openf1', query: { session_key: 2 }, sha256: 'a'.repeat(64), rowCount: rows.length, returnedIdentity: rows.length ? identity : null, requestUrl: `https://example.test/${endpoint}`, observedAt: '2026-01-02T00:00:00Z' })), payloads: new Map(Object.entries(records).map(([k, v]) => [`synthetic-${k}`, v])) };
}
const build = (rc, p) => buildTimelineContext(input(rc, p));

test('unmapped, uncaptured and rights unresolved', () => {
  const x = input(); x.race.sourceKeys.openf1MeetingKey = null; assert.equal(buildTimelineContext(x).reason, 'unmapped');
  x.race = race(); x.receipts = []; assert.equal(buildTimelineContext(x).reason, 'uncaptured');
  x.receipts = input().receipts; x.rights.providers.openf1.status = 'unresolved'; assert.equal(buildTimelineContext(x).reason, 'rights-unresolved');
});
test('empty valid responses', () => { const c = build(); assert.equal(c.coverage, 'empty'); assert.deepEqual(c.events, []); });
test('window filtering and missing endpoint give partial coverage', () => {
  const x = input([control('2026-01-01T11:59:59Z'), control()]); x.receipts.pop();
  const c = buildTimelineContext(x); assert.equal(c.coverage, 'partial'); assert.equal(c.counts.outOfWindow, 1); assert.equal(c.events.length, 1);
});
test('exact duplicates collapse and preserve refs', () => {
  const row = control(); const c = build([row, { ...row }]); assert.equal(c.counts.duplicates, 1); assert.deepEqual(c.events[0].sourceRefs.map(r => r.recordIndex), [0, 1]);
});
test('near duplicates remain distinct', () => assert.equal(build([control(), control(undefined, { message: 'different' })]).events.length, 2));
test('same microsecond ties follow endpoint then source order', () => {
  const c = build([control(undefined, { message: 'first' }), control(undefined, { message: 'second' })], [pit()]);
  assert.deepEqual(c.events.map(e => e.detail), ['first', 'second', 'Χρόνος στο pit lane: 24,048 s · ακινητοποίηση: 2,5 s']);
});
test('shuffled input preserves chronological content while provenance follows row indexes', () => {
  const rows = [control('2026-01-01T12:00:01Z'), control('2026-01-01T12:00:02Z')];
  const content = c => c.events.map(({ eventId, sourceRefs, ...event }) => event);
  assert.deepEqual(content(build(rows)), content(build([...rows].reverse())));
});
test('microsecond ordering and offset normalization', () => {
  const c = build([control('2026-01-01T14:00:12.000010+02:00'), control('2026-01-01T12:00:12.000001Z')]);
  assert.deepEqual(c.events.map(e => e.timestampUtc), ['2026-01-01T12:00:12.000001Z', '2026-01-01T12:00:12.000010Z']);
});
test('invalid or missing timestamps throw', () => {
  for (const value of [null, undefined, 1, '2026-02-30T12:00:00Z', '2026-01-01T12:00:00', '2026-01-01T12:00:00.1234567Z']) assert.throws(() => build([control(value === undefined ? null : value)]));
});
test('lap zero and null are valid; negative lap throws', () => {
  assert.deepEqual(build([control(undefined, { lap_number: 0 }), control(undefined, { lap_number: null })]).events.map(e => e.lapNumber), [0, null]);
  assert.throws(() => build([control(undefined, { lap_number: -1 })]));
});
test('track-wide driver may be null and out-of-range drivers throw', () => {
  assert.equal(build([control()]).events[0].driverNumber, null);
  for (const n of [0, 100, -1]) assert.throws(() => build([control(undefined, { driver_number: n })]));
});
test('unknown category has generic label', () => assert.equal(build([control(undefined, { category: 'synthetic-unknown' })]).events[0].label, 'Μήνυμα'));
test('pit durations, fallback, zero and invalid values', () => {
  const c = build([], [pit(undefined, { lane_duration: null, pit_duration: 0, stop_duration: 0 })]);
  assert.equal(c.events[0].detail, 'Χρόνος στο pit lane: 0 s · ακινητοποίηση: 0 s');
  assert.equal(build([], [pit(undefined, { pit_duration: 24.048 })]).events.length, 1);
  for (const extra of [{ pit_duration: 3 }, { lane_duration: -1 }, { stop_duration: -1 }, { pit_duration: NaN }]) assert.throws(() => build([], [pit(undefined, extra)]));
});
test('hostile message is preserved as plain text', () => { const message = '<script>alert("synthetic")</script>'; assert.equal(build([control(undefined, { message })]).events[0].detail, message); });
test('message above documented 2000 character cap throws deterministically', () => { const rows = [control(undefined, { message: 'x'.repeat(50000) })]; assert.throws(() => build(rows), /message/); assert.throws(() => build(rows), /message/); });
test('returned identity mismatch or another race throws', () => {
  const x = input([control()]); x.receipts[1].returnedIdentity = { ...identity, session_key: 3 }; assert.throws(() => buildTimelineContext(x));
  x.receipts[1].returnedIdentity = identity; x.receipts[1].raceId = 'other'; assert.throws(() => buildTimelineContext(x));
});
test('sprint session and receipt kind mismatch throw', () => {
  const x = input(); x.payloads.get('synthetic-sessions')[0].session_name = 'Sprint'; assert.throws(() => buildTimelineContext(x));
  x.payloads.get('synthetic-sessions')[0].session_name = 'Race'; x.receipts[0].sessionKind = 'sprint'; assert.throws(() => buildTimelineContext(x));
});
test('event IDs are deterministic and repeated runs deep equal', () => {
  const x = input([control()]); const a = buildTimelineContext(x); assert.deepEqual(a, buildTimelineContext(x));
  const expected = createHash('sha256').update(['synthetic-gp', 'race', 'openf1', 'race_control', 'a'.repeat(64), 0].join('|')).digest('hex'); assert.equal(a.events[0].eventId, `tl-${expected}`);
});

test('unresolved rights do not hide malformed captured rows', () => {
  const x = input([control(null)], [pit(undefined, { stop_duration: -1 })]);
  x.rights.providers.openf1.status = 'unresolved';
  assert.throws(() => buildTimelineContext(x), /timestamp/);
  x.payloads.get('synthetic-race_control')[0].date = '2026-01-01T12:00:00Z';
  assert.throws(() => buildTimelineContext(x), /duration/);
});
