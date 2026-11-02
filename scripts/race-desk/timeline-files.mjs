import fs from 'node:fs';
import { readBounded } from './capture-files.mjs';
import { verifyCapture } from './capture.mjs';
import { buildTimelineContext, timestamp } from './timeline.mjs';

const fail = message => { throw new Error(`Timeline archive: ${message}`); };
const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('\0') === [...expected].sort().join('\0');
const text = value => typeof value === 'string' && value.trim().length > 0;
const positive = value => Number.isSafeInteger(value) && value > 0;
const timelineEndpoints = ['sessions', 'race_control', 'pit'];
// validateBatch checks receipts for both inventories; each reader restricts its own endpoints.
const endpoints = [...timelineEndpoints, 'laps', 'stints', 'drivers'];
const legacyOpenF1 = ['status', 'decidedBy', 'decidedOn', 'license', 'licenseUrl', 'terms', 'attribution'];
const paceKeys = ['status', 'decidedBy', 'decidedOn', 'raceId', 'sessionKind', 'meetingKey', 'sessionKey', 'endpoints', 'uses'];
const sameSet = (value, expected) => Array.isArray(value) && value.length === expected.length && new Set(value).size === value.length && expected.every(item => value.includes(item));
const calendarDay = value => typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
// R-07 pace scope is recorded separately from the R-06 provider approval; absent means unresolved.
const paceValid = pace => keys(pace, paceKeys) && ['approved', 'unresolved'].includes(pace.status) && text(pace.decidedBy) && calendarDay(pace.decidedOn) && text(pace.raceId)
  && pace.sessionKind === 'race' && positive(pace.meetingKey) && positive(pace.sessionKey) && sameSet(pace.endpoints, ['laps', 'stints', 'drivers']) && sameSet(pace.uses, ['stints', 'compounds', 'lap-times', 'descriptive-pace']);
const fields = ['schemaVersion', 'captureId', 'provider', 'endpoint', 'raceId', 'sessionKind', 'requestUrl', 'query', 'finalUrl', 'observedAt', 'httpStatus', 'path', 'sha256', 'bytes', 'rowCount', 'returnedIdentity', 'coverage', 'coverageReasons', 'codeRevision', 'synthetic'];
export const openF1Url = (endpoint, sessionKey) => `https://api.openf1.org/v1/${endpoint}?session_key=${sessionKey}`;

export function readTimelineInventory(root, registry) {
  const base = fs.realpathSync(root);
  const readJson = file => JSON.parse(readBounded(base, file, 5_000_000).toString('utf8'));
  const inventory = readJson('data/race-desk/timeline.v1.json');
  const rights = readJson('data/race-desk/publication-rights.v1.json');
  if (!keys(inventory, ['schemaVersion', 'captures']) || inventory.schemaVersion !== 1 || !Array.isArray(inventory.captures)) fail('invalid inventory');
  if (!keys(rights, ['schemaVersion', 'providers']) || rights.schemaVersion !== 1 || !keys(rights.providers, ['openf1', 'jolpica'])) fail('invalid rights');
  const openf1 = rights.providers.openf1, jolpica = rights.providers.jolpica;
  if (!(keys(openf1, legacyOpenF1) || (keys(openf1, [...legacyOpenF1, 'pace']) && paceValid(openf1.pace))) || !['approved', 'unresolved'].includes(openf1.status) || !['decidedBy', 'decidedOn', 'license', 'licenseUrl', 'terms', 'attribution'].every(key => text(openf1[key])) || !/^\d{4}-\d\d-\d\d$/.test(openf1.decidedOn) || openf1.license !== 'CC BY-NC-SA 4.0' || openf1.licenseUrl !== 'https://creativecommons.org/licenses/by-nc-sa/4.0/' || openf1.terms !== 'https://openf1.org/' || openf1.attribution !== 'OpenF1' || !keys(jolpica, ['status', 'note']) || !['approved', 'unresolved'].includes(jolpica.status) || !text(jolpica.note)) fail('invalid provider rights');
  if (!inventory.captures.every(receipt => timelineEndpoints.includes(receipt?.endpoint))) fail('invalid receipt');
  const payloads = validateBatch(inventory.captures, registry, receipt => readBounded(base, receipt.path, MAX_CAPTURE_BYTES));
  return { receipts: inventory.captures, payloads, rights };
}

