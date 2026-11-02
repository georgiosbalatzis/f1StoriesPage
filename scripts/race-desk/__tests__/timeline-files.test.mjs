import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readTimelineInventory } from '../timeline-files.mjs';
import { captureOpenF1 } from '../capture-openf1.mjs';

const rights = JSON.parse(fs.readFileSync('data/race-desk/publication-rights.v1.json'));
const registry = { races: [{ raceId: 'synthetic-race', sourceKeys: { openf1MeetingKey: 11 }, sessions: [{ kind: 'race', openf1SessionKey: 22 }] }] };
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synthetic-timeline-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'data/race-desk'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/race-desk/timeline.v1.json'), JSON.stringify({ schemaVersion: 1, captures: [] }));
  fs.writeFileSync(path.join(root, 'data/race-desk/publication-rights.v1.json'), JSON.stringify(rights));
  return root;
}
const capture = root => captureOpenF1({ root, registry, raceId: 'synthetic-race', codeRevision: 'a'.repeat(40), clock: () => new Date('2026-01-01T00:00:00Z'), fetch: async url => ({ status: 200, url, arrayBuffer: async () => Buffer.from(JSON.stringify([{ meeting_key: 11, session_key: 22, synthetic: true }])) }) });
function mutate(root, fn) {
  const file = path.join(root, 'data/race-desk/timeline.v1.json'), inventory = JSON.parse(fs.readFileSync(file));
  fn(inventory); fs.writeFileSync(file, JSON.stringify(inventory));
}

test('fake capture round trips exact bytes and rejects receipt tampering', async t => {
  const root = fixture(t);
  const receipts = await capture(root);
  assert.deepEqual(receipts.map(item => item.endpoint), ['pit', 'race_control', 'sessions']);
  assert.equal(readTimelineInventory(root, registry).receipts.length, 3);
  const original = fs.readFileSync(path.join(root, 'data/race-desk/timeline.v1.json'));
  for (const change of [r => { r.synthetic = true; }, r => { r.rowCount++; }, r => { r.sha256 = '0'.repeat(64); }, r => { r.httpStatus = 404; }, r => { r.requestUrl += '&x=1'; }, r => { r.returnedIdentity.meeting_key++; }, r => { r.path = 'data/race-desk/captures/openf1/../escape.response'; }, r => { r.codeRevision = 'bad'; }]) {
    mutate(root, inventory => change(inventory.captures[0]));
    assert.throws(() => readTimelineInventory(root, registry));
    fs.writeFileSync(path.join(root, 'data/race-desk/timeline.v1.json'), original);
  }
  mutate(root, inventory => inventory.captures.push({ ...inventory.captures[0], captureId: 'other' }));
  assert.throws(() => readTimelineInventory(root, registry), /duplicate/);
});

test('rejects unmapped race before fetch and rejects symlinked capture', async t => {
  const root = fixture(t);
  let called = false;
  await assert.rejects(captureOpenF1({ root, registry: { races: [{ ...registry.races[0], sessions: [{ kind: 'race', openf1SessionKey: null }] }] }, raceId: 'synthetic-race', codeRevision: 'a'.repeat(40), fetch: () => { called = true; } }), /mapping/);
  assert.equal(called, false);
  const [receipt] = await capture(root);
  const target = path.join(root, receipt.path);
  fs.unlinkSync(target); fs.symlinkSync('/dev/null', target);
  assert.throws(() => readTimelineInventory(root, registry), /unsafe path/);
});

test.todo('readTimelineContexts end-to-end after Terra B timeline.mjs is integrated');
