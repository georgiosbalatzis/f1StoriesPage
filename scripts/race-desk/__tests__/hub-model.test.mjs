import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHubModels, formatHubTime, hubPath } from '../hub-model.mjs';
import { RegistryValidationError } from '../core/index.mjs';
import { planToolLink } from '../core/navigation.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const registry = read('../../../data/race-desk/registry.v1.json');
const lock = read('../../deployment/sources.json');
const options = { currentYear: 2026 };
const enabledLock = { ...lock, enabled: true, releaseReady: true };
const make = (data = registry, deployment = enabledLock) => createHubModels(data, deployment, options);
const claim = (race, field) => race.evidence.find(item => item.field === field);

test('all six races have stable identity, reviewed sources and planned tool links', () => {
  const models = make();
  assert.equal(models.length, 6);
  assert.deepEqual(models.map(m => m.raceId), registry.races.map(r => r.raceId).sort());
  for (const model of models) {
    const race = registry.races.find(r => r.raceId === model.raceId);
    assert.equal(model.path, `/race-desk/gp/${race.raceId}/`);
    assert.equal(model.eventName, race.eventName);
    assert.equal(model.displayName, race.displayName);
    assert.deepEqual(model.sources.map(s => s.id), [...new Set([...race.evidence, ...race.sessions.flatMap(s => s.evidence)].map(c => c.sourceId))].sort());
    assert.deepEqual(model.tools.map(t => t.target), ['grid', 'telemetry', 'ghostcar', 'tyres']);
    for (const tool of model.tools) {
      const plan = planToolLink(registry, { raceId: race.raceId }, tool.target, options);
      assert.deepEqual({ url: tool.url, kind: tool.kind, notice: tool.notice }, { url: plan.url, kind: plan.kind, notice: plan.notice });
    }
    if (model.tools[0].kind === 'exact') assert.match(model.tools[0].url, /[?&]embed=1(?:&|$)/);
    assert.ok(model.sessions.every(s => Object.keys(s).join(',') === 'kind,startUtc,utcTime,venueTime,athensTime'));
    for (const session of model.sessions.filter(s => s.startUtc)) assert.equal(session.utcTime.zone, 'UTC');
  }
  assert.notEqual(models.find(m => m.raceId === '2026-bahrain-gp').displayName, models.find(m => m.raceId === '2026-bahrain-gp').eventName);
  assert.ok(models.find(m => m.raceId === '2026-singapore-gp').sessions.some(s => s.kind === 'sprint'));
  assert.ok(!models.find(m => m.raceId === '2026-japanese-gp').sessions.some(s => s.kind === 'sprint'));
});

test('disabled deployment uses generic existing legacy routes including Grid', () => {
  for (const model of make(registry, { ...enabledLock, enabled: false })) {
    assert.deepEqual(model.tools.map(t => [t.url, t.kind, t.notice]), [
      ['https://f1-stories.gr/standings/', 'generic', 'race-context-unavailable'],
      ['https://georgiosbalatzis.github.io/f1-telemetry-dashboard/', 'generic', 'race-context-unavailable'],
      ['https://georgiosbalatzis.github.io/ghostcar/', 'generic', 'race-context-unavailable'],
      ['https://georgiosbalatzis.github.io/Tyres/', 'generic', 'race-context-unavailable'],
    ]);
  }
});

test('relocation retains identity and incomplete, unmapped sessions remain truthful', () => {
  const data = structuredClone(registry), race = data.races[0];
  const original = race.raceId;
  race.venue.name = '<Relocated & circuit>';
  claim(race, 'venue.name').value = race.venue.name;
  for (const key of Object.keys(race.sourceKeys)) race.sourceKeys[key] = null;
  race.evidence = race.evidence.filter(c => !c.field.startsWith('sourceKeys.'));
  race.sessions = race.sessions.slice(0, 2);
  for (const session of race.sessions) {
    session.startUtc = null;
    session.evidence = session.evidence.filter(c => c.field !== 'startUtc');
  }
  const result = make(data).find(m => m.raceId === original);
  assert.equal(result.path, hubPath(original));
  assert.equal(result.venue.name, '<Relocated & circuit>');
  assert.ok(result.sessions.every(s => s.startUtc === null && s.venueTime === null && s.athensTime === null));
  assert.ok(result.tools.every(t => t.kind === 'generic'));
});

test('time conversion handles Athens DST gap, fold, midnight and invalid input', () => {
  const at = (timestamp, zone = 'Europe/Athens') => formatHubTime(timestamp, zone);
  assert.deepEqual(at('2026-03-29T00:59:00.000Z'), { date: '29/03/2026', time: '02:59', zone: 'Europe/Athens', offset: 'UTC+02:00' });
  assert.equal(at('2026-03-29T01:00:00.000Z').time, '04:00');
  assert.equal(at('2026-03-29T01:00:00.123Z').time, '04:00');
  assert.equal(at('2026-03-29T01:00:00Z'), null);
  assert.deepEqual(at('2026-10-25T00:30:00.000Z'), { date: '25/10/2026', time: '03:30', zone: 'Europe/Athens', offset: 'UTC+03:00' });
  assert.deepEqual(at('2026-10-25T01:30:00.000Z'), { date: '25/10/2026', time: '03:30', zone: 'Europe/Athens', offset: 'UTC+02:00' });
  assert.deepEqual(at('2026-03-27T15:00:00.000Z', 'Asia/Tokyo'), { date: '28/03/2026', time: '00:00', zone: 'Asia/Tokyo', offset: 'UTC+09:00' });
  for (const [start, zone] of [[null, 'Europe/Athens'], ['2026-02-30T00:00:00.000Z', 'Europe/Athens'], ['2026-01-01T00:00:00.000Z', null], ['2026-01-01T00:00:00.000Z', 'Not/AZone']]) assert.equal(at(start, zone), null);
});

