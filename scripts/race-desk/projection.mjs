import { validateRegistry, RegistryValidationError } from './core/index.mjs';
import { planToolLink } from './core/navigation.mjs';
import { checkLock } from '../deployment/release.mjs';

const targets = ['tyres', 'telemetry', 'ghostcar'];

/** Build only the navigation data needed by the standings client. */
export function createRaceDeskProjection(registry, sourceLock, currentYear) {
  if (!Number.isInteger(currentYear) || currentYear < 1950 || currentYear > 2100) {
    throw new TypeError('Invalid build year');
  }
  if (typeof sourceLock?.enabled !== 'boolean') throw new TypeError('Invalid deployment enabled flag');
  checkLock(sourceLock);
  const validation = validateRegistry(registry);
  if (!validation.valid) throw new RegistryValidationError(validation.errors);

  const generic = Object.fromEntries(targets.map(target => {
    const app = sourceLock.applications.find(item => item.application === target);
    return [target, { url: sourceLock.origin + app.path, kind: 'generic', notice: 'race-context-unavailable' }];
  }));
  const rounds = registry.races
    .filter(race => race.sourceKeys.jolpica !== null)
    .map(race => {
      const plans = Object.fromEntries(targets.map(target => {
        const { url, kind, notice } = planToolLink(registry, { raceId: race.raceId }, target, { currentYear });
        return [target, { url, kind, notice }];
      }));
      return { season: race.sourceKeys.jolpica.season, round: race.sourceKeys.jolpica.round, raceId: race.raceId, label: race.displayName, plans };
    })
    .sort((a, b) => a.season - b.season || a.round - b.round);
  return { schemaVersion: 1, enabled: sourceLock.enabled, buildYear: currentYear, generic, rounds };
}
