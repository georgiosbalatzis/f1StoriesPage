# Step 9 delivery and Steps 5–7 integration — #279

The retained production change is three lines in `standings/core/fetchers.js`: existing first-party JSON network reads use `no-cache` instead of `no-store`. Every such request still validates with the server; unchanged responses can reuse their HTTP-cache body after a 304. Third-party API requests, the application cache, its TTLs, explicit retries and content freshness remain unchanged. No dependency, service worker, hosting configuration, resource hint, CSS or article/Edition runtime change is retained.

Baseline: current `origin/main` at `30c27779`. Separate temporary worktrees contain the combined PRs and the Step 9 branch. No original PR branch was edited, merged into main or deployed.

## Accepted measurements

Chrome, actual baseline/candidate compiled fetch module, local TLS HTTP/2, gzip, CPU ×4, three alternating pairs per network and cache state: 36 measurements. Fast 4G is 9 Mbps/40 ms RTT; Slow 4G is 1.6 Mbps/150 ms RTT. The fixture certificate is trusted by SPKI; no request interception or blanket certificate-error override disables the browser cache. These are **JSON fetch completion times**, not page paint, tab presentation or field INP.

| Cache state | Fast 4G median before → after | Slow 4G median before → after | Compressed response body before → after |
| --- | ---: | ---: | ---: |
| Cold | 107.3 → 107.2 ms | 477.4 → 477.0 ms | 61,509 → 61,509 B |
| Warm, unchanged | 105.7 → 52.5 ms | 473.1 → 163.8 ms | 61,509 → 0 B |
| Expired, unchanged | 106.0 → 53.3 ms | 474.3 → 169.4 ms | 61,509 → 0 B |

The warm/expired candidate responses are actual server-side 304s. Resource Timing reports 61,809 → 300 transfer bytes; its 300-byte validation accounting is nominal header overhead, not exact HTTP/2 wire bytes. All 36 unchanged response hashes match. The built-module correctness check proves 200 → 304 → changed-content 200 → HTTP 503 rejection, including changed content while the previous response is still fresh. Request counts remain one per existing fetch. The production Debrief snapshot measured separately is 65,026 gzip bytes; the repository fixture is 61,509 bytes.

Expiry in this controlled comparison uses `max-age=600` plus `Age: 601`. Actual production expiry was independently observed after **630.45 wall-clock seconds**, as described below. [Summary](snapshot-summary.json), [raw results](snapshot-raw.json.gz), [freshness/error checks](snapshot-correctness.json).

## Steps 5–7 integration

PR #287 head `8d16ffe1` and PR #289 head `a9a5e846` both had successful Quality gates. They combine cleanly with main in detached integration commit `660233f0`. Both are technically ready on the checks below; they remain unmerged into main.

- Existing public build/validator and 18 Standings tests pass. The existing nine-report interaction suite passes at 390/768/1440 px, dark/light: real desktop/mobile controls, keyboard navigation, session changes, retained SVG/scroll position, deep links, Back/Forward URL state, embedded/pinned modes, retry recovery, snapshot failure fallback and cache clearing.
- The existing dynamic-cue suite passes all six width/theme combinations: insertion, unrelated/descendant mutations, scrolling, resizing, removal and observer cleanup.
- Three interleaved main/integration pairs per network and width produce 36 homepage interaction runs: no page errors; exactly 34 resource entries in every run; median click Event Timing stays 32 ms. There is one isolated 57 ms task before and one 55 ms task after at 768 px Fast 4G; no increase in task count. Other combinations have no long tasks. No homepage speedup is claimed.
- Three interleaved Tyre Pace pairs per network preserve identical chart hashes: warm presentation 132.1 → 53.8 ms Slow 4G and 133.6 → 55.4 ms Fast 4G. Each network has nine measured warm switches: long tasks 9 → 0. Cold populated-chart times remain noise: 2401 → 2402 ms and 859 → 864 ms. This reuses the existing PR #289 profiler with its loop bounded to three pairs.
- A second temporary integration includes retained Step 9: public build/validator and all **19** Standings tests pass. The same six width/theme report checks, dynamic-cue suite and consent guard pass. The small [test extension](integration-cache-restoration.patch) additionally clears IndexedDB, reloads Tyre Pace, verifies provider refetch/storage restoration and compares the restored SVG hash. Original PR branches remain untouched.

