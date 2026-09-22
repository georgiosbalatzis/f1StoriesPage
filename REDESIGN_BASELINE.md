# F1 Stories — Redesign Baseline

Captured 2026-09-22 on branch `claude-redesign` (HEAD `8932a1d50`). **This is a read-only baseline. No UI files were changed.**

The rule for all later work: **source code decides.** It sets the colors, type, spacing, components and behaviour. The live site is only something to compare against for regressions.

---

## 1. Architecture map

```
                         ┌───────────────────────── SOURCE ─────────────────────────┐
partials/head-meta.html ─┐                                                          │
partials/footer.html ────┼─ include.mjs ──► shell HTML (in-place @include blocks)   │
                         │                  index.html, blog/index.html,            │
                         │                  blog/template.html, standings/,         │
                         │                  authors/, privacy/*, 404, offline …     │
source CSS / JS ─────────┼─ minify.mjs (lightningcss + esbuild) ──► *.min.css/js    │
                         │                   + scripts/build/asset-manifest.json    │
                         │  stamp-html.mjs ──► ?v=<sha256[:8]> refs in shell HTML,  │
                         │                     icon sprite inline, article shell    │
                         │                     migration (article-editorial.mjs)    │
blog-entries/<id>/*.txt ─┼─ blog-module/build/index.js (worker pool)                │
  + images               │     └─ template.html ──► blog-entries/<id>/article.html  │
                         │     └─ blog-index-data.json, blog-index-page-1.json,     │
                         │        home-latest.json, blog-source-cache.json, sitemap │
YouTube API ─────────────┴─ fetch-youtube.mjs ──► assets/youtube-latest.json        │
                                                                                    │
npm run build:public = pages:guard → build → data-contracts → public-artifact.mjs   │
                       → validate-public-artifact.mjs  ──►  dist/  (gitignored)     │
                                                                                    │
.github/workflows/deploy-pages.yml ──► upload-pages-artifact(dist) ──► GitHub Pages │
```

### Runtime layering (what each public page loads, in order)

| Route | Body classes | CSS (in load order) | Page JS |
|---|---|---|---|
| `/` `index.html` | `home-page editorial-page` | bootstrap.slim → `styles` → `styles/editorial` → `home` → `styles/shared-nav` → `styles/home-fonts` | analytics, web-vitals, cookie-consent, `blog-module/blog-loader`, `scripts/f1-optimized`, `shared-nav` |
| `/blog-module/blog/` | `editorial-page archive-page` | home-fonts → bootstrap.slim → `styles` → `blog-module/blog-styles` → shared-nav → editorial → `blog/archive-editorial` | shared-nav, blog-fixes, taxonomy, blog-index |
| article (`template.html` → `article.html`) | `editorial-page article-page` | home-fonts → bootstrap.slim → `styles` → blog-styles → `blog/article-styles` → `blog/article-rail` → shared-nav → editorial → `blog/article-editorial` | article-script, article-rail, article-comments, shared-nav, cookie-consent, blog-fixes |
| `/standings/` | `editorial-page standings-page` | home-fonts → bootstrap.slim → `styles` → shared-nav → `standings` → `standings-polish` → editorial → `standings-editorial` (+ lazy `standings/tabs/*.css` via `ensureTabStylesheet()`) | `standings.min.js` (ESM, esbuild chunks in `standings/chunks/`) + `standings-nomodule` |
| `/authors/` | `authors-page editorial-page` | `styles` → home-fonts → editorial → shared-nav → `styles/authors` | shared-nav, authors, sw-register |
| `/privacy/privacy.html`, `terms.html` | `editorial-page` | home-fonts → bootstrap.slim → `styles` → shared-nav → editorial → `styles/legal.css` (**unminified, no `?v=`**) | shared-nav, cookie-consent, sw-register |
| `404.html`, `offline.html` | none | inline styles only | offline-page |

Every page's `<head>` runs `scripts/perf/error-beacon` and `scripts/theme-init` first, before anything paints.

