import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { classifyRequest, loadFixtures, requestKey, summarizeAttempts } from './lighthouse-rate-safe.mjs';

const hash = data => createHash('sha256').update(data).digest('hex');
test('method and decoded query multimap match exactly', () => {
    const a = requestKey('GET', 'https://example.org/data?a=1&a=2&b=x%20y');
    assert.equal(a, requestKey('GET', 'https://example.org/data?b=x+y&a=2&a=1'));
    assert.notEqual(a, requestKey('POST', 'https://example.org/data?a=1&a=2&b=x+y'));
    assert.notEqual(a, requestKey('GET', 'https://example.org/data?a=1&b=x+y'));
    assert.throws(() => requestKey('GET', 'https://user@example.org/data'));
    assert.throws(() => requestKey('GET', 'https://example.org/data#fragment'));
});
test('fixture validates body and replays status and safe headers; unknown requests fail closed', () => {
    const dir = fs.mkdtempSync(path.join(process.cwd(), '.fixture-test-'));
    try {
        const body = Buffer.from('{"ok":true}');
        fs.writeFileSync(path.join(dir, 'body'), body);
        const item = { method: 'GET', url: 'https://provider.test/data?q=1', status: 200, headers: { 'content-type': 'application/json', 'content-length': '11' }, body: 'body', sha256: `sha256-${hash(body)}` };
        const manifest = path.join(dir, 'manifest.json');
        fs.writeFileSync(manifest, JSON.stringify({ fixtures: [item] }));
        const fixtures = loadFixtures(manifest);
        const result = classifyRequest({ method: 'GET', url: item.url }, 'http://127.0.0.1:1234', fixtures);
        assert.equal(result.action, 'fulfill');
        assert.equal(result.fixture.responseCode, 200);
        assert.deepEqual(result.fixture.responseHeaders, [{ name: 'content-type', value: 'application/json' }]);
        assert.deepEqual(Buffer.from(result.fixture.body, 'base64'), body);
        assert.equal(classifyRequest({ method: 'GET', url: 'https://provider.test/data?q=2' }, 'http://127.0.0.1:1234', fixtures).action, 'abort');
        assert.equal(classifyRequest({ method: 'GET', url: 'http://127.0.0.1:1234/a.css' }, 'http://127.0.0.1:1234', fixtures).action, 'continue');
        fs.writeFileSync(path.join(dir, 'body'), 'corrupt');
        assert.throws(() => loadFixtures(manifest), /Invalid fixture body/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('budget bytes and thresholds remain at the supplied base', () => {
    assert.equal(hash(fs.readFileSync(new URL('../../perf/lighthouse-budget.json', import.meta.url))), '61680ea406e95116bbe7676522d7fc6f887bb377cdbbfb1d560272d92f58a434');
});
test('only valid attempts count and existing evaluator applies thresholds', () => {
    const route = { thresholds: { performance: 95 } };
    const attempts = [{ valid: true, metrics: { performance: 96 } }, { valid: false, metrics: { performance: 1 } }];
    assert.match(summarizeAttempts(route, attempts, 2).failures[0], /1\/2/);
    assert.deepEqual(summarizeAttempts(route, attempts, 1).failures, []);
    assert.equal(summarizeAttempts(route, [{ valid: true, metrics: { performance: 90 } }], 1).failures.length, 1);
});

test('label is required and prevents accidental mixing', async () => {
    const { spawnSync } = await import('node:child_process');
    const result = spawnSync(process.execPath, [new URL('./lighthouse-rate-safe.mjs', import.meta.url).pathname, '--target-dir', '.', '--label', 'other', '--out', '.'], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage:/);
});

test('frame and worker interception', async () => {
    const { launch } = await import('chrome-launcher');
    const { default: puppeteer } = await import('puppeteer-core');
    const { intercept, CLOSED_PROXY_FLAGS } = await import('./lighthouse-rate-safe.mjs');
    assert.ok(CLOSED_PROXY_FLAGS.includes('--proxy-server=http://127.0.0.1:9'));
    const http = await import('node:http');
    const server = http.createServer((req, res) => {
        if (req.url === '/preexisting') return res.end('pre-existing page');
        if (req.url === '/worker.js') {
            res.setHeader('content-type', 'application/javascript');
            return res.end("fetch('https://worker.invalid/data').then(r => r.text()).then(postMessage).catch(()=>{})");
        }
        res.setHeader('content-type', 'text/html');
        if (req.url === '/frame') return res.end("<script>fetch('https://frame.invalid/data').then(r => r.text()).then(t => parent.postMessage(t, '*'))</script>");
        res.end(`<main><h1>Title</h1><img id="hero-image" class="article-header-img"
            src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==">
            <span id="next-race-name">Race</span><section id="numbers"><div class="tower-row">
            <span class="tower-row__name">Driver</span><span class="tower-row__pts">10</span></div></section>
            <ul class="ed-cal__months"><li>Month</li></ul><a href="/blog-entries/test">Article</a>
            <span id="round-num">20</span><div id="drivers-table"><div class="st-row" data-detail-target="x">Driver</div></div>
            <div class="article-content">Body</div></main>
            <script>window.received=[];onmessage=e=>received.push(e.data);let w=new Worker('/worker.js');w.onmessage=e=>received.push(e.data)</script><iframe src='/frame'></iframe>`);
    });
    await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
    let chrome, browser, stop, profiles;
    try {
        profiles = fs.mkdtempSync(path.join(process.cwd(), '.browser-test-'));
        fs.mkdirSync(path.join(profiles, 'first'));
        fs.mkdirSync(path.join(profiles, 'second'));
        chrome = await launch({ userDataDir: path.join(profiles, 'first'), chromeFlags: ['--headless=new', '--no-sandbox', ...CLOSED_PROXY_FLAGS], maxConnectionRetries: 3, connectionPollInterval: 500, logLevel: 'silent' });
        browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
        const origin = `http://127.0.0.1:${server.address().port}`;
        const attempt = { causes: [], requests: [], observations: [] };
        const fixtures = new Map([[requestKey('GET', 'https://frame.invalid/data'), { responseCode: 200, responseHeaders: [{ name: 'access-control-allow-origin', value: '*' }], body: Buffer.from('ok').toString('base64') }], [requestKey('GET', 'https://worker.invalid/data'), { responseCode: 200, responseHeaders: [{ name: 'access-control-allow-origin', value: '*' }], body: Buffer.from('ok').toString('base64') }]]);
        stop = await intercept(browser, origin, fixtures, attempt);
        assert.ok(!attempt.causes.some(cause => cause.includes('pre-existing target could have issued requests')));
        const page = await browser.newPage();
        await page.goto(origin, { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => window.received.includes('ok'), { timeout: 5000 }).catch(error => {
            throw new Error(`${error.message}; requests=${JSON.stringify(attempt.requests)}; causes=${JSON.stringify(attempt.causes)}`);
        });
        await stop.drain();
        assert.ok(await page.evaluate(() => window.received.includes('ok')));
        assert.deepEqual(attempt.causes.filter(cause => cause.startsWith('Observer:')), []);
        const observation = attempt.observations.find(item => item.url === `${origin}/`);
        assert.ok(observation?.loaderId);
        assert.deepEqual(observation.routeState, {
            hero: true, schedule: true, homeStandings: true, calendar: 1, articleLinks: 1,
            round: '20', standingsRows: 1, articleHero: true, title: true, articleBody: true, betcast: false
        });
        await page.evaluate(() => { fetch('https://unknown.invalid/data').catch(() => {}); new WebSocket('wss://socket.invalid/'); });
        await new Promise(resolve => setTimeout(resolve, 300));
        await stop.drain();
        assert.ok(attempt.causes.some(cause => cause.includes('Unmatched request: GET https://unknown.invalid/data')));
        assert.ok(attempt.causes.some(cause => cause.includes('External WebSocket: wss://socket.invalid/')));
        assert.ok(attempt.requests.some(item => item.url === 'https://frame.invalid/data' && item.action === 'fulfill'));
        const firstProcess = chrome.process;
        const firstExit = new Promise(resolve => firstProcess.once('exit', resolve));
        await stop(async () => chrome.kill());
        await firstExit;
        assert.ok(firstProcess.exitCode !== null || firstProcess.signalCode !== null);
        assert.ok(attempt.requests.some(item => item.url === 'https://worker.invalid/data' && item.action === 'fulfill') ||
            attempt.causes.some(cause => cause.includes('Network request without Fetch pause: https://worker.invalid/data')));
        stop = null;
        await browser.disconnect();
        browser = null;
        chrome = null;
        assert.deepEqual(attempt.causes.filter(cause => cause.startsWith('Observer:')), []);

        chrome = await launch({ userDataDir: path.join(profiles, 'second'), chromeFlags: ['--headless=new', '--no-sandbox', ...CLOSED_PROXY_FLAGS], maxConnectionRetries: 3, connectionPollInterval: 500, logLevel: 'silent' });
        browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
        const next = { causes: [], requests: [], observations: [] };
        const existing = await browser.newPage();
        await existing.goto(`${origin}/preexisting`);
        stop = await intercept(browser, origin, fixtures, next);
        assert.ok(next.causes.includes(`Observer: pre-existing target could have issued requests: page ${origin}/preexisting`));
        await stop.drain();
        assert.ok(!next.requests.some(request => request.url.includes('late.invalid')));
        assert.ok(!next.causes.some(cause => cause.includes('late.invalid')));
    } finally {
        if (stop) await stop(async () => { if (chrome) await chrome.kill(); }).catch(() => {});
        if (browser) await browser.disconnect();
        if (chrome) await chrome.kill();
        await new Promise(resolve => server.close(resolve));
        if (profiles) fs.rmSync(profiles, { recursive: true, force: true });
    }
});


test('unpaused nonblank attachments invalidate the attempt', async () => {
    const { intercept } = await import('./lighthouse-rate-safe.mjs');
    const browser = new EventEmitter();
    const root = new EventEmitter();
    const session = new EventEmitter();
    root.connection = () => ({ session: () => session });
    session.send = async () => ({});
    root.send = async method => {
        if (method === 'Target.setAutoAttach') {
            for (const [targetId, waitingForDebugger, url] of [
                ['unpaused', false, 'http://127.0.0.1/race'],
                ['paused', true, 'http://127.0.0.1/safe'],
                ['blank', false, 'about:blank']
            ]) root.emit('Target.attachedToTarget', { sessionId: targetId, waitingForDebugger, targetInfo: { targetId, type: 'worker', url } });
        }
        return method === 'Target.getTargets' ? { targetInfos: [] } : {};
    };
    browser.target = () => ({ createCDPSession: async () => root });
    const attempt = { causes: [], requests: [], observations: [] };
    const stop = await intercept(browser, 'http://127.0.0.1', new Map(), attempt);
    assert.deepEqual(attempt.causes, ['Observer: target attached without pause could have issued requests: worker http://127.0.0.1/race']);
    await stop(async () => {});
});

test('network-only event between close and disconnect invalidates its attempt', async () => {
    const { intercept } = await import('./lighthouse-rate-safe.mjs');
    const browser = new EventEmitter();
    browser.connected = true;
    const root = new EventEmitter();
    const session = new EventEmitter();
    root.connection = () => ({ session: () => session });
    session.send = async () => ({});
    root.send = async method => {
        if (method === 'Target.setAutoAttach') root.emit('Target.attachedToTarget', { sessionId: 's', targetInfo: { targetId: 't', type: 'worker' } });
        return method === 'Target.getTargets' ? { targetInfos: [] } : {};
    };
    browser.target = () => ({ createCDPSession: async () => root });
    const first = { causes: [], requests: [], observations: [] };
    const stop = await intercept(browser, 'http://127.0.0.1', new Map(), first);
    const url = 'https://unobserved.invalid/data';
    await stop(async () => {
        setImmediate(() => {
            session.emit('Network.requestWillBeSent', { requestId: 'late', request: { method: 'GET', url } });
            browser.connected = false;
            browser.emit('disconnected');
        });
    });
    assert.deepEqual(first.causes, [`Network request without Fetch pause: ${url}`]);
});