[Initial smoke](integration-smoke.json), [with Step 9](integration-with-step9-smoke.json), [homepage medians](integration-home-summary.json), [Tyre medians](integration-tyre-summary.json); compressed raw measurements are beside them.

## Production delivery and navigation

Actual `https://f1-stories.gr/` response inspection, 2026-10-15:

- Canonical HTTPS home/article/Standings requests negotiate HTTP/2 without redirects. HTTP, `www`, and slashless `/standings` each add one redirect; internal links already use canonical paths, so none was changed.
- Successful HTML/CSS/JS/JSON samples use gzip and `Vary: Accept-Encoding`; `br` alone returns identity. WOFF2 stays uncompressed. There is no published standalone SVG to test: SVG icons are inline within gzip HTML. A sprite-path 404 is retained as a probe, excluded from compression conclusions.
- `Cache-Control: max-age=600` applies even to query-versioned assets and content-hashed chunks. Matching ETags return 304/zero body. No `immutable` directive is served. An old `Expires` value does not override `Cache-Control`.
- The real Chrome production test records cold → fresh → forced validation → naturally expired → restored fresh. Resource Timing transfer bytes are **5540 / 0 / 300 / 300 / 0**. Actual CDP encoded bytes are **5402 / 0 / 88 / 231 / 0**; the retained gzip CSS body and ETag match. Expiry latency includes reconnect/TLS after ten idle minutes and is not a speed comparison.
- Home → Article, Article → Article, Article → Edition, Home → Standings and Standings → Article were exercised with cold/shared-cache, warm and revalidated resource states, Slow/Fast 4G and CPU ×4. Shared font/style/script URLs match; the existing Standings snapshot preload is consumed once. No duplicate request was removed or claimed. Earlier experimental warm-document byte totals are excluded because that fixture did not revalidate HTML correctly; CSS/JS 304s were observed. Accepted cache claims use the SPKI-trusted snapshot/history runs and real production expiry.
- Native HTTP/2 Back/Forward checks pass baseline/candidate at all three widths and both themes: **24 sequences, 96 restores**, original document/URL/theme retained, `pageshow.persisted=true`, null `notRestoredReasons`, zero restored body bytes. All 24 cache calibrations pass: 36 JSON 304s and zero fresh-cache network requests. [History summary](history-summary.json).

[Response/header evidence](production-responses.json), [real expiry](production-cache-expiry.json), [redirects](production-redirects.json), [compression bounds](production-compression.json). Local Brotli 11 would save approximately 2.4–3.7 KB per sampled HTML page; these are potential byte differences, not demonstrated browser gains.

## Ranked decisions

| Rank | Opportunity | Measured impact / mobile value | Risk and maintenance | Decision |
| --- | --- | --- | --- | --- |
| 1 | Revalidate local JSON instead of discarding its HTTP cache | 61.5 KB avoided per unchanged Debrief fetch; about 309 ms saved on measured Slow 4G warm reads | Low: always validates; native browser behavior, three runtime lines | Implemented |
| 2 | Reuse complete article CSS across distinct HTML documents | Step 2 adds 36,557 gzip bytes in the measured article HTML, 20,125 → 56,682 B | Pages cannot choose HTML by browser stylesheet-cache state; safe reuse would require a different delivery design | Preserve Step 2 cold gains; deferred |
| 3 | Inline the complete tiny theme bootstrap with exact CSP hashing | FCP improves, but cold article LCP worsens 864 → 1036 ms Fast and 2440 → 2780 ms Slow in three pairs | Earlier font discovery competes with the cover; unacceptable cold-load regression | Fully reverted |

