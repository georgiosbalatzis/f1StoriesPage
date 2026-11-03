import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import taxonomy from '../../blog-module/taxonomy.js';
import { readHubRegistry } from './hub-files.mjs';
import { readGatewayManifest } from './gateway-files.mjs';
import { gatewayDigest, selectGateways, validateGatewayManifest } from './gateway.mjs';
import { prepareHubModels } from '../build/race-desk-hubs.mjs';

try {
  // `npm run gateways:validate -- --digest <raceId>` arrives as `--validate --digest <raceId>`.
  let args = process.argv.slice(2);
  if (args[0] === '--validate' && args[1] === '--digest') args = args.slice(1);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const manifest = readGatewayManifest(root), registry = readHubRegistry(root);
  const editorialManifest = JSON.parse(fs.readFileSync(path.join(root, 'data/race-desk/editorial.v1.json'), 'utf8'));
  if (args[0] === '--digest' && args.length === 2) {
    validateGatewayManifest(manifest, { registry, editorialManifest });
    const gateway = manifest.gateways.find(item => item.raceId === args[1]);
    if (!gateway) throw new Error(`Unknown gateway: ${args[1]}`);
    console.log(gatewayDigest(gateway));
  } else if (args[0] === '--validate') {
    let today = taxonomy.athensDay(), strict = false;
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--strict' && !strict) strict = true;
      else if (args[i] === '--day' && args[i + 1]) today = args[++i];
      else throw new Error('Usage: --validate [--strict] [--day YYYY-MM-DD] | --digest <raceId>');
    }
    if (!taxonomy.isDay(today)) throw new Error('Invalid day');
    const { models } = prepareHubModels(root, { today });
    const rows = selectGateways({ manifest, registry, editorialManifest, models, today });
    for (const row of rows) console.log(`${row.raceId} ${row.status} eligible=${row.eligible ? 'yes' : 'no'} reasons=${row.reasons.map(reason => `${reason.code}:${reason.detail}`).join(',') || '-'}`);
    if (strict && rows.some(row => row.status === 'published' && !row.eligible)) process.exitCode = 1;
  } else throw new Error('Usage: --validate [--strict] [--day YYYY-MM-DD] | --digest <raceId>');
} catch (error) { console.error(error.message); process.exitCode = 1; }
