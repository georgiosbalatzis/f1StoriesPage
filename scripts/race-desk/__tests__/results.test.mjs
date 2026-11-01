import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { adaptJolpicaClassification, adaptChampionshipSnapshot, compareChampionshipSnapshots } from '../results.mjs';

const root = new URL('../../../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const registry = JSON.parse(read('data/race-desk/registry.v1.json'));
const archive = JSON.parse(read('data/race-desk/results.v1.json'));
const raceFor = id => ({ ...registry.races.find(r => r.raceId === id), resultsBinding: archive.bindings.find(b => b.raceId === id) });
const captureFor = (race, kind) => archive.captures.find(c => c.captureId === race.resultsBinding.captures[kind]);
const classify = (race, kind) => { const capture = captureFor(race, kind); return adaptJolpicaClassification({ race, sessionKind: kind, capture, raw: read(capture.path) }); };
const snap = round => { const capture = archive.standings.find(c => c.round === round); return adaptChampionshipSnapshot({ season: 2026, round, capture, raw: read(capture.path) }); };
const japanDrivers = `antonelli 2 1 47 72 25
russell 1 2 51 63 12
leclerc 3 3 34 49 15
hamilton 4 4 33 41 8
norris 6 5 15 25 10
piastri 12 6 3 21 18
bearman 5 7 17 17 0
gasly 7 8 9 15 6
max_verstappen 8 9 8 12 4
lawson 9 10 8 10 2
arvid_lindblad 10 11 4 4 0
hadjar 11 12 4 4 0
bortoleto 14 13 2 2 0
sainz 13 14 2 2 0
ocon 16 15 0 1 1
colapinto 15 16 1 1 0
hulkenberg 17 17 0 0 0
albon 18 18 0 0 0
bottas 19 19 0 0 0
perez 20 20 0 0 0
alonso 21 21 0 0 0
stroll 22 22 0 0 0`;
const japanConstructors = `mercedes 1 1 98 135 37
ferrari 2 2 67 90 23
mclaren 3 3 18 46 28
haas 4 4 17 18 1
alpine 7 5 10 16 6
red_bull 5 6 12 16 4
rb 6 7 12 14 2
audi 8 8 2 2 0
williams 9 9 2 2 0
cadillac 10 10 0 0 0
aston_martin 11 11 0 0 0`;
const expected = text => text.split('\n').map(line => { const [id, beforeRank, afterRank, beforePoints, afterPoints, delta] = line.split(' '); return [id, +beforeRank, +afterRank, beforePoints, afterPoints, delta, +beforeRank - +afterRank]; });
const actual = rows => rows.map(r => [r.entityId, r.before.position, r.after.position, r.before.points, r.after.points, r.pointsChange, r.rankChange]);

test('Japan comparison matches independently calculated complete driver and constructor tables', () => {
  const before = snap(2), after = snap(3);
  assert.equal(before.status, 'available'); assert.equal(after.status, 'available');
  const comparison = compareChampionshipSnapshots({ before, after });
  assert.equal(comparison.status, 'available');
  assert.equal(comparison.basis, 'captured-cumulative-championship-totals');
  assert.deepEqual(actual(comparison.drivers), expected(japanDrivers));
  assert.deepEqual(actual(comparison.constructors), expected(japanConstructors));
  for (const rows of [comparison.drivers, comparison.constructors]) assert.equal(rows.reduce((n, r) => n + Number(r.pointsChange), 0), 101);
});

test('all mapped comparisons retain full tables and Singapore sprint remains separate', () => {
  for (const [round, total, count] of [[3, 101, 22], [15, 101, 23], [16, 101, 23], [17, 137, 23]]) {
    const result = compareChampionshipSnapshots({ before: snap(round - 1), after: snap(round) });
    assert.equal(result.status, 'available');
    assert.equal(result.drivers.length, count); assert.equal(result.constructors.length, 11);
    for (const rows of [result.drivers, result.constructors]) assert.equal(rows.reduce((n, r) => n + Number(r.pointsChange), 0), total);
  }
  const singapore = raceFor('2026-singapore-gp');
  for (const [kind, sum] of [['race', 101], ['sprint', 36]]) {
    const result = classify(singapore, kind);
    assert.equal(result.status, 'available'); assert.equal(result.entries.length, 22);
    assert.equal(result.entries.reduce((n, r) => n + Number(r.points), 0), sum);
  }
});

test('archived classifications preserve complete provider order and session-specific fields', () => {
  for (const id of ['2026-japanese-gp', '2026-azerbaijan-gp', '2026-bahrain-gp', '2026-singapore-gp']) {
    const race = raceFor(id);
    for (const kind of ['race', 'qualifying', 'sprint']) {
      const capture = captureFor(race, kind), raw = read(capture.path), body = JSON.parse(raw);
      const result = adaptJolpicaClassification({ race, sessionKind: kind, capture, raw });
      if (kind === 'sprint' && id !== '2026-singapore-gp') { assert.equal(result.status, 'unavailable'); assert.equal(result.reason, 'provider-empty'); continue; }
      assert.equal(result.status, 'available', `${id} ${kind}`);
      assert.deepEqual(result.completeness, { scope: 'provider-response', total: 22, rows: 22 });
      const key = { race: 'Results', qualifying: 'QualifyingResults', sprint: 'SprintResults' }[kind];
      const source = body.MRData.RaceTable.Races[0][key];
      assert.deepEqual(result.entries.map(e => e.driverId), source.map(e => e.Driver.driverId));
      assert.equal(new Set(result.entries.map(e => e.driverId)).size, 22);
      if (kind === 'qualifying') {
        assert.ok(result.entries.some(e => e.q2 === null && e.q3 === null));
        assert.ok(result.entries.every(e => !('points' in e) && !('status' in e) && !('grid' in e)));
      } else {
        assert.ok(result.entries.some(e => e.points === '0'));
        assert.ok(result.entries.every(e => !('q1' in e)));
      }
    }
  }
});

const hash = raw => createHash('sha256').update(raw).digest('hex');
function mutateInput(capture, raw, mutate) {
  const object = JSON.parse(raw); mutate(object); const changed = Buffer.from(JSON.stringify(object));
  return { capture: { ...capture, sha256: hash(changed), bytes: changed.length }, raw: changed };
}
const invalid = result => assert.equal(result.status, 'invalid', JSON.stringify(result));

test('classification rejects tampered bytes, bad provenance, wrong identity and incomplete responses', () => {
  const race = raceFor('2026-bahrain-gp'), capture = captureFor(race, 'race'), raw = read(capture.path);
  const adapt = input => adaptJolpicaClassification({ race, sessionKind: 'race', capture, raw, ...input });
  assert.equal(adapt({}).status, 'available');
  invalid(adapt({ raw: Buffer.concat([raw, Buffer.from(' ')]) }));
  invalid(adapt({ capture: { ...capture, bytes: capture.bytes + 1 } }));
  for (const patch of [{ httpStatus: 500 }, { observedAt: null }, { requestUrl: 'https://attacker.example/results.json' }, { requestUrl: 'https://user:pass@api.jolpi.ca/ergast/f1/2026/16/results.json?limit=100' }, { sessionKind: 'sprint' }]) invalid(adapt({ capture: { ...capture, ...patch } }));
  for (const mutate of [
    d => { d.MRData.RaceTable.Races[0].Circuit.circuitId = 'bahrain'; },
    d => { d.MRData.RaceTable.Races[0].raceName = 'Bahrain Grand Prix'; },
    d => { d.MRData.RaceTable.Races[0].date = '2026-10-05'; },
    d => { d.MRData.RaceTable.round = '15'; },
    d => { d.MRData.offset = '1'; },
    d => { d.MRData.RaceTable.Races[0].Results.pop(); },
    d => { const rows = d.MRData.RaceTable.Races[0].Results; rows[1].Driver.driverId = rows[0].Driver.driverId; },
    d => { delete d.MRData.RaceTable.Races[0].Results[0].Driver.driverId; },
    d => { d.MRData.RaceTable.Races[0].Results[0].points = 'NaN'; },
  ]) invalid(adapt(mutateInput(capture, raw, mutate)));
  const broken = Buffer.from('{'); invalid(adapt({ raw: broken, capture: { ...capture, sha256: hash(broken), bytes: broken.length } }));
});

test('pure adapters are deterministic and do not mutate their input', () => {
  const race = raceFor('2026-japanese-gp'), capture = captureFor(race, 'race'), raw = read(capture.path);
  const args = { race: structuredClone(race), sessionKind: 'race', capture: structuredClone(capture), raw: Buffer.from(raw) };
  const original = structuredClone(args);
  const first = adaptJolpicaClassification(args);
  assert.deepEqual(adaptJolpicaClassification(args), first);
  assert.deepEqual(args.race, original.race); assert.deepEqual(args.capture, original.capture); assert.deepEqual(args.raw, Buffer.from(original.raw));
  const before = snap(2), after = snap(3), saved = structuredClone({ before, after });
  assert.deepEqual(compareChampionshipSnapshots({ before, after }), compareChampionshipSnapshots({ before, after }));
  assert.deepEqual({ before, after }, saved);
});

test('standings reject scope, completeness, duplicate identity, bad numbers and provenance independently', () => {
  const capture = archive.standings.find(c => c.round === 2), raw = read(capture.path);
  const adapt = input => adaptChampionshipSnapshot({ season: 2026, round: 2, capture, raw, ...input });
  assert.equal(adapt({}).status, 'available');
  invalid(adapt({ raw: Buffer.concat([raw, Buffer.from(' ')]) }));
  for (const patch of [{ generatedAt: 'not-a-date' }, { path: 'standings/rounds/2026-3.json' }, { revision: '' }]) invalid(adapt({ capture: { ...capture, ...patch } }));
  for (const mutate of [
    d => { d.driverStandings.MRData.StandingsTable.season = '2025'; },
    d => { d.driverStandings.MRData.StandingsTable.StandingsLists[0].round = '3'; },
    d => { d.constructorStandings.MRData.StandingsTable.round = '3'; },
    d => { d.constructorStandings.MRData.StandingsTable.StandingsLists = []; },
    d => { d.driverStandings.MRData.StandingsTable.StandingsLists.push({}); },
    d => { d.driverStandings.MRData.offset = '1'; },
    d => { d.constructorStandings.MRData.total = '12'; },
    d => { const rows = d.driverStandings.MRData.StandingsTable.StandingsLists[0].DriverStandings; rows[1].Driver.driverId = rows[0].Driver.driverId; },
    d => { d.driverStandings.MRData.StandingsTable.StandingsLists[0].DriverStandings[0].points = '1e2'; },
  ]) invalid(adapt(mutateInput(capture, raw, mutate)));
  const sixteen = snap(16);
  assert.equal(sixteen.status, 'available');
  assert.notEqual(sixteen.source.wrapperUrls.drivers, sixteen.source.embeddedUrls.drivers);
});

test('synthetic decimal differences, missing IDs, ties and stable identity retain source meaning', () => {
  const make = (round, change) => {
    const capture = archive.standings.find(c => c.round === round), raw = read(capture.path);
    const changed = mutateInput(capture, raw, d => change(d.driverStandings.MRData.StandingsTable.StandingsLists[0].DriverStandings));
    const result = adaptChampionshipSnapshot({ season: 2026, round, ...changed });
    assert.equal(result.status, 'available', JSON.stringify(result)); return result;
  };
  const before = make(2, rows => {
    for (const [i, points] of ['0.1', '12.5', '1.00', '5', '0'].entries()) rows[i].points = points;
    rows[0].position = rows[1].position = '1'; rows[0].positionText = rows[1].positionText = '1';
    rows[5].Driver.driverId = 'synthetic_before_only';
  });
  const after = make(3, rows => {
    const ids = before.drivers.slice(0, 6).map(r => r.entityId);
    const byId = new Map(rows.map(r => [r.Driver.driverId, r]));
    for (const [i, points] of ['0.3', '13.25', '1', '2.5', '0'].entries()) byId.get(ids[i]).points = points;
    byId.get(ids[0]).Driver.givenName = 'Synthetic rename';
    byId.get(ids[0]).Constructors[0].name = 'Synthetic team';
    byId.get('piastri').Driver.driverId = 'synthetic_after_only';
  });
  const comparison = compareChampionshipSnapshots({ before, after });
  assert.equal(comparison.status, 'available');
  for (const [i, delta] of ['0.2', '0.75', '0', '-2.5', '0'].entries()) {
    const row = comparison.drivers.find(r => r.entityId === before.drivers[i].entityId);
    assert.equal(row.pointsChange, delta); assert.equal(row.presence, 'both');
  }
  const removed = comparison.drivers.find(r => r.entityId === 'synthetic_before_only');
  const added = comparison.drivers.find(r => r.entityId === 'synthetic_after_only');
  assert.equal(removed.presence, 'before-only'); assert.equal(added.presence, 'after-only');
  for (const row of [removed, added]) { assert.equal(row.pointsChange, null); assert.equal(row.rankChange, null); }
  const afterIds = new Set(after.drivers.map(r => r.entityId));
  assert.deepEqual(comparison.drivers.map(r => r.entityId), [
    ...after.drivers.map(r => r.entityId),
    ...before.drivers.filter(r => !afterIds.has(r.entityId)).map(r => r.entityId),
  ]);
});

test('unmapped, uncaptured and missing baseline remain explicitly unavailable', () => {
  for (const id of ['2025-singapore-gp', '2026-mexico-gp']) {
    const race = raceFor(id);
    const result = adaptJolpicaClassification({ race, sessionKind: 'race', capture: null, raw: null });
    assert.equal(result.status, 'unavailable'); assert.equal(result.reason, 'unmapped-race');
  }
  const result = adaptJolpicaClassification({ race: raceFor('2026-japanese-gp'), sessionKind: 'sprint-qualifying', capture: null, raw: null });
  assert.equal(result.status, 'unavailable'); assert.equal(result.reason, 'uncaptured-session');
  const missing = adaptChampionshipSnapshot({ season: 2026, round: 0, capture: null, raw: null });
  assert.equal(missing.status, 'unavailable'); assert.equal(missing.reason, 'missing-baseline');
});

test('actual unranked round-one Stroll keeps zero points and has no rank movement', () => {
  const raw = read('standings/rounds/2026-1.json'), data = JSON.parse(raw);
  const capture = {
    ...archive.standings.find(c => c.round === 2), captureId: 'jolpica-2026-1-standings', round: 1,
    path: 'standings/rounds/2026-1.json', bytes: raw.length, sha256: hash(raw), generatedAt: data.generatedAt,
    wrapperUrls: { drivers: data.source.driverStandingsUrl, constructors: data.source.constructorStandingsUrl },
    embeddedUrls: { drivers: data.driverStandings.MRData.url, constructors: data.constructorStandings.MRData.url },
  };
  const before = adaptChampionshipSnapshot({ season: 2026, round: 1, capture, raw });
  assert.equal(before.status, 'available', JSON.stringify(before));
  const stroll = before.drivers.find(r => r.entityId === 'stroll');
  assert.equal(stroll.position, null); assert.equal(stroll.positionText, '-'); assert.equal(stroll.points, '0');
  const comparison = compareChampionshipSnapshots({ before, after: snap(2) });
  assert.equal(comparison.drivers.find(r => r.entityId === 'stroll').rankChange, null);
});

test('pure adapters make no clock or network request', () => {
  const race = raceFor('2026-japanese-gp'), capture = captureFor(race, 'race'), raw = read(capture.path);
  const before = snap(2), after = snap(3);
  const oldFetch = globalThis.fetch, oldNow = Date.now;
  try {
    globalThis.fetch = () => { throw new Error('unexpected network'); };
    Date.now = () => { throw new Error('unexpected clock'); };
    assert.equal(adaptJolpicaClassification({ race, sessionKind: 'race', capture, raw }).status, 'available');
    assert.equal(compareChampionshipSnapshots({ before, after }).status, 'available');
  } finally { globalThis.fetch = oldFetch; Date.now = oldNow; }
});

test('independent classification disagreement does not alter championship comparison', () => {
  const race = raceFor('2026-japanese-gp'), capture = captureFor(race, 'race'), raw = read(capture.path);
  const synthetic = mutateInput(capture, raw, d => { d.MRData.RaceTable.Races[0].Results[0].points = '99'; });
  const classification = adaptJolpicaClassification({ race, sessionKind: 'race', ...synthetic });
  assert.equal(classification.status, 'available'); assert.equal(classification.entries[0].points, '99');
  const comparison = compareChampionshipSnapshots({ before: snap(2), after: snap(3) });
  assert.equal(comparison.status, 'available');
  assert.equal(comparison.drivers.find(r => r.entityId === 'antonelli').pointsChange, '25');
  assert.equal(comparison.basis, 'captured-cumulative-championship-totals');
  invalid(compareChampionshipSnapshots({ before: snap(2), after: snap(15) }));
});

test('invalid calendar dates fail provenance even when capture and snapshot timestamps agree', () => {
  const race = raceFor('2026-japanese-gp'), capture = captureFor(race, 'race'), raw = read(capture.path);
  invalid(adaptJolpicaClassification({ race, sessionKind: 'race', capture: { ...capture, observedAt: '2026-02-30T12:00:00Z' }, raw }));
  const pin = archive.standings.find(c => c.round === 2), snapshotRaw = read(pin.path);
  const changed = mutateInput(pin, snapshotRaw, d => { d.generatedAt = '2026-02-30T12:00:00Z'; });
  changed.capture.generatedAt = '2026-02-30T12:00:00Z';
  invalid(adaptChampionshipSnapshot({ season: 2026, round: 2, ...changed }));
});

test('empty championship tables and forged empty comparisons are invalid', () => {
  const capture = archive.standings.find(c => c.round === 2), raw = read(capture.path);
  for (const [section, key] of [['driverStandings', 'DriverStandings'], ['constructorStandings', 'ConstructorStandings']]) {
    const changed = mutateInput(capture, raw, d => {
      const data = d[section].MRData;
      data.total = '0';
      data.StandingsTable.StandingsLists[0][key] = [];
    });
    invalid(adaptChampionshipSnapshot({ season: 2026, round: 2, ...changed }));
  }
  const before = snap(2), after = snap(3);
  for (const key of ['drivers', 'constructors']) {
    invalid(compareChampionshipSnapshots({ before: { ...before, [key]: [] }, after }));
    invalid(compareChampionshipSnapshots({ before, after: { ...after, [key]: [] } }));
  }
});

test('race grid and laps reject malformed values while preserving zero and unavailable', () => {
  const race = raceFor('2026-japanese-gp'), capture = captureFor(race, 'race'), raw = read(capture.path);
  const run = mutate => adaptJolpicaClassification({ race, sessionKind: 'race', ...mutateInput(capture, raw, mutate) });
  for (const [field, value] of [['grid', 'garbage'], ['grid', '-1'], ['laps', 'garbage'], ['laps', '-4']]) {
    invalid(run(d => { d.MRData.RaceTable.Races[0].Results[0][field] = value; }));
  }
  const result = run(d => {
    const rows = d.MRData.RaceTable.Races[0].Results;
    rows[0].grid = '0'; rows[0].laps = '0';
    delete rows[1].grid; delete rows[1].laps;
  });
  assert.equal(result.status, 'available', JSON.stringify(result));
  assert.equal(result.entries[0].grid, '0'); assert.equal(result.entries[0].laps, '0');
  assert.equal(result.entries[1].grid, null); assert.equal(result.entries[1].laps, null);
});
