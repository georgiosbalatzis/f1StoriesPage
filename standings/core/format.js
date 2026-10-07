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

// Match the editorial date labels; UTC keeps a date-only snapshot stable.
export function formatEditorialDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return date.toLocaleDateString('el-GR', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
    }).replace(/\./g, '');
}

export function sessionLabel(value) {
    const labels = {
        'practice 1': 'Δοκιμές 1 (FP1)',
        'practice 2': 'Δοκιμές 2 (FP2)',
        'practice 3': 'Δοκιμές 3 (FP3)',
        practice: 'Ελεύθερες δοκιμές',
        qualifying: 'Κατατακτήριες',
        'sprint qualifying': 'Κατατακτήριες Sprint',
        'sprint shootout': 'Κατατακτήριες Sprint',
        race: 'Αγώνας',
        sprint: 'Sprint',
        session: 'Συνεδρία'
    };
    const text = String(value || '').trim();
    return labels[text.toLowerCase()] || text;
}
