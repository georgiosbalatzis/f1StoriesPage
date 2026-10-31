import fs from 'node:fs';
import path from 'node:path';
import { validateRegistry, RegistryValidationError } from './core/index.mjs';
import { hubPath } from './hub-model.mjs';
import { PUBLIC_RACE_IDS } from './hub-publication.mjs';

export function readHubRegistry(root) {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'data/race-desk/registry.v1.json'), 'utf8'));
  const validation = validateRegistry(registry);
  if (!validation.valid) throw new RegistryValidationError(validation.errors);
  return registry;
}

export function hubFiles(root) {
  const ids = new Set(readHubRegistry(root).races.map(race => race.raceId));
  for (const id of PUBLIC_RACE_IDS) if (!ids.has(id)) throw new Error(`Missing approved GP identity: ${id}`);
  return PUBLIC_RACE_IDS.map(id => hubPath(id).slice(1) + 'index.html');
}

export function readHubEvidence(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'data/race-desk/hub-evidence.v1.json'), 'utf8'));
}
