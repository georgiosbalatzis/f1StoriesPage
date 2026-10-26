# BigQuery validation — phase 1 (2026-10-26)

Code under test: `main` at `fe220330` (I-05 #357 merged), plus this PR, which changes no model SQL. Export:
`f1-stories-analytics.analytics_485678890` (EU), measurement ID `G-X68J6MQKSM`.

**Result: every dry-run is BLOCKED.** This environment has no BigQuery access. No query was dry-run or executed,
no bytes were measured, and no model below is production-validated. Nothing here is a simulated result.

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
| I-03 `10`–`15` | `STATICALLY_TESTED` | `BLOCKED` (no access) | not executed |
| I-04 `20`–`29` | `STATICALLY_TESTED` | `BLOCKED` (no access) | not executed |
| I-05 `30`–`33` | `STATICALLY_TESTED` | `BLOCKED` (no access) | not executed |

**I-01 `sql/00`–`03`.** Not run here, and **not established as executed as written**. On 2026-10-26 the owner ran
targeted, adapted exploratory BigQuery queries over 2026-10-19 → 22. They confirmed 416 GA4 events and initial Web
Vitals integrity. The same owner report also gave daily tables from 2026-10-19, official Web Vitals present,
production-host checks passing, and a 241.85 KB estimate for the owner's adapted inventory query. That estimate is
not a measurement of repository `02`. The exact repository `02` and `03` still need a run of their own. That record
exists only in the **closed, unmerged** PR #353. No I-02 validation is on `main`.

## Access check

| Check | Result |
| --- | --- |
| `bq` / `gcloud` on PATH, or in common Cloud SDK locations | absent |
| `~/.config/gcloud`, application-default credentials, `GOOGLE_APPLICATION_CREDENTIALS` | absent (existence checked only; nothing read) |
| IDE data sources | none configured |
| Dataset read and job permissions | not testable without credentials |

No credentials were requested, and no service account, IAM, billing or GA4 change was made.

## Schema compatibility (from Google's published schema, not from the dataset)

Checked against the [GA4 BigQuery export schema](https://support.google.com/analytics/answer/7029846), read on
2026-10-26. This confirms names and types only. Whether a field exists in this dataset and is populated still needs
the owner checks below.

| Field the models read | Published type | Finding |
| --- | --- | --- |
| `event_name`, `event_timestamp` (INT64 µs), `event_params.key` / `value.string_value`, `int_value`, `double_value` | STRING / INTEGER / FLOAT | Match. `float_value` is documented as unused; it appears only inside `COALESCE`, which is harmless |
| `event_date` | STRING | Not read: the models use `_TABLE_SUFFIX` |
| `privacy_info.analytics_storage` | STRING: `Yes`, `No`, `Unset` | Matches the `= 'Yes'` filter. `Unset`/NULL rows are excluded by design and counted by 15, 29, 33 |
| `device.category`, `geo.country` | STRING | Match |
| `traffic_source.name` / `medium` / `source` | STRING | Match. Documented as not populated in intraday tables, which are never read |
| `collected_traffic_source.manual_source` / `manual_medium` / `manual_campaign_name` / `gclid` / `dclid` | STRING | Match |
| `session_traffic_source_last_click.cross_channel_campaign.source` / `medium` | STRING | Match |
| `session_traffic_source_last_click.cross_channel_campaign.default_channel_group` | — | **Not on Google's schema page.** Third-party references describe it as added around October 2024 and not yet officially documented. **Top dry-run risk:** if absent, every I-04 model (`20`–`29`) fails, because `audience-base.sql` reads it. Not changed here: it is a risk, not a confirmed error |

**Event parameters** (`metric_revision`, `metric_value`, `nav_start_ms`, `observation_start_ms`, `page_location`)
are key/value pairs, not schema columns. Their value types can only be seen in data. The models already tolerate
type drift:
- `metric_value` and `observation_start_ms` are coalesced across value types.
- `metric_revision` and `nav_start_ms` must be `int_value`; a non-integer revision is counted, not guessed.

The I-01 `02` inventory reports the actual types and must be run before any model is called validated.

**If `default_channel_group` turns out to be missing,** the confirmed fix is narrow: remove the one
`session_channel_class` line from `audience-base.sql`, the `channel_class` column from `26` (shifting its
`GROUP BY` / `ORDER BY` ordinals), the matching count from `29`, and the corresponding test and doc lines. Session
source/medium stay. No other model changes.

## Phase-1 parameters

`start_day = 2026-10-19`, `end_day = 2026-10-22`, `as_of_day = 2026-10-26` (so tables through 2026-10-22 count as
mature), `min_events = min_observations = 30`, and `period = day` and `week` for `32`. `report_timezone =
Europe/Athens` is **provisional** until the property time zone is confirmed. Each model gets only the parameters it
references:

| Models | Parameters |
| --- | --- |
| `10`–`14`, `20`–`28` | `start_day`, `end_day`, `as_of_day`, `min_events` |
| `15`, `29` | `start_day`, `end_day`, `as_of_day` |
| `30`, `31` | `start_day`, `end_day`, `as_of_day`, `report_timezone`, `min_observations` |
| `32` | as `30` + `period` |
| `33` | `start_day`, `end_day`, `as_of_day`, `report_timezone` |

## Owner commands (free metadata and dry-runs only)

These read schema metadata or perform `--dry_run`, which validates the query and estimates bytes without billing or
returning rows. Nothing below executes a production query.

```sh
# 1. Dataset location, tables (look for gaps and events_intraday_*), and the schema of one mature table.
bq show --format=prettyjson f1-stories-analytics:analytics_485678890 | grep '"location"'
bq ls --max_results=100 f1-stories-analytics:analytics_485678890
bq show --schema --format=prettyjson f1-stories-analytics:analytics_485678890.events_20261022 > /tmp/ga4-schema.json
grep -c '"default_channel_group"' /tmp/ga4-schema.json   # 0 means the I-04 risk above is real

# 2. Initial four dry-runs. Each prints "Query successfully validated ... will process N bytes" or the exact error.
for m in 10-article-pageviews 20-daily-activity 30-cwv-summary 33-rum-coverage; do
  node scripts/intelligence/editorial-model.mjs dry-run-command "$m" --project=f1-stories-analytics --property=485678890 \
    --start=2026-10-19 --end=2026-10-22 --as-of=2026-10-26 --timezone=Europe/Athens --min=30 --period=day
done > /tmp/dry-run-initial.sh
sh /tmp/dry-run-initial.sh

# 3. Only if all four pass: every model (32 with period=day), then 32 again with period=week.
node scripts/intelligence/editorial-model.mjs dry-run-command all --project=f1-stories-analytics --property=485678890 \
  --start=2026-10-19 --end=2026-10-22 --as-of=2026-10-26 --timezone=Europe/Athens --min=30 --period=day > /tmp/dry-run-all.sh
sh /tmp/dry-run-all.sh
node scripts/intelligence/editorial-model.mjs dry-run-command 32-cwv-trend --project=f1-stories-analytics --property=485678890 \
  --start=2026-10-19 --end=2026-10-22 --as-of=2026-10-26 --timezone=Europe/Athens --min=30 --period=week | sh
```

Each printed line is `render <model> | bq query --dry_run --location=EU …`. The query is read from stdin, and only
the parameters the model references are passed. `dry-run-command` refuses malformed or shell-unsafe values.

**Interpreting failures.**
- An unrecognised `default_channel_group` failing all of `20`–`29` is the risk above; one fix covers them all.
- A failure shared by `30`–`33` points at the rum-base pattern: `QUALIFY` after `WHERE TRUE`, or analytic
  `PERCENTILE_CONT` with `SELECT DISTINCT`, both copied from `perf/rum-pilot/report.sql`.
- Stop at a systematic failure and record the first error verbatim. Do not adjust filters to make a query pass.

## Production data checks (prepared, NOT executed; need separate authorization)

All use existing models, with no new diagnostics. Execute with `--maximum_bytes_billed=104857600` (100 MB) after the
matching dry-run has passed.

| Area | Question | Model |
| --- | --- | --- |
| I-03 | Mapped vs unmapped vs retired-URL article views; consent and host stages | `15` |
| I-03 | Article metadata coverage | `metadata` CLI (repository, no query): 412 articles, 0 missing fields at `fe220330` |
| I-03 | Category classification, engagement counts | `11`, `12` |
| I-04 | Events kept after consent and host per event; automatic events missing `page_location` (`primary_host_events` vs `consented_events`); device/country unknown; first-user, collected and session source/channel unattributed rates | `29` |
| I-04 | Scope separation | Structural (tests). Then compare `24`, `25`, `26` side by side, never summed |
| I-05 | Version mix, consent and host stages, identity and revision integrity, duplicate/conflicting snapshots, missing fields, cohort placement, library-rating agreement | `33` (plus I-01 `03` for a ≤ 7-day sub-window) |
| I-05 | CLS conversion and valid zeros | `30` (CLS p75 in native units; zeros are kept by construction and tested). A separate zero count is not produced; add one only if a concrete question needs it |
| I-05 | Agreement with `perf/rum-pilot/report.sql` | Possible only for a **28-day** cohort, which `report.sql` hard-codes: `@first_day = start_day`, I-05 `end_day = start_day + 27`, `report.sql @as_of_day = I-05 as_of_day − 4`, `@deployment_day ≤ start_day − 1`, same `@report_timezone`, `@coverage = 'all'`, `@navigation_type = 'all'`. `report.sql` has no consent or host filter, so p75s must match exactly only when `33` shows no consent/host exclusions. The first such cohort (19 Oct → 15 Nov) is mature from **2026-11-19** |

## Final window

The seven-day window **2026-10-19 → 2026-10-25** is a separate final check. `events_20261025` cannot be treated as
mature before **2026-10-29** (`as_of_day = 2026-10-29`). Until then only the four-day window above is used. The
seven-day verification stays pending.

## Blockers

1. No BigQuery access in the validation environment, so every dry-run and production step is BLOCKED.
2. `default_channel_group` is undocumented by Google, so I-04 dry-run compatibility is unknown.
3. The property time zone is unconfirmed, so `@report_timezone` is provisional and navigation dates may shift by a day.
4. GA4 Admin confirmation that property `485678890` streams `G-X68J6MQKSM` is still open.
5. Parameter value types (`metric_revision`, `nav_start_ms`, `sponsored`) are unconfirmed: run I-01 `02`.

## Required from the owner

1. Run the commands in "Owner commands" from an authenticated machine and paste back the verbatim outputs: location
   line, table list, the `default_channel_group` count, and each dry-run's success line or error. No result rows are
   produced.
2. Confirm the property time zone and the `G-X68J6MQKSM` stream in GA4 Admin.
3. Separately authorize production execution of the checks above (100 MB cap), or keep them unexecuted.
4. On or after 2026-10-29, repeat steps 2–3 for 2026-10-19 → 25 with `as_of_day = 2026-10-29`.

Statuses in this file change only with that evidence.
