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

// Unclassified standings rows have no position (Jolpica positionText "-").
function isUnclassifiedPosition(value) {
    return value === undefined || value === null || value === '' || value === '-';
}

function requireFiniteFields(row, fields, label, optionalPositionFields) {
    requireObject(row, label);
    fields.forEach(function(field) {
        const value = row[field];
        if (optionalPositionFields && optionalPositionFields.indexOf(field) !== -1 && isUnclassifiedPosition(value)) return;
        if (!(typeof value === 'number' || (typeof value === 'string' && value.trim())) || !Number.isFinite(Number(value))) {
            throw new Error(label + ' ' + field + ' must be a finite number.');
        }
    });
}

export function validateStandingsSnapshotPayload(payload) {
    requireObject(payload, 'standings snapshot');
    validateJolpicaStandingsPayload(payload.driverStandings, 'driver standings snapshot');
    validateJolpicaStandingsPayload(payload.constructorStandings, 'constructor standings snapshot');
    return payload;
}

export function validateJolpicaStandingsPayload(payload, label) {
    requireObject(payload, label || 'Jolpica standings payload');
    const lists = requireArrayPath(payload, ['MRData', 'StandingsTable', 'StandingsLists'], label || 'Jolpica standings lists');
    lists.forEach(function(list) {
        requireObject(list, 'Jolpica standings list');
        ['DriverStandings', 'ConstructorStandings'].forEach(function(key) {
            if (list[key] === undefined) return;
            requireArray(list[key], key, { allowEmpty: true }).forEach(function(row) {
                requireFiniteFields(row, ['position', 'points'], label || key, ['position']);
            });
        });
    });
    return payload;
}

export function validateJolpicaRaceListPayload(payload, label) {
    requireObject(payload, label || 'Jolpica race list payload');
    const races = requireArrayPath(payload, ['MRData', 'RaceTable', 'Races'], label || 'Jolpica races', { allowEmpty: true });
    races.forEach(function(race) {
        requireFiniteFields(race, ['round'], label || 'Jolpica race');
    });
    return payload;
}

export function validateJolpicaRacePayload(payload, label) {
    requireObject(payload, label || 'Jolpica race payload');
    requireArrayPath(payload, ['MRData', 'RaceTable', 'Races'], label || 'Jolpica race entries', { allowEmpty: true });
    return payload;
}

export function validateOpenF1ArrayPayload(payload, label, options) {
    requireArray(payload, label || 'OpenF1 payload', options);
    if (options && options.numericFields) {
        payload.forEach(function(row) {
            requireFiniteFields(row, options.numericFields, label || 'OpenF1 payload', options.optionalPositionFields);
        });
    }
    return payload;
}