**Legacy layer (author tools only).** `theme-overrides.css`, `styles/critical-common.css` (inlined critical CSS) and `styles/fonts.css` are now loaded **only** by `generate.html`, `housekeeping.html` and `statistics.html`. No public route loads them. `styles/layers.css` is minified and allowlisted but no HTML loads it. Contrary to what the brief assumed, `theme-overrides.css` is **not** part of the public design surface.

### JS module map (from graphify, `graphify-out/graph.json`, 1,820 nodes)

The graph only covers JS/MJS symbols. CSS and HTML were mapped by hand for this document.
- `scripts/shared-nav.js`: navbar, mobile menu, theme toggle (`f1stories-theme`), race countdown (`tickCountdown`), scroll-to-top, reading progress, `isFooterInView`.
- `scripts/theme-init.js`: pre-paint theme. Reads localStorage and falls back to sessionStorage. `light` sets `html[data-theme="light"]`. Dark is the attribute being absent.
- `scripts/cookie-consent.js`, `scripts/analytics.js` and `scripts/perf/web-vitals-beacon.js`: consent-gated (`f1stories-cookie-consent-v1`).
- `blog-module/blog-loader.js`: homepage latest-posts, reading `home-latest.json`. `blog-index.js`, `taxonomy.js` and `blog-fixes.js` run the archive search, filter and pagination.
- `blog-module/blog/article-script.js`, `article-rail.js` and `article-comments.js`: article runtime.
- `standings/standings.js` + `standings/core/*` (fetchers, cache, rendering, payloads, lifecycle) + `standings/tabs/*.js|css` (lazy per-report).
- `scripts/f1-optimized.js`, `hero-background-init.js` and `background-randomizer.js`: homepage.
- `scripts/author/*`: author tools (`generate.html`, `housekeeping.html`), which never reach `dist/`.

---

## 2. Source-of-truth CSS / HTML

### CSS (edit these, never the `.min.css`)

Ownership comes from `docs/css-architecture.md` and was checked against what each page actually loads.

| File | Lines | Owns |
|---|---:|---|
| `styles.css` | 807 | Global tokens (legacy `:root` palette: `#111113` / `#8fb6cf` / Roboto), base elements, footer, modals, utilities |
| `styles/editorial.css` | 651 | **The live brand system.** Paper/ink/signal tokens for both themes, scoped on `body.editorial-page`; masthead, footer and consent skin; archive/article token variant |
| `styles/shared-nav.css` | 669 | Navbar, mobile menu, theme toggle, scroll-top, reading progress |
| `styles/home-fonts.css` | — | Self-hosted Barlow Condensed, GFS Didot, IBM Plex Sans (Greek subsets) |
| `home.css` | 409 | Homepage cover, journal, podcast/data links, team, sponsors, contact |
| `blog-module/blog-styles.css` | 1,928 | Blog card components (archive + homepage) |
| `blog-module/blog/archive-editorial.css` | 451 | Archive masthead, search/filter, story layout, pagination |
| `blog-module/blog/article-styles.css` | 1,562 | Article reading layout, hero, body type, related, comments |
| `blog-module/blog/article-rail.css` | 162 | ≥992px article rail |
| `blog-module/blog/article-editorial.css` | 771 | Editorial skin for articles |
| `standings/standings.css` | 622 | Standings shell, tables, report selector |
| `standings/standings-polish.css` | 412 | Interaction polish (paired with `standings-polish.js`) |
| `standings/standings-editorial.css` | 269 | Standings masthead, timing tables, report skins |
| `standings/tabs/*.css` | — | Per-report styles, loaded lazily |
| `styles/authors.css` | 86 | Authors page |
| `styles/legal.css` | 229 | Privacy/terms |
| `theme-overrides.css` | 1,057 | Legacy light-theme overrides: **author tools only**, 312 `!important` |
| `styles/critical-common.css`, `critical-standings.css` | 692 / 457 | Critical CSS inlined only into author tools (the standings entry is kept in the manifest but no longer inlined) |

