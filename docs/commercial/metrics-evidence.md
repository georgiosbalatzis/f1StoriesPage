# Metrics evidence and claims

## Scope, provenance and present evidence state

Repository evidence is cited as `path:line` at reviewed SHA `58273df6d753510605468c0787d9cdf04d6d398e`. Source code describes capability; a deployment pin does not prove served bytes, GA4 property settings, receipt or export completeness. Recorded execution is an owner-reported historical result: all 20 numbered models are `PRODUCTION_EXECUTED`, none `PRODUCTION_VALIDATED` (`docs/intelligence/bigquery-validation.md:19`, `docs/intelligence/bigquery-validation.md:23`, `docs/intelligence/bigquery-validation.md:34`, `docs/intelligence/bigquery-validation.md:35`). No owner-local validation result is supplied: `PENDING_OWNER_VALIDATION`. Internal exploration can be useful with limitations; neither execution nor an internal check approves an external statement (`docs/commercial/pricing-methodology.md:43`).

Analytics depends on affirmative analytics consent; custom sends recheck stored consent. Runtime has no production-host allowlist, but analytical bases select consent-granted events with a primary HTTPS Main path (`scripts/analytics.js:274`, `scripts/analytics.js:301`; `docs/intelligence/sql/models/base.sql:33`, `docs/intelligence/sql/models/base.sql:55`; `docs/intelligence/sql/models/audience-base.sql:23`, `docs/intelligence/sql/models/audience-base.sql:53`; `docs/intelligence/sql/models/rum-base.sql:49`). Consenters are not the whole audience. Main events do not establish use of separate tool documents, even when a Main link points there (`docs/intelligence/README.md:61`; `docs/audience/measurement-contract.md:238`).

## Collection and processing map

Emission is a source capability, not proof of delivery. “Reported” below means an owner-reported historical aggregate contained that family, not complete export or validated current output (`docs/intelligence/bigquery-validation.md:23`, `docs/intelligence/bigquery-validation.md:56`). “Not evidenced” means no event-specific export proof located, not zero. Models are potential outputs on their own eligible population and window, not proof of every field or event. All rows inherit the consent and host gates above; RUM additionally applies its version and observation rules. Automatic events and enhanced measurement depend on unverified GA4 property settings; source configuration does not prove automatic emission or parameter availability (`docs/intelligence/event-inventory.md:24`; `scripts/analytics.js:292`).

| Event family | Emitter and export evidence | Model coverage and limits |
|---|---|---|
| `page_view` | GA4 config; reported (`scripts/analytics.js:292`; `docs/intelligence/bigquery-validation.md:77`). | Editorial 10 and audience 20/26; events, not people; lost or late tag loads are omitted (`docs/intelligence/sql/models/10-article-pageviews.sql:1`; `docs/intelligence/sql/models/20-daily-activity.sql:1`). |
| `article_engaged` | Article threshold emitter; reported (`scripts/analytics.js:236`; `docs/intelligence/bigquery-validation.md:67`). | 12 and 27; once per document after 30 visible consented seconds and 50% scroll, thresholds rather than exact duration/depth (`docs/intelligence/sql/models/12-article-engagement.sql:1`). |
| `internal_page_click` | Main click listener; reported (`scripts/analytics.js:147`; `docs/intelligence/bigquery-validation.md:68`). | Editorial base and 28; eligible same-origin click intent, not destination load; modified and other excluded clicks absent (`scripts/analytics.js:211`; `docs/intelligence/sql/models/28-internal-navigation.sql:1`). |
| `outbound_click` | Main click listener; event-specific export not evidenced (`scripts/analytics.js:176`). | 27 aggregates event and sponsored flag, not destination or sponsor; no visit receipt (`docs/intelligence/sql/models/27-engagement-events.sql:5`). |
| `article_share` | Social click and copy/native actions; copy-link reported, other methods not established (`scripts/analytics.js:203`; `blog-module/blog-fixes.js:39`; `docs/intelligence/bigquery-validation.md:84`). | 27 groups actions by method; no proof of completed sharing or reach (`docs/intelligence/sql/models/27-engagement-events.sql:4`). |
| `journal_search` | Journal search; event-specific export not evidenced (`blog-module/blog-index.js:398`). | 27 counts nonempty search pauses after 900 ms; repeated pauses can emit repeatedly, not unique searches (`docs/intelligence/sql/models/27-engagement-events.sql:6`). |
| `web_vital` | Consented collector; official snapshots reported (`scripts/perf/web-vitals-collector.js:40`; `docs/intelligence/bigquery-validation.md:99`). | 30–33; delayed, partial coverage and latest-revision observations; not complete population or visitors (`docs/intelligence/sql/models/rum-base.sql:49`; `docs/intelligence/sql/models/rum-base.sql:63`). |
| `js_error` | Error beacon; event-specific export not evidenced (`scripts/perf/error-beacon.js:45`). | Not in the editorial, audience or RUM bases; first error per tab then 10% sampling, not a complete error rate (`scripts/perf/error-beacon.js:50`; `docs/intelligence/sql/models/audience-base.sql:50`). |
| `session_start` | GA4 automatic after config; reported (`scripts/analytics.js:292`; `docs/intelligence/bigquery-validation.md:78`). | 20/26 count events, not exact sessions (`docs/intelligence/sql/models/20-daily-activity.sql:1`). |
| `first_visit` | GA4 automatic after config; reported (`scripts/analytics.js:292`; `docs/intelligence/bigquery-validation.md:79`). | 20 counts events, not unique or first-ever people (`docs/intelligence/sql/models/20-daily-activity.sql:1`). |
| `user_engagement` | GA4 automatic after config; reported (`scripts/analytics.js:292`; `docs/intelligence/bigquery-validation.md:83`). | 27 counts GA4 engagement events, not article engagement or reading time (`docs/intelligence/audience-model.md:109`). |

