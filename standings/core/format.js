// String escaping + locale label helpers shared by every standings render
// path. Pure functions, zero module state — safe to import from both the
// slim entry and every per-tab module.

export function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function escAttr(s) {
    return esc(s).replace(/'/g, '&#39;');
}

export function formatWinsLabel(wins) {
    return wins + ' ' + (wins === 1 ? 'νίκη' : 'νίκες');
}
