# F1 Stories — Redesign Verification

Date: 2026-09-22 · Branch `claude-redesign` (HEAD `8932a1d50`).

**Nothing is committed and nothing is deployed.**

This file covers the fixes for the P1 items and the direct low-risk P2 items in `FINAL_VISUAL_CRITIQUE.md`, plus the release gate `npm run verify` over the whole redesign working tree. It also includes the earlier GLOBAL, HOME, BLOG, ARTICLE, DATA and AUTHORS work.

---

## 1. Completed issues

Each fix was verified with a Playwright check in `perf/visual-qa/redesign-audit/checks.mjs --final` (gitignored tooling), run against the local preview.

| ID | Problem confirmed | Root cause fixed | Viewports | Acceptance result |
|---|---|---|---|---|
| **F-01** (P1) | Archive lead at 0.46 / 0.23 of needed resolution; cards 0.26–0.63 | Every card renderer emitted one 400px `src`. Now one shared helper, `cardImageSrcset()` in `blog-module/taxonomy.js`, builds `srcset` (400w card + 800w; leads also 1600w) plus per-slot `sizes`. It's used by the archive (static page + client + lazy loader + error fallback), the home journal and the related cards. `public-artifact.mjs` now ships each card's `-mobile.webp` and, for the `home-latest.json` posts, the 1600w original, so no candidate 404s in `dist/`. Every one of the 631 `*-card.webp` files has both siblings | 1440@1×, 1440@2×, 390@3× | **Partly met.** Leads, the home journal and related cards are ≥0.9 everywhere. Archive grid cards on 2–3× screens reach **0.69–0.90** (was 0.26–0.47): a deliberate 800w ceiling (§4) |
| **F-02** (P1) | Archive stamp covered the deck at 390 | At ≤767 the stamp was `position: absolute` over the note. It now joins the flow below the deck (the treatment ≤359 already used) and the empty ≤359 block is deleted | 360, 390, 768, 1440 | `ARCHIVE-STAMP-CLEAR` **PASS** |
| **F-03** (P1) | Ink on signal 4.22:1 at 12px in light mode (AA fail) | New token `--signal-ink: #17191b`, an existing brand value (home's dark `--ink`), used for all text on `--signal`: timing band, round badge, live dot, paddock strip, primary-button hover, hero and archive stamps. Contrast 4.77:1. Band colour and layout unchanged | 390, 1440 × dark/light | `CONTRAST-BANDS` **PASS**. `qa:visual` contrast PASS |
| **F-04** (P1) | Tyre pace, dirty air, track dominance, debrief and destructors were boxed dashboard cards with 20px and 999px pills | Scoped overrides in `standings/standings-editorial.css` (tab CSS untouched, calculations untouched): report bodies unboxed under a 1px rule, the debrief table gets a 2px ledger top rule, tabs/badges/tooltips/compound pills at `--radius-control`, bars square | 390, 1440 × dark/light | `REPORT-LEDGER`: no boxed card, radius or shadow issues left on those tabs |
| **F-05** (P1) | Cyan leader, emerald/rose deltas, green/red sector times | Faster / leader / better now read by weight (600, `--st-text`); slower / worse by `--st-text-secondary` / 400. Text shadows removed. Team and tyre colours untouched | all | Computed colours are palette tokens (`REPORT-LEDGER` + visual) |
| **F-06** (P1) | Text under 12px in five reports; `.chart-pts-label` at 9.92px | The same selector-list approach as DATA-04 raises every listed label to `.75rem`, including `.chart-pts-label` and `.lap1-axis-label` | 390, 768, 1440 | `TEXT-MIN` **PASS** on all routes |
| **F-07** (P2) | Home cast said "2 Fast" | Name and alt in `index.html` → "Θέμης Χαρβάλης" (the owner-approved Greek name) | all | `COPY-VOICE` **PASS** |
| **F-08** (P2) | Formal placeholders and a title-cased button | Placeholders → informal ("…σου", "Γράψε…"), button → "Αποστολή μηνύματος" | all | `COPY-VOICE` **PASS** |
| **F-10** (P2) | Share/embed labels wrapped at 390 | At ≤767 the `.share-tools` pair stacks full width with `nowrap` labels | 360, 390 | `BUTTONS-NO-WRAP` **PASS** |
| **F-12** (P2) | Related footers misaligned at 768 | At ≥768 the related card is a flex column with the footer pushed to the bottom | 768, 1440 | `RELATED-BASELINE` **PASS** |
| **F-13** (P2, partial) | Debrief tabs "Long Run" / "Race Pace" in English | Tabs and summary labels are Greek ("Ρυθμός stint", "Ρυθμός αγώνα") | all | Tabs **PASS**. The English `source.note` comes from the data cache, not the UI (see §4) |

### Regressions found by `npm run verify` and fixed

- **Quali-gap dots failed `qa:visual` control contrast (1.39–2.68 vs 3:1) in dark mode.**
  - Cause: DATA-04 had given the dots a team-colour fill behind cream (hidden-tooltip) text, removing the dark "instrument ring" that existed for that contrast.
  - Fix: dark mode is back to a surface face with a solid 2px team-colour ring, without the glow.
  - Result: `qa:visual` **PASS**.
- **The Lighthouse guard could never run.**
  - `perf/lighthouse-budget.json` asks for `preset: "mobile"`, but Lighthouse 12.8.2 only accepts `perf`, `experimental` or `desktop`, with mobile as the default. The guard exited before auditing, at HEAD too.
  - Fix in `scripts/perf/lighthouse-guard.mjs`: don't pass `--preset` for mobile.
  - This makes the gate stricter, not weaker: its assertions now execute for the first time.

---

## 2. Screenshot matrix

Captured by `perf/visual-qa/redesign-audit/audit.mjs` (`OUT_DIR=perf/visual-qa/verification`): 242 files, gitignored.

| Route | 390×844 | 768×1024 | 1440×900 | Themes | Sections captured |
|---|---|---|---|---|---|
| Home | ✓ | ✓ | ✓ | dark + light | nav, hero, paddock strip, latest (journal, YouTube, Data Hub), partners, cast, contact, footer |
| Blog | ✓ | ✓ | ✓ | dark + light | masthead, filters, results row, grid, pagination |
| Article `20260920W` | ✓ | ✓ | ✓ | dark + light | cover, body grid, author, navigation, related, comments |
| Article `20260526D` | ✓ | ✓ | ✓ | dark | cover, body grid |
| Standings (drivers) | ✓ | ✓ | ✓ | dark + light | header, timing band, report selector/tabs, context row, table, chart, side panel |
| Standings quali gaps | ✓ | ✓ | ✓ | dark + light | active panel |
| Standings tyre pace | ✓ | ✓ | ✓ | dark | active panel |
| Authors | ✓ | ✓ | ✓ | dark + light | intro, directory |
| Privacy | ✓ | ✓ | ✓ | dark | main |
| States | ✓ | ✓ | ✓ | dark (+ light mobile nav) | mobile nav open, filters open, empty search, pagination, standings API failure, home loading |

**Naming:** `<route>-<width>-<theme>--<section>.png`. `metrics.json` holds per-route DOM metrics. All 39 route × viewport × theme loads rendered with no horizontal overflow.

**Earlier evidence folders:**

| Folder | Contents |
|---|---|
| `perf/visual-qa/redesign-baseline/` | before any change |
| `redesign-audit/` | audit |
| `redesign-global/` | after GLOBAL |
| `redesign-home/` | after HOME |
| `redesign-article/` | after BLOG / ARTICLE |
| `redesign-data/` | after DATA / AUTHORS |
| `final-critique/` | the final critique run |
| `step12-2026-09-22T16-33-35-748Z/` | the repository's own `qa:visual` run over `dist/` |

---

## 3. `npm run verify` result

`npm run verify` was run in full. It stops at the first failure (`build:check`), so the remaining steps were then run individually in the same order. The final state, after the fixes in §1:

| Step | Result | Notes |
|---|---|---|
| `build:public` (pages:guard, build, data contracts, public artifact, validation) | ✅ PASS | `dist/`: 2767 files, 170.15 MB, validated |
| `build:check` (generated drift) | ❌ FAIL (expected) | Every regenerated file is uncommitted, because committing wasn't requested. **The build is idempotent:** a second `build:public` produced no further changes (identical `git diff` / `git status` hashes). It passes once the generated files are committed |
| `quality:static` | ✅ PASS | |
| `audit:runtime` | ✅ PASS | |
| `test:blog` | ✅ PASS (21/21) | Golden fixtures were updated after review. The diff is limited to the related-card `srcset`/`sizes`, the stylesheet `?v=` hashes, and the earlier label, rail and lead changes already reviewed |
| `test:author` | ✅ PASS | |
| `test:standings` | ✅ PASS | |
| `perf:budget` | ❌ FAIL | 3 files over +10%: `scripts/shared-nav.js` +12.5% and `.min.js` +11.5% (**already over at HEAD**, and grown by the GLOBAL-09 scroll-top logic), plus `blog-module/blog-loader.js` **source** +10.4% (GLOBAL-08 Greek display wrappers, HOME-01 cover/journal split, F-01 `setCardSources`). The shipped `blog-loader.min.js` is within budget. **Budget not updated:** this is legitimate new behaviour, but raising the budget is the owner's call |
| `perf:article-media` | ❌ FAIL (pre-existing) | **Identical at HEAD** (checked in a clean worktree): 3744 files / 266.58 MB against a July baseline of 2062 / 192.42 MB, plus two >1 MB images in `20260918W`. Content growth; this work adds no media |
| `perf:images` | ✅ PASS | Every public image, including the newly shipped 800w and 1600w variants, is within the per-image limit |
| `test:consent` | ✅ PASS | |
| `qa:visual` | ✅ PASS | After fixing the quali-dot regression (§1) |
| `perf:lighthouse` | ❌ FAIL (pre-existing budgets) | Now runs for the first time (guard fix, §1). Comparison below |

The same guard fix was applied to a clean HEAD worktree to get the baseline:

| Route | Perf HEAD → now | A11y | LCP | CLS | Verdict |
|---|---|---|---|---|---|
| Home | 77 → **78** | 96 → **100** | 5256 → **5037 ms** | 0.002 → 0.006 | Better; still under the 95 / 2500 ms budget |
| Blog | 85 → 84 | 95 → **100** | 3754 → 3903 ms | 0.001 → 0.001 | a11y better. LCP +149 ms, probably the lead now loading its 800w variant on the emulated 1.75× phone (was 400w). Within run-to-run noise but plausible |
| Standings | 69 → **81** | 93 → **96** | 3907 → **3665 ms** | 0.282 → **0.109** | Clearly better; still over budget |

**Overall:** `npm run verify` does **not** pass. The failures are:
- **`build:check`:** expected until the generated files are committed.
- **`perf:article-media` and the Lighthouse budgets:** failed at HEAD too.
- **`perf:budget`:** partly this work's growth, partly already over at HEAD.

No test or check was weakened, and no budget was changed.

---

## 4. Remaining known issues

| Item | Status |
|---|---|
| F-01 archive grid cards on ≥2× screens | 0.69–0.90 resolution. Offering the 1600w original to every grid card would add about 38 MB of originals to `dist/` and heavier mobile LCP. Needs an owner decision (or a 1200w variant from `generate-image-variants.js`) |
| F-09 lead paragraph too heavy on phones (418px) | Not done; changes article output and goldens. Tune `LEAD_MIN_CHARS` / add a max length, or reduce the mobile lead size |
| F-11 previous/next without titles | Not done (template + build change) |
| F-13 English `source.note` in the debrief summary | Written into `standings/debrief-cache.json` by the builder; fix belongs in `scripts/build/refresh-standings-data.mjs` |
| F-14 tablet home cover | Not done (RESP-01) |
| F-15 standings mark scale, F-16 share set trim | Owner decisions |
| F-17 – F-21 | P3 polish, not done |
| DATA-08 "closest battle" | Skipped: changes a calculation |
| A11Y-02 (touch targets under 24px for quali dots) | Hit area was added in DATA-04; the full sweep isn't done |
| POLISH-01 legal pages, POLISH-02 footer, POLISH-04 title hygiene | Not done |
| `perf:budget` overrun | Owner to accept (`perf:budget:update` with justification) or trim |
| `perf:article-media` baseline | Pre-existing content growth; owner to rebaseline or re-optimise media |
| Lighthouse budgets (perf 95, LCP 2.5 s) | Pre-existing gaps on all routes. Main LCP driver is hero/lead image weight on emulated mobile |
| `build:check` | Passes once the generated drift is committed. Suggested order: commit the generated drift separately from source changes |

---

## 5. Files changed

The working tree against HEAD: 408 tracked files, +10,114 / −14,515 lines. Nothing committed.

**Source: shared system**
- `styles/editorial.css`: tokens, button roles, menu, `--signal-ink`, cut and radius tokens
- `styles/shared-nav.css`, `styles.css`, `styles/home-fonts.css`, `styles/authors.css`

**Source: pages**
- `home.css`
- `blog-module/blog-styles.css`, `blog-module/blog/archive-editorial.css`, `blog-module/blog/article-editorial.css`, `blog-module/blog/article-styles.css`
- `standings/standings-editorial.css`, `standings/standings.css`

**Source: JavaScript**
- `blog-module/taxonomy.js`: display layer + `cardImageSrcset`
- `blog-module/blog-index.js`, `blog-module/blog-loader.js`, `blog-module/blog/article-script.js`, `blog-module/blog/article-comments.js`
- `scripts/shared-nav.js`, `scripts/authors.js`
- `standings/standings.js`
- `standings/tabs/{debrief,destructors,dirty-air,lap1-gains,pit-stops,quali-gaps,track-dominance,tyre-pace}.js`

**Source: build and tooling**
- `blog-module/build/index.js`, `blog-module/build/article-render.js`, `blog-module/build/related.js`
- `scripts/build/check-generated-assets.mjs`, `download-home-fonts.mjs`, `minify.mjs` (UTF-8 charset for the standings graph), `public-artifact.mjs` (card siblings), `validate-data-contracts.mjs` (home-latest max 4)
- `scripts/perf/lighthouse-guard.mjs` (preset bug)
- `docs/data-contracts.md`

**Source: markup**
- `index.html` (source regions: cast, form, taxonomy script)
- `authors/index.html`, `blog-module/blog/index.html` (author chips, masthead copy), `blog-module/blog/template.html`, `standings/index.html`

**Tests**
- `blog-module/build/__tests__/taxonomy-display.test.js` (new)
- `blog-module/build/__tests__/metadata-escaping-guard.js`: the share-URL assertion now targets Facebook `u=` because the Threads link was removed. Same encoding intent
- Golden fixtures ×5

**Assets**
- `assets/fonts/ibm-plex-sans-400-600-arrows.woff2` (new, 3 KB)
- `sw.js` (precache + `SW_VERSION` v41)

**Generated, tracked**
- 352 × `blog-module/blog-entries/*/article.html`
- Shell stamps in `index.html`, `blog-module/blog/index.html`, `blog-module/blog/template.html`, `standings/index.html`, `authors/index.html`, `privacy/*.html`, `generate.html`, `housekeeping.html`, `statistics.html`
- `blog-module/home-latest.json`

**Docs (untracked)**
- `REDESIGN_BASELINE.md`, `DESIGN.md`, `KEEP.md`, `REDESIGN_AUDIT.md`, `TASKS.md`, `FINAL_VISUAL_CRITIQUE.md`, `REDESIGN_VERIFICATION.md`

**Not deployed.** `dist/` is built locally only. Nothing was pushed, and no workflow was triggered.

---

# Round 2 — remaining P2 and P3 items (2026-09-22)

Scope:
- Every remaining P2 and P3 item in `FINAL_VISUAL_CRITIQUE.md`.
- The open P2/P3 tasks in `TASKS.md`: A11Y-02, DATA-08, POLISH-02, POLISH-03, POLISH-04.
- The P1 prerequisites they depended on: RESP-01 (= F-14), A11Y-01 (= F-03), and HOME-02, which was blocked on A11Y-01.

POLISH-01 (legal pages, **P1**) was not in the "P2 and P3" request and is still open.

## R2.1 Completed

| ID | Fix (root cause) | Verification |
|---|---|---|
| **F-09** lead paragraph over-applied (P2) | `markArticleLead()` gains `LEAD_MAX_CHARS = 240`: a standfirst is one or two sentences. Openings measured up to 1,753 characters (median 317). The rule is idempotent and demotes old over-long leads. The phone lead drops to 1.0625rem/1.6. **Leads: 215 → 54 articles.** `20260920W` (312 characters) is now ordinary body text | `LEAD-RULE` PASS (20260918W lead; 20260920W, 20250516G, 20250328G not). Unit assertions for in-range, too-long and demotion |
| **F-11** previous/next bare link (P2) | `blog-module/build/nav.js` renders a direction label plus the story title ("Προηγούμενο" / "Επόμενο", previously English "Previous/Next" on re-rendered articles). The matcher now also compares markup, so all 352 articles were updated. CSS: two halves on desktop, stacked on phones | 352/352 articles contain `.article-nav-title`. Golden diff reviewed |
| **F-13** English `source.note` in debrief (P2) | The summary shows a fixed Greek methodology note (`DEBRIEF_METHOD_NOTE`) instead of the builder's English string. The cache data is untouched | `GREEK-LABELS-STANDINGS` PASS on all 10 tabs |
| **F-14 / RESP-01** tablet cover (P2) | A 768–991 block in `home.css`: full-measure title (4 lines at 768), full-width 16:9 photo with the stamp, caption on one row, description beside byline, no scroll hint. It only applies when the viewport is taller than 500px, so the landscape phone layout is unaffected | `p-hero-768-dark-2.png`, `p-hero-900-light.png`. 390 and 1440 unchanged |
| **F-15** masthead mark scale (P3) | The mark sits in its own column, so it can be large again: 4.5rem (3.25rem at 768–1199) | `OVERLAP:masthead-mark` still PASS at 768 / 1024 / 1200 / 1440 |
| **F-17** meta separator (P3) | `createStoryMeta()` inserts an `aria-hidden` "·"; gap tightened to 8px | Visual (home journal) |
| **F-18 / POLISH-02** colophon (P3) | Wordmark, mission line and section index in `partials/footer.html`. **Root cause:** `include.mjs` only expanded shells, so partials never reached the 352 articles; it now expands article files too (a rerun expands 0 files) | `p-footer-1440-dark.png`, `p-footer-390-light.png`. Present on every route |
| **F-19** meta-line icons (P3) | Calendar, tag and clock glyphs hidden in the article cover meta, related cards and archive cards (text-only like home, authors and standings). The cover meta gets "·" separators | Visual |
| **F-20 / POLISH-04** headline hygiene (P3) | `titleWarnings()` (repeated word, mostly capitals, emoji) as a non-blocking confirm before export and publish in `generate.html`. `20260920W` title fixed in `source.txt` and rebuilt | `test:author` 8/8 (6 new assertions). 0 files still contain "Schumacher Schumacher" |
| **F-21** authors headline (P3) | Plex 600 at −.03em, like the other Plex mastheads (was 700 at −.045em) | Visual |
| **POLISH-03** (P3) | Hero photo aligned at ≤767, single rule under the journal on phones, ✓ gap on chips, `text-wrap: pretty` on decks, partners band after section 05 | Visual. Numbering 01–05 is uninterrupted |
| **A11Y-02** (P2) | Standalone text links get `inline-flex; min-height: 24px`. Links inside sentences use WCAG 2.5.8's inline exception. Text floor was already done | `TARGET-MIN` PASS on 13 routes × 390 / 1440. `TEXT-MIN` PASS |
| **DATA-08** (P3) | `findClosestBattle()` restricted to scoring pairs in the top 10, falling back to P1–P2 | New `standings/core/__tests__/closest-battle.test.mjs` (2 cases). `test:standings` 3/3 |
| **A11Y-01, HOME-02** | Closed by F-03 (`--signal-ink`) | `CONTRAST-BANDS`, `PADDOCK-BAND` PASS |

**Not implemented: F-16 (share-set trim).** It's a product decision, not a defect. Restore the Threads, Instagram DM and Telegram buttons only if you want them back.

## R2.2 Check matrix

These are Playwright checks against the local preview, 47 in total. Viewports are 390 / 768 / 1440 unless a check says otherwise, in both themes where themed.

| Result | Checks |
|---|---|
| **44 PASS** | Everything listed in `checks.mjs --list` except the three below, including `TARGET-MIN`, `LEAD-RULE`, `RELATED-BASELINE`, `CONTRAST-BANDS`, `GREEK-LABELS-STANDINGS`, `NO-JS-ERRORS` |
| FAIL (accepted) `FONT-PLATFORM` | "✳" on the home paddock strip has no IBM Plex glyph; decorative and `aria-hidden` |
| FAIL (documented ceiling) `IMG-RES` | Archive grid cards on 2–3× screens stop at 800w (0.69–0.90) |
| `REPORT-LEDGER` | Failed only on `.track-dom-tooltip`'s shadow. That's a floating overlay, and overlays are exempt from the flat rule like the dropdown and cookie banner, so the check now exempts `[class*=tooltip]` |

New screenshots: `perf/visual-qa/verification/p-hero-768-dark-2.png`, `p-hero-900-light.png`, `p-footer-1440-dark.png`, `p-footer-390-light.png`. The full matrix from §2 is in the same folder.

## R2.3 `npm run verify` (all steps run)

| Step | Result |
|---|---|
| `build:public` | ✅ 2767 files, 170.58 MB, validated |
| `build:check` | ❌ expected: uncommitted generated drift. The build stays idempotent |
| `quality:static`, `audit:runtime` | ✅ |
| `test:blog` 21/21, `test:author` 8/8, `test:standings` 3/3, `test:build` | ✅ |
| `perf:images`, `test:consent`, `qa:visual` | ✅ |
| `perf:budget` | ❌ `shared-nav.js` / `.min.js` (over at HEAD), and `blog-loader.js` **source** now **+11.1%** (this round's meta separator added about 140 bytes). The `.min.js` is within budget. **Budget not changed** |
| `perf:article-media` | ❌ pre-existing, identical at HEAD |
| `perf:lighthouse` | ❌ budgets, pre-existing at HEAD |

Lighthouse at HEAD compared with now:

| Route | Perf | A11y | LCP | CLS |
|---|---|---|---|---|
| Home | 77 → **80** | 96 → **100** | 5256 → **4581 ms** | 0.002 → 0.003 |
| Standings | 69 → **80** | 93 → **96** | 3907 → **3814 ms** | 0.282 → **0.097** |
| Blog | 85 → **81** | 95 → **100** | 3754 → **4203 ms** | 0.001 → 0.000 |

**Blog is the one regression.** The archive lead is now served at 800w on the emulated 1.75× phone (it was the 400w card), which trades about 450 ms of LCP for a sharp lead image. Options:
- Keep it.
- Make the static first card `sizes` stop at 400w on phones (`100vw` → `50vw`), accepting a soft lead on phones again.
- Add a pre-sized 600w variant.

## R2.4 Files changed this round

`blog-module/build/nav.js`, `blog-module/build/article-render.js` (lead max), `blog-module/blog-loader.js` (meta separator), `blog-module/blog/article-editorial.css`, `blog-module/blog/archive-editorial.css`, `home.css`, `styles/editorial.css`, `styles/authors.css`, `standings/standings-editorial.css`, `standings/standings-polish.js`, `standings/tabs/debrief.js`, `partials/footer.html`, `scripts/build/include.mjs`, `scripts/author/article-source.js`, `scripts/author/generate-page.js`, `index.html` (partners order), `blog-module/blog-entries/20260920W/source.txt` (title).

Tests: `scripts/author/__tests__/article-source.test.mjs` (+6 assertions), `standings/core/__tests__/closest-battle.test.mjs` (new), golden fixtures ×5 (colophon, titled previous/next, demoted leads; reviewed).

Generated: all 352 `article.html`, the shells, `blog-module/blog-index*.json`, `blog-module/home-latest.json`, `sitemap.xml`.

Whole working tree vs HEAD: 419 files, +17,372 / −17,640. **Nothing committed; nothing deployed.**

## R2.5 Still open

- POLISH-01, the legal pages (P1, outside this request).
- The F-01 grid-card resolution ceiling and the Blog LCP trade-off (owner decision).
- F-16, the share set (owner decision).
- `perf:budget` for `blog-loader.js` and `shared-nav.js`, the `perf:article-media` baseline, and the Lighthouse budgets (owner decisions or separate performance work).
- `build:check` passes once the generated drift is committed.
