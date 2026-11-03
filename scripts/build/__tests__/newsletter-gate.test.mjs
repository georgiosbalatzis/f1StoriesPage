import test from 'node:test';
import assert from 'node:assert/strict';
import { EVIDENCE_KEYS, loadNewsletterConfig, validateNewsletterConfig } from '../newsletter-gate.mjs';

const codes = config => validateNewsletterConfig(config).errors.map(error => error.code);
test('default config is disabled and valid', () => {
    assert.deepEqual(codes(loadNewsletterConfig()), []);
    assert.equal(loadNewsletterConfig.length, 0);
    assert.ok(Object.isFrozen(EVIDENCE_KEYS));
});
test('strict shapes and values fail closed', () => {
    for (const mutate of [c => delete c.version, c => { c.extra = 1; }, c => { c.version = 2; }, c => { c.enabled = 'false'; }, c => { c.provider = {}; }, c => { c.review.status = 'other'; }, c => delete c.evidence[EVIDENCE_KEYS[0]], c => { c.evidence[EVIDENCE_KEYS[0]] = { status: 'open', extra: 1 }; }, c => { c.evidence[EVIDENCE_KEYS[0]] = { status: 'other' }; }]) {
        const config = structuredClone(loadNewsletterConfig()); mutate(config); assert.notDeepEqual(codes(config), []);
    }
});
test('enabled cannot pass, even with complete evidence', () => {
    const c = loadNewsletterConfig(); c.enabled = true;
    assert.equal(codes(c).filter(code => code === 'evidence-open').length, EVIDENCE_KEYS.length);
    assert.ok(codes(c).includes('provider-required'));
    assert.ok(codes(c).includes('review-required'));
    c.provider = { id: 'mock', name: 'Mock' }; c.review.status = 'approved';
    for (const key of EVIDENCE_KEYS) c.evidence[key] = { status: 'complete', by: 'Owner', date: '2020-01-01', reference: 'record 1' };
    assert.deepEqual(codes(c), ['production-adapter-unavailable']);
    c.enabled = false; assert.deepEqual(codes(c), []);
    for (const patch of [{ by: 'SYNTHETIC TEST' }, { date: '9999-01-01' }, { date: '2024-02-30' }, { reference: 'https://example.com/?x=1' }, { reference: 'a@example.com' }]) {
        const copy = structuredClone(c); Object.assign(copy.evidence[EVIDENCE_KEYS[0]], patch); assert.ok(codes(copy).includes('invalid-evidence'));
    }
});
