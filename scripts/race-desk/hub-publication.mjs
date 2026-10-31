import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { createHubModels, formatHubTime, hubPath } from './hub-model.mjs';

const approved = {
  '2025-singapore-gp': ['2025/singapore', 'Singapore Grand Prix', 'Marina Bay Street Circuit', '7b', "FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2025", "93917a792de0ad9038207a83b465e57e245a0326057dcf60db7a73b1482e683c", 556602],
  '2026-azerbaijan-gp': ['2026/azerbaijan', 'Azerbaijan Grand Prix', 'Baku City Circuit', '81', "FORMULA 1 QATAR AIRWAYS AZERBAIJAN GRAND PRIX 2026", "6e8c7953b9e92361a3efcce7b1022d65d89f74414320a2095b5168c7a0380206", 566502],
  '2026-bahrain-gp': ['2026/bahrain', 'Bahrain Grand Prix in Malaysia', 'Sepang International Circuit', '81', "FORMULA 1 GULF AIR BAHRAIN GRAND PRIX IN MALAYSIA 2026", "d15dcec7e33750d3a764a38c7f355ac7e1ae6146057618a43e75ea895980afe1", 548148],
  '2026-japanese-gp': ['2026/japan', 'Japanese Grand Prix', 'Suzuka Circuit', '81', "FORMULA 1 ARAMCO JAPANESE GRAND PRIX 2026", "d17142cbb09e6e944084c3a5a70460811521c0c070695c1a84084d4ccba466e2", 559724],
  '2026-mexican-gp': ['2026/mexico', 'Mexico City Grand Prix', 'Autódromo Hermanos Rodríguez', '7e', "FORMULA 1 GRAN PREMIO DE LA CIUDAD DE MÉXICO 2026", "6f9e4cc0d4c6104b96e5173d6a37b11b69f22952402755299c172edfc8f57d4a", 532152],
  '2026-singapore-gp': ['2026/singapore', 'Singapore Grand Prix', 'Marina Bay Street Circuit', '81', "FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2026", "8be83beaa8cad5c4a2d2edd7cae994a9c6acaa3334c41ff9dc4013aa47e5dcda", 565014],
};
// Digests pin the complete reviewed approval, independently of the source capture hash.
const approvalDigests = {
  '2025-singapore-gp': '345f74b3e6cb557359b3342510bc09b24cce3c2b15d67ac6d9ca6f451eef1dab',
  '2026-azerbaijan-gp': '3ccaae88110236803d068c928531bda8e882527ebb64b8d0bcb224acd7df78f1',
  '2026-bahrain-gp': 'cc26cc9abe2736c0357e01f4d6f484c24aeb7d9d851fe39d04c9d0f3ea607a45',
  '2026-japanese-gp': 'aa7a5859a85975c6910aa9b10c72da285e4dd5e66960a8fce047ca758ced6edb',
  '2026-mexican-gp': 'b3488cc10a4754d1faa7fcf687cbfc7f1ac05d0b4b39c2306e0047072684b8d6',
  '2026-singapore-gp': '28643718dbc6f608918717234d9a0b583aca7d4f192fe5554c2b0929976e4a87',
};
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
export const PUBLIC_RACE_IDS = Object.freeze(Object.keys(approved).sort());
const fail = message => { throw new TypeError(`Invalid hub publication evidence: ${message}`); };
const utc = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
// Reviewed capture fingerprints require an explicit code review when official evidence changes.
const identity = race => ({ raceId: race.raceId, season: race.season, eventName: race.eventName, displayName: race.displayName, venue: race.venue, sessions: race.sessions.map(({ kind, startUtc }) => ({ kind, startUtc })) });

