import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateRegistry,
  resolveRace,
  resolveSession,
  normalizeSessionKind,
  normalizeContext,
  validateSelectedScope,
  RegistryValidationError,
} from "../core/index.mjs";

const seed = JSON.parse(
  readFileSync(
    new URL("../../../data/race-desk/registry.v1.json", import.meta.url),
  ),
);
const copy = () => structuredClone(seed);
const claim = (field, value, sourceId) => ({
  field,
  value,
  sourceId,
  reference: "/synthetic",
  status: "verified",
});
function fixture() {
  const data = copy(),
    race = data.races[0],
    session = race.sessions[0],
    source = data.sources[0].id;
  race.sourceKeys.openf1MeetingKey = 1234;
  race.evidence.push(claim("sourceKeys.openf1MeetingKey", 1234, source));
  session.openf1SessionKey = 5678;
  session.evidence.push(claim("openf1SessionKey", 5678, source));
  return { data, race, session };
}
const rejects = (data) => {
  assert.equal(validateRegistry(data).valid, false);
  assert.throws(
    () => resolveRace(data, { raceId: "x" }),
    RegistryValidationError,
  );
};

test("reviewed seed has deterministic coverage and exact identity mappings", () => {
  const r = validateRegistry(seed);
  assert.equal(r.valid, true);
  assert.equal(r.coverage.races, 6);
  assert.deepEqual(validateRegistry(seed), r);
  const reversed = copy();
  reversed.races.reverse();
  reversed.sources.reverse();
  assert.deepEqual(validateRegistry(reversed).coverage, r.coverage);
  const bh = resolveRace(seed, { raceId: "2026-bahrain-gp" }).race;
  assert.match(bh.venue.timeZone, /Kuala_Lumpur/);
  assert.notEqual(bh.eventName, bh.venue.name);
  assert.equal(
    resolveRace(seed, { season: 2026, jolpicaRound: 3 }).race.raceId,
    "2026-japanese-gp",
  );
  assert.equal(
    resolveRace(seed, { tyresRaceId: bh.sourceKeys.tyresRaceId }).race.raceId,
    bh.raceId,
  );
  assert.equal(
    resolveRace(seed, { season: bh.season, tyresSlug: bh.sourceKeys.tyresSlug })
      .race.raceId,
    bh.raceId,
  );
  assert.equal(
    resolveRace(seed, { season: 2025, jolpicaRound: 3 }).status,
    "missing",
  );
  assert.equal(
    resolveRace(seed, { openf1MeetingKey: 999999 }).status,
    "missing",
  );
  assert.equal(
    resolveSession(seed, { raceId: bh.raceId }, { kind: "sprint" }).status,
    "missing",
  );
});

test("verified synthetic provider keys and sessions resolve only in scope", () => {
  const { data, race, session } = fixture();
  assert.equal(validateRegistry(data).valid, true);
  assert.equal(
    resolveRace(data, { openf1MeetingKey: 1234 }).race.raceId,
    race.raceId,
  );
  assert.equal(
    resolveSession(
      data,
      { raceId: race.raceId },
      { kind: session.kind, openf1SessionKey: 5678 },
    ).session.kind,
    session.kind,
  );
  assert.equal(
    resolveSession(data, { raceId: race.raceId }, { openf1SessionKey: 5679 })
      .status,
    "missing",
  );
  assert.equal(
    resolveSession(
      data,
      { raceId: data.races[1].raceId },
      { openf1SessionKey: 5678 },
    ).status,
    "missing",
  );
  assert.equal(normalizeSessionKind("Sprint Qualifying"), "sprint-qualifying");
  assert.equal(normalizeSessionKind("Qualifying"), "qualifying");
  assert.equal(normalizeSessionKind("Sprint Shootout"), null);
  assert.throws(() => normalizeSessionKind(1), TypeError);
});

test("rejects collisions, unsupported structure, missing and contradictory claims", () => {
  let data = copy();
  data.races.push(structuredClone(data.races[0]));
  rejects(data);
  data = copy();
  data.races[0].evidence[0].value = 1950;
  rejects(data);
  data = copy();
  data.races[0].evidence = [];
  rejects(data);
  data = copy();
  data.races[0].evidence[0].sourceId = "absent";
  rejects(data);
  data = copy();
  data.races[0].evidence[0].reference = "";
  rejects(data);
  data = copy();
  data.races[0].evidence[0].status = "unverified";
  rejects(data);
  data = copy();
  data.races[0].unexpected = true;
  rejects(data);
  data = copy();
  data.schemaVersion = 2;
  rejects(data);
  data = copy();
  data.races[0].sessions.push(structuredClone(data.races[0].sessions[0]));
  rejects(data);
  data = fixture().data;
  data.races[0].sourceKeys.openf1MeetingKey = null;
  rejects(data);
});

