# P-01 codebase inventory

| Baseline | Pinned code SHA |
|---|---|
| Main | `58273df6d753510605468c0787d9cdf04d6d398e` |
| Telemetry | `38c3dd2018b810a5dce1add1f7663bcb199c845a` |
| Ghost Car | `13fc12afb7c73ccbab6e71fc3d3210d922038d51` |
| TYRES | `249aa796a1981be4f70213c9f1973b4418faf3ca` |
| BetCast | `74eeb98b4acb1b4e0ea45d4ab12f7fdf4e0c2650` |

**Evidence date:** 2026-11-10 UTC. **Scope:** pinned Main source, four pinned child archives, supplied local aggregate, dependencies and artifact inventories. Read-only analysis; no source deletion, install, build or new browser/network execution.

**Evidence key:** `M:path:line` means Main at the SHA above; child-prefixed references use the named pin. `S-*` maps to [findings.json](../../perf/p01/findings.json); [baseline.json](../../perf/p01/baseline.json) records release/data/toolchain identity. Retained evidence is addressed as `local-bundle:p01-evidence.tar.gz#<path>`; hashes and retrieval status belong to [evidence-index.json](../../perf/p01/evidence-index.json). Bundle references do not attest upload or independent review.

**Limitations:** source graphs are not emitted chunk graphs or exhaustive dynamic reachability proofs. Artifact totals describe the local-built aggregate, not production transfer. Child archives were inspected at the lock pins; their capture was not independently refetched in synthesis. CSS coverage, currentSrc/rendered boxes, per-library CPU/bytes and removable media URLs are incomplete. Field INP and Core Web Vitals are unavailable. Every unmeasured saving is **TBD — requires P-0X measurement**.

## Main source structure and accounting

| Area | Role and boundary | Pinned source anchor |
|---|---|---|
| Root HTML and partials | Static shells, shared navigation and generated panels; transformed for public output | `M:index.html:38`; `M:scripts/build/public-artifact.mjs:454` |
| `styles.css`, `home.css`, `styles/` | Base, route, font, navigation and editorial CSS | `M:docs/css-architecture.md:8`; `M:index.html:43` |
| `scripts/` browser entries | Theme, consent, analytics/vitals, navigation and home behavior | `M:index.html:48`; `M:index.html:743` |
| `blog-module/blog/`, `blog-index.js` | Archive/article presentation and browser interactions | `M:blog-module/blog/index.html:194`; `M:blog-module/blog/article-script.js:93` |
| `blog-module/blog-entries/` | Published HTML/media, including source-less history; not disposable generated clutter | `M:blog-module/build/index.js:887`; `M:scripts/build/public-media-integrity.mjs:6` |
| `blog-module/build/` | DOCX/media/content generation and incremental input digests | `M:blog-module/build/index.js:1156`; `M:blog-module/build/input-digest.js:4` |
| `standings/core/`, `standings/tabs/` | Runtime state, validation, cache/fetch and lazy report modules | `M:standings/standings.js:19`; `M:standings/standings.js:87` |
| `scripts/build/` | Minification, stamping, inlining, public allowlist and integrity checks | `M:scripts/build/minify.mjs:27`; `M:scripts/build/public-artifact.mjs:29` |
| `scripts/deployment/`, Actions | Pin/toolchain/cache/assembly and publication orchestration | `M:scripts/deployment/sources.json:1`; `M:scripts/deployment/release.mjs:186` |
| `dashboard/` | Public locked shell; no decryption/private data in this audit | `M:dashboard/index.html:13`; `M:dashboard/index.html:16` |

[repository.tsv](../../perf/p01/repository.tsv) counts **5300 tracked regular files / 263683752 raw B** by working-tree `lstat`, not Git blob size. Categories are exclusive accounting labels, not deletion permissions. Historical HTML counts as generated; historical images count as media.

