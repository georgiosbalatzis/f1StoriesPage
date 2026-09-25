# F1 Stories — Performance Audit (baseline)

- **Date:** 2026-09-23
- **Branch / HEAD:** `perf/perf-boost` @ `31da7877c41168c8d99e1e62aae423d24dfd2ba0`
- **Scope:** measurement only. No production code, budgets or guards were changed.
- **Where things ran:** a detached git worktree in the session scratchpad. `npm ci`, `build:public` and all guards ran there, so this working tree was untouched. The only files added here are this one and `PERFORMANCE_TASKS.md`.

Tasks derived from this audit are in `PERFORMANCE_TASKS.md`.

---

## 1. Summary

Overall the site is already lean:
- tiny JS
- no main-thread long tasks worth mentioning (TBT 0–88 ms everywhere)
- smooth scrolling on every route
- fast interactions (worst event ~48 ms at 4× CPU)
- small HTML
- cheap standings rendering

What hurts the real experience is a small number of pathological bugs. They mostly affect **article pages**, the most-visited surface.

1. **Every article shifts its whole body on load (CLS 0.08–0.37).** `article-editorial.css` sets `aspect-ratio: auto` on the hero `<img>`. That cancels the ratio the browser derives from `width`/`height`, so the hero is 0px tall until it decodes, then jumps (e.g. to 810px).
2. **Every article downloads its hero twice.** The preload asks for the WebP `srcset`, but `<picture>` picks the AVIF. On a 390px/3× phone that is 297 KB of WebP competing with the 143 KB AVIF. Result: mobile LCP 3.0 s, versus 1.2 s on home.
3. **Embed articles pull 4.7 MB of third-party content at load.** Measured on production (Lighthouse mobile): Instagram 1.9 MB, Sketchfab 1.6 MB, YouTube 1.0 MB. LCP 35 s simulated, performance score 54.
4. **The service worker serves old CSS/JS after a deploy, indefinitely.** Proven with a simulated deploy (§9). This affects every client the SW controls.
5. **Standings shifts 0.24–0.46 on slow mobile.** The summary cards are injected above the table after the data arrives, and the Greek title re-wraps when the Latin font subset (which holds the spaces) arrives.

Beyond those, the render path carries 142–214 KB raw (29–43 KB gzip) of blocking CSS. 50–64% of it is unused per route. Several image assets are much larger than their rendered size.

---

## 2. Baseline commands

All run in the scratch worktree at HEAD.

| Command | Result | Notes |
|---|---|---|
| `git status --short` | clean | the only untracked file in this tree was `.claude/`, created for the user's allowlist |
| `npm ci` | ok | 2.9 s |
| `npm run build:public` | **pass** (2 min) | 2,793 files, 171.9 MB in `dist/`; 104 article images re-encoded. It **rewrites 357 tracked files**: committed `article.html` and `template.html` still reference `article-script.min.js?v=f007dada`, and the rebuild stamps `?v=367c0e4b`. Production already serves `367c0e4b`, so this is repo drift, not a stale deploy. |
| `npm run perf:budget` | **FAIL** | 4 files over +10%: `scripts/shared-nav.js` +12.5%, `shared-nav.min.js` +11.5%, `blog-module/blog-loader.js` +11.6%, `scripts/build/fetch-youtube.mjs` +18.1%. Because of this, the standings ESM chunk-graph check never ran. |
| `npm run perf:article-media` | **FAIL** | totalFiles 3,717 vs budget 2,166; totalBytes 259 MB vs 202 MB; `20260918W/1.webp` (1.22 MB) and `20260918W/9.webp` (1.27 MB) exceed the 1 MB single-file limit. |
| `npm run perf:images` | pass | no public image >300 KB (`public-artifact.mjs` re-encodes oversized ones) |
| `npm run qa:visual` | pass | 10 routes × 4 viewports × 2 themes = 80 captures, 0 issues |
| `npm run perf:lighthouse` | **FAIL** | Home 87 (LCP 3,608 ms); Blog 83 (LCP 3,903 ms); Standings 74 (LCP 3,606 ms, **CLS 0.240**). The JS/CSS byte budgets report **0 B** on every route, so they are never enforced (guard bug, §12). |
| `npm run verify` | **FAIL at `build:check`** | Drift from `build:public` (above). Later steps were run individually. |
| ↳ `quality:static` | pass | `!important` 79/100 |
| ↳ `audit:runtime` | pass | |
| ↳ `test:blog` | **FAIL** | taxonomy 22/22 pass; golden fixtures 20260415, 20260416G, 20260422G, 20260610-2J and 20260610W mismatch (already failing at HEAD) |
| ↳ `test:author` | pass | 8/8 |
| ↳ `test:standings` | pass | 3/3 |
| ↳ `test:consent` | pass | |

