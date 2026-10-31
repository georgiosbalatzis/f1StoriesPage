import { validateRegistry, RegistryValidationError } from './core/index.mjs';
import { planToolLink } from './core/navigation.mjs';
import { checkLock } from '../deployment/release.mjs';

const targets = [
  ['grid', 'THE GRID', 'https://f1-stories.gr/standings/'],
  ['telemetry', 'TELEMETRY', 'https://georgiosbalatzis.github.io/f1-telemetry-dashboard/'],
  ['ghostcar', 'GHOST CAR', 'https://georgiosbalatzis.github.io/ghostcar/'],
  ['tyres', 'TYRES', 'https://georgiosbalatzis.github.io/Tyres/'],
];
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function hubPath(raceId) {
  if (typeof raceId !== 'string' || !/^[0-9]{4}-[a-z0-9]+(?:-[a-z0-9]+)*-gp$/.test(raceId)) throw new TypeError('Invalid race ID');
  return `/race-desk/gp/${raceId}/`;
}

/** Return Greek calendar date and 24-hour time, with the IANA zone and UTC offset. */
export function formatHubTime(startUtc, timeZone) {
  if (typeof startUtc !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(startUtc) || typeof timeZone !== 'string' || !timeZone || /^[+-]/.test(timeZone)) return null;
  const instant = new Date(startUtc);
  if (Number.isNaN(instant.valueOf()) || instant.toISOString() !== startUtc) return null;
  try {
    const formatter = new Intl.DateTimeFormat('el-GR', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
    const offset = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(instant).find(part => part.type === 'timeZoneName').value.replace('GMT', 'UTC');
    return { date: `${parts.day}/${parts.month}/${parts.year}`, time: `${parts.hour}:${parts.minute}`, zone: timeZone, offset };
  } catch {
    return null;
  }
}

export function createHubModels(registry, sourceLock, options) {
  if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).length !== 1 || !Object.hasOwn(options, 'currentYear') || !Number.isInteger(options.currentYear) || options.currentYear < 1950 || options.currentYear > 2100) throw new TypeError('Invalid build year');
  if (typeof sourceLock?.enabled !== 'boolean') throw new TypeError('Invalid deployment enabled flag');
  checkLock(sourceLock);
  const validation = validateRegistry(registry);
  if (!validation.valid) throw new RegistryValidationError(validation.errors);

  return registry.races.map(race => {
    const referenced = new Set([...race.evidence, ...race.sessions.flatMap(session => session.evidence)].map(claim => claim.sourceId));
    return {
      raceId: race.raceId,
      path: hubPath(race.raceId),
      season: race.season,
      eventName: race.eventName,
      displayName: race.displayName,
      venue: { name: race.venue.name, timeZone: race.venue.timeZone },
      sessions: race.sessions.map(session => ({
        kind: session.kind,
        startUtc: session.startUtc,
        utcTime: formatHubTime(session.startUtc, 'UTC'),
        venueTime: formatHubTime(session.startUtc, race.venue.timeZone),
        athensTime: formatHubTime(session.startUtc, 'Europe/Athens'),
      })),
      tools: targets.map(([target, label, legacy]) => {
        const plan = planToolLink(registry, { raceId: race.raceId }, target, options);
        const { url, kind, notice } = sourceLock.enabled ? plan : { url: legacy, kind: 'generic', notice: 'race-context-unavailable' };
        return { target, label, url, kind, notice };
      }),
      sources: registry.sources.filter(source => referenced.has(source.id)).map(source => ({ id: source.id, repository: source.repository, url: source.url ?? null, reviewedAt: source.reviewedAt, revision: source.revision, path: source.path })).sort((a, b) => compare(a.id, b.id)),
    };
  }).sort((a, b) => compare(a.raceId, b.raceId));
}
