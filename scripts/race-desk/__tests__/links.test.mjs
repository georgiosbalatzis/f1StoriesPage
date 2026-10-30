import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildToolLink } from "../core/links.mjs";
import { parseRoundPin } from "../../../standings/core/rounds.js";
import { RegistryValidationError } from "../core/index.mjs";

const seed = JSON.parse(
  readFileSync(
    new URL("../../../data/race-desk/registry.v1.json", import.meta.url),
  ),
);
const claim = (field, value) => ({
  field,
  value,
  sourceId: "synthetic-openf1",
  reference: "/fixture",
  status: "verified",
});
function fixture() {
  const data = structuredClone(seed);
  data.sources.push({
    id: "synthetic-openf1",
    repository: "synthetic/test",
    revision: "a".repeat(40),
    path: "fixture.json",
    gitBlob: "b".repeat(40),
    reviewedAt: "2026-01-01T00:00:00.000Z",
  });
  const race = data.races.find((r) => r.raceId === "2026-japanese-gp");
  race.sourceKeys.openf1MeetingKey = 1234;
  race.evidence.push(claim("sourceKeys.openf1MeetingKey", 1234));
  race.sessions[0].openf1SessionKey = 5678;
  race.sessions[0].evidence.push(claim("openf1SessionKey", 5678));
  const fact = {
    season: 2026,
    openf1MeetingKey: 1234,
    circuitShortName: "Suzuka Test",
    sourceId: "synthetic-openf1",
    reference: "/fixture/circuit",
    status: "verified",
  };
  const driver = (driverNumber, lapNumber) => ({
    openf1SessionKey: 5678,
    driverNumber,
    lapNumber,
  });
  const context = {
    raceId: race.raceId,
    openf1SessionKey: 5678,
    drivers: [driver(44, 12), driver(1, 13)],
  };
  return { data, race, fact, context, driver };
}
const result = (status, reason) => ({ status, reason });
const telemetry = (fact) => ({ currentYear: 2026, telemetryCircuit: fact });

test("golden links match pinned consumer paths and parameters", () => {
  const { data, race, context, fact } = fixture();
  assert.deepEqual(buildToolLink(data, { raceId: race.raceId }, "tyres"), {
    status: "resolved",
    url: "https://f1-stories.gr/tyres/2026/suzuka/",
  });
  assert.deepEqual(
    buildToolLink(data, { raceId: race.raceId }, "grid", { currentYear: 2026 }),
    {
      status: "resolved",
      url: "https://f1-stories.gr/standings/?tab=drivers&embed=1&season=2026&round=3",
    },
  );
  const ghost = buildToolLink(data, context, "ghostcar");
  assert.deepEqual(ghost, {
    status: "resolved",
    url: "https://f1-stories.gr/ghostcar/?y=2026&mk=1234&sk=5678&d1=44&d2=1&l1=12&l2=13&v=2",
  });
  const oneLap = structuredClone(context);
  oneLap.drivers[1].lapNumber = 12;
  const link = buildToolLink(data, oneLap, "telemetry", telemetry(fact));
  assert.deepEqual(link, {
    status: "resolved",
    url: "https://f1-stories.gr/telemetry/?year=2026&circuit=Suzuka+Test&session=5678&drivers=44%2C1&lap=12&tab=telemetry",
  });
  const parsed = new URL(link.url);
  assert.equal(parsed.searchParams.get("drivers"), "44,1");
  assert.equal(parsed.searchParams.get("tab"), "telemetry");
  assert.equal(new URL(ghost.url).searchParams.get("l2"), "13");
});