## Claims matrix

All campaign-specific results are currently `UNSUPPORTED FOR EXTERNAL CLAIM`. Field 9 separates execution, analytical evidence and sponsor reporting; lifecycle terms apply only to numbered SQL models, not manual facts. The B-06 references name the ranked, owner-defined gaps in [the handoff](b06-measurement-handoff.md); no work or policy adoption is implied. Required evidence is claim-specific and includes the applicable approval and privacy/rights gates.

### C01 — Article publication count

| Field | Value |
|---|---|
| 1. Metric/claim | Article publication count |
| 2. Business use | S2 publication closeout |
| 3. Exact source | Approved article register and dated deployed canonical URLs; proposed S2 scope: `docs/commercial/packages.md:31` |
| 4. Population | Approved new S2 articles only |
| 5. Unit | Distinct canonical articles |
| 6. Time window | Approved four-week production interval and actual publication dates; boundaries/time zone pending |
| 7. Consent limitation | No reader consent required for manual publication observation |
| 8. Attribution limitation | Publication must be linked to agreed scope; aliases are not additional articles |
| 9. Validation status (execution; analytical; sponsor reporting; lifecycle where applicable) | not executed (no campaign record); not checked; not measured; NOT MEASURED |
| 10. Supported interpretation | A dated observation can establish publication |
| 11. Unsupported interpretation | Audience, impressions or effectiveness |
| 12. Required evidence before external publication | Approved scope, dated deployment observations, canonical identity and owner/editor approval |
| 13. Relevant B-06 dependency | 1 — manual fulfilment record |
| 14. Approval owner | Publisher owner and editorial lead |

### C02 — Article delivery commitments

| Field | Value |
|---|---|
| 1. Metric/claim | Article delivery commitments |
| 2. Business use | S2 obligation closeout |
| 3. Exact source | Approved duties, editorial approvals, disclosure and dated publication records; `docs/commercial/packages.md:31`; `docs/commercial/pricing-methodology.md:60` |
| 4. Population | Only agreed S2 deliverables |
| 5. Unit | Duty marked met, unmet or unverified |
| 6. Time window | Agreed production window and actual dates |
| 7. Consent limitation | Manual records need no visitor analytics |
| 8. Attribution limitation | Publication alone does not establish every duty |
| 9. Validation status (execution; analytical; sponsor reporting; lifecycle where applicable) | not executed (no campaign record); not checked; not measured; NOT MEASURED |
| 10. Supported interpretation | Reconcile each agreed duty against dated evidence |
| 11. Unsupported interpretation | Automatic fulfilment, reader impact or guaranteed outcomes |
| 12. Required evidence before external publication | Approved duties, separate commercial/editorial approvals, disclosure and exceptions, closeout |
| 13. Relevant B-06 dependency | 1 — manual fulfilment record |
| 14. Approval owner | Publisher owner and editorial lead |

