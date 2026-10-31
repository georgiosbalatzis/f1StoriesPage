import fs from 'node:fs';
import path from 'node:path';
import { validateRegistry, RegistryValidationError } from './core/index.mjs';
import { hubPath } from './hub-model.mjs';

export function readHubRegistry(root) {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'data/race-desk/registry.v1.json'), 'utf8'));
  const validation = validateRegistry(registry);
  if (!validation.valid) throw new RegistryValidationError(validation.errors);
  return registry;
}

export function hubFiles(root) {
  return readHubRegistry(root).races.map(race => hubPath(race.raceId).slice(1) + 'index.html').sort();
}
