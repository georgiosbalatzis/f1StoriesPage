let scopes = [], year, listener;

export function setRaceDeskYear(value) { year = value; }

function pick(list, rows) {
    return list && rows && rows.length ? [list.season, list.round] : null;
}

export function acceptRaceDeskScopes(drivers, driverRows, constructors, constructorRows) {
    scopes = [pick(drivers, driverRows), pick(constructors, constructorRows)];
    if (listener) queueMicrotask(listener);
}

export function clearRaceDeskScopes() { acceptRaceDeskScopes(); }

export function subscribeRaceDesk(callback) {
    listener = callback;
    callback();
}

export function raceDeskState() { return [scopes, year]; }
