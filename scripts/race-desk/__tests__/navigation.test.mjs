import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseToolUrl, planToolLink } from "../core/navigation.mjs";
import { RegistryValidationError } from "../core/index.mjs";
import { parseRoundPin } from "../../../standings/core/rounds.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const seed = read("../../../data/race-desk/registry.v1.json");
const urls = read("./fixtures/tool-urls.v1.json");
const options = { currentYear: 2026 };
const claim = (field, value) => ({ field, value, sourceId: "synthetic-openf1", reference: "/fixture", status: "verified" });
function synthetic() {
  const registry = structuredClone(seed);
  registry.sources.push({ id: "synthetic-openf1", repository: "synthetic/test", revision: "a".repeat(40), path: "fixture.json", gitBlob: "b".repeat(40), reviewedAt: "2026-01-01T00:00:00.000Z" });
  const race = registry.races.find((row) => row.raceId === "2026-japanese-gp");
  race.sourceKeys.openf1MeetingKey = 1234;
  race.evidence.push(claim("sourceKeys.openf1MeetingKey", 1234));
  race.sessions[0].openf1SessionKey = 5678;
  race.sessions[0].evidence.push(claim("openf1SessionKey", 5678));
  const fact = { season: 2026, openf1MeetingKey: 1234, circuitShortName: "Suzuka Test", sourceId: "synthetic-openf1", reference: "/fixture/circuit", status: "verified" };
  return { registry, fact };
}
function checkReport(report) {
  assert.deepEqual(Object.keys(report).sort(), ["ambiguous", "dropped", "preserved", "unresolved"]);
  for (const entries of Object.values(report)) {
    assert.ok(Array.isArray(entries));
    for (const entry of entries) {
      assert.equal(typeof entry.field, "string");
      assert.equal(typeof entry.reason, "string");
      assert.ok(Object.keys(entry).every((key) => ["field", "reason", "candidates"].includes(key)));
    }
    assert.deepEqual(entries.map((entry) => entry.field), entries.map((entry) => entry.field).toSorted());
  }
}
function checkParse(result) {
  checkReport(result.report);
  assert.ok(["resolved", "missing", "ambiguous", "unsupported", "invalid"].includes(result.status));
  assert.equal(Object.hasOwn(result, "context"), result.status === "resolved");
  assert.equal(Object.hasOwn(result, "reason"), result.status !== "resolved");
}
function checkPlan(result) {
  checkReport(result.report);
  assert.ok(["exact", "partial", "generic"].includes(result.kind));
  assert.equal(typeof result.url, "string");
  assert.equal(result.notice === null, result.kind === "exact");
}
const fields = (entries) => entries.map((entry) => entry.field);

test("real seed race links reverse without inventing OpenF1 identifiers", () => {
  for (const row of urls.realSeed) {
    for (const [tool, url] of [["tyres", row.tyres], ["grid", row.grid]]) {
      const result = parseToolUrl(seed, url, options);
      checkParse(result);
      assert.equal(result.status, "resolved");
      assert.equal(result.tool, tool);
      assert.equal(result.context.raceId, row.raceId);
      assert.equal(result.context.openf1SessionKey, null);
    }
    for (const tool of ["ghostcar", "telemetry"]) {
      const result = planToolLink(seed, { raceId: row.raceId }, tool, options);
      checkPlan(result);
      assert.equal(result.kind, "generic");
      assert.ok(result.notice);
    }
  }
});

test("synthetic equal-lap Ghostcar and Telemetry round-trip preserves driver order", () => {
  const { registry, fact } = synthetic();
  const opts = { ...options, telemetryCircuit: fact };
  for (const [source, target, url] of [["ghostcar", "telemetry", urls.syntheticOpenF1.ghostcar], ["telemetry", "ghostcar", urls.syntheticOpenF1.telemetry]]) {
    const parsed = parseToolUrl(registry, url, opts);
    checkParse(parsed);
    assert.equal(parsed.status, "resolved");
    assert.equal(parsed.tool, source);
    assert.deepEqual(parsed.context.drivers.map((d) => [d.driverNumber, d.lapNumber]), [[44, 12], [1, 12]]);
    const plan = planToolLink(registry, parsed.context, target, opts);
    checkPlan(plan);
    assert.equal(plan.kind, "exact");
    const back = parseToolUrl(registry, plan.url, opts);
    checkParse(back);
    assert.equal(back.status, "resolved");
    assert.deepEqual(back.context, parsed.context);
  }
});

