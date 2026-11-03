# Audience measurement contract

Status: A-01 documentation; base `58331f9fb`; investigation 2026-11-03 UTC.

This extends the [Intelligence metrics contract](../intelligence/metrics-contract.md); it does not compete with or replace its definitions. Where a definition exists, its contract and model govern; the sections below add audience interpretation. No instrumentation or SQL is introduced here.

## Evidence labels

These descriptive audience labels map to the existing [Intelligence statuses](../intelligence/bigquery-validation.md#statuses), [validator outcomes](../intelligence/data-quality.md#outcomes-and-severities), and [closeout evidence matrix](../intelligence/i06c4-closeout.md#evidence-matrix); they do **not redefine** any status or outcome.

| Audience label | Relationship to existing evidence |
| --- | --- |
| `VERIFIED_CODE` | Current repository inspection; may also be `STATICALLY_TESTED` if that test was run. Code alone proves neither deployment nor collection. |
| `OBSERVED_PRODUCTION` | Dated observation or an owner-reported `PRODUCTION_EXECUTED` aggregate; distinguish direct observation from reported results. |
| `PRODUCTION_VALIDATED` | The existing status, only for the model, checks, population and window actually validated. |
| `PROXY_ONLY` | Semantic limitation orthogonal to lifecycle status; corresponds to an expected limitation in the closeout. A validated proxy remains a proxy. |
| `NOT_VERIFIED` | Validator `NOT_VERIFIED` or closeout NOT VERIFIED; preserve any underlying execution status. Use `BLOCKED` only for an actually blocked step. |
| `NOT_MEASURABLE` | No suitable source or denominator today; an expected limitation, with relevant checks `NOT_VERIFIED`; do not invent a lifecycle status. |

A healthy pipeline does not establish analytical correctness; executing SQL does not validate a KPI; synthetic fixture success is not production evidence; a missing observation is not zero readership. All 20 models are `PRODUCTION_EXECUTED`, none `PRODUCTION_VALIDATED` ([production evidence](../intelligence/data-quality.md#production-evidence), [owner report](../intelligence/bigquery-validation.md)).

## Shared reporting rules

All GA4 metrics below cover only consented collection, with consent bias, and the model populations and primary HTTPS host in [data-quality.md](../intelligence/data-quality.md#populations-derived-from-the-sql). Non-GA4 sources have their own populations and must not be presented as consented GA4 counts. No visitor-level extracts, pseudonymous IDs in outputs, or visitor-level joins are permitted ([data minimization](../intelligence/metrics-contract.md#data-minimization)).

Unless a section states otherwise, the proposed reporting window is the latest available ≤28 mature days, in `America/Los_Angeles`, ending at `as_of − 4` days; the export begins 2026-10-19. This is a model rule, not proof of complete data ([snapshot data](../intelligence/dashboard-snapshots.md#data), [time rules](../intelligence/data-quality.md#time-what-is-expected-and-what-is-a-defect)). Scheduled snapshots run daily at 03:00 Athens; models 13 and 28 rotate weekly and carry their own dates; models 30 and 33 are carried on discovery days. Acquisition 26/29 covers ≤7 mature days, not the primary window ([rotation](../intelligence/dashboard-snapshots.md#i-06c3--editorial-discovery-weekly-rotation), [operations](../intelligence/operations.md#clocks-schedules-and-thresholds)).

Event counts are event-grain, not deduplicated people or sessions; use only compatible units and matching model windows. RUM uses its own revision identity, described below. A reporting row below the existing 30-event or observation floor remains visible and flagged; it is not evidence of zero ([quality contract](../intelligence/data-quality.md#quality-contract)).

## 1. Returning readership

- **Product question:** Are readers returning to articles?
- **Numerator:** Aggregate GA4 returning users, if the owner verifies an appropriate article-scoped report.
- **Denominator:** Compatible aggregate users from the same report if a rate is used; otherwise none.
- **Unit & grain:** Users per report period, not event counts.
- **Source & model:** None in Intelligence models; potential aggregate GA4 report ([interface](../intelligence/metrics-contract.md#ga4-interface-vs-bigquery-export-u), [model 20](../intelligence/sql/models/20-daily-activity.sql)).
- **Population & consent bias:** Consented GA4 population only; reporting identity and consent bias require owner review.
- **Host & page coverage:** Article scope and host filters of the prospective report are unverified.
- **Window, timezone & maturity:** Shared mature window for export; GA4 report availability and date semantics are unverified.
- **Freshness/cadence:** No existing snapshot KPI; report freshness must be verified.
- **Identity rules:** GA4 aggregate reporting identity must be verified; no ID extracts or visitor joins.
- **Limitations:** Thresholding, sampling, reporting identity and article filter can change interpretation.
- **Evidence label + status:** `NOT_VERIFIED`; existing models `PRODUCTION_EXECUTED`, this KPI has no model status.
- **New instrumentation needed?:** Recommendation only: verify a GA4 aggregate returning-user report and compatible denominator; existing event totals cannot answer return behaviour.

## 2. Engaged sessions and article engagement

- **Product question:** How do GA4 engaged sessions differ from the article threshold?
- **Numerator:** GA4 engaged sessions if verified separately; `article_engaged` event count for the existing proxy.
- **Denominator:** GA4 sessions in the same aggregate report if appropriate; model 12 uses `page_view` events.
- **Unit & grain:** Sessions versus events per article and period; never equate them.
- **Source & model:** [Model 12](../intelligence/sql/models/12-article-engagement.sql), [27](../intelligence/sql/models/27-engagement-events.sql), `article_engaged`, `engaged_seconds`, `scroll_depth`; GA4 engaged sessions: no model.
- **Population & consent bias:** Consented GA4; engagement among non-consenting readers is absent.
- **Host & page coverage:** Article identity and main host for 12; 27 is site-level.
- **Window, timezone & maturity:** Shared mature window; separate GA4 reporting period must be verified.
- **Freshness/cadence:** 12 and 27 were Console-executed; they are not in the daily snapshot model list.
- **Identity rules:** One `article_engaged` per instrumented document instance; events are not paired with views.
- **Limitations:** 30 visible consented seconds and 50% scroll is a threshold, not completion; the unmatched ratio can exceed 1 ([emitter](../../scripts/analytics.js), [editorial model](../intelligence/editorial-model.md)). GA4 generally defines an engaged session as lasting more than 10 seconds, containing a key event, or having at least two page/screen views; the threshold and property/report definition are not verified in this repository. It is distinct from the article threshold.
- **Evidence label + status:** `PROXY_ONLY`, `VERIFIED_CODE`; models `PRODUCTION_EXECUTED`.
- **New instrumentation needed?:** Recommendation only: verify aggregate GA4 engaged-session reporting; existing threshold events cannot count engaged sessions.

## 3. Article-to-article discovery

- **Product question:** Do article links invite further article discovery?
- **Numerator:** Article-source `internal_page_click` events targeting articles.
- **Denominator:** None; exposure impressions are absent.
- **Unit & grain:** Click events by destination, source surface and link section.
- **Source & model:** [13](../intelligence/sql/models/13-article-discovery.sql), [28](../intelligence/sql/models/28-internal-navigation.sql): `internal_page_click`, `link_path`, `link_section`, `page_location`.
- **Population & consent bias:** Consented main-site events; missing consent and blocked scripts bias counts.
- **Host & page coverage:** Article source and identified article destination; source article identity is not a journey.
- **Window, timezone & maturity:** Shared primary window using the carried pair’s own bounds.
- **Freshness/cadence:** 13/28 weekly and carried; see shared rules.
- **Identity rules:** Event identity; no journey matching or reader dedupe.
- **Limitations:** Clicks are intent, not destination loads; excluded click types and generic link classes limit coverage ([model 28](../intelligence/sql/models/28-internal-navigation.sql)).
- **Evidence label + status:** `PROXY_ONLY`; 13/28 `PRODUCTION_EXECUTED`.
- **New instrumentation needed?:** No for click intent. Recommendation only: privacy-reviewed aggregate placement exposures if CTR is needed; clicks alone have no exposure denominator.

## 4. Curated collections

- **Product question:** Are collection-like hubs used for discovery?
- **Numerator:** Entity-hub-source clicks to article destinations.
- **Denominator:** None. Aggregate `entity_hub` page-view events exist in [model 21](../intelligence/sql/models/21-site-sections.sql), but no collection or link impression count exists, so they cannot supply per-collection reach or placement CTR.
- **Unit & grain:** Click events by surface, destination and section.
- **Source & model:** [13](../intelligence/sql/models/13-article-discovery.sql), [28](../intelligence/sql/models/28-internal-navigation.sql); [entity hubs](../entity-hubs.md).
- **Population & consent bias:** Consented site population, not all readers.
- **Host & page coverage:** Entity hubs on Main; existing model classes do not give individual collection performance.
- **Window, timezone & maturity:** Shared primary window, with carried bounds.
- **Freshness/cadence:** 13/28 weekly and carried.
- **Identity rules:** Event count; no collection completion or reader identity.
- **Limitations:** Published hubs are collection-like supply, not evidence of collection readership or completed collections.
- **Evidence label + status:** `PROXY_ONLY`, `VERIFIED_CODE`; models `PRODUCTION_EXECUTED`.
- **New instrumentation needed?:** Recommendation only: aggregate collection identifier and exposure if per-collection reach is needed; current groupings cannot isolate it.

## 5. Reading paths

- **Product question:** Do readers progress through an ordered path?
- **Numerator:** None for path progress; generic article-link clicks are a proxy for intent.
- **Denominator:** None for path starts or eligible steps.
- **Unit & grain:** No measurable path progression grain.
- **Source & model:** None for paths; generic clicks in [13](../intelligence/sql/models/13-article-discovery.sql) and [28](../intelligence/sql/models/28-internal-navigation.sql); existing related links in [discovery](../../blog-module/build/discovery.js).
- **Population & consent bias:** GA4 proxies cover consented readers only.
- **Host & page coverage:** Main article links; generic section classes do not establish a path.
- **Window, timezone & maturity:** Shared primary window for proxy clicks; no established path window.
- **Freshness/cadence:** 13/28 weekly and carried; no path snapshot.
- **Identity rules:** Events are not linked into visitor journeys.
- **Limitations:** No explicit ordered-path identifier, progress or completion source; click intent is not a load.
- **Evidence label + status:** `NOT_MEASURABLE` for progression; `PROXY_ONLY` for clicks, models `PRODUCTION_EXECUTED`.
- **New instrumentation needed?:** Recommendation only: aggregate path-step reporting with a defined path and denominator; existing generic clicks cannot identify progress.

## 6. Race-weekend behaviour

- **Product question:** How does activity vary around a race weekend?
- **Numerator:** Daily consented site page-view events ([model 20](../intelligence/sql/models/20-daily-activity.sql)) during a defined race window. Model 21 returns section totals over its query period, so daily article or section counts would need separate one-day model-21 executions.
- **Denominator:** None; a comparison period must be stated separately.
- **Unit & grain:** Events per LA property day, optionally grouped over an explicitly named race window.
- **Source & model:** [20](../intelligence/sql/models/20-daily-activity.sql), [21](../intelligence/sql/models/21-site-sections.sql); registry session `startUtc` in [registry](../../data/race-desk/registry.v1.json).
- **Population & consent bias:** Consented Main activity; no inference about the unconsented audience.
- **Host & page coverage:** Whole Main site / existing section classes; GP hubs do not have a dedicated class.
- **Window, timezone & maturity:** For a reproducible proxy use LA calendar days containing first through last listed registry session starts, inclusive; missing session times mean window `NOT_VERIFIED`. Convert UTC explicitly; Athens scheduler dates differ. Apply shared maturity.
- **Freshness/cadence:** 20 daily; 21 Console-executed, outside snapshot list.
- **Identity rules:** Daily event counts; no race attribution or returner identity.
- **Limitations:** Site activity during the window is not necessarily race-related; the window omits days after the final session-start day.
- **Evidence label + status:** `PROXY_ONLY`; 20/21 `PRODUCTION_EXECUTED`.
- **New instrumentation needed?:** Recommendation only: aggregate race context if race-specific activity is needed; daily site totals lack a race dimension.

## 7. Newsletter subscriptions

- **Product question:** How many subscription requests occur?
- **Numerator:** None today; future aggregate requests with a defined state.
- **Denominator:** None unless a compatible exposure population is available.
- **Unit & grain:** Requests per period, not people or confirmed opt-ins.
- **Source & model:** None; [privacy notice](../../privacy/privacy.html) says there is no newsletter.
- **Population & consent bias:** Future subscription population independent of analytics consent.
- **Host & page coverage:** No newsletter collection surface established.
- **Window, timezone & maturity:** No established source or maturity; specify LA reporting dates and source timezone conversion later.
- **Freshness/cadence:** None; future source cadence to be documented.
- **Identity rules:** Future source must define duplicate request handling without public identifiers.
- **Limitations:** Contact form submissions are not newsletter subscriptions.
- **Evidence label + status:** `NOT_MEASURABLE`; no model status.
- **New instrumentation needed?:** Recommendation only: aggregate subscription-state source; existing GA4 and contact form cannot establish subscriptions.

## 8. Confirmed opt-ins

- **Product question:** How many requests become confirmed subscriptions?
- **Numerator:** None today; future confirmed subscription-state transitions.
- **Denominator:** Compatible requests from a defined cohort, only if source supports it.
- **Unit & grain:** Confirmed transitions per period or cohort.
- **Source & model:** None; no confirmed newsletter state in the repository ([privacy notice](../../privacy/privacy.html)).
- **Population & consent bias:** Future newsletter consent is separate from analytics consent.
- **Host & page coverage:** No newsletter surface established.
- **Window, timezone & maturity:** No established maturity; define LA reporting dates, source timezone and confirmation lag.
- **Freshness/cadence:** None; future source cadence to be documented.
- **Identity rules:** State transitions, with source-defined deduplication; no visitor-level output or joins.
- **Limitations:** Pending requests and confirmations are different; no legal compliance certification is implied.
- **Evidence label + status:** `NOT_MEASURABLE`; no model status.
- **New instrumentation needed?:** Recommendation only: aggregate confirmed state and cohort counts; request or GA4 events cannot establish confirmation.

## 9. Unsubscribes and newsletter clicks

- **Product question:** Do subscribers unsubscribe or follow newsletter links?
- **Numerator:** None today; future unsubscribe transitions and email-link clicks reported separately.
- **Denominator:** Compatible subscriptions or delivered messages only where the source defines them.
- **Unit & grain:** Transitions or clicks per period; never combine the units.
- **Source & model:** None for newsletter; website `outbound_click` is a different event ([analytics](../../scripts/analytics.js)).
- **Population & consent bias:** Future newsletter population; independent of analytics consent.
- **Host & page coverage:** Email delivery surface, currently absent.
- **Window, timezone & maturity:** No established source; define LA dates, conversion and reporting delay later.
- **Freshness/cadence:** None; future source cadence to be documented.
- **Identity rules:** Source-defined aggregate event/state dedupe; no identities in output.
- **Limitations:** Clicks can include automated activity; email opens are unreliable indicators of human reading.
- **Evidence label + status:** `NOT_MEASURABLE`; no model status.
- **New instrumentation needed?:** Recommendation only: aggregate unsubscribe and email-click reporting with bot and state rules; existing website clicks cannot answer either.

## 10. Newsletter-origin visits

- **Product question:** What traffic is attributed to email?
- **Numerator:** Email-classified `page_view` or `session_start` events, reported separately.
- **Denominator:** None; a share must use a matching event population and attribution scope.
- **Unit & grain:** Events per attribution class; not exact visits.
- **Source & model:** [24](../intelligence/sql/models/24-acquisition-first-user.sql), [25](../intelligence/sql/models/25-acquisition-collected.sql), [26](../intelligence/sql/models/26-acquisition-session.sql); [medium classification](../intelligence/sql/models/audience-functions.sql) includes email/newsletter.
- **Population & consent bias:** Consented GA4 Main population; attribution gaps remain.
- **Host & page coverage:** Primary host; campaign details are reduced to classes/presence.
- **Window, timezone & maturity:** 26 is ≤7 mature days; 24/25 follow their own query bounds, LA timezone.
- **Freshness/cadence:** 26 daily snapshot; 24/25 Console-executed, not snapshot models.
- **Identity rules:** Event counts under distinct first-user, collected-event and session-last-click scopes; do not sum scopes.
- **Limitations:** Email class does not prove an owned newsletter caused the traffic; event counts are not exact visits.
- **Evidence label + status:** `PROXY_ONLY`; models `PRODUCTION_EXECUTED`.
- **New instrumentation needed?:** No for email-classified event counts. Recommendation only: privacy-reviewed owned-campaign aggregate source if ownership must be established; medium class alone cannot establish it.

## 11. Reading-list save and open

- **Product question:** Do readers save or open a reading list?
- **Numerator:** None.
- **Denominator:** None; no list exposure count.
- **Unit & grain:** Save or list-open actions per period, currently unavailable.
- **Source & model:** None; current generic navigation in [28](../intelligence/sql/models/28-internal-navigation.sql) cannot distinguish list actions.
- **Population & consent bias:** Future analytics would cover consenting visitors only; local list use could differ.
- **Host & page coverage:** No identified reading-list surface.
- **Window, timezone & maturity:** No source window; use LA reporting dates and maturity if later collected in GA4.
- **Freshness/cadence:** None.
- **Identity rules:** No action identity or dedupe contract exists.
- **Limitations:** Generic article links cannot establish a save or list open.
- **Evidence label + status:** `NOT_MEASURABLE`; no model status.
- **New instrumentation needed?:** Recommendation only: privacy-reviewed aggregate save/open actions and exposure definition; current links lack action semantics.

## 12. Saved-article revisits

- **Product question:** Do readers revisit saved articles?
- **Numerator:** None.
- **Denominator:** None; no eligible saved-article cohort.
- **Unit & grain:** Aggregate revisits per explicitly defined cohort, currently unavailable.
- **Source & model:** None; [10](../intelligence/sql/models/10-article-pageviews.sql) counts views without save context.
- **Population & consent bias:** Any GA4 proxy is consent-gated; local saved state need not match it.
- **Host & page coverage:** Article views on Main do not identify saved origin.
- **Window, timezone & maturity:** No established source window; define LA dates and maturity if applicable.
- **Freshness/cadence:** None for revisits.
- **Identity rules:** No visitor-level joins or pseudonymous outputs; an aggregate method remains unverified.
- **Limitations:** A click from a list alone proves neither a prior save by the same reader nor a destination load.
- **Evidence label + status:** `NOT_MEASURABLE`; model 10 `PRODUCTION_EXECUTED` for views only.
- **New instrumentation needed?:** Recommendation only: assess a privacy-preserving aggregate revisit measure; existing views have no saved-state context.

## 13. Reader participation

- **Product question:** How much contact-form participation is accepted?
- **Numerator:** Owner-only aggregate accepted form submissions, if the external dashboard supports that count.
- **Denominator:** None; no exposure or eligible-reader count established.
- **Unit & grain:** Accepted submissions per period, not people or substantive conversations.
- **Source & model:** Formspree endpoint in [index.html](../../index.html); [submit handler](../../scripts/f1-optimized.js); no custom GA4 submission outcome.
- **Population & consent bias:** Form submissions are independent of analytics consent; any GA4 observation is consent-gated.
- **Host & page coverage:** TEAM RADIO contact form on Main; automatic GA4 form measurement settings are unverified.
- **Window, timezone & maturity:** No verified dashboard period or maturity; specify LA dates and provider timezone if observed.
- **Freshness/cadence:** Owner-only dashboard cadence unverified; no snapshot KPI.
- **Identity rules:** Provider aggregate dedupe and acceptance definitions unverified; no message contents or identities.
- **Limitations:** An OK response is not proof of delivery, reply or meaningful participation.
- **Evidence label + status:** `VERIFIED_CODE` for mechanism; count `NOT_VERIFIED`.
- **New instrumentation needed?:** No for a verified provider aggregate if available. Recommendation only: define aggregate acceptance reporting if unavailable; existing GA4 code does not emit a confirmed outcome.

## 14. Article to Race Desk navigation

- **Product question:** Do article links point readers to Race Desk surfaces?
- **Numerator:** Article-source clicks to classified tool destinations; separately consider hub page views only if a source can isolate them.
- **Denominator:** None; no link exposures.
- **Unit & grain:** Click events by section; hub views and tool clicks are separate units.
- **Source & model:** [28](../intelligence/sql/models/28-internal-navigation.sql), `internal_page_click` and `link_path`; [hub renderer](../../scripts/race-desk/hub-render.mjs).
- **Population & consent bias:** Consented Main-source events; standalone child-tool use is outside this population.
- **Host & page coverage:** Model 28 identifies specific tool paths; GP hubs fall into `other` in the existing section classifier, so current grouped models cannot isolate hub views; BetCast is not a Race Desk tool.
- **Window, timezone & maturity:** Shared primary window using discovery pair bounds.
- **Freshness/cadence:** 28 weekly and carried.
- **Identity rules:** Click event identity; no matched destination or child usage.
- **Limitations:** Clicks to standalone tools are intent, not verified tool usage; child analytics are not established by Main. Hub source-specific loads cannot be isolated by existing model.
- **Evidence label + status:** `PROXY_ONLY`; model 28 `PRODUCTION_EXECUTED`; child usage `NOT_MEASURABLE`.
- **New instrumentation needed?:** Recommendation only: aggregate hub classification if hub navigation must be isolated; existing `other` class cannot isolate it. Child usage needs independent, privacy-reviewed evidence.

## 15. Core Web Vitals guardrails

- **Product question:** Do delayed field observations indicate a performance regression?
- **Numerator:** p75 and good-rated observations, separately by metric and coverage class.
- **Denominator:** All eligible observations in that same metric and coverage class for good share.
- **Unit & grain:** Observations; LCP/INP milliseconds, CLS unitless.
- **Source & model:** [30–33](../intelligence/performance-model.md#models), `web_vital`; coverage companion 33.
- **Population & consent bias:** Consented delayed RUM observations only, with coverage bias.
- **Host & page coverage:** Instrumented Main pages; GP hub renderer lacks the RUM emitter and standalone children are not covered.
- **Window, timezone & maturity:** Shared mature primary cohort; 31/32 require their own execution and periods.
- **Freshness/cadence:** 30/33 daily, carried one day on discovery days; 31/32 Console-executed only.
- **Identity rules:** Resolve highest revision then latest timestamp per observation; retain separate coverage classes ([performance model](../intelligence/performance-model.md#observations-deduplication-units-percentiles)).
- **Limitations:** Not full-navigation CWV; no pooling coverage classes. Use ≥30 observations before comparing groups or quoting p75. Existing good thresholds: LCP ≤2500 ms, INP ≤200 ms, CLS ≤0.1 ([contract](../intelligence/performance-model.md#observations-deduplication-units-percentiles)).
- **Evidence label + status:** `PROXY_ONLY`; models `PRODUCTION_EXECUTED`, none `PRODUCTION_VALIDATED`.
- **New instrumentation needed?:** No for existing delayed observations. Recommendation only: separately review missing hub/tool coverage if needed; current emitter cannot observe those surfaces.

## Prohibited derivations

- `page_view` is not a unique visitor; `session_start` events are not exact sessions; `first_visit` events are not exact new users. Never derive returning users by subtracting event counts.
- `article_engaged` is not reading completion or GA4 engaged sessions; `internal_page_click` is not a confirmed destination load.
- Clicks into standalone Race Desk tools do not establish tool usage. Email opens do not establish human reading.
- Never present consented GA4 data as the whole audience, join visitors across sources, or publish visitor-level extracts or pseudonymous IDs.
