import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeRaceDeskHubs } from '../../build/race-desk-hubs.mjs';
import { expandPageIncludes } from '../../build/include.mjs';

const sourceRoot = fileURLToPath(new URL('../../..', import.meta.url));
const registryPath = 'data/race-desk/registry.v1.json';
const lockPath = 'scripts/deployment/sources.json';
const marker = '<!-- f1s:gp-discovery:begin -->old<!-- f1s:gp-discovery:end -->';
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-hubs-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const rel of [registryPath, 'data/race-desk/hub-evidence.v1.json', lockPath, 'partials']) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.cpSync(path.join(sourceRoot, rel), path.join(root, rel), { recursive: true });
  }
  fs.writeFileSync(path.join(root, 'index.html'), `<p>before</p>${marker}<p>after</p>`);
  return root;
}
const files = root => fs.existsSync(path.join(root, 'race-desk/gp')) ? fs.readdirSync(path.join(root, 'race-desk/gp')) : [];
const page = (root, item) => fs.readFileSync(path.join(root, item.file), 'utf8');

test('generates six exact pages, discovery and stable bytes without touching unknown files', async t => {
  const root = fixture(t), registryFile = path.join(root, registryPath), registry = readJson(registryFile);
  const unknown = path.join(root, 'race-desk/gp/unrelated/index.html');
  fs.mkdirSync(path.dirname(unknown), { recursive: true }); fs.writeFileSync(unknown, 'leave alone');
  const result = await writeRaceDeskHubs(root, 2026);
  assert.equal(result.length, 6);
  assert.deepEqual(result.map(p => p.file), registry.races.map(r => `race-desk/gp/${r.raceId}/index.html`).sort());
  assert.ok(result.every(p => p.path === '/' + p.file.slice(0, -'index.html'.length)));
  assert.ok(!result.some(p => p.file.includes('unrelated')));
  assert.equal(fs.readFileSync(unknown, 'utf8'), 'leave alone');
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(home, /Japanese Grand Prix/);
  assert.ok(home.startsWith('<p>before</p>') && home.endsWith('<p>after</p>'));
  const before = result.map(p => page(root, p));
  assert.ok(before.every(html => html.includes('<!-- @include:begin partials/nav.html -->')));
  registry.races.reverse(); registry.sources.reverse(); writeJson(registryFile, registry);
  assert.deepEqual(await writeRaceDeskHubs(root, 2026), result);
  assert.deepEqual(result.map(p => page(root, p)), before);
  assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), home);
});

test('deployment mode and supplied year control links', async t => {
  const root = fixture(t), lockFile = path.join(root, lockPath), lock = readJson(lockFile);
  lock.enabled = false; writeJson(lockFile, lock);
  let result = await writeRaceDeskHubs(root, 2026);
  let html = page(root, result.find(p => p.path.includes('2026-japanese-gp')));
  for (const url of ['https://georgiosbalatzis.github.io/Tyres/', 'https://georgiosbalatzis.github.io/ghostcar/', 'https://georgiosbalatzis.github.io/f1-telemetry-dashboard/', 'https://f1-stories.gr/standings/']) assert.ok(html.includes(url));
  assert.ok(!html.includes('https://f1-stories.gr/tyres/2026/'));
  lock.enabled = true; writeJson(lockFile, lock);
  result = await writeRaceDeskHubs(root, 2024);
  html = page(root, result.find(p => p.path.includes('2026-japanese-gp')));
  assert.ok(html.includes('https://f1-stories.gr/standings/'));
  assert.ok(!html.includes('embed=1&amp;season=2026'));
  result = await writeRaceDeskHubs(root, 2026);
  html = page(root, result.find(p => p.path.includes('2026-japanese-gp')));
  assert.ok(html.includes('embed=1&amp;season=2026'));
});

test('invalid registry and missing home marker fail before writing pages', async t => {
  for (const failure of ['registry', 'marker']) {
    const root = fixture(t);
    if (failure === 'registry') {
      const file = path.join(root, registryPath), registry = readJson(file);
      registry.races[0].venue.timeZone = 'Invalid/Zone'; writeJson(file, registry);
    } else fs.writeFileSync(path.join(root, 'index.html'), '<p>no marker</p>');
    await assert.rejects(writeRaceDeskHubs(root, 2026));
    assert.deepEqual(files(root), []);
  }
});

