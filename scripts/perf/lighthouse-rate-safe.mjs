#!/usr/bin/env node
// Local replay and discovery; acceptance still requires independently enforced egress isolation.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import puppeteer from 'puppeteer-core';
import { loadBudget, resolveRequest, startServer, closeChrome, launchAuditChrome, seedAuditConsent, clearServiceWorkers, latestArticlePath, runLighthouse, medianMetrics, evaluateRoute, routeMetrics, inlineCssBytes } from './lighthouse-guard.mjs';

export function requestKey(method, input) {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error('Invalid request URL');
    const query = [...url.searchParams].sort(([ak, av], [bk, bv]) => ak < bk ? -1 : ak > bk ? 1 : av < bv ? -1 : av > bv ? 1 : 0);
    return JSON.stringify([method, url.origin, url.pathname, query]);
}

export function loadFixtures(manifestPath) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!Array.isArray(manifest.fixtures)) throw new Error('fixtures must be an array');
    const fixtures = new Map();
    for (const item of manifest.fixtures) {
        if (item.method !== 'GET' || !Number.isInteger(item.status) || item.status < 200 || item.status > 599 || !item.headers || Array.isArray(item.headers) || typeof item.headers !== 'object' || typeof item.body !== 'string' || !/^sha256-[a-f0-9]{64}$/.test(item.sha256 || '')) throw new Error('Invalid fixture metadata');
        const key = requestKey(item.method, item.url);
        if (fixtures.has(key)) throw new Error('Duplicate fixture request');
        const body = fs.readFileSync(path.resolve(path.dirname(manifestPath), item.body));
        if (body.length > 10 * 1024 * 1024 || createHash('sha256').update(body).digest('hex') !== item.sha256.slice(7)) throw new Error('Invalid fixture body');
        const headers = Object.entries(item.headers).map(([name, value]) => {
            if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || typeof value !== 'string' || /[\r\n]/.test(value)) throw new Error('Invalid fixture header');
            return { name, value };
        }).filter(({ name }) => !/^(content-length|content-encoding|transfer-encoding)$/i.test(name));
        fixtures.set(key, { responseCode: item.status, responseHeaders: headers, body: body.toString('base64') });
    }
    return fixtures;
}

export function classifyRequest(request, firstPartyOrigin, fixtures) {
    const url = new URL(request.url);
    if (url.origin === firstPartyOrigin && !url.username && !url.password) return { action: 'continue' };
    const fixture = fixtures.get(requestKey(request.method, request.url));
    return fixture ? { action: 'fulfill', fixture } : { action: 'abort', cause: `Unmatched request: ${request.method} ${request.url}` };
}


export function summarizeAttempts(route, attempts, required) {
    const valid = attempts.filter(attempt => attempt.valid && attempt.metrics);
    if (valid.length < required) return { valid: valid.length, failures: [`Only ${valid.length}/${required} valid attempts`] };
    const metrics = medianMetrics(valid.map(attempt => attempt.metrics));
    return { valid: valid.length, ...evaluateRoute(route, metrics) };
}

// Browser-level auto-attach pauses new targets before their first request. Each child
// installs the same interception before it is resumed, including nested targets.
export const CLOSED_PROXY_FLAGS = ['--disable-quic', '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=<-loopback>;127.0.0.1;localhost;[::1]'];

