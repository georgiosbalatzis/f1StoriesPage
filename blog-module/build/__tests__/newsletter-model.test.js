const { test } = require('node:test');
const assert = require('node:assert/strict');
const { STATES, EVENTS, transition, validateEmail, validateSignupInput, PUBLIC_RESULTS, publicSignupResult,
    requestSignup, managementResult, validatePreferenceUpdate } = require('../newsletter/model');

const options = { policyVersion: 'preview-0', sourceForm: 'local-preview' };

test('every state and event pair follows the transition table', () => {
    const allowed = {
        none: { request: 'pending', suppress: 'suppressed', erase: 'none' },
        pending: { request: 'pending', confirm: 'active', expire: 'expired', unsubscribe: 'unsubscribed', suppress: 'suppressed', erase: 'none' },
        active: { request: 'active', unsubscribe: 'unsubscribed', suppress: 'suppressed', erase: 'none' },
        expired: { request: 'pending', suppress: 'suppressed', erase: 'none' },
        unsubscribed: { request: 'pending', suppress: 'suppressed', erase: 'none' },
        suppressed: { request: 'suppressed', suppress: 'suppressed', erase: 'suppressed' }
    };
    assert.ok(Object.isFrozen(STATES) && Object.isFrozen(EVENTS));
    for (const state of STATES) for (const event of EVENTS) {
        if (allowed[state][event]) assert.equal(transition(state, event), allowed[state][event]);
        else assert.throws(() => transition(state, event), { code: 'invalid-transition' });
    }
    assert.throws(() => transition('bad', 'request'), { code: 'unknown-state' });
    assert.throws(() => transition('none', 'bad'), { code: 'unknown-event' });
});

test('email validation normalizes domains and rejects invalid input', () => {
    assert.deepEqual(validateEmail('  Test@EXAMPLE.COM  '), { ok: true, email: 'Test@example.com' });
    for (const value of [null, 1, '', '  ']) assert.equal(validateEmail(value).code, 'email-missing');
    assert.equal(validateEmail(`${'a'.repeat(243)}@example.com`).code, 'email-too-long');
    for (const value of ['a', '@example.com', 'a@@example.com', `${'a'.repeat(65)}@example.com`, 'a b@example.com',
        'a\n@example.com', 'a<@example.com', 'a\\b@example.com', 'a@example', 'a@-example.com', 'a@example-.com',
        'a@example.c', 'a@example.123', 'a@example..com']) assert.equal(validateEmail(value).code, 'email-invalid', value);
});

test('signup requires explicit consent and reports both fields', () => {
    for (const consent of [false, 'on', 1, 'true', null]) {
        assert.deepEqual(validateSignupInput({ email: '', consent }, options).errors,
            [{ field: 'email', code: 'email-missing' }, { field: 'consent', code: 'consent-required' }]);
    }
    assert.deepEqual(validateSignupInput({ email: ' A@EXAMPLE.ORG ', consent: true }, options), {
        ok: true, request: { email: 'A@example.org', consent: { newsletter: 'weekly-briefing', ...options } }
    });
    for (const invalid of [{ policyVersion: '', sourceForm: 'x' }, { policyVersion: 'x', sourceForm: ' ' }]) {
        assert.throws(() => validateSignupInput({}, invalid));
    }
});

test('public and management outcomes do not reveal membership', () => {
    assert.deepEqual(PUBLIC_RESULTS, ['neutral', 'unknown']);
    for (const kind of ['accepted', 'duplicate', 'pending', 'active', 'suppressed']) assert.equal(publicSignupResult({ kind }), 'neutral');
    for (const value of [null, {}, { kind: 'rate-limited' }, { kind: 'timeout' }, { kind: 'error' }, { kind: 'malformed' }, { kind: 'disabled' }, { kind: 'other' }]) assert.equal(publicSignupResult(value), 'unknown');
    assert.equal(managementResult({ kind: 'updated' }), 'updated');
    for (const kind of ['invalid-authorization', 'expired-authorization']) assert.equal(managementResult({ kind }), 'neutral');
    assert.equal(managementResult(null), 'unknown');
});

test('signup calls the adapter once only after validation and fails closed', async () => {
    let calls = 0;
    const adapter = { submit: async (request, { signal }) => { calls++; assert.equal(request.email, 'a@example.com'); assert.ok(signal instanceof AbortSignal); return { kind: 'accepted' }; } };
    assert.equal((await requestSignup(adapter, { email: '', consent: false }, options)).result, 'invalid');
    assert.equal(calls, 0);
    assert.deepEqual(await requestSignup(adapter, { email: 'a@example.com', consent: true }, options), { result: 'neutral' });
    assert.equal(calls, 1);
    const input = { email: 'a@example.com', consent: true };
    assert.deepEqual(await requestSignup({ submit() { throw new Error('failure'); } }, input, options), { result: 'unknown' });
    assert.deepEqual(await requestSignup({ submit(request, { signal }) { return new Promise(resolve => signal.addEventListener('abort', () => resolve({ kind: 'timeout' }))); } }, input, { ...options, timeoutMs: 5 }), { result: 'unknown' });
    assert.deepEqual(await requestSignup({ submit: () => new Promise(() => {}) }, input, { ...options, timeoutMs: 5 }), { result: 'unknown' });
});

test('preferences only allow unsubscribe', () => {
    assert.deepEqual(validatePreferenceUpdate({ briefing: false }), { ok: true, update: { briefing: false } });
    assert.equal(validatePreferenceUpdate({ briefing: true }).errors[0].code, 'resubscribe-requires-consent');
    for (const value of [null, {}, { briefing: 'false' }, { briefing: false, extra: true }, []]) assert.equal(validatePreferenceUpdate(value).errors[0].code, 'preference-unknown');
});
