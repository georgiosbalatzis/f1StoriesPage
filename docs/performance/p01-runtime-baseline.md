# P-01 runtime baseline

| Baseline | Pinned code SHA |
|---|---|
| Main | `58273df6d753510605468c0787d9cdf04d6d398e` |
| Telemetry | `38c3dd2018b810a5dce1add1f7663bcb199c845a` |
| Ghost Car | `13fc12afb7c73ccbab6e71fc3d3210d922038d51` |
| TYRES | `249aa796a1981be4f70213c9f1973b4418faf3ca` |
| BetCast | `74eeb98b4acb1b4e0ea45d4ab12f7fdf4e0c2650` |

**Evidence date:** 2026-11-10 UTC. **Scope:** eleven public routes, two separate environments, supplied browser captures and read-only source analysis. No new measurement was run for this report.

**Evidence key:** `M:path:line` means Main at the SHA above; child-prefixed references use that child's pin. `S-*` identifies the adjudicated finding in [findings.json](../../perf/p01/findings.json). Compact identities and units: [baseline.json](../../perf/p01/baseline.json), [matrix.json](../../perf/p01/matrix.json), [README](../../perf/p01/README.md). Retained raw evidence uses `local-bundle:p01-evidence.tar.gz#<path>`; checksums/retrieval status belong to [evidence-index.json](../../perf/p01/evidence-index.json). A bundle reference does not attest remote upload or independent review.

**Limitations:** one host/browser, synthetic throttling and replayed/blocked providers; application readiness is incomplete. Benchmark Lighthouse n=1 with providers blocked. Interaction contexts have unverified assertions. Field INP and Core Web Vitals are unavailable. Production and local-built are separate baselines; never subtract or pool them. Every unmeasured saving is **TBD — requires P-0X measurement**.

## Fixed URLs and route matrix

Production origin is `https://f1-stories.gr`; append the exact paths below. Local-built uses the same paths on the frozen aggregate's loopback origin. Articles were selected from the 429-row published index, whose SHA-256 was `11228190b9826c79cd801cdeb606da2c82584a12091c09d4bb086fb6e32766f0`. Preserve row order for latest selection (`M:blog-module/blog-index.js:147`). No private dashboard data was opened.

| Route ID | Exact path | Class / reason |
|---|---|---|
| home | `/` | Primary; editorial landing |
| index | `/blog-module/blog/` | Primary; THE INDEX archive |
| latest | `/blog-module/blog-entries/20261107-2J/article.html` | Primary; published row 0; managed embed |
| standings | `/standings/` | Primary; THE GRID |
| telemetry | `/telemetry/` | Primary; pinned child |
| ghostcar | `/ghostcar/` | Primary; pinned child |
| tyres | `/tyres/` | Primary; pinned child |
| betcast | `/betcast/` | Primary; pinned child |
| long | `/blog-module/blog-entries/20250602-1G/article.html` | Secondary; 28-minute article, seven source tables |
| historical | `/blog-module/blog-entries/20250301G/article.html` | Secondary; oldest index date, source-less retained HTML |
| dashboard | `/dashboard/` | Secondary; locked public shell only |

The Gate E archive URL is `/blog-module/blog/index.html`, a distinct tested URL from the slash benchmark route. Its n=3 results are not replaced by the slash route's n=1 diagnostic.

## Environment, profiles and collection

| Setting | Recorded value / interpretation |
|---|---|
| Host | Apple M3 Pro, arm64, 36 GiB RAM, Darwin 27.0.0 |
| Browser | Chrome for Testing 158.0.8127.18; binary SHA-256 `6ac929cf1af41969ed0de43ac88a015ae4b70f92dcc1bfb60871bfa7f141e96d` |
| Collector / build Node | Host/default Node: 26.13.0; retained collection runner selects Node 22.23.4; actual collection-process Node was not captured per attempt and is unverified. Main/Telemetry/Ghost Car/BetCast build and Gate E: Node 22.23.4; TYRES: Node 24.22.2 |
| Mobile | 390×844, DPR3, touch/mobile UA |
| Tablet | 768×1024, DPR2, touch/mobile UA |
| Desktop | 1440×900, DPR1, desktop UA; also throttled, not physical desktop speed |
| CDP throttle | 150 ms latency; 200,000 B/s down; 93,750 B/s up; CPU ×4 |
| Lighthouse | v13.6.0; simulated 150 ms RTT, 1600 Kbit/s, CPU ×4; CDP throttle reset first |
| Initial window | At least navigation +6 s and load +1 s; readiness capped at 25 s |
| Cold state | Fresh context/cache/storage; only theme and essential consent seeded; analytics false |
| Theme | Theme storage and preferred color scheme seeded together; audited-page verification differs by method |
| Production delivery | Live first-party HTTPS/HTTP/2; external APIs replayed or blocked for controlled CDP |
| Local-built delivery | Aggregate artifact, HTTP/1.1 gzip; build/data/transport differ from production |

