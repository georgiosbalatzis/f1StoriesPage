// PREPARATION ONLY: writes stubs outside the public artifact. Publish separately
// at the OLD sites only after canonical production verification and approval.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'scripts/deployment/sources.json'), 'utf8'));
const output = path.join(root, '.build/aggregate/legacy-redirects');
for (const app of lock.applications.filter(app => app.path !== '/')) {
    const target = lock.origin + app.path;
    const directory = path.join(output, app.application);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'index.html'), `<!doctype html>
<html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>F1 Stories</title><link rel="canonical" href="${target}">
<meta http-equiv="refresh" content="0;url=${target}">
<script>const destination = ${JSON.stringify(target)} + location.search + location.hash; addEventListener("DOMContentLoaded", () => { document.getElementById("destination").href = destination; location.replace(destination); });</script>
</head><body><a id="destination" href="${target}">Άνοιξε το F1 Stories</a>
<script>document.getElementById('destination').href=${JSON.stringify(target)}+location.search+location.hash;</script>
</body></html>\n`);
}
console.log(`Prepared (not published): ${output}`);
