# P-01 executive summary

| Baseline | Pinned code SHA |
|---|---|
| Main | `58273df6d753510605468c0787d9cdf04d6d398e` |
| Telemetry | `38c3dd2018b810a5dce1add1f7663bcb199c845a` |
| Ghost Car | `13fc12afb7c73ccbab6e71fc3d3210d922038d51` |
| TYRES | `249aa796a1981be4f70213c9f1973b4418faf3ca` |
| BetCast | `74eeb98b4acb1b4e0ea45d4ab12f7fdf4e0c2650` |

**Evidence date:** 2026-11-10 UTC. **Scope:** synthesis of the runtime, source/artifact, five-app and publishing evidence in the three reports below. P-01 is audit-only; this report does not implement P-02 or attest final independent approval, PR delivery, merge or deployment.

**Evidence key:** `M:path:line` means Main at the SHA above; child-prefixed references use that child's pin. `S-*` is the adjudicated ID in [findings.json](../../perf/p01/findings.json). Identity/units are in [baseline.json](../../perf/p01/baseline.json) and [README](../../perf/p01/README.md). Raw evidence is addressed as `local-bundle:p01-evidence.tar.gz#<path>`; [evidence-index.json](../../perf/p01/evidence-index.json) supplies hashes/retrieval status. Local references alone do not establish durable upload.

**Limitations:** one synthetic host/browser, incomplete app readiness, unverified interaction contexts and n=1 diagnostic screens/Lighthouse. Production and local-built remain separate series and are never subtracted. Field INP and Core Web Vitals are unavailable. Every unmeasured saving is **TBD — requires P-0X measurement**.

## Current health

**The first implementation priority is restoring a trustworthy Main quality baseline.** Generated-output drift and Blog calendar contrast are bounded, reproduced defects. The clearest runtime investigation targets are BetCast mobile text paint, Telemetry initial work, and the shared home/article hero. Their costs are measured; the specific changes that would reduce them are not yet established.

The [runtime baseline](p01-runtime-baseline.md) covers eleven routes in production and local-built. Each environment has 80 primary cold CDP observations: eight routes × mobile/desktop × five, light theme. Secondary, tablet, dark, warm, API, interaction and offline observations are separately labelled. Collection used Chrome for Testing 158.0.8127.18 on Apple M3 Pro/36 GiB, controlled Slow 4G and CPU ×4. Host/default Node: 26.13.0; retained collection runner selects Node 22.23.4; actual collection-process Node was not captured per attempt and is unverified. Build/check Node is 22.23.4; TYRES uses Node 24.22.2. These are lab results, not field performance or physical-device speed.

### Production: current controlled mobile observations

Cold/light CDP, **n=5 per row**, median [minimum–maximum]. Providers are replayed/blocked; LCP is shell paint and does not establish usable-data readiness.

| Target | Measured observation | Practical implication |
|---|---|---|
| BetCast | LCP 2708 ms [2704–2744] | Highest primary mobile median; representative LCP is introduction text; all five data-incomplete |
| Telemetry | Known 966475 B [966327–966535]; TaskDuration 589.029 ms [573.457–611.727] | Largest primary mobile recorded byte/counter cost; known bytes include median 250658 replayed B, with 715817 first-party B |
| Home | LCP 2320 ms [2316–2336] | Representative LCP hero 146091 B, n=1; image selection/priority merits profiling, oversizing unproved |
| Latest article | LCP 2220 ms [2088–2296] | Shell timing only; managed-embed data incomplete |

### Local-built: separate controlled mobile observations

Cold/light CDP, **n=5 per row**, same lab profile; local HTTP/1.1 gzip, aggregate/data provenance differs from production. These are not before/after values.

| Target | Measured observation |
|---|---|
| BetCast | LCP 2720 ms [2692–2748] |
| Telemetry | Known 967916 B [967916–967916]; TaskDuration 625.624 ms [622.354–660.137] |
| Home | LCP 2332 ms [2324–2336] |
| Latest article | LCP 1772 ms [1768–1776] |

