// Lightweight runtime payload checks for standings API/cache data.
//
// These are intentionally structural rather than schema-exhaustive. They
// catch malformed API/cache responses before renderers start reading deep
// properties, while leaving Step 10 to define full generated-data contracts.

export function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function requireObject(value, label) {
    if (!isPlainObject(value)) {
        throw new Error((label || 'payload') + ' must be an object.');
    }
    return value;
}

export function requireArray(value, label, options) {
    const config = options || {};
    if (!Array.isArray(value)) {
        throw new Error((label || 'payload') + ' must be an array.');
    }
    if (!config.allowEmpty && !value.length) {
        throw new Error((label || 'payload') + ' must not be empty.');
    }
    return value;
}

export function getPath(value, path) {
    return (path || []).reduce(function(current, key) {
        return current == null ? undefined : current[key];
    }, value);
}

export function requireArrayPath(value, path, label, options) {
    return requireArray(getPath(value, path), label || path.join('.'), options);
}

export function validateStandingsSnapshotPayload(payload) {
    requireObject(payload, 'standings snapshot');
    validateJolpicaStandingsPayload(payload.driverStandings, 'driver standings snapshot');
    validateJolpicaStandingsPayload(payload.constructorStandings, 'constructor standings snapshot');
    return payload;
}

export function validateJolpicaStandingsPayload(payload, label) {
    requireObject(payload, label || 'Jolpica standings payload');
    requireArrayPath(payload, ['MRData', 'StandingsTable', 'StandingsLists'], label || 'Jolpica standings lists');
    return payload;
}

export function validateJolpicaRaceListPayload(payload, label) {
    requireObject(payload, label || 'Jolpica race list payload');
    requireArrayPath(payload, ['MRData', 'RaceTable', 'Races'], label || 'Jolpica races', { allowEmpty: true });
    return payload;
}

export function validateJolpicaRacePayload(payload, label) {
    requireObject(payload, label || 'Jolpica race payload');
    requireArrayPath(payload, ['MRData', 'RaceTable', 'Races'], label || 'Jolpica race entries', { allowEmpty: true });
    return payload;
}

export function validateOpenF1ArrayPayload(payload, label, options) {
    requireArray(payload, label || 'OpenF1 payload', options);
    return payload;
}

export function validateDestructorsSnapshotPayload(payload) {
    requireObject(payload, 'destructors snapshot');
    requireArray(payload.drivers, 'destructors drivers');
    if (payload.zeroTeams != null) requireArray(payload.zeroTeams, 'destructors zeroTeams', { allowEmpty: true });
    if (payload.source != null) requireObject(payload.source, 'destructors source');
    return payload;
}
