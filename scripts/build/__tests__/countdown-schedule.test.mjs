import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../../shared-nav.js', import.meta.url), 'utf8');
const countdown = source.slice(source.indexOf('    var FALLBACK_RACES'), source.indexOf('    if (countdownNameEl ||'));
const now = '2026-10-21T00:00:00Z';
const race = (raceName = 'United States Grand Prix', date = '2026-10-25', time = '20:00:00Z') =>
    ({ raceName, date, time, Circuit: { Location: { country: 'USA' } } });
const schedule = (...races) => ({ MRData: { RaceTable: { Races: races } } });
const storedRace = (name = 'United States GP', date = '2026-10-25T20:00:00Z') => ({ name, flag: '🇺🇸', ts: Date.parse(date) });
const freshCache = races => ({ ts: Date.parse(now) - 1000, races });

async function readCountdown({ instant = now, cached, data, ok = true, storageBlocked = false } = {}) {
    const nodes = new Map(['next-race-name', 'race-countdown', 'race-countdown-mobile', 'race-flag-emoji', 'nav-countdown'].map(id => [id, {
        textContent: 'Σύντομα', attrs: {},
        setAttribute(key, value) { this.attrs[key] = value; },
        removeAttribute(key) { delete this.attrs[key]; }
    }]));
    const RealDate = Date;
    class FixedDate extends RealDate {
        constructor(...args) { super(...(args.length ? args : [instant])); }
        static now() { return RealDate.parse(instant); }
    }
    const requests = [];
    const writes = [];
    const context = vm.createContext({
        Date: FixedDate, Intl,
        document: { hidden: false, getElementById: id => nodes.get(id) || null },
        window: { setTimeout: () => 1, clearTimeout() {} },
        sessionStorage: {
            getItem() {
                if (storageBlocked) throw new Error('Storage disabled');
                return typeof cached === 'string' ? cached : JSON.stringify(cached ?? null);
            },
            setItem(key, value) {
                if (storageBlocked) throw new Error('Storage disabled');
                writes.push([key, JSON.parse(value)]);
            }
        },
        fetch: async url => {
            requests.push(url);
            if (data === undefined) throw new Error('Network unavailable');
            return { ok, json: async () => data };
        }
    });
    vm.runInContext(`${countdown}\ntickCountdown(); loadLiveSchedule();`, context);
    await new Promise(resolve => setImmediate(resolve));
    return {
        name: nodes.get('next-race-name').textContent,
        timer: nodes.get('race-countdown').textContent,
        mobile: nodes.get('race-countdown-mobile').textContent,
        label: nodes.get('nav-countdown').attrs['aria-label'],
        source: context.calendarSource, requests, writes
    };
}

test('offline, HTTP failures and empty/malformed responses preserve the named fallback', async () => {
    for (const options of [{}, { data: schedule(race()), ok: false }, { data: schedule() }, { data: null }, { data: { bad: true } }]) {
        const result = await readCountdown(options);
        assert.equal(result.name, 'US GP');
        assert.equal(result.timer, '4d 20h 0m');
        assert.equal(result.source, 'fallback');
        assert.match(result.label, /αποθηκευμένο πρόγραμμα/);
    }
});

test('invalid or missing race times reject the response instead of inventing or dropping start times', async () => {
    for (const invalid of [race('Unknown GP', '2026-10-25', ''), { ...race(), time: undefined },
        race('Unknown GP', '2026-10-25', '20:00:00'), race('Unknown GP', '2026-10-25', '25:00:00Z'),
        race('Unknown GP', '2026-02-30'), race(''), { raceName: 'Missing circuit' }]) {
        const result = await readCountdown({ data: schedule(race(), invalid) });
        assert.equal(result.source, 'fallback');
        assert.equal(result.name, 'US GP');
        assert.equal(result.writes.length, 0);
    }
});

test('empty, malformed and wrong-season cache records cannot suppress a fresh request', async () => {
    for (const races of [[], {}, [{}], [null], [storedRace('', undefined)], [{ ...storedRace(), ts: '1792958400000' }],
        [{ ...storedRace(), ts: null }], [storedRace('Old GP', '2025-10-25T20:00:00Z')]]) {
        const result = await readCountdown({ cached: freshCache(races), data: schedule(race()) });
        assert.equal(result.requests.length, 1);
        assert.equal(result.source, 'live');
        assert.equal(result.name, 'United States GP');
    }
});

test('cache TTL boundaries, future timestamps, invalid JSON and blocked storage fall back to fetching', async () => {
    for (const options of [
        { cached: { ts: Date.parse(now) - 6 * 3600000, races: [storedRace()] } },
        { cached: { ts: Date.parse(now) + 1, races: [storedRace()] } },
        { cached: { ts: String(Date.parse(now)), races: [storedRace()] } },
        { cached: '{bad json' }, { storageBlocked: true }
    ]) {
        const result = await readCountdown({ ...options, data: schedule(race()) });
        assert.equal(result.requests.length, 1);
        assert.equal(result.source, 'live');
    }
});

test('valid current-season cache is reused and unordered schedules select the earliest future race', async () => {
    const cached = await readCountdown({ cached: freshCache([storedRace('Mexico GP', '2026-11-01T20:00:00Z'), storedRace()]) });
    assert.equal(cached.requests.length, 0);
    assert.equal(cached.source, 'cache');
    assert.equal(cached.name, 'United States GP');
    const live = await readCountdown({ data: schedule(race('Mexico Grand Prix', '2026-11-01'), race()) });
    assert.equal(live.source, 'live');
    assert.equal(live.name, 'United States GP');
    assert.equal(live.timer, cached.timer);
    assert.equal(live.writes.length, 1);
});

test('a fresh cache from the previous year does not block the new season request', async () => {
    const result = await readCountdown({
        instant: '2027-01-01T00:30:00Z',
        cached: { ts: Date.parse('2026-12-31T23:30:00Z'), races: [storedRace('Abu Dhabi GP', '2026-12-06T13:00:00Z')] },
        data: schedule(race('Australian Grand Prix', '2027-03-07', '04:00:00Z'))
    });
    assert.match(result.requests[0], /\/2027\.json$/);
    assert.equal(result.name, 'Australian GP');
    assert.equal(result.source, 'live');
});

test('race-start boundaries advance correctly and unknown seasons are distinct from a completed season', async () => {
    assert.equal((await readCountdown({ instant: '2026-10-25T19:59:59Z' })).timer, '0m 1s');
    assert.equal((await readCountdown({ instant: '2026-10-25T20:00:00Z' })).name, 'Mexico City GP');
    const ended = await readCountdown({ instant: '2026-12-07T00:00:00Z' });
    assert.equal(ended.name, 'Η σεζόν ολοκληρώθηκε');
    assert.equal(ended.timer, '2027 προσεχώς');
    for (const instant of ['2027-01-01T00:00:00Z', '2028-01-01T00:00:00Z']) {
        const unknown = await readCountdown({ instant });
        assert.equal(unknown.name, 'Πρόγραμμα μη διαθέσιμο');
        assert.equal(unknown.mobile, 'Αναμονή');
        assert.equal(unknown.label, undefined);
    }
    const nextSeasonEnd = await readCountdown({ instant: '2027-12-07T00:00:00Z',
        data: schedule(race('Abu Dhabi Grand Prix', '2027-12-06', '13:00:00Z')) });
    assert.equal(nextSeasonEnd.timer, '2028 προσεχώς');
});
