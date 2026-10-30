import {
  normalizeContext,
  resolveRace,
  RegistryValidationError,
} from "./index.mjs";

const origin = "https://f1-stories.gr";
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) =>
  typeof value === "string" && value.length > 0 && value.trim() === value;
const year = (value) =>
  Number.isInteger(value) && value >= 1950 && value <= 2100;
const invalid = (message) => {
  throw new RegistryValidationError([
    { path: "$", code: "invalid-input", message },
  ]);
};
const outcome = (status, reason) => ({ status, reason });

export function buildToolLink(registry, input, target, options = {}) {
  if (!["tyres", "grid", "ghostcar", "telemetry"].includes(target))
    invalid("Invalid target");
  if (
    !object(options) ||
    Object.keys(options).some(
      (key) => !["currentYear", "telemetryCircuit"].includes(key),
    )
  )
    invalid("Invalid options");
  if (Object.hasOwn(options, "currentYear") && !year(options.currentYear))
    invalid("Invalid current year");
  if (
    ["grid", "telemetry"].includes(target) &&
    !Object.hasOwn(options, "currentYear")
  )
    invalid("Current year is required");
  const hasFact = Object.hasOwn(options, "telemetryCircuit");
  const fact = options.telemetryCircuit;
  if (hasFact) {
    const keys = [
      "season",
      "openf1MeetingKey",
      "circuitShortName",
      "sourceId",
      "reference",
      "status",
    ];
    if (
      target !== "telemetry" ||
      !object(fact) ||
      Object.keys(fact).length !== keys.length ||
      !keys.every((key) => Object.hasOwn(fact, key)) ||
      !year(fact.season) ||
      !Number.isSafeInteger(fact.openf1MeetingKey) ||
      fact.openf1MeetingKey <= 0 ||
      !text(fact.circuitShortName) ||
      !/^[A-Za-z0-9 ._'-]{1,80}$/.test(fact.circuitShortName) ||
      !text(fact.sourceId) ||
      !text(fact.reference) ||
      fact.status !== "verified"
    )
      invalid("Invalid telemetry circuit fact");
  }
  const result = normalizeContext(registry, input);
  if (
    hasFact &&
    !registry.sources.some((source) => source.id === fact.sourceId)
  )
    invalid("Unknown circuit source");
  const raceResult = resolveRace(registry, { raceId: input.raceId });
  if (
    hasFact &&
    raceResult.status === "resolved" &&
    (fact.season !== raceResult.race.season ||
      fact.openf1MeetingKey !== raceResult.race.sourceKeys.openf1MeetingKey)
  )
    invalid("Circuit fact does not match race");
  if (result.status === "missing") return result;
  const context = result.context;
  const race = raceResult.race;
  if (target === "tyres" || target === "grid") {
    if (
      context.sessionKind !== null ||
      context.openf1SessionKey !== null ||
      context.drivers.length
    )
      return outcome("unsupported", "selected-scope-not-supported");
    if (target === "tyres") {
      const { tyresRaceId, tyresSlug } = race.sourceKeys;
      if (tyresRaceId === null || tyresSlug === null)
        return outcome("missing", "tyres-mapping-unavailable");
      if (!/^[a-z0-9-]{1,40}$/.test(tyresSlug))
        return outcome("unsupported", "tyres-slug-not-supported");
      return {
        status: "resolved",
        url: `${origin}/tyres/${race.season}/${tyresSlug}/`,
      };
    }
    const mapping = race.sourceKeys.jolpica;
    if (mapping === null)
      return outcome("missing", "jolpica-mapping-unavailable");
    if (
      race.season < 2024 ||
      race.season > options.currentYear + 1 ||
      mapping.round > 30
    )
      return outcome("unsupported", "season-or-round-not-supported");
    const query = new URLSearchParams({
      tab: "drivers",
      embed: "1",
      season: String(race.season),
      round: String(mapping.round),
    });
    return { status: "resolved", url: `${origin}/standings/?${query}` };
  }
  const meeting = race.sourceKeys.openf1MeetingKey;
  if (meeting === null) return outcome("missing", "openf1-meeting-unmapped");
  if (context.openf1SessionKey === null)
    return outcome("missing", "session-unmapped");
  const drivers = context.drivers;
  if (drivers.length < (target === "ghostcar" ? 2 : 1) || drivers.length > 4)
    return outcome("unsupported", "driver-count-not-supported");
  if (drivers.some((driver) => driver.lapNumber === null))
    return outcome("unsupported", "lap-selection-required");
  if (target === "ghostcar") {
    const query = new URLSearchParams({
      y: String(race.season),
      mk: String(meeting),
      sk: String(context.openf1SessionKey),
    });
    drivers.forEach((driver, index) =>
      query.set(`d${index + 1}`, String(driver.driverNumber)),
    );
    drivers.forEach((driver, index) =>
      query.set(`l${index + 1}`, String(driver.lapNumber)),
    );
    if (drivers.length > 2) query.set("nd", String(drivers.length));
    query.set("v", "2");
    return { status: "resolved", url: `${origin}/ghostcar/?${query}` };
  }
  if (drivers.some((driver) => driver.lapNumber !== drivers[0].lapNumber))
    return outcome("unsupported", "independent-laps-not-supported");
  if (race.season < 2023 || race.season > options.currentYear)
    return outcome("unsupported", "season-or-round-not-supported");
  if (!hasFact) return outcome("missing", "telemetry-circuit-unmapped");
  const query = new URLSearchParams({
    year: String(race.season),
    circuit: fact.circuitShortName,
    session: String(context.openf1SessionKey),
    drivers: drivers.map((driver) => driver.driverNumber).join(","),
    lap: String(drivers[0].lapNumber),
    tab: "telemetry",
  });
  return { status: "resolved", url: `${origin}/telemetry/?${query}` };
}
