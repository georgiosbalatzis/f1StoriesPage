// Live, read-only connectivity check for the public APIs the tools call from the browser, as seen from the
// f1-stories.gr origin. Informational: it never gates a build (the browser smoke uses recorded fixtures), and
// it never sends credentials or writes anything. Usage: node live-read.mjs [--out report.json]
import fs from 'node:fs';
import path from 'node:path';

const ORIGIN = 'https://f1-stories.gr';
// Exactly the hosts in the tools' runtime source; TYRES has no runtime API (its build-time refresh is recorded
// in deployment-manifest.json).
export const ENDPOINTS = [
    ['telemetry, ghostcar, standings', 'OpenF1 meetings', 'https://api.openf1.org/v1/meetings?year=2026'],
    ['telemetry', 'MultiViewer circuit', 'https://api.multiviewer.app/api/v1/circuits/61/2026'],
    ['standings', 'Jolpica season', 'https://api.jolpi.ca/ergast/f1/2026.json?limit=30'],
    ['betcast', 'Google Sheets CSV (direct, then CORS proxies)', 'https://docs.google.com/spreadsheets/d/16cz7p-hZIs3PrvhL9JJ1q1tqyVEupXQ2k8kN8F9mexc/gviz/tq?tqx=out:csv&gid=796888004'],
];

export function readable(status, allowOrigin) {
    return status >= 200 && status < 300 && (allowOrigin === '*' || allowOrigin === ORIGIN);
}

async function probe([users, name, url]) {
    const started = Date.now();
    try {
        const response = await fetch(url, { headers: { Origin: ORIGIN, Accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
        const body = await response.arrayBuffer();
        const allowOrigin = response.headers.get('access-control-allow-origin');
        return { users, name, url, status: response.status, ms: Date.now() - started, bytes: body.byteLength, allowOrigin, browserReadable: readable(response.status, allowOrigin) };
    } catch (error) {
        return { users, name, url, error: error.message, ms: Date.now() - started, browserReadable: false };
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
    const results = await Promise.all(ENDPOINTS.map(probe));
    const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
    const report = { checkedAt: new Date().toISOString(), origin: ORIGIN, note: 'Live read-only probe; not a deterministic test.', results };
    if (out) fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
    for (const r of results) console.log(`${r.browserReadable ? '✓' : '·'} ${r.name} [${r.users}]: ${r.error ? `error ${r.error}` : `HTTP ${r.status}, ${r.bytes} B, ${r.ms} ms, Access-Control-Allow-Origin ${r.allowOrigin ?? 'none'}`}`);
}