Source lock authority is `M:scripts/deployment/sources.json:1`; CI majors follow `M:.github/actions/setup/action.yml:19` and `M:scripts/deployment/release.mjs:77`. Host/default Node: 26.13.0; retained collection runner selects Node 22.23.4; actual collection-process Node was not captured per attempt and is unverified.

Production before/after records retain identity `sha256-9ac925c76bd67eb2a8d6df1fc36c88820ccececa3298f8979b3df0f4ca5996ae` in recorded phases. Production manifest build ID was `42714120119`. Lighthouse and offline lack separate release brackets. Local manifest outputDigest is `584d508980d382930eeb95506477fd71e6843c5d37a15ac4333dfb631836df17`; per-attempt local release is null and complete local bracketing is absent. TYRES code and data differ in identity: data SHA `dbc69155aaa8e8c2af3556ef02ba18d54ad0ba0c`, with a separately refreshed overlay. Manifest outputDigest and Gate E tree hashes have different schemes/scopes and are not interchangeable.

| Series, per environment | Coverage | Recorded count | Interpretation |
|---|---|---:|---|
| Primary cold CDP | 8 routes × mobile/desktop × light × 5 | 80 | n=5 per cell; collector assertions pass |
| Secondary cold CDP | 3 routes × mobile/desktop × light | 6 | n=1 per cell |
| Dark CDP | 11 routes × mobile/desktop | 22 | n=1 screen |
| Tablet CDP | 11 routes × light/dark | 22 | n=1 screen |
| Warm CDP | 11 routes × mobile/desktop × light | 22 | One measured return after prime; providers blocked |
| Real-provider CDP | 5 interactive routes × mobile | 5 | Availability observation; incomplete provider paths |
| Benchmark Lighthouse | 11 routes × mobile/desktop × light | 22 | n=1 diagnostic, providers blocked; audited-page state unobserved |
| LAB interactions | 10 routes × mobile/desktop | 20 contexts | Three journeys/context; no context fully validates all six assertions |
| Cache/offline | home/standings/ghostcar × 5 stages | 15 | Different states, not five replicates |

Totals across environments: 304 controlled CDP navigations plus 10 real-provider observations, 44 benchmark Lighthouse diagnostics, 40 interaction contexts/120 journey repetitions, 30 cache stages and one local migration fixture. Admission uses the 354 IDs in retained `attempts.jsonl`, joined to `runs.jsonl`; 73 other run rows are excluded. The 44 Lighthouse and cache records are separate. [summary.tsv](../../perf/p01/summary.tsv), [runs.jsonl](../../perf/p01/runs.jsonl) and retained validation distinguish collector validity from strict protocol validation.

## Methodology deviations

Initial a0 tooling was incomplete. Follow-up passes a1–a8 (retained `prompts/a1.md` through `prompts/a8.md` and `out/a1.md` through `out/a8.md`) addressed validity and null handling, control and readiness selectors, and Lighthouse cleanup. Pilot attempts were discarded after configuration changes. The first full Lighthouse phase crashed in cleanup and was rerun. The post-a8 rerun replaced Lighthouse and interaction phases, local-built first and then production. Admitted CDP/interaction IDs are those in `evidence/attempts.jsonl`, joined to `evidence/runs.jsonl`; Lighthouse rows are in `evidence/lighthouse.jsonl`. Superseded `evidence/attempts-before-a8-rerun.jsonl`, `evidence/interactions-before-a8-rerun.jsonl`, and `evidence/attempts-pilot-discarded.jsonl` remain retained.

Unresolved gaps include unverified interaction assertions and Lighthouse audited-page state, incomplete readiness/round fixtures, missing local identity brackets, unverified process Node, n=1 screen escalation and unavailable field data. These reruns do not close those gaps.

## Cold CDP baseline

Each entry is median [observed minimum–maximum], **n=5**, light theme, initial viewport. Timing is ms; CLS is unitless. TaskDuration is a main-target cumulative counter converted from seconds, **not TBT**. Known bytes sum numeric request sizes, including replay; unknown sizes remain missing, so the sum is a lower bound. Requests are collector counts, not successful data loads. Detailed ScriptDuration, LayoutDuration, RecalcStyleDuration, DOM, long-task records and missing counts remain in the raw runs and [summary.tsv](../../perf/p01/summary.tsv).