test("scope, absent mapping and R01 missing are fail closed", () => {
  const { data, race, context, fact } = fixture();
  for (const target of ["tyres", "grid"])
    assert.deepEqual(
      buildToolLink(data, context, target, { currentYear: 2026 }),
      result("unsupported", "selected-scope-not-supported"),
    );
  assert.deepEqual(
    buildToolLink(seed, { raceId: race.raceId }, "ghostcar"),
    result("missing", "openf1-meeting-unmapped"),
  );
  assert.deepEqual(
    buildToolLink(data, { raceId: race.raceId }, "ghostcar"),
    result("missing", "session-unmapped"),
  );
  assert.deepEqual(
    buildToolLink(data, { ...context, openf1SessionKey: 9999 }, "ghostcar"),
    result("missing", "session-not-found"),
  );
  assert.deepEqual(
    buildToolLink(data, { raceId: "2026-unknown-gp" }, "tyres"),
    result("missing", "race-not-found"),
  );
  const same = structuredClone(context);
  same.drivers[1].lapNumber = 12;
  assert.deepEqual(
    buildToolLink(data, same, "telemetry", { currentYear: 2026 }),
    result("missing", "telemetry-circuit-unmapped"),
  );
  const unmapped = data.races.find((r) => r.sourceKeys.jolpica === null);
  assert.deepEqual(
    buildToolLink(data, { raceId: unmapped.raceId }, "grid", {
      currentYear: 2026,
    }),
    result("missing", "jolpica-mapping-unavailable"),
  );
  race.sourceKeys.tyresSlug = null;
  race.evidence = race.evidence.filter(
    (c) => c.field !== "sourceKeys.tyresSlug",
  );
  assert.deepEqual(
    buildToolLink(data, { raceId: race.raceId }, "tyres"),
    result("missing", "tyres-mapping-unavailable"),
  );
});

test("driver counts, lap selection and order follow each consumer", () => {
  const { data, context, fact, driver } = fixture();
  for (const n of [0, 1]) {
    const input = { ...context, drivers: context.drivers.slice(0, n) };
    assert.deepEqual(
      buildToolLink(data, input, "ghostcar"),
      result("unsupported", "driver-count-not-supported"),
    );
  }
  assert.deepEqual(
    buildToolLink(
      data,
      { ...context, drivers: [] },
      "telemetry",
      telemetry(fact),
    ),
    result("unsupported", "driver-count-not-supported"),
  );
  for (const laps of [
    [null, null],
    [12, null],
    [null, 12],
  ]) {
    const input = {
      ...context,
      drivers: laps.map((lap, i) => driver(i + 1, lap)),
    };
    for (const target of ["ghostcar", "telemetry"])
      assert.deepEqual(
        buildToolLink(
          data,
          input,
          target,
          target === "telemetry" ? telemetry(fact) : {},
        ),
        result("unsupported", "lap-selection-required"),
      );
  }
  assert.deepEqual(
    buildToolLink(data, context, "telemetry", telemetry(fact)),
    result("unsupported", "independent-laps-not-supported"),
  );
  const four = {
    ...context,
    drivers: [driver(99, 1), driver(2, 2), driver(3, 3), driver(4, 4)],
  };
  const query = new URL(buildToolLink(data, four, "ghostcar").url).searchParams;
  assert.deepEqual(
    [...query.entries()],
    [
      ["y", "2026"],
      ["mk", "1234"],
      ["sk", "5678"],
      ["d1", "99"],
      ["d2", "2"],
      ["d3", "3"],
      ["d4", "4"],
      ["l1", "1"],
      ["l2", "2"],
      ["l3", "3"],
      ["l4", "4"],
      ["nd", "4"],
      ["v", "2"],
    ],
  );
  const three = { ...four, drivers: four.drivers.slice(0, 3) };
  assert.equal(
    new URL(buildToolLink(data, three, "ghostcar").url).searchParams.get("nd"),
    "3",
  );
  assert.throws(
    () =>
      buildToolLink(
        data,
        { ...four, drivers: [...four.drivers, driver(5, 5)] },
        "ghostcar",
      ),
    RegistryValidationError,
  );
});

