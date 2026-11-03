# Audience readiness gates

Status: A-01 audit; base `58331f9fb`; investigation 2026-11-03 UTC. Roadmap numbering reconciled in A-02 (base `d8308bf0d`).
These are proposed review gates, not authorizations to build, deploy, collect data or choose a provider.
The [measurement contract](measurement-contract.md) owns KPI definitions and [evidence labels](measurement-contract.md#evidence-labels); Intelligence retains its own [statuses](../intelligence/bigquery-validation.md#statuses) and [validator outcomes](../intelligence/data-quality.md#outcomes-and-severities).

## Phase 4 roadmap

**Owner-approved order (recorded in A-02, 2026-11-03).** A-01 proposed a provisional A-02..A-09 mapping; it was never
the approved roadmap and is superseded. The feature gates below keep their A-01 content under the approved numbers.

| A-number | Feature | Gate | A-01 provisional number |
| --- | --- | --- | --- |
| A-01 | Audience Baseline & Measurement Contract | Completed ([README](README.md)) | A-01 |
| A-02 | Curated Collections Foundation | [A-02](#a-02--curated-collections-foundation) | A-03 |
| A-03 | Article Reading Journeys | [A-03](#a-03--article-reading-journeys) | A-04 |
| A-04 | Race Weekend Reader Gateway | [A-04](#a-04--race-weekend-reader-gateway) | A-05 |
| A-05 | Weekly Briefing Editorial Foundation | [A-05](#a-05--weekly-briefing-editorial-foundation) | none |
| A-06 | Newsletter Signup, Consent & Preferences | [A-06 and A-07](#a-06-and-a-07--newsletter) | A-07 (first half) |
| A-07 | Newsletter Delivery & Editorial Approval | [A-06 and A-07](#a-06-and-a-07--newsletter) | A-07 (second half) |
| A-08 | Reader Questions & Editorial Q&A | [A-08](#a-08--reader-questions--editorial-qa) | A-09 (community) |
| A-09 | Local Reading List Pilot | [A-09](#a-09--local-reading-list-pilot) | A-06 |

Not in the approved roadmap, gates kept for any later proposal:
[audience intelligence](#unscheduled--audience-intelligence) (A-01 provisional A-02) and
[notifications / push](#unscheduled--notifications--push) (A-01 provisional A-08).

## Global gates

These gates apply to every later A-0x, scaled to the proposed scope.

1. **Scope:** identify documentation-only versus runtime, data, third-party and deployment changes. A-01 itself is documentation only. A PR to main triggers [quality checks](../../.github/workflows/quality.yml); [deployment](../../.github/workflows/deploy-pages.yml) is separate.
2. **Measurement:** link each relevant KPI in the [contract](measurement-contract.md); document the existing source checked, unit, population, coverage and limitations. A new event, dimension or model is a recommendation only, justified by the gap and minimised before approval.
3. **Baseline:** identify an applicable mature window, time zone, source, status and missing coverage before comparisons. Export begins 2026-10-19 in `America/Los_Angeles`; the owner-reported aggregates cover 19–22 October only. [Validation record](../intelligence/bigquery-validation.md). Snapshot windows and maturity differ by model; use [snapshot data](../intelligence/dashboard-snapshots.md#data), not an assumed common window.
4. **Evidence:** all 20 Intelligence models are `PRODUCTION_EXECUTED`, none `PRODUCTION_VALIDATED` as recorded in [Intelligence README](../intelligence/README.md) and [production evidence](../intelligence/data-quality.md#production-evidence). Validate the specific source and grain before an impact claim. A successful synthetic test, model execution or healthy pipeline is not analytical validation.
5. **Privacy:** close applicable [review items](privacy-data-flow.md#future-feature-review-matrix), assign an owner, and satisfy [instrumentation restrictions](privacy-data-flow.md#restrictions-on-new-instrumentation). Analytics is consented-population data and can be biased by consent; absent evidence is not a zero.
6. **Reuse:** check existing [Intelligence contracts](../intelligence/README.md), [editorial review](../editorial-review.md), [entity hubs](../entity-hubs.md), and [Race Desk program](../race-desk-program.md) as applicable. Do not duplicate their model, publishing, identity or operations contracts.
7. **Decision:** record owner approval, accountable operations, failure and rollback/removal behaviour, and unresolved risks. A feature can be ready to ship with its measurement gap disclosed; it is not ready to claim an audience effect until relevant evidence is validated.

Unless a cited existing contract supplies a threshold for that particular measurement, **acceptance threshold: owner to set after baseline**. Do not treat a small-sample flag as proof of impact.
For existing RUM reports, `min_observations = 30` is a sample flag, not a general launch or significance threshold. [Validation record](../intelligence/bigquery-validation.md), [snapshot data](../intelligence/dashboard-snapshots.md#data).

## A-02 — Curated Collections Foundation

**Feature:** organize approved public articles using existing discovery and hub infrastructure.

**Status:** foundation merged (#431); contract and approval procedure in [collections.md](collections.md). No collection is approved.

**Depends on:** A-01; [entity hubs](../entity-hubs.md), [editorial review](../editorial-review.md), [editorial model](../intelligence/editorial-model.md).

**KPIs:** [KPI 3 Article-to-article discovery; KPI 4 Curated collections; KPI 15 Core Web Vitals guardrails](measurement-contract.md).

**Measurement prerequisites:** observe approved collection supply and existing hub-origin click coverage; production-validate the applicable model and its coverage before reporting impact. A click is intent, not a confirmed page load.

**Missing evidence:** per-collection exposure, completion and production impact are not established by existing aggregate hub click sources. [Editorial model](../intelligence/editorial-model.md); [data quality](../intelligence/data-quality.md#instrumentation-sent-exported-extracted).

**Privacy/legal items:** [review matrix](privacy-data-flow.md#future-feature-review-matrix); [instrumentation restrictions](privacy-data-flow.md#restrictions-on-new-instrumentation).

**Acceptance thresholds:** owner to set after baseline.

**GO:** editorial ownership and approval, canonical links, accessible presentation, rollback and an honest measurement limitation are documented.

**NO-GO:** unapproved content, a claimed completion rate without evidence, or unnecessary collection of visitor data.

**Owner decisions required:** collection selection and maintenance, acceptable proxy, and whether a measurement gap warrants future instrumentation.

## A-03 — Article Reading Journeys

**Feature:** provide an ordered reading experience over approved public content.

**Status:** foundation implemented in the A-03 draft PR; contract and approval procedure in [journeys.md](journeys.md). No journey is approved.

**Depends on:** A-01; [entity hubs](../entity-hubs.md), [editorial review](../editorial-review.md), [editorial model](../intelligence/editorial-model.md).

**KPIs:** [KPI 3 Article-to-article discovery; KPI 5 Reading paths; KPI 15 Core Web Vitals guardrails](measurement-contract.md).

**Measurement prerequisites:** validate any reused click source at the relevant grain; observe actual presentation and destination behaviour before making claims. Existing generic navigation cannot prove path progression or completion.

**Missing evidence:** explicit ordered-path progress and completion; placement-level exposure and confirmed destination loads. [Editorial model](../intelligence/editorial-model.md); [analytics emitter](../../scripts/analytics.js).

**Privacy/legal items:** [review matrix](privacy-data-flow.md#future-feature-review-matrix), especially progress storage; [instrumentation restrictions](privacy-data-flow.md#restrictions-on-new-instrumentation).

**Acceptance thresholds:** owner to set after baseline.

**GO:** editorial path ownership, broken-link handling, accessibility and removal are specified; impact claims wait for validated evidence.

**NO-GO:** progress presented as established by generic clicks, hidden persistent profiling, or unapproved publication.

**Owner decisions required:** path curation, whether progress is stored, and whether its measurement is necessary.

## A-04 — Race Weekend Reader Gateway

**Feature:** use Race Desk context to help readers navigate race-weekend content.

**Depends on:** A-01; [Race Desk architecture](../race-desk-architecture.md), [link contract](../race-desk-links.md), [editorial associations](../race-desk-editorial.md), [program](../race-desk-program.md).

**KPIs:** [KPI 6 Race-weekend audience behaviour; KPI 14 Article→Race Desk; KPI 15 Core Web Vitals guardrails](measurement-contract.md).

**Measurement prerequisites:** production-validate any relevant existing classification and consented source; observe actual supported routes and race context separately from reporting. Verify current child-tool instrumentation independently before making any tool-usage claim.

**Missing evidence:** per-race return behaviour, isolated GP hub classification and confirmed use inside standalone tools. Current link clicks are intent, not child usage. [Navigation model](../intelligence/sql/models/28-internal-navigation.sql); [Race Desk links](../../scripts/race-desk/core/links.mjs).

**Privacy/legal items:** [review matrix](privacy-data-flow.md#future-feature-review-matrix); data-provider and content-rights review; [instrumentation restrictions](privacy-data-flow.md#restrictions-on-new-instrumentation).

**Acceptance thresholds:** owner to set after baseline; apply the existing RUM flag only to covered observations.

**GO:** race identity, associations, context-preserving links, source rights, fallback and ownership follow existing Race Desk contracts; measurement gaps are explicit.

**NO-GO:** new competing race registry, treating a click as tool use, or a race-level audience claim unsupported by production data.

**Owner decisions required:** scope, acceptable proxies, GP classification gap and whether child measurement is warranted.

## A-05 — Weekly Briefing Editorial Foundation

**Feature:** an editorially written weekly briefing built from published articles. A-01 defined no gate for it.

**Gate:** not yet written. Before A-05 starts, its gate must be added here in the same form as the others: the
relevant [KPIs](measurement-contract.md) or a declared gap, the [global gates](#global-gates), editorial ownership and
approval under [editorial review](../editorial-review.md), and owner decisions. A briefing that is later emailed falls
under the [newsletter gates](#a-06-and-a-07--newsletter).

## A-06 and A-07 — Newsletter

**Feature:** offer an independently consented newsletter, subject to owner and legal decisions. A-06 owns signup, consent and preferences; A-07 owns delivery and editorial approval of each issue. Both must pass this gate; A-07 cannot start before A-06's consent and unsubscribe flow is approved.

**Depends on:** A-01; [privacy flow](privacy-data-flow.md), [acquisition model](../intelligence/audience-model.md), [editorial review](../editorial-review.md).

**KPIs:** [KPI 7 Newsletter subscriptions; KPI 8 Confirmed opt-ins; KPI 9 Unsubscribes and newsletter clicks; KPI 10 Newsletter-origin traffic](measurement-contract.md).

**Measurement prerequisites:** define and validate authoritative aggregate subscription-state and delivery reporting before making claims; validate the scope of any consented GA4 attribution separately. Email opens cannot establish human reading.

**Missing evidence:** the current privacy page says there is no newsletter; a contact submission is not a subscription. [Privacy section 4](../../privacy/privacy.html); [contact handler](../../scripts/f1-optimized.js).

**Privacy/legal items:** independent newsletter consent, confirmation, unsubscribe, retention, processor and legal review in the [matrix](privacy-data-flow.md#future-feature-review-matrix); [consent model](privacy-data-flow.md#consent-model).

**Acceptance thresholds:** owner to set after baseline.

**GO:** owner-approved provider selection process and operating responsibilities, independent consent and removal flow, disclosure, aggregate state definitions and incident handling are ready.

**NO-GO:** treating analytics consent or a contact form as newsletter consent, no unsubscribe path, or reporting openings as human readers.

**Owner decisions required:** provider selection process and criteria, consent and confirmation approach, retention, operator, launch and rollback. No provider is selected here.

## A-08 — Reader Questions & Editorial Q&A

**Feature:** enable participation beyond the existing contact form, subject to moderation and publication decisions. A-08 is the narrower case of reader questions answered editorially; this A-01 community gate applies to it in full.

**Depends on:** A-01; [editorial review](../editorial-review.md), [contact implementation](../../scripts/f1-optimized.js), [privacy disclosure](../../privacy/privacy.html).

**KPIs:** [KPI 13 Reader participation](measurement-contract.md).

**Measurement prerequisites:** determine whether a privacy-safe aggregate participation source exists and validate its units; neither form submission acceptance nor a synthetic test establishes substantive participation or a reply.

**Missing evidence:** reliable current participation outcomes, moderation capacity and any future UGC lifecycle are not established by the [contact handler](../../scripts/f1-optimized.js).

**Privacy/legal items:** [review matrix](privacy-data-flow.md#future-feature-review-matrix), covering submitted content, rights, abuse, appeals, deletion, processors and retention.

**Acceptance thresholds:** owner to set after baseline.

**GO:** moderation policy, staffing, reporting, escalation, removal, accessibility and failure/rollback ownership are documented and reviewed.

**NO-GO:** publication without moderation and rights decisions, exposure of submitted personal data, or a participation claim based solely on accepted form requests.

**Owner decisions required:** participation model, moderation and appeals policy, content rights, retention and operator.

## A-09 — Local Reading List Pilot

**Feature:** allow readers to save and reopen articles. The approved roadmap scopes A-09 as a local (on-device) pilot; the storage decisions below still apply.

**Depends on:** A-01; [editorial identity and review](../editorial-review.md), [metrics minimisation](../intelligence/metrics-contract.md#data-minimization).

**KPIs:** [KPI 11 Reading-list save/open; KPI 12 Saved-article revisits](measurement-contract.md).

**Measurement prerequisites:** identify and validate any future aggregate source for save/open actions; a generic article view cannot establish saved-state revisit. Check existing sources first and document any justified additional measurement as a recommendation.

**Missing evidence:** no current reader reading-list state or save/open source is established in the [event inventory](../intelligence/event-inventory.md); saved-article revisit is not measurable from existing views alone.

**Privacy/legal items:** [review matrix](privacy-data-flow.md#future-feature-review-matrix), including same-origin exposure, shared devices, retention and deletion; [instrumentation restrictions](privacy-data-flow.md#restrictions-on-new-instrumentation).

**Acceptance thresholds:** owner to set after baseline.

**GO:** storage scope, accessible save/open controls, removal, unavailable-storage behaviour and rollback are agreed; any measurement is independently consent-gated.

**NO-GO:** visitor-level joins, unexplained persistent storage, or claiming a save or revisit from an ordinary page view.

**Owner decisions required:** local-only versus other storage, lifecycle, sync needs and whether measurement is necessary.

## Unscheduled — Audience intelligence

**Feature:** determine whether aggregate reporting can answer returning-audience questions without visitor-level outputs.

**Depends on:** A-01; [Intelligence metrics contract](../intelligence/metrics-contract.md), [data quality](../intelligence/data-quality.md), [snapshot design](../intelligence/dashboard-snapshots.md).

**KPIs:** [KPI 1 Returning readership; KPI 2 Engaged sessions vs article_engaged; KPI 15 Core Web Vitals guardrails](measurement-contract.md).

**Measurement prerequisites:** owner verifies the aggregate GA4 report's availability, definition, population, time zone and privacy-safe reporting grain; validates each existing model actually used against its own production evidence and mature window.

**Missing evidence:** returning-user and engaged-session reports are NOT VERIFIED; no visitor-level joins or event subtraction can establish them. [Metrics contract](../intelligence/metrics-contract.md#data-minimization); [validation statuses](../intelligence/bigquery-validation.md#statuses).

**Privacy/legal items:** [Intelligence minimisation](privacy-data-flow.md#intelligence-minimisation-and-security-boundaries), [review matrix](privacy-data-flow.md#future-feature-review-matrix).

**Acceptance thresholds:** owner to set after baseline; existing RUM sample flag applies only to the relevant observations.

**GO:** owner accepts an aggregate source, bounded disclosure and validation plan; responsible operator and limitations are recorded.

**NO-GO:** visitor-level extract or join proposed, undefined reporting population, or impact claim based only on execution or synthetic fixtures.

**Owner decisions required:** acceptability of aggregate reporting, ownership, permissible aggregate disclosure and validation priority.

## Unscheduled — Notifications / push

**Feature:** offer optional notifications with explicit browser permission and operational controls.

**Depends on:** A-01; [privacy flow](privacy-data-flow.md); existing static hosting and deployment boundaries in [deploy-pages.yml](../../.github/workflows/deploy-pages.yml).

**KPIs:** [KPI 1 Returning readership; KPI 15 Core Web Vitals guardrails](measurement-contract.md); notification-specific measures require a separately justified contract.

**Measurement prerequisites:** establish existing-source limits first; independently verify permission, delivery and any aggregate reporting before claiming effect. Production-validate existing metrics used for impact comparisons.

**Missing evidence:** permission lifecycle, delivery and notification outcomes are not established in the current [privacy disclosure](../../privacy/privacy.html) or [event inventory](../intelligence/event-inventory.md).

**Privacy/legal items:** [review matrix](privacy-data-flow.md#future-feature-review-matrix), including browser permission, subscription revocation, provider and service-worker lifecycle; [instrumentation restrictions](privacy-data-flow.md#restrictions-on-new-instrumentation).

**Acceptance thresholds:** owner to set after baseline.

**GO:** owner-approved permission UX, delivery ownership, frequency, expiry, revocation, failure and rollback paths, and required privacy review are complete.

**NO-GO:** analytics consent treated as push permission, unowned subscriptions, or delivery claimed from an attempted send alone.

**Owner decisions required:** notification purpose and frequency, provider selection process, service-worker compatibility and revocation ownership.

## Owner decision register

1. ~~Confirm or change the provisional A-02–A-09 mapping and sequencing.~~ Resolved 2026-11-03: owner-approved [roadmap](#phase-4-roadmap) recorded in A-02.
2. Decide whether an aggregate GA4 returning-user report is acceptable, how its definition and privacy-safe availability will be verified, and who may see it.
3. Assign KPI and validation owners, baseline windows and impact thresholds after adequate evidence exists.
4. Set collection and reading-path editorial ownership, approval and maintenance rules.
5. Decide whether race-level classification or child-tool measurement merits a later proposal after existing-source review.
6. Decide reading-list storage scope, retention, deletion, shared-device behaviour and any sync requirements.
7. Define the newsletter provider selection process and criteria, independent consent, confirmation, unsubscribe, retention and operator; do not choose a vendor in A-01.
8. Decide notification purpose, frequency, permission and revocation flow, delivery ownership and service-worker compatibility.
9. Set community participation scope, moderation, abuse reporting, appeals, removal, rights and retention policies.
10. Determine when DPIA and DPA evaluation and legal review are triggered, who performs them, and how decisions are recorded.
11. Decide acceptable public aggregate disclosure and small-group protections without expanding Phase 1 visitor-level outputs.
12. Assign release, privacy, operational and rollback owners for each approved feature; distinguish launch approval from approval to claim impact.
