import { verifyCapture } from './capture.mjs';

const kinds = { race: ['results', 'Results'], qualifying: ['qualifying', 'QualifyingResults'], sprint: ['sprint', 'SprintResults'] };
const present = value => typeof value === 'string' && value.trim().length > 0;
const decimal = value => typeof value === 'string' && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value);
const integer = value => typeof value === 'string' && /^(?:0|[1-9]\d*)$/.test(value) && Number.isSafeInteger(Number(value));
const positive = value => integer(value) && Number(value) > 0;
const utc = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 19) === value.slice(0, 19);
};
const invalid = (errors, source) => ({ status: 'invalid', errors, source: source ?? null });
const unavailable = (reason, source) => ({ status: 'unavailable', reason, source: source ?? null });
const error = (errors, code, path) => errors.push({ code, path });
const canonicalInteger = value => (typeof value === 'string' || typeof value === 'number') && integer(String(value));
const same = (a, b) => canonicalInteger(a) && canonicalInteger(b) && String(a) === String(b);
const validSeason = value => canonicalInteger(value) && Number(value) >= 1950 && Number(value) <= 2100;

function urlMatches(value, pathname, allowQuery = true) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'api.jolpi.ca' && !url.port && !url.username && !url.password && !url.hash && url.pathname === pathname && (allowQuery || !url.search);
  } catch { return false; }
}
function bytesAndJson(raw, capture, errors) {
  try { return verifyCapture(raw, capture); }
  catch (failure) {
    for (const issue of failure.issues) error(errors, issue.code, issue.path);
    return failure.parsed ?? null;
  }
}
function pagination(mr, count, errors, path) {
  if (!integer(mr?.offset) || mr.offset !== '0' || !integer(mr?.total) || !integer(mr?.limit) || Number(mr.total) !== count || Number(mr.limit) < count) error(errors, 'incomplete-pagination', path);
}
function rank(row, errors, path, providerOrder = false) {
  if (!present(row?.positionText)) { error(errors, 'invalid-rank', `${path}.positionText`); return null; }
  // Jolpica classification rows retain source order for unranked finishers.
  if (['-', 'R', 'D', 'W', 'E', 'F', 'N'].includes(row.positionText) && (row.position == null || (providerOrder && row.positionText !== '-' && positive(row.position)))) return null;
  if (!positive(row.position) || row.positionText !== row.position) { error(errors, 'invalid-rank', `${path}.position`); return null; }
  return Number(row.position);
}
function driver(d, errors, path) {
  if (!present(d?.driverId) || !present(d?.givenName) || !present(d?.familyName) || (d?.code != null && !present(d.code))) error(errors, 'invalid-identity', path);
  return { driverId: d?.driverId, driverName: `${d?.givenName ?? ''} ${d?.familyName ?? ''}`.trim(), driverCode: d?.code ?? null };
}
function constructor(c, errors, path) {
  if (!present(c?.constructorId) || !present(c?.name)) error(errors, 'invalid-identity', path);
  return { constructorId: c?.constructorId, constructorName: c?.name };
}
function unique(id, ids, errors, path) {
  if (ids.has(id)) error(errors, 'duplicate-entity', path);
  ids.add(id);
}
function optionalUnsignedInteger(value, errors, path) {
  if (value == null) return null;
  if (!integer(value)) error(errors, 'invalid-field', path);
  return value;
}
function optionalString(value, errors, path) {
  if (value == null) return null;
  if (!present(value)) error(errors, 'invalid-field', path);
  return value;
}

