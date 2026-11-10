# P-03A Home LCP investigation

## Baseline and method

Merged Main `b0995928bf1c6361a1162b2bdecf710767799491`, tree `fd89ca910a8494aa870a3b89836af2543603016b`; worktree starts at that commit. Identity: `/Users/giorgos/WebstormProjects/f1s-p03-evidence/base/identity.txt`. Artifact: `/Users/giorgos/WebstormProjects/f1s-p03-base/dist`. Evidence: `/Users/giorgos/WebstormProjects/f1s-p03-evidence/base/campaign/main/{home-1,home-2,home-3,results}.json`; results marks all three Home attempts valid. No new browser run.

Lighthouse 13.6.0, mobile 412×823, simulated throttling: RTT 150 ms, throughput 1638.4 Kbit/s, request latency 562.5 ms, download 1474.56 Kbit/s, upload 675 Kbit/s, CPU slowdown 4×. The ~2.9 s LCP is Lantern's simulated metric; the breakdown below is observed trace time and does not sum to it. Comparing these directly as a causal decomposition is invalid.

| Attempt | Simulated LCP ms | Observed TTFB | Load delay | Load duration | Render delay |
|---|---:|---:|---:|---:|---:|
| 1 | 2883.617 | 4.234 | 13.037 | 1.644 | 98.072 |
| 2 | 2883.891 | 2.943 | 5.609 | 4.768 | 73.089 |
| 3 | 2884.054 | 3.819 | 11.819 | 3.759 | 82.161 |

Median LCP 2883.891 ms, range 2883.617–2884.054 ms. These are the merged-Main JSON values, not the earlier candidate values in the plan.

## Requests and evidence

All three attempts have the same sizes and priorities below. Values are transfer/resource bytes; transfer includes HTTP overhead. Gzip is supported by server code and the document compression audit; sizes alone do not establish response headers. WOFF2 and AVIF are encoded formats, not gzip responses under this server's extension policy.

| Request | Attempts 1 / 2 / 3 transfer/resource | Priority | Delivery / role |
|---|---|---|---|
| `/` | 43771/213417 each | VeryHigh | gzip HTML; initial document |
| `20261110W/2-mobile.avif` | 35747/35552 each | High | AVIF; image preload and LCP |
| `barlow-condensed-700.woff2` | 15083/14888 each | High | WOFF2 font preload |
| `ibm-plex-sans-400-600-greek.woff2` | 16491/16296 each | High | WOFF2 font preload |
| `theme-init.min.js` | 730/943 each | High | gzip-eligible script; sole reported render-blocking request |
| `ibm-plex-sans-400-600.woff2` | 40435/40240 each | VeryHigh | WOFF2 font, network dependency tree |
| `ibm-plex-sans-400-600-arrows.woff2` | 3634/3440 each | VeryHigh | WOFF2 font, network dependency tree |

The reported network dependency tree is document → theme script and the two non-preloaded IBM fonts; its longest observed chain is 106/80/95 ms. It does **not** present the image as a member of that tree or prove those fonts are image dependencies. The network audit separately identifies the image and two other fonts as preloads. No external stylesheet request appears; built Home has 124341 bytes of inline style contents across six style elements, included in HTML resource size. No separate critical-request-chains, largest-contentful-paint-element or uses-text-compression audit is present; the current dependency-tree, LCP breakdown/discovery and document-latency insights provide the available equivalents.

Every attempt identifies `img#hero-image`, eager, high priority and discoverable in the initial document; the discovery checklist passes all three checks. Render-blocking insight lists the theme script at 151 ms in each attempt with estimated LCP savings 0 ms. Font-display insight has no entries in each attempt. Document-latency reports compression and no redirects in each attempt, observed server response 2/1/1 ms. Main-thread breakdown reports 860.044/598.472/750.028 ms; these audit values do not isolate a simulated LCP cause.

## Conclusion: INCONCLUSIVE

