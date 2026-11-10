# Validation contract

Reviewed against repository SHA `58273df6d753510605468c0787d9cdf04d6d398e`. The recorded production executions were reported by the owner, not independently rechecked. No owner-local report is supplied: `PENDING_OWNER_VALIDATION`. All 20 models remain `PRODUCTION_EXECUTED`; none is `PRODUCTION_VALIDATED` (`docs/intelligence/bigquery-validation.md:19`, `docs/intelligence/README.md:3`). Documentation completion does not approve a numerical sponsor claim.

## Existing statuses and separate evidence dimensions

The existing lifecycle meanings are preserved verbatim (`docs/intelligence/bigquery-validation.md:32`, `docs/intelligence/bigquery-validation.md:33`, `docs/intelligence/bigquery-validation.md:34`, `docs/intelligence/bigquery-validation.md:35`):

| Status | Meaning |
| --- | --- |
| `STATICALLY_TESTED` | “Rendered and checked by `npm run test:intelligence` (synthetic fixtures, no BigQuery)” |
| `BIGQUERY_DRY_RUN_PASSED` | “A real `bq query --dry_run` succeeded; bytes recorded” |
| `PRODUCTION_EXECUTED` | “An authorized run returned aggregate results” |
| `PRODUCTION_VALIDATED` | “Executed results checked against the coverage models and the acceptance criteria” |

Record each of the following separately, with its model or check, source revision, population and actual window. These fields do not replace lifecycle statuses or validator outcomes. Software tests establish behavior; operational execution, scoped internal reconciliation, external verification and claim approval are distinct. “Fully validated” means applicable defined requirements have evidence, not complete audience observability. Manual obligations use met/unmet/unverified and approval, not a SQL status.

| Dimension | Values |
| --- | --- |
| Execution evidence | not executed; synthetic tested; dry-run checked; production executed |

| Dimension | Values |
| --- | --- |
| Analytical evidence | not checked; internal reconciliation passed; external checks pending; fully validated |

| Dimension | Values |
| --- | --- |
| Sponsor reporting | not measured; measured with limitations; validation pending; approved for specified claim; prohibited/unsupported claim |

## Model coverage register

Each row has the owner-reported `PRODUCTION_EXECUTED` status. Snapshot membership is defined in `scripts/intelligence/snapshot.mjs:44`; check rules are in `docs/intelligence/data-quality.md:70`, `docs/intelligence/data-quality.md:103`. The historical seven-day all-model and owner checklist remains open (`docs/intelligence/bigquery-validation.md:264`, `docs/intelligence/bigquery-validation.md:284`; `docs/intelligence/i06c4-closeout.md:25`). For every row, relevant coverage, parameters, source/stream and applicable external evidence remain open; the last column names additional scope. Execution does not prove receipt of each event family or completeness of each parameter.

