// Round pinning for embeds: ?season=2026&round=4 shows the standings as of that round.
//
// A pinned embed never refreshes live, so an article keeps saying what it said when it was written.
// Source order: the committed per-round snapshot (standings/rounds/<season>-<round>.json, written by
// scripts/build/refresh-standings-data.mjs), then Jolpica's per-round endpoints. Pure logic only; the
// shell passes in the fetch and validation functions.

export const FIRST_SEASON = 2024;
const MAX_ROUND = 30;

function toInt(value) {
    return /^\d{1,4}$/.test(String(value == null ? '' : value).trim()) ? parseInt(value, 10) : NaN;
}

// -> { season, round } as strings when `round` is a usable number, otherwise null (not pinned).
export function parseRoundPin(search, currentYear) {
    const params = new URLSearchParams(search || '');
    const round = toInt(params.get('round'));
    if (!(round >= 1 && round <= MAX_ROUND)) return null;
    const season = toInt(params.get('season'));
    const validSeason = season >= FIRST_SEASON && season <= currentYear + 1 ? season : currentYear;
    return { season: String(validSeason), round: String(round) };
}

export function roundSnapshotUrl(season, round) {
    return 'rounds/' + season + '-' + round + '.json';
}

export function jolpicaRoundUrls(base, season, round) {
    const root = base + '/' + season + '/' + round;
    return {
        drivers: root + '/driverstandings.json?limit=30',
        constructors: root + '/constructorstandings.json?limit=30',
        race: root + '.json'
    };
}

function snapshotMatches(snapshot, season, round) {
    const lists = snapshot && snapshot.driverStandings && snapshot.driverStandings.MRData
        && snapshot.driverStandings.MRData.StandingsTable;
    return !!lists && String(lists.season) === String(season) && String(lists.round) === String(round);
}

function raceNameOf(payload) {
    const races = payload && payload.MRData && payload.MRData.RaceTable && payload.MRData.RaceTable.Races;
    return Array.isArray(races) && races[0] && typeof races[0].raceName === 'string' ? races[0].raceName : '';
}

// Resolves { driverStandings, constructorStandings, raceName, source }.
// io: { fetchSnapshot(url), fetchLive(url), validateSnapshot(payload), validateStandings(payload, label), jolpicaBase }
export function loadPinnedStandings(pin, io) {
    return io.fetchSnapshot(roundSnapshotUrl(pin.season, pin.round)).then(function(snapshot) {
        io.validateSnapshot(snapshot);
        if (!snapshotMatches(snapshot, pin.season, pin.round)) throw new Error('round snapshot does not match the requested round');
        return {
            driverStandings: snapshot.driverStandings,
            constructorStandings: snapshot.constructorStandings,
            raceName: typeof snapshot.raceName === 'string' ? snapshot.raceName : '',
            source: 'snapshot'
        };
    }).catch(function() {
        const urls = jolpicaRoundUrls(io.jolpicaBase, pin.season, pin.round);
        return Promise.all([
            io.fetchLive(urls.drivers).then(function(p) { return io.validateStandings(p, 'driver standings for round ' + pin.round); }),
            io.fetchLive(urls.constructors).then(function(p) { return io.validateStandings(p, 'constructor standings for round ' + pin.round); }),
            io.fetchLive(urls.race).then(raceNameOf, function() { return ''; })
        ]).then(function(results) {
            return { driverStandings: results[0], constructorStandings: results[1], raceName: results[2], source: 'jolpica' };
        });
    });
}
