# F1 Stories: Runtime Smoothness Report

Step 3 of the performance program, run on `perf/perf-boost` after P0–P3 (HEAD `9fe2f65`) on 2026-09-24. The scope is runtime only: scrolling, interaction latency, main-thread work, layout, paint, compositing, repeated work, and memory over long sessions. Nothing was redesigned, and nothing was deployed.

## Summary

- **The public site was already smooth.** On a 390×844 phone profile with 4× CPU throttling, home, both articles, archive and standings all scrolled at a frame p95 of 16.7–16.8 ms, with no long tasks after load. That is the P0–P3 baseline.
- **Five changes were kept.** Each has a measured before/after (below) and passed the visual and functional checks:
  1. Standings dirty-air and debrief keep their rendered report when a tab is revisited with the same data.
  2. The dirty-air timeline view (92% of the tab's DOM) is built the first time it is shown.
  3. Housekeeping "load more" appends the next page instead of rebuilding the list.
  4. A collapsed article TOC no longer animates its invisible links.
  5. Archive card images on phones drop `content-visibility: auto`.
- **The only jank the profile found** was on the standings **dirty-air and debrief tabs** (4–13 frames over 33 ms per switch). After the changes, every rep is at 0 and the worst frame is 16.8 ms.
- **Three attempted changes were reverted** because the gain was inside the noise, and one was narrowed because it broke pixel parity (see *Rejected*).

## Method

**Tools.**
- **Graphify** (the existing knowledge graph) mapped handlers, observers and DOM rebuilds across the five experiences.
- **Agent Skills** (*performance-optimization*) set the workflow: measure, identify, fix, re-measure, keep or revert.
- **Impeccable** (*optimize* playbook, project context), **Taste** and **DESIGN.md** / `KEEP.md` were the visual-regression guards. The design is flat and matte (no blur, no glass, shadows `none`), with designed arrival and hover motion, and `prefers-reduced-motion` turns all of it off. Every visible effect was treated as design and kept.
- **Ponytail** set the bias: remove work before optimising it.
- **Playwright** drove everything.

**Harness** (`smooth.mjs`, in the session scratchpad).
- Serves `dist/` the way GitHub Pages does (gzip).
- Standings' Jolpica and OpenF1 calls are replayed from a HAR recorded once, for determinism. The GitHub API is mocked for the author tools.
- For each action it records:
  - rAF frame intervals
  - long tasks, and long animation frames with per-script forced-layout time
  - event timing (the slowest interaction, an INP proxy)
  - CDP layout and style counts and durations, and script time
  - trace-derived forced-layout sources (resolved through source maps)
  - main-thread paint count and time
  - composited layer count
  - heap, DOM nodes and listeners after GC
- **Profiles.**
  - `m390`: 390×844, DPR 3, touch, **CPU ×4**.
  - `d1440`: 1440×900, CPU ×1, as a desktop sanity check.

**Experiences covered.**
- **Home:** load, full scroll, sticky nav, mobile menu, theme toggle, YouTube facade, and a long session (10 cycles of theme × 6, menu × 6 and a full scroll).
- **Articles** (20260422G, long, with gallery and embeds; 20260923, latest): long scroll, images and embeds entering the viewport, related stories, share/copy, scroll back.
- **Archive.**
- **Standings:** every tab, first visit and revisit, table scroll, horizontal table scroll, dirty-air view switching.
- **Housekeeping:** records, "load more", scroll, search typing, category filter, lane switching, edit modal.
- **Generate:** typing into a 2,600-word body, selecting 6 files, preview step, preview scroll, device switch.
- **Not covered in housekeeping:** it has **no density switch and no `<details>` element**, so those two items from the brief do not exist.

**Controlling for noise.** Every kept change was measured one at a time against its own baseline (3–5 reps; per-rep ranges below). CDP throttling is relative to the host, and a sequential before/after run hours apart showed a global drift (home, which has no changes, came out ~1.5–2× slower on time metrics while its counts stayed identical). So the final before/after below uses **interleaved** runs: base and after alternate one rep at a time, and home is the control.

## Problems found

| # | Where | What the profile showed | Root cause |
|---|---|---|---|
| P1 | Standings, dirty-air tab revisit | 1–13 frames over 33 ms, worst 50–67 ms, long animation frames from the module | `ensureLoaded()` fully re-renders the report (`innerHTML`, ~3,600 nodes) every time the tab is shown, even when data, session and view are unchanged |
| P2 | Standings, debrief tab revisit | 0–14 frames over 33 ms, worst ~50 ms | Same pattern: `renderDebrief()` rebuilds all six view panels on every revisit |
| P3 | Standings, dirty-air first open | 0–6 frames over 33 ms, worst ~50 ms | The inactive, `display: none` timeline view (3,301 of 3,577 nodes) is built up front |
| P4 | Housekeeping "load more" | Each page slower than the last: by page 4, layout 22 ms, a 50–63 ms long task, INP 64–80 ms | `loadMore()` rebuilds every row already on screen |
| P5 | Long article scroll | 312 paints / 160 ms of main-thread paint; `#document` and `body` repainted on nearly every scroll step | On phones the TOC is collapsed (`max-height: 0; overflow: hidden`), but its links keep `transition: all`. Every heading change toggles `.active`, which animates invisible links and invalidates the page's paint (confirmed: 310 → 227 paints with those transitions off) |
| P6 | Archive scroll | 98 layouts, 28 forced, 205 paints per scroll; still 20 layouts and 44 paints on a second pass over loaded content | `content-visibility: auto` on `<img>` (nothing to skip inside an image) makes each card image leave and re-enter layout and paint as it crosses the viewport |

Nothing else rose above noise, or it wasn't a problem (see *Rejected* and *Remaining costs*).

## Changes made

All five pass the checks under *Visual check* and *Functional check*.

1. **Standings revisit memo** (`standings/tabs/dirty-air.js`, `standings/tabs/debrief.js`). Each module records its last full render: the data object, a key built from session or round plus view, and the rendered root node. A revisit whose inputs match, and whose panel still holds that exact node, skips the rebuild and calls `fireRendered()`, so URL state still updates. Any other writer to the panel (loading, error, retry) replaces the node and forces a render. Neither render reads the theme, viewport or time, so the kept DOM is identical to a rebuild.
2. **Lazy dirty-air timeline** (`standings/tabs/dirty-air.js`). The existing timeline-building code is wrapped in a closure. It runs at render time only if the timeline is the active view; otherwise it's parked and run on the first switch to the timeline (`applyViewState`). The markup is identical once built (the node count is equal).
3. **Housekeeping append** (`scripts/author/housekeeping-page.js`). `loadMore()` in the "All articles" lane appends the next `PAGE_SIZE` rows (`appendBrowse`) and falls back to a full render if the list is not exactly the previous page. Stats and footer are unchanged (`updateBrowseStats`).
4. **Collapsed TOC** (`blog-module/blog/article-styles.css`). Adds `.toc-body:not(.open) .toc-item { transition: none; }`. The collapsed TOC is clipped to zero height; the open TOC keeps its transitions.
5. **Phone archive card images** (`blog-module/blog-styles.css`). Adds `@media (max-width: 767px) { .article-card-img { content-visibility: visible; } }`. Wider layouts, the article hero and related images keep `content-visibility: auto` (see rejected item R4).

## Before and after (390×844, CPU ×4, interleaved, median [min–max] of 3)

Home is the unchanged control. Housekeeping and generate were measured the same way, per change.

| Action | Metric | Before | After |
|---|---|---|---|
| Home scroll (control) | layouts / paints / frames over 33 ms | 15 / 112 / 0 | 15 / 112 / 0 |
| **Dirty-air first open** | frames over 33 ms / worst frame | 2 [0–6] / 49.9 ms | **0 / 16.8 ms** |
| **Dirty-air revisit** | frames over 33 ms / worst frame | 4 [1–13] / 49.9 ms | **0 / 16.8 ms** |
| | layouts / style ms | 3 / 17 | 2 / 12 |
| **Debrief revisit** | worst frame / style ms | 33.3 [33.2–50] / 22 | **16.8 / 14** |
| Debrief first open | frames over 33 ms | 5 [3–9] | 0 [0–9] |
| **Archive scroll** | layouts / layout ms | 99 [95–102] / 43 | **33 / 17** |
| | paints / paint ms | 206 / 39 | **66 / 15** |
| | style ms | 52 | 38 |
| Archive second scroll | layouts / paints | 20 / 44 | **1 / 2** |
| **Long article scroll** (20260422G) | paints / paint ms | 312 / 160 [131–161] | **227 / 83 [73–100]** |
| | style ms | 46 | 35 |
| Long article scroll back | paints / paint ms | 88 / 38 | 55 / 23 |
| **Housekeeping 4th "load more"** | long task / INP | 50 [0–63] ms / 64 ms | **0 / 24 ms** |
| | layout / style / script ms | 22 / 14 / 16 | 9 / 4 / 5 |
| Housekeeping 3rd "load more" | INP / layout ms | 56 / 20 | 24 / 8 |
| Dirty-air first switch to timeline (cost moved by change 2) | INP / script ms | 136 / 9 | 152 / 24 |
| Dirty-air second switch to timeline | INP | 120 | 104 |

**Isolated per-change runs** (5 reps each, same session) agree:
- Dirty-air revisit: 0,2,1,3,0,10 frames over 33 ms → 0 in all 5.
- Debrief revisit: 0,3,2,4,6,0 → 0 in all 5.
- Dirty-air first open with the lazy timeline: 0,6,0,4,0 → 0 in all 5.
- Housekeeping page 4: long task 52–60 ms → none.
- Collapsed TOC: paints 310–316 → 227 in every run.

**Desktop (1440×900, CPU ×1, interleaved, 2 rounds).**
- Nothing janks before or after on any profiled route. The one 233 ms frame is a single home-scroll outlier in the baseline.
- **Long article:** paints 336 → 251, paint 101 → 76 ms, style 39 → 26 ms.
- **Archive:** unchanged (33 layouts, 117 paints), by design, since change 5 is phone-only.
- **Standings tab switches:** within noise, and desktop never janked. The revisit memo still skips the rebuild there, but at CPU ×1 the rebuild never dropped a frame.

## Rejected optimizations

| # | Idea | Before → after | Verdict | Why |
|---|---|---|---|---|
| R1 | Defer standings' `history.replaceState` until after paint; it forces a 25–28 ms layout inside the tab `onchange` | forced layouts dropped (debrief 2→1, drivers 1→0); frames over 33 ms on revisits 1→3 and 2→4, within per-rep ranges of 0–2 vs 0–10 | reverted | The forced layout was the frame's own layout of the newly revealed panel, arriving early. Moving it saved nothing measurable |
| R2 | `shared-nav` scroll path: create the media-query lists once; write scroll-to-top state only on change | archive forced layouts 27–28 → 27–28; layouts 97–100 → 99–100; frames unchanged | reverted | The forced layout at `window.pageYOffset` (27× per archive scroll) is again the frame's own layout arriving early; nothing extra was removed |
| R3 | Generate: skip rebuilding the image-map rows when a keystroke leaves the marker count unchanged | script 122–136 → 93–136 ms per 49 keystrokes; layouts 98 → 98 | reverted | Overlapping ranges. The per-keystroke cost is the textarea's own layout plus the summary, not the rows |
| R4 | Remove `content-visibility: auto` from **all** images (hero, related, cards, every width) | archive layouts 98 → 34, but article heroes rendered differently in 5 of 12 controlled captures (4.8–10.3%, while baseline-vs-baseline was 0.000%) and desktop archive cards differed 0.7–4.4% | narrowed to phone archive cards (change 5) | Visual parity. Paint containment changes how the hero and downscaled desktop cards rasterize. At ≤767px the archive is pixel-identical at every scroll position |
| R5 | Transform- or clip-based reveal for the mobile menu (it animates `max-height`) | 136 layouts per 3 open/close cycles, but only 12–22 ms of layout in total, and no dropped frames | not done | A transform reveal would scale the menu contents: a visible change for no measurable gain |
| R6 | Remove the global 0.3 s colour transitions in `theme-overrides.css` (every `h1`–`h4`, `p`, `a`, `span`) | — | not done | Only the two author tools load that file. It is the visible theme crossfade, with no dropped frames |
| R7 | Stop the infinite skeleton pulses on the OpenF1 tabs (66 on quali-gaps) | 0 style recalcs in 2 s at idle | not done | They animate `opacity` and run on the compositor; the main thread pays nothing |
| R8 | Housekeeping `selectLane` forced layout (`focus()` on the heading) | 23 ms forced inside a 30 ms click | not done | The same layout of the rebuilt list must happen before the next paint anyway |
| R9 | `scrollStandingsTabIntoView` measures a hidden tab strip on phones | 1 forced layout per switch, inside rAF | not done | Inside rAF, it is the frame's own layout early, not extra work |
| R10 | Archive card-image fade (`.loaded`, 0.4 s opacity) and hover scale | — | kept | Designed motion. Hover recalcs only appear because the synthetic mouse sits over cards while wheel-scrolling; touch devices have no hover |

## Remaining unavoidable costs

- **Dirty-air timeline switch:** INP 104–176 ms at 4× CPU. Showing the timeline styles and paints ~3,300 absolutely positioned segments (70 ms style + 50 ms paint), and the first switch also builds them (+15 ms script). It is under the 200 ms "good" INP bar. Making it cheaper means rendering fewer elements (for example a canvas), which is a redesign of the chart.
- **Home load:** one long task of 138–147 ms at 4× CPU during initial script evaluation. Load work belongs to steps 1–2 (loading), not runtime.
- **Theme toggle:** a whole-document restyle (70–110 ms of style per 4 toggles at 4× CPU). Inherent to switching every colour token; interactions stay at 24–32 ms.
- **Scroll-position reads:** reading `pageYOffset` in `shared-nav`'s rAF and the article mini-bar forces the frame's layout early. It is not extra work (R2).
- **OpenF1-backed standings tabs** (quali-gaps, lap1-gains, tyre-pace, track-dominance): OpenF1 currently returns **401** without authentication, so in this environment these tabs never leave their loading state. Their loading sequence costs 100–200 ms of style per visit, with no dropped frames. This is a data-availability issue, not a smoothness one; it should be checked against production.
- **Memory:** no leak found. A 10-cycle home session grows 850 KB once (a lazy embed frame plus the remaining images loading), then about 7 KB per cycle, with DOM nodes (1,220) and listeners (63) flat. Standings keeps each visited tab's DOM (10.8k nodes after all ten tabs) by design.

## Visual check

**Full page-load matrix** (20 routes: home, archive, 7 articles plus a hero-viewport capture, standings with debrief and quali-gaps tabs, authors, generate, housekeeping, statistics, privacy, terms, 404, offline) × 390/768/1440 × dark/light. Each capture was run twice from the baseline (a noise pass) and once from the final build.
- The **worst diff is 4.4%**, against a **noise worst of 3.6%**.
- Every flagged route is one that also varies baseline-vs-baseline (lazy gallery timing on 20260422G and 20260918W, and the nav's live countdown), with one exception: the **phone archive full-page capture** (3.6–3.7%).
- That exception is a capture artifact. In the baseline's full-page screenshot, card images below the first screen are **blank**, because `content-visibility: auto` skips off-screen rendering during capture. The new build draws them. A visitor never sees blanks: images render before they enter the viewport.

**What visitors see on the archive:** viewport screenshots at scroll positions 0/900/1800/2700, each settled until in-view images had loaded and decoded, at 390 and 1440 in both themes. Base vs final **0.004%**, which equals the base-vs-base noise (**0.004%**).

**Interactive states touched by the changes**, at 390 and 1440 in both themes:
- TOC closed, open, and open after a scroll-driven active change
- dirty-air summary, timeline, and timeline after a revisit
- debrief first render and after a revisit
- housekeeping after two "load more"

All of them match within **≤0.011%**, the nav clock only. The one exception is the full-element archive-grid capture, the same off-screen artifact described above.

**Design guards:** no visible effect was removed.
- The mobile-menu reveal, theme crossfade, skeleton pulses, card fade-in and hover scale are all unchanged.
- The open TOC keeps its transitions.
- `prefers-reduced-motion` handling is untouched.
- The flat and matte rules in `DESIGN.md` / `KEEP.md` are unaffected: no blur, shadow or radius changes.

## Functional check

**`memocheck.mjs`** (standings; **22/22 pass** at 390 and 1440):
- A revisit keeps the identical DOM node, with an unchanged HTML length (dirty-air 19,688, debrief 945).
- A revisit still updates the URL (`?tab=dirty-air&dirtyAirSession=…`, `?tab=debrief&debriefRound=…`).
- The dirty-air timeline builds on its first switch (3,301 nodes, visible).
- A view chosen before leaving survives the revisit.
- Changing the session or round re-renders, and the choice survives a revisit.

**`hkcheck.mjs`** (housekeeping; **10/10 pass**): after load more ×3, then a search plus load more, the list HTML and the "N από M" stats text are byte-identical to the full-rebuild baseline at 390 and 1440 (for example 81,521 bytes for 96 rows; "48 από 49 αποτελέσματα · 356 συνολικά").

**Not rerun:** this pass did not touch the service worker, `shared-nav` or the article mini-bar (E was reverted), so the P2-10 SW test and the P3 mini-bar and progress-bar checks were not repeated. `test:consent` and `qa:visual` still run in *Verification*.

## Verification

Every `npm run verify` step was run individually on the final tree, so one failure doesn't hide the rest:

| Step | Result |
|---|---|
| `build:public` | ✅ pass (2,974 files) |
| `build:check` | ❌ expected: the regenerated artifacts (articles, shells, goldens) are not committed yet; it passes once they are |
| `quality:static` | ✅ |
| `audit:runtime` | ✅ |
| `test:blog` | ✅ (goldens regenerated; the only diff is the `article-styles.min.css` hash) |
| `test:author` | ✅ |
| `test:standings` | ✅ |
| `test:build` | ✅ |
| `perf:budget` | ✅ all files within budget |
| `perf:article-media` | ❌ pre-existing: `20260918W/1.webp` (1.22 MB) and `9.webp` (1.27 MB) exceed the fixed 1 MB single-file limit |
| `perf:images` | ✅ |
| `test:consent` | ✅ |
| `qa:visual` | ✅ full matrix ok |
| `perf:lighthouse` | ❌ accessibility only, **identical on the P0–P3 baseline dist** (below) |

**Lighthouse detail** (baseline dist vs final dist, 3 runs each):
- **Performance, LCP and CLS:** Home 98, Blog 98, Standings 97 and Article 96 on both.
- **Home a11y 96 on both:** `color-contrast` on the contact form's `p.contact-block__micro` (1.7:1). The same baseline dist scored 100 earlier the same day, so this audit is timing-dependent (likely caught mid fade-in).
- **Article a11y 95 on both:** `aria-hidden-focus`. The mobile mini-bar is `aria-hidden="true"` while its share button stays focusable: a real, pre-existing a11y bug outside this pass.
- **Article LCP:** 2,403 ms in the verify run and 2,554 ms in the diagnostic run of the same final dist; that is run-to-run variance around the 2,500 ms budget.

**`npm run verify`** itself stops at `build:check`, for the uncommitted-artifact reason above.

**Nothing was committed or deployed.** Changed sources:
- `standings/tabs/dirty-air.js`
- `standings/tabs/debrief.js`
- `scripts/author/housekeeping-page.js`
- `blog-module/blog/article-styles.css`
- `blog-module/blog-styles.css`

The rest of the diff is regenerated artifacts: the 356 article pages, shells, goldens and min files.
