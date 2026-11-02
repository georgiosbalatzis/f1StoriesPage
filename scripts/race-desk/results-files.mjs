import fs from 'node:fs';
import { readBounded as readCaptureFile } from './capture-files.mjs';
import { adaptJolpicaClassification, adaptChampionshipSnapshot, compareChampionshipSnapshots } from './results.mjs';

const pilots = new Map([
  ['2026-japanese-gp', 3],
  ['2026-azerbaijan-gp', 15],
  ['2026-bahrain-gp', 16],
  ['2026-singapore-gp', 17],
]);
const kinds = ['race', 'qualifying', 'sprint'];
const snapshotRounds = [2, 3, 14, 15, 16, 17];
const fail = message => { throw new Error(`Results archive: ${message}`); };
const shape = (value, keys, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('\0') !== [...keys].sort().join('\0')) fail(`invalid ${label} shape`);
};
const descriptor = (value, label) => shape(value, ['raceName', 'circuitId', 'date', 'time'], label);
const urls = (value, label) => shape(value, ['drivers', 'constructors'], label);

function readBounded(root, relative) {
  try { return readCaptureFile(root, relative); }
  catch (error) { if (error.message.startsWith('unsafe path ')) fail(error.message); throw error; }
}

export function readResultsContexts(root, registry) {
  const base = fs.realpathSync(root);
  let manifest;
  try { manifest = JSON.parse(readBounded(base, 'data/race-desk/results.v1.json').toString('utf8')); }
  catch (err) { fail(`cannot read manifest: ${err.message}`); }
  shape(manifest, ['schemaVersion', 'bindings', 'captures', 'standings'], 'manifest');
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.bindings) || manifest.bindings.length !== pilots.size || !Array.isArray(manifest.captures) || manifest.captures.length !== pilots.size * kinds.length || !Array.isArray(manifest.standings) || manifest.standings.length !== snapshotRounds.length) fail('unexpected manifest inventory');
  if (!Array.isArray(registry?.races)) fail('invalid registry');
  const registryIds = new Set();
  for (const race of registry.races) {
    if (typeof race?.raceId !== 'string' || registryIds.has(race.raceId)) fail('duplicate or invalid registry race');
    registryIds.add(race.raceId);
    if (race.sourceKeys?.jolpica && !pilots.has(race.raceId)) fail(`unexpected results mapping ${race.raceId}`);
  }
  const bindings = new Map(), captures = new Map(), snapshots = new Map(), allIds = new Set();
  const addId = (id, label) => {
    if (typeof id !== 'string' || allIds.has(id)) fail(`duplicate or invalid ${label} ID`);
    allIds.add(id);
  };
  for (const binding of manifest.bindings) {
    shape(binding, ['raceId', 'season', 'round', 'expectedRace', 'captures'], 'binding');
    descriptor(binding.expectedRace, 'binding descriptor');
    shape(binding.captures, kinds, 'binding captures');
    const round = pilots.get(binding.raceId);
    if (round === undefined || binding.season !== 2026 || binding.round !== round || bindings.has(binding.raceId)) fail('unexpected or duplicate binding');
    const race = registry.races.find(item => item.raceId === binding.raceId);
    if (!race || race.season !== 2026 || race.sourceKeys?.jolpica?.season !== 2026 || race.sourceKeys?.jolpica?.round !== round) fail(`registry binding mismatch ${binding.raceId}`);
    for (const kind of kinds) if (binding.captures[kind] !== `jolpica-2026-${round}-${kind}`) fail('unexpected capture binding');
    bindings.set(binding.raceId, binding);
  }
  for (const capture of manifest.captures) {
    shape(capture, ['captureId', 'provider', 'raceId', 'season', 'round', 'sessionKind', 'requestUrl', 'finalUrl', 'observedAt', 'httpStatus', 'path', 'sha256', 'bytes', 'expectedRace', 'rowCount'], 'capture');
    descriptor(capture.expectedRace, 'capture descriptor');
    addId(capture.captureId, 'capture');
    const binding = bindings.get(capture.raceId), kind = capture.sessionKind;
    if (!binding || !kinds.includes(kind) || capture.season !== 2026 || capture.round !== binding.round || capture.captureId !== binding.captures[kind]) fail('unexpected capture');
    const suffix = kind === 'race' ? 'results' : kind;
    if (capture.path !== `data/race-desk/captures/jolpica/2026-${binding.round}-${suffix}.response`) fail('unexpected capture path');
    captures.set(capture.captureId, capture);
  }
  for (const capture of manifest.standings) {
    shape(capture, ['captureId', 'provider', 'season', 'round', 'path', 'sha256', 'bytes', 'revision', 'generatedAt', 'wrapperUrls', 'embeddedUrls'], 'standings');
    urls(capture.wrapperUrls, 'wrapper URLs'); urls(capture.embeddedUrls, 'embedded URLs');
    addId(capture.captureId, 'standings');
    if (capture.season !== 2026 || !snapshotRounds.includes(capture.round) || snapshots.has(capture.round) || capture.captureId !== `jolpica-2026-${capture.round}-standings` || capture.path !== `standings/rounds/2026-${capture.round}.json`) fail('unexpected standings pin');
    snapshots.set(capture.round, capture);
  }
  const checkedSnapshots = new Map();
  for (const [round, capture] of snapshots) {
    const result = adaptChampionshipSnapshot({ season: 2026, round, capture, raw: readBounded(base, capture.path) });
    if (result.status !== 'available') fail(`invalid standings ${round}: ${JSON.stringify(result.errors ?? result.reason)}`);
    checkedSnapshots.set(round, result);
  }
  const contexts = new Map();
  for (const race of registry.races) {
    const binding = bindings.get(race.raceId);
    if (!binding) {
      const classifications = Object.fromEntries(kinds.map(sessionKind => [sessionKind, adaptJolpicaClassification({ race, sessionKind })]));
      contexts.set(race.raceId, { classifications, comparison: { status: 'unavailable', reason: 'missing-snapshot', source: null } });
      continue;
    }
    const classifications = {};
    for (const sessionKind of kinds) {
      const capture = captures.get(binding.captures[sessionKind]);
      if (!capture) fail(`missing capture ${binding.captures[sessionKind]}`);
      const result = adaptJolpicaClassification({ race: { ...race, resultsBinding: binding }, sessionKind, capture, raw: readBounded(base, capture.path) });
      const expectedEmpty = sessionKind === 'sprint' && binding.round !== 17;
      if (expectedEmpty ? result.status !== 'unavailable' || result.reason !== 'provider-empty' : result.status !== 'available') fail(`invalid capture ${capture.captureId}: ${JSON.stringify(result.errors ?? result.reason)}`);
      classifications[sessionKind] = result;
    }
    const comparison = compareChampionshipSnapshots({ before: checkedSnapshots.get(binding.round - 1), after: checkedSnapshots.get(binding.round) });
    if (comparison.status !== 'available') fail(`invalid comparison ${race.raceId}: ${JSON.stringify(comparison.errors ?? comparison.reason)}`);
    contexts.set(race.raceId, { classifications, comparison });
  }
  return contexts;
}
