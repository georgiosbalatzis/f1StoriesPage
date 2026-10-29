import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { EDITORIAL_INPUT_VERSION, canonicalArticleUrl, joinable, validateEditorialInputs } from '../editorial-inputs.mjs';
import { parseCsv, importSearchConsoleCsv, writeEditorialInputs } from '../editorial-inputs-import.mjs';

const fixtures = fileURLToPath(new URL('./fixtures/editorial-inputs/', import.meta.url));
const read = name => fs.readFileSync(path.join(fixtures, name), 'utf8');
const fixture = () => JSON.parse(read('synthetic.json'));
const options = { property: 'https://f1-stories.gr/', start: '2026-10-19', end: '2026-10-25', asOf: '2026-10-29', dataState: 'final' };
const article = id => `https://f1-stories.gr/blog-module/blog-entries/${id}/article.html`;
const descriptor = (section, row = section.rows[0]) => ({ ...section, ...row });

test('v1 complete synthetic example and independent optional sections validate without mutation', () => {
    const doc = fixture(), before = JSON.stringify(doc);
    assert.equal(EDITORIAL_INPUT_VERSION, 1);
    assert.deepEqual(validateEditorialInputs(doc), { ok: true, errors: [], warnings: [] });
    assert.equal(JSON.stringify(doc), before);
    assert.equal(validateEditorialInputs({ version: 1, synthetic: true }).ok, true);
    for (const key of ['gsc', 'site', 'catalogue', 'linkGraph']) {
        assert.equal(validateEditorialInputs({ version: 1, synthetic: true, [key]: doc[key] }).ok, true);
    }
});

test('URL identity imports the public alias mapping; raw/encoded Greek Tau is never Latin T', () => {
    assert.equal(canonicalArticleUrl(`${article('20260222T')}?utm_source=SYNTHETIC#top`).url, article('20260222T'));
    assert.equal(canonicalArticleUrl(article('20260822G')).articleId, '20260822J');
    for (const id of ['20260227Τ', '20260227%CE%A4', '20260227%ce%a4', '20260227%Ce%a4']) {
        assert.equal(canonicalArticleUrl(article(id)).url, article('20260222T'));
    }
    assert.equal(canonicalArticleUrl(article('20260227T')).status, 'unmapped');
});

test('unmapped resources are retained distinctly, including queries, case, asset and directory routes', () => {
    const urls = [article('20991231SYNTHETIC'), article('20260222t'), article('20260222T') + '/',
        article('20260222T').replace('article.html', ''), article('20260222T').replace('article.html', '1.webp'),
        'https://f1-stories.gr/synthetic?a=1', 'https://f1-stories.gr/synthetic?a=2', article('%E0%A4'),
        article('20260227%25CE%25A4')];
    for (const url of urls) assert.deepEqual(canonicalArticleUrl(url), { url, articleId: null, status: 'unmapped' });
});

test('dead domain, offsite, insecure, credentialed and malformed URLs are rejected', () => {
    for (const url of ['https://f1stories.gr/x', 'https://www.f1-stories.gr/x', 'http://f1-stories.gr/x',
        'https://f1-stories.gr.evil.example/x', 'https://owner@f1-stories.gr/x', '/relative', null, 'bad',
        ' https://f1-stories.gr/x', 'https://f1-stories.gr/\\x']) assert.throws(() => canonicalArticleUrl(url));
    const doc = fixture(); doc.gsc.rows[0].page = 'https://f1stories.gr/synthetic';
    assert.equal(validateEditorialInputs(doc).ok, false);
});