TaskDuration is a main-target cumulative counter, **not TBT**. Known transfer excludes unknown request sizes and includes replay where present. Telemetry's representative charts/React chunks are 112850/59283 B, not attributed library savings. BetCast has seven unknown-size requests/sample. Source anchors: `Telemetry:src/components/DashboardShell.tsx:34`; `Telemetry:vite.config.ts:32`; `BetCast:src/App.js:29`; hero `M:index.html:33` and `M:index.html:149`. Full devices/ranges/resources are in [summary.tsv](../../perf/p01/summary.tsv) and [resources.tsv](../../perf/p01/resources.tsv).

**Benchmark Lighthouse n=1 with providers blocked** is diagnostic, with no settled audited-page assertion. It supplies no stable score precision and is separate from CDP and Gate E. **Standings `tab-pit-stops` and `session` NOT MEASURED**: round 17 replay data does not match the selected round 20 race list. Forty interaction contexts lack a fully verified assertion set; their Event Timing values are LAB, never field INP. Latest/BetCast have 40 data-incomplete primary observations across both environments/devices.

## Confirmed defects, observed costs and checks

| Finding / check | Evidence and result | Action boundary |
|---|---|---|
| S-03 generated coherence | **build:check BASELINE FAILURE**: three paths,60 additions/60 deletions; independent cold incremental build repeats paths | Review authoritative data cut and normal generation; retain the drift guard |
| S-01 calendar contrast | Blog accessibility 96/100 vs ≥98 in three Gate E runs; six empty-month labels/run at 3.58:1 vs 4.5:1 | Component-scoped contrast correction after authorization; independent of DNS error |
| Runtime audit | **audit:runtime PASS on Main and aggregate**, two separate target logs | Preserve both results; aggregate log does not itself supply a cryptographic tree digest |
| Other named Gate E checks | build:public, check:assets, quality:static, perf:budget, test:deployment and test:incremental PASS | No historical overage/failure count copied into this baseline |
| Gate E Lighthouse | **Ran behind a DNS guard; seven assertions remain BLOCKED**; command exit 1, mixed assertion outcomes | Retain observed failures; repair measurement before clean product attribution |

Drift affects `index.html`, `scripts/author/research-catalog.json`, `standings/index.html`: tracked round 19 output lags round 20 inputs. Current generators explain it (`M:scripts/build/author-research.mjs:6`; `M:blog-module/build/home-panels.js:163`; `M:scripts/build/stamp-html.mjs:252`). There is no evidence that Node/date differences require changing the guard. Contrast source is `M:blog-module/blog/archive-editorial.css:125`, generated calendar `M:blog-module/build/discovery.js:242`.

The seven blocked Lighthouse assertions are four best-practices scores 96/100 caused by guard-induced Jolpica DNS console errors, Home/Article LCP attribution under guarded local delivery, and Article third-party request attribution under a loopback origin. Observed LCP medians 2627.098/2554.348 ms and request count 14 versus≤8 remain retained observations. Ten production-origin BetCast requests are external to the loopback first party, and failed requests still count (`M:scripts/perf/lighthouse-guard.mjs:373`). Do not subtract requests or excuse Blog contrast to claim green checks. [Build pipeline](p01-build-pipeline.md) and [checks.tsv](../../perf/p01/checks.tsv) contain the complete result boundaries.

## Redundancy and codebase implications

The [codebase inventory](p01-codebase-inventory.md) separates 5300 tracked files/263683752 raw B from the local aggregate's 5547 files/405433924 raw B. Artifact size is not a typical route transfer. Sum of per-file gzip is not an archive size or network total.

