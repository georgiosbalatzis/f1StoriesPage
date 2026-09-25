# F1 Stories: Payload and Critical Render Path Report

Step 4 of the performance program, run on `perf/perf-boost` on 2026-09-24, after P0–P3 (HEAD `9fe2f65`) and the uncommitted step 3 smoothness changes. The scope was the payload and the critical render path only. Nothing was redesigned, no content was removed, and no image quality was changed. Nothing was deployed or committed.

## Summary

- **The biggest finding was structural, not bytes.** Every page opens with a `<meta http-equiv="Content-Security-Policy">`. Chromium's preload scanner holds back what it finds after a CSP meta until the parser catches up. Two parser-blocking scripts (`error-beacon`, then `theme-init`) sat right after it, so **every stylesheet, font and preload started only after two sequential round trips**: about 320 ms on Slow 4G, on every route.
- **Fix:**
  - `error-beacon` is now `defer`.
  - `theme-init` stays parser-blocking but moved to the end of `<head>`. The theme is still set before `<body>` exists (checked on 11 routes × 4 theme modes).
- **Real-Chrome results.** Mobile LCP is 190–290 ms faster on every surface, and FCP 200–240 ms faster:

| Surface | Mobile LCP before | Mobile LCP after |
|---|---|---|
| Home | 1160 ms | 956 ms |
| Article | 1388 ms | 1172 ms |
| Standings | 1172 ms | 960 ms |
| Archive | 1456 ms | 1164 ms |

  Desktop LCP is 70–90 ms faster.
- **Three smaller payload bugs were fixed:**
  1. **Archive preload.** The archive LCP preload fetched a candidate the `<img>` never used (a wasted 7.5 KB request on phones).
  2. **Bootstrap hash drift.** All 356 articles referenced Bootstrap under a stale `?v=` hash: a second cache entry for the same file, and no cache bust on its next change.
  3. **Home hero re-fetch.** `blog-loader.js` re-wrote the home hero preload's attributes to identical values, which can trigger a second hero fetch. Lighthouse caught it after fix 1 changed the timing.
- **Images were already well-sized.** No image downloads significantly more pixels than its rendered size needs, given its candidate ladder. Details are under *Images*.
- **Pixels are identical.** Base-vs-final viewport captures (5 routes × 390/768/1440 × dark/light) are 0.000% different, with a noise floor of 0.000%.
- **Owner follow-ups, applied on 2026-09-25** (see *Follow-ups*):
  1. **Standings label.** A shorter `stale` label removes the standings CLS: 0.148 → 0.000.
  2. **Home tablet shift.** Its real cause was `ch`-based widths, not a font swap. Those widths are converted to `em`, and metric-matched fallback faces are added; the home tablet CLS goes 0.034 → 0.000.
  3. **Automatic restamp.** Article asset hashes are now restamped on every build.

## Method

**Tools.**
- **Agent Skills** (*performance-optimization*, *webperf*): workflow of measure, find, fix, re-measure, keep or revert.
- **Ponytail:** the smallest fix at the root.
- **Graphify / DESIGN.md / KEEP.md** from earlier passes: design guards. Designed motion (card and hero entrance fades) is treated as design.
- **Playwright:** drove everything.
- **Lighthouse 12:** simulated throttling, cross-check only.
- **sharp:** read real image dimensions.

**Payload probe** (`payload.mjs`, session scratchpad).
- Serves `dist/` the way GitHub Pages does (gzip, `max-age=600`), with a cold context per load and the service worker blocked.
- Third parties are blocked at DNS. `ctx.route` would disable the HTTP cache.
- Records every request: priority, start and end, bytes, and whether it started before LCP.
- Also records LCP (with its element), FCP, CLS, TBT (long tasks after FCP), and an image audit: file pixels, via sharp, vs rendered CSS px × DPR. `naturalWidth` is density-corrected under `w` descriptors, so it can't be used.

**Profiles.**

| Profile | Viewport | DPR | CPU | Network |
|---|---|---|---|---|
| `m390` | 390×844 | 3 | ×4 | Slow 4G (150 ms RTT, 1.6 Mbps) |
| `t768` | 768×1024 | 2 | ×2 | Slow 4G |
| `d1440` | 1440×900 | 1 | ×1 | 10 Mbps, 28 ms |

**Reps.** 5 per configuration, median. Before and after ran back to back on the same machine. Home "after" is from a re-run following the last home-only change (`blog-loader.js`).

