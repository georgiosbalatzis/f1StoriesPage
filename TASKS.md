# F1 Stories — Professionalization Tasks

This is the implementation plan for `REDESIGN_AUDIT.md`. The rules come from `DESIGN.md` and `KEEP.md`, and the build constraints from `REDESIGN_BASELINE.md`.

Every task **professionalizes the existing implementation**. No task introduces a new brand concept, palette, typeface, visual identity or framework.

Tasks are ordered by dependency: the build prerequisites and verification harness come first, then shared tokens and components, then page-level fixes, then polish. Audit finding IDs appear in brackets, e.g. `[P0-01]`.

---

## Conventions

### Working rules (apply to every task)

1. **Source-only diffs.**
   - Until GLOBAL-01 lands, don't run `npm run build`, `build:assets` or `stamp-html.mjs` locally. They rewrite 37 shell references and 352 articles (baseline §3 ⚠️2).
   - Edit source CSS, JS and templates only.
   - For a local preview, run `node scripts/build/minify.mjs`, which writes only ignored files.
2. **Generated HTML is never hand-edited.** That means the areas inside `@include`, `f1s:icon-sprite`, `f1s:hero-*` and `?v=` markers, and every `blog-entries/*/article.html`. Change the template or build module instead, and let `npm run build:public` or CI regenerate.
3. **Article markup changes** require `node blog-module/build/__tests__/run-golden.js --update`, then a review of the golden diff, then `npm run test:blog`.
4. **Data-contract changes** (new or changed fields in `blog-index-data.json`, `home-latest.json`, standings caches) must update `scripts/build/validate-data-contracts.mjs` and `docs/data-contracts.md` in the same change.
5. **Budgets:** run `npm run perf:budget` after CSS or JS changes. If it grows, update it with `perf:budget:update` and a one-line justification in the PR.
6. **Nav or menu markup** lives in about 8 shells plus `blog-module/blog/template.html`, and is baked into 352 articles. Prefer CSS-only solutions. A markup change also requires the `scripts/build/article-editorial.mjs` migration path.

### Verification