### HTML

| File | Status | Notes |
|---|---|---|
| `partials/head-meta.html`, `partials/footer.html` | SOURCE | Expanded in place by `include.mjs`. Footer takes `{{footerEmailHref}}` and `{{footerExtraLinks}}` (standings adds a "clear cache" button) |
| `index.html`, `blog-module/blog/index.html`, `standings/index.html`, `authors/index.html`, `privacy/*.html`, `404.html`, `offline.html`, `f1telemetry/`, `ghostcar/` | **SOURCE + GENERATED regions** | You edit the markup by hand, but `@include:begin/end` blocks, `?v=` hashes, `<!-- f1s:icon-sprite -->` and critical CSS blocks are rewritten by the build. **Don't hand-edit inside those markers.** |
| `blog-module/blog/template.html` | SOURCE (+ stamped refs) | The one template for all 352 articles |
| `blog-module/blog-entries/*/article.html` (352) | GENERATED-BUT-TRACKED | Rebuilt from template + source. `stamp-html.mjs` also migrates shells in place |

**The navigation is not a partial.** The `.blog-nav` markup is copied inline into every shell page (16–20 occurrences of `blog-nav*` classes per page) and is baked into all 352 committed articles. Changing the nav markup therefore means editing about 8 shells plus `template.html`, then regenerating or migrating the articles. A CSS-only nav change avoids all of that.

---

## 3. Generated-file ownership

| Class | Files | Tracked in git? | Produced by |
|---|---|---|---|
| **SOURCE** | `partials/`, source `*.css` / `*.js`, `blog-module/build/`, `blog-module/blog/template.html`, `standings/**/*.js`, `scripts/**`, `.github/workflows/`, `docs/`, `blog-entries/<id>/` text sources | yes | humans / author tools |
| **GENERATED-BUT-TRACKED** | Include blocks and `?v=` stamps inside shell HTML; `blog-entries/*/article.html`; `blog-index-data.json`, `blog-index-page-1.json`, `home-latest.json`, `blog-source-cache.json`; `sitemap.xml`; `sw.js`; `assets/youtube-latest.json`; `standings/*-cache.json`, `standings/debrief-cache.json` | yes | `build:html`, `build:blog`, `build:youtube`, `build:standings-data`, `stamp-html` |
| **GENERATED (ignored)** | `*.min.css`, `*.min.js`, `*.map`, `scripts/build/asset-manifest.json`, `styles/vendor/bootstrap.slim.css`, `images/icons/sprite.svg`, `blog-module/blog-data.json`, `dist/`, `perf/visual-qa/` | **no** (see `.gitignore`) | `minify.mjs`, `build:bootstrap`, `build-icon-sprite.mjs` |
| **PUBLIC ASSETS** | `images/**`, `assets/fonts/*.woff2`, `blog-entries/*/*.avif|webp`, `manifest.json`, `robots.txt`, `CNAME` | yes | fonts, logos, headshots, image-variants scripts |
| **BUILD TOOLS** | `scripts/build/*.mjs`, `scripts/quality/*`, `scripts/perf/*`, `blog-module/build/*`, `scripts/serve-site.mjs`, `scripts/author/serve-tools.mjs` | yes | — |
| **OUT OF SCOPE / untracked** | `DESIGN_COMPARISON.md`, `DESIGN_CONCEPTS.md`, `design-experiments/`, `graphify-out/` | untracked | earlier sessions |

### ⚠️ Discrepancies found (these matter before any change)