/** Validate the complete approval set before returning any models to a writer. */
export function createPublicationModels(registry, sourceLock, evidence, options) {
  const models = createHubModels(registry, sourceLock, options);
  if (evidence?.schemaVersion !== 1 || !Array.isArray(evidence.approvals) || !isDeepStrictEqual(evidence.approvals.map(a => a?.raceId).sort(), PUBLIC_RACE_IDS)) fail('approval IDs must be the exact reviewed six');
  const byId = new Map(registry.races.map(race => [race.raceId, race]));
  for (const entry of evidence.approvals) {
    const race = byId.get(entry.raceId);
    if (!race || !isDeepStrictEqual(entry.localIdentity, identity(race))) fail(`registry drift for ${entry.raceId}`);
    const [slug, displayName, venueName, flight, title, sha256, bytes] = approved[entry.raceId];
    const source = entry.source;
    const url = `https://www.formula1.com/en/racing/${slug}`;
    if (source?.url !== url || source.finalUrl !== url || !utc(source.observedAt) || !/^[a-f0-9]{64}$/.test(source.sha256) || source.sha256 !== sha256 || source.bytes !== bytes || !Number.isSafeInteger(source.bytes) || source.bytes < 1) fail(`source proof for ${entry.raceId}`);
    const official = entry.official;
    if (!official || official.title !== title || official.meetingOfficialName !== official.title || official.circuitOfficialName !== venueName || official.titleReference !== 'application/ld+json[0]/name' || official.meetingReference !== `Flight/${flight}/meetingOfficialName` || official.circuitReference !== `Flight/${flight}/circuitOfficialName`) fail(`official identity for ${entry.raceId}`);
    if (!isDeepStrictEqual(entry.publicLabels, { displayName, venueName })) fail(`public labels for ${entry.raceId}`);
    if (entry.raceId === '2026-bahrain-gp' && (!official.title.includes('BAHRAIN GRAND PRIX IN MALAYSIA') || !entry.exclusions?.includes('JSON-LD location address is inconsistent; no country claim derived.'))) fail('Bahrain identity exclusions');
    if (!Array.isArray(official.sessions) || official.sessions.length !== race.sessions.length || !/^[+-]\d\d:\d\d$/.test(official.gmtOffset)) fail(`session evidence for ${entry.raceId}`);
    race.sessions.forEach((session, i) => {
      const proof = official.sessions[i];
      const names = { fp1: 'Practice 1', fp2: 'Practice 2', fp3: 'Practice 3', 'sprint-qualifying': 'Sprint Qualifying', sprint: 'Sprint', qualifying: 'Qualifying', race: 'Race' };
      if (!proof || proof.kind !== session.kind || proof.startUtc !== session.startUtc || !utc(proof.startUtc) || proof.name !== `${names[session.kind]} - ${displayName.replace(' in Malaysia', '')}` || proof.nameReference !== `application/ld+json[0]/subEvent/${i}/name` || proof.startReference !== `application/ld+json[0]/subEvent/${i}/startDate`) fail(`session order or UTC start for ${entry.raceId}`);
      if (formatHubTime(session.startUtc, race.venue.timeZone)?.offset !== `UTC${official.gmtOffset}`) fail(`venue offset for ${entry.raceId}`);
    });
    if (createHash('sha256').update(canonical(entry)).digest('hex') !== approvalDigests[entry.raceId]) fail(`unreviewed approval for ${entry.raceId}`);
  }
  return PUBLIC_RACE_IDS.map(raceId => {
    const entry = evidence.approvals.find(a => a.raceId === raceId);
    const model = models.find(m => m.raceId === raceId);
    return { ...model, path: hubPath(raceId), displayName: entry.publicLabels.displayName, venue: { ...model.venue, name: entry.publicLabels.venueName }, localIdentity: structuredClone(entry.localIdentity), scheduleEvidence: { ...entry.source, title: entry.official.title, titleReference: entry.official.titleReference, meetingReference: entry.official.meetingReference, circuitReference: entry.official.circuitReference, gmtOffset: entry.official.gmtOffset, timeZoneBasis: entry.official.timeZoneBasis, sessions: structuredClone(entry.official.sessions) } };
  });
}
