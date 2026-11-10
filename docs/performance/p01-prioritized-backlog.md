# P-01 prioritized backlog

| Baseline | Pinned code SHA |
|---|---|
| Main | `58273df6d753510605468c0787d9cdf04d6d398e` |
| Telemetry | `38c3dd2018b810a5dce1add1f7663bcb199c845a` |
| Ghost Car | `13fc12afb7c73ccbab6e71fc3d3210d922038d51` |
| TYRES | `249aa796a1981be4f70213c9f1973b4418faf3ca` |
| BetCast | `74eeb98b4acb1b4e0ea45d4ab12f7fdf4e0c2650` |

**Evidence date:** 2026-11-10 UTC. **Scope:** adjudicated P-01 opportunities, proposed owners/phases and measurable future acceptance. P-01 performs no implementation. Rank is not authorization or execution order.

**Evidence key:** `M:path:line` refers to Main at the pin above; child prefixes use the named child pin. IDs/aliases and dimensions are in [findings.json](../../perf/p01/findings.json). Metrics/resources: [summary.tsv](../../perf/p01/summary.tsv), [resources.tsv](../../perf/p01/resources.tsv); checks: [checks.tsv](../../perf/p01/checks.tsv). `EV-*` receipts resolve in `local-bundle:p01-evidence.tar.gz#work/s1/evidence-receipts.json`; [evidence-index.json](../../perf/p01/evidence-index.json) supplies hashes/retrieval status.

**Limitations:** five supported opportunities do not establish five proven speedups. Three are measured profiling targets whose implementation is conditional on attribution. One synthetic host, replay/blocked providers, incomplete readiness, unknown bytes and unverified interactions constrain impact estimates. Field INP/CWV are unavailable. Production/local are separate baselines, never before/after. Compact data links were checked at 3dca15331; final closure changes require their own review. Every unmeasured saving is **TBD — requires P-0X measurement**.

## Evidence admission and scoring

The true ranked count is **5**, followed by **10 unranked hypotheses**. The remaining ten synthesis records preserve existing work or reject approaches. Only CONFIRMED or STRONGLY SUPPORTED observations are admitted to ranking; confidence in a source fact does not establish an intervention's benefit. We do not pad the list to 20 with uncertain deletions, prior work or aliases.

Each dimension is an integer 0–5: performance impact **P**, user experience **U**, build/developer productivity **D**, evidence confidence **C**, implementation complexity **X** and regression risk **R**.

`score = 4P + 3U + 2D + 2C − 2X − 2R`

Performance receives the largest weight; low effort alone cannot create impact. Confidence applies to the admitted defect/profiling target, not promised savings. Complexity/risk include the prerequisite experiments and affected contracts; generated output, child loading and historical media keep nonzero risk floors. Ties favor measured user impact and prerequisite value. There are no ties in the admitted five.

| Rank / ID / aliases | Category / admitted evidence | P / U / D / C / X / R | Score | Proposed owner / phase |
|---|---|---|---:|---|
| 1 S-02 / A-01 | Runtime / CONFIRMED shell cost | 3 / 3 / 1 / 4 / 3 / 3 | 19 | BetCast maintainer / P-04 |
| 2 S-04 / A-02, A-03 | Runtime / CONFIRMED counters and known bytes | 3 / 2 / 2 / 4 / 3 / 3 | 18 | Telemetry maintainer / P-04 |
| 3 S-01 / lighthouse | Maintenance/accessibility / CONFIRMED defect | 0 / 2 / 2 / 5 / 1 / 1 | 16 | Main maintainer / P-02 |
| 4 S-03 / build-check | Build reliability / CONFIRMED defect | 0 / 1 / 5 / 5 / 2 / 2 | 15 | Main maintainer / P-02 |
| 5 S-05 / A-04, C-01 | Runtime/images / STRONGLY SUPPORTED profiling target | 2 / 2 / 1 / 3 / 2 / 3 | 12 | Main media/build maintainer / P-03 |

Category balance follows evidence: three runtime investigations, one accessibility repair and one build reliability repair. Build acceleration, repository hygiene and architectural simplification have no admitted quantified intervention. They remain in the hypothesis queue. A-02/A-03 are one Telemetry investigation; A-04/C-01 are one shared-hero investigation; D-01/D-03 are one build-sharing hypothesis.

