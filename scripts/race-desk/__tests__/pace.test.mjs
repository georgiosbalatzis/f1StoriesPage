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

test('out-of-window control rows do not imply partial source coverage', () => {
  const c = build({ race_control: [{ ...id, date: '2026-01-01T11:59:00Z' }] });
  // One control row falls before the session.
  assert.equal(c.normalization.outOfWindowControlRows, 1);
  assert.ok(!c.coverageReasons.includes('source-partial'));
  const x = input(); x.receipts.find(r => r.endpoint === 'laps').coverage = 'partial';
  assert.ok(buildPaceContext(x).coverageReasons.includes('source-partial'));
});

test('all provider row orderings preserve diagnostics apart from source references', () => {
  const rows = {
    drivers: [{ ...id, driver_number: 6, full_name: 'A' }, { ...id, driver_number: 6, full_name: 'B' }, { ...id, driver_number: 6, full_name: 'A' }],
    laps: [lap(1), lap(1), lap(2, { lap_duration: null }), lap(2, { lap_duration: NaN }), lap(3, { date_start: 'bad' })],
    stints: [stint(2, 2, 3), stint(1, 1, 1), stint(1, 1, 1)],
    pit: [{ ...id, driver_number: 6, lap_number: 1 }, { ...id, driver_number: 6, lap_number: 2 }],
    race_control: [{ ...id, date: '2026-01-01T11:59:00Z' }, { ...id, date: '2026-01-01T12:01:00Z' }]
  };
  const clean = c => { for (const d of c.diagnostics) delete d.sourceRefs; return c; };
  const reversed = Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, [...value].reverse()]));
  assert.deepEqual(clean(build(rows)), clean(build(reversed)));
});

test('roster union keeps number identities separate and validates numbers', () => {
  const c = build({ drivers: [{ ...id, driver_number: 6, name_acronym: 'SYN' }, { ...id, driver_number: 8, name_acronym: 'SYN' }, { ...id, driver_number: 9, name_acronym: 'ONLY' }], laps: [lap(1), lap(2, { driver_number: 7 })], stints: [stint(1, 1, 1), stint(1, 1, 3, { driver_number: 8 })] });
  partition(c);
  // Union of roster 6,8,9 and lap driver 7 has four separate numbers.
  assert.deepEqual(c.drivers.map(d => d.driverNumber), [6, 7, 8, 9]);
  assert.equal(c.drivers[1].identity, 'missing'); assert.equal(c.drivers[1].name, null);
  // Driver 7 has no reported stints: zero rows.
  assert.equal(c.drivers[1].stints.length, 0); assert.ok(c.drivers[1].laps[0].reasonCodes.includes('stint-unassigned'));
  assert.equal(c.drivers[2].coverage, 'empty'); assert.equal(c.drivers[2].stints[0].coverage, 'empty');
  assert.equal(c.drivers[3].coverage, 'empty'); assert.equal(c.drivers[0].acronym, c.drivers[2].acronym);
  for (const endpoint of ['drivers', 'laps', 'stints']) for (const number of [0, 100, '7']) {
    const x = input(); x.payloads.get(`synthetic-${endpoint}`)[0].driver_number = number;
    assert.throws(() => buildPaceContext(x), /driver number/);
  }
});

test('duration variants, sector tolerance and timestamp uncertainty', () => {
  const missing = lap(2); delete missing.lap_duration;
  const noDate = lap(10); delete noDate.date_start;
  const c = build({ laps: [lap(1, { lap_duration: null }), missing, lap(3, { lap_duration: '100' }), lap(4, { lap_duration: NaN }), lap(5, { lap_duration: Infinity }), lap(6, { lap_duration: 0 }), lap(7, { lap_duration: -1 }), lap(8, { duration_sector_1: 30, duration_sector_2: 30, duration_sector_3: 40.003 }), lap(9, { duration_sector_1: 30, duration_sector_2: 30, duration_sector_3: 40.0031 }), noDate, lap(11, { duration_sector_1: 30, duration_sector_2: 30 }), lap(12, { duration_sector_1: 0, date_start: 'bad' }), lap(13, { date_start: '2026-01-01T15:00:00Z' })], stints: [stint(1, 1, 13)] });
  partition(c);
  for (const [index, code] of [[0, 'duration-null'], [1, 'duration-missing'], [2, 'duration-invalid-type'], [3, 'duration-nonfinite'], [4, 'duration-nonfinite'], [5, 'duration-nonpositive'], [6, 'duration-nonpositive']]) assert.ok(c.drivers[0].laps[index].reasonCodes.includes(code));
  assert.ok(!c.drivers[0].laps[7].reasonCodes.includes('sector-sum-mismatch')); assert.ok(c.drivers[0].laps[8].reasonCodes.includes('sector-sum-mismatch'));
  assert.ok(!c.drivers[0].laps[10].reasonCodes.includes('sector-sum-mismatch')); assert.ok(c.drivers[0].laps[11].reasonCodes.includes('sector-invalid'));
  for (const [index, code] of [[9, 'lap-start-missing'], [11, 'lap-start-invalid'], [12, 'lap-start-outside-session']]) { assert.equal(c.drivers[0].laps[index].eligibility, 'UNKNOWN'); assert.ok(c.drivers[0].laps[index].reasonCodes.includes(code)); }
});

