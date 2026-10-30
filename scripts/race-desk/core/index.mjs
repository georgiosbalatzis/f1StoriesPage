const kinds = [
  "fp1",
  "fp2",
  "fp3",
  "qualifying",
  "sprint-qualifying",
  "sprint",
  "race",
];
const aliases = {
  "Practice 1": "fp1",
  "Practice 2": "fp2",
  "Practice 3": "fp3",
  Qualifying: "qualifying",
  "Sprint Qualifying": "sprint-qualifying",
  Sprint: "sprint",
  Race: "race",
};
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const nonempty = (value) =>
  typeof value === "string" && value.trim() === value && value.length > 0;
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const year = (value) =>
  Number.isInteger(value) && value >= 1950 && value <= 2100;
const canonicalUtc = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
  )
    return false;
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date.toISOString() === value;
};
const timezone = (value) => {
  if (!nonempty(value) || /^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};
const same = (a, b) => {
  if (object(a) && object(b))
    return (
      Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every(
        (key) => Object.hasOwn(b, key) && same(a[key], b[key]),
      )
    );
  return a === b;
};
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export class RegistryValidationError extends Error {
  constructor(errors) {
    super("Race desk validation failed");
    this.name = "RegistryValidationError";
    this.errors = errors;
  }
}
export function normalizeSessionKind(value) {
  if (typeof value !== "string")
    throw new TypeError("Session kind must be a string");
  return kinds.includes(value)
    ? value
    : Object.hasOwn(aliases, value)
      ? aliases[value]
      : null;
}

export function validateRegistry(registry) {
  const errors = [];
  const missing = {
    openf1MeetingKey: [],
    jolpica: [],
    tyresRaceId: [],
    tyresSlug: [],
    openf1SessionKey: [],
    startUtc: [],
  };
  const coverage = { races: 0, sessions: 0, missing };
  const err = (path, code, message) => errors.push({ path, code, message });
  const shape = (v, keys, path, optional = []) => {
    if (!object(v)) {
      err(path, "type", "Expected an object");
      return false;
    }
    for (const key of Object.keys(v))
      if (!keys.includes(key))
        err(`${path}.${key}`, "unknown", "Unknown field");
    for (const key of keys)
      if (!optional.includes(key) && !Object.hasOwn(v, key))
        err(`${path}.${key}`, "required", "Required field");
    return true;
  };
  const requireValue = (condition, path, message) => {
    if (!condition) err(path, "invalid", message);
  };
  const unique = (map, value, path) => {
    if (map.has(value))
      err(path, "duplicate", `Duplicate value also at ${map.get(value)}`);
    else map.set(value, path);
  };
  if (!shape(registry, ["schemaVersion", "sources", "races"], "$"))
    return { valid: false, errors, coverage };
  requireValue(
    registry.schemaVersion === 1,
    "$.schemaVersion",
    "Unsupported schema version",
  );
  requireValue(
    Array.isArray(registry.sources),
    "$.sources",
    "Expected an array",
  );
  requireValue(Array.isArray(registry.races), "$.races", "Expected an array");
  const sourceIds = new Map();
  for (const [i, s] of (Array.isArray(registry.sources)
    ? registry.sources
    : []
  ).entries()) {
    const p = `$.sources[${i}]`;
    if (
      !shape(
        s,
        [
          "id",
          "repository",
          "revision",
          "path",
          "gitBlob",
          "reviewedAt",
          "capturedAt",
          "url",
        ],
        p,
        ["capturedAt", "url"],
      )
    )
      continue;
    for (const key of ["id", "repository", "path"])
      requireValue(
        nonempty(s[key]),
        `${p}.${key}`,
        "Expected a non-empty string",
      );
    if (nonempty(s.id)) unique(sourceIds, s.id, `${p}.id`);
    for (const key of ["revision", "gitBlob"])
      requireValue(
        typeof s[key] === "string" && /^[0-9a-f]{40}$/.test(s[key]),
        `${p}.${key}`,
        "Expected a lowercase Git hash",
      );
    for (const key of [
      "reviewedAt",
      ...(Object.hasOwn(s, "capturedAt") ? ["capturedAt"] : []),
    ])
      requireValue(
        canonicalUtc(s[key]),
        `${p}.${key}`,
        "Expected canonical UTC timestamp",
      );
    if (Object.hasOwn(s, "url")) {
      let valid = false;
      try {
        valid = nonempty(s.url) && ["http:", "https:"].includes(new URL(s.url).protocol);
      } catch {}
      requireValue(valid, `${p}.url`, "Expected an HTTP(S) URL");
    }
  }
  const maps = {
    raceId: new Map(),
    meeting: new Map(),
    jolpica: new Map(),
    tyresId: new Map(),
    slug: new Map(),
    session: new Map(),
  };
  const claims = (owner, fields, p) => {
    if (!Array.isArray(owner.evidence)) {
      err(`${p}.evidence`, "type", "Expected an array");
      return;
    }
    const seen = new Set();
    for (const [i, c] of owner.evidence.entries()) {
      const cp = `${p}.evidence[${i}]`;
      if (!shape(c, ["field", "value", "sourceId", "reference", "status"], cp))
        continue;
      if (!nonempty(c.field) || !Object.hasOwn(fields, c.field))
        err(`${cp}.field`, "invalid", "Unsupported claim field");
      else {
        seen.add(c.field);
        if (!same(c.value, fields[c.field]))
          err(
            `${cp}.value`,
            "contradiction",
            "Claim does not match recorded value",
          );
        if (fields[c.field] === null)
          err(`${cp}.value`, "invalid", "Null fields cannot be verified");
      }
      requireValue(
        nonempty(c.sourceId) && sourceIds.has(c.sourceId),
        `${cp}.sourceId`,
        "Unknown source",
      );
      requireValue(
        nonempty(c.reference),
        `${cp}.reference`,
        "Expected a source reference",
      );
      requireValue(
        c.status === "verified",
        `${cp}.status`,
        "Expected verified status",
      );
    }
    for (const [field, value] of Object.entries(fields))
      if (value !== null && value !== undefined && !seen.has(field))
        err(
          `${p}.evidence`,
          "missing-evidence",
          `Missing verified claim for ${field}`,
        );
  };
  for (const [i, r] of (Array.isArray(registry.races)
    ? registry.races
    : []
  ).entries()) {
    const p = `$.races[${i}]`;
    coverage.races++;
    if (
      !shape(
        r,
        [
          "raceId",
          "season",
          "eventName",
          "displayName",
          "venue",
          "sourceKeys",
          "sessions",
          "evidence",
        ],
        p,
      )
    )
      continue;
    for (const key of ["raceId", "eventName", "displayName"])
      requireValue(
        nonempty(r[key]),
        `${p}.${key}`,
        "Expected a non-empty string",
      );
    requireValue(
      year(r.season),
      `${p}.season`,
      "Expected a season from 1950 through 2100",
    );
    requireValue(
      typeof r.raceId === "string" &&
        /^[0-9]{4}-[a-z0-9]+(?:-[a-z0-9]+)*-gp$/.test(r.raceId) &&
        year(r.season) &&
        r.raceId.slice(0, 4) === String(r.season),
      `${p}.raceId`,
      "Expected a season-prefixed event ID ending in -gp",
    );
    if (nonempty(r.raceId)) unique(maps.raceId, r.raceId, `${p}.raceId`);
    const v = object(r.venue) ? r.venue : {};
    if (shape(r.venue, ["venueId", "name", "timeZone"], `${p}.venue`)) {
      for (const key of ["venueId", "name"])
        requireValue(
          nonempty(v[key]),
          `${p}.venue.${key}`,
          "Expected a non-empty string",
        );
      requireValue(
        timezone(v.timeZone),
        `${p}.venue.timeZone`,
        "Expected an IANA time zone",
      );
    }
    const k = object(r.sourceKeys) ? r.sourceKeys : {};
    if (
      shape(
        r.sourceKeys,
        ["openf1MeetingKey", "jolpica", "tyresRaceId", "tyresSlug"],
        `${p}.sourceKeys`,
      )
    ) {
      requireValue(
        k.openf1MeetingKey === null || positive(k.openf1MeetingKey),
        `${p}.sourceKeys.openf1MeetingKey`,
        "Expected null or a positive safe integer",
      );
      if (positive(k.openf1MeetingKey))
        unique(
          maps.meeting,
          k.openf1MeetingKey,
          `${p}.sourceKeys.openf1MeetingKey`,
        );
      if (
        k.jolpica !== null &&
        shape(k.jolpica, ["season", "round"], `${p}.sourceKeys.jolpica`)
      ) {
        requireValue(
          year(k.jolpica.season) && k.jolpica.season === r.season,
          `${p}.sourceKeys.jolpica.season`,
          "Expected the race season",
        );
        requireValue(
          positive(k.jolpica.round),
          `${p}.sourceKeys.jolpica.round`,
          "Expected a positive safe integer",
        );
        if (year(k.jolpica.season) && positive(k.jolpica.round))
          unique(
            maps.jolpica,
            `${k.jolpica.season}/${k.jolpica.round}`,
            `${p}.sourceKeys.jolpica`,
          );
      }
      for (const key of ["tyresRaceId", "tyresSlug"])
        requireValue(
          k[key] === null || nonempty(k[key]),
          `${p}.sourceKeys.${key}`,
          "Expected null or a non-empty string",
        );
      if (nonempty(k.tyresRaceId))
        unique(maps.tyresId, k.tyresRaceId, `${p}.sourceKeys.tyresRaceId`);
      if (nonempty(k.tyresSlug) && year(r.season))
        unique(
          maps.slug,
          `${r.season}/${k.tyresSlug}`,
          `${p}.sourceKeys.tyresSlug`,
        );
      for (const key of [
        "openf1MeetingKey",
        "jolpica",
        "tyresRaceId",
        "tyresSlug",
      ])
        if (k[key] === null && nonempty(r.raceId)) missing[key].push(r.raceId);
    }
    claims(
      r,
      {
        season: r.season,
        eventName: r.eventName,
        "venue.venueId": v.venueId,
        "venue.name": v.name,
        "venue.timeZone": v.timeZone,
        "sourceKeys.openf1MeetingKey": k.openf1MeetingKey,
        "sourceKeys.jolpica": k.jolpica,
        "sourceKeys.tyresRaceId": k.tyresRaceId,
        "sourceKeys.tyresSlug": k.tyresSlug,
      },
      p,
    );
    if (!Array.isArray(r.sessions)) {
      err(`${p}.sessions`, "type", "Expected an array");
      continue;
    }
    const sessionKinds = new Map();
    let previousStart = null;
    for (const [j, s] of r.sessions.entries()) {
      const sp = `${p}.sessions[${j}]`;
      coverage.sessions++;
      if (!shape(s, ["kind", "openf1SessionKey", "startUtc", "evidence"], sp))
        continue;
      requireValue(
        kinds.includes(s.kind),
        `${sp}.kind`,
        "Unknown session kind",
      );
      if (kinds.includes(s.kind)) unique(sessionKinds, s.kind, `${sp}.kind`);
      requireValue(
        s.openf1SessionKey === null || positive(s.openf1SessionKey),
        `${sp}.openf1SessionKey`,
        "Expected null or a positive safe integer",
      );
      if (positive(s.openf1SessionKey)) {
        unique(maps.session, s.openf1SessionKey, `${sp}.openf1SessionKey`);
        requireValue(
          positive(k.openf1MeetingKey),
          `${sp}.openf1SessionKey`,
          "A session key requires a meeting key",
        );
      }
      requireValue(
        s.startUtc === null || canonicalUtc(s.startUtc),
        `${sp}.startUtc`,
        "Expected null or a canonical UTC timestamp",
      );
      if (canonicalUtc(s.startUtc)) {
        if (previousStart !== null && s.startUtc <= previousStart)
          err(
            `${sp}.startUtc`,
            "chronology",
            "Known session starts must increase in the recorded schedule order",
          );
        previousStart = s.startUtc;
      }
      for (const key of ["openf1SessionKey", "startUtc"])
        if (s[key] === null && nonempty(r.raceId) && kinds.includes(s.kind))
          missing[key].push(`${r.raceId}/${s.kind}`);
      claims(
        s,
        {
          kind: s.kind,
          openf1SessionKey: s.openf1SessionKey,
          startUtc: s.startUtc,
        },
        sp,
      );
    }
  }
  for (const key of ["openf1MeetingKey", "jolpica", "tyresRaceId", "tyresSlug"])
    missing[key].sort(cmp);
  for (const key of ["openf1SessionKey", "startUtc"])
    missing[key].sort((a, b) => {
      const splitA = a.lastIndexOf("/"),
        splitB = b.lastIndexOf("/");
      return (
        cmp(a.slice(0, splitA), b.slice(0, splitB)) ||
        kinds.indexOf(a.slice(splitA + 1)) - kinds.indexOf(b.slice(splitB + 1))
      );
    });
  errors.sort(
    (a, b) =>
      cmp(a.path, b.path) || cmp(a.code, b.code) || cmp(a.message, b.message),
  );
  return { valid: errors.length === 0, errors, coverage };
}

function assertRegistry(registry) {
  const result = validateRegistry(registry);
  if (!result.valid) throw new RegistryValidationError(result.errors);
}
function invalid(message) {
  throw new RegistryValidationError([
    { path: "$", code: "invalid-input", message },
  ]);
}
function exact(value, keys) {
  return (
    object(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
function raceLookup(registry, selector) {
  let match;
  if (exact(selector, ["raceId"]) && nonempty(selector.raceId))
    match = (r) => r.raceId === selector.raceId;
  else if (
    exact(selector, ["openf1MeetingKey"]) &&
    positive(selector.openf1MeetingKey)
  )
    match = (r) => r.sourceKeys.openf1MeetingKey === selector.openf1MeetingKey;
  else if (
    exact(selector, ["season", "jolpicaRound"]) &&
    year(selector.season) &&
    positive(selector.jolpicaRound)
  )
    match = (r) =>
      r.sourceKeys.jolpica?.season === selector.season &&
      r.sourceKeys.jolpica?.round === selector.jolpicaRound;
  else if (exact(selector, ["tyresRaceId"]) && nonempty(selector.tyresRaceId))
    match = (r) => r.sourceKeys.tyresRaceId === selector.tyresRaceId;
  else if (
    exact(selector, ["season", "tyresSlug"]) &&
    year(selector.season) &&
    nonempty(selector.tyresSlug)
  )
    match = (r) =>
      r.season === selector.season &&
      r.sourceKeys.tyresSlug === selector.tyresSlug;
  else if (
    (exact(selector, ["eventName"]) ||
      (exact(selector, ["eventName", "season"]) && year(selector.season))) &&
    nonempty(selector.eventName)
  )
    match = (r) =>
      r.eventName === selector.eventName &&
      (!Object.hasOwn(selector, "season") || r.season === selector.season);
  else invalid("Invalid race selector");
  const matches = registry.races.filter(match);
  if (matches.length > 1)
    return {
      status: "ambiguous",
      reason: "race-name-ambiguous",
      raceIds: matches.map((race) => race.raceId).sort(cmp),
    };
  const race = matches[0];
  return race
    ? { status: "resolved", race }
    : { status: "missing", reason: "race-not-found" };
}
export function resolveRace(registry, selector) {
  assertRegistry(registry);
  return raceLookup(registry, selector);
}
function sessionLookup(race, selector) {
  if (
    !(
      exact(selector, ["kind"]) ||
      exact(selector, ["openf1SessionKey"]) ||
      exact(selector, ["kind", "openf1SessionKey"])
    )
  )
    invalid("Invalid session selector");
  if (Object.hasOwn(selector, "kind") && !kinds.includes(selector.kind))
    invalid("Invalid session kind");
  if (
    Object.hasOwn(selector, "openf1SessionKey") &&
    !positive(selector.openf1SessionKey)
  )
    invalid("Invalid session key");
  const session = race.sessions.find(
    (s) =>
      (!Object.hasOwn(selector, "kind") || s.kind === selector.kind) &&
      (!Object.hasOwn(selector, "openf1SessionKey") ||
        s.openf1SessionKey === selector.openf1SessionKey),
  );
  return session
    ? { status: "resolved", race, session }
    : { status: "missing", reason: "session-not-found" };
}
export function resolveSession(registry, raceSelector, sessionSelector) {
  assertRegistry(registry);
  sessionLookup({ sessions: [] }, sessionSelector);
  const result = raceLookup(registry, raceSelector);
  return result.status === "resolved"
    ? sessionLookup(result.race, sessionSelector)
    : result;
}

export function validateSelectedScope(context) {
  if (
    !exact(context, [
      "schemaVersion",
      "raceId",
      "sessionKind",
      "openf1SessionKey",
      "drivers",
    ]) ||
    context.schemaVersion !== 1 ||
    !nonempty(context.raceId) ||
    !(context.sessionKind === null || kinds.includes(context.sessionKind)) ||
    !(
      context.openf1SessionKey === null || positive(context.openf1SessionKey)
    ) ||
    !Array.isArray(context.drivers) ||
    context.drivers.length > 4
  )
    invalid("Invalid context");
  if (context.openf1SessionKey !== null && context.sessionKind === null)
    invalid("Session key requires a session kind");
  const numbers = new Set();
  for (const driver of context.drivers) {
    if (
      !exact(driver, ["openf1SessionKey", "driverNumber", "lapNumber"]) ||
      context.openf1SessionKey === null ||
      driver.openf1SessionKey !== context.openf1SessionKey ||
      !Number.isInteger(driver.driverNumber) ||
      driver.driverNumber < 1 ||
      driver.driverNumber > 99 ||
      !(
        driver.lapNumber === null ||
        (Number.isInteger(driver.lapNumber) &&
          driver.lapNumber >= 1 &&
          driver.lapNumber <= 200)
      ) ||
      numbers.has(driver.driverNumber)
    )
      invalid("Invalid driver scope");
    numbers.add(driver.driverNumber);
  }
}
export function normalizeContext(registry, input) {
  assertRegistry(registry);
  if (
    !object(input) ||
    Object.keys(input).some(
      (k) =>
        ![
          "schemaVersion",
          "raceId",
          "sessionKind",
          "openf1SessionKey",
          "drivers",
        ].includes(k),
    )
  )
    invalid("Invalid context input");
  const context = {
    schemaVersion: Object.hasOwn(input, "schemaVersion")
      ? input.schemaVersion
      : 1,
    raceId: input.raceId,
    sessionKind: Object.hasOwn(input, "sessionKind") ? input.sessionKind : null,
    openf1SessionKey: Object.hasOwn(input, "openf1SessionKey")
      ? input.openf1SessionKey
      : null,
    drivers: Object.hasOwn(input, "drivers") ? input.drivers : [],
  };
  if (context.sessionKind !== null && typeof context.sessionKind === "string")
    context.sessionKind =
      normalizeSessionKind(context.sessionKind) ??
      invalid("Invalid session kind");
  // A key-only input is completed from the verified registry before structural validation.
  if (
    context.schemaVersion !== 1 ||
    !nonempty(context.raceId) ||
    !(context.sessionKind === null || kinds.includes(context.sessionKind)) ||
    !(
      context.openf1SessionKey === null || positive(context.openf1SessionKey)
    ) ||
    !Array.isArray(context.drivers) ||
    context.drivers.length > 4
  )
    invalid("Invalid context");
  const raceResult = raceLookup(registry, { raceId: context.raceId });
  if (raceResult.status === "missing") return raceResult;
  if (context.sessionKind !== null || context.openf1SessionKey !== null) {
    const selector = {};
    if (context.sessionKind !== null) selector.kind = context.sessionKind;
    if (context.openf1SessionKey !== null)
      selector.openf1SessionKey = context.openf1SessionKey;
    const result = sessionLookup(raceResult.race, selector);
    if (result.status === "missing") return result;
    context.sessionKind = result.session.kind;
    context.openf1SessionKey = result.session.openf1SessionKey;
  }
  validateSelectedScope(context);
  const laps = new Set(
    context.drivers.map((d) => d.lapNumber).filter((lap) => lap !== null),
  );
  return {
    status: "resolved",
    context,
    conversionLosses: laps.size > 1 ? ["telemetry-single-lap"] : [],
  };
}