| Tracked category | Files | Raw B |
|---|---:|---:|
| cache/data | 206 | 16291483 |
| docs | 251 | 11929135 |
| generated | 485 | 27601273 |
| historical content | 301 | 2057863 |
| media | 3431 | 193609454 |
| source | 377 | 5157633 |
| tests | 249 | 7036911 |

Allocated working-tree usage was 268264 KiB, including ignored/untracked files and filesystem effects. Shared Git object storage reported 1.23 MiB loose and 478.82 MiB packed across 72685 packed objects/six packs. This is shared worktree storage, not a standalone history-size baseline. No history purge or maintenance is proposed. Inventory evidence: `local-bundle:p01-evidence.tar.gz#work/f/hygiene.md`.

## CSS ownership and route loading

The ownership boundary is deliberate: base layout in `styles.css`, navigation mechanics in `styles/shared-nav.css`, editorial skin/tokens in `styles/editorial.css`, and route-specific layers. Residual nav skin migration is documented debt, **S-06 HYPOTHESIS**, not confirmed wasted CSS (`M:styles/shared-nav.css:61`; `M:styles/editorial.css:264`; `M:docs/css-architecture.md:8`).

The route map below shows **source head order**. Names omit `.min` for readability but correspond to the minified references in [route-assets.tsv](../../perf/p01/route-assets.tsv). Public-profile HTML inlines eligible local head CSS in that order (`M:scripts/build/public-artifact.mjs:454`; `M:scripts/build/inline-head-css.mjs:20`). These are not repeated external CSS transfers. Dashboard has a different CSP and external styles (`M:scripts/build/security-policy.mjs:80`; `M:scripts/build/security-policy.mjs:110`).

| Route | Ordered CSS source dependencies | Source at Main pin |
|---|---|---|
| Home | Bootstrap slim → styles → editorial → home → shared-nav → home-fonts | `M:index.html:38`; `M:index.html:43`; `M:index.html:44`; `M:index.html:45`; `M:index.html:46`; `M:index.html:47` |
| THE INDEX | archive-front → home-fonts → styles → shared-nav → editorial → archive-editorial | `M:blog-module/blog/index.html:29`; `M:blog-module/blog/index.html:31`; `M:blog-module/blog/index.html:36`; `M:blog-module/blog/index.html:37`; `M:blog-module/blog/index.html:38`; `M:blog-module/blog/index.html:39` |
| Latest/long/historical articles | Bootstrap slim → styles → article-styles → shared-nav → home-fonts → editorial → article-editorial | `M:blog-module/blog-entries/20261107-2J/article.html:55`; `M:blog-module/blog-entries/20261107-2J/article.html:60`; `M:blog-module/blog-entries/20261107-2J/article.html:72`; other two pages have the same head anchors |
| THE GRID | home-fonts → Bootstrap slim → styles → shared-nav → standings → standings-polish → editorial → standings-editorial | `M:standings/index.html:40`; `M:standings/index.html:46`; `M:standings/index.html:52`; `M:standings/index.html:55` |
| THE GRID activated tabs | pit-stops, quali-gaps, lap1-gains, tyre-pace, dirty-air, track-dominance, debrief CSS on demand | `M:standings/standings.js:772`; duplicate guard at `M:standings/standings.js:782` |
| Dashboard | home-fonts → dashboard.css | `M:dashboard/index.html:13`; `M:dashboard/index.html:14` |
| Four child routes | Independent child entry CSS and fonts; not inferred from Main HTML | See five-app matrix below |

`archive-front` is present in the pinned archive HTML despite omission from an older architecture route table. The actual source map takes precedence; this mismatch is not a new runtime defect. `styles/layers.css` has no observed route tag in this inventory, but that does not prove no dynamic use or authorize deletion.

Author tooling owns `theme-overrides.css`, `styles/fonts.css`, `styles/critical-common.css` and `blog-module/blog-styles.css` (`M:docs/css-architecture.md:18`; `M:docs/css-architecture.md:20`). Reader-route absence is expected, not dead-CSS evidence. Article tables intentionally combine structure and skin, including responsive `!important` and generated/historical states (`M:blog-module/blog/article-styles.css:14`; `M:blog-module/blog/article-editorial.css:369`). No exhaustive selector/specificity scan or removable declaration set is established.