test("loss planner discloses scope and cannot collapse independent laps", () => {
  const { registry, fact } = synthetic();
  const opts = { ...options, telemetryCircuit: fact };
  const parsed = parseToolUrl(registry, urls.syntheticOpenF1.ghostcar, opts);
  assert.equal(parsed.status, "resolved");
  for (const target of ["grid", "tyres"]) {
    const plan = planToolLink(registry, parsed.context, target, opts);
    checkPlan(plan);
    assert.equal(plan.kind, "partial");
    const lost = fields(plan.report.dropped);
    for (const field of ["sessionKind", "openf1SessionKey", "drivers", "laps"]) assert.ok(lost.includes(field), `${target} must disclose ${field}`);
  }
  const unequal = structuredClone(parsed.context);
  unequal.drivers[1].lapNumber = 13;
  const plan = planToolLink(registry, unequal, "telemetry", opts);
  checkPlan(plan);
  assert.equal(plan.kind, "generic");
  assert.ok([...fields(plan.report.dropped), ...fields(plan.report.unresolved)].includes("laps"));
});

test("hostile, ambiguous, malformed and unrecognised inputs never resolve", () => {
  const { registry, fact } = synthetic();
  const base = urls.syntheticOpenF1.ghostcar;
  const inputs = [
    "https://f1-stories.gr.evil.example/ghostcar/?y=2026",
    "https://user@f1-stories.gr/ghostcar/?y=2026",
    "https://f1-stories.gr/ghostcar/%2e%2e/tyres/2026/suzuka/",
    `${base}&%79=2026`, `${base}&v=2`, base.replace("v=2", "v="), base.replace("v=2", "v=3"),
    base.replace("d1=44", "d1=100"), base.replace("l1=12", "l1=0"),
    "https://f1-stories.gr/tyres/2026/suzuka/?year=bad&race=suzuka",
    "https://f1-stories.gr/standings/?tab=drivers&embed=1&season=1999&round=3",
    `https://f1-stories.gr/ghostcar/?${"x".repeat(8200)}`,
  ];
  for (const url of inputs) {
    const result = parseToolUrl(registry, url, { ...options, telemetryCircuit: fact });
    checkParse(result);
    assert.notEqual(result.status, "resolved", url);
  }
});

test("presentation state and query/path precedence remain visible", () => {
  const { registry, fact } = synthetic();
  const ghost = parseToolUrl(registry, `${urls.syntheticOpenF1.ghostcar}&tv=3d&fig=map&from=1&to=20&fixed=1#view`, { ...options, telemetryCircuit: fact });
  checkParse(ghost);
  assert.equal(ghost.status, "resolved");
  const disclosed = [...fields(ghost.report.dropped), ...fields(ghost.report.unresolved)];
  for (const field of ["query.tv", "query.fig", "query.from", "query.to", "query.fixed", "hash"]) assert.ok(disclosed.includes(field), field);
  const override = parseToolUrl(seed, "https://f1-stories.gr/tyres/2026/suzuka/?race=sepang", options);
  checkParse(override);
  assert.equal(override.status, "resolved");
  assert.equal(override.context.raceId, "2026-bahrain-gp");
  assert.ok(fields(override.report.dropped).includes("path.slug"));
  const yearOnly = parseToolUrl(seed, "https://f1-stories.gr/tyres/2026/suzuka/?year=2026", options);
  checkParse(yearOnly);
  assert.notEqual(yearOnly.status, "resolved");
  const ordinaryGrid = parseToolUrl(seed, "https://f1-stories.gr/standings/?tab=drivers&season=2026&round=3", options);
  checkParse(ordinaryGrid);
  assert.notEqual(ordinaryGrid.status, "resolved");
});

test("programmer errors are typed and inputs are not mutated", () => {
  const { registry, fact } = synthetic();
  const before = structuredClone(registry);
  assert.throws(() => parseToolUrl(registry, urls.syntheticOpenF1.ghostcar, {}), RegistryValidationError);
  assert.throws(() => planToolLink(registry, { raceId: "2026-japanese-gp" }, "invalid", options), RegistryValidationError);
  const bad = structuredClone(registry);
  bad.races.push(structuredClone(bad.races[0]));
  assert.throws(() => parseToolUrl(bad, urls.syntheticOpenF1.ghostcar, options), RegistryValidationError);
  parseToolUrl(registry, urls.syntheticOpenF1.ghostcar, { ...options, telemetryCircuit: fact });
  assert.deepEqual(registry, before);
});

