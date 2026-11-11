#!/usr/bin/env node
// Local replay and discovery; acceptance still requires independently enforced egress isolation.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DOMParser } from '@xmldom/xmldom';
import { validateOrigin, httpsChromeFlags, articlePath, startHttpsOrigin, loadFixtures, spkiHash, cleanupSync, validateHttpsFlags } from './https-origin.mjs';
const selfTestOnly = process.argv.includes('--self-test');
const { default: puppeteer, CDPSessionEvent } = selfTestOnly ? {} : await import('puppeteer-core');
const {  loadBudget, resolveRequest, startServer, createStaticHandler, closeChrome, launchAuditChrome, seedAuditConsent, clearServiceWorkers, latestArticlePath, runLighthouse, medianMetrics, evaluateRoute, routeMetrics, inlineCssBytes  } = selfTestOnly ? {} : await import('./lighthouse-guard.mjs');

export { requestKey, loadFixtures } from './https-origin.mjs';
import { requestKey } from './https-origin.mjs';

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

export const auditedNavigations = (navigations, expected, count = navigations.length) => navigations.slice(0, count).filter(value => value.url === expected);
export const attemptOutput = (current, assertions, metrics) => ({ valid: !current.causes.length, causes: [...current.causes], requests: [...current.requests], assertions, metrics });
export const reportExitCode = report => report.routes.some(route => report.discovery ? route.attempts.some(attempt => attempt.causes.some(cause => cause.startsWith('Observer:') || cause.startsWith('Run:'))) : route.summary.failures.length) ? 1 : 0;

export const expectedTheme = theme => theme === 'light';

export function createLossState(events) {
    let phase = 'lighthouse';
    return {
        setPhase(next) { phase = next; },
        get phase() { return phase; },
        record(event, targetId) {
            events.push({ event, targetId, phase });
            return phase !== 'teardown';
        }
    };
}