The apparent second standings stylesheet is a `<noscript>` fallback (`M:standings/index.html:52`; `M:standings/index.html:54`). Inlining replaces the normal link and removes the matching fallback (`M:scripts/build/inline-head-css.mjs:24`; `M:scripts/build/inline-head-css.mjs:32`). **S-23 rejects the two-full-transfer claim.** Preserve no-JS compatibility.

## JavaScript graph and initialization

[dependency-edges.tsv](../../perf/p01/dependency-edges.tsv) records Main HTML edges, static standings imports and selected dynamic edges. It is a source graph, not a complete emitted dependency or execution-order graph. Modulepreload tags at `M:standings/index.html:32` identify initial candidates, not the content of every chunk.

| From | Dependency / activation | Source |
|---|---|---|
| Public reader shells | Error beacon, theme bootstrap, analytics/vitals, consent, shared-nav and legacy SW cleanup | `M:index.html:9`; `M:index.html:48`; `M:index.html:83`; `M:index.html:743` |
| Home | `scripts/f1-optimized.js` after parser; route element guards | `M:index.html:744`; `M:scripts/f1-optimized.js:253` |
| Archive | taxonomy → blog-index search/filter/runtime data | `M:blog-module/blog/index.html:194`; `M:blog-module/blog/index.html:195`; `M:blog-module/blog-index.js:399` |
| Three article pages | article-script + shared-nav + consent + blog-fixes + cleanup; latest additionally loads article-embeds | `M:blog-module/blog-entries/20261107-2J/article.html:321`; `M:blog-module/blog-entries/20250602-1G/article.html:1846`; `M:blog-module/blog-entries/20250301G/article.html:325` |
| Standings entry | core format/team/cache/fetch/embed/round/render/payload modules | `M:standings/standings.js:10`; `M:standings/standings.js:19`; `M:standings/standings.js:28` |
| Standings activation | Memoized dynamic report imports + guarded CSS; post-load Race Desk navigation outside embeds | `M:standings/standings.js:87`; `M:standings/standings.js:816`; `M:standings/standings.js:1813` |
| Managed article embeds | Protocol-specific iframe adapters and interaction-loaded telemetry manifest entry | `M:blog-module/blog/article-script.js:663`; `M:blog-module/blog/article-embeds.js:281` |
| Dashboard | theme-init → snapshot-crypto/dashboard modules | `M:dashboard/index.html:15`; `M:dashboard/index.html:16`; `M:dashboard/index.html:17` |

[initialization.tsv](../../perf/p01/initialization.tsv) retains triggers, guards and lifetimes:

| Feature | Trigger / guard / lifecycle | Source and assessment |
|---|---|---|
| Nav scroll cues | Tracked scrollers; filtered MutationObserver; per-scroller ResizeObserver; passive scroll; removed-scroller cleanup | `M:scripts/shared-nav.js:408`; `M:scripts/shared-nav.js:468`; existing optimization |
| Shared progress | Progress element guard, cached geometry, consolidated RAF scroll | `M:scripts/shared-nav.js:490`; `M:scripts/shared-nav.js:500`; no duplicate cost proved |
| Article sector/progress | DOMContentLoaded, element guards, passive scroll/resize/RAF; reads before writes | `M:blog-module/blog/article-script.js:93`; `M:blog-module/blog/article-script.js:114`; distinct UI |
| Managed embeds | Different protocols/origin checks; scans/messages/observers/timers; adapters expose cleanup | `M:blog-module/blog/article-embeds.js:7`; `M:blog-module/blog/article-embeds.js:96`; `M:blog-module/blog/article-embeds.js:183`; no controlled insertion cost |
| Standings tabs | Cached module promises, stylesheet map and tab lifecycles; retained Tyre Pace chart | `M:standings/standings.js:816`; `M:standings/tabs/tyre-pace.js:70` |
| Analytics | Consent gated; article analytics waits for load | `M:scripts/analytics.js:274`; `M:scripts/analytics.js:314` |
| Archive | Search element guard, 250 ms debounce, popstate/pageshow | `M:blog-module/blog-index.js:399` |
| Consent banner | Missing-consent/banner guards; reveal removes listener and timer | `M:scripts/cookie-consent.js:90` |