### production

| Route | Device | FCP ms | LCP ms | CLS | TaskDuration ms | Requests | Known B |
|---|---|---:|---:|---:|---:|---:|---:|
| home | mobile | 800 [792–816] | 2320 [2316–2336] | 0 [0–0] | 508.3 [496.5–527.5] | 22 [22–22] | 432083 [432046–432228] |
| home | desktop | 804 [784–808] | 1808 [1796–1820] | 0.003 [0.003–0.003] | 512.6 [511.8–523.5] | 23 [23–23] | 541756 [541573–541783] |
| index | mobile | 712 [696–716] | 1116 [1112–1140] | 0 [0–0] | 369.1 [367.9–380.4] | 20 [20–20] | 210773 [210745–210783] |
| index | desktop | 700 [692–700] | 1224 [1204–1256] | 0.014 [0.014–0.014] | 346.2 [340.2–351.7] | 21 [21–21] | 257940 [257928–257969] |
| latest | mobile | 796 [788–824] | 2220 [2088–2296] | 0 [0–0] | 460.9 [457.1–499.7] | 38 [38–38] | 591327 [591310–591384] |
| latest | desktop | 784 [780–788] | 2256 [2252–2276] | 0 [0–0] | 446.5 [442.3–463.3] | 38 [38–38] | 591349 [591313–591390] |
| standings | mobile | 684 [680–692] | 684 [680–692] | 0.001 [0.001–0.001] | 391.5 [387.3–393.8] | 37 [37–37] | 233948 [233931–233973] |
| standings | desktop | 696 [692–696] | 696 [692–696] | 0.038 [0.038–0.038] | 400.5 [394.5–406.3] | 37 [37–37] | 233937 [233901–233953] |
| telemetry | mobile | 1488 [1480–1488] | 1488 [1480–1488] | 0 [0–0] | 589 [573.5–611.7] | 42 [42–42] | 966475 [966327–966535] |
| telemetry | desktop | 1488 [1484–1500] | 1488 [1484–1500] | 0.001 [0.001–0.001] | 594.6 [591.5–620.7] | 42 [42–42] | 841318 [841278–841364] |
| ghostcar | mobile | 1008 [996–1052] | 1008 [996–1052] | 0.161 [0.16–0.162] | 196.3 [194.4–206.3] | 19 [19–19] | 419569 [419540–419591] |
| ghostcar | desktop | 1008 [992–1012] | 1008 [992–1012] | 0.06 [0.06–0.06] | 214.5 [212.1–217] | 19 [19–19] | 419550 [419510–419600] |
| tyres | mobile | 988 [960–1068] | 988 [960–1068] | 0 [0–0] | 249.4 [244.9–250.5] | 14 [14–14] | 144304 [144275–144335] |
| tyres | desktop | 980 [972–996] | 980 [972–996] | 0 [0–0] | 512.8 [504.8–535.4] | 16 [16–16] | 416338 [416214–416361] |
| betcast | mobile | 744 [740–748] | 2708 [2704–2744] | 0.082 [0.014–0.082] | 406.9 [400.2–422.6] | 26 [26–26] | 410308 [410044–410329] |
| betcast | desktop | 748 [744–760] | 748 [744–760] | 0.055 [0.049–0.103] | 468.7 [462–486.7] | 26 [26–26] | 410308 [410253–410329] |

### local-built

