# P-03D — Article and aggregate benchmark

- **Article without BetCast: MEASURED** (existing baseline; no new campaign).
- **Aggregate: BLOCKED** — verified frozen child inputs are unavailable.
- **BetCast-embedded Article: BLOCKED** — owner decision on controlled HTTPS experiment required.

## Baseline and repeatability

Merged Main `b0995928bf1c6361a1162b2bdecf710767799491`, tree `fd89ca910a8494aa870a3b89836af2543603016b`; Node 22.23.4, npm 10.9.9, Apple M3 Pro. Baseline `build:public`, `build:check`, and `perf:budget` exited 0; campaign exited 1. Earlier P-02 candidate `d4c8f08ff53d2c65e8864fbd7493aecf9029c3a6` records the same tree. The earlier identity does not list runner blobs; resolving both recorded commits with `git ls-tree` shows matching rate-safe runner `304634899a2270acaf2ffe552dc10d1b6b14cbe8` and guard `b36abee4d6d23166046c3f8a140edac40467c406` blobs. Identity files: `/Users/giorgos/WebstormProjects/f1s-p03-evidence/base/identity.txt` and `/Users/giorgos/WebstormProjects/f1s-p02a-evidence/pi/final/identity.txt`; exits: `/Users/giorgos/WebstormProjects/f1s-p03-evidence/base/exits.txt`.

Both campaigns selected `/blog-module/blog-entries/20261110W/article.html` (Kenny Roberts Jr.); all observations report `betcast: false`. Selection is the newest built index row (`scripts/perf/lighthouse-guard.mjs:261`). LCP is simulated, in ms; medians are per column. Attempt budget columns compare the displayed values with the score ≥95 and LCP ≤2500 thresholds; the evaluator reports the median outcome, not individual attempt outcomes.

| Attempt | Main valid | Main score | Main LCP | Main thresholds missed | Earlier valid | Earlier score | Earlier LCP | Earlier thresholds missed |
|---|---|---:|---:|---|---|---:|---:|---|
| 1 | yes | 91 | 3557.829 | score, LCP | yes | 90 | 3557.680 | score, LCP |
| 2 | yes | 95 | 2958.363 | LCP | yes | 95 | 2957.918 | LCP |
| 3 | yes | 95 | 2957.114 | LCP | yes | 91 | 3482.116 | score, LCP |
| median | 3/3 valid | 95 | 2958.363 | LCP (FAIL) | 3/3 valid | 91 | 3482.116 | score, LCP (FAIL) |

Every attempt and both medians identify `div.rr-cover__grid > figure.rr-cover__media > picture > img.article-header-img`, eager and high priority, with resource `/blog-module/blog-entries/20261110W/2-mobile.avif`. Each reports the sole render-blocking resource `/scripts/theme-init.min.js?v=d8c05277`, 730 transferred bytes, estimated LCP savings 0 ms. Blocking durations for Main attempts 1/2/3 and median: 151/151/151 and 151 ms; earlier: 150/151/151 and 151 ms. Loopback ports are 65420 and 63581 respectively. This is a repeatability observation, not a performance-change claim. The predeclared comparison rules are in `/Users/giorgos/WebstormProjects/f1s-p03-evidence/NOISE-THRESHOLD.md`.

Raw evidence: `/Users/giorgos/WebstormProjects/f1s-p03-evidence/base/campaign/main/results.json` and `article-1.json` through `article-3.json` in that directory; earlier equivalents are in `/Users/giorgos/WebstormProjects/f1s-p02a-evidence/pi/final/campaign/main/`.

## Measurement stability

Simulated LCP takes discrete values: Blog control attempts were 3189.901, 3185.518 and 2734.916 ms, while merged-Main baseline Blog attempts were 2735.706, 2733.992 and 2734.683 ms. Three attempts can straddle modes about 450 ms apart. Host 1-minute load averages were 6.89 before and 6.44 after the variant run, versus 4.84 before and 5.05 after the baseline campaign (orchestrator `uptime` records in `/Users/giorgos/WebstormProjects/f1s-p03-evidence/logs/variants-run.txt` and `logs/base-run.txt`), limiting comparability. Evidence: `/Users/giorgos/WebstormProjects/f1s-p03-evidence/variants/results/table.txt` and `/Users/giorgos/WebstormProjects/f1s-p03-evidence/base/campaign/main/results.json`.

The gate's attempt count and evaluator are unchanged. Any study of attempt count belongs to a future, separately reviewed change.

## Aggregate — BLOCKED

The following pins, output directories and Node versions are from `scripts/deployment/sources.json`. For **each** child, a candidate-ready built output tied to the pinned source, provenance, digest/build metadata and valid freshness evidence are unverified or missing. TYRES additionally needs a frozen data commit and digest, including refresh identity and freshness. Historical outputs in `/Users/giorgos/WebstormProjects/f1s-p01-evidence/p01-local-site.tar.gz` have not been recovered or verified as complete current inputs; the archive is not evidence of candidate readiness. The scope records its Main as `58273df6d753510605468c0787d9cdf04d6d398e` and TYRES data SHA `dbc69155aaa8e8c2af3556ef02ba18d54ad0ba0c`.

| Child / destination | Pinned source SHA | Output | Node |
|---|---|---|---:|
| Telemetry `/telemetry/` | `38c3dd2018b810a5dce1add1f7663bcb199c845a` | `dist` | 22 |
| Ghostcar `/ghostcar/` | `13fc12afb7c73ccbab6e71fc3d3210d922038d51` | `dist` | 22 |
| TYRES `/tyres/` | `249aa796a1981be4f70213c9f1973b4418faf3ca` | `dist` | 24 |
| BetCast `/betcast/` | `74eeb98b4acb1b4e0ea45d4ab12f7fdf4e0c2650` | `build` | 22 |

Owner must supply verified frozen outputs and metadata, or approve a separately verified recovery of complete unmodified archived inputs with current freshness and TYRES data identity. Assemble copies with the existing `scripts/deployment/assemble.mjs` only after verification. Do **not** use `build:ecosystem --local`: its non-reuse build path runs the configured TYRES refresh (`scripts/deployment/build.mjs:124`, `:129`). No build was run for this report.

## BetCast-embedded Article — BLOCKED

Owner must decide whether to authorize a separately designed controlled HTTPS production-host experiment, including frozen fixtures, origin, embed/data readiness and observer coverage. Earlier `/Users/giorgos/WebstormProjects/f1s-p02a-evidence/integration/campaign/main/results.json` selected `20261107-2J` but invalidated attempts on an unmatched aborted production-host BetCast document request; `integration/campaign-v2/main/results.json` records iframe session loss and document/data readiness failures. Loopback differs from production HTTPS and prevents representative third-party attribution. Neither series is a valid embedded-article benchmark.
