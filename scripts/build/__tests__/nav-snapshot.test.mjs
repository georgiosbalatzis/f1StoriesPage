import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createSnapshot } from '../refresh-nav-snapshot.mjs';

const now = new Date('2026-06-01T00:00:00Z');
const race = {
    raceName: 'British Grand Prix', date: '2026-07-05', time: '14:00:00Z',
    Circuit: { Location: { country: 'UK' } }, round: '9'
};
const schedule = (races = [race], year = 2026) =>
    ({ MRData: { total: String(races.length), RaceTable: { season: String(year), Races: races } } });
const rss = enclosure => `<rss><channel><item>${enclosure}</item>
    <item><enclosure type="audio/mpeg" url="https://example.com/older.mp3"/></item></channel></rss>`;
const audioUrl = 'https://example.com/latest.mp3';
const feed = rss(`<enclosure type="audio/mpeg" url="${audioUrl}"/>`);
const raceStart = { name: 'British GP', country: 'UK', ts: Date.parse('2026-07-05T14:00:00Z') };

function fetcher({ races = JSON.stringify(schedule()), audio = feed } = {}) {
    return url => {
        const result = new URL(url).hostname === 'api.jolpi.ca' ? races : audio;
        if (result instanceof Error) throw result;
        return result;
    };
}

test('nav snapshot keeps published race starts and the newest audio enclosure', async () => {
    const races = [race, { ...race, date: undefined }, { ...race, time: undefined }];
    assert.deepEqual(await createSnapshot(fetcher({ races: JSON.stringify(schedule(races)) }), now), {
        races: [raceStart], audioUrl
    });
});

const outage = new Error('service unavailable');
for (const { name, failures, expected } of [
    { name: 'Jolpica fails', failures: { races: outage }, expected: { audioUrl } },
    { name: 'Anchor fails', failures: { audio: outage }, expected: { races: [raceStart] } },
    { name: 'both upstreams fail', failures: { races: outage, audio: outage }, expected: {} }
]) {
    test(`nav snapshot preserves available sections when ${name}`, async t => {
        const warn = t.mock.method(console, 'warn', () => {});
        assert.deepEqual(await createSnapshot(fetcher(failures), now), expected);
        assert.deepEqual(warn.mock.calls.map(call => call.arguments[0]), [
            ...(failures.races ? ['warning: nav snapshot omitted races: Error: service unavailable'] : []),
            ...(failures.audio ? ['warning: nav snapshot omitted audio: Error: service unavailable'] : [])
        ]);
    });
}

test('invalid or incomplete upstream data only drops the affected section', async t => {
    t.mock.method(console, 'warn', () => {});
    const incomplete = schedule();
    incomplete.MRData.total = '2';
    for (const invalid of [incomplete, schedule([race, race]), schedule(Array(33).fill(race)),
        schedule([{ ...race, date: '2026-02-30' }]), schedule([{ ...race, time: 1400 }])]) {
        assert.deepEqual(await createSnapshot(fetcher({ races: JSON.stringify(invalid) }), now), { audioUrl });
    }
    for (const invalid of [rss(''), rss('<enclosure type="audio/mpeg" url="http://example.com/latest.mp3"/>')]) {
        assert.deepEqual(await createSnapshot(fetcher({ audio: invalid }), now), { races: [raceStart] });
    }
});

test('nav snapshot fetches the next UTC season when the current season has no future starts', async t => {
    const next = { ...race, date: '2027-07-04' };
    const offSeason = new Date('2026-12-31T23:30:00Z');
    const fetchText = t.mock.fn(url => {
        if (url.includes('/2026.json')) return JSON.stringify(schedule());
        if (url.includes('/2027.json')) return JSON.stringify(schedule([next, { ...next, time: undefined }], 2027));
        return feed;
    });
    assert.deepEqual(await createSnapshot(fetchText, offSeason), {
        races: [{ ...raceStart, ts: Date.parse('2027-07-04T14:00:00Z') }], audioUrl
    });
    assert.equal(fetchText.mock.calls.filter(call => call.arguments[0].includes('api.jolpi.ca')).length, 2);
});

test('the countdown accepts next season and falls back to Jolpica when snapshot races are missing', async () => {
    const source = readFileSync(new URL('../../shared-nav.js', import.meta.url), 'utf8');
    const countdown = source.slice(source.indexOf('    var FALLBACK_RACES'), source.indexOf('    Array.prototype.forEach.call(document.querySelectorAll(\'[data-current-year]\')'));
    const now = Date.parse('2026-12-31T23:30:00Z');
    class Clock extends Date {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return now; }
    }
    const nextRace = { ...raceStart, ts: Date.parse('2027-07-04T14:00:00Z') };
    for (const snapshot of [{}, { audioUrl }, { races: [nextRace] }]) {
        const name = {};
        const requests = [];
        vm.runInNewContext(countdown, {
            Date: Clock,
            document: { getElementById: id => id === 'next-race-name' ? name : null, addEventListener() {} },
            window: { clearTimeout() {}, setTimeout() {} },
            loadNavSnapshot: async () => snapshot,
            fetch: async url => { requests.push(url); return { ok: false }; }
        });
        await new Promise(resolve => setImmediate(resolve));
        if (snapshot.races) {
            assert.equal(name.textContent, nextRace.name);
            assert.deepEqual(requests, []);
        } else {
            assert.deepEqual(requests, ['https://api.jolpi.ca/ergast/f1/2026.json']);
        }
    }
});
