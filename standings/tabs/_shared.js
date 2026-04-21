// Helpers shared across per-tab modules.
//
// Extracted from the legacy bundle during Phase 6C. Kept as leaf-level
// utilities so each tab module can import only what it needs and stay
// below the ~40 KB target the nextsteps.txt Phase 6 plan set.

export function parseNumberValue(value) {
    if (value == null || value === '') return NaN;
    if (typeof value === 'number') return isFinite(value) ? value : NaN;
    const parsed = parseFloat(String(value).trim());
    return isFinite(parsed) ? parsed : NaN;
}

export function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
}

// Accepts seconds as a number, a "ss.sss" string, a "mm:ss.sss" string, or a
// "hh:mm:ss.sss" string. Arrays and plain objects are walked recursively and
// the smallest finite value wins — Jolpica occasionally nests Q1/Q2/Q3 lap
// times inside an object keyed by session identifier.
export function parseTimeSeconds(value) {
    if (value == null || value === '') return NaN;
    if (typeof value === 'number') return isFinite(value) ? value : NaN;
    if (Array.isArray(value)) {
        const nested = value.map(parseTimeSeconds).filter(isFiniteNumber);
        return nested.length ? Math.min.apply(null, nested) : NaN;
    }
    if (typeof value === 'object') {
        const values = Object.keys(value).map(function(key) { return parseTimeSeconds(value[key]); }).filter(isFiniteNumber);
        return values.length ? Math.min.apply(null, values) : NaN;
    }

    const str = String(value).trim();
    if (!str) return NaN;
    if (/^\d+(\.\d+)?$/.test(str)) return parseFloat(str);

    const parts = str.split(':');
    if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
    if (parts.length === 3) return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2]);

    return NaN;
}