test("rejects malformed dates, time zones, years and numeric values", () => {
  for (const mutate of [
    (d) => (d.races[0].season = 1949),
    (d) => (d.races[0].venue.timeZone = "Not/AZone"),
    (d) => (d.races[0].sessions[0].startUtc = "2026-02-30T00:00:00.000Z"),
    (d) => (d.sources[0].reviewedAt = "2026-01-01"),
    (d) => (d.sources[0].revision = "A".repeat(40)),
    (d) =>
      (d.races[0].sourceKeys.openf1MeetingKey = Number.MAX_SAFE_INTEGER + 1),
  ]) {
    const data = copy();
    mutate(data);
    rejects(data);
  }
  for (const selector of [
    { season: 2101, jolpicaRound: 1 },
    { openf1MeetingKey: 0 },
    { raceId: "x", season: 2026 },
    { season: 2026, jolpicaRound: 1.5 },
  ])
    assert.throws(() => resolveRace(seed, selector), RegistryValidationError);
});

test("context preserves session-scoped drivers and independent laps", () => {
  const { data, race, session } = fixture();
  const drivers = [
    { openf1SessionKey: 5678, driverNumber: 44, lapNumber: 12 },
    { openf1SessionKey: 5678, driverNumber: 1, lapNumber: 13 },
  ];
  const result = normalizeContext(data, {
    raceId: race.raceId,
    openf1SessionKey: 5678,
    drivers,
  });
  assert.equal(result.status, "resolved");
  assert.equal(result.context.sessionKind, session.kind);
  assert.deepEqual(result.context.drivers, drivers);
  assert.deepEqual(result.conversionLosses, ["telemetry-single-lap"]);
  assert.deepEqual(normalizeContext(data, result.context), result);
  assert.equal(
    normalizeContext(data, {
      raceId: race.raceId,
      sessionKind: session.kind,
      openf1SessionKey: 999,
    }).status,
    "missing",
  );
  for (const bad of [
    [...drivers, drivers[0]],
    [{ ...drivers[0], openf1SessionKey: 5679 }],
    [{ ...drivers[0], driverNumber: 0 }],
    [{ ...drivers[0], lapNumber: 201 }],
    Array.from({ length: 5 }, (_, i) => ({
      ...drivers[0],
      driverNumber: i + 1,
    })),
  ])
    assert.throws(
      () =>
        normalizeContext(data, {
          raceId: race.raceId,
          openf1SessionKey: 5678,
          drivers: bad,
        }),
      RegistryValidationError,
    );
  assert.throws(
    () => validateSelectedScope({ ...result.context, openf1SessionKey: null }),
    RegistryValidationError,
  );
  assert.throws(
    () => normalizeContext(data, { raceId: race.raceId, drivers }),
    RegistryValidationError,
  );
});

test("session coverage follows canonical order independent of input ordering", () => {
  const data = copy();
  const reversed = copy();
  for (const race of reversed.races) race.sessions.reverse();
  assert.deepEqual(
    validateRegistry(data).coverage,
    validateRegistry(reversed).coverage,
  );
  assert.deepEqual(
    validateRegistry(data).coverage.missing.openf1SessionKey.filter((s) =>
      s.startsWith("2026-singapore-gp/"),
    ),
    [
      "2026-singapore-gp/fp1",
      "2026-singapore-gp/qualifying",
      "2026-singapore-gp/sprint-qualifying",
      "2026-singapore-gp/sprint",
      "2026-singapore-gp/race",
    ],
  );
  for (const key of ["__proto__", "constructor", "toString"])
    assert.equal(normalizeSessionKind(key), null);
  data.races[0].raceId = "wrong-season";
  rejects(data);
});

