# Step 5: global JavaScript execution — 2026-10-15

Base: `origin/main` at `f08cd0df`. Independent worktree/branch; Steps 2–4 stay separate. The retained runtime change is **11 lines in `shared-nav.js`**: discover/update horizontal scroll cues only when a DOM mutation affects a matching scroller. Unrelated table, status, countdown and navigation text updates no longer trigger document-wide discovery and synchronous chart geometry reads. Relevant edits still run immediately; nothing is rescheduled into a later interaction.

## What profiling found

The homepage alone did not justify a runtime rewrite. At CPU ×4 it has no long tasks, 35.6–39.1 ms total startup JS, 15.5–19.6 ms JS across the whole interaction sequence, and 6.6–9.7 ms JS during a two-second scroll. The existing global scroll listener is passive and consolidated into one animation-frame callback; the player already creates its audio element on demand. These implementations are preserved.

The same shared navigation runs on analytics pages. A production-artifact CDP discovery trace of drivers → tyre pace → drivers → tyre pace → dirty air → debrief attributed approximately **86.7 ms of sampled execution to shared-nav's horizontal-cue geometry update**, versus 20.7 ms to tyre SVG work. The body-wide MutationObserver repeatedly scanned existing chart regions after unrelated DOM updates, forcing pending chart layout. It is the demonstrated target of this PR.

The filter retains initial discovery, font-ready/resize discovery, existing ResizeObservers, insertion/removal cleanup, edits inside a scroller, and scrollers added inside a new parent. It leaves page structure, cue placement, controls, theme inheritance and accessibility unchanged. No publishing/build scripts, templates, CSS, images, article runtime or other draft PR is changed.

## Paired before/after measurements

Three serial alternating baseline/candidate pairs per width and network, CPU ×4. Both artifacts come from the same main build; the candidate changes **only** the generated `shared-nav.min.js` bytes, with the filter above. The standings application/data and all other bytes are identical. Provider responses are recorded public data (Singapore race 11388: 22 drivers, 1,240 lap records), delivered unchanged from the included compressed fixtures. HTML/CSS/JS/JSON/SVG are gzip-served; caches start empty and local responses use `no-store`.

Slow 4G: 150 ms latency, 1.6 Mibit/s down, 750 Kibit/s up. Fast 4G: 40 ms, 9 Mibit/s down, 1.5 Mibit/s up. Google Chrome 155.0.8059.80 on macOS arm64; Node v26.11.0. No other browser benchmark ran concurrently. Two short Node check commands overlapped part of the Slow matrix, so treat those numbers as supporting evidence; the subsequent Fast pairs ran without that contention and independently show the benefit.

Each run exercises tyre pace → drivers → tyre pace → dirty air → drivers → dirty air → debrief → drivers → debrief. Phone/tablet use the native report selector; desktop uses the actual visible tab buttons. Readiness requires the active visible panel, no skeleton, and a real tyre chart SVG. This measures first rendering and cached revisits, not just a synthetic callback loop.

“JS” is the CDP ScriptDuration delta for the complete interaction sequence. “Observer time” is inclusive callback wall time, including synchronous browser style/layout inside its geometry reads; it must not be added to JS or called pure JS time. All values are median milliseconds.

| Network | Width | JS before | JS after | Observer before | Observer after | Layout before | Layout after |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Slow 4G | 390 | 45.7 | 36.0 | 143.8 | 103.0 | 58.2 | 55.2 |
| Slow 4G | 768 | 49.2 | 35.9 | 140.0 | 101.4 | 53.2 | 56.6 |
| Slow 4G | 1440 | 71.2 | 51.5 | 181.5 | 109.2 | 197.3 | 202.9 |
| Fast 4G | 390 | 55.8 | 37.1 | 160.9 | 101.3 | 78.7 | 73.2 |
| Fast 4G | 768 | 56.6 | 41.0 | 162.2 | 102.7 | 74.4 | 75.7 |
| Fast 4G | 1440 | 58.7 | 48.6 | 157.1 | 104.6 | 182.6 | 191.1 |

Fast 4G interaction JS falls **17–34%**, and inclusive observer work falls **33–37%**. Layout totals vary with existing focus/scroll animation timing; no layout improvement is claimed. Desktop median trusted click Event Timing remains 40 ms before/after. Phone/tablet `selectOption` exercises real change/render handlers but does not produce trusted Event Timing; no mobile input-latency speedup is inferred from it. The improvement is less unnecessary execution during actual tab operations, with no added delay. Analytics render long tasks remain in both builds; this global fix does not claim to eliminate the separate analytics work addressed in Steps 6–7.

## Homepage interaction baseline

Three cold runs at 390/768/1440 for each profile. Real mobile taps open the menu three times and Escape closes it, both themes are toggled, the audio player starts against a local RSS/WAV fixture and pauses after 1.2 seconds, then a real CDP gesture scrolls 3,600 px in approximately two seconds. The clock is offset to 30 seconds before a race to exercise the one-second countdown path. Declined consent and blocked other external services make the runtime repeatable, rather than measuring provider variation.

All 18 runs have **zero long tasks and zero JavaScript errors**. Median click Event Timing is 32 ms; the largest recorded click is 64 ms. Median handler processing is 0.3–0.6 ms. Scroll animation-frame p95 is 16.7–16.8 ms. Homepage cue scans total only 1.2–1.8 ms per run, so no homepage-only scheduling or listener change was retained. Loading is not claimed to improve: startup content/initialization is unchanged, apart from omitting later irrelevant scans.

## Rejected experiments

- Reading all cue geometry before its visibility writes did not reliably improve paired execution/layout. Reverted; it is absent from the retained patch.
- Further homepage scroll caching, audio scheduling or countdown deferral was rejected because the measured handlers were already small. The first-use localized countdown formatter cost approximately 23 ms without a long task; delaying or changing the accessible label would trade correctness for a score.
- An exploratory matrix that selected the hidden desktop native select, plus one run that did not wait for the actual active chart, was discarded. The committed results use visible desktop controls and strict render readiness.

## Reproduce

Build baseline and candidate artifacts in separate worktrees with `npm run build:public`, then run from this repository:

```sh
GLOBAL_BASELINE_ROOT=/path/to/main/dist \
GLOBAL_CANDIDATE_ROOT=/path/to/step5/dist \
GLOBAL_PROVIDER_FIXTURES="$PWD/perf/step5-global-runtime/fixtures" \
node scripts/perf/global-cues-profile.cjs /tmp/f1-cues 3 390,768,1440 slow4g,fast4g

node scripts/perf/global-runtime-profile.mjs --root=dist --output=/tmp/f1-global --runs=3
node scripts/perf/shared-nav-cues-qa.mjs --root=dist
```

`cue-interactions.json.gz` preserves all 36 before/after interaction records, observer callback durations, long tasks and Event Timing. `results.json.gz` preserves all 18 homepage traces/resource requests. The JSON traces and representative CPU profiles for both networks and variants are compressed to keep review diffs small; gunzip them and import into Chrome DevTools Performance. Each profiler run writes all raw CPU profiles to its chosen output directory. Fixture metadata records provider URLs, capture times, record counts and SHA-256 hashes. The added measurements use existing dependencies and change no performance budgets.

## Regression results

Pending final public-artifact build plus focused browser checks. The dedicated cue suite covers dynamic insertion, unrelated subtree/text updates, descendant text updates, scroll buttons, resizing and removal at 390/768/1440 in both themes. Existing audio, countdown and consent suites cover behavior outside the optimized observer.