**P-02 comes first despite the numeric order.** Recover deterministic Main output, contrast and trustworthy gate execution before runtime implementation. Then P-03/P-04 can compare matched before/after runs. No ranked item authorizes a child release, Main pin update, merge or deployment.

## 1. S-02 — attribute BetCast mobile text paint

**Impact baseline:** production cold/light mobile CDP LCP **2708 ms [2704–2744], n=5**, highest primary mobile median. Representative LCP is `p.page-intro`. All five samples are data-incomplete and each has seven unknown-size requests. Local-built LCP **2720 ms [2692–2748], n=5** is a separate baseline. No usable-chart baseline or causal delay attribution exists. Expected saving: **TBD — requires P-0X measurement**.

Source entry: `BetCast:src/App.js:29`; `BetCast:src/services/googleSheetService.js:43`. EV-ATTEMPTS/NETWORK; representative capture `sha256-0ee5e9ba4bb96bd593a0fd8027c115efb4ed379aac696493ec8de246b99d5f5c`.

| Dimension | Justification |
|---|---|
| P=3 | Repeated 2708-ms mobile shell LCP is the largest primary mobile median; no causal saving is measured. |
| U=3 | Late introduction text affects the initial mobile reading task; useful analysis readiness remains unknown. |
| D=1 | Focused attribution gives an actionable next change; no maintenance-time reduction is demonstrated. |
| C=4 | Five shell samples agree; incomplete data and uncertain text/font/CSS/component cause limit confidence. |
| X=3 | Requires complete direct/proxy fixtures, font/CSS/commit traces and readiness probes. |
| R=3 | Loading-order changes may worsen text layout, themes, embeds or usable-chart timing. |

**Owner/phase:** BetCast maintainer, P-04. **Dependencies:** P-02 gate/identity recovery; complete successful and failed CSV/direct/proxy fixtures; owner authorization for the pinned child. Keep S-13 fallback work separate unless tracing establishes a shared cause.

**Acceptance test:** collect at least five matched before/after navigations per affected mobile/desktop cell, each environment separately, with fixed device/theme/cache/API/delivery/identity. Attribute the proposed delay and show improved LCP median/range alongside font/CSS/component timing, CSV-ready and chart-ready latency. A ≤2500-ms LCP is a proposed investigation goal for BetCast, not an existing child budget or observed field result. No readiness/interaction/CLS regression; preserve light/dark/auto/URL theme, embed protocol, errors and denied consent. If attribution shows no justified change, retain the implementation and report that outcome.

## 2. S-04 — attribute Telemetry bytes and initial work together

**Impact baseline:** production cold/light mobile known bytes **966475 B [966327–966535], n=5**: median **715817 first-party B** and **250658 replayed B**. Main-target TaskDuration **589.029 ms [573.457–611.727], n=5**. Representative charts/React chunks are 112850/59283 B, n=1; these are resource observations, not attributed library savings. Local-built known bytes 967916 B [967916–967916] and TaskDuration 625.624 ms [622.354–660.137], n=5 each, remain separate. Expected saving: **TBD — requires P-0X measurement**.

Source entry: `Telemetry:src/components/DashboardShell.tsx:34`; `Telemetry:src/components/dashboard/TelemetryTab.tsx:3`; `Telemetry:vite.config.ts:32`. EV-ATTEMPTS/NETWORK; capture `sha256-80f29c19302ded9c652de9b683472f64240b78f70645b1ce0afe0a3784c8336e`.

| Dimension | Justification |
|---|---|
| P=3 | Largest primary production mobile recorded byte total and main-target task duration merit attribution. |
| U=2 | Initial work may delay charts; chart readiness was not assessed in those navigation samples. |
| D=2 | One experiment avoids separately refactoring the same request/chunk/initialization twice. |
| C=4 | Five samples reproduce counters/bytes; replay and missing per-library attribution constrain conclusions. |
| X=3 | Must map emitted chunks to requests/tasks and add successful chart-readiness measurements. |
| R=3 | Deferring a default chart/data path can move cost to interaction or break cancellation/tab behavior. |