test("invalid options, fact scope, context and registries throw typed errors", () => {
  const { data, race, context, fact } = fixture();
  for (const options of [
    null,
    [],
    { foo: 1 },
    { currentYear: 1949 },
    { currentYear: 2101 },
    { currentYear: "2026" },
    { telemetryCircuit: fact },
  ])
    assert.throws(
      () => buildToolLink(data, context, "ghostcar", options),
      RegistryValidationError,
    );
  for (const candidate of [
    "Suzuka",
    [],
    { ...fact, extra: true },
    { ...fact, season: 2025 },
    { ...fact, openf1MeetingKey: 999 },
    { ...fact, sourceId: "unknown" },
    { ...fact, reference: "" },
    { ...fact, status: "unverified" },
    { ...fact, circuitShortName: "bad/slug" },
    { ...fact, circuitShortName: " Suzuka" },
    { ...fact, circuitShortName: "x".repeat(81) },
  ])
    assert.throws(
      () => buildToolLink(data, context, "telemetry", telemetry(candidate)),
      RegistryValidationError,
    );
  for (const target of ["grid", "telemetry"])
    assert.throws(
      () => buildToolLink(data, context, target),
      RegistryValidationError,
    );
  assert.throws(
    () => buildToolLink(data, context, "unknown"),
    RegistryValidationError,
  );
  assert.throws(
    () =>
      buildToolLink(
        data,
        {
          ...context,
          drivers: [{ ...context.drivers[0], openf1SessionKey: 999 }],
        },
        "ghostcar",
      ),
    RegistryValidationError,
  );
  const duplicate = structuredClone(data);
  duplicate.races.push(structuredClone(race));
  assert.throws(
    () => buildToolLink(duplicate, context, "ghostcar"),
    RegistryValidationError,
  );
});

test("slug and consumer year and round boundaries are enforced", () => {
  const { data, race, context, fact } = fixture();
  for (const slug of ["../outside", "A", "x".repeat(41)]) {
    race.sourceKeys.tyresSlug = slug;
    race.evidence.find((c) => c.field === "sourceKeys.tyresSlug").value = slug;
    assert.deepEqual(
      buildToolLink(data, { raceId: race.raceId }, "tyres"),
      result("unsupported", "tyres-slug-not-supported"),
    );
  }
  race.sourceKeys.jolpica.round = 31;
  race.evidence.find((c) => c.field === "sourceKeys.jolpica").value.round = 31;
  assert.deepEqual(
    buildToolLink(data, { raceId: race.raceId }, "grid", { currentYear: 2026 }),
    result("unsupported", "season-or-round-not-supported"),
  );
  race.sourceKeys.jolpica.round = 30;
  race.evidence.find((c) => c.field === "sourceKeys.jolpica").value.round = 30;
  assert.equal(
    buildToolLink(data, { raceId: race.raceId }, "grid", { currentYear: 2025 })
      .status,
    "resolved",
  );
  assert.deepEqual(
    buildToolLink(data, { raceId: race.raceId }, "grid", { currentYear: 2024 }),
    result("unsupported", "season-or-round-not-supported"),
  );
  const same = structuredClone(context);
  same.drivers[1].lapNumber = 12;
  assert.deepEqual(
    buildToolLink(data, same, "telemetry", telemetry({ ...fact })).status,
    "resolved",
  );
  assert.deepEqual(
    buildToolLink(data, same, "telemetry", {
      currentYear: 2025,
      telemetryCircuit: fact,
    }),
    result("unsupported", "season-or-round-not-supported"),
  );
});

test("links are repeatable and do not mutate inputs", () => {
  const { data, context, fact } = fixture();
  const before = structuredClone({ data, context, fact });
  const expected = buildToolLink(data, context, "ghostcar");
  const reordered = structuredClone(data);
  reordered.races.reverse();
  reordered.sources.reverse();
  assert.deepEqual(buildToolLink(reordered, context, "ghostcar"), expected);
  assert.deepEqual(buildToolLink(data, context, "ghostcar"), expected);
  assert.deepEqual({ data, context, fact }, before);
});