| Route | Device | FCP ms | LCP ms | CLS | TaskDuration ms | Requests | Known B |
|---|---|---:|---:|---:|---:|---:|---:|
| home | mobile | 800 [788–804] | 2332 [2324–2336] | 0 [0–0] | 525.2 [518–532.3] | 22 [22–22] | 432619 [432619–432619] |
| home | desktop | 1072 [1064–1092] | 1464 [1464–1480] | 0.002 [0.002–0.002] | 497.6 [484.1–498] | 23 [23–23] | 542125 [542125–542125] |
| index | mobile | 712 [708–720] | 1020 [1008–1048] | 0 [0–0] | 384.2 [379.9–394.5] | 20 [20–20] | 211505 [211505–211505] |
| index | desktop | 704 [696–704] | 1028 [1020–1048] | 0.014 [0.014–0.014] | 359.2 [356.2–364.1] | 21 [21–21] | 258724 [258724–258724] |
| latest | mobile | 776 [768–788] | 1772 [1768–1776] | 0 [0–0] | 362 [351.5–364.1] | 23 [23–23] | 320195 [320195–320195] |
| latest | desktop | 780 [768–788] | 1776 [1772–1776] | 0 [0–0] | 346.6 [344.1–353.8] | 23 [23–23] | 320195 [320195–320195] |
| standings | mobile | 808 [804–812] | 808 [804–812] | 0.001 [0.001–0.001] | 402.6 [401.1–410.6] | 37 [37–37] | 235975 [235975–235975] |
| standings | desktop | 796 [788–804] | 796 [788–804] | 0.008 [0.008–0.008] | 409.7 [408.4–412.9] | 37 [37–37] | 235975 [235975–235975] |
| telemetry | mobile | 1508 [1504–1512] | 1508 [1504–1512] | 0 [0–0] | 625.6 [622.4–660.1] | 42 [42–42] | 967916 [967916–967916] |
| telemetry | desktop | 1508 [1496–1512] | 1508 [1496–1512] | 0.001 [0.001–0.001] | 616.6 [607.6–636.9] | 42 [42–42] | 842840 [842840–842840] |
| ghostcar | mobile | 1012 [1008–1024] | 1012 [1008–1024] | 0.163 [0.161–0.163] | 207.4 [204.5–216.4] | 19 [19–19] | 420096 [420096–420096] |
| ghostcar | desktop | 1016 [1008–1020] | 1016 [1008–1020] | 0.06 [0.06–0.06] | 234 [231–242.1] | 19 [19–19] | 420096 [420096–420096] |
| tyres | mobile | 948 [944–956] | 948 [944–956] | 0 [0–0] | 260.9 [256.9–266.3] | 14 [14–14] | 145062 [145062–145062] |
| tyres | desktop | 952 [940–964] | 952 [940–964] | 0 [0–0] | 530 [515.9–571.5] | 16 [16–16] | 561606 [561606–561606] |
| betcast | mobile | 756 [736–768] | 2720 [2692–2748] | 0.077 [0.014–0.091] | 425.1 [415.1–466.5] | 26 [26–26] | 409091 [409091–409091] |
| betcast | desktop | 756 [748–756] | 756 [748–756] | 0.049 [0.048–0.097] | 479.4 [476.3–511.3] | 26 [26–26] | 409091 [409091–409091] |

### Initial payload by resource type

The following is **one representative mobile cold light sample per route/environment**, not an n=5 byte estimate. Values are known recorded B by request type; `—` means no matching request, not an inline-byte measurement. `+?` means at least one size in that type is unknown. Stylesheet columns exclude inline CSS in HTML. Script counts include child frames where captured; they are not a dependency-to-chunk attribution. Raw source, emitted files, decoded bodies and transferred bytes are different quantities. Full request and decoded-body details: [resources.tsv](../../perf/p01/resources.tsv); full waterfall: `local-bundle:p01-evidence.tar.gz#evidence/network.tsv`.

**production, n=1 representative per row**

| Route | HTML/document B | JS B | External CSS B | Images B | Fonts B | DOM nodes | Long tasks |
|---|---:|---:|---:|---:|---:|---:|---:|
| home | 44464 | 16715 | — | 277396 | 75651 | 1041 | 0 |
| index | 30350 | 25850 | — | 60900 | 75738 | 843 | 0 |
| latest | 47811 | 217098 | 7981 | 152749 | 147638 | 456 | 0 |
| standings | 42708 | 38669 | — | 40843 | 75579 | 1759 | 1 |
| telemetry | 1398 | 232237 | 15897 | 197788 | 72096 | 1291 | 1 |
| ghostcar | 1608 | 101898 | 11876 | 197954 | 72104 | 203 | 0 |
| tyres | 16422 | 36461 | 10288 | 5483 | 71899 | 1219 | 0 |
| betcast | 939 | 190752 | 8049 | 103890 | 72047 | 334 | 1 |

**local-built, n=1 representative per row**

| Route | HTML/document B | JS B | External CSS B | Images B | Fonts B | DOM nodes | Long tasks |
|---|---:|---:|---:|---:|---:|---:|---:|
| home | 43594 | 17668 | — | 277317 | 75971 | 1041 | 0 |
| index | 29808 | 26598 | — | 61059 | 75971 | 843 | 0 |
| latest | 46256 +? | 27047 | — | 152852 | 75971 | 456 | 1 |
| standings | 42000 | 39950 | — | 41760 | 75971 | 1759 | 1 |
| telemetry | 1316 | 232612 | 15670 | 198398 | 72255 | 1293 | 1 |
| ghostcar | 1525 | 101793 | 11734 | 198530 | 72255 | 203 | 0 |
| tyres | 16318 | 36754 | 10081 | 5695 | 72255 | 1219 | 0 |
| betcast | 856 | 189024 | 8014 | 104352 | 72255 | 334 | 1 |

