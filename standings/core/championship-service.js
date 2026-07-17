import { fetchJSON, fetchJSONNoCache } from './fetchers.js';

export function createChampionshipService({ jolpica, year = new Date().getFullYear(), snapshot = 'standings-cache.json' }) {
    const driverUrl = `${jolpica}/${year}/driverstandings.json?limit=30`;
    const constructorUrl = `${jolpica}/${year}/constructorstandings.json?limit=30`;
    return {
        snapshot: () => fetchJSON(snapshot),
        drivers: () => fetchJSON(driverUrl),
        constructors: () => fetchJSON(constructorUrl),
        refreshDrivers: () => fetchJSONNoCache(driverUrl),
        refreshConstructors: () => fetchJSONNoCache(constructorUrl)
    };
}
