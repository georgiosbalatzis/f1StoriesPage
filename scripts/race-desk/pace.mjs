import { buildTimelineContext, timestamp } from './timeline.mjs';
import { normalizeSessionKind } from './core/index.mjs';

export const PACE_LAP_REASONS = ['duration-null', 'duration-missing', 'duration-invalid-type', 'duration-nonfinite', 'duration-nonpositive', 'duration-out-of-range', 'sector-sum-mismatch', 'opening-lap', 'pit-in', 'pit-out', 'lap-conflict', 'driver-identity-missing', 'driver-identity-conflicting', 'stint-unassigned', 'stint-overlap', 'stint-integrity-unresolved', 'compound-unknown', 'pit-out-unknown', 'pit-boundary-uncertain', 'sector-invalid', 'lap-start-missing', 'lap-start-invalid', 'lap-start-outside-session', 'neutralisation-unresolved', 'sector-check-unavailable'];
const EXCLUDED_REASONS = new Set(['duration-null', 'duration-missing', 'duration-invalid-type', 'duration-nonfinite', 'duration-nonpositive', 'duration-out-of-range', 'sector-sum-mismatch', 'opening-lap', 'pit-in', 'pit-out']);
export const PACE_COVERAGE_REASONS = ['source-partial', 'stints-missing', 'drivers-missing', 'pit-missing', 'laps-missing', 'missing-laps', 'unassigned-laps', 'lap-conflicts', 'identity-missing', 'identity-conflicting', 'stint-gap', 'stint-overlap', 'stint-invalid-interval', 'stint-unverified', 'stint-bounds-unknown', 'compound-unknown', 'tyre-age-unknown', 'sector-sum-mismatch', 'lap-start-anomaly', 'neutralisation-unresolved', 'no-observations'];
const fail = message => { throw new Error(`Invalid pace: ${message}`); };
const ordered = (codes, order) => order.filter(code => codes.has(code));
const validPositive = n => typeof n === 'number' && Number.isFinite(n) && n > 0;
const integer = n => Number.isSafeInteger(n) && n > 0;
const ms = n => Math.floor(n * 1000 + 0.5 + 1e-9);
const emptyCounts = () => ({ observed: 0, timed: 0, excluded: 0, unknown: 0, eligible: 0 });
const canonical = v => typeof v === 'number' && !Number.isFinite(v) ? String(v) : Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : `${typeof v}:${JSON.stringify(v)}`;
const time = value => { try { return timestamp(value); } catch { fail('timestamp'); } };
export function summarizeDurations(seconds) {
  if (!Array.isArray(seconds) || seconds.some(n => !validPositive(n) || n > 86400)) fail('durations');
  const a = [...seconds].sort((x, y) => x - y), n = a.length;
  return { count: n, minMs: n ? ms(a[0]) : null, medianMs: n < 3 ? null : ms(n % 2 ? a[(n - 1) / 2] : a[n / 2 - 1] + (a[n / 2] - a[n / 2 - 1]) / 2) };
}
const ranges = (numbers, first, last) => {
  const result = []; let next = first;
  for (const n of numbers) { if (n < first || n > last) continue; if (n > next) result.push({ from: next, to: n - 1 }); next = n + 1; }
  if (next <= last) result.push({ from: next, to: last });
  return result;
};
const countsOf = laps => laps.reduce((c, lap) => { c.observed++; if (lap.seconds !== null) c.timed++; c[lap.eligibility.toLowerCase()]++; return c; }, emptyCounts());
const sampleOf = laps => ({ status: laps.some(l => l.eligibility === 'UNKNOWN') ? 'unsuitable' : 'empty', reasons: laps.some(l => l.eligibility === 'UNKNOWN') ? ['neutralisation-unresolved'] : [], summary: summarizeDurations([]) });