**Other harnesses.**
- `sizesweep.mjs`: evaluates every `sizes` slot vs rendered width at 18 viewport widths.
- `coverage.mjs`: CSS coverage, union of 390 and 1440, after a full scroll.
- `clsattr.mjs`: layout-shift sources.
- `filmstrip.mjs`: screencast pixel completeness of one element, for visual-vs-metric questions.
- `swprobe.mjs`: returning visits with the SW active, counted server-side with an ETag/304 server.
- `themeflash.mjs`: the `data-theme` value at the moment `<body>` is created.
- `herosync.mjs`: hero attribute writes and fetches.
- `parity.mjs`: viewport screenshot parity.

## Before and after

### The four required surfaces (median of 5)

| | Requests | Transfer | CSS | JS | Fonts | Images | FCP | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|---|---|
| **Home, mobile** (390) | 29 → 29 | 373.6 → 373.6 KB | 26.0 → 26.0 | 21.8 → 21.8 | 73.8 → 73.8 | 237.8 → 237.8 | 1160 → **956** | 1160 → **956** | 0 → 0 | 0 → 0 |
| **Article, mobile** (390) | 27 → 27 | 162.3 → 162.3 KB | 34.4 → 34.4 | 20.5 → 20.5 | 73.8 → 73.8 | 19.4 → 19.4 | 1084 → **856** | 1388 → **1172** | 0 → 0 | 0 → 0 |
| **Standings, mobile** (390) | 37 → 37 | 194.9 → 194.9 KB | 32.4 → 32.4 | 29.4 → 29.4 | 73.8 → 73.8 | 42.4 → 42.4 | 1172 → **960** | 1172 → **960** | 0.148 → 0.148 ¹ | 0 → 0 |
| **Home, desktop** (1440) | 29 → 29 | 214.4 → 214.4 KB | 26.0 → 26.0 | 21.8 → 21.8 | 73.8 → 73.8 | 78.6 → 78.6 | 276 → **204** | 276 → **204** | 0 → 0 | 0 → 0 |

KB are transfer (gzip) sizes. Times are ms from navigation start.

¹ The standings mobile CLS only happens when the live Jolpica refresh fails, which the probe forces by blocking third parties. With a successful live response it is **0.0003**. See *Open issues*.

### Other configurations

| | Requests | Images | FCP | LCP | CLS |
|---|---|---|---|---|---|
| Home, tablet (768) | 29 → 28 ² | 237.8 → 186.7 KB ² | 1116 → 892 | 1116 → **892** | 0.034 → 0 ² |
| Article, tablet (768) | 27 → 27 | 19.4 → 19.4 | 1016 → 788 | 1300 → **1064** | 0 → 0 |
| Article, desktop | 27 → 27 | 19.4 → 19.4 | 244 → 176 | 244 → **176** | 0.002 → 0.002 |
| Standings, desktop | 37 → 37 | 42.4 → 42.4 | 296 → 220 | 296 → **220** | 0.009 → 0.009 |
| Archive, mobile | 27 → **26** | 27.2 → **19.7** | 1184 → 944 | 1456 → **1164** | 0 → 0 |
| Archive, desktop | 29 → **28** | 79.3 → **71.7** | 292 → 204 | 292 → **204** | 0.008 → 0.008 |

² Timing-dependent, not claimed as savings.
- **CLS:** the home-tablet shift is a font swap that happens in some loads and not others. It re-wraps the hero headline by 53 px. Fonts now start earlier, so it shows up less often (0 of 5 in this probe; 1 of 3 in `clsattr`), but the root cause remains. See *Open issues*.
- **Requests and images:** the 51 KB YouTube thumbnail sits at the lazy-load boundary, and whether it loads within the probe window follows the same timing.

### Lighthouse cross-check (simulated throttling, median of 3)

| | Perf | Requests | Transfer | FCP | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| Home, mobile | 98 → 98 | 37 → 37 | 473.3 → 473.8 KB | 1504 → 1503 | 2254 → 2253 | 0.001 → 0.001 | 0 → 0 |
| Article, mobile | 96 → 96 | 29 → 29 | 200.5 → 200.5 KB | 1954 → 1953 | 2556 → 2554 | 0 → 0 | 16 → 13 |
| Standings, mobile | 97 → 97 | 39 → 39 | 233.4 → 233.4 KB | 1879 → **1803** | 2253 → 2403 ³ | 0.015 → 0.010 | 0 → 0 |
| Home, desktop | 100 → 100 | 42 → 42 | 391.9 → 391.9 KB | 403 → **363** | 484 → 483 | 0.012 → 0.013 | 0 → 0 |

Lighthouse runs the page unthrottled and simulates the network (Lantern). Lantern mostly doesn't model the CSP preload-scanner hold, so it barely registers the main win. Real throttled Chrome (tables above) is the ground truth for this change.

