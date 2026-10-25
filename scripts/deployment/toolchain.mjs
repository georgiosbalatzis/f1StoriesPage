// Prints `extra=<major>` for the setup action: the one child Node major beyond Main's, needed only
// once aggregation is release-ready. Main-only runs print `extra=` and provision nothing.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export function extraNode(config, main = '22') {
    if (!config.enabled && !config.releaseReady) return '';
    const majors = [...new Set(config.applications.map(app => app.node).filter(node => node !== main))];
    if (majors.length > 1) throw new Error(`One extra Node toolchain is supported; the lock declares ${majors.join(', ')}`);
    return majors[0] || '';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    console.log(`extra=${extraNode(JSON.parse(fs.readFileSync(new URL('./sources.json', import.meta.url))))}`);
}