test('strict types, unknown fields and invalid metadata fail without exposing values', () => {
    const mutations = [
        d => { d.version = 2; }, d => { d.synthetic = 'true'; }, d => { d.secret = 'SYNTHETIC DO NOT PRINT'; },
        d => { d.gsc.rows[0].user_id = 'SYNTHETIC DO NOT PRINT'; }, d => { d.gsc.population = 'readers'; },
        d => { d.gsc.status = 'SYNTHETIC DO NOT PRINT'; },
        d => { d.site.unit = 'sessions'; }, d => { d.gsc.timezone = 'Europe/Athens'; },
        d => { d.gsc.asOf = '2026-02-30'; }, d => { d.gsc.period.end = '2026-02-30'; },
        d => { d.gsc.asOf = ['2026-10-29']; }, d => { d.gsc.period.start = ['2026-10-19']; },
        d => { d.gsc.period.start = '2026-10-26'; }, d => { d.gsc.freshness.carried = 'false'; },
        d => { d.gsc.freshness = null; }, d => { d.site = []; }, d => { d.gsc.rows = [null]; },
        d => { delete d.gsc.rows[0].country; }, d => { d.gsc.rows[0].device = 'PHONE'; },
        d => { d.gsc.rows[0].date = '2026-10-26'; }, d => { d.catalogue.rows[0].id = 'wrong'; },
        d => { d.linkGraph.rows[0].to = article('20260822G'); }
    ];
    for (const mutate of mutations) {
        const doc = fixture(); mutate(doc);
        const result = validateEditorialInputs(doc);
        assert.equal(result.ok, false, mutate.toString());
        assert.ok(!JSON.stringify(result).includes('SYNTHETIC DO NOT PRINT'));
    }
    for (const doc of [null, [], 42, 'bad']) assert.equal(validateEditorialInputs(doc).ok, false);
});

test('malformed JSON values at every input field return diagnostics without throwing', () => {
    const paths = [];
    function visit(value, parts = []) {
        for (const [key, child] of Object.entries(value)) {
            paths.push([...parts, key]);
            if (child !== null && typeof child === 'object') visit(child, [...parts, key]);
        }
    }
    visit(fixture());
    for (const parts of paths) for (const value of [null, [], {}, { toString: null, valueOf: null }, 'SYNTHETIC-invalid', 1]) {
        const doc = fixture();
        const parent = parts.slice(0, -1).reduce((node, key) => node[key], doc);
        parent[parts.at(-1)] = value;
        const result = validateEditorialInputs(doc);
        assert.equal(typeof result.ok, 'boolean', parts.join('.'));
        assert.ok(Array.isArray(result.errors) && Array.isArray(result.warnings));
    }
});

test('GSC exact property identity, page/property grain and metric ranges are enforced', () => {
    const doc = fixture();
    for (const property of ['https://f1-stories.gr', 'https://f1stories.gr/', 'sc-domain:other.example']) {
        doc.gsc.property = property;
        assert.equal(validateEditorialInputs(doc).ok, false);
    }
    doc.gsc.property = 'sc-domain:f1-stories.gr';
    assert.equal(validateEditorialInputs(doc).ok, true);
    for (const [key, value] of [['clicks', -1], ['clicks', 5], ['impressions', 2.5], ['impressions', Number.MAX_SAFE_INTEGER + 1],
        ['ctr', 25], ['ctr', NaN], ['position', 0], ['position', null]]) {
        const copy = fixture(); copy.gsc.rows[0][key] = value;
        assert.equal(validateEditorialInputs(copy).ok, false, key);
    }
    const empty = fixture(); Object.assign(empty.gsc.rows[0], { clicks: 0, impressions: 0, ctr: 0, position: null });
    assert.equal(validateEditorialInputs(empty).ok, true);
    empty.gsc.rows.push(empty.gsc.rows[0]);
    assert.equal(validateEditorialInputs(empty).ok, false);
    doc.gsc.aggregation = 'property';
    assert.equal(validateEditorialInputs(doc).ok, false);
});

test('anonymised/omitted queries and unmapped pages are valid with explicit limits', () => {
    const doc = { version: 1, synthetic: true, gsc: importSearchConsoleCsv(read('pages.csv'), options) };
    const result = validateEditorialInputs(doc);
    assert.equal(result.ok, true);
    assert.ok(result.warnings.some(w => /unmapped/.test(w)));
    assert.equal(doc.gsc.rows[0].date, null);
    assert.equal(Object.hasOwn(doc.gsc.rows[0], 'query'), false);
    doc.gsc = importSearchConsoleCsv(read('queries.csv'), options);
    assert.equal(doc.gsc.aggregation, 'property');
    assert.equal(doc.gsc.rows[0].page, null);
    assert.equal(validateEditorialInputs(doc).ok, true);
    assert.equal(joinable(descriptor(doc.gsc), descriptor(fixture().gsc)), false);
    doc.gsc.rows[0].query = null;
    assert.equal(validateEditorialInputs(doc).ok, true);
});

