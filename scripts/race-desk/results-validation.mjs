import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC_RACE_IDS } from './hub-publication.mjs';
import { hubPath } from './hub-model.mjs';
import { renderResultsSection } from './results-render.mjs';

// Asset stamping leaves this static section intact; compare against the validated source model.
export function validateResultsOutput(root, contexts) {
  const errors = [];
  for (const [raceId, context] of contexts) {
    if (!PUBLIC_RACE_IDS.includes(raceId)) continue;
    const file = hubPath(raceId).slice(1) + 'index.html';
    let html;
    try { html = fs.readFileSync(path.join(root, file), 'utf8'); }
    catch { errors.push(`${file}: missing results output`); continue; }
    const section = renderResultsSection(context);
    if (!html.includes(section) || (html.match(/id="gp-results-title"/g) ?? []).length !== 1) errors.push(`${file}: captured results output differs from validated sources`);
  }
  return errors;
}