**Owner/phase:** Telemetry maintainer, P-04. **Dependencies:** P-02 measurement recovery; complete session fixtures and chart-ready probe; authorization for child implementation/release. API-sharing hypothesis S-14 is not a prerequisite to optimization.

**Acceptance test:** map actual emitted resources and attributed work, then collect n≥5 matched before/after primary cells. Report first-party compressed transfer, replay bodies and unknown counts separately; retain ScriptDuration, TaskDuration and attributed tasks without calling TaskDuration TBT. Demonstrate the identified reduction with no worse first-use chart readiness, selected-tab latency, warm/on-demand cost, cancellation, data accuracy or consent behavior. Test every affected tab in both themes and mobile/desktop. No package replacement/deferral is accepted merely from the byte total.

## 3. S-01 — repair Blog empty-month contrast

**Impact baseline:** canonical Blog Gate E accessibility **96/100 in 3/3 runs**, threshold ≥98; **six contrast nodes/run at 3.58:1**, required ≥4.5:1. This is independently attributable despite the provider DNS wrapper. No speed saving is claimed. Expected saving: **TBD — requires P-0X measurement**.

Source entry: `M:blog-module/blog/archive-editorial.css:125`; `M:blog-module/build/discovery.js:242`. EV-GATE-BLOG-1/2/3, selector `ol.ed-cal__months > li > span.is-empty > span`, foreground `#7d7871` on `#242321`.

| Dimension | Justification |
|---|---|
| P=0 | No runtime speed improvement is demonstrated. |
| U=2 | Six calendar captions fail a reading/accessibility task with a narrow component scope. |
| D=2 | Repairs a concrete existing accessibility gate. |
| C=5 | Three saved runs and matching CSS identify the same defect independently of DNS errors. |
| X=1 | One component rule and normal minified/hash consumers need review. |
| R=1 | Scoped color/opacity treatment has limited visual risk; global token changes are unnecessary. |

**Owner/phase:** Main maintainer, P-02. **Dependencies:** successful-response gate fixtures for full phase acceptance; normal generated CSS/hash review. The component defect can be reproduced without attributing the other Lighthouse failures.

**Acceptance test:** each empty-month label ≥4.5:1 in light/dark at 390/768/1440; Blog accessibility ≥98 in three clean canonical-route runs. Preserve labels/counts/links/empty semantics, keyboard/focus and layout. Review `archive-editorial.min.css` and only expected stylesheet-hash consumers. Keep every budget unchanged and run relevant Edition/tablet checks from the [handoff](p01-handoff.md).

## 4. S-03 — restore generated-output coherence

**Impact baseline:** build:check exits 1 on **3 tracked paths**, diff **60 insertions/60 deletions**. **n=2 independent builds repeat the paths**, with one exact diff retained; byte-identical second output is not established. Public build generation already updates these outputs, so the observed problem is tracked coherence/gate reliability. Expected saving: **TBD — requires P-0X measurement**.

Source entry: `M:scripts/build/generated-drift-guard.mjs:15`; `M:scripts/build/author-research.mjs:6`; `M:blog-module/build/home-panels.js:163`; `M:scripts/build/stamp-html.mjs:252`. EV-GATE-BUILD-CHECK/DRIFT/INCREMENTAL. Expected generated paths: `index.html`, `scripts/author/research-catalog.json`, `standings/index.html`.

| Dimension | Justification |
|---|---|
| P=0 | No build-time saving has been measured. |
| U=1 | Tracked round output is stale; public generation already rebuilds it, limiting the demonstrated user effect. |
| D=5 | Trustworthy build:check is a prerequisite for later implementation and review. |
| C=5 | Gate log, exact diff and independent cold build identify the same paths. |
| X=2 | Review normal generation and authoritative data cut; no new pipeline is justified. |
| R=2 | Generated sporting/editorial values and ordering must be reviewed rather than accepted blindly. |

**Owner/phase:** Main maintainer with editorial/data owner, P-02. **Dependencies:** owner decision on authoritative tracked season/data cut and review of round19→round20 output. There is no evidence requiring a drift-guard or generator rewrite.

