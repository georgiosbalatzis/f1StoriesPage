const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ADAPTER_METHODS, assertAdapter, createDisabledAdapter } = require('../newsletter/adapter');

test('adapter requires all methods', () => {
    assert.deepEqual(ADAPTER_METHODS, ['submit', 'preferences', 'unsubscribe']);
    assert.ok(Object.isFrozen(ADAPTER_METHODS));
    assert.throws(() => assertAdapter(null));
    for (const method of ADAPTER_METHODS) {
        const adapter = createDisabledAdapter();
        delete adapter[method];
        assert.throws(() => assertAdapter(adapter));
    }
    assert.doesNotThrow(() => assertAdapter(createDisabledAdapter()));
});

test('disabled adapter rejects without examining arguments', async () => {
    const argument = new Proxy({}, { get() { throw new Error('argument accessed'); }, ownKeys() { throw new Error('argument accessed'); } });
    const adapter = createDisabledAdapter();
    for (const method of ADAPTER_METHODS) await assert.rejects(adapter[method](argument, argument, argument), { code: 'newsletter-disabled' });
});
