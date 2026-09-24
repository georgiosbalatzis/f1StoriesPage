# F1 Stories — Performance Tasks

Derived from `PERFORMANCE_AUDIT.md` (baseline at HEAD `31da787`, 2026-09-23).

**Priorities**

| Priority | Meaning |
|---|---|
| P0 | User-visible breakage/jank or a pathological bug |
| P1 | High impact, low/controlled risk |
| P2 | Meaningful |
| P3 | Micro |

Order within a priority is the suggested implementation order.

**Global rules for every task**

- No visual, typographic, colour, layout, content, URL, SEO or publishing-behaviour change unless it is marked **[DECISION]** or **[OPTIONAL]**. Those are never implemented automatically.
- No budget update and no weakened guard.
- A task that changes generated artifacts must regenerate them through the existing pipeline: `build:blog` / `stamp-html` migrations.
- **Standard Playwright check ("screenshot parity"):** the `qa:visual` matrix (10 routes × 390/768/1440/1920 × dark/light) plus the audit probe routes. Settled-state screenshots must be pixel-identical before and after the change, allowing ≤0.1% differing pixels only for anti-aliasing noise.
- **Standard perf check:** re-run the audit probe (`probe.mjs`: m390/t768/d1440, cold + warm; medians of ≥3 runs for the routes a task targets) and compare with the baseline JSON.

**Ponytail pass.** Every task was challenged with "can we remove the work instead?" The answer is recorded under *Exact change*. Pure deletions: P0-01, P1-02, P3-02, P3-04, P3-05.

---

## P0

### [x] PERF-P0-01 — Stop cancelling the hero's intrinsic aspect ratio on article pages

**Surface:** every article page (356), all devices, both themes.

**Metric affected:** CLS.

**Baseline evidence:**

| Profile | CLS range | Notes |
|---|---|---|
| m390 | 0.077–0.207 | |
| t768 | 0.162–0.367 | |
| production Lighthouse mobile | 0.091 / 0.168 | the shifting node is `div.article-body-grid` |

Deterministic: identical on warm reloads. The frame log (`clsdebug.mjs`, `20250303G`, 768px) shows `picture` and `img` at **0px height** at first paint, then 810px when the image decodes; `article-body-grid` jumps 519→1329px.

**Root cause:** `blog-module/blog/article-editorial.css:181` and `:626` set `aspect-ratio: auto` on `.article-page .article-header-img`. That overrides the UA's presentational `aspect-ratio: auto <width>/<height>`, which comes from the `width`/`height` attributes the build already emits with real dimensions (`article-render.js:275-277`). The image therefore has no reserved box until it decodes.

**Files:** `blog-module/blog/article-editorial.css`.

**Exact change:** delete the `aspect-ratio: auto;` declaration at L181 and delete `aspect-ratio: auto` from L626 (keep `height: auto`). A pure removal; nothing is added. The UA default then reserves `width/height` space, and because it is `auto`, the loaded image's natural ratio still wins, so the final render is unchanged.

**Expected effect:** article CLS from 0.08–0.37 to ≤0.05. The remaining ~0.045 is the font re-wrap, which PERF-P1-03 addresses.

**Regression risk:** low. Check heroes whose `backgroundImageWidth/Height` front-matter disagrees with the file. Once loaded they still render at the natural ratio, but they could shift slightly from the reserved box to the natural one.

**Visual risk:** none after load. Before load, the reserved box shows the transparent picture background.

**Must preserve:** hero crop/fit (`object-fit: contain`), border radius and cut corner, the mobile full-bleed header, the 1100px container-query two-column cover, and the enter animation.

**Acceptance criteria:**
- CLS ≤ 0.05 on m390 and t768 for `20260923`, `20250303G`, `20260918W`, `20260415` and `20260422G`.
- Zero shift entries whose source is `article-body-grid`.
- Screenshot parity.

**Playwright verification:** `clsdebug.mjs` shows `picture` height > 0 on the first frame. Screenshot parity for article routes at all widths, both themes.

**Performance verification:** probe the article set (m390, t768, 3 runs); production Lighthouse mobile on 2 articles after deploy.

**Dependencies:** none.

---

### [x] PERF-P0-02 — Make the article hero preload request the same file the `<picture>` renders

**Surface:** every article page.

**Metric affected:** LCP, network transfer.

**Baseline evidence:**

| Profile | Requests made (all High priority) | Result |
|---|---|---|
| m390 (`20260923`) | preload `1.webp` (297 KB) and `1.avif` (143 KB) | LCP 3,024 ms (median of 4); home is 1,232 ms |
| production Lighthouse mobile | `1-mobile.webp` (42 KB) and `1-mobile.avif` (54 KB) | |

**Root cause:** `template.html:75` preloads `imagesrcset="ARTICLE_IMAGE_SRCSET"`, which is filled with the **WebP** srcset (`article-render.js:270-272, 304`). The `<picture>` has an AVIF `<source>` (`article-render.js:267-269`), so AVIF-capable browsers use AVIF and the preloaded WebP is wasted bandwidth that competes with the LCP image.

**Files:**
- `blog-module/build/article-render.js`
- `blog-module/blog/template.html`
- regenerated `blog-entries/*/article.html` (through the build or a `stamp-html.mjs` article migration)
- golden fixtures in `blog-module/build/__tests__/golden-expected/`

**Exact change:**
1. When the AVIF source exists, emit the preload as `href=<1600 AVIF> imagesrcset=<AVIF srcset> imagesizes=<same sizes> type="image/avif" fetchpriority="high"`. Browsers without AVIF skip a typed preload and fall back to the normal `<img>` discovery.
2. Otherwise keep the WebP preload.

No new work is added; one of the two downloads is removed.

**Expected effect:**
- m390: removes about 297 KB of competing transfer; LCP estimated at ≤2.0 s.
- production mobile: about 42 KB less per article view.

**Regression risk:** low. Safari/Firefox honour `type` on preload. The `imagesizes` value must stay identical to the `<source>` `sizes`, or the preload becomes a third candidate.

**Visual risk:** none.

**Must preserve:** hero appearance, `fetchpriority=high`, the WebP fallback, the OG/Twitter image metadata, and `decoding="sync"` behaviour.

**Acceptance criteria:**
- Exactly one hero image request per article view in Chrome (AVIF).
- WebP-only requests happen only when AVIF is unsupported.
- m390 article LCP ≤ 2.2 s (median of 3).
- `test:blog` goldens updated in the same change.

**Playwright verification:** a request log asserts a single hero request; screenshot parity.

**Performance verification:** probe m390/t768/d1440 for the article set; production Lighthouse after deploy (the "preload key requests" warnings disappear).

**Dependencies:** PERF-P2-08 (so the golden and drift gates are green first).

---

### [ ] PERF-P0-03 — Stop loading third-party embeds before they are near the viewport

**Surface:** articles with YouTube (9 iframes / 8 articles), Sketchfab (2), Instagram/Threads/X/Facebook (8 articles).

**Metric affected:** LCP, network transfer, main-thread and memory; also consent exposure.