**The baseline is red before any optimisation.** Tasks PERF-P2-07 and PERF-P2-08 restore a trustworthy gate. No budget was updated to hide these failures.

---

## 3. Method

### Existing infrastructure

What the repo already measures:
- Lighthouse mobile with simulated throttling, 3 routes, 1 run each.
- Byte sizes, raw only.
- Media inventory.
- Visual/a11y smoke QA (no timings).
- Consent behaviour.
- RUM beacon, consented users only. Its INP is the max event duration and its CLS a plain sum, not session windows.

What it does **not** measure:
- lab INP or interactions
- long tasks / LoAF
- CLS on articles
- compressed sizes (the Lighthouse server serves no gzip)
- warm-cache or service-worker behaviour
- per-route image/font weight

### Harness added for this audit

All probe scripts live in the scratchpad and are not committed:

| Script | What it does |
|---|---|
| `probe.mjs` | Playwright + system Chrome. Serves `dist/` like GitHub Pages: gzip, `cache-control: max-age=600`, 404 page. Per page × profile it records FCP, LCP (element, URL), all layout shifts with sources, long tasks, LoAF with script attribution, Event Timing for interactions (menu, theme toggle), rAF frame intervals during a scripted wheel scroll, CDP layout/style counts, heap, DOM size/depth, every resource (bytes, render-blocking status), image natural vs rendered size, iframes, third-party origins, console errors. It also does a warm reload. |
| `clsdebug.mjs` | Frame-by-frame geometry log, used to find CLS root causes. |
| `scrolltrace.mjs` | CDP trace of Layout/Paint/Raster/Script during a scroll, dark vs light theme. |
| `coverage.mjs` | CSS/JS coverage per route: union of 390/1440 × dark/light, after scroll and menu open. |
| `swtest.mjs` | Service-worker stale-asset experiment (simulated deploy on the scratch `dist/`). |
| Lighthouse 12 on production | `https://f1stories.gr`: mobile ×6 URLs, desktop home. |

**Profiles:**

| Profile | Viewport | DPR | CPU | Network |
|---|---|---|---|---|
| m390 | 390×844 | 3 | 4× slowdown | Slow 4G (150 ms, 1.6 Mbps) |
| m320 | 320×640 | 2 | 4× slowdown | Slow 4G |
| t768 | 768×1024 | 2 | 2× slowdown | 4G (60 ms, 9 Mbps) |
| d1440 | 1440×900 | 1 | none | none |

**Pages profiled (14):**

| Page | Path |
|---|---|
| Home | `/` |
| Archive | `/blog-module/blog/` |
| Article, normal | `20260923` |
| Article, long | `20250303G` (262 KB HTML) |
| Article, image-heavy | `20260918W` |
| Article, carousel | `20260415` (30 `<img>`) |
| Article, embeds | `20260422G` (YouTube + Sketchfab + Instagram + Threads) |
| Standings | `/standings/` |
| Standings data tab | `?tab=dirty-air` |
| Standings data tab | `?tab=debrief` |
| Authors | `/authors/` |
| Author tool | `/generate.html` |
| Author tool | `/housekeeping.html` |
| 404 | |

**Caveats:**
- **Spurious `hadRecentInput`.** In Chrome's mobile emulation, early layout shifts are flagged `hadRecentInput=true` even though no input happened. CLS below therefore counts **all** shifts (web-vitals session-window rule). Lighthouse's own Standings CLS of 0.240 confirms these shifts are real.
- **Rendering.** Headless Chrome uses software raster, so absolute paint costs are indicative only; frame pacing is still meaningful.
- **Network throttling.** CDP adds latency per request, not per round trip.
- **Production Lighthouse.** One run per URL, with no stored consent: first-visit conditions, so the cookie banner is shown.

