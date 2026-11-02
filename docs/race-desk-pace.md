# Race Desk race pace & stint debrief (R-07)

A GP Hub may show a historical, descriptive debrief of the laps and tyre stints that the OpenF1 feed recorded for the race session. It reports what was observed: reported stint ranges, compounds and tyre ages, lap counts, and the recorded lap times. It is not strategy modelling, prediction, simulated tyre degradation or fuel correction, and it never ranks drivers or compares compounds.

## Data rights

The OpenF1 entry in `data/race-desk/publication-rights.v1.json` holds a separate `pace` object. On 2026-11-02 the site owner extended the OpenF1 CC BY-NC-SA 4.0 acceptance from the R-06 timeline to the `laps`, `stints` and `drivers` responses of the approved 2026 Singapore race session (meeting 1296, session 11388), for stints, compounds, lap times and descriptive pace. The reader accepts the original OpenF1 record with or without `pace`. Without an approved `pace` object matching the race and session, the section reports that publication is not approved. A published section shows OpenF1 as the source with a link, the note that it is unofficial and not associated with Formula 1, the retrieval dates, and that the derived data is under CC BY-NC-SA 4.0.

## Identity

R-07 reuses the R-06 mapping: `sourceKeys.openf1MeetingKey` and the race session's `openf1SessionKey` in the registry, reviewed in `docs/race-desk-r06-openf1-identity.md`. Only Singapore 2026 is mapped. The Sprint (11383) is not part of R-07. Every row must carry the bound meeting and session keys. The receipted session record must be named `Race` with type `Race`, because the Sprint shares that type. Drivers are joined only by car number within the session; names come from the receipted `drivers` response and are never used as join keys.

## Evidence

`data/race-desk/pace.v1.json` lists the receipts for the `laps`, `stints` and `drivers` responses. These use the R-06 receipt fields. Its `timelineBindings` pin the R-06 `sessions`, `pit` and `race_control` receipts that the pace model reads, by capture id and SHA-256. A changed or missing pinned receipt fails the build; a pace capture never adopts a recapture silently. The timeline inventory still rejects pace endpoints.

`node scripts/race-desk/capture-openf1-pace.mjs <raceId>` is run by a maintainer, never in CI. It requires the approved mapping and the approved `pace` rights for that race and session. It fetches only the three pace endpoints and stores the exact bytes under `data/race-desk/captures/openf1/`. It validates the whole proposed archive, including building the pace context, before writing; it writes the inventory last and rolls back a failed write. OpenF1 responses can change after capture: the Singapore stints response differed between 2026-10-15 and 2026-11-02 in one tyre age and in row order. The published figures are therefore tied to the receipted bytes. The 2026-10-15 performance fixtures under `perf/` are not publication evidence.

## Model

`buildPaceContext` (`scripts/race-desk/pace.mjs`) is pure. It moves from raw observation to validated lap and stint, to pace sample, to summary:

- **Laps.** One observation per driver and lap number. Exact duplicate rows collapse. Differing rows for the same lap are a conflict, and that lap is left out of every summary. A null or invalid lap time is never treated as zero. Missing lap numbers stay missing and are reported as ranges. When all three sector times are present, they must sum to the lap time within 3 ms; a mismatch is reported and leaves the lap out of every summary. `date_start` is approximate, so it is never used for pace or flag timing.
- **Stints.** Reported ranges are kept as reported: never renumbered, extended, split or joined. A lap belongs to a stint only when exactly one valid range contains it. A boundary is corroborated when a pit row at lap N, a pit-out lap at N+1 and a stint starting at N+1 agree. A pit visit inside a reported range without a matching boundary leaves both adjacent stints `unverified`. In Singapore this applies to #6, #14 and #18. Compounds outside SOFT, MEDIUM, HARD, INTERMEDIATE and WET are shown as unavailable, never inferred. Tyre age at start is the reported number of laps already completed on that tyre.
- **Eligibility.** Every lap is ELIGIBLE, EXCLUDED or UNKNOWN, with ordered reason codes. Definite exclusions: an invalid or missing time, a sector mismatch, lap 1, a pit-in lap and a pit-out lap. Race-control messages carry a lap number whose meaning for each driver's lap is not established. Lap start times are approximate, with no documented error bound. Neutralisation (VSC/SC/flags) therefore cannot be assigned to individual driver laps. Every lap not excluded is UNKNOWN, and the eligible sample is empty, reported as `unsuitable`. No outlier filter is applied. A nonempty clean-lap sample needs a reviewed change to this policy, backed by driver-lap flag evidence.
- **Summaries.** Each supported stint has a raw summary: count, the minimum and the median of its valid recorded times. This includes opening, pit and possibly neutralised laps. The median of an even count is the mean of the two middle values. The minimum needs at least 1 lap and the median at least 3. Values are rounded once to the millisecond, half up. Summaries are suppressed for unverified, inconsistent or unknown stints and for drivers whose identity is missing or conflicting. Quartiles, means, trends, degradation rates, pooled compound figures, cross-driver deltas and rankings are not produced.

Coverage (`full`, `partial`, `empty`) describes the captured observations, never the complete race history. Sample suitability is reported separately.

## Page

The section «Ρυθμός αγώνα & stints» follows the race timeline. It contains a stint overview table and a closed disclosure per driver with the lap-by-lap table, including exclusion and uncertainty reasons and missing laps. It carries both caveats and the attribution. It is static HTML with no chart and no runtime JavaScript. Races without an approved mapping, capture or rights show one sentence saying so. Receipts, captures, hashes and inventories never reach visitor HTML or `dist`.