// One limit for reading and for capture preflight, so capture can never write an archive the reader rejects.
export const MAX_CAPTURE_BYTES = 20_000_000;

export function validateBatch(receipts, registry, readBytes) {
  if (!Array.isArray(registry?.races)) fail('invalid registry');
  const races = new Map();
  for (const race of registry.races) {
    if (!text(race?.raceId) || races.has(race.raceId)) fail('invalid registry race');
    races.set(race.raceId, race);
  }
  const ids = new Set(), pairs = new Set(), paths = new Set(), payloads = new Map();
  for (const receipt of receipts) {
    if (!keys(receipt, fields) || receipt.schemaVersion !== 1 || !text(receipt.captureId) || receipt.provider !== 'openf1' || !endpoints.includes(receipt.endpoint) || receipt.sessionKind !== 'race' || receipt.synthetic !== false || !/^[a-f0-9]{40}$/.test(receipt.codeRevision ?? '') || receipt.httpStatus !== 200 || !Number.isSafeInteger(receipt.rowCount) || receipt.rowCount < 0 || !Array.isArray(receipt.coverageReasons) || !receipt.coverageReasons.every(text) || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(receipt.observedAt ?? '')) fail('invalid receipt');
    timestamp(receipt.observedAt);
    if ((receipt.coverage === 'partial' && receipt.coverageReasons.length === 0) || (['full', 'empty'].includes(receipt.coverage) && receipt.coverageReasons.length !== 0) || !['full', 'partial', 'empty'].includes(receipt.coverage)) fail('coverage mismatch');
    const race = races.get(receipt.raceId), sessions = race?.sessions?.filter(session => session.kind === 'race');
    const meetingKey = race?.sourceKeys?.openf1MeetingKey, sessionKey = sessions?.[0]?.openf1SessionKey;
    if (sessions?.length !== 1 || !positive(meetingKey) || !positive(sessionKey)) fail('unmapped receipt');
    const url = openF1Url(receipt.endpoint, sessionKey);
    if (!keys(receipt.query, ['session_key']) || receipt.query.session_key !== sessionKey || receipt.requestUrl !== url || !(receipt.finalUrl === null || receipt.finalUrl === url)) fail('invalid request');
    if (!/^data\/race-desk\/captures\/openf1\/[A-Za-z0-9_-]+\.response$/.test(receipt.path)) fail('unsafe capture path');
    const pair = `${receipt.raceId}\0${sessionKey}\0${receipt.endpoint}`;
    if (ids.has(receipt.captureId) || pairs.has(pair) || paths.has(receipt.path)) fail('duplicate capture');
    ids.add(receipt.captureId); pairs.add(pair); paths.add(receipt.path);
    const bytes = readBytes(receipt);
    if (bytes.length > MAX_CAPTURE_BYTES) fail('capture too large');
    const rows = verifyCapture(bytes, receipt);
    if (!Array.isArray(rows) || rows.length !== receipt.rowCount) fail('row count mismatch');
    if ((rows.length === 0 && receipt.coverage !== 'empty') || (rows.length > 0 && !['full', 'partial'].includes(receipt.coverage))) fail('coverage mismatch');
    if (rows.length === 0) {
      if (receipt.returnedIdentity !== null) fail('empty response identity');
    } else {
      if (!keys(receipt.returnedIdentity, ['meeting_key', 'session_key']) || receipt.returnedIdentity.meeting_key !== meetingKey || receipt.returnedIdentity.session_key !== sessionKey || rows.some(row => row?.meeting_key !== meetingKey || row?.session_key !== sessionKey)) fail('identity mismatch');
    }
    payloads.set(receipt.captureId, rows);
  }
  return payloads;
}

export function readTimelineContexts(root, registry) {
  const { receipts, payloads, rights } = readTimelineInventory(root, registry);
  return new Map(registry.races.map(race => [race.raceId, buildTimelineContext({ race, receipts: receipts.filter(item => item.raceId === race.raceId), payloads, rights })]));
}
