import assert from 'node:assert/strict';
import { jolpicaRoundUrls, loadPinnedStandings, parseRoundPin, roundSnapshotUrl } from '../rounds.js';

// URL parsing
assert.deepEqual(parseRoundPin('?tab=drivers&embed=1&season=2026&round=4', 2026), { season: '2026', round: '4' });
assert.deepEqual(parseRoundPin('?round=12', 2026), { season: '2026', round: '12' }, 'season defaults to the current year');
assert.deepEqual(parseRoundPin('?round=3&season=1999', 2026), { season: '2026', round: '3' }, 'out-of-range season falls back');
assert.deepEqual(parseRoundPin('?round=3&season=2027', 2026), { season: '2027', round: '3' }, 'next season is allowed');
for (const bad of ['', '?round=0', '?round=31', '?round=abc', '?round=-2', '?round=4.5', '?round=']) {
    assert.equal(parseRoundPin(bad, 2026), null, bad || '(empty)');
}
assert.equal(roundSnapshotUrl('2026', '4'), 'rounds/2026-4.json');
assert.deepEqual(jolpicaRoundUrls('https://j.example/f1', '2026', '4'), {
    drivers: 'https://j.example/f1/2026/4/driverstandings.json?limit=30',
    constructors: 'https://j.example/f1/2026/4/constructorstandings.json?limit=30',
    race: 'https://j.example/f1/2026/4.json'
});

// Source choice: snapshot first, Jolpica as the fallback
const standings = (season, round) => ({ MRData: { StandingsTable: { season, round, StandingsLists: [{ season, round }] } } });
const race = name => ({ MRData: { RaceTable: { Races: [{ raceName: name }] } } });
const snapshot = { raceName: 'Spanish Grand Prix', driverStandings: standings('2026', '4'), constructorStandings: standings('2026', '4') };
function makeIo(handlers) {
    const calls = [];
    return {
        calls,
        jolpicaBase: 'https://j.example/f1',
        validateSnapshot() {},
        validateStandings(payload) { return payload; },
        fetchSnapshot(url) { calls.push('snapshot:' + url); return handlers.snapshot(url); },
        fetchLive(url) { calls.push('live:' + url); return handlers.live(url); }
    };
}

{
    const io = makeIo({ snapshot: () => Promise.resolve(snapshot), live: () => Promise.reject(new Error('must not be called')) });
    const result = await loadPinnedStandings({ season: '2026', round: '4' }, io);
    assert.equal(result.source, 'snapshot');
    assert.equal(result.raceName, 'Spanish Grand Prix');
    assert.deepEqual(io.calls, ['snapshot:rounds/2026-4.json'], 'a snapshot hit makes no live request');
}
{
    const live = url => Promise.resolve(url.endsWith('/4.json') ? race('Live GP') : standings('2026', '4'));
    for (const snapshotHandler of [() => Promise.reject(new Error('HTTP 404')), () => Promise.resolve(snapshot.driverStandings && { ...snapshot, driverStandings: standings('2026', '5') })]) {
        const io = makeIo({ snapshot: snapshotHandler, live });
        const result = await loadPinnedStandings({ season: '2026', round: '4' }, io);
        assert.equal(result.source, 'jolpica', 'missing or mismatched snapshot falls back to Jolpica');
        assert.equal(result.raceName, 'Live GP');
        assert.equal(io.calls.filter(c => c.startsWith('live:')).length, 3);
    }
}
{
    const io = makeIo({ snapshot: () => Promise.reject(new Error('nope')), live: url => url.endsWith('/4.json') ? Promise.reject(new Error('x')) : Promise.resolve(standings('2026', '4')) });
    const result = await loadPinnedStandings({ season: '2026', round: '4' }, io);
    assert.equal(result.raceName, '', 'a missing race name is not fatal');
}
{
    const io = makeIo({ snapshot: () => Promise.reject(new Error('nope')), live: () => Promise.reject(new Error('down')) });
    await assert.rejects(() => loadPinnedStandings({ season: '2026', round: '4' }, io), /down/);
}