- Full-mode quality independently builds four suite artifacts; the browser build is conditional for content-only changes (`M:.github/workflows/quality.yml:45`; `M:.github/workflows/quality.yml:115`; `M:.github/workflows/quality.yml:163`; `M:.github/workflows/quality.yml:231`). This is intentional parallelism and the basis for one unproved build-sharing hypothesis, not four savings.
- Listed tracked duplicate media groups contain 26107749 gross repeated B; aggregate groups 24311688 B. Every listed group was rehashed, but published article/social/direct URLs remain constraints (`M:blog-module/blog-entries/20250424-3GF/article.html:19`; `M:blog-module/blog-entries/20250424G/article.html:19`; `M:scripts/build/public-media-integrity.mjs:6`). Gross repetition is not removable storage or route savings.
- Shared-nav/editorial skin and article table rules overlap intentionally or as documented debt. No removable declaration set, dynamic-state equivalence or runtime penalty is established (`M:styles/shared-nav.css:61`; `M:styles/editorial.css:264`; `M:blog-module/blog/article-styles.css:14`; `M:blog-module/blog/article-editorial.css:369`).
- Different embed protocols and two progress interfaces do not establish duplicated work. Exact insertion/theme and attributed scroll experiments remain missing (`M:blog-module/blog/article-embeds.js:7`; `M:blog-module/blog/article-script.js:663`; `M:scripts/shared-nav.js:500`).
- Independently maintained child shells and P1–P6 metadata may benefit from existing parity checks; incident/update-effort savings are unmeasured. React 19/18, Three versions, Node 22/24, standalone/embed/subpath contracts and independent pins make generic consolidation costly (`M:scripts/deployment/sources.json:13`; child manifests in [app-dependencies.tsv](../../perf/p01/app-dependencies.tsv)).

No new safe dependency, source, selector or media deletion is supported. All 14 Main direct dependencies have representative callers. Build-only blog source cache and already partitioned Dirty Air are not initial browser bloat. Author CSS/JSZip and protected historical assets have real consumers (`M:blog-module/build/index.js:1156`; `M:standings/tabs/dirty-air.js:509`; `M:scripts/build/public-artifact.mjs:45`; `M:scripts/author/dom-tools.js:60`).

## Publishing and build health

The [build pipeline](p01-build-pipeline.md) maps trusted author/head/URL guards, quality, serialized maintenance, generation/commit retry, current-main aggregate assembly, validation, upload and Pages release. The audit did not publish anything.

Three captured historical standalone Deploy Pages runs elapsed 1029–1088 s. Their Main stages were 50.427–52.556 s and TYRES 102.652–111.702 s, n=3 each. Telemetry/Ghost Car/BetCast had verified cached output in every selected run. These samples are historical, include two older Main SHAs and are not a fleet hit rate or avoidable-time estimate. The local standalone build:public 23.923 s, n=1, is a separate series. Nested verification, upload and CPU costs are not isolated.

A shared quality build could reduce repeated compute but introduce upload/download, queues and a serial dependency; some tests need generated inputs outside dist. Wall time, runner-job minutes, queue and CPU must remain distinct. Child/image caching, digest-based incremental generation, content-only/ARTICLE_FAST_PATH and latest-main serialized deployment already exist (`M:.github/actions/build-pages/action.yml:28`; `M:scripts/deployment/release.mjs:186`; `M:blog-module/build/input-digest.js:4`; `M:scripts/build/classify-quality.mjs:19`). Do not sell their introduction as new work or bypass TYRES freshness to force hits.

## Preserved optimizations and rejected approaches

| Preserve | Why / pinned source |
|---|---|
| Ordered full head-CSS inlining, local font/icon subsets | Delivered cold-rendering architecture; external CSS zero is not zero CSS (`M:scripts/build/public-artifact.mjs:454`; `M:scripts/build/stamp-html.mjs:1046`) |
| Responsive AVIF/WebP, truthful widths, matched preloads and historical fidelity | Existing delivery work; no currentSrc/box/fidelity case for blanket shrinking (`M:blog-module/build/image-sizes.js:27`; `M:blog-module/build/article-render.js:528`) |
| Lazy report/chart/3D boundaries and retained Tyre Pace chart | Protect initial/interaction trade-offs; lazy syntax does not prove zero startup transfer (`M:standings/standings.js:87`; `M:standings/tabs/tyre-pace.js:70`; `TYRES:src/ui/app.ts:434`) |
| Dirty Air index/session, round snapshots and JSON revalidation | Already partitioned/runtime-specific; source aggregate size is not route cost (`M:standings/tabs/dirty-air.js:1268`; `M:standings/core/rounds.js:25`; `M:standings/core/fetchers.js:19`) |
| Nav/scroll filters, read-before-write progress, consent gating | Prior runtime work and privacy boundary (`M:scripts/shared-nav.js:468`; `M:blog-module/blog/article-script.js:114`; `M:scripts/analytics.js:314`) |
| Legacy SW cleanup | Local migration fixture passed n=1; six fresh offline probes fail, so no active offline fallback claim (`M:scripts/sw-cleanup.js:1`; `M:sw.js:1`) |
| Release pins, data freshness, verified caches and trusted-head/retry guards | Build correctness before speed (`M:scripts/deployment/release.mjs:186`; `M:.github/actions/commit-and-push/action.yml:52`) |

