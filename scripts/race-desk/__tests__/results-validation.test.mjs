import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { readResultsContexts } from '../results-files.mjs';
import { renderResultsSection } from '../results-render.mjs';
import { validateResultsOutput } from '../results-validation.mjs';

const sourceRoot = new URL('../../../', import.meta.url);
const registry = JSON.parse(fs.readFileSync(new URL('data/race-desk/registry.v1.json', sourceRoot)));
const context = readResultsContexts(fileURLToPath(sourceRoot), registry).get('2026-japanese-gp');
const contexts = new Map([['2026-japanese-gp', context]]);
test('rejects stale, duplicated and missing static result sections against the validated source model', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'race-results-output-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'race-desk/gp/2026-japanese-gp/index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const html = renderResultsSection(context);
  fs.writeFileSync(file, html);
  assert.deepEqual(validateResultsOutput(root, contexts), []);
  assert.deepEqual(validateResultsOutput(root, new Map([...contexts, ['2027-unpublished-gp', context]])), []); // Private registry additions do not publish routes.
  const updated = structuredClone(context);
  updated.classifications.race.entries[0].points = '24';
  assert.match(validateResultsOutput(root, new Map([['2026-japanese-gp', updated]])).join('\n'), /differs/);
  fs.writeFileSync(file, html + html);
  assert.match(validateResultsOutput(root, contexts).join('\n'), /differs/);
  fs.unlinkSync(file);
  assert.match(validateResultsOutput(root, contexts).join('\n'), /missing/);
});
