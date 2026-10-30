import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  validateRegistry, resolveRace, resolveSession, normalizeContext,
  RegistryValidationError,
} from "../core/index.mjs";

const registry = JSON.parse(readFileSync(new URL("../../../data/race-desk/registry.v1.json", import.meta.url)));
const copy = () => structuredClone(registry);
const ambiguous = {
  status: "ambiguous", reason: "race-name-ambiguous",
  raceIds: ["2025-singapore-gp", "2026-singapore-gp"],
};

test("exact repeated names are ambiguous, deterministic and season scoped", () => {
  const selector = { eventName: "Singapore Grand Prix" };
  assert.deepEqual(resolveRace(registry, selector), ambiguous);
  const reversed = copy();
  reversed.races.reverse();
  assert.equal(JSON.stringify(resolveRace(reversed, selector)), JSON.stringify(ambiguous));
  for (const season of [2025, 2026]) {
    const result = resolveRace(registry, { ...selector, season });
    assert.equal(result.status, "resolved");
    assert.equal(result.race.raceId, `${season}-singapore-gp`);
  }
  assert.equal(resolveRace(registry, { ...selector, season: 2024 }).status, "missing");
  assert.deepEqual(resolveSession(registry, selector, { kind: "race" }), ambiguous);
  assert.equal(resolveSession(registry, { ...selector, season: 2025 }, { kind: "race" }).race.raceId, "2025-singapore-gp");
});

test("a name hint never guesses from a venue, display name, case or substring", () => {
  const bahrain = resolveRace(registry, { eventName: "Bahrain Grand Prix", season: 2026 });
  assert.equal(bahrain.race.raceId, "2026-bahrain-gp");
  assert.equal(bahrain.race.venue.venueId, "sepang");
  for (const eventName of ["Sepang", bahrain.race.venue.name, bahrain.race.displayName, "singapore grand prix", "Singapore", "__proto__"])
    assert.equal(resolveRace(registry, { eventName }).status, "missing", eventName);
  for (const selector of [
    { eventName: "" }, { eventName: " Singapore Grand Prix" },
    { eventName: ["Singapore Grand Prix"] }, { eventName: "Singapore Grand Prix", season: null },
    { eventName: "Singapore Grand Prix", season: "2026" },
    { eventName: "Singapore Grand Prix", season: 1949 },
    { eventName: "Singapore Grand Prix", raceId: "2026-singapore-gp" },
  ]) assert.throws(() => resolveRace(registry, selector), RegistryValidationError);
  assert.throws(() => resolveSession(registry, { eventName: "Singapore Grand Prix" }, { kind: "invalid" }), RegistryValidationError);
});

test("same-season repeated names stay ambiguous without invalidating independent IDs", () => {
  const data = copy(), race = structuredClone(data.races.find(r => r.raceId === "2026-japanese-gp"));
  race.raceId = "2026-japanese-second-gp";
  race.sourceKeys = { openf1MeetingKey: null, jolpica: null, tyresRaceId: null, tyresSlug: null };
  race.evidence = race.evidence.filter(c => !c.field.startsWith("sourceKeys."));
  data.races.push(race);
  assert.equal(validateRegistry(data).valid, true);
  assert.deepEqual(resolveRace(data, { eventName: race.eventName, season: 2026 }), {
    status: "ambiguous", reason: "race-name-ambiguous",
    raceIds: ["2026-japanese-gp", "2026-japanese-second-gp"],
  });
  assert.equal(resolveRace(data, { raceId: race.raceId }).race, race);
  // Duplicate identity/provider bindings remain corrupt data, not legitimate name ambiguity.
  data.races.push(structuredClone(race));
  assert.equal(validateRegistry(data).valid, false);
  assert.throws(() => resolveRace(data, { eventName: race.eventName }), RegistryValidationError);
});

function setStart(session, startUtc) {
  session.startUtc = startUtc;
  session.evidence = session.evidence.filter(c => c.field !== "startUtc");
  if (startUtc !== null) session.evidence.push({
    field: "startUtc", value: startUtc, sourceId: registry.sources[0].id,
    reference: "/synthetic/chronology", status: "verified",
  });
}

test("chronology rejects reversal/equality, including across missing starts", () => {
  for (const gap of [false, true]) for (const reversed of [false, true]) {
    const data = copy(), sessions = data.races[0].sessions, later = gap ? 2 : 1;
    if (gap) setStart(sessions[1], null);
    setStart(sessions[later], reversed ? "2026-03-26T23:30:00.000Z" : sessions[0].startUtc);
    const validation = validateRegistry(data);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some(e => e.code === "chronology" && e.path === `$.races[0].sessions[${later}].startUtc`));
    assert.throws(() => resolveRace(data, { raceId: data.races[0].raceId }), RegistryValidationError);
  }
});

test("incomplete schedules and null instants stay valid without imposing a sprint era", () => {
  for (const race of registry.races) {
    const data = copy();
    data.races = [structuredClone(race)];
    for (const session of data.races[0].sessions) setStart(session, null);
    assert.equal(validateRegistry(data).valid, true);
    data.races[0].sessions = [];
    assert.equal(validateRegistry(data).valid, true);
    assert.equal(resolveSession(data, { raceId: race.raceId }, { kind: "race" }).status, "missing");
  }
  const data = copy(), race = data.races[0];
  race.sessions = [race.sessions[0], race.sessions[2], race.sessions[4]];
  setStart(race.sessions[1], null);
  assert.equal(validateRegistry(data).valid, true);
  assert.equal(normalizeContext(data, { raceId: race.raceId, sessionKind: "race" }).context.openf1SessionKey, null);
  // Earlier sprint formats can put qualifying before sprint; timestamps establish order.
  const sprint = data.races.find(r => r.raceId === "2026-singapore-gp");
  [sprint.sessions[1].kind, sprint.sessions[3].kind] = [sprint.sessions[3].kind, sprint.sessions[1].kind];
  for (const i of [1, 3]) sprint.sessions[i].evidence.find(c => c.field === "kind").value = sprint.sessions[i].kind;
  assert.equal(validateRegistry(data).valid, true);
});

test("invalid timestamp values fail validation without chronology coercion", () => {
  for (const value of ["2026-02-30T00:00:00.000Z", "2026-03-27T01:00:00+00:00", {}, [], 0, ""]) {
    const data = copy();
    setStart(data.races[0].sessions[1], value);
    const result = validateRegistry(data);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.path === "$.races[0].sessions[1].startUtc" && e.code === "invalid"));
    assert.equal(result.errors.filter(e => e.code === "chronology").length, 0);
  }
});

test("all exact identity bindings round trip and coverage CLI bytes repeat without network", () => {
  for (const race of registry.races) {
    const selectors = [{ raceId: race.raceId }, { tyresRaceId: race.sourceKeys.tyresRaceId },
      { season: race.season, tyresSlug: race.sourceKeys.tyresSlug }];
    if (race.sourceKeys.jolpica) selectors.push({ season: race.season, jolpicaRound: race.sourceKeys.jolpica.round });
    for (const selector of selectors) {
      assert.equal(resolveRace(registry, selector).race.raceId, race.raceId);
      for (const session of race.sessions)
        assert.equal(resolveSession(registry, selector, { kind: session.kind }).session, session);
    }
  }
  const run = () => spawnSync(process.execPath, [new URL("../validate.mjs", import.meta.url).pathname], { encoding: "utf8" });
  const first = run(), second = run();
  assert.equal(first.status, 0);
  assert.equal(second.status, 0);
  assert.equal(first.stdout, second.stdout);
  assert.equal(first.stderr, second.stderr);
});