// Supplying the page keeps Lighthouse from closing it during its own cleanup.
async function runHttpsLighthouse(route, origin, budget, out, run, browser) {
    const { default: lighthouse } = await import('lighthouse');
    const page = await browser.newPage();
    const flags = {
        onlyCategories: budget.onlyCategories || ['performance', 'accessibility', 'best-practices', 'seo'],
        throttlingMethod: process.env.LIGHTHOUSE_THROTTLING_METHOD || budget.throttlingMethod || 'provided',
        disableStorageReset: true, output: 'json', logLevel: 'error'
    };
    if (budget.preset && budget.preset !== 'mobile') flags.preset = budget.preset;
    const result = await lighthouse(new URL(route.path, origin).href, flags, undefined, page);
    if (!result) throw new Error('Lighthouse returned no result');
    fs.writeFileSync(path.join(out, `${String(route.name || 'route').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'route'}-${run}.json`), result.report);
    return result.lhr;
}

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
    attempt.sessionEvents = [];
    const lossState = createLossState(attempt.sessionEvents);
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
        session.on(CDPSessionEvent.Disconnected, () => { if (lossState.record('CDPSession.Disconnected', info.targetId)) detached.add(info.targetId); });
        session.on('Target.attachedToTarget', child => track(attach(session, child)));
        session.on('Target.detachedFromTarget', child => {
            const id = sessions.get(child.sessionId) || child.sessionId;
            if (lossState.record('Target.detachedFromTarget', id)) detached.add(id);
            sessions.delete(child.sessionId);
        });
        session.on('Inspector.targetCrashed', () => lost(`target crashed: ${info.targetId}`));
        session.on('Network.requestWillBeSent', event => {
            initiators.set(event.requestId, event.initiator);
            if (attempt.httpsPort && event.redirectResponse) {
                try {
                    const source = event.redirectResponse;
                    const from = classifyRequest({ url: source.url, method: event.request.method }, origin, fixtures);
                    const to = classifyRequest(event.request, origin, fixtures);
                    const loopback = ['127.0.0.1', '::1', '[::1]'].includes(source.remoteIPAddress) && source.remotePort === attempt.httpsPort;
                    if (from.action === 'abort' || to.action === 'abort' || (from.action === 'continue' && (!loopback || to.action === 'continue'))) attempt.causes.push(`Unexpected redirect hop: ${source.url}`);
                } catch (_) { attempt.causes.push(`Invalid redirect hop: ${event.redirectResponse.url}`); }
            }
            if (event.type === 'Document' && (attempt.httpsPort || event.frameId === info.targetId)) {
                attempt.navigations.push({ targetId: info.targetId, ...(attempt.httpsPort ? { frameId: event.frameId } : {}), loaderId: event.loaderId, url: event.request.url });
            }
            if (/^https?:/i.test(event.request.url) && new URL(event.request.url).origin !== origin) {
                network.push({ id: event.requestId, url: event.request.url, method: event.request.method });
            }
        });
        session.on('Network.responseReceived', event => {
            if (!attempt.httpsPort || !event.response.url.startsWith(origin + '/')) return;
            const response = event.response;
            attempt.localResponses ||= [];
            attempt.localResponses.push({ url: response.url, status: response.status, remoteIPAddress: response.remoteIPAddress, remotePort: response.remotePort, frameId: event.frameId, targetId: info.targetId, loaderId: event.loaderId, type: event.type, phase: lossState.phase });
            if (response.status >= 300 && response.status < 400) attempt.causes.push(`Unexpected first-party redirect: ${response.url}`);
            if (!['127.0.0.1', '::1', '[::1]'].includes(response.remoteIPAddress) || response.remotePort !== attempt.httpsPort) attempt.causes.push(`Non-loopback first-party response: ${response.url}`);
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
            let requestOrigin;
            try { requestOrigin = new URL(request.url).origin; } catch (_) { requestOrigin = 'invalid'; }
            const classification = decision.action === 'continue' ? 'exact-origin' : decision.action === 'fulfill' ? 'fixture' : 'aborted';
            const countKey = JSON.stringify([requestOrigin, classification, lossState.phase]);
            attempt.originCounts ||= {};
            attempt.originCounts[countKey] = (attempt.originCounts[countKey] || 0) + 1;
            if (decision.action === 'continue') return session.send('Fetch.continueRequest', { requestId });
            paused.push({ id: networkId, url: request.url, method: request.method });
            const record = {
                method: request.method, url: request.url, resourceType: event.resourceType,
                frameId: event.frameId || null, targetType: info.type, targetId: info.targetId,
                initiator: initiators.get(networkId) || null, action: decision.action, ...(attempt.httpsPort ? { phase: lossState.phase } : {})
            };
            if (decision.action === 'fulfill') {
                if (attempt.httpsPort && decision.fixture.responseCode >= 300 && decision.fixture.responseCode < 400) attempt.causes.push(`Unexpected fixture redirect: ${request.url}`);
                const { redirectNote, ...response } = decision.fixture;
                if (attempt.httpsPort) record.status = response.responseCode;
                if (attempt.httpsPort && redirectNote) record.redirectNote = redirectNote;
                await session.send('Fetch.fulfillRequest', { requestId, ...response });
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
                    if (attempt.httpsPort && observation.routeState.betcast) {
                        const src = await session.send('Runtime.evaluate', { expression: "document.querySelector('iframe[data-f1s-betcast-managed]')?.src", returnByValue: true });
                        observation.routeState.betcastSrc = src.result.value;
                    }
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
        const id = sessions.get(event.sessionId) || event.sessionId;
        if (lossState.record('Target.detachedFromTarget', id)) detached.add(id);
        sessions.delete(event.sessionId);
    });
    root.on('Target.targetDestroyed', event => { lossState.record('Target.targetDestroyed', event.targetId); destroyed.add(event.targetId); });
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
        lossState.setPhase('teardown');
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
    stop.setPhase = phase => lossState.setPhase(phase);
    return stop;
}

