// PREPARATION ONLY: writes stubs outside the public artifact. Publish separately
// at the OLD sites only after canonical production verification and approval.
// These are client-side compatibility pages (canonical + meta refresh + script), not HTTP 301s.
// Usage: node scripts/deployment/redirects.mjs [--site <assembled site>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { files } from './assemble.mjs';

const page = (target, script) => `<!doctype html>
<html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>F1 Stories</title><link rel="canonical" href="${target}">
<meta http-equiv="refresh" content="0;url=${target}">
<script>${script}</script>
</head><body><a id="destination" href="${target}">Άνοιξε το F1 Stories</a></body></html>\n`;
// Exact page: same path on the new origin, keeping query and hash.
const exact = target => `const destination = ${JSON.stringify(target)} + location.search + location.hash; addEventListener("DOMContentLoaded", () => { document.getElementById("destination").href = destination; location.replace(destination); });`;
// Any other old path (the old site's 404): the same path under the new tool path, never its homepage.
const mapped = (legacy, base) => `const rest = location.pathname.startsWith(${JSON.stringify(legacy)}) ? location.pathname.slice(${legacy.length}) : ""; const destination = ${JSON.stringify(base)} + rest + location.search + location.hash; addEventListener("DOMContentLoaded", () => { document.getElementById("destination").href = destination; location.replace(destination); });`;

/** Compatibility documents per child: one per page the aggregate publishes, plus a path-preserving 404. */
export function legacyStubs(lock, site) {
    const out = {};
    for (const app of lock.applications.filter(app => app.path !== '/')) {
        const base = lock.origin + app.path;
        const legacy = `/${app.repository.split('/')[1]}/`;
        const pages = site ? files(site, app.path.slice(1, -1)).filter(rel => rel.endsWith('index.html')).map(rel => rel.slice(app.path.length - 1)) : ['index.html'];
        for (const rel of pages) out[`${app.application}/${rel}`] = page(base + rel.replace(/index\.html$/, ''), exact(base + rel.replace(/index\.html$/, '')));
        out[`${app.application}/404.html`] = page(base, mapped(legacy, base));
    }
    return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'scripts/deployment/sources.json'), 'utf8'));
    const args = process.argv.slice(2);
    const site = args.includes('--site') ? path.resolve(args[args.indexOf('--site') + 1]) : null;
    const output = path.join(root, '.build/aggregate/legacy-redirects');
    const stubs = legacyStubs(lock, site);
    for (const [rel, html] of Object.entries(stubs)) {
        fs.mkdirSync(path.dirname(path.join(output, rel)), { recursive: true });
        fs.writeFileSync(path.join(output, rel), html);
    }
    console.log(`Prepared (not published): ${Object.keys(stubs).length} compatibility pages in ${output}`);
}
