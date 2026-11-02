import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readResultsContexts } from '../results-files.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const manifestPath = 'data/race-desk/results.v1.json';
const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath)));
const registry = JSON.parse(fs.readFileSync(path.join(root, 'data/race-desk/registry.v1.json')));
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'race-results-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const relative of [manifestPath, ...manifest.captures.map(c => c.path), ...manifest.standings.map(c => c.path)]) {
    const dest = path.join(dir, relative);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(root, relative), dest);
  }
  return dir;
}
function modifyManifest(dir, edit) {
  const file = path.join(dir, manifestPath), copy = JSON.parse(fs.readFileSync(file));
  edit(copy);
  fs.writeFileSync(file, JSON.stringify(copy));
}

test('loads all four captures and comparisons with explicit unsupported states, deterministically', t => {
  const dir = fixture(t), input = structuredClone(registry), before = structuredClone(input);
  const first = readResultsContexts(dir, input), second = readResultsContexts(dir, input);
  assert.deepEqual(first, second); assert.deepEqual(input, before);
  assert.equal(first.size, registry.races.length);
  for (const id of ['2026-japanese-gp', '2026-azerbaijan-gp', '2026-bahrain-gp', '2026-singapore-gp']) {
    const result = first.get(id);
    assert.equal(result.classifications.race.status, 'available');
    assert.equal(result.classifications.qualifying.status, 'available');
    assert.equal(result.classifications.sprint.status, id === '2026-singapore-gp' ? 'available' : 'unavailable');
    assert.equal(result.comparison.status, 'available');
  }
  for (const race of registry.races.filter(r => !r.sourceKeys.jolpica)) {
    const result = first.get(race.raceId);
    assert.equal(result.classifications.race.reason, 'unmapped-race');
    assert.equal(result.comparison.status, 'unavailable');
  }
});

test('rejects modified and missing captured or pinned bytes', t => {
  const dir = fixture(t);
  const capture = path.join(dir, manifest.captures[0].path), snapshot = path.join(dir, manifest.standings[0].path);
  const original = fs.readFileSync(capture);
  fs.appendFileSync(capture, ' ');
  assert.throws(() => readResultsContexts(dir, registry), /digest-mismatch/);
  fs.writeFileSync(capture, original);
  fs.appendFileSync(snapshot, ' ');
  assert.throws(() => readResultsContexts(dir, registry), /digest-mismatch/);
  fs.unlinkSync(snapshot);
  assert.throws(() => readResultsContexts(dir, registry));
});

test('rejects malformed inventories, duplicate IDs, paths and scope changes before loading data', t => {
  const edits = [
    m => { m.schemaVersion = 2; },
    m => { m.bindings.pop(); },
    m => { m.captures[1].captureId = m.captures[0].captureId; },
    m => { m.standings[0].captureId = m.captures[0].captureId; },
    m => { m.captures[0].path = '../outside'; },
    m => { m.standings[0].path = 'standings/rounds/../rounds/2026-2.json'; },
    m => { m.bindings[0].round = 4; },
    m => { m.captures[0].extra = true; },
    m => { m.standings.pop(); },
  ];
  for (const edit of edits) {
    const dir = fixture(t); modifyManifest(dir, edit);
    assert.throws(() => readResultsContexts(dir, registry));
  }
});

test('rejects symlinked archive components and manifest', t => {
  const dir = fixture(t), file = path.join(dir, manifest.captures[0].path);
  fs.unlinkSync(file); fs.symlinkSync(path.join(root, manifest.captures[0].path), file);
  assert.throws(() => readResultsContexts(dir, registry), /unsafe path/);
  const dir2 = fixture(t), manifestFile = path.join(dir2, manifestPath);
  fs.unlinkSync(manifestFile); fs.symlinkSync(path.join(root, manifestPath), manifestFile);
  assert.throws(() => readResultsContexts(dir2, registry), /unsafe path/);
  const dir3 = fixture(t), archiveDir = path.join(dir3, 'data/race-desk/captures/jolpica');
  fs.rmSync(archiveDir, { recursive: true });
  fs.symlinkSync(path.join(root, 'data/race-desk/captures/jolpica'), archiveDir);
  assert.throws(() => readResultsContexts(dir3, registry), /unsafe path/);
});

test('rejects duplicate or inconsistent registry bindings', t => {
  const dir = fixture(t), duplicate = structuredClone(registry), altered = structuredClone(registry);
  duplicate.races.push(duplicate.races[0]);
  altered.races.find(r => r.raceId === '2026-japanese-gp').sourceKeys.jolpica.round = 4;
  assert.throws(() => readResultsContexts(dir, duplicate), /registry race/);
  assert.throws(() => readResultsContexts(dir, altered), /registry binding mismatch/);
});