³ **Standings Lantern LCP.** Unthrottled, the standings LCP is the page title at 46–68 ms, equal to FCP, in both builds. Lantern builds its LCP estimate from whatever the unthrottled trace had finished before that paint. With `theme-init` now waiting for the stylesheets, more requests finish before first paint in the unthrottled trace, so Lantern bills them to LCP. Real Slow 4G Chrome shows the opposite: 1172 → 960 ms, 5 of 5 reps within 948–1020. The value stays inside the 2,500 ms route budget, and `perf:lighthouse` passes it.

## Changes made

### 1. Head scripts no longer block discovery (all pages)

**The problem.** Every page's `<head>` was:

```
<meta charset> <meta http-equiv="Content-Security-Policy"> <meta viewport>
<script src="/scripts/perf/error-beacon.min.js"></script>   ← parser-blocking
<script src="/scripts/theme-init.min.js"></script>          ← parser-blocking
…stylesheets, font preloads, image preload…
```

Timeline evidence (home, mobile, before):
- `error-beacon`: 167 → 328 ms.
- `theme-init`: 330 → 485 ms.
- **Every other request started at 487–497 ms**: 6 stylesheets, 2 fonts, the hero image, `home-latest.json` and the logo.

The same pattern shows on the article (497 ms), standings (488 ms) and archive (497 ms). The preload scanner didn't run ahead. That fits Chromium holding back what the scanner finds after a CSP meta until the parser reaches it, and the parser was stuck on the two scripts.

**Experiments** on a copy of the baseline `dist/` (3 reps):

| Variant | Home, mobile | Article, mobile | Standings, mobile | Home, desktop |
|---|---|---|---|---|
| Baseline | 1152 | 1392 | 1160 | 280 |
| E1: `error-beacon` → `defer` | 1020 | 1236 | 1008 | 244 |
| **E2: E1 + `theme-init` at end of `<head>`** | **948** | **1152** | **952** | **216** |

**Why E2 is safe.**
- **`error-beacon` as `defer`.** It ignores resource errors and can only report through `gtag`, and `gtag` comes from the deferred analytics script. As the first `defer` script it still installs its handlers before every other deferred and module script runs.
- **`theme-init` at the end of `<head>`.** It is still parser-blocking and still runs before `<body>` is created, so the theme is set before first paint. `themeflash.mjs` checks `data-theme` at the moment `<body>` is created: **44/44 pass** (11 routes × stored light / stored dark / system light / system dark).
- **No other head script reads the theme.** The one other sync head script is `statistics-config.js`, and it doesn't read the theme.

**The implementation is one build step.**
- `placeHeadScripts()` in `scripts/build/stamp-html.mjs` runs in the shell loop, in the article theme pass, and again at the end of the article runtime pass. The last run matters because `applyArticleEditorial()` re-inserts its three stylesheets before `</head>` on every stamp, and `theme-init` must stay after them.
- It is idempotent: a second stamp run changed 0 files.
- `partials/head-meta.html` now carries `defer` on `error-beacon` and no longer emits `theme-init` (the stamp step inserts it).
- The redirect stubs `ghostcar/` and `f1telemetry/` are exempt, as they already were for theme-init.

### 2. Archive LCP preload matches its `<img>` (`blog-module/build/index.js`)

The archive preload was a bare `href="…/1-card.webp"`. The lead card's `<img>` has a `400w/800w/1600w` srcset with `sizes` (see *Images*), so on a DPR-3 phone the browser preloaded the 400w card, **never used it**, and then fetched `1.webp` separately, found late by the parser. The preload now carries the same `imagesrcset` and `imagesizes` (`cardImageSrcset(…, true)` and `CARD_SIZES.archiveLead`).
- **Archive, mobile:** 27 → 26 requests, images 27.2 → 19.7 KB.
- **Archive, desktop:** 29 → 28 requests, images 79.3 → 71.7 KB.

Three variants were tested with `filmstrip.mjs`, which measures when the lead image region actually becomes visible (5 reps, Slow 4G, CPU ×4):

| Lead image | No preload | Old `1-card` preload | **Matching preload** |
|---|---|---|---|
| Light (14 KB, current lead), 90% visible | 1080 ms | 1140 ms | 1140 ms |
| Heavy (96 KB `1.webp` at DPR 3), 90% visible | 1630 ms | 1685 ms | **1425 ms** |