test('refuses destination ancestor, file and dangling symlinks without writing outside', async t => {
  for (const kind of ['ancestor', 'file', 'dangling', 'home']) {
    const root = fixture(t), outside = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-hubs-outside-'));
    t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
    const target = path.join(outside, 'target');
    if (kind === 'ancestor') {
      fs.mkdirSync(target); fs.mkdirSync(path.join(root, 'race-desk'));
      fs.symlinkSync(target, path.join(root, 'race-desk/gp'));
    } else if (kind === 'home') {
      fs.writeFileSync(target, marker); fs.unlinkSync(path.join(root, 'index.html')); fs.symlinkSync(target, path.join(root, 'index.html'));
    } else {
      const dir = path.join(root, 'race-desk/gp/2025-singapore-gp'); fs.mkdirSync(dir, { recursive: true });
      if (kind === 'file') fs.writeFileSync(target, 'outside');
      fs.symlinkSync(target, path.join(dir, 'index.html'));
    }
    await assert.rejects(writeRaceDeskHubs(root, 2026));
    if (kind === 'file') assert.equal(fs.readFileSync(target, 'utf8'), 'outside');
    if (kind === 'home') assert.equal(fs.readFileSync(target, 'utf8'), marker);
    if (kind === 'dangling') assert.equal(fs.existsSync(target), false);
    if (kind === 'ancestor') assert.deepEqual(fs.readdirSync(target), []);
  }
});

test('shared include expander reports missing variables, cycles and outside paths', async t => {
  const root = fixture(t), partial = path.join(root, 'partials/hub-test.html');
  const expand = source => expandPageIncludes(source, { root, relativePath: 'race-desk/gp/example/index.html' });
  fs.writeFileSync(partial, 'hello {{missingHubVariable}}');
  await assert.rejects(expand('<!-- @include partials/hub-test.html -->'), /Missing include variable/);
  fs.writeFileSync(partial, '<!-- @include partials/hub-test.html -->');
  await assert.rejects(expand('<!-- @include partials/hub-test.html -->'), /cycle/i);
  await assert.rejects(expand('<!-- @include ../../../../../outside.html -->'), /outside repository/);
  await assert.rejects(expandPageIncludes('', { root, relativePath: '../outside.html' }), /outside repository/);
});

test('ambiguous duplicate home markers fail before any page is written', async t => {
  const root = fixture(t), home = path.join(root, 'index.html');
  fs.writeFileSync(home, marker + marker);
  await assert.rejects(writeRaceDeskHubs(root, 2026));
  assert.equal(fs.readFileSync(home, 'utf8'), marker + marker);
  assert.deepEqual(files(root), []);
});

test('refuses a symlinked root and leaves unrelated symlink directories alone', async t => {
  const root = fixture(t), outside = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-hubs-unknown-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const rootAlias = path.join(outside, 'root-link');
  fs.symlinkSync(root, rootAlias);
  await assert.rejects(writeRaceDeskHubs(rootAlias, 2026));
  assert.deepEqual(files(root), []);
  const unknown = path.join(root, 'race-desk/gp/unrelated');
  fs.mkdirSync(path.dirname(unknown), { recursive: true });
  fs.symlinkSync(outside, unknown);
  const descriptors = await writeRaceDeskHubs(root, 2026);
  assert.ok(fs.lstatSync(unknown).isSymbolicLink());
  assert.ok(!descriptors.some(p => p.file.includes('unrelated')));
  assert.deepEqual(fs.readdirSync(outside), ['root-link']);
});

test('a broken shared partial aborts generation before writes', async t => {
  const root = fixture(t), home = path.join(root, 'index.html');
  fs.writeFileSync(path.join(root, 'partials/nav.html'), '{{missingHubVariable}}');
  const original = fs.readFileSync(home, 'utf8');
  await assert.rejects(writeRaceDeskHubs(root, 2026), /Missing include variable/);
  assert.deepEqual(files(root), []);
  assert.equal(fs.readFileSync(home, 'utf8'), original);
});


test('missing or invalid publication proof and registry drift fail before writes', async t => {
  for (const failure of ['missing', 'invalid', 'drift']) {
    const root = fixture(t), proof = path.join(root, 'data/race-desk/hub-evidence.v1.json');
    const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    if (failure === 'missing') fs.unlinkSync(proof);
    if (failure === 'invalid') { const data = readJson(proof); data.approvals[0].source.sha256 = '0'.repeat(64); writeJson(proof, data); }
    if (failure === 'drift') { const file = path.join(root, registryPath), data = readJson(file); data.races[0].displayName = '<Unsafe & "name">'; writeJson(file, data); }
    await assert.rejects(writeRaceDeskHubs(root, 2026));
    assert.deepEqual(files(root), []);
    assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), home);
  }
});