S-08 embed consolidation and S-09 progress consolidation remain hypotheses. Separate interfaces and security protocols are not redundant merely because both use observers/scroll. Retained long-article navigation traces do not attribute scroll callbacks. A three-frame insertion/theme fixture and named callback/RAF/layout counters must precede an intervention.

## Build-time versus runtime dependencies

Main is a static build plus browser scripts, not a site-wide application framework. Package sections alone do not determine browser cost: Main's DOCX/image/ZIP packages are build/publishing tools, while `web-vitals` is bundled for a consent-gated browser path despite being declared under devDependencies. All 14 direct dependencies have representative callers; none is proven removable. [dependency-usage.tsv](../../perf/p01/dependency-usage.tsv) is a caller inventory, not proof that every historical use was searched.

| Main package, locked version | Actual role | Representative pinned caller |
|---|---|---|
| adm-zip 0.6.1 | build/publishing | `M:blog-module/build/shared.js:5` |
| mammoth 1.13.0 | build/publishing | `M:blog-module/build/shared.js:3` |
| sharp 0.35.4 | build/publishing | `M:blog-module/build/shared.js:4` |
| @fortawesome/fontawesome-free 7.3.1 | build/publishing | `M:scripts/build/build-icon-sprite.mjs:34` |
| bootstrap 5.3.8 | build/publishing | `M:styles/vendor/bootstrap.slim.scss:5` |
| chrome-launcher 1.2.3 | QA / browser tooling | `M:scripts/perf/lighthouse-guard.mjs:15` |
| esbuild 0.28.2 | build/publishing | `M:scripts/build/minify.mjs:27` |
| fast-xml-parser 5.12.0 | build/publishing | `M:blog-module/build/telemetry-figure.js:4` |
| lighthouse 13.6.0 | QA / browser tooling | `M:package.json:85` |
| lightningcss 1.33.0 | build/publishing | `M:scripts/build/minify.mjs:28` |
| playwright-core 1.65.0 | QA / browser tooling | `M:scripts/deployment/build.mjs:126` |
| puppeteer-core 25.16.0 | QA / browser tooling | `M:scripts/perf/lighthouse-guard.mjs:14` |
| sass 1.108.0 | build/publishing | `M:package.json:24` |
| web-vitals 6.2.3 | runtime bundle (consent gated); build and test | `M:scripts/perf/web-vitals-collector.js:2` |

JSZip is an explicit author exception at `M:scripts/build/public-artifact.mjs:45`, loaded lazily for ZIP actions at `M:scripts/author/dom-tools.js:60`. Its presence under `node_modules/` in output is not a packaging defect. Do not confuse package installation size with route transfer.

## Data, media and font inventory

[payloads.tsv](../../perf/p01/payloads.tsv) separates source raw B, offline gzip B, local inclusion and observed request phase. Gzip below is a reproducible offline level-9/mtime 0 representation, not measured HTTP transfer. Artifact HTML is larger after inlining/stamping; this alone does not establish redundant work.

| File | Source raw B | Offline gzip B | Local artifact raw B | Boundary |
|---|---:|---:|---:|---|
| `blog-module/blog-index-data.json` | 147934 | 44011 | 147934 | Runtime archive projection |
| `blog-module/blog-source-cache.json` | 471610 | 84008 | NOT PRESENT | Build-only; absent |
| `standings/standings-cache.json` | 27927 | 2718 | 27927 | Runtime snapshot |
| `standings/debrief-cache.json` | 678566 | 71929 | 678566 | Tab-driven runtime data |
| `standings/dirty-air-cache.json` | 2773211 | 335544 | NOT PRESENT | Authoring bundle; absent |
| `blog-module/blog-entries/20261107-2J/article.html` | 43129 | 12175 | 220642 | Published HTML; preserve URL/content |
| `blog-module/blog-entries/20250602-1G/article.html` | 221989 | 34726 | 399914 | Published HTML; preserve URL/content |
| `blog-module/blog-entries/20250301G/article.html` | 54700 | 14596 | 232495 | Published HTML; preserve URL/content |

