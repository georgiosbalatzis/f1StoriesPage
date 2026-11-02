import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { captureOpenF1 } from '../capture-openf1.mjs';
import { captureOpenF1Pace } from '../capture-openf1-pace.mjs';
import { readPaceInventory } from '../pace-files.mjs';

const registry = JSON.parse(fs.readFileSync('data/race-desk/registry.v1.json'));
const raceId = '2026-singapore-gp';
async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synthetic-pace-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'data/race-desk'), { recursive: true });
  fs.copyFileSync('data/race-desk/publication-rights.v1.json', path.join(root, 'data/race-desk/publication-rights.v1.json'));
  fs.writeFileSync(path.join(root, 'data/race-desk/timeline.v1.json'), JSON.stringify({ schemaVersion: 1, captures: [] }));
  const syntheticSession = { meeting_key: 1296, session_key: 11388, session_name: 'Race', session_type: 'Race', year: 2026, date_start: '2026-10-11T12:00:00Z', date_end: '2026-10-11T14:00:00Z', synthetic: true };
  await captureOpenF1({ root, registry, raceId, codeRevision: 'a'.repeat(40), clock: () => new Date('2026-11-02T00:00:00Z'), fetch: async url => ({ status: 200, url, arrayBuffer: async () => Buffer.from(JSON.stringify(url.includes('/sessions?') ? [syntheticSession] : [])) }) });
  fs.writeFileSync(path.join(root, 'data/race-desk/pace.v1.json'), JSON.stringify({ schemaVersion: 1, captures: [], timelineBindings: [] }));
  return root;
}
const run = (root, extra = {}) => captureOpenF1Pace({ root, registry, raceId, codeRevision: 'a'.repeat(40), clock: () => new Date('2026-11-02T00:00:00Z'), fetch: async url => ({ status: 200, url, arrayBuffer: async () => Buffer.from('[]') }), ...extra });

test('captures exact empty responses and leaves timeline evidence untouched', async t => {
  const root = await fixture(t);
  const timeline = fs.readFileSync(path.join(root, 'data/race-desk/timeline.v1.json'));
  const before = JSON.parse(timeline).captures.map(r => fs.readFileSync(path.join(root, r.path)));
  const receipts = await run(root);
  assert.deepEqual(receipts.map(r => r.endpoint), ['drivers', 'laps', 'stints']);
  assert.ok(receipts.every(r => r.coverage === 'empty'));
  // Three pace receipts and three bound timeline receipts = six.
  assert.equal(readPaceInventory(root, registry).receipts.length, 6);
  assert.deepEqual(fs.readFileSync(path.join(root, 'data/race-desk/timeline.v1.json')), timeline);
  assert.deepEqual(JSON.parse(timeline).captures.map(r => fs.readFileSync(path.join(root, r.path))), before);
});

test('HTTP failures, redirects and oversized responses do not write inventory', async t => {
  const root = await fixture(t), file = path.join(root, 'data/race-desk/pace.v1.json'), before = fs.readFileSync(file);
  for (const response of [
    { status: 503, url: '' },
    { status: 200, url: 'https://example.com/' },
    { status: 200, url: '', arrayBuffer: async () => Buffer.alloc(20_000_001) },
  ]) {
    await assert.rejects(run(root, { fetch: async () => response }));
    assert.deepEqual(fs.readFileSync(file), before);
  }
});

test('rights mismatch rejects before fetching', async t => {
  const root = await fixture(t), file = path.join(root, 'data/race-desk/publication-rights.v1.json');
  const original = JSON.parse(fs.readFileSync(file));
  for (const change of [
    r => { delete r.providers.openf1.pace; },
    r => { r.providers.openf1.pace.status = 'unresolved'; },
    r => { r.providers.openf1.pace.raceId = 'synthetic-other'; },
    r => { r.providers.openf1.pace.sessionKey = 11383; },
  ]) {
    const rights = structuredClone(original); change(rights); fs.writeFileSync(file, JSON.stringify(rights));
    let called = false;
    await assert.rejects(run(root, { fetch: async () => { called = true; } }));
    assert.equal(called, false);
  }
});

test('replacement failure rolls back all files', async t => {
  const root = await fixture(t); await run(root);
  const file = path.join(root, 'data/race-desk/pace.v1.json'), before = fs.readFileSync(file);
  let calls = 0;
  const io = { ...fs, renameSync: (...args) => { if (++calls === 2) throw new Error('synthetic failure'); return fs.renameSync(...args); } };
  await assert.rejects(run(root, { fs: io }), /synthetic failure/);
  assert.deepEqual(fs.readFileSync(file), before);
  readPaceInventory(root, registry);
});