export function expectedEmbedFromHtml(html, articleUrl) {
    const doc = new DOMParser({ errorHandler: { warning() {}, error() {}, fatalError(message) { throw new Error(message); } } }).parseFromString(html, 'text/html');
    const frames = Array.from(doc.getElementsByTagName('iframe')).filter(frame => frame.hasAttribute('data-f1s-betcast-managed'));
    if (frames.length > 1) throw new Error('Multiple managed BetCast iframes');
    if (!frames.length) return null;
    const src = frames[0].getAttribute('src');
    if (!src) throw new Error('Managed BetCast iframe has no src');
    return new URL(src, articleUrl).href;
}

export function verifyEmbed({ present, required, expectedUrl, measuredUrl, probe, response, navigation, provider }) {
    if (!present) return !required && !expectedUrl;
    return !!(expectedUrl && measuredUrl === expectedUrl && probe?.src === expectedUrl && probe?.url === expectedUrl && probe.frameId && probe.rows > 0 &&
        response?.phase === 'probe' && response.url === expectedUrl && response.frameId === probe.frameId && response.type === 'Document' && response.status === 200 &&
        navigation?.url === expectedUrl && navigation.frameId === probe.frameId && navigation.targetId === response.targetId && navigation.loaderId === response.loaderId &&
        provider?.phase === 'probe' && provider.frameId === probe.frameId && provider.action === 'fulfill' && provider.status === 200 && new URL(provider.url).hostname === 'docs.google.com');
}

function installHttpsCleanup(paths) {
    const cleanup = () => cleanupSync(paths);
    const interrupt = signal => { cleanup(); if (process.listenerCount(signal) === 1) process.exit(signal === 'SIGINT' ? 130 : 143); };
    const sigint = () => interrupt('SIGINT'), sigterm = () => interrupt('SIGTERM');
    process.prependListener('exit', cleanup);
    process.prependListener('SIGINT', sigint);
    process.prependListener('SIGTERM', sigterm);
    return () => { process.off('exit', cleanup); process.off('SIGINT', sigint); process.off('SIGTERM', sigterm); };
}

