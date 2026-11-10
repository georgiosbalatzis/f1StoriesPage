#!/usr/bin/env node
// Local replay and discovery; acceptance still requires independently enforced egress isolation.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import puppeteer, { CDPSessionEvent } from 'puppeteer-core';
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

export const expectedTheme = theme => theme === 'light';

// Browser-level auto-attach pauses new targets before their first request. Each child
// installs the same interception before it is resumed, including nested targets.
export const CLOSED_PROXY_FLAGS = ['--disable-quic', '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=<-loopback>;127.0.0.1;localhost;[::1]'];

export function reconcileNetwork(network, paused, causes) {
    const remaining = [...paused];
    for (const request of network) {
        const index = remaining.findIndex(item =>
            item.id === request.id && item.url === request.url && item.method === request.method
        );
        if (index < 0) causes.push(`Network request without Fetch pause: ${request.url}`);
        else remaining.splice(index, 1);
    }
}

export async function intercept(browser, origin, fixtures, attempt) {
    const root = await browser.target().createCDPSession();
    const pending = new Set();
    const sessions = new Map();
    const targetTypes = new Map();
    const destroyed = new Set();
    const detached = new Set();
    const preExistingReported = new Set();
    let closing = false;
    const track = promise => {
        pending.add(promise);
        promise.catch(error => attempt.causes.push(`Observer: ${error.message}`))
            .finally(() => pending.delete(promise));
    };
    const lost = message => { if (!closing) attempt.causes.push(`Observer: ${message}`); };
    const disconnected = () => lost('browser disconnected');
    browser.on('disconnected', disconnected);
    root.on(CDPSessionEvent.Disconnected, () => lost('root session disconnected'));
    const attach = async (parent, event) => {
        const session = parent.connection().session(event.sessionId);
        if (!session) throw new Error(`Missing session for ${event.targetInfo.type}`);
        const info = event.targetInfo;
        if (event.waitingForDebugger === false && ['page', 'iframe', 'worker', 'shared_worker', 'service_worker'].includes(info.type) &&
            info.url && info.url !== 'about:blank' && !preExistingReported.has(info.targetId)) {
            attempt.causes.push(`Observer: target attached without pause could have issued requests: ${info.type} ${info.url}`);
        }
        sessions.set(event.sessionId, info.targetId);
        targetTypes.set(info.targetId, info.type);
        const network = [];
        const paused = [];
        const initiators = new Map();
        attempt.reconcile.push(() => reconcileNetwork(network, paused, attempt.causes));
        session.on(CDPSessionEvent.Disconnected, () => { if (!closing) detached.add(info.targetId); });
        session.on('Target.attachedToTarget', child => track(attach(session, child)));
        session.on('Target.detachedFromTarget', child => {
            if (!closing) detached.add(sessions.get(child.sessionId) || child.sessionId);
            sessions.delete(child.sessionId);
        });
        session.on('Inspector.targetCrashed', () => lost(`target crashed: ${info.targetId}`));
        session.on('Network.requestWillBeSent', event => {
            initiators.set(event.requestId, event.initiator);
            if (event.type === 'Document' && event.frameId === info.targetId) {
                attempt.navigations.push({ targetId: info.targetId, loaderId: event.loaderId, url: event.request.url });
            }
            if (/^https?:/i.test(event.request.url) && new URL(event.request.url).origin !== origin) {
                network.push({ id: event.requestId, url: event.request.url, method: event.request.method });
            }
        });
        session.on('Network.webSocketCreated', event => {
            const socket = new URL(event.url);
            const socketOrigin = `${socket.protocol === 'wss:' ? 'https:' : 'http:'}//${socket.host}`;
            if (socketOrigin !== origin || socket.username || socket.password) {
                attempt.causes.push(`External WebSocket: ${event.url}`);
            }
        });
        session.on('Fetch.requestPaused', event => track((async () => {
            const { request, requestId, networkId } = event;
            let decision;
            try { decision = classifyRequest(request, origin, fixtures); }
            catch (error) { decision = { action: 'abort', cause: `Invalid request ${request.url}: ${error.message}` }; }
            if (decision.action === 'continue') return session.send('Fetch.continueRequest', { requestId });
            paused.push({ id: networkId, url: request.url, method: request.method });
            const record = {
                method: request.method, url: request.url, resourceType: event.resourceType,
                frameId: event.frameId || null, targetType: info.type, targetId: info.targetId,
                initiator: initiators.get(networkId) || null, action: decision.action
            };
            if (decision.action === 'fulfill') {
                await session.send('Fetch.fulfillRequest', { requestId, ...decision.fixture });
                attempt.requests.push(record);
            } else {
                attempt.requests.push(record);
                attempt.causes.push(decision.cause);
                await session.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
            }
        })()));
        if (info.type === 'page') {
            session.on('Page.lifecycleEvent', event => {
                if (event.name !== 'load' || event.frameId !== info.targetId) return;
                track((async () => {
                const { frameTree } = await session.send('Page.getFrameTree');
                if (frameTree.frame.loaderId !== event.loaderId || !frameTree.frame.url.startsWith(origin)) return;
                const { result } = await session.send('Runtime.evaluate', {
                    expression: `new Promise(resolve => setTimeout(() => {
                        const image = selector => { const img = document.querySelector(selector); return !!img && img.complete && img.naturalWidth > 0; };
                        resolve(JSON.stringify({
                            url: location.href, readyState: document.readyState, hasMain: !!document.querySelector('main'),
                            viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
                            theme: document.documentElement.getAttribute('data-theme'),
                            routeState: {
                                hero: image('#hero-image'), schedule: !!document.querySelector('#next-race-name')?.textContent.trim() &&
                                    document.querySelector('#next-race-name').textContent.trim() !== 'Επόμενο GP',
                                homeStandings: [...document.querySelectorAll('#numbers .tower-row')].some(row =>
                                    row.querySelector('.tower-row__name')?.textContent.trim() && row.querySelector('.tower-row__pts')?.textContent.trim()),
                                calendar: document.querySelectorAll('.ed-cal__months > li').length,
                                articleLinks: document.querySelectorAll('a[href*="/blog-entries/"]').length,
                                round: document.querySelector('#round-num')?.textContent.trim() || null,
                                standingsRows: document.querySelectorAll('#drivers-table .st-row[data-detail-target]').length,
                                articleHero: image('img.article-header-img'), title: !!document.querySelector('h1')?.textContent.trim(),
                                articleBody: !!document.querySelector('.article-content')?.textContent.trim(),
                                betcast: !!document.querySelector('iframe[data-f1s-betcast-managed]')
                            },
                            consent: JSON.parse(localStorage.getItem('f1stories-cookie-consent-v1') || 'null'),
                            serviceWorker: { controlled: !!navigator.serviceWorker?.controller }
                        }));
                    }, 100))`, returnByValue: true, awaitPromise: true
                });
                const after = await session.send('Page.getFrameTree');
                if (result.value && frameTree.frame.loaderId === after.frameTree.frame.loaderId) {
                    const observation = JSON.parse(result.value);
                    if (observation.routeState.betcast) {
                        const frame = after.frameTree.childFrames?.find(child => /\/betcast\//i.test(child.frame.url));
                        if (frame) {
                            observation.routeState.betcastFrameId = frame.frame.id;
                            try {
                                const { executionContextId } = await session.send('Page.createIsolatedWorld', { frameId: frame.frame.id });
                                const rows = await session.send('Runtime.evaluate', {
                                    contextId: executionContextId,
                                    expression: "document.querySelectorAll('tbody tr').length",
                                    returnByValue: true
                                });
                                observation.routeState.betcastRows = rows.result.value || 0;
                            } catch (_) { observation.routeState.betcastRows = 0; }
                        }
                    }
                    attempt.observations.push({ ...observation, targetId: info.targetId, loaderId: frameTree.frame.loaderId });
                }
            })().catch(error => { if (!/Inspected target navigated or closed|Target closed|Session closed/.test(error.message)) throw error; }));
            });
            await session.send('Page.enable');
            await session.send('Page.setLifecycleEventsEnabled', { enabled: true });
        }
        await session.send('Network.enable');
        try { await session.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] }); }
        catch (error) {
            if (info.type !== 'worker' || !error.message.includes("wasn't found")) throw error;
        }
        if (['page', 'iframe', 'worker', 'shared_worker', 'service_worker'].includes(info.type)) {
            try { await session.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }); }
            catch (error) { if (['page', 'iframe'].includes(info.type)) throw error; }
        }
        await session.send('Runtime.runIfWaitingForDebugger');

    };
    attempt.reconcile = [];
    attempt.navigations = [];
    root.on('Target.attachedToTarget', event => track(attach(root, event)));
    root.on('Target.detachedFromTarget', event => {
        if (!closing) detached.add(sessions.get(event.sessionId) || event.sessionId);
        sessions.delete(event.sessionId);
    });
    root.on('Target.targetDestroyed', event => destroyed.add(event.targetId));
    await root.send('Target.setDiscoverTargets', { discover: true });
    const { targetInfos: preExisting } = await root.send('Target.getTargets');
    for (const info of preExisting) {
        if (['page', 'iframe', 'worker', 'shared_worker', 'service_worker'].includes(info.type) && info.url && info.url !== 'about:blank') {
            attempt.causes.push(`Observer: pre-existing target could have issued requests: ${info.type} ${info.url}`);
            preExistingReported.add(info.targetId);
        }
    }
    await root.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
    const drain = async () => { while (pending.size) await Promise.allSettled([...pending]); };
    await drain();
    const { targetInfos } = await root.send('Target.getTargets');
    for (const info of targetInfos) {
        if (!['page', 'iframe', 'worker', 'shared_worker', 'service_worker'].includes(info.type)) continue;
        if (![...sessions.values()].includes(info.targetId)) {
            attempt.causes.push(`Observer: existing target not attached: ${info.targetId} ${info.url}`);
        }
    }
    const stop = async (close, expectedClosedTarget) => {
        await drain();
        closing = true;
        await close();
        if (browser.connected) await new Promise(resolve => {
            const timer = setTimeout(() => {
                browser.off('disconnected', onDisconnect);
                attempt.causes.push('Observer: browser did not disconnect before reconciliation');
                resolve();
            }, 5000);
            const onDisconnect = () => { clearTimeout(timer); resolve(); };
            browser.once('disconnected', onDisconnect);
        });
        await drain();
        for (const id of detached) {
            if (id !== expectedClosedTarget || !destroyed.has(id)) {
                attempt.causes.push(`Observer: unexpected session loss: ${targetTypes.get(id) || 'unknown'} ${id}`);
            }
        }
        attempt.reconcile.forEach(reconcile => reconcile());
        delete attempt.reconcile;
        browser.off('disconnected', disconnected);
    };
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
    const report = { label: options.label, discovery: !!options.discovery, routes: [] };
    let server;
    try {
        const started = await startServer(site); server = started.server;
        for (const configured of routes) {
            const route = configured.path === 'latest-article' ? { ...configured, path: latestArticlePath(site) } : configured;
            const attempts = [];
            for (let i = 1; i <= (options.discovery ? 1 : count); i++) {
                const current = { causes: [], requests: [], observations: [], navigations: [] };
                const profile = fs.mkdtempSync(path.join(out, '.profile-'));
                let chrome, browser, stop, lhr;
                const expected = new URL(route.path, started.origin).href;
                try {
                    chrome = await launchAuditChrome(profile, CLOSED_PROXY_FLAGS);
                    await seedAuditConsent(chrome, started.origin);
                    await clearServiceWorkers(chrome, started.origin);
                    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
                    const blank = await browser.newPage();
                    await blank.goto(new URL('/__f1stories-lighthouse-storage.html', started.origin).toString());
                    await blank.evaluate(() => localStorage.setItem('f1stories-theme', 'light'));
                    await blank.goto('about:blank');
                    for (const page of await browser.pages()) if (page !== blank) await page.close();
                    stop = await intercept(browser, started.origin, fixtures, current);
                    if (options.discovery) {
                        const page = await browser.newPage();
                        await page.goto(expected, { waitUntil: 'networkidle2', timeout: 30000 });
                    } else lhr = await runLighthouse(route, started.origin, budget, out, chrome.port, i);
                } catch (error) { current.causes.push(`Run: ${error.message}`); }
                finally {
                    if (stop) {
                        const targetId = lhr && current.navigations.filter(nav => nav.url === expected).at(-1)?.targetId;
                        await stop(() => closeChrome(chrome), targetId)
                            .catch(error => current.causes.push(`Observer: ${error.message}`));
                    }
                    await closeChrome(chrome);
                    if (browser) await browser.disconnect();
                    fs.rmSync(profile, { recursive: true, force: true });
                }
                const expectedFinal = route.name === 'Standings' ? `${expected}?tab=drivers` : expected;
                const navigations = current.navigations.filter(value => value.url === expected);
                // Lighthouse's back-forward cache audit navigates away and back after the measured load.
                const auditedNavigation = navigations[0];
                const observation = current.observations.find(value =>
                    (value.url === expected || value.url === expectedFinal) &&
                    auditedNavigation?.targetId === value.targetId && auditedNavigation?.loaderId === value.loaderId
                );
                const analytics = current.requests.filter(request => /(^|\.)(googletagmanager\.com|google-analytics\.com|doubleclick\.net)$/i.test(new URL(request.url).hostname));
                const assertions = { navigations: current.navigations, observations: current.observations, requestedURL: expected, finalURL: lhr?.finalDisplayedUrl || lhr?.finalUrl || observation?.url || null, readiness: observation?.readyState || null, hasMain: observation?.hasMain ?? null, viewport: observation?.viewport || null, theme: observation?.theme || null, consent: observation?.consent || null, serviceWorker: observation?.serviceWorker || null, routeState: observation?.routeState || null, analyticsRequests: analytics };
                if (!options.discovery) {
                    if (!auditedNavigation || navigations.some(nav => nav.targetId !== auditedNavigation.targetId)) {
                        current.causes.push('Audited navigation target is ambiguous');
                    }
                    if (assertions.finalURL !== expected && assertions.finalURL !== expectedFinal) current.causes.push('Final URL mismatch');
                    if (!observation || observation.readyState !== 'complete' || !observation.hasMain) current.causes.push('Audited page readiness not observed');
                    if (observation?.consent?.essential !== true || observation?.consent?.analytics !== false) current.causes.push('Analytics consent not denied');
                    if (analytics.length) current.causes.push('Analytics request without consent');
                    if (observation?.viewport?.width !== 412 || observation?.viewport?.height !== 823 || observation?.viewport?.dpr !== 1.75 || !expectedTheme(observation?.theme)) current.causes.push('Viewport or theme mismatch');
                    const state = observation?.routeState;
                    const routeReady = {
                        Home: state?.hero && state?.schedule && state?.homeStandings,
                        Blog: state?.calendar && state?.articleLinks,
                        Standings: state?.round === '20' && state?.standingsRows,
                        Article: state?.articleHero && state?.title && state?.articleBody
                    };
                    if (!routeReady[route.name]) current.causes.push('Route readiness mismatch');
                    if (state?.betcast && (!state.betcastRows || !current.requests.some(request =>
                        request.action === 'fulfill' && request.resourceType === 'Document' &&
                        request.frameId === state.betcastFrameId
                    ))) current.causes.push('BetCast embed document not fulfilled or data rows not populated');
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
        if (server) await new Promise(resolve => server.close(resolve));
        fs.writeFileSync(path.join(out, options.discovery ? 'discovery.json' : 'results.json'), JSON.stringify(report, null, 2) + '\n');
    }
    if (report.routes.some(route => options.discovery ? route.attempts.some(attempt => attempt.causes.some(cause => cause.startsWith('Observer:') || cause.startsWith('Run:'))) : route.summary.failures.length)) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => { console.error(error.stack || error); process.exitCode = 1; });