### Data dependency graph

[data-edges.tsv](../../perf/p01/data-edges.tsv) provides the fuller graph. Presence in an artifact is not proof a route fetched it; a request absent from supplied captures is not globally unused. Interaction network rows lack action boundaries, so they cannot identify action-only bytes.

| Producer/consumer | Edge / trigger | Pinned source |
|---|---|---|
| Article sources → build cache → published index/home panels | Build projection; cache is not a reader payload | `M:blog-module/build/index.js:1156`; `M:blog-module/build/index.js:1169`; `M:blog-module/build/home-panels.js:382` |
| Archive/search → JSON | Demand fetch, no-store, relative fallback paths | `M:blog-module/blog-index.js:174`; `M:blog-module/search-destinations.js:54` |
| Standings → snapshot | Initial snapshot, validation, fallback | `M:standings/standings.js:1252` |
| Season/round → round snapshot | Existing per-season/round files, Jolpica fallback | `M:standings/core/rounds.js:25`; `M:standings/core/rounds.js:53` |
| Dirty Air → index → selected session | Already partitioned; memory promises/cache; OpenF1 fallback | `M:standings/tabs/dirty-air.js:509`; `M:standings/tabs/dirty-air.js:1268` |
| Debrief tab → debrief-cache | Fetch only through tab data path | `M:standings/tabs/debrief.js:120` |
| First-party JSON → browser/application caches | HTTP revalidation plus TTL/IndexedDB/session fallback where used | `M:standings/core/fetchers.js:19`; `M:standings/core/fetchers.js:23`; `M:standings/core/cache.js:1` |

S-16 rejects re-partitioning the absent 2773211-B Dirty Air authoring bundle as a new runtime improvement. S-17 rejects partitioning the absent 471610-B blog source cache for reader speed. Existing round/session partitioning should remain. Parse/transform CPU and request/compression trade-offs are unmeasured.

### Images and fonts

Source image inventory covers `images/` and `blog-module/`; generated artifact-only and child images are outside that source inventory. Selected requests and declarations are in [images-fonts.tsv](../../perf/p01/images-fonts.tsv); detailed catalogs remain `local-bundle:p01-evidence.tar.gz#work/c/image-inventory.tsv` and `local-bundle:p01-evidence.tar.gz#work/c/font-faces.tsv`.

Responsive AVIF/WebP variants, truthful width descriptors, aligned hero preloads and preserved historical originals already exist (`M:blog-module/build/image-sizes.js:27`; `M:blog-module/build/article-render.js:508`; `M:blog-module/build/article-render.js:528`; `M:scripts/build/public-media-integrity.mjs:6`). A repeated requested filename across widths does not establish poor sizing at different DPR. Collect currentSrc, rendered/intrinsic dimensions, priority/reuse and fidelity before S-05/S-10 changes.

The source font catalog includes Roboto 400/600/700, DM Sans 400 normal/italic and 500/600/700, and Outfit 500/600/700/800 with declared subsets (`M:styles/fonts.css:1`). Home uses Barlow Condensed 700 and IBM Plex Sans variable 400–600 with subset faces (`M:styles/home-fonts.css:1`). Declarations are not transfer. Home Barlow/IBM Greek preloads are inserted at `M:scripts/build/stamp-html.mjs:157` and `M:scripts/build/stamp-html.mjs:505`; each URL appeared once in each of three representative local widths, n=3/face. This rules out duplicate requests in those cells only; text usage and LCP competition are unmeasured. No font removal is supported from an unfetched declaration.