1. **Docs disagree with the actual setup about minified files.** `docs/static-publishing-model.md` says `*.min.*` and `asset-manifest.json` are committed. `.gitignore` excludes them and `git ls-files '*.min.*'` returns 0. `generated-drift-guard.mjs` still lists them, which is harmless because ignored files never show up in `git status`.
2. **Stamped hashes can't be reproduced locally.** The committed `index.html`, blog index, template, standings and authors pages reference `styles.min.css?v=9c6508cb`. A fresh local `minify.mjs` produces `0c0b5f47`, and that is what `privacy/*.html` references. `stamp-html.mjs --dry` plans **37 shell rewrites plus an inline-runtime migration of all 352 articles**. So running `npm run build` or `build:assets` locally will create large tracked drift that has nothing to do with the redesign. Plan for this: either land a stamp-normalising commit on its own first, or keep redesign PRs to source-only diffs and let CI (`auto-build [skip ci]`) regenerate.
3. `styles/legal.css` is loaded unminified with no cache-busting hash.
4. Three different dark charcoals are defined for the same brand surface: `styles/editorial.css` `#1b1a19`, `home.css` `#181a1c`, and the legacy `styles.css` `:root` `#111113`, which still applies to anything outside `.editorial-page`.

Baseline prep ran `node scripts/build/minify.mjs` only. It writes ignored files (`*.min.*` and the manifest) so the local preview matches source. No tracked file changed: `git status` is identical to the session start.

---

## 4. Page / surface inventory

| Surface | Entry | Data sources | Public (`dist/`)? |
|---|---|---|---|
| Homepage | `index.html` | `blog-module/home-latest.json`, `assets/youtube-latest.json`, countdown in shared-nav | ✅ |
| Blog archive | `blog-module/blog/index.html` | `blog-index-page-1.json`, `blog-index-data.json` | ✅ |
| Article (×352) | `blog-module/blog-entries/<id>/article.html` | built from `template.html` | ✅ |
| Standings (drivers, constructors, quali-gaps, lap1, tyre pace, dirty-air, track-dominance, pit stops, destructors, debrief) | `standings/index.html?tab=…` | `standings-cache.json` + live APIs (Jolpica/OpenF1) | ✅ |
| Authors | `authors/index.html` | inline + `scripts/authors.js` | ✅ |
| Privacy / Terms | `privacy/privacy.html`, `privacy/terms.html` | static | ✅ |
| 404 / Offline | `404.html`, `offline.html` | static, SW fallback | ✅ |
| Redirect bridges | `f1telemetry/`, `ghostcar/` | — | ✅ |
| Author tools | `generate.html`, `housekeeping.html`, `statistics.html` | GitHub API (token) | copied to `dist/` (required by `pages-source-guard`), not linked from the site |

Shared components: masthead/nav, theme toggle, race countdown, mobile menu, reading progress, scroll-to-top, footer (partial), cookie-consent banner and settings, icon sprite (`<use href="#fa-*">`), and the blog card (used on both the homepage and the archive).

---

## 5. Responsive breakpoints

There's no single breakpoint scale. Two conventions are mixed across files: Bootstrap's `.98px` and whole-pixel values.

| Tier | Values in use | Main users |
|---|---|---|
| xs | `359px`, `359.98px` | editorial, home, archive, article, standings-editorial |
| sm | `479.98`, `480`, `520`, `575.98`, `576` | styles, shared-nav, blog-styles, article-styles, standings |
| md | `767`, `767.98`, `768` (min + max) | **every file.** Both `767px` and `767.98px` appear, sometimes in the same file (`editorial.css`, `standings.css`) |
| lg | `991`, `991.98`, `992` (min), `1024`, `1100` | nav collapse (`shared-nav` 991/992), article rail (992), standings |
| xl | `1199`, `1199.98`, `1200` (min), `1399.98` | editorial, home, archive, article, standings |
| xxl | `1600` (min) | home |

Other layout facts:
- The editorial container is `max-width: 1476px`, `padding-inline: 48px`, set in `styles/editorial.css` and reduced at the smaller tiers.
- The desktop nav appears at ≥992px. Below that the hamburger and mobile menu take over.
- The article rail appears at ≥992px.
- Baseline check: **none of the 30 captures showed horizontal overflow** at 390, 768 or 1440 px.

---

## 6. Shared design primitives (as implemented)

From `styles/editorial.css`, which applies to all public routes:

