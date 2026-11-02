import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { validatePaceInventory } from '../pace-files.mjs';

const registry = { races: [{ raceId: 'synthetic-race', sourceKeys: { openf1MeetingKey: 11 }, sessions: [{ kind: 'race', openf1SessionKey: 22 }] }] };
const bytes = Buffer.from(JSON.stringify([{ meeting_key: 11, session_key: 22, synthetic: true }]));
const sha256 = createHash('sha256').update(bytes).digest('hex');
function receipt(endpoint) {
  const url = `https://api.openf1.org/v1/${endpoint}?session_key=22`;
  return { schemaVersion: 1, captureId: `openf1-22-${endpoint}`, provider: 'openf1', endpoint, raceId: 'synthetic-race', sessionKind: 'race', requestUrl: url, query: { session_key: 22 }, finalUrl: url, observedAt: '2026-01-01T00:00:00Z', httpStatus: 200, path: `data/race-desk/captures/openf1/22-${endpoint}.response`, sha256, bytes: bytes.length, rowCount: 1, returnedIdentity: { meeting_key: 11, session_key: 22 }, coverage: 'full', coverageReasons: [], codeRevision: 'a'.repeat(40), synthetic: false };
}
function fixture() {
  const timeline = { receipts: ['sessions', 'pit', 'race_control'].map(receipt), rights: {} };
  const inventory = { schemaVersion: 1, captures: [receipt('laps')], timelineBindings: [{ raceId: 'synthetic-race', sessionKind: 'race', sources: timeline.receipts.map(({ endpoint, captureId, sha256 }) => ({ endpoint, captureId, sha256 })) }] };
  return { timeline, inventory };
}
const check = ({ inventory, timeline }, reader = () => bytes) => validatePaceInventory(inventory, registry, timeline, reader);

test('binding requires all exact timeline pins and rejects duplicate bindings and sources', () => {
  const good = fixture();
  // One pace capture plus three pinned timeline captures = four receipts.
  assert.equal(check(good).receipts.length, 4);
  for (const mutate of [
    x => { x.inventory.timelineBindings = []; },
    x => { x.inventory.timelineBindings.push(structuredClone(x.inventory.timelineBindings[0])); },
    x => { x.inventory.timelineBindings[0].sources.pop(); },
    x => { x.inventory.timelineBindings[0].sources[0].sha256 = '0'.repeat(64); },
    x => { x.inventory.timelineBindings[0].sources[0].captureId = 'missing'; },
    x => { x.inventory.timelineBindings[0].sources[0].endpoint = 'pit'; },
    x => { x.inventory.captures = []; },
    x => { x.inventory.captures.push(structuredClone(x.inventory.captures[0])); },
    x => { x.inventory.captures[0].path = 'data/race-desk/captures/openf1/../escape.response'; },
    x => { x.inventory.captures[0].rowCount = 2; },
    x => { x.inventory.captures[0].bytes++; },
    x => { x.inventory.captures[0].returnedIdentity.session_key = 23; },
    x => { x.inventory.captures[0].query.session_key = 23; },
  ]) {
    const value = fixture(); mutate(value); assert.throws(() => check(value));
  }
  assert.throws(() => check(fixture(), () => Buffer.from('changed')));
});

test('partial coverage is accepted while source bytes remain pinned', () => {
  const value = fixture();
  value.inventory.captures[0].coverage = 'partial';
  value.inventory.captures[0].coverageReasons = ['synthetic truncation'];
  assert.equal(check(value).receipts[0].coverage, 'partial');
  assert.throws(() => check(value, () => Buffer.from(JSON.stringify([{ session_key: 22, meeting_key: 11, synthetic: true }]))));
});

test('pace modules do not import perf or review probe material', () => {
  for (const file of ['scripts/race-desk/pace-files.mjs', 'scripts/race-desk/capture-openf1-pace.mjs']) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /(?:perf\/|scratchpad\/)/);
  }
});