---

## 4. Core metrics

### Lab probe, gzip, cold cache

m390 values are medians of 4 runs for home, article and standings; everything else is 1 run.

| Page | m390 FCP | m390 LCP | m390 CLS | t768 LCP | t768 CLS | d1440 CLS | LCP element (m390) |
|---|---:|---:|---:|---:|---:|---:|---|
| Home | 1,232 | **1,232** | 0.025 | 456 | 0.001 | 0.014 | `img#hero-image` (AVIF, 14 KB) |
| Archive | 1,280 | 1,492 | 0.001 | 544 | 0.001 | 0.020 | first card image |
| Article normal | 1,252 | **3,024** | 0.077 | 784 | **0.162** | 0.007 | `img.article-header-img` |
| Article long | 1,340 | 2,380 | **0.207** | 716 | **0.356** | 0.034 | hero |
| Article image-heavy | 1,252 | 2,196 | 0.091 | 616 | 0.176 | 0.008 | hero |
| Article carousel | 1,228 | 1,968 | **0.206** | 604 | **0.367** | 0.089 | hero |
| Article embeds | 1,388 | **3,556** | 0.117 | 796 | 0.181 | 0.000 | hero |
| Standings | 1,228 | 1,228 | **0.458** | 476 | 0.055 | 0.026 | `.standings-title-display` |
| Standings dirty-air | 1,284 | 1,368 | **0.219** | 460 | 0.006 | 0.008 | tab copy |
| Standings debrief | 1,300 | 1,580 | 0.050 | 460 | 0.045 | 0.009 | tab copy |
| Authors | 1,060 | 1,060 | 0.016 | 408 | 0 | 0.004 | `h1` |
| Generate (tool) | 1,928 | 1,928 | **0.564** | 684 | **0.690** | 0.003 | lede |
| Housekeeping (tool) | 1,824 | 2,640 | 0.137 | 884 | 0.054 | 0.133 | lane text |
| 404 | 804 | 804 | 0.016 | 324 | 0 | 0.002 | message |

At 320px (DPR 2):

| Page | LCP (ms) | CLS |
|---|---:|---:|
| Home | 1,212 | 0.001 |
| Article | 1,996 | 0.044 |
| Standings | 1,192 | 0.097 |

Desktop FCP/LCP on localhost is 32–108 ms, so desktop is network-bound; see production.

- **TBT:** 0 ms everywhere except the long article (42 ms; one 92 ms task at 2.27 s).
- **Main-thread cost:** under 4× CPU, the largest main-thread frame at load was about 1.0–1.2 s. It was style/layout of the initial render with no script attribution; scripts contributed ≤39 ms per frame.

### Production Lighthouse, mobile Slow 4G simulated, first visit

| URL | Perf | FCP | LCP | TBT | CLS | LCP element |
|---|---:|---:|---:|---:|---:|---|
| `/` | 94 | 1,717 | 2,865 | 55 | 0.000 | hero `img` |
| `/blog-module/blog/` | 93 | 1,474 | 2,678 | 47 | 0.000 | `h1` |
| article `20260923` | **74** | 1,614 | **5,864** | 32 | **0.091** | **cookie-consent `<p>`** (render delay 5.2 s) |
| article `20250303G` (long) | **75** | 1,798 | **4,078** | 88 | **0.168** | **cookie-consent `<p>`** |
| article `20260422G` (embeds) | **54** | – | **35,212** | 0 | 0.082 | 4.7 MB of third-party content saturates the link |
| `/standings/` | 95 | 1,574 | 2,679 | 42 | 0.000 | title |
| `/` desktop | 100 | 315 | 375 | 0 | 0.013 | hero `img` |

In production, standings CLS is 0 because the snapshot arrived before first paint. The shift only happens when the data lands after first paint; see §7.

### Warm cache

A reload within 10 minutes: every asset comes from the HTTP cache (0 bytes transferred), with FCP 28–208 ms on every route.

After 10 minutes, GitHub Pages' `max-age=600` forces revalidation of every asset. Only clients the service worker controls avoid that (§9).

### Interactions and scrolling (m390, 4× CPU)

