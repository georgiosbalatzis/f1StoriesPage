import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readTimelineInventory, readTimelineContexts } from '../timeline-files.mjs';
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
const syntheticRows = () => ({
  sessions: [{ meeting_key: 11, session_key: 22, session_name: 'Race', session_type: 'Race', date_start: '2026-01-01T12:00:00Z', date_end: '2026-01-01T14:00:00Z', synthetic: true }],
  race_control: [{ meeting_key: 11, session_key: 22, date: '2026-01-01T12:30:00Z', message: 'synthetic' }],
  pit: [],
});
const capture = (root, rows = syntheticRows(), io = fs) => captureOpenF1({ root, registry, raceId: 'synthetic-race', codeRevision: 'a'.repeat(40), clock: () => new Date('2026-01-01T00:00:00Z'), fs: io, fetch: async url => ({ status: 200, url, arrayBuffer: async () => Buffer.from(JSON.stringify(rows[new URL(url).pathname.split('/').pop()])) }) });

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
  for (const change of [r => { r.synthetic = true; }, r => { r.rowCount++; }, r => { r.sha256 = '0'.repeat(64); }, r => { r.httpStatus = 404; }, r => { r.requestUrl += '&x=1'; }, r => { r.path = 'data/race-desk/captures/openf1/../escape.response'; }, r => { r.codeRevision = 'bad'; }]) {
    mutate(root, inventory => change(inventory.captures[0]));
    assert.throws(() => readTimelineInventory(root, registry));
    fs.writeFileSync(path.join(root, 'data/race-desk/timeline.v1.json'), original);
  }
  mutate(root, inventory => { inventory.captures.find(r => r.endpoint === 'sessions').returnedIdentity.meeting_key++; });
  assert.throws(() => readTimelineInventory(root, registry));
  fs.writeFileSync(path.join(root, 'data/race-desk/timeline.v1.json'), original);
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

test('readTimelineContexts builds a synthetic context end to end and the production inventory contains the Singapore pilot', async t => {
  const root = fixture(t);
  // Synthetic rows only: a session window and one row per endpoint, plus one race-control row before the window.
  const rows = {
    sessions: [{ meeting_key: 11, session_key: 22, session_name: 'Race', session_type: 'Race', date_start: '2026-01-01T12:00:00+00:00', date_end: '2026-01-01T14:00:00+00:00' }],
    race_control: [{ meeting_key: 11, session_key: 22, date: '2026-01-01T11:00:00+00:00', lap_number: 1, category: 'Other', flag: null, scope: null, sector: null, driver_number: null, qualifying_phase: null, message: 'SYNTHETIC PRE-START' },
      { meeting_key: 11, session_key: 22, date: '2026-01-01T12:30:00+00:00', lap_number: 9, category: 'SafetyCar', flag: null, scope: null, sector: null, driver_number: null, qualifying_phase: null, message: 'SYNTHETIC VSC DEPLOYED' }],
    pit: [{ meeting_key: 11, session_key: 22, date: '2026-01-01T12:31:00.250000+00:00', lap_number: 10, driver_number: 7, lane_duration: 21.5, pit_duration: 21.5, stop_duration: 2.4 }],
  };
  await captureOpenF1({ root, registry, raceId: 'synthetic-race', codeRevision: 'a'.repeat(40), clock: () => new Date('2026-01-02T00:00:00Z'),
    fetch: async url => ({ status: 200, url, arrayBuffer: async () => Buffer.from(JSON.stringify(rows[new URL(url).pathname.split('/').pop()])) }) });
  const context = readTimelineContexts(root, registry).get('synthetic-race');
  assert.equal(context.status, 'available'); assert.equal(context.coverage, 'partial');
  assert.deepEqual(context.counts, { raceControl: 2, pit: 1, outOfWindow: 1, duplicates: 0 });
  assert.deepEqual(context.events.map(e => [e.eventType, e.timestampUtc]), [['race-control-observation', '2026-01-01T12:30:00.000000Z'], ['pit-lane-visit', '2026-01-01T12:31:00.250000Z']]);
  const real = JSON.parse(fs.readFileSync('data/race-desk/registry.v1.json'));
  const contexts = readTimelineContexts(process.cwd(), real);
  assert.equal(contexts.get('2026-singapore-gp').status, 'available');
  assert.equal(contexts.get('2026-singapore-gp').events.length, 172);
  assert.equal(contexts.get('2026-singapore-gp').events.filter(event => event.eventType === 'race-control-observation').length, 147);
  assert.ok([...contexts].filter(([id]) => id !== '2026-singapore-gp').every(([, c]) => c.status === 'unavailable' && c.reason === 'unmapped'));
  assert.equal(contexts.size, 6);
});

test('failed staging and replacement preserve the previous archive', async t => {
  const root = fixture(t);
  await capture(root);
  const before = readTimelineContexts(root, registry);
  const inventory = fs.readFileSync(path.join(root, 'data/race-desk/timeline.v1.json'));
  for (const [operation, failAt] of [['writeFileSync', 2], ['renameSync', 2], ['renameSync', 4]]) {
    let calls = 0;
    const io = { ...fs, [operation]: (...args) => {
      if (++calls === failAt) throw new Error('synthetic failure');
      return fs[operation](...args);
    } };
    const rows = syntheticRows(); rows.race_control[0].message = 'synthetic refresh';
    await assert.rejects(capture(root, rows, io), /synthetic failure/);
    assert.deepEqual(fs.readFileSync(path.join(root, 'data/race-desk/timeline.v1.json')), inventory);
    assert.deepEqual(readTimelineContexts(root, registry), before);
  }
});

test('invalid proposed session is rejected before touching the archive', async t => {
  const root = fixture(t);
  await capture(root);
  const before = readTimelineContexts(root, registry);
  const inventory = fs.readFileSync(path.join(root, 'data/race-desk/timeline.v1.json'));
  const rows = syntheticRows(); rows.sessions[0].session_name = 'Sprint';
  await assert.rejects(capture(root, rows), /session kind/);
  assert.deepEqual(fs.readFileSync(path.join(root, 'data/race-desk/timeline.v1.json')), inventory);
  assert.deepEqual(readTimelineContexts(root, registry), before);
});

test('receipt coverage and observedAt are validated and partial reaches the context', async t => {
  const root = fixture(t);
  await capture(root);
  const file = path.join(root, 'data/race-desk/timeline.v1.json');
  const original = fs.readFileSync(file);
  mutate(root, inventory => { const r = inventory.captures.find(r => r.endpoint === 'race_control'); r.coverage = 'partial'; r.coverageReasons = ['synthetic truncation']; });
  const context = readTimelineContexts(root, registry).get('synthetic-race');
  assert.equal(context.coverage, 'partial'); assert.equal(context.events[0].coverage, 'partial');
  for (const change of [r => { r.coverage = 'partial'; }, r => { r.coverageReasons = ['unexpected']; }, r => { r.coverage = 'invalid'; }, r => { r.coverage = 'empty'; }, r => { r.observedAt = '2026-02-30T00:00:00Z'; }, r => { r.observedAt = '2026-01-01T00:00:00.1234Z'; }]) {
    fs.writeFileSync(file, original);
    mutate(root, inventory => change(inventory.captures.find(r => r.endpoint === 'race_control')));
    assert.throws(() => readTimelineContexts(root, registry));
  }
  fs.writeFileSync(file, original);
  mutate(root, inventory => { const r = inventory.captures.find(r => r.endpoint === 'pit'); r.coverageReasons = ['unexpected']; });
  assert.throws(() => readTimelineContexts(root, registry));
});