Repeated shared CSS in article HTML is intentional (`M:scripts/build/stamp-html.mjs:411`; `M:scripts/build/public-artifact.mjs:454`). Any repeat-navigation caching benefit from externalization must be weighed against cold rendering; no saving is established.

## Five-app dependency and release matrix

Main owns release assembly; children retain independent builds, standalone URLs and pinned subpaths (`M:scripts/deployment/sources.json:13`). The pin table at the start is authoritative for code. TYRES data additionally uses SHA `dbc69155aaa8e8c2af3556ef02ba18d54ad0ba0c`, then a separately refreshed data overlay. Code pins do not freeze live providers or generated data.

| App | Node / builder / output | Runtime/library boundary | Pinned source |
|---|---|---|---|
| Main | 22 / custom static pipeline / dist | Vanilla scripts; consent-gated web-vitals; generated Bootstrap/icons | `M:package.json:100`; `M:package.json:119`; `M:scripts/build/minify.mjs:165` |
| Telemetry | 22 / Vite 6.4.1 / dist; `/telemetry/` | React/DOM 19.1.0, Recharts 2.15.3, lucide-react 0.503.0; lazy tabs, named vendor chunks | `Telemetry:package.json:23`; `Telemetry:vite.config.ts:32`; `Telemetry:src/components/DashboardShell.tsx:34` |
| Ghost Car | 22 / Vite 6.4.2 / dist; `/ghostcar/` | React/DOM 18.3.1, Three 0.162.0; prebuild model optimization; lazy 3D stage | `Ghost Car:package.json:28`; `Ghost Car:vite.config.js:16`; `Ghost Car:src/features/replay/ReplayStage.jsx:10` |
| TYRES | 24 / Vite 8.3.4 / dist; `/tyres/` | Native TS DOM, Three 0.186.1 on demand, zod 4.6.7 via mini; data/OG generation | `TYRES:package.json:7`; `TYRES:src/domain/schema.ts:10`; `TYRES:src/ui/app.ts:434`; `TYRES:scripts/build-f1stories.ts:22` |
| BetCast | 22 / react-scripts 5.0.1 (CRA) / build; `/betcast/` | React/DOM 18.3.1, Recharts 2.15.3; lazy analysis; no aggregate source maps | `BetCast:package.json:11`; `BetCast:src/App.js:29`; `BetCast:src/components/BetCast.jsx:1` |

[app-dependencies.tsv](../../perf/p01/app-dependencies.tsv) lists direct dependencies and selected transitives, not a full transitive graph. Test packages declared under BetCast dependencies remain test tools. Per-library raw/gzip/transfer and dependency-to-emitted-chunk mapping are unknown. Lazy source syntax does not mean zero initial cost: a representative production BetCast initial request includes its analysis chunk at 119028 B. Preserve boundaries; measure the selected default view first.

### Shared contracts and coupling risk

[app-contracts.tsv](../../perf/p01/app-contracts.tsv) captures differences, not a mandate to share implementation. Partner identities are **P1–P6** only in public audit material.

