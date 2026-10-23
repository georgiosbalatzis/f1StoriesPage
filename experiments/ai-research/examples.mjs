import { mkdir, writeFile } from 'node:fs/promises';
import { demoDossier, examples } from './fixtures.mjs';
import { briefText } from './brief.mjs';

// Deterministic DEMO exports only. This script cannot invoke the provider.
const directory = new URL('./evidence/dossiers/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const example of examples) {
    const result = demoDossier({ question: example.question, season: '2026', grandPrix: '', session: example.session, category: example.category });
    await writeFile(new URL(`${example.id}.txt`, directory), briefText(result), 'utf8');
}
console.log('Four DEMO dossiers written to experiments/ai-research/evidence/dossiers/. No provider calls.');