- **Color, dark** (default, no `data-theme`): `--bg-base #1b1a19`, `--bg-surface #242321`, `--bg-surface-alt #2e2c29`, `--text-primary #eee8db`, `--text-secondary #b6bbac`, `--border #4b5146`, `--accent #ff775f`, `--accent-hover #ff947f`.
- **Color, light** (`html[data-theme="light"]`): `--bg-base #f2eee4`, `--bg-surface #e9e3d6`, `--text-primary #20251f`, `--text-secondary #5b6256`, `--border #c8c8b9`, `--accent #a82e1c`.
- **Brand constants**: `--paper #e9e3d6`, `--ink #20251f`, `--signal #ed4c32` (the racing-red rule and the red full stop after headlines).
- **Route variants**: archive and article re-scope to a warmer charcoal (`--text-tertiary #968f86`, `--accent-readable #ff9a89`). `home.css` re-scopes again (`--bg-base #181a1c`, `--accent #ff826b`, plus the `--home-cover-*` family).
- **Type**: `--font-body` / `--font-display` / `--font-editorial` are all IBM Plex Sans. `--font-brand` is Barlow Condensed (wordmark, "THE GRID." mastheads). GFS Didot is preloaded for articles. `h2` is `600 clamp(1.8rem, 3vw, 3rem)/1.2` with `-.025em` tracking. `.section-kicker` is `.75rem`, weight 600, `.13em` tracking, uppercase.
- **Legacy scale** (`styles.css`, still present): `--text-xs … --text-3xl` (0.75–2.75rem), `--space-2xs … --space-xl` (0.25–2.25rem), `--max-prose 68ch`, `--leading-tight 1.2` / `--leading-normal 1.6`.
- **Shape and depth**: `--radius-media 4px`, `--button-radius 2px`, `--shadow-sm/md: none`. The editorial system is flat on purpose.
- **Motion**: `--ease-editorial cubic-bezier(.22,.68,0,1.02)`.
- **Spacing**: `--space-section clamp(40px, 6vw, 80px)`.
- **Texture**: an inline SVG noise overlay (`body.editorial-page::after`, opacity .035) that shows in light mode only.
- **Focus**: `2px solid var(--accent)`, offset 5px.
- **`!important` counts** (checked by `scripts/quality/important-guard.mjs`): theme-overrides 312, shared-nav 52, standings 18, blog-styles 15, styles 12, editorial 10, article-styles 9.

---

## 7. Build / test commands

| Purpose | Command | Changes tracked files? |
|---|---|---|
| Local preview (no build) | `node scripts/serve-site.mjs` → http://127.0.0.1:4173 | no |
| Refresh minified CSS/JS only | `node scripts/build/minify.mjs` (or `npm run build:assets:minify`) | no (ignored outputs) |
| Preview the way docs describe it | `npm run preview` (build:assets + check:assets + serve) | **yes**, restamps HTML (see §3 ⚠️2) |
| Expand partials | `npm run build:html` | yes, when partials change |
| Blog | `npm run build:blog` / `build:blog:force` | yes |
| Full build | `npm run build` | yes |
| Public artifact | `npm run build:public` → `dist/` | yes (runs build) |
| Drift check | `npm run build:check` | no |
| Static quality | `npm run quality:static` (static-source, important-guard, rendering-sink) | no |
| Tests | `npm run test:blog` (golden), `test:author`, `test:standings`, `test:build`, `test:consent` | no |
| Perf budgets | `npm run perf:budget` (CSS/JS size, `--update` to rebaseline), `perf:images`, `perf:article-media`, `perf:lighthouse` | no |
| Visual QA (existing) | `npm run qa:visual`: runs against `dist/`, 4 viewports × 2 themes, a11y/contrast/focus checks | no |
| Full release gate | `npm run verify` | yes |

CI: `quality.yml` runs on PRs. `deploy-pages.yml` runs on push to `main`, `workflow_call` and manual dispatch. `publish-blog.yml` runs scheduled content and standings maintenance. `auto-publish-author-pr.yml` merges author PRs and calls deploy.

