import { createHash } from 'node:crypto';
import { normalizeSessionKind } from './core/index.mjs';

// Reject oversized provider messages rather than silently truncate them.
const MAX_MESSAGE_LENGTH = 2000;
const labels = { Flag: 'Σημαία', SafetyCar: 'Safety Car / VSC', SessionStatus: 'Κατάσταση συνεδρίας', Other: 'Μήνυμα αγωνοδιεύθυνσης' };
const fail = message => { throw new Error(`Invalid timeline: ${message}`); };

function timestamp(value) {
  if (typeof value !== 'string') fail('timestamp');
  const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,6}))?(Z|[+-]\d\d:\d\d)$/.exec(value);
  if (!m) fail('timestamp');
  const [, y, mo, d, h, mi, s, fraction = '', zone] = m;
  const local = new Date(0);
  local.setUTCFullYear(+y, +mo - 1, +d);
  local.setUTCHours(+h, +mi, +s, 0);
  if (local.getUTCFullYear() !== +y || local.getUTCMonth() !== +mo - 1 || local.getUTCDate() !== +d || local.getUTCHours() !== +h || local.getUTCMinutes() !== +mi || local.getUTCSeconds() !== +s) fail('timestamp');
  let offset = 0;
  if (zone !== 'Z') {
    const hours = +zone.slice(1, 3), minutes = +zone.slice(4, 6);
    if (hours > 23 || minutes > 59) fail('timestamp offset');
    offset = (hours * 60 + minutes) * (zone[0] === '+' ? 1 : -1);
  }
  const utc = new Date(local.getTime() - offset * 60000).toISOString();
  if (!/^\d{4}-/.test(utc)) fail('timestamp range');
  return `${utc.slice(0, 19)}.${fraction.padEnd(6, '0')}Z`;
}

