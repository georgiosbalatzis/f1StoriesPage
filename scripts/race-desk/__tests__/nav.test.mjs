import test from 'node:test';
import assert from 'node:assert/strict';
import { createRaceDeskNavigation } from '../../../standings/core/race-desk-nav.js';
import projection from '../../../standings/core/race-desk-links.generated.js';

function fixture(data = projection) {
    const links = Object.fromEntries(['tyres', 'telemetry', 'ghostcar'].map(name => {
        let href = `initial-${name}`;
        return [name, { getAttribute: () => href, setAttribute: (_, value) => { href = value; } }];
    }));
    const tyresNotice = { textContent: 'initial tyres' }, openf1Notice = { textContent: 'initial openf1' };
    const controller = createRaceDeskNavigation({ links, tyresNotice, openf1Notice, projection: data });
    const state = () => ({ hrefs: Object.fromEntries(Object.entries(links).map(([key, el]) => [key, el.getAttribute('href')])), tyres: tyresNotice.textContent, openf1: openf1Notice.textContent });
    return { controller, state };
}
const snap = (tab, scopes, extra = {}) => ({ tab, scopes, nativeYear: 2026, embed: false, ...extra });

test('factory and embed mode leave links and notices untouched', () => {
    const { controller, state } = fixture();
    const initial = state();
    controller.update(snap('drivers', { drivers: { season: 2026, round: 3 } }, { embed: true }));
    assert.deepEqual(state(), initial);
});

test('uses only the accepted active standings scope and precomputed links', () => {
    const { controller, state } = fixture();
    const scopes = { drivers: { season: '2026', round: '3' }, constructors: { season: 2026, round: 16 } };
    controller.update(snap('drivers', scopes));
    assert.equal(state().hrefs.tyres, 'https://f1-stories.gr/tyres/2026/suzuka/');
    assert.equal(state().tyres, 'Στο TYRES μεταφέρεται ο αγώνας Japanese Grand Prix.');
    assert.equal(state().hrefs.telemetry, projection.generic.telemetry.url);
    assert.equal(state().hrefs.ghostcar, projection.generic.ghostcar.url);
    controller.update(snap('constructors', scopes));
    assert.equal(state().hrefs.tyres, 'https://f1-stories.gr/tyres/2026/sepang/');
    assert.equal(state().tyres, 'Στο TYRES μεταφέρεται ο αγώνας Bahrain Grand Prix in Malaysia.');
    assert.match(state().openf1, /θα επιλέξεις αγώνα/);
});

test('unknown, stale, invalid, or non-standings scopes use generic links', () => {
    const { controller, state } = fixture();
    const scope = { season: 2026, round: 3 };
    const cases = [
        snap('quali-gaps', { drivers: scope }), snap('drivers', {}), snap('drivers', { drivers: null }),
        snap('drivers', { drivers: { ...scope, round: 31 } }), snap('drivers', { drivers: { ...scope, round: '00003' } }),
        snap('drivers', { drivers: { ...scope, season: '02026' } }), snap('drivers', { drivers: { ...scope, season: '2e3' } }),
        snap('drivers', { drivers: { ...scope, round: 2 } }), snap('drivers', { drivers: scope }, { nativeYear: 2027 }),
    ];
    for (const value of cases) {
        controller.update(snap('drivers', { drivers: scope }));
        controller.update(value);
        assert.deepEqual(state().hrefs, Object.fromEntries(Object.entries(projection.generic).map(([key, plan]) => [key, plan.url])));
        assert.equal(state().tyres, 'Στο TYRES θα επιλέξεις αγώνα μέσα στο εργαλείο.');
    }
});

test('embed updates preserve a previously rendered state and updates are idempotent', () => {
    const { controller, state } = fixture();
    const value = snap('drivers', { drivers: { season: 2026, round: 3 } });
    controller.update(value);
    const selected = state();
    controller.update(value);
    assert.deepEqual(state(), selected);
    controller.update(snap('constructors', {}, { embed: true }));
    assert.deepEqual(state(), selected);
});

test('ambiguous projection matches do not select a race', () => {
    const data = structuredClone(projection);
    data.rounds.push(structuredClone(data.rounds[0]));
    const { controller, state } = fixture(data);
    controller.update(snap('drivers', { drivers: { season: 2026, round: 3 } }));
    assert.equal(state().hrefs.tyres, data.generic.tyres.url);
});


test('disabled deployment leaves original legacy links and notices untouched', () => {
    const legacy = {
        tyres: 'https://georgiosbalatzis.github.io/Tyres/',
        telemetry: 'https://georgiosbalatzis.github.io/f1-telemetry-dashboard/',
        ghostcar: 'https://georgiosbalatzis.github.io/ghostcar/',
    };
    const links = Object.fromEntries(Object.entries(legacy).map(([key, href]) => [key, {
        getAttribute: () => href,
        setAttribute: () => assert.fail('disabled controller must not change links'),
    }]));
    const tyresNotice = { textContent: 'original tyres notice' };
    const openf1Notice = { textContent: 'original OpenF1 notice' };
    for (const enabled of [false, undefined, 'true']) {
        const controller = createRaceDeskNavigation({ links, tyresNotice, openf1Notice, projection: { ...projection, enabled } });
        controller.update(snap('drivers', { drivers: { season: 2026, round: 3 } }));
        assert.deepEqual(Object.fromEntries(Object.entries(links).map(([key, el]) => [key, el.getAttribute('href')])), legacy);
        assert.equal(tyresNotice.textContent, 'original tyres notice');
        assert.equal(openf1Notice.textContent, 'original OpenF1 notice');
    }
});

test('scope parsing follows native pin grammar without using its season fallback', () => {
    const { controller, state } = fixture();
    for (const [season, round] of [['2026', '0003'], [' 2026 ', ' 3 '], [2026, 3]]) {
        controller.update(snap('drivers', { drivers: { season, round } }));
        assert.equal(state().hrefs.tyres, 'https://f1-stories.gr/tyres/2026/suzuka/');
    }
    for (const [season, round] of [['2023', '3'], ['2028', '3'], ['02026', '3'], ['2026', '00003'], ['2026', '0'], ['2026', '31']]) {
        controller.update(snap('drivers', { drivers: { season, round } }));
        assert.equal(state().hrefs.tyres, projection.generic.tyres.url, `${season}/${round}`);
    }
});

test('malformed or inherited scope fields safely use generic links', () => {
    const { controller, state } = fixture();
    const throwsOnConversion = { toString() { throw new Error('must not coerce objects'); } };
    const cases = [
        { season: throwsOnConversion, round: 3 }, { season: 2026, round: throwsOnConversion },
        { season: [2026], round: 3 }, { season: 2026, round: [3] },
        Object.assign(Object.create({ season: 2026 }), { round: 3 }),
        Object.assign(Object.create({ round: 3 }), { season: 2026 }),
        [2026, 3], null,
    ];
    for (const value of cases) {
        assert.doesNotThrow(() => controller.update(snap('drivers', { drivers: value })));
        assert.equal(state().hrefs.tyres, projection.generic.tyres.url);
    }
    controller.update(snap('drivers', Object.create({ drivers: { season: 2026, round: 3 } })));
    assert.equal(state().hrefs.tyres, projection.generic.tyres.url);
});