Reject the two-full-transfer claim for standings' normal link/noscript fallback (`M:standings/index.html:52`; `M:standings/index.html:54`; `M:scripts/build/inline-head-css.mjs:32`). Also reject coverage-only deletion, first-time minification/cache/fast-path proposals, blanket inline-CSS externalization, new shared runtime packages/repository consolidation and BetCast builder migration without a quantified case. Previous October cleanup is completed work, not a fresh finding (`M:docs/dead-code-cleanup-progress.md:23`).

## Top opportunities and evidence admission

Only **five** opportunities meet CONFIRMED/STRONGLY SUPPORTED admission: two quality defects and three measured profiling targets. No list is padded to 20. CONFIRMED describes the observed cost/defect, not an untested saving or assumed mechanism. Ten other proposals remain an unranked hypothesis queue.

Score = `4×performance + 3×UX + 2×DX + 2×confidence − 2×complexity − 2×risk`, each dimension 0–5. Ties favor measured user impact/prerequisites. Dimensions below are P/U/D/C/X/R. Prerequisites override numerical order: recover Main's gates in P-02 before runtime changes.

| Rank / ID | Evidence / score (dimensions) | Owner / phase | Required experiment or acceptance | Expected saving |
|---|---|---|---|---|
| 1 S-02 | CONFIRMED shell cost;19 (3/3/1/4/3/3) | BetCast maintainer / P-04 | Complete fixtures; attribute text/font/CSS/component delay; matched n≥5 LCP and useful-chart readiness, each environment separately | TBD — requires P-0X measurement |
| 2 S-04 | CONFIRMED counters/known bytes;18 (3/2/2/4/3/3) | Telemetry maintainer / P-04 | One chunk/request/task/readiness experiment; preserve cancellation/tabs; n≥5 plus warm/on-demand costs | TBD — requires P-0X measurement |
| 3 S-01 | CONFIRMED contrast defect;16 (0/2/2/5/1/1) | Main maintainer / P-02 | Each label≥4.5:1, Blog accessibility≥98 in three clean runs; preserve themes/content/keyboard behavior | TBD — requires P-0X measurement |
| 4 S-03 | CONFIRMED generated drift;15 (0/1/5/5/2/2) | Main maintainer / P-02 | Approved data cut; two clean Node 22 build:check passes; zero drift exemptions, all incremental/deployment assertions retained | TBD — requires P-0X measurement |
| 5 S-05 | STRONGLY SUPPORTED profiling target;12 (2/2/1/3/2/3) | Main maintainer / P-03 | currentSrc/boxes/DPR/reuse/fidelity and matched n≥5 LCP; home/article remain separate | TBD — requires P-0X measurement |

BetCast leads on repeated shell delay, but readiness and mechanism uncertainty raise complexity/risk. Telemetry combines byte and CPU investigation to avoid counting the same work twice. Contrast has no claimed speed benefit; it repairs a narrow reading/accessibility defect. Drift scores for developer reliability, not an invented runtime saving. Hero evidence identifies a material resource, not proven oversizing. Full justifications, aliases, dependencies and regression tests are in [findings.json](../../perf/p01/findings.json).

Unranked hypotheses are S-06 nav skin, S-07 table CSS, S-08 managed embeds, S-09 progress callbacks, S-10 frame preload, S-11 quality build sharing, S-12 shell contracts, S-13 BetCast fallback, S-14 OpenF1 reuse, S-15 media deduplication. Each needs its named experiment before implementation; all unmeasured savings remain **TBD — requires P-0X measurement**.