## Benchmark Lighthouse diagnostics

**Benchmark Lighthouse n=1 with providers blocked** for every row. Each table is its own environment. Simulated metrics are not pooled with CDP and do not reproduce Gate E. Scores are /100 in performance/accessibility/best-practices/SEO order; timings rounded to ms, CLS to three decimals. Audited-page settled theme, consent, SW and analytics state were not observed; seeded state alone cannot validate those pages. These diagnostic scores are not a stable regression baseline or field experience.

### production: diagnostic n=1

| Route | Device | Scores P/A/BP/SEO | FCP ms | LCP ms | TBT ms | Speed Index ms | CLS |
|---|---|---|---:|---:|---:|---:|---:|
| home | mobile | 99/100/100/100 | 1228 | 1963 | 109 | 1410 | 0 |
| home | desktop | 84/100/100/100 | 1074 | 2595 | 63 | 1074 | 0 |
| index | mobile | 97/96/100/100 | 926 | 2446 | 122 | 926 | 0.004 |
| index | desktop | 85/96/100/100 | 1006 | 2443 | 0 | 1006 | 0 |
| latest | mobile | 98/100/100/100 | 1087 | 2271 | 81 | 1261 | 0.004 |
| latest | desktop | 80/100/100/100 | 1155 | 3048 | 17 | 1155 | 0 |
| standings | mobile | 100/97/100/100 | 1067 | 1067 | 29 | 1067 | 0 |
| standings | desktop | 98/97/100/100 | 924 | 924 | 22 | 924 | 0.008 |
| telemetry | mobile | 100/100/100/100 | 1037 | 1037 | 18 | 2420 | 0.028 |
| telemetry | desktop | 97/100/100/100 | 901 | 901 | 3 | 1320 | 0.01 |
| ghostcar | mobile | 99/100/100/100 | 910 | 910 | 0 | 1526 | 0.065 |
| ghostcar | desktop | 99/100/100/100 | 767 | 767 | 0 | 767 | 0.056 |
| tyres | mobile | 100/100/100/100 | 1061 | 1061 | 28 | 1324 | 0 |
| tyres | desktop | 97/100/100/100 | 982 | 982 | 94 | 982 | 0 |
| betcast | mobile | 97/100/100/100 | 847 | 2131 | 30 | 1438 | 0.082 |
| betcast | desktop | 85/100/100/100 | 759 | 2347 | 54 | 1445 | 0.054 |
| long | mobile | 86/100/100/100 | 1080 | 4120 | 71 | 1080 | 0.004 |
| long | desktop | 78/100/100/100 | 1173 | 3422 | 2 | 1173 | 0 |
| historical | mobile | 95/100/100/100 | 1078 | 2746 | 119 | 1078 | 0.004 |
| historical | desktop | 83/100/100/100 | 1149 | 2596 | 0 | 1149 | 0 |
| dashboard | mobile | 99/100/100/58 | 835 | 1581 | 69 | 1065 | 0.001 |
| dashboard | desktop | 94/100/100/58 | 755 | 1523 | 31 | 755 | 0 |

### local-built: diagnostic n=1