| Contract | Existing variation / source | Required regression boundary |
|---|---|---|
| Theme | Common storage concept; BetCast also auto/URL overrides; different iframe precedence (`Telemetry:src/components/DashboardContainer.tsx:44`; `Ghost Car:src/hooks/useThemePreference.js:5`; `TYRES:public/theme.js:6`; `BetCast:public/theme-init.js:3`) | First paint light/dark/auto, standalone/aggregate/embed; avoid flashes |
| Navigation | Static/React shells and intentional standalone/subpath links (`Telemetry:src/copy.ts:185`; `Ghost Car:src/app/siteNav.js:4`; `TYRES:index.html:23`; `BetCast:src/components/SiteMasthead.jsx:52`) | Destinations/order/current state, historical links; reuse Ghost's existing drift check |
| P1–P6 metadata | Independent asset/variant/link ownership (`Telemetry:src/components/dashboard/SiteFooter.tsx:4`; `Ghost Car:src/app/SponsorSection.jsx:10`; `TYRES:index.html:88`; `BetCast:src/components/SponsorStrip.jsx:3`) | Preserve six identities, ordering and destinations without exposing contact/commercial details |
| Consent/analytics | Main consent gates; BetCast web-vitals call without a supplied callback (`M:scripts/analytics.js:274`; `BetCast:src/index.js:18`; `BetCast:src/reportWebVitals.js:1`) | Denied consent and actual transport in every relevant page/frame; no shared tracker proposed |
| OpenF1 | Telemetry inclusive date operators; Ghost independent stream scheduling (`Telemetry:src/api/openf1.ts:174`; `Telemetry:src/api/openf1.ts:392`; `Ghost Car:src/services/openf1.js:41`) | Exact query/operator/session, cancellation, partial failure, rate limiting and cache semantics |
| Formatting/icons | Domain-specific rounding/units/nulls and different icon systems (`Ghost Car:src/helpers.js:1`; `Telemetry:src/components/dashboard/chartAxis.ts:1`; `TYRES:src/ui/strings.ts:1`; `BetCast:src/services/bettingDataCore.mjs:1`) | Golden domain cases and accessible icons; common names do not prove semantic identity |

S-12 shell contracts, S-13 BetCast fallback and S-14 OpenF1 reuse remain unranked hypotheses. BetCast has two direct attempts with 8 s fetch timers and up to four proxy attempts with 6 s timers (`BetCast:src/services/googleSheetService.js:24`; `BetCast:src/services/googleSheetService.js:43`). Their 40 s sum is configured timer exposure, not measured latency or a strict end-to-end bound. It does not explain text LCP without attribution.

Generic repository consolidation, a mandatory shared runtime/npm package and BetCast builder migration are rejected (S-20). Different versions/toolchains, backward-compatible pins, subpaths and embeds create real coupling risks. First measure drift/update effort and compatible fixtures; no net benefit is quantified.

## Local artifact inventory and exclusions

[artifact-summary.tsv](../../perf/p01/artifact-summary.tsv) covers **5547 regular files / 405433924 raw B**. Sum of individually gzip-compressed files is **295131989 B**, including already compressed binaries; this is neither archive size nor HTTP transfer. This table is **local-built only** and is not a production baseline.

| Local aggregate owner | Files | Raw B | Sum of per-file gzip B |
|---|---:|---:|---:|
| main | 4375 | 326729235 | 231253546 |
| telemetry | 185 | 19242194 | 12866646 |
| ghostcar | 23 | 3031265 | 2194765 |
| tyres | 922 | 53590834 | 46567874 |
| betcast | 42 | 2840396 | 2249158 |

Owner accounting is by path prefix; other paths, including the legacy telemetry redirect namespace and deployment manifest, count as Main. Main exceeds its local pre-assembly manifest by exactly one file/3180 B: `deployment-manifest.json`, generated at `M:scripts/deployment/assemble.mjs:256`. Production's separately refreshed TYRES artifact has different bytes; no subtraction is a saving.

Main packaging is reference-driven allowlisting, protected historical media, author exceptions and generated social/redirect output (`M:scripts/build/public-artifact.mjs:29`; `M:scripts/build/public-artifact.mjs:338`; `M:scripts/build/public-artifact.mjs:393`). The following tracked files are absent **at their exact source paths** in the local artifact; derivatives may still ship.

| Exact-path absent category | Files | Source raw B |
|---|---:|---:|
| cache/data | 139 | 7492808 |
| source | 346 | 4484802 |
| docs | 247 | 11904498 |
| media | 148 | 17531160 |
| historical content | 301 | 2057863 |
| generated | 1 | 49901 |
| tests | 249 | 7036911 |

