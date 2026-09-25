# F1 Stories: Final Performance Audit (adversarial review)

- **Date:** 2026-09-25
- **Branch:** `perf/perf-boost`: HEAD `9fe2f65` plus the uncommitted step 3 and step 4 changes and the step 4 follow-ups.
- **Baseline:** `PERFORMANCE_AUDIT.md` (2026-09-23, `31da787`).
- **Scope:** read-only. No code was changed for this review. The only file written is this one.

## Verdict

**The site is genuinely faster, and no regression was found.**

Every comparison below runs the **same harness on the same machine, on the same day, back to back**: the original baseline build (`31da787`, fingerprinted by `article-script.min.js?v=367c0e4b`, the stamp the baseline audit recorded) and the current build. The re-measured baseline matches the numbers recorded in `PERFORMANCE_AUDIT.md` (article normal m390 LCP 3,016 ms now vs 3,024 ms recorded; generate CLS 0.564 vs 0.564). The harness is stable, so the deltas are real.

- **Phone LCP improved on every surface**, by 23–48%. The four worst pages in the baseline (three articles and the embeds article) improved the most: by 800 ms to 1.4 s.
- **CLS is effectively eliminated on articles and author tools.** For example, long article m390 went 0.207 → 0.001 and generate 0.564 → 0.002.
- **Standings still has a small, deterministic CLS**: 0.040 cold, 0.065 warm, down from 0.126 and 0.262 (P2-1).
- **The one high-impact remaining problem is P1-1.** The embeds article still loads a YouTube player (1.07 MB) and contacts `doubleclick.net` before consent on an unscrolled load. Third-party weight on that page did fall from 4.5 MB to 1.2 MB.
- **Checked and clean:**
  - The stale service-worker bug is fixed.
  - Warm loads are no slower with the SW, and 2× faster once the HTTP cache has expired.
  - Interactions, scrolling and theme or menu latency are unchanged.
  - Accessibility scores are unchanged.
  - No broken images, and no quality reduction.
  - Settled rendering is pixel-identical.

## Method

**Tools.**
- **Playwright + CDP** did every measurement, using the **baseline audit's own harness** (`probe.mjs`, copied unchanged) plus targeted probes (all in the session scratchpad):
  - `embedbytes.mjs`: third-party bytes across all frames.
  - `warmsw.mjs`: SW vs no-SW warm reloads.
  - `warmcls.mjs`, `abovetitle.mjs`, `whatat.mjs`: layout-shift root causes.
  - `phasecheck.mjs`: font-loading phases.
  - `brokenimg.mjs`, `audit-dups.mjs`.
  - `swtest.mjs`: the baseline's own simulated-deploy test, run unchanged.
- **Lighthouse 12:** the repo's `lighthouse-guard.mjs`, run on both builds.
- **Graphify / code reading:** ownership of the re-render and SW paths.
- **Agent Skills:** *performance-optimization* (measure, then attribute).
- **Ponytail:** findings name the smallest root-cause fix.
- **Impeccable / Taste / DESIGN.md / KEEP.md:** design guards. Entrance fades, grain and the typography are treated as design, and nothing that is design is reported as a defect.

**Profiles** (identical to the baseline audit):

| Profile | Viewport | DPR | CPU | Network |
|---|---|---|---|---|
| m390 | 390×844 | 3 | ×4 | Slow 4G (150 ms, 1.6 Mbps) |
| t768 | 768×1024 | 2 | ×2 | 4G (60 ms, 9 Mbps) |
| d1440 | 1440×900 | 1 | ×1 | unthrottled |

**How each run works.**
- 3 reps (median) per page and profile.
- Consent is pre-declined, the SW is allowed, and third parties are live, as in the baseline.
- Rep 0 also scrolls (rAF frames), measures the menu and theme interactions, and does a warm reload.

**CLS** is web-vitals session windows over **all** shifts. As the baseline audit notes, Chrome's mobile emulation flags early shifts as `hadRecentInput`; the "no-input" CLS is shown where it matters.