| Route | Device | Scores P/A/BP/SEO | FCP ms | LCP ms | TBT ms | Speed Index ms | CLS |
|---|---|---|---:|---:|---:|---:|---:|
| home | mobile | 90/100/100/100 | 919 | 3603 | 60 | 919 | 0 |
| home | desktop | 76/100/100/100 | 1062 | 4202 | 58 | 1147 | 0.003 |
| index | mobile | 97/96/100/100 | 916 | 2568 | 0 | 916 | 0.004 |
| index | desktop | 83/96/100/100 | 1060 | 2642 | 33 | 1060 | 0 |
| latest | mobile | 93/100/100/100 | 1068 | 3227 | 0 | 1068 | 0.004 |
| latest | desktop | 79/100/100/100 | 1062 | 3377 | 0 | 1062 | 0 |
| standings | mobile | 100/97/100/100 | 920 | 920 | 0 | 920 | 0.011 |
| standings | desktop | 98/97/100/100 | 914 | 914 | 0 | 914 | 0 |
| telemetry | mobile | 100/100/100/100 | 911 | 911 | 0 | 1535 | 0.028 |
| telemetry | desktop | 97/100/100/100 | 903 | 903 | 2 | 1255 | 0.01 |
| ghostcar | mobile | 93/100/100/100 | 910 | 910 | 0 | 910 | 0.158 |
| ghostcar | desktop | 97/100/100/100 | 904 | 904 | 0 | 904 | 0.059 |
| tyres | mobile | 100/100/100/100 | 1061 | 1061 | 0 | 1061 | 0 |
| tyres | desktop | 96/100/100/100 | 1055 | 1055 | 46 | 1055 | 0 |
| betcast | mobile | 91/100/100/100 | 910 | 3265 | 32 | 1674 | 0.096 |
| betcast | desktop | 75/100/100/100 | 1368 | 3353 | 37 | 1797 | 0.054 |
| long | mobile | 91/100/100/100 | 1069 | 3452 | 55 | 1069 | 0.004 |
| long | desktop | 79/100/100/100 | 1062 | 3452 | 0 | 1062 | 0 |
| historical | mobile | 95/100/100/100 | 1069 | 2852 | 0 | 1069 | 0.004 |
| historical | desktop | 82/100/100/100 | 1062 | 2852 | 0 | 1062 | 0 |
| dashboard | mobile | 99/100/100/58 | 911 | 1952 | 0 | 911 | 0.001 |
| dashboard | desktop | 96/100/100/58 | 1072 | 1072 | 0 | 1072 | 0 |

Full benchmark JSON/configuration: `local-bundle:p01-evidence.tar.gz#evidence/lighthouse.jsonl`, SHA-256 `0ce040df1410cded2421ae2b5cafb6044230d0f2048a4beef3f2cfed8503c0ae`.

## Network and rendering path

- **S-02, CONFIRMED observation:** BetCast production mobile LCP is 2708 ms [2704–2744], n=5, the highest primary mobile median. Representative LCP is `p.page-intro`; recorded blocking resources include `/betcast/fonts/fonts.css` and main CSS. Seven request sizes are unknown in each sample and data readiness is unavailable. Font/CSS/component causality and a safe change remain unproved (`BetCast:src/App.js:29`; `BetCast:src/services/googleSheetService.js:43`). Capture `sha256-0ee5e9ba4bb96bd593a0fd8027c115efb4ed379aac696493ec8de246b99d5f5c`.
- **S-04, CONFIRMED observation:** Telemetry production mobile known bytes are 966475 [966327–966535], n=5. Median components are 715817 first-party B and 250658 replayed B. Representative charts and React chunks are 112850 B and 59283 B. Main-target TaskDuration is 589.029 ms [573.457–611.727], n=5. These are not live provider transfer, per-library CPU or avoidable bytes. Join chart-ready state and traces before deferring a default view (`Telemetry:src/components/DashboardShell.tsx:34`; `Telemetry:src/components/dashboard/TelemetryTab.tsx:3`; `Telemetry:vite.config.ts:32`). Capture `sha256-80f29c19302ded9c652de9b683472f64240b78f70645b1ce0afe0a3784c8336e`.
- **S-05, STRONGLY SUPPORTED profiling target:** Home production mobile LCP is 2320 ms [2316–2336], n=5. Representative hero AVIF is 146091 recorded B, n=1. Latest article local representative requests use the same hero path at 145952 B in each of three widths, n=1/width. Missing currentSrc/rendered boxes/fidelity evidence prevents an oversizing claim. Responsive/preload work already exists (`M:index.html:33`; `M:index.html:149`; `M:blog-module/build/article-render.js:508`; `M:blog-module/build/article-render.js:528`). Home capture `sha256-56891e32115e0a637e09da1420a7269e3500cf100b670e81be623d9c105cae92`.
- **S-10, HYPOTHESIS:** One local tablet frame request is 264058 B. Its viewport-conditioned preload is `M:index.html:35`, display markup `M:index.html:156`. Visibility, reuse and contention are unmeasured; article preload code is not evidence for this frame.

The representative waterfall holds the first valid sample per primary cell, its five largest numeric resources, blocking entries and LCP candidate joined by run ID. It is not an n=5 resource ranking. In the admitted network table, 7859 rows include 550 unknown sizes and 160 blocked rows; none of those blocked rows has numeric transfer. Unknown is never zero. Third-party share by origin can undercount missing sizes and does not turn replay into live traffic.

Main public HTML embeds ordered head CSS (`M:scripts/build/public-artifact.mjs:454`; `M:scripts/build/inline-head-css.mjs:20`). Zero external stylesheet transfer therefore does not mean zero CSS work. Inline raw budgets and compressed document transfer remain separate. A new external-CSS strategy has no measured benefit here.