**Baseline evidence:**
- `20260422G` production Lighthouse mobile: performance **54**, LCP **35.2 s** (simulated). 167 requests, of which 134 are third-party: 4.68 MB of 5.05 MB total (Instagram 1.94 MB, Sketchfab 1.57 MB, YouTube 1.02 MB).
- Probe m390: 159 requests at load, LCP 3,556 ms. YouTube pulls `doubleclick.net` / `googleads` before any consent.
- The iframes sit at y=1,333 to 11,949px.

**Root cause:**
- `embed-render.js:4-16` (`buildYouTubeEmbed`) emits `<iframe src="https://www.youtube.com/embed/ID">` with no `loading`.
- `renderIframe` (`embed-render.js:182-208`) only emits `loading` when the author supplied it.
- `article-script.js:250-300` (`setupSocialEmbeds`, called at `:642`) injects every SDK at `DOMContentLoaded`.

**Files:**
- `blog-module/build/embed-render.js`
- `blog-module/blog/article-script.js`
- regenerated article HTML
- golden fixtures

**Exact change:**
1. Add `loading="lazy"` to the YouTube iframe, and make it the default in `renderIframe` when no `loading` attribute is supplied. This is native: no JS and no facade.
2. In `setupSocialEmbeds`, wrap each platform's loader in a single `IntersectionObserver` (`rootMargin: '600px 0px'`) on the first matching embed. Disconnect it once the loader fires. The existing loader code stays unchanged.

A YouTube click-to-load facade is **not** included: it changes the interaction (it needs a click). Offer it as a separate [DECISION] only if lazy loading proves insufficient.

**Expected effect:**
- About 4.7 MB and 130+ requests fewer at load on `20260422G`; LCP back to the normal article baseline.
- No third-party ad origins contacted unless the reader scrolls to the video.

**Regression risk:** low–medium.
- Embeds must still render when scrolled to and when printed.
- Deep links (`#anchor`) to below-the-fold embeds must still load them.
- Instagram→Facebook SDK ordering (`article-script.js:294`) must be kept.

**Visual risk:** none in the settled state. Embed boxes keep their reserved size. Check that `youtube-embed-container` has an aspect ratio so lazy iframes don't shift (the t768 CLS entry shows it collapsing 151→0px).

**Must preserve:** every embed renders and is interactive after scrolling; the X theme sync; the `allow` / `allowfullscreen` attributes; the CSP allowlist (no new origins).

**Acceptance criteria:**
- On `20260422G`, zero third-party requests before scroll (other than `api.jolpi.ca`).
- After scrolling to each embed, each renders within 3 s on t768.
- CLS does not increase.
- Goldens updated.

**Playwright verification:**
- Load and assert no youtube/instagram/sketchfab/threads requests.
- Scroll to each embed and assert the iframe loads and the SDK processes the blockquote.
- Screenshots of the settled embeds before and after.

**Performance verification:** probe `20260422G` (m390/t768/d1440); production Lighthouse mobile for `20260422G` (target perf ≥ 85).

**Dependencies:** PERF-P2-08.

---

### [x] PERF-P0-04 — Service worker: serve the exact stamped asset, use `ignoreSearch` only as the offline fallback

**Surface:** every page for clients the SW controls. Anyone who has opened `/authors/` or `/privacy/*` has one; the SW controls the whole origin.

**Metric affected:** correctness after deploys (stale CSS/JS against new HTML), cache growth.

**Baseline evidence:** `swtest.mjs` simulated a deploy on the scratch `dist/` (new CSS body, new `?v=` in the HTML). Two consecutive reloads were **both served the old body from the SW** (`fromServiceWorker: true`, marker absent). `f1s-assets-v40` grew 27→28 entries, but the fresh entry was never read.

**Root cause:** `sw.js:357-371`: `staleWhileRevalidate(request, CACHE_ASSETS, true)` calls `caches.match(request, { ignoreSearch: true })`. That matches the unversioned precached shell entry (`/styles.min.css` etc., `sw.js:157-204`) before anything else. The background revalidation writes to `f1s-assets`, which the lookup never reaches. It is stale until `sw.js` bytes change.

**Files:** `sw.js`.

**Exact change:** in `staleWhileRevalidate`, look up `cache.match(request)` first (exact URL, including `?v=`). If there is no exact hit, go to the network. Only if the network fails, fall back to `caches.match(request, { ignoreSearch: true })`, which keeps the cold-offline shell behaviour described in the comment at `sw.js:478-480`. Bump `SW_VERSION` and **the cache names together** (see PERF-P2-09) so existing clients install the fix.

**Expected effect:** new deploys are picked up on the first load after the HTML updates; stamped assets still come from the cache on repeat views.

**Regression risk:** medium, because it is service-worker code.
- One extra network fetch per newly stamped asset. That is intended.
- Offline must still work.

**Visual risk:** none.

**Must preserve:**
- offline navigation → `offline.html`
- navigation preload
- `standings-cache.json` stale-while-revalidate
- the blog JSON network-first behaviour
- the update banner in `sw-register.js`

**Acceptance criteria:** `swtest.mjs` shows the new body on the first load after deploy. An offline reload of a previously visited page still renders styled. `validate-public-artifact` passes.

**Playwright verification:**
- The `swtest.mjs` scenario (deploy → reload → new marker).
- Go offline → reload home, an article and standings → styled pages / `offline.html`.
- Screenshot parity with the SW active.

**Performance verification:** warm-load probe with the SW controlling (register via `/authors/`, then load home, article and standings). Warm FCP is not worse than baseline (28–208 ms).

**Dependencies:** none. Do it before PERF-P2-10.

---

## P1

### [x] PERF-P1-01 — Reserve the standings summary-row space before data arrives

**Surface:** `/standings/` (drivers and constructors panels) on slow and mid networks.

**Metric affected:** CLS.

**Baseline evidence:** m390 CLS **0.458** (median of 4). Local Lighthouse guard 0.240 (the guard FAILs). The frame log shows `#drivers-table` moving 484→635px (+151px) when `#drivers-summary-row` is filled, and `standings-layout` resizing 317→167px as the skeleton becomes the table. Production Lighthouse shows 0 only because the snapshot won the race with first paint.

**Root cause:** `standings/index.html:242` ships an empty `#drivers-summary-row`. `standings/standings-polish.js:56,97` (`renderSummaryCards`) fills it after `standings-cache.json` loads. The skeleton height also differs from the final table height.

**Files:**
- `standings/standings-editorial.css` (context-row rules at L82/266/293)
- possibly the skeleton markup in `standings/standings.js`

**Exact change:**
1. Give `.standings-page .standings-context-row:empty` a `min-height` equal to the rendered card-row height at each breakpoint. Measure it from the settled page at 390, 768, 1024 and 1440.
2. Make the skeleton row count and row height match the final table rows.

CSS only, applying only while the row is empty. No new JS.

**Expected effect:** standings CLS ≤ 0.05 on m390. Lighthouse guard CLS below its 0.02 budget, together with PERF-P1-03.

**Regression risk:** low. If the data fails, an empty reserved row remains; check the error state.

**Visual risk:** none settled. During load a blank band occupies the space the cards will fill.

**Must preserve:** the ledger layout, the summary cards, the timing band, the live Jolpica refresh at 3.5 s, and tab switching.

**Acceptance criteria:**
- m390/t768 standings CLS ≤ 0.05 (median of 3).
- No `#drivers-table` movement after first paint in `clsdebug`.
- Screenshot parity.

