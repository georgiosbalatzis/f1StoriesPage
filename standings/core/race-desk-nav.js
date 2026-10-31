import { FIRST_SEASON, parseRoundPin } from './rounds.js';

const TOOLS = ['tyres', 'telemetry', 'ghostcar'];

/** Render only from the standings snapshot the shell has actually accepted. */
export function createRaceDeskNavigation({ links, tyresNotice, openf1Notice, projection }) {
    function update(snapshot) {
        if (projection.enabled !== true || snapshot?.embed) return;
        let row = null;
        if (projection.schemaVersion === 1 && snapshot?.nativeYear === projection.buildYear &&
            (snapshot.tab === 'drivers' || snapshot.tab === 'constructors')) {
            const scopes = snapshot.scopes;
            const scope = scopes && typeof scopes === 'object' && !Array.isArray(scopes) &&
                Object.hasOwn(scopes, snapshot.tab) ? scopes[snapshot.tab] : null;
            if (scope && typeof scope === 'object' && !Array.isArray(scope) &&
                Object.hasOwn(scope, 'season') && Object.hasOwn(scope, 'round') &&
                ['string', 'number'].includes(typeof scope.season) && ['string', 'number'].includes(typeof scope.round)) {
                const season = String(scope.season).trim();
                const round = String(scope.round).trim();
                if (/^\d{4}$/.test(season) && Number(season) >= FIRST_SEASON && Number(season) <= snapshot.nativeYear + 1) {
                    const query = new URLSearchParams({ season, round });
                    const pin = parseRoundPin(query.toString(), snapshot.nativeYear);
                    if (pin && pin.season === String(Number(season))) {
                        const matches = projection.rounds.filter(item => item.season === Number(pin.season) && item.round === Number(pin.round));
                        if (matches.length === 1) row = matches[0];
                    }
                }
            }
        }
        const plans = row?.plans ?? projection.generic;
        for (const tool of TOOLS) {
            const plan = plans[tool];
            if (links[tool].getAttribute('href') !== plan.url) links[tool].setAttribute('href', plan.url);
        }
        const tyreText = row && plans.tyres.kind !== 'generic'
            ? `Στο TYRES μεταφέρεται ο αγώνας ${row.label}.`
            : 'Στο TYRES θα επιλέξεις αγώνα μέσα στο εργαλείο.';
        const otherText = 'Στα TELEMETRY / GHOST CAR θα επιλέξεις αγώνα μέσα στο εργαλείο.';
        if (tyresNotice.textContent !== tyreText) tyresNotice.textContent = tyreText;
        if (openf1Notice.textContent !== otherText) openf1Notice.textContent = otherText;
    }
    return { update };
}