## Major risks and evidence gaps

| Gap / risk | Consequence and disposition |
|---|---|
| Gate setup and local identity | Local per-attempt release is null; complete bracketing is absent. Manifest outputDigest and Gate E tree hash differ in scope/algorithm. Future P-02 runs must record separate Main/aggregate identities before/after; old runs cannot be retroactively certified. |
| Fixtures and useful-data readiness | Standings round mismatch, incomplete latest/BetCast and live-provider paths prevent full app claims. P-04 requires exact successful query/session fixtures and fail-closed misses. |
| Protocol validity and variance | Lighthouse audited-page assertions unobserved;40 interaction contexts unverified. Battery rather than planned adapter, unisolated contention/trace overhead, n=1 dark/tablet CLS spikes and missing reserve checks constrain certainty. |
| Dynamic/author/history regressions | CSS cascade/themes/tables, managed origins/messages, dual progress UI, source-less media, direct/social URLs and author tools require fixtures before deletion or migration. |
| API/release coupling | BetCast's sequential fetch-timer sum 40 s is configuration, not measured latency; OpenF1 clients differ in date/cancellation semantics. Shared packages, concurrent fallbacks or changed freshness require correctness/provider-load evidence. |
| CI/publication attribution | Three successful samples are not matched full/fast or fleet cache efficiency; queue/job elapsed/CPU and parent/reusable overlap cannot substitute for a full publication journey. |
| Field evidence | Field INP and Core Web Vitals unavailable; no new tracking, consent change or credentials authorized. |
| Review/retention/integration | Bundle checksums exist, but final durable delivery, integrated compact links/diff allowlist and independent Gate F verdict must still be verified by the coordinator/reviewer. These documents do not self-approve P-01. |

Existing Lighthouse and size budgets remain unchanged: score 95/98/100/100, LCP≤2500 ms, CLS≤0.02, TBT≤100 ms, third-party requests≤8, plus route-specific DOM/byte and graph limits (`M:perf/lighthouse-budget.json:1`; `M:perf/size-budget.json:1`; `M:scripts/perf/size-guard.mjs:170`). A failed or blocked check does not authorize resetting a budget or hiding generated drift.

## P-02 through P-10 implications and decisions

These are recommended phase assignments, not a claim that P-01 authorizes implementation. Each phase depends on adequate evidence and review of its specific changes. Every unmeasured phase saving is **TBD — requires P-0X measurement**.

| Phase | Exact direction / prerequisite | Acceptance and decision |
|---|---|---|
| **P-02 Main baseline recovery** | First reproduce three-path drift. Review authoritative tracked data cut, regenerate expected outputs, fix calendar empty-month contrast. Add a small tooling-only successful-provider/identity/assertion repair for the unchanged Lighthouse guard. | Separate reviewable changes for tooling, generated output and contrast. Two clean Node 22 drift passes; all labels≥4.5:1 and Blog accessibility≥98; all seven blocked assertions receive real pass/failure on identified Main/aggregate; budgets unchanged. Owner chooses authoritative data cut and exact implementation scope. |
| **P-03 images/fonts/payloads** | Trustworthy P-02 delivery baseline, S-05 hero and S-10 frame study; record currentSrc/boxes/DPR/priority/reuse and parse evidence. | Matched same-environment n≥5; preserve image fidelity, source-less originals, URLs and truthful descriptors. No source-size-only JSON/font change; owner decides any visible fidelity trade-off. |
| **P-04 app runtime/data** | P-02 assertions/identity and complete round/session/direct/proxy fixtures. Attribute S-02 BetCast text and S-04 Telemetry chunks/tasks/readiness; study S-13/S-14 failures/query semantics separately. | Matched n≥5 shell and useful-data/interaction checks, both themes/devices; preserve rate limits, cancellation and CSV/data correctness. Child implementation/release and Main pin update need separate review/authorization. |
| **P-05 Main CSS/JS** | Dynamic/historical/table/author computed-style fixtures and exact S-08 insertion/theme, S-09 attributed scroll experiments. Repeat Main screen issues before diagnosing. | Prove declaration/work reduction and state equivalence, both progress UIs and origin/message security. No blanket cascade/layer rewrite or observer merging by appearance. |
| **P-06 hygiene** | Complete reference/URL/protected-media and dynamic-reachability audit before S-15 storage changes. | Report recoverable repository/artifact/route bytes separately; preserve direct/social/history/author/SW migration paths. No dependency deletion from package names or coverage. |
| **P-07 CI/publishing** | Deterministic P-02 outputs; matched events/revisions/full/fast cases, generated-source parity, cache-miss reasons and nested-stage timings. | S-11 compares wall/queue/job-minutes/transport independently with unchanged suites/provenance. Preserve TYRES freshness, verified caches and trusted-head/retry guards. Owner review before build-sharing architecture changes. |
| **P-08 cross-app contracts** | Measure actual drift/update effort for S-12; reuse existing checks and compatible fixtures first. | Standalone/aggregate/embed/old-pin/theme/P1–P6 parity. Prefer bounded documented invariants; no shared runtime/repository migration without quantified net value and approval. |
| **P-09 field/repeat validation** | Repeat n=1/uncertain dark/tablet and readiness observations with repaired protocol. Use only existing approved sufficient aggregate field evidence if available. | Keep field INP/CWV unavailable when absent; do not add tracking or require new credentials. Document environment/identity and distinguish LAB from field. |
| **P-10 regression closure** | All authorized route/app/data changes measured with applicable unchanged gates and complete evidence. | Historical/canonical/SEO/consent/embed/data correctness, durable retained evidence and independent review; compare matched within-environment results, never production-minus-local. |