test('GA4 maturity, weekly carried dates, and RUM age remain explicit', () => {
    const doc = fixture(); doc.site.period.end = '2026-10-28';
    assert.equal(validateEditorialInputs(doc).ok, false);
    const carried = fixture(); carried.site.discovery.freshness.carried = false;
    assert.equal(validateEditorialInputs(carried).ok, false);
    const rum = fixture(); rum.site.rum.asOf = '2026-10-27'; rum.site.rum.period.end = '2026-10-23'; rum.site.rum.freshness.carried = true;
    assert.equal(validateEditorialInputs(rum).ok, false);
    const gsc = fixture(); gsc.gsc.period.end = '2026-10-28'; gsc.gsc.freshness.dataState = 'preliminary';
    assert.equal(validateEditorialInputs(gsc).ok, true);
    assert.ok(validateEditorialInputs(gsc).warnings.some(w => /preliminary/.test(w)));
});

test('joinable permits only identical mapped pages, final data, exact periods, timezone and property scope', () => {
    const doc = fixture(), g = descriptor(doc.gsc), s = descriptor(doc.site, doc.site.articles[0]);
    assert.equal(joinable(g, s), true);
    assert.equal(joinable({ ...g, page: article('20260227%CE%A4') }, s), true);
    for (const change of [
        { page: article('20260822J') }, { page: 'https://f1-stories.gr/unknown' },
        { period: { start: '2026-10-20', end: '2026-10-25' } }, { timezone: 'UTC' }, { status: 'NOT VERIFIED' },
        { freshness: { dataState: 'preliminary' } }, { aggregation: 'property' }, { property: 'https://other.example/' },
        { asOf: '2026-10-24' }
    ]) assert.equal(joinable({ ...g, ...change }, s), false, JSON.stringify(change));
    assert.equal(joinable(g, { ...g, property: 'sc-domain:f1-stories.gr' }), false);
    assert.equal(joinable(g, descriptor(doc.site.discovery)), false);
    assert.equal(joinable(null, s), false);
    assert.equal(joinable(g, { ...s, asOf: '2026-10-27' }), false);
    assert.equal(joinable({ ...g, date: '2026-10-19' }, s), false);
    assert.equal(joinable({ ...g, date: '2026-10-19' }, { ...g, date: '2026-10-20' }), false);
    assert.equal(joinable({ ...g, date: '2026-10-19' }, { ...g, date: '2026-10-19' }), true);
    assert.equal(joinable({ ...g, asOf: '2026-10-26' }, s), false);
});

test('unavailable is never zero; cross-instrument comparison emits WARNING without authorising it', () => {
    const doc = fixture(); doc.gsc.status = 'absent';
    assert.equal(validateEditorialInputs(doc).ok, false);
    delete doc.gsc.rows;
    assert.equal(validateEditorialInputs(doc).ok, true);
    assert.ok(validateEditorialInputs(doc).warnings.some(w => /unavailable, never zero/.test(w)));
    const comparison = fixture(); comparison.comparisons[0].operation = 'reconcile';
    assert.equal(validateEditorialInputs(comparison).ok, true);
    assert.ok(validateEditorialInputs(comparison).warnings.some(w => /must never be compared or reconciled/.test(w)));
});

test('CSV parsing handles BOM, quotes, commas, CRLF and newlines and rejects malformed CSV', () => {
    assert.deepEqual(parseCsv('\uFEFFa,b\r\n"x,""y""\nz",0\r\n'), [['a', 'b'], ['x,"y"\nz', '0']]);
    for (const csv of ['a,b\n"x,0', 'a,b\nx"y,0', 'a,b\n"x"z,0', 'a,b\nx', 'a,b\n']) assert.throws(() => parseCsv(csv));
    assert.throws(() => importSearchConsoleCsv('Pages,Clicks,Impressions,CTR,Position\nx,1,2,50%,3', options));
    assert.throws(() => importSearchConsoleCsv(read('pages.csv').replace('25%', '0,25%'), options));
    assert.equal(importSearchConsoleCsv(read('queries.csv').replace('1,4,25%,3.5', '"1,000","2,000",50%,3.5'), options).rows[0].clicks, 1000);
});