test("legacy Telemetry bases and panel hashes preserve scope and disclose presentation", () => {
  const { registry, fact } = synthetic();
  const opts = { ...options, telemetryCircuit: fact };
  for (const base of [
    "https://georgiosbalatzis.github.io/f1-telemetry-dashboard/",
    "https://f1-stories.gr/telemetry/",
    "https://f1stories.gr/telemetry/",
    "https://www.f1stories.gr/telemetry/",
  ]) {
    const url = new URL(urls.syntheticOpenF1.telemetry);
    const legacy = `${base}${url.search}#telemetry-speed-trace`;
    const result = parseToolUrl(registry, legacy, opts);
    checkParse(result);
    assert.equal(result.status, "resolved", legacy);
    assert.ok(fields(result.report.dropped).includes("hash"));
  }
  const mismatch = urls.syntheticOpenF1.telemetry.replace("Suzuka+Test", "Other+Circuit");
  const result = parseToolUrl(registry, mismatch, opts);
  checkParse(result);
  assert.notEqual(result.status, "resolved");
  const missingFact = parseToolUrl(registry, urls.syntheticOpenF1.telemetry, options);
  checkParse(missingFact);
  assert.notEqual(missingFact.status, "resolved");
  for (const url of [
    urls.syntheticOpenF1.telemetry.replace("drivers=44%2C1", "drivers=44%2C44"),
    `${urls.syntheticOpenF1.telemetry}&%6cap=12`,
  ]) {
    const invalid = parseToolUrl(registry, url, opts);
    checkParse(invalid);
    assert.notEqual(invalid.status, "resolved", url);
  }
});

test("Ghostcar v1 year alias and Grid qualifying presentation are handled explicitly", () => {
  const { registry, fact } = synthetic();
  const opts = { ...options, telemetryCircuit: fact };
  for (const url of [urls.syntheticOpenF1.ghostcar.replace("y=2026", "year=2026").replace("&v=2", ""), urls.syntheticOpenF1.ghostcar.replace("v=2", "v=1")]) {
    const parsed = parseToolUrl(registry, url, opts);
    checkParse(parsed);
    assert.equal(parsed.status, "resolved");
  }
  const bothYears = parseToolUrl(registry, `${urls.syntheticOpenF1.ghostcar}&year=2026`, opts);
  checkParse(bothYears);
  assert.notEqual(bothYears.status, "resolved");
  const grid = parseToolUrl(seed, `${urls.realSeed[0].grid.replace("tab=drivers", "tab=quali-gaps")}&qualiSession=5678`, options);
  checkParse(grid);
  assert.notEqual(grid.status, "resolved");
});

test("native legacy routes and escaped Telemetry separators retain verified scope", () => {
  const { registry, fact } = synthetic();
  const opts = { ...options, telemetryCircuit: fact };
  for (const [tool, url] of [["tyres", urls.legacy.tyres], ["ghostcar", urls.legacy.ghostcar]]) {
    const result = parseToolUrl(registry, url, opts);
    checkParse(result);
    assert.equal(result.status, "resolved", url);
    assert.equal(result.tool, tool);
    assert.equal(result.context.raceId, "2026-japanese-gp");
  }
  for (const separator of ["&amp;", "&#38;", "&#x26;"]) {
    const escaped = urls.syntheticOpenF1.telemetry.replaceAll("&", separator);
    const result = parseToolUrl(registry, escaped, opts);
    checkParse(result);
    assert.equal(result.status, "resolved", separator);
    assert.deepEqual(result.context.drivers.map(d => d.driverNumber), [44, 1]);
  }
});

test("malformed URL encoding anywhere cannot be ignored as presentation", () => {
  const { registry, fact } = synthetic();
  const opts = { ...options, telemetryCircuit: fact };
  for (const url of [
    `${urls.realSeed[0].tyres}#%ZZ`, `${urls.realSeed[0].tyres}#%C3%28`, `${urls.realSeed[0].tyres}#%0A`,
    ...["%ZZ", "%C3%28", "%0A", "%5C"].map(value => `${urls.syntheticOpenF1.ghostcar}&tv=${value}`),
    `${urls.syntheticOpenF1.ghostcar}&%ZZ=1`, `${urls.syntheticOpenF1.ghostcar}&%C3%28=1`,
  ]) {
    const result = parseToolUrl(registry, url, opts);
    checkParse(result);
    assert.equal(result.status, "invalid", url);
  }
});