**Acceptance test:** after the reviewed correction, two clean Node 22 builds each leave zero tracked generated drift and build:check exits 0. Retain test:incremental/test:deployment assertions; inspect season totals/order/round labels/research list and canonical/SEO invariants. No generated-file exemption, input alteration to hide failure or budget reset. New generator defects require a separate measured scope decision.

## 5. S-05 — profile shared home/article hero delivery

**Impact baseline:** home production mobile LCP **2320 ms [2316–2336], n=5**; representative LCP image **146091 B, n=1**. Latest local mobile/tablet/desktop each request the same **145952-B AVIF, n=1 per width**. Responsive descriptors and preloads already align; rendered boxes/currentSrc/DPR/fidelity comparison is missing. These are separate conditions, not a saving. Expected saving: **TBD — requires P-0X measurement**.

Source entry: `M:index.html:33`; `M:index.html:149`; `M:blog-module/build/article-render.js:508`; `M:blog-module/build/article-render.js:528`; `M:scripts/build/stamp-html.mjs:871`. EV-RUNS/NETWORK; home capture `sha256-56891e32115e0a637e09da1420a7269e3500cf100b670e81be623d9c105cae92`.

| Dimension | Justification |
|---|---|
| P=2 | A material LCP image is identified; oversizing and recoverable bytes are unproved. |
| U=2 | Home mobile LCP is 2320 ms, already below 2500 ms under this CDP profile. |
| D=1 | One selection experiment can serve home/latest without conflating route results. |
| C=3 | LCP/request evidence agrees, but boxes/currentSrc and a beneficial alternative are missing. |
| X=2 | Requires selection/priority/reuse/DPR and fidelity observations before derivative changes. |
| R=3 | Truthful srcset, protected historical URLs and editorial image fidelity constrain implementation. |

**Owner/phase:** Main media/build maintainer, P-03. **Dependencies:** P-02 trustworthy delivery baseline; rendered-pixel/fidelity observations and owner decision for any visible trade-off. Keep frame-preload S-10 as a separate hypothesis even if profiled alongside it.

**Acceptance test:** record currentSrc, intrinsic/rendered dimensions, DPR, preload reuse/priority, decode and LCP at 390/768/1440, both themes. Collect n≥5 matched before/after navigation samples per affected route/environment; show improved same-environment LCP or known image bytes with preserved fidelity and no loading/layout regression. Home/article and production/local remain separate. Image integrity, originals/direct/social URLs and source-less historical pages must remain valid. If selection is appropriate, retain current delivery.

## Unranked hypothesis queue

No scores or ranks are assigned below. Owners are proposed accountable roles. Each needs its stated measurement and dynamic-state evidence before admission or implementation. Every expected saving is **TBD — requires P-0X measurement**.

