import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readEditorialSelection } from './editorial-files.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const today = process.argv[2];
const registry = JSON.parse(readFileSync(new URL('../../data/race-desk/registry.v1.json', import.meta.url)));
try {
  // The day is explicit so a historical report is reproducible; never fall back to the clock.
  if (!today) throw new Error('Usage: editorial-report.mjs YYYY-MM-DD');
  const selection = readEditorialSelection(root, registry, { today });
  console.log(JSON.stringify({ today, races: [...selection].map(([raceId, articles]) => ({ raceId, articleCount: articles.length, articleIds: articles.map(a => a.articleId) })) }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
