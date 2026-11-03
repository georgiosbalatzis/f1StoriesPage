import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockProvider } from '../newsletter-preview/mock-provider.mjs';
import { route } from '../newsletter-preview/server.mjs';

const origin = 'http://127.0.0.1:1234';
const request = (ctx, url, data) => route({ method: 'POST', url, headers: { host: '127.0.0.1:1234', origin, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(data) }, ctx);
test('signup, confirmation and unsubscribe stay in memory', async () => {
    const provider = createMockProvider(); const ctx = { origin, provider };
    const signup = await request(ctx, '/mock/signup', { email: 'reader@example.com', consent: true });
    assert.equal(JSON.parse(signup.body).result, 'neutral');
    const duplicate = await request(ctx, '/mock/signup', { email: 'reader@example.com', consent: true });
    const suppressed = await request(ctx, '/mock/signup', { email: 'suppressed@example.com', consent: true });
    assert.deepEqual(duplicate, signup); assert.deepEqual(suppressed, signup);
    assert.equal(provider.outbox.length, 1);
    await request(ctx, '/mock/confirm', { token: provider.outbox[0].id });
    assert.equal(provider.state('reader@example.com'), 'active');
    await request(ctx, '/mock/manage', { token: provider.outbox[1].id });
    await request(ctx, '/mock/unsubscribe', { token: provider.outbox[1].id });
    assert.equal(provider.state('reader@example.com'), 'unsubscribed');
});
test('errors and invalid input do not reveal membership', async () => {
    const provider = createMockProvider({ rateLimit: { max: 3 } }); const ctx = { origin, provider };
    assert.equal(JSON.parse((await request(ctx, '/mock/signup', { email: '', consent: false })).body).result, 'invalid');
    for (const email of ['error@example.com', 'malformed@example.com', 'other@example.com']) {
        const result = JSON.parse((await request(ctx, '/mock/signup', { email, consent: true })).body).result;
        assert.equal(result, email === 'other@example.com' ? 'neutral' : 'unknown');
    }
    assert.equal(JSON.parse((await request(ctx, '/mock/signup', { email: 'another@example.com', consent: true })).body).result, 'unknown');
    await assert.rejects(provider.adapter.submit({ email: 'person@unreserved.com' }, { signal: new AbortController().signal }), { code: 'non-synthetic-address' });
    const controller = new AbortController(); const pending = createMockProvider().adapter.submit({ email: 'timeout@example.com' }, { signal: controller.signal }); controller.abort(); await assert.rejects(pending);
});