- **Server:** `node scripts/serve-site.mjs` (http://127.0.0.1:4173).
- **Captures:** `node perf/visual-qa/redesign-audit/audit.mjs [route]` writes section crops, UI states and `metrics.json`. Before and after evidence use the same filenames.
- **Assertions:** GLOBAL-02 adds `perf/visual-qa/redesign-audit/checks.mjs`, where each task's machine-checkable criteria are written as named checks. `node …/checks.mjs <CHECK-ID>` prints PASS or FAIL.
- **Viewports** are always checked in the order **390×844 → 1440×900 → 768×1024**, and in **both themes** unless a task says otherwise. The theme is forced with `localStorage['f1stories-theme']`, and consent is pre-accepted.
- **Playwright verification state** in each task lists:
  - **Now:** the current failing evidence file(s) from the audit.
  - **Check:** the check ID(s) to add to `checks.mjs`.
  - **Done when:** the expected passing state.
- **Release gate** before merging each phase: `npm run verify`. Run it only on a branch after GLOBAL-01, or in CI.

### Priority

P0 = visibly broken on a core surface · P1 = clearly unprofessional or a WCAG AA failure · P2 = noticeable inconsistency · P3 = polish.

---

## Dependency graph (summary)

```
GLOBAL-01 (stamps/sprite) ─┬─> every task that needs a local full build or regenerated shells
GLOBAL-02 (checks harness) ─┴─> every task's Playwright verification
GLOBAL-03 type tokens ─────┬─> A11Y-01, A11Y-02, DATA-04, AUTHORS-01, POLISH-01, ARTICLE-05
GLOBAL-04 radius tokens ───┼─> DATA-04, ARTICLE-05, AUTHORS-01, POLISH-01, BLOG-01
GLOBAL-05 flat/no shadows ─┼─> GLOBAL-06, GLOBAL-09, DATA-04, ARTICLE-05
GLOBAL-06 button roles ────┼─> ARTICLE-03, ARTICLE-06, DATA-05, POLISH-01, HOME-03
GLOBAL-07 font coverage ───┼─> GLOBAL-10, POLISH-02 (soft: DATA-01, DATA-02)
GLOBAL-08 Greek display ───┼─> DATA-08, AUTHORS-01, HOME-05, ARTICLE-03
RESP-02 image srcset ──────┴─> BLOG-01 (needs final image heights)
ARTICLE-01 ─> ARTICLE-02 ─> ARTICLE-06
A11Y-01 ─> HOME-02
DATA-04 ─> A11Y-02
```

---

## Phase 0 — Prerequisites

### - [x] GLOBAL-01 — Normalize the generated stamps and the inline icon sprite
- **Status (2026-09-22): DONE.** Root cause: CI's blog workflow commits only blog artifacts, while Pages builds `dist/` fresh. The committed shells were therefore stale; production was never wrong. Local minify output reproduces the already-current `privacy.html` stamps, so no Node pin was needed. Ran sprite → minify → stamp. The `stamp-html --dry` diff is now 0. `check-generated-assets.mjs` now fails when an icon reference has no inlined symbol (proven against the old `index.html`: `#fa-play`). **The generated drift is still uncommitted** (not asked to commit); it lands with the GLOBAL source changes.
- **Priority:** P1 (it blocks reviewable diffs). It also resolves `[P3-02]`.
- **Affected surfaces:**
  - all 14 stamped shells: `index.html`, `offline.html`, `404.html`, `authors/`, `standings/`, `blog-module/blog/index.html`, `blog-module/blog/template.html`, `privacy/*`, `f1telemetry/`, `ghostcar/`, author tools
  - the 352 articles, through the shell migration
- **Viewport:** n/a (build). Visible result: the home YouTube play glyph.
- **Current problem:**
  - The committed shells reference `?v=` hashes that a fresh local `minify.mjs` doesn't reproduce (e.g. `styles.min.css?v=9c6508cb` vs `0c0b5f47`).
  - `stamp-html.mjs --dry` plans 37 rewrites plus an inline-runtime migration of all 352 articles.
  - The inline sprite in `index.html` (`data-hash="94e0743f"`) has no `fa-play` symbol, so the facade play button is a blank disc.
- **Exact root cause:**
  - The CI and local minify outputs differ, or the shells were stamped from an older manifest.
  - The sprite inlined into the shells predates the `fa-play` usage.
  - `build-icon-sprite.mjs --dry` does detect `play` (70 icons).
- **Files:** `scripts/build/stamp-html.mjs`, `scripts/build/minify.mjs`, `scripts/build/build-icon-sprite.mjs`, `scripts/build/check-generated-assets.mjs`, plus the generated regions of the shells and articles listed above
- **Exact implementation requirement:**
  1. Find out why the hashes differ: compare `node --version`, the `lightningcss` / `esbuild` versions from the lockfile, and the Browserslist target, locally vs CI (`.github/workflows/deploy-pages.yml`). Pin whatever differs, e.g. `engines.node` and CI `node-version`.
  2. On a dedicated branch, run `npm run build:public` once and commit **only** the generated drift, with the message `chore(build): normalize generated stamps and sprite`.
  3. Extend `check-generated-assets.mjs`: every `<use href="#fa-X">` in each `SPRITE_TARGETS` shell must have a matching `<symbol id="fa-X">` in that file's inline sprite. Fail the check otherwise.
- **What must not change:**
  - article body content
  - CSS or JS source
  - which assets are loaded
  - visual output, apart from the play glyph appearing
- **Acceptance criteria:**
  - After the commit, `npm run build && npm run build:check` on a clean checkout reports "generated artifacts synchronized".
  - `stamp-html.mjs --dry` plans 0 rewrites.
  - The new sprite-symbol check passes.
  - The play triangle is visible in `.home-video-facade__play`.
- **Playwright verification state:**
  - **Now:** `home-390-dark--latest.png`, `home-1440-dark--latest.png` (blank disc)
  - **Check:** `SPRITE-SYMBOLS` (every `use[href^="#fa-"]` resolves to a `symbol` in the DOM) on the 5 routes
  - **Done when:** PASS, and the recaptured `home-*--latest.png` shows the glyph
- **Dependencies:** none. **Everything else depends on it** for local full builds.

### - [x] GLOBAL-02 — Assertion harness for this plan
- **Status (2026-09-22): DONE.** `perf/visual-qa/redesign-audit/checks.mjs` implements the 15 GLOBAL checks (`--global`); later IDs are listed as pending. `audit.mjs` accepts `OUT_DIR`. The before/after runs are in `perf/visual-qa/redesign-audit/` and `perf/visual-qa/redesign-global/`.
- **Priority:** P1 (enabler)
- **Affected surfaces:** tooling only (`perf/visual-qa/redesign-audit/`, gitignored)
- **Viewport:** 390, 1440, 768 × dark and light
- **Current problem:** The audit's image-resolution, font-fallback and related-card probes were one-off scratch scripts. Acceptance criteria can't be re-run.
- **Exact root cause:** There's no persistent assertion layer. `scripts/perf/visual-qa.mjs` only covers generic smoke, contrast and focus checks against `dist/`.
- **Files:** `perf/visual-qa/redesign-audit/checks.mjs` (new, ignored), reusing `perf/visual-qa/redesign-audit/audit.mjs` helpers
- **Exact implementation requirement:**
  - A Playwright (`playwright-core` + `chrome-launcher`) runner that takes check IDs, loads the preview, forces theme and consent, and prints PASS/FAIL with measured values.
  - Implement the checks named in this document's "Check:" fields, in the order the tasks need them. Start with `IMG-RES`, `FONT-PLATFORM`, `NO-SHADOW`, `RADIUS-SET`, `TEXT-MIN`, `BUTTON-SIGNATURES`, `OVERLAP` and `CONTRAST-BANDS`.
  - Font checks use CDP `CSS.getPlatformFontsForNode`.
- **What must not change:** application files. This is local tooling only. Don't wire it into `npm run verify` in this plan.
- **Acceptance criteria:** `node checks.mjs --list` prints every check ID referenced in TASKS.md. Running all checks on the current tree reproduces the audit's failures.
- **Playwright verification state:**
  - **Now:** doesn't exist
  - **Check:** self-test, where all listed checks execute without a script error
  - **Done when:** it reports the expected current FAILs, e.g. `IMG-RES` fails at 0.26
- **Dependencies:** none (it can run in parallel with GLOBAL-01)

---

## Phase 1 — Shared system corrections (root causes)

### - [x] GLOBAL-03 — Type scale tokens and a 12px floor `[P2-09]`
- **Status (2026-09-22): DONE.** **Criterion revised:** ≤10 distinct sizes per route is unreachable without touching fluid display type, which this task forbids. `TYPE-SCALE` now asserts ≤3 distinct sizes below 16px (12 / 14 plus body). Outliers (.72–.95rem) were snapped to the existing .75 / .875 / 1rem steps in the editorial files and the legacy related-card, chip and ellipsis rules. Per YAGNI no new `--fs-*` tokens were added: the steps are already de-facto constants. `chart-pts-label` (9.9px) stays for A11Y-02. PASS on 4 routes × 2 themes.
- **Priority:** P2 (foundation for several P1 tasks)
- **Affected surfaces:** all editorial routes; standings reports; authors
- **Viewport:** all
- **Current problem:**
  - Home renders 16 distinct text sizes, articles 17–20 and the standings tyre report 18. Near-duplicates include 12.32 / 12.48 / 12.8 / 12.96 / 13.12 / 13.44 / 13.76px.
  - Text under 12px appears in: `.chart-pts-label` 9.9px, tyre labels 10.2–10.9px, quali tooltips 9.6px, the author badge 9.9px, related date badges 11.5px.
- **Exact root cause:** There are no size tokens in the editorial layer. Every rule sets its own `rem`, and many rules repeat `.75rem` at every breakpoint.
- **Files:** `styles/editorial.css` (tokens), `home.css`, `blog-module/blog/archive-editorial.css`, `blog-module/blog/article-editorial.css`, `standings/standings-editorial.css`, `styles/authors.css`
- **Exact implementation requirement:**
  - Add the following under the `body.editorial-page, .editorial-preview` token block: `--fs-label:.75rem; --fs-small:.875rem; --fs-body:1rem; --fs-read:1.125rem; --fs-deck:1.35rem; --fs-h3:1.25rem; --fs-h2:clamp(1.8rem,3vw,3rem)`.
  - In the editorial files, snap every raw value between `.72` and `.87rem`: `.72–.82 → var(--fs-label)` or `var(--fs-small)`, whichever is nearer; `.84–.87 → var(--fs-small)`.
  - Delete media-query redeclarations that restate the same size.
  - **Do not touch display sizes** (mastheads, hero h1, article title clamps).
  - Report-level fixes under 12px are done in DATA-04 and A11Y-02. This task only supplies the tokens and fixes the editorial files.
- **What must not change:**
  - display typography
  - body reading size (1.125rem/1.75)
  - the label style (tracked capitals at .75rem)
  - line-heights
  - IBM Plex and Barlow roles
- **Acceptance criteria:** ≤10 distinct computed text sizes on home, archive, article and authors at 1440. Screenshot diffs versus baseline show no change in display type.
- **Playwright verification state:**
  - **Now:** `metrics.json` → `fontSizes` (home 16, article 20)
  - **Check:** `TYPE-SCALE` (distinct sizes ≤10 per route)
  - **Done when:** PASS on home, blog, article and authors in both themes
- **Dependencies:** GLOBAL-02

### - [x] GLOBAL-04 — Radius and cut-corner tokens `[P2-08]`
- **Status (2026-09-22): DONE.** Added `--radius-control`, `--cut-sm/md/lg` (24/40/64px) and mapped every cut corner and control radius onto them. **Kept 4px** (`--radius-media`, documented identity). Gallery arrows moved to the square control role; the skip link uses 2px. `RADIUS-SET` PASS on 5 routes (it allows chart bar ends as data geometry).
- **Priority:** P2 (foundation)
- **Affected surfaces:** site-wide
- **Viewport:** all
- **Current problem:**
  - Computed radii in use: 1, 2, 4, 6, 12, 14, 16, 999px and 50%.
  - The identity "cut corner" takes 12 or more values: 12, 18, 26, 28, 30, 32, 36, 38, 42, 44, 62, 64, 72px.
- **Exact root cause:** Hand-picked values in each rule. `--radius-media` and `--button-radius` exist but are barely used.
- **Files:** `styles/editorial.css`, `home.css`, `blog-module/blog/archive-editorial.css`, `blog-module/blog/article-editorial.css`, `standings/standings-editorial.css`, `styles/authors.css`. `styles/legal.css` is handled in POLISH-01.
- **Exact implementation requirement:**
  - Add tokens: `--radius-control:2px; --cut-sm:24px; --cut-md:40px; --cut-lg:64px`.
  - Map the cut corners:
    - hero (72) and archive lead (62) → `--cut-lg`
    - home history treatment (64) → `--cut-lg`
    - mobile hero (42), cast #5 (44), archive lead mobile (44), related #3 (36), track-dom shell (36), author profile (38) → `--cut-md`
    - article cover (32), figures (26), gallery (30), author box (32), empty state (30), chip frame (18), secondary history (28) → `--cut-sm`
  - Controls: `1px` → `var(--radius-control)`.
  - Keep `50%` only for avatars, dots and the theme toggle.
  - Preserve the `1px 1px X 1px` shape where it exists, by writing `1px 1px var(--cut-*) 1px`.
- **What must not change:**
  - the one-corner rule (bottom-right only)
  - which elements get a cut corner
  - square photo corners
- **Acceptance criteria:** The computed radius inventory on the 5 routes is a subset of {0, 2px, 50%, `0 0 24px`, `0 0 40px`, `0 0 64px`, `1px 1px 24px 1px`, `1px 1px 40px 1px`, `1px 1px 64px 1px`}. The exception is `legal.css`, until POLISH-01.
- **Playwright verification state:**
  - **Now:** `metrics.json` → `radii`
  - **Check:** `RADIUS-SET`
  - **Done when:** PASS on home, blog, article, standings (drivers tab) and authors in both themes
- **Dependencies:** GLOBAL-02

### - [x] GLOBAL-05 — Enforce flat and matte: remove stray shadows and legacy blue `[P2-07]`
- **Status (2026-09-22): DONE.** Removed elevation from archive controls, pagination, gallery arrows, standings headshots and scroll-top. The dropdown keeps a single `0 2px 0 var(--border)`, and search focus is a ring only. The legacy `rgba(65,182,230,…)` / `#41B6E6` values (36 occurrences in 4 legacy files) are now `color-mix(var(--accent) …)`, which is on-brand wherever the editorial palette applies. Overlay surfaces (cookie banner, share toast) keep their shadow, and the quali dot glow is left for DATA-04. `NO-SHADOW` PASS.
- **Priority:** P2
- **Affected surfaces:** archive controls, chip dropdown, pagination; standings chart rows (23 shadows); article gallery arrows; scroll-top; legacy article CSS
- **Viewport:** all
- **Current problem:** Shadows found on: archive controls `0 7px 18px`, dropdown `0 18px 40px`, `.page-btn` `0 5px 14px`, standings rows `0 6px 16px` ×23, gallery arrows `0 8px 18px`, dark scroll-top `0 8px 22px`. `rgba(65,182,230,…)` borders and gradients remain in `article-styles.css:714–874`. The detector reports `thin-border-wide-shadow` and `dark-glow #41b6e6`.
- **Exact root cause:** Editorial rules re-add elevation (`archive-editorial.css` controls, `editorial.css:638` scroll-top), and legacy rules were never neutralised.
- **Files:** `blog-module/blog/archive-editorial.css`, `standings/standings.css`, `standings/standings-editorial.css`, `blog-module/blog/article-editorial.css`, `blog-module/blog/article-styles.css`, `styles/editorial.css`, `styles.css` (legacy `--border-accent`)
- **Exact implementation requirement:**
  - Set `box-shadow:none` on the listed elements.
  - Keep a single dropdown separation: `.chip-scroll-frame { box-shadow: 0 2px 0 var(--border) }`.
  - Keep search focus as a focus ring only (`0 0 0 2px var(--accent-muted)`, no drop).
  - Replace every `rgba(65,182,230,…)` with `var(--border)`.
  - Remove the blue radial and linear gradients in `article-styles.css` (lines 860 and 874).
- **What must not change:**
  - focus rings
  - the faint warm radial washes on body, nav, cover and footer (identity)
  - borders
- **Acceptance criteria:** The computed-shadow inventory on the 5 routes contains only focus rings and the one dropdown rule. `grep -rn "65, *182, *230" --include=*.css` over non-min public CSS returns 0 lines.
- **Playwright verification state:**
  - **Now:** `metrics.json` → `shadows` (blog-1440, standings-390, article-1440)
  - **Check:** `NO-SHADOW`
  - **Done when:** PASS on the 5 routes in both themes; `state-filters-open-1440.png` recaptured flat
- **Dependencies:** GLOBAL-02

### - [x] GLOBAL-06 — Three shared button roles `[P1-11]`
- **Status (2026-09-22): DONE.** `styles/editorial.css` now defines the primary role (`--btn-primary-*`, ink in light / text-primary in dark, signal on hover), the secondary role (matte `--bg-base`, 1px border, accent on hover) and disabled states. The per-route colour duplicates in home, archive, article and standings were removed; the text role stays `.cta-secondary`. Cookie accept is now primary. `BUTTON-SIGNATURES` (pooled across routes, structural signature) = 3 per theme, PASS.
- **Priority:** P1
- **Affected surfaces:** home CTAs and contact submit; archive pagination, filter reset and chips (chips keep their own style); article share, gallery and nav buttons; standings share, retry and embed; cookie banner
- **Viewport:** all
- **Current problem:** At least 8 visually distinct button implementations sit side by side (hero ink block, contact paper block, coral-tint retry, filled coral page button with inset shadow, bordered share squares, and others). The primary style exists only as `.home-page .cta-*`.
- **Exact root cause:** There's no shared button component in `styles/editorial.css`. Each route re-skins legacy classes separately.
- **Files:** `styles/editorial.css`, `home.css`, `blog-module/blog/archive-editorial.css`, `blog-module/blog/article-editorial.css`, `standings/standings-editorial.css`, `standings/standings.css`, `styles/shared-nav.css`
- **Exact implementation requirement:** Define these in `styles/editorial.css`, scoped `body.editorial-page`:
  - **Primary:** the current `.home-page .cta-primary` spec. Ink background with paper text, reversed in dark mode as today. `min-height:47px`, `padding:12px 18px`, `radius:var(--radius-control)`, `font:600 var(--fs-label)/1.4`. Hover: `--signal` background with `--ink` text. No transform, no shadow. Trailing `.icon` nudges 5px.
  - **Secondary:** transparent, 1px `var(--border)`, text primary, 44px minimum. Hover: border and text `--accent-readable`.
  - **Text:** the current `.cta-secondary` (1px bottom rule).

  Apply them to existing class names through grouped selectors. **Don't rename markup classes.**
  - Primary: `.cta-primary`, `.contact-submit`, `.cookie-btn.accept-btn`, `.page-btn.active`
  - Secondary: `.retry-btn` (and the standings error button), `.page-btn`, `.filter-reset-btn`, `.share-btn` (article and standings), gallery prev/next, `.cookie-btn`
  - Text: `.cta-secondary`

  Delete the per-route duplicates: `home.css:83-86,155-156,222-224,229-232`, the archive `.page-btn` block, the cookie duplicates in `editorial.css:476-479` vs `home.css`, and the standings `.share-btn` block.
- **What must not change:**
  - the visual spec of the hero primary and the secondary underline link
  - 44px targets
  - chip styles (they are filters, not buttons)
  - button labels
- **Acceptance criteria:** ≤3 distinct (background, border, radius, font-weight) signatures per theme across all visible buttons on the 5 routes, plus the active pagination state. The hero CTA is pixel-equal to the baseline.
- **Playwright verification state:**
  - **Now:** `state-standings-error-1440.png` (coral-tint retry), `state-pagination-1440.png`, `home-1440-dark--contact.png`
  - **Check:** `BUTTON-SIGNATURES`
  - **Done when:** PASS on the 5 routes plus the error and pagination states
- **Dependencies:** GLOBAL-03, GLOBAL-04, GLOBAL-05

### - [x] GLOBAL-07 — Font coverage for arrows and ✳, plus a Barlow/Greek guard `[P2-14]` (and the root of `[P1-04]`)
- **Status (2026-09-22): DONE.** `download-home-fonts.mjs` now fetches the Plex Arrows block (U+2190–2199, 3 KB) as `ibm-plex-sans-400-600-arrows.woff2`. It's added to `home-fonts.css`, the `sw.js` precache and `SW_VERSION` v41; the existing font files are byte-identical. **✳ (U+2733) stays on the platform fallback:** IBM Plex has no such glyph, and it's a decorative `aria-hidden` separator. `FONT-PLATFORM` passes except ✳. `BRAND-NO-GREEK` flags only `.standings-side-kicker`, which DATA-01 fixes.
- **Priority:** P2
- **Affected surfaces:** every "↗ ↙ → ←" affordance and the "✳" separators site-wide; any Greek set in `--font-brand`
- **Viewport:** all
- **Current problem:**
  - CDP shows "↗" rendered in Hiragino Sans on macOS (Segoe on Windows), so the arrows' weight and size vary by platform.
  - Greek text set in Barlow (Latin subset only) falls back to Helvetica.
- **Exact root cause:**
  - `scripts/build/download-home-fonts.mjs` subsets IBM Plex without U+2190–21FF and U+2733.
  - Nothing prevents `var(--font-brand)` from being applied to Greek text.
- **Files:** `scripts/build/download-home-fonts.mjs`, `styles/home-fonts.css`, `assets/fonts/ibm-plex-sans-400-600*.woff2`, `scripts/quality/static-source-guard.mjs`
- **Exact implementation requirement:**
  - Add `U+2190-21FF, U+2733` to the Plex latin subset request and its `unicode-range` in `home-fonts.css`. Re-download with `npm run build:fonts`.
  - Add a runtime guard (in GLOBAL-02 `checks.mjs`, not in production code): for every element whose computed `font-family` starts with "Barlow Condensed", assert the text has no Greek characters (`/[Ͱ-Ͽἀ-῿]/`).
- **What must not change:**
  - the glyphs used in markup
  - font families
  - the Barlow Latin subset
- **Acceptance criteria:**
  - The CDP platform font for "↗" and "✳" is IBM Plex Sans on the 5 routes.
  - Font payload growth is <4KB.
  - The guard flags `.standings-side-kicker` (fixed in DATA-01) and nothing else.
- **Playwright verification state:**
  - **Now:** arrows render in Hiragino Sans; `standings-1440-dark--fold.png`
  - **Check:** `FONT-PLATFORM`, `BRAND-NO-GREEK`
  - **Done when:** `FONT-PLATFORM` passes; `BRAND-NO-GREEK` passes after DATA-01
- **Dependencies:** GLOBAL-01 (a font rebuild changes stamped `?v=`), GLOBAL-02

### - [x] GLOBAL-08 — A single Greek display layer for categories, author names, dates, reading time and CTA copy `[P1-03]` (shared part), `[P2-01]`
- **Status (2026-09-22): DONE.** `taxonomy.js` gained the display layer (`categoryLabel`, `authorLabel`, `formatDate` with fixed Greek month tables, `formatReadingTime`), with unit tests in `taxonomy-display.test.js`. It's applied in `build/index.js` (archive cards, filters, hero category via `greekUpper` and hero byline), `related.js`, `article-render.js` (new articles plus `refreshArticleTaxonomy` for all existing ones, since 203 have no source), `blog-index.js` (cards, chips, summaries, search haystack), `blog-loader.js` (home now loads `taxonomy.min.js`) and the static author chips and authors-page markup. Canonical values stay in data, URLs, filters and JSON-LD. Author names are Greek per the owner, with Θέμης Χαρβάλης for Themis. `article-script.js` looks up bios by slug. CTA copy is now 'Διάβασε' / 'Εξερεύνησε'. The golden fixtures were **already failing at HEAD**; they were updated and reviewed (labels, restamped hashes, pre-existing image markup). `GREEK-LABELS`, `AUTHOR-NAME-CONSISTENT`, `DATE-FORMAT` and `CTA-COPY` PASS; `test:blog` and `test:taxonomy` pass.
- **Priority:** P1
- **Affected surfaces:** home journal, archive cards and filters, article cover, rail and related cards, authors page, home meta
- **Viewport:** all
- **Current problem:**
  - Categories are shown in English ("News", "History", "Technical · Data").
  - Author names are Latin on the archive, articles and authors page but Greek on home.
  - Reading time appears as "4 λεπ", "4 λεπτά ανάγνωσης" and "3 MIN".
  - Dates appear as "2026-09-20", "20 Σεπτεμβρίου 2026" and "15 Αυγ 2026".
  - CTA copy has four variants, mixing formal and informal address.
- **Exact root cause:** Each renderer formats labels itself. `taxonomy.js` exposes slugs as display text, `build/related.js` hard-codes "min", and author names come from different sources.
- **Files:**
  - `blog-module/taxonomy.js` (display map + `formatCategoryLabel`)
  - `blog-module/build/shared.js` (date and reading-time helpers for build)
  - `blog-module/build/related.js`, `blog-module/build/article-render.js`, `blog-module/build/metadata.js`, `blog-module/build/index.js`
  - `blog-module/blog-index.js`, `blog-module/blog-loader.js`
  - `scripts/authors.js` (canonical Greek display names)
  - `authors/index.html`, `blog-module/blog/index.html`, `index.html` (static copy only, outside generated markers)
  - golden fixtures
- **Exact implementation requirement:**
  1. **Categories.** Add a slug → Greek label map in `taxonomy.js`: news→Ειδήσεις, analysis→Ανάλυση, technical→Τεχνικά, history→Ιστορία, opinion→Άποψη, betting→Στοίχημα, drivers→Οδηγοί, teams→Ομάδες, season→Σεζόν, journal→Journal (brand word), data→Δεδομένα. Every renderer, build and client, calls `formatCategoryLabel(slug)`. Slugs, URLs, query params and CSS modifier classes (`--technical` etc.) stay unchanged.
  2. **Author names.** One `displayName` (Greek) per author in `scripts/authors.js`, consumed by the archive, articles (via build), related cards and the authors page. Slugs such as `?author=georgios-balatzis` stay unchanged.
  3. **Dates.** One helper, `formatDateEl(iso) → "20 Σεπτεμβρίου 2026"` (`Intl.DateTimeFormat('el',{day:'numeric',month:'long',year:'numeric'})`), with a compact variant for cards: `"20 Σεπ 2026"`.
  4. **Reading time.** One helper, `formatReadingTime(n) → "4′ ανάγνωση"` in compact spots and `"4 λεπτά ανάγνωσης"` in the article cover meta. Nothing else.
  5. **CTA copy and voice.** Informal singular. Every card CTA reads "Διάβασε". The archive masthead link reads "Εξερεύνησε το αρχείο". The hero CTA stays "Διάβασε την ιστορία".
- **What must not change:**
  - English brand slogans and F1 jargon ("RACE DESK", "TEAM RADIO", "THE GRID.", "EVERY POINT COUNTS.", "JOURNAL.", driver codes, "H2H")
  - category colors
  - slugs and URLs
  - the data-contract field names; add display fields only if needed, and update the contracts if so
- **Acceptance criteria:**
  - A text scan of rendered home, archive, article and authors finds no English category word outside the jargon allowlist.
  - Each author has exactly one display name across the routes.
  - One date pattern per context, one reading-time pattern per context, and one card-CTA string.
  - No second-person-plural imperatives in the UI chrome.
  - `npm run test:blog` and `test:taxonomy` pass with the updated goldens.
- **Playwright verification state:**
  - **Now:** `state-filters-open-1440.png`, `blog-390-dark--articles-grid.png`, `v-related-1440-light.png`, `authors-390-dark--author-directory.png`
  - **Check:** `GREEK-LABELS`, `AUTHOR-NAME-CONSISTENT`, `DATE-FORMAT`, `CTA-COPY`
  - **Done when:** all PASS on home, blog, article and authors
- **Dependencies:** GLOBAL-01 (regenerated articles), GLOBAL-02

### - [x] GLOBAL-09 — Scroll-to-top: square, bottom-right, never over text `[P1-09]`
- **Status (2026-09-22): DONE.** `shared-nav.css` owned the button with `!important` everywhere. It now sits centred in the right page gutter (`right: max(6px, calc((100vw - 1476px)/4 + 6px))`) as a 36px square with a 44px hit area (`::after`), and its colours come from the secondary role. The desktop threshold is 2× viewport height. The existing ≤1199px hide and footer suppression are kept. The `!important` rules for scroll-top in `editorial.css` were removed except the visibility utility. `OVERLAP:scroll-top` PASS at 768 / 1440 / 1920.
- **Priority:** P1
- **Affected surfaces:** home, blog, article (every route with the button)
- **Viewport:** 1440, 768 (390 checked for regressions)
- **Current problem:** The round 40px button fixed at bottom-left overlaps the journal lead meta and the archive excerpts (`home-1440-dark--latest.png`, `blog-1440-dark--articles-grid.png`).
- **Exact root cause:** `styles/shared-nav.css` sets `left` and `border-radius:50%`. `editorial.css:630-647` only recolors it, using `!important`.
- **Files:** `styles/shared-nav.css`, `styles/editorial.css`, `scripts/shared-nav.js` (visibility threshold only)
- **Exact implementation requirement:**
  - Position it at `right: max(16px, calc((100vw - 1476px)/2 + 16px)); bottom:16px; left:auto`.
  - Size 44×44 with `border-radius:var(--radius-control)`, using the GLOBAL-06 secondary role colors.
  - Show it after `scrollY > 2*innerHeight`, and hide it while `isFooterInView()`.
  - Remove the 4 `!important` rules in `editorial.css:636-647` once specificity allows it.
- **What must not change:** the function, the reduced-motion behaviour, and the `aria-label`.
- **Acceptance criteria:**
  - At 768, 1440 and 1920, the button never intersects a text node at scroll positions of 25%, 50% and 75% on home, blog and article.
  - Computed radius is 2px.
  - The `!important` count in `editorial.css` goes down by 4.
- **Playwright verification state:**
  - **Now:** `home-1440-dark--latest.png`, `blog-1440-dark--articles-grid.png`
  - **Check:** `OVERLAP:scroll-top`
  - **Done when:** PASS at the 3 widths × 3 routes × both themes
- **Dependencies:** GLOBAL-05, GLOBAL-06

### - [x] GLOBAL-10 — Mobile menu: remove decorative icons and duplicates `[P2-12]`
- **Status (2026-09-22): DONE.** Implemented CSS-only as planned: icons hidden, `↗` on `[target=_blank]`, and the menu theme row hidden via `.blog-nav:has(.theme-toggle-nav-btn)`. `MENU-ICONS` and `THEME-CONTROL-SINGLE` PASS at 390 / 768 in both themes.
- **Priority:** P2
- **Affected surfaces:** the mobile menu on all routes
- **Viewport:** 390, 768 (≤991)
- **Current problem:**
  - Every menu row has an icon, while the desktop nav has none.
  - "Δεδομένα" and "BetCast" share the chart icon.
  - The theme toggle appears in both the bar and the menu.
  - External links aren't marked.
  - "Βαθμολογία" and "Δεδομένα" both go to `/standings/`.

  Evidence: `state-mobile-nav-390-dark.png`.
- **Exact root cause:** Legacy menu markup with icons, duplicated per shell. The theme row predates the bar toggle.
- **Files:** `styles/editorial.css`, `styles/shared-nav.css` (CSS only)
- **Exact implementation requirement:**
  - `body.editorial-page .blog-nav-mobile-link .icon { display:none }`.
  - `…mobile-link[target="_blank"]::after { content:'↗'; margin-left:auto; color:var(--text-secondary) }`.
  - Hide `.blog-nav-mobile .theme-toggle-menu-btn` whenever `.blog-nav-right .theme-toggle-nav-btn` is visible (both exist at ≤991, so hide the menu row).
  - **Out of scope here:** merging or relabelling "Δεδομένα" requires shell and article markup changes. Record it as a follow-up decision for the owner; don't implement it in this task.
- **What must not change:** row height (52px), the active signal left border, link order and hrefs, and the countdown.
- **Acceptance criteria:** At 390 and 768, the menu shows no leading icons, both external links show a trailing ↗, and exactly one theme control is visible.
- **Playwright verification state:**
  - **Now:** `state-mobile-nav-390-dark.png`, `state-mobile-nav-390-light.png`, `state-mobile-nav-768-dark.png`
  - **Check:** `MENU-ICONS`, `THEME-CONTROL-SINGLE`
  - **Done when:** PASS in both themes; the state screenshots are recaptured
- **Dependencies:** GLOBAL-07 (↗ glyph coverage)

---

## Phase 2 — Responsive and imaging root causes

### - [x] RESP-02 — Responsive card imagery with `srcset`/`sizes` `[P0-02]`
- **Status (2026-09-22): DONE.** **DONE with a documented ceiling** (via FINAL_VISUAL_CRITIQUE F-01). There's no data-contract change: every one of the 631 `*-card.webp` files has an 800w `-mobile.webp` and a 1600w `.webp` sibling, so one helper, `cardImageSrcset()` in `taxonomy.js`, derives the `srcset` from the card URL. `CARD_SIZES` holds the per-slot `sizes`. It's wired into the archive (static first page, client cards, lazy loader, error fallback), the home journal and the related cards, and `public-artifact.mjs` ships the siblings. Leads and related cards are ≥0.9. **Archive grid cards on 2–3× screens stop at 800w (0.69–0.90)** to hold mobile LCP and `dist/` size; the upgrade path is a 1200w variant in `generate-image-variants.js`. Check: `IMG-RES`.
- **Priority:** P0
- **Affected surfaces:** home journal (lead + secondary), archive grid (lead + cards), article related cards (and the rail list if it has thumbnails)
- **Viewport:** all; worst at 1440@2x and 390@3x
- **Current problem:** Only the 400px `-card.webp` is ever served.
  - Archive lead: 771px slot → ratio 0.52 at DPR1, 0.26 at DPR2.
  - Home lead: 632px → 0.63 / 0.32.
  - Archive cards: 427px → 0.47 at DPR2.
  - Full-width mobile cards at DPR3 → 0.39.

  Visibly soft photography.
- **Exact root cause:** The card renderers emit a single `src`. The `-mobile.webp` (800w), `1.webp` (1600w) and `.avif` siblings already exist in every entry folder but are never offered.
- **Files:** `blog-module/blog-index.js`, `blog-module/blog-loader.js`, `blog-module/build/related.js`, `blog-module/build/index.js` (thumbnail variant fields), `scripts/build/validate-data-contracts.mjs`, `docs/data-contracts.md`, golden fixtures
- **Exact implementation requirement:**
  - The build emits, per post, `thumbnailSet: { card:'…/1-card.webp', mobile:'…/1-mobile.webp', full:'…/1.webp', mobileAvif?, fullAvif? }`, listing only files that exist on disk. `thumbnail` stays for backward compatibility.
  - Renderers output `<picture>` with an optional `<source type="image/avif" srcset="…mobile.avif 800w, …1.avif 1600w" sizes=…>`, and `<img src="…-card.webp" srcset="…-card.webp 400w, …-mobile.webp 800w, …1.webp 1600w" sizes=…>`.
  - `sizes` values:
    - archive lead `(min-width:1200px) 780px, (min-width:768px) 50vw, 100vw`
    - archive card `(min-width:1200px) 430px, (min-width:768px) 50vw, 100vw`
    - home lead `(min-width:1200px) 640px, (min-width:768px) 55vw, 100vw`
    - home secondary `(max-width:767px) 104px, 400px`
    - related `(max-width:767px) 40vw, 390px`
  - Keep `loading="lazy"` except on the first archive card. Keep the `width` and `height` attributes.
- **What must not change:**
  - crops and aspect ratios
  - the `saturate` treatments
  - cut corners
  - the lazy-load reveal animation
  - the hero `<picture>` (already correct)
  - `perf:images` and `perf:article-media` budgets (no new files are generated)
- **Acceptance criteria:**
  - `naturalWidth / (cssWidth × DPR)` ≥ 0.9 for every card or lead image at 1440@1, 1440@2 and 390@3.
  - `npm run build:data-contracts`, `perf:images` and `test:blog` pass.
- **Playwright verification state:**
  - **Now:** `home-1440-dark--latest.png`, `blog-1440-dark--articles-grid.png`; resolution probe ratios 0.26–0.63
  - **Check:** `IMG-RES`
  - **Done when:** PASS on home, blog and article (related) at the three DPR/viewport pairs
- **Dependencies:** GLOBAL-01, GLOBAL-02

### - [x] RESP-01 — Tablet home cover: recompose at ≤991px `[P1-06]`
- **Status (2026-09-22): DONE.** (FINAL F-14) `home.css` 768–991 block (`min-height: 501px` so the landscape phone block keeps priority): full-width title (4 lines at 768), 16:9 full-width photo with the stamp, caption on one row, description beside byline, no scroll hint. 390 and 1440 are unchanged. Verified: `perf/visual-qa/verification/p-hero-768-dark-2.png`, `p-hero-900-light.png`.
- **Priority:** P1
- **Affected surfaces:** home hero
- **Viewport:** 768×1024 (range 768–991). Verify that 390 and 1440 are unchanged.
- **Current problem:** At 768 the 47/53 split holds. The headline wraps into 7 lines next to a 366×230 photo, and "SCROLL TO EXPLORE ↙" still shows (`home-768-dark--fold.png`).
- **Exact root cause:** `home.css` only switches to the `grid-template-areas` composition at `max-width:767px`. The 991px block adjusts margins only.
- **Files:** `home.css`
- **Exact implementation requirement:** Add an `@media (min-width:768px) and (max-width:991px)` block:
  - `.hero-shell { grid-template-columns:1fr 1fr; grid-template-areas:'edition edition' 'title title' 'subtitle subtitle' 'photo photo' 'description byline' 'actions actions' }`
  - `.hero-content { display:contents }`
  - `.hero-photograph { aspect-ratio:16/9; margin:28px 0 40px }`
  - h1 size `clamp(2.5rem,6vw,3.4rem)`
  - hide `.hero-scroll`
  - keep the stamp at `top:-24px; right:16px`
  - `.hero-eyebrow` stays visible

  Leave the ≤767 block and the landscape block (`max-height:500px`) untouched.
- **What must not change:**
  - the 390 and 1440 renders
  - the stamp and figcaption numbering
  - the headline's signal full stop
  - CTA order
- **Acceptance criteria:**
  - At 768: headline ≤4 lines; photo width ≥ container width − 24px; primary CTA within the first 1024px; no `.hero-scroll` visible.
  - `home-390-*--hero.png` and `home-1440-*--fold.png` pixel diffs are ≤0.5% versus the audit captures (excluding the countdown).
- **Playwright verification state:**
  - **Now:** `home-768-dark--fold.png`, `home-768-light--fold.png`
  - **Check:** `HERO-TABLET` (line count via `getClientRects` on the h1 text range, photo width, CTA top)
  - **Done when:** PASS in both themes; 390 and 1440 are unchanged
- **Dependencies:** GLOBAL-02

---

## Phase 3 — Accessibility floor

### - [x] A11Y-01 — AA contrast for ink text on the signal bands `[P1-12]`
- **Status (2026-09-22): DONE.** (FINAL F-03) Root cause fixed with `--signal-ink: #17191b` (an existing brand ink) for every text on `--signal`: timing band, round badge, live dot, paddock strip, primary hover and stamps. 4.77:1; band colour and size unchanged. `CONTRAST-BANDS` PASS at 390 / 1440 in both themes; `qa:visual` PASS.
- **Priority:** P1
- **Affected surfaces:** standings timing band; home paddock strip (all themes, after HOME-02)
- **Viewport:** all
- **Current problem:** `#20251f` on `#ed4c32` is 4.2:1 on 12px/500 text ("Live δεδομένα · Σεζόν 2026", "Μετά τον γύρο 11", paddock topics and link). That fails WCAG AA 1.4.3.
- **Exact root cause:** Small text on a mid-luminance fill. Neither color may change (KEEP).
- **Files:** `standings/standings-editorial.css`, `home.css`
- **Exact implementation requirement:** Qualify the band text as AA large text (≥18.66px bold, where 3:1 applies):
  - `.standings-sub`, `.round-badge`: `font:600 1.17rem/1.3 var(--font-body)`
  - `.paddock-strip__topics`, `.paddock-strip a`: `font:600 1.17rem/1.3 var(--font-body)` (Greek), with Latin-only strings allowed in Barlow 700 1.2rem

  Where that doesn't fit at 390, move the band's secondary meta out of the band into the line below (`.standings-report-meta` already exists), and keep only one large-text line in the band.
- **What must not change:** the band's color, full-bleed width and ink text; the live dot; "EVERY POINT COUNTS." and "RACE. TALK. REPEAT." (already large).
- **Acceptance criteria:** Every text node inside `.standings-timing-band` and `.paddock-strip` either has a contrast ratio ≥4.5, or is ≥18.66px at weight ≥600 with ratio ≥3.0. Checked at 390, 768 and 1440 in both themes. `npm run qa:visual` reports no contrast failure.
- **Playwright verification state:**
  - **Now:** detector `low-contrast 4.2:1`; `standings-390-dark--standings-timing-band.png`
  - **Check:** `CONTRAST-BANDS`
  - **Done when:** PASS
- **Dependencies:** GLOBAL-03

### - [x] A11Y-02 — Minimum text size and touch targets in data views (enforcement pass) `[P2-09]` `[P1-10]` (targets)
- **Status (2026-09-22): DONE.** Text: every report label is ≥ .75rem (DATA-04 + F-06; `TEXT-MIN` PASS). Targets: quali dots have a `::after` hit area, and standalone text links (cast names, authors links, footer links, profile links, trust-panel correction links) get `inline-flex; min-height: 24px`. Links inside running sentences use WCAG 2.5.8's inline exception. `TARGET-MIN` PASS on home, blog, article, authors and all 9 standings tabs at 390 / 1440.
- **Priority:** P2
- **Affected surfaces:** standings (all 10 reports), authors badge, related date badge
- **Viewport:** 390 (primary), 1440
- **Current problem:** Text under 12px (9.6–11.5px) and 10×10px interactive quali dots (`metrics.json` → `smallText`, `targets`).
- **Exact root cause:** The report CSS sets sizes independently. Dots are `<button>`s sized to the visual mark.
- **Files:** `standings/tabs/*.css`, `standings/standings.css`, `standings/standings-editorial.css`, `styles/authors.css`, `blog-module/blog/article-editorial.css`
- **Exact implementation requirement:**
  - After DATA-04, sweep the remaining sub-12px rules to `var(--fs-label)`.
  - Every interactive element under 24×24 gets a transparent hit-area pseudo-element (`::before { content:''; position:absolute; inset:-7px }`) with `position:relative` on the host, so the visual size stays the same.
- **What must not change:** visual dot size, chart geometry, and the ledger layout.
- **Acceptance criteria:**
  - `metrics.json` shows `smallText` empty on every standings tab, authors and article.
  - Every interactive element's hit area is ≥24×24 (WCAG 2.2 AA 2.5.8).
- **Playwright verification state:**
  - **Now:** `metrics.json` (`standings-quali-390-dark`: 25 small, 25 targets)
  - **Check:** `TEXT-MIN`, `TARGET-MIN`
  - **Done when:** PASS for all 10 `?tab=` values at 390 and 1440
- **Dependencies:** GLOBAL-03, DATA-04

---

## Phase 4 — Page tasks

### HOME

#### - [x] HOME-01 — Stop repeating the cover story in the journal `[P1-01]`
- **Status (2026-09-22): DONE.** The build now writes 4 posts to `home-latest.json` (`[0]` cover, `[1..3]` journal). `blog-loader.js` starts the journal at index 1 and falls back to `slice(0,3)` when fewer than 4 posts exist. Contract max raised to 4 and documented in `docs/data-contracts.md`. `HOME-NO-DUP` PASS at 390/768/1440; `build:data-contracts` passes.
- **Priority:** P1
- **Affected surfaces:** home `#latest`
- **Viewport:** all
- **Current problem:** The hero shows post[0], and the journal lead shows post[0] again, with the same title, image and excerpt (`home-390-dark--hero.png` + `--latest.png`).
- **Exact root cause:** `blog-loader.js` renders the journal from index 0 of `home-latest.json`. The hero is stamped from the same post.
- **Files:** `blog-module/blog-loader.js`, `blog-module/build/index.js` (home-latest length), `scripts/build/validate-data-contracts.mjs`, `docs/data-contracts.md`
- **Exact implementation requirement:**
  - The journal uses `posts.slice(1, 4)`: lead = [1], secondary = [2], [3].
  - Make sure `home-latest.json` holds at least 4 posts, and enforce that in the contract.
  - If fewer than 4 are available, fall back to `slice(0, 3)` so the section never renders empty.
- **What must not change:** the hero; the journal layout (lead + 2 + margin column); the treatment classes (`home-story-treatment--*`).
- **Acceptance criteria:** No article URL appears in both `#hero` and `#latest`. The journal still renders 1 lead and 2 secondary stories. The data contract passes.
- **Playwright verification state:**
  - **Now:** `home-390-dark--latest.png`, `home-1440-dark--latest.png`
  - **Check:** `HOME-NO-DUP`
  - **Done when:** PASS at the 3 viewports
- **Dependencies:** GLOBAL-02. Coordinate with RESP-02, which edits the same renderer.

#### - [x] HOME-02 — Keep the paddock strip a signal band in dark mode `[P2-06]`
- **Status (2026-09-22): DONE.** Unblocked by A11Y-01: the band text now uses `--signal-ink` (4.77:1). `PADDOCK-BAND` + `CONTRAST-BANDS` PASS.
- **Priority:** P2
- **Affected surfaces:** home `.paddock-strip`
- **Viewport:** all, dark theme
- **Current problem:** In dark mode the band becomes charcoal with a 4px side tab and coral text. The detector flags it as `side-tab` (`home-1440-dark--paddock-strip.png`).
- **Exact root cause:** The dark override at `home.css:48-55`.
- **Files:** `home.css`
- **Exact implementation requirement:** Delete the `:root:not([data-theme="light"]) .home-page .paddock-strip` rules (lines 48–55), so the band stays `--signal` with `--ink` text in both themes, matching `.standings-timing-band`.
- **What must not change:** the light-mode band, content, link and the ✳ separators.
- **Acceptance criteria:** The computed background is `rgb(237, 76, 50)` and `border-left-width` is 0 in both themes. A11Y-01 passes in dark mode.
- **Playwright verification state:**
  - **Now:** `home-1440-dark--paddock-strip.png`, `home-390-dark--paddock-strip.png`
  - **Check:** `PADDOCK-BAND`, `CONTRAST-BANDS`
  - **Done when:** PASS in both themes
- **Dependencies:** A11Y-01

#### - [x] HOME-03 — A journal loading skeleton that matches the loaded layout `[P2-11]` (home)
- **Status (2026-09-22): DONE.** Root cause was different from the planned one: the skeleton styles live in `blog-module/blog-styles.css`, which home doesn't load, so the skeleton collapsed to 0px. `home.css` now draws the journal's own shape while loading (4:3 lead plus two 16:9 rail stories on desktop; 16:10 lead plus 104px thumbnail rows on mobile) as flat `--bg-surface` / `--bg-surface-alt` blocks, with a calm opacity pulse only under `prefers-reduced-motion: no-preference`. No JS change was needed. Loading → loaded height shift: 5% (390), 9% (768), 1% (1440). `HOME-SKELETON-SHIFT` PASS in both themes.
- **Priority:** P2
- **Affected surfaces:** home `#latest` during data load
- **Viewport:** 390 (primary), 1440
- **Current problem:** On mobile the journal collapses to intro → "Όλα τα άρθρα" while loading, with no visible skeleton (`state-home-loading-390.png`).
- **Exact root cause:** `home.css:342` sets `.blog-posts { min-height:0 }` at ≤767, and the skeleton markup has no editorial styling.
- **Files:** `home.css`, `blog-module/blog-loader.js` (only if the skeleton markup needs a hook)
- **Exact implementation requirement:**
  - Style `.home-loading-skeleton .skeleton-card` as the lead layout: a 16/10 block in `--bg-surface`, then 3 lines (60%, 90%, 75%) of `var(--fs-small)` height in `--bg-surface-alt`, then 2 secondary rows (104px square + 2 lines).
  - Set `min-height` equal to the loaded lead height at each breakpoint.
  - No shimmer animation: a static block, or a 1s opacity pulse only when `prefers-reduced-motion: no-preference`.
- **What must not change:** the loaded state; `aria-busy` and `aria-live`.
- **Acceptance criteria:** The journal section height changes by <10% between the loading and loaded states at 390 and 1440. The skeleton is visible in both themes.
- **Playwright verification state:**
  - **Now:** `state-home-loading-390.png`, `state-home-loading-1440.png`
  - **Check:** `HOME-SKELETON-SHIFT` (route-delay `home-latest.json` by 8s, then measure)
  - **Done when:** PASS
- **Dependencies:** GLOBAL-02, HOME-01

#### - [x] HOME-04 — Cast: one destination per person `[P2-13]` (home part)
- **Status (2026-09-22): DONE.** Portrait links now point to the same `/authors/?author=…` as the name. The duplicate link is `tabindex="-1"` and `aria-hidden`, so keyboard and screen-reader users meet each person once. Instagram stays on the authors page. Crops, stagger, counters and hover are unchanged. `CAST-SINGLE-DEST` PASS.
- **Priority:** P2
- **Affected surfaces:** home `#about` team row
- **Viewport:** all
- **Current problem:** Each cast member's portrait links to Instagram while the name links to `/authors/?author=…`, so there are two destinations per person. Names are Greek here but Latin elsewhere (fixed by GLOBAL-08).
- **Exact root cause:** Hard-coded links in `index.html`, in the source region outside generated markers.
- **Files:** `index.html` (team-row markup, not a generated region)
- **Exact implementation requirement:** Point the portrait `<a>` at the same `/authors/?author=<slug>` as the name. Drop `target="_blank"`. Instagram stays reachable from the author profile.
- **What must not change:**
  - portrait crops (square, arched, cut corner)
  - the stagger
  - `01–05` counters
  - hover desaturate-to-color
- **Acceptance criteria:** Within each `.team-member`, every `a[href]` resolves to one URL.
- **Playwright verification state:**
  - **Now:** `home-1440-light--about.png`
  - **Check:** `CAST-SINGLE-DEST`
  - **Done when:** PASS
- **Dependencies:** GLOBAL-08

### BLOG

#### - [x] BLOG-01 — Close the void under the archive lead story `[P1-02]`
- **Status (2026-09-22): DONE.** At ≥768 the curated lead card fills both grid rows, and its photo flexes (`flex: 1 1 auto; aspect-ratio: auto; min-height: clamp(260px, 32vw, 520px)`, `object-fit: cover`), so the spread closes on one baseline. Preserve-composition cards are excluded. Mobile is unchanged. `ARCHIVE-SPREAD-BASELINE` PASS at 768 / 1024 / 1440 in both themes.
- **Priority:** P1
- **Affected surfaces:** archive curated opening spread
- **Viewport:** 768, 1440 (and 1024–1199)
- **Current problem:** The lead card spans rows 1–2, but its content ends about 200px (1440) or 300px (768) above the stacked right column (`blog-1440-dark--articles-grid.png`, `blog-768-light--articles-grid.png`).
- **Exact root cause:** The lead image has a fixed `aspect-ratio:16/10` and nothing lets it stretch, while the two right-hand cards add up taller.
- **Files:** `blog-module/blog/archive-editorial.css`
- **Exact implementation requirement:** At `min-width:768px`, for `.archive-grid.is-curated-default > .article-card-wrap:first-child`:
  - `height:100%` on the wrap and on `.article-card` (flex column)
  - `.article-card-img-wrap { flex:1 1 auto; aspect-ratio:auto; min-height:clamp(260px, 32vw, 520px) }`
  - `.article-card-img { height:100%; object-fit:cover }`
  - `.article-card-body`, `.article-card-footer` `flex:0 0 auto`

  So the photo absorbs the difference.
- **What must not change:**
  - the column split (1–7 / 9–12)
  - the 62px cut corner (via `--cut-lg`)
  - title sizes
  - `preserve-composition` cards, which must keep `object-fit:contain` and be excluded from the stretch
  - the mobile layout
- **Acceptance criteria:** At 768, 1024 and 1440, the bottom of the lead card's footer is within 24px of the bottom of card 3's footer. No gap over 48px inside the first row group.
- **Playwright verification state:**
  - **Now:** `blog-1440-dark--articles-grid.png`, `blog-768-light--articles-grid.png`
  - **Check:** `ARCHIVE-SPREAD-BASELINE`
  - **Done when:** PASS in both themes
- **Dependencies:** GLOBAL-04, RESP-02 (final image sources)

#### - [x] BLOG-02 — One excerpt clamp rule `[P2-05]`
- **Status (2026-09-22): DONE.** **Root cause corrected:** the archive markup uses `.archive-grid`, so the legacy `.articles-grid` clamps never applied. The real leak was the legacy `flex: 1 1 auto` on `.article-card-excerpt`, which stretched the clamped box inside the flex-column card. Replaced with one rule (`display: -webkit-box; -webkit-box-orient: vertical; line-clamp 2; overflow: hidden; flex: 0 0 auto`, 3 lines for the curated lead) at a specificity that beats the legacy variants. `EXCERPT-CLAMP` PASS at 390 / 768 / 1440.
- **Priority:** P2
- **Affected surfaces:** archive cards
- **Viewport:** 768 (visible), all (rule)
- **Current problem:** A third line leaks after the ellipsis ("…Έχει… / ταχύτητα, έχει…") on the Colapinto card at 768.
- **Exact root cause:** `archive-editorial.css` sets `display:-webkit-box; -webkit-line-clamp:2` without `-webkit-box-orient` and `overflow:hidden`, and competing clamps in `blog-styles.css:790,895,948,1001` apply by `nth-child`.
- **Files:** `blog-module/blog/archive-editorial.css`, `blog-module/blog-styles.css`
- **Exact implementation requirement:**
  - A single rule, `.archive-page .article-card-excerpt { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; line-clamp:2; overflow:hidden }`.
  - The first curated card keeps 3 lines, via an explicit override in `archive-editorial.css`.
  - Delete the `blog-styles.css` excerpt clamp variants that `.archive-page` overrides; keep any the home cards use.
- **What must not change:** the home card clamps (3 and 2 lines), excerpt typography, and the mobile hiding of excerpts on curated cards 2–3.
- **Acceptance criteria:** Every visible `.archive-page .article-card-excerpt` renders ≤2 lines (3 for the lead), with no text below the ellipsis line, at 390, 768 and 1440.
- **Playwright verification state:**
  - **Now:** `blog-768-light--articles-grid.png`
  - **Check:** `EXCERPT-CLAMP`
  - **Done when:** PASS
- **Dependencies:** GLOBAL-02

### ARTICLE

#### - [x] ARTICLE-01 — Fix the mobile related-card grid `[P0-01]`
- **Status (2026-09-22): DONE.** CSS only: at ≤767 the two-column grid moved from `.related-card-link` to `.related-article-card` (≤359: `.8fr / 1.2fr`, 12px gap). The article HTML is unchanged. `RELATED-MOBILE-GRID` PASS at 390 and 360 on 20260920W and 20250516G, in both themes.
- **Priority:** P0
- **Affected surfaces:** "Σχετικά άρθρα" on all 352 articles
- **Viewport:** ≤767 (390, 360)
- **Current problem:** Image and text are squeezed into about 139px, the right ~60% is empty, and words break mid-word (`article-390-related-settled.png`, `v-table-390-dark.png`).
- **Exact root cause:** `article-editorial.css:625,638` puts the 2-column grid on `.related-card-link`, whose only child is `.related-article-card` (`build/related.js:71-72`).
- **Files:** `blog-module/blog/article-editorial.css`
- **Exact implementation requirement:**
  - At ≤767: `.article-page .related-card-link { display:block }` and `.article-page .related-article-card { display:grid; grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr); gap:18px; align-items:start }`.
  - At ≤359: `.8fr 1.2fr`, `gap:12px`.
  - `.related-card-media` goes in column 1 and `.card-body` in column 2. Keep `.related-card-hover { display:none }` at mobile.
- **What must not change:** the 768 and 1440 layout; the card #3 cut corner; titles; the CTA.
- **Acceptance criteria:**
  - At 390 and 360, `.card-body` `left` is greater than `.related-card-media` `right`.
  - Title box width ≥180px.
  - No title line ends mid-word: every line break lands on whitespace, checked via `Range.getClientRects`.
- **Playwright verification state:**
  - **Now:** `article-390-related-settled.png`, `article-390-dark--article-related-section.png`
  - **Check:** `RELATED-MOBILE-GRID`
  - **Done when:** PASS on `20260920W` and `20250516G`, in both themes
- **Dependencies:** GLOBAL-02. No build is needed: CSS-only, and the article HTML is unchanged.

#### - [x] ARTICLE-02 — One alignment axis for the body, related and comments `[P2-02]`
- **Status (2026-09-22): DONE.** Related, previous/next and comments now share the body grid's 968px box (740px ≤991). Bootstrap gutters are zeroed in the related row (`--bs-gutter-x: 0`, 32px column gap, `calc((100% − 64px) / 3)` cards). The wide cover is left as the deliberate contrast. `ARTICLE-AXIS` PASS at 1440 / 1200 / 768.
- **Priority:** P2
- **Affected surfaces:** article at ≥1200
- **Viewport:** 1440 (1200–1439)
- **Current problem:** Cover text starts at x=97, body at 236, related heading at 140 and related cards at 152 (`article-1440-dark--fold.png`, `v-related-1440-light.png`).
- **Exact root cause:** The body grid is centered at 968px. The related section is centered at 1160px with Bootstrap `.col-md-4` padding (`--bs-gutter-x`).
- **Files:** `blog-module/blog/article-editorial.css`
- **Exact implementation requirement:**
  - `.article-related-section, .article-comments, .article-navigation { max-width:968px }`, so they share the body grid's outer box.
  - `.article-related-section { --bs-gutter-x:0; column-gap:32px }`, with `.col-md-4 { flex:0 0 calc((100% - 64px)/3) }`.
  - Leave the cover full width. That wide/narrow contrast is deliberate.
- **What must not change:** the cover; the body measure; the rail; the mobile layout (ARTICLE-01).
- **Acceptance criteria:** At 1200 and 1440, the related heading's left edge = the first related card's left edge = the body `<p>`'s left edge (±1px).
- **Playwright verification state:**
  - **Now:** `v-related-1440-light.png`
  - **Check:** `ARTICLE-AXIS`
  - **Done when:** PASS in both themes
- **Dependencies:** ARTICLE-01

#### - [x] ARTICLE-03 — Remove rail duplication and trim the share set `[P2-03]`
- **Status (2026-09-22): DONE.** The template drops the rail meta card, the category rail and the Threads / Instagram / Telegram buttons. `refreshArticleTaxonomy` removes the same blocks from every existing article (idempotent), and the unused `renderCategoryRail` was deleted. Share is now Facebook, WhatsApp, native share (which `blog-fixes.js` already hides where unsupported) and copy: 3 buttons on desktop, 4 on mobile. The dark rail toolbar is unboxed and separated by its existing 1px rule. Also fixed a GLOBAL-08 gap: new articles got the English `ARTICLE_CATEGORY_TEXT` until the next refresh. The `metadata-escaping-guard` assertion moved from the removed Threads `linkname=` to Facebook `u=`, which is the same encoding intent. `ARTICLE-CATEGORY-COUNT` and `SHARE-COUNT` PASS; goldens updated and reviewed.
- **Priority:** P2
- **Affected surfaces:** article rail (≥992), mini-bar
- **Viewport:** 1440, 768 (the toolbar moves inline at ≤991)
- **Current problem:**
  - The category is shown 4–5 times: cover label, cover meta, rail "ΡΕΠΟΡΤΑΖ", rail "ΚΑΤΗΓΟΡΙΕΣ" chip, mini-bar.
  - Date and reading time appear in both the cover and the rail.
  - Seven boxed share icons sit in two rows inside a bordered box in dark mode (`article-1440-dark--fold.png`, `--article-body-grid.png`).
- **Exact root cause:** `blog-module/build/article-render.js` renders both the cover meta and `article-rail-meta` / `article-rail-tags`. The share list is the full legacy set.
- **Files:** `blog-module/build/article-render.js`, `blog-module/blog/template.html`, `blog-module/blog/article-editorial.css`, `blog-module/blog/article-rail.css`, `blog-module/blog/article-script.js` (share handlers), golden fixtures
- **Exact implementation requirement:**
  - Stop rendering the rail meta block and the rail category chip. The template keeps the rail slots for related stories and share.
  - Share buttons: Facebook, WhatsApp, native share (`navigator.share`, falling back to copy), copy link. Threads, Instagram and Telegram go behind native share.
  - The rail toolbar is unboxed in dark mode: remove `editorial.css` / `article-editorial.css` background and border on `.article-side-rail .article-toolbar`, and separate it with a 1px rule.
  - Share buttons use the GLOBAL-06 secondary role.
  - Existing articles pick this up only on regeneration. Use `stamp-html.mjs --stamp-articles` or a blog force build on a branch after GLOBAL-01.
- **What must not change:** the related list in the rail with `01–03` numbering; the cover meta; share URLs and behaviour for the kept networks.
- **Acceptance criteria:** Category text is rendered ≤2 times (cover + mini-bar). The rail has ≤4 share buttons. There's no bordered or filled wrapper around the rail toolbar in either theme. Goldens are updated.
- **Playwright verification state:**
  - **Now:** `article-1440-dark--fold.png`, `article-1440-dark--article-body-grid.png`
  - **Check:** `ARTICLE-CATEGORY-COUNT`, `SHARE-COUNT`
  - **Done when:** PASS
- **Dependencies:** GLOBAL-01, GLOBAL-06, GLOBAL-08

#### - [x] ARTICLE-04 — Apply the lead paragraph only to real standfirsts `[P2-04]`
- **Status (2026-09-22): DONE.** `markArticleLead()` in `build/article-render.js` (exported, idempotent) adds `.article-lead` to the first `<p>` only when it comes before any h1–h3, has ≥140 characters and doesn't end in ":". Existing `class` attributes are left alone. It runs for new articles and, through `refreshArticleTaxonomy`, for all 352 existing ones: 215 qualify. The CSS now targets `p.article-lead`. `LEAD-RULE` PASS (20260920W and 20260526D yes; 20250516G heading-first and 20250328G short subtitle no).
- **Priority:** P2
- **Affected surfaces:** article `.article-content` first paragraph
- **Viewport:** all
- **Current problem:** The `ΕΙΣΑΓΩΓΗ` label and the large 500-weight lead style are applied to a one-line colon sentence after an h2 (`20250516G`, `v-h2-1440-dark.png`).
- **Exact root cause:** `article-editorial.css` targets `.article-content > p:first-of-type` unconditionally.
- **Files:** `blog-module/build/article-render.js` (or `worker.js`), `blog-module/blog/article-editorial.css`, golden fixtures
- **Exact implementation requirement:**
  - The build adds `class="article-lead"` to the first `<p>` only if it precedes any `h1`–`h3` in the content, has ≥140 characters of text, and doesn't end with ":".
  - CSS: replace `> p:first-of-type` and `::before` with `.article-lead` and `.article-lead::before`.
- **What must not change:** the lead style itself (signal rule, `ΕΙΣΑΓΩΓΗ` label, size and weight) on qualifying articles.
- **Acceptance criteria:** `20250516G` has no `.article-lead`, and `20260920W` does. Golden diffs are limited to the class attribute.
- **Playwright verification state:**
  - **Now:** `v-h2-1440-dark.png`
  - **Check:** `LEAD-RULE`
  - **Done when:** PASS on both articles
- **Dependencies:** GLOBAL-01

#### - [x] ARTICLE-05 — Bring in-article tables into the ledger language `[P1-08]`
- **Status (2026-09-22): DONE.** Ledger skin in `article-editorial.css` over the shared `blog-styles.css` tables: 2px text-primary top rule, a tracked category-coloured label with no fill, underline-tab view switch (icons hidden), row rules only, tabular figures, no radius or shadow; card view as rule-separated rows. **Breakout skipped on purpose:** the rail's sticky share block would collide with a table extending into it. The clipping was actually caused by `th { white-space: nowrap }` plus `min-width: 600px`, so tables now wrap inside the 680px measure (min 480px on phones, with sideways scroll), and ≤4-column tables fit at 1440. The phone view switch is hidden for CSV tables because phones force card view anyway; the existing JS already hides the scroll hint without overflow. `TABLE-LEDGER` PASS at 390 / 1440 / 768.
- **Priority:** P1
- **Affected surfaces:** articles with CSV tables (e.g. `20250516G`, `20250615G`, `20250602-1G`)
- **Viewport:** all
- **Current problem:**
  - Tables sit in a rounded card with a shadow and a solid coral header block.
  - The view toggles are 999px pills.
  - At 1440 the columns are clipped inside the 680px measure while the rail is empty (`v-h2-1440-dark.png`, `v-table-1440-light.png`).
- **Exact root cause:** The `csv-to-table.js` markup is styled by legacy `article-styles.css`. `article-editorial.css` never re-skinned it.
- **Files:** `blog-module/blog/article-editorial.css`, `blog-module/blog/article-styles.css`, `blog-module/build/csv-to-table.js` (only if a class hook is missing), golden fixtures (if markup changes)
- **Exact implementation requirement:**
  - **Header:** no fill. The title is a `var(--fs-label)` tracked label in `--article-signal-readable`, over a 2px `--text-primary` top rule.
  - **Toggles:** underline tabs (2px `--signal` on active, `min-height:44px`, `radius:0`).
  - **Container:** `border-radius:0; box-shadow:none; background:transparent`. Rows get a 1px `--border` bottom border. Cells: `font-variant-numeric:tabular-nums`, `padding:10px 12px`.
  - **Breakout:** at ≥1200, the table container spans both body-grid columns (`grid-column:1 / -1`, max 968px).
  - Hide the "Σύρετε για περισσότερα" hint unless the table overflows (JS: toggle a class when `scrollWidth > clientWidth`).
  - Keep the source caption as `var(--fs-label)` muted text below a 1px rule.
- **What must not change:** table/card toggle behaviour, horizontal scroll on small screens, the data, and the source line.
- **Acceptance criteria:**
  - No ancestor of `.article-content table` (up to `.article-content`) has an `--accent` or `--signal` background, a radius over 2px, or a box-shadow.
  - At 1440, tables with ≤4 columns show every column without horizontal scroll.
  - The toggle still switches views.
- **Playwright verification state:**
  - **Now:** `v-h2-1440-dark.png`, `v-table-1440-light.png`, `v-table-390-dark.png`
  - **Check:** `TABLE-LEDGER`, `NO-SHADOW`, `RADIUS-SET`
  - **Done when:** PASS on `20250516G` at 390, 1440 and 768, in both themes
- **Dependencies:** GLOBAL-03, GLOBAL-04, GLOBAL-05

#### - [x] ARTICLE-06 — Comments on demand, placed before related stories `[P2-15]`
- **Status (2026-09-22): DONE.** **The order criterion was already met:** the template and all built articles already run comments → previous/next → related (the audit misread the scroll position). On-demand loading is JS-only in `article-comments.js`: it inserts a `Δες τα σχόλια (Disqus)` button (shared secondary role) before `#disqus_thread`, and Disqus loads and receives focus on click. There was no consent gating to preserve (the script had none). No article markup migration was needed. `DISQUS-ON-DEMAND` and `ARTICLE-END-ORDER` PASS.
- **Priority:** P2
- **Affected surfaces:** article comments (Disqus)
- **Viewport:** all
- **Current problem:** A 558–709px unthemed third-party iframe auto-loads after the related stories. "Σχόλια" is the only section heading with a leading icon (`article-390-dark--article-comments.png`).
- **Exact root cause:** `article-comments.js` loads Disqus on scroll, and `template.html` orders comments after related stories.
- **Files:** `blog-module/blog/article-comments.js`, `blog-module/blog/template.html`, `blog-module/blog/article-editorial.css`, `scripts/build/article-editorial.mjs` (migration for existing articles), golden fixtures
- **Exact implementation requirement:**
  - Render the heading "Σχόλια" (no icon) plus a secondary button (GLOBAL-06), "Δες τα σχόλια (Disqus)". Load Disqus only on click, and keep existing consent gating.
  - Move the comments block above `.article-related-section` in the template. Migrate existing articles through the `article-editorial.mjs` shell migration.
- **What must not change:** the Disqus thread identifiers (`data-article-id`) and consent behaviour.
- **Acceptance criteria:** No request to `*.disqus.com` before the click. After the click, the thread loads. The last content block before `<footer>` is "Σχετικά άρθρα".
- **Playwright verification state:**
  - **Now:** `article-390-dark--article-comments.png`
  - **Check:** `DISQUS-ON-DEMAND` (network log), `ARTICLE-END-ORDER`
  - **Done when:** PASS on 2 articles
- **Dependencies:** GLOBAL-01, GLOBAL-06, ARTICLE-02

### DATA (standings)

#### - [x] DATA-01 — Side-panel title in Plex, not a Barlow fallback `[P1-04]`
- **Status (2026-09-22): DONE.** `.standings-side-kicker` is now `600 1.45rem/1.2 var(--font-body)`, so the Greek title renders in Plex instead of a Helvetica fallback. `BRAND-NO-GREEK` PASS site-wide; `OVERFLOW:side-panel` PASS at 1200 / 1440.
- **Priority:** P1
- **Affected surfaces:** standings side panel (≥1200)
- **Viewport:** 1440 (visible ≥1200)
- **Current problem:** "Αγωνιστικό δελτίο" renders in Helvetica (CDP) and overflows to x=1426, beyond the 1392px content edge (`standings-1440-dark--fold.png`).
- **Exact root cause:** `standings-editorial.css:80` sets `.standings-side-kicker { font:700 2.7rem/.95 var(--font-brand) }` on Greek text. Barlow ships a Latin subset only.
- **Files:** `standings/standings-editorial.css`
- **Exact implementation requirement:** `.standings-side-kicker { font:600 1.45rem/1.2 var(--font-body); letter-spacing:-.02em }`, which matches `.chart-title`'s role. No other changes to the side panel.
- **What must not change:** the side panel content, position and width (255px), or its visibility breakpoint.
- **Acceptance criteria:** `BRAND-NO-GREEK` passes site-wide. The side kicker's platform font is IBM Plex Sans. Its `right` is ≤ the container content edge at 1200 and 1440.
- **Playwright verification state:**
  - **Now:** `standings-1440-dark--fold.png`
  - **Check:** `BRAND-NO-GREEK`, `FONT-PLATFORM`, `OVERFLOW:side-panel`
  - **Done when:** PASS in both themes
- **Dependencies:** GLOBAL-02. GLOBAL-07 is soft: it adds the `BRAND-NO-GREEK` guard but isn't needed for the fix, which can ship first.

#### - [x] DATA-02 — Masthead arrow mark in the flow, not colliding `[P1-05]`
- **Status (2026-09-22): DONE.** The aside is a two-column grid with the arrow in its own column (3rem, 2.25rem at ≤1199), with no absolute positioning. Together with the Plex arrow glyphs from GLOBAL-07 it can no longer collide. `OVERLAP:masthead-mark` PASS at 768 / 1024 / 1200 / 1440.
- **Priority:** P1
- **Affected surfaces:** standings masthead aside
- **Viewport:** 768 (worst), 1024, 1200, 1440
- **Current problem:** The 5.5rem rotated "↗" crosses "Κάθε βαθμός," and the edition label at 768, and touches the edition line at 1440 (`standings-768-light--fold.png`).
- **Exact root cause:** `standings-editorial.css:39` absolutely positions the mark (`right:5px; top:-20px`) inside an aside whose width changes by breakpoint. Its glyph metrics also vary by fallback font (fixed by GLOBAL-07).
- **Files:** `standings/standings-editorial.css`
- **Exact implementation requirement:**
  - `.standings-masthead-aside { display:grid; grid-template-columns:minmax(0,1fr) auto; column-gap:16px }`, with the note and description in column 1.
  - `.standings-masthead-mark { position:static; grid-column:2; grid-row:1; align-self:start; font-size:3rem (≥1200) / 2.25rem (768–1199); transform:rotate(-8deg) }`.
  - Keep it hidden at ≤767 (the aside is already hidden).
- **What must not change:** the mark's color (`--accent-readable`), its rotation, and the aside's content and left rule.
- **Acceptance criteria:** The mark's bounding box intersects neither `.standings-masthead-note` nor `.standings-edition` at 768, 1024, 1200 or 1440, in either theme.
- **Playwright verification state:**
  - **Now:** `standings-768-light--fold.png`, `standings-1440-dark--fold.png`
  - **Check:** `OVERLAP:masthead-mark`
  - **Done when:** PASS
- **Dependencies:** GLOBAL-02. GLOBAL-07 is soft: it stabilises the glyph metrics across platforms. Re-run `OVERLAP:masthead-mark` after GLOBAL-07 lands.

#### - [x] DATA-03 — Remove the 1px row bars that read as broken borders `[P2-10]`
- **Status (2026-09-22): DONE.** `.standings-page .st-bar-wrap { display: none }`. The markup and JS are untouched, and the chart below still carries the proportion. `NO-ROW-HAIRLINES` PASS on drivers and constructors at 390 / 1440.
- **Priority:** P2
- **Affected surfaces:** standings drivers and constructors tables
- **Viewport:** all
- **Current problem:** A 1px team-colored line of varying length sits under each row, starting at x≈95 (`standings-768-light--fold.png`).
- **Exact root cause:** `standings-editorial.css:106` sets `.st-bar-wrap { height:1px }`, which shrinks the legacy points bar into a hairline.
- **Files:** `standings/standings-editorial.css`
- **Exact implementation requirement:** `.standings-page .st-bar-wrap { display:none }`. The chart section below shows the same proportion. Don't remove the markup (`standings.js` may reference it).
- **What must not change:** row rules, team-color left rules, the expand/collapse detail rows, and the chart section.
- **Acceptance criteria:** No visible element under 2px tall and narrower than its row between table rows.
- **Playwright verification state:**
  - **Now:** `standings-768-light--fold.png`, `standings-390-dark--standings-table-wrap.png`
  - **Check:** `NO-ROW-HAIRLINES`
  - **Done when:** PASS
- **Dependencies:** GLOBAL-02

#### - [x] DATA-04 — Bring the quali, lap1 and pit-stop reports into the ledger language `[P1-10]`
- **Status (2026-09-22): DONE.** Scoped overrides in `standings-editorial.css` (the tab CSS files are untouched): pairings and race cards as rule-separated rows, flat 3% tracks, solid team-colour dots (1px `--bg-base` stroke) that scale on hover/active instead of glowing, a 24px+ hit area via `::after`, deltas read by weight rather than green/red (tinted backgrounds removed), badges and pills at 2px, and every sub-12px label raised to .75rem. **Root-cause extra:** the panel font reset used `:where()` (zero specificity), so every report still rendered in the unloaded Outfit / DM Sans. It's now `:is()` plus a debrief-table override, which fixes all ten reports. Leftover shadows are also removed in dirty-air, track-dominance, destructors and debrief. `REPORT-LEDGER` is clean for quali / lap1 / pit-stops; the remaining sub-12px text in tyre / dirty-air / track-dom / debrief / destructors belongs to A11Y-02. Calculations are unchanged.
- **Priority:** P1
- **Affected surfaces:** standings `?tab=quali-gaps`, `lap1-gains`, `pit-stops` (and any sibling tab using the same card/track pattern)
- **Viewport:** all
- **Current problem:**
  - Each pairing is a bordered box with a 14px-radius tinted track.
  - Dots have glow rings (`0 0 0 3px rgba(team,.24)` ×228).
  - Deltas use off-palette green and red.
  - Dot targets are 10×10px, and text runs 9.6–11.5px.

  Evidence: `standings-quali-390-dark--standings-panel-active.png`.
- **Exact root cause:** Report CSS in `standings/tabs/*.css` predates the editorial skin. `standings-editorial.css:151` flattens the cards but not the tracks, dots or delta colors.
- **Files:** `standings/tabs/quali-gaps.css`, `standings/tabs/lap1-gains.css`, `standings/tabs/pit-stops.css`, `standings/standings-editorial.css`
- **Exact implementation requirement:**
  - **Pairings:** `border:0; border-top:1px solid var(--st-border); background:transparent; padding:20px 0`.
  - **Tracks:** `border-radius:0; background:color-mix(in srgb, var(--st-text) 3%, transparent)`.
  - **Dots:** a solid `rgb(var(--dot-color))` fill with a 1px `var(--bg-base)` stroke and `box-shadow:none`, in both themes. Remove the dark-mode "instrument ring" override at `standings-editorial.css:157-162`.
  - **Deltas:** `color:var(--st-text)` with a sign. The faster driver's delta is `font-weight:600`; the slower is `400` in `--st-text-secondary`.
  - **Text:** all labels and names ≥ `var(--fs-label)`. Tooltip ≥12px.
  - Scope every override under `.standings-page .standings-panel` so it wins over the lazy report CSS (see the `standings-editorial.css:130` comment).
- **What must not change:** team colors on dots and headshot rings; H2H numbers; the Overview / By Race views; tooltips (content); chart geometry.
- **Acceptance criteria:**
  - In these panels: no computed box-shadow, no radius over 2px apart from `50%` on dots and headshots, and no green or red text colors outside team data.
  - `TEXT-MIN` passes for the panel.
- **Playwright verification state:**
  - **Now:** `standings-quali-390-dark--standings-panel-active.png`, `standings-quali-390-light--standings-panel-active.png`
  - **Check:** `NO-SHADOW`, `RADIUS-SET`, `TEXT-MIN`, `REPORT-LEDGER` (no bordered boxes)
  - **Done when:** PASS for all 3 tabs at 390, 1440 and 768, in both themes
- **Dependencies:** GLOBAL-03, GLOBAL-04, GLOBAL-05

#### - [x] DATA-05 — An editorial error state with a cache timestamp `[P2-11]` (standings)
- **Status (2026-09-22): DONE.** CSS only: the error is now a margin note (2px signal rule, message as a Plex 600 heading, detail at .875rem, icons hidden), the retry uses the shared secondary role, and there's no orphan 2px table rule (`.standings-table-wrap:has(.standings-error)`). **Cache-timestamp line dropped:** the page falls back snapshot cache → API → OpenF1, and the error only renders when all three fail, so there is never a cache to date. No JS or markup change. `STANDINGS-ERROR-STATE` PASS at 390 / 1440 in both themes.
- **Priority:** P2
- **Affected surfaces:** standings panels when the APIs or cache fail
- **Viewport:** 390, 1440
- **Current problem:** A centered, boxed alert with a ⚠ icon and a coral-tint retry button. An orphan 2px table rule sits above it, and there's no timestamp (`state-standings-error-1440.png`).
- **Exact root cause:** The legacy `.standings-error` markup and styles. `standings-editorial.css:64` only adjusts padding and border.
- **Files:** `standings/standings-editorial.css`, `standings/core/rendering.js` (message markup), `standings/core/cache.js` (to expose the cache timestamp, if needed)
- **Exact implementation requirement:**
  - Markup: an h3 "Τα δεδομένα δεν φόρτωσαν" (Plex 600 `var(--fs-h3)`), one line explaining why (existing copy), and, when a cached payload exists, "Τελευταία διαθέσιμα δεδομένα: <date via GLOBAL-08 helper>" with a secondary action "Δες τα αποθηκευμένα".
  - Retry is a secondary button (GLOBAL-06).
  - Style: no box; a 2px `--signal` left rule with 20px padding-left; left-aligned; no icon.
  - Hide `.standings-table-wrap`'s top rule while the panel is in the error state.
- **What must not change:** retry behaviour, `aria-live` announcements, and the Greek copy meaning.
- **Acceptance criteria:** The error state has no bordered container, no icon, and uses the shared secondary button. A timestamp appears when `standings-cache.json` loaded. There's no 2px rule above it.
- **Playwright verification state:**
  - **Now:** `state-standings-error-1440.png`, `state-standings-error-390.png`
  - **Check:** `STANDINGS-ERROR-STATE` (route-abort the APIs, and separately abort the APIs while serving the cache)
  - **Done when:** PASS in both variants
- **Dependencies:** GLOBAL-06, GLOBAL-08

#### - [x] DATA-06 — Tyre-pace chart overflow affordance and name truncation `[P2-16]`
- **Status (2026-09-22): DONE.** A presentation-only `watchChartOverflow()` in `tyre-pace.js` toggles `.is-overflowing` (scroll + ResizeObserver). CSS adds a right-edge mask and the `Σύρε για όλους τους οδηγούς →` hint only while columns are hidden. The driver code is the visible column label and the full name is visually hidden (still read by screen readers). **Scroll-snap skipped:** snapping columns to the container's start would scroll the time axis out of view. `TYRE-OVERFLOW-CUE` PASS at 390 / 768.
- **Priority:** P2
- **Affected surfaces:** standings `?tab=tyre-pace`
- **Viewport:** 390, 768
- **Current problem:** The chart body is 1893px wide with only 3 columns visible and no cue. Names are truncated ("George RUS…") (`standings-tyre-390-dark--standings-panel-active.png`).
- **Exact root cause:** Fixed column widths in `standings/tabs/tyre-pace.css`, no edge fade or hint, and full names under narrow columns.
- **Files:** `standings/tabs/tyre-pace.css`, `standings/tabs/tyre-pace.js`
- **Exact implementation requirement:**
  - `.tyre-pace-chart-shell { mask-image: linear-gradient(90deg,#000 88%,transparent) }`, applied only when a class `is-overflowing` is set by JS on resize or scroll (`scrollWidth > clientWidth`). Remove it at scroll end.
  - Add a `var(--fs-label)` hint "Σύρε για όλους τους οδηγούς →" under the chart legend, shown only while overflowing.
  - The column footer shows the driver code only, with the full name in the existing tooltip and `aria-label`.
  - Add `scroll-snap-type:x proximity` to the shell, and `scroll-snap-align:start` to the columns.
- **What must not change:** the violin chart rendering, the data, the tyre colors (data), and the session selector.
- **Acceptance criteria:** At 390, a cue is visible while overflow exists and hidden at scroll end. No text-overflow ellipsis in the chart footer.
- **Playwright verification state:**
  - **Now:** `standings-tyre-390-dark--standings-panel-active.png`
  - **Check:** `TYRE-OVERFLOW-CUE`
  - **Done when:** PASS at 390 and 768
- **Dependencies:** GLOBAL-03

#### - [x] DATA-07 — Greek UI strings in the standings reports and tab labels `[P1-03]` (data part)
- **Status (2026-09-22): DONE.** Greek tab strip, report selector and report notes (Κενά κατατακτήριων, Κέρδη 1ου γύρου, Ρυθμός ελαστικών, Κυριαρχία πίστας; Dirty Air, Pit Stops, Debrief and Destructors kept as proper nouns), panel tool titles and notes, share/embed buttons, toasts, embed titles, view tabs, card labels and empty/loading/error messages in quali, lap1, pit, track-dom, debrief and destructors. Report dates moved from `en-GB` to `el-GR` (the destructors `$` stays `en-US`). The authored subtitle prose and the debrief cache's `source.note` (data written by the builder) were left as they are. **Budget root cause:** esbuild escaped every Greek letter as a 6-byte `\uXXXX`, so `minify.mjs` now uses `charset: 'utf8'` for the ES-module standings graph only. That also cleared the pre-existing `standings.min.js` and `tyre-pace.min.js` budget overruns (now +1.8% and +0.4%). `GREEK-LABELS-STANDINGS` passes except that data note; `test:standings` passes; all ten tabs render without console errors.
- **Priority:** P1
- **Affected surfaces:** standings tab strip and report selector; the quali report UI ("Teammate pace comparison", "Qualifying Gaps Tab", "Share tab", "Embed tab", "Overview / By Race", "The shared link keeps…"); dates such as "13 Sept"
- **Viewport:** all
- **Current problem:** English report chrome next to Greek reports (`standings-quali-390-dark--standings-panel-active.png`, `standings-1440-dark--fold.png`).
- **Exact root cause:** Strings are hard-coded per report module and in `standings/index.html`. Dates are formatted with an English locale.
- **Files:** `standings/index.html` (tab labels, a source region), `standings/tabs/quali-gaps.js` (and every tab module with English chrome), `standings/tabs/_shared.js` (share/embed labels), `standings/core/format.js` (dates → GLOBAL-08 helper)
- **Exact implementation requirement:**
  - Translate the chrome strings, using the tyre report's existing wording as the reference ("Κοινοποίηση καρτέλας", "Ενσωμάτωση καρτέλας").
  - Tab labels: Οδηγοί, Κατασκευαστές, Κενά κατατακτήριων, Κέρδη 1ου γύρου, Ρυθμός ελαστικών, Dirty Air, Κυριαρχία πίστας, Pit Stops, Debrief, Destructors (proper nouns and jargon kept).
  - All dates go through `formatDateEl`.
- **What must not change:** tab IDs and `?tab=` values; driver codes and team names; "H2H", "Q/SQ" jargon; `EVERY POINT COUNTS.`
- **Acceptance criteria:** A text scan of all 10 tabs finds no English UI chrome outside the jargon allowlist, and every date follows the `el` pattern. `npm run test:standings` passes.
- **Playwright verification state:**
  - **Now:** `standings-quali-390-dark--standings-panel-active.png`, `standings-tyre-390-dark--standings-panel-active.png`
  - **Check:** `GREEK-LABELS` (standings mode), `DATE-FORMAT`
  - **Done when:** PASS for all 10 tabs
- **Dependencies:** GLOBAL-08

#### - [x] DATA-08 — Meaningful "closest battle" `[P3-05]`
- **Status (2026-09-22): DONE.** `findClosestBattle()` (`standings-polish.js`, now exported) only considers adjacent pairs within the top 10 where both have points > 0, falling back to P1–P2. Covered by the new `standings/core/__tests__/closest-battle.test.mjs` (a zero-point tie at P13–P14 and an all-zero fallback), which is picked up by `test:standings`. It changes only which pair the context card names; the standings data is untouched. Done now that the remaining P3 tasks were requested; it had been deferred under the DATA pass's "preserve every calculation" rule.
- **Priority:** P3
- **Affected surfaces:** standings context row
- **Viewport:** all
- **Current problem:** "ΠΙΟ ΚΟΝΤΙΝΗ ΜΑΧΗ: Bottas vs Stroll · 0 βαθ. διαφορά", a tie at the bottom of the table.
- **Exact root cause:** The closest-gap calculation ignores position and zero-point entries.
- **Files:** `standings/core/rendering.js` (or `payloads.js`), `standings/core/__tests__/`
- **Exact implementation requirement:** Compute the minimum gap among adjacent pairs within the top 10 where both have points > 0. Fall back to the P1–P2 gap. Add a unit test that includes a 0-point tie at P19–P20.
- **What must not change:** the context-row layout and copy format.
- **Acceptance criteria:** The new test passes. On the current cache the result is a top-10 pair.
- **Playwright verification state:**
  - **Now:** `standings-390-dark--fold.png`
  - **Check:** `CLOSEST-BATTLE-TOP10`
  - **Done when:** PASS
- **Dependencies:** none

### AUTHORS

#### - [x] AUTHORS-01 — Unbox the profiles, add the folio line, fix labels and the badge `[P2-13]`
- **Status (2026-09-22): DONE.** The page background is now `--bg-base` and the badge text `--accent-contrast`, replacing the undefined `--bg-page`. There's a folio line (`.authors-edition`, computed styles identical to `.archive-edition`). Profiles are unboxed (top rule, no fill or side borders, vertical padding only on mobile), and the cut corner moved to every third portrait. The 24px stagger now applies only at ≥1200. Labels, kicker and badge are 600, including the browser-default-bold `<strong>` labels. Bio is 1rem / 1.65 at 60ch, and story links are .9375rem with 5px padding plus an underline on hover. The focused `?author=` view keeps an accent top rule. **Deviation:** capitals stay as CSS `text-transform` on mixed-case markup rather than typed capitals (identical under `lang="el"`, better for screen readers). `AUTHORS-UNBOXED` and `FOLIO-MATCH` PASS at 390 / 768 / 1440 in both themes, including `?author=georgios-balatzis`.
- **Priority:** P2
- **Affected surfaces:** `/authors/`
- **Viewport:** all
- **Current problem:**
  - Fully bordered, filled profile boxes, with every second one translated 24px, which reads as misalignment inside boxes.
  - Uppercase **700** labels.
  - No folio line; the detector flags `hero-eyebrow-chip`.
  - A 9.9px number badge.
  - An undefined `var(--bg-page)`.

  Evidence: `authors-390-dark--author-directory.png`, `authors-768-dark--fold.png`, baseline `authors-1440x900-light-fold.png`.
- **Exact root cause:** `styles/authors.css` was written apart from the editorial card language and references an undefined token.
- **Files:** `styles/authors.css`, `authors/index.html` (source region: intro markup), `scripts/authors.js` (label strings)
- **Exact implementation requirement:**
  - `.authors-page { background:var(--bg-base) }`. `.author-profile__number { color:var(--accent-contrast) }` (replacing `--bg-page`).
  - `.author-profile { border:0; border-top:1px solid var(--border); background:transparent; padding:24px 0 }`. The 3n cut corner moves to the portrait (`--cut-md`).
  - Keep `translateY(24px)` on even profiles only at ≥1200.
  - Labels (`__kicker`, `__column strong`, `__stories-head strong`, `__archive`, `__social`, intro data link): `font:600 var(--fs-label)/1.4 var(--font-body); letter-spacing:.12em`, capitals typed in markup and JS strings; remove `text-transform:uppercase` and weight 700.
  - Replace the intro `section-kicker` with the folio pattern (`.authors-edition`, a copy of the `.archive-edition` rules): `F1 STORIES / ΟΙ ΑΝΘΡΩΠΟΙ` · `ΠΕΝΤΕ ΦΩΝΕΣ`.
  - Badge `font-size:var(--fs-label)`, min 28×28px.
  - Offset the intro padding from the masthead variable, not the literal `130px`.
- **What must not change:**
  - portraits and their saturate-on-hover
  - numbered badges (position, accent)
  - the directory's focused-author mode (`?author=`)
  - the story lists
  - the h1 wording and its signal full stop
- **Acceptance criteria:**
  - `.author-profile` has no background and no left, right or bottom border.
  - The folio line's computed styles match `.archive-edition` (font, rule, tracking).
  - No 700-weight labels.
  - No undefined custom properties (`getComputedStyle(...).getPropertyValue('--bg-page')` isn't used).
  - `TEXT-MIN` passes.
- **Playwright verification state:**
  - **Now:** `authors-390-dark--author-directory.png`, `authors-768-dark--fold.png`, `authors-1440-*--fold.png`
  - **Check:** `AUTHORS-UNBOXED`, `FOLIO-MATCH`, `TEXT-MIN`, `RADIUS-SET`
  - **Done when:** PASS at the 3 viewports × both themes, including `?author=georgios-balatzis`
- **Dependencies:** GLOBAL-03, GLOBAL-04, GLOBAL-08

---

## Phase 5 — Polish

### - [ ] POLISH-01 — Re-skin the legal pages in the article language `[P1-07]`
- **Priority:** P1 (grouped under POLISH because it is page-local)
- **Affected surfaces:** `privacy/privacy.html`, `privacy/terms.html`
- **Viewport:** all
- **Current problem:**
  - A centered hero with a `999px` pill kicker.
  - A 16px-radius boxed TOC with a pill scroll bar.
  - A 16px-radius bordered content card.
  - Pink monospace code.
  - Mismatched insets (TOC 19px, card 22px).

  Evidence: `privacy-390-dark--fold.png`, `privacy-390-dark--main.png`.
- **Exact root cause:** `styles/legal.css` predates the editorial layer. It's loaded unminified, with no `?v=`, which is a separate minor issue fixed here.
- **Files:** `styles/legal.css`, `privacy/privacy.html`, `privacy/terms.html` (source regions: hero and TOC markup), `scripts/build/minify.mjs` / `stamp-html.mjs` targets (add `styles/legal.css`)
- **Exact implementation requirement:**
  - Hero: left-aligned; a folio line `F1 STORIES / ΝΟΜΙΚΑ` · `ΤΕΛΕΥΤΑΙΑ ΕΝΗΜΕΡΩΣΗ <date>`, using the `.article-edition` rules; h1 in Plex 600 `clamp(2rem,3.8vw,3.2rem)`, `-.025em`, with an `.editorial-accent` full stop; the deck at `var(--fs-deck)` 400.
  - Remove `.legal-kicker`.
  - TOC: a sticky underline-tab strip, reusing the `.standings-tab` visual rules (text, 3px signal underline on active, `radius:0`, no box), with horizontal scroll and a right-edge fade when overflowing.
  - Content: no card; 68ch measure; section h2s use the article numbering style (margin counter at ≥1200); 1px rules between sections.
  - Inline code: Plex, `--bg-surface-alt` background, `radius:var(--radius-control)`, `color:var(--text-primary)`.
  - Minify and stamp `legal.css` like the other stylesheets.
- **What must not change:** the legal text, anchors and IDs, sticky TOC behaviour, the contact CTA, and the cookie-settings entry point.
- **Acceptance criteria:**
  - No computed radius over 4px (except `50%`).
  - No `text-align:center` blocks.
  - Folio styles match `.article-edition`.
  - TOC anchors scroll correctly.
  - `legal.css` is loaded as `legal.min.css?v=…`.
  - Checked at 390, 1440 and 768, in both themes.
- **Playwright verification state:**
  - **Now:** `privacy-390-dark--fold.png`, `privacy-390-dark--main.png`, `privacy-1440-dark--fold.png`, `privacy-768-dark--fold.png`
  - **Check:** `RADIUS-SET`, `FOLIO-MATCH`, `NO-CENTER-BLOCKS`, `TOC-ANCHORS`
  - **Done when:** PASS on both legal pages
- **Dependencies:** GLOBAL-01, GLOBAL-03, GLOBAL-04, GLOBAL-06

### - [x] POLISH-02 — Footer colophon: wordmark and section index `[P3-01]`
- **Status (2026-09-22): DONE.** `partials/footer.html` gains the "F1 STORIES." wordmark (Barlow, signal full stop), a mission line and a section index (Άρθρα, Βαθμολογία, Συντάκτες, YouTube ↗, BetCast ↗) with the signal underline on hover. **Root-cause extra:** `include.mjs` only expanded the shell list, so the partial never reached the 352 articles that carry the same `@include` markers. It now expands article files too (idempotent).
- **Priority:** P3
- **Affected surfaces:** every route with the footer partial
- **Viewport:** all
- **Current problem:** The footer is copyright + 5 social icons + 3 legal links. There's no wordmark or section links (`home-390-light--footer.png`).
- **Exact root cause:** `partials/footer.html` is minimal.
- **Files:** `partials/footer.html`, `styles/editorial.css`. Run `npm run build:html` (after GLOBAL-01) to expand the includes.
- **Exact implementation requirement:**
  - Prepend a row: "F1 STORIES." (Barlow 700, 1.75rem, `--paper`, the same as `.blog-nav-brand`) plus one line of mission copy in Plex `var(--fs-small)` (reuse the hero subtitle text: "Τεχνική ανάλυση, άποψη και ελληνική F1 κοινότητα.").
  - Add a section-link row (Άρθρα, Βαθμολογία, Συντάκτες, YouTube ↗, BetCast ↗) at `var(--fs-label)`, tracked, with the existing signal underline hover.
  - Keep the copyright, social and legal rows.
- **What must not change:** the ink block in both themes, the square social icons, the legal links, the `{{footerExtraLinks}}` standings slot, and `data-current-year`.
- **Acceptance criteria:** The footer shows the wordmark and section links on every route at 390 and 1440. Footer height is ≤360px at 1440 and ≤560px at 390.
- **Playwright verification state:**
  - **Now:** `home-390-light--footer.png`, `home-1440-*--footer.png`
  - **Check:** `FOOTER-COLOPHON`
  - **Done when:** PASS on the 5 routes
- **Dependencies:** GLOBAL-01, GLOBAL-07

### - [x] POLISH-03 — Small alignment, rule-stacking and widow fixes `[P3-04]`
- **Status (2026-09-22): DONE.** Hero photo flush with the text column at ≤767; the journal's "Όλα τα άρθρα" left-aligned without its extra rule on phones; the chip ✓ gets `.5em` padding; `text-wrap: pretty` on decks and intros; the unnumbered partners band moved after section 05, so 01–05 run uninterrupted.
- **Priority:** P3
- **Affected surfaces:** home hero (mobile), home journal footer action, archive chips, privacy intro, home partners numbering
- **Viewport:** 390 (primary)
- **Current problem:**
  - The hero photo is inset 12px from the text column at 390.
  - "Όλα τα άρθρα" floats right between three rules within 80px.
  - "Όλες✓" has no gap.
  - The privacy intro has a widow ("μας.").
  - The partners section is unnumbered between 03 and 04.
- **Exact root cause:** Individual rules: `home.css:326` (`margin:24px 0 33px 12px`), `home.css:154` (`.latest-footer-actions` border), the `archive-editorial.css` chip `::after`, and no `text-wrap` on decks.
- **Files:** `home.css`, `blog-module/blog/archive-editorial.css`, `styles/editorial.css` (the `text-wrap` rule), `index.html` (partners kicker, source region)
- **Exact implementation requirement:**
  - At ≤767: `.hero-photograph { margin-left:0 }`.
  - At ≤767: `.latest-footer-actions { justify-content:flex-start; border-top:0; margin-top:8px }`.
  - `:is(.author-chip,.category-chip).active::after { margin-left:.5em }`.
  - `body.editorial-page :is(.section-intro__text, .hero-subtitle, .archive-subtitle, .legal-subtitle, p.lead) { text-wrap:pretty }`.
  - Partners: move `#home-sponsors` after `#contact`, or leave it unnumbered on purpose. Recommendation: move it after contact, so 01–05 run uninterrupted.
- **What must not change:** the asymmetric hero at ≥768, the right-aligned "all stories" link at ≥768, and the 01–05 numbering.
- **Acceptance criteria:** At 390: the hero photo's left edge equals the h1's left edge (±1px); no two horizontal rules within 24px vertically in `#latest`; no single-word last lines in the listed decks.
- **Playwright verification state:**
  - **Now:** `home-390-dark--hero.png`, `home-390-dark--latest.png`, `state-filters-open-1440.png`, `privacy-390-dark--fold.png`
  - **Check:** `HERO-MOBILE-ALIGN`, `RULE-STACK`, `WIDOWS`
  - **Done when:** PASS
- **Dependencies:** RESP-01, HOME-01, POLISH-01

### - [x] POLISH-04 — Title hygiene warnings in the author tools `[P3-03]`
- **Status (2026-09-22): DONE.** `titleWarnings()` in `scripts/author/article-source.js` flags a repeated adjacent word, a title that is more than 60% capitals, and emoji in the title or `#` headings. `generate-page.js` shows them in a non-blocking confirm before export and publish. 6 assertions added to `article-source.test.mjs`; `test:author` passes. `20260920W`'s title fixed in `source.txt` ("Michael Schumacher Schumacher" → "Michael Schumacher") and rebuilt; 0 files still contain the duplicate. Existing titles were not bulk-rewritten.
- **Priority:** P3
- **Affected surfaces:** author tools (`generate.html`, `housekeeping.html`). The visible effect is on home, blog and article titles.
- **Viewport:** n/a (author tool)
- **Current problem:** A duplicated word in the latest headline ("Schumacher Schumacher", shown 4× on home and archive), an all-caps title ("CHARLES LECLERC …") and emoji in titles and h2s.
- **Exact root cause:** No title validation in the authoring flow.
- **Files:** `scripts/author/article-source.js`, `scripts/author/generate-page.js`, `scripts/author/__tests__/`, `blog-module/blog-entries/20260920W/source.txt` (a content fix, via the normal author PR flow)
- **Exact implementation requirement:**
  - Non-blocking warnings before publish:
    - repeated adjacent word (case-insensitive)
    - title with over 60% uppercase letters
    - emoji in the title or in heading lines (`\p{Extended_Pictographic}`)
  - Unit tests for each rule.
  - Fix the `20260920W` title through the author tool's edit flow (`housekeeping.html`), not by hand-editing `article.html`.
- **What must not change:** the publish flow, token handling, body-text freedom, and existing articles (no bulk rewrite).
- **Acceptance criteria:** `npm run test:author` passes with the new tests. The warnings show for the three cases. The live latest title has no duplicate word after the next publish.
- **Playwright verification state:**
  - **Now:** `home-390-dark--hero.png`
  - **Check:** unit tests (no Playwright); plus `TITLE-NO-DUP-WORD` on home after republish
  - **Done when:** PASS
- **Dependencies:** none

---

## Excluded (by instruction)

These are out of scope for this plan. Don't implement them under these tasks.
- **Breakpoint scale unification** (DESIGN §3 B1). It's broad churn with no visible defect of its own. Revisit only if RESP tasks need it.
- **Removing unused font files** (DM Sans, Outfit) and the **unused GFS Didot preload**. It's cleanup, not a visible professionalization. It can be a separate perf PR.
- **Merging the "Βαθμολογία" and "Δεδομένα" nav items.** This needs an owner decision and markup migration (noted in GLOBAL-10).
- **Consolidating the three charcoal palettes** (DESIGN §1 B1). The home "Night edition" charcoal is documented as a deliberate route variant, so changing it counts as a palette decision.
- **Retiring the legacy `theme-overrides.css`, `critical-common.css` and Roboto**, which only the author tools use.

## Suggested PR grouping

| PR | Tasks | Notes |
|---|---|---|
| 1 | GLOBAL-01 | Generated-only diff; review for expected drift |
| 2 | GLOBAL-02 | Local tooling; can be shared as a gist or ignored file |
| 3 | ARTICLE-01, DATA-01, DATA-02, DATA-03 | Fast, CSS-only, high-visibility fixes |
| 4 | RESP-02, HOME-01 | Renderer + data-contract changes; goldens |
| 5 | GLOBAL-03, GLOBAL-04, GLOBAL-05, GLOBAL-06, GLOBAL-09 | Tokens + shared components (systemic) |
| 6 | A11Y-01, HOME-02, RESP-01, BLOG-01, BLOG-02, HOME-03 | Composition + contrast |
| 7 | GLOBAL-07, GLOBAL-10 | Font subset + menu |
| 8 | GLOBAL-08, DATA-07, HOME-04 | Greek display layer; goldens + contracts |
| 9 | ARTICLE-02 … ARTICLE-06 | Article template/build; goldens + article migration |
| 10 | DATA-04, DATA-05, DATA-06, A11Y-02 | Standings reports |
| 11 | AUTHORS-01, POLISH-01 | Drifting pages |
| 12 | POLISH-02, POLISH-03, POLISH-04, DATA-08 | Polish |