**Interactions:**
- Menu open: 32–40 ms. Nearly all of it is presentation delay; processing is under 1 ms.
- Theme toggle: 16–48 ms.
- No interaction exceeded 50 ms, so INP is comfortably under 200 ms.

**Scrolling** (every page, both themes, 390 and 1440):
- frame p95 16.7–16.8 ms
- 0 frames over 50 ms
- 0 LoAF during scroll

The light-mode fixed noise overlay (`editorial.css:98`) showed no frame cost. `scrolltrace` ranges across home, article, archive and standings:

| Metric (during a ~6,000 px scroll) | Dark | Light |
|---|---:|---:|
| Style recalc | 11–59 ms | 11–65 ms |
| Paint | 17–61 ms | 19–55 ms |
| Frames over 33 ms | 0 | 0–2 |

The archive's unthrottled scroll handler forces **124 layouts over a 5,846px scroll** at 390px, about 0.4 ms each. It is measurable but not jank.

---

## 5. Critical render path per surface

gzip at level 9; brotli in parentheses.

| Route | HTML raw / gz | Inline sprite | Blocking CSS files, raw / gz | CSS unused (coverage) | JS files, raw / gz | Sync head JS | Preloads |
|---|---|---|---|---|---|---|---|
| Home | 68 KB / 19.8 KB | 32 KB (11.4 KB gz) | 6 files, 142 KB / 28.7 KB (24.2) | 50% | 9 files, 54 KB / 19 KB | error-beacon, theme-init | hero AVIF, `home-latest.json`, 2 fonts |
| Archive | 77 KB / 19.4 KB | same | 7 files, 177 KB / 35 KB (29.7) | 58% | 9 files, 55 KB / 19.6 KB | same | `page-1.json`, `1-card.webp` (400w), 2 fonts |
| Article | 76 KB / 21.5 KB (long: 264 KB / 66 KB) | same | 9 files, 214 KB / 42.8 KB (36.6) | **64%** | 10 files, 48 KB / 17.6 KB | same | **Didot font (unused)**, Plex Greek, **hero WebP srcset (wrong format)** |
| Standings | 72 KB / 18.5 KB | same | 9 files, 191 KB / 39.5 KB | 59% | 8 files, 67 KB / 21 KB | same (+ a nomodule `standings-nomodule.min.js` that 404s) | modulepreload shell, snapshot JSON, 2 fonts |
| Authors | 56 KB / 16.4 KB | same | 5 files, 77 KB / 17 KB | 56% | 7 files, 30 KB / 11 KB | same | 2 fonts |
| Generate | 66 KB / 19.9 KB | same | 11 files, 259 KB / 49.8 KB + 11.4 KB inline | – | 11 files, 230 KB / 65 KB | + 4 author scripts | 2 fonts |
| Housekeeping | 60 KB / 18.6 KB | same | 9 files, 200 KB / 37.7 KB + 11.4 KB inline | – | 12 files, 240 KB / 67 KB | + 4 author scripts | 2 fonts |
| 404 | 6.8 KB / 2.6 KB | – | 1 file, 1.5 KB | – | 2 files, 2 KB | same | 2 fonts |

### Timeline, article on m390

| Time | What happens |
|---|---|
| 0–490 ms | HTML arrives |
| ~490 ms | Preload scanner starts the Didot font (wasted), Plex Greek, the **hero WebP 1600w (297 KB)**, the AVIF (143 KB) and 9 stylesheets, all at once on a 1.6 Mbps link |
| ~1,240 ms | **FCP**, once all CSS has arrived. At that moment the hero box has **0 height** and the body is painted in its place. |
| ~1,240–3,000 ms | The AVIF competes with the redundant WebP |
| ~3,000 ms | **LCP**, with a +810px layout shift at hero decode |
| ~2,200 ms | The Latin font subset (spaces, digits, punctuation) arrives. It was not preloaded; it was discovered at style time (~1,120 ms). The Greek headline re-wraps, giving a second shift (0.048 on the long article). |
| After DOMContentLoaded | `article-script` runs, 23 ms in its largest task. |
| After idle | Consent banner after a 3.6 s timer (first visit), then `web-vitals` and analytics only after consent. |

On the home page, FCP and LCP coincide at ~1.2 s. The hero is a 14 KB AVIF preloaded at high priority. The LCP breakdown on production mobile:

