// Prints `extra=<major>` for the setup action: the one child Node major beyond Main's, needed once
// aggregation is release-ready, or by the Ecosystem dry run (--rehearsal). Main-only runs print `extra=`.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export function extraNode(config, main = '22', { rehearsal = false } = {}) {
    if (!rehearsal && !config.enabled && !config.releaseReady) return '';
    const majors = [...new Set(config.applications.map(app => app.node).filter(node => node !== main))];
    if (majors.length > 1) throw new Error(`One extra Node toolchain is supported; the lock declares ${majors.join(', ')}`);
    return majors[0] || '';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const config = JSON.parse(fs.readFileSync(new URL('./sources.json', import.meta.url)));
    console.log(`extra=${extraNode(config, '22', { rehearsal: process.argv.includes('--rehearsal') })}`);
}