### C03 — Placement start/end fulfilment

| Field | Value |
|---|---|
| 1. Metric/claim | Placement start/end fulfilment |
| 2. Business use | S1 term closeout |
| 3. Exact source | Approved private P-label release and dated built/deployed start and removal observations; `docs/commercial/packages.md:41`; `docs/commercial/inventory.md:33` |
| 4. Population | One approved homepage listing on / and /index.html |
| 5. Unit | Observed endpoint and duty status |
| 6. Time window | Agreed 28 calendar days, exact endpoints and time zone |
| 7. Consent limitation | Manual checks need no visitor analytics |
| 8. Attribution limitation | Endpoint observations cannot prove continuous display |
| 9. Validation status (execution; analytical; sponsor reporting; lifecycle where applicable) | not executed (no campaign record); not checked; not measured; NOT MEASURED |
| 10. Supported interpretation | Record observed installation/removal and exceptions |
| 11. Unsupported interpretation | Uninterrupted exposure or impressions |
| 12. Required evidence before external publication | Release, scope/isolation, deployed endpoint checks, exceptions and closeout |
| 13. Relevant B-06 dependency | 3 — S1 release and isolation |
| 14. Approval owner | Publisher owner and operations lead |

### C04 — Consented article pageviews

| Field | Value |
|---|---|
| 1. Metric/claim | Consented article pageviews |
| 2. Business use | Editorial article performance context |
| 3. Exact source | Model 10 and editorial base: `docs/intelligence/sql/models/10-article-pageviews.sql:1`; `docs/intelligence/sql/models/base.sql:33` |
| 4. Population | Consenting eligible Main article events with mapped canonical identity |
| 5. Unit | Page-view events |
| 6. Time window | Exact mature model window, as-of and property time zone |
| 7. Consent limitation | Excludes non-consent, blocked or lost collection |
| 8. Attribution limitation | Article mapping, aliases and campaign scope must be checked; not sponsor exposure |
| 9. Validation status (execution; analytical; sponsor reporting; lifecycle where applicable) | production executed; not checked for proposed window; validation pending; NOT VALIDATED; model 10 PRODUCTION_EXECUTED, not PRODUCTION_VALIDATED |
| 10. Supported interpretation | Limited eligible page-view event count after checks |
| 11. Unsupported interpretation | Readers, total audience or sponsor impressions |
| 12. Required evidence before external publication | Relevant model/window, mapping, coverage and reconciliation; suppression and explicit approval |
| 13. Relevant B-06 dependency | 4 — existing-data validation |
| 14. Approval owner | Publisher owner and analytics reviewer |

### C05 — Consented article engagement

| Field | Value |
|---|---|
| 1. Metric/claim | Consented article engagement |
| 2. Business use | Editorial threshold-event context |
| 3. Exact source | Model 12: `docs/intelligence/sql/models/12-article-engagement.sql:1` |
| 4. Population | Eligible consented Main article events |
| 5. Unit | Engaged events per page-view event, unmatched |
| 6. Time window | Same mature model window and as-of for both counts |
| 7. Consent limitation | Excludes non-consent and missing events |
| 8. Attribution limitation | No event-to-view matching or sponsor attribution |
| 9. Validation status (execution; analytical; sponsor reporting; lifecycle where applicable) | production executed; not checked for proposed window; validation pending; NOT VALIDATED; model 12 PRODUCTION_EXECUTED, not PRODUCTION_VALIDATED |
| 10. Supported interpretation | Threshold-event proxy; can exceed one and is NULL without page views |
| 11. Unsupported interpretation | Reader, document, completion or sponsor engagement rate |
| 12. Required evidence before external publication | Separately authorized model 12 extraction, denominator/sample checks and approved wording |
| 13. Relevant B-06 dependency | 4 — existing-data validation |
| 14. Approval owner | Publisher owner and analytics reviewer |

### C06 — Consented outbound click intents