Build cache/source docs are excluded by contract (`M:scripts/build/validate-public-artifact.mjs:43`). Raw logo exclusion does not remove optimized logos. Original article media is selectively retained when referenced or compatibility-protected, not blanket excluded (`M:scripts/build/public-artifact.mjs:114`; `M:scripts/build/public-artifact.mjs:338`). Child namespace rules permit three Telemetry analysis Markdown files; the path scan found zero prohibited child source/test directories, maps or disallowed Markdown (`M:scripts/deployment/assemble.mjs:231`). This scan does not fully re-execute Main's semantic allowlist.

The detailed artifact list retains only the largest 500 files plus complete owner totals. Only same-size candidates were hashed; it is not a complete cryptographic file manifest. See `local-bundle:p01-evidence.tar.gz#work/f/artifacts.tsv` and `local-bundle:p01-evidence.tar.gz#work/f/inventory-summary.json`.

## Redundancy, preserved work and deletion limits

Listed duplicate groups were independently rehashed in synthesis: tracked **294 groups / 719 files / 26107749 gross repeated B**; local aggregate **300 groups / 743 files / 24311688 gross repeated B**. These are arithmetic upper bounds if every extra copy vanished, not removable storage or route-transfer savings. They verify listed groups, not search completeness. Distinct article/social/direct URLs remain required (`M:blog-module/blog-entries/20250424-3GF/article.html:19`; `M:blog-module/blog-entries/20250424G/article.html:19`; `M:scripts/build/public-media-integrity.mjs:6`). S-15 remains HYPOTHESIS.

Preserve prior October cleanup, ordered full CSS inlining, self-hosted fonts/icon subsets, responsive imagery, nav observer/scroll guards, article geometry ordering, lazy reports/retained charts, Dirty Air partitioning, JSON revalidation, source-cache build boundary, author exceptions, denied-consent behavior and SW migration (`M:docs/dead-code-cleanup-progress.md:23`; `M:docs/css-architecture.md:8`; `M:standings/tabs/tyre-pace.js:70`; `M:scripts/sw-cleanup.js:1`). None is a newly discovered saving.

No new safe source, dependency, media or selector deletion is established. Dynamic classes/imports, author preview, responsive tables, themes, accessibility states, source-less history and protected URLs constrain future cleanup. Broad CSS layers, iframe/progress merging, unfetched-font deletion and runtime-package extraction remain rejected or deferred until their precise fixtures and attribution exist.

## Verification and next use

**audit:runtime PASS on Main and aggregate. build:check BASELINE FAILURE.** Gate E Lighthouse ran behind a DNS guard and seven assertions remain BLOCKED; Blog contrast is an independent baseline failure. Benchmark Lighthouse n=1 with providers blocked is diagnostic. Standings **`tab-pit-stops` and `session` NOT MEASURED**. [Runtime baseline](p01-runtime-baseline.md), [build pipeline](p01-build-pipeline.md) and [checks.tsv](../../perf/p01/checks.tsv) preserve these boundaries; none is a field CWV/INP result.

P-03 must collect image boxes/currentSrc/DPR/reuse and payload parse evidence; P-04 needs complete application fixtures, chunk/task attribution and useful-data readiness; P-05 needs computed styles and controlled embed/scroll states; P-06 needs a complete URL/reference analysis; P-08 needs measured contract drift before extraction. No implementation starts in P-01. All unmeasured savings: **TBD — requires P-0X measurement**.

Raw architecture/data catalogs are retained as `local-bundle:p01-evidence.tar.gz#work/b/route-assets.tsv`, `local-bundle:p01-evidence.tar.gz#work/b/graph.tsv`, `local-bundle:p01-evidence.tar.gz#work/c/payloads.tsv`, `local-bundle:p01-evidence.tar.gz#work/e/dependencies.tsv` and `local-bundle:p01-evidence.tar.gz#work/f/duplicates.tsv`. The duplicate TSV SHA-256 is `3b02a6621f1e3765b23d3998121eb720407359cb5b9bdf8838dca31100190e81`. Use [evidence-index.json](../../perf/p01/evidence-index.json) for remaining hashes/retention; do not mistake scratch availability for durable delivery.