The matching preload wins by about 260 ms when the lead image is heavy, and lead images vary with every new article. With a light lead it costs about 60 ms of visibility. For a light lead the recorded LCP is higher than with no preload (1164 vs 992 ms), for the reason under *Open issues*: the card fades in from opacity 0. The matching preload was kept.

### 3. Articles use the current Bootstrap hash (`scripts/build/stamp-html.mjs`)

- **The drift.** All 356 articles referenced `bootstrap.slim.min.css?v=c3f2db5f`, while the manifest and every shell use `?v=946979ee`. After the P3-07 Bootstrap trim, the shells were re-stamped, but articles are only re-stamped with `--stamp-articles`, and Bootstrap isn't in `ARTICLE_RUNTIME_SOURCES`.
- **The cost.** The same file was cached twice. A returning visitor going from home to an article re-downloaded it: 3.7 KB, visible in `swprobe.mjs` as a 200 before and a 304 after. And the next Bootstrap change would not have busted the article pages' cache.
- **The fix.** `swapBootstrapCdn()` already runs over every article on every build. It now also re-points any stale local Bootstrap `?v=` to the manifest hash. After the fix, no tracked file references `c3f2db5f`.

### 4. The home hero sync writes only real changes (`blog-module/blog-loader.js`)

- **The bug.** `syncHeroMedia()` set `src`, `srcset`, `sizes` and `alt`, and the hero preload's `href` and `imagesizes`, unconditionally, even to identical values: 9 attribute writes on every home load. Changing a preload `<link>`'s attributes can re-run its fetch.
- **How it surfaced.** After change 1 moved the timing, Lighthouse (whose server sends `no-store`) showed `1.avif` fetched **twice** in 6 of 6 final home runs, against 0 of 6 before.
- **The fix.** A single `setAttr()` helper writes only differing values and removes only present attributes.
- **Check** (`herosync.mjs`):
  - Unchanged lead: 0 attribute writes and one hero fetch.
  - Changed lead (a swapped `home-latest.json`): `src`, AVIF `srcset`, preload `href` and `alt` all follow the new story.
  - The duplicate fetch is gone from Lighthouse: 0 of 3 mobile runs, and desktop is back to 42 requests.

## Critical path classification

These are the requests that start before LCP on 390 px Slow 4G, after the fixes. Sizes are transfer sizes.

| Resource | Surfaces | Class | Why |
|---|---|---|---|
| Document | all | CRITICAL | |
| `theme-init.min.js` (0.5 KB, sync, end of `<head>`) | all | CRITICAL | Sets the theme before first paint; now fetched in parallel with the CSS |
| `error-beacon.min.js` (1.0 KB) | all | DEFERABLE → **deferred** | See change 1 |
| Route stylesheets: 6 on home (26.0 KB), 8 on article (34.4), 7 on standings (32.4), 7 on archive (32.3) | per route | CRITICAL | Render-blocking and used in the first viewport. The unused share is under *CSS and JS scoping* |
| Home hero `1.avif` preload (14 KB, high) | home | CRITICAL | The LCP image; the preload matches the `<picture>` source |
| Article hero AVIF preload (responsive, high) | article | CRITICAL | Heroes are large: median 37 KB, p90 72 KB, max 145 KB (phone candidate). Dropping the preload delayed a p90 hero's visibility by about 250 ms (1370 → 1620 ms, `filmstrip.mjs`). Kept |
| Archive lead-card preload (responsive, high) | archive | CRITICAL | Change 2 |
| `barlow-condensed-700` (14.7 KB) + `ibm-plex-sans-greek` (16.1 KB) preloads | home, standings, archive | NEAR-CRITICAL | Hero headline and first-viewport text (`font-display: swap`). Kept to limit late swaps; see the home tablet CLS |
| `ibm-plex-sans-greek` preload | article | NEAR-CRITICAL | Body and title face |
| Barlow on the article | article | not preloaded (correct) | Only the nav wordmark and footer use it; the title is Plex |
| `home-latest.json` preload (1.6 KB) | home | NEAR-CRITICAL | Latest-story cards directly under the hero |
| `blog-index-page-1.json` preload (2.5 KB) | archive | NEAR-CRITICAL | Archive runtime state |
| `standings.min.js` + 3 chunk modulepreloads (18 KB) and `standings-cache.json` preload (2.6 KB) | standings | CRITICAL | They render the drivers table, the page's primary content |
| `logo-nav.webp` (2.8 KB, `fetchpriority=high`) | all | NEAR-CRITICAL | First-viewport brand; too small to matter for contention |
| `ibm-plex-sans` latin (39.5 KB) + arrows (3.5 KB), found through CSS | all | NEAR-CRITICAL, not preloaded | Preloading 39.5 KB would compete with the LCP image on phones. Text LCPs don't wait on it (`swap`) |
| Deferred scripts (analytics, web-vitals, cookie-consent, shared-nav, sw-register, page scripts) | all | DEFERABLE (already `defer`, low priority) | |
| `dns-prefetch` to jolpi.ca / openf1.org | standings | NEAR-CRITICAL, cheap | The live refresh follows first paint |
| Archive `1-card.webp` preload (7.5 KB) | archive | **UNNECESSARY → fixed** | Change 2 |

