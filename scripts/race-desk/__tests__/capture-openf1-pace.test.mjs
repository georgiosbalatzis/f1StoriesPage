import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { captureOpenF1 } from '../capture-openf1.mjs';
import { captureOpenF1Pace } from '../capture-openf1-pace.mjs';
import { readPaceContexts, readPaceInventory } from '../pace-files.mjs';

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
  const beforeArchives = snapshot(root);
  for (const response of [
    { status: 503, url: '' },
    { status: 200, url: 'https://example.com/' },
    // The response is one byte above the 20,000,000-byte limit.
    { status: 200, url: '', arrayBuffer: async () => Buffer.alloc(20_000_001) },
  ]) {
    await assert.rejects(run(root, { fetch: async () => response }));
    assert.deepEqual(fs.readFileSync(file), before);
    assert.deepEqual(snapshot(root), beforeArchives);
    assert.equal(fs.existsSync(path.join(root, 'data/race-desk/captures/openf1/11388-laps.response')), false);
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

function snapshot(root) {
  const timeline = fs.readFileSync(path.join(root, 'data/race-desk/timeline.v1.json'));
  const pace = fs.readFileSync(path.join(root, 'data/race-desk/pace.v1.json'));
  return [timeline, pace, ...[...JSON.parse(timeline).captures, ...JSON.parse(pace).captures].map(r => fs.readFileSync(path.join(root, r.path)))];
}

test('every staging and replacement failure preserves both archives', async t => {
  const root = await fixture(t); await run(root);
  const before = snapshot(root);
  // Four files each require one staging write, backup link and replacement rename.
  for (const method of ['writeFileSync', 'linkSync', 'renameSync']) for (let failAt = 1; failAt <= 4; failAt++) {
    let calls = 0;
    const io = { ...fs, [method]: (...args) => { if (++calls === failAt) throw new Error('synthetic failure'); return fs[method](...args); } };
    await assert.rejects(run(root, { fs: io }), /synthetic failure/);
    assert.deepEqual(snapshot(root), before, `${method} ${failAt}`);
    readPaceInventory(root, registry);
  }
});

test('reader rejects a symlinked capture and capture directory', async t => {
  const root = await fixture(t); await run(root);
  const dir = path.join(root, 'data/race-desk/captures/openf1');
  const file = path.join(dir, '11388-laps.response');
  fs.renameSync(file, `${file}.saved`); fs.symlinkSync(`${file}.saved`, file);
  assert.throws(() => readPaceInventory(root, registry), /unsafe path/);
  fs.unlinkSync(file); fs.renameSync(`${file}.saved`, file);
  fs.renameSync(dir, `${dir}.saved`); fs.symlinkSync(`${dir}.saved`, dir);
  assert.throws(() => readPaceInventory(root, registry), /unsafe path/);
});

test('empty laps and partial receipt coverage reach the context', async t => {
  const root = await fixture(t); await run(root);
  assert.equal(readPaceContexts(root, registry).get(raceId).coverage, 'empty');
  await run(root, { fetch: async url => ({ status: 200, url, arrayBuffer: async () => Buffer.from(url.includes('/laps?') ? JSON.stringify([{ meeting_key: 1296, session_key: 11388, driver_number: 1, lap_number: 1, synthetic: true }]) : '[]') }) });
  const file = path.join(root, 'data/race-desk/pace.v1.json'), inventory = JSON.parse(fs.readFileSync(file));
  const laps = inventory.captures.find(r => r.endpoint === 'laps');
  laps.coverage = 'partial'; laps.coverageReasons = ['synthetic partial'];
  fs.writeFileSync(file, JSON.stringify(inventory));
  const context = readPaceContexts(root, registry).get(raceId);
  assert.equal(context.coverage, 'partial');
  assert.ok(context.coverageReasons.includes('source-partial'));
  assert.equal(context.sources.find(s => s.endpoint === 'laps').coverage, 'partial');
});

test('changed provider bytes receive new receipts while the old archive remains readable during capture', async t => {
  const root = await fixture(t); const old = await run(root);
  const next = await run(root, { fetch: async url => {
    assert.deepEqual(readPaceInventory(root, registry).receipts.filter(r => r.endpoint === 'laps' && r.raceId === raceId).map(r => r.sha256), old.filter(r => r.endpoint === 'laps').map(r => r.sha256));
    return { status: 200, url, arrayBuffer: async () => Buffer.from('[ ]') };
  } });
  assert.ok(next.every((r, i) => r.sha256 !== old[i].sha256));
  assert.deepEqual(readPaceInventory(root, registry).receipts.filter(r => ['laps', 'drivers', 'stints'].includes(r.endpoint)).map(r => r.sha256), next.map(r => r.sha256));
});

test('Sprint name or changed start in pinned sessions rejects the proposed capture', async t => {
  for (const change of [s => { s.session_name = 'Sprint'; }, s => { s.date_start = '2026-10-11T11:00:00Z'; }]) {
    const root = await fixture(t), timeline = JSON.parse(fs.readFileSync(path.join(root, 'data/race-desk/timeline.v1.json')));
    const sessionReceipt = timeline.captures.find(r => r.endpoint === 'sessions');
    const session = JSON.parse(fs.readFileSync(path.join(root, sessionReceipt.path)))[0]; change(session);
    const bytes = Buffer.from(JSON.stringify([session]));
    sessionReceipt.sha256 = createHash('sha256').update(bytes).digest('hex'); sessionReceipt.bytes = bytes.length;
    fs.writeFileSync(path.join(root, sessionReceipt.path), bytes);
    fs.writeFileSync(path.join(root, 'data/race-desk/timeline.v1.json'), JSON.stringify(timeline));
    const before = snapshot(root);
    await assert.rejects(run(root), /session identity/);
    assert.deepEqual(snapshot(root), before);
  }
});

test('timeline recapture invalidates old pin until a new pace capture', async t => {
  const root = await fixture(t); await run(root);
  const timeline = JSON.parse(fs.readFileSync(path.join(root, 'data/race-desk/timeline.v1.json')));
  const session = fs.readFileSync(path.join(root, timeline.captures.find(r => r.endpoint === 'sessions').path));
  await captureOpenF1({ root, registry, raceId, codeRevision: 'a'.repeat(40), clock: () => new Date('2026-11-02T00:00:00Z'), fetch: async url => ({ status: 200, url, arrayBuffer: async () => url.includes('/sessions?') ? session : Buffer.from('[ ]') }) });
  assert.throws(() => readPaceInventory(root, registry), /timeline pin mismatch/);
  await run(root);
  assert.doesNotThrow(() => readPaceInventory(root, registry));
});