| Phase | Time |
|---|---:|
| TTFB | 253 ms |
| Load delay | 376 ms |
| Load time | 290 ms |
| Render delay | 434 ms |

Render delay is dominated by blocking CSS.

---

## 6. JavaScript audit

JS is small (17–21 KB gzip per public route) and cheap: TBT ≈ 0, and no forced synchronous layouts attributed to scripts above 14 ms. Findings, with estimated impact:

| Finding | Evidence | Impact |
|---|---|---|
| **Social SDKs** (X, Instagram, Threads, Facebook) load at `DOMContentLoaded`, regardless of position | `article-script.js:250-300`, called at `:642` | Very high on the 8 embed articles (MBs of third-party; §8) |
| **Internal-link click interception** calls `preventDefault()` and waits up to 250 ms for the gtag callback before `location.assign` (consented users) | `analytics.js:13,155-189` | High for consented users: up to 250 ms added to every internal navigation. Without consent it still parses consent JSON on every click. |
| Reading-progress bar animates `style.width` each scroll frame (`will-change: width` is useless) | `shared-nav.js:196-200`, `blog-styles.css:1426-1432` | Low: one layout per frame, no jank measured |
| `measureArticle()` forces layout at script start (`offsetHeight` + `getBoundingClientRect`) | `shared-nav.js:172-183` | Low: one forced layout, ≤14 ms (LoAF) |
| Unthrottled scroll/resize handlers in the article mini-bar and archive | `article-script.js:180-190`, `blog-index.js:894-895` | Low: 124 layouts per archive scroll, ~0.4 ms each |
| `--vh` custom property set on every resize; **no CSS uses it** | `blog-fixes.js:173-178` | Low, but pure waste: a full style recalc on each mobile URL-bar move |
| Home hero re-rendered by JS after load (`renderHeroLead` → `syncHeroMedia` rewrites `src`, strips `srcset`) | `blog-loader.js:32-60, 261-288` | Measured: no extra LCP candidate and no refetch. Leave it. |
| Dead scripts shipped (`hero-background-init`, `background-randomizer`) plus 2.4 MB of `images/bg` | not referenced by any HTML | Deploy size only |
| Author tools: `generate-page.js` (86 KB) and `housekeeping-page.js` (89 KB) unminified; JSZip (97 KB) loaded on every open; 4 sync head scripts | `generate.html:29-32` | Author-only; FCP 1.8–1.9 s on m390 |

Initialisation, observers, polling and JSON parsing:
- No duplicate initialisation or `setInterval` polling was found.
- Observers are IntersectionObserver and ResizeObserver, and they unobserve correctly.
- JSON parsing is small, except the dirty-air tab (§10).

## 7. Layout shift root causes

| Surface | Shift | Root cause (verified frame by frame) | File |
|---|---|---|---|
| **All articles** | 0.08–0.37, deterministic, cold and warm | `.article-page .article-header-img { aspect-ratio: auto; }` cancels the `auto 1920/1080` ratio the browser derives from `width`/`height`. At first paint `picture` = 0px, then 810px at decode. | `blog-module/blog/article-editorial.css:181` and `:626` |
| Articles (header) | 0.045–0.048 | The Greek headline re-wraps when the Latin subset (U+0000-00FF: spaces, punctuation) arrives about 1 s after first paint | `styles/home-fonts.css` (unicode-range split), no preload |
| **Standings** | 0.15 + 0.11 + 0.12 (m390) | `#drivers-summary-row` is empty in the HTML. `standings-polish.js` injects summary cards (+151px at 390) above the table after the snapshot loads. The skeleton height also differs from the final table. | `standings/index.html:242`, `standings/standings-polish.js:5,56,97` |
| Standings (title) | 0.041 (0.194 at 107 ms unthrottled) | `.standings-title-greek` wraps to 2 lines (47px) before the Latin subset arrives, then 1 line (23px) | same font cause |
| Generate (tool) | 0.56–0.69 | Wizard stage and fields reflow at about 2.4 s (`gb-stage`, `gb-field`, progress bar) | `generate.html`, `styles/author/generate.css` |
| Housekeeping (tool) | 0.13 | `section.hk-work` moves after `blog-index-data.json` loads | `housekeeping-page.js` |
| Home | 0.014–0.025 | Small text nudges (hero period glyph / font) | – |