| Field | Value |
|---|---|
| 1. Metric/claim | Consented outbound click intents |
| 2. Business use | Internal navigation interest |
| 3. Exact source | Emitter and model 27: `scripts/analytics.js:176`; `docs/intelligence/sql/models/27-engagement-events.sql:9` |
| 4. Population | Eligible consented Main outbound events |
| 5. Unit | Click-intent events |
| 6. Time window | Exact mature model window and as-of |
| 7. Consent limitation | Non-consent, blocked, modified and failed sends omitted |
| 8. Attribution limitation | 27 groups event and sponsored flag only; no destination report |
| 9. Validation status (execution; analytical; sponsor reporting; lifecycle where applicable) | production executed; not checked for this event/window; validation pending; NOT VALIDATED; model 27 PRODUCTION_EXECUTED, not PRODUCTION_VALIDATED |
| 10. Supported interpretation | Eligible click intents if event and coverage are validated |
| 11. Unsupported interpretation | Unique-visitor floor, destination visits or conversions |
| 12. Required evidence before external publication | Event export and relevant fields validated, exact scope/window and approved aggregate |
| 13. Relevant B-06 dependency | 4 — existing-data validation |
| 14. Approval owner | Publisher owner and analytics reviewer |

### C07 — Sponsor-specific clicks

| Field | Value |
|---|---|
| 1. Metric/claim | Sponsor-specific clicks |
| 2. Business use | Optional S1 reporting |
| 3. Exact source | Outbound emitter plus private effective-dated listing/destination mapping; `scripts/analytics.js:189`; `docs/intelligence/sql/models/27-engagement-events.sql:9` |
| 4. Population | Only eligible consented clicks unambiguously mapped to agreed listing |
| 5. Unit | Click-intent events |
| 6. Time window | Exact approved term, endpoints and time zone |
| 7. Consent limitation | Only observed consenting Main actions |
| 8. Attribution limitation | Domain/role are fragile; model 27 has no sponsor or destination grouping; no historical reassignment |
| 9. Validation status (execution; analytical; sponsor reporting; lifecycle where applicable) | production executed for model 27 only; not checked for sponsor; not measured; NOT MEASURED; model 27 PRODUCTION_EXECUTED, not PRODUCTION_VALIDATED |
| 10. Supported interpretation | A future validated narrow mapped aggregate may describe intent |
| 11. Unsupported interpretation | Sponsor visits, people, outcomes or a present campaign result |
| 12. Required evidence before external publication | Owner chooses obligation; validated mapping, collision/occupant handling, term-aligned extraction and approval |
| 13. Relevant B-06 dependency | 5 — conditional S1 click attribution |
| 14. Approval owner | Publisher owner, analytics and privacy reviewers |

### C08 — Sponsor impressions

| Field | Value |
|---|---|
| 1. Metric/claim | Sponsor impressions |
| 2. Business use | Exposure reporting |
| 3. Exact source | No validated sponsor exposure source; `docs/commercial/inventory.md:24` |
| 4. Population | No measured campaign exposure population |
| 5. Unit | Impression, undefined and unmeasured |
| 6. Time window | No approved measurement window |
| 7. Consent limitation | Consent and coverage would need definition |
| 8. Attribution limitation | Pageviews and installed days cannot identify exposure |
| 9. Validation status (execution; analytical; sponsor reporting; lifecycle where applicable) | not executed; not checked; not measured; NOT MEASURED |
| 10. Supported interpretation | No exposure result is established |
| 11. Unsupported interpretation | Pageviews or placement endpoints as impressions |
| 12. Required evidence before external publication | A separately justified, privacy-reviewed exposure definition and validated source before any claim |
| 13. Relevant B-06 dependency | None; return only if an exposure claim is separately justified and approved |
| 14. Approval owner | Publisher owner and privacy/analytics reviewers |

### C09 — Total audience reach

| Field | Value |
|---|---|
| 1. Metric/claim | Total audience reach |
| 2. Business use | Overall audience description |
| 3. Exact source | No complete audience source; `docs/intelligence/event-inventory.md:5` |
| 4. Population | All intended audience, including unobserved visitors |
| 5. Unit | People reached, undefined and unmeasured |
| 6. Time window | No approved measurement window |
| 7. Consent limitation | Non-consent and blocking create unknown coverage |
| 8. Attribution limitation | Events cannot be deduplicated into total reach |
| 9. Validation status (execution; analytical; sponsor reporting; lifecycle where applicable) | not executed; not checked; not measured; NOT MEASURED |
| 10. Supported interpretation | Consented event scope can be described |
| 11. Unsupported interpretation | All-audience reach inferred from events |
| 12. Required evidence before external publication | Independent defined coverage and deduplication evidence, uncertainty and review |
| 13. Relevant B-06 dependency | None; return only with a separately justified source and approved definition |
| 14. Approval owner | Publisher owner and privacy/analytics reviewers |

