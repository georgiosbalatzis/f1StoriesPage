import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { validateInput, validateSchema, sections } from '../schema.mjs';
import { approvedURL, retrievedEvidence, validateEvidence, APPROVED_DOMAINS } from '../evidence.mjs';
import { configuration, liveResearch, estimateUsage, readBounded } from '../provider.mjs';
import { startResearchServer } from '../server.mjs';
import { examples, demoDossier, DEMO_LABEL } from '../fixtures.mjs';
import { briefText } from '../brief.mjs';

const input = (extra = {}) => ({ question: examples[0].question, season: '2026', grandPrix: '', session: 'Qualifying', category: 'Technical', mode: 'DEMO', activateLive: false, ...extra });
const sourceURL = 'https://www.fia.com/regulation/category/2182';
const claim = (extra = {}) => ({ id: 'C1', text: 'Δοκιμαστικός ισχυρισμός', kind: 'source_report', sourceIds: ['model1'], statistic: null, ...extra });
const raw = (extra = {}) => ({ scope: 'Πεδίο ελέγχου', ...Object.fromEntries(Object.keys(sections).map(k => [k, []])), limitations: [], outline: [], sources: [{ id: 'model1', url: sourceURL, title: 'Model title', publicationDate: '2026-01-01' }], facts: [claim()], ...extra });
const response = (dossier = raw(), extra = {}) => ({ status: 'completed', output: [
    { type: 'web_search_call', status: 'completed', action: { type: 'search', sources: [{ type: 'url', url: sourceURL }] } },
    { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(dossier), annotations: [] }] },
], usage: { input_tokens: 1000, output_tokens: 500 }, ...extra });
const evidence = r => retrievedEvidence(r, '2026-10-23T10:00:00Z');
async function serverFor(t, options = {}) {
    const server = await startResearchServer({ port: 0, env: {}, ...options });
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const config = await (await fetch(origin + '/api/config')).json();
    const post = (data = input(), headers = {}) => fetch(origin + '/api/research', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-F1S-Research': config.csrf, ...headers }, body: JSON.stringify(data) });
    return { server, origin, config, post };
}

test('default configuration remains DEMO even with a key; bounds reject invalid values', () => {
    assert.equal(configuration({}).mode, 'DEMO');
    assert.equal(configuration({ OPENAI_API_KEY: 'not-a-real-key' }).mode, 'DEMO');
    assert.equal(configuration({}).maxRequests, 5);
    for (const env of [{ F1S_RESEARCH_MODE: 'auto' }, { F1S_MAX_LIVE_REQUESTS: '6' }, { F1S_MAX_OUTPUT_TOKENS: 'Infinity' }, { OPENAI_MODEL: '../secret' }]) assert.throws(() => configuration(env));
});

test('Greek request validation rejects empty, unknown, oversized and invalid fields', () => {
    assert.deepEqual(validateInput(input()), input());
    for (const bad of [null, [], input({ question: '   ' }), input({ question: 'α'.repeat(1201) }), input({ question: 'διακοπή\u0000δοκιμή' }), input({ season: '1949' }), input({ season: 2026 }), input({ category: 'Anything' }), input({ session: 'Q99' }), input({ mode: 'auto' }), input({ activateLive: 'true' }), input({ domains: ['evil.test'] }), input({ draft: 'private draft' }), input({ apiKey: 'secret' })]) assert.throws(() => validateInput(bad));
});

test('fixed source domain boundary rejects deceptive hosts, credentials, protocols and private resources', () => {
    for (const url of ['https://fia.com/a', 'https://www.formula1.com/a', 'https://press.pirelli.com/a']) assert.equal(approvedURL(url), url);
    for (const url of ['http://fia.com/a', 'https://fia.com.evil.test/a', 'https://evilfia.com/a', 'https://fia.com@127.0.0.1/a', 'https://127.0.0.1/a', 'https://[::1]/a', 'https://169.254.169.254/a', 'file:///etc/passwd', 'javascript:alert(1)', 'https://fia.com:8080/a', 'https://fia.com\\@evil.test/a', 'https://fia.com/a\n']) assert.equal(approvedURL(url), null, url);
});

test('strict response contract rejects unknown keys, wrong kinds, missing fields and malformed statistics', () => {
    assert.equal(validateSchema(raw()).facts.length, 1);
    for (const bad of [raw({ hidden: true }), raw({ facts: [claim({ kind: 'verified' })] }), raw({ facts: [claim({ statistic: { value: '7' } })] }), raw({ sources: null }), raw({ scope: ' ' }), raw({ outline: ['a'.repeat(301)] })]) assert.throws(() => validateSchema(bad));
    const missing = raw(); delete missing.outline; assert.throws(() => validateSchema(missing));
});

test('actual retrieval records alone do not establish claim support or publication dates', () => {
    const d = validateEvidence(raw(), evidence(response()));
    assert.equal(d.facts.length, 0); assert.equal(d.unverified.length, 1);
    assert.equal(d.unverified[0].association, 'model_reference_only');
    assert.equal(d.sources[0].publicationDate, null);
    assert.notEqual(d.sources[0].title, 'Model title');
    assert.equal(d.sources[0].retrievedAt, '2026-10-23T10:00:00Z');
    assert.match(d.limitations[0], /δεν αποδεικνύουν/);
});

test('fabricated IDs and URLs are rejected even when the claimed URL is an official domain', () => {
    for (const d of [raw({ facts: [claim({ sourceIds: ['made-up'] })] }), raw({ sources: [{ ...raw().sources[0], url: sourceURL + '/invented' }] }), raw({ sources: [{ ...raw().sources[0], url: 'https://evil.test/page' }] })]) {
        const out = validateEvidence(d, evidence(response()));
        assert.equal(out.facts.length, 0); assert.equal(out.unverified[0].association, 'rejected_reference'); assert.deepEqual(out.unverified[0].sourceIds, []);
    }
    const duplicate = raw({ sources: [raw().sources[0], raw().sources[0]] }); assert.throws(() => validateEvidence(duplicate, evidence(response())));
    assert.throws(() => validateEvidence(raw({ executive: [claim()] }), evidence(response())));
});

test('citation offsets bind only to the exact unique claim, never a neighboring sentence or source list', () => {
    const r = response(), text = r.output[1].content[0].text;
    const start = text.indexOf(JSON.stringify(claim().text));
    const annotation = { type: 'url_citation', url: sourceURL, title: 'Actual annotation title', start_index: start + 1, end_index: start + 10 };
    r.output[1].content[0].annotations = [annotation];
    let d = validateEvidence(raw(), evidence(r));
    assert.equal(d.unverified[0].association, 'provider_citation');
    assert.equal(d.unverified[0].verification, 'unverified');
    assert.equal(d.sources[0].title, annotation.title);
    for (const patch of [{ start_index: 0, end_index: 2 }, { start_index: start, end_index: text.length + 5 }, { start_index: '0', end_index: 2 }]) {
        r.output[1].content[0].annotations = [{ ...annotation, ...patch }];
        assert.equal(validateEvidence(raw(), evidence(r)).unverified[0].association, 'model_reference_only');
    }
});

test('failed search results and unapproved annotations cannot become sources; open-page records retain actual URL', () => {
    const r = response(); r.output[0].status = 'failed';
    r.output[1].content[0].annotations = [{ type: 'url_citation', url: 'https://evil.test/a' }];
    assert.equal(evidence(r).records.length, 0);
    r.output[0] = { type: 'web_search_call', status: 'completed', action: { type: 'open_page', url: sourceURL } };
    assert.equal(evidence(r).records[0].url, sourceURL);
});

test('unsupported explanations, predictions and statistics remain unverified; disagreements are preserved', () => {
    const stat = Object.fromEntries(['value', 'unit', 'population', 'period', 'dataSource', 'method', 'exclusions'].map(k => [k, 'test']));
    for (const kind of ['technical_interpretation', 'prediction', 'unsupported_hypothesis', 'calculated_statistic']) {
        const d = validateEvidence(raw({ facts: [claim({ kind, statistic: kind === 'calculated_statistic' ? stat : null })] }), evidence(response()));
        assert.equal(d.facts.length, 0); assert.equal(d.unverified[0].kind, kind);
    }
    const d = validateEvidence(raw({ facts: [], contradictions: [claim({ text: 'Πηγή Α: 12, πηγή Β: 13 — δεν επιλύθηκε.' })] }), evidence(response()));
    assert.equal(d.contradictions[0].verification, 'unverified'); assert.match(d.contradictions[0].text, /δεν επιλύθηκε/);
});

test('four deterministic DEMO investigations work without credentials; arbitrary questions never get canned facts', () => {
    for (const ex of examples) {
        const request = input({ question: ex.question, category: ex.category, session: ex.session });
        const result = demoDossier(request);
        assert.deepEqual(result, demoDossier(request)); assert.equal(result.label, DEMO_LABEL); assert.equal(result.usage.estimatedUSD, 0);
        for (const c of [...result.dossier.executive, ...result.dossier.facts]) assert.ok(c.sourceIds.length && c.sourceIds.every(id => result.dossier.sources.some(s => s.id === id)));
        assert.ok(Buffer.from(briefText(result), 'utf8').toString('utf8').includes(ex.question));
        if (ex.id === 'history') assert.equal(result.dossier.contradictions.length, 1);
        if (ex.id === 'unsupported') { assert.equal(result.dossier.sources.length, 0); assert.match(result.dossier.unverified[0].text, /Ανεπαρκή/); }
    }
    for (const request of [input({ question: 'Άγνωστο ερώτημα για το F1' }), input({ season: '2025' }), input({ grandPrix: 'Monza' })]) assert.equal(demoDossier(request).dossier.sources.length, 0);
});

test('Responses adapter sends only explicit scope, fixed tools and strict schema; one request, no retry', async () => {
    let calls = 0;
    const result = await liveResearch(input({ mode: 'LIVE', activateLive: true }), configuration({ F1S_RESEARCH_MODE: 'LIVE', OPENAI_API_KEY: 'test-only' }), new AbortController().signal, async (url, options) => {
        calls++; assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(options.redirect, 'error');
        assert.equal(options.headers.Authorization, 'Bearer test-only');
        const b = JSON.parse(options.body); assert.equal(b.store, false); assert.equal(b.service_tier, 'default');
        assert.equal(b.tools[0].type, 'web_search'); assert.deepEqual(b.tools[0].filters.allowed_domains, APPROVED_DOMAINS);
        assert.equal(b.text.format.strict, true); assert.equal(b.max_tool_calls, 3); assert.equal(b.max_output_tokens, 5000);
        assert.deepEqual(Object.keys(JSON.parse(b.input)), ['question', 'season', 'grandPrix', 'session', 'category']);
        assert.match(b.instructions, /untrusted data/); assert.match(b.instructions, /brake pressure/);
        return Response.json(response());
    });
    assert.equal(calls, 1); assert.equal(result.mode, 'LIVE'); assert.equal(result.dossier.facts.length, 0);
    assert.match(result.dossier.scope, new RegExp('2026'));
    calls = 0;
    await assert.rejects(liveResearch(input({ mode: 'LIVE', activateLive: true }), configuration({ F1S_RESEARCH_MODE: 'LIVE', OPENAI_API_KEY: 'test-only' }), new AbortController().signal, async () => { calls++; return new Response('No', { status: 429 }); }));
    assert.equal(calls, 1);
});

test('adapter itself refuses unactivated paid calls before fetching', async () => {
    let calls = 0;
    const fakeFetch = () => { calls++; throw new Error('Must not fetch'); };
    for (const [request, config] of [[input(), configuration({})], [input({ mode: 'LIVE', activateLive: true }), configuration({ F1S_RESEARCH_MODE: 'LIVE' })], [input({ mode: 'LIVE' }), configuration({ F1S_RESEARCH_MODE: 'LIVE', OPENAI_API_KEY: 'test-only' })]]) {
        await assert.rejects(liveResearch(request, config, new AbortController().signal, fakeFetch), /activation/);
    }
    assert.equal(calls, 0);
});

test('incomplete, refused and invalid provider responses fail safely and retain reported usage', async () => {
    for (const r of [response(raw(), { status: 'incomplete' }), response(raw(), { output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }] }), response({ invalid: true })]) {
        await assert.rejects(liveResearch(input({ mode: 'LIVE', activateLive: true }), configuration({ F1S_RESEARCH_MODE: 'LIVE', OPENAI_API_KEY: 'test-only' }), new AbortController().signal, async () => Response.json(r)), e => e.usage.inputTokens === 1000);
    }
    await assert.rejects(readBounded(new Response('oversized'), 3), /size limit/);
});