| ID / aliases / category | Verified fact and missing evidence | Owner / phase / dependency | Experiment and acceptance for any later proposal |
|---|---|---|---|
| S-06 / B-01 / Architecture | Residual nav skin is documented T9, not proven redundant structure/skin. `M:styles/shared-nav.css:61`; `M:styles/editorial.css:264`; `M:docs/css-architecture.md:8` | Main CSS maintainer / P-05 / dynamic/computed-style fixtures; supersedes B's P-04 | Measure maintenance benefit/declarations before scoped migration; computed styles/nav/focus/hover/active equal across themes/widths; no rendering regression. High cascade risk. |
| S-07 / B-02 / Architecture | Table structural and editorial rules serve generated/history/card/scroll states. No removable rule set. `M:blog-module/blog/article-styles.css:14`; `M:blog-module/blog/article-editorial.css:369` | Main CSS maintainer / P-05 / generated/historical table fixtures; supersedes P-04 suggestion | Compare computed styles, visibility/overflow and keyboard behavior in both themes/three widths; show measurable net benefit before consolidation. High content/cascade risk. |
| S-08 / B-03 / Runtime | Different iframe protocols/origins and cleanup, no insertion/theme cost attribution. `M:blog-module/blog/article-embeds.js:7`; `M:blog-module/blog/article-embeds.js:106`; `M:blog-module/blog/article-script.js:663` | Main JS maintainer / P-05 / complete three-frame fixture | Count scans/observers/timers/messages under initial/async insertion/theme/error/teardown; reduce demonstrated duplicate work while retaining protocol/origin checks. High integration risk. |
| S-09 / B-04 / Runtime | Existing RAF/cached geometry plus distinct article sector bar; no attributed scroll cost. `M:scripts/shared-nav.js:500`; `M:blog-module/blog/article-script.js:93` | Main JS maintainer / P-05 / controlled long-article scroll trace | Attribute callback/RAF/layout windows at mobile/desktop; retain both progress visuals, resize and focus; share reads only if measured benefit exists. |
| S-10 / C-02 / Runtime/images | Local tablet frame 264058 B, n=1; reuse/visibility/contention absent. `M:index.html:35`; `M:index.html:156` | Main media maintainer / P-03 / P-02 delivery baseline | Observe visibility/preload reuse/priority and hero contention, then compare same-environment cold/warm/fidelity; no automatic preload removal. |
| S-11 / D-01, D-03 / Build acceleration | Four full-mode quality builds; fourth conditional. No matched shared-build experiment. `M:.github/workflows/quality.yml:45`; `M:.github/workflows/quality.yml:115`; `M:.github/workflows/quality.yml:163`; `M:.github/workflows/quality.yml:231` | Build/CI maintainer / P-07 / P-02 deterministic outputs, matched events/revisions | Compare wall critical path, queue, job minutes, transport and complete generated-input hashes; identical full/content-only suites and provenance, no worse publication latency. |
| S-12 / E-01 / Architecture | Independent shells/P1–P6 and intentional URL variants; no drift/update-effort series. `Telemetry:src/copy.ts:187`; `Ghost Car:src/app/siteNav.js:1`; `TYRES:index.html:23`; `BetCast:src/components/SiteMasthead.jsx:52` | Main + child maintainers / P-08 / existing parity checks and compatible releases | Measure incidents/update effort first; retain standalone/aggregate/embed/old-pin/theme/nav/P1–P6 parity. Prefer a bounded contract over a runtime package. |
| S-13 / E-02 / Runtime/data | Sequential 8 s/6 s fetch timers sum to 40 s configuration; observed latency/body-read/prevalence unknown. `BetCast:src/services/googleSheetService.js:24`; `BetCast:src/services/googleSheetService.js:43` | BetCast maintainer / P-04 / complete direct/proxy/cache/error fixtures | Measure real success/error/body-read and cache cases, then test CSV/CORS/privacy/freshness/rate-load/cancellation before reordering. Does not explain text LCP by itself. |
| S-14 / E-03 / Architecture/data | Shared provider with distinct inclusive-date/batching/cancellation semantics; no duplicate independent-visit cost. `Telemetry:src/api/openf1.ts:174`; `Telemetry:src/api/openf1.ts:392`; `Ghost Car:src/services/openf1.js:41` | Telemetry + Ghost Car maintainers / P-04 / compatible exact-query recordings | Compare session/operator/query semantics, waterfall, rate limits, partial failures and cancellation. Shared recordings precede any shared-client proposal. |
| S-15 / F-01, F-C01 / Repository hygiene | Listed groups: tracked 26107749 gross repeated B/294 groups/719 files; aggregate 24311688 B/300 groups/743 files; n=one inventory/scope, all listed groups rehashed. Distinct URLs referenced. `M:blog-module/blog-entries/20250424-3GF/article.html:19`; `M:blog-module/blog-entries/20250424G/article.html:19`; `M:scripts/build/public-media-integrity.mjs:6` | Main content/artifact maintainer / P-06 / full generated/runtime/history/social/direct references | Establish recoverable repository/artifact/route bytes separately with unchanged protected hashes and published URLs; highest deletion risk. Gross repetition is not a savings estimate. |

## Rejected and deferred proposals

The implementation mechanisms for S-02/S-04/S-05 are **deferred** until their profiles justify a specific change. Ranked investigation does not admit assumed font, bundle, chart or image edits. Unranked S-06–15 remain deferred pending the experiments above. Additional dark/tablet/layout diagnosis, missing functional journeys and full publication timing are measurement work, not extra ranked opportunities.

