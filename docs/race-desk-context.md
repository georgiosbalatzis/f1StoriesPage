# Race Desk identity and context contract (v1)

The checked-in `data/race-desk/registry.v1.json` is a small, reviewed identity registry. A race is a Grand Prix event in a season, independent of its venue, calendar round, provider key or published URL. The naming convention is `<season>-<event-name>-gp`; once published, a `raceId` is immutable even when the venue or round changes. The Bahrain-named event at Sepang illustrates why venue is not event identity. Display and event names, venue identity and IANA time zone are separate fields.

This is a foundation for future adapters, not a public route or a source for results, weather, standings or article associations. Current hosting is described by [deployment architecture](deployment-architecture.md) and the source lock. Existing tool URLs and calculations remain independent.

## Registry and evidence

The top level has `schemaVersion: 1`, `sources` and `races`. Each race has `raceId`, `season`, `eventName`, `displayName`, `venue` (`venueId`, `name`, `timeZone`), `sourceKeys`, `sessions` and `evidence`. Source keys are independent: `openf1MeetingKey`, `jolpica` (`{season, round}`), `tyresRaceId`, and `tyresSlug`. Unknown bindings are explicit `null`; a slug lookup also requires a season. Sessions contain `kind`, `openf1SessionKey`, `startUtc` and `evidence`; timestamps use canonical UTC `YYYY-MM-DDTHH:mm:ss.sssZ`. A scheduled time does not assert data availability or finality.

Seasons use fixed bounds 1950–2100, independent of the current year. Numeric provider keys and rounds must be positive safe integers; Jolpica's season must match the event's season. A verified OpenF1 session key requires a verified meeting binding in its race. Unknown fields and duplicate internal/provider bindings fail validation.

Each source records `id`, `repository`, pinned `revision`, `path`, `gitBlob`, and `reviewedAt`, optionally `capturedAt` and `url`. Each evidence claim records a dotted `field`, its exact normalized `value`, `sourceId`, `reference` and `status: "verified"`. Material non-null source, venue, event and session fields require matching claims. The validator checks claim structure and consistency; review of the cited source is still necessary. An unverified candidate belongs outside the trusted registry until supported by evidence. Additions should be checked against pinned source files, with the exact field and revision recorded; never infer a mapping from a circuit name, current round or a nearby event.

Canonical session kinds are `fp1`, `fp2`, `fp3`, `qualifying`, `sprint-qualifying`, `sprint` and `race`. Source-supported aliases are `Practice 1`, `Practice 2`, `Practice 3`, `Qualifying`, `Sprint Qualifying`, `Sprint` and `Race`, as recorded in the pinned [TYRES session parser](https://github.com/georgiosbalatzis/Tyres/blob/50e5f50be89e038257cbe3426b366810e0c1f59a/scripts/lib/weekend-sources.ts#L4-L12). `Sprint Shootout` is not currently supported. Sprint qualifying is distinct from regular qualifying.

## Pure API

Import from `scripts/race-desk/core/index.mjs`. The core has no filesystem, network or browser dependencies. It accepts a registry value rather than loading one itself.

- `validateRegistry(registry)` returns `{valid, errors, coverage}`; each error has `path`, `code` and `message`. Coverage counts races and sessions and lists missing optional bindings. Invalid data and duplicate identities fail validation; optional nulls do not.
- `resolveRace(registry, selector)` accepts exactly one of `{raceId}`, `{openf1MeetingKey}`, `{season, jolpicaRound}`, `{tyresRaceId}`, or `{season, tyresSlug}`. It returns `{status: "resolved", race}` or `{status: "missing", reason}`.
- `resolveSession(registry, raceSelector, sessionSelector)` accepts a race selector and `{kind}`, `{openf1SessionKey}`, or both together. It resolves within that race and returns a resolved race and session or a missing result. A key from another race cannot match.
- `normalizeSessionKind(value)` maps a canonical kind or documented alias to its canonical kind, or returns `null` for an unknown string.
- `normalizeContext(registry, input)` returns a resolved normalized context and `conversionLosses`, or a missing result. The normalized shape is `{schemaVersion: 1, raceId, sessionKind, openf1SessionKey, drivers}`; each driver is `{openf1SessionKey, driverNumber, lapNumber}`. Session and lap values can be null where applicable. Up to four distinct driver numbers (1–99) are scoped to the selected OpenF1 session; each lap is independently selected (1–200 or null). `telemetry-single-lap` records that differing selected laps cannot all be expressed in Telemetry's single-lap UI. No navigation conversion is performed here.
- `validateSelectedScope(context)` checks the normalized shape and scope. Invalid inputs and invalid registries throw `RegistryValidationError` from the resolver/scope APIs. Collision makes the registry invalid, so lookups fail closed instead of returning an arbitrary first match. The kind normalizer throws `TypeError` for non-strings.

`npm run validate:race-desk` validates the static registry and reports coverage gaps. `npm run test:race-desk` runs the focused network-free tests. `npm run build:data-contracts` validates the same registry alongside the existing generated contracts.

Coverage reports use codepoint race-ID order and canonical session-kind order, regardless of source-array ordering. Resolvers return validated records without rewriting their array order. Context normalization preserves selected driver order and validates session scope, not driver participation or lap availability.

Breaking schema or consumer contract changes require a version increment. Once v1 consumers are published, retain v1 read compatibility during migration; never silently reinterpret existing IDs or source bindings. Race lifecycle states and link adapters are deferred to later work.
