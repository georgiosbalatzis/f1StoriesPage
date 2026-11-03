const ADAPTER_METHODS = Object.freeze(['submit', 'preferences', 'unsubscribe']);

// Provider contract: submit(request, { signal }) returns a publicSignupResult kind;
// preferences(authorization, update, { signal }) and unsubscribe(authorization, { signal }) return a managementResult kind.
// Authorization is an opaque provider-verified handle, never an email lookup.
function assertAdapter(adapter) {
    if (!adapter || ADAPTER_METHODS.some(method => typeof adapter[method] !== 'function')) {
        throw new Error('newsletter: invalid adapter');
    }
}

function createDisabledAdapter() {
    const disabled = () => Promise.reject(Object.assign(new Error('newsletter-disabled'), { code: 'newsletter-disabled' }));
    return Object.fromEntries(ADAPTER_METHODS.map(method => [method, disabled]));
}

module.exports = { ADAPTER_METHODS, assertAdapter, createDisabledAdapter };
