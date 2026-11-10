# P-03C Standings accessibility

## Baseline evidence and cause

Merged Main `b0995928bf1c6361a1162b2bdecf710767799491`, tree `fd89ca910a8494aa870a3b89836af2543603016b` (see `/Users/giorgos/WebstormProjects/f1s-p03-evidence/base/identity.txt`). All three `/Users/giorgos/WebstormProjects/f1s-p03-evidence/base/campaign/main/standings-{1,2,3}.json` reports score `color-contrast` and `label-content-name-mismatch` 0. HIR and RAF have inline #B6BABD text on #e9e3d6, reported 1.52:1 against 4.5:1. The player name omitted the full stop in the visible `ON AIR.`; the report also showed the two rendered faces.

## Change

Fallback initials use `--st-text` on `--st-surface`; the existing team-colour border remains. Both missing and failed images use the same fallback. The audio name includes `ON AIR.` in play and pause states; the duplicate face remains aria-hidden and `aria-busy` remains independent. The player does not have separate on-air/off-air states: its visible phrase is constant. Browser computed styles, accessibility tree and audit results remain to be verified.

## Contrast table

WCAG ratios calculated from canonical `standings/core/teams.js` colours and editorial surface tokens; old team-colour text is shown for both themes. New token text is independent of team colour: 12.20:1 light (#20251f/#e9e3d6), 12.86:1 dark (#eee8db/#242321), and 12.89:1 for the alternate dark token #eee8df. Base non-editorial tokens yield 15.46:1 light and 14.37:1 dark. Rounded to two decimals; Lighthouse's reported Haas value is 1.52:1.

| Team | Colour | Old light | Old dark | New light | New dark |
|---|---|---:|---:|---:|---:|
| Mercedes | #27F4D2 | 1.10 | 11.18 | 12.20 | 12.86 |
| Red Bull | #3671C6 | 3.79 | 3.24 | 12.20 | 12.86 |
| Ferrari | #E8002D | 3.67 | 3.34 | 12.20 | 12.86 |
| McLaren | #FF8000 | 1.97 | 6.24 | 12.20 | 12.86 |
| Aston Martin | #229971 | 2.80 | 4.38 | 12.20 | 12.86 |
| Alpine | #FF87BC | 1.74 | 7.06 | 12.20 | 12.86 |
| Haas | #B6BABD | 1.53 | 8.04 | 12.20 | 12.86 |
| Racing Bulls | #6692FF | 2.31 | 5.32 | 12.20 | 12.86 |
| Williams | #64C4FF | 1.51 | 8.14 | 12.20 | 12.86 |
| Sauber / Audi | #F50537 | 3.31 | 3.71 | 12.20 | 12.86 |
| Cadillac | #1E4168 | 8.17 | 1.50 | 12.20 | 12.86 |

## Tests

Focused Node tests cover the source, all canonical teams and theme token contrast, plus accessible names in idle, playing, buffering and error states. Existing audio browser QA expectations were updated; it must be run by the orchestrator. Node 22: build:public, perf:budget, quality:static, audit:runtime, test:standings, test:blog and check:assets exited 0. build:check exited 1 because generated changes are uncommitted. test:build exited 1 (180 passed, one newsletter browser test could not launch Chrome); it unexpectedly includes a browser test. The Git index lock was denied by the sandbox, preventing the requested commit and post-commit build:check.

## Matched benchmark

Round 1 campaign: all three `/Users/giorgos/WebstormProjects/f1s-p03-evidence/c/campaign/main/standings-{1,2,3}.json` reports pass `color-contrast` and fail `label-content-name-mismatch` on the audio button.

## Round 2: audio label

Lighthouse 13.6.0 uses axe-core 4.14.0. In `node_modules/axe-core/axe.js`, `labelContentNameMismatchEvaluate` (line 30872) calls `visibleVirtual` with `screenReader` false and compares its sanitized text against the accessible name as a contiguous sequence of normalized word tokens (`isLabelContainedInName`, line 30798). `visibleVirtual` (line 21326) recursively collects DOM text nodes; `flattenTree` (line 23247) builds that tree from child nodes, so CSS pseudo-element content is not collected. `_isVisibleOnScreen` (line 19341) checks display, visibility, opacity, overflow, clipping and offscreen status, but does not use `aria-hidden`; that attribute applies to screen-reader visibility. `clipHidden` (line 19087) treats an inset as hidden when its first numeric value is at least 50, whereas this face begins with `inset(0 ...)`. Thus the duplicated DOM text can be included even when the fill is clipped, as the campaign observed.

The fill face now renders `ON AIR.` from its `data-label` via `::before`; the underlying face retains the real DOM label, its separately coloured dot, and the same clipped fill face and glyph. For idle, playing and buffering, the sole DOM text is `ON AIR.` and each accessible name contains those words. The source reasoning was not run through axe in Node (jsdom is not installed); the Lighthouse campaign below confirms it.

## Verification (orchestrator, outside the sandbox, Node 22.23.4)

Round 2 campaign, same runner blob and fixtures as the merged-Main baseline, 3/3 valid Standings attempts (`/Users/giorgos/WebstormProjects/f1s-p03-evidence/c2/campaign/main/standings-{1,2,3}.json`): accessibility 100 in all three, no failing accessibility audit in any attempt (`color-contrast` and `label-content-name-mismatch` both pass), performance 100, LCP 902.559 / 901.524 / 901.536 ms, budgets passed. Baseline for comparison: accessibility 97 in all three, failing both audits (`base/campaign/main/standings-{1,2,3}.json`). `label-content-name-mismatch` has weight 0 in Lighthouse 13.6, so the score change comes from `color-contrast`.

Gates on the final tree: `build:public`, `build:check` (after regenerating `generate.html`, whose preview-renderer hash the worker's earlier build left stale), `test:build`, `qa:audio-player` (browser: behaviour, persistence and layout/colour checks), `test:standings`, `perf:budget`, `quality:static`, `audit:runtime` all exit 0. The 490 changed HTML files differ only in `?v=` asset hashes: the shared-nav CSS and JS on every page, the Standings assets on Standings pages, and the preview-renderer hash in `generate.html`. No article content changed. Dark theme is not measured by the campaign (the runner pins light); dark contrast rests on the unit test above.
