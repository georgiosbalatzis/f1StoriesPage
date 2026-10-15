# Sprint #279 — Steps 6–7 standings execution

Base: current `origin/main` at `f08cd0df`, independent of Step 5 and drafts
#282/#284/#285/#286. No publishing/build source, CSS, images, article runtime or
templates changed. The only product change is eight added lines in
`standings/tabs/tyre-pace.js`.

## Demonstrated bottleneck

A real production-artifact CDP sweep at CPU x4 found interaction long tasks of
109 ms and 52 ms while opening and revisiting analytics. Tyre Pace's loaded
path unconditionally called `renderSelectedSession(false)`, regenerated all
22 driver distributions, and replaced the chart's HTML/SVG on every revisit.
Data was already cached; rebuilding it invalidated styles/layout, reset the
horizontal chart scroll, and triggered shared navigation's DOM observer.

Retain the existing chart when all three identities still match: cached data,
selected session key, and the actual first chart node. Keep calling `onRendered`
so URL state, embed visibility and requested-focus handling still run. A changed
session, replaced loading/error content, or explicit reload follows the original
render path. No calculation, point placement, SVG path, data request, cache TTL,
stylesheet, animation or scheduling policy changed. The first render is not
deferred or made conditional on the first interaction.

## Paired measurement

Chrome 155, headless, 390×844 at DPR 2, CPU x4. Fresh browser contexts and cold
HTTP/IndexedDB caches for each first load. Five baseline/candidate pairs per
network, alternating their order; three warm drivers→tyre switches per context.
The table reports the median of each run's three switches, then the median of
the five runs. Long tasks are counts over all 15 switches in each variant/profile.
No other browser benchmark or CPU-heavy test ran during this comparison.

| Metric | Slow 4G baseline | Slow candidate | Fast 4G baseline | Fast candidate |
| --- | ---: | ---: | ---: | ---: |
| Warm selection→presented estimate, ms | 130.6 | **54.4** | 128.9 | **54.1** |
| Warm script execution, ms | 6.195 | 3.465 | 6.049 | 3.191 |
| Warm layout, ms | 8.053 | 4.667 | 7.844 | 4.545 |
| Warm long tasks ≥50 ms, count | 17 | **0** | 16 | **0** |
| Cold first populated chart, ms | 2422 | 2401 | 858 | 853 |
| Initial script execution, ms | 54.578 | 53.225 | 52.786 | 53.582 |

Warm switching improves by about **58%** in both network conditions. The small
cold-load differences are noise, not a claimed loading improvement. Initial
script work is effectively unchanged; there is no first-use penalty.

Network profiles use CDP with latency/down/up:

- Slow: 150 ms / 1.6 Mibps / 750 Kibps.
- Fast: 40 ms / 9 Mibps / 1.5 Mibps.

The measurement invokes the actual native selector's change path with Playwright
`selectOption`, marking its capture handler and two animation frames. This is a
selection-to-presented upper-bound estimate, **not** an INP or native OS picker
latency claim. Performance-domain counters measure scripting/layout, and the
Long Tasks API records blocking tasks. The first trial per variant/profile also
records a full DevTools interaction trace with user-timing marks. Trace overhead
is symmetric and only one of five trials contributes it.

The existing 3.5-second background standings refresh is allowed to finish before
warm windows. Baseline and candidate have identical public artifact bytes except
the changed tyre module. Provider responses are frozen **original** captured
HTTP-200 bodies, not fabricated race data, served through a gzip HTTPS fixture
server. Routing rewrites HTTPS provider requests to that server; CDP network
throttling applies to the resulting actual network transfers. Live standings
refresh uses the same committed snapshot response in both variants. Unrelated
third parties are blocked identically.

All 20 first-render SVG hashes match:
`5e819b3cc4168ce36c01fb9418f06845d7848afe9d2620ef30fe6e49fb9195be`.
Each chart retains all **1,118 real lap markers**. The warm candidate keeps the
actual node and horizontal scroll; a session change still builds the requested
session. Measurements do not claim performance on physical devices or field INP.

Evidence:

- [Summary](summary.json), [all 20 runs and 60 switches](results.json).
- [Slow baseline trace](slow4g-baseline.trace.json.gz), [Slow candidate trace](slow4g-candidate.trace.json.gz).
- [Fast baseline trace](fast4g-baseline.trace.json.gz), [Fast candidate trace](fast4g-candidate.trace.json.gz).
- [Original live production-artifact requests and sampled attribution](f1-279-standings-discover.json).

Decompress a trace and load its JSON into Chrome DevTools Performance.

## Production data pipeline inspection

The live sweep inspected the built artifact before any data-pipeline change:

- Drivers/constructors start from the ~28 KB raw committed standings snapshot,
  with their existing delayed live refresh. No heavy analytics module is imported
  until its tab is activated.
- Tyre Pace then requests its own module/styles, session list, and selected race's
  drivers/laps/stints. The recorded Singapore race has 1,240 raw lap records;
  the existing filtering correctly displays 1,118 samples.
- Dirty Air already loads `dirty-air/index.json` and **one selected per-session
  file**. The 2.2 MB source aggregate is excluded from the public artifact and is
  never an initial request. No data-file split/rewrite is justified here.
- Debrief's static snapshot is requested on its own tab, not initial drivers load.
- The live sweep encountered provider 429 responses on stints and exercised the
  existing retries. Paired comparisons therefore use the documented recorded
  responses instead of mistaking provider variability for a runtime gain.

No endpoint, rate limit, retry/fallback policy, fetch cache, IndexedDB version,
payload parser, or derived analytics computation changed. Dynamic imports remain
on demand. Other candidates from source inspection (lap-one sorting and track
map reconstruction) were not changed without a separately demonstrated gain.

## Regression results

Pass:

- Public build and artifact validator; no generated reference drift.
- All 18 standings tests, including a new focused lifecycle test for retained
  nodes, session changes, replacement content, callbacks and explicit retry.
- All 89 existing build tests; static/rendering/token checks; runtime dependency
  guard.
- All nine analytics reports at 390/768/1440 px in dark/light themes.
- Keyboard table details/navigation; per-tab controls; all six Debrief views;
  Dirty Air timeline; full 219-segment Track Dominance map, driver changes,
  duplicate-driver avoidance and tooltip.
- URL parameters, deep links/back-forward, embed mode, pinned round, cache
  clearing, injected stints failure/retry and snapshot→live fallback.

See the [browser regression report](../step6-7-regressions.md) and its raw JSON.
The deterministic provider fixture covers two races, one qualifying session and
one Jolpica round; it does **not** claim whole-season correctness or all possible
track telemetry. Committed Dirty Air/Debrief/pinned-round data remains unchanged.

`perf:budget` still fails on the same nine pre-existing files as main. The tyre
source/minified module stays within its existing budget; no budget was raised.
The longstanding unrelated visual QA harness defect belongs to draft #285;
that PR was not modified or folded into this independent branch.

## Reproduction

Build an untouched baseline at `f08cd0df` in a separate worktree, and build this
branch using the same installed Node/dependencies/Chrome. Then run from this
branch:

```sh
node scripts/perf/standings-performance.mjs /path/to/baseline/dist dist /tmp/standings-performance
npm run test:standings
node scripts/perf/standings-interactions-qa.mjs --root=dist
```

The profiler creates a temporary one-day local TLS certificate with installed
OpenSSL, enables certificate trust bypass only in its test browser, and deletes
the certificate files on completion. No certificate or private key is committed.
No live provider is needed for either repeatable check.