export function buildPaceContext({ race, receipts, payloads, rights } = {}) {
  if (!race || !Array.isArray(race.sessions) || !Array.isArray(receipts) || !(payloads instanceof Map)) fail('input');
  const unavailable = reason => ({ schemaVersion: 1, raceId: race.raceId, status: 'unavailable', reason });
  let sessions;
  try { sessions = race.sessions.filter(s => normalizeSessionKind(s.kind) === 'race'); } catch { fail('registry session'); }
  const meetingKey = race.sourceKeys?.openf1MeetingKey, sessionKey = sessions[0]?.openf1SessionKey;
  if (meetingKey == null || sessionKey == null) return unavailable('unmapped');
  if (sessions.length !== 1 || !integer(meetingKey) || !integer(sessionKey)) fail('registry identity');
  if (race.raceId === '2026-singapore-gp' && (meetingKey !== 1296 || sessionKey !== 11388 || !sessions[0].evidence?.some(e => e.field === 'openf1SessionKey' && e.value === sessionKey && e.status === 'verified' && e.sourceId === 'openf1-2026-singapore-identity') || !race.evidence?.some(e => e.field === 'sourceKeys.openf1MeetingKey' && e.value === meetingKey && e.status === 'verified' && e.sourceId === 'openf1-2026-singapore-identity'))) fail('mapping evidence');
  const by = new Map();
  for (const receipt of receipts) {
    if (!receipt || receipt.raceId !== race.raceId || receipt.sessionKind !== 'race' || receipt.provider !== 'openf1' || !['sessions', 'laps', 'stints', 'drivers', 'pit', 'race_control'].includes(receipt.endpoint) || by.has(receipt.endpoint) || receipt.query?.session_key != sessionKey) fail('receipt identity');
    const rows = payloads.get(receipt.captureId);
    if (!Array.isArray(rows) || rows.length !== receipt.rowCount || (rows.length ? receipt.returnedIdentity?.meeting_key !== meetingKey || receipt.returnedIdentity?.session_key !== sessionKey : receipt.returnedIdentity !== null)) fail('payload identity');
    for (const row of rows) if (!row || typeof row !== 'object' || Array.isArray(row) || row.meeting_key !== meetingKey || row.session_key !== sessionKey) fail('row identity');
    by.set(receipt.endpoint, { receipt, rows });
  }
  if (!by.has('sessions') || !by.has('laps')) return unavailable('uncaptured');
  const sessionRows = by.get('sessions').rows;
  if (sessionRows.length !== 1) fail('session window');
  const session = sessionRows[0], windowStartUtc = time(session.date_start), windowEndUtc = time(session.date_end);
  if (session.session_name !== 'Race' || session.session_type !== 'Race' || session.year !== race.season || session.is_cancelled === true || windowStartUtc >= windowEndUtc || windowStartUtc !== time(sessions[0].startUtc)) fail('session identity');
  buildTimelineContext({ race, receipts: receipts.filter(r => ['sessions', 'pit', 'race_control'].includes(r.endpoint)), payloads, rights });
  const diagnostics = [], driverMap = new Map(); let exactDuplicateRows = 0, conflictingLapKeys = 0, unassignedLaps = 0, outOfWindowControlRows = 0;
  const diag = (code, driverNumber, stintNumber, lapNumber, sourceRefs = []) => diagnostics.push({ code, driverNumber, stintNumber, lapNumber, sourceRefs: [...sourceRefs].sort((a, b) => a.captureId.localeCompare(b.captureId) || a.recordIndex - b.recordIndex) });
  const driver = n => { if (!integer(n) || n > 99) fail('driver number'); if (!driverMap.has(n)) driverMap.set(n, { n, roster: new Map(), lapKeys: new Map(), stintKeys: new Map(), pits: new Set() }); return driverMap.get(n); };
  const add = (endpoint, key, mapName) => {
    const capture = by.get(endpoint); if (!capture) return;
    capture.rows.forEach((row, recordIndex) => {
      const d = driver(row.driver_number), k = key(row), map = d[mapName], canonicalRow = canonical(row), ref = { captureId: capture.receipt.captureId, recordIndex };
      if (!map.has(k)) map.set(k, new Map());
      const variants = map.get(k); if (variants.has(canonicalRow)) { variants.get(canonicalRow).refs.push(ref); exactDuplicateRows++; } else variants.set(canonicalRow, { row, refs: [ref] });
    });
  };
  add('drivers', () => 0, 'roster');
  add('laps', row => { if (!integer(row.lap_number)) fail('lap number'); return row.lap_number; }, 'lapKeys');
  add('stints', row => { if (!integer(row.stint_number)) fail('stint number'); for (const n of [row.lap_start, row.lap_end]) if (n != null && !integer(n)) fail('stint bounds'); return row.stint_number; }, 'stintKeys');
  for (const row of by.get('pit')?.rows ?? []) { if (!integer(row.driver_number) || row.driver_number > 99 || !integer(row.lap_number)) fail('pit identity'); driverMap.get(row.driver_number)?.pits.add(row.lap_number); }
  for (const row of by.get('race_control')?.rows ?? []) { const t = time(row.date); if (t < windowStartUtc || t > windowEndUtc) outOfWindowControlRows++; }
  const sourceReasons = new Set();
  if ([...by.values()].some(x => x.receipt.coverage === 'partial')) sourceReasons.add('source-partial');
  for (const endpoint of ['stints', 'drivers', 'pit']) if (!by.has(endpoint) || (endpoint !== 'pit' && !by.get(endpoint).rows.length)) sourceReasons.add(`${endpoint}-missing`);
  if (!by.get('laps').rows.length) sourceReasons.add('laps-missing');
  const drivers = [], allLaps = [], raceReasons = new Set(sourceReasons);
  for (const d of [...driverMap.values()].sort((a, b) => a.n - b.n)) {
    const roster = d.roster.get(0), identity = !roster ? 'missing' : roster.size > 1 ? 'conflicting' : 'verified', meta = identity === 'verified' ? [...roster.values()][0].row : {};
    const reasons = new Set(sourceReasons); if (identity !== 'verified') reasons.add(`identity-${identity}`); if (!d.stintKeys.size) reasons.add('stints-missing'); if (!d.lapKeys.size) reasons.add('no-observations');
    const laps = [...d.lapKeys].sort((a, b) => a[0] - b[0]).map(([n, variants]) => {
      const refs = [...variants.values()].flatMap(v => v.refs), conflict = variants.size > 1, row = [...variants.entries()].sort(([a], [b]) => a.localeCompare(b))[0][1].row, codes = new Set();
      if (conflict) { conflictingLapKeys++; codes.add('lap-conflict'); diag('lap-conflict', d.n, null, n, refs); }
      const duration = row.lap_duration;
      if (!conflict) {
        if (!Object.hasOwn(row, 'lap_duration')) codes.add('duration-missing'); else if (duration === null) codes.add('duration-null'); else if (typeof duration !== 'number') codes.add('duration-invalid-type'); else if (!Number.isFinite(duration)) codes.add('duration-nonfinite'); else if (duration <= 0) codes.add('duration-nonpositive'); else if (duration > 86400) codes.add('duration-out-of-range');
      }
      const seconds = !conflict && validPositive(duration) && duration <= 86400 ? duration : null;
      const sectors = [row.duration_sector_1, row.duration_sector_2, row.duration_sector_3];
      if (!conflict && sectors.some(s => s != null && !validPositive(s))) codes.add('sector-invalid');
      if (!conflict && seconds !== null && !codes.has('sector-invalid') && sectors.some(s => s == null)) codes.add('sector-check-unavailable');
      if (!conflict && seconds !== null && sectors.every(validPositive) && Math.abs(sectors.reduce((a, b) => a + b, 0) - seconds) > 0.003 + 1e-9) codes.add('sector-sum-mismatch');
      if (n === 1) codes.add('opening-lap'); if (d.pits.has(n)) codes.add('pit-in');
      if (!conflict && row.is_pit_out_lap === true) codes.add('pit-out'); else if (conflict || typeof row.is_pit_out_lap !== 'boolean') codes.add('pit-out-unknown');
      if (identity !== 'verified') codes.add(`driver-identity-${identity}`);
      if (conflict) {} else if (row.date_start == null) codes.add('lap-start-missing'); else { try { const t = timestamp(row.date_start); if (t < windowStartUtc || t > windowEndUtc) codes.add('lap-start-outside-session'); } catch { codes.add('lap-start-invalid'); } }
      return { n, row, refs, seconds, codes, conflict };
    });
    const stints = [...d.stintKeys].sort((a, b) => a[0] - b[0]).map(([n, variants]) => {
      const first = [...variants.entries()].sort(([a], [b]) => a.localeCompare(b))[0][1], row = first.row, start = row.lap_start ?? null, end = row.lap_end ?? null, sr = new Set();
      let integrity = variants.size > 1 || (start !== null && end !== null && start > end) ? 'inconsistent' : start === null || end === null ? 'unknown' : 'validated';
      if (integrity === 'inconsistent') sr.add('stint-invalid-interval'); if (integrity === 'unknown') sr.add('stint-bounds-unknown');
      const compound = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'].includes(row.compound) ? row.compound : null;
      const age = Number.isSafeInteger(row.tyre_age_at_start) && row.tyre_age_at_start >= 0 ? row.tyre_age_at_start : null;
      if (compound === null) sr.add('compound-unknown'); if (age === null) sr.add('tyre-age-unknown');
      if (integrity === 'validated' && sr.size) integrity = 'partial';
      return { n, start, end, compound, age, integrity, reasons: sr, refs: [...variants.values()].flatMap(v => v.refs) };
    });
    const promote = (s, state, reason) => { const ranks = ['validated', 'partial', 'unverified', 'unknown', 'inconsistent']; if (ranks.indexOf(state) > ranks.indexOf(s.integrity)) s.integrity = state; s.reasons.add(reason); };
    for (let i = 0; i < stints.length; i++) {
      const s = stints[i], prev = stints[i - 1];
      if (s.n !== (prev?.n ?? 0) + 1) promote(s, 'partial', 'stint-gap');
      if (!prev) continue;
      if (prev.start === null || prev.end === null || s.start === null || s.end === null) {
        if (prev.start !== null && prev.end !== null) promote(prev, 'unverified', 'stint-unverified');
        if (s.start !== null && s.end !== null) promote(s, 'unverified', 'stint-unverified');
        continue;
      }
      if (s.start <= prev.end) { promote(prev, 'inconsistent', 'stint-overlap'); promote(s, 'inconsistent', 'stint-overlap'); }
      else if (s.start > prev.end + 1) { promote(prev, 'partial', 'stint-gap'); promote(s, 'partial', 'stint-gap'); }
      const out = laps.find(l => l.n === s.start);
      if (s.start !== prev.end + 1 || !d.pits.has(s.start - 1) || !out || out.conflict || out.row.is_pit_out_lap !== true) { promote(prev, 'unverified', 'stint-unverified'); promote(s, 'unverified', 'stint-unverified'); }
    }
    for (let i = 0; i < stints.length; i++) for (let j = i + 1; j < stints.length; j++) {
      const a = stints[i], b = stints[j];
      if (a.start !== null && a.end !== null && b.start !== null && b.end !== null && a.start <= a.end && b.start <= b.end && a.start <= b.end && b.start <= a.end) { promote(a, 'inconsistent', 'stint-overlap'); promote(b, 'inconsistent', 'stint-overlap'); }
    }
    for (const pit of d.pits) {
      const out = laps.find(l => l.n === pit + 1);
      if (!out || out.conflict || out.row.is_pit_out_lap !== true) continue;
      if (!stints.some((s, i) => i && s.start === pit + 1 && stints[i - 1].end === pit)) for (const s of stints) if (s.start !== null && s.end !== null && pit >= s.start && pit <= s.end) promote(s, 'unverified', 'stint-unverified');
    }
    for (const lap of laps) {
      const matches = stints.filter(s => s.start !== null && s.end !== null && s.start <= s.end && lap.n >= s.start && lap.n <= s.end);
      lap.stint = matches.length === 1 ? matches[0] : null;
      if (!matches.length) { lap.codes.add('stint-unassigned'); unassignedLaps++; reasons.add('unassigned-laps'); } else if (matches.length > 1) lap.codes.add('stint-overlap');
      if (lap.stint) { if (['unverified', 'inconsistent', 'unknown'].includes(lap.stint.integrity)) lap.codes.add('stint-integrity-unresolved'); if (!lap.stint.compound) lap.codes.add('compound-unknown'); if (lap.stint.integrity === 'unverified') lap.codes.add('pit-boundary-uncertain'); }
      if (!by.has('pit')) lap.codes.add('pit-boundary-uncertain');
      if (lap.codes.has('sector-sum-mismatch')) reasons.add('sector-sum-mismatch');
      if (['lap-start-missing', 'lap-start-invalid', 'lap-start-outside-session'].some(c => lap.codes.has(c))) reasons.add('lap-start-anomaly');
      if (lap.conflict) reasons.add('lap-conflicts');
      for (const code of lap.codes) if (code !== 'lap-conflict') diag(code, d.n, lap.stint?.n ?? null, lap.n, lap.refs);
      const excluded = [...EXCLUDED_REASONS].some(c => lap.codes.has(c));
      if (!excluded) lap.codes.add('neutralisation-unresolved');
      lap.eligibility = excluded ? 'EXCLUDED' : 'UNKNOWN';
    }
    const nums = laps.map(l => l.n), missing = nums.length ? ranges(nums, 1, nums.at(-1)) : [];
    if (missing.length) reasons.add('missing-laps');
    const stintOutput = stints.map((s, i) => {
      const contained = s.start !== null && s.end !== null && s.start <= s.end ? laps.filter(l => l.n >= s.start && l.n <= s.end) : [];
      const missingRanges = s.start !== null && s.end !== null && s.start <= s.end ? ranges(contained.map(l => l.n), s.start, s.end) : [];
      if (contained.some(l => l.conflict)) s.reasons.add('lap-conflicts');
      if (contained.some(l => l.codes.has('sector-sum-mismatch'))) s.reasons.add('sector-sum-mismatch');
      if (contained.some(l => ['lap-start-missing', 'lap-start-invalid', 'lap-start-outside-session'].some(c => l.codes.has(c)))) s.reasons.add('lap-start-anomaly');
      if (missingRanges.length) promote(s, 'partial', 'missing-laps');
      if (i === stints.length - 1 && laps.some(l => l.n > (s.end ?? Infinity))) promote(s, 'partial', 'unassigned-laps');
      for (const r of sourceReasons) s.reasons.add(r); for (const r of s.reasons) reasons.add(r);
      if (identity !== 'verified') s.reasons.add(`identity-${identity}`);
      if (!contained.length) s.reasons.add('no-observations');
      for (const code of s.reasons) if (!sourceReasons.has(code)) diag(code, d.n, s.n, null, s.refs);
      const raw = identity === 'verified' && ['validated', 'partial'].includes(s.integrity) ? summarizeDurations(contained.filter(l => l.stint === s && l.seconds !== null && !l.codes.has('sector-sum-mismatch')).map(l => l.seconds)) : null;
      return { stintNumber: s.n, lapStart: s.start, lapEnd: s.end, compound: s.compound, tyreAgeAtStart: s.age, integrity: s.integrity, coverage: !contained.length ? 'empty' : s.reasons.size ? 'partial' : 'full', coverageReasons: ordered(s.reasons, PACE_COVERAGE_REASONS), missingLapRanges: missingRanges, counts: countsOf(contained), rawSummary: raw, sample: sampleOf(contained), pitInLaps: [...d.pits].filter(n => s.start !== null && s.end !== null && n >= s.start && n <= s.end).sort((a, b) => a - b) };
    });
    for (const r of reasons) raceReasons.add(r);
    allLaps.push(...laps);
    drivers.push({ driverNumber: d.n, identity, name: typeof meta.full_name === 'string' ? meta.full_name : null, acronym: typeof meta.name_acronym === 'string' ? meta.name_acronym : null, team: typeof meta.team_name === 'string' ? meta.team_name : null, coverage: !laps.length ? 'empty' : reasons.size ? 'partial' : 'full', coverageReasons: ordered(reasons, PACE_COVERAGE_REASONS), lapRange: nums.length ? { first: nums[0], last: nums.at(-1) } : null, missingLapRanges: missing, counts: countsOf(laps), sample: sampleOf(laps), stints: stintOutput, laps: laps.map(l => ({ lapNumber: l.n, stintNumber: l.stint?.n ?? null, durationMs: l.seconds === null ? null : ms(l.seconds), eligibility: l.eligibility, reasonCodes: ordered(l.codes, PACE_LAP_REASONS) })) });
  }
  const scope = rights?.providers?.openf1, pace = scope?.pace;
  if (scope?.status !== 'approved' || pace?.status !== 'approved' || pace.raceId !== race.raceId || pace.meetingKey !== meetingKey || pace.sessionKey !== sessionKey || pace.sessionKind !== 'race') return unavailable('rights-unresolved');
  diagnostics.sort((a, b) => a.code.localeCompare(b.code) || (a.driverNumber ?? 0) - (b.driverNumber ?? 0) || (a.stintNumber ?? 0) - (b.stintNumber ?? 0) || (a.lapNumber ?? 0) - (b.lapNumber ?? 0));
  return { schemaVersion: 1, raceId: race.raceId, status: 'available', provider: 'openf1', session: { kind: 'race', meetingKey, sessionKey, windowStartUtc, windowEndUtc }, coverage: !allLaps.length ? 'empty' : raceReasons.size ? 'partial' : 'full', coverageReasons: ordered(raceReasons, PACE_COVERAGE_REASONS), policy: { id: 'r07-observed-v1', neutralisation: 'unresolved' }, sources: [...by].map(([endpoint, { receipt }]) => ({ endpoint, observedAt: receipt.observedAt, rowCount: receipt.rowCount, coverage: receipt.coverage })).sort((a, b) => a.endpoint.localeCompare(b.endpoint)), counts: countsOf(allLaps), normalization: { exactDuplicateRows, conflictingLapKeys, unassignedLaps, outOfWindowControlRows }, drivers, attribution: { name: 'OpenF1', url: 'https://openf1.org/', license: 'CC BY-NC-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' }, diagnostics };
}