export function adaptJolpicaClassification({ race, sessionKind, capture, raw } = {}) {
  const source = capture ?? null;
  if (!race?.sourceKeys?.jolpica) return unavailable('unmapped-race', source);
  if (!capture) return unavailable('uncaptured-session', null);
  const errors = [], mapping = race.sourceKeys.jolpica, binding = race.resultsBinding, kind = kinds[sessionKind];
  if (!kind) return invalid([{ code: 'session-mismatch', path: 'sessionKind' }], source);
  if (!validSeason(mapping.season) || !(canonicalInteger(mapping.round) && Number(mapping.round) > 0) || !binding || binding.raceId !== race.raceId || !same(binding.season, mapping.season) || !same(binding.round, mapping.round) || !same(race.season, mapping.season) || binding.captures?.[sessionKind] !== capture.captureId) error(errors, 'identity-mismatch', 'race.resultsBinding');
  if (capture.provider !== 'jolpica' || !present(capture.captureId) || !present(capture.path) || !utc(capture.observedAt) || capture.httpStatus !== 200 || !Number.isSafeInteger(capture.rowCount) || capture.rowCount < 0) error(errors, 'invalid-provenance', 'capture');
  if (capture.raceId !== race.raceId || !same(capture.season, mapping.season) || !same(capture.round, mapping.round)) error(errors, 'identity-mismatch', 'capture');
  if (capture.sessionKind !== sessionKind) error(errors, 'session-mismatch', 'capture.sessionKind');
  const endpoint = `/ergast/f1/${mapping.season}/${mapping.round}/${kind[0]}.json`;
  if (!urlMatches(capture.requestUrl, endpoint) || !(capture.finalUrl === null || urlMatches(capture.finalUrl, endpoint))) error(errors, 'invalid-provenance', 'capture.requestUrl');
  const expected = binding?.expectedRace, declared = capture.expectedRace;
  for (const field of ['raceName', 'circuitId', 'date', 'time']) if (!present(expected?.[field]) || declared?.[field] !== expected[field]) error(errors, 'identity-mismatch', `capture.expectedRace.${field}`);
  const data = bytesAndJson(raw, capture, errors), mr = data?.MRData, table = mr?.RaceTable;
  if (!urlMatches(mr?.url, endpoint)) error(errors, 'session-mismatch', 'MRData.url');
  if (!same(table?.season, mapping.season) || !same(table?.round, mapping.round)) error(errors, 'identity-mismatch', 'MRData.RaceTable');
  const races = table?.Races;
  if (!Array.isArray(races)) error(errors, 'identity-mismatch', 'MRData.RaceTable.Races');
  const empty = Array.isArray(races) && races.length === 0;
  if (empty) {
    pagination(mr, 0, errors, 'MRData');
    if (capture.rowCount !== 0) error(errors, 'incomplete-pagination', 'capture.rowCount');
    return errors.length ? invalid(errors, source) : unavailable('provider-empty', source);
  }
  if (!Array.isArray(races) || races.length !== 1) error(errors, 'identity-mismatch', 'MRData.RaceTable.Races');
  const event = races?.[0];
  if (!same(event?.season, mapping.season) || !same(event?.round, mapping.round) || event?.raceName !== expected?.raceName || event?.Circuit?.circuitId !== expected?.circuitId || event?.date !== expected?.date || event?.time !== expected?.time) error(errors, 'identity-mismatch', 'MRData.RaceTable.Races[0]');
  const rows = event?.[kind[1]];
  if (!Array.isArray(rows)) error(errors, 'session-mismatch', `MRData.RaceTable.Races[0].${kind[1]}`);
  const list = Array.isArray(rows) ? rows : [];
  pagination(mr, list.length, errors, 'MRData');
  if (capture.rowCount !== list.length || list.length === 0) error(errors, 'incomplete-pagination', 'capture.rowCount');
  const ids = new Set();
  const entries = list.map((row, i) => {
    const path = `entries[${i}]`, d = driver(row?.Driver, errors, `${path}.Driver`), c = constructor(row?.Constructor, errors, `${path}.Constructor`);
    unique(d.driverId, ids, errors, `${path}.Driver.driverId`);
    const ranked = sessionKind === 'qualifying' && row?.positionText == null ? { ...row, positionText: row?.position } : row;
    const result = { sourceIndex: i, ...d, ...c, position: rank(ranked, errors, path, true), positionText: ranked?.positionText };
    if (sessionKind === 'qualifying') {
      for (const q of ['q1', 'q2', 'q3']) result[q] = optionalString(row?.[q.toUpperCase()] === '' ? null : row?.[q.toUpperCase()], errors, `${path}.${q}`);
    } else {
      if (!decimal(row?.points)) error(errors, 'invalid-points', `${path}.points`);
      if (!present(row?.status)) error(errors, 'invalid-field', `${path}.status`);
      Object.assign(result, { points: row?.points, grid: optionalUnsignedInteger(row?.grid, errors, `${path}.grid`), laps: optionalUnsignedInteger(row?.laps, errors, `${path}.laps`), status: row?.status, time: optionalString(row?.Time?.time === '' ? null : row?.Time?.time, errors, `${path}.time`) });
    }
    return result;
  });
  return errors.length ? invalid(errors, source) : { status: 'available', raceId: race.raceId, season: mapping.season, round: mapping.round, sessionKind, basis: 'captured-provider-classification', source, completeness: { scope: 'provider-response', total: Number(mr.total), rows: list.length }, entries };
}