**Comparability caveats.**
- Third-party APIs are live, and Jolpica returned some 429s on article runs. They affect standings' live refresh (see P3-2) but not the lab metrics.
- Desktop (d1440) is unthrottled localhost, so its timings are tens of milliseconds and only its CLS and bytes are meaningful.

## Before, current and delta

### Phones (m390, cold)

| Page | FCP (ms) | LCP (ms) | CLS | Transfer | Requests |
|---|---|---|---|---|---|
| Home | 1,244 → 928 (**−25%**) | 1,244 → 928 (**−25%**) | 0.001 → 0.001 | 366 → 364 KB | 29 → 30 |
| Blog archive | 1,248 → 916 | 1,468 → 1,168 (**−20%**) | 0.001 → 0.001 | 162 → 150 KB | 27 → 27 |
| Article normal | 1,216 → 840 | **3,016 → 1,860 (−38%)** | **0.077 → 0.001** | **592 → 279 KB** | 57 → 48 |
| Article long | 1,320 → 1,016 | 2,368 → 1,572 (−34%) | **0.207 → 0.001** | 352 → 217 KB | 30 → 28 |
| Article image-heavy | 1,284 → 848 | 2,188 → 1,144 (**−48%**) | 0.090 → 0.001 | 490 → 391 KB | 31 → 29 |
| Article embeds | 1,364 → 868 | **3,596 → 2,200 (−39%)** | 0.111 → 0.001 | 524 → 305 KB ¹ | **161 → 47** |
| Standings | 1,276 → 996 | 1,276 → 996 (−22%) | 0.126 → **0.040** | 186 → 185 KB | 39 → 50 ² |
| Authors | 1,040 → 748 | 1,040 → 748 (−28%) | 0.016 → 0.001 | 155 → 154 KB | 22 → 22 |
| Generate (tool) | 1,916 → 1,008 | 1,916 → 1,008 (−47%) | **0.564 → 0.002** | **821 → 313 KB** | 37 → 36 |
| Housekeeping (tool) | 1,840 → 916 | 2,640 → 2,056 (−22%) | 0.137 → 0.032 | 308 → 270 KB | 31 → 30 |

¹ Resource timing can't see bytes downloaded inside cross-origin iframes. The measured third-party total is in *Third parties* below.
² See P3-2: 10 headshots are re-requested from cache (0 bytes) after the live refresh.

**TBT** is 0 everywhere except the long article (30 → 32 ms, one ~80 ms task, unchanged). **DOM nodes** dropped 9–27% on every page (the inline sprite is now subset per page).

### Tablet (t768) and desktop (d1440), cold

| Page | t768 LCP (ms) | t768 CLS | d1440 CLS | d1440 transfer |
|---|---|---|---|---|
| Home | 460 → 332 | 0.033 → 0.001 | 0.016 → 0.000 | 237 → 205 KB |
| Blog archive | 540 → 432 | 0.001 → 0.001 | 0.000 → 0.000 | 215 → 205 KB |
| Article normal | 788 → 452 | **0.162 → 0.001** | 0.007 → 0.002 | 248 → 191 KB |
| Article long | 676 → 560 | **0.356 → 0.001** | 0.032 → 0.002 | 352 → 217 KB |
| Article image-heavy | 612 → 456 | 0.176 → 0.001 | 0.008 → 0.002 | 392 → 360 KB |
| Article embeds | 772 → 456 | 0.181 → 0.001 | 0.005 → 0.005 | 339 → 225 KB |
| Standings | 468 → 380 | 0.053 → 0.004 | 0.046 → **0.025** | 186 → 185 KB |
| Authors | 408 → 288 | 0 → 0 | 0.004 → 0.000 | 183 → 181 KB |
| Generate | 684 → 324 | **0.690 → 0.001** | 0.037 → 0.010 | 821 → 313 KB |
| Housekeeping | 876 → 648 | 0.054 → 0.008 | 0.124 → 0.006 | 308 → 270 KB |

Home t768 image bytes rose (187 → 239 KB) because the lazy YouTube thumbnail, which sits at the lazy-load boundary, loaded inside the probe window this time. It varies with timing and isn't a regression (it also varied within step 4's runs).

