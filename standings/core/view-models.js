import { getCanonicalTeamColor, getCanonicalTeamName, resolveTeamId } from './teams.js';

export function driverViewModel(standing = {}) {
    const driver = standing.Driver || {};
    return { id: driver.driverId || '', name: [driver.givenName, driver.familyName].filter(Boolean).join(' '), code: driver.code || '', points: Number(standing.points) || 0, wins: Number(standing.wins) || 0, teamId: resolveTeamId(standing.Constructors?.[0]?.constructorId, standing.Constructors?.[0]?.name) };
}

export function constructorViewModel(standing = {}) {
    const team = standing.Constructor || {};
    return { id: resolveTeamId(team.constructorId, team.name), name: getCanonicalTeamName(team.name), color: getCanonicalTeamColor(team.constructorId, team.name), points: Number(standing.points) || 0, wins: Number(standing.wins) || 0 };
}

export function championshipViewModel(payload = {}) {
    const list = payload.MRData?.StandingsTable?.StandingsLists?.[0] || {};
    return { drivers: (list.DriverStandings || []).map(driverViewModel), constructors: (list.ConstructorStandings || []).map(constructorViewModel) };
}
