import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPublicationModels, PUBLIC_RACE_IDS } from '../hub-publication.mjs';
import { createHubModels } from '../hub-model.mjs';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const registry = read('../../../data/race-desk/registry.v1.json');
const evidence = read('../../../data/race-desk/hub-evidence.v1.json');
const lock = read('../../deployment/sources.json');
const options = { currentYear: 2026 };
const make = (r = registry, e = evidence, l = lock) => createPublicationModels(r, l, e, options);

test('reviewed official identities and thirty UTC starts bound exactly six public models', () => {
  const original = structuredClone(registry);
  const models = make();
  assert.deepEqual(models.map(m => m.raceId), PUBLIC_RACE_IDS);
  assert.equal(models.flatMap(m => m.sessions).length, 30);
  for (const m of models) {
    const local = createHubModels(registry, lock, options).find(r => r.raceId === m.raceId);
    assert.deepEqual(m.tools, local.tools);
    assert.deepEqual(m.sources, local.sources);
    assert.deepEqual(m.sessions, local.sessions);
    assert.deepEqual(m.localIdentity.sessions, m.scheduleEvidence.sessions.map(({ kind, startUtc }) => ({ kind, startUtc })));
    assert.equal(m.localIdentity.venue.timeZone, m.venue.timeZone);
  }
  assert.equal(models.find(m => m.raceId === '2026-japanese-gp').venue.name, 'Suzuka Circuit');
  assert.equal(models.find(m => m.raceId === '2026-mexican-gp').displayName, 'Mexico City Grand Prix');
  assert.equal(models.find(m => m.raceId === '2026-bahrain-gp').displayName, 'Bahrain Grand Prix in Malaysia');
  assert.deepEqual(registry, original);
});
test('disabled deployment retains existing fallback behavior', () => {
  const disabled = { ...lock, enabled: false };
  assert.deepEqual(make(registry, evidence, disabled).map(m => m.tools), createHubModels(registry, disabled, options).map(m => m.tools));
});
for (const [label, change] of [
  ['missing approval', e => e.approvals.pop()],
  ['duplicate approval', e => e.approvals[1] = e.approvals[0]],
  ['extra approval', e => e.approvals.push(e.approvals[0])],
  ['wrong host', e => e.approvals[0].source.url = 'https://example.com/en/racing/2025/singapore'],
  ['wrong final URL', e => e.approvals[0].source.finalUrl += '/other'],
  ['unreviewed hash', e => e.approvals[0].source.sha256 = '0'.repeat(64)],
  ['wrong capture size', e => e.approvals[0].source.bytes += 1],
  ['conflicting official title', e => { e.approvals[0].official.title = 'FORMULA 1 WRONG GRAND PRIX 2025'; e.approvals[0].official.meetingOfficialName = e.approvals[0].official.title; }],
  ['bad hash', e => e.approvals[0].source.sha256 = 'not a hash'],
  ['missing source proof', e => delete e.approvals[0].source],
  ['bad UTC observation', e => e.approvals[0].source.observedAt = '2026-10-31T10:00:00+02:00'],
  ['conflicting public label', e => e.approvals[0].publicLabels.venueName = 'Sepang'],
  ['conflicting official circuit', e => e.approvals[0].official.circuitOfficialName = 'Sepang'],
  ['session ordering', e => e.approvals[0].official.sessions.reverse()],
  ['wrong session start', e => e.approvals[0].official.sessions[0].startUtc = '2025-10-03T10:30:00.000Z'],
  ['wrong session name', e => e.approvals[0].official.sessions[0].name = 'Qualifying - Singapore Grand Prix'],
  ['wrong offset', e => e.approvals[0].official.gmtOffset = '+07:00'],
]) test(`rejects ${label} before returning models`, () => {
  const e = structuredClone(evidence); change(e);
  assert.throws(() => make(registry, e));
});
test('registry drift and approved identity deletion fail', () => {
  const r = structuredClone(registry);
  r.races[0].displayName += ' changed';
  assert.throws(() => make(r), /registry drift/);
  assert.throws(() => make({ ...registry, races: registry.races.slice(1) }));
});
test('a valid additional registry record is not automatically published', () => {
  const r = structuredClone(registry);
  const extra = structuredClone(r.races[0]);
  extra.raceId = '2026-unapproved-gp';
  extra.sourceKeys = { openf1MeetingKey: null, jolpica: null, tyresRaceId: null, tyresSlug: null };
  extra.evidence = extra.evidence.filter(c => !c.field.startsWith('sourceKeys.'));
  r.races.push(extra);
  assert.deepEqual(make(r).map(m => m.raceId), PUBLIC_RACE_IDS);
});

test('changed local timezone fails even when registry evidence is internally consistent', () => {
  const r = structuredClone(registry);
  r.races[0].venue.timeZone = 'Asia/Seoul';
  r.races[0].evidence.find(c => c.field === 'venue.timeZone').value = 'Asia/Seoul';
  assert.throws(() => make(r), /registry drift/);
});
