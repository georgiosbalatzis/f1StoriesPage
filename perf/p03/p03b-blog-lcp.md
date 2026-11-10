# P-03B Blog LCP investigation

## Baseline and method

INCONCLUSIVE: neither a dominant Blog-specific product cost nor a loopback server artifact is established. No product change is justified by these reports.
Baseline merged Main `b0995928bf1c6361a1162b2bdecf710767799491`, tree `fd89ca910a8494aa870a3b89836af2543603016b`; Node 22.23.4, npm 10.9.9, Apple M3 Pro. Identity: `/Users/giorgos/WebstormProjects/f1s-p03-evidence/base/identity.txt`.
Read `/Users/giorgos/WebstormProjects/f1s-p03-evidence/base/campaign/main/{blog-1.json,blog-2.json,blog-3.json,results.json}`, the frozen `/Users/giorgos/WebstormProjects/f1s-p03-base/dist/blog-module/blog/index.html`, and `scripts/perf/lighthouse-{guard,rate-safe}.mjs`. All three attempts are valid in results.json. This is the merged Main campaign; the earlier plan's numbers belong to a different campaign.

All reports use mobile 412×823, DPR 1.75, Lighthouse `simulate`: RTT 150 ms, throughput 1638.4 Kbps, request latency 562.5 ms, download 1474.56 Kbps, upload 675 Kbps, CPU slowdown 4. Lantern models network and CPU from the observed trace; the reported breakdown is observed, so its phases cannot be summed to explain the simulated metric. The throttling model explains why the two sets of timings are different, but these reports do not quantify each dependency's simulated contribution.

| Attempt | Simulated LCP ms | Observed TTFB | Load delay | Load duration | Render delay | Tree longest ms |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 2735.706 | 3.270 | 18.295 | 4.047 | 70.927 | 84 |
| 2 | 2733.992 | 3.544 | 28.388 | 3.615 | 67.678 | 91 |
| 3 | 2734.683 | 4.629 | 5.396 | 4.949 | 70.685 | 76 |

Median simulated LCP 2734.683 ms, range 2733.992–2735.706 ms; budget 2500 ms. All identify `article.ed-lead > a.ed-lead__link > span.ed-media > img`, selected `20261110W/1-mobile.webp`. All discovery checklists say initial-document discoverable, eager and fetchpriority high; frozen HTML also contains its responsive image preload and image markup. No late-discovery fix is supported.

## Requests and attribution

In all three attempts the following transfer/resource bytes and reported priorities are identical. Transfer size includes headers; gzip refers to HTTP text compression, not the intrinsic WebP/WOFF2 encoding. The server does not gzip WebP or WOFF2. The network-dependency-tree insight reports the document with theme script and the two non-preloaded IBM fonts as children; it does not establish that the fonts are image dependencies. The image and two other fonts are preloads shown by network requests, not listed as critical-tree children.

| Request | Transfer / resource bytes | Priority | HTTP gzip | Role |
|---|---:|---|---|---|
| Blog `index.html` | 29945 / 146800 | VeryHigh | yes | document; contains inline CSS |
| `theme-init.min.js` | 730 / 943 | High | yes | sole reported render-blocking request |
| `barlow-condensed-700.woff2` | 15083 / 14888 | High | no | font preload |
| `ibm-plex-sans-400-600-greek.woff2` | 16491 / 16296 | High | no | font preload |
| `ibm-plex-sans-400-600.woff2` | 40435 / 40240 | VeryHigh | no | critical-tree font |
| `ibm-plex-sans-400-600-arrows.woff2` | 3634 / 3440 | VeryHigh | no | critical-tree font |
| `20261110W/1-mobile.webp` | 34071 / 33876 | High | no | LCP image preload |

No external CSS request is reported: CSS is inline; `results.json` records 91745 inline CSS bytes and zero route CSS bytes in every attempt. The render-blocking insight reports the theme script at 151 ms and estimated LCP savings 0 ms in each attempt; font-display insight has no items. `largest-contentful-paint-element`, `critical-request-chains`, and `uses-text-compression` are absent; the current LCP breakdown and network-dependency-tree insights supply the available element and tree. Document latency insight reports no redirects, 1 ms observed server response, and compression in all attempts.

