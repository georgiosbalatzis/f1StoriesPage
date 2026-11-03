# Audience infrastructure audit

**Status:** A-01 documentation; no runtime change.  
**Base:** `58331f9fb` · **Investigation:** 2026-11-03 UTC.  
**Evidence labels:** see [measurement contract](measurement-contract.md#evidence-labels). Source references below describe repository capability, not proof of deployment or audience impact.

## Analytics and consent

The consent controller defaults analytics to off and stores only essential and analytics choices; the emitter enables GA4 only after `analytics: true`, disables it and attempts cookie removal on withdrawal. Ads consent remains denied. Article pages defer the GA4 download until load. All GA4 observations describe the **consented population**, with consent bias. Sources: `scripts/cookie-consent.js:10–49`, `scripts/analytics.js:34–73,274–325`; local behavior fixtures: `scripts/perf/__tests__/analytics-events.test.mjs`, `scripts/perf/__tests__/web-vitals.test.mjs`.

| Event | Emitter and trigger | Key parameters and limitation |
| --- | --- | --- |
| `page_view` | GA4 configuration on consented document load or consent; `scripts/analytics.js:274–298` | `page_location` retains only allowlisted campaign parameters (`scripts/analytics.js:84–93`). A page view is not a unique visitor. |
| `session_start`, `first_visit`, `user_engagement` | GA4 automatic events associated with the consented configuration; [event inventory](../intelligence/event-inventory.md) | Counts of `session_start` are not exact sessions; `first_visit` is not exact new users; `user_engagement` pings are not engaged-session counts. |
| `internal_page_click` | `scripts/analytics.js:100–164,211–233`; unmodified primary click on eligible same-origin page link | Destination `link_path`, `link_url`, optional destination `article_id`, `link_text`, `link_section`, source path/type and destination type. Click intent, not confirmed destination load; excludes modified and prevented clicks. |
| `outbound_click` | `scripts/analytics.js:176–208,211–233`; eligible cross-origin HTTP(S) click outside share buttons | Destination domain, section, text, source and optional source article, sponsored flag. Click intent, not a delivered visit. |
| `article_share` | `scripts/analytics.js:189–208`; social share link; `blog-module/blog-fixes.js:39–85`; successful copy or native share action | Method and article identity where available; an action, not proof of a completed share. |
| `article_engaged` | `scripts/analytics.js:236–271`; once per article document after 30 visible consented seconds and 50% scroll | `article_id`, `engaged_seconds`, `scroll_depth`; threshold event, not reading completion. |
| `journal_search` | `blog-module/blog-index.js:398–407`; nonempty search after 900 ms pause | `query_length`, `result_count`; no search text. Multiple pauses can produce events for one search. |
| `web_vital` | `scripts/perf/web-vitals-beacon.js:4–35`, `scripts/perf/web-vitals-collector.js:38–89`; delayed consent/load/idle collector callbacks for LCP, INP, CLS, FCP and TTFB | Metric, value, revision, navigation, page group, viewport and coverage metadata; observations are not visitors. Collection may start late and be incomplete. |
| `js_error` | `scripts/perf/error-beacon.js:10–88`; uncaught error or rejection; first per tab session, later sampled | Bounded diagnostic message, source, line, first stack frame, page path and sampling rating. Consent is checked at send. |

Every custom emitter above checks analytics consent directly or through `trackEvent`; GA4 enhanced-measurement events depend on property settings and are **NOT VERIFIED** (`scripts/analytics.js:148,177,301–307`; [event inventory](../intelligence/event-inventory.md)). Never derive returning users by subtracting event counts. Phase 1 outputs exclude visitor-level extracts, pseudonymous IDs and visitor-level joins ([metrics contract](../intelligence/metrics-contract.md)). Returning-user reporting is only a proposed aggregate GA4 report until independently verified.

The emitter has no hostname guard: a copy running on another host can send to the same property; Intelligence filters for the primary host (`scripts/analytics.js:5–7,274–298`; `docs/intelligence/sql/models/audience-base.sql`). Main home, standings, article template, Journal/archive/sections, entity and author hubs, legal pages and GP hubs include analytics (`index.html:45`, `standings/index.html:49`, `blog-module/blog/template.html:70`, `blog-module/blog/index.html:40`, `blog-module/blog/archive/index.html:39`, `blog-module/blog/entities/drivers/lando-norris/index.html:40`, `authors/index.html:279`, `privacy/privacy.html:33`, `scripts/race-desk/hub-render.mjs:113`). The home, standings and Journal/article templates load Web Vitals; the GP hub renderer does not (`index.html:46`, `standings/index.html:50`, `blog-module/blog/template.html:71`, `scripts/race-desk/hub-render.mjs:109–115`). This is source coverage, not a production census.

Telemetry, ghost car, tyres and betcast are separately assembled child tools; historical inventory reports no child analytics and the assembly contract does not inject Main analytics. Their current pinned source checkouts were unavailable for independent inspection, so current child instrumentation is **NOT VERIFIED**. Same-origin tool-link clicks from an instrumented parent are `internal_page_click`, not verified tool usage. Sources: [event inventory](../intelligence/event-inventory.md), `scripts/deployment/sources.json`, `scripts/race-desk/core/links.mjs`.

## Phase 1: Intelligence

All rows below are **PRODUCTION_EXECUTED**, none **PRODUCTION_VALIDATED**, as recorded in [validation status](../intelligence/bigquery-validation.md#statuses) and [production evidence](../intelligence/data-quality.md#production-evidence). Execution is not KPI validation. Each model's window and coverage must accompany its interpretation; the SQL files define exact populations and grain.

| Model | Question and output grain | Source |
| --- | --- | --- |
| 10 | Which articles receive page-view events? Canonical article. | `docs/intelligence/sql/models/10-article-pageviews.sql` |
| 11 | Which primary categories receive article page-view events? Category. | `docs/intelligence/sql/models/11-category-pageviews.sql` |
| 12 | How many threshold engagement and page-view events occur? Article; unmatched event ratio. | `docs/intelligence/sql/models/12-article-engagement.sql` |
| 13 | Which articles are clicked from which surfaces and link sections? Destination article × source surface × link section. | `docs/intelligence/sql/models/13-article-discovery.sql` |
| 14 | How do article events vary by publication age? Age band × primary category. | `docs/intelligence/sql/models/14-publication-age.sql` |
| 15 | What editorial event coverage survives filtering and mapping? Event × consent/host/article status. | `docs/intelligence/sql/models/15-coverage.sql` |
| 20 | How many activity events occur each day? Day × event counts. | `docs/intelligence/sql/models/20-daily-activity.sql` |
| 21 | Where do page-view and session-start events occur? Site section. | `docs/intelligence/sql/models/21-site-sections.sql` |
| 22 | How do activity events vary by device? Coarse device category. | `docs/intelligence/sql/models/22-device-category.sql` |
| 23 | How do activity events vary by country? Country, with small countries grouped. | `docs/intelligence/sql/models/23-country.sql` |
| 24 | What is the first-user acquisition classification of events? First-user source/medium/campaign class. | `docs/intelligence/sql/models/24-acquisition-first-user.sql` |
| 25 | What campaign information was collected on events? Event-scoped acquisition class. | `docs/intelligence/sql/models/25-acquisition-collected.sql` |
| 26 | What GA4 session attribution accompanies events? Session attribution class, not reconstructed sessions. | `docs/intelligence/sql/models/26-acquisition-session.sql` |
| 27 | How many engagement and sharing events occur? Event × applicable breakdown. | `docs/intelligence/sql/models/27-engagement-events.sql` |
| 28 | Which sections link to which others? Source section × destination section × link section, click events. | `docs/intelligence/sql/models/28-internal-navigation.sql` |
| 29 | How complete is audience filtering and classification? Event and coverage counts. | `docs/intelligence/sql/models/29-audience-coverage.sql` |
| 30 | What are the Web Vitals observations and p75? Coverage class × metric. | `docs/intelligence/sql/models/30-cwv-summary.sql` |
| 31 | How do vitals vary by one dimension? Coverage × metric × one page, viewport or navigation dimension. | `docs/intelligence/sql/models/31-cwv-breakdown.sql` |
| 32 | How do vitals change over time? Navigation day or week × coverage × metric. | `docs/intelligence/sql/models/32-cwv-trend.sql` |
| 33 | What survives each RUM pipeline stage? Stage × coverage/integrity category. | `docs/intelligence/sql/models/33-rum-coverage.sql` |

The scheduled snapshot pipeline runs via `.github/workflows/intelligence-snapshot.yml` and `scripts/intelligence/snapshot.mjs`; the dashboard reads its encrypted snapshot through `scripts/intelligence/dashboard-browser.mjs`, and `.github/workflows/intelligence-health.yml` invokes `scripts/intelligence/health-check.mjs`. See [snapshot contract](../intelligence/dashboard-snapshots.md), [operations](../intelligence/operations.md) and [validator outcomes](../intelligence/data-quality.md#outcomes-and-severities). Healthy operation is not analytical correctness; no snapshot was inspected here.

## Phase 2: discovery and editorial

| Capability | Existing behavior and boundary | Evidence |
| --- | --- | --- |
| NEXT UP | Build-time ranking selects up to three released, dated stories: approved shared subjects lead, then rarity-weighted topical tags, category, author and recency; image duplication is avoided and newer stories fill remaining slots. | `blog-module/build/related-score.js:14–74`, `blog-module/build/related.js` |
| Contextual links | Authored body links and reviewable suggestions connect earlier stories and approved topic hubs; a tag match alone is not proof of relationship. SEO contextual-link pilot #346. | `blog-module/build/body-links.js:1–2,127–175` |
| Entity hubs | Selection requires human approvals and qualifying published subjects; hubs provide curated entity context and article links. | `blog-module/build/entities/hubs.js`, [entity hubs](../entity-hubs.md) |
| Journal and archive | Edition, sections, archives and in-page search/filtering already expose public articles. | `blog-module/build/discovery.js:264–322`, `blog-module/blog-index.js:390–412` |
| Editorial review | Review, preflight and research notebook maintain human editorial and claim-review boundaries; a research artifact is not audience input. | [editorial review](../editorial-review.md), [research notebook](../editorial-research-notebook/README.md) |

`classifyLink()` derives `link_section` from classes and ancestors: `article_share`, `sponsor`, `social`, `cta`, `article_link`, `navigation`, `footer`, otherwise `page` (`scripts/analytics.js:132–144`). Article cards and previous/next navigation can be `article_link`; ordinary body links and NEXT UP are not separately identified and generally fall into `page` (`blog-module/build/related.js`, `blog-module/blog/template.html:235`; `scripts/analytics.js:132–144`). `data-kind`, `data-story-ids`, archive filter attributes and `data-article-kind` describe rendering and filtering, but the click classifier does not read them (`blog-module/build/discovery.js:284–286`, `blog-module/blog/template.html:201–202`). Do not treat a section count as placement impressions or a click-through rate.

Curated collections and ordered reading paths are **not existing features** in the inspected discovery builds; entity hubs, approved public articles, body links and NEXT UP provide reusable components, not a collection or path-completion contract (`blog-module/build/discovery.js`, `blog-module/build/entities/hubs.js`, `blog-module/build/related-score.js`).

## Phase 3: Race Desk

GP hubs are generated from the registry and evidence, with schedule, sources, tools and curated published article associations (`scripts/race-desk/hub-model.mjs`, `scripts/race-desk/hub-render.mjs`, `data/race-desk/hub-evidence.v1.json`; [editorial associations](../race-desk-editorial.md), #404). Association is editorial context, not verification of each article claim. Hub-to-article links are built from the association and publication rules (`scripts/race-desk/editorial.mjs`, `scripts/race-desk/hub-render.mjs:107`; [editorial associations](../race-desk-editorial.md)). No article-to-GP-hub link was found in the committed article pages or article renderer; the homepage links to selected GP hubs (`index.html:388–393`, `blog-module/build/article-render.js`).

The Race Desk link and navigation builders build supported same-origin child routes and carry race context where supported; GP hubs render tool links (`scripts/race-desk/core/links.mjs`, `scripts/race-desk/core/navigation.mjs`, `scripts/race-desk/hub-render.mjs`). Eligible instrumented same-origin home→hub, hub→article and hub→tool links produce consented `internal_page_click` intents; a future article→hub link would follow the same rule; external sources use `outbound_click`. Destination query parameters are stripped from the event, and the existing SQL path classifier does not give GP hubs a distinct Race Desk section (`scripts/analytics.js:150–159`, `docs/intelligence/sql/02-event-inventory.sql:7–20`). Neither a hub click nor a tool link establishes child-tool usage or race-specific return behavior.

The existing experience includes race calendar/context and standings data (`data/race-desk/registry.v1.json`, `standings/index.html`, [Race Desk architecture](../race-desk-architecture.md)); the homepage calls its selected GP list explicitly incomplete (`index.html:388`). Standings refresh is scheduled Friday 23:59 and Saturday/Monday 07:01 `Europe/Athens` (`.github/workflows/publish-blog.yml:11–18`), not evidence of live updates. A personalized weekend journey or verified weekend-return measure is absent from the inspected runtime and models.

## Participation

TEAM RADIO is a contact form posting required name, contact and message fields to the Formspree endpoint in `index.html:620–641`. The form includes a hidden `_gotcha` honeypot; no in-page reCAPTCHA widget is present in the form. The AJAX handler submits, resets on success, displays errors and, on the specific 403 verification response, falls back to native submission for provider verification (`scripts/f1-optimized.js:91–164`). The privacy notice describes provider anti-spam controls (`privacy/privacy.html:158`); their operation is not verified here. CSP permits the provider in `form-action` and `connect-src` (`scripts/build/security-policy.mjs:27,34`). Contact is not newsletter consent or a public community forum.

The privacy notice mentions comments and social/video embeds (`privacy/privacy.html:137,160–161`); current build cleanup removes retired Disqus markup/scripts (`scripts/build/remove-retired-comments.mjs:1–7`). Actual public article markup includes social embeds, for example `blog-module/blog-entries/20260416G/article.html:180` and `blog-module/blog-entries/20261007F/article.html:200`. A current site-wide comment system is not established by that notice or cleanup alone.

## Opportunity inventory and duplicate risk

Statuses describe source capability, not validated audience outcomes.

| Opportunity | State and existing evidence | Duplicate risk and reuse rule |
| --- | --- | --- |
| Newsletter | **ABSENT**; privacy notice says no newsletter (`privacy/privacy.html:157`). | Do not repurpose TEAM RADIO as subscription. A future subscription needs independent consent and authoritative confirmation/unsubscribe state; no provider selected. |
| Collections / reading paths | **PARTIAL** discovery components; explicit collections and ordered paths absent (`blog-module/build/discovery.js`, `blog-module/build/entities/hubs.js`). | Do not build a competing related engine; reuse approved entities, article identities and `related-score.js`, preserving editorial gates. |
| Reading list | **ABSENT** save/revisit feature in inspected public discovery runtime (`blog-module/blog-index.js`, `blog-module/blog/template.html`). | Reuse canonical public article IDs; do not reuse editorial drafts as reader storage. |
| Race weekend | **PARTIAL** GP hubs, calendar, tools and scheduled standings (`scripts/race-desk/hub-render.mjs`, `.github/workflows/publish-blog.yml:11–17`). | Reuse R-01 registry, associations and `core/` link builders instead of inventing race identity or context parsing. |
| Notifications | **ABSENT** audience notification flow in inspected runtime; legacy worker cleanup exists (`scripts/sw-cleanup.js`). | Do not create a competing worker lifecycle; resolve cleanup and permission behavior before a future design. |
| Community participation | **PARTIAL** private TEAM RADIO contact and article social embeds (`index.html:613–641`, `blog-module/blog-entries/20260416G/article.html:180`). | Reuse contact for contact only; public discussion would need its own moderation and publication rules. |
| Audience intelligence | **PARTIAL** consented aggregate event and performance models exist; returning readership is not established (`docs/intelligence/sql/models/20-daily-activity.sql`, `docs/intelligence/README.md:3`). | Reuse I-03–I-05 models, coverage and validation; do not duplicate KPI SQL or infer users by event subtraction. |

Any future event, dimension or model is a recommendation only and must first show why an existing source cannot answer the question, the minimum additional information and its privacy/validation implications. No new instrumentation or SQL is authorized by this audit.

## Ownership boundaries

| Phase | Owns | Phase 4 may reuse | Phase 4 must not re-own or alter here |
| --- | --- | --- | --- |
| 1 Intelligence | Event definitions, models, validation and snapshot operations (`docs/intelligence/`, `scripts/intelligence/`). | Aggregates, coverage, classifications and owner validation evidence. | Collection semantics, SQL populations, encryption, pipeline or status definitions. |
| 2 Editorial | Publication, research and human review (`docs/editorial-review.md`, `docs/editorial-research-notebook/README.md`, `scripts/author/`). | Approved public metadata, canonical identities and review gates. | Draft storage, claims, publication approval or corrections. |
| 3 Race Desk | Race identity, links, sources and publication (`data/race-desk/`, `scripts/race-desk/`; [program](../race-desk-program.md)). | Registry, supported links, approved associations and dated evidence. | Registry, provider identity, sporting calculations, rights gates or child instrumentation. |
| 4 Audience | Audience questions, evidence requirements and readiness in `docs/audience/`. | The preceding contracts by reference. | A second analytics, editorial approval or race registry system; A-01 changes no runtime. |

## Phase history anchors

Merge anchors only; a merged PR is not evidence of deployment or of production correctness.

| Phase | PRs |
| --- | --- |
| 1 Intelligence | I-01 #352; I-02 #353 closed unmerged; I-03 #354; I-04 #355, #356; I-05 #357; BigQuery validation #359; snapshots #365; I-06C4 #370, #372; dashboard #369; operations #371, #376; I-07 #375, #377, #379; I-08 #373, #378; growth audit #374 |
| 2 Editorial OS | E-01 #383; E-02 #385; E-03 #388; E-04 #384; E-05 #389; E-06 #390; E-07 #391; E-08 #386 |
| 3 Race Desk | R-01 #392, #394; R-02 #393, #395, #397; R-03 #400; R-04 #402; R-05 #404, #418; R-06 #419, #421; R-07 #424, #425; R-09 #426, #427, #428 |
| SEO discovery | Topic discovery #338; contextual-link pilot #346; archive discovery #351 |

## Stale statements in existing documents

A-01 does not edit these files. Each correction belongs to its owning phase as a separate change.

| Document | Statement | Current source |
| --- | --- | --- |
| `docs/intelligence/metrics-contract.md:20` | Article engagement is a "share of consented article documents" | `docs/intelligence/sql/models/12-article-engagement.sql:1–4` divides unmatched event counts; the ratio can exceed 1 |
| `docs/intelligence/audience-model.md:170`, `docs/intelligence/editorial-model.md:136` | "CI does not run these tests" | `.github/workflows/quality.yml:63` runs `npm run test:intelligence` |
| `docs/intelligence/editorial-intelligence.md:157` | "roughly five consented visitors per day" | No model counts visitors; say low consented event volume ([metrics contract](../intelligence/metrics-contract.md#data-minimization)) |
| `docs/race-desk-architecture.md:12–14,44` | Child tools at `georgiosbalatzis.github.io/...` | `scripts/race-desk/core/links.mjs:7,155` builds same-origin `https://f1-stories.gr/<tool>/` routes |
| `docs/race-desk-program.md:29` | R-03 "Draft #400 ... not released" | Same file line 7 and git history: #400 merged; later milestones R-04..R-09 merged |
| `docs/intelligence/event-inventory.md:3,97` | Inventory anchored at `5572beb7`; TYRES pin `c780d95f` | `scripts/deployment/sources.json:35` pins TYRES `50e5f50b`; child instrumentation at the current pin is **NOT VERIFIED** |