test('local writes are validated, private, exclusive, and guarded against worktree paths and symlinks', t => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'editorial-inputs-synthetic-'));
    t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
    const output = path.join(tmp, 'input.json');
    writeEditorialInputs(fixture(), output);
    assert.equal(fs.statSync(output).mode & 0o777, 0o600);
    assert.equal(JSON.parse(fs.readFileSync(output, 'utf8')).synthetic, true);
    assert.throws(() => writeEditorialInputs(fixture(), output), /EEXIST/);
    const invalid = fixture(); invalid.site.unit = 'readers';
    assert.throws(() => writeEditorialInputs(invalid, path.join(tmp, 'invalid.json')), /validation FAIL/);
    assert.equal(fs.existsSync(path.join(tmp, 'invalid.json')), false);
    const inRepo = path.join(fixtures, `temporary-synthetic-${process.pid}.json`);
    t.after(() => fs.rmSync(inRepo, { force: true }));
    assert.throws(() => writeEditorialInputs(fixture(), inRepo), /repository output refused/);
    assert.throws(() => writeEditorialInputs({ ...fixture(), synthetic: false }, inRepo, { allowRepoPath: true }), /repository output refused/);
    assert.throws(() => writeEditorialInputs(fixture(), fileURLToPath(new URL('../../../synthetic-not-fixture.json', import.meta.url)), { allowRepoPath: true }), /repository output refused/);
    fs.symlinkSync(fixtures, path.join(tmp, 'back-into-repo'));
    assert.throws(() => writeEditorialInputs(fixture(), path.join(tmp, 'back-into-repo', 'refused.json')), /repository output refused/);
    writeEditorialInputs(fixture(), inRepo, { allowRepoPath: true });
    fs.symlinkSync(output, path.join(tmp, 'existing-link.json'));
    assert.throws(() => writeEditorialInputs(fixture(), path.join(tmp, 'existing-link.json')), /EEXIST/);
    const otherWorktree = path.join(tmp, 'other-worktree');
    const nested = path.join(otherWorktree, 'private-exports');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(otherWorktree, '.git'), 'gitdir: /SYNTHETIC/unused\n');
    const linkedWorktree = path.join(tmp, 'linked-worktree');
    fs.symlinkSync(nested, linkedWorktree);
    const nonSynthetic = { ...fixture(), synthetic: false };
    for (const directory of [otherWorktree, nested, linkedWorktree]) {
        const refused = path.join(directory, 'private-inputs.json');
        assert.throws(() => writeEditorialInputs(nonSynthetic, refused), /repository output refused/);
        assert.equal(fs.existsSync(refused), false);
    }
    assert.throws(() => writeEditorialInputs(fixture(), path.join(nested, 'synthetic.json'), { allowRepoPath: true }), /repository output refused/);
    assert.equal(fs.existsSync(path.join(nested, 'synthetic.json')), false);
});

test('CLI synthetic round trip and failure output never prints queries; real imports refuse CI', t => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'editorial-cli-synthetic-'));
    t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
    const cli = fileURLToPath(new URL('../editorial-inputs-import.mjs', import.meta.url));
    const args = [cli, `--csv=${path.join(fixtures, 'queries.csv')}`, `--property=${options.property}`,
        `--start=${options.start}`, `--end=${options.end}`, `--as-of=${options.asOf}`, '--search-type=web',
        '--synthetic', `--output=${path.join(tmp, 'output.json')}`];
    const env = { ...process.env }; delete env.CI; delete env.GITHUB_ACTIONS;
    const result = spawnSync(process.execPath, args, { env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PASS/);
    assert.ok(!result.stdout.includes('query'));
    assert.equal(validateEditorialInputs(JSON.parse(fs.readFileSync(path.join(tmp, 'output.json'), 'utf8'))).ok, true);
    const failure = spawnSync(process.execPath, [...args, '--unknown=SYNTHETIC-PRIVATE'], { env, encoding: 'utf8' });
    assert.equal(failure.status, 1);
    assert.ok(!failure.stderr.includes('SYNTHETIC-PRIVATE'));
    const ci = spawnSync(process.execPath, args, { env: { ...env, CI: 'true' }, encoding: 'utf8' });
    assert.equal(ci.status, 1);
});