| Model | Recorded execution status | Nine-model snapshot | Checks covering it | What stays open |
| --- | --- | --- | --- | --- |
| 10 article pageviews | `PRODUCTION_EXECUTED` | Yes | `articles.totals`, `articles.by-category`, `articles.within-site`, `articles.days` | Actual window, identity, mapping and coverage. |
| 11 category pageviews | `PRODUCTION_EXECUTED` | Yes | `articles.totals`, `articles.by-category` | Same-window 10 and catalogue classification. |
| 12 article engagement | `PRODUCTION_EXECUTED` | No | Historical production checks; model 15 coverage | Matching event counts, coverage and ratio scope. |
| 13 article discovery | `PRODUCTION_EXECUTED` | Yes | `discovery.within-navigation`, `discovery.by-section`, `discovery.by-surface`, `discovery.fields` | Mapping and actual carried window against 28. |
| 14 publication age | `PRODUCTION_EXECUTED` | No | Historical production checks against 10/12 and 15 | Age classification, parameters and matching scope. |
| 15 editorial coverage | `PRODUCTION_EXECUTED` | No | Historical editorial filter and mapping checks | Full stages, exclusions and unmapped results. |
| 20 daily activity | `PRODUCTION_EXECUTED` | Yes | `articles.within-site`, `articles.days`, `acquisition.sessions` | Day continuity and matching 26/29 days. |
| 21 site sections | `PRODUCTION_EXECUTED` | No | Historical section checks against 20 and 29 | Totals and classification. |
| 22 device category | `PRODUCTION_EXECUTED` | No | Historical device checks against 20 and 29 | Totals and unknown categories. |
| 23 country | `PRODUCTION_EXECUTED` | No | Historical country checks against 20 and 29 | Totals, unknowns and grouping floor. |
| 24 first-user acquisition | `PRODUCTION_EXECUTED` | No | Historical acquisition checks against 20 and 29 | Scope and first-user unknowns. |
| 25 collected acquisition | `PRODUCTION_EXECUTED` | No | Historical acquisition checks against 20 and 29 | Scope and collected-source gaps. |
| 26 session acquisition | `PRODUCTION_EXECUTED` | Yes | `acquisition.sessions`, `acquisition.coverage`, `acquisition.gaps-reconcile` | Matching 20/29 scope and attribution. |
| 27 engagement events | `PRODUCTION_EXECUTED` | No | Historical event checks and 29 coverage | Event integrity and parameter types; no sponsor attribution report. |
| 28 internal navigation | `PRODUCTION_EXECUTED` | Yes | `discovery.within-navigation`, `discovery.by-section`, `discovery.by-surface`, `discovery.fields` | Same-scope 13, classes and carried dates. |
| 29 audience coverage | `PRODUCTION_EXECUTED` | Yes | `acquisition.coverage`, `acquisition.gaps-reconcile` | Full filter stages and unknown counters, beyond snapshot subset. |
| 30 CWV summary | `PRODUCTION_EXECUTED` | Yes | `rum.ratings`, `rum.p75`, `rum.coverage`, `rum.grid` | Mature reference, compatible grain, CLS conversion evidence and sample limits. |
| 31 CWV breakdown | `PRODUCTION_EXECUTED` | No | Historical 30/33 coverage and integrity checks | Comparable grain and applicable reference; dimensions are not crossed. |
| 32 CWV trend | `PRODUCTION_EXECUTED` | No | Historical cohort and 33 integrity checks | Both day and week periods, thresholds and partial weeks. |
| 33 RUM coverage | `PRODUCTION_EXECUTED` | Yes | `rum.coverage`, `rum.pipeline`, `rum.integrity`, `rum.library` | Full consent/host stages, integrity query and reference comparability. |

The snapshot cannot alone validate its eleven omitted models. The historical final check is the 2026-10-19–2026-10-25 window with as-of 2026-10-29, independently of later snapshot windows. Model-specific checks and outstanding coverage are documented in `docs/intelligence/bigquery-validation.md:245`, `docs/intelligence/bigquery-validation.md:264`; snapshot check IDs and applicability are in `docs/intelligence/data-quality.md:78`, `docs/intelligence/data-quality.md:103`.

## Wording reconciliations

| Item | Classification and treatment |
| --- | --- |
| No `FAIL` versus present, passing checks | A substantive strictness conflict: snapshot-specific no-FAIL can coexist with absent checks (`docs/intelligence/data-quality.md:185`; `docs/intelligence/i06c4-closeout.md:27`). The CLI's success only means no FAIL (`scripts/intelligence/validate-snapshot.mjs:729`). Preserve history and resolve prospectively through the proposed decision below. |
| Snapshot versus overall model validation | A scope conflict if both are called simply validated: external checks remain open after snapshot success, while overall status requires relevant historical owner items (`docs/intelligence/data-quality.md:185`; `docs/intelligence/bigquery-validation.md:284`). Keep snapshot reconciliation, model acceptance and claim approval separate. The non-consenter population is unobservable and remains a limitation/`NOT_VERIFIED`, never PASS (`scripts/intelligence/validate-snapshot.mjs:718`; `docs/intelligence/i06c4-closeout.md:41`). |
| “Production validation” heading | Historical operational execution, not a substantiated promotion: the same passage lists unresolved checks (`docs/intelligence/dashboard-snapshots.md:403`, `docs/intelligence/dashboard-snapshots.md:408`). Cite the execution only; do not change model status. |
| “Never the counts” versus PASS/FAIL extract | Compatible restrictive sharing instructions, not competing validation definitions (`docs/intelligence/data-quality.md:234`; `docs/intelligence/i06c4-closeout.md:160`). This task permits the limited validation-outcome whitelist in Stage B; metric and diagnostic data counts remain excluded. `--redact` alone is not the sharing filter. |
| “First owner-validated run” | Historical rollout wording, not analytical promotion (`docs/intelligence/README.md:26`; `docs/intelligence/README.md:3`). Preserve it as history and keep owner validation pending. |

