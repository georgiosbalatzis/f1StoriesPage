import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPaceContext, summarizeDurations } from '../pace.mjs';

// All observations in this file are synthetic.
const id = { meeting_key: 1, session_key: 2 };
const lap = (n, extra = {}) => ({ ...id, driver_number: 6, lap_number: n, lap_duration: 100, is_pit_out_lap: false, date_start: '2026-01-01T12:01:00Z', ...extra });
const stint = (n, start, end, extra = {}) => ({ ...id, driver_number: 6, stint_number: n, lap_start: start, lap_end: end, compound: 'MEDIUM', tyre_age_at_start: 0, ...extra });
function input(overrides = {}) {
  const rows = { sessions: [{ ...id, session_name: 'Race', session_type: 'Race', year: 2026, date_start: '2026-01-01T12:00:00Z', date_end: '2026-01-01T14:00:00Z' }], laps: [lap(1), lap(2), lap(3)], stints: [stint(1, 1, 3)], drivers: [{ ...id, driver_number: 6, full_name: 'Synthetic Driver', name_acronym: 'SYN', team_name: 'Synthetic' }], pit: [], race_control: [], ...overrides };
  return { race: { raceId: 'synthetic-gp', season: 2026, sourceKeys: { openf1MeetingKey: 1 }, sessions: [{ kind: 'race', openf1SessionKey: 2, startUtc: '2026-01-01T12:00:00Z' }] }, receipts: Object.entries(rows).map(([endpoint, data]) => ({ synthetic: true, captureId: `synthetic-${endpoint}`, endpoint, raceId: 'synthetic-gp', sessionKind: 'race', provider: 'openf1', query: { session_key: 2 }, rowCount: data.length, returnedIdentity: data.length ? id : null, coverage: data.length ? 'full' : 'empty', observedAt: '2026-01-02T00:00:00Z' })), payloads: new Map(Object.entries(rows).map(([endpoint, data]) => [`synthetic-${endpoint}`, data])), rights: { providers: { openf1: { status: 'approved', pace: { status: 'approved', raceId: 'synthetic-gp', sessionKind: 'race', meetingKey: 1, sessionKey: 2 } } } } };
}
const build = rows => buildPaceContext(input(rows));
function partition(c) { for (const obj of [c, ...c.drivers, ...c.drivers.flatMap(d => d.stints)]) assert.equal(obj.counts.excluded + obj.counts.unknown + obj.counts.eligible, obj.counts.observed); }

