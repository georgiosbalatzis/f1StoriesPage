# I-02 production data validation — interim

Status: **interim, not complete.** The final seven-day validation for **2026-10-19 → 2026-10-25** is pending (see
[final checks](#final-checks-before-merge)). Nothing here changes tracking, consent, deployment or CI.

Source: aggregate results of authorized read-only runs in the BigQuery console, reported by the property owner on
2026-10-26. The queries were [sql/02](sql/02-event-inventory.sql) and [sql/03](sql/03-web-vital-integrity.sql),
unchanged, with only the placeholders substituted. No result file, raw event or visitor-level field is committed. These
figures were not re-executed for this PR.

## Infrastructure (verified)

| Item | Value |
| --- | --- |
| Project (`{{PROJECT_ID}}`) | `f1-stories-analytics` |
| Dataset | `analytics_485678890` |
| Location | EU |
| GA4 property (`{{GA4_PROPERTY_ID}}`) | `485678890`, derived from the dataset name |
| Daily tables present | `events_20261019` … `events_20261024` (six, contiguous) |
| Rows in those six tables | 575 events |

These resolve I-01 blockers 1–3 ([validation.md](validation.md#pr-i-02--blockers)). Blocker 4 (cost) is resolved
with the deviation noted under [Cost](#cost).

## Interim results: 2026-10-19 → 2026-10-22 (four daily tables)

| Measure | Value | Query |
| --- | --- | --- |
| Events | 416 | 02 |
| `page_view` | 84 | 02 |
| `web_vital` | 242 | 02 / 03 |
| `web_vital`, `measurement_version = wv6.2.3-rum1` | 173 | 03 |
| `web_vital`, no version (legacy) | 69 | 03 |
| Distinct `wv6.2.3-rum1` observations `(version, metric, metric_id)` | 171 | 03 |
| `wv6.2.3-rum1`: `missing_int_revision`, `revision_not_int` | 0 | 03 |
| `wv6.2.3-rum1`: `missing_or_negative_value` | 0 | 03 |
| `wv6.2.3-rum1`: `missing_nav_start` | 0 | 03 |
| `wv6.2.3-rum1`: `conflicting_snapshots` | 0 | 03 |
| Events with `host_class = primary` (`f1-stories.gr`) | 416 of 416 | 02 |

### Confirmed observations

- A GA4 daily export exists in an EU dataset, and it receives production events from `f1-stories.gr`.
- The 173 + 69 split adds up to the 242 `web_vital` total. Legacy and versioned rows are distinguishable by
  `measurement_version`, as the [rum-pilot contract](../../perf/rum-pilot/README.md#event-contract) requires.
- Within these four days the versioned `web_vital` schema is intact: integer revisions, valid values, navigation
  timestamps, and no same-id/same-revision conflicts.
- No localhost, preview, `github.io` or other-host events appear in this window, so the contamination risk recorded in
  I-01 had zero observed volume here.

### Limitations

- **Property identity.** The property id is inferred from the dataset name. The link between GA4 property `485678890`
  and measurement ID `G-X68J6MQKSM` has not been read from GA4 Admin. The all-primary host result is consistent with
  that link but does not prove it.
- **Partial window.** Only four of the seven planned days. Tables for 23–24 exist (159 events) but are not in these
  results. `events_20261025` was not yet available.
- **Late arrival.** GA4 documents updates to daily tables for up to 72 h. The 19–22 figures can still change, and
  `last_modified` per table was not recorded.
- **Consent cohort only.** As stated in the [metrics contract](metrics-contract.md#population-and-coverage-bias),
  these are opted-in Main visits. The counts say nothing about total readership.
- **Version transition.** The window starts before #305 (merged 2026-10-20). The 69 legacy rows are expected from the
  old reporter and cached pages. The per-day split and the first production day of `wv6.2.3-rum1` were not recorded.

### Small-sample effects

- 84 page views and 171 observations across five metrics average about 34 observations per metric before any split.
  The rum-pilot table further splits by page group × viewport × coverage × navigation type, which leaves most cells in
  single digits or empty.
- **No p75 or rating distribution may be published from this window.** The zero-defect counts are meaningful as
  integrity checks, but their absence of failures at n = 173 does not bound the defect rate tightly.

### Unknowns

- What the remaining 90 events are (416 − 84 − 242). The per-event breakdown from 02 was not recorded, and neither were
  parameter types or the tool path/link classes.
- Whether the 2 rows between 173 snapshots and 171 observations are later revisions (expected for CLS/INP) or transport
  duplicates. SQL 03's `snapshots`, `max_revision` and `duplicate_copies` columns answer this.
- The legacy rows' metrics and days.
- Whether `events_intraday_*` tables exist (streaming export), and each table's creation and last-modified times
  ([sql/01](sql/01-export-tables.sql), metadata only).
- The bytes scanned by 03.

## Cost

Dry-run estimate for the 02 inventory: **241.85 KB**. Each job ran with **maximum bytes billed = 100 MB**.

This deviates from the I-01 criterion "maximum bytes billed set to the dry-run figure". BigQuery documents a minimum of
10 MB billed per referenced table, so a cap at the KB-scale dry-run figure would reject the query. A fixed 100 MB cap
still bounds cost for this dataset size (575 rows). Keep 100 MB for the final run, and revisit it only if a dry-run
exceeds it.

## Final checks before merge

All runs use SQL files 01–03 unchanged, with no new diagnostic queries. Run them on or after **2026-10-28**, which
allows the 72 h late-arrival window for `events_20261025`.

1. **01** with `@start_day = 2026-10-19`, `@end_day = 2026-10-25`. Record seven contiguous `events_` tables, their row
   counts, `created_at` / `last_modified_at`, and whether any `events_intraday_` table exists.
2. **Dry-run 02 and 03** with the same parameters. Record both byte estimates and confirm each is under 100 MB.
3. **Run 02** with maximum bytes billed = 100 MB (104857600). Record:
   - event rows per `event_name`, so every event in [event-inventory.md](event-inventory.md) is observed or marked
     absent;
   - `host_class` totals, where anything other than `primary` must be quantified;
   - `page_view` rows with `path_class = tool_*` (expected 0);
   - `internal_page_click` rows with `link_class = tool_*`;
   - value types of `metric_revision`, `nav_start_ms` and `sponsored`;
   - the constant values of `engaged_seconds` / `scroll_depth`.
4. **Run 03** with the same cap. For `wv6.2.3-rum1`, the six defect columns (`missing_id`, `missing_int_revision`,
   `revision_not_int`, `missing_or_negative_value`, `missing_nav_start`, `conflicting_snapshots`) must be 0, or each
   failure must be listed. Also record `rows_received`, `observations`, `snapshots`, `max_revision`,
   `duplicate_copies` and `first_seen`, and the `(none)` legacy row count per metric.
5. **GA4 Admin:** confirm property `485678890`'s web stream is measurement ID `G-X68J6MQKSM`.
6. **Update this file:** replace the interim tables with the 19–25 results and keep the 19–22 figures labelled as
   interim. Any change in 19–22 counts is reported as late arrival. Change the status line only if checks 1–5 pass.
7. **Scope:** `git diff origin/main --stat` lists only `docs/intelligence/**`, CI is green, and the public artifact
   delta is zero.
