import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-test-'));
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
        if (req.url === '/worker.js') return res.end("fetch('https://worker.invalid/data').catch(()=>{})");
        if (req.url === '/frame') return res.end("<script>fetch('https://frame.invalid/data').catch(()=>{})</script>");
        res.end("<iframe src='/frame'></iframe><script>new Worker('/worker.js')</script>");
    });
    await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
    let chrome, browser, stop;
    try {
        chrome = await launch({ chromeFlags: ['--headless=new', '--no-sandbox', ...CLOSED_PROXY_FLAGS], maxConnectionRetries: 3, connectionPollInterval: 500, logLevel: 'silent' });
        browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
        const origin = `http://127.0.0.1:${server.address().port}`;
        const attempt = { causes: [], requests: [], observations: [] };
        const fixtures = new Map([[requestKey('GET', 'https://frame.invalid/data'), { responseCode: 200, responseHeaders: [{ name: 'access-control-allow-origin', value: '*' }], body: Buffer.from('ok').toString('base64') }], [requestKey('GET', 'https://worker.invalid/data'), { responseCode: 200, responseHeaders: [{ name: 'access-control-allow-origin', value: '*' }], body: Buffer.from('ok').toString('base64') }]]);
        stop = await intercept(browser, origin, fixtures, attempt);
        const page = await browser.newPage();
        await page.goto(origin, { waitUntil: 'networkidle0' });
        await stop.drain();
        assert.ok(attempt.requests.some(item => item.url === 'https://frame.invalid/data' && item.action === 'fulfill'));
        const worker = attempt.requests.find(item => item.url === 'https://worker.invalid/data');
        assert.ok(worker, 'worker request must be observed');
        console.log(`Dedicated worker coverage: ${worker.action}`);
        assert.ok(worker.action === 'fulfill' || (worker.action === 'observed-fetchless' && attempt.causes.some(cause => cause.includes(worker.url))));
        await page.close();
    } finally {
        if (stop) await stop().catch(() => {});
        if (browser) await browser.disconnect();
        if (chrome) await chrome.kill();
        await new Promise(resolve => server.close(resolve));
    }
});
