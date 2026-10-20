# Article third-party scheduling — one experiment

Baseline: latest main at `37ce4c10` (includes PR #301). Article selection:
`20261019W` (latest published), `20261007G` (six tool iframes), and
`20260423G` (real X, Instagram and YouTube embeds).

## Bottleneck and change

With previously accepted analytics consent, the roughly 180 KB compressed Google
tag started while the 149 KB article hero was downloading. Five alternating
accepted/declined baseline pairs on `20261007G` produced accepted LCPs of
2132–2140 ms versus declined LCPs of 1756–1764 ms (paired penalty 368–384 ms).
The Google request overlapped the hero transfer. Social SDKs were absent on cold
navigation and loaded at their existing proximity boundary; no change to them was
justified.

The only runtime change holds Google script injection until the article's window
`load` event. Configuration and consent-approved events continue to enter the
existing queue immediately. Injection checks the effective consent state again;
revocation before load prevents the request. Explicit consent events still work
when storage cannot be read. Already-loaded articles and non-article routes keep
their previous injection behavior.

## Controlled results

Separate public builds; one browser run at a time, alternating B/C and C/B.
Five final pairs on mobile, dark theme, accepted consent, `20261007G`:

| Metric (median) | Baseline | Candidate |
| --- | ---: | ---: |
| LCP | 2432 ms | 1924 ms |
| FCP | 836 ms | 828 ms |
| CLS | 0 | 0 |
| Requests, first 6 seconds | 28 | 28 |
| Response body + header transfer, first 6 seconds | 620586 B | 620643 B |
| Third-party requests, first 6 seconds | 9 | 9 |
| Third-party response transfer, first 6 seconds | 274745 B | 274746 B |
| Google request start | 901 ms | 1898 ms |
| Article main-thread script time | 184.6 ms | 166.8 ms |
| Main-thread long tasks | 2 | 2 |
| Total long-task duration | 136 ms | 140 ms |
| Largest long task | 72 ms | 75 ms |
| Largest recorded keyboard interaction per run | 32 ms | 24 ms |
| HTTP-cache return LCP | 192 ms | 188 ms |

LCP improved in every final pair: **504, 508, 488, 508, 512 ms** (median
**508 ms / 20.9%**). Candidate LCP range: 1920–1928 ms; baseline: 2416–2432 ms.
The change schedules the same Google payload later; it does not remove requests
or reduce provider CPU work. Long-task durations remain variable: the largest
individual sample was 101 ms in the candidate and 74 ms in baseline. No related
interaction regression was observed. The compressed first-party loader grows
by 56 bytes.

Single-pair secondary checks (LCP):

| Article / scenario | Baseline | Candidate |
| --- | ---: | ---: |
| `20261007G`, mobile light, accepted | 2424 ms | 1924 ms |
| `20261007G`, desktop dark, accepted | 832 ms | 824 ms |
| `20261007G`, desktop light, accepted | 812 ms | 820 ms |
| `20261007G`, mobile dark, declined | 1916 ms | 1924 ms |
| `20261019W`, mobile dark, accepted | 868 ms | 860 ms |
| `20261019W`, mobile light, declined | 872 ms | 876 ms |
| `20260423G`, mobile dark, accepted | 1320 ms | 1276 ms |
| `20260423G`, mobile light, declined | 1272 ms | 1272 ms |

These small secondary differences are observations, not claims of improvements.
All final navigation samples had no page errors.

## Embeds, appearance and navigation

Three additional accepted-consent mobile pairs approached X as early as load
permitted, with a two-second minimum from navigation. Real rendered tweet text
and populated links defined usability. Median time from entry into the preload
region to usability was **2387 → 2361 ms**. Paired differences were +69, -257 and
+14 ms; no material delay was observed. BFCache restoration succeeded in all six
runs, with **zero repeated Google SDK requests**; median observed history return
was 220 → 212 ms.

The Tyres embed was ready before reaching it in both variants. X and Instagram
loaded automatically on approach. YouTube made no player request before keyboard
activation and played real video in both variants. Activation CLS remained zero;
iframe dimensions and keyboard focus were preserved. Provider-failure injection
verified X/Instagram fallback links, single SDK requests, keyboard/theme behavior,
and YouTube iframe sizing/focus in both artifacts.

Of 20 matched screenshots, 18 are pixel-identical (cold articles and activated
Tyres, X and Instagram). The two YouTube playback captures contain different
video frames. Their iframe geometry and surrounding article layout match.
The live navigation countdown was hidden in both images for comparison.

A byte comparison of all 3658 public files found only the analytics runtime and
449 HTML cache-version references changed. Normalizing that one query parameter
makes every HTML file identical. Images, CSS, embed markup, fallbacks, SEO,
editorial content, CSP, and other runtime assets are identical.

## Method and limits

Chrome 155 headless on macOS, Node 26.12.0. Mobile: 390 × 844, DPR 3, touch;
desktop: 1440 × 1000, DPR 1. CDP article-target CPU ×4; Slow 4G: 150 ms latency,
1.6 Mibit/s download, 750 Kibit/s upload. Text served gzipped from the generated
production artifacts; cold contexts and cleared browser cache per sample;
HTTP caching enabled for return navigation. Both themes and stored accepted /
declined analytics consent were exercised. The primary byte window is fixed at
six seconds; secondary windows are explicitly recorded in the CSV.

PerformanceObserver captured paint/LCP, CLS session windows, long tasks and input
events; CDP captured network timing, script time and CPU profiles. These CPU and
long-task totals describe the article main thread, not the internal execution of
cross-origin iframe providers. Real iframe-provider timing is observational;
provider-internal CPU is not claimed as a calibrated benchmark. The bottleneck
and LCP comparison concern Google code executing in the calibrated article target.

Google, X, Instagram, YouTube and Tyres responses were real. The deep tool
investigation encountered OpenF1 HTTP 429s, so it supplies no claims about live
OpenF1 latency or full live data availability. Existing checksum-verified recorded
responses were used for F1 interaction, retry/recovery and fallback tests.

Raw tabular observations: [navigation measurements](measurements.csv),
[rapid-scroll/BFCache measurements](rapid-scroll.csv),
[pixel comparisons](visual-diffs.json). Local full request logs, CPU profiles,
images and measurement scripts are under `/tmp/f1-step4-evidence/`.

## Validation and decision

Passed without changing any gate or budget:

- Public build and artifact validation; generated asset checks.
- Blog tests/goldens, author and standings tests, security tests, static quality,
  and runtime dependency audit.
- Media integrity, public artifact/image tests, image and article-media budgets.
- Seven analytics unit tests and the existing live-browser consent guard.
- Embed geometry/focus/size-budget tests; provider-failure checks in both artifacts.
- Recorded F1 interactions: 5/5 matrix/navigation groups, including failure/retry,
  embedded tyre sessions, pinned rounds and snapshot fallback.
- Embed dialog: 136/136 checks.
- Visual gate: 72/72 route/theme/viewport checks.
- Existing Lighthouse budgets: Home 99, Blog 99, Standings 99, Article 98;
  accessibility, best practices and SEO all 100.
- Tablet CLS: both themes <= 0.003 cold, 0 after edition-font swap (limit 0.02).

[Command-level results](validation.json) accompany the measurements. A clean rebuild after committing the references passed the generated-artifact
synchronization guard.
The original checkout's staged diff, unstaged diff and status match the snapshots
captured before worktree creation.

**Decision: retain.** The measured LCP gain repeats in every primary pair, the
runtime change is small, and no visible or functional regression was found.
CI is reported by the focused pull request. Merge and deployment remain manual.
