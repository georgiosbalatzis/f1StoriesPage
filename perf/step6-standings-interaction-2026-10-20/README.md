# Standings interaction responsiveness — one retained experiment

Baseline: current `origin/main` at `cdf1cdfbfb15e6756e81a3041a2008f67b1fd35b`.
Work performed on an isolated worktree/branch. The original checkout's staged
and unstaged changes were preserved. The earlier Tyre Pace optimization and
its measurements were not changed or repeated.

## Bottleneck and smallest fix

Select Dirty Air → timeline → another report → Dirty Air. The view switch
updates the existing DOM but leaves `lastRender.key` describing the summary.
The first revisit consequently rejects the retained report, recreates all
2,571 timeline segments, and resets horizontal scroll. Later revisits retain it.

The focused CPU ×4 sweep found this revisit at 250 ms mobile / 231 ms desktop.
Tracing shows two full style/layout passes: first revealing the existing report,
then replacing it. This is avoidable work, distinct from the necessary initial
chart render. The timeline's initial render was not changed or deferred.

Two product lines synchronize the retained key after a view change, provided
the actual report node still matches. The existing cached-data, session and node
checks still decide reuse; changed sessions and replaced content still render.
No calculations, sorting, data points, SVG geometry, styles, cache semantics,
imports, fetches, retry policies or callbacks changed.

## Controlled comparison

Chrome 155.0.8059.85; 390×1000 (DPR 2, touch/mobile) and 1440×1000 (DPR 1),
CPU ×4, reduced motion, dark theme. Five serial pairs **per width**, alternating
baseline/candidate order. Each sample uses a fresh browser context and cold
HTTP/IndexedDB caches; no other browser benchmark or CPU-heavy tests ran during
the comparison. Both artifacts were separately built with `npm run build:public`.
Only `standings/tabs/dirty-air.min.js` differs among their 3,658 files.

The existing verified OpenF1/Jolpica fixtures and committed per-session Dirty Air
snapshots are reused through the existing browser QA helpers. Provider responses
are fulfilled locally; unrelated external requests are blocked. This measures
client processing, without simulated internet latency. The existing 3.5-second
standings refresh finishes before measurement windows.

Medians of five runs; long-task counts aggregate the five revisit windows:

| Metric | 390 baseline | 390 candidate | 1440 baseline | 1440 candidate |
| --- | ---: | ---: | ---: | ---: |
| Revisit event → presented estimate, ms | 246.3 | **125.4** | 232.9 | **117.2** |
| Script execution, ms | 3.865 | 2.772 | 4.603 | 3.328 |
| Style recalculation, ms | 145.611 | 74.129 | 142.949 | 72.070 |
| Layout, ms | 24.865 | 12.689 | 25.411 | 13.515 |
| Main-thread task work, ms | 287.054 | 162.090 | 286.431 | 160.141 |
| Long tasks ≥50 ms, count | 10 | **5** | 10 | **5** |
| Revisit requests, per run | 1 | 1 | 1 | 1 |
| Revisit transferred bytes, per run | 2749 | 2749 | 2749 | 2749 |
| Cold navigation → populated summary, ms | 404 | 407 | 366 | 367 |
| First timeline event → presented estimate, ms | 184.6 | 184.6 | 181.8 | 185.8 |

The affected revisit improves **49.1% mobile / 49.7% desktop**, about 116–121 ms.
Every paired revisit improves by over 100 ms. First-use differences are small
laboratory noise; there is no change to the initial render path and no claimed
first-use improvement. One necessary reveal/layout long task remains; this
experiment removes the duplicate task, not every long task.

The first pair per width includes symmetric DevTools tracing. Traces confirm two
~70–75 ms `UpdateLayoutTree` passes in baseline versus one in candidate. Event
processing itself remains ~86–91 ms in those traces; most of the gain comes from
removing subsequent rendering work. Performance-domain counters are cumulative
work within the interaction window, not total elapsed time.

Latency is measured from the native report selector's `change` event on mobile
and the actual report button's `click` on desktop through two animation frames.
It is a scripted event-to-presented upper-bound estimate, **not field INP**,
physical-device performance, or native OS picker latency. Event Timing entries
(where supported), processing durations, long tasks and raw traces are retained.

The sole warm request in both artifacts is the existing shared navigation's
favicon refresh. There are no warm provider requests, module imports or extra
data transfers. Candidate retains the actual report/chart nodes and horizontal
scroll; baseline replaces them and resets scroll. All twenty timeline markup
hashes match, including every segment and its exact positions/colors:
`e324e7eec9d0b9ea05f8b0de41dc5ba1fd1ed9f9e662584b243c0c3db0ce5a9a`.

## Verification

- New focused retention assertion fails against baseline and passes on candidate.
- All nine reports at 390/768/1440 px in dark/light: 54 initial report screenshots
  are pixel-identical; all per-report SVG hashes match baseline.
- Six additional timeline revisit screenshots (three widths, both themes) are
  pixel-identical after setting equal horizontal scroll. Their checks include a
  real touchscreen tap at 390 px. `visual-equivalence.json` records pixel results
  and both artifacts' PNG hashes; local captures remain under
  `/tmp/f1-step6-evidence/screenshots/`.
- Focused browser checks preserve report/timeline node identity, exact timeline
  markup, scroll, provider request count, summary↔timeline switches, keyboard
  activation, live theme switching and changed-session replacement/URL state.
- Established QA passes deep links, browser back/forward, embedded views (including
  Dirty Air), pinned round, IndexedDB/cache clearing, injected provider failure
  and retry, and snapshot-to-live fallback. No uncaught page/fixture errors.
- 21 Standings tests, 117 build tests, 27 security tests pass.
- Public artifact validation, generated asset checks, static/rendering/token
  guards, runtime dependency audit and existing size budgets pass unchanged.

Fixtures cover the documented provider subset, not every race/driver. No live
provider audit or whole-site performance audit was performed.

## Evidence and reproduction

`summary.json`, `results.json.gz` and four `*-baseline/candidate.trace.json.gz` files
contain the paired comparison. Decompress traces for Chrome DevTools Performance.
`sweep.json.gz` and `sweep-*.trace.json.gz` contain the initial all-report interaction
sweep; `dirty-discovery*` isolates the view-change/revisit sequence. The sweep
includes report switches, detail expansion, session/driver selection, chart
interaction and report subviews. It observes Tyre Pace first use but does not
re-benchmark its protected warm-revisit optimization. Sweep paint estimates for
first-use async reports can precede populated content and are not loading claims;
the controlled comparison explicitly measures populated first use.

`artifact-diff.json`, `baseline-red.json`, `baseline-qa.json`, `candidate-qa.json`
and `visual-equivalence.json` record artifact, functional and visual checks.

Build baseline at the commit above in a separate clean worktree, and candidate
with the same Node/dependencies/Chrome, then from candidate:

```sh
npm run build:public
node scripts/perf/standings-dirty-air-performance.mjs /path/to/baseline/dist dist /tmp/dirty-air-comparison
node scripts/perf/standings-interactions-qa.mjs --root=dist --output=/tmp/standings-qa.json --screenshots=/tmp/standings-screenshots
npm run test:standings
npm run test:build
npm run test:security
npm run quality:static
npm run audit:runtime
npm run check:assets
npm run perf:budget
```

Decision: **retain this single experiment**. Do not merge or deploy automatically.