**Playwright verification:** `clsdebug.mjs /standings/` at 390 and 768 with throttling; screenshots of the drivers and constructors tabs.

**Performance verification:** probe standings, dirty-air and debrief; `perf:lighthouse` Standings CLS.

**Dependencies:** none.

---

### [x] PERF-P1-02 — Remove the unused GFS Didot preload and precache entries

**Surface:** every article; the SW install.

**Metric affected:** LCP (bandwidth contention), transfer.

**Baseline evidence:**
- `gfs-didot-400-greek.woff2` is requested at high priority at ~490 ms on every article (m390), alongside the LCP image.
- No `@font-face` references GFS Didot. `DESIGN.md:167` already records this as debt.
- The SW precaches 3 Didot files (30.7 KB).

**Root cause:** leftover entries in `stamp-html.mjs:169` (the font-preload list), `blog-module/blog/template.html:63` and `sw.js:197-199`.

**Files:** `scripts/build/stamp-html.mjs`, `blog-module/blog/template.html`, `sw.js`, regenerated article HTML.

**Exact change:** delete those entries. A pure deletion. Leave the woff2 files in place; deleting them is a separate cleanup.

**Expected effect:** 7.2 KB fewer high-priority bytes per article view; 30.7 KB less SW install.

**Regression risk:** very low. `validate-public-artifact` checks SW asset references.

**Visual risk:** none (the font was never applied).

**Must preserve:** the Plex Greek preload.

**Acceptance criteria:** no `gfs-didot` request on any route; `validate-public-artifact` passes.

**Playwright verification:** request log; screenshot parity for article routes.

**Performance verification:** probe the article set on m390.

**Dependencies:** bundle the `sw.js` part with PERF-P0-04's version bump.

---

### [x] PERF-P1-03 — Deliver the Latin core subset early, so Greek text doesn't re-wrap

**Surface:** all public routes. The headline and title wrap is visible on articles, standings and authors.

**Metric affected:** CLS, visual stability.

**Baseline evidence:** shifts coincide exactly with the arrival of `ibm-plex-sans-400-600.woff2` (40 KB):

| Route | Font arrives | Shift | What moves |
|---|---|---|---|
| Standings | 1,759 ms | 0.041 at 1,780 ms | `.standings-title-greek` 47→23px |
| Long article | 2,267 ms | 0.048 at 2,370 ms | header re-centres |
| Authors | 1,573 ms | 0.016 at 1,592 ms | bio grows |

The file is not preloaded and is discovered at style time (~1.1 s, m390).

**Root cause:** `styles/home-fonts.css` splits IBM Plex by `unicode-range`. U+0000-00FF (space, digits, punctuation) lives in the Latin file, so every Greek line depends on it. Until it loads, spaces come from the fallback font, whose advance width differs, and the lines re-wrap.

**Files:**
- `scripts/build/stamp-html.mjs` (the font-preload block)
- regenerated HTML
- the alternative in step 2 touches `styles/home-fonts.css`