export function adaptChampionshipSnapshot({ season, round, capture, raw } = {}) {
  if (!capture) return unavailable(round === 0 ? 'missing-baseline' : 'missing-snapshot', null);
  const source = capture, errors = [];
  if (!Number.isSafeInteger(season) || !validSeason(season) || !Number.isSafeInteger(round) || round < 1 || capture.provider !== 'jolpica' || !present(capture.captureId) || !same(capture.season, season) || !same(capture.round, round) || capture.path !== `standings/rounds/${season}-${round}.json` || !/^[a-f0-9]{40}$/.test(capture.revision ?? '') || !utc(capture.generatedAt)) error(errors, 'invalid-provenance', 'capture');
  const data = bytesAndJson(raw, capture, errors);
  if (data?.generatedAt !== capture.generatedAt || !utc(data?.generatedAt)) error(errors, 'invalid-provenance', 'generatedAt');
  const output = {};
  for (const [plural, wrapper, rowKey] of [['drivers', 'driverStandings', 'DriverStandings'], ['constructors', 'constructorStandings', 'ConstructorStandings']]) {
    const mr = data?.[wrapper]?.MRData, table = mr?.StandingsTable, lists = table?.StandingsLists;
    const endpoint = plural === 'drivers' ? 'driverstandings' : 'constructorstandings';
    const wrapperUrl = data?.source?.[`${plural === 'drivers' ? 'driver' : 'constructor'}StandingsUrl`];
    const scoped = `/ergast/f1/${season}/${round}/${endpoint}.json`, seasonWide = `/ergast/f1/${season}/${endpoint}.json`;
    if (capture.wrapperUrls?.[plural] !== wrapperUrl || !urlMatches(wrapperUrl, scoped) || capture.embeddedUrls?.[plural] !== mr?.url || !(urlMatches(mr?.url, scoped) || urlMatches(mr?.url, seasonWide))) error(errors, 'invalid-provenance', `${wrapper}.MRData.url`);
    if (!same(table?.season, season) || !same(table?.round, round)) error(errors, 'identity-mismatch', `${wrapper}.MRData.StandingsTable`);
    if (!Array.isArray(lists) || lists.length !== 1) error(errors, 'identity-mismatch', `${wrapper}.MRData.StandingsTable.StandingsLists`);
    const list = lists?.[0];
    if (!same(list?.season, season) || !same(list?.round, round)) error(errors, 'identity-mismatch', `${wrapper}.MRData.StandingsTable.StandingsLists[0]`);
    const rows = list?.[rowKey];
    if (!Array.isArray(rows)) error(errors, 'identity-mismatch', `${wrapper}.${rowKey}`);
    const entries = Array.isArray(rows) ? rows : [];
    pagination(mr, entries.length, errors, `${wrapper}.MRData`);
    if (entries.length === 0) error(errors, 'incomplete-pagination', `${wrapper}.${rowKey}`);
    const ids = new Set();
    output[plural] = entries.map((row, i) => {
      const path = `${plural}[${i}]`;
      let identity;
      if (plural === 'drivers') {
        const d = driver(row?.Driver, errors, `${path}.Driver`);
        if (!Array.isArray(row?.Constructors) || !row.Constructors.length) error(errors, 'invalid-identity', `${path}.Constructors`);
        identity = { entityId: d.driverId, driverName: d.driverName, driverCode: d.driverCode, constructors: (Array.isArray(row?.Constructors) ? row.Constructors : []).map((c, index) => constructor(c, errors, `${path}.Constructors[${index}]`)) };
      } else {
        const c = constructor(row?.Constructor, errors, `${path}.Constructor`);
        identity = { entityId: c.constructorId, constructorName: c.constructorName };
      }
      unique(identity.entityId, ids, errors, `${path}.entityId`);
      if (!decimal(row?.points)) error(errors, 'invalid-points', `${path}.points`);
      return { sourceIndex: i, ...identity, position: rank(row, errors, path), positionText: row?.positionText, points: row?.points };
    });
  }
  return errors.length ? invalid(errors, source) : { status: 'available', season, round, source, ...output };
}