test("each provider collision fails closed", () => {
  for (const key of [
    "openf1MeetingKey",
    "jolpica",
    "tyresRaceId",
    "tyresSlug",
    "session",
  ]) {
    const { data } = fixture();
    const a = data.races[0],
      b = data.races[1];
    if (key === "session") {
      b.sourceKeys.openf1MeetingKey = 9999;
      b.evidence.push(
        claim("sourceKeys.openf1MeetingKey", 9999, data.sources[0].id),
      );
      b.sessions[0].openf1SessionKey = a.sessions[0].openf1SessionKey;
      b.sessions[0].evidence.push(
        claim(
          "openf1SessionKey",
          a.sessions[0].openf1SessionKey,
          data.sources[0].id,
        ),
      );
    } else {
      b.sourceKeys[key] = structuredClone(a.sourceKeys[key]);
      b.evidence = b.evidence.filter((c) => c.field !== `sourceKeys.${key}`);
      b.evidence.push(
        claim(`sourceKeys.${key}`, b.sourceKeys[key], data.sources[0].id),
      );
    }
    assert.ok(
      validateRegistry(data).errors.some((e) => e.code === "duplicate"),
      key,
    );
    rejects(data);
  }
});

test("event identity survives relocation and round changes, and source keys remain season scoped", () => {
  const data = copy(),
    a = data.races.find((r) => r.raceId === "2026-japanese-gp");
  const id = a.raceId;
  a.venue.name = "Synthetic relocated circuit";
  a.evidence.find((c) => c.field === "venue.name").value = a.venue.name;
  a.sourceKeys.jolpica.round = 99;
  a.evidence.find((c) => c.field === "sourceKeys.jolpica").value.round = 99;
  assert.equal(
    resolveRace(data, { season: 2026, jolpicaRound: 99 }).race.raceId,
    id,
  );
  assert.equal(
    resolveRace(data, { season: 2026, jolpicaRound: 3 }).status,
    "missing",
  );
  const historical = structuredClone(a);
  historical.raceId = "2025-japanese-gp";
  historical.season = 2025;
  historical.evidence.find((c) => c.field === "season").value = 2025;
  historical.sourceKeys.jolpica.season = 2025;
  historical.evidence.find(
    (c) => c.field === "sourceKeys.jolpica",
  ).value.season = 2025;
  historical.sourceKeys.tyresRaceId = null;
  historical.sourceKeys.tyresSlug = a.sourceKeys.tyresSlug;
  historical.evidence = historical.evidence.filter(
    (c) => c.field !== "sourceKeys.tyresRaceId",
  );
  data.races.push(historical);
  assert.equal(
    resolveRace(data, { season: 2025, jolpicaRound: 99 }).race.raceId,
    historical.raceId,
  );
  assert.equal(
    resolveRace(data, { season: 2026, jolpicaRound: 99 }).race.raceId,
    id,
  );
  assert.equal(
    resolveRace(data, { season: 2025, tyresSlug: a.sourceKeys.tyresSlug }).race
      .raceId,
    historical.raceId,
  );
});

test("same driver number can be selected independently in two sessions", () => {
  const { data, race, session } = fixture();
  const other = race.sessions[1];
  other.openf1SessionKey = 6789;
  other.evidence.push(claim("openf1SessionKey", 6789, data.sources[0].id));
  for (const selected of [session, other]) {
    const result = normalizeContext(data, {
      raceId: race.raceId,
      sessionKind: selected.kind,
      drivers: [
        {
          openf1SessionKey: selected.openf1SessionKey,
          driverNumber: 44,
          lapNumber: 8,
        },
      ],
    });
    assert.equal(result.context.openf1SessionKey, selected.openf1SessionKey);
  }
});

test('malformed JSON claim fields and seasons report validation errors', () => {
  for (const field of [['season'], {toString: 'season'}]) {
    const data = copy();
    data.races[0].evidence.push({...data.races[0].evidence[0], field});
    assert.doesNotThrow(() => validateRegistry(data));
    assert.equal(validateRegistry(data).valid, false);
  }
  const data = copy();
  data.races[0].season = {toString: '2026'};
  assert.doesNotThrow(() => validateRegistry(data));
  assert.equal(validateRegistry(data).valid, false);
});


test("source URL must be a string", () => {
  const data = copy();
  data.sources[0].url = ["https://example.com"];
  assert.equal(validateRegistry(data).valid, false);
  assert.ok(validateRegistry(data).errors.some(error => error.path === "$.sources[0].url"));
});