The inherited “consented-visitor click floor” appears in `docs/commercial/README.md:57` and `docs/commercial/rights-matrix.md:120`. Repeated, unmatched click events provide neither a visitor denominator nor reporting permission (`scripts/analytics.js:176`; `docs/intelligence/metrics-contract.md:45`; `docs/commercial/pricing-methodology.md:43`). No numerical audience or sponsor-performance statement is approved by that phrase.

## OWNER DECISION: claim approval rule (proposed, not adopted)

> Approve an external statement only for a named claim, source revision, population, unit, measured window/as-of and stated limitations. Manual fulfilment requires the approved obligations, dated delivery evidence, exceptions and accountable sign-off. An analytical statement additionally requires the claim-relevant results and coverage, applicable internal checks actually present and PASS, warnings reviewed locally, and the relevant source/stream, parameter, export, attribution and external evidence. Missing material evidence or a relevant unresolved FAIL blocks that statement; unrelated models and checks do not. Record sample limits, suppression, permissions, recipients and approver/date. A no-FAIL snapshot result is snapshot-scoped evidence only. Preserve lifecycle statuses; record `PRODUCTION_VALIDATED` only when the model's applicable existing production acceptance and historical owner-checklist requirements are evidenced. Approval of a statement does not automatically promote a model. Unobservable populations remain explicit limitations/`NOT_VERIFIED`, never PASS.

This proposed rule is not adopted. Until adoption and evidence, preserve recorded statuses, make no promotions and hold numerical sponsor results. The historical model checklist remains open; unrelated models or RUM are not prerequisites for manually evidenced delivery facts (`docs/intelligence/bigquery-validation.md:284`; `docs/commercial/packages.md:24`).

## Population, units, windows and interpretation

- **Population and identity.** Runtime collection is consent gated but has no production-host allowlist; modeled editorial, audience and RUM populations require consent and the primary HTTPS host (`scripts/analytics.js:84`, `scripts/analytics.js:274`; `docs/intelligence/sql/models/base.sql:33`; `docs/intelligence/sql/models/audience-base.sql:23`; `docs/intelligence/sql/models/rum-base.sql:49`). Consenters are not all readers. Main does not inject analytics into child documents (`docs/intelligence/README.md:61`). Article identity follows normalized paths and retired-ID mapping; catalogue metadata is the render revision, not a historical readership record (`docs/intelligence/metrics-contract.md:19`; `docs/intelligence/editorial-model.md:99`). Comparisons require compatible identity, mapping revision, configuration, cohort, unit and window; that does not establish causality.
- **Units and sources.** Pageviews, session starts and clicks are events, not people or verified visits. Engagement is unmatched engaged events per page-view event; it can exceed one and is NULL without a denominator (`docs/intelligence/editorial-model.md:86`; `docs/intelligence/sql/models/12-article-engagement.sql:1`). First-user, collected-event and session-last-click acquisition are separate scopes, not additive populations (`docs/intelligence/sql/models/audience-base.sql:34`; `docs/intelligence/sql/models/26-acquisition-session.sql:1`). Missing attribution is not proof of Direct. GA4 UI and BigQuery have distinct settings and processing; resolve definitions, dates and scope before interpreting differences, without assuming equality or Search Console reconciliation (`docs/intelligence/metrics-contract.md:52`; `docs/intelligence/data-quality.md:95`).
- **Actual windows.** Read each result's `modelWindows` and as-of: primary is at most 28 mature days, acquisition 26/29 at most seven with the same end, and discovery has its own weekly window. Discovery days carry RUM exactly one day; carried discovery retains its own date and expires. A refreshed envelope does not refresh carried results (`scripts/intelligence/snapshot.mjs:26`, `scripts/intelligence/snapshot.mjs:81`, `scripts/intelligence/snapshot.mjs:92`, `scripts/intelligence/snapshot.mjs:249`). Do not sum overlapping rolling snapshots or treat a rolling Los Angeles day window as an exact subday contract term.
- **Existing reconciliations only.** With compatible populations and identical units and window/as-of, 10 page-view totals equal 11 and are a subset of 20; for each of `session_start` and `page_view`, 26 equals matching days of 20 and 29's kept site events; 13 clicks are a subset of 28; 30 ratings sum to observations and 33 coverage matches 30 by coverage class. The documented per-category, gap, section, surface and pipeline checks apply at their stated grains. There are no numerical tolerances; mismatched scope is `NOT_VERIFIED` (`docs/intelligence/data-quality.md:33`, `docs/intelligence/data-quality.md:70`). Do not equate 10 with 13, 13 with 28 article destinations, or 26 with Search Console (`docs/intelligence/data-quality.md:95`).
- **Missing and samples.** A zero in a present mature table is not proof of no readers; missing or partial source and absent comparisons are not zero (`scripts/intelligence/snapshot.mjs:356`; `docs/intelligence/data-quality.md:21`, `docs/intelligence/data-quality.md:139`). Use 30 for specified ratio, ranking, group-comparison and p75 uses; model 12's flag counts page-view events. Exact reconciliations can pass below that floor. Counts under 10 stay owner-only, with complementary disclosure guarded; descriptive counts from 10–29 need specific approval and limitations. Never promise sufficient samples or loosen the threshold (`docs/intelligence/editorial-model.md:103`; `docs/intelligence/audience-model.md:134`; `docs/intelligence/performance-model.md:123`; `docs/intelligence/sql/models/12-article-engagement.sql:17`).
- **RUM.** Resolve `(version, metric, metric_id)` by highest revision, then latest event timestamp, before navigation-cohort filtering; transport copies and revisions are not separate observations (`docs/intelligence/sql/models/rum-base.sql:49`). Coverage stages have different units and overlapping diagnostic categories (`docs/intelligence/sql/models/33-rum-coverage.sql:18`). Keep metric and coverage cohorts separate, convert CLS to native units, never average p75s or treat missing INP as zero. A shared-logic reference is a consistency check, not independent proof of complete navigation or CrUX (`docs/intelligence/metrics-contract.md:27`; `docs/intelligence/i06c4-closeout.md:122`).