### C10 — Unique users

| Field | Value |
|---|---|
| 1. Metric/claim | Unique users |
| 2. Business use | Audience size |
| 3. Exact source | No validated unique-person source; `docs/intelligence/audience-model.md:55` |
| 4. Population | No measured unique-person population |
| 5. Unit | Distinct people |
| 6. Time window | No approved measurement window |
| 7. Consent limitation | Consented browsers exclude an unknown population |
| 8. Attribution limitation | First-visit events and cookies do not identify unique people |
| 9. Validation status (execution; analytical; sponsor reporting; lifecycle where applicable) | not executed; not checked; not measured; NOT MEASURED |
| 10. Supported interpretation | First-visit events retain their event meaning |
| 11. Unsupported interpretation | Events or browsers as unique people |
| 12. Required evidence before external publication | Permitted independent definition, deduplication and validated aggregate evidence |
| 13. Relevant B-06 dependency | None; return only with a justified privacy-reviewed measure |
| 14. Approval owner | Publisher owner and privacy/analytics reviewers |

### C11 — Cross-tool audience

| Field | Value |
|---|---|
| 1. Metric/claim | Cross-tool audience |
| 2. Business use | Combined audience |
| 3. Exact source | Main entry clicks only; `docs/intelligence/README.md:61`; `docs/intelligence/event-inventory.md:100` |
| 4. Population | Main consenters and separate tool populations are not joined |
| 5. Unit | Distinct people across applications |
| 6. Time window | No approved combined window |
| 7. Consent limitation | Tools have separate coverage and consent boundaries |
| 8. Attribution limitation | Main click does not prove tool load; overlapping populations cannot be summed |
| 9. Validation status (execution; analytical; sponsor reporting; lifecycle where applicable) | not executed; not checked; not measured; NOT MEASURED |
| 10. Supported interpretation | Main-to-tool click intent may be described in its own scope |
| 11. Unsupported interpretation | Combined audience or tool sessions from Main clicks |
| 12. Required evidence before external publication | Separately authorized aggregate sources, definitions, overlap and privacy review |
| 13. Relevant B-06 dependency | None; return only if a combined claim is separately justified |
| 14. Approval owner | Publisher owner and privacy/analytics reviewers |

### C12 — Sponsor referrals

| Field | Value |
|---|---|
| 1. Metric/claim | Sponsor referrals |
| 2. Business use | Destination arrival or inbound referral context |
| 3. Exact source | No validated sponsor-specific arrival source; `docs/commercial/pricing-methodology.md:47` |
| 4. Population | Defined destination or inbound population, currently unknown |
| 5. Unit | Verified arrivals under a defined source rule |
| 6. Time window | No approved measurement window |
| 7. Consent limitation | Separate destination consent and coverage apply |
| 8. Attribution limitation | Outbound intent does not establish arrival; inbound acquisition scopes differ |
| 9. Validation status (execution; analytical; sponsor reporting; lifecycle where applicable) | not executed; not checked; not measured; NOT MEASURED |
| 10. Supported interpretation | A click intent is an intent only |
| 11. Unsupported interpretation | Sponsor referrals or verified arrivals from clicks |
| 12. Required evidence before external publication | Permitted destination-side aggregate or validated inbound source, attribution rule and approval |
| 13. Relevant B-06 dependency | None; return only with a separately justified permitted arrival source |
| 14. Approval owner | Publisher owner and destination data owner |

### C13 — External conversions

