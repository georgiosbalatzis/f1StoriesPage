import test from 'node:test';
import assert from 'node:assert/strict';
import { setTrustedHtml } from '../rendering.js';

test('warm tyre tabs retain the chart; changed sessions, retry and replaced content still render', async () => {
    const storage = new Map();
    const requests = [];
    let writes = 0;
    const target = {
        firstElementChild: null,
        addEventListener() {},
        set innerHTML(html) { writes++; this.firstElementChild = { html }; }
    };
    globalThis.document = { getElementById: id => id === 'tyre-pace-table' ? target : null };
    globalThis.window = { setTimeout, clearTimeout, sessionStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key)
    } };
    const sessions = [1, 2].map(session_key => ({ session_key, session_type: 'Race', session_name: 'Race',
        date_start: '2026-01-01T12:00:00Z', date_end: '2026-01-01T14:00:00Z', location: `Circuit ${session_key}` }));
    globalThis.fetch = async value => {
        const url = new URL(value, 'https://test.invalid/standings/');
        requests.push(url.href);
        const session_key = Number(url.searchParams.get('session_key'));
        let data;
        if (url.pathname.endsWith('/sessions')) data = sessions;
        else if (url.pathname.endsWith('/drivers')) data = [{ session_key, driver_number: 4, full_name: 'Lando NORRIS', name_acronym: 'NOR', team_name: 'McLaren' }];
        else if (url.pathname.endsWith('/laps')) data = [2, 3, 4].map(lap_number => ({ session_key, driver_number: 4, lap_number, lap_duration: 90 + lap_number }));
        else if (url.pathname.endsWith('/stints')) data = [{ session_key, driver_number: 4, stint_number: 1, lap_start: 1, lap_end: 5, compound: 'MEDIUM' }];
        else data = {};
        return { ok: true, json: async () => data };
    };
    const mod = await import('../../tabs/tyre-pace.js');
    let renders = 0;
    mod.initTyrePace({ onRendered: () => { renders++; } });
    const settle = async expected => {
        for (let i = 0; i < 100 && renders < expected; i++) await new Promise(resolve => setTimeout(resolve, 1));
        assert.equal(renders, expected);
        await new Promise(resolve => setImmediate(resolve));
    };
    mod.ensureLoaded();
    await settle(1);
    assert.equal(mod.getSelectedSession(), '2');
    assert.match(target.firstElementChild.html, /Circuit 2/);
    const first = target.firstElementChild, initialWrites = writes, initialRequests = requests.length;
    mod.ensureLoaded();
    assert.equal(renders, 2, 'onRendered still runs to synchronize URL and embeds');
    assert.equal(target.firstElementChild, first, 'keep the actual chart and its scroll state');
    assert.equal(writes, initialWrites);
    assert.equal(requests.length, initialRequests);

    mod.setSelectedSession('1');
    await settle(3);
    assert.match(target.firstElementChild.html, /Circuit 1/);
    mod.setSelectedSession('2');
    assert.equal(renders, 4);
    assert.match(target.firstElementChild.html, /Circuit 2/);
    assert.notEqual(target.firstElementChild, first);

    const second = target.firstElementChild;
    setTrustedHtml(target, '<p>Replaced by a loading/error state</p>', 'unit-test replaced chart');
    mod.ensureLoaded();
    assert.equal(renders, 5);
    assert.match(target.firstElementChild.html, /tyre-pace-chart-scroll/);
    assert.notEqual(target.firstElementChild, second);

    const beforeRetry = target.firstElementChild;
    window.__retryTyrePace();
    await settle(6);
    assert.notEqual(target.firstElementChild, beforeRetry, 'explicit retry cannot reuse stale DOM');
    assert.match(target.firstElementChild.html, /Circuit 2/);
});
