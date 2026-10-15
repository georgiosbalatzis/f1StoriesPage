import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchJSONNoCache } from '../fetchers.js';

test('local snapshots always revalidate; provider requests still bypass the HTTP cache', async t => {
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ round: 17 }) }));
    globalThis.window = {
        location: new URL('https://f1-stories.gr/standings/'),
        setTimeout, clearTimeout
    };
    t.after(() => { delete globalThis.window; });
    for (const [url, mode] of [
        ['standings-cache.json', 'no-cache'],
        ['/standings/debrief-cache.json', 'no-cache'],
        ['https://f1-stories.gr/standings/standings-cache.json', 'no-cache'],
        ['https://api.openf1.org/v1/location?session_key=11388', 'no-store'],
        ['//api.jolpi.ca/ergast/f1/2026.json', 'no-store']
    ]) {
        assert.deepEqual(await fetchJSONNoCache(url), { round: 17 });
        const call = fetch.mock.calls.at(-1);
        assert.equal(call.arguments[0], url);
        assert.equal(call.arguments[1].cache, mode);
    }
    // No application-cache reuse is introduced: the next read still calls fetch.
    await fetchJSONNoCache('standings-cache.json');
    assert.equal(fetch.mock.callCount(), 6);
    // The existing tab lifecycle tests run with a minimal window stub.
    delete window.location;
    await fetchJSONNoCache('standings-cache.json');
    assert.equal(fetch.mock.calls.at(-1).arguments[1].cache, 'no-store');
});