function subtract(after, before) {
  const parts = value => {
    const negative = value[0] === '-', unsigned = /^[+-]/.test(value) ? value.slice(1) : value;
    const [whole, fraction = ''] = unsigned.split('.');
    return { coefficient: BigInt((negative ? '-' : '') + whole + fraction), scale: fraction.length };
  };
  const a = parts(after), b = parts(before), scale = Math.max(a.scale, b.scale);
  let value = a.coefficient * 10n ** BigInt(scale - a.scale) - b.coefficient * 10n ** BigInt(scale - b.scale);
  if (value === 0n) return '0';
  const sign = value < 0n ? '-' : '';
  if (value < 0n) value = -value;
  if (!scale) return sign + value.toString();
  const digits = value.toString().padStart(scale + 1, '0');
  const fraction = digits.slice(-scale).replace(/0+$/, '');
  return sign + digits.slice(0, -scale) + (fraction ? `.${fraction}` : '');
}

export function compareChampionshipSnapshots({ before, after } = {}) {
  if (before?.status === 'invalid') return invalid(before.errors, before.source);
  if (after?.status === 'invalid') return invalid(after.errors, after.source);
  if (!before || before.status === 'unavailable') return unavailable(before?.reason === 'missing-baseline' ? 'missing-baseline' : 'missing-snapshot', before?.source);
  if (!after || after.status === 'unavailable') return unavailable('missing-snapshot', after?.source);
  const errors = [];
  if (before.status !== 'available' || after.status !== 'available' || !Number.isSafeInteger(before.season) || !validSeason(before.season) || before.season !== after.season || !Number.isSafeInteger(before.round) || before.round < 1 || !Number.isSafeInteger(after.round) || after.round !== before.round + 1) error(errors, 'identity-mismatch', 'snapshots');
  for (const [label, snapshot] of [['before', before], ['after', after]]) {
    for (const group of ['drivers', 'constructors']) {
      if (!Array.isArray(snapshot[group]) || snapshot[group].length === 0) { error(errors, 'incomplete-pagination', `${label}.${group}`); continue; }
      const ids = new Set();
      for (const [i, row] of snapshot[group].entries()) {
        if (!present(row?.entityId)) error(errors, 'invalid-identity', `${label}.${group}[${i}].entityId`);
        unique(row?.entityId, ids, errors, `${label}.${group}[${i}].entityId`);
        if (!decimal(row?.points)) error(errors, 'invalid-points', `${label}.${group}[${i}].points`);
        if (!((row?.position === null && ['-', 'R', 'D', 'W', 'E', 'F', 'N'].includes(row?.positionText)) || (Number.isSafeInteger(row?.position) && row.position > 0 && row.positionText === String(row.position)))) error(errors, 'invalid-rank', `${label}.${group}[${i}].position`);
      }
    }
  }
  if (errors.length) return invalid(errors, null);
  const compare = group => {
    const first = new Map(before[group].map(row => [row.entityId, row]));
    const last = new Map(after[group].map(row => [row.entityId, row]));
    return [...after[group].map(row => row.entityId), ...before[group].filter(row => !last.has(row.entityId)).map(row => row.entityId)].map(entityId => {
      const a = first.get(entityId) ?? null, b = last.get(entityId) ?? null;
      return { entityId, presence: a && b ? 'both' : a ? 'before-only' : 'after-only', before: a, after: b, pointsChange: a && b ? subtract(b.points, a.points) : null, rankChange: a?.position != null && b?.position != null ? a.position - b.position : null };
    });
  };
  return { status: 'available', season: before.season, beforeRound: before.round, afterRound: after.round, basis: 'captured-cumulative-championship-totals', sources: { before: before.source, after: after.source }, drivers: compare('drivers'), constructors: compare('constructors') };
}