---

## 8. Regression-sensitive functionality

- **Theme**: `theme-init.js` must run before paint. The storage key `f1stories-theme` migrates from sessionStorage to localStorage. Dark is the attribute being *absent*, so any CSS keyed on `[data-theme="dark"]` will never match. `aria-pressed` must stay in sync on every `.theme-toggle-btn`.
- **Nav**: the desktop↔hamburger switch at 991/992, the mobile menu, the race countdown (`tickCountdown`, which changes over time), scroll-top visibility (`isFooterInView`) and reading progress on articles.
- **Consent**: the banner, the `[data-cookie-settings]` footer button, and analytics gating. Covered by `npm run test:consent`.
- **Homepage**: latest-posts hydration from `home-latest.json`, the YouTube/articles tabs, the preloaded LCP image (latest article's `1.avif`), and the Formspree contact form.
- **Archive**: search, category filter and pagination (`blog-index.js`, `taxonomy.js`), and page-1 JSON preload.
- **Article**: the `<picture>` AVIF/WebP pipeline, embeds (`embed-render.js` sanitisation), the ≥992px rail, share buttons, related/prev-next, comments. Golden fixtures cover markup (`test:blog`).
- **Standings**: `?tab=` URL state (`read/writeStandingsURLState`), lazy tab CSS/JS chunks, cache fallback, clear-cache footer button, share action, the `nomodule` fallback.
- **Service worker** (`sw.js`): it precaches the shell, so stale CSS can survive a deploy. The validator checks SW references.
- **Public boundary**: `pages-source-guard` and `validate-public-artifact` fail the build if routes, assets or author tools move without updating the allowlists.
- **Budgets**: `perf/size-guard` fails on CSS/JS growth, so any CSS additions will need `perf:budget:update` with a justification.
- **Security/static rules**: `static-source-guard` bans inline handlers and inline scripts. `rendering-sink-guard` checks `innerHTML` sinks.

---

## 9. Baseline screenshots

Captured with `playwright-core` driving system Chrome against `node scripts/serve-site.mjs` (repo root, fresh `minify.mjs`). Settings: service workers blocked, consent pre-accepted (analytics off), theme forced through `f1stories-theme` plus `prefers-color-scheme`, page scrolled once to trigger lazy/reveal content, then returned to the top.

**Location:** `perf/visual-qa/redesign-baseline/` (gitignored, local only)
**Naming:** `<route>-<W>x<H>-<theme>-{fold|full}.png`, i.e. 5 routes × 3 viewports × 2 themes × 2 = **60 PNGs**, plus `results.json`.

| Route | URL | Height @390 / 768 / 1440 (dark) |
|---|---|---|
| `home` | `/` | 4462 / 4376 / 4045 |
| `blog` | `/blog-module/blog/index.html` | 6671 / 4700 / 3996 |
| `article` | `/blog-module/blog-entries/20260920W/article.html` | 8372 / 6002 / 5833 |
| `standings` | `/standings/` (drivers tab) | 3275 / 3289 / 3192 |
| `authors` | `/authors/` | 3526 / 2667 / 2017 |

Examples:
- `perf/visual-qa/redesign-baseline/home-1440x900-dark-fold.png`
- `perf/visual-qa/redesign-baseline/standings-390x844-light-full.png`
- `perf/visual-qa/redesign-baseline/article-768x1024-dark-full.png`

Result: all 30 page loads returned HTTP 200, with **0 uncaught page errors** and **0 horizontal overflow**. Light and dark both applied: `data-theme` was verified in `results.json`.

Content that changes between runs and will make pixel diffs noisy:
- the race countdown in the nav
- the homepage hero, which is the latest article
- the archive order
- standings data and the "last updated" date
- the YouTube snapshot

To regenerate: `node scripts/serve-site.mjs` then `node perf/visual-qa/redesign-baseline/capture.mjs` (the script lives next to the PNGs). Or use `npm run qa:visual` after `build:public` (which covers the same viewports against `dist/`).
