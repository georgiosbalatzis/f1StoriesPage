// Driver roster keyed by car number, built from the committed standings snapshot (Jolpica).
//
// OpenF1's /drivers endpoint is rate-limited (HTTP 429) and the tabs skip a chunk that fails, which used to
// leave rows with nothing but a car number ("#5", "Οδηγός #5") and no avatar, or no rows at all. The standings
// snapshot is a static file already loaded with the page, so it can always name the current drivers.
// Tabs call supplementDriverRecords() on the OpenF1 /drivers payload, so nothing downstream changes shape.

// OpenF1 spells some teams differently from Jolpica; use OpenF1's names so rows read the same either way.
const OPENF1_TEAM_NAMES = {
    red_bull: 'Red Bull Racing',
    rb: 'Racing Bulls',
    alpine: 'Alpine',
    haas: 'Haas F1 Team',
    audi: 'Audi',
    cadillac: 'Cadillac',
    aston_martin: 'Aston Martin',
    williams: 'Williams',
    mercedes: 'Mercedes',
    mclaren: 'McLaren',
    ferrari: 'Ferrari'
};

export function teamDisplayName(constructorId, jolpicaName) {
    return OPENF1_TEAM_NAMES[constructorId] || jolpicaName || '';
}

// OpenF1 writes names without diacritics ("PEREZ"); Jolpica has "Pérez".
function upperFamily(name) {
    return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

// -> { '12': { driverNumber, firstName, lastName, fullName, acronym, teamName, constructorId } }
export function buildRosterByNumber(standingsPayload) {
    const roster = {};
    const table = standingsPayload && standingsPayload.MRData && standingsPayload.MRData.StandingsTable;
    const lists = table && Array.isArray(table.StandingsLists) ? table.StandingsLists : [];
    const standings = lists[0] && Array.isArray(lists[0].DriverStandings) ? lists[0].DriverStandings : [];

    standings.forEach(function(entry) {
        const driver = entry && entry.Driver;
        const number = driver && parseInt(driver.permanentNumber, 10);
        if (!driver || !Number.isFinite(number)) return;
        const team = entry.Constructors && entry.Constructors[0];
        const constructorId = team ? team.constructorId || '' : '';
        roster[number] = {
            driverNumber: number,
            firstName: driver.givenName || '',
            lastName: driver.familyName || '',
            // Same shape as OpenF1's full_name ("Gabriel BORTOLETO"), which the headshot lookup keys on.
            fullName: [driver.givenName, upperFamily(driver.familyName)].filter(Boolean).join(' '),
            acronym: String(driver.code || '').toUpperCase(),
            teamName: teamDisplayName(constructorId, team ? team.name : ''),
            constructorId: constructorId
        };
    });

    return roster;
}

// Loads the roster from the standings snapshot. `fetchJSON` is passed in so this module stays pure.
// Never rejects: no roster just means no fallback.
export function loadDriverRoster(fetchJSON, snapshotUrl) {
    return fetchJSON(snapshotUrl || 'standings-cache.json').then(function(snapshot) {
        return buildRosterByNumber(snapshot && snapshot.driverStandings);
    }).catch(function() {
        return {};
    });
}

// OpenF1-shaped /drivers records for every requested session that came back with none (a rate-limited chunk
// drops its sessions whole). Sessions that did answer are left exactly as OpenF1 returned them.
// `activity` (laps, positions or results of the same sessions) limits the fill to drivers who actually took part:
// the roster also holds drivers who missed a session, and tabs list every driver they find a record for.
export function supplementDriverRecords(driverRecords, sessionKeys, roster, activity) {
    const records = Array.isArray(driverRecords) ? driverRecords.slice() : [];
    const numbers = Object.keys(roster || {});
    if (!numbers.length) return records;

    const answered = {};
    records.forEach(function(record) {
        if (record && record.session_key != null) answered[String(record.session_key)] = true;
    });

    const present = {};
    const hasActivity = Array.isArray(activity);
    (activity || []).forEach(function(record) {
        if (!record || record.session_key == null || record.driver_number == null) return;
        present[record.session_key + ':' + record.driver_number] = true;
    });

    (sessionKeys || []).forEach(function(sessionKey) {
        if (answered[String(sessionKey)]) return;
        numbers.forEach(function(number) {
            if (hasActivity && !present[sessionKey + ':' + number]) return;
            const entry = roster[number];
            records.push({
                session_key: sessionKey,
                driver_number: entry.driverNumber,
                full_name: entry.fullName,
                first_name: entry.firstName,
                last_name: entry.lastName,
                name_acronym: entry.acronym,
                team_name: entry.teamName,
                team_colour: '',
                headshot_url: ''
            });
        });
    });

    return records;
}
