import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cases } from './fixtures/evaluation-2026-10.mjs';
import { sections, validateInput, validateSchema } from '../schema.mjs';
import { demoDossier } from '../fixtures.mjs';
import { retrievedEvidence, validateEvidence } from '../evidence.mjs';

const rawFor = c => ({ scope: c.input.question, ...Object.fromEntries(Object.keys(sections).map(k => [k, []])),
    facts: [{ id: 'C1', text: c.claim, kind: c.id === 11 ? 'prediction' : 'source_report', sourceIds: ['S1'], statistic: null }],
    sources: c.sources.map(({ id, url, publicationDate }) => ({ id, url, title: 'Synthetic source', publicationDate })), limitations: [], outline: [] });
const envelope = (raw, annotations = []) => ({ output: [
    { type: 'web_search_call', status: 'completed', action: { type: 'search', sources: raw.sources.map(s => ({ url: s.url, title: s.title })) } },
    { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(raw), annotations }] },
] });
const evidence = response => retrievedEvidence(response, '2026-10-29T00:00:00Z');
const finding = d => [...d.facts, ...d.unverified, ...d.contradictions][0];

test('fixed set: DEMO abstains and synthetic provider claims are demoted without any network calls', () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = () => { calls++; throw new Error('Network forbidden'); };
    try {
        for (const c of cases) {
            validateInput(c.input);
            const before = structuredClone(c);
            const demo = demoDossier(c.input);
            assert.equal(demo.dossier.sources.length, 0);
            assert.equal(demo.dossier.unverified.length, 1);
            assert.match(demo.dossier.unverified[0].text, /Ανεπαρκή στοιχεία/);
            assert.equal(demo.usage.searchToolCalls, 0);
            const raw = rawFor(c), result = validateEvidence(raw, evidence(envelope(raw)));
            assert.equal(result.facts.length, 0);
            assert.equal(finding(result).verification, c.expected.verification);
            assert.equal(result.validation.demotedClaims, 1);
            assert.deepEqual(c, before);
        }
        assert.equal(calls, 0);
    } finally { globalThis.fetch = originalFetch; }
});

test('schema labels, provenance matrix and exact citation association', () => {
    const raw = rawFor(cases[0]);
    const invalid = [ { ...raw, extra: true }, { ...raw, sources: null }, { ...raw, facts: [{ ...raw.facts[0], kind: 'verified' }] }, { ...raw, scope: '' } ];
    for (const c of cases) assert.doesNotThrow(() => validateSchema(rawFor(c)));
    for (const bad of invalid) assert.throws(() => validateSchema(bad));
    // Independent expected provenance labels: two present records, three invented or disallowed references.
    for (const [url, id, accepted] of [[raw.sources[0].url, 'S1', true], [raw.sources[0].url, 'S1', true],
        [raw.sources[0].url + '/invented', 'S1', false], ['https://evil.test/x', 'S1', false], [raw.sources[0].url, 'missing', false]]) {
        const candidate = structuredClone(raw); candidate.sources[0].url = url; candidate.facts[0].sourceIds = [id];
        const out = validateEvidence(candidate, evidence(envelope(raw)));
        assert.equal(finding(out).sourceIds.length > 0, accepted);
    }
    const text = JSON.stringify(raw), start = text.indexOf(JSON.stringify(raw.facts[0].text));
    const base = { type: 'url_citation', url: raw.sources[0].url, start_index: start + 1, end_index: start + 2 };
    for (const [annotation, expected] of [[base, 'provider_citation'], [{ ...base, start_index: 0, end_index: 1 }, 'model_reference_only'],
        [{ ...base, end_index: text.length + 1 }, 'model_reference_only'], [{ ...base, start_index: '1' }, 'model_reference_only']]) {
        const result = validateEvidence(raw, evidence(envelope(raw, [annotation])));
        assert.equal(finding(result).association, expected);
        assert.equal(finding(result).verification, 'unverified');
    }
});

test('fixture dates, scope limitation and contradiction retention are distinct from support', () => {
    const c = cases[7], raw = rawFor(c);
    const record = { ...c.sources[0], publisher: 'Pirelli', retrievedAt: '2026-10-29', provenance: 'fixture', via: ['synthetic'], inspectedClaims: [c.claim] };
    const promoted = validateEvidence(raw, { records: [record], annotations: [] }, { demo: true });
    // Demonstrates the unsafe outcome if a mis-scoped fixture is incorrectly marked inspected.
    assert.equal(finding(promoted).verification, 'fixture_inspected');
    assert.equal(c.proposed, 'out-of-scope');
    assert.equal(promoted.sources[0].publicationDate, null);
    const datedCase = cases[0], datedRaw = rawFor(datedCase);
    const datedRecord = { ...datedCase.sources[0], publisher: 'Formula 1', retrievedAt: '2026-10-29', provenance: 'fixture', via: ['synthetic'], inspectedClaims: [datedCase.claim] };
    assert.equal(validateEvidence(datedRaw, { records: [datedRecord], annotations: [] }, { demo: true }).sources[0].publicationDate, '2023-11-26');
    assert.equal(validateEvidence(datedRaw, evidence(envelope(datedRaw))).sources[0].publicationDate, null);
    const conflict = rawFor(cases[2]);
    conflict.facts = [];
    conflict.contradictions = [{ id: 'C2', text: 'Το γλωσσάρι αναφέρει 12 λεπτά και ο οδηγός 13 λεπτά· η διαφορά παραμένει ανεπίλυτη.', kind: 'source_report', sourceIds: ['S1', 'S2'], statistic: null }];
    const out = validateEvidence(conflict, evidence(envelope(conflict)));
    assert.equal(out.contradictions.length, 1);
    assert.equal(out.contradictions[0].verification, 'unverified');
    assert.match(out.contradictions[0].text, /12.*13/);
    const undiscovered = rawFor(cases[2]);
    assert.equal(validateEvidence(undiscovered, evidence(envelope(undiscovered))).contradictions.length, 0);
});