## 8. Third parties

| Third party | When it loads | Cost | Facade | Consent |
|---|---|---|---|---|
| GA4 / gtag | after opt-in only (consent-guard passes) | – | n/a | ok |
| YouTube in 9 iframes / 8 articles | **eager**: no `loading="lazy"`, `youtube.com` (not nocookie) | ~1.0 MB per article at load; pulls doubleclick/googleads **before consent** | no (the home video has one, in `f1-optimized.js:574`) | ⚠ ad/tracking origins contacted with no consent |
| Sketchfab (2 articles) | eager | 1.6 MB | no | – |
| Instagram, Threads, X, FB SDKs (8 articles) | eager at `DOMContentLoaded` | Instagram 1.9 MB, Threads 46 KB | n/a | – |
| Own tools (ghostcar/telemetry iframes) | `loading="lazy"` | – | – | ok |
| `api.jolpi.ca` | every page (countdown, session-cached) | 3 KB | – | ok |
| Disqus | on click | – | yes | ok |

On `20260422G`, production Lighthouse counted **167 requests, 134 of them third-party, 4.68 MB third-party of 5.05 MB total.**

## 9. Service worker and cache

**Registration.** Only `/authors/` and `/privacy/*.html` register `sw.js`. Home, archive, articles and standings never do. Once a visitor opens an author or privacy page, the SW controls the whole origin.

**Stale-asset bug (proven).** `staleWhileRevalidate(…, matchShellAsset=true)` looks up stamped assets with `caches.match(request, { ignoreSearch: true })` (`sw.js:357-371, 477-481`). The shell cache precaches unversioned `/styles.min.css` and similar, and it is searched first. Simulated deploy (`swtest.mjs`):
1. New CSS body and new `?v=newhash1` in the HTML.
2. Reload: the SW returns the **old body**.
3. Reload again: still the old body. The fresh copy is written to `f1s-assets` but is never read, because the shell match wins.

Controlled clients therefore run new HTML against old CSS/JS until `sw.js` itself changes and reinstalls.

**Other issues:**
- `SW_VERSION = 'v41'`, but the caches are named `*-v40`, so activation never purges.
- `f1s-assets` has no eviction and grows with every `?v` variant.
- The precache includes 3 unused GFS Didot fonts and `/styles/layers.css`, which is only `@import`ed by the unminified `styles.css`.
- Install also fetches 10 recent article HTML pages.

**Hosting.** GitHub Pages sends `cache-control: max-age=600` for everything. The `_headers` file written into `dist/` is not honoured by GitHub Pages. Hashed assets can't be marked immutable, so repeat visits after 10 minutes revalidate every asset. Only a sitewide SW would change that, and that is a behaviour decision (PERF-P2-10).

## 10. Images, media and fonts

**Images**

| Finding | Evidence |
|---|---|
| **Hero double download** (all articles) | The preload uses `ARTICLE_IMAGE_SRCSET` = WebP (`template.html:75`, `article-render.js:270-272,304`); `<picture>` has an AVIF `<source>`. m390: `1.webp` 297 KB + `1.avif` 143 KB. Production: `1-mobile.webp` 42 KB + `1-mobile.avif` 54 KB, both High priority. |
| `-mobile.avif` larger than full `.avif` for 56 of 636 heroes | e.g. `20250303G/2-mobile.avif` 106,764 B vs `2.avif` 81,582 B, so phones get the bigger file |
| Carousel thumbnails use the 800w `-sm` at 74 CSS px | `20260415`: 10 thumbs, 3.6× (m390) to 5.4× oversized; the page moves 967 KB of images |
| Byline avatars `giannis.webp` (260 KB) and `dimitris.webp` (214 KB) are 1024² | shown at 56px on 52 articles; the author tools show 474–1024px avatars at 40px (561 KB of images on `/generate.html`) |
| Home: sponsor logos and YouTube thumbnail larger than rendered | Lighthouse estimates 116 KB (mobile) / 196 KB (desktop) of savings |
| Home hero source is only 474×266 but displayed at 55vw | upscaled. A visual-quality issue, not performance; fixing it *adds* bytes. Noted only. |
| Hero preload on the archive | preloads the 400w card image without `imagesrcset`; the `<img>` picks 1.webp. Measured: only `1-card.webp` 7.6 KB is wasted. Low. |

