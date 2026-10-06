// Driver roster keyed by car number, built from the committed standings snapshot (Jolpica).
//
// OpenF1's /drivers endpoint is rate-limited (HTTP 429) and the tabs skip a chunk that fails, which used to
// leave rows with nothing but a car number ("#5", "Οδηγός #5") and no avatar. The standings snapshot is a
// static file already loaded with the page, so it can always name the current drivers.

function upperFamily(name) {
    return String(name || '').toUpperCase();
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
        roster[number] = {
            driverNumber: number,
            firstName: driver.givenName || '',
            lastName: driver.familyName || '',
            // Same shape as OpenF1's full_name ("Gabriel BORTOLETO"), which the headshot lookup keys on.
            fullName: [driver.givenName, upperFamily(driver.familyName)].filter(Boolean).join(' '),
            acronym: String(driver.code || '').toUpperCase(),
            teamName: team ? team.name || '' : '',
            constructorId: team ? team.constructorId || '' : ''
        };
    });

    return roster;
}