The theme experiment used current content with PR #282's complete ordered CSS inliner on both variants, not partial critical CSS. Its Fast profile is 1.6 Mbps/150 ms and Slow is 0.5 Mbps/300 ms, distinct from the accepted JSON profiles. Only cold results decide rejection; old fixture warm/expiry observations support no performance claims. [Rejected cold summary](rejected-theme-inline-css-summary.json).

Whole-sheet CSS recombination saved only 34–197 gzip bytes and was rejected. External sprites could reduce HTML by roughly 2.9–6.2 KB but add a first-load request and rendering risk; they were not implemented. Partial critical CSS, cache TTL changes, additional preloads, SW caching, hosting/DNS/CDN changes and Claude's Step 8 work were not attempted.

Pages' fixed cache policy and lack of Brotli are proven limits. No material page-paint gain from migration was demonstrated, so no infrastructure change is recommended now. If later authorized, a narrow same-URL hosting trial could test negotiated Brotli and longer caching only for genuinely content-addressed assets, while retaining HTML/data freshness. It would not by itself remove repeated inline CSS.

## Regression evidence and remaining work

The retained artifact has **449/450 byte-identical HTML pages**; only generated Standings asset references differ. All 450 canonical and JSON-LD comparisons match; all 30 CSS files and 3021 image/font files match; both author-tool pages are byte-identical. [Artifact invariants](artifact-invariants.json).

Public build/validator, 89 build tests, 237 blog tests plus golden snapshots, 6 author tests, 9 deployment tests, Standings tests, security/static/rendering/token/runtime checks, editorial-media checks and consent checks pass. No publishing source was changed. The **same nine pre-existing size-budget failures** are tracked separately in [pre-existing-budgets.json](pre-existing-budgets.json); thresholds were not raised.

The existing visual harness from PR #285 was limited to Home, Article, Edition and Standings at the requested three widths and both themes, with fixed time/random selection and identical blocked providers. All 18 non-home captures are pixel-identical. Of six homepage captures, one is exact and four differ by only 3–12 pixels; the interrupted desktop capture differed in the cover image. A fresh desktop comparison with cover decoding awaited, reduced motion and screenshot animations disabled is **pixel-identical**. [Pixel comparison](visual-comparison.json), [stationary cover check](visual-static-hero.json). Both variants retain the same existing latest-article heading-order finding (`h1` followed by `h3`); no new finding was introduced. Mobile menu, consent decline and theme-switch interaction checks pass. The resumed visual report covers the remaining captures; its companion initial log covers the captures saved before the browser process stopped.

The existing **Standings** Lighthouse thresholds also pass, unchanged: three-run median performance 98, accessibility/best-practices/SEO 100, LCP 2253 ms, CLS 0, TBT 0. This is a targeted budget check, not evidence for the accepted speedup. [Budget results](standings-lighthouse-budget.json). Homepage/article/Edition delivery bytes are unchanged, so their unrelated Lighthouse routes were not rerun. Compact test output is in [validation.json](validation.json).

Step 10 should verify a midrange Android and iOS Safari with real cold/warm/expired navigation, Back/Forward audio resumption and memory pressure; then live-provider session/retry behavior on a lossy mobile connection. Synthetic CPU/network measurements and recorded provider fixtures do not establish field INP or real-device performance.

## Reproduce

Build baseline `30c27779` and this branch in separate worktrees with existing project dependencies and `npm run build:public`, then run from the repository root:

```sh
node perf/step9-delivery/snapshot-benchmark.mjs BASELINE_DIST CANDIDATE_DIST /tmp/f1-step9-snapshots
node perf/step9-delivery/history-qa.mjs BASELINE_DIST CANDIDATE_DIST /tmp/f1-step9-history
node perf/step9-delivery/navigation-benchmark.mjs BASELINE_DIST CANDIDATE_DIST /tmp/f1-step9-navigation matrix - 3
node perf/step9-delivery/production-cache-expiry.mjs /tmp/f1-step9-production
```

The production-expiry check takes over ten minutes. Integration profilers and the fixture-based report/cue suites are the existing scripts from PRs #287/#289. The snapshot replay asserts the current compiled export layout rather than silently benchmarking a different function if the build graph changes.
