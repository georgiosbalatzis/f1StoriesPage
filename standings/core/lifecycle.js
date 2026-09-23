// Shared tab-loading lifecycle for standings modules.
//
// Keeps the common "only one load at a time, render controlled loading/error
// states, then clear loading" path outside individual analysis tabs.

import { setTrustedHtml } from './rendering.js';

export function runExclusiveLoad(state, options) {
    const config = options || {};
    if (!state || typeof state !== 'object') {
        return Promise.reject(new Error('runExclusiveLoad requires a mutable state object.'));
    }
    if (state.loading) {
        if (config.queueWhileLoading) state.pendingReload = true;
        return Promise.resolve(false);
    }
    if (typeof config.load !== 'function') {
        return Promise.reject(new Error('runExclusiveLoad requires a load function.'));
    }

    state.loading = true;
    state.pendingReload = false;

    if (config.target && config.loadingHTML) {
        setTrustedHtml(
            config.target,
            config.loadingHTML,
            config.loadingReason || config.reason || 'standings tab loading state'
        );
    }
    if (typeof config.onStart === 'function') config.onStart();

    return Promise.resolve()
        .then(config.load)
        .then(function(result) {
            if (typeof config.onSuccess === 'function') return config.onSuccess(result);
            return result;
        })
        .catch(function(error) {
            if (typeof config.onError === 'function') return config.onError(error);
            throw error;
        })
        .finally(function() {
            state.loading = false;
            if (state.pendingReload && typeof config.onPendingReload === 'function') {
                state.pendingReload = false;
                config.onPendingReload();
            }
        });
}
