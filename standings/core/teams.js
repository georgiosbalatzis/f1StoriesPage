// 2026 constructor roster + team-color / logo utilities.
//
// The TEAMS map is the single source of truth for constructor identity in
// the slim standings entry (and, once the legacy chunk is retired, every
// per-tab module). The 'sauber' key aliases to the same entry as 'audi'
// because Jolpica still emits the old constructorId for the first races
// of the rebrand.

const TEAM_LOGO_BASE = 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026';

function teamEntry(color, name, logoSlug) {
    return {
        color: color,
        name: name,
        logo: TEAM_LOGO_BASE + '/' + logoSlug + '/2026' + logoSlug + 'logo.webp'
    };
}

export const TEAMS = {
    'mercedes':      teamEntry('27F4D2', 'Mercedes',        'mercedes'),
    'red_bull':      teamEntry('3671C6', 'Red Bull Racing', 'redbullracing'),
    'ferrari':       teamEntry('E8002D', 'Ferrari',         'ferrari'),
    'mclaren':       teamEntry('FF8000', 'McLaren',         'mclaren'),
    'aston_martin':  teamEntry('229971', 'Aston Martin',    'astonmartin'),
    'alpine':        teamEntry('FF87BC', 'Alpine',          'alpine'),
    'haas':          teamEntry('B6BABD', 'Haas F1 Team',    'haasf1team'),
    'rb':            teamEntry('6692FF', 'Racing Bulls',    'racingbulls'),
    'williams':      teamEntry('64C4FF', 'Williams',        'williams'),
    'sauber':        teamEntry('F50537', 'Audi',            'audi'),
    'audi':          teamEntry('F50537', 'Audi',            'audi'),
    'cadillac':      teamEntry('1E4168', 'Cadillac',        'cadillac')
};

export function normalizeTeamName(teamName) {
    return (teamName || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function resolveTeamId(constructorId, teamName) {
    if (constructorId && TEAMS[constructorId]) return constructorId;

    const normalized = normalizeTeamName(teamName);
    if (!normalized) return constructorId || '';
    if (normalized.indexOf('audi') !== -1 || normalized.indexOf('sauber') !== -1 || normalized.indexOf('stake') !== -1) return 'audi';
    if (normalized.indexOf('mercedes') !== -1) return 'mercedes';
    if (normalized.indexOf('red bull') !== -1) return 'red_bull';
    if (normalized.indexOf('ferrari') !== -1) return 'ferrari';
    if (normalized.indexOf('mclaren') !== -1) return 'mclaren';
    if (normalized.indexOf('aston') !== -1) return 'aston_martin';
    if (normalized.indexOf('alpine') !== -1) return 'alpine';
    if (normalized.indexOf('haas') !== -1) return 'haas';
    if (normalized.indexOf('racing bulls') !== -1 || normalized === 'rb' || normalized.indexOf('visa cash app') !== -1) return 'rb';
    if (normalized.indexOf('williams') !== -1) return 'williams';
    if (normalized.indexOf('cadillac') !== -1) return 'cadillac';
    return constructorId || '';
}

export function normalizeHexColor(hex) {
    let value = (hex || '').toString().replace(/[^0-9a-f]/gi, '');
    if (value.length === 3) value = value.replace(/(.)/g, '$1$1');
    if (value.length !== 6) return '3b82f6';
    return value.toLowerCase();
}

export function getCanonicalTeamColor(constructorId, teamName, fallbackColor) {
    const teamId = resolveTeamId(constructorId, teamName);
    if (teamId && TEAMS[teamId]) return TEAMS[teamId].color;
    return fallbackColor ? normalizeHexColor(fallbackColor) : '3b82f6';
}

export function getCanonicalTeamName(teamName) {
    const teamId = resolveTeamId('', teamName);
    return teamId && TEAMS[teamId] ? TEAMS[teamId].name : (teamName || '');
}

export function getTeamColor(constructorId) {
    const t = TEAMS[constructorId];
    return t ? t.color : '3b82f6';
}

export function getTeamLogo(constructorId, teamName) {
    const teamId = resolveTeamId(constructorId, teamName);
    const t = teamId ? TEAMS[teamId] : null;
    return t ? t.logo : '';
}