**Fonts** (public routes: IBM Plex Sans variable in greek, latin, latin-ext and arrows subsets, plus Barlow Condensed 700 latin; all `font-display: swap`)

| Finding | Evidence |
|---|---|
| The Latin core subset `ibm-plex-sans-400-600.woff2` (40 KB) is needed by all Greek text (spaces, digits, punctuation) but is not preloaded. It starts at about 1.1 s on m390 (after CSS) and finishes 1.7–2.4 s, causing the rewrap shifts. | resource timings, CLS entries at 1,780 ms (standings) and 2,370 ms (article) |
| `gfs-didot-400-greek.woff2` is preloaded on every article; **no `@font-face` uses it** | `template.html:63`, `stamp-html.mjs:169`; also 3 Didot files in the SW precache |
| Author tools load two font systems; DM Sans 400/500/600/700 are byte-identical files (one variable font), and the same holds for Outfit and Roboto | `styles/fonts.css` |

Greek glyph coverage is correct: the Greek subset is preloaded everywhere.

**Standings data**

| Finding | Evidence |
|---|---|
| `dirty-air-cache.json` is 1.9 MB raw / 222 KB transferred (all 14 sessions) for one displayed session | DOM 5,258 nodes (4,614 hidden); JS heap 4.8–7.5 MB vs 2.2 MB on drivers |
| `debrief-cache.json` is 763 KB raw / 58 KB gzip, pretty-printed | about 288 KB of that is whitespace |

## 11. CSS

- **Blocking CSS per route:** 142–214 KB raw / 29–43 KB gzip, 5–9 files, all render-blocking. Editorial routes deliberately have no critical CSS (`stamp-html.mjs:88-98`). Production Lighthouse puts render-blocking savings at 289–587 ms.
- **Coverage (unused bytes):**

| Stylesheet | Unused | Where |
|---|---:|---|
| `bootstrap.slim` (39.6 KB) | 83–84% | every route |
| `styles.min` (34.8 KB) | 59–83% | per route |
| `blog-styles.min` (41.6 KB) | **95%** | articles |
| `article-editorial` | 48% | articles |
| `standings-editorial` | 51% | standings |

  Coverage excludes hover, lightbox and error states, so treat these as upper bounds.
- **Expensive effects:**
  - `backdrop-filter` survives on the fixed theme button (desktop), the cookie banner, the lightbox and the mobile standings select.
  - `will-change: transform` plus `translateZ(0)` on every `.blog-img` / `.avatar` (`styles.css:421`) adds one layer per image.
  - `imgShimmer` (`blog-styles.css:186`) keeps animating `background-position` behind loaded images outside the archive.
  - None showed measurable frame cost in the scroll traces.
- **Design identity (keep):** the fixed noise overlay (light mode only), desaturation filters and hover scale are identity items in `KEEP.md`, and they measured as free. They are not tasks.
- **Complex selectors:** nothing pathological. Style recalc during scroll was 11–65 ms per ~6,000px.

## 12. Build output and tooling

**`dist/` contents** (Git repository size is unrelated to runtime payload):

| Type | Size |
|---|---:|
| Total | 197 MB |
| WebP | 91.9 MB (1,563 files) |
| AVIF | 45.1 MB (718 files) |
| HTML | 29.9 MB (369 files) |
| JSON | 2.7 MB (of which dirty-air 1.9 MB) |
| WOFF2 | 0.76 MB |
| JS | 0.67 MB |
| CSS | 0.51 MB |

**Largest runtime files:**
- JS: JSZip 97.6 KB (author tools), `housekeeping-page.js` 88.7 KB and `generate-page.js` 86.0 KB (both unminified), `standings.min.js` 43.1 KB.
- CSS: `blog-styles.min` 41.6 KB, `bootstrap.slim.min` 39.6 KB.
- Fonts: Plex Latin 40.2 KB.

**Minification and stamping.** They work: lightningcss/esbuild, `?v=` sha256-8 query stamping, content-hashed standings chunks. Problems:
- The query-string stamping is exactly what the SW's `ignoreSearch` defeats (§9).
- Author-tool JS is not minified.
- `standings/index.html:503` references the non-existent `standings-nomodule.min.js`.