| Field | Value |
|---|---|
| 1. Metric/claim | External conversions |
| 2. Business use | Outcome reporting |
| 3. Exact source | No validated destination conversion source; `docs/commercial/pricing-methodology.md:47` |
| 4. Population | Defined destination action population, currently unknown |
| 5. Unit | Completed defined actions |
| 6. Time window | No approved measurement window |
| 7. Consent limitation | Destination consent and permission apply separately |
| 8. Attribution limitation | Click intent cannot establish action or causality |
| 9. Validation status (execution; analytical; sponsor reporting; lifecycle where applicable) | not executed; not checked; not measured; NOT MEASURED |
| 10. Supported interpretation | No conversion result is established |
| 11. Unsupported interpretation | Clicks or visits as conversions |
| 12. Required evidence before external publication | Permitted destination-side aggregate, defined action, attribution and quality review |
| 13. Relevant B-06 dependency | None; return only with separately justified destination evidence |
| 14. Approval owner | Publisher owner and destination data owner |

### C14 — Advertiser revenue

| Field | Value |
|---|---|
| 1. Metric/claim | Advertiser revenue |
| 2. Business use | Financial reporting |
| 3. Exact source | No advertiser financial records supplied; publisher costing is separate: `docs/commercial/pricing-methodology.md:3` |
| 4. Population | Advertiser transactions under an agreed definition, unknown |
| 5. Unit | Currency amount under defined accounting basis |
| 6. Time window | No approved financial period |
| 7. Consent limitation | Financial data permissions and privacy apply |
| 8. Attribution limitation | Publisher fee and clicks do not establish advertiser revenue |
| 9. Validation status (execution; analytical; sponsor reporting; lifecycle where applicable) | not executed; not checked; not measured; NOT MEASURED |
| 10. Supported interpretation | No advertiser revenue result is established |
| 11. Unsupported interpretation | Publisher price, clicks or attributed sales as incremental revenue |
| 12. Required evidence before external publication | Permitted reconciled advertiser finance evidence and defined accounting/attribution basis |
| 13. Relevant B-06 dependency | None; return only with separately authorized financial evidence |
| 14. Approval owner | Advertiser finance owner and publisher owner |

### C15 — Return on investment

| Field | Value |
|---|---|
| 1. Metric/claim | Return on investment |
| 2. Business use | Effectiveness assessment |
| 3. Exact source | No validated incremental benefit, counterfactual or full campaign cost; `docs/commercial/pricing-methodology.md:23` |
| 4. Population | Defined campaign and comparison population, unknown |
| 5. Unit | Return relative to defined investment |
| 6. Time window | No approved analysis period |
| 7. Consent limitation | Privacy and permission apply to all inputs |
| 8. Attribution limitation | Attribution or correlation does not establish incremental effect |
| 9. Validation status (execution; analytical; sponsor reporting; lifecycle where applicable) | not executed; not checked; not measured; NOT MEASURED |
| 10. Supported interpretation | No ROI result is established |
| 11. Unsupported interpretation | Clicks, pageviews or publisher margin as ROI |
| 12. Required evidence before external publication | Permitted finance inputs, credible counterfactual, uncertainty and qualified review |
| 13. Relevant B-06 dependency | None; return only if a causal and financial assessment is separately justified |
| 14. Approval owner | Publisher owner, advertiser finance and qualified analytics reviewer |

### C16 — Real-user performance metrics

| Field | Value |
|---|---|
| 1. Metric/claim | Real-user performance metrics |
| 2. Business use | Technical quality context |
| 3. Exact source | Models 30/33 and RUM base: `docs/intelligence/performance-model.md:22`; `docs/intelligence/sql/models/rum-base.sql:63` |
| 4. Population | Eligible consented Main observations by metric and coverage class |
| 5. Unit | Metric-specific observations and p75 in native units |
| 6. Time window | Exact mature navigation cohort and as-of; first full 28-day reference eligible 2026-11-19 |
| 7. Consent limitation | Delayed consent, browser support and missing callbacks bias coverage |
| 8. Attribution limitation | Observations are not people; no sponsor causality |
| 9. Validation status (execution; analytical; sponsor reporting; lifecycle where applicable) | production executed; not checked for proposed window; validation pending; NOT VALIDATED; models 30/33 PRODUCTION_EXECUTED, not PRODUCTION_VALIDATED |
| 10. Supported interpretation | Validated, sufficiently sampled technical distribution with coverage stated |
| 11. Unsupported interpretation | All-user performance, sponsor impact or missing INP as zero |
| 12. Required evidence before external publication | Owner-local checks, mature matching-grain reference, adequate samples and technical approval |
| 13. Relevant B-06 dependency | 4 — existing-data validation (RUM Stage D is independent of fulfilment) |
| 14. Approval owner | Publisher owner and performance/analytics reviewer |