test('summary thresholds, ties, rounding and immutable input', () => {
  // 4 values: sorted 99.9,100,100.1,101.2; median (100 + 100.1)/2 = 100.05 s.
  const a = [100.1, 99.9, 100, 101.2]; assert.deepEqual(summarizeDurations(a), { count: 4, minMs: 99900, medianMs: 100050 }); assert.deepEqual(a, [100.1, 99.9, 100, 101.2]);
  // Three ties have median 99.9995 s, rounded to 100000 ms.
  assert.deepEqual(summarizeDurations([99.9995, 99.9995, 99.9995]), { count: 3, minMs: 100000, medianMs: 100000 });
  // One value, 99.9994 s rounds to 99999 ms; median requires three.
  assert.deepEqual(summarizeDurations([99.9994]), { count: 1, minMs: 99999, medianMs: null });
  assert.deepEqual(summarizeDurations([]), { count: 0, minMs: null, medianMs: null });
  for (const a of [[0], [-1], [Infinity], [NaN], [null], ['1'], null]) assert.throws(() => summarizeDurations(a), /^Error: Invalid pace:/);
});
test('conservative policy, counts and no outlier filtering', () => {
  const c = build({ laps: [lap(1), lap(2, { lap_duration: 99 }), lap(3, { lap_duration: 999 })] }); partition(c);
  // Three observed and timed laps: opening excluded, two unknown; no eligible laps.
  assert.deepEqual(c.drivers[0].counts, { observed: 3, timed: 3, excluded: 1, unknown: 2, eligible: 0 });
  // Sorted 99,100,999 seconds: median 100 seconds, minimum 99 seconds.
  assert.deepEqual(c.drivers[0].stints[0].rawSummary, { count: 3, minMs: 99000, medianMs: 100000 });
  assert.equal(c.drivers[0].sample.status, 'unsuitable'); assert.ok(c.drivers[0].laps[1].reasonCodes.includes('neutralisation-unresolved'));
});
test('pit boundary corroboration and unsupported analogues', () => {
  const laps = Array.from({ length: 62 }, (_, i) => lap(i + 1, { is_pit_out_lap: i === 32 }));
  const pit = [{ ...id, driver_number: 6, lap_number: 32 }];
  let c = build({ laps, pit, stints: [stint(2, 33, 62), stint(1, 1, 32)] }); partition(c);
  assert.deepEqual(c.drivers[0].stints.map(s => s.integrity), ['validated', 'validated']); assert.deepEqual(c.drivers[0].stints[0].pitInLaps, [32]);
  c = build({ laps, pit, stints: [stint(1, 1, 1), stint(2, 2, 62)] }); partition(c);
  assert.deepEqual(c.drivers[0].stints.map(s => s.integrity), ['unverified', 'unverified']); assert.deepEqual(c.drivers[0].stints.map(s => s.rawSummary), [null, null]);
  assert.ok(c.drivers[0].laps[31].reasonCodes.includes('pit-in')); assert.ok(c.drivers[0].laps[32].reasonCodes.includes('pit-out'));
});
test('terminal missing duration is unassigned, metadata is never inferred', () => {
  const c = build({ laps: [lap(1), lap(2), lap(3, { lap_duration: null })], stints: [stint(1, 1, 2, { compound: 'UNKNOWN', tyre_age_at_start: 3 })] }); partition(c);
  assert.equal(c.drivers[0].laps[2].stintNumber, null); assert.equal(c.drivers[0].laps[2].durationMs, null); assert.equal(c.drivers[0].stints[0].coverage, 'partial');
  assert.equal(c.drivers[0].stints[0].compound, null); assert.equal(c.drivers[0].stints[0].tyreAgeAtStart, 3); assert.ok(c.drivers[0].laps[1].reasonCodes.includes('compound-unknown'));
});
test('duplicates, conflicts, missing ranges and invalid durations', () => {
  const c = build({ laps: [lap(1), lap(1), lap(3, { lap_duration: null }), lap(3, { lap_duration: Infinity }), lap(4, { lap_duration: 0 })], stints: [stint(1, 1, 4)] }); partition(c);
  // One exact duplicate, one conflicting key and three distinct observed keys.
  assert.equal(c.normalization.exactDuplicateRows, 1); assert.equal(c.normalization.conflictingLapKeys, 1); assert.equal(c.counts.observed, 3);
  assert.deepEqual(c.drivers[0].missingLapRanges, [{ from: 2, to: 2 }]); assert.ok(c.drivers[0].laps[1].reasonCodes.includes('lap-conflict')); assert.equal(c.drivers[0].laps[1].durationMs, null); assert.ok(c.drivers[0].laps[2].reasonCodes.includes('duration-nonpositive'));
});
test('sector tolerance, timestamps and invalid pit flag', () => {
  const c = build({ laps: [lap(1), lap(2, { duration_sector_1: 30, duration_sector_2: 30, duration_sector_3: 40.003 }), lap(3, { duration_sector_1: 30, duration_sector_2: 30, duration_sector_3: 40.004, date_start: 'bad', is_pit_out_lap: null })] });
  assert.ok(!c.drivers[0].laps[1].reasonCodes.includes('sector-sum-mismatch')); assert.ok(c.drivers[0].laps[2].reasonCodes.includes('sector-sum-mismatch')); assert.ok(c.drivers[0].laps[2].reasonCodes.includes('lap-start-invalid')); assert.ok(c.drivers[0].laps[2].reasonCodes.includes('pit-out-unknown'));
  // Two valid raw values remain, both 100 s; median requires three.
  assert.deepEqual(c.drivers[0].stints[0].rawSummary, { count: 2, minMs: 100000, medianMs: null });
});
test('identity union, overlaps, missing bounds and conflicting metadata', () => {
  const rows = { drivers: [{ ...id, driver_number: 6, full_name: 'A' }, { ...id, driver_number: 6, full_name: 'B' }, { ...id, driver_number: 8, full_name: 'A' }], laps: [lap(1), lap(2), lap(3), lap(1, { driver_number: 7 })], stints: [stint(1, 1, 2), stint(2, 2, 3), stint(1, null, null, { driver_number: 7 })] };
  const c = build(rows); partition(c); assert.deepEqual(c.drivers.map(d => d.driverNumber), [6, 7, 8]); assert.deepEqual(c.drivers.map(d => d.identity), ['conflicting', 'missing', 'verified']); assert.equal(c.drivers[0].name, null); assert.equal(c.drivers[0].laps[1].stintNumber, null); assert.equal(c.drivers[0].stints[0].integrity, 'inconsistent'); assert.equal(c.drivers[1].stints[0].integrity, 'unknown'); assert.equal(c.drivers[2].coverage, 'empty');
});
test('evidence and rights validation', () => {
  const x = input(); x.rights.providers.openf1.status = 'unresolved'; x.payloads.get('synthetic-laps')[0].driver_number = 0; assert.throws(() => buildPaceContext(x), /Invalid pace:/);
  x.payloads.get('synthetic-laps')[0].driver_number = 6; assert.equal(buildPaceContext(x).reason, 'rights-unresolved');
  x.rights.providers.openf1.status = 'approved'; x.payloads.get('synthetic-sessions')[0].session_name = 'Sprint'; assert.throws(() => buildPaceContext(x), /Invalid pace:/);
  x.race.sourceKeys.openf1MeetingKey = null; assert.equal(buildPaceContext(x).reason, 'unmapped');
  const y = input(); y.receipts = []; assert.equal(buildPaceContext(y).reason, 'uncaptured');
});
test('provider row order does not change context when source references are not diagnostic', () => {
  const a = input({ laps: [lap(2), lap(3)], stints: [stint(1, 2, 3)] }); const b = input({ laps: [lap(3), lap(2)], stints: [stint(1, 2, 3)] }); assert.deepEqual(buildPaceContext(a), buildPaceContext(b));
});