**Exact change** (measure-gated; stop at the first step that meets the acceptance criteria):
1. Add a `<link rel="preload" as="font" type="font/woff2" crossorigin>` for `ibm-plex-sans-400-600.woff2` next to the existing Greek preload. After PERF-P1-02 this replaces the Didot preload slot on articles.
2. If step 1 costs more than 100 ms of home or article LCP on m390, revert it. Instead add a metric-matched local fallback `@font-face` (`size-adjust` / `ascent-override` tuned so the fallback space width equals Plex's) in `home-fonts.css`, placed last in the `font-family` stacks. The web font still wins once loaded.

**Expected effect:** removes the 0.016–0.048 font shifts. Standings and article CLS fall to ≈0 together with P0-01 and P1-01.

**Regression risk:** step 1 costs +40 KB of early high-priority transfer, competing with LCP on Slow 4G. That is why it is measure-gated.

**Visual risk:** none after the fonts load (same fonts). Step 2 only affects the pre-swap flash.

**Must preserve:** IBM Plex Sans as the only text family, Barlow for the display caps, `font-display: swap`, Greek coverage.

**Acceptance criteria:**
- No layout-shift entry within 100 ms after any woff2 `responseEnd` on m390 for home, article, standings and authors.
- LCP not worse than baseline + 100 ms.
- Screenshot parity.

**Playwright verification:** a probe with a shift/font timeline; screenshots at settle.

**Performance verification:** probe m390/m320/t768 (3 runs) for home, article, standings and authors.

**Dependencies:** PERF-P1-02.

---

### [x] PERF-P1-04 — Right-size author avatars

**Surface:**
- article byline/author block: 52 articles use `giannis` / `dimitris`
- `/generate.html`
- the home cast and authors page, where applicable

**Metric affected:** transfer, image decode memory.

**Baseline evidence:**
- `images/authors/giannis.webp` 260 KB and `dimitris.webp` 214 KB, both 1024×1024, displayed at 56 CSS px (`article-editorial.css:528`).
- `/generate.html` loads 561 KB of images with avatars 474–1024px at 40px (3.95–12.8× oversized, probe).

**Root cause:** avatar source files are published at their original size and referenced directly (`CONFIG.AUTHOR_AVATARS`, `article-render.js:273`).

**Files:**
- `images/authors/*.webp`, re-encoded to 168×168 (3× of 56px) at the same quality, **or** new `-168.webp` siblings plus a reference change in `article-render.js`
- author-tool avatar references

**Exact change:** prefer re-encoding the existing files in place at 168px (for the 56px byline) if no surface displays them larger than 168 CSS px ÷ DPR. Verify on the home cast and `/authors/` first. If a larger surface exists, add a small variant and point only the byline and tool uses to it.

**Expected effect:** about 470 KB less for readers of those 52 articles when the author block loads; about 500 KB less on `/generate.html`.

**Regression risk:** low. Check every consumer of `/images/authors/*`, including OG/JSON-LD author images.

**Visual risk:** very low (3× density kept). Compare the 56px crops at DPR 3.

**Must preserve:** the circular or cut-corner crop, the image focus, the desaturation treatment.

**Acceptance criteria:**
- No avatar with natural width > 3.2× its CSS width on any audited route.
- Screenshot parity at DPR 1/2/3 on the article author block, `/authors/` and the home cast.

**Playwright verification:** the probe's `imgs[].over` ≤ 3.2 for avatars; screenshots.

**Performance verification:** probe article (`20260918W`, byline giannis/dimitris), generate, home.

**Dependencies:** none.

---

### [x] PERF-P1-05 — Stop delaying internal navigations for analytics

**Surface:** every page with internal links, for consented users.

**Metric affected:** navigation latency (INP-adjacent: click → next page).

**Baseline evidence:** `analytics.js:155-189` calls `preventDefault()` on every internal link click and navigates only after the gtag `event_callback` fires, or after `CLICK_EVENT_TIMEOUT = 250` ms (`:13`). For users who have not consented, it still parses consent JSON from `localStorage` on every click.

**Root cause:** callback-gated navigation. The event is already sent with `transport_type: 'beacon'`, which survives unload.

**Files:** `scripts/analytics.js`.

**Exact change:** do not `preventDefault`. Call `trackInternalPageClick(anchor, destination)` without a callback and let the browser navigate natively. Delete the timeout/`location.assign` path; this is a deletion.

**Expected effect:** up to 250 ms removed from every consented internal navigation. Native link behaviour is restored (bfcache friendliness, preconnect on hover, modifier handling stays the same).

**Regression risk:** low. GA4 beacon delivery on unload is reliable. Confirm in GA DebugView that the `internal_click` events still arrive.

**Visual risk:** none.

**Must preserve:** event names and params, consent gating, `target=_blank` handling.

**Acceptance criteria:** with consent granted, the click→navigation start is ≤ 30 ms (probe). `test:consent` passes. Events are visible in GA DebugView.

**Playwright verification:** a consented context: click an internal link, measure the time from click to the `framenavigated` event, and assert that `collect` beacons are sent.

**Performance verification:** before/after click→navigation timing on home → article.

**Dependencies:** none.

---

### [ ] PERF-P1-06 — Fix mobile hero variants that are larger than the desktop file

> **Rejected (measured).** The 52 same-width offenders are not wasteful re-encodes: the `-mobile.avif` files are closer to the source (SSIM vs source .962–.991) than the legacy full `.avif` files (.899–.980), which an older encoder produced at a lower effective quality for the same nominal q60. Making mobile ≤ full would require lowering mobile image quality (SSIM .896–.979 vs the current file). New heroes already produce byte-identical pairs. No change made.

**Surface:** 56 article heroes (plus the home/archive cards that reuse `-mobile`).

**Metric affected:** mobile LCP bytes.

**Baseline evidence:** 56 of 636 hero pairs have `N-mobile.avif` > `N.avif`. Example: `20250303G/2-mobile.avif` 106,764 B vs `2.avif` 81,582 B. The `sizes` attribute selects the 800w `-mobile` variant on phones.

**Root cause:** `blog-module/generate-image-variants.js`: the mobile variants are encoded from the source with different effort/quality settings than the full AVIF, or from a different source.

**Files:** `blog-module/generate-image-variants.js`, the affected `-mobile.avif` files.

**Exact change:**
1. Find the parameter difference.
2. Re-encode the 56 offenders from the same source with the full-size AVIF's quality setting at 800px width. Keep quality-equivalent settings; do not lower quality blindly.
3. Add a generation-time check that fails if `-mobile` ≥ full.

**Expected effect:** smaller mobile hero bytes on those articles (roughly 20–50% of the mobile file).

**Regression risk:** low.

**Visual risk:** low. Compare the re-encoded 800w output visually against the previous one at DPR 2/3 (SSIM ≥ 0.98).

**Must preserve:** crops and colour, and the file names and URLs.

**Acceptance criteria:**
- No `-mobile.avif` ≥ its full `.avif`.
- `perf:article-media` totals not increased.
- Visual comparison passes.

**Playwright verification:** screenshots of 3 affected articles at 390 and 768.

**Performance verification:** probe `20250303G` on m390 (hero bytes, LCP).

**Dependencies:** PERF-P0-02 (so only one hero request exists to measure).

---

## P2

### [x] PERF-P2-01 — Split `dirty-air-cache.json` per session

**Surface:** `/standings/?tab=dirty-air`.

**Metric affected:** transfer, JSON parse, memory.

**Baseline evidence:**
- 1,904,927 B raw / 222 KB transferred for all 14 sessions (about 116 KB raw each), while one session is displayed (`tabs/dirty-air.js:492`).
- Heap 4.8 MB (m390) / 7.5 MB (t768) vs 2.2 MB on drivers; DOM 5,258 nodes, 4,614 of them hidden.

**Root cause:** a monolithic cache produced by the builder script.

**Files:** the dirty-air cache builder (`blog-module/dirty-air-cache.js`), `standings/tabs/dirty-air.js`, `public-artifact.mjs` allowlist, `sw.js` data routes, `validate-data-contracts.mjs`.

**Exact change:** emit a small index (session list plus metadata) and one file per session. The tab fetches the index plus the selected session, then others on selection. Keep the current file until every consumer (including `?embed=1`) is migrated.

**Expected effect:** about 222 KB → about 20 KB of initial transfer; about 90% less parse and heap.

**Regression risk:** medium (data contract change).

**Visual risk:** none.

**Must preserve:** session selector, share/embed URLs, default session, offline SW behaviour for standings data.

**Acceptance criteria:**
- Initial dirty-air transfer ≤ 40 KB.
- Identical rendered output per session (DOM snapshot diff).
- Data-contract validation updated and passing.

**Playwright verification:** switch through every session and compare screenshots and DOM with the baseline.

**Performance verification:** probe dirty-air on m390/t768 (bytes, heap, LCP).

**Dependencies:** none.

---

### [x] PERF-P2-02 — Inline only the sprite symbols each page uses

**Surface:** every page except 404.

**Metric affected:** HTML bytes before the hero markup; FCP on slow links.

**Baseline evidence:**
- The sprite is 32,137 B raw / **11.4 KB gzip per page** and starts at about byte 6–8K, before the nav and hero.
- Only 22 of 66 symbols are referenced on home and articles, 28 on standings.
- HTML has `max-age=600`, so the sprite is re-downloaded with every page.

**Root cause:** `stamp-html.mjs` inlines the full `build-icon-sprite.mjs` output.

**Files:** `scripts/build/stamp-html.mjs` (sprite inlining), `scripts/build/build-icon-sprite.mjs`.

**Exact change:** at stamp time, collect the `#id` references in the page, including ids that runtime JS injects into `<use href>` (grep `use href="#` / `'#fa-` in JS). Inline only those symbols plus the JS-referenced set.

**Expected effect:** about 7 KB gzip less per HTML view, and the nav and hero reach the parser earlier.

**Regression risk:** medium: an icon referenced dynamically by JS could go missing. Mitigate with a validator check.

**Visual risk:** icons missing if the set is wrong, so screenshots are required.

**Must preserve:** every icon, including those rendered by JS (share, theme, lightbox, standings tabs).

**Acceptance criteria:**
- Screenshot parity on all routes, including interaction states (menu open, lightbox, theme toggle).
- The validator fails if any `<use href="#x">` in HTML or JS has no inlined symbol.

**Playwright verification:** screenshot matrix plus an interaction pass; DOM check that every `use` resolves (`getBBox` non-zero).

**Performance verification:** HTML gz size per route; FCP on m390.

**Dependencies:** none.

---

### [x] PERF-P2-03 — Remove `blog-styles.min.css` from article pages

**Surface:** every article page.

**Metric affected:** render-blocking CSS, FCP/LCP render delay.

**Baseline evidence:** coverage shows 95% of `blog-styles.min.css` (41.6 KB raw, about 8 KB gzip) unused on articles. Articles block on 9 stylesheets, 214 KB raw / 42.8 KB gzip. Production Lighthouse render-blocking savings are 400–587 ms on articles.

**Root cause:** articles inherit the archive stylesheet for a few shared rules (reading progress, the reduced-motion block, a few components).

**Files:** `blog-module/blog/template.html` (stylesheet list), `blog-module/blog/article-styles.css` (receives the used rules), regenerated article HTML.

**Exact change:**
1. Extract the ~5% of `blog-styles` rules actually matched on articles (coverage across both themes, all widths and interactive states) into `article-styles.css`.
2. Drop the `<link>` from the template.

**Expected effect:** about 8 KB gzip and one render-blocking request less per article view.

**Regression risk:** medium: rules for rarely seen states (lightbox, gallery, error states) may be missed.

**Visual risk:** medium. Mandatory screenshot parity, including the lightbox, gallery, TOC, the mini-bar on scroll, print, and reduced motion.

**Must preserve:** every article visual state in both themes.

**Acceptance criteria:**
- Screenshot parity across the article route set (5 articles) × 4 widths × 2 themes, plus interaction states.
- Articles load 8 stylesheets.

**Playwright verification:** as above, plus coverage re-run showing no "missing rule" regressions.

**Performance verification:** probe the article set (FCP, LCP render delay).

**Dependencies:** PERF-P0-01, PERF-P0-02 (to measure the CSS delta cleanly).

---

### [x] PERF-P2-04 — Dedicated carousel thumbnail variant

**Surface:** gallery/carousel articles (e.g. `20260415`, `20260918W`).

**Metric affected:** transfer.

**Baseline evidence:** thumbnails are 800w `-sm.webp` at 74 CSS px (3.6× at DPR 3, 5.4× at DPR 2). `20260415` moves 967 KB of images. The fallback uses the *full* image when `-sm` is missing (`media.js:218`); in `20260918W` that is a 3392px, 1.33 MB source.

**Root cause:** `blog-module/build/media.js:216-225` reuses `-sm` / full as the thumbnail.

**Files:** `blog-module/generate-image-variants.js`, `blog-module/build/media.js`, regenerated articles.

**Exact change:** generate `N-thumb.webp` at 240px (3× of 80px) and use it for `.gallery-thumb img`. Never fall back to the full image; fall back to `-sm`.

**Expected effect:** about 90% smaller thumbnails; hundreds of KB per gallery article.

**Regression risk:** low.

**Visual risk:** very low (3× density).

**Must preserve:** thumb crop and active state.

**Acceptance criteria:** thumbnail natural width ≤ 3.2× its CSS width; screenshot parity.

**Playwright verification:** gallery screenshots at 390/1440; thumb click still switches the slide.

**Performance verification:** probe `20260415` image bytes.

**Dependencies:** none.

---

### [x] PERF-P2-05 — Right-size home sponsor logos and the YouTube thumbnail

**Surface:** home (below the fold).

**Metric affected:** transfer.

**Baseline evidence:** production Lighthouse estimates 116 KB (mobile) / 196 KB (desktop) of savings: `BalatzisDomika.webp` 59 KB, `ps.webp` 37 KB, 4 others at 20–25 KB, and `images/youtube/l0vNNK6FO3g.webp` 51 KB, all larger than rendered.

**Root cause:** `normalized/` sponsors are 320×160 for all displays; the YouTube thumbnail is fetched at a single size.

**Files:** `scripts/build/normalize-sponsors.mjs`, `scripts/build/fetch-youtube.mjs`, `index.html` / partial markup (add `srcset`/`sizes`).

**Exact change:** emit 1×/2× sizes for the actual rendered box and use `srcset` + `sizes`; same encoder settings.

**Expected effect:** 100–190 KB less per home view.

**Regression risk:** low.

**Visual risk:** low. Sponsor logos must keep their original colours on the light mat (KEEP.md).

**Must preserve:** logo colours, mat, and layout.

**Acceptance criteria:** Lighthouse `uses-responsive-images` savings under 20 KB on home; screenshot parity.

**Playwright verification:** screenshots of the sponsor strip and video section at 390/768/1440, both themes.

**Performance verification:** probe home bytes.

**Dependencies:** none.

---

### [x] PERF-P2-06 — Author tools: stop the layout jumps and ship minified code

**Surface:** `/generate.html`, `/housekeeping.html` (authors only).

**Metric affected:** CLS, FCP, transfer.

**Baseline evidence:**

| Page | CLS | FCP (m390) | Other |
|---|---|---|---|
| Generate | **0.564** (m390) / **0.690** (t768), from `gb-stage` / `gb-field` / progress bar at about 2.4 s | 1.9 s | |
| Housekeeping | 0.137, from `section.hk-work` | 1.8 s | |
| Both | | | unminified `generate-page.js` 86 KB and `housekeeping-page.js` 89 KB; 4 sync head scripts; JSZip 97.6 KB loaded on open but used only for zip import/export (`generate-page.js:596,805`); avatars up to 12.8× oversized |

**Root cause:** hidden-until-JS wizard fields; no minification entry for author scripts in `minify.mjs`; eager JSZip `<script>`.

**Files:** `generate.html`, `housekeeping.html`, `scripts/build/minify.mjs`, `scripts/author/*.js`, `styles/author/generate.css`.

**Exact change:**
1. Add the author scripts to `minify.mjs`, plus stamping.
2. Make the head scripts `defer`, keeping their order.
3. Load JSZip via dynamic script injection on the first zip action.
4. Reserve the wizard's initial layout in CSS so JS initialisation doesn't reflow.

**Expected effect:** tool FCP about 0.5 s faster on mobile, CLS ≤ 0.05, about 150 KB less.

**Regression risk:** medium (author workflows).

**Visual risk:** low.

**Must preserve:** the whole author flow (GitHub auth, zip import/export, publish), `test:author`.

**Acceptance criteria:** `test:author` passes; a manual end-to-end publish dry run; CLS ≤ 0.05.

**Playwright verification:** load both tools at 390 and 1440; exercise zip export/import with a fixture.

**Performance verification:** probe generate and housekeeping.

**Dependencies:** none.

---

### [x] PERF-P2-07 — Make the Lighthouse guard measure what production serves

**Surface:** the `perf:lighthouse` tooling.

**Metric affected:** measurement fidelity. This is not a weakening: budgets stay as they are.

**Baseline evidence:**
- The guard serves uncompressed responses (`lighthouse-guard.mjs:99-103`). Its LCP of about 3.6 s compares with 2.7–2.9 s in production.
- The JS/CSS byte extraction reports **0 B** on every route (`:314-351`), so `initial-js-bytes` and `route-css-bytes` never enforce.
- Articles are not covered at all.
- 1 run per route.

**Root cause:** a static server without gzip; a resource-summary parsing bug.

**Files:** `scripts/perf/lighthouse-guard.mjs`, `perf/lighthouse-budget.json` (add an article route; do not change existing thresholds).

**Exact change:**
1. gzip text responses in the guard's server.
2. Fix the byte extraction using Lighthouse `resource-summary` `transferSize` per `resourceType`.
3. Add the latest article as a 4th route.
4. Run 3 times and take the median.

**Expected effect:** trustworthy lab gating, catching regressions like P0-01/P0-02.

**Regression risk:** none at runtime.

**Visual risk:** none.

**Must preserve:** existing thresholds.

**Acceptance criteria:** the guard reports non-zero JS/CSS bytes that match `routes.mjs` gzip totals within 5%; an article route is present.

**Playwright verification:** n/a.

**Performance verification:** run the guard before and after the P0 tasks.

**Dependencies:** none (do it early so it gates everything else).

---

### [x] PERF-P2-08 — Restore a green baseline: stamp drift and golden fixtures

> **Done, with one content exception.** Goldens were regenerated and reviewed; every diff matches an intended P0–P3 change, and `test:blog` passes. The regenerated artifacts are committed on `perf/perf-boost` (owner approved 2026-09-24), so `build:check` can pass. On the owner's decision, `perf:budget` and `perf:article-media` were re-baselined, and `perf:budget` passes. `perf:article-media` still fails on its fixed 1 MB single-file limit: `20260918W/1.webp` is 1.22 MB and `20260918W/9.webp` is 1.27 MB (pre-existing). Clearing it means recompressing those two photos or raising the limit, which is left to the owner.

**Surface:** repo and CI gates (`verify`).

**Metric affected:** the ability to verify every other task.

**Baseline evidence:**
- On a clean HEAD, `build:public` rewrites 357 tracked files: committed `article.html` and `template.html` reference `article-script.min.js?v=f007dada`, while the build stamps `367c0e4b`. `build:check` fails.
- `test:blog` golden mismatches: 20260415, 20260416G, 20260422G, 20260610-2J, 20260610W.
- `perf:budget` is over for 4 files; `perf:article-media` is over its totals.

**Root cause:** commit `06c8154` ("Socials Fix") changed `article-script.js` without committing the regenerated artifacts or goldens. The budget overages come from real growth since the budgets were recorded.

**Files:** generated article HTML and template; `blog-module/build/__tests__/golden-expected/*`.

**Exact change:**
1. Commit the regenerated artifacts from `build:public`.
2. Review each golden diff: accept it only if it matches the intended Socials Fix change, otherwise treat it as a bug.

Budget overages need an explicit human decision. This task must **not** run `perf:budget:update` or `perf:article-media:update` on its own.

**Expected effect:** `verify` reaches the perf steps again.

**Regression risk:** none.

**Visual risk:** none.

**Must preserve:** production output (already built with `367c0e4b`).

**Acceptance criteria:** `build:check` and `test:blog` pass on a clean tree.

**Playwright verification:** `qa:visual`.

**Performance verification:** n/a.

**Dependencies:** none. Do this first.

---

### [x] PERF-P2-09 — Service-worker hygiene: version-aligned caches, bounded asset cache, dead precache entries

**Surface:** SW-controlled clients.

**Metric affected:** storage growth, lookup cost, install bytes.

**Baseline evidence:**
- `SW_VERSION='v41'` while the caches are `*-v40` (`sw.js:147-151`), so activation never purges.
- `f1s-assets` has no size cap and accumulates every `?v` variant and image.
- Precache includes `/styles/layers.css`, which no page loads (only the unminified `styles.css` `@import`s it).
- Install fetches the 10 latest article pages (about 700 KB) at `no-store`.

**Root cause:** manual versioning with drift; no eviction.

**Files:** `sw.js`.

**Exact change:**
1. Derive the cache names from `SW_VERSION`.
2. Cap `f1s-assets` (e.g. 150 entries, delete the oldest on put).
3. Drop `layers.css` (and Didot, via P1-02) from `SHELL_ASSETS`.
4. **[DECISION]** whether the 10-article install prefetch stays. It is an offline feature; keep it by default.

**Expected effect:** bounded storage; old caches purged on the next update.

**Regression risk:** low–medium (SW).

**Visual risk:** none.

**Must preserve:** offline behaviour, the update banner.

**Acceptance criteria:** after an update only `*-v<new>` caches exist; `f1s-assets` stays under the cap across 200 navigations.

**Playwright verification:** a persistent context with 200 navigations, then inspect `caches.keys()`.

**Performance verification:** warm probe with the SW.

**Dependencies:** PERF-P0-04.

---

### [x] PERF-P2-10 — [DECISION] Register the service worker on all public routes

> **Done (owner approved 2026-09-24; the owner also chose to remove the PWA install banner completely).** `sw-register.min.js` is now the last script on home, archive, standings and the article template, and `stamp-html` adds it to the 356 committed articles through an idempotent migration (`ensureSwRegisterScript`, with `scripts/sw-register.js` added to `ARTICLE_RUNTIME_SOURCES`). The install-prompt code and its `#pwa-install-banner` CSS are gone; the update banner stays. `swp210.mjs` passes all 14 checks: each route registers and controls on its own, no install banner appears after scroll + 10 s, the update banner appears on every route after a `sw.js` deploy and Reload activates the new worker, a stamped-asset deploy is picked up on the first load, visited routes render styled offline, and an unvisited page gets `offline.html`. Warm load after the HTTP TTL (m390, Slow 4G, CPU ×4, max-age=0 + ETag/304, medians of 3):
> - FCP: home 880 → 292 ms; archive 896 → 288 ms; article 884 → 292 ms; standings 1,012 → 256 ms.
> - Load: 1,139–1,481 ms → 256–313 ms.
>
> Revalidation continues in the background without blocking paint.
>
> **Guard fix:** `perf:lighthouse` shares one Chrome with `--disable-storage-reset` so the consent seed persists. Once the SW registered, it served every later audit from Cache Storage (JS/CSS 0 B, LCP about 0.7 s), silently making the gate measure warm loads. The guard now clears the origin's service workers and Cache Storage before each run over CDP (`Storage.clearDataForOrigin`; localStorage is kept). Cold-visit numbers are back: LCP 2.25–2.41 s, and against the pre-change run CSS is −3.3 KB and JS +1.4 KB per route.

**Surface:** repeat visits to home, archive, articles and standings.

**Metric affected:** repeat-visit load. GitHub Pages sends `max-age=600` for everything and ignores `_headers`, so after 10 minutes every asset revalidates.

**Baseline evidence:** only `authors/index.html` and `privacy/*.html` include `sw-register`. Warm loads within 10 minutes are 0-byte (HTTP cache); beyond that, nothing is guaranteed without the SW.

**Root cause:** unclear whether the partial registration is intentional.

**Files:** page shells / the include partial that carries `sw-register.min.js`.

**Exact change:** none until the owner decides, because it changes service-worker behaviour and offline UX site-wide. If approved, do it only after PERF-P0-04 and PERF-P2-09.

**Expected effect:** near-instant repeat visits beyond the 10-minute TTL; offline reading.

**Regression risk:** medium (site-wide SW).

**Visual risk:** the update banner appears on more routes.

**Must preserve:** consent, navigation freshness (network-first for HTML).

**Acceptance criteria:** owner decision recorded.

**Playwright verification:** as P0-04, on all routes.

**Performance verification:** warm probe after 11 minutes (fake clock) with and without the SW.

**Dependencies:** PERF-P0-04, PERF-P2-09.

---

### [x] PERF-P2-11 — [DECISION/OPTIONAL] The consent banner becomes the LCP element on first-visit mobile articles

> **Closed: the owner chose option (a), accept it as a metric artifact (2026-09-24).** No code change; consent timing and banner appearance are unchanged.

**Surface:** first visits to articles on mobile.

**Metric affected:** lab/field LCP accounting (not perceived speed).

**Baseline evidence:** production Lighthouse mobile, where the LCP element is the cookie-consent `<p>`:
- `20260923`: LCP 5,864 ms, render delay 5.2 s
- `20250303G`: LCP 4,078 ms

The banner appears after a 3.6 s timer (`cookie-consent.js:97-98`) and its text box is larger than the hero's visible area at 390–412px. Real users who scroll first stop LCP earlier. RUM never sees these users because the beacon is consent-gated.

**Root cause:** a deliberately delayed banner plus text size.

**Files:** `scripts/cookie-consent.js`, banner CSS.

**Exact change:** none automatically; it would change consent UX timing or banner appearance. Options for the owner:
- (a) accept it, since it is a metric artifact;
- (b) render the banner at load;
- (c) keep the timing but reduce the banner's painted text area.

**Expected effect:** only lab and field LCP numbers change.

**Regression risk:** consent-UX behaviour.

**Visual risk:** option (c) is visible.

**Must preserve:** consent behaviour per `test:consent`.

**Acceptance criteria:** owner decision.

**Playwright verification:** `test:consent` plus banner screenshots.

**Performance verification:** production Lighthouse on 2 articles.

**Dependencies:** none.

---

## P3

### [x] PERF-P3-01 — Reading-progress bar: `transform: scaleX` instead of `width`

> **Done.** Article scroll LayoutCount (5 reps, identical each rep): 20260923 m390 52→12, d1440 32→9; 20260422G m390 66→5, d1440 71→9. The trace attributes the removed layouts to "Style changed #reading-progress". Bar width matches within 0.01px at 0/3/10/50/100% in both themes. Strip diffs are ≤0.061% (1–4 device-px columns at the rounded tip), so the radius stays.

**Surface:** articles.

**Metric affected:** layout work per scroll frame.

**Baseline evidence:** `shared-nav.js:200` sets `style.width` inside the rAF scroll handler, which means one layout per frame. `blog-styles.css:1431` has `will-change: width`, which does nothing useful. No jank was measured (p95 16.7 ms).

**Root cause:** animating a layout property.

**Files:** `scripts/shared-nav.js`, `blog-module/blog-styles.css` (or wherever P2-03 moves it).

**Exact change:**
1. Give `.reading-progress-fill` `width: 100%; transform-origin: 0 50%; transform: scaleX(0)`.
2. Have JS set `transform = 'scaleX(' + pct/100 + ')'`.
3. Remove `will-change: width`.

**Expected effect:** zero layouts from the progress bar during scroll.

**Regression risk:** very low.

**Visual risk:** the `border-radius: 0 2px 2px 0` cap scales with the bar. Check the right edge at small percentages; drop the radius only if it differs visibly.

**Must preserve:** bar colour, height, and position in both themes.

**Acceptance criteria:** CDP LayoutCount during an article scroll drops by ≥ 1 per frame; screenshot parity at 0%, 50% and 100%.

**Playwright verification:** screenshots at three scroll positions.

**Performance verification:** `scrolltrace.mjs` on the long article.

**Dependencies:** none.

---

### [x] PERF-P3-02 — Delete the unused `--vh` resize writer

> **Done.** RecalcStyleCount over a 10-step resize sequence: 20→10 on both articles and the archive, at m390 and d1440. `--vh` is no longer set.

**Surface:** archive, articles, author tools (pages loading `blog-fixes.js`).

**Metric affected:** style recalc on resize / mobile URL-bar moves.

**Baseline evidence:** `blog-fixes.js:173-178` writes `--vh` on `<html>` on every resize; a repo search finds no `var(--vh)` consumer.

**Root cause:** leftover code.

**Files:** `blog-module/blog-fixes.js`.

**Exact change:** delete `fixViewportHeight` and its call (`:310`).

**Expected effect:** no full style recalc per URL-bar resize.

**Regression risk:** none (no consumer).

**Visual risk:** none.

**Must preserve:** everything else in `blog-fixes`.

**Acceptance criteria:** a search shows no `--vh` usage; screenshot parity.

**Playwright verification:** a resize sequence on mobile; screenshots.

**Performance verification:** CDP RecalcStyleCount during resize.

**Dependencies:** none.

---

### [x] PERF-P3-03 — rAF-throttle the article mini-bar and archive scroll/resize handlers

> **Done; the archive acceptance criterion is not met, and handler changes cannot meet it.** Both handlers are rAF-coalesced and write only on change, and the dead desktop `getBoundingClientRect` branch is gone. Show/hide thresholds and ARIA state are unchanged: articles hide at header-bottom 83px and show at 81px; the archive is visible at ≤767px, hidden above, and follows breakpoint resizes. Archive LayoutCount is unchanged (m390 96→97, d1440 33→33). A trace shows **0 JS-forced layouts at baseline** too: all of them come from `content-visibility: auto` on `.article-card-img` (added to/removed from layout as cards cross the viewport), card-image animation style recalcs and the lazy `data-src` swap. Carried to the smoothness pass.

**Surface:** articles (mobile mini-bar), archive.

**Metric affected:** layout/style work during scroll.

**Baseline evidence:**
- Archive m390: 124 layouts and 128 ms of script over a 5,846px scroll (`scrolltrace`).
- `article-script.js:180-190` reads `getBoundingClientRect` and writes class and attribute on every scroll/resize event.
- `blog-index.js:894-895` does the same.
- No dropped frames were measured.

**Root cause:** unthrottled handlers.

**Files:** `blog-module/blog/article-script.js`, `blog-module/blog-index.js`.

**Exact change:**
1. Coalesce in `requestAnimationFrame`, using the same pattern as `shared-nav.js:188-205`.
2. Write `aria-hidden` and the class only when the value changes.
3. Remove the dead `getBoundingClientRect` branch in `syncArchiveMiniBar`.

**Expected effect:** at most one read/write per frame.

**Regression risk:** very low.

**Visual risk:** none.

**Must preserve:** when the mini-bar shows and hides, and its ARIA state.

**Acceptance criteria:** LayoutCount during the archive scroll ≤ 50% of baseline.

**Playwright verification:** a scroll test asserts the mini-bar toggles at the same threshold.

**Performance verification:** `scrolltrace.mjs`.

**Dependencies:** none.

---

### [x] PERF-P3-04 — Remove the broken nomodule reference on standings

> **Done.** `validate-public-artifact` passes; no reference remains.

**Surface:** `/standings/`.

**Metric affected:** a failed request on legacy browsers; artifact validity.

**Baseline evidence:** `standings/index.html:503` references `standings-nomodule.min.js`, which is not built or published (the audit route check shows it missing).

**Root cause:** stale markup.

**Files:** `standings/index.html`.

**Exact change:** delete the `nomodule` `<script>`. Modern browsers already ignore it, and no supported target needs it (esbuild targets ES2019+ with modules).

**Expected effect:** no 404 on legacy browsers.

**Regression risk:** none for supported browsers.

**Visual risk:** none.

**Must preserve:** the module script.

**Acceptance criteria:** `validate-public-artifact` passes; no reference remains.

**Playwright verification:** standings screenshots.

**Performance verification:** n/a.

**Dependencies:** none.

---

### [x] PERF-P3-05 — Stop publishing dead scripts and background images

> **Done.** `dist/`: 2,996 → 2,974 files, 165.70 → 163.11 MB. Both scripts were deleted (source, min and map), and the `images/bg` entries were removed from the artifact allowlist, the validator's required list, the minify inputs and the size-guard lists (the thresholds themselves are unchanged). The `images/bg` source files remain in the repo. `quality:static` lists files with `git ls-files`, so it passes only once the deletions are committed (verified against a temporary index).

**Surface:** deploy artifact (not runtime).

**Metric affected:** deploy size and time.

**Baseline evidence:** no HTML page loads `scripts/hero-background-init.js` or `background-randomizer.js`. The 20 `images/bg` files (2.4 MB) are referenced only by the former and are allowlisted in `public-artifact.mjs:100-119`.

**Root cause:** leftovers.

**Files:** `scripts/build/public-artifact.mjs`, `scripts/build/minify.mjs`, `scripts/perf/size-guard.mjs` (remove the list entries; do not change thresholds).

**Exact change:** drop them from the minify inputs and the artifact allowlist.

**Expected effect:** about 2.4 MB smaller `dist/`.

**Regression risk:** low. First confirm no inline or CSS reference to `images/bg`.

**Visual risk:** none.

**Must preserve:** every referenced image.

**Acceptance criteria:** `validate-public-artifact` (reference check) passes; screenshot parity.

**Playwright verification:** `qa:visual`.

**Performance verification:** `dist/` size.

**Dependencies:** none.

---

### [x] PERF-P3-06 — Minify `debrief-cache.json` whitespace

> **Done.** The writer emits compact JSON, and the committed cache was re-serialized (asserted deep-equal): 763,006 → 475,289 B raw (−37.7%). Transferred size went from 59.7 to 48.6 KB (gzip −11 KB, about twice the estimate). Debrief screenshots are identical at m390 and d1440.

**Surface:** `/standings/?tab=debrief`.

**Metric affected:** raw bytes and parse time (gzip gain is small).

**Baseline evidence:** 763,008 B raw / 58.3 KB transferred; about 288 KB of the raw size is indentation.

**Root cause:** pretty-printed output from `standings/debrief-cache.js`.

**Files:** `standings/debrief-cache.js`.

**Exact change:** `JSON.stringify(data)` with no indent argument.

**Expected effect:** about 38% smaller raw file and faster `JSON.parse`; gzip about −5 KB.

**Regression risk:** none (same data).

**Visual risk:** none.

**Must preserve:** the data contract.

**Acceptance criteria:** `validate-data-contracts` passes; the rendered debrief is identical.

**Playwright verification:** debrief screenshots.

**Performance verification:** probe debrief bytes.

**Dependencies:** none.

---

### [x] PERF-P3-07 — [OPTIONAL] Trim `bootstrap.slim` to the selectors actually used

> **Done (owner approved 2026-09-24).** An audit against every token in `dist` HTML/JS (author tools and JS-built markup included) found only `.row`, `.col-12`, `.col-md-4`, `.col-md-6`, `.col-lg-4`, `.text-center`, `.py-4`, `.py-5`, `.mt-3`, `.mt-5`, `.mb-4`, `.alert` and `.alert-danger` in use, plus containers, `.visually-hidden`, reboot and the root variables. No display, justify, align, colour, gutter, offset, row-cols or spinner class is used anywhere. The SCSS now configures the four kept utility families to their used values (non-responsive), generates only the five used column classes via Bootstrap's own mixins instead of `make-grid-columns()`, emits only `.alert-danger` by narrowing `$theme-colors` around the alert import, and drops spinners. No purge dependency was added. Static parity after lightningcss minification: all 107 live rules are byte-identical, in the same order and `@media` context, and nothing new was added. Size: 39,627 → 13,084 B raw, 7,089 → 3,728 B gz on every Bootstrap route (−3.4 KB gz against the 5–6 KB estimate). Full-page parity covered 20 routes (author tools, legal and error pages, standings tabs) × 3 widths × 2 themes and is clean: every difference either also appears when the baseline is compared with itself, or vanishes on re-capture (lazy sponsor-logo paint timing).

**Surface:** all Bootstrap routes.

**Metric affected:** render-blocking CSS.

**Baseline evidence:** coverage shows 83–84% of `bootstrap.slim.min.css` (39.6 KB raw) unused on every route.

**Root cause:** the whole slim build ships.

**Files:** `styles/vendor/bootstrap.slim.scss`.

**Exact change:** remove unused Bootstrap partial imports from the slim SCSS entry (grid/utilities audit), one partial at a time with screenshot diffing. Do not add a purge dependency.

**Expected effect:** about 5–6 KB gzip less blocking CSS per route.

**Regression risk:** medium–high (author tools and legacy classes).

**Visual risk:** medium–high. Optional, and only with a full screenshot and interaction matrix.

**Must preserve:** everything.

**Acceptance criteria:** full screenshot parity, including author tools.

**Playwright verification:** full matrix plus the tools.

**Performance verification:** CSS bytes per route.

**Dependencies:** PERF-P2-03.

---

### [x] PERF-P3-08 — `modulepreload` the standings shell's static chunks

> **Done; the expected row-time gain did not materialize.** `minify.mjs` records the shell's static-import closure from the esbuild metafile (`staticImports` in the manifest). `stamp-html` writes it as a marker-bounded modulepreload block and fails if the list or its anchor is missing. On Slow 4G m390 the chunks now start at 488 ms instead of 887 ms and finish by about 750 ms instead of 1,181 ms. First row is unchanged (medians 1,320 → 1,325 ms) because the module runs at DOMContentLoaded, after the `defer` queue, and `cookie-consent.min.js` arrives last at about 1,316 ms. FCP median improved 1,232 → 1,172 ms and blocking CSS finished 1,051 → 987 ms, so there is no bandwidth-contention regression. Lazy tabs are still dynamic imports and are not preloaded.

**Surface:** `/standings/`.

**Metric affected:** JS waterfall depth (the time to rendered rows).

**Baseline evidence:** only `standings.min.js` is modulepreloaded (`standings/index.html:41`). Its static imports (`chunks/chunk-*.min.js`) are discovered one step later.

**Root cause:** the preload is hand-written, not generated from the esbuild metafile.

**Files:** `scripts/build/minify.mjs` (emit the static chunk list), `scripts/build/stamp-html.mjs` (write the modulepreloads).

**Exact change:** add `<link rel="modulepreload">` for the shell's static-import chunks only (not the lazy tabs).

**Expected effect:** rows render about one RTT earlier (about 150 ms on Slow 4G).

**Regression risk:** low (chunk names are content-hashed; generate the list, don't hand-write it).

**Visual risk:** none.

**Must preserve:** lazy tab loading.

**Acceptance criteria:** the chunks start downloading in parallel with the shell (resource timing).

**Playwright verification:** standings screenshots.

**Performance verification:** probe standings (time to first table row).

**Dependencies:** PERF-P1-01.

---

## Suggested order

1. **Gates first:** P2-08, then P2-07.
2. **Articles:** P0-01, P0-02, P0-03 (these share an article regeneration; they can land as a sequence of commits in one build).
3. **Service worker:** P0-04 + P1-02 (with the SW part), then P2-09.
4. **Standings and fonts:** P1-01, P1-03.
5. **Everything else** in listed order.

**[DECISION]** and **[OPTIONAL]** items wait for the owner.

**Counts:** P0 = 4 · P1 = 6 · P2 = 11 (2 of them [DECISION]) · P3 = 8 (1 [OPTIONAL])
