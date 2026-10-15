# Steps 6–7 browser regressions — 2026-10-15

Command: `node scripts/perf/standings-interactions-qa.mjs --root=dist`

Result: **7/7 groups passed** against the built public artifact: all nine reports
at 390, 768 and 1440 px in dark and light themes, plus focused navigation and
failure/recovery checks. The machine-readable result is
[`step6-7-regressions.json`](step6-7-regressions.json).

The browser check uses recorded real provider responses with provenance and
checksums in the compressed fixture; it makes no live API requests. Its scope is
two completed races, one qualifying session and one Jolpica round, with existing
committed snapshots for dirty air, debrief and pinned standings. It does not
establish complete-season data correctness or replace the separate paired
performance measurements. See the
[fixture notes](../scripts/perf/fixtures/standings-2026-10-15.md).

Validated behavior:

- Drivers and constructors render real rows; keyboard activation expands and
  collapses driver details. Desktop keyboard tab navigation still works.
- Qualifying overview/detail and lap-one overview/detail render real rows and
  update their URL parameters.
- Tyre Pace retains its actual report node, exact chart SVG, data summary and
  horizontal scroll position on a warm revisit, without new OpenF1 requests.
  Changing to the second recorded real session replaces the report; returning
  produces the exact original SVG and data summary.
- Dirty-air summary and the populated timeline switch correctly. Track dominance
  renders all 219 track segments from actual Ferrari fastest-lap location samples,
  the pointer tooltip responds, and changing the first driver updates the URL,
  selects a distinct second driver and redraws the full map.
- Pit-stop race and season views work within the explicitly limited one-round
  fixture. All six debrief views and round selection work.
- IndexedDB receives provider data and the existing cache-clear control removes
  it. Themes persist across all matrix cells; no uncaught page errors occurred.
- A direct tyre session link, seeded browser back/forward history, embedded tyre
  session and pinned round-one standings restore the intended state.
- An injected HTTP 503 on stints shows the existing retry UI; recovery renders
  the real chart. A failed local standings snapshot falls back to live-shaped
  recorded Jolpica responses.

Harness details: the application intentionally replaces its URL state when
switching reports, so the history test seeds distinct entries before traversing
them. Embedded pages retain static dialog markup but do not initialize its
controls. Scrolling updates the existing scroll-arrow disabled state, so exact
equality checks cover chart SVG and data summaries while separately asserting
node identity and scroll position.

No runtime changes were needed beyond the measured Tyre Pace DOM reuse fix.