### Warm loads and the service worker

| Check | Before | Current |
|---|---|---|
| SW controls public routes | only after visiting `/authors/` or `/privacy/` | every route |
| Stale CSS after a deploy (the baseline's own `swtest.mjs`) | **old body on every reload, indefinitely** | **new body on the first load** (`hasNew: true` on both loads) |
| Warm reload within 10 min, long article, m390 (same build, SW vs no SW, 5 reps) | 332 ms FCP (no SW) | 340 ms FCP (SW): noise |
| Warm reload after the HTTP cache expires (`max-age=0`), same test | 672 ms FCP (no SW) | **344 ms** FCP (SW) |
| Warm CLS, articles m390 (harness) | 0.076–0.159 | 0.000 |
| Warm CLS, standings m390 | 0.262 | 0.065 (P2-1) |

The harness's single-run warm FCPs differ by −28 to +72 ms. The controlled 5-rep test above shows these are noise, not SW overhead.

### Third parties (embeds article `20260422G`, m390, cold and unscrolled, all frames counted)

| | Before | Current | Delta |
|---|---|---|---|
| Third-party requests | 130 | 19 | −85% |
| Third-party bytes | **4,528 KB** | **1,211 KB** | −73% |
| Instagram / Threads / Sketchfab at load | 1.7 MB | 0 (load on approach) | removed |
| YouTube player at load | 1,072 KB | **1,073 KB** | unchanged (P1-1) |
| `googleads.g.doubleclick.net`, `static.doubleclick.net` before consent | yes | **yes** (P1-1) | unchanged |

### Interactions and scrolling (rep 0; event duration, ms)

- **Menu open:** 32–40 → 32–40.
- **Theme toggle:** 16–48 → 16–48.
- **Scroll:** frame p95 16.7–16.8 ms on every page, before and after. Frames over 50 ms went from 2 (baseline, image-heavy and embeds) to **0**. A single 33 ms frame appeared once on standings m390 and once on authors t768; these are single frames with an unchanged p95.

### Lighthouse: the same guard on both builds, same day, mobile simulated, median of 3

| Route | Perf | LCP (ms) | CLS | TBT | A11y |
|---|---|---|---|---|---|
| Home | 97 → 98 | 2,404 → 2,254 | 0.003 → 0.000 | 0 → 0 | 100 → 100 |
| Blog | 97 → 99 | 2,405 → 2,103 | 0.001 → 0.001 | 0 → 0 | 100 → 100 |
| Standings | **85 → 97** | 2,403 → 2,402 | **0.240 → 0.003** | 0 → 8 | 100 → 100 |
| Article (`20260923G` in both) | 92 → 97 | 2,705 → 2,403 | 0.096 → 0.001 | 12 → 0 | 90 → 90 |

- **Standings LCP.** Lantern's simulated LCP is flat on standings (2,403 → 2,402 ms), while real throttled Chrome shows −22% there. Step 4 traced this: Lantern mostly ignores the CSP-meta preload-scanner hold that step 4 removed. **Lighthouse understates the gain; it doesn't hide a regression.**
- **Article a11y 90 on both builds.** The two failing audits are identical (`aria-hidden-focus` on the mini-bar, and `color-contrast` on `.author-title`), so this is not a regression. See P2-4.

## Findings

### P0: regressions or breakage

**None found.** What was checked:
- **Rendering:** all 10 pages × 3 viewports, cold and warm, with third parties live. Settled pixel parity is 0.000% across 5 routes × 3 widths × 2 themes, with a base-vs-base noise floor of 0.000%.
- **Performance and delivery:** LCP resource priority (every LCP image is high-priority and preloaded with a matching `imagesrcset`); image resolution (every "under-resolved" image is identical in the baseline, because the source files are small); broken images (the only zero-size `<img>` is the hidden lightbox placeholder `src=""`, which makes no request); the service worker's stale-asset behaviour.
- **Tests and pages:** fonts across forced loading phases, the theme before first paint (44/44 checks), consent (`test:consent`), the standings memo checks from step 3, and the author tools' load.

### P1: high-impact remaining problems

**P1-1. YouTube still loads eagerly, with ad and tracking origins before consent, on embed articles.**

*Evidence:*
- `20260422G`, m390, cold, **no scroll**: `www.youtube.com` 9 requests / 1,073 KB, plus `googleads.g.doubleclick.net` (2), `static.doubleclick.net`, `jnn-pa.googleapis.com` and `www.google.com`, with consent pre-declined.
- The same happens at t768 and d1440.
- The iframe has `loading="lazy"` but sits at y≈1,331 px. That is inside Chrome's native lazy-load distance (1,250–2,500 px depending on connection), so it loads immediately.

*Why it matters:*
- PERF-P0-03 promised "no third-party ad origins contacted unless the reader scrolls to the video". That isn't achieved for any video in the first ~2 screens, and roughly 8 articles carry YouTube.
- It is also the largest single payload left on any public page: 1.07 MB of a 1.5 MB total.

*Smallest fix (owner decision; P0-03 deliberately deferred it):* a click-to-load facade (poster from `i.ytimg.com` plus a play button, iframe inserted on click), and/or `youtube-nocookie.com`. A tighter `IntersectionObserver` for YouTube (the pattern the social SDKs already use) would help videos further down, but not one at y≈1,300.

### P2: worthwhile remaining optimizations

**P2-1. Standings still shifts on phones: 0.040 cold, 0.065 warm (deterministic), 0.025 on desktop.** Down from 0.126 / 0.262 / 0.046. The desktop value is above the 0.02 Lighthouse budget in this harness. Two causes, both pre-existing:

1. **The masthead kicker re-wraps (about 0.045 warm, 0.019 cold).**
   - `div.standings-edition` holds two uppercase, letter-spaced spans ("F1 STORIES / RACE DESK", "ΒΑΘΜΟΛΟΓΙΕΣ & ΑΝΑΛΥΣΗ"). They are 38 px tall (2 lines) in fallback metrics and 19 px (1 line) in Plex. Everything below moves 19 px.
   - It happens **even on a warm, fully cached reload** (at about 85 ms), because a cached web font still loads asynchronously and the first frame is painted in the fallback.
   - The step 4 fallback faces are calibrated on mixed-case article text, so they don't match wide uppercase.
   - Smallest fix: reserve the final one-line height (`min-height`), or `white-space: nowrap` if the spans fit on one line in Plex at the narrowest supported width (not verified at 320 px).
2. **The report-meta status line re-wraps (about 0.02).** `#standings-report-meta-status` ("Βαθμολογία πρωταθλήματος · Jolpica F1 · …") moves its source links down 18 px when the data-source text fills in. Fix: reserve its final line count, or keep the source text static.

**P2-2. Article LCP is paced by the hero's entrance fade.**
- `article-editorial-enter` runs 0.8 s after a 0.12 s delay, from opacity 0.
- On m390 the hero image is usually decoded before first paint, yet LCP lands about 300 ms after FCP: normal article 840 → 1,860 ms includes the fade. The archive lead card behaves the same way (`archive-enter`, 0.6 s).
- It's designed motion (`KEEP.md`), so this is an owner decision, not a defect. A fade starting at opacity 0.01 would look the same and let Chrome report LCP at first paint. Step 4 measured the effect with a filmstrip: the pixels are identical, only the metric moves.

**P2-3. Clients controlled by the old v41 service worker keep its stale-asset behaviour until the new worker activates.**
- The fix lives in the **new** `sw.js`.
- The new worker waits for the update banner's "Reload" (or for every tab to close) before activating.
- Until then, visitors already controlled by the baseline v41 worker (anyone who opened `/authors/` or `/privacy/` before) get the new HTML with their old SW's pathname-matched shell CSS/JS, which is the bug the baseline audit proved.
- One-time and transitional. Mitigation for that single deploy: `self.skipWaiting()` in `install` (caches are version-named, so activation purges v40 cleanly).
- Evidence: the baseline `swtest.mjs` result in `PERFORMANCE_AUDIT.md` §9, plus the waiting-activation logic in the current `sw-register.js` / `sw.js`. Not re-run as a two-version upgrade test.

**P2-4. The Article accessibility gate is red (90 < 98) on both builds.** Same two audits: the mini-bar is `aria-hidden="true"` with a focusable share button, and `.author-title` fails contrast. It's pre-existing, but it keeps `npm run verify` red. It is accessibility, not performance.

### P3: micro-optimizations

**P3-1. Lazy images inside the first viewport (all identical in the baseline):**
- archive at t768/d1440: the author avatars strip and the second card;
- `/authors/` at d1440: `SV.webp`;
- housekeeping: its first card.

Each is under 10 KB, so the cost is a later start, not bytes.

**P3-2. Standings' live refresh re-renders the whole table even when the data equals the snapshot.**
- By design (`standings.js:1015`: "Πηγή" cells follow the source).
- That rebuilds the rows and re-requests the 10 headshots. The repeats are HTTP-cache hits (0 bytes), so the cost is the DOM rebuild.
- Unchanged code since the baseline. The baseline run's lower request count reflects a different live-API outcome (Jolpica 429s), not different code.
- Updating only the "Πηγή" cells would avoid it.

**P3-3. Author-tool avatars at desktop** are 168 px files shown at 40 px (4.2×), about 3 KB each. Down from 1,024 px files; not worth more work.

**P3-4. The Article Lighthouse LCP flips between two quantized values (2,403 / 2,554 ms) around the 2,500 ms budget on both builds.** It makes `perf:lighthouse` flaky, not the page slower: real throttled Chrome is 1,172 ms (step 4 probe) to 1,860 ms (this harness, with third parties live). Options: 5 runs, or a budget with headroom.

**P3-5. `perf:article-media` fails on two `20260918W` WebP originals over 1 MB** (pre-existing). They are the non-AVIF / lightbox sources; phones get the AVIF.

## Items specifically checked and cleared

| Concern from the brief | Result |
|---|---|
| Regressions hidden by Lighthouse | None. Lighthouse *understates* the gains (Lantern ignores the preload-scanner hold) |
| Layout shifts | Removed on articles, tools, home, archive and authors. Standings residual: P2-1 |
| Delayed content | None. The standings table renders from the snapshot; the home hero now makes no redundant attribute writes |
| Lazy-loading mistakes | Only the pre-existing P3-1, plus YouTube loading *too early* (P1-1) |
| LCP resource deprioritization | None. Every LCP image is high-priority with a matching preload |
| Broken image loading | None (the lightbox placeholder is hidden and makes no request) |
| Stale service-worker behaviour | Fixed and re-proven with the baseline's own test. Transitional caveat: P2-3 |
| Interaction delay / menu lag / theme lag | Unchanged (menu 32–40 ms, theme 16–48 ms) |
| Scroll jank | None. p95 16.7–16.8 ms and 0 frames over 50 ms (was 2) |
| Fonts flashing or swapping badly | Font-phase mismatches down 15 → 5 (forced all-fallback phase) and 6 → 3 (forced Greek-only phase); the rest is P2-1 |
| Third-party blocking | Nothing third-party is render-blocking. YouTube: P1-1 |
| Visual differences | 0.000% settled parity; `qa:visual` passes |
| Reduced image quality | None. Resolution ratios are identical to the baseline; avatars exactly match 56 px × DPR 3 |
| Accessibility regressions | None. Scores are identical on all routes (P2-4 is pre-existing) |
| Functionality changed for performance | Only the owner-approved changes: the PWA install banner was removed, the SW is sitewide, unscrolled embeds print as links, and the standings stale label is shorter. Analytics' internal-link tracking no longer delays navigation by up to 250 ms; it relies on GA4's default beacon transport to survive the unload (not verified against GA4 in this review) |

## Not done

- Production Lighthouse (not deployed).
- A two-version SW upgrade test (P2-3 is inferred from the proven v41 behaviour plus the activation logic).
- Standings data tabs (dirty-air, debrief), which step 3 covered.
