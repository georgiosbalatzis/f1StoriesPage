import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import model from '../../../blog-module/build/newsletter/model.js';
import { renderSignupPage, renderInboxPage, renderManagePage } from './ui/render.mjs';
import { createMockProvider } from './mock-provider.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const security = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", 'referrer-policy': 'same-origin' };
// same-origin, not no-referrer: under no-referrer Chrome sends `Origin: null` on native form POSTs, which the CSRF check rejects.
export async function route({ method, url, headers = {}, body = '' }, ctx) {
    const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    const response = (status, body, type = 'text/plain; charset=utf-8') => ({ status, headers: { ...security, 'content-type': type }, body });
    if (h.host !== new URL(ctx.origin).host) return response(403, 'Forbidden');
    if (method === 'POST' && h.origin !== ctx.origin) return response(403, 'Forbidden');
    if (Buffer.byteLength(body) > 4096) return response(413, 'Too large');
    let parsed;
    try { parsed = new URL(url, ctx.origin); } catch { return response(400, 'Bad request'); }
    const theme = parsed.searchParams.get('theme') === 'light' ? 'light' : 'dark';
    const html = (status, content) => response(status, content, 'text/html; charset=utf-8');
    if (method === 'GET') {
        if (parsed.pathname === '/') return html(200, renderSignupPage({ theme }));
        if (parsed.pathname === '/mock/inbox') return html(200, renderInboxPage({ messages: ctx.provider.outbox, theme }));
        if (parsed.pathname === '/robots.txt') return response(200, 'User-agent: *\nDisallow: /\n');
        const staticFiles = { '/ui/styles.css': 'scripts/build/newsletter-preview/ui/styles.css', '/ui/client.js': 'scripts/build/newsletter-preview/ui/client.js', '/styles/editorial.css': 'styles/editorial.css', '/styles/fonts.css': 'styles/fonts.css' };
        let rel = staticFiles[parsed.pathname];
        if (/^\/assets\/fonts\/[a-zA-Z0-9._-]+\.woff2$/.test(parsed.pathname)) rel = parsed.pathname.slice(1);
        if (rel) {
            try { return response(200, fs.readFileSync(path.join(root, rel)), rel.endsWith('.css') ? 'text/css; charset=utf-8' : rel.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'font/woff2'); } catch { return response(404, 'Not found'); }
        }
        return response(404, 'Not found');
    }
    if (method !== 'POST') return response(405, 'Method not allowed');
    let input;
    const contentType = String(h['content-type'] || '').split(';')[0].trim().toLowerCase();
    try {
        if (contentType === 'application/json') input = JSON.parse(body);
        else if (contentType === 'application/x-www-form-urlencoded') {
            const params = new URLSearchParams(body);
            input = { email: params.get('email'), consent: params.get('consent') === 'yes', token: params.get('token') };
        } else return response(415, 'Unsupported media type');
    } catch { return response(400, 'Bad request'); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) return response(400, 'Bad request');
    if (parsed.pathname === '/mock/signup') {
        const result = await model.requestSignup(ctx.provider.adapter, input, { policyVersion: 'preview-0', sourceForm: 'local-preview' });
        if (String(h.accept || '').includes('application/json')) return response(200, JSON.stringify(result), 'application/json; charset=utf-8');
        return html(200, renderSignupPage({ state: result.result, errors: result.errors || {}, email: result.result === 'invalid' ? input.email : '', theme }));
    }
    if (parsed.pathname === '/mock/confirm') {
        return html(200, renderManagePage({ state: model.managementResult(ctx.provider.confirm(input.token)), theme }));
    }
    if (parsed.pathname === '/mock/manage') return html(200, renderManagePage(ctx.provider.isManagementToken(input.token) ? { token: input.token, theme } : { state: 'neutral', theme }));
    if (parsed.pathname === '/mock/unsubscribe') {
        let outcome;
        try { outcome = await ctx.provider.adapter.unsubscribe(input.token, {}); } catch { outcome = { kind: 'error' }; }
        return html(200, renderManagePage({ state: model.managementResult(outcome), theme }));
    }
    return response(404, 'Not found');
}
export async function startPreview({ host = '127.0.0.1', port = 0 } = {}) {
    if (host !== '127.0.0.1') throw new Error('loopback host required');
    const provider = createMockProvider();
    let origin;
    const server = http.createServer(async (req, res) => {
        let size = 0;
        const chunks = [];
        for await (const chunk of req) { size += chunk.length; if (size <= 4096) chunks.push(chunk); }
        try {
            const result = await route({ method: req.method, url: req.url, headers: req.headers, body: size > 4096 ? 'x'.repeat(4097) : Buffer.concat(chunks).toString('utf8') }, { origin, provider });
            res.writeHead(result.status, result.headers); res.end(result.body);
        } catch { res.writeHead(500, security); res.end('Error'); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
    origin = `http://${host}:${server.address().port}`;
    return { origin, close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())), provider };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--port' || !/^\d+$/.test(args[1]) || Number(args[1]) > 65535)) { console.error('Usage: node server.mjs [--port N]'); process.exitCode = 2; }
    else startPreview({ port: args.length ? Number(args[1]) : 0 }).then(({ origin }) => console.log(origin)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
