import projection from './core/race-desk-links.generated.js';
import { createRaceDeskNavigation } from './core/race-desk-nav.js';
import { raceDeskState, subscribeRaceDesk } from './core/race-desk-bridge.js';

if (projection.enabled === true) {
    const links = {};
    for (const tool of ['tyres', 'telemetry', 'ghostcar']) {
        links[tool] = document.querySelector('[data-race-desk-tool="' + tool + '"]');
    }
    const tyresNotice = document.getElementById('race-desk-tyres-context');
    const openf1Notice = document.getElementById('race-desk-openf1-context');
    if (links.tyres && links.telemetry && links.ghostcar && tyresNotice && openf1Notice) {
        const navigation = createRaceDeskNavigation({ links, tyresNotice, openf1Notice, projection });
        const update = () => {
            try {
                const [rows, year] = raceDeskState();
                const scopes = {};
                ['drivers', 'constructors'].forEach((key, index) => {
                    const row = rows[index];
                    if (row) scopes[key] = { season: row[0], round: row[1] };
                });
                navigation.update({
                    tab: document.querySelector('.standings-tab[aria-selected="true"]')?.dataset.tab,
                    embed: document.body.classList.contains('standings-embed'),
                    nativeYear: year,
                    scopes
                });
            } catch { /* Leave the native links usable if the enhancement fails. */ }
        };
        subscribeRaceDesk(update);
        const observer = new MutationObserver(update);
        for (const tab of document.querySelectorAll('.standings-tab')) {
            observer.observe(tab, { attributes: true, attributeFilter: ['aria-selected'] });
        }
    }
}
