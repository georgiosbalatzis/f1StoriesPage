// Recorded OpenF1/Jolpica data: scripts/perf/fixtures/standings-2026-10-15.json.gz;
// provenance and capture date are recorded in that fixture. The existing providerPayload
// validates response hashes. Podcast and audio tests supply their own synthetic routes.
import fs from 'node:fs';
import path from 'node:path';
import { providerPayload } from './standings-interactions-qa.mjs';

const intentionallyOffline = new Set(['anchor.fm', 'www.googletagmanager.com', 'www.google-analytics.com', 'www.youtube.com', 'www.youtube-nocookie.com', 'i.ytimg.com', 'open.spotify.com', 'accounts.spotify.com']);
// Only the two configured BetCast sheets and their actual CSV URL shapes are fixture-backed.
export function isBetcastCsv(requestUrl) {
    let url;
    try {
        url = new URL(requestUrl);
        if (url.origin === 'https://corsproxy.io' && url.pathname === '/') url = new URL(decodeURIComponent(url.search.slice(1)));
        else if (url.origin === 'https://api.allorigins.win' && url.pathname === '/raw' && [...url.searchParams.keys()].join(',') === 'url') url = new URL(url.searchParams.get('url'));
    } catch { return false; }
    if (url.origin !== 'https://docs.google.com') return false;
    const sources = new Map([['16cz7p-hZIs3PrvhL9JJ1q1tqyVEupXQ2k8kN8F9mexc', '796888004'], ['1nMytseR9C-GJNri0n5DAW25jijullNMVUcTj1mLEEYs', null]]);
    const match = url.pathname.match(/^\/spreadsheets\/d\/([^/]+)\/(export|gviz\/tq)$/);
    if (!match || !sources.has(match[1])) return false;
    const expected = match[2] === 'export' ? 'format' : 'tqx';
    const value = match[2] === 'export' ? 'csv' : 'out:csv';
    const gid = sources.get(match[1]);
    return url.searchParams.get(expected) === value && url.searchParams.get('gid') === gid &&
        [...url.searchParams.keys()].sort().join(',') === [expected, ...(gid ? ['gid'] : [])].sort().join(',');
}
export function classifyRequest(url, origin) {
    const parsed = new URL(url);
    if (parsed.origin === origin) return 'local';
    if (isBetcastCsv(url)) return 'betcast-csv';
    if (['api.openf1.org', 'api.jolpi.ca'].includes(parsed.hostname)) return 'provider';
    if (intentionallyOffline.has(parsed.hostname)) return 'offline';
    return 'unexpected';
}
export async function guardContext(context, origin, violations, { freeze = true, artifactRoot = '', notes = [] } = {}) {
    const manifestPath = path.join(artifactRoot, 'deployment-manifest.json');
    const applications = artifactRoot && fs.existsSync(manifestPath)
        ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')).applications : artifactRoot ? [] : null;
    if (applications !== null && !Array.isArray(applications)) throw new Error('Invalid deployment manifest: applications must be an array');
    await context.route('**/*', async route => {
        const url = route.request().url();
        const parsed = new URL(url);
        // Pinned article iframes use absolute production URLs. Serve those bytes from
        // the selected frozen artifact; never contact the production host.
        if (artifactRoot && parsed.origin === 'https://f1-stories.gr') {
            const child = parsed.pathname.match(/^\/(betcast|telemetry|ghostcar|tyres)(?:\/|$)/)?.[1];
            if (child && applications && !applications.some(app => app.application === child)) {
                notes.push(`child app ${child} not in dist; embed not loaded`);
                return route.abort();
            }
            let pathname = decodeURIComponent(parsed.pathname);
            if (pathname.endsWith('/')) pathname += 'index.html';
            const file = path.resolve(artifactRoot, `.${pathname}`);
            if (file.startsWith(path.resolve(artifactRoot) + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
                const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp' };
                return route.fulfill({ status: 200, contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
            }
            violations.push(`unrecorded production artifact request ${url}`);
            return route.abort();
        }
        const kind = classifyRequest(url, origin);
        if (kind === 'local') return route.continue();
        if (kind === 'betcast-csv') return route.fulfill({ status: 200, contentType: 'text/csv', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(new URL('./fixtures/qa/betcast-cls.csv', import.meta.url)) });
        if (kind === 'provider') {
            try {
                const payload = providerPayload(new URL(url));
                return await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(payload) });
            } catch (error) {
                violations.push(`unrecorded provider request ${url}: ${error.message}`);
                return route.abort();
            }
        }
        if (kind === 'unexpected') violations.push(`unexpected origin ${url}`);
        return route.abort();
    });
    if (context.routeWebSocket) await context.routeWebSocket('**/*', socket => {
        const url = new URL(socket.url());
        const expected = new URL(origin);
        if (url.hostname === expected.hostname && url.port === expected.port) return socket.connectToServer();
        violations.push(`unexpected WebSocket origin ${socket.url()}`);
        socket.close();
    });
    if (freeze) await context.addInitScript(() => {
        const NativeDate = Date;
        const instant = NativeDate.parse('2026-10-15T12:00:00Z');
        class FixedDate extends NativeDate {
            constructor(...args) { super(...(args.length ? args : [instant])); }
            static now() { return instant; }
        }
        window.Date = FixedDate;
    });
}

// Predicates shared with the small assertion self-tests.
export const matchesCountdown = (state, name, timer) => state.name === name && state.timer === timer;
export const hasPausedAudioLabel = state => state.aria === 'Αναπαραγωγή BetCast, ON AIR.';