## Summary

| ID | Claim | Evidence state | External state |
|---|---|---|---|
| C01 | Article publication count | NOT MEASURED | UNSUPPORTED FOR EXTERNAL CLAIM |
| C02 | Article delivery commitments | NOT MEASURED | UNSUPPORTED FOR EXTERNAL CLAIM |
| C03 | Placement start/end fulfilment | NOT MEASURED | UNSUPPORTED FOR EXTERNAL CLAIM |
| C04 | Consented article pageviews | NOT VALIDATED | UNSUPPORTED FOR EXTERNAL CLAIM |
| C05 | Consented article engagement | NOT VALIDATED | UNSUPPORTED FOR EXTERNAL CLAIM |
| C06 | Consented outbound click intents | NOT VALIDATED | UNSUPPORTED FOR EXTERNAL CLAIM |
| C07 | Sponsor-specific clicks | NOT MEASURED | UNSUPPORTED FOR EXTERNAL CLAIM |
| C08 | Sponsor impressions | NOT MEASURED | UNSUPPORTED FOR EXTERNAL CLAIM |
| C09 | Total audience reach | NOT MEASURED | UNSUPPORTED FOR EXTERNAL CLAIM |
| C10 | Unique users | NOT MEASURED | UNSUPPORTED FOR EXTERNAL CLAIM |
| C11 | Cross-tool audience | NOT MEASURED | UNSUPPORTED FOR EXTERNAL CLAIM |
| C12 | Sponsor referrals | NOT MEASURED | UNSUPPORTED FOR EXTERNAL CLAIM |
| C13 | External conversions | NOT MEASURED | UNSUPPORTED FOR EXTERNAL CLAIM |
| C14 | Advertiser revenue | NOT MEASURED | UNSUPPORTED FOR EXTERNAL CLAIM |
| C15 | Return on investment | NOT MEASURED | UNSUPPORTED FOR EXTERNAL CLAIM |
| C16 | Real-user performance metrics | NOT VALIDATED | UNSUPPORTED FOR EXTERNAL CLAIM |

## Internal and external use boundaries

Treat page views, session starts, first visits, shares and clicks as the exact event units emitted or modeled. A share action is not distribution; a click is intent, not arrival; a threshold event is not a reader or completion. No distinct-visitor click floor follows from repeated unmatched events. Model 27's sponsored flag is based on parameter presence, while the emitter sets it for `rel=sponsored`; sponsor-strip role alone does not supply a verified payer identity (`docs/intelligence/sql/models/audience-base.sql:30`; `scripts/analytics.js:132`; `scripts/analytics.js:198`).

A mature, present table with no kept events can yield model-20 zero; absent or incomplete source evidence is not zero (`docs/intelligence/sql/models/20-daily-activity.sql:1`; `docs/intelligence/data-quality.md:139`). Missing models and inapplicable comparisons remain `NOT_VERIFIED`. Do not add overlapping rolling snapshots or compare different cohort, model, mapping, as-of or window definitions. Snapshot windows and carried models may differ (`scripts/intelligence/snapshot.mjs:81`; `scripts/intelligence/snapshot.mjs:262`).

Use the existing 30-event threshold for article ranking, group comparisons and the model-12 ratio, where the denominator is page-view events; 30 observations applies to RUM p75/group comparisons. Exact reconciliations may pass below these thresholds. Cells below 10 remain owner-only, including protection against complementary disclosure; counts from 10–29 need specific approval and limitations, and are not a license to quote a ratio or p75 (`docs/intelligence/editorial-model.md:103`; `docs/intelligence/audience-model.md:134`; `docs/intelligence/performance-model.md:123`).

The [validation contract](validation-contract.md) sets the proposed approval gate, owner-local evidence and unresolved policy decision. Use its [S2 report acceptance](validation-contract.md#s2-report-acceptance) and [S1 report acceptance](validation-contract.md#s1-report-acceptance) for claim-relevant manual and optional analytical evidence. A manually verified publication or placement endpoint does not require unrelated SQL lifecycle promotion and does not establish audience or effectiveness.