**Preload contention.**
- The most any route preloads is on standings: 4 module scripts, 1 JSON and 2 fonts, all on the table's render path.
- Every image preload now matches its element exactly. Nothing is preloaded "because it's important eventually".
- The only candidate I considered adding, Plex latin, was rejected for contention.

## Images

**Question:** is the browser downloading significantly more pixels or bytes than the rendered size needs? Checked at 390, 768 and 1440 on home, article, standings and archive, plus `sizesweep.mjs` across 18 widths from 320 to 1920.

- **Candidate ladders.** Cards ship 400w / 800w / 1600w (full). Article heroes ship 800w (`-mobile`) / 1600w in AVIF and WebP.
- **Home secondary stories** (104×104 cover squares on phones). `sizes` is already cover-aware (`185px` = 104 × 16/9). At DPR 3 the need is 555 px, so the 800w file is the smallest candidate that satisfies it. The ratio is 1.44 linear, which is ladder granularity, not waste.
- **Home lead card at 768.** The rendered box is 400×300 with `object-fit: cover` over a 2.2:1 image, so it needs about 1324 device px of width. The 1170 px full file is actually slightly under, not over. The linear "1.46×" reading was a false positive once cover is accounted for.
- **`sizes` mismatches.**
  - *Over-estimates:* home lead at 1024–1280, related cards on desktop, article hero above 1199. At every one of these widths the browser picks the same file an exact `sizes` would pick. No change.
  - *Under-estimates:* article hero at 1024–1100 (770 vs 896–972 px) and the home hero at 768–900. The home hero has a single source, so `sizes` doesn't apply. The article case would only raise bytes, on DPR-1 laptops. Not changed (quality, not payload).
- **AVIF/WebP.** Article heroes and the home hero ship AVIF with WebP fallback. Cards and thumbnails are WebP only. AVIF cards would need a new variant pipeline plus a quality review; not done.
- **Dimensions.** Every audited `<img>` carries `width`/`height`, and CLS from images is 0 on every surface.
- **Below-the-fold lazy loading.** Images are `loading="lazy"` everywhere except the LCP candidates and the nav logo.

## CSS and JS scoping

CSS coverage is the union of 390 and 1440 after a full scroll. It misses theme, menu and filter states, so it **undercounts** use.

| File | Home | Article | Standings | Archive |
|---|---|---|---|---|
| `styles.min.css` (33.9 KB raw, 7.5 KB gzip) | 42% used | 28% | 16% | 28% |
| `bootstrap.slim.min.css` (12.8 KB raw) | 52% | 49% | 49% | 53% |
| `editorial.min.css` (21.2 KB raw) | 65% | 64% | 55% | 63% |
| Route editorial CSS | home 75% | article-editorial 46%, article-styles 44% | standings-editorial 50% | archive-editorial 66% |
| `blog-styles.min.css` (40.8 KB raw) | n/a | n/a | n/a | 35% |

- **Decision: no split.** The biggest possible win is about 4–6 KB gzipped per route (the unused part of `styles.min.css`, or `blog-styles` on the archive). On Slow 4G that's about 25 ms of render-blocking transfer. Getting it means carving shared CSS into route files, with a known risk of dropping state-only rules (P2-03 hit exactly that), or duplicating shared rules. The brief rules out duplicating substantial shared code for small bytes.
- **Candidate for a later, gated pass:** `blog-styles.min.css` on the archive (26 KB raw unused), with a static class-vocabulary check.
- **JS.** Every route's JS is 20–29 KB gzipped, all `defer` or module, and nothing runs before first paint except the 0.5 KB `theme-init`. No route loads another surface's code. Standings' tab modules are already split and dynamically imported. TBT is 0 on every surface.

## Fonts

- **Bytes.** 73.8 KB of fonts on every public surface: Barlow Condensed 700 (latin) and IBM Plex Sans 400–600 in greek, latin, latin-ext (unused on these pages) and arrows subsets.
- **Axes.** The Plex files are Google's variable subsets, already instanced to `wght` 400–600 with no `wdth` axis (`download-home-fonts.mjs`). Subsetting further by glyph isn't safe for arbitrary article text.
- **Loading.** `font-display: swap` everywhere, and two preloads (see the classification table). Change 1 made fonts start about 320 ms earlier on phones.
- **Font-swap CLS.** See *Open issues*.

