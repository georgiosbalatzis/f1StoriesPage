# Sprint #279: integration readiness and Step 4

Base: `origin/main` at `f08cd0df`, 2026-10-15. No merge to main or deployment.
Existing Step 2/3 performance evidence remains accepted; no rejected CSS strategies
or exhaustive performance comparisons were repeated.

## Existing PRs

- [#282](https://github.com/georgiosbalatzis/f1StoriesPage/pull/282): main update
  `8855ac06`, preserving the original commits. Reconstructing this merge produces
  a conflict-free tree exactly matching the recorded merge. CSS correction
  `34b4114a` is pushed; Quality gates passed.
- [#284](https://github.com/georgiosbalatzis/f1StoriesPage/pull/284): main update
  `77df539e`, preserving the original commits. The update resolved the documented
  `index.html` conflict while retaining main's current stories and Step 3 preloads.
  Quality gates passed.
- Both are draft, `MERGEABLE/CLEAN`. Main has no required-check/up-to-date branch
  protection; its ruleset prevents deletion and non-fast-forward pushes. The
  original #282 historical mergeability response was not saved: conflicts and an
  up-to-date protection requirement are ruled out, but a transient GitHub status
  cannot be reconstructed. Draft status itself prevents merging.

## Combined Step 2/3 regression

Temporary worktree `f1StoriesPage-perf-integration`, branch `perf/integration-279`:
both existing PR heads plus the CSS guard correction, merge `90053762`.

Pass: public build/validator; 92 build tests; blog tests and goldens; static/token/
rendering checks; security tests; media QA; image delivery guard; article media
budget; consent tests; Edition discovery 358/358. Media QA checked 5,833 images,
4,994 srcset candidates, zero missing files/false descriptors/ratio mismatches,
and 802/802 LCP image checks. Only 10 already-cached article encodes were reused;
the 162 historic missing variant sets remain untouched.

One combined mobile Lighthouse budget run, gzip local server, Chrome 155:

| Route | Performance | Accessibility / best practices / SEO | LCP ms | CLS | TBT ms |
| --- | ---: | --- | ---: | ---: | ---: |
| Home | 98 | 100 / 100 / 100 | 2252 | 0.000 | 50 |
| Blog | 99 | 100 / 100 / 100 | 2101 | 0.004 | 0 |
| Standings | 99 | 100 / 100 / 100 | 2102 | 0.004 | 0 |
| Latest article | 98 | 100 / 100 / 100 | 2252 | 0.000 | 18 |

Every route budget passed, including the corrected inline CSS metric. No broad
comparative benchmarking was needed.

`perf:budget` fails **nine pre-existing file-size budgets**. A fresh main build
fails on the same nine files; all nine source/generated files have identical
SHA-256 content and byte sizes in main and integration (zero integration growth).
Details: [integration-size-budget-2026-10-15.md](integration-size-budget-2026-10-15.md).
Those budgets were not increased and the unrelated runtime files were not edited.
Passing PR CI should not be mistaken for a fully passing `npm run verify`.

## Actual image requests

Fresh Chrome contexts; request IDs and initiators captured with CDP, and matched
to each cover image's `currentSrc`. Lead is now `20261014W`, frames `20261014F`
and `20261014G`. Paths below are relative to each story directory.

| Viewport / DPR | Hero | Frame F | Frame G |
| --- | --- | --- | --- |
| 390 / 3 | `2.avif` | `1-mobile.webp` | `1-mobile.webp` |
| 768 / 2 | `2.avif` | `1.avif` | `1-mobile.avif` |
| 1440 / 1 | `2-mobile.avif` | `1.avif` | `1-mobile.avif` |

Every selected cover candidate had exactly one request, and no other AVIF/WebP
candidate of that cover was fetched. No unused-preload warnings. The two frame
preloads' media conditions were false at 390 and true at 768/1440. The typed
responsive hero preload selected the same candidate as its picture. This is
actual Chrome AVIF support; an AVIF-disabled browser was not emulated.

## CSS guard correction (#282 only)

`route-css-bytes` continues counting compressed external stylesheet transfer
bytes. New `inline-css-bytes` counts UTF-8 source bytes from all document style
blocks, including existing inline styles; it is explicitly uncompressed.
External budgets remain unchanged. Independent metric tests cover both units.

| Route | Inline CSS measured B | New inline budget B |
| --- | ---: | ---: |
| Home | 126407 | 140000 |
| Blog | 89131 | 99000 |
| Standings | 146634 | 162000 |
| Latest article | 194743 | 215000 |

These budgets add roughly 10% headroom to the measured source sizes rather than
relabeling compressed transfer budgets. See #282's step2 report for details.

## Tablet CLS: exact cause and fix

The edition row uses Barlow Condensed for Latin and IBM Plex Sans for Greek,
with a generic sans-serif fallback. At 768 px, the fallback's wider mixed-script
labels wrap, adding one 16.5 px line. On font arrival Chrome attributes a shift
to `.cover-strip` (`y127 -> y111`), `.cover-text` (`y849 -> y832`), and the edition
span (`height34 -> 18`). A deliberately delayed whole-font-set diagnostic
reproduced a **0.045** cover shift, consistent with the accepted ~0.048 total.

The only product rule added is `.home-page .cover-edition > span {
white-space: nowrap; }`. It preserves the intended one-line labels while fonts
load. No height reservation, clipping, hidden content, animation changes,
template changes, or runtime changes.

The new `perf:cls-tablet` guard measures real cold-load CLS on Slow 4G / CPU x4
and then separately replays just the edition label's fallback-to-loaded-font
swap. This deterministic replay matters: local preload scheduling can load fonts
before paint and make unfixed main appear to pass (0.003 cold CLS). It sets only
that label's font family to the actual generic fallback, waits for paint, clears
the observer, restores the authored family, and reads Chrome layout-shift
attribution. It does not simulate delays for unrelated page fonts.

On unmodified main, the isolated replay fails at **0.028** in both themes with
the exact 16.5 px cover movement. On the fixed artifact, the replay is below
0.001, row height stays 42.5 px, and the cover does not move vertically. Its
score differs from the 0.045 startup shift because the rest of the page's fonts
and affected element geometries are already settled. Neither value is presented
as the other's measurement.

| Width | Cold CLS dark | Cold CLS light | Edition-swap CLS both themes |
| --- | ---: | ---: | ---: |
| 390 | 0.004 | 0.004 | <0.001 |
| 768 | 0.003 | 0.003 | <0.001 |
| 1024 | 0.000 | 0.005 | <0.001 |
| 1440 | 0.001 | 0.007 | <0.001 |
| 1920 | 0.001 | 0.004 | <0.001 |

All use DPR 2; heights 844/1024/1366/1080/1080 respectively. No horizontal
overflow in any final layout. Default guard covers 768 and 1024, both themes;
CI explicitly runs 768. Largest-session-window calculation has focused tests,
and any over-budget case fails with attribution, with no pass-on-retry policy.

Settled first-viewport cover screenshots excluding the live nav are pixel-identical
for all five widths in dark/light themes. Compared independent navigations with
the rule enabled and with only that rule restored to main's wrapping behavior;
font readiness, viewport and screenshot animation handling were identical.
No image candidates, geometry or appearance changed.

An exploratory artificial 1.5-second delay of **every** web font also exposed
separate existing headline/navigation font-swap shifts (up to 0.032 at 390 and
0.021 at 768 after the edition fix). These are not the edition wrapping cause
and are not concealed by the deterministic edition check. The production
cold-load matrix above passed; this change does not claim zero CLS under every
artificial font scheduling pattern. No unrelated typography redesign was applied.

Reproduce after building:

```sh
npm run perf:cls-tablet -- --widths 390,768,1024,1440,1920 --output /tmp/cls.json
# Against a separate, unmodified-main dist, the deterministic 768 case fails:
node scripts/perf/tablet-cls-guard.mjs --root /path/to/main/dist --widths 768
```

## Sprite / HTML decision

Keep current inline subsets. The measurement across 445 sprite-bearing HTML
documents found 4,946,364 repeated raw sprite bytes. A versioned hybrid external
subset adds a request with essentially unchanged cold body transfer, saves
2.6–3.5 KB gzip on matching cached navigations, removes 28–36 DOM elements, and
shows at most 0.1 ms parse difference. Whole shared sprites increase cold home
transfer by about 6 KB gzip. The benefit does not justify pipeline/compatibility
changes, especially with fragment-only runtime factories that must remain intact.
Full measurements and color/cache probes:
[step4-sprite-evaluation-2026-10-15.md](step4-sprite-evaluation-2026-10-15.md).

## Separate visual QA correction

Draft [#285](https://github.com/georgiosbalatzis/f1StoriesPage/pull/285), commits
`fd0f4166` and `97b111c9`, has passing Quality gates. On unmodified main, article
`20261014F` at 768 reproduced `Expected options.clip.height to be greater than 0`:
a lazy telemetry iframe shrank after scroll/focus and moved a measured WhatsApp
control to `y=-94`. The harness now waits/recenters with bounded retries and
reports a real failure if the control never settles. Ring thresholds are intact;
the browser regression verifies resize recovery, missing rings and unframable
controls. A stale lightbox selector now matches the current supported cover
control as well as legacy articles. Full 72-capture QA had only those eight
selector findings; all eight affected article captures passed after correction,
along with the other 64 captures and three interactions. No product JS changed.

## Scope

Step 4 is independent of #282/#284. Main's unrelated local documentation edits
were preserved. No production deployment, merge into main, historic image
variant generation, or Codex-owned runtime JavaScript modification occurred.
