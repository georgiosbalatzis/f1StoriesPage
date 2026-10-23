import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { configuration, liveResearch, TIMEOUT_MS, OUTPUT_BYTES } from './provider.mjs';
import { validateInput } from './schema.mjs';
import { demoDossier, examples } from './fixtures.mjs';
import { briefText } from './brief.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const INPUT_BYTES = 8192;
const normalize = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ς/g, 'σ');
export async function internalLookup(query) {
    if (typeof query !== 'string' || query.trim().length < 2 || query.length > 100) throw new Error('Δώσε 2–100 χαρακτήρες για την τοπική αναζήτηση.');
    // Read published metadata only, on explicit local lookup. Never read article bodies or drafts.
    const data = JSON.parse(await readFile(path.join(root, 'blog-module/blog-index-data.json'), 'utf8'));
    if (data.v !== 2 || !Array.isArray(data.p)) throw new Error('Μη διαθέσιμος κατάλογος.');
    const q = normalize(query.trim());
    return data.p.filter(row => typeof row[1] === 'string' && normalize(row[1]).includes(q))
        .filter(row => /^[\p{L}\p{N}_-]+$/u.test(row[0])).slice(0, 8)
        .map(row => ({ title: row[1], date: row[3], url: `https://f1-stories.gr/blog-module/blog-entries/${encodeURIComponent(row[0])}/article.html` }));
}
const files = new Map([
    ['/', ['public/index.html', 'text/html; charset=utf-8']],
    ['/app.js', ['public/app.js', 'text/javascript; charset=utf-8']],
    ['/app.css', ['public/app.css', 'text/css; charset=utf-8']],
]);
export function createResearchServer({ env = process.env, provider = liveResearch, timeoutMs = TIMEOUT_MS } = {}) {
    const config = configuration(env), csrf = randomBytes(32).toString('hex');
    let liveRequests = 0, busy = false;
    const active = new Set();
    const server = http.createServer(async (req, res) => {
        const origin = `http://127.0.0.1:${server.address().port}`;
        res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
        res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Cache-Control', 'no-store'); res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        const json = (status, value) => {
            if (res.destroyed) return;
            const body = JSON.stringify(value);
            if (Buffer.byteLength(body) > OUTPUT_BYTES) { res.writeHead(502, { 'Content-Type': 'application/json' }).end('{"error":"Output size limit exceeded"}'); return; }
            res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }).end(body);
        };
        if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)
            || (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))) {
            json(403, { error: 'Μη επιτρεπόμενο Host ή Origin.' }); return;
        }
        let url;
        try { url = new URL(req.url, origin); } catch { json(400, { error: 'Μη έγκυρο URL.' }); return; }
        if (url.origin !== origin) { json(403, { error: 'Μη επιτρεπόμενο URL.' }); return; }
        if (req.method === 'GET') {
            if (url.pathname === '/api/config') {
                json(200, { csrf, defaultMode: 'DEMO', liveAvailable: config.mode === 'LIVE' && !!config.key,
                    liveUnavailableReason: !config.key ? 'Η ζωντανή έρευνα δεν είναι διαθέσιμη: λείπει OPENAI_API_KEY.' : config.mode !== 'LIVE' ? 'Η ζωντανή έρευνα είναι απενεργοποιημένη στον server.' : '',
                    model: config.model, maxRequests: config.maxRequests, liveRequests, busy, timeoutMs, maxOutputTokens: config.maxOutputTokens, examples }); return;
            }
            if (url.pathname === '/api/internal') {
                try { json(200, { references: await internalLookup(url.searchParams.get('q')), note: 'Τοπικές εσωτερικές αναφορές· δεν αποτελούν ανεξάρτητη επαλήθευση και δεν αποστέλλονται στον πάροχο.' }); }
                catch { json(400, { error: 'Η τοπική αναζήτηση χρειάζεται 2–100 χαρακτήρες και διαθέσιμο δημόσιο κατάλογο.' }); }
                return;
            }
            const font = new Map([
                ['/font.woff2', 'ibm-plex-sans-400-600.woff2'],
                ['/font-greek.woff2', 'ibm-plex-sans-400-600-greek.woff2'],
            ]).get(url.pathname);
            const asset = files.get(url.pathname);
            if (!asset && !font) { json(404, { error: 'Δεν βρέθηκε.' }); return; }
            try {
                const content = await readFile(font ? path.join(root, 'assets/fonts', font) : path.join(here, asset[0]));
                res.writeHead(200, { 'Content-Type': font ? 'font/woff2' : asset[1] }).end(content);
            } catch { json(404, { error: 'Δεν βρέθηκε.' }); }
            return;
        }
        if (req.method !== 'POST' || url.pathname !== '/api/research') { json(405, { error: 'Μη επιτρεπόμενη ενέργεια.' }); return; }
        if (req.headers.origin !== origin || req.headers['x-f1s-research'] !== csrf) { json(403, { error: 'Η συνεδρία χρειάζεται ανανέωση της σελίδας.' }); return; }
        if (req.headers['content-type'] !== 'application/json') { json(415, { error: 'Απαιτείται JSON.' }); return; }
        if (Number(req.headers['content-length']) > INPUT_BYTES) { json(413, { error: 'Το ερώτημα είναι υπερβολικά μεγάλο.' }); return; }
        let input;
        try {
            let size = 0; const chunks = [];
            for await (const chunk of req) {
                size += chunk.length;
                if (size > INPUT_BYTES) { json(413, { error: 'Το ερώτημα είναι υπερβολικά μεγάλο.' }); return; }
                chunks.push(chunk);
            }
            input = validateInput(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch { json(400, { error: 'Έλεγξε το ερώτημα (8–1200 χαρακτήρες), τη σεζόν και τα πεδία έρευνας.' }); return; }
        if (input.mode === 'DEMO') {
            const result = demoDossier(input); json(200, { ...result, brief: briefText(result), liveRequests }); return;
        }
        if (config.mode !== 'LIVE' || !config.key || !input.activateLive) {
            json(403, { error: !config.key ? 'Η ζωντανή έρευνα δεν είναι διαθέσιμη: λείπει OPENAI_API_KEY.' : 'Χρειάζεται LIVE στον server και ρητή ενεργοποίηση για αυτή την πληρωμένη κλήση.' }); return;
        }
        if (busy) { json(429, { error: 'Υπάρχει ήδη μία ζωντανή έρευνα σε εξέλιξη.' }); return; }
        if (liveRequests >= config.maxRequests) { json(429, { error: 'Συμπληρώθηκε το όριο ζωντανών αιτημάτων της συνεδρίας.' }); return; }
        busy = true; liveRequests++;
        const controller = new AbortController(); active.add(controller);
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
        const cancel = () => { if (!res.writableEnded) controller.abort(); };
        res.on('close', cancel);
        try {
            const aborted = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true }));
            const result = await Promise.race([provider(input, config, controller.signal), aborted]);
            json(200, { ...result, brief: briefText(result), liveRequests });
        } catch (error) {
            json(timedOut ? 504 : 502, { error: timedOut ? 'Η έρευνα υπερέβη το χρονικό όριο. Δεν έγινε αυτόματη επανάληψη.' : 'Η έρευνα ακυρώθηκε ή ο πάροχος επέστρεψε σφάλμα / μη έγκυρα στοιχεία. Δεν έγινε αυτόματη επανάληψη.',
                usage: error.usage || { estimatedUSD: null, note: 'Η τελική χρήση δεν αναφέρθηκε. Ενδέχεται να υπάρχει χρέωση· έλεγξε τον πάροχο.' }, liveRequests });
        } finally {
            clearTimeout(timer); active.delete(controller); res.off('close', cancel); busy = false;
        }
    });
    server.requestTimeout = 10000; server.headersTimeout = 5000; server.maxHeadersCount = 30;
    server.on('close', () => { for (const controller of active) controller.abort(); });
    return server;
}
export async function startResearchServer(options = {}) {
    const server = createResearchServer(options);
    const port = options.port ?? 4317;
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
    return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    startResearchServer().then(server => console.log(`AI Research — local only: http://127.0.0.1:${server.address().port} (browser defaults to DEMO)`))
        .catch(() => { console.error('Research server failed. Check local port and configuration.'); process.exitCode = 1; });
}
