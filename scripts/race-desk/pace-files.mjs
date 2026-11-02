import fs from 'node:fs';
import { readBounded } from './capture-files.mjs';
import { readTimelineInventory, validateBatch, MAX_CAPTURE_BYTES } from './timeline-files.mjs';
import { buildPaceContext } from './pace.mjs';

const paceEndpoints = ['laps', 'stints', 'drivers'];
const timelineEndpoints = ['sessions', 'pit', 'race_control'];
const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('\0') === [...expected].sort().join('\0');
const fail = message => { throw new Error(`Pace archive: ${message}`); };

export function validatePaceInventory(inventory, registry, timeline, readBytes) {
  if (!keys(inventory, ['schemaVersion', 'captures', 'timelineBindings']) || inventory.schemaVersion !== 1 || !Array.isArray(inventory.captures) || !Array.isArray(inventory.timelineBindings) || !inventory.captures.every(item => paceEndpoints.includes(item?.endpoint))) fail('invalid inventory');
  const raceIds = new Set(inventory.captures.map(item => item.raceId));
  const bound = [], seen = new Set();
  for (const binding of inventory.timelineBindings) {
    if (!keys(binding, ['raceId', 'sessionKind', 'sources']) || binding.sessionKind !== 'race' || !raceIds.has(binding.raceId) || seen.has(binding.raceId) || !Array.isArray(binding.sources) || binding.sources.length !== 3) fail('invalid binding');
    seen.add(binding.raceId);
    const endpoints = new Set();
    for (const source of binding.sources) {
      if (!keys(source, ['endpoint', 'captureId', 'sha256']) || !timelineEndpoints.includes(source.endpoint) || endpoints.has(source.endpoint)) fail('invalid binding source');
      endpoints.add(source.endpoint);
      const receipt = timeline.receipts.find(item => item.captureId === source.captureId);
      if (!receipt || receipt.raceId !== binding.raceId || receipt.sessionKind !== binding.sessionKind || receipt.endpoint !== source.endpoint || receipt.sha256 !== source.sha256) fail('timeline pin mismatch');
      bound.push(receipt);
    }
  }
  if (seen.size !== raceIds.size) fail('missing binding');
  const receipts = [...inventory.captures, ...bound];
  const payloads = validateBatch(receipts, registry, readBytes);
  for (const receipt of inventory.captures) {
    if (receipt.captureId !== `openf1-${receipt.query.session_key}-${receipt.endpoint}`) fail('invalid capture ID');
  }
  return { receipts, payloads, rights: timeline.rights };
}

export function readPaceInventory(root, registry) {
  const base = fs.realpathSync(root);
  const inventory = JSON.parse(readBounded(base, 'data/race-desk/pace.v1.json', 5_000_000).toString('utf8'));
  const timeline = readTimelineInventory(base, registry);
  return validatePaceInventory(inventory, registry, timeline, receipt => readBounded(base, receipt.path, MAX_CAPTURE_BYTES));
}

export function readPaceContexts(root, registry) {
  const { receipts, payloads, rights } = readPaceInventory(root, registry);
  return new Map(registry.races.map(race => [race.raceId, buildPaceContext({ race, receipts: receipts.filter(item => item.raceId === race.raceId), payloads, rights })]));
}