export async function intercept(browser, origin, fixtures, attempt, discovery = false) {
    const root = await browser.target().createCDPSession();
    const pending = new Set();
    const track = promise => {
        pending.add(promise);
        promise.catch(error => attempt.causes.push(`Observer: ${error.message}`)).finally(() => pending.delete(promise));
    };
    const attach = async (parent, event) => {
        const session = parent.connection().session(event.sessionId);
        if (!session) throw new Error(`Missing session for ${event.targetInfo.type}`);
        const targetInfo = event.targetInfo;
        const initiators = new Map();
        session.on('Target.attachedToTarget', child => track(attach(session, child)));
        let fetchSupported = true;
        session.on('Network.requestWillBeSent', event => {
            initiators.set(event.requestId, event.initiator);
            if (!fetchSupported && /^https?:/.test(event.request.url) && new URL(event.request.url).origin !== origin) {
                attempt.requests.push({ method: event.request.method, url: event.request.url, targetType: targetInfo.type, targetId: targetInfo.targetId, action: 'observed-fetchless' });
                attempt.causes.push(`Fetch-less target external request: ${event.request.url}`);
            }
        });
        session.on('Fetch.requestPaused', event => track((async () => {
            const { request, requestId, networkId } = event;
            let decision;
            try { decision = classifyRequest(request, origin, fixtures); }
            catch (error) { decision = { action: 'abort', cause: `Invalid request ${request.url}: ${error.message}` }; }
            if (decision.action === 'continue') return session.send('Fetch.continueRequest', { requestId });
            const record = { method: request.method, url: request.url, resourceType: event.resourceType, frameId: event.frameId || null, targetType: targetInfo.type, targetId: targetInfo.targetId, initiator: initiators.get(networkId) || null, action: decision.action };
            attempt.requests.push(record);
            if (decision.action === 'fulfill') return session.send('Fetch.fulfillRequest', { requestId, ...decision.fixture });
            attempt.causes.push(decision.cause);
            return session.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
        })()));
        if (event.targetInfo.type === 'page') {
            session.on('Page.loadEventFired', () => track((async () => {
                const { result } = await session.send('Runtime.evaluate', { expression: `new Promise(resolve => setTimeout(() => resolve(JSON.stringify({url:location.href,readyState:document.readyState,hasMain:!!document.querySelector('main'),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},theme:document.documentElement.getAttribute('data-theme'),routeState:{hero:!!document.querySelector('#hero-image'),calendar:!!document.querySelector('.ed-cal__months'),round:document.querySelector('#round-num')?.textContent.trim() || null,standingsRows:document.querySelectorAll('#drivers-table .st-row[data-detail-target]').length,articleHero:!!document.querySelector('img.article-header-img'),title:!!document.querySelector('h1')},consent:JSON.parse(localStorage.getItem('f1stories-cookie-consent-v1') || 'null'),serviceWorker:{controlled:!!navigator.serviceWorker?.controller}})), 1000))`, returnByValue: true, awaitPromise: true });
                if (result.value) attempt.observations.push({ ...JSON.parse(result.value), targetId: targetInfo.targetId });
            })().catch(error => { if (!/Inspected target navigated or closed|Target closed/.test(error.message)) throw error; })));
            await session.send('Page.enable');
        }
        await session.send('Network.enable');
        try { await session.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] }); } catch (error) {
            if (targetInfo.type !== 'worker' || !error.message.includes("wasn't found")) throw error;
            fetchSupported = false;
        }
        if (['page', 'iframe', 'worker', 'shared_worker', 'service_worker'].includes(event.targetInfo.type)) {
            try { await session.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }); }
            catch (error) { if (['page', 'iframe'].includes(event.targetInfo.type)) throw error; }
        }
        await session.send('Runtime.runIfWaitingForDebugger');
    };
    root.on('Target.attachedToTarget', event => track(attach(root, event)));
    await root.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
    const drain = async () => { while (pending.size) await Promise.allSettled([...pending]); };
    const stop = async () => { await drain(); await root.detach(); };
    stop.drain = drain;
    return stop;
}