test("TYRES query year requires exactly four digits and Grid honours both standings tabs", () => {
  for (const year of ["02026", "026", "20260", "20x6"]) {
    const result = parseToolUrl(seed, `https://f1-stories.gr/tyres/?year=${year}&race=suzuka`, options);
    checkParse(result);
    assert.notEqual(result.status, "resolved", year);
  }
  for (const tab of ["drivers", "constructors", null]) {
    const url = new URL(urls.realSeed[0].grid);
    if (tab) url.searchParams.set("tab", tab); else url.searchParams.delete("tab");
    const result = parseToolUrl(seed, url.href, options);
    checkParse(result);
    assert.equal(result.status, "resolved", String(tab));
    assert.equal(result.context.raceId, "2026-japanese-gp");
  }
});

test("valid Telemetry tabs retain scope but unknown tabs do not", () => {
  const { registry, fact } = synthetic();
  const opts = { ...options, telemetryCircuit: fact };
  for (const tab of ["energy", "trackmap", "positions", "intervals", "tires", "radio", "incidents", "weather", "broadcast"]) {
    const url = urls.syntheticOpenF1.telemetry.replace("tab=telemetry", `tab=${tab}`);
    const result = parseToolUrl(registry, url, opts);
    checkParse(result);
    assert.equal(result.status, "resolved", tab);
    assert.ok(fields(result.report.dropped).includes("query.tab"));
  }
  const invalid = parseToolUrl(registry, urls.syntheticOpenF1.telemetry.replace("tab=telemetry", "tab=unknown"), opts);
  checkParse(invalid);
  assert.notEqual(invalid.status, "resolved");
});

test("failed resolutions account for all explicitly selected scope", () => {
  const { registry, fact } = synthetic();
  const opts = { ...options, telemetryCircuit: fact };
  const selected = { raceId: "2026-unknown-gp", sessionKind: "race", openf1SessionKey: 5678, drivers: [{ openf1SessionKey: 5678, driverNumber: 44, lapNumber: 12 }] };
  const plan = planToolLink(registry, selected, "telemetry", opts);
  checkPlan(plan);
  assert.equal(plan.kind, "generic");
  const reported = [...fields(plan.report.unresolved), ...fields(plan.report.dropped)];
  for (const field of ["raceId", "sessionKind", "openf1SessionKey", "drivers", "laps"]) assert.ok(reported.includes(field), field);
  const bad = parseToolUrl(registry, urls.syntheticOpenF1.ghostcar.replace("mk=1234", "mk=9999"), opts);
  checkParse(bad);
  assert.notEqual(bad.status, "resolved");
  const parseReported = [...fields(bad.report.unresolved), ...fields(bad.report.dropped), ...fields(bad.report.ambiguous)];
  for (const field of ["raceId", "season", "openf1SessionKey", "drivers", "laps"]) assert.ok(parseReported.includes(field), field);
});

test("round trips are deterministic and preserve all input values", () => {
  const { registry, fact } = synthetic();
  const opts = { ...options, telemetryCircuit: fact };
  const before = structuredClone({ registry, opts });
  const a = parseToolUrl(registry, urls.syntheticOpenF1.ghostcar, opts);
  const b = parseToolUrl(registry, urls.syntheticOpenF1.ghostcar, opts);
  assert.deepEqual(a, b);
  assert.equal(a.status, "resolved");
  const snapshot = structuredClone(a.context);
  const one = planToolLink(registry, a.context, "telemetry", opts);
  const two = planToolLink(registry, a.context, "telemetry", opts);
  assert.deepEqual(one, two);
  assert.deepEqual(a.context, snapshot);
  assert.deepEqual({ registry, opts }, before);
});

test("consumer numeric bounds and unsupported session selections fail closed", () => {
  const { registry, fact } = synthetic();
  const opts = { ...options, telemetryCircuit: fact };
  for (const url of [
    urls.syntheticOpenF1.telemetry.replace("lap=12", "lap=201"),
    urls.syntheticOpenF1.telemetry.replace("session=5678", "session=0"),
    urls.syntheticOpenF1.telemetry.replace("year=2026", "year=2027"),
    urls.syntheticOpenF1.ghostcar.replace("sk=5678", "sk=9999"),
    urls.syntheticOpenF1.ghostcar.replace("d2=1", "d2=44"),
    urls.realSeed[0].grid.replace("round=3", "round=31"),
  ]) {
    const result = parseToolUrl(registry, url, opts);
    checkParse(result);
    assert.notEqual(result.status, "resolved", url);
  }
  const uppercaseQuery = parseToolUrl(seed, "https://f1-stories.gr/tyres/?year=2026&race=SUZUKA", options);
  checkParse(uppercaseQuery);
  assert.equal(uppercaseQuery.status, "resolved");
  assert.equal(uppercaseQuery.context.raceId, "2026-japanese-gp");
});