`scripts/perf/lighthouse-guard.mjs:97` gzip-compresses HTML, CSS and JS when accepted, with `content-encoding: gzip`; network transfer/resource sizes and the document insight corroborate compression for this run. Thus the proposed uncompressed-loopback explanation is contradicted for the document and theme script. This does not prove parity with production: loopback is HTTP/1.1, no-store, and real production delivery was not measured. Shared theme script and server are cross-route; any comparison of origin/protocol and simulated dependency costs belongs in P-03D. HYPOTHESIS: inline CSS/HTML size, competing preloads, or simulated CPU/network work contributes; their relative impact is unproven. No causal savings or speed-up is claimed.

## Change made

Documentation only. No build or product checks were run because there is no product change. Browser and Lighthouse runs are reserved for the orchestrator.

## Round 2: single-factor attribution

LCP values are simulated milliseconds in attempt order. Control min/max/median: **2734.916 / 3189.901 / 3185.518 ms**. The predeclared rule requires non-overlapping ranges and a median change of at least 5% and 100 ms; fewer than three valid attempts is inconclusive.

| Variant | Valid | 3 LCPs (ms) | Median | Min–max | Verdict vs control | Reading |
|---|---|---|---:|---|---|---|
| control | 3/3 | 3189.901, 3185.518, 2734.916 | 3185.518 | 2734.916–3189.901 | Reference | Unmodified clone; attempts span modes. |
| no-font-preload | 3/3 | 2736.668, 3275.058, 2734.091 | 2736.668 | 2734.091–3275.058 | No measurable change | Ranges overlap. |
| no-webfonts | 3/3 | 2734.744, 2807.330, 2732.827 | 2734.744 | 2732.827–2807.330 | No measurable change | Ranges overlap; font removal also changes fallback geometry. |
| no-theme-init | 0/3 | 2662.261, 3258.134, 2660.733 | 2662.261 | 2660.733–3258.134 | Inconclusive | Theme check fails; diagnostic only. |
| html-trim | 0/3 | 2737.405, 3183.484, 2733.396 | 2737.405 | 2733.396–3183.484 | Inconclusive | Readiness check fails; diagnostic only. |
| no-image-preload | 3/3 | 3258.787, 3257.526, 3257.043 | 3257.526 | 3257.043–3258.787 | No measurable change | All attempts are slower, but median +72.008 ms (+2.3%) is below both thresholds. |

The conclusion remains **INCONCLUSIVE** for a fix: no valid intervention meets the improvement threshold. Invalid variants are diagnostic only, never evidence of a fix. HYPOTHESIS: font payload under the simulated 1.47 Mbit/s link contributes to LCP. A next experiment would measure a controlled font subset or fewer webfonts against a matched control; either choice changes typography and requires an owner trade-off decision. Host 1-minute load averages were 6.89 before and 6.44 after the variant run, versus 4.84 before and 5.05 after the baseline campaign (orchestrator `uptime` records in `/Users/giorgos/WebstormProjects/f1s-p03-evidence/logs/variants-run.txt` and `logs/base-run.txt`); this limits comparability. Three attempts can straddle simulated LCP modes about 450 ms apart.

Evidence: `/Users/giorgos/WebstormProjects/f1s-p03-evidence/variants/results/table.txt`, `/Users/giorgos/WebstormProjects/f1s-p03-evidence/variants/results/`, `/Users/giorgos/WebstormProjects/f1s-p03-evidence/variants/README.md`, `/Users/giorgos/WebstormProjects/f1s-p03-evidence/NOISE-THRESHOLD.md`, and `/Users/giorgos/WebstormProjects/f1s-p03-evidence/base/campaign/`.

## Matched benchmark

Not applicable: no product change in this PR. Baseline: base/campaign; diagnostics: variants/results.

Evidence: `/Users/giorgos/WebstormProjects/f1s-p03-evidence/base/campaign/` and `/Users/giorgos/WebstormProjects/f1s-p03-evidence/variants/results/`.
