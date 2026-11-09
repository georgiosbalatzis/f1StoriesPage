// Preloaded with `node --import` so the refresh script never reaches the network.
import fs from 'node:fs';

if (process.env.STUB_WRITE_FAIL) {
    const original = fs.writeFileSync;
    fs.writeFileSync = function(file, ...args) {
        if (String(file).includes(process.env.STUB_WRITE_FAIL) && String(file).endsWith('.tmp')) {
            original.call(this, file, 'partial');
            throw new Error('stubbed write failure');
        }
        return original.call(this, file, ...args);
    };
}

const list = name => (process.env[name] || '').split(',').filter(Boolean);
const fail = new Set(list('STUB_FAIL'));
const empty = new Set(list('STUB_EMPTY'));
const dirtyAirKeys = list('STUB_DIRTY_AIR_KEYS');

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const notFound = () => json({ detail: 'stubbed failure' }, 404);

const raceSession = key => ({
    session_key: key,
    meeting_key: 1,
    session_name: 'Race',
    session_type: 'Race',
    meeting_name: 'Stub GP',
    location: 'Stubville',
    date_start: '2026-03-01T14:00:00Z',
    date_end: '2026-03-01T16:00:00Z'
});

const standings = (key, rows) => ({
    MRData: { StandingsTable: { season: '2026', StandingsLists: [{ season: '2026', round: '1', [key]: rows }] } }
});
const noStandings = () => ({ MRData: { StandingsTable: { season: '2026', StandingsLists: [] } } });

function jolpica(url) {
    if (url.pathname.endsWith('/driverstandings.json')) {
        if (fail.has('primary')) return notFound();
        return json(empty.has('primary') ? noStandings() : standings('DriverStandings', empty.has('drivers') ? [] : [{ position: '1', points: '25', ...(fail.has('driver-row') ? {} : { Driver: { driverId: 'stub' } }) }]));
    }
    if (url.pathname.endsWith('/constructorstandings.json')) {
        if (fail.has('primary')) return notFound();
        return json(empty.has('primary') ? noStandings() : standings('ConstructorStandings', empty.has('constructors') ? [] : [{ position: '1', points: '25', ...(fail.has('constructor-row') ? {} : { Constructor: { constructorId: 'stub' } }) }]));
    }
    if (empty.has('race-name')) return json({ MRData: { RaceTable: { Races: [] } } });
    return json({ MRData: { RaceTable: { Races: [{ raceName: 'Stub Grand Prix' }] } } });
}

function openF1(url) {
    const endpoint = url.pathname.split('/').pop();
    const sessionKey = url.searchParams.get('session_key');

    if (endpoint === 'sessions' && url.searchParams.get('session_type') === 'Race') {
        if (fail.has('dirty-air')) return notFound();
        return json(empty.has('dirty-air') ? [] : dirtyAirKeys.map(raceSession));
    }
    if (endpoint === 'sessions') {
        if (fail.has('debrief')) return notFound();
        return json(empty.has('debrief') ? [] : [raceSession(9001)]);
    }
    if (endpoint === 'laps' && fail.has('dirty-air-session') && sessionKey === '9002') return notFound();
    if (sessionKey !== '9001') return json([]);
    if (endpoint === 'drivers') {
        return json([{ session_key: 9001, driver_number: 1, full_name: 'Stub Driver', name_acronym: 'NEW', team_name: 'McLaren' }]);
    }
    if (endpoint === 'laps' && !empty.has('debrief-laps')) {
        return json([{ driver_number: 1, lap_number: 1, lap_duration: 90.5, duration_sector_1: 30, duration_sector_2: 30, duration_sector_3: 30.5 }]);
    }
    return json([]);
}

globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (process.env.STUB_CALLS) fs.appendFileSync(process.env.STUB_CALLS, `${url.hostname}\n`);
    if (url.hostname === 'api.jolpi.ca') return jolpica(url);
    if (url.hostname === 'api.openf1.org') return openF1(url);
    throw new Error(`Unexpected network call: ${url}`);
};