## Initial viewport versus traversal

Navigation tables stop at the initial observation window; they do not describe a full article read or every lazy tab. Full-page traversal was recorded separately for archive/latest/long/historical, one traversal per route/device/environment, inside unverified interaction contexts. Reading/related-story/back actions do not provide Event Timing durations. No validated full-read transfer or callback CPU aggregate is claimed. Long-article retained traces are navigation traces, not the requested attributed scroll-window traces.

Data readiness is independent of shell LCP. Latest and BetCast are data-incomplete in all 40 primary observations across both environments/devices. The real-provider observations for standings, Telemetry and Ghost Car are also incomplete in both environments. A selector changing or a loading shell painting does not prove the chart/comparison journey works.

## Warm, service worker and offline

The 22 warm navigations/environment are single measured returns after an unmeasured prime; providers are blocked. Cache probes separately cover home, standings and Ghost Car in five states/environment: fresh online, warm reload, cache-disabled return with app storage retained, existing offline document, and fresh offline navigation. See [cache.tsv](../../perf/p01/cache.tsv).

All online cache stages returned HTTP 200 and warm stages had at least one disk-cache hit. App storage remained, so this does not isolate HTTP savings from application caching. Home/standings warm observations reported 87–88 known B; Ghost Car production warm reported 252116 B versus fresh 138698 B, n=1 each. No general warm saving follows.

No active SW controller/registration appeared in online probes. Existing offline documents returned `ok` in six probes; home/standings menu toggled, while Ghost Car had no action and retained loading text. **All six fresh offline navigations failed with `ERR_INTERNET_DISCONNECTED`; no offline fallback was observed.**

The local legacy migration fixture passed once: old controller, root registration and shell cache removed, one reload. Preserve `M:scripts/sw-cleanup.js:1` and `M:sw.js:1`; this is migration correctness, not active SW performance or production timing. Migration capture SHA-256 `2e5f181eae8a0fb03a2bab383e16d016f550f31c8d732861215a27801fe46053`.

## LAB interactions

**LAB only; never field INP.** All 40 contexts lack a fully true six-field assertion set for theme, viewport, consent, SW, analytics and required metrics. Three repetitions share one prepared context. This is unverified validity, not proof of contamination. The illustrative mobile values below are retained diagnostics; they do not establish release acceptance.

| Environment | Action | LAB event-duration median / max ms | Numeric n | Context status |
|---|---|---:|---:|---|
| production | home menu-open | 32 / 48 | 3 | Unverified |
| production | home theme-dark | 32 / 40 | 3 | Unverified |
| local-built | home menu-open | 32 / 48 | 3 | Unverified |
| local-built | home theme-dark | 32 / 40 | 3 | Unverified |
| production and local-built | standings `tab-pit-stops` | NOT MEASURED | 0 | Round fixture mismatch |
| production and local-built | standings `session` | NOT MEASURED | 0 | Round fixture mismatch |

Standings **`tab-pit-stops` and `session` NOT MEASURED**: replay race data covers round 17 while the race list selects round 20. There are 12 not-ready pit-stop rows; session has nine not-ready and three missing-control rows. These are neither zero latency nor product failures. Programmatic selection/traversal often has numeric event n=0; selection-to-presented estimates in [interactions.tsv](../../perf/p01/interactions.tsv) remain a distinct LAB measure. Summed long-task counts are not latency.

S-08 needs a controlled three-frame insertion/theme-change fixture with scan/observer/timer/message counts and origin validation (`M:blog-module/blog/article-embeds.js:7`; `M:blog-module/blog/article-embeds.js:106`). S-09 needs attributed callback/RAF/layout scroll windows and both progress visuals at mobile/desktop (`M:scripts/shared-nav.js:490`; `M:scripts/shared-nav.js:500`; `M:blog-module/blog/article-script.js:93`). Current traces do not establish redundancy.

## Gate E and preserved budgets

**Gate E Lighthouse ran behind a DNS guard and seven assertions remain BLOCKED.** It used the unchanged guard, three mobile runs/canonical route, local aggregate HTTP/1.1 gzip/no-store. It is separate from the benchmark above. Four best-practices failures at 96/100 came from wrapper-induced Jolpica DNS console errors. Home and Article LCP medians were 2627.098 and 2554.348 ms; attribution remains BLOCKED under the guarded local setup. Article third-party count was 14 against ≤8; ten production-origin BetCast requests are external to the loopback origin and the failed provider request is still counted (`M:scripts/perf/lighthouse-guard.mjs:373`). Arithmetic removal is not a rerun.

