# Real User Performance models (I-05)

Status: **statically tested and `PRODUCTION_EXECUTED`, not production-validated.** On 2026-10-26 the owner executed
`30`–`33` in the BigQuery Console, for 2026-10-19 → 22 with `@report_timezone = America/Los_Angeles`, the
confirmed property time zone. All four models reconcile to 171 observations. The earlier `Europe/Athens` runs gave
124, and are superseded. The I-03 and I-04 models have the same status. The I-02 interim validation draft
([#353](https://github.com/georgiosbalatzis/f1StoriesPage/pull/353)) was closed without merging. Results and
outstanding items: [bigquery-validation.md](bigquery-validation.md). The synthetic tests prove nothing about
production data. The collector and its event contract are owned by [perf/rum-pilot](../../perf/rum-pilot/README.md),
which remains the source of truth.

The data covers **consented, observable Main-site navigations** with the official collector. It is not the F1 Stories
audience, not all visitors and not CrUX. It cannot estimate visitors or the consent rate.

## Architecture and reuse

```text
scripts/intelligence/editorial-model.mjs render 3x-… --project= --property=   (prints SQL; never queries)
  models/3x-*.sql
    └─ {{RUM_BASE}} = models/rum-base.sql
         window_bounds   cohort, extraction cutoff, caps (reported on every row)
         events          one bounded scan of web_vital; allowlisted parameters only
         eligible        consented · https://f1-stories.gr · 'wv6.2.3-rum1' · id · revision ≥ 1
         snapshots       copies per (version, metric, metric_id, revision): duplicate / conflicting
         latest          ← QUALIFY clause copied verbatim from perf/rum-pilot/report.sql
         rated           valid values, navigation date, CLS ÷ 1000, rating; no metric_id, no path
```

What is reused, without changing it:
- **Revision rule:** `report.sql`'s `QUALIFY ROW_NUMBER() OVER (PARTITION BY version, metric, metric_id ORDER BY
  revision DESC, event_timestamp DESC) = 1` is inserted by the renderer from the file itself. It exists once.
  `report.sql` is unchanged and still works standalone.
- **Report conventions:** the value extraction, CLS conversion, valid-value filter, enum lists, navigation-date
  expression, and resolving revisions *before* the cohort filter. The tests require identical text.
- **Shared intelligence rules:** the consent filter, host regex and future-date guard are the I-03 text, and the
  maturity rule (no table newer than `@as_of_day − 4`) is the same.
- **I-01 `03-web-vital-integrity.sql`** stays the per-version integrity check. Model 33 adds only what `03` cannot
  show.

`report.sql` still produces the full group × viewport × navigation × coverage table for the 28-day rum-pilot report.
I-05 does not replace it.

## Parameters, rendering and dry-run

| Parameter | Type | Meaning |
| --- | --- | --- |
| `@start_day`, `@end_day` | DATE | Navigation cohort, in `@report_timezone` |
| `@as_of_day` | DATE | Extraction cutoff (run date); tables after `@as_of_day − 4` are immature and not read |
| `@report_timezone` | STRING | Time zone for navigation dates: the property's, `America/Los_Angeles` (confirmed 2026-10-26) |
| `@min_observations` | INT64 | 30, 31, 32: rows below it are flagged, not hidden |
| `@period` | STRING | 32 only: `day` or `week` (ISO weeks) |

```sh
node scripts/intelligence/editorial-model.mjs render 30-cwv-summary --project=f1-stories-analytics --property=485678890 > /tmp/m30.sql
bq query --location=EU --use_legacy_sql=false --dry_run \
  --parameter=start_day:DATE:2026-10-19 --parameter=end_day:DATE:2026-10-25 --parameter=as_of_day:DATE:2026-10-30 \
  --parameter=report_timezone:STRING:America/Los_Angeles --parameter=min_observations:INT64:30 "$(cat /tmp/m30.sql)"
```

Dry-run each model and record the bytes. An authorized analyst then runs it with `--maximum_bytes_billed=104857600`
(100 MB), alongside **33** for the same parameters. Keep only the aggregate output, with the parameters. Nothing runs
automatically.

## Freshness, cutoff and dates

- **Navigation date vs export date.** An observation belongs to the day of `nav_start_ms` in `@report_timezone`.
  Its revisions can arrive in later daily tables. Tables are therefore scanned from `@start_day − 1` (time-zone
  margin) through the extraction cutoff `LEAST(@as_of_day − 4, @start_day + 119)`, not just the cohort days.
  Revisions are resolved first; only then are observations filtered by navigation date. Daily tables only;
  `events_intraday_*` are never read.
- **Caps.** The cohort is capped at 90 days and at the extraction cutoff. Every row reports `through_day`,
  `requested_through_day`, `extraction_through`, `cohort_truncated` and `late_revision_days` (days of late arrivals
  captured after the last cohort day). A future `@as_of_day` aborts the query.
- **The last received revision is not necessarily the browser's final value.** Pages can stay open past the cutoff
  and beacons can be lost. Re-running with a later `@as_of_day` can revise results; record `@as_of_day` with every
  number.

## Observations, deduplication, units, percentiles

- **One observation = one `(measurement_version, metric_name, metric_id)`**, keeping the highest `metric_revision`,
  then the latest `event_timestamp`. Never the maximum value: INP can decrease. All counts are observations, not
  `web_vital` events, snapshots, page views or visitors.
- **Duplicates and conflicts.** Equal copies of one revision are transport duplicates and collapse to one.
  Different values for the same revision are conflicts: the revision rule still picks one (latest timestamp, as in
  `report.sql`), the observation is flagged, and models 30 and 33 count them.
- **Units.** LCP, INP, FCP, TTFB are milliseconds. CLS is stored × 1000 and divided by 1000. Valid zeros are kept.
  A missing INP is **absent**, not zero, and is not evidence of a visit without interaction.
- **Percentiles.** Exact `PERCENTILE_CONT(value, 0.75)` over deduplicated observations, recomputed for every row and
  period. Never averaged across days or groups, and never computed from snapshots.
- **Thresholds.** These match the collector library's own rating; model 33 reports any disagreement. FCP and TTFB
  are supporting diagnostics without a rating. There is no combined score.

| Metric | Good | Needs improvement | Poor |
| --- | --- | --- | --- |
| LCP | ≤ 2500 ms | ≤ 4000 ms | > 4000 ms |
| INP | ≤ 200 ms | ≤ 500 ms | > 500 ms |
| CLS | ≤ 0.1 | ≤ 0.25 | > 0.25 |

## Models

| Model | Grain | Output |
| --- | --- | --- |
| `30-cwv-summary` | coverage class × metric (all 15 rows, empty ones as 0 / NULL) | `observations`, `p75`, `good`, `needs_improvement`, `poor`, `good_share`, `conflicted_observations`, `meets_min_observations` |
| `31-cwv-breakdown` | one dimension (`page_group`, `viewport_category` or `nav_type`) × value × coverage × metric | `observations`, `p75`, rating counts, `meets_min_observations` |
| `32-cwv-trend` | navigation `period_start` (day or ISO week) × coverage × metric | `observations`, `p75`, `period_complete`, `meets_min_observations` |
| `33-rum-coverage` | stage × category | `count` (events, snapshots or observations, per stage) |

Model 33 stages:
- `scan_version`: the official version, `(none: legacy)` or `other`.
- `scan_consent` and `scan_host`: the official version only.
- `scan_identity`: missing id, invalid revision, non-integer revision.
- `eligible_snapshots`: single, duplicate or conflicting copies.
- `observations`: resolved, revised, final snapshot duplicated or conflicting.
- `observation_validity`: invalid metric, value, navigation start, group, viewport or coverage.
- `observation_fields`: missing `observation_start_ms`, missing or unlisted `nav_type`.
- `cohort_placement`, `coverage_distribution` and `library_rating`.

Breakdown dimensions are never crossed, and coverage classes are never pooled. `delayed_existing` and
`delayed_consent` are partial-lifetime observations; `bfcache_observed` is a restoration observed by a registered
collector. `nav_type` values outside the library's list become `other`, and a missing one `(missing)`.
`viewport_category` is a width bucket (< 768 CSS px), not a CrUX device class.

## Sample size and coverage bias

- `meets_min_observations` flags rows below `@min_observations`. Use 30 before comparing groups or quoting a p75.
  Flagged rows keep their numbers and must be shown with the warning, never pooled silently with unrelated groups.
- The owner-reported interim figures in closed #353 had 171 official observations across all metrics in four days
  (2026-10-19 → 22), so most breakdown and daily cells will be
  flagged; read 28-day windows and weekly periods first.
- **Coverage bias.**
  - Only visitors who accepted analytics.
  - Only browsers supporting the APIs.
  - Only metrics observed after the delayed collector start (buffered entries can be incomplete).
  - Only beacons that arrived.
  - No iframes.
  - Multiple visits by one person cannot be told apart, so independence assumptions for intervals are unsafe.

## Known production-validation gaps

Settled by the owner's 19–22 Oct Console runs:
- `analytics_storage` values and `page_location` presence on `web_vital`: 171 observations reached the cohort. Had
  either been missing, eligible counts would have fallen to zero at `scan_consent` / `scan_host`. The filters are
  never relaxed.
- The property time zone: `America/Los_Angeles`, for `@report_timezone` and the table-date margin.
- BigQuery accepts `QUALIFY` after `WHERE TRUE` and the analytic `PERCENTILE_CONT` pattern: `30`–`33` executed.
  `report.sql` itself has not run in production.

Still open:
- The numeric types of `metric_revision`, `nav_start_ms` and `observation_start_ms`. They are not confirmed by
  inventory, and I-01 `02` has not been run as written.
- The first production day of `wv6.2.3-rum1`.
- That property `485678890` is `G-X68J6MQKSM`.
- Sample size: delayed-existing LCP n = 26 and INP n = 7, both below `min_observations = 30`.
- Agreement with the 28-day `report.sql` reference, from 2026-11-19.

## Tests

`npm run test:intelligence` runs I-05 with I-03 and I-04. A rules-driven oracle reads the scan and cohort bounds,
eligibility, the verbatim revision order, validity lists, CLS divisor, thresholds and percentile fraction from the
rendered SQL. It then runs synthetic fixtures through them:
- revision order, decreasing INP, duplicates and conflicts;
- CLS and threshold boundaries, zero vs missing;
- exact p75 (`[100, 200, 300, 400]` → 325) and sample flags;
- time-zone and DST navigation dates, late revisions and immature tables;
- BFCache and coverage separation, consent/host/version exclusions, caps and truncation.

Text tests cover verbatim reuse, privacy, read-only single-scan rendering, determinism, and placeholders hidden in
comments. CI does not run these tests; existing gates are unchanged.
