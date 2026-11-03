import fs from 'node:fs';
import path from 'node:path';
import { selectGateways } from './gateway.mjs';

export function readGatewayManifest(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'data/audience/race-gateways.v1.json'), 'utf8'));
}

export function readGatewaySelection(root, registry, models, { today } = {}) {
  const manifest = readGatewayManifest(root);
  const editorialManifest = JSON.parse(fs.readFileSync(path.join(root, 'data/race-desk/editorial.v1.json'), 'utf8'));
  return new Map(selectGateways({ manifest, registry, editorialManifest, models, today })
    .filter(item => item.eligible).map(item => [item.raceId, item.view]));
}