## Service worker

The service worker **was not changed**. Measured with `swprobe.mjs` (ETag/304 server, HTTP cache expired to show the worst case):
- **First visit.** Install precaches the shell plus the 10 most recent articles: about 470 KB after `load` on top of the page (842 KB total for a first home visit). It is registered on `load`, so it doesn't compete with the critical path, and it is the offline guarantee.
- **Returning visit.** A page sends 20–37 background conditional requests. All are 304s with no body, and none block rendering, because the cached copy is served first.
- **Rejected: cache-first without revalidation for `?v=` assets.** It would save those 304s. But GitHub Pages ETags are `mtime-size` (for example `"6ab578b2-87c6"` on `styles.min.css`), and during a deploy a new-hash URL could briefly return old content from an edge that hasn't updated. Without revalidation, that stale entry would stay until the next SW version. The brief says stale content is a worse regression than a small performance gain, so it was not done.
- **What this pass did change for caching:** the Bootstrap hash fix (change 3) removes one duplicate cache entry and restores cache busting on articles.

## Third-party embeds

- There are no third-party requests before LCP on any surface. Lighthouse counts one third-party request, the live Jolpica call after first paint.
- YouTube, social and video embeds use the P0-03 facades and lazy loading, which were not changed.
- Analytics loads only after consent.

## Rejected or not done

| Idea | Evidence | Verdict |
|---|---|---|
| Keep `theme-init` in place and only defer `error-beacon` (E1) | About half of E2's gain | Superseded by E2 |
| Remove the article hero preload | Latest article (14 KB hero): LCP 1172 → 972 ms. A p90 hero (20260824J) became visible about 250 ms **later** | Rejected; heroes are usually heavy |
| Remove the archive image preload | Best for light leads (LCP 992 ms); about 205 ms later visibility for heavy leads | Rejected in favour of the matching preload |
| Tighten `sizes` (home lead `55vw`, secondary `400px`, related `390px`, article hero `770px`) | The browser picks the same candidate at every swept width | No byte change; not done |
| Barlow preload on articles | Only the nav wordmark and footer use it | Not justified |
| Preload Plex latin (39.5 KB) | Would compete with the LCP image on phones; text LCPs use `swap` | Not done |
| Plex re-subsetting or instancing | Already Google's `wght`-only subsets; glyph subsetting is unsafe for article text | Not done |
| Split `styles.min.css` or `blog-styles.min.css` per route | 4–6 KB gzip per route; state-only-rule risk | Not done (see scoping) |
| SW cache-first without revalidation for hashed assets | Saves bodiless 304s only; staleness risk during deploys | Rejected |
| Inline `theme-init` | CSP is `script-src 'self'` with no hashes; inlining needs a CSP hash in both the meta tag and `_headers` | Not needed; E2 gets the gain without touching the CSP |

## Follow-ups (owner decisions, 2026-09-25)

### F1. Standings `stale` label shortened (`standings/standings.js`)

- **Change.** `Στιγμιότυπο 23 Σεπ · χωρίς live` → `Χωρίς live · 23 Σεπ`. It still states both facts: no live data, and the snapshot's date.
- **Why it works.** Measured with `bandfit.mjs` against the worst-case date width (`28 Ιουλ`):
  - The new label is 5 px **narrower** than the snapshot label it replaces (107 vs 112 px), so the band keeps its line count at every width.
  - Both labels fit on one line at 360, 390 and 414 px. Both take two lines at 320 px, as the live label always did.
  - The old label wrapped at 360 and 390 px.
- **Result.** With the live refresh failing (third parties blocked), standings mobile CLS is **0.148 → 0.000** (5 of 5 reps).
- A code comment now records the rule: the `stale` label must be no wider than the snapshot label.

### F2. Home tablet shift: the real cause was `ch` units (`home.css`, `styles/editorial.css`, `archive-editorial.css`)

**Correction.** Earlier in this report I attributed the 0.034 home-tablet shift to Barlow arriving late. That was wrong.