async function main(argv) {
    const options = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--discovery') options.discovery = true;
        else if (['--target-dir', '--label', '--routes', '--attempts', '--out', '--manifest'].includes(argv[i]) && argv[i + 1]) options[argv[i].slice(2)] = argv[++i];
        else throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
    }
    if (!options['target-dir'] || !['main', 'aggregate'].includes(options.label) || !options.out) throw new Error('Usage: --target-dir DIR --label main|aggregate [--routes Home,Blog,Standings,Article] [--attempts N] --out DIR [--discovery]');
    const count = Number(options.attempts || 3);
    if (!Number.isInteger(count) || count < 1) throw new Error('attempts must be a positive integer');
    const budget = loadBudget(path.resolve('perf/lighthouse-budget.json'));
    const names = options.routes?.split(',').map(name => name.trim().toLowerCase());
    const routes = budget.routes.filter(route => !names || names.includes(route.name.toLowerCase()) || names.includes(route.path.toLowerCase()) || (route.name === 'Home' && names.includes('homepage')));
    if (!routes.length || (names && names.length !== routes.length)) throw new Error('Unknown or duplicate route');
    const site = path.resolve(options['target-dir']);
    const out = path.resolve(options.out, options.label);
    fs.mkdirSync(out, { recursive: true });
    const fixtures = loadFixtures(path.resolve(options.manifest || new URL('./fixtures/p02/manifest.json', import.meta.url).pathname));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rate-safe-profile-'));
    const report = { label: options.label, discovery: !!options.discovery, routes: [] };
    let server, chrome, browser, stop;
    try {
        const started = await startServer(site); server = started.server;
        chrome = await launchAuditChrome(profile, CLOSED_PROXY_FLAGS);
        browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
        const current = { causes: [], requests: [], observations: [] };
        stop = await intercept(browser, started.origin, fixtures, current, !!options.discovery);
        await seedAuditConsent(chrome, started.origin);
        for (const configured of routes) {
            const route = configured.path === 'latest-article' ? { ...configured, path: latestArticlePath(site) } : configured;
            const attempts = [];
            for (let i = 1; i <= (options.discovery ? 1 : count); i++) {
                current.causes.length = current.requests.length = current.observations.length = 0;
                await clearServiceWorkers(chrome, started.origin);
                const expected = new URL(route.path, started.origin).href;
                let lhr;
                try {
                    if (options.discovery) {
                        const page = await browser.newPage();
                        await page.goto(expected, { waitUntil: 'networkidle2', timeout: 30000 });
                        await page.close();
                    } else lhr = await runLighthouse(route, started.origin, budget, out, chrome.port, i);
                } catch (error) { current.causes.push(`Run: ${error.message}`); }
                await stop.drain();
                const expectedFinal = route.name === 'Standings' ? `${expected}?tab=drivers` : expected;
                const observation = current.observations.filter(value => value.url === expected || value.url === expectedFinal).at(-1);
                const analytics = current.requests.filter(request => /(^|\.)(googletagmanager\.com|google-analytics\.com|doubleclick\.net)$/i.test(new URL(request.url).hostname));
                const assertions = { requestedURL: expected, finalURL: lhr?.finalDisplayedUrl || lhr?.finalUrl || observation?.url || null, readiness: observation?.readyState || null, hasMain: observation?.hasMain ?? null, viewport: observation?.viewport || null, theme: observation?.theme || null, consent: observation?.consent || null, serviceWorker: observation?.serviceWorker || null, routeState: observation?.routeState || null, analyticsRequests: analytics };
                if (!options.discovery) {
                    if (assertions.finalURL !== expected && assertions.finalURL !== expectedFinal) current.causes.push('Final URL mismatch');
                    if (!observation || observation.readyState !== 'complete' || !observation.hasMain) current.causes.push('Audited page readiness not observed');
                    if (observation?.consent?.essential !== true || observation?.consent?.analytics !== false) current.causes.push('Analytics consent not denied');
                    if (analytics.length) current.causes.push('Analytics request without consent');
                    if (observation?.viewport?.width !== 412 || observation?.viewport?.height !== 823 || observation?.viewport?.dpr !== 1.75 || !['light', 'dark'].includes(observation?.theme)) current.causes.push('Viewport or theme mismatch');
                    const state = observation?.routeState;
                    if ((route.name === 'Home' && !state?.hero) || (route.name === 'Blog' && !state?.calendar) || (route.name === 'Standings' && (state?.round !== '20' || !state?.standingsRows)) || (route.name === 'Article' && (!state?.articleHero || !state?.title))) current.causes.push('Route readiness mismatch');
                    const hits = current.requests.filter(request => request.action === 'fulfill' && request.targetId === observation?.targetId && request.frameId === observation?.targetId);
                    assertions.auditedTargetId = observation?.targetId || null;
                    assertions.auditedFixtureHits = hits;
                    if (!hits.length) current.causes.push('No fixture hit on audited target');
                    if (observation?.serviceWorker?.controlled !== false) current.causes.push('Service worker controls audited page');
                }
                const metrics = lhr ? routeMetrics(lhr) : null;
                if (metrics) metrics['inline-css-bytes'] = inlineCssBytes(fs.readFileSync(resolveRequest(site, route.path), 'utf8'));
                attempts.push({ valid: !current.causes.length, causes: [...current.causes], requests: [...current.requests], assertions, metrics });
            }
            const summary = options.discovery ? null : summarizeAttempts(route, attempts, count);
            report.routes.push({ route: route.name, path: route.path, attempts, summary, thirdPartyAttribution: route.name === 'Article' ? 'BLOCKED-ORIGIN: loopback origin differs from production HTTPS' : undefined });
            console.log(`${route.name}: ${options.discovery ? `${attempts[0].requests.length} external requests observed` : `${summary.valid}/${count} valid; ${summary.failures.length ? summary.failures.join('; ') : 'budgets passed'}`}`);
        }
    } catch (error) {
        report.error = error.message;
        throw error;
    } finally {
        if (stop) await stop().catch(error => console.error(`Observer cleanup: ${error.message}`));
        if (browser) await browser.disconnect();
        await closeChrome(chrome);
        if (server) await new Promise(resolve => server.close(resolve));
        fs.rmSync(profile, { recursive: true, force: true });
        fs.writeFileSync(path.join(out, options.discovery ? 'discovery.json' : 'results.json'), JSON.stringify(report, null, 2) + '\n');
    }
    if (report.routes.some(route => options.discovery ? route.attempts.some(attempt => attempt.causes.some(cause => cause.startsWith('Observer:') || cause.startsWith('Run:'))) : route.summary.failures.length)) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => { console.error(error.stack || error); process.exitCode = 1; });
