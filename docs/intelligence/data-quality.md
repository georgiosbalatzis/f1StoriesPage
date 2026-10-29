# I-06C4 — Data quality, reconciliation and validation

Status (2026-10-29): **offline validator implemented and tested on synthetic snapshots. Not run on production data.**
`scripts/intelligence/validate-snapshot.mjs` checks a decrypted snapshot payload in memory. It is not wired into any
workflow, it runs no BigQuery query, and it writes nothing. The owner runs it locally with the dashboard key
([Run it](#run-it)). Until that run happens, no I-06 model is `PRODUCTION_VALIDATED`
([evidence](#production-evidence)).

The aim is not to make every metric pass. It is to say, for each figure on `/dashboard/`, whether it is consistent
with the others, whether it is complete, and what evidence supports that, and to say so explicitly when the
evidence does not exist.

## Outcomes and severities

| Outcome | Meaning |
| --- | --- |
| `PASS` | Verified against the aggregates in the snapshot. A check that did not run is never a PASS |
| `WARNING` | The data is valid but limited: an attribution gap, unmapped URLs, an overdue weekly refresh, a probable collection gap |
| `FAIL` | A demonstrated contract violation |
| `NOT_VERIFIED` | The snapshot cannot establish it (a model is absent, the windows differ, or the evidence is outside BigQuery aggregates) |

| Severity | Used for |
| --- | --- |
| critical | Broken identity, integrity or window claims: the snapshot must not be used |
| high | A material numerical mismatch between models, or a confirmed instrumentation problem |
| medium | Freshness, missing coverage, unresolved classification |
| info | Expected lag, small samples, known limitations |

There are no numerical tolerances. Every reconciliation below is exact, because both sides are integer counts of
the same events. A rule that cannot be exact is not a reconciliation; it is a `WARNING` or is left out.

## Populations (derived from the SQL)

| Population | Defined in | Filter | Models |
| --- | --- | --- | --- |
| `editorial` | `sql/models/base.sql` | `analytics_storage = 'Yes'`, page on `https://f1-stories.gr`, mature day, **and an article key** | `10`, `11`, `13` |
| `site` | `sql/models/audience-base.sql` | `analytics_storage = 'Yes'`, page on `https://f1-stories.gr`, mature day | `20`, `26`, `28` |
| `events` | `29-audience-coverage` | every event of the audience-base list in the window tables, with each filter stage counted | `29` |
| `rum` | `sql/models/rum-base.sql` | deduplicated `wv6.2.3-rum1` observations, revisions resolved first, navigation cohort | `30`, `33` |

`editorial` is `site` with one more condition, and both read the same table bounds with the same host regular
expression, consent filter and maturity rule. So, for the same window, editorial page views are a subset of site page
views, and editorial clicks are a subset of site clicks. Tests read the SQL and fail if any of these filters diverge.

## Quality contract

`QUALITY_CONTRACT` in the validator is the machine-readable form; a test checks that it lists exactly the snapshot
models and every column `SNAPSHOT_MODELS` keeps, and that each column exists in the model SQL.

| Model | Metric · unit | Window · cadence | Grain | Missing values allowed |
| --- | --- | --- | --- | --- |
| `10-article-pageviews` | Article page views · `page_view` events | primary (≤ 28 mature days) · daily | `article_id` | metadata NULL only on `(unmapped)` or a catalogue gap |
| `11-category-pageviews` | Page views by primary category · `page_view` events | primary · daily | `category` | none; `(unmapped)` and `(unknown)` are explicit; catalogue-only categories read 0 |
| `13-article-discovery` | Clicks to articles · `internal_page_click` events | primary · weekly, carried ≤ 13 days | destination, source surface, `link_section` | title/category NULL on `(unmapped)`; `link_section` `(none)` when absent |
| `20-daily-activity` | Daily `page_view`, `session_start`, `first_visit` · events | primary · daily | `event_day` (every window day) | none: 0 means no kept event in an existing table |
| `26-acquisition-session` | Events by GA4 session last click · `session_start` and `page_view` events | acquisition (≤ 7 days, same end) · daily | channel, medium, source family | none; NULL attribution is `unattributed`, never Direct |
| `28-internal-navigation` | Clicks by source and destination section · `internal_page_click` events | primary · weekly, carried ≤ 13 days | source, destination, `link_section` | destination `missing` without `link_path`; `link_section` `(none)` |
| `29-audience-coverage` | Filter stages and attribution gaps · events | acquisition · daily | `event_name` | a name without a row had no event in the window |
| `30-cwv-summary` | LCP/INP/CLS (+FCP/TTFB) p75 and ratings · observations, ms (CLS unitless) | primary · daily, carried 1 day on discovery days | coverage × metric (15 rows) | p75 and `good_share` NULL exactly when there are no observations |
| `33-rum-coverage` | Observation pipeline stages · events, snapshots or observations by stage | primary · as `30` | stage × category | a missing stage/category counted 0 |

Valid ranges: every count is a safe integer ≥ 0; every grouped row counts at least 1 (a `GROUP BY` never yields an
empty group); `good_share` is in 0…1; p75 ≥ 0; dates are ISO days. Sample size: `min_events = min_observations = 30`.
Rows below it keep their numbers and carry `meets_min_* = false`; the validator checks every flag against its count.

## Reconciliation rules

Before any comparison the validator calls `reconcile()`. It returns `NOT_VERIFIED` unless both sides count **the same
unit** over **the same window and as_of day**, and the populations support the relation: `equal` needs one
population, `subset` needs the left population to be declared a subset of the right (`editorial ⊂ site`). A 28-day
total is never compared with a 7-day total. Model 20 has a daily grain, so it is summed over exactly the acquisition
days before it is compared with 26 and 29.

| Check | Rule | Why it is valid |
| --- | --- | --- |
| `articles.totals` | Σ 10 page views = Σ 11 page views | both count `editorial` page views over the primary window; 11 groups 10's rows by category |
| `articles.by-category` | per category, 11 = Σ of 10's articles in it; `articles_with_events` = 10's mapped rows in it | 11's category is 10's `primary_category`, `(unknown)` when NULL, `(unmapped)` for unmapped rows |
| `articles.within-site` | Σ 10 page views ≤ Σ 20 page views | `editorial ⊂ site`, same window |
| `articles.days` | each article's `days_with_events` ≤ days with any site page view, and ≤ its views | a view on a day implies a site view that day |
| `acquisition.sessions` | Σ 26 = Σ 20 over the 26 window days, for `session_start` and for `page_view` | both `site`; 26 groups by attribution only |
| `acquisition.coverage` | 29 `site_events` = Σ 26, per event | 29's `kept` repeats the `site` filter |
| `acquisition.gaps-reconcile` | 29's unattributed/other counters = Σ 26 rows in those classes | same class functions on the same events |
| `discovery.within-navigation` | Σ 13 clicks ≤ Σ 28 clicks | `editorial ⊂ site`, same weekly window (13 and 28 always move together) |
| `discovery.by-section` | per `link_section` class, 13 ≤ 28 | 13's raw `link_section` is mapped with 28's `link_section_class` first |
| `discovery.by-surface` | per source surface, 13 ≤ 28 | 28's path classes outside 13's surfaces are 13's `other` |
| `rum.ratings` | good + needs_improvement + poor = observations; `good_share` = good / observations | every core observation is rated |
| `rum.p75` | p75 lies in the band the rating counts force | `PERCENTILE_CONT` interpolates between positions ⌊0.75(n−1)⌋ and ⌈0.75(n−1)⌉; when both fall in one band, p75 does too |
| `rum.coverage` | 33 `coverage_distribution` = Σ 30 observations, per coverage class | both read `rated` for the same cohort |
| `rum.pipeline` | validity categories sum to resolved; rated ≤ valid; rated ≤ in cohort; resolved ≤ eligible snapshots | stages of one pipeline |

Not reconciled, on purpose:
- **13 against 28's `article` destinations as an equality.** 13 can also resolve a destination through the
  `article_id` parameter. `discovery.destinations` only warns when 13 exceeds them.
- **26 against Search Console clicks.** These are different instruments: GA4 consented events versus Google's own
  clicks.
- **10 against 13.** A click is not a page view.
- **30 across coverage classes.** They are never pooled; `rum.grid` requires all 15 rows.

## Checks

Integrity: `payload.format`, `payload.header`, `payload.window`, `payload.as-of`, `payload.models`, `schema.columns`,
`schema.grain`, `schema.positive`, `continuity.days`, `articles.rows`, `articles.identity`, `acquisition.stages`,
`rum.grid`. A failure of `payload.*`, `schema.columns` or `schema.grain` stops the numeric checks: nothing is computed
on a payload that is not what its header says.

Presentation: `payload.thresholds`, `schema.flags` (the dashboard's small-sample marks come from these flags).

Classification: `schema.enums`, which checks that every class is one the SQL can produce. Tests compare each list
with the SQL `CASE` and with `analytics.js classifyLink()`.

Scheduling and freshness: `window.labels`, `window.carried`, `window.rows`, `window.rotation`, `freshness.snapshot`,
`freshness.discovery`.

Reconciliation: see the rule table above.

Source coverage and instrumentation: `continuity.zero-days`, `continuity.sessions-without-views`,
`articles.unmapped`, `articles.metadata`, `categories.catalogue`, `acquisition.filters`, `acquisition.attribution`,
`discovery.destinations`, `discovery.fields`, `discovery.classes`, `discovery.unmapped`, `rum.integrity`,
`rum.library`.

Sample: `sample.sizes` is one consolidated note, never a warning. At about five readers a day almost every row is
below 30. That is expected and is not reported row by row.

Outside the snapshot, always `NOT_VERIFIED`: `external.ga4-stream`, `external.parameters`,
`external.export-completeness`, `external.consent-population`, `external.rum-reference`.

## Time: what is expected and what is a defect

| Situation | How it is reported |
| --- | --- |
| Data ends 4 days before `as_of` | Expected GA4 maturity lag; stated in `freshness.snapshot`, never a warning |
| The 03:00 Athens run starts late | Harmless when the snapshot's `as_of` is still its own property day (`payload.as-of` checks exactly that) |
| Today's run has not happened yet | `freshness.snapshot` PASS, "pending or late" |
| One or more days without a refresh, or generated > 48 h ago | `freshness.snapshot` WARNING, medium (the dashboard's own stale rule is 48 h) |
| A daily export table is missing | Cannot reach the dashboard: the refresh fails closed on any missing table, and `continuity.days` requires one row per day. A missing day is never a zero |
| A table exists but is partial | Not visible in aggregates: `external.export-completeness` (free table metadata, below) |
| Three or more consecutive zero-page-view days | `continuity.zero-days` WARNING: a probable tag, consent or export gap, not proven zero readership. Isolated zero days are normal at this traffic |
| Discovery carried 1–7 days | Expected weekly rotation: PASS, with its own dates. 8–13 days: WARNING, overdue. More than 13: FAIL, since `schedule()` must have dropped it |
| RUM carried on a discovery day | Expected: PASS when it is exactly 1 day old and discovery ran in its place. Any other age, or a carried label whose dates are not that day's window, is a FAIL |

## Instrumentation: sent, exported, extracted

The repository can prove only the first column. The second needs the raw export (`sql/02`). The third is proven by
the models for the fields they read.

| `internal_page_click` field | Sent by `analytics.js` | In the GA4 export | Read by the models |
| --- | --- | --- | --- |
| `page_location` | yes (gtag config, campaign parameters kept) | unverified as such; an off-host or missing one is excluded and counted by 29 | 13, 28 (path), 29 |
| `link_path` | always (`destination.pathname`) | unverified; `discovery.fields` counts kept clicks without it (28 `missing`) | 13 (article key), 28 (destination) |
| `link_section` | always (`classifyLink()`, eight values) | unverified; `discovery.fields` counts `(none)`, `discovery.classes` counts unknown values | 13 raw, 28 classified |
| `article_id` | only for `/blog-entries/<id>/article.html` destinations | unverified | 13 fallback, when `link_path` gives no key |
| `source_path`, `source_type`, `destination_type` | always | unverified | **no model reads them** |

Findings from the code (repository, no query):
1. `source_path`, `source_type` and `destination_type` are collected but unused. The models derive source and
   destination from `page_location` and `link_path`. `detectPageType()` also classifies differently from
   `classify_path` (for example, entity hubs are `blog_index`). Do not report from these three parameters.
2. 13 keeps `link_section` as sent (`base.sql`), while 28 maps it through `link_section_class`. The same click can
   therefore read `Navigation ` in 13 and `navigation` in 28. The dashboard shows sections only from 28, so nothing
   displayed is affected. The validator maps 13 the same way before comparing.
3. The `article_id` click parameter adds nothing when `link_path` is an article path, which is the only case in
   which it is sent. The fallback matters only for a non-standard path that still contains `/blog-entries/`.
4. `catalog_articles` (11) counts the article index at render time, not a historical catalogue. Catalogue size is
   not readership: an article without traffic is never inferred from it.
5. The UI fixture `__tests__/snapshot-fixture.mjs` is deliberately not reconcilable: its 11 totals do not equal its
   10 totals. It tests rendering only. Reconciliation tests use `__tests__/validation-fixture.mjs`, which aggregates
   synthetic events with the models' own filters.

## Production evidence

Only GitHub Actions logs and the owner's Console report are evidence. The logs print model names, bytes and row
counts, never values.

| Date | Run | What it proves | What it does not prove |
| --- | --- | --- | --- |
| 2026-10-26 | Owner, BigQuery Console | All 20 models executed for 19–22 Oct. Several reconciliations passed, including `articles.totals` (25 + 14 + 1 = 40) and the subset rules (7 article clicks ≤ 15 internal clicks; 40 article views ≤ 84 page views). See [bigquery-validation.md](bigquery-validation.md) | Any later window, parameter completeness, stream identity |
| 2026-10-27 | `40489852956` (manual) | `as_of` 2026-10-27, 19–23 Oct: `11`, `20`, `30`, `33` executed, 4 × 10.00 MiB billed (220 MiB planned); 20 returned 5 rows for 5 days; 30 returned its 15 | Reconciliation of the encrypted values |
| 2026-10-28 | `40643859550` (schedule) | Correct dedupe: "the snapshot for as_of 2026-10-27 is already published". Not a missed refresh | — |
| 2026-10-29 | `40830298650` (schedule) | First discovery day, `as_of` 2026-10-28, 19–24 Oct: `10`, `11`, `13`, `20`, `26`, `28`, `29` executed; `30`, `33` carried from `as_of` 2026-10-27. Preflight 420 MiB; billed 7 × 10.00 MiB = 70 MiB. Row counts 13 / 8 / 9 / 6 / 3 / 14 / 7; 20's 6 rows match the 6-day window | The numbers themselves, that clicks carry `link_path`/`link_section` in the export, and that the page showed the carried labels (all of these need the decrypted payload) |

Statuses in the pipeline: `10`, `11`, `13`, `20`, `26`, `28`, `29` are `PRODUCTION_EXECUTED` over 19–24 Oct, and `30`,
`33` over 19–23 Oct. None is `PRODUCTION_VALIDATED`. A model becomes validated for a snapshot when the owner's local
run of the validator on that snapshot reports no `FAIL` for its checks. The external items below remain open
regardless.

## Run it

Locally, by the owner only, against the committed encrypted file. The key is read from the environment, so it never
appears in shell history or arguments. Nothing is written to disk.

```sh
read -rs DASHBOARD_SNAPSHOT_KEY && export DASHBOARD_SNAPSHOT_KEY   # paste the key; it is not echoed
node scripts/intelligence/validate-snapshot.mjs                   # report with counts (terminal only)
node scripts/intelligence/validate-snapshot.mjs --redact          # outcomes and dates only, safe to share
node scripts/intelligence/validate-snapshot.mjs --json --redact   # machine-readable, no counts
unset DASHBOARD_SNAPSHOT_KEY
```

The exit code is 0 without a `FAIL`, 1 with one, and 2 when the snapshot does not open. Under GitHub Actions the CLI
always redacts. It is deliberately not part of the scheduled workflow: the first runs should show whether real data
produces warnings that would be noise, and a `FAIL` should never block publication of an otherwise valid encrypted
snapshot without a decision. Tests: `npm run test:intelligence` (synthetic data and generated keys only).

## Optional BigQuery checks (plan only, nothing executed)

These answer the `external.*` items. None is scheduled, none runs in CI, and none may run without the owner's
explicit approval. Each must be dry-run first, and each runs once, manually, with the cap shown. Byte figures are the
conservative floor of 10 MiB per scanned daily table. In the only live evidence each query billed 10 MiB in total,
but that is not guaranteed.

| # | Query | Period | Expected bytes (dry-run first) | `maximumBytesBilled` | Billable | Permissions | Answers |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `bq show --format=prettyjson f1-stories-analytics:analytics_485678890.events_YYYYMMDD` per day (`numRows`, `lastModifiedTime`) | each window day | 0: metadata API call, not a query | — | no | dataset metadata read (owner already has it) | `external.export-completeness`: a present but partial table; late modifications |
| 2 | `docs/intelligence/sql/02-event-inventory.sql` as written | 2026-10-19 → 25 (capped at 7 tables) | ≤ 70 MiB | `104857600` (100 MiB) | yes | BigQuery Job User + dataset Data Viewer (owner) | `external.parameters`: which `internal_page_click` parameters exist, their types, host and path classes |
| 3 | `docs/intelligence/sql/03-web-vital-integrity.sql` as written | 2026-10-19 → 25 | ≤ 70 MiB | `104857600` | yes | as 2 | RUM id, revision and conflict integrity per version (complements `rum.integrity`) |
| 4 | `perf/rum-pilot/report.sql` against model 30 for the same 28-day cohort | `@first_day` 2026-10-19, `as_of` ≥ 2026-11-19 | ≤ 330 MiB (about 33 tables) | `419430400` (400 MiB) | yes | as 2 | `external.rum-reference` |
| 5 | GA4 Admin → Data streams | — | — | — | no | GA4 property access | `external.ga4-stream` |

Use the owner's account, never the snapshot workflow's service account. A read-only query still costs money. The
daily caps (400 MiB per query, 1600 MiB per refresh), the seven-query rotation and the €10 budget alert (an alert,
not a cap) are unchanged.

## Owner checklist

1. After the next scheduled refresh (`as_of` 2026-10-29, 19–25 Oct), run the validator locally. Record the redacted
   outcome in the PR or this file, never the counts.
2. Treat any `FAIL` as a blocker for editorial conclusions from the affected section. Treat `WARNING`s by their
   action.
3. Confirm the GA4 stream (row 5). Decide whether rows 1–3 are worth running once; row 1 is free.
4. On or after 2026-11-19, decide on row 4 for the RUM reference comparison.
5. Decide later whether the redacted validator should run inside the snapshot workflow. That needs its own PR and
   must not block publication on `WARNING`.