The independent **Blog accessibility BASELINE FAILURE** remains: 96/100 against ≥98 in all three runs, six empty-month labels at 3.58:1 versus required 4.5:1. Source: `M:blog-module/blog/archive-editorial.css:125`, `M:blog-module/build/discovery.js:242`. See [build pipeline](p01-build-pipeline.md) and [checks.tsv](../../perf/p01/checks.tsv). **audit:runtime PASS on Main and aggregate; build:check BASELINE FAILURE.**

Preserve `M:perf/lighthouse-budget.json:1`: scores 95/98/100/100, LCP≤2500 ms, CLS≤0.02, TBT≤100 ms, third-party requests≤8. Route DOM/initial-JS/external-CSS/inline-CSS limits remain as recorded in [baseline.json](../../perf/p01/baseline.json). Preserve size budgets and graph limits; no reset is justified. These are internal lab budgets; no field compliance is claimed.

## Variance, contamination and field position

Primary FCP/LCP ranges did not cross the planned >20% of median with 100 ms floor. That does not validate n=1 tablet/dark screens: recorded CLS spikes include production standings desktop dark 0.053 and several Ghost Car/BetCast states. Prescribed reserve reruns, visual overflow and resource-graph verification are unclosed; no child layout repair is ranked from one sample.

Eighteen CPU calibration ratios were 4.0113–4.1203 without warning, and requested network settings were accepted. Battery power deviated from the planned adapter. Thermal/contention and trace overhead were not isolated; cold browser state does not flush DNS/TLS/CDN state. Main-target CPU omits cross-origin frame CPU.

All 314 admitted navigation/real attempts assert consent/analytics correctly and have empty analytics-attempt lists. That supports no detected transport in those observations only. It does not extend to Lighthouse audited pages or the 40 interaction contexts.

**Field INP: unavailable. Field Core Web Vitals: unavailable.** No approved sufficient field dataset was supplied. LCP/CLS above are lab measurements, and Event Timing is LAB interaction evidence. No tracking or consent change is proposed.

## Evidence and reproduction

Use [README](../../perf/p01/README.md) for the integrated data dictionary and commands; raw evidence and tool paths below are bundle-relative, never workstation-specific. Key input checksums:

| Retained entry | SHA-256 |
|---|---|
| `local-bundle:p01-evidence.tar.gz#evidence/attempts.jsonl` | `0133e6720dac62640ab2c77c049883a019e44607c794ef2b7b571926c97a8a35` |
| `local-bundle:p01-evidence.tar.gz#evidence/network.tsv` | `d826236a2582c614900495eeef69fc50bd7f8c640bc37cb3dfa59e9066897336` |
| `local-bundle:p01-evidence.tar.gz#evidence/runs.jsonl` | `e79e70801bfeb4b34876d7a2864f4529e9b1a0d0362448c14720f65c0c806388` |
| `local-bundle:p01-evidence.tar.gz#evidence/interactions.jsonl` | `299d4538bdb3a9fb16b595752f4ba4ad14eed7ee738cf4ce91c8431d4da92950` |
| `local-bundle:p01-evidence.tar.gz#evidence/cache.jsonl` | `e25e8693905a3f9609387628241bfee673d011bb269aa34639e168ea236708a2` |

For offline numerical reproduction, use retained `local-bundle:p01-evidence.tar.gz#work/s1/recompute.py` and `local-bundle:p01-evidence.tar.gz#work/s1/synthesize.py` in an extracted working copy. They preserve admission, null sizes, per-environment medians and finding aliases. This report used their retained results and read the underlying records; it did not rerun a browser.

For a future authorized recollection, retained `local-bundle:p01-evidence.tar.gz#bench-run.sh` accepts environment `production` or `local-built` and phase `record`, `pilot`, `cold`, `screens`, `warm`, `interactions`, `real`, `offline`, `lighthouse`, `summarize`. Run serially with pinned source/toolchains, deny analytics consent, fail closed on fixture misses and verify audited-page assertions. Repair incomplete round fixtures and identity brackets first. Retain discarded attempts separately rather than pooling them. Do not use this protocol to claim current gaps were retroactively validated.

Preserve ordered CSS inlining, local fonts/icons, existing responsive images/preloads, lazy tab/chart boundaries, JSON revalidation, consent gating and SW migration. Re-splitting build-only data, removing fallback CSS or deleting compatibility code has no supported saving. Future acceptance must compare matched runs within each environment and include useful-data readiness; all unmeasured savings: **TBD — requires P-0X measurement**.
