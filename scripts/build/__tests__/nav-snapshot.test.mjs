import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createSnapshot } from '../refresh-nav-snapshot.mjs';
import { validatePublicText } from '../validate-public-artifact.mjs';

const source = readFileSync(new URL('../../shared-nav.js', import.meta.url), 'utf8');
const countdown = source.slice(source.indexOf('    var FALLBACK_RACES'), source.indexOf('    Array.prototype.forEach.call(document.querySelectorAll(\'[data-current-year]\')'));
const now = new Date('2026-06-01T00:00:00Z');
const race = {
    raceName: 'British Grand Prix', date: '2026-07-05', time: '14:00:00Z',
    Circuit: { Location: { country: 'UK' } }, round: '9'
};
const schedule = (races = [race], year = 2026) =>
    ({ MRData: { total: String(races.length), RaceTable: { season: String(year), Races: races } } });
const rss = enclosure => `<rss><channel><item>${enclosure}</item>
    <item><enclosure type="audio/mpeg" url="https://example.com/older.mp3"/></item></channel></rss>`;
const audioUrl = 'https://anchor.fm/s/101588098/podcast/play/123/latest.mp3';
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

test('race text that would fail the artifact scan is omitted without failing snapshot generation', async t => {
    const warn = t.mock.method(console, 'warn', () => {});
    for (const [raceName, reason] of [['briefings.v1.json', /invalid race/],
        // Split so the static source guard does not flag this test fixture as a committed key.
        ['-----BEGIN PRIVATE ' + 'KEY-----', /contains a credential/]]) {
        const errors = [];
        validatePublicText(errors, JSON.stringify({ raceName }), 'data/nav-snapshot.json', []);
        assert.equal(errors.length, 1);
        const races = JSON.stringify(schedule([{ ...race, raceName }]));
        assert.deepEqual(await createSnapshot(fetcher({ races }), now), { audioUrl });
        assert.match(warn.mock.calls.at(-1).arguments[0], reason);
    }

    const internationalRace = {
        ...race, raceName: "São Paulo 2 - D’Oeste Grand Prix",
        Circuit: { Location: { country: "Côte d'Ivoire" } }
    };
    assert.deepEqual(await createSnapshot(fetcher({ races: JSON.stringify(schedule([internationalRace])) }), now), {
        races: [{ ...raceStart, name: 'São Paulo 2 - D’Oeste GP', country: "Côte d'Ivoire" }], audioUrl
    });
    const badCountry = { ...race, Circuit: { Location: { country: 'UK/NI' } } };
    assert.deepEqual(await createSnapshot(fetcher({ races: JSON.stringify(schedule([badCountry])) }), now), { audioUrl });
});

test('snapshot audio is limited to the podcast paths and passes the artifact scan', async t => {
    const warn = t.mock.method(console, 'warn', () => {});
    for (const url of ['https://example.com/latest.mp3', 'https://youtube.com./s/101588098/latest.mp3',
        audioUrl.replace('anchor.fm', 'anchor.fm.'), audioUrl.replace('101588098', '101588099'),
        'https://d3ctxlq1ktw2nl.cloudfront.net/other/latest.mp3', audioUrl + '?name=briefings.v1.json']) {
        const audio = rss(`<enclosure type="audio/mpeg" url="${url}"/>`);
        assert.deepEqual(await createSnapshot(fetcher({ audio }), now), { races: [raceStart] });
    }
    assert.match(warn.mock.calls.at(-1).arguments[0], /briefing editorial data leaked/);
    const direct = 'https://d3ctxlq1ktw2nl.cloudfront.net/staging/2026-9-7/latest.mp3';
    const audio = rss(`<enclosure type="audio/mpeg" url="${direct}"/>`);
    assert.deepEqual(await createSnapshot(fetcher({ audio }), now), { races: [raceStart], audioUrl: direct });
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

test('the shared snapshot deadline aborts stalled headers and body reads', async () => {
    const loader = source.slice(source.indexOf('    var navSnapshot;'), source.indexOf('    // ── Navbar audio player'));
    for (const stallBody of [false, true]) {
        let expire, signal, bodyRead;
        const load = vm.runInNewContext(loader + '\nloadNavSnapshot;', {
            AbortController,
            setTimeout(callback, delay) { assert.equal(delay, 3000); expire = callback; },
            clearTimeout() {},
            fetch(url, options) {
                assert.equal(url, '/data/nav-snapshot.json');
                signal = options.signal;
                const stall = () => new Promise((_, reject) => {
                    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
                });
                return stallBody ? Promise.resolve({ ok: true, json() { bodyRead = true; return stall(); } }) : stall();
            }
        });
        const snapshot = load();
        assert.equal(load(), snapshot);
        await Promise.resolve();
        assert.equal(Boolean(bodyRead), stallBody);
        expire();
        assert.equal(await snapshot, null);
        assert.equal(signal.aborted, true);
    }
});

test('an exhausted snapshot restores the bundled next race when Jolpica has no usable future start', async () => {
    for (const data of [undefined, schedule([]), schedule([race])]) {
        let now = raceStart.ts - 1000;
        let tick;
        class Clock extends Date {
            constructor(...args) { super(...(args.length ? args : [now])); }
            static now() { return now; }
        }
        const name = {};
        const requests = [];
        const context = vm.createContext({
            Date: Clock,
            document: { getElementById: id => id === 'next-race-name' ? name : null, addEventListener() {} },
            window: { clearTimeout() {}, setTimeout(callback) { tick = callback; return 1; } },
            loadNavSnapshot: async () => ({ races: [raceStart] }),
            fetch: async url => {
                requests.push(url);
                if (!data) throw new Error('Network unavailable');
                return { ok: true, json: async () => data };
            }
        });
        vm.runInContext(countdown, context);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(context.calendarSource, 'snapshot');
        assert.equal(name.textContent, 'British GP');
        now = raceStart.ts;
        tick();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(context.calendarSource, 'fallback');
        assert.equal(name.textContent, 'Belgian GP');
        assert.deepEqual(requests, ['https://api.jolpi.ca/ergast/f1/2026.json']);
    }
});
