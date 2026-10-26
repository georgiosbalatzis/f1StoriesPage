# I-01 validation report — 2026-10-26

Baseline `main` `5572beb7`, inspected in a clean worktree. No production query ran. No events were sent; no GA4,
BigQuery, consent, deployment or tracking setting was read with credentials or changed.

## What was checked

| Check | Method | Result |
| --- | --- | --- |
| Event emitters | `git grep` for `gtag('event'` / `trackEvent(` in public runtime code | `page_view` + 7 custom event names (`article_share` from two emitters), all listed in [event-inventory.md](event-inventory.md) |
| Consent gate | Read `scripts/analytics.js`, `scripts/cookie-consent.js`, Web Vitals loader/collector, error beacon | Tag loads only on `analytics: true`; ad signals always denied |
| Tag coverage, Main | Count of committed public-candidate HTML referencing each script | 467 / 470 / 471 / 458 of 479; all 412 articles fully tagged; authors and legal lack Web Vitals |
| Tag coverage, live | Plain GET of `/`, `/standings/`, four tools, `/f1telemetry/` | Main tagged; tools 0 tags; stub matches only its CSP |
| Child repositories | `git grep` of local clones at the lock SHAs in `scripts/deployment/sources.json` | No GA4/consent/beacon; BetCast `reportWebVitals()` has no callback |
| Live build identity | `https://f1-stories.gr/deployment-manifest.json` | Main `sourceSha` `5572beb7`; children at lock SHAs |
| Article identity | Script over `blog-index-data.json` and article folders | 412 = 412, all ASCII, no case collisions; 2 retired ids mapped |
| SQL | Static guard (scratch script, not shipped): no write/DDL except `CREATE TEMP FUNCTION`, placeholders only, every `events_*` suffix-bounded and capped at 7 tables, no intraday/user tables, no minimized fields | Pass, 4 files |
| Docs | Relative link check | Pass |

Existing quality gates were not modified. No code, dependency, workflow, budget or generated artifact changed, so no
test suite was re-run locally; CI runs the full suite because the change is outside blog entries
(`scripts/build/classify-quality.mjs`).

## SQL dry-run status

**Not run.** No `bq`/`gcloud` on this machine, no credentials, and the project id and property id are unknown. The
files have only been statically checked; syntax and bytes-scanned are unverified until an authorized analyst dry-runs
them.

## Public artifact impact

**Zero expected.** `scripts/build/public-artifact.mjs` copies an allowlist that does not include `docs/`, and no gate
reads `docs/intelligence/`. Not confirmed by a local before/after build; CI's `build:public` is the check.

## Unknowns [U]

BigQuery link existence, project, dataset id, location, link date, daily vs streaming, gaps, late updates, property
time zone, retention, sandbox expiry, enhanced-measurement settings, what GA4 stores in `page_referrer`, the first
production day of `wv6.2.3-rum1`, numeric types GA4 assigns to `metric_revision`/`nav_start_ms`/`sponsored`, and the
size of localhost/preview contamination. The 2026-10-20 attempt to list GA4 properties failed
([rum-pilot](../../perf/rum-pilot/README.md#reporting-feasibility-and-approval-prerequisite)); nothing since has changed that.

## PR I-02 — blockers

1. Owner confirms a GA4 → BigQuery link exists for the property behind `G-X68J6MQKSM`, and supplies project id and
   numeric property id out of band (not committed).
2. Analyst has read-only dataset access plus a billing project for query jobs. No new link, export, schedule or
   service is created by I-02; enabling an export is a separate owner decision.
3. Dataset location is EU ([00](sql/00-dataset-location.sql)). Non-EU stops I-02.
4. Cost: dry-run bytes for [02](sql/02-event-inventory.sql) and [03](sql/03-web-vital-integrity.sql) are recorded and
   approved, and each execution sets maximum bytes billed to that figure.

## PR I-02 — acceptance criteria

- [ ] 00 and 01 run first (metadata only). Location, link date, daily/intraday tables, gaps and late updates recorded.
- [ ] 02 and 03 run once each over one 7-day window ending at least 3 days before the run, with as-of time recorded.
- [ ] Every event in the inventory is reported as observed (with parameter types) or absent with a reason; any
      unexpected event name is explained.
- [ ] Tool coverage confirmed or refuted: `page_view` rows with `path_class = tool_*` (expected 0) and
      `internal_page_click` rows with `link_class = tool_*`.
- [ ] Non-primary `host_class` volume reported.
- [ ] `wv6.2.3-rum1`: `missing_*`, `revision_not_int` and `conflicting_snapshots` are 0, or each failure is listed;
      legacy `(none)` rows quantified.
- [ ] Committed results are aggregate-only, contain no ids from the
      [minimization list](metrics-contract.md#data-minimization), and say "production-validated" only for queries
      that actually ran.
- [ ] No tracking, consent, deployment or budget change; public artifact delta zero.

## Tracking recommendations (separate, not implemented)

Each needs its own reviewed PR, and the tool items need an owner/privacy decision.

1. Send only on `f1-stories.gr` (host guard in `analytics.js`, error beacon, Web Vitals loader) to stop preview contamination.
2. One shared path classifier for `source_type`, `destination_type` and `page_group`, covering authors, entity hubs and tools.
3. Decide explicitly whether the four tools should be measured. If yes, each child repository adopts Main's consent key
   and gate. Not by injecting Main scripts at assembly, which the deployment architecture rules out.
4. Load Web Vitals on authors and legal pages, or document their exclusion.
5. Emit decoded canonical `article_id` (and on `page_view`), and add an event schema version to custom events.
6. Rename or drop the constant `engaged_seconds`/`scroll_depth` parameters of `article_engaged`.
7. Review whether `js_error` `message`/`stack` should be collected at all under data minimization.
