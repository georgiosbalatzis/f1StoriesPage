import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRaceDeskProjection } from '../projection.mjs';
import { ensureRaceDeskLinks } from '../../build/race-desk-links.mjs';

const read = url => JSON.parse(readFileSync(new URL(url, import.meta.url), 'utf8'));
const registry = read('../../../data/race-desk/registry.v1.json');
const lock = read('../../deployment/sources.json');

test('projection contains only verified rounds and compact canonical plans', () => {
  const original = structuredClone(registry);
  const projection = createRaceDeskProjection(registry, lock, 2026);
  assert.deepEqual(registry, original);
  assert.equal(projection.enabled, lock.enabled);
  assert.deepEqual(projection.rounds.map(r => [r.season, r.round]), [[2026,3],[2026,15],[2026,16],[2026,17]]);
  assert.equal(projection.rounds[0].plans.tyres.url, 'https://f1-stories.gr/tyres/2026/suzuka/');
  assert.equal(projection.rounds[2].plans.tyres.url, 'https://f1-stories.gr/tyres/2026/sepang/');
  for (const [target, plan] of Object.entries(projection.generic)) {
    assert.deepEqual(plan, {url:`https://f1-stories.gr/${target}/`,kind:'generic',notice:'race-context-unavailable'});
  }
  for (const row of projection.rounds) {
    for (const [target, plan] of Object.entries(row.plans)) {
      assert.equal(new URL(plan.url).origin, lock.origin);
      assert.ok(new URL(plan.url).pathname.startsWith(`/${target}/`));
      assert.deepEqual(Object.keys(plan), ['url','kind','notice']);
    }
    assert.equal(row.plans.telemetry.kind, 'generic');
    assert.equal(row.plans.ghostcar.kind, 'generic');
  }
  assert.doesNotMatch(JSON.stringify(projection), /evidence|sourceKeys|gitBlob|openf1SessionKey/);
  const reversed = structuredClone(registry);
  reversed.races.reverse();
  assert.deepEqual(createRaceDeskProjection(reversed, lock, 2026), projection);
});

test('invalid registry, duplicate bindings, lock and year fail closed', () => {
  const bad = structuredClone(registry);
  bad.races[0].raceId = '';
  assert.throws(() => createRaceDeskProjection(bad, lock, 2026));
  const duplicate = structuredClone(registry);
  const bound = duplicate.races.filter(r => r.sourceKeys.jolpica);
  bound[1].sourceKeys.jolpica = structuredClone(bound[0].sourceKeys.jolpica);
  bound[1].evidence.find(claim => claim.field === 'sourceKeys.jolpica').value = structuredClone(bound[1].sourceKeys.jolpica);
  assert.throws(() => createRaceDeskProjection(duplicate, lock, 2026));
  const invalidLock = structuredClone(lock);
  invalidLock.applications.find(a => a.application === 'tyres').path = '/other/';
  assert.throws(() => createRaceDeskProjection(registry, invalidLock, 2026));
  for (const year of [undefined, '2026', 1949, 2101, NaN]) assert.throws(() => createRaceDeskProjection(registry, lock, year));
});

test('no mapped rounds emits generic routes only', () => {
  const empty = structuredClone(registry);
  for (const race of empty.races) {
    race.sourceKeys.jolpica = null;
    race.evidence = race.evidence.filter(claim => claim.field !== 'sourceKeys.jolpica');
  }
  assert.deepEqual(createRaceDeskProjection(empty, lock, 2026).rounds, []);
});

test('generator writes deterministic bytes only when changed', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'race-desk-projection-'));
  try {
    for (const dir of ['data/race-desk','scripts/deployment','standings/core']) mkdirSync(path.join(root,dir), {recursive:true});
    writeFileSync(path.join(root,'data/race-desk/registry.v1.json'), JSON.stringify(registry));
    writeFileSync(path.join(root,'scripts/deployment/sources.json'), JSON.stringify(lock));
    const first = ensureRaceDeskLinks(root, 2026);
    const bytes = readFileSync(first.path);
    assert.equal(first.changed, true);
    assert.equal(first.bytes, bytes.length);
    assert.equal(first.buildYear, 2026);
    assert.match(bytes.toString(), /^\/\/ Generated .*\nexport default /);
    const second = ensureRaceDeskLinks(root, 2026);
    assert.equal(second.changed, false);
    assert.deepEqual(readFileSync(second.path), bytes);
    assert.equal(ensureRaceDeskLinks(root, 2027).changed, true);
  } finally { rmSync(root, {recursive:true,force:true}); }
});


test('deployment enabled flag is required, boolean, and faithfully projected', () => {
  for (const enabled of [true, false]) {
    assert.equal(createRaceDeskProjection(registry, { ...lock, enabled }, 2026).enabled, enabled);
  }
  for (const enabled of [undefined, null, 'false', 0, 1]) {
    assert.throws(() => createRaceDeskProjection(registry, { ...lock, enabled }, 2026), TypeError);
  }
  const missing = { ...lock };
  delete missing.enabled;
  assert.throws(() => createRaceDeskProjection(registry, missing, 2026), TypeError);
});