Concrete P-02 source entry points: `M:scripts/build/generated-drift-guard.mjs:15`, `M:scripts/build/author-research.mjs:6`, `M:blog-module/build/home-panels.js:153`, `M:scripts/build/stamp-html.mjs:252`; expected generated paths are `index.html`, `scripts/author/research-catalog.json`, `standings/index.html`. Contrast is `M:blog-module/blog/archive-editorial.css:125`; normal minified/hash consumers require review. The existing guard should remain; no generator rewrite is justified by current evidence.

Tooling repair must deliver successful exact provider fixtures before every relevant page/frame request, fail closed on misses, keep first-party assets real, and assert theme/viewport/consent/SW/analytics/required metrics on the actual audited page. Keep Main and aggregate targets/origins separate. If a clean rerun isolates a new product failure, record it and review the fix rather than relax the budget or declare recovery complete.

## Evidence and audit status

Primary receipts and adjudication: `local-bundle:p01-evidence.tar.gz#work/s1/evidence-receipts.json`, `local-bundle:p01-evidence.tar.gz#work/s1/recomputed.json`, `local-bundle:p01-evidence.tar.gz#work/s1/challenge.md`. Runtime admission uses `evidence/attempts.jsonl` SHA-256 `0133e6720dac62640ab2c77c049883a019e44607c794ef2b7b571926c97a8a35`; network SHA-256 `d826236a2582c614900495eeef69fc50bd7f8c640bc37cb3dfa59e9066897336`. Resolve both through the bundle/index rather than workstation paths.

Main runtime PASS is `local-bundle:p01-evidence.tar.gz#evidence/gate-logs/runtime-main.log`; aggregate PASS is `local-bundle:p01-evidence.tar.gz#evidence/gate-logs-aggregate/runtime-aggregate.log`, SHA-256 `7773f7ded15201857f20849b8abe9495795c386d72a849ee37694cb61abf2191`. Exact drift and twelve Gate E JSONs remain in retained evidence. The three detailed reports link the compact supporting data; those links and the final PR diff/retention still require integration verification.

Gate A source/child pins and budgets are recorded, with local identity limits. Gate B has verified primary counts but explicit interaction/readiness/field/screen gaps. Gate C maps Main/four children/build/assets without proving exhaustive dead code. Gate D's final integrated allowlist check remains a coordinator duty. Gate E retains PASS, BASELINE FAILURE and BLOCKED outcomes above. **Gate F independent review is still required; this synthesis supplies no verdict.** P-01 must not be called complete merely because these four files exist. No merge or deployment is authorized.