test('stint gaps, metadata and pit visits remain reported without inferred splits', () => {
  const c = build({ laps: [lap(1), lap(2), lap(3, { is_pit_out_lap: true }), lap(5), lap(7)], pit: [{ ...id, driver_number: 6, lap_number: 2 }], stints: [stint(4, 7, 7, { compound: null, tyre_age_at_start: -1 }), stint(1, 1, 3, { compound: 'UNKNOWN', tyre_age_at_start: 0 }), stint(3, 5, 5, { compound: 'hard', tyre_age_at_start: null })] });
  partition(c);
  // Observed 1,2,3,5,7 leaves two single-lap gaps: 4 and 6.
  assert.deepEqual(c.drivers[0].missingLapRanges, [{ from: 4, to: 4 }, { from: 6, to: 6 }]);
  assert.deepEqual(c.drivers[0].stints.map(s => s.stintNumber), [1, 3, 4]);
  assert.deepEqual(c.drivers[0].stints.map(s => s.compound), [null, null, null]);
  assert.deepEqual(c.drivers[0].stints.map(s => s.tyreAgeAtStart), [0, null, null]);
  assert.ok(c.drivers[0].coverageReasons.includes('stint-gap')); assert.equal(c.drivers[0].stints[0].integrity, 'unverified');
  assert.deepEqual(c.drivers[0].stints[0].pitInLaps, [2]);
});

test('exclusions precede unknown reasons and summaries retain extreme timed laps', () => {
  const c = build({ laps: [lap(1, { lap_duration: null, is_pit_out_lap: true, date_start: 'bad' }), lap(2), lap(3, { lap_duration: 300 })] }); partition(c);
  assert.equal(c.drivers[0].laps[0].eligibility, 'EXCLUDED');
  assert.deepEqual(c.drivers[0].laps[0].reasonCodes, ['duration-null', 'opening-lap', 'pit-out', 'lap-start-invalid']);
  // Two timed observations, 100 and 300 s: minimum 100000 ms; median requires three.
  assert.deepEqual(c.drivers[0].stints[0].rawSummary, { count: 2, minMs: 100000, medianMs: null });
  // Two values, 2 and 4 s: minimum 2000 ms; median requires three.
  assert.deepEqual(summarizeDurations([4, 2]), { count: 2, minMs: 2000, medianMs: null });
});

test('missing required receipts and null mapping keys return unavailable', () => {
  for (const endpoint of ['sessions', 'laps']) { const x = input(); x.receipts = x.receipts.filter(r => r.endpoint !== endpoint); assert.equal(buildPaceContext(x).reason, 'uncaptured'); }
  const x = input(); x.race.sessions[0].openf1SessionKey = null; assert.equal(buildPaceContext(x).reason, 'unmapped');
});

test('each synthetic unsupported boundary stays unverified without splitting at the pit', () => {
  for (const [number, pitLap] of [[6, 33], [14, 35], [18, 26]]) {
    const c = build({ drivers: [{ ...id, driver_number: number }], laps: [lap(1, { driver_number: number }), lap(pitLap, { driver_number: number }), lap(pitLap + 1, { driver_number: number, is_pit_out_lap: true })], pit: [{ ...id, driver_number: number, lap_number: pitLap }], stints: [stint(2, 2, pitLap + 1, { driver_number: number }), stint(1, 1, 1, { driver_number: number })] });
    partition(c); assert.deepEqual(c.drivers[0].stints.map(s => s.integrity), ['unverified', 'unverified']);
    // The lap after the pit remains assigned to the reported second stint: 2.
    assert.deepEqual(c.drivers[0].stints[1].pitInLaps, [pitLap]); assert.equal(c.drivers[0].laps[2].stintNumber, 2);
  }
});

test('conflicting null and each nonfinite duration never collapse', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    const c = build({ laps: [lap(2, { lap_duration: null }), lap(2, { lap_duration: value })] });
    // Two variants at one key produce one conflict and one observed lap.
    assert.equal(c.normalization.conflictingLapKeys, 1); assert.equal(c.counts.observed, 1);
    assert.equal(c.drivers[0].laps[0].durationMs, null); assert.ok(c.drivers[0].laps[0].reasonCodes.includes('lap-conflict'));
  }
});

test('a 300 second outlier remains in a three-lap raw median', () => {
  const c = build({ laps: [lap(1, { lap_duration: 100 }), lap(2, { lap_duration: 300 }), lap(3, { lap_duration: 200 })] });
  // Sorted 100, 200, 300 s: minimum 100000 ms and median 200000 ms.
  assert.deepEqual(c.drivers[0].stints[0].rawSummary, { count: 3, minMs: 100000, medianMs: 200000 });
});
