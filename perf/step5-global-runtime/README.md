# Step 5: global JavaScript execution — 2026-10-15

Original runtime baseline: `origin/main` at `f08cd0df`. Final branch also merges main `30c27779` (new article content; global runtime unchanged). Independent worktree/branch; Steps 2–4 stay separate. The retained runtime change is **12 added lines replacing one observer registration in `shared-nav.js`**: discover/update horizontal scroll cues only when a DOM mutation affects a matching scroller. Unrelated table, status, countdown and navigation text updates no longer trigger document-wide discovery and synchronous chart geometry reads. Relevant edits still run immediately; nothing is rescheduled into a later interaction.

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

A subsequent isolated Slow 4G 390 px rerun (three alternating pairs, no competing benchmarks/checks) confirms **53.8 → 32.7 ms** median interaction JS (39% less) and **142.8 → 104.3 ms** inclusive observer work (27% less); layout is **58.3 → 54.3 ms**, without a layout claim. Its six raw runs and representative profiles are retained separately.

Fast 4G interaction JS falls **17–34%**, and inclusive observer work falls **33–37%**. Layout totals vary with existing focus/scroll animation timing; no layout improvement is claimed. Desktop median trusted click Event Timing remains 40 ms before/after. Phone/tablet `selectOption` exercises real change/render handlers but does not produce trusted Event Timing; no mobile input-latency speedup is inferred from it. The improvement is less unnecessary execution during actual tab operations, with no added delay. Analytics render long tasks remain in both builds; this global fix does not claim to eliminate the separate analytics work addressed in Steps 6–7.

## Homepage interaction baseline

Three cold runs at 390/768/1440 for each profile. Real mobile taps open the menu three times and Escape closes it, both themes are toggled, the audio player starts against a local RSS/WAV fixture and pauses after 1.2 seconds, then a real CDP gesture scrolls 3,600 px in approximately two seconds. The clock is offset to 30 seconds before a race to exercise the one-second countdown path. Declined consent and blocked other external services make the runtime repeatable, rather than measuring provider variation.

All 18 runs have **zero long tasks and zero JavaScript errors**. Median click Event Timing is 32 ms; the largest recorded click is 64 ms. Median handler processing is 0.3–0.6 ms. Scroll animation-frame p95 is 16.7–16.8 ms. Homepage cue scans total only 1.2–1.8 ms per run, so no homepage-only scheduling or listener change was retained. Loading is not claimed to improve: startup content/initialization is unchanged, apart from omitting later irrelevant scans.

## Final homepage before/after verification

After merging main `30c27779`, rebuilt the public artifact and copied it to form the baseline, replacing only `scripts/shared-nav.min.js` with the frozen original-main bytes. A recursive byte comparison confirmed that this is the only differing file; the hashes are recorded in `homepage-artifact-comparison.json`. Both variants therefore include the same new article and all other assets. This extra verification uses 390 px, CPU ×4, three cold baseline/candidate pairs per network, run serially without another browser benchmark. Each pair runs baseline Slow/Fast then candidate Slow/Fast. The earlier 18-run, three-width baseline above remains separate.

All values below are medians in milliseconds. These short homepage samples show variability and establish no loading, JS, or scroll speedup:

| Network | Variant | FCP | Load event | Startup JS | Interaction JS | Scroll JS | Click Event Timing | Scroll frame p95 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Slow 4G | Before | 1088 | 1462 | 38.7 | 23.1 | 10.4 | 32 | 16.7 |
| Slow 4G | After | 1100 | 1480 | 41.7 | 26.5 | 15.3 | 32 | 16.7 |
| Fast 4G | Before | 496 | 674 | 36.0 | 24.3 | 11.1 | 32 | 16.7 |
| Fast 4G | After | 464 | 562 | 34.9 | 19.6 | 9.3 | 32 | 16.8 |

All **12 runs have zero long tasks and zero JavaScript errors**. Real menu taps and Escape state assertions passed, both theme toggles ran, audio reached its playing state and paused, the one-second countdown path ran, and the touch scroll completed. Median click handler processing stayed at 0.5–0.7 ms. Maximum recorded click Event Timing was 72 ms before and 64 ms after. Per-run scroll frame p95 stayed at 16.7–16.8 ms. Slow 4G's small JS increase and Fast 4G's decrease are reported without inferring a performance regression or improvement from this sample size. The justified optimization remains the analytics observer work above.

`homepage-paired.json.gz` retains all 12 raw records (navigation, resources, interactions, frames, errors and long tasks), and `homepage-cpu/` retains every associated CPU profile. `validation/homepage-paired.log` preserves execution output. The interrupted preliminary final-homepage attempt is excluded.

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

Completed on the public artifact; readable execution logs are retained in `validation/`. Audio, countdown, consent, build tests and static checks ran before the content-only main merge; final public build, dynamic cues and paired homepage checks ran after it. Shared runtime source and generated navigation bytes were unchanged by that merge:

- `build:public` passes after merging current main: 3,600 public files validated. Generated HTML hash-reference churn was restored from this worktree after preserving `dist`; no publishing or build source was edited.
- Dynamic cue browser suite passes all six combinations of 390/768/1440 px and light/dark themes, including insertion inside a parent, unrelated subtree/text filtering, descendant edits, scrolling, resizing, and removal with explicit ResizeObserver disconnection.
- Audio player: **106 checks pass**, including keyboard behavior, errors, both themes and responsive geometry.
- Countdown: **23 checks pass**.
- Consent: three analytics unit tests plus the browser accept/reject and route guard pass.
- Build tests: **89 pass**; static source, rendering sink and design-token checks pass.
- Final paired homepage check: all 12 runs pass without a page error or long task, with stable click and scroll-frame timing as reported above.

No PR was merged or deployed. External audio/provider services are stubbed with repeatable local fixtures in browser checks; live provider latency and real-device performance are not measured. The runtime change remains limited to the shared navigation observer filter.
