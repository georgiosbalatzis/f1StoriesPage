import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const context = vm.createContext({ window: {}, URL, Date });
vm.runInContext(fs.readFileSync(path.join(root, 'scripts/author/research-assistant.js'), 'utf8'), context);
const api = context.window.F1S_RESEARCH;
const cases = JSON.parse(fs.readFileSync(path.join(root, 'scripts/author/__tests__/fixtures/editorial-preflight-cases.json')));
const clone = value => JSON.parse(JSON.stringify(value));

test('30 labeled published passages have exact advisory sets', () => {
    let emitted = 0, matched = 0, falsePositives = 0, misses = 0, negativeAffected = 0;
    assert.equal(cases.length, 30);
    for (const item of cases) {
        const html = fs.readFileSync(path.join(root, `blog-module/blog-entries/${item.article}/article.html`), 'utf8');
        const body = html.split('\n')[item.line - 1].replace(/<[^>]*>/g, '').trim();
        assert.ok(body, item.label);
        const numeric = !['insufficient', 'ambiguous'].includes(item.fault) && !(item.article === '20261024J');
        const claim = { id: '12345678-1234-4123-8123-123456789abc', text: body, anchor: { quote: body, prefix: '', suffix: '', start: 0, end: body.length }, claimType: 'official-fact', status: 'unreviewed', sources: [{ title: 'Synthetic', url: 'https://example.com/source', locator: { kind: 'page', value: '1' }, sourceDate: '', excerpt: '', independenceKey: 'synthetic', stance: 'supports' }], scope: { event: 'Synthetic', season: '2026', round: '1', session: 'race', period: { start: '', end: '' } }, numeric: numeric ? { metric: 'metric', value: '120', units: 'laps', sample: 'sample', method: 'method', originalValues: [{ label: 'value', value: '120' }] } : null, review: null };
        let checked = clone(api.assessClaim(claim, 'reviewed-with-evidence', 'Synthetic review', ''));
        let content = body;
        if (item.variant === 'fault') {
            switch (item.fault) {
            case 'unreviewed': checked.status = 'unreviewed'; checked.review = null; break;
            case 'season': checked.scope.season = ''; break;
            case 'operand': checked.numeric.originalValues[0].value = '121'; break;
            case 'sample': checked.numeric.sample = ''; break;
            case 'method': checked.numeric.method = ''; break;
            case 'disputed': checked.status = 'disputed'; checked.sources[0].stance = 'contradicts'; checked.review = null; break;
            case 'insufficient': checked.status = 'insufficient'; checked.review = null; break;
            case 'ambiguous': content = body + ' / ' + body; checked.anchor.start = 99999; checked.anchor.end = 99999 + body.length; break;
            case 'decimal': checked.numeric.value = '0,250'; checked.status = 'unreviewed'; checked.review = null; break;
            }
        }
        const actual = clone(api.claimIssues({ claims: item.variant === 'no-ledger' ? [] : [checked] }, content)).map(x => x.code).sort();
        const expected = item.expected.slice().sort();
        emitted += actual.length; matched += actual.filter(x => expected.includes(x)).length;
        falsePositives += actual.filter(x => !expected.includes(x)).length; misses += expected.filter(x => !actual.includes(x)).length;
        if (!expected.length && actual.length) negativeAffected++;
        assert.deepEqual(actual, expected, item.label);
    }
    assert.equal(matched / emitted, 1); assert.equal(falsePositives, 0); assert.equal(misses, 0); assert.equal(negativeAffected, 0);
});

test('independent mechanical issues coexist and numbers outside the ledger are ignored', () => {
    assert.equal(api.claimIssues(null, '2026 120 0,250').length, 0);
    const claim = { id: 'x', text: '', anchor: null, status: 'unreviewed', sources: [], scope: { event: '', season: '', round: '', session: '', period: { start: '', end: '' } }, numeric: null, review: null };
    assert.deepEqual(clone(api.claimIssues({ claims: [claim] }, '')).map(x => x.code), ['claim-incomplete', 'claim-anchor', 'scope-missing', 'evidence-unresolved']);
});