test("year bounds and one to four telemetry drivers", () => {
  for (const season of [2022, 2023, 2024, 2026, 2027, 2100]) {
    const { data, race, fact, driver } = fixture();
    race.season = season;
    race.raceId = `${season}-synthetic-gp`;
    race.evidence.find((c) => c.field === "season").value = season;
    race.sourceKeys.jolpica.season = season;
    race.evidence.find((c) => c.field === "sourceKeys.jolpica").value.season =
      season;
    fact.season = season;
    for (const count of [1, 2, 3, 4]) {
      const context = {
        raceId: race.raceId,
        openf1SessionKey: 5678,
        drivers: Array.from({ length: count }, (_, i) => driver(i + 1, 5)),
      };
      const outcome = buildToolLink(
        data,
        context,
        "telemetry",
        telemetry(fact),
      );
      assert.equal(
        outcome.status,
        season >= 2023 && season <= 2026 ? "resolved" : "unsupported",
      );
      if (outcome.status === "resolved")
        assert.equal(
          new URL(outcome.url).searchParams.get("drivers"),
          context.drivers.map((d) => d.driverNumber).join(","),
        );
      if (count >= 2)
        assert.equal(
          buildToolLink(data, context, "ghostcar").status,
          "resolved",
        );
    }
    assert.equal(
      buildToolLink(data, { raceId: race.raceId }, "grid", {
        currentYear: 2026,
      }).status,
      season >= 2024 && season <= 2027 ? "resolved" : "unsupported",
    );
  }
});

test("fact is validated even when a requested session is missing", () => {
  const { data, context, fact } = fixture();
  assert.throws(
    () =>
      buildToolLink(
        data,
        { ...context, openf1SessionKey: 999 },
        "telemetry",
        telemetry({ ...fact, openf1MeetingKey: 999 }),
      ),
    RegistryValidationError,
  );
});

test("source lock matches reviewed origin, application paths and pinned revisions", () => {
  const lock = JSON.parse(
    readFileSync(new URL("../../deployment/sources.json", import.meta.url)),
  );
  assert.equal(lock.origin, "https://f1-stories.gr");
  const expected = {
    main: ["/", undefined],
    telemetry: ["/telemetry/", "38c3dd2018b810a5dce1add1f7663bcb199c845a"],
    ghostcar: ["/ghostcar/", "4d7a783d9866bce917f61ae6546e48bc0d38b622"],
    tyres: ["/tyres/", "50e5f50be89e038257cbe3426b366810e0c1f59a"],
  };
  for (const [name, [path, sha]] of Object.entries(expected)) {
    const app = lock.applications.find((item) => item.application === name);
    assert.equal(app.path, path);
    assert.equal(app.sha, sha);
  }
  const { data, context, fact } = fixture();
  const equalLaps = structuredClone(context);
  equalLaps.drivers[1].lapNumber = 12;
  const links = [
    [buildToolLink(data, { raceId: "2026-japanese-gp" }, "tyres"), "/tyres/"],
    [
      buildToolLink(data, { raceId: "2026-japanese-gp" }, "grid", {
        currentYear: 2026,
      }),
      "/standings/",
    ],
    [buildToolLink(data, context, "ghostcar"), "/ghostcar/"],
    [
      buildToolLink(data, equalLaps, "telemetry", telemetry(fact)),
      "/telemetry/",
    ],
  ];
  for (const [link, prefix] of links) {
    const parsed = new URL(link.url);
    assert.equal(parsed.origin, lock.origin);
    assert.ok(parsed.pathname.startsWith(prefix));
  }
});