test('validation, stable serialization and no input mutation', () => {
  const data = structuredClone(registry), deployment = structuredClone(lock);
  const before = JSON.stringify([data, deployment]);
  const first = JSON.stringify(make(data, deployment));
  data.races.reverse(); data.sources.reverse();
  assert.equal(JSON.stringify(make(data, deployment)), first);
  data.races.reverse(); data.sources.reverse();
  assert.equal(JSON.stringify([data, deployment]), before);
  const invalid = structuredClone(data); invalid.races[0].venue.timeZone = 'Not/AZone';
  assert.throws(() => make(invalid), RegistryValidationError);
  delete invalid.races[0].venue.timeZone;
  assert.throws(() => make(invalid), RegistryValidationError);
  assert.throws(() => createHubModels(data, deployment, { currentYear: 2101 }), TypeError);
  assert.throws(() => make(data, { ...deployment, enabled: undefined }), TypeError);
  assert.throws(() => make(data, { ...deployment, origin: 'https://example.com' }));
  assert.equal(hubPath('1950-some-12-event-gp'), '/race-desk/gp/1950-some-12-event-gp/');
  for (const id of ['../2026-gp', '2026-jp-gp/', null]) assert.throws(() => hubPath(id), TypeError);
});

test('recorded session order is preserved when a middle start is unknown', () => {
  const data = structuredClone(registry), race = data.races.find(r => r.raceId === '2026-japanese-gp');
  const middle = race.sessions[1];
  middle.startUtc = null;
  middle.evidence = middle.evidence.filter(c => c.field !== 'startUtc');
  const sessions = make(data).find(m => m.raceId === race.raceId).sessions;
  assert.deepEqual(sessions.map(s => s.kind), race.sessions.map(s => s.kind));
  assert.equal(sessions[1].startUtc, null);
  assert.equal(sessions[1].venueTime, null);
  assert.equal(sessions[1].athensTime, null);
  assert.notEqual(sessions[2].startUtc, null);
});

test('all races without provider mappings remain generic and season identities stay distinct', () => {
  const data = structuredClone(registry);
  for (const race of data.races) {
    for (const key of Object.keys(race.sourceKeys)) race.sourceKeys[key] = null;
    race.evidence = race.evidence.filter(c => !c.field.startsWith('sourceKeys.'));
  }
  const models = make(data);
  assert.ok(models.every(model => model.tools.every(tool => tool.kind === 'generic')));
  assert.deepEqual(models.filter(m => m.raceId.endsWith('-singapore-gp')).map(m => [m.season, m.path]), [
    [2025, '/race-desk/gp/2025-singapore-gp/'],
    [2026, '/race-desk/gp/2026-singapore-gp/'],
  ]);
});

test('optional source URL is represented as null and invalid schedules fail closed', () => {
  const data = structuredClone(registry), race = data.races[0];
  const sourceId = race.evidence[0].sourceId;
  delete data.sources.find(s => s.id === sourceId).url;
  assert.equal(make(data).find(m => m.raceId === race.raceId).sources.find(s => s.id === sourceId).url, null);
  for (const change of [
    r => { r.venue.timeZone = 'Invalid/Zone'; claim(r, 'venue.timeZone').value = r.venue.timeZone; },
    r => { r.sessions[0].startUtc = '2026-02-30T00:00:00.000Z'; r.sessions[0].evidence.find(c => c.field === 'startUtc').value = r.sessions[0].startUtc; },
    r => { r.sessions[1].startUtc = r.sessions[0].startUtc; r.sessions[1].evidence.find(c => c.field === 'startUtc').value = r.sessions[1].startUtc; },
  ]) {
    const invalid = structuredClone(data);
    change(invalid.races[0]);
    assert.throws(() => make(invalid), RegistryValidationError);
  }
});


test('session-only evidence is included in source citations', () => {
  const data = structuredClone(registry), race = data.races[0];
  const source = structuredClone(data.sources.find(s => s.id === race.sessions[0].evidence[0].sourceId));
  source.id = 'synthetic-session-only';
  data.sources.push(source);
  race.sessions[0].evidence.find(c => c.field === 'startUtc').sourceId = source.id;
  assert.ok(!race.evidence.some(c => c.sourceId === source.id));
  const model = make(data).find(m => m.raceId === race.raceId);
  assert.ok(model.sources.some(s => s.id === source.id));
});

test('actual lock and explicitly enabled and disabled modes project consistently', () => {
  const actual = make(registry, lock);
  const enabled = make(registry, enabledLock);
  const disabled = make(registry, { ...enabledLock, enabled: false });
  assert.deepEqual(actual, lock.enabled ? enabled : disabled);
  assert.ok(enabled.find(m => m.raceId === '2026-japanese-gp').tools.some(t => t.kind === 'exact'));
  assert.ok(disabled.every(m => m.tools.every(t => t.kind === 'generic')));
});