async function httpsSelftest() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1s-selftest-'));
    const site = path.join(dir, 'site'); fs.mkdirSync(site);
    fs.writeFileSync(path.join(site, 'index.html'), '<!doctype html><title>selftest</title>');
    const profile = path.join(dir, 'profile'); fs.mkdirSync(profile);
    let started, chrome, browser, stop;
    let failed = false;
    const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed = true; };
    try {
        started = await startHttpsOrigin(site, 'https://f1-stories.gr', createStaticHandler);
        const host = 'f1-stories.gr';
        const flags = httpsChromeFlags(host, started.port, started.hash, CLOSED_PROXY_FLAGS.filter(f => !f.startsWith('--proxy-bypass-list=')));
        // Chromium's SPKI exception ignores certificate errors, including hostname mismatch:
        // https://chromium.googlesource.com/chromium/src/+/main/services/network/ignore_errors_cert_verifier.cc
        // Resolver containment is configured but not independently demonstrated by this self-test.
        console.log('INFO SPKI-scoped trust does not validate hostnames; Resolver containment is configured but not independently demonstrated by this self-test.');
        chrome = await launchAuditChrome(profile, flags);
        browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
        let page = await browser.newPage();
        let accepted = false;
        try { accepted = (await page.goto(`https://${host}/`, { timeout: 10000 })).status() === 200; } catch (_) {}
        check('trusted right-host certificate accepted', accepted);
        await browser.disconnect(); browser = null; await closeChrome(chrome); chrome = null;
        fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile);
        const unrelatedHash = spkiHash(generateKeyPairSync('ed25519').privateKey);
        const untrustedFlags = httpsChromeFlags(host, started.port, unrelatedHash, CLOSED_PROXY_FLAGS.filter(f => !f.startsWith('--proxy-bypass-list=')));
        chrome = await launchAuditChrome(profile, untrustedFlags);
        browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
        page = await browser.newPage();
        let rejected = false;
        try { await page.goto(`https://${host}/`, { timeout: 10000 }); } catch (error) { rejected = /net::ERR_CERT_/.test(error.message); }
        check('right-host certificate with untrusted key rejected', rejected);
        await browser.disconnect(); browser = null; await closeChrome(chrome); chrome = null;
        fs.rmSync(profile, { recursive: true, force: true }); fs.mkdirSync(profile);
        chrome = await launchAuditChrome(profile, flags);
        browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
        page = await browser.newPage();
        for (const [name, url, pattern] of // Measured: the closed proxy refuses these first (ERR_PROXY_CONNECTION_FAILED); the resolver rule is configured but not independently exercised here.
        [['unmapped host blocked', 'https://unmapped.invalid/', /ERR_PROXY_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED/], ['mapped host on another port blocked', `https://${host}:444/`, /ERR_PROXY_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED/]]) {
            let rejected = false, seen = 'navigation succeeded'; try { await page.goto(url, { timeout: 10000 }); } catch (error) { seen = error.message.split('\n')[0]; rejected = pattern.test(seen); } check(rejected ? name : `${name} (saw: ${seen})`, rejected);
        }
        const current ={ causes: [], requests: [], observations: [], navigations: [] };
        stop = await intercept(browser, `https://${host}`, new Map(), current);
        page = await browser.newPage();
        try { await page.goto('https://unmatched.invalid/data', { timeout: 10000 }); } catch (_) {}
        await stop.drain();
        check('unmatched third-party aborted and recorded', current.requests.some(r => r.action === 'abort' && r.url === 'https://unmatched.invalid/data'));
        await stop(() => closeChrome(chrome)); stop = null; chrome = null;
    } catch (error) { console.log(`FAIL selftest setup: ${error.message}`); failed = true; }
    finally {
        if (stop) await stop(() => closeChrome(chrome)).catch(() => {});
        await closeChrome(chrome); if (browser) await browser.disconnect().catch(() => {});
        const certDir = started?.dir;
        if (started) await started.close();
        fs.rmSync(dir, { recursive: true, force: true });
        check('key cert and profile deleted', !!certDir && !fs.existsSync(dir) && !fs.existsSync(certDir));
    }
    const childResult = await new Promise(resolve => {
        const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--https-signal-child'], { stdio: ['ignore', 'pipe', 'ignore'] });
        let output = ''; let certDir;
        const timer = setTimeout(() => { child.kill('SIGKILL'); }, 30000);
        child.stdout.on('data', chunk => { output += chunk; const line = output.split('\n')[0]; if (!certDir && line.startsWith('READY ')) { certDir = line.slice(6); child.kill('SIGINT'); } });
        child.on('error', () => { clearTimeout(timer); resolve(false); });
        child.on('exit', () => { clearTimeout(timer); resolve(!!certDir && !fs.existsSync(certDir)); });
    });
    check('SIGINT removes HTTPS key directory', childResult);
    if (failed) process.exitCode = 1;
}