test("real seed produces exact TYRES and Grid links while OpenF1 remains unmapped", () => {
  const cases = [
    [
      "2026-japanese-gp",
      "https://f1-stories.gr/tyres/2026/suzuka/",
      "https://f1-stories.gr/standings/?tab=drivers&embed=1&season=2026&round=3",
    ],
    [
      "2026-bahrain-gp",
      "https://f1-stories.gr/tyres/2026/sepang/",
      "https://f1-stories.gr/standings/?tab=drivers&embed=1&season=2026&round=16",
    ],
    [
      "2026-azerbaijan-gp",
      "https://f1-stories.gr/tyres/2026/baku/",
      "https://f1-stories.gr/standings/?tab=drivers&embed=1&season=2026&round=15",
    ],
    [
      "2026-singapore-gp",
      "https://f1-stories.gr/tyres/2026/marina-bay/",
      "https://f1-stories.gr/standings/?tab=drivers&embed=1&season=2026&round=17",
    ],
    ["2025-singapore-gp", "https://f1-stories.gr/tyres/2025/marina-bay/", null],
    ["2026-mexican-gp", "https://f1-stories.gr/tyres/2026/mexico-city/", null],
  ];
  for (const [raceId, tyres, grid] of cases) {
    assert.deepEqual(buildToolLink(seed, { raceId }, "tyres"), {
      status: "resolved",
      url: tyres,
    });
    const gridResult = buildToolLink(seed, { raceId }, "grid", {
      currentYear: 2026,
    });
    assert.deepEqual(
      gridResult,
      grid
        ? { status: "resolved", url: grid }
        : result("missing", "jolpica-mapping-unavailable"),
    );
    for (const target of ["ghostcar", "telemetry"]) {
      const link = buildToolLink(
        seed,
        { raceId },
        target,
        target === "telemetry" ? { currentYear: 2026 } : {},
      );
      assert.deepEqual(link, result("missing", "openf1-meeting-unmapped"));
      assert.equal(Object.hasOwn(link, "url"), false);
    }
    if (!grid) assert.equal(Object.hasOwn(gridResult, "url"), false);
  }
  const unsupported = buildToolLink(
    seed,
    { raceId: "2026-japanese-gp", sessionKind: "race" },
    "tyres",
  );
  assert.deepEqual(
    unsupported,
    result("unsupported", "selected-scope-not-supported"),
  );
  assert.equal(Object.hasOwn(unsupported, "url"), false);
});

test("rejects explicit undefined, unreasonable years and invalid circuit characters", () => {
  const { data, context, fact } = fixture();
  for (const currentYear of [
    undefined,
    null,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER,
    2026.5,
  ]) {
    assert.throws(
      () => buildToolLink(data, context, "grid", { currentYear }),
      RegistryValidationError,
    );
  }
  for (const circuitShortName of [["Suzuka"], "Suzuka;other", "Sūzuka"]) {
    assert.throws(
      () =>
        buildToolLink(
          data,
          context,
          "telemetry",
          telemetry({ ...fact, circuitShortName }),
        ),
      RegistryValidationError,
    );
  }
});

test("Grid parser accepts exact generated pins at its boundaries", () => {
  for (const [season, round] of [
    [2024, 1],
    [2027, 30],
  ]) {
    const { data, race } = fixture();
    race.season = season;
    race.raceId = `${season}-synthetic-gp`;
    race.evidence.find((c) => c.field === "season").value = season;
    race.sourceKeys.jolpica = { season, round };
    race.evidence.find((c) => c.field === "sourceKeys.jolpica").value = {
      season,
      round,
    };
    const link = buildToolLink(data, { raceId: race.raceId }, "grid", {
      currentYear: 2026,
    });
    assert.equal(link.status, "resolved");
    const parsed = new URL(link.url);
    assert.equal(parsed.searchParams.get("embed"), "1");
    assert.deepEqual(parseRoundPin(parsed.search, 2026), {
      season: String(season),
      round: String(round),
    });
    const forbidden = buildToolLink(
      data,
      { raceId: race.raceId, sessionKind: "fp1" },
      "grid",
      { currentYear: 2026 },
    );
    assert.deepEqual(
      forbidden,
      result("unsupported", "selected-scope-not-supported"),
    );
    assert.equal(Object.hasOwn(forbidden, "url"), false);
  }
});