**Diagnosis.**
- `framewatch.mjs` sampled layout every frame under tablet throttling. `h1#hero-title` goes 2 → 3 lines (106 → 159 px) when the **Greek** Plex subset arrives, and back to 2 lines when the **Latin** subset arrives, about 500 ms later. The second step is the 0.034 shift.
- The headline's box was **461 px** wide between those two arrivals and **553 px** once the Latin subset landed.
- 461/553 = 0.833 = 0.5/0.6. The hero rule at 768–991 px is `max-width: 20ch`. `ch` is measured from the primary font's "0", which lives in the **Latin** subset. With only the Greek subset loaded, `1ch` falls back to 0.5em; once Latin lands it becomes Plex's 0.6em. This is the same trap P1 fixed elsewhere.

**Fix, part 1: `ch` → `em`.** All 12 remaining `ch` widths on Plex text were converted with Plex's "0" = 0.6em. The final layout is identical by construction (viewport parity 0.000%), and the widths no longer depend on font loading:
- `home.css`: 9 values, including the hero title's `20ch` → `12em` and the hero description's `60ch` → `36em`.
- `editorial.css`: the footer paragraph.
- `archive-editorial.css`: 2 masthead notes.

**Fix, part 2: metric-matched fallback faces, as recommended.**
- **Before:** the existing `'IBM Plex Sans Fallback'` covered spaces and digits only.
- **After:** it has complete sets per weight bucket. Browsers pick a face by weight before `unicode-range`, so each bucket needs all four ranges (space, digits, Latin letters and punctuation, Greek).
  - 400 and 500 use local Arial; 600+ uses local Arial Bold.
  - Each `size-adjust` is Plex's advance width divided by the local font's, measured in the browser on the site's own article titles and excerpts (13.9k Latin and 60.3k Greek characters).
  - The method reproduces the existing hand-set values: space 84.94%, digits 107.88% (107.89% before).
- The faces only affect rendering before the Plex subsets arrive.

**Evidence** (`phasecheck.mjs`: 5 routes × 390/768/1440; each loading phase forced by holding back font files; text blocks whose height differs from the final layout):

| Build | All-fallback phase | Greek-loaded, Latin-pending phase |
|---|---|---|
| Baseline | 15 blocks | 6 blocks (including the home-768 headline) |
| Fallback faces only | 5 | 6 |
| **Fallback faces + `ch` → `em` (final)** | **5** | **3** |