async function main(argv) {
    if (argv.includes('--https-signal-child')) {
        const paths = new Set();
        installHttpsCleanup(paths);
        const started = await startHttpsOrigin(process.cwd(), 'https://f1-stories.gr', () => (_req, res) => res.end(), paths);
        paths.add(started.dir);
        console.log(`READY ${started.dir}`);
        return;
    }
    const options = {};
    for (let i = 0; i < argv.length; i++) {
        if (['--discovery', '--expect-betcast', '--https-selftest', '--self-test'].includes(argv[i])) options[argv[i].slice(2)] = true;
        else if (['--target-dir', '--label', '--routes', '--attempts', '--out', '--manifest', '--origin', '--article'].includes(argv[i]) && argv[i + 1]) { const key = argv[i].slice(2); const value = argv[++i]; if (key === 'manifest') (options.manifests ||= []).push(value); else options[key] = value; }
        else throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
    }
    if (options['self-test']) { const result = spawnSync(process.execPath, ['--test', fileURLToPath(new URL('./__tests__/https-origin.test.mjs', import.meta.url))], { stdio: 'inherit' }); process.exitCode = result.status ?? 1; return; }
    if (options['https-selftest']) { validateHttpsFlags((process.env.LIGHTHOUSE_CHROME_FLAGS || '').split(/\s+/)); return httpsSelftest(); }
    if (options.origin) { validateOrigin(options.origin); validateHttpsFlags((process.env.LIGHTHOUSE_CHROME_FLAGS || '').split(/\s+/)); }
    if (!options['target-dir'] || (!options.origin && !['main', 'aggregate'].includes(options.label)) || (options.origin && !/^[A-Za-z0-9_-]+$/.test(options.label || '')) || !options.out) throw new Error('Usage: --target-dir DIR --label main|aggregate [--routes Home,Blog,Standings,Article] [--attempts N] --out DIR [--discovery]');
    const count = Number(options.attempts || 3);
    if (!Number.isInteger(count) || count < 1) throw new Error('attempts must be a positive integer');
    const budget = loadBudget(path.resolve('perf/lighthouse-budget.json'));
    const names = options.routes?.split(',').map(name => name.trim().toLowerCase());
    const routes = budget.routes.filter(route => !names || names.includes(route.name.toLowerCase()) || names.includes(route.path.toLowerCase()) || (route.name === 'Home' && names.includes('homepage')));
    if (!routes.length || (names && names.length !== routes.length)) throw new Error('Unknown or duplicate route');
    const site = path.resolve(options['target-dir']);
    const out = path.resolve(options.out, options.label);
    fs.mkdirSync(out, { recursive: true });
    const fixtures = loadFixtures((options.manifests ? (options.origin ? options.manifests : [options.manifests.at(-1)]) : [new URL('./fixtures/p02/manifest.json', import.meta.url).pathname]).map(value => path.resolve(value)));
    if (options.article) articlePath(site, options.article);
    const report = { label: options.label, discovery: !!options.discovery, routes: [] };
    let server, startedClose;
    const cleanupPaths = new Set();
    const removeCleanup = options.origin ? installHttpsCleanup(cleanupPaths) : () => {};
    try {
        const started = options.origin ? await startHttpsOrigin(site, options.origin, createStaticHandler, cleanupPaths) : await startServer(site); server = started.server; startedClose = started.close; if (options.origin) cleanupPaths.add(started.dir);
        const chromeExtraFlags = options.origin ? httpsChromeFlags(new URL(options.origin).hostname, started.port, started.hash, CLOSED_PROXY_FLAGS.filter(flag => !flag.startsWith('--proxy-bypass-list='))) : CLOSED_PROXY_FLAGS;
        if (options.origin) validateHttpsFlags(chromeExtraFlags.filter(flag => !flag.startsWith('--host-resolver-rules=')));
        for (const configured of routes) {
            const route = configured.path === 'latest-article' ? { ...configured, path: options.article ? articlePath(site, options.article) : latestArticlePath(site) } : configured;
            const expectedEmbed = options.origin && route.name === 'Article' ? expectedEmbedFromHtml(fs.readFileSync(resolveRequest(site, route.path), 'utf8'), new URL(route.path, started.origin).href) : null;
            const attempts = [];
            for (let i = 1; i <= (options.discovery ? 1 : count); i++) {
                const current = { causes: [], requests: [], observations: [], navigations: [], ...(options.origin ? { httpsPort: started.port } : {}) };
                const profile = fs.mkdtempSync(path.join(out, '.profile-'));
                if (options.origin) cleanupPaths.add(profile);
                let chrome, browser, stop, lhr;
                const expected = new URL(route.path, started.origin).href;
                try {
                    chrome = await launchAuditChrome(profile, chromeExtraFlags);
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
                    } else lhr = options.origin ? await runHttpsLighthouse(route, started.origin, budget, out, i, browser) : await runLighthouse(route, started.origin, budget, out, chrome.port, i);
                    if (options.origin) { current.auditNavigationCount = current.navigations.length; await stop.drain(); stop.setPhase('probe'); }
                    if (options.origin && route.name === 'Article' && (expectedEmbed || current.observations.some(o => o.routeState?.betcast))) {
                        const page = await browser.newPage();
                        await page.goto(expected, { waitUntil: 'load', timeout: 30000 });
                        const frameElement = await page.$('iframe[data-f1s-betcast-managed]');
                        if (!frameElement) throw new Error('Expected BetCast iframe absent');
                        const src = await frameElement.evaluate(el => { el.scrollIntoView({ block: 'center' }); return el.src; });
                        await page.waitForFunction(element => element.contentWindow && element.contentWindow.location.href === element.src, { timeout: 30000 }, frameElement);
                        const frame = await frameElement.contentFrame();
                        await frame.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, { timeout: 30000 });
                        current.betcastProbe = { src, url: frame.url(), frameId: frame._id, rows: await frame.$$eval('tbody tr', rows => rows.length) };
                        await stop.drain();
                        const response = (current.localResponses || []).find(r => r.phase === 'probe' && r.url === src && r.frameId === frame._id && r.type === 'Document' && r.status === 200);
                        const navigation = current.navigations.find(n => n.url === src && n.frameId === frame._id && n.targetId === response?.targetId && n.loaderId === response?.loaderId);
                        const provider = current.requests.find(r => r.phase === 'probe' && r.frameId === frame._id && r.action === 'fulfill' && r.status === 200 && new URL(r.url).hostname === 'docs.google.com');
                        const measuredNav = current.navigations.find(n => n.url === expected);
                        const measured = current.observations.find(o => o.targetId === measuredNav?.targetId && o.loaderId === measuredNav?.loaderId);
                        if (!verifyEmbed({ present: measured?.routeState?.betcast, required: options['expect-betcast'], expectedUrl: expectedEmbed, measuredUrl: measured?.routeState?.betcastSrc, probe: current.betcastProbe, response, navigation, provider })) throw new Error('BetCast frame, document, fixture or rows mismatch');
                        current.betcastProbe.response = response;
                        current.betcastProbe.provider = provider;
                    }
                } catch (error) { current.causes.push(`Run: ${error.message}`); }
                finally {
                    if (stop) {
                        const targetId = lhr && current.navigations.filter(nav => nav.url === expected).at(-1)?.targetId;
                        await stop(() => closeChrome(chrome), options.origin ? undefined : targetId)
                            .catch(error => current.causes.push(`Observer: ${error.message}`));
                    }
                    try { await closeChrome(chrome); } finally { try { if (browser) await browser.disconnect(); } finally { fs.rmSync(profile, { recursive: true, force: true }); cleanupPaths.delete(profile); } }
                }
                const expectedFinal = route.name === 'Standings' ? `${expected}?tab=drivers` : expected;
                const navigations = auditedNavigations(current.navigations, expected, current.auditNavigationCount);
                // Lighthouse's back-forward cache audit navigates away and back after the measured load.
                const auditedNavigation = navigations[0];
                const observation = current.observations.find(value =>
                    (value.url === expected || value.url === expectedFinal) &&
                    auditedNavigation?.targetId === value.targetId && auditedNavigation?.loaderId === value.loaderId
                );
                const analytics = current.requests.filter(request => { try { return /(^|\.)(googletagmanager\.com|google-analytics\.com|doubleclick\.net)$/i.test(new URL(request.url).hostname); } catch (_) { return false; } });
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
                    if (!options.origin && state?.betcast && (!state.betcastRows || !current.requests.some(request =>
                        request.action === 'fulfill' && request.resourceType === 'Document' &&
                        request.frameId === state.betcastFrameId
                    ))) current.causes.push('BetCast embed document not fulfilled or data rows not populated');
                    const hits = current.requests.filter(request => request.action === 'fulfill' && request.targetId === observation?.targetId && request.frameId === observation?.targetId);
                    assertions.auditedTargetId = observation?.targetId || null;
                    assertions.auditedFixtureHits = hits;
                    if (!hits.length) current.causes.push('No fixture hit on audited target');
                    if (observation?.serviceWorker?.controlled !== false) current.causes.push('Service worker controls audited page');
                }
                if (options.origin && !(current.localResponses || []).some(r => r.phase === 'lighthouse' && r.url === expected && r.type === 'Document' && r.status === 200 && r.targetId === auditedNavigation?.targetId && r.frameId === auditedNavigation?.frameId && r.loaderId === auditedNavigation?.loaderId)) current.causes.push('Audited local document response missing');
                if (options.origin && route.name === 'Article' && !verifyEmbed({ present: observation?.routeState?.betcast, required: options['expect-betcast'], expectedUrl: expectedEmbed, measuredUrl: observation?.routeState?.betcastSrc, probe: current.betcastProbe, response: current.betcastProbe?.response, navigation: current.navigations.find(n => n.url === expectedEmbed && n.frameId === current.betcastProbe?.frameId && n.targetId === current.betcastProbe?.response?.targetId && n.loaderId === current.betcastProbe?.response?.loaderId), provider: current.betcastProbe?.provider })) current.causes.push('BetCast verification failed');
                const measuredEmbed = options.origin ? {
                    betcast: observation?.routeState?.betcast ? 'verified' : 'absent',
                    documents: (current.localResponses || []).filter(r => r.phase === 'lighthouse' && r.type === 'Document' && new URL(r.url).pathname.startsWith('/betcast/')).length,
                    providerFixtures: current.requests.filter(r => r.phase === 'lighthouse' && r.action === 'fulfill' && new URL(r.url).hostname === 'docs.google.com').length
                } : null;
                const metrics = lhr ? routeMetrics(lhr) : null;
                if (metrics) metrics['inline-css-bytes'] = inlineCssBytes(fs.readFileSync(resolveRequest(site, route.path), 'utf8'));
                attempts.push({ ...attemptOutput(current, assertions, metrics), ...(options.origin ? { measured: { embed: measuredEmbed }, probe: { embed: current.betcastProbe || null }, sessionEvents: current.sessionEvents || [], localResponses: current.localResponses || [], requestOrigins: Object.entries(current.originCounts || {}).map(([key, count]) => { const [origin, classification, phase] = JSON.parse(key); return { origin, classification, phase, count }; }) } : {}) });
            }
            const summary = options.discovery ? null : summarizeAttempts(route, attempts, count);
            report.routes.push({ route: route.name, path: route.path, attempts, summary, thirdPartyAttribution: route.name === 'Article' && !options.origin ? 'BLOCKED-ORIGIN: loopback origin differs from production HTTPS' : undefined });
            console.log(`${route.name}: ${options.discovery ? `${attempts[0].requests.length} external requests observed` : `${summary.valid}/${count} valid; ${summary.failures.length ? summary.failures.join('; ') : 'budgets passed'}`}`);
        }
    } catch (error) {
        report.error = error.message;
        throw error;
    } finally {
        if (server) { if (options.origin) await startedClose(); else await new Promise(resolve => server.close(resolve)); }
        removeCleanup();
        fs.writeFileSync(path.join(out, options.discovery ? 'discovery.json' : 'results.json'), JSON.stringify(report, null, 2) + '\n');
    }
    if (reportExitCode(report)) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => { console.error(error.stack || error); process.exitCode = 1; });