**Guard fidelity:**
- `lighthouse-guard.mjs` serves uncompressed responses (L99-103), which penalises CSS/JS transfer versus production gzip. That is why the guard reports LCP of about 3.6 s versus 2.7–2.9 s in production.
- Its JS/CSS byte extraction yields 0 B (L314-351), so the byte budgets never enforce.
- `size-guard` measures raw bytes only.
- CI runs none of the perf guards.

## 13. Top bottlenecks (impact × frequency × cost ÷ risk)

| # | Bottleneck | Scope | Measured cost |
|---|---|---|---|
| 1 | Article hero `aspect-ratio: auto` gives a 0-height hero, then a body jump | every article, every device | CLS 0.08–0.37 |
| 2 | Article hero preload fetches WebP while `<picture>` uses AVIF | every article | +42–297 KB per view; m390 LCP 3.0 s vs 1.2 s home |
| 3 | Eager third-party embeds (YouTube, Sketchfab, social SDKs) | 8+ articles | 4.7 MB, 134 requests, prod LCP 35 s, ad origins before consent |
| 4 | SW serves stale CSS/JS after deploys | SW-controlled clients | indefinite until `sw.js` changes (proven) |
| 5 | Standings summary row injected above the table after data | standings, slow networks | CLS 0.24–0.46 |
| 6 | Latin font subset not preloaded; Greek text re-wraps | all routes | CLS 0.016–0.048 per page; plus a wasted 7 KB Didot preload on articles |
| 7 | 1024px byline avatars at 56px | 52 articles | 214–260 KB each |
| 8 | Blocking CSS 142–214 KB raw, 50–64% unused (95% of `blog-styles` on articles) | all routes | 290–590 ms render-blocking (prod Lighthouse) |
| 9 | `-mobile.avif` > desktop AVIF (56 heroes); 800w carousel thumbs at 74px | articles | tens to hundreds of KB on mobile |
| 10 | dirty-air JSON bundles all sessions | dirty-air tab | 222 KB gz / 1.9 MB parse, 5.2k DOM nodes, 7.5 MB heap |

These are not bottlenecks (measured): main-thread JS, scroll jank, INP, the noise overlay, the home hero pipeline, archive hydration, standings rendering cost.

## 14. How the other tools were used

- **graphify.** I refreshed the graph with `graphify update .` (2,110 nodes, 4,695 edges) and queried it to confirm who owns and calls the hot-path functions:
  - `setupSocialEmbeds` → `loadScriptOnce` / `loadFacebookSdk`
  - `renderHeroLead` → `syncHeroMedia`
  - `fetchJSONNoCache` consumers: shell, debrief, destructors
  - `measureArticle`, which only `shared-nav` consumes

  HTML-to-asset ownership came from the built HTML, because the graph is code-level.
- **Ponytail.** Every task was first put through "can we remove the work?". Several tasks are pure deletions (§ tasks P0-01, P1-02, P3-02, P3-04, P3-05), and several proposals were rejected (see below).
- **DESIGN.md / KEEP.md.** Treated as invariants. Nothing proposed changes palette, typography, the grain, the desaturation or motion. Tasks with any visual exposure require a screenshot diff.
- **Impeccable / taste.** Used as a checklist on each proposal: no visible degradation, no altered first-paint composition beyond removing jumps. I did not invoke those skills as tools; that would have been ceremonial for a measurement-only pass. Visual risk is stated per task.
- **Playwright.** Every lab number in this document comes from Playwright + CDP.

**Considered and rejected:**
- `content-visibility` on the article body: its auto sizing would break the reading-progress/TOC measurement, and article layout cost is already small.
- Removing the grain overlay or image filters: they are identity items and measured as free.
- Critical-CSS inlining on editorial routes: a large change against a documented decision; do P2-03 first.
- A framework migration.
- Lowering image quality.

**Artifacts** (scratchpad, not committed): `perf/matrix.json`, `reps.json`, `m320.json`, `scrolltrace.json`, `coverage.json`, `lh-guard/*.json`, `lh-prod/*.json`, `shots/*.jpg`, `visual-qa/` (80 captures), and the probe scripts.
