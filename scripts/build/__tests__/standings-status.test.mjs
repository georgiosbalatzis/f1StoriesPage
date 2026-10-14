import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../../standings/standings.js', import.meta.url), 'utf8');
const statusFunction = source.slice(source.indexOf('function setStandingsDataStatus('), source.indexOf('\nfunction renderStandingsPayload('));

test('standings status names the API source without claiming live telemetry', () => {
    const label = { textContent: '' };
    const dot = { hidden: false };
    const context = vm.createContext({ standingsDataStatus: label, standingsLiveDot: dot,
        latestStandingsMeta: { updatedAt: '2026-10-12T11:47:19.822Z', source: 'Jolpica F1' },
        formatEditorialDate: () => '12 Οκτ 2026' });
    vm.runInContext(statusFunction, context);
    for (const [state, api, expected] of [
        ['live', undefined, 'Jolpica F1'], ['live', 'OpenF1', 'OpenF1'],
        ['snapshot', undefined, 'Στιγμιότυπο 12 Οκτ 2026'],
        ['stale', undefined, 'Στιγμιότυπο 12 Οκτ 2026'], ['error', undefined, 'Χωρίς δεδομένα']
    ]) {
        context.state = state; context.api = api;
        vm.runInContext('setStandingsDataStatus(state, api)', context);
        assert.equal(label.textContent, expected);
        assert.equal(dot.hidden, true);
    }
});

test('primary standings refresh keeps the factual source in its metadata', async () => {
    let metadata;
    const context = vm.createContext({ fetchPrimaryStandings: () => Promise.resolve({ driverStandings: {}, constructorStandings: {} }),
        renderStandingsPayload: (_drivers, _constructors, meta) => { metadata = meta; } });
    const refreshFunction = source.slice(source.indexOf('function renderPrimaryStandings('), source.indexOf('\nfunction loadStandingsSnapshot('));
    vm.runInContext(refreshFunction, context);
    await vm.runInContext('renderPrimaryStandings(false)', context);
    assert.equal(metadata.source, 'Jolpica F1');
    assert.equal(metadata.live, true);
});