| Record / proposal | Disposition and reason | Verification / future boundary |
|---|---|---|
| S-16 / C-03: split Dirty Air again | REJECTED size-only runtime case; already index/session partitioned, source aggregate absent in artifact. `M:standings/tabs/dirty-air.js:509`; `M:standings/tabs/dirty-air.js:1268` | Preserve data normalization/cache/fallback; P-03/P-04 may measure actual selected-session costs. |
| S-17 / C-04: partition blog source cache for reader speed | REJECTED build/runtime confusion. `M:blog-module/build/index.js:1156`; `M:blog-module/build/home-panels.js:382` | Retain build-only boundary; P-07 investigation only if build profiling warrants it. |
| S-18 / D-02: force TYRES hits or introduce child caching | PRESERVE current verified cache/freshness; three historical samples do not prove avoidable misses. `M:scripts/deployment/release.mjs:186`; `M:scripts/deployment/build.mjs:53` | P-07 requires miss causes; never weaken pin/data/Node/hash checks or scheduled refresh. |
| S-19 / E-04: infer zero startup from lazy syntax | REJECTED inference; preserve existing boundaries. Representative BetCast analysis chunk 119028 B is initially requested. `BetCast:src/App.js:29`; [resources.tsv](../../perf/p01/resources.tsv) | P-04 default/optional view readiness and emitted-chunk attribution before further deferral. |
| S-20 / E-05: consolidate repositories/frameworks, mandate runtime package or migrate BetCast builder | REJECTED without quantified net benefit; independent versions/pins/toolchains/embed/subpath contracts. `M:scripts/deployment/sources.json:13`; child package anchors in [inventory](p01-codebase-inventory.md) | P-08 measured drift/coupling trade-off and separate owner decision. |
| S-21 / F-02, F-C02: delete JSZip exception | REJECTED; explicit author ZIP consumer. `M:scripts/build/public-artifact.mjs:45`; `M:scripts/author/dom-tools.js:60` | Preserve author DOCX/ZIP actions; package path is not deletion evidence. |
| S-22 / F-03, F-C03, F-C04: delete tabs/classes/media/history on static absence | REJECTED; dynamic/generated/protected contracts. `M:standings/standings.js:87`; `M:blog-module/build/index.js:887`; `M:scripts/build/public-media-integrity.mjs:6` | P-06 requires complete references and old/direct/social URL plus protected-media tests. F-C01's specific referenced-image deletion is also rejected within S-15. |
| S-23 / B-R1: remove two stylesheet transfers | REJECTED premise; normal link/noscript and public inliner fallback removal. `M:standings/index.html:52`; `M:standings/index.html:54`; `M:scripts/build/inline-head-css.mjs:32` | Keep source/built no-JS compatibility. |
| S-24 / B-R2: delete author CSS from reader coverage | REJECTED; author-only ownership. `M:docs/css-architecture.md:18`; `M:docs/css-architecture.md:20` | Preserve author preview/theme and publishing fixtures. |
| S-25 / B-R3: remove SW cleanup or claim offline fallback | PRESERVE migration, local fixture n=1; all six fresh offline probes fail. `M:scripts/sw-cleanup.js:1`; `M:sw.js:1`; [cache.tsv](../../perf/p01/cache.tsv) | Retain old registration/cache/one-reload checks; no active worker gain claimed. |

Prior October cleanup, inlining, responsive imagery, local fonts/icons, minification, scroll/observer guards, lazy reports, JSON revalidation, image/child caches, digest skips and fast paths are completed work, not new backlog gains. Source/test details are in the [redundancy ledger](p01-redundancy-ledger.md). No new safe dependency or media deletion is proved. Blanket inline-CSS externalization, CSS-layer rewrites, unfetched-font removal, history purging and source-size-only partitioning have no admitted case.

G's obsolete claim that the aggregate runtime audit was not run is rejected: EV-GATE-RUNTIME-AGGREGATE records PASS/exit 0. Do not excuse Blog contrast as DNS-induced, equate unknown/blocked bytes to zero, label TaskDuration TBT, manufacture field INP or treat production-minus-local as savings. Gate F remains independent of this ranking. Expected savings for all deferred/rejected alternatives remain **TBD — requires P-0X measurement**.