test('usage estimates use documented rates and actual tool actions; unknown model/usage has no guessed price', () => {
    const r = response(); r.output.push({ type: 'web_search_call', action: { type: 'open_page' } });
    const usage = estimateUsage(r, 'gpt-6.1-sol', 55);
    assert.equal(usage.estimatedUSD, .017); assert.equal(usage.searchToolCalls, 2); assert.equal(usage.billableSearchActions, 1); assert.equal(usage.elapsedMs, 55);
    assert.equal(estimateUsage(r, 'unknown', 1).estimatedUSD, null);
    assert.equal(estimateUsage(response(raw(), { usage: null }), 'gpt-6.1-sol', 1).estimatedUSD, null);
});

test('server binds loopback; DEMO runs without provider; API key and repo files never reach browser', async t => {
    const { server, origin, config, post } = await serverFor(t, { env: { OPENAI_API_KEY: 'isolation-secret', GITHUB_TOKEN: 'github-secret' }, provider: () => { throw new Error('Unexpected call'); } });
    assert.equal(server.address().address, '127.0.0.1'); assert.equal(config.liveAvailable, false);
    const r = await post(); assert.equal(r.status, 200); const body = await r.text(); assert.match(body, /DEMO/); assert.doesNotMatch(body, /isolation-secret|github-secret/);
    for (const path of ['/api/config', '/', '/app.js', '/app.css']) {
        const r = await fetch(origin + path); assert.equal(r.status, 200); assert.doesNotMatch(await r.text(), /isolation-secret|github-secret/);
        assert.equal(r.headers.get('access-control-allow-origin'), null); assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
    }
    for (const path of ['/.env', '/provider.mjs', '/package.json', '/blog-module/blog-index-data.json', '/generate.html', '/api/publish', '/api/drafts']) assert.equal((await fetch(origin + path)).status, 404);
    assert.equal((await post(input({ mode: 'LIVE', activateLive: true }))).status, 403);
});