## S2 report acceptance

The proposed scope is two new articles on an editor-selected theme in four weeks. Require approved duties and dates/timezone; canonical identity and newness; actual deployed publication and acknowledgment; editor/human review and separate commercial decisions; actual permission and disclosure outputs; exceptions; and one accountable obligations closeout. Two URLs alone do not prove all duties. Effective funded-content routing and disclosure safeguards remain a separate, not-implemented delivery prerequisite. Follow the existing [package](packages.md#s2-technical-analysis-partner--priority-1), [rights matrix](rights-matrix.md) and [risk register](risk-register.md) (`docs/commercial/packages.md:31`).

Article statistics are optional: require the exact canonical cohort, compatible mature model-10 evidence and coverage. Engagement additionally requires independently evidenced model 12 at matching scope; neither model 27 nor the nine-model snapshot validates it. S2 purchases no sponsor logo, link, strip or sponsor-effectiveness metric (`docs/commercial/packages.md:31`; `scripts/intelligence/snapshot.mjs:44`).

## S1 report acceptance

Require one privately owner-released P-label, both home aliases only, an agreed 28-calendar-day term with exact endpoints/timezone, durable isolation from article extraction, checks of actual built and deployed scope, permitted artwork/link/disclosure, observed installation and removal, exceptions and owner/operations closeout. All six positions are occupied and capacity is unconfirmed. Boundary checks establish observations, not uninterrupted display. Follow the [package](packages.md#s1-website-partner--priority-2), [inventory](inventory.md#shared-control-and-capacity-prerequisite), [rights matrix](rights-matrix.md) and [risk register](risk-register.md) (`docs/commercial/packages.md:41`; `blog-module/build/article-render.js:99`).

No click promise is required. If later selected, it needs effective-dated unambiguous sponsor/listing/destination/role/source/term mapping, occupant and collision handling, and a validated narrow aggregate report; model 27 alone cannot supply it. Align analytics bounds with the term or disclose omitted/overlap periods; a rolling snapshot is not the contract term (`docs/intelligence/sql/models/27-engagement-events.sql:9`; `docs/commercial/packages.md:43`). Both minimum reports can be manual; neither discharges applicable rights, disclosure, category or professional-review gates.

## Stages A to D

### Stage A — offline

Inspect source, model dependencies, schemas, contracts, synthetic tests and public workflow evidence; build the claim-to-evidence record and identify owner-local checks. This establishes software and documented operational behavior only, not actual audience correctness or sponsor approval (`docs/intelligence/data-quality.md:169`; `docs/intelligence/bigquery-validation.md:19`). See [metrics evidence](metrics-evidence.md).

### Stage B — owner-local snapshot validation

The owner alone follows the [hidden-prompt instructions](../intelligence/i06c4-closeout.md#owner-local-validation) in a trusted, non-recorded terminal. The key is never given to anyone or any agent and never pasted in a chat, PR or tool. No network or Google login is needed. Review every WARNING and NOT_VERIFIED locally and check each required model's actual carried dates. Exit 0 means no FAIL, not all checks passed; 1 indicates FAIL, and 2 means the file/key/envelope cannot be opened. A relevant FAIL holds the affected conclusion (`docs/intelligence/i06c4-closeout.md:134`, `docs/intelligence/i06c4-closeout.md:173`).

The owner may share **only** overall status, PASS/FAIL/WARNING outcome counts, check identifiers, diagnostic categories, as-of date and window. Nothing else: no raw payload, complete report, metric value, key, identifier or visitor-level record. `--redact` alone is not the sharing filter; the existing PASS/FAIL-only extract is a narrower safe subset (`docs/intelligence/i06c4-closeout.md:160`; `scripts/intelligence/validate-snapshot.mjs:735`). Absent a report: `PENDING_OWNER_VALIDATION`.

### Stage C — optional external checks, plan only

Reuse the [data-quality plan](../intelligence/data-quality.md#optional-bigquery-checks-plan-only-nothing-executed) and [owner checks](../intelligence/i06c4-closeout.md#existing-owner-checks-billing-and-scan-bounds): export metadata/completeness limitations, exact inventory parameter presence/types, event and RUM integrity, stream identity, relevant coverage and reference comparison. Explicit owner authorization for the concrete scope is required before **any** cloud step. Before billable execution the owner privately reviews exact SQL, windows, actual dry-run bytes, unchanged caps and whole-cloud monthly spend including scheduled and manual work. No agent runs any of it (`docs/intelligence/data-quality.md:213`; `docs/intelligence/i06c4-closeout.md:185`).

The EUR 10/month total-cloud constraint and existing safeguards are configuration, not measured spend: 100 MiB for the existing seven-day manual checks; the existing full-window RUM plan uses 400 MiB per query; snapshot safeguards are 400 MiB/query and 1600 MiB/refresh. A planning floor is not an estimate or upper bound; manual work does not inherit refresh accounting, and a budget alert is never a hard cost cap. Stop if the existing cap or budget cannot accommodate the work; do not change caps, privileges, jobs or schedules (`docs/intelligence/i06c4-closeout.md:192`, `docs/intelligence/i06c4-closeout.md:208`; `scripts/intelligence/snapshot.mjs:29`).

### Stage D — mature RUM dependency

The earliest eligible as-of is **2026-11-19**, for the fixed **2026-10-19 to 2026-11-15** navigation cohort. Models 30/33 use that cohort, as-of 2026-11-19 and `America/Los_Angeles`. The reference uses first day 2026-10-19, extraction as-of 2026-11-15, deployment/scan margin 2026-10-18, version `wv6.2.3-rum1`, coverage `all` and navigation type `all`; keep strata separate and the 30-observation interpretation floor. The first reference scans 29 suffix dates; do not create a missing pre-export table (`docs/intelligence/i06c4-closeout.md:105`).

Check actual carried bounds, integrity, units and consent/host comparability. Compare LCP, INP and CLS counts separately from any eligible p75 comparison; FCP and TTFB lack reference counterparts. Sum counts only over disjoint reference strata. Never average p75s: multiple populated strata leave pooled p75 agreement `NOT_VERIFIED` unless separately reviewed identical-grain recomputation exists. Model 31 does not automatically provide that grain. Nonzero CLS conversion evidence remains needed when available (`docs/intelligence/i06c4-closeout.md:118`, `docs/intelligence/i06c4-closeout.md:122`, `docs/intelligence/i06c4-closeout.md:235`). No premature comparison, promised adequate sample size or looser threshold; maturity alone does not establish stable inference.
