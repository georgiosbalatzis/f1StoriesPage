import test from 'node:test';
import assert from 'node:assert/strict';

test('overlapping Pit Stops season loads replace partial rankings and reuse the current render', { timeout: 3000 }, async () => {
    const firstPace = Promise.withResolvers();
    const retry = Promise.withResolvers();
    const partialRender = Promise.withResolvers();
    const finalPace = Promise.withResolvers();
    let click;
    let renders = 0;
    let earlyRoundRequests = 0;
    let paceCount = 0;
    const seasonPanel = {
        firstElementChild: null,
        set innerHTML(html) { this.firstElementChild = { html }; },
        querySelector(selector) {
            return selector === '.st-motion' && this.firstElementChild?.html.includes('st-motion') ? this.firstElementChild : null;
        }
    };
    const table = {
        addEventListener(type, handler) { if (type === 'click') click = handler; },
        querySelector(selector) { return selector === '[data-pitstop-panel="season"]' ? seasonPanel : null; },
        querySelectorAll() { return []; }
    };
    globalThis.document = { getElementById: id => id === 'pit-stops-table' ? table : null };
    globalThis.window = {
        setTimeout(callback, ms) {
            if (ms !== 120) return setTimeout(callback, ms);
            const pace = ++paceCount;
            if (pace === 1) firstPace.resolve();
            return setTimeout(() => {
                callback();
                if (pace === 4) setImmediate(finalPace.resolve);
            }, 0);
        },
        clearTimeout
    };
    const race = (round, raceName) => ({ round, raceName, date: '2020-01-01' });
    const races = [race('1', 'Opening Grand Prix'), race('2', 'Second Grand Prix')];
    globalThis.fetch = async value => {
        const pathname = new URL(value).pathname;
        let entries = races;
        if (pathname.endsWith('/pitstops.json')) {
            const opening = pathname.endsWith('/1/pitstops.json');
            if (opening && ++earlyRoundRequests === 1) return { ok: false, status: 503 };
            if (opening) await retry.promise;
            entries = [{ PitStops: [{ driverId: 'norris', duration: opening ? '20.0' : '22.0', lap: '3', stop: '1' }] }];
        } else if (pathname.endsWith('/results.json')) {
            entries = [{ Results: [{ Driver: { driverId: 'norris', code: 'NOR', familyName: 'Norris' } }] }];
        }
        return { ok: true, json: async () => ({ MRData: { RaceTable: { Races: entries } } }) };
    };
    const tab = await import('../../tabs/pit-stops.js');
    tab.initPitStops({ onRendered() {
        renders++;
        if (renders === 2) partialRender.resolve();
    } });
    const selectView = view => click({
        target: { closest: () => ({ getAttribute: () => view }) },
        stopImmediatePropagation() {}
    });

    assert.equal(await tab.ensureLoaded(), true);
    selectView('season');
    await firstPace.promise;
    selectView('race');
    selectView('season');
    await partialRender.promise;
    assert.match(seasonPanel.firstElementChild.html, /Second GP.*22\.0s/);

    retry.resolve();
    await finalPace.promise;
    assert.match(seasonPanel.firstElementChild.html, /Opening GP.*20\.0s/);
    assert.equal(earlyRoundRequests, 2);

    const current = seasonPanel.firstElementChild;
    selectView('race');
    selectView('season');
    assert.equal(seasonPanel.firstElementChild, current);
    assert.equal(renders, 3);
});
