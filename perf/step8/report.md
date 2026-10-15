# Sprint #279 — Step 8: article runtime

Baseline: current main at `07ab7987`. Branch: `perf/step8-article-runtime`.

## Kept change

One runtime optimization: read cover, article and section geometry before writing reading-progress styles, attributes or classes. Previously, section reads synchronously flushed the bar’s preceding style updates. Geometry is still measured on every scheduled scroll/resize frame; no stale position cache or deferred interaction was introduced.

## Measurements

Chrome 155.0.8059.80, Apple M3 Pro, CPU ×4, Slow 4G (150 ms latency, 1.6 Mbps down / 750 Kbps up), viewports 390×900, 768×900 and 1440×900. Three interleaved baseline/candidate pairs per viewport, four articles per run: 72 navigations. Both variants serve the same public build and substitute only the article runtime from baseline/candidate source, with identical callback timing instrumentation. Each navigation samples 45 scroll positions with two animation frames between positions. Browser contexts are fresh per variant/pair. Service workers and external requests are blocked identically. No other test processes ran during the retained comparison.

Articles: `20250328G` (standard editorial), `20261009W` (image-heavy), `20261007G` (Standings/telemetry/Tyres/Ghost Car), `20260422G` (YouTube, social and Sketchfab).

Average reading-progress callback duration across sampled updates:

| Width | Baseline | Candidate | Reduction |
|---|---:|---:|---:|
| 390 | 0.882 ms | 0.188 ms | 78.7% |
| 768 | 0.844 ms | 0.166 ms | 80.3% |
| 1440 | 0.868 ms | 0.175 ms | 79.8% |

Per-pair means (each article weighted equally), baseline → candidate:

| Width | Pair 1 | Pair 2 | Pair 3 |
|---|---:|---:|---:|
| 390 | 0.854 → 0.196 ms | 0.940 → 0.178 ms | 0.854 → 0.190 ms |
| 768 | 0.782 → 0.163 ms | 0.913 → 0.167 ms | 0.838 → 0.170 ms |
| 1440 | 0.870 → 0.170 ms | 0.916 → 0.168 ms | 0.819 → 0.188 ms |

Whole-page metrics are noisier. Median values per navigation are shown below; scroll metrics include the scroll driver, all article scripts, lazy images and observers. CDP ScriptDuration excludes time attributed to style/layout, while callback wall time includes synchronous flushes. Do not equate callback savings with the same reduction in total rendering work.

| Width | Initial JS B/C | Scroll JS B/C | Scroll style B/C | Scroll layout B/C |
|---|---:|---:|---:|---:|
| 390 | 19.32 / 22.77 ms | 13.40 / 12.28 ms | 39.64 / 40.13 ms | 11.96 / 10.91 ms |
| 768 | 17.94 / 18.60 ms | 14.17 / 11.21 ms | 34.98 / 33.63 ms | 10.80 / 11.55 ms |
| 1440 | 19.70 / 17.93 ms | 13.97 / 12.57 ms | 36.09 / 36.88 ms | 12.02 / 11.81 ms |

All 72 scroll phases recorded zero long tasks (≥50 ms) and zero CLS. There is no consistent initial-loading improvement; initial JS medians vary in both directions. This is a synthetic callback responsiveness improvement, **not a real-user INP claim**. Source instrumentation means initial timings are diagnostic rather than production loading scores.

The minified article runtime changes from 17,136 to 17,130 bytes (gzip 5,842 → 5,838). Images and other assets are unchanged by this PR.

Edition profiling at all three widths and both themes: initial JS 13.6–17.6 ms; submitted search JS 0.7–4.2 ms. Existing 250 ms typing debounce, caching, result ordering and history remain unchanged. No second optimization was justified by these measurements.

## Validation

- `npm run build:public` — passed once; generated tracked changes were restored and are excluded from this PR.
- `npm run test:blog` — 238/238 plus golden snapshots. Includes embed origin/source/message validation, theme synchronization, retries, interactive telemetry and chart keyboard tests.
- `npm run test:build` — 89/89 against the public artifact.
- `npm run qa:edition` — 358/358: legacy links, analytics, articles, routes, ordering/filter combinations, pagination, Back/Forward and scroll restoration.
- `npm run qa:media` — 441 pages, 5,863 images and 5,009 srcset candidates; no missing files, false descriptors or ratio mismatches; all checks passed.
- `npm run test:consent` — analytics event tests and consent guard passed.
- New targeted progress regression test — passed again after adding share handoff assertions. Checks geometry reads before writes, frame coalescing, active section, percentage, resized viewport/content, end visibility/inert state and copy/native-share forwarding.
- `node perf/step8/browser-check.mjs` — all four articles at 390/768/1440 in both themes: progress matches geometry, active section/visibility/inert state match, no overflow, lightbox arrow/Escape/trigger restoration and YouTube Enter activation pass. Six reading screenshots captured and visually inspected locally.
- Baseline browser check (`STEP8_BASELINE=1`) reproduces the inherited lightbox opening-focus issue: focus stays on body immediately after opening instead of reaching the close button. Candidate behaves the same. Escape and trigger restoration pass on both. This issue was not changed here.
- Syntax checks and `git diff --check` passed.

Initial build-test/Edition/consent attempts against the unbuilt worktree lacked generated prerequisites; these passed after preparing the public artifact. They are not retained failures and no thresholds were weakened.

## Experiments and limits

No runtime experiment was reverted: the single geometry-batching candidate showed a consistent callback benefit and was retained. The first benchmark attempt was discarded because ignored build assets were absent; it also overlapped setup validation. Only the subsequent isolated 72-navigation comparison is retained.

No comprehensive Lighthouse or 72-screenshot rerun was needed. External iframe/social provider payloads were excluded for repeatability, so these numbers cover host-side initialization and scrolling, not live provider execution or transfer. Existing embed unit tests cover protocols/security; no live-provider performance claim is made.

Remaining opportunities: fix the inherited lightbox opening-focus behavior separately; collect live-provider traces before considering observer/retry changes. Edition month-range/date validation and search normalization can be reconsidered if the index grows, but current search work does not justify caching complexity.

## Reproduce

After installing the existing dependencies and preparing `npm run build:public`, run:

```sh
node perf/step8/benchmark.mjs
node perf/step8/browser-check.mjs
STEP8_BASELINE=1 node perf/step8/browser-check.mjs
```

Raw results: `results.json`, `browser-candidate-results.json`, `browser-baseline-results.json`, `bytes.json`, `environment.json` in this directory. Screenshots are written under `/tmp/step8-*.png`. The baseline commit is pinned in the harness. Run benchmarks without other test processes.