test('duration and timestamp anomalies keep ordered reasons', () => {
  const missing = lap(2); delete missing.lap_duration;
  const c = build({ laps: [lap(1), missing, lap(3, { lap_duration: '100', date_start: null }), lap(4, { lap_duration: NaN, date_start: '2026-01-01T15:00:00Z' }), lap(5, { lap_duration: -1, duration_sector_1: -2 })], stints: [stint(1, 1, 5)] }); partition(c);
  for (const [i, reason] of [[1, 'duration-missing'], [2, 'duration-invalid-type'], [3, 'duration-nonfinite'], [4, 'duration-nonpositive']]) assert.equal(c.drivers[0].laps[i].reasonCodes[0], reason);
  assert.ok(c.drivers[0].laps[2].reasonCodes.includes('lap-start-missing')); assert.ok(c.drivers[0].laps[3].reasonCodes.includes('lap-start-outside-session')); assert.ok(c.drivers[0].laps[4].reasonCodes.includes('sector-invalid'));
});
test('bad identity, bounds and receipt evidence fail even with unresolved rights', () => {
  for (const mutate of [x => { x.payloads.get('synthetic-laps')[0].lap_number = 0; }, x => { x.payloads.get('synthetic-stints')[0].lap_end = '3'; }, x => { x.payloads.get('synthetic-drivers')[0].session_key = 3; }, x => { x.payloads.get('synthetic-sessions')[0].year = 2025; }, x => { x.payloads.get('synthetic-sessions')[0].session_type = 'Sprint'; }, x => { x.receipts[0].query.session_key = 3; }]) {
    const x = input(); x.rights.providers.openf1.status = 'unresolved'; mutate(x); assert.throws(() => buildPaceContext(x), /^Error: Invalid pace:/);
  }
});
test('missing feeds, invalid intervals and reported tyre metadata remain visible', () => {
  let c = build({ stints: [] }); assert.equal(c.drivers[0].stints.length, 0); assert.ok(c.drivers[0].coverageReasons.includes('stints-missing')); assert.ok(c.drivers[0].laps[1].reasonCodes.includes('stint-unassigned'));
  c = build({ stints: [stint(1, 3, 1, { compound: null, tyre_age_at_start: null })] }); assert.equal(c.drivers[0].stints[0].integrity, 'inconsistent'); assert.equal(c.drivers[0].stints[0].rawSummary, null); assert.equal(c.drivers[0].stints[0].tyreAgeAtStart, null);
});
