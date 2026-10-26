# BigQuery validation (2026-10-26)

Code under test: `main` at `fe220330` (I-05 #357 merged), plus this PR, which changes no model SQL. Export:
`f1-stories-analytics.analytics_485678890` (EU), measurement ID `G-X68J6MQKSM`.

**Result: all 20 models are `PRODUCTION_EXECUTED`; none is `PRODUCTION_VALIDATED`.** This happened in two steps:

1. **Phase 1, the validation environment that prepared this PR: BLOCKED.** It has no BigQuery access. It dry-ran
   and executed nothing, and measured no bytes. Nothing in this file is a simulated result.
2. **Phase 2, owner BigQuery Console executions: executed.** On 2026-10-26 the owner ran every I-03, I-04 and I-05
   model in the EU dataset for 2026-10-19 → 22 with `as_of_day = 2026-10-26`, and reported the aggregates below.
   Every number in "Owner-reported results" comes from those Console runs. The validation environment did not run,
   see or re-check them.

## Statuses

| Status | Meaning |
| --- | --- |
| `STATICALLY_TESTED` | Rendered and checked by `npm run test:intelligence` (synthetic fixtures, no BigQuery) |
| `BIGQUERY_DRY_RUN_PASSED` | A real `bq query --dry_run` succeeded; bytes recorded |
| `PRODUCTION_EXECUTED` | An authorized run returned aggregate results |
| `PRODUCTION_VALIDATED` | Executed results checked against the coverage models and the acceptance criteria |
| `BLOCKED` | The step could not be performed; the reason is recorded |

| Models | Static | Dry-run | Production |
| --- | --- | --- | --- |
| I-03 `10`–`15` | `STATICALLY_TESTED` | `BLOCKED` in the validation environment (no access). The owner's Console reported that `10` would process 219.08 KB | `PRODUCTION_EXECUTED` (owner Console, 19–22 Oct) |
| I-04 `20`–`29` | `STATICALLY_TESTED` | `BLOCKED` in the validation environment (no access) | `PRODUCTION_EXECUTED` (owner Console, 19–22 Oct) |
| I-05 `30`–`33` | `STATICALLY_TESTED` | `BLOCKED` in the validation environment (no access) | `PRODUCTION_EXECUTED` (owner Console, 19–22 Oct, `America/Los_Angeles`) |

**Bytes.** 219.08 KB for model `10` is the only byte figure reported. No figure is recorded for any other model.

**Not `PRODUCTION_VALIDATED`.** The window is four days and the samples are small, and the open items in
[Outstanding](#outstanding) are still open. Only the specific reconciliations listed below passed.

**I-01 `sql/00`–`03`.** Not run here, and **not established as executed as written**. On 2026-10-26 the owner ran
targeted, adapted exploratory BigQuery queries over 2026-10-19 → 22. They confirmed 416 GA4 events and initial Web
Vitals integrity. The same owner report also gave daily tables from 2026-10-19, official Web Vitals present,
production-host checks passing, and a 241.85 KB estimate for the owner's adapted inventory query. That estimate is
not a measurement of repository `02`. The exact repository `02` and `03` still need a run of their own. That record
exists only in the **closed, unmerged** PR #353. No I-02 validation is on `main`.

## Owner-reported results (BigQuery Console, 2026-10-19 → 22, `as_of_day = 2026-10-26`)

All figures are **event counts**. They are not users and not sessions, including `session_start` and `first_visit`.

### I-03 (`10`–`15`)

| Measure | Owner-reported value |
| --- | --- |
| Article page-view events | 40 |
| Articles with page views | 11 |
| Category totals | History 25, Analysis 14, Teams 1 |
| Article engagement events | 6 |
| Article discovery clicks | 7 |
| Internal navigation coverage | 15 clicks |
| Publication-age totals | 40 page views, 6 article engagement events |
| Unmapped article events (`15`) | none unexplained |

### I-04 (`20`–`29`)

| Measure | Owner-reported value |
| --- | --- |
| `page_view` events | 84 |
| `session_start` events | 32 |
| `first_visit` events | 6 |
| Device (page views) | mobile 81, desktop 3 |
| Country (page views) | Greece 84 |
| Facebook page views, by scope | event-collected 14, session-attributed 18, first-user 15 |
| `user_engagement` events | 22 |
| Article shares | 3 `copy_link` |
| Internal navigation | 15 clicks, 7 of them to articles |
| `29` coverage | no event loss through the consent or production-host filters among its 168 examined events |

The three Facebook figures answer different questions (where the event came from, the session's last click, the
user's first source). They are compared side by side and never summed.

### I-05 (`30`–`33`)

The owner confirmed that the GA4 reporting time zone is **`America/Los_Angeles`**, and the final RUM runs used
`@report_timezone = America/Los_Angeles`. The initial runs with the provisional `Europe/Athens` gave 124 in-cohort
observations. Re-running with `America/Los_Angeles` gave 171. The 171 runs are the record.

| Measure | Owner-reported value |
| --- | --- |
| Official `web_vital` snapshots | 173 |
| Legacy snapshots excluded | 69 |
| Deduplicated observations | 171 |
| In-cohort observations | 171 |
| Coverage | delayed-existing 151, delayed-consent 15, BFCache 5 |
| Library rating agreement | 77 / 77 |
| Revised observations | 1 |
| Conflicting snapshots | none reported |
| Delayed-existing LCP p75 | 964 ms (n = 26) |
| Delayed-existing INP p75 | 68 ms (n = 7) |
| Delayed-existing CLS p75 | 0 (n = 32) |

How to read these figures:
- **Not Core Web Vitals.** Delayed-coverage observations start after consent, load and idle. They are not
  full-navigation Core Web Vitals and must not be reported as such.
- **Small samples.** LCP (n = 26) and INP (n = 7) are below the phase-1 floor of `min_observations = 30`. At that
  floor, `30`–`32` keep the numbers and flag the rows (`meets_min_observations = false`).
- **CLS.** A p75 of 0 is a valid zero, and zeros are kept by construction. It does not exercise the ÷ 1000
  conversion.

### Reconciliations (passed, as reported by the owner)

| Check | Result |
| --- | --- |
| I-03 category totals vs article page views | 25 + 14 + 1 = 40 = article page-view events |
| I-03 publication-age totals | 40 page views and 6 engagement events, the same as `10` and the engagement count |
| I-03 unmapped article events (`15`) | no unexplained unmapped events |
| I-04 device split vs page views | 81 + 3 = 84 |
| I-04 country vs page views | Greece 84 = 84 |
| I-04 first-user, session and event-collected attribution (`24`, `25`, `26`) | each reconciles to 84 page views and 32 `session_start` events |
| I-04 consent and host filters (`29`) | no event loss among 168 examined events |
| I-05 coverage split vs in-cohort | 151 + 15 + 5 = 171 |
| I-05 cross-model | `30`, `31`, `32`, `33` all reconcile to 171 observations for the same cohort |
| I-05 library ratings | 77 / 77 agree with the model thresholds |
| I-05 snapshot integrity | 173 official → 171 deduplicated, 1 revised observation, no conflicting snapshots |

## Access check (validation environment, phase 1)

| Check | Result |
| --- | --- |
| `bq` / `gcloud` on PATH, or in common Cloud SDK locations | absent |
| `~/.config/gcloud`, application-default credentials, `GOOGLE_APPLICATION_CREDENTIALS` | absent (existence checked only; nothing read) |
| IDE data sources | none configured |
| Dataset read and job permissions | not testable without credentials |

No credentials were requested, and no service account, IAM, billing or GA4 change was made.

## Schema compatibility (from Google's published schema, not from the dataset)

Checked against the [GA4 BigQuery export schema](https://support.google.com/analytics/answer/7029846), read on
2026-10-26. This confirms names and types only. The owner's dataset check ([below](#dataset-schema-check-owner)) and
the executed models supersede it for the fields they cover.

| Field the models read | Published type | Finding |
| --- | --- | --- |
| `event_name`, `event_timestamp` (INT64 µs), `event_params.key` / `value.string_value`, `int_value`, `double_value` | STRING / INTEGER / FLOAT | Match. `float_value` is documented as unused; it appears only inside `COALESCE`, which is harmless |
| `event_date` | STRING | Not read: the models use `_TABLE_SUFFIX` |
| `privacy_info.analytics_storage` | STRING: `Yes`, `No`, `Unset` | Matches the `= 'Yes'` filter. `Unset`/NULL rows are excluded by design and counted by 15, 29, 33 |
| `device.category`, `geo.country` | STRING | Match |
| `traffic_source.name` / `medium` / `source` | STRING | Match. Documented as not populated in intraday tables, which are never read |
| `collected_traffic_source.manual_source` / `manual_medium` / `manual_campaign_name` / `gclid` / `dclid` | STRING | Match |
| `session_traffic_source_last_click.cross_channel_campaign.source` / `medium` | STRING | Match |
| `session_traffic_source_last_click.cross_channel_campaign.default_channel_group` | — | **Not on Google's schema page.** Third-party references describe it as added around October 2024 and not yet officially documented. This was recorded as the top I-04 dry-run risk. **Resolved for `events_20261022`**: see the dataset check below |

**Event parameters** (`metric_revision`, `metric_value`, `nav_start_ms`, `observation_start_ms`, `page_location`)
are key/value pairs, not schema columns. Their value types can only be seen in data. The models already tolerate
type drift:
- `metric_value` and `observation_start_ms` are coalesced across value types.
- `metric_revision` and `nav_start_ms` must be `int_value`; a non-integer revision is counted, not guessed.

The I-01 `02` inventory reports the actual types, and remaining type verification needs it run as written.

**The narrow fix for a missing `default_channel_group`** is no longer needed for the inspected table. It is kept for
any table where the field turns out to be missing: remove the one `session_channel_class` line from
`audience-base.sql`, the `channel_class` column from `26` (shifting its `GROUP BY` / `ORDER BY` ordinals), the
matching count from `29`, and the corresponding test and doc lines. Session source/medium stay. No other model
changes.

### Dataset schema check (owner)

The owner read the schema of `events_20261022` with `INFORMATION_SCHEMA` and confirmed that
`session_traffic_source_last_click.cross_channel_campaign.default_channel_group` exists as `STRING`. The I-04 schema
risk is therefore resolved for that table, and all `20`–`29` then executed. Other tables were not inspected.

## Phase-1 parameters

`start_day = 2026-10-19`, `end_day = 2026-10-22`, `as_of_day = 2026-10-26` (so tables through 2026-10-22 count as
mature), `min_events = min_observations = 30`, and `period = day` and `week` for `32`.

`report_timezone` was planned as a provisional `Europe/Athens`. The property time zone is now confirmed as
**`America/Los_Angeles`**, and that is the value for every I-05 run. The commands below use it.

The owner report does not restate the `min_events`, `min_observations` or `period` values used in the Console runs.
Each model gets only the parameters it references:

| Models | Parameters |
| --- | --- |
| `10`–`14`, `20`–`28` | `start_day`, `end_day`, `as_of_day`, `min_events` |
| `15`, `29` | `start_day`, `end_day`, `as_of_day` |
| `30`, `31` | `start_day`, `end_day`, `as_of_day`, `report_timezone`, `min_observations` |
| `32` | as `30` + `period` |
| `33` | `start_day`, `end_day`, `as_of_day`, `report_timezone` |

## Owner commands (free metadata and dry-runs only)

These were prepared in phase 1 for an authenticated machine. The phase-2 runs used the BigQuery Console instead. The
commands stay valid for re-checks and the final window. They read schema metadata or perform `--dry_run`, which
validates the query and estimates bytes without billing or returning rows. Nothing below executes a production
query.

```sh
# 1. Dataset location, tables (look for gaps and events_intraday_*), and the schema of one mature table.
bq show --format=prettyjson f1-stories-analytics:analytics_485678890 | grep '"location"'
bq ls --max_results=100 f1-stories-analytics:analytics_485678890
bq show --schema --format=prettyjson f1-stories-analytics:analytics_485678890.events_20261022 > /tmp/ga4-schema.json
grep -c '"default_channel_group"' /tmp/ga4-schema.json   # 0 means the field is missing from that table

# 2. Initial four dry-runs. Each prints "Query successfully validated ... will process N bytes" or the exact error.
for m in 10-article-pageviews 20-daily-activity 30-cwv-summary 33-rum-coverage; do
  node scripts/intelligence/editorial-model.mjs dry-run-command "$m" --project=f1-stories-analytics --property=485678890 \
    --start=2026-10-19 --end=2026-10-22 --as-of=2026-10-26 --timezone=America/Los_Angeles --min=30 --period=day
done > /tmp/dry-run-initial.sh
sh /tmp/dry-run-initial.sh

# 3. Only if all four pass: every model (32 with period=day), then 32 again with period=week.
node scripts/intelligence/editorial-model.mjs dry-run-command all --project=f1-stories-analytics --property=485678890 \
  --start=2026-10-19 --end=2026-10-22 --as-of=2026-10-26 --timezone=America/Los_Angeles --min=30 --period=day > /tmp/dry-run-all.sh
sh /tmp/dry-run-all.sh
node scripts/intelligence/editorial-model.mjs dry-run-command 32-cwv-trend --project=f1-stories-analytics --property=485678890 \
  --start=2026-10-19 --end=2026-10-22 --as-of=2026-10-26 --timezone=America/Los_Angeles --min=30 --period=week | sh
```

Each printed line is `render <model> | bq query --dry_run --location=EU …`. The query is read from stdin, and only
the parameters the model references are passed. `dry-run-command` refuses malformed or shell-unsafe values.

**Interpreting failures.**
- An unrecognised `default_channel_group` failing all of `20`–`29` on some other table is the risk above; one fix
  covers them all.
- A failure shared by `30`–`33` points at the rum-base pattern: `QUALIFY` after `WHERE TRUE`, or analytic
  `PERCENTILE_CONT` with `SELECT DISTINCT`, both copied from `perf/rum-pilot/report.sql`. The phase-2 runs executed
  both patterns.
- Stop at a systematic failure and record the first error verbatim. Do not adjust filters to make a query pass.

## Production data checks

These checks use the existing models only, with no new diagnostics. Run them with `--maximum_bytes_billed=104857600`
(100 MB). The "19–22 Oct status" column records the owner's phase-2 Console runs.

| Area | Question | Model | 19–22 Oct status |
| --- | --- | --- | --- |
| I-03 | Mapped vs unmapped vs retired-URL article views; consent and host stages | `15` | Executed: no unexplained unmapped article events |
| I-03 | Article metadata coverage | `metadata` CLI (repository, no query): 412 articles, 0 missing fields at `fe220330` | Repository check; no query |
| I-03 | Category classification, engagement counts | `11`, `12` | Executed: categories reconcile to 40; 6 engagement events |
| I-04 | Events kept after consent and host per event; automatic events missing `page_location` (`primary_host_events` vs `consented_events`); device/country unknown; first-user, collected and session source/channel unattributed rates | `29` | Executed: no consent or host loss among 168 events. Per-field unknown and unattributed counts were not reported |
| I-04 | Scope separation | Structural (tests). Then compare `24`, `25`, `26` side by side, never summed | Executed: each scope reconciles to 84 / 32; Facebook 15 / 14 / 18 kept apart |
| I-05 | Version mix, consent and host stages, identity and revision integrity, duplicate/conflicting snapshots, missing fields, cohort placement, library-rating agreement | `33` (plus I-01 `03` for a ≤ 7-day sub-window) | `33` executed: see the reconciliations. I-01 `03` was not run as written |
| I-05 | CLS conversion and valid zeros | `30` (CLS p75 in native units; zeros are kept by construction and tested). A separate zero count is not produced; add one only if a concrete question needs it | Executed: CLS p75 0 (n = 32). The conversion is not exercised by a zero p75 |
| I-05 | Agreement with `perf/rum-pilot/report.sql` | Possible only for a **28-day** cohort, which `report.sql` hard-codes: `@first_day = start_day`, I-05 `end_day = start_day + 27`, `report.sql @as_of_day = I-05 as_of_day − 4`, `@deployment_day ≤ start_day − 1`, same `@report_timezone`, `@coverage = 'all'`, `@navigation_type = 'all'`. `report.sql` has no consent or host filter, so p75s must match exactly only when `33` shows no consent/host exclusions. The first such cohort (19 Oct → 15 Nov) is mature from **2026-11-19** | Pending |

## Final window

The seven-day window **2026-10-19 → 2026-10-25** is a separate final check. `events_20261025` cannot be treated as
mature before **2026-10-29** (`as_of_day = 2026-10-29`). Until then only the four-day window above is used. The
seven-day verification stays pending.

## Outstanding

1. GA4 Admin confirmation that property `485678890` streams `G-X68J6MQKSM`.
2. The full 19–25 October cohort, on or after 2026-10-29.
3. Larger observation samples. LCP and INP are below the `min_observations` floor. At 84 page views in four days,
   most I-04 daily and source rows are below `min_events` as well.
4. The remaining event-parameter type checks (`metric_revision`, `nav_start_ms`, `observation_start_ms`, `sponsored`),
   by running the I-01 `02` inventory as written.
5. The RUM comparison with the full 28-day `report.sql` reference report, once that cohort is mature (2026-11-19).
6. Consent-gated collection. Every figure covers only visitors who accepted analytics, and only observations after
   the delayed collector start. It is not total traffic and not full-navigation Core Web Vitals.

Resolved since phase 1:
- The property time zone (`America/Los_Angeles`).
- `default_channel_group` in `events_20261022` (`STRING`).
- That `collected_traffic_source`, `session_traffic_source_last_click` and the rum-base `QUALIFY` /
  `PERCENTILE_CONT` patterns run in this dataset. The models executed.

The validation environment still has no BigQuery access. That blocks only its own runs.

## Required from the owner

1. Confirm the `G-X68J6MQKSM` stream in GA4 Admin.
2. On or after 2026-10-29, run every model for 2026-10-19 → 25 with `as_of_day = 2026-10-29` and
   `report_timezone = America/Los_Angeles`. Report the aggregates as before, plus the parameter values used.
3. Run the I-01 `02` inventory as written, for the parameter value types.
4. On or after 2026-11-19, run the 28-day `report.sql` comparison.

Statuses in this file change only with that evidence. A model becomes `PRODUCTION_VALIDATED` only when the relevant
items above are closed.