- **Real throttled loads** (5 reps each): home tablet CLS **0.034 → 0.000** (5 of 5; before it was bimodal). CLS is 0 on every other surface, except the pre-existing desktop standings 0.009 and article 0.002.
- **The remaining 5 all-fallback mismatches** are the home-390 headline (the Greek subset reaches phones before first paint in 5 of 5 frame watches, so it isn't visible), two article paragraphs, and the standings Barlow masthead. The masthead is Barlow's own swap: this test withholds Barlow in both phases, whereas in real loads it is preloaded.
- **Without the Greek faces** the all-fallback phase had 14 mismatches, so the Greek faces are kept.
- **Ceiling.** The faces use local Arial/Helvetica, so the matching applies on macOS, iOS and Windows. Android has no local Arial; there, text before the fonts load keeps using the system sans, as before.

### F3. Article asset hashes restamp on every build (`scripts/build/stamp-html.mjs`)

- `stampArticleRuntimeScripts()` now runs on all articles by default. It only rewrites files whose hashes changed.
- The `migrationOnly` gate, `needsArticleRuntimeMigration()` and the `--stamp-articles` flag are gone.
- `styles/vendor/bootstrap.slim.css` joined `ARTICLE_RUNTIME_SOURCES`, which replaces the Bootstrap-only regex from change 3. There is now one mechanism for all of them.
- `README.md` and `docs/css-architecture.md` are updated.
- **Consequence:** a change to a shared stylesheet or script rewrites the `?v=` in every article that references it, in the same build (and therefore in the blog auto-build's commit).
- **Checks:**
  - Planting stale hashes for Bootstrap, `article-styles` and `shared-nav` in one article: the next stamp repaired all 3.
  - A corpus scan (`hashcheck.mjs`) finds **7,120 stamped article refs, 0 stale, 0 unmapped**.

## Open issues (owner decisions)

Issues 1, 2 and 4 below were resolved by the follow-ups above. They are kept for the record.

1. **Standings CLS when the live refresh fails (0.148 at 390).** If Jolpica is unreachable, the data-status label becomes `Στιγμιότυπο 23 Σεπ · χωρίς live`. That wraps the timing band onto a second line and pushes the round badge and reports down 22 px, about 4.9 s after load. On the normal live path it is 0.0003. It occurs only during API outages, but real visitors would see it then. Fixing it means either shortening the `stale` label or reserving the band's second line: copy or layout, so it's your call. Neither is done.
2. **Home tablet font-swap CLS (0.034, bimodal).** When Barlow arrives after first paint at 768, the hero headline re-wraps and the content below moves up 53 px. Change 1 made it rarer but didn't remove it. The root fix is a metric-matched fallback `@font-face` (`size-adjust`, `ascent-override`). A condensed face has no dependable local equivalent across platforms, and the fallback rendering itself would change, so it needs a design decision.
3. **LCP reporting under entrance fades.**
   - The article hero picture fades in (0.8 s, 0.12 s delay), so article LCP is about FCP + 300 ms even when the image arrived earlier.
   - The archive lead card fades in (0.6 s). When its image is already there at first paint, Chrome records LCP about 200 ms later than when the image arrives mid-fade, although the pixels on screen are the same (filmstrip). The archive "after" figure (1164 ms) includes this.
   - Field LCP will show the same effect. The fades are design and were kept.
4. **Article asset hashes only refresh with `--stamp-articles`.** Change 3 fixes this for Bootstrap by construction. Any other shared asset referenced by articles (`article-styles`, `shared-nav`, scripts) still keeps a stale `?v=` after a change until someone runs `node scripts/build/stamp-html.mjs --stamp-articles`. A full dry-run restamp shows **0 stale references today**. Options: make the restamp the default (it only rewrites files whose hashes changed), or add a drift check.
5. **Pre-existing verify failures (unchanged):** see *Verification*.

## Verification

**Checks on the final `dist/`.**
- **Theme before first paint:** `themeflash.mjs` passes 44/44.
- **Pixel parity:** `parity.mjs`, viewport captures settled with fonts ready (the nav clock masked, reduced motion). 5 routes (home, latest article, standings, archive, gallery article 20260422G) × 390/768/1440 × dark/light: **30/30 at 0.000%**, with base-vs-base noise at 0.000%.
- **Hero sync:** `herosync.mjs` passes 6/6.
- **Service worker:** `swprobe.mjs` gives the same request counts before and after, and Bootstrap now revalidates (304) between home and articles.

**`npm run verify`** stops at `build:check`, as in step 3, because the regenerated artifacts (articles, shells, goldens) aren't committed. That check passes once they are. Every later step was run individually:

| Step | Result |
|---|---|
| `build:public` | ✅ 2,974 files, validated |
| `build:check` | ❌ expected: uncommitted regenerated artifacts |
| `quality:static` | ✅ |
| `audit:runtime` | ✅ |
| `test:blog` | ✅ (goldens regenerated; the diff is the head-script order, the step 3 `article-styles` hash, and the `editorial.min.css` hash from F2) |
| `test:author` | ✅ |
| `test:standings` | ✅ |
| `test:build` | ✅ |
| `perf:budget` | ✅ |
| `perf:article-media` | ❌ pre-existing: `20260918W/1.webp` (1.22 MB) and `9.webp` (1.27 MB) exceed the 1 MB single-file limit |
| `perf:images` | ✅ |
| `test:consent` | ✅ |
| `qa:visual` | ✅ |
| `perf:lighthouse` | ❌ pre-existing. **Step 4 run:** accessibility only, Home 96 and Article 95 (the same scores step 3 recorded). **Re-run after the follow-ups:** Article a11y 90 (`aria-hidden-focus` on the mini-bar, plus `color-contrast` on `.author-title`) and Article simulated LCP 2555 ms, over the 2,500 ms budget. The **baseline dist gives the identical result** (a11y 90 with the same two audits; LCP 2403 / 2404 / 2558 across 3 runs), so both are pre-existing and timing-dependent, not caused by this pass |

## Files changed in this pass

**Sources**
- `partials/head-meta.html`: `error-beacon` is `defer`; `theme-init` moves to the stamp step.
- `scripts/build/stamp-html.mjs`: `placeHeadScripts()` and the Bootstrap hash normalization.
- `blog-module/build/index.js`: the archive lead preload mirrors the lead card's `srcset`/`sizes`.
- `blog-module/blog-loader.js`: hero sync writes only real changes.
- `standings/standings.js`: shorter `stale` label (F1).
- `home.css`, `styles/editorial.css`, `blog-module/blog/archive-editorial.css`: `ch` → `em`, and the metric-matched fallback faces (F2).
- `scripts/build/stamp-html.mjs`, `README.md`, `docs/css-architecture.md`: automatic article restamp (F3).

**Regenerated artifacts:** 12 of the 14 stamped shell pages (the ghostcar and f1telemetry redirect stubs are unchanged), including `blog-module/blog/index.html` and `template.html`, all 356 `article.html` (head order and Bootstrap hash), the 5 golden snapshots, and the min files.

Nothing was committed or deployed.
