# Audience baseline evidence

Status: partial evidence register; base `58331f9fb`;
investigation 2026-11-03 UTC.

This is a truthful **partial baseline**, not a 28-day
audience baseline. See the [measurement
contract](measurement-contract.md) for units, populations,
proxies and the evidence-label
mapping. No production query or snapshot inspection was
performed for A-01.

## Availability and maturity

- The GA4 daily export starts **2026-10-19**; the property timezone is `America/Los_Angeles` ([validation](../intelligence/bigquery-validation.md#phase-1-parameters), [snapshot data](../intelligence/dashboard-snapshots.md#data)).
- Daily tables are eligible only through `as_of − 4` days; late-arriving events motivate the lag. Missing tables fail refresh, while an existing partial table is not established complete by aggregate data ([freshness](../intelligence/metrics-contract.md#freshness), [time rules](../intelligence/data-quality.md#time-what-is-expected-and-what-is-a-defect)).
- The earliest 28-day cohort is **2026-10-19–2026-11-15** inclusive: 13 days in October plus 15 in November = 28. Its end becomes mature at `as_of = 2026-11-15 + 4 days = 2026-11-19` in the property timezone ([production checks](../intelligence/bigquery-validation.md#production-data-checks)). This date establishes eligibility only, not export completeness or validation.
- A hypothetical `as_of` 2026-11-03 permits an end of 2026-10-30, 12 calendar days since export start. This arithmetic is not an observation that those days are complete, available, or present in a particular snapshot. The 03:00 Athens run may still be on the preceding Los Angeles property day ([schedule](../intelligence/dashboard-snapshots.md#schedule-reruns-and-dst)).
- Snapshots are scheduled daily at 03:00 Athens. Models 13 and 28 rotate weekly and retain their own carried window and `as_of`; 30/33 are carried on discovery days. Models 26/29 have a ≤7-day window; never substitute the headline 28-day period ([rotation](../intelligence/dashboard-snapshots.md#i-06c3--editorial-discovery-weekly-rotation), [operations](../intelligence/operations.md#clocks-schedules-and-thresholds)).
- Evidence for model output values is the owner-reported **19–22 October** Console record. Later pipeline logs prove runs and shapes, not values or complete production validation ([evidence](../intelligence/data-quality.md#production-evidence)).

## Evidence register

Dates below are execution or record dates, not claims of a
new audience observation. Figures
are copied from the linked records and owner results are
explicitly identified.

| Date | Source | What it shows | Status and boundary |
| --- | --- | --- | --- |
| 2026-10-26 | [Owner Console results](../intelligence/bigquery-validation.md#owner-reported-results-bigquery-console-2026-10-19--22-as_of_day--2026-10-26) | Owner reports all 20 models for 19–22 Oct, `as_of_day=2026-10-26`: 40 article page-view events, 6 article engagement events, 7 discovery clicks; site 84 page-view, 32 `session_start`, 6 `first_visit` events. | `OBSERVED_PRODUCTION`, owner-reported; `PRODUCTION_EXECUTED`, not `PRODUCTION_VALIDATED`. Counts are events, not readers or sessions. |
| 2026-10-26 | [Owner RUM results](../intelligence/bigquery-validation.md#i-05-3033) | Owner reports delayed-existing LCP p75 964 ms (n = 26), INP p75 68 ms (n = 7), CLS p75 0 (n = 32), 19–22 Oct. | `OBSERVED_PRODUCTION`, owner-reported; LCP and INP below 30; delayed observations are not full-navigation CWV. |
| 2026-10-26 | [Owner reconciliations](../intelligence/bigquery-validation.md#reconciliations-passed-as-reported-by-the-owner) | Selected article, audience and RUM checks passed as reported for the same four days. | Recorded PASS for those checks only; no full model validation. |
| 2026-10-27 | [Production evidence](../intelligence/data-quality.md#production-evidence), run `40489852956` | Models 11, 20, 30, 33 executed for 19–23 Oct, `as_of` 27 Oct. | `PRODUCTION_EXECUTED`; logs do not expose or validate metric values. |
| 2026-10-28 | [Production evidence](../intelligence/data-quality.md#production-evidence), run `40643859550` | Scheduled run correctly skipped an already published `as_of` 27 Oct. | Operational deduplication evidence; not a new data cohort or correctness check. |
| 2026-10-29 | [Production evidence](../intelligence/data-quality.md#production-evidence), run `40830298650` | Models 10, 11, 13, 20, 26, 28, 29 executed for 19–24 Oct with `as_of` 28 Oct; 30/33 carried from 27 Oct. | `PRODUCTION_EXECUTED`; values, link-field coverage and display of carry labels remain unverified. |
| 2026-10-29 | [Closeout evidence matrix](../intelligence/i06c4-closeout.md#evidence-matrix) | The recorded public header states 19–24 Oct and `asOf` 28 Oct. | Header inspection was not authentication; this A-01 did not inspect it and it is not evidence of metric values. |
| 2026-10-29 | [Closeout evidence matrix](../intelligence/i06c4-closeout.md#evidence-matrix) | Offline validator tests passed on synthetic data. | Static test only; production snapshot reconciliation remains `NOT_VERIFIED`. |

The [Intelligence README](../intelligence/README.md)
records all 20 models as
`PRODUCTION_EXECUTED` and none `PRODUCTION_VALIDATED`.
Model-specific production validation and
all external checks must be assessed independently; a
green workflow is not validation.

## Per-KPI baseline

In the table, **O4** means the owner-reported 19–22
October range (four eligible calendar days,
not a guarantee of complete events); **P6** means pipeline
execution logs for 19–24 October,
six calendar days, without published metric values; **R5**
means pipeline execution of the RUM
pair for 19–23 October, five days, without published
values. “Unknown” missing days means the
record does not establish export completeness or the
outcome after its stated range. The values
and scopes are documented in the [evidence
register](#evidence-register); **30** is the
existing event/observation sample flag, not a guarantee of
accuracy ([quality
contract](../intelligence/data-quality.md#quality-contract)).

For every row, the first potential 28-day GA4 cohort is
eligible no earlier than
**2026-11-19**, but this does not create a missing feature
or guarantee a measured baseline.
The “28-day?” column means “possible from evidence
available on the investigation date.” Exact
owner follow-up remains aggregate-only.

| KPI | Earliest supported date | Available mature range and eligible days | Missing days | Validation status | Sample implication | 28-day? | Exact evidence needed later |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 Returning readership | Unknown | None; 0 supported KPI days | Unknown; entire KPI unverified | `NOT_VERIFIED` | No observed denominator | No; 19 Nov eligibility only | Owner verifies aggregate GA4 returning-user definition, reporting identity, article scope, filters, thresholding and compatible denominator. |
| 2 Engaged sessions / article threshold | 2026-10-19 for threshold | O4; 4 for 12/27; no engaged-session report | Unknown beyond O4; engaged-session source unverified | 12/27 executed; KPI proxy only | Owner reported 6 threshold events; small sample | No; 19 Nov | Owner validates model 12; separately verifies GA4 engaged-session aggregate and definition. |
| 3 Article discovery | 2026-10-19 | O4 values; P6 execution, 6 | Unknown beyond P6; completeness unknown | 13/28 executed; proxy only | Owner reported 7 article clicks; small sample | No; 19 Nov | Validate 13/28 same carried bounds and link-field coverage; report click intent. |
| 4 Curated collections | 2026-10-19 for hub click model | O4 execution; P6 execution, 6; no hub-specific value reported | Unknown beyond P6; individual hub coverage unknown | 13/28 executed; proxy only | Hub-specific n not reported | No; 19 Nov | Owner validates entity-hub source clicks and coverage; separately establish any collection denominator. |
| 5 Reading paths | Unknown | No path KPI; 0 | Unknown; path semantics absent | `NOT_MEASURABLE` | No path count | No; 19 Nov cannot create source | Define path and privacy-respecting aggregate progression evidence. |
| 6 Race-weekend behaviour | 2026-10-19 for daily activity | O4 values; P6 execution, 6; no race-specific baseline | Unknown beyond P6; race attribution missing | 20 executed; proxy only | Race-window n not reported | No; 19 Nov | Select documented registry window, convert to LA days, verify model 20 counts and completeness. |
| 7 Newsletter subscriptions | Unknown | No subscription source; 0 | Unknown; source absent | `NOT_MEASURABLE` | No subscription count | No; 19 Nov cannot create source | Establish aggregate subscription requests and state rules independently of analytics consent. |
| 8 Confirmed opt-ins | Unknown | No confirmation source; 0 | Unknown; source absent | `NOT_MEASURABLE` | No confirmation count | No; 19 Nov cannot create source | Establish aggregate confirmed states and compatible request cohort. |
| 9 Unsubscribes and clicks | Unknown | No newsletter source; 0 | Unknown; source absent | `NOT_MEASURABLE` | No count | No; 19 Nov cannot create source | Establish aggregate unsubscribe transitions and email-click units and bot limitations. |
| 10 Newsletter-origin visits | 2026-10-19 for email-class events | O4 model execution; P6 model 26 execution, 6; no email count reported | Unknown beyond P6; attributed email count unknown | 24–26 executed; attribution proxy | Email-class n not reported | No; 19 Nov; 26 snapshot remains ≤7 days | Validate email-class event counts, scope, gaps and owned-campaign interpretation separately. |
| 11 Reading-list save/open | Unknown | No list source; 0 | Unknown; source absent | `NOT_MEASURABLE` | No action count | No; 19 Nov cannot create source | Define and verify aggregate save/open events and eligible exposures. |
| 12 Saved-article revisits | Unknown | No revisit source; 0 | Unknown; saved-state context absent | `NOT_MEASURABLE` | No revisit count | No; 19 Nov cannot create source | Verify a privacy-preserving aggregate method with a defined eligible saved cohort. |
| 13 Reader participation | Unknown | No owner aggregate reported; 0 | Unknown; acceptance and date coverage unverified | Mechanism `VERIFIED_CODE`; count `NOT_VERIFIED` | No count or exposure denominator | No; 19 Nov does not verify provider | Owner verifies aggregate accepted submissions, period, dedupe and timezone; exclude messages and identities. |
| 14 Article to Race Desk | 2026-10-19 for classified clicks | O4 execution; P6 execution, 6; no Race Desk count reported | Unknown beyond P6; hub class and child use absent | 28 executed; click proxy | Destination-specific n not reported | No; 19 Nov | Validate article-source tool-click classes and coverage; establish hub/tool use separately. |
| 15 Web Vitals guardrails | 2026-10-19 | O4 values; R5 execution, 5 | Unknown beyond R5; completeness and coverage unknown | 30–33 executed; delayed proxy | LCP n=26 and INP n=7 below 30; CLS n=32 | No; 19 Nov | Owner validates 30/33 and full 28-day reference comparison with matching cohort, coverage and grain. |


### Interpretation of missing evidence

1. O4 is the only recorded owner-reported value range, even when a later run shows that a model executed.
2. P6 and R5 do not mean all event fields were populated or that their aggregates reconciled.
3. No 28-day returning-user, newsletter, list, participation or child-tool baseline follows merely from a mature GA4 export.
4. A missing row, table, metric or observation must not be turned into a zero-reader day.
5. Report consent bias, host, unit, time zone, source period, and the model’s own carry dates beside any later figure.

## Future validation procedure

The owner can follow the existing [ordered I-06C4
checklist](../intelligence/i06c4-closeout.md#ordered-owner-checklist)
and [BigQuery validation
owner
requirements](../intelligence/bigquery-validation.md#required-from-the-owner).
This
document adds no SQL and A-01 runs no live query.

1. Verify the property/stream association privately, table completeness and exact extraction parameters. Record only sanitized outcomes in public evidence.
2. Use the existing owner-local validation procedure, checking applicable outcomes rather than relying on exit code alone. Review missing pairs, warnings, `NOT_VERIFIED` external checks, per-model windows, populations and carry dates ([local validation](../intelligence/i06c4-closeout.md#owner-local-validation)).
3. Complete the previously requested 19–25 October model checks with the recorded parameters and reconcile compatible units and populations. A nine-model snapshot cannot validate all 20 models ([closeout matrix](../intelligence/i06c4-closeout.md#evidence-matrix)).
4. On or after 19 November, if the tables exist and are mature, follow the existing [RUM reference comparison](../intelligence/i06c4-closeout.md#rum-reference-comparison) for the 19 October–15 November cohort. Match cohort, coverage, host/consent conditions, scan bounds and grain; distinguish count from p75 agreement.
5. Privately inspect any proposed aggregate GA4 returning-user report for definition, reporting identity, article scope, filters, thresholding and compatible denominator. Record whether verification succeeded without publishing private values or identifiers.
6. For non-GA4 sources, verify independently the aggregate source, reporting period, timezone, state definitions, duplicate treatment and coverage. Newsletter consent is independent of analytics consent.
7. Publish only a sanitized evidence status and approved aggregate summary. Do not share visitor-level extracts, pseudonymous IDs, form content, credentials or snapshot payloads ([data minimization](../intelligence/metrics-contract.md#data-minimization)).

## Measurement gaps

- Returning article readership and GA4 engaged-session reporting are not verified; event subtraction cannot fill the gap.
- Path progress, individual collection exposure, list actions and saved-article revisits lack suitable existing denominators or sources.
- No newsletter subscription, confirmation, unsubscribe or newsletter-click source is established; email attribution does not prove an owned campaign.
- Form acceptance aggregates and automatic form measurement settings are not verified; submission is not proof of a conversation.
- Race-specific behaviour, GP-hub navigation classification and standalone tool usage are not established by current grouped models.
- All GA4 measures exclude non-consenting activity; late/partial export completeness, stream association and parameter checks remain open.
- RUM begins after delayed collection, omits some surfaces, and LCP/INP reported samples are below the phase-1 floor. No model is production validated.
- Sampling, attribution gaps and weekly carried discovery windows must remain visible in any later report; a healthy pipeline is not analytical correctness.
