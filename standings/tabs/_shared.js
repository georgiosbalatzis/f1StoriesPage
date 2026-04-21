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