The small observed phases versus simulated LCP follow from comparing trace observations with Lighthouse's model under mobile network and CPU settings; the available JSON does not quantify individual simulated contributions or establish a dominant Home property. The local server's `scripts/perf/lighthouse-guard.mjs` `sendFile` gzips HTML, CSS, JS and other listed text types when gzip is accepted. The document audit confirms compression in all three attempts; the HTML transfer is much smaller than its decoded size. Therefore an uncompressed HTML loopback response is not the evidenced cause. The server comment says GitHub Pages serves gzip; production headers were not checked because network is off, so production behavior is inferred, not verified.

HYPOTHESIS: compressed HTML size, concurrent requests, CPU work or the simulated network model could materially contribute; these records do not rank them. No product change or derivative rebuild was made. For P-03D, consider retaining a reproducible Lantern dependency/timing attribution and comparing controlled response headers/protocol with production when network access is authorized; first establish whether any measurement mismatch exists. Do not assume compression is missing.

## Round 2: single-factor attribution

LCP values are simulated milliseconds in attempt order. Control min/max/median: **2883.107 / 2887.778 / 2883.135 ms**. The predeclared rule requires non-overlapping ranges and a median change of at least 5% and 100 ms; fewer than three valid attempts is inconclusive. Validity below refers to runner checks; the Home no-font-preload variant also fails the CLS budget (0.047 > 0.02).

| Variant | Valid | 3 LCPs (ms) | Median | Min–max | Verdict vs control | Reading |
|---|---|---|---:|---|---|---|
| control | 3/3 | 2887.778, 2883.135, 2883.107 | 2883.135 | 2883.107–2887.778 | Reference | Unmodified clone. |
| no-font-preload | 3/3 | 3451.987, 2734.686, 2734.154 | 2734.686 | 2734.154–3451.987 | No measurable change | Ranges overlap; CLS budget fails. |
| no-webfonts | 3/3 | 3109.248, 2282.329, 3107.601 | 3107.601 | 2282.329–3109.248 | No measurable change | Ranges overlap; font removal also changes fallback geometry. |
| no-theme-init | 0/3 | 2811.895, 2809.794, 2808.140 | 2809.794 | 2808.140–2811.895 | Inconclusive | Theme check fails; diagnostic only. |
| html-trim | 0/3 | 2810.586, 3332.671, 3258.048 | 3258.048 | 2810.586–3332.671 | Inconclusive | Readiness checks fail; diagnostic only. |
| no-image-preload | 3/3 | 3560.194, 3632.179, 3557.545 | 3560.194 | 3557.545–3632.179 | Regression | All attempts are slower; median +677.059 ms (+23.5%). |

The conclusion remains **INCONCLUSIVE** for a fix: removing the image preload is consistently slower and meets the regression threshold, while valid font interventions do not show a measurable improvement. Invalid variants are diagnostic only, never evidence of a fix. HYPOTHESIS: font payload under the simulated 1.47 Mbit/s link contributes to LCP. A next experiment would measure a controlled font subset or fewer webfonts against a matched control; either choice changes typography and requires an owner trade-off decision. Host 1-minute load averages were 6.89 before and 6.44 after the variant run, versus 4.84 before and 5.05 after the baseline campaign (orchestrator `uptime` records in `/Users/giorgos/WebstormProjects/f1s-p03-evidence/logs/variants-run.txt` and `logs/base-run.txt`); this limits comparability. Three attempts can straddle simulated LCP modes about 450 ms apart.

Evidence: `/Users/giorgos/WebstormProjects/f1s-p03-evidence/variants/results/table.txt`, `/Users/giorgos/WebstormProjects/f1s-p03-evidence/variants/results/`, `/Users/giorgos/WebstormProjects/f1s-p03-evidence/variants/README.md`, `/Users/giorgos/WebstormProjects/f1s-p03-evidence/NOISE-THRESHOLD.md`, and `/Users/giorgos/WebstormProjects/f1s-p03-evidence/base/campaign/`.

## Matched benchmark

Not applicable: no product change in this PR. Baseline: base/campaign; diagnostics: variants/results.

Evidence: `/Users/giorgos/WebstormProjects/f1s-p03-evidence/base/campaign/` and `/Users/giorgos/WebstormProjects/f1s-p03-evidence/variants/results/`.
