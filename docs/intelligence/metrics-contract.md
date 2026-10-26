# Metrics contract

What I-02 may compute from the existing events, and the rules every result must follow. Labels as in the
[README](README.md). Google product behaviour cited below is from Google's public documentation and is **not verified
for this property** [U].

## Population and coverage bias [R]

Every metric covers **consented visits on Main pages only.** Decline, no decision yet, blocked `googletagmanager.com`,
failed beacon delivery and the four tools all produce zero rows. There is no denominator of all visitors, no modeled
fill (no cookieless pings are sent), and no way to compare consenters with non-consenters. Results are statements about
the opted-in cohort, never about readership as a whole. Always state the host filter (`f1-stories.gr`) and the period.

## Metrics

| Metric | Source | Definition | Unit | Do not |
| --- | --- | --- | --- | --- |
| Page views | `page_view` | Count by `path_class` from `page_location` | events | Call them visitors or sessions |
| Article views | `page_view`, `path_class = article` | Count by article id parsed from the path, retired ids mapped to target | events | Use emitted `article_id` (page_view has none) |
| Article engagement | `article_engaged` ÷ article `page_view` | Share of consented article documents reaching 30 s visible **and** 50% scroll | ratio | Read `engaged_seconds`/`scroll_depth` as measurements: they are constants 30 and 50 |
| Internal navigation | `internal_page_click` | Count by `link_section`, source and destination `path_class` | clicks | Treat as complete navigation: modifier/middle clicks, prevented clicks and non-link navigation are excluded |
| Tool entries | `internal_page_click` with `link_path` under a tool prefix | Clicks from Main into `/telemetry/` `/ghostcar/` `/tyres/` `/betcast/` | clicks | Report as tool usage, sessions or views |
| Outbound / sponsor clicks | `outbound_click` | Count by `destination_domain`; `sponsored` subset | clicks | Assume delivery: beacons can be lost |
| Shares | `article_share` | Count by `method`; two emitters with different parameter sets | events | Count native-share/copy as completed shares (intent, not confirmation) |
| Edition search | `journal_search` | Search *pauses* (900 ms debounce) with non-empty query | events | Call it searches or users; `query_length` is UTF-16 code units |
| JS errors | `js_error` | `rating = first`: unsampled, one per tab session; `sampled`: 10% of later errors | events | Report an error rate; any total from sampled rows (first + 10 × sampled) is an estimate |
| Web Vitals | `web_vital` | Per [perf/rum-pilot](../../perf/rum-pilot/README.md) and its [report.sql](../../perf/rum-pilot/report.sql) | ms; CLS ×1000 | Mix versions, sum revisions, average p75s |

## Units [R]

`metric_value`: milliseconds, except CLS which is unitless ×1000 (divide by 1000). `nav_start_ms`: epoch ms.
`observation_start_ms`: ms after `performance.timeOrigin`. `engaged_seconds` / `scroll_depth`: constant thresholds
(s / %). `result_count`: articles. `lineno` / `colno`: 1-based, 0 when unknown. BigQuery `event_timestamp`: UTC
microseconds; table suffix date: property time zone [U].

## Versions

- `web_vital`: only `measurement_version = 'wv6.2.3-rum1'` (code since #305, merged 2026-10-20 [R]; first production day
  [U], found by [sql/03](sql/03-web-vital-integrity.sql)). Rows without a version are the legacy approximation and are
  excluded.
- No other event carries a schema version [R]. Treat a parameter set as stable only between the first and last day the
  inventory sees it, and cross-check against `git log` of the emitter. Known parameter-set split: `article_share` (two
  emitters).

## Revisions and deduplication

- `web_vital`: one observation per `(measurement_version, metric_name, metric_id)`, keeping the highest
  `metric_revision` (then latest `event_timestamp`). Never the maximum value: INP can decrease. Copies with the same id and
  revision are transport duplicates; same id and revision with different values is a defect to report, not to average.
- Other events have no idempotency key [R]. Report raw counts; I-01 does not attempt row-level dedup.

## GA4 interface vs BigQuery export [U]

| | GA4 reports / explorations | BigQuery daily export |
| --- | --- | --- |
| Rows | Aggregated; thresholding, sampling in explorations, `(other)` for high cardinality | One row per received event, unsampled |
| Custom parameters | Need registered custom definitions | All `event_params` present, no registration |
| Percentiles, revision dedup | Not possible | Possible (rum-pilot SQL) |
| History | Since property creation, within retention | Only from link date, **no backfill** |
| Limits | — | Standard properties: daily export capped (1M events/day documented); streaming is a separate paid option |

Totals between the two will not match exactly; state which one a number comes from.

## Freshness

Daily tables `events_YYYYMMDD` keyed by property-timezone date; documented late events can update a table for up to
72 h. Rules: report an explicit as-of time, exclude the last 3 days from conclusions, never combine `events_intraday_*`
with daily tables for the same day. [sql/01](sql/01-export-tables.sql) measures creation vs last-modified per table
from metadata only.

## EU location

The export dataset's location is fixed when the link is created and cannot be moved. Required: EU multi-region or an EU
region. [sql/00](sql/00-dataset-location.sql) verifies it. A non-EU dataset blocks I-02; fixing it means a new link and
dataset (owner decision, not done here).

## Data minimization

Allowed in outputs: dates, `event_name`, host/path classes, enumerated parameter values, public article ids, aggregate
counts. Not selected or exported: `user_pseudo_id`, `user_id`, `ga_session_id`, `user_properties`, geo below country,
device detail beyond category, `page_referrer`, `link_text`, `js_error` `message`/`stack`/`source`, row-level
timestamps. `pseudonymous_users_*` / `users_*` tables are not queried. No row-level extract leaves BigQuery; no
visitor-level joins.