test("Grid round pin digit grammar agrees with the native consumer", () => {
  for (const [round, expected] of [["00003", null], ["0000003", null], ["0003", "3"], ["%203%20", "3"]]) {
    const search = `?tab=drivers&embed=1&season=2026&round=${round}`;
    const native = parseRoundPin(search, 2026);
    assert.equal(native?.round ?? null, expected, round);
    const result = parseToolUrl(seed, `https://f1-stories.gr/standings/${search}`, options);
    checkParse(result);
    if (expected === null) assert.notEqual(result.status, "resolved", round);
    else {
      assert.equal(result.status, "resolved", round);
      assert.equal(result.context.raceId, "2026-japanese-gp");
    }
  }
  const search = "?tab=drivers&embed=1&season=02026&round=3";
  assert.deepEqual(parseRoundPin(search, 2026), { season: "2026", round: "3" });
  const result = parseToolUrl(seed, `https://f1-stories.gr/standings/${search}`, options);
  checkParse(result);
  assert.notEqual(result.status, "resolved");
});

test("inherited options cannot smuggle unvalidated circuit facts or current year", () => {
  const { registry } = synthetic();
  const inheritedFact = Object.assign(Object.create({ telemetryCircuit: { season: 2026, openf1MeetingKey: 1234, circuitShortName: "Suzuka Test" } }), { currentYear: 2026 });
  const inheritedYear = Object.create({ currentYear: 2026 });
  for (const opts of [inheritedFact, inheritedYear]) {
    assert.throws(() => parseToolUrl(registry, urls.syntheticOpenF1.telemetry, opts), RegistryValidationError);
    assert.throws(() => planToolLink(registry, { raceId: "2026-japanese-gp" }, "telemetry", opts), RegistryValidationError);
  }
});

test("TYRES resolves the pinned manifest ID forms within the requested season", () => {
  for (const race of ["2026-jp", "jp", "JP"]) {
    const result = parseToolUrl(seed, `https://f1-stories.gr/tyres/?year=2026&race=${race}`, options);
    checkParse(result);
    assert.equal(result.status, "resolved", race);
    assert.equal(result.context.raceId, "2026-japanese-gp");
  }
  const wrongYear = parseToolUrl(seed, "https://f1-stories.gr/tyres/?year=2025&race=2026-jp", options);
  checkParse(wrongYear);
  assert.notEqual(wrongYear.status, "resolved");
});

test("TYRES slug and ID collisions are ambiguous regardless of registry order", () => {
  const registry = structuredClone(seed);
  const bahrain = registry.races.find(r => r.raceId === "2026-bahrain-gp");
  bahrain.sourceKeys.tyresSlug = "2026-jp";
  bahrain.evidence.find(c => c.field === "sourceKeys.tyresSlug").value = "2026-jp";
  const url = "https://f1-stories.gr/tyres/?year=2026&race=2026-jp";
  const first = parseToolUrl(registry, url, options);
  checkParse(first);
  assert.equal(first.status, "ambiguous");
  const entry = first.report.ambiguous.find(e => e.field === "raceId");
  assert.deepEqual(entry?.candidates, ["2026-bahrain-gp", "2026-japanese-gp"]);
  const reversed = structuredClone(registry);
  reversed.races.reverse();
  assert.deepEqual(parseToolUrl(reversed, url, options), first);
});

test("Ghostcar infers legacy driver counts and rejects inconsistent selections", () => {
  const { registry, fact } = synthetic();
  const opts = { ...options, telemetryCircuit: fact };
  const base = urls.syntheticOpenF1.ghostcar;
  for (const [extra, expected] of [["&nd=2", [44, 1]], ["&d3=16&l3=12", [44, 1, 16]], ["&d3=16&l3=12&d4=4&l4=12", [44, 1, 16, 4]]]) {
    const result = parseToolUrl(registry, base + extra, opts);
    checkParse(result);
    assert.equal(result.status, "resolved", extra);
    assert.deepEqual(result.context.drivers.map(d => d.driverNumber), expected);
  }
  for (const extra of ["&nd=3", "&nd=2&d3=16&l3=12", "&d4=4&l4=12", "&d3=16"]) {
    const result = parseToolUrl(registry, base + extra, opts);
    checkParse(result);
    assert.notEqual(result.status, "resolved", extra);
  }
});
