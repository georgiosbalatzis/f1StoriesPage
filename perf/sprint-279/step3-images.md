# Issue #279 — step 3: LCP image and responsive delivery (2026-10-15)

Branch `perf/claude-lcp-images`, from `origin/main` @ `9e97cccc`, independent of step 2. Homepage lead at capture
time: `20261014F`; cover frames `20261014G` and `20261013W`.

## Finding

On tablets and desktops the homepage LCP is not the hero, it is a **cover frame** beside it: 383×287 at 768 px,
359×562 at 1440 px and 479×600 at 1920 px. The frames are small files (7–17 KB), yet they painted 0.55–1.0 s after
first paint on Slow 4G. The request log shows why:

- The browser holds body images back until the render-blocking stylesheets have arrived (about 1.48 s).
- After that, everything competes at once, including a 116 KB lazy image from the next section.
- `fetchpriority` on the `<img>` does not change this: `low`, default and `high` all measured the same. Only the head
  hero preload started early (≈590 ms).
- Inlining the CSS (step 2) does not remove the hold either. The frames still landed ≈550 ms after first paint.

Phones are unaffected: there the LCP is the hero, which is already preloaded, and the frames are 112×84 thumbnails.

## Changes

1. **Cover-frame preloads from 768 px** (`renderCoverFramePreloads`, `blog-module/build/index.js`). The homepage head
   gets one `<link rel="preload" as="image" media="(min-width: 768px)" fetchpriority="high">` per frame, in an
   `f1s:home-frame-preload` block.
   - Each preload names exactly the candidates and `sizes` its frame's picture uses at that width: the AVIF
     `<source>` (typed `image/avif`, so a browser without AVIF skips it) or else the WebP `srcset`. So it is never a
     second download.
   - Both are computed by one function (`coverFramePicture`), and a test asserts they match.
   - A default-priority preload was measured and gives no gain, so `high` is required.
2. **Typed hero preload.** The hero preload now carries `type="image/avif"` when it names the AVIF. Before, a browser
   without AVIF downloaded the AVIF and then displayed the WebP.
3. **Responsive hero for stories whose cover is `2.webp`** (the W series). The hero `srcset` was built only for
   `1.webp` covers, so when a W story leads, every device would receive the 1600w master although
   `2-mobile.webp/.avif` exist. The same measured-width sets are now built for either cover. Without AVIF, the preload
   follows the WebP set. This does not affect today's lead (a `1.*` story); it applies the next time a W story leads.

## Rejected: smaller phone `sizes` for the cover frames

The frames' phone `sizes` assume a 150 px tall box, while `home.css` draws 112×84 thumbnails. Asking for the true box
size makes phones fetch the 400w card instead of the 540/800w copy: −7.8 KB per load, with no change to paint times
(the frames are not the phone LCP).

At 390@3× the card is used at about 1:1, and the comparison against the previous screenshot was measurably softer:
PSNR 30 dB on the thumbnail, with lettering edges visibly blurred at 4× zoom. Image fidelity takes precedence over
7.8 KB, so this was reverted.

## Measurement

Real Chrome, local HTTP/2 + gzip + `max-age=600`, CPU ×4, third parties blocked. Base = `origin/main` homepage,
everything else byte-identical. Interleaved, median of 3; FCP / LCP in ms.

| Viewport | Network | Base | Step 3 | LCP change |
|---|---|---|---|---|
| 390×844 @3× | Slow 4G | 1696 / 1832 | 1692 / 1836 | none: phones get identical markup and bytes |
| 768×1024 @2× | Slow 4G | 1704 / 2272 | 1792 / **1792** | **−480** |
| 1440×900 @1× | Slow 4G | 1688 / 2688 | 1788 / **1860** | **−828** |
| 1920×1080 @1× | Slow 4G | 1688 / 2696 | 1772 / **1852** | **−844** |
| 1440×900 @1× | Fast 4G | 632 / 700 | 652 / 716 | +16 (FCP +20) |

The 390 px and 1440 px Slow 4G rows were re-measured on the final build; the others come from the same build before
the phone `sizes` revert, which changes nothing from 768 px up. On Slow 4G, FCP moves later by 80–100 ms on
tablets and desktops while LCP moves 480–844 ms earlier.

**Combined with step 2's inlined CSS** (same frame preload): 1440 Slow LCP 2152 → **1680**, 768 Slow 2080 → **1628**,
1440 Fast 604 / 672 → 632 / 692.

**Trade-off.** On tablet- and laptop-class viewports over mobile networks, LCP improves by about 0.5–0.85 s, while
FCP moves 80–100 ms later. Desktop on a fast connection pays about 16–28 ms on FCP/LCP, because the two preloads
(≈24 KB) share the connection with the stylesheets. Phones are untouched.

## Regression checks

- **Homepage parity** (only `index.html` differs): 390@3, 768@2, 1440@1 and 1920@1, both themes, first and second
  viewport, base / step 3 / base back to back. Identical within the noise floor.
  - The only difference above noise is the live race countdown in the nav ("11d 0h 0m" vs "10d 23h 59m"); the minute
    rolled over between captures.
- Pass:
  - `build:public` + validator.
  - `test:blog` (240 plus goldens) and `test:build` (89).
  - `qa:media`: LCP group 800/800, no false descriptors, no missing files, no ratio mismatches.
  - `perf:images`, `quality:static` and `qa:edition` (358/358).
  - A second `build:blog` leaves the homepage unchanged (idempotent).
- Lighthouse guard: all budgets pass. Home 97, LCP 2404 ms, the same as baseline 2407; the simulation is mobile only.
  The previously failing Article third-party budget now passes, because the latest article changed on `main`.
- **Pre-existing on current `main`, not caused by this change:** `qa:visual` crashes at the 768 px latest-article
  focus-ring check (`page.screenshot: Expected options.clip.height to be greater than 0`) on the base build as well.
  The share button's box ends up outside the viewport after `scrollIntoView`. Recorded, not fixed here.
- **Pre-existing, not addressed:** homepage CLS 0.048 at 768@2× (budget 0.02, which the mobile-only guard does not
  test).

## Not done (needs an owner decision or a larger change)

- **Missing mobile hero copies:** 162 older articles have a single wide hero candidate (average 79 KB AVIF). Creating
  `-mobile` copies means about 324 encodes and goes against the generator's rule that source-less articles keep their
  existing media.
- **Oversized AVIF:** `20250507W/2.avif` is 4367 px (207 KB) while its WebP is 1600 px. It is kept on purpose by the
  generator.
- **No 1200w step for 1600 px masters.** This needs generator, renderer and validator changes.