function optionalInteger(value, min, max) {
  if (value == null) return null;
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('integer');
  return value;
}
function duration(value) {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) fail('duration');
  return value;
}
function pitDetail(row) {
  const lane = duration(row.lane_duration), alias = duration(row.pit_duration), stop = duration(row.stop_duration);
  if (lane !== null && alias !== null && lane !== alias) fail('duration conflict');
  const format = n => new Intl.NumberFormat('el-GR', { maximumFractionDigits: 20, useGrouping: false }).format(n);
  const parts = [];
  if ((lane ?? alias) !== null) parts.push(`Χρόνος στο pit lane: ${format(lane ?? alias)} s`);
  if (stop !== null) parts.push(`ακινητοποίηση: ${format(stop)} s`);
  return parts.length ? parts.join(' · ') : null;
}
// Object key order is not a property of a provider observation.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function buildTimelineContext({ race, receipts, payloads, rights } = {}) {
  if (!race || !Array.isArray(race.sessions) || !Array.isArray(receipts) || !(payloads instanceof Map)) fail('input');
  const raceSession = race.sessions.find(s => normalizeSessionKind(s.kind) === 'race');
  const meetingKey = race.sourceKeys?.openf1MeetingKey, sessionKey = raceSession?.openf1SessionKey;
  if (meetingKey == null || sessionKey == null) return { status: 'unavailable', reason: 'unmapped' };
  if (!receipts.length) return { status: 'unavailable', reason: 'uncaptured' };
  if (rights?.providers?.openf1?.status !== 'approved') return { status: 'unavailable', reason: 'rights-unresolved' };
  const byEndpoint = new Map();
  for (const receipt of receipts) {
    if (receipt.raceId !== race.raceId || receipt.sessionKind !== 'race' || receipt.provider !== 'openf1' || !['sessions', 'race_control', 'pit'].includes(receipt.endpoint) || byEndpoint.has(receipt.endpoint)) fail('receipt identity');
    if (receipt.query?.session_key != sessionKey) fail('receipt session');
    const rows = payloads.get(receipt.captureId);
    if (!Array.isArray(rows) || rows.length !== receipt.rowCount) fail('payload');
    if (receipt.returnedIdentity !== null && (receipt.returnedIdentity?.meeting_key !== meetingKey || receipt.returnedIdentity?.session_key !== sessionKey)) fail('returned identity');
    for (const row of rows) if (!row || typeof row !== 'object' || row.meeting_key !== meetingKey || row.session_key !== sessionKey) fail('row identity');
    byEndpoint.set(receipt.endpoint, { receipt, rows });
  }
  const sessionRows = byEndpoint.get('sessions')?.rows;
  if (!sessionRows || sessionRows.length !== 1) fail('session window');
  const session = sessionRows[0];
  if (session.session_name !== 'Race' || session.session_type !== 'Race') fail('session kind');
  const windowStartUtc = timestamp(session.date_start), windowEndUtc = timestamp(session.date_end);
  if (windowStartUtc > windowEndUtc) fail('session window');
  const counts = { raceControl: byEndpoint.get('race_control')?.rows.length ?? 0, pit: byEndpoint.get('pit')?.rows.length ?? 0, outOfWindow: 0, duplicates: 0 };
  const events = [];
  for (const endpoint of ['race_control', 'pit']) {
    const capture = byEndpoint.get(endpoint);
    if (!capture) continue;
    const seen = new Map();
    capture.rows.forEach((row, recordIndex) => {
      const time = timestamp(row.date);
      const lapNumber = optionalInteger(row.lap_number, 0, Number.MAX_SAFE_INTEGER);
      const driverNumber = optionalInteger(row.driver_number, 1, 99);
      let category = null, detail;
      if (endpoint === 'race_control') {
        if (row.category != null && typeof row.category !== 'string') fail('category');
        if (row.message != null && (typeof row.message !== 'string' || row.message.length > MAX_MESSAGE_LENGTH)) fail('message');
        category = row.category ?? null; detail = row.message ?? null;
      } else detail = pitDetail(row);
      if (time < windowStartUtc || time > windowEndUtc) { counts.outOfWindow++; return; }
      const key = canonical(row), previous = seen.get(key);
      if (previous) { previous.sourceRefs.push({ captureId: capture.receipt.captureId, recordIndex }); counts.duplicates++; return; }
      const idInput = [race.raceId, 'race', 'openf1', endpoint, capture.receipt.sha256, recordIndex].join('|');
      const event = { schemaVersion: 1, eventId: `tl-${createHash('sha256').update(idInput).digest('hex')}`, raceId: race.raceId, sessionKind: 'race', eventType: endpoint === 'pit' ? 'pit-lane-visit' : 'race-control-observation', provider: 'openf1', timestampUtc: time, lapNumber, driverNumber, category, label: endpoint === 'pit' ? 'Διέλευση από το pit lane' : (Object.hasOwn(labels, category) ? labels[category] : 'Μήνυμα'), detail, sourceRefs: [{ captureId: capture.receipt.captureId, recordIndex }], coverage: 'full' };
      seen.set(key, event); events.push(event);
    });
  }
  events.sort((a, b) => a.timestampUtc < b.timestampUtc ? -1 : a.timestampUtc > b.timestampUtc ? 1 : 0);
  const coverage = !byEndpoint.has('race_control') || !byEndpoint.has('pit') || counts.outOfWindow ? 'partial' : counts.raceControl === 0 && counts.pit === 0 ? 'empty' : 'full';
  for (const event of events) event.coverage = coverage === 'partial' ? 'partial' : 'full';
  const sources = [...byEndpoint.values()].map(({ receipt }) => ({ endpoint: receipt.endpoint, requestUrl: receipt.requestUrl, observedAt: receipt.observedAt, rowCount: receipt.rowCount })).sort((a, b) => a.endpoint.localeCompare(b.endpoint, 'en'));
  return { status: 'available', coverage, provider: 'openf1', session: { kind: 'race', meetingKey, sessionKey, windowStartUtc, windowEndUtc }, sources, counts, attribution: { name: 'OpenF1', url: 'https://openf1.org/', license: 'CC BY-NC-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' }, events };
}