test('Host, Origin, fetch metadata and CSRF checks reject cross-site requests', async t => {
    const { origin, post } = await serverFor(t);
    for (const headers of [{ Origin: 'https://evil.test' }, { Origin: 'null' }, { Origin: '' }, { 'X-F1S-Research': '' }, { 'Sec-Fetch-Site': 'cross-site' }]) assert.equal((await post(input(), headers)).status, 403, JSON.stringify(headers));
    const hostStatus = await new Promise((resolve, reject) => {
        const req = http.get(origin + '/api/config', { headers: { Host: 'evil.test' } }, res => { res.resume(); resolve(res.statusCode); });
        req.on('error', reject);
    });
    assert.equal(hostStatus, 403);
    assert.equal((await fetch(origin + '/api/config', { headers: { Origin: 'https://evil.test' } })).status, 403);
});

test('request limits reject invalid JSON, huge content, wrong content type and invalid fields', async t => {
    const { origin, config, post } = await serverFor(t);
    assert.equal((await post(input({ privateDraft: 'not allowed' }))).status, 400);
    assert.equal((await post(input(), { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await post(input({ question: 'a'.repeat(9000) }))).status, 413);
    assert.equal((await fetch(origin + '/api/research', { method: 'POST', headers: { Origin: origin, 'X-F1S-Research': config.csrf, 'Content-Type': 'application/json' }, body: '{bad' })).status, 400);
    const status = await new Promise((resolve, reject) => {
        const req = http.request(origin + '/api/research', { method: 'POST', headers: { Origin: origin, 'X-F1S-Research': config.csrf, 'Content-Type': 'application/json' } }, res => { res.resume(); resolve(res.statusCode); });
        req.on('error', reject); req.write('a'.repeat(5000)); req.end('b'.repeat(4000));
    });
    assert.equal(status, 413);
});

test('live needs key, server opt-in and per-request activation; sixth request is refused including failed attempts', async t => {
    const absent = await serverFor(t, { env: { F1S_RESEARCH_MODE: 'LIVE' } });
    assert.equal((await absent.post(input({ mode: 'LIVE', activateLive: true }))).status, 403);
    let calls = 0;
    const { post } = await serverFor(t, { env: { OPENAI_API_KEY: 'test-only', F1S_RESEARCH_MODE: 'LIVE' }, provider: async () => { calls++; throw new Error('failure'); } });
    assert.equal((await post(input({ mode: 'LIVE' }))).status, 403);
    for (let i = 0; i < 5; i++) assert.equal((await post(input({ mode: 'LIVE', activateLive: true }))).status, 502);
    assert.equal((await post(input({ mode: 'LIVE', activateLive: true }))).status, 429); assert.equal(calls, 5);
});

test('one concurrent live request, timeout aborts upstream and counter remains consumed', async t => {
    let started; const ready = new Promise(resolve => { started = resolve; }); let aborted = false;
    const { post, origin } = await serverFor(t, { env: { OPENAI_API_KEY: 'test-only', F1S_RESEARCH_MODE: 'LIVE' }, timeoutMs: 80, provider: async (_, __, signal) => { started(); await new Promise(resolve => signal.addEventListener('abort', () => { aborted = true; resolve(); })); throw new Error('abort'); } });
    const first = post(input({ mode: 'LIVE', activateLive: true })); await ready;
    assert.equal((await post(input({ mode: 'LIVE', activateLive: true }))).status, 429);
    const res = await first; assert.equal(res.status, 504); assert.equal(aborted, true);
    const config = await (await fetch(origin + '/api/config')).json(); assert.equal(config.busy, false); assert.equal(config.liveRequests, 1);
});

test('browser disconnect cancels provider work without automatic retry', async t => {
    let started, aborted; const ready = new Promise(resolve => { started = resolve; }), stopped = new Promise(resolve => { aborted = resolve; });
    const { origin, config } = await serverFor(t, { env: { OPENAI_API_KEY: 'test-only', F1S_RESEARCH_MODE: 'LIVE' }, provider: async (_, __, signal) => { started(); await new Promise(resolve => signal.addEventListener('abort', () => { aborted(); resolve(); })); throw new Error('abort'); } });
    const controller = new AbortController();
    const pending = fetch(origin + '/api/research', { method: 'POST', signal: controller.signal, headers: { Origin: origin, 'X-F1S-Research': config.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify(input({ mode: 'LIVE', activateLive: true })) });
    await ready; controller.abort(); await assert.rejects(pending); await stopped;
});

test('server output-size limit rejects an oversized result without leaking it', async t => {
    const { post } = await serverFor(t, { env: { OPENAI_API_KEY: 'test-only', F1S_RESEARCH_MODE: 'LIVE' }, provider: async () => {
        const result = demoDossier(input()); result.dossier.scope = 'a'.repeat(512 * 1024); return result;
    } });
    const res = await post(input({ mode: 'LIVE', activateLive: true }));
    assert.equal(res.status, 502); assert.match(await res.text(), /Output size limit/);
});

test('service modules contain no editor imports, write APIs, shell execution or publishing capabilities', async () => {
    for (const name of ['server.mjs', 'provider.mjs', 'evidence.mjs', 'schema.mjs', 'fixtures.mjs']) {
        const code = await readFile(new URL('../' + name, import.meta.url), 'utf8');
        assert.doesNotMatch(code, /child_process|execSync|writeFile|indexedDB|api\.github\.com|GITHUB_TOKEN|scripts\/author/);
    }
});
