# F1 Stories — UI/UX Audit

Audited 2026-09-22 on branch `claude-redesign`. The local preview was `node scripts/serve-site.mjs`, run on the current source with fresh `minify.mjs` output.

The audit order was **390×844 → 1440×900 → 768×1024**, in both themes. No source files were changed. This document and the evidence folder are the only outputs.

> ⚠️ **DEGRADED: single-context.** Impeccable's critique method calls for two isolated sub-agents. This session only spawns sub-agents when the user asks explicitly, so the design review and the detector/browser evidence were collected in one context. To limit anchoring, the visual judgement came first and the detector output was checked against it afterwards (§1.3).

**Authority.** `DESIGN.md` and `KEEP.md` define what stays. Every finding below proposes a change **inside** the existing identity: no new palette, no new typefaces, no new visual language.

**Evidence.** All paths are relative to `perf/visual-qa/redesign-audit/`. The folder is gitignored and local only.
- **Section crops:** `<route>-<w>-<theme>--<section>.png`, 243 files.
- **UI states:** `state-*.png` (mobile nav, filters open, empty search, pagination, standings API failure, home loading).
- **Targeted views:** `v-*.png`, plus `article-390-related-settled.png`.
- **DOM metrics:** `metrics.json` (text under 12px, touch targets, radii, shadows, distinct font sizes, overflow).
- **Scripts:** `audit.mjs` regenerates everything (start the server first). The one-off probes for image resolution, fonts and related cards live in the session scratchpad.

---

## 1. Summary

### 1.1 Core answer

The identity is strong, specific and mostly well executed: the paper/ink/signal palette, the folio lines, the Barlow mastheads, the unboxed cards and the ledger-style standings.

What stops it feeling like a finished professional editorial product is not the design language. It is **execution debt at the edges of that language**:

1. **Visible breakage on core surfaces.** Related stories collapse on mobile. The YouTube play button is blank. A Greek title falls back to Helvetica and overflows its container.
2. **Under-resolved photography.** The site's main visual asset is shown at 26–52% of the resolution the layout needs, on the two most visited pages.
3. **Greek-first is broken in taxonomy and data UI.** Category names, author names, tab names and reading times switch between Greek and English, depending on the page.
4. **Composition gaps.** There is a dead void under the archive lead story, the home hero repeats the lead story, and the tablet hero is a stretched desktop layout.
5. **Parts that look independently authored.** The legal pages, the in-article tables, the quali-gaps report and the authors cards each speak a different dialect: pills, 14–16px radii, glows, boxes. At least eight button styles sit next to each other.

### 1.2 Impeccable audit health score

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 2 | Ink on signal is 4.2:1 on 12px band text; 10×10px quali dot targets; 9.6–11.5px text in data views |
| 2 | Performance | 3 | Mostly lean. The hero ships a 1600px AVIF into a 712px slot while cards starve at 400px (misallocated bytes) |
| 3 | Responsive | 2 | Related cards collapse at ≤767px; tablet hero keeps a 2-column split; standings side panel overflows at 1440 |
| 4 | Theming | 2 | Dark-mode paddock strip loses the signal band; legacy blue remnants in article CSS; three charcoals |
| 5 | Implementation integrity | 2 | Coherent core, but legal, table, report and authors components drift from the system |
| **Total** | | **11/20** | **Acceptable: significant work needed, but no redesign** |

**Integrity verdict: PASS with drift.** The system is product-specific. The folio lines, numbered kickers, stamps, timing band and ledger standings could not be moved to an unrelated site unchanged. The failures are local drift, not a generic template.

### 1.3 Deterministic detector (`impeccable detect`, 7 pages)

| Rule | Hits | Verdict |
|---|---|---|
| `numbered-section-labels` (home ×4) | 4 | **False positive.** Numbered kickers are protected identity (KEEP §Editorial structure) |
| `hero-eyebrow-chip` (authors, privacy) | 2 | **Mixed.** Authors kicker is identity but should become the folio line (P2-13). The privacy pill is real drift (P1-07) |
| `side-tab` (lead paragraph, author box, h3 bar, st-row, dark paddock strip) | 6 | **Mostly false positive.** Category rules are identity. **Real:** the dark-mode paddock strip, which replaces the band with a 4px side tab (P2-06) |
| `low-contrast` 4.2:1 ink on `#ed4c32` | 1 | **Real** (P1-12) |
| `low-contrast` white on `#ff775f`, 2.6:1 | 2 | Not reproduced visually. Left for the P2-07 sweep to check |
| `gpt-thin-border-wide-shadow`, `dark-glow #41b6e6` | 7 | **Real drift.** Shadows are back in a flat system (P2-07); legacy blue in `article-styles.css:714–874` |
| `broken-image` / `buried-raster` (archive) | 22 | **False positive.** The lazy loader fills `src` on scroll. Verified: images load and fade to opacity 1 within 300ms |
| `layout-transition max-height` (mobile menu) | 7 | Minor, P3. Leave as is |
| `wide-tracking`, `all-caps-body` | ~12 | **Mostly false positive.** Tracked capitals labels are identity. Real only where the capitals are long sentences (P2-13) |
| `cramped-padding` | ~30 | Mostly rule-based layouts misread as boxes. Ignored |

---

## 2. Findings

Severity:
- **P0**: visibly broken or badly degraded on a core surface.
- **P1**: clearly unprofessional, or a WCAG AA failure.
- **P2**: inconsistency a trained eye notices.
- **P3**: polish.

---

### P0

#### P0-01 — Related stories collapse into a 139px column on mobile
- **PAGE:** every article (352), "Σχετικά άρθρα"
- **VIEWPORT:** ≤767px, both themes
- **OBSERVED:** Each related card squeezes image, date, title and CTA into the left ~40% of the row. The right ~60% is empty. Titles break mid-word ("αποτελεσματικό / τητα"). Evidence: `article-390-related-settled.png`, `article-390-dark--article-related-section.png`, `v-table-390-dark.png`.
- **WHY IT LOOKS UNPROFESSIONAL:** It reads as a broken page at the exact point where the reader decides what to read next.
- **WHAT MUST BE PRESERVED:** The mobile intent: thumbnail on the left, text on the right; the one cut corner on the third card; the paper label tab.
- **ROOT CAUSE:** `article-editorial.css:625,638` puts `display:grid; grid-template-columns:.85fr 1.15fr` on `.related-card-link`. But `blog-module/build/related.js:71-72` gives that link a single child, `.related-article-card`, so the whole card sits in grid column 1.
- **EXACT CHANGE:** Move the grid to the card. At ≤767px use `.article-page .related-article-card { display:grid; grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr); gap:18px }` (≤359px: `.8fr 1.2fr; gap:12px`), and reset `.related-card-link` to `display:block`. The `.related-card-media` becomes column 1 and `.card-body` column 2.
- **LIKELY FILES:** `blog-module/blog/article-editorial.css`
- **ACCEPTANCE CRITERIA:** At 390 and 360, `.card-body` starts to the right of `.related-card-media`, and the title width is ≥180px. No word breaks inside a word. `article-390-related-settled.png` recaptured shows image and text side by side. 768 and 1440 are unchanged.

#### P0-02 — Lead photography renders at 26–52% of the resolution it needs
- **PAGE:** home journal lead + secondary stories, archive grid (lead and cards), related cards
- **VIEWPORT:** all viewports; worst at 1440 and on DPR 2–3 phones
- **OBSERVED:** Only `1-card.webp` (400px wide) is served.
  - Archive lead: 771×482 CSS px → ratio **0.52** at DPR1, **0.26** at DPR2.
  - Home lead: 632×474 → 0.63 / 0.32.
  - Archive cards at 1440: 427px → 0.47 at DPR2.
  - Phone full-width cards: 346px at DPR3 → 0.39.

  Visibly soft and pixelated: `home-1440-dark--latest.png`, `blog-1440-dark--articles-grid.png`. Meanwhile the hero is sent a 1600px AVIF for a 712px slot.
- **WHY IT LOOKS UNPROFESSIONAL:** Photography is the site's main visual asset (KEEP §Photography). Blurry lead images are the fastest signal of an amateur site.
- **WHAT MUST BE PRESERVED:** Crops and aspect ratios, the desaturate-at-rest treatment, the cut corners, lazy loading, and the article media budget.
- **ROOT CAUSE:** The card renderers emit a single `src` pointing at the 400px `-card.webp`, although `-mobile.webp` (800px) and `1.webp` / `1.avif` (1600px) already exist in every entry folder.
- **EXACT CHANGE:** Emit `srcset="…/1-card.webp 400w, …/1-mobile.webp 800w, …/1.webp 1600w"` with a real `sizes` value:
  - archive lead: `(min-width:1200px) 780px, (min-width:768px) 50vw, 100vw`
  - grid cards: `(min-width:1200px) 430px, (min-width:768px) 50vw, 100vw`
  - home lead: `(min-width:1200px) 640px, (min-width:768px) 55vw, 100vw`
  - secondary and thumbnail rows: `(max-width:767px) 104px, 400px`

  Wrap in `<picture>` with an AVIF `<source>` wherever `1-mobile.avif` / `1.avif` exist. Keep `-card.webp` as the fallback `src`.
- **LIKELY FILES:** `blog-module/blog-index.js`, `blog-module/blog-loader.js`, `blog-module/build/related.js`, `blog-module/build/index.js` (thumbnail fields in `blog-index-data.json` / `home-latest.json`), `docs/data-contracts.md` and `scripts/build/validate-data-contracts.mjs` if new fields are added.
- **ACCEPTANCE CRITERIA:** `naturalWidth / (cssWidth × DPR)` ≥ 0.9 for every lead and card image at 1440@2x and 390@3x. The existing resolution probe reproduces this. `npm run perf:images` and `perf:budget` pass. Blog golden fixtures are updated intentionally.

---

### P1

#### P1-01 — The home hero and the journal lead show the same story back to back
- **PAGE:** home. **VIEWPORT:** all
- **OBSERVED:** The hero shows the latest article's title, excerpt, image and byline. The first item of "01 / ΤΟ JOURNAL" repeats the same title, image and excerpt one scroll later. Evidence: `home-390-dark--hero.png` and `home-390-dark--latest.png`; `home-1440-dark--fold.png` and `--latest.png`.
- **WHY IT LOOKS UNPROFESSIONAL:** Editorial front pages never run the cover story twice. It reads as an automated feed rather than a curated edition.
- **WHAT MUST BE PRESERVED:** The hero as a cover for the latest story (headline crossing the photo, stamp, figcaption numbering). The journal's lead plus 2 secondary stories plus margin column.
- **ROOT CAUSE:** `blog-loader.js` renders `home-latest.json` from index 0, and the hero is also stamped from post 0 (`f1s:hero-*` markers).
- **EXACT CHANGE:** The journal starts at post index 1: lead = post[1], secondary = post[2..3]. `home-latest.json` must carry at least 4 posts; check the data contract.
- **LIKELY FILES:** `blog-module/blog-loader.js`, `blog-module/build/index.js` (home-latest size), `scripts/build/validate-data-contracts.mjs`
- **ACCEPTANCE CRITERIA:** On home, no article URL appears in both `#hero` and `#latest`. The journal still shows 1 lead and 2 secondary stories.

#### P1-02 — A dead void under the archive lead story (tablet and desktop)
- **PAGE:** blog archive. **VIEWPORT:** 768, 1440 (both themes)
- **OBSERVED:** The lead card spans grid rows 1–2, but its content ends about 200px (1440) or about 300px (768) above the bottom of the stacked right column. The result is an empty rectangle under the lead excerpt. Evidence: `blog-1440-dark--articles-grid.png` (y≈800–1000), `blog-768-light--articles-grid.png` (y≈570–880).
- **WHY IT LOOKS UNPROFESSIONAL:** An asymmetric spread only works when both sides resolve at the same baseline. A hole reads as a layout error, not as white space.
- **WHAT MUST BE PRESERVED:** The curated opening spread (lead in columns 1–7, two stories stacked in 9–12), the 62px cut corner, and the lead title size.
- **ROOT CAUSE:** `archive-editorial.css` sets the lead image to a fixed `aspect-ratio:16/10`, and the two right-hand cards (16/9 image plus meta, title, excerpt, CTA) add up taller. Nothing lets the lead stretch.
- **EXACT CHANGE:** At ≥768px, make the lead `.article-card` a flex column filling its grid area (`height:100%`). Give its `.article-card-img-wrap` `flex:1 1 auto; aspect-ratio:auto; min-height: <16/10 of width>`, with `object-fit:cover` on the image. Photo height then absorbs the difference. Alternatively, set the right-column cards' images to `aspect-ratio:3/2` at 768–1199.
- **LIKELY FILES:** `blog-module/blog/archive-editorial.css`
- **ACCEPTANCE CRITERIA:** At 768 and 1440, the bottom edge of the lead card's CTA row sits within 24px of the bottom of card 3. There is no vertical gap over 48px anywhere in the first grid row group.

#### P1-03 — Greek-first breaks in taxonomy, names and data UI
- **PAGE:** home, blog, article, standings, authors. **VIEWPORT:** all
- **OBSERVED:**
  - Categories are in English everywhere: "News", "History", "Teams", "Drivers", "Opinion · Betting", "Technical · Data", plus filter chips "Analysis / Technical / …" (`state-filters-open-1440.png`).
  - Author names are Latin on the archive, articles and authors page ("Georgios Balatzis") but Greek on home ("Γιώργος Μπαλατζής").
  - Reading time appears as "4 λεπ", "4 λεπτά ανάγνωσης" and "3 MIN" (related cards, `v-related-1440-light.png`).
  - Standings tabs mix "Οδηγοί / Κατασκευαστές" with "Quali Gaps / Lap 1 Gains / Tyre Pace / …".
  - The quali report is entirely English ("Teammate pace comparison", "Qualifying Gaps Tab", "Share tab", "Overview / By Race"; `standings-quali-390-dark--standings-panel-active.png`), while the tyre report is Greek.
  - Dates appear as "13 Sept", "2026-09-20", "20 Σεπτεμβρίου 2026" and "15 Αυγ 2026".
- **WHY IT LOOKS UNPROFESSIONAL:** Language switching between neighbouring labels is the clearest "assembled from parts" signal. It breaks the Greek-first identity (KEEP §Greek-first).
- **WHAT MUST BE PRESERVED:** English as brand slogans and F1 jargon ("RACE DESK", "TEAM RADIO", "THE GRID.", "EVERY POINT COUNTS.", driver codes, "H2H"). Category slugs and URLs.
- **ROOT CAUSE:** Display labels are the raw slugs or English strings in `taxonomy.js`, `build/related.js` ("min") and the standings tab modules. Author display names come from different sources on different pages.
- **EXACT CHANGE:**
  - Add a single Greek display map for categories (e.g. News→Ειδήσεις, Analysis→Ανάλυση, Technical→Τεχνικά, History→Ιστορία, Opinion→Άποψη, Betting→Στοίχημα, Drivers→Οδηγοί, Teams→Ομάδες) and use it in every renderer. Slugs stay as they are.
  - Use one author display name (Greek) from `scripts/authors.js` everywhere.
  - Use one reading-time format ("4′ ανάγνωση" or "4 λεπτά") and one date format (`d MMMM yyyy` with the `el` locale), shared through one helper.
  - Translate the quali report UI strings.
  - Tab names: Greek labels, keeping established jargon only where it is a proper noun (e.g. "Dirty Air" may stay; "Tyre Pace" → "Ρυθμός ελαστικών").
- **LIKELY FILES:** `blog-module/taxonomy.js`, `blog-module/blog-index.js`, `blog-module/blog-loader.js`, `blog-module/build/related.js`, `blog-module/build/article-render.js`, `blog-module/build/metadata.js`, `scripts/authors.js`, `standings/index.html` (tab labels), `standings/tabs/quali-gaps.js` (and siblings), `styles/authors.css` is unaffected
- **ACCEPTANCE CRITERIA:**
  - A text scan of rendered home, blog, article, standings (all tabs) and authors finds no English category word outside the allowlisted jargon.
  - Every instance of a given author uses the same display name.
  - Exactly one reading-time pattern and one date pattern appear site-wide.
  - Golden fixtures are updated.

#### P1-04 — The standings side-panel title falls back to Helvetica and overflows
- **PAGE:** standings (drivers). **VIEWPORT:** 1440 (visible ≥1200)
- **OBSERVED:** "Αγωνιστικό δελτίο" is set in `var(--font-brand)` (Barlow Condensed, which ships a Latin subset only). CDP reports **Helvetica** rendering all 16 glyphs. The wide fallback runs to x=1426, beyond the 1392px content edge. Evidence: `standings-1440-dark--fold.png`.
- **WHY IT LOOKS UNPROFESSIONAL:** It is visibly the wrong typeface, and it is clipped against the viewport.
- **WHAT MUST BE PRESERVED:** Barlow only for Latin display words (KEEP). The side panel as a margin note.
- **ROOT CAUSE:** `standings-editorial.css:80` sets `.standings-side-kicker { font: 700 2.7rem/.95 var(--font-brand) }` on Greek text.
- **EXACT CHANGE:** Set it to `600 1.45rem/1.2 var(--font-body)` with `letter-spacing:-.02em`, matching the other margin titles such as `.chart-title`. Also add a static-guard rule: flag any `var(--font-brand)` selector whose rendered text contains Greek.
- **LIKELY FILES:** `standings/standings-editorial.css`, optionally `scripts/quality/static-source-guard.mjs`
- **ACCEPTANCE CRITERIA:** The CDP platform font for `.standings-side-kicker` is IBM Plex Sans. Its right edge is ≤ the container content edge at 1200 and 1440.

#### P1-05 — The standings masthead arrow collides with the text around it
- **PAGE:** standings. **VIEWPORT:** 768 (worst), 1440
- **OBSERVED:** At 768, the 5.5rem rotated "↗" mark crosses "Κάθε βαθμός," and the edition label "ΑΝΑΛΥΣΗ" (`standings-768-light--fold.png`). At 1440 it touches the edition line (mark box top 133px vs label bottom 131px).
- **WHY IT LOOKS UNPROFESSIONAL:** Glyphs overlapping body text look accidental.
- **WHAT MUST BE PRESERVED:** The arrow as an affordance mark in the aside.
- **ROOT CAUSE:** `standings-editorial.css:39`: `position:absolute; right:5px; top:-20px` inside an aside whose width changes by breakpoint. The glyph also renders from a fallback font (Hiragino / Segoe), so its size differs by platform.
- **EXACT CHANGE:** Put the mark in the flow: aside `display:grid; grid-template-columns:1fr auto`, with the mark in column 2 aligned to the note's first line, at 3rem ≥1200 and 2.25rem 768–1199. Hide it at ≤767 (already hidden). See P2-14 for the glyph font.
- **LIKELY FILES:** `standings/standings-editorial.css`
- **ACCEPTANCE CRITERIA:** The mark's bounding box does not intersect `.standings-masthead-note` or `.standings-edition` at 768, 1024, 1200 or 1440, in either theme.

#### P1-06 — The tablet home hero is a squeezed desktop layout
- **PAGE:** home. **VIEWPORT:** 768×1024 (and roughly 768–991)
- **OBSERVED:** The 47/53 two-column split holds at 768. The headline wraps into 7 lines at about 330px wide, the photograph shrinks to 366×230, and "SCROLL TO EXPLORE ↙" still shows. Evidence: `home-768-dark--fold.png`.
- **WHY IT LOOKS UNPROFESSIONAL:** It's the classic awkward tablet state: neither the composed mobile cover nor the desktop spread.
- **WHAT MUST BE PRESERVED:** The headline crossing the image edge (desktop), the stamp, the figcaption, and the mobile grid-area recomposition.
- **ROOT CAUSE:** `home.css` switches to the one-column `grid-template-areas` composition only at `max-width:767px`. The 991px rule only adjusts margins.
- **EXACT CHANGE:** Move the recomposed cover to `max-width:991px`. From 768 to 991, use `grid-template-areas: 'edition edition' 'title title' 'subtitle subtitle' 'photo photo' 'description byline' 'actions actions'`. Keep the photo at full width with `aspect-ratio:16/9` and the stamp overlapping its top edge. Hide `.hero-scroll` at ≤991.
- **LIKELY FILES:** `home.css`
- **ACCEPTANCE CRITERIA:**
  - At 768 the headline is ≤4 lines.
  - The photo is ≥ the container width minus 24px.
  - The primary CTA is visible within the first 1024px.
  - The 390 and 1440 renders are pixel-identical to the baseline.

#### P1-07 — The legal pages use a different design language
- **PAGE:** `privacy/privacy.html`, `privacy/terms.html`. **VIEWPORT:** all
- **OBSERVED:** A centered hero, a `999px` pill kicker ("ΑΠΟΡΡΗΤΟ"), a 16px-radius boxed TOC with a pill scroll bar, a 16px-radius bordered content card, and pink monospace inline code. The TOC inset (19px) doesn't match the card inset (22px). Evidence: `privacy-390-dark--fold.png`, `privacy-390-dark--main.png`.
- **WHY IT LOOKS UNPROFESSIONAL:** A trust page that looks like a different product undermines trust. These are the only pills and large radii on the site.
- **WHAT MUST BE PRESERVED:** The content, the section anchors, sticky TOC behaviour, and the contact CTA.
- **ROOT CAUSE:** `styles/legal.css` predates the editorial layer and was never re-skinned.
- **EXACT CHANGE:** Re-skin to the article language:
  - a left-aligned folio line `F1 STORIES / ΝΟΜΙΚΑ` · `ΤΕΛΕΥΤΑΙΑ ΕΝΗΜΕΡΩΣΗ …`
  - an h1 in Plex 600 with the signal full stop
  - the TOC as an underline-tab strip (like `.standings-tab`)
  - no box around the content: 68ch measure, section h2s numbered with the article counter style, 1px rules between sections
  - code as Plex with `--bg-surface-alt` background and a 2px radius
  - no radius over 4px, no `999px`
- **LIKELY FILES:** `styles/legal.css`, `privacy/privacy.html`, `privacy/terms.html` (folio markup)
- **ACCEPTANCE CRITERIA:** No computed `border-radius` over 4px and no centered text blocks on the legal pages. The folio line matches `.article-edition`. Sticky TOC and anchors still work (390, 1440).

#### P1-08 — In-article data tables look like another product
- **PAGE:** articles with CSV tables (e.g. `20250516G`, 9 tables). **VIEWPORT:** all
- **OBSERVED:**
  - The table sits in a rounded card with a shadow and a **solid coral header block** ("ALPINE").
  - It has **pill** toggles ("Προβολή πίνακα / Προβολή καρτών") and a "Σύρετε για περισσότερα" hint.
  - At 1440 the columns are clipped inside the 680px measure while the rail beside it is empty.

  Evidence: `v-h2-1440-dark.png`, `v-table-1440-light.png`.
- **WHY IT LOOKS UNPROFESSIONAL:** A big accent fill, pills and a card chrome go against the restrained accent and the flat system. Clipping data next to empty space looks careless.
- **WHAT MUST BE PRESERVED:** The table/card view toggle function, horizontal scroll on small screens, and the source caption ("Πηγή: alpine.csv").
- **ROOT CAUSE:** The `blog-module/build/csv-to-table.js` markup plus legacy rules in `article-styles.css`, not overridden by `article-editorial.css`.
- **EXACT CHANGE:**
  - Header: `.75rem` tracked label in `--article-signal-readable` above a 2px `--text-primary` top rule, like the standings ledger. No fill.
  - Toggles: underline tabs.
  - Container: no radius, no shadow, 1px row rules, tabular numerals.
  - At ≥1200, let `.table-container` span both body-grid columns (`grid-column:1/-1`, max 968px).
- **LIKELY FILES:** `blog-module/blog/article-editorial.css`, `blog-module/blog/article-styles.css`, `blog-module/build/csv-to-table.js` (only if class hooks are missing), golden fixtures
- **ACCEPTANCE CRITERIA:** No element in `.article-content table`'s ancestry has a background of `--accent` or `--signal`, a radius over 2px, or a box-shadow. At 1440 the table shows all columns without horizontal scroll for tables with ≤4 columns. The toggle still works.

#### P1-09 — The scroll-to-top button overlaps content
- **PAGE:** home, blog, article. **VIEWPORT:** 1440, 768
- **OBSERVED:** A 40px round button fixed at bottom-left sits over the journal lead's meta ("Themis Charvalis · News") and over archive excerpts (`home-1440-dark--latest.png`, `blog-1440-dark--articles-grid.png`).
- **WHY IT LOOKS UNPROFESSIONAL:** A floating control covering text is a visible collision. It is also the only round utility button in a square system.
- **WHAT MUST BE PRESERVED:** The scroll-to-top function after long scrolls, and the 44px target.
- **ROOT CAUSE:** `styles/shared-nav.css` places it on the left, with `50%` radius from legacy. `editorial.css` re-skins its colors only.
- **EXACT CHANGE:** Anchor it bottom-right at `right: max(16px, calc((100vw - 1476px)/2 + 16px))` so it stays in the margin at ≥1476px. Make it a 44×44 square with 2px radius. Show it only after 2 viewport heights, and never while the footer is in view (`isFooterInView` already exists).
- **LIKELY FILES:** `styles/shared-nav.css`, `styles/editorial.css`
- **ACCEPTANCE CRITERIA:** At 768, 1440 and 1920, the button's box does not intersect any text node's box in any captured scroll position on home, blog or article. The computed radius is 2px.

#### P1-10 — The quali-gaps (and lap1 / pit-stop) reports read like a dashboard
- **PAGE:** standings `?tab=quali-gaps` (and sibling reports). **VIEWPORT:** all
- **OBSERVED:**
  - Every pairing is a bordered box with a **14px-radius** tinted track.
  - The dots have **glow rings** (`0 0 0 3px rgba(team,.24)` × 228).
  - Deltas are in green and red that aren't in the palette.
  - Dot targets are **10×10px**. Tooltip text is 9.6px and names are 10.9px.

  Evidence: `standings-quali-390-dark--standings-panel-active.png`, `metrics.json`.
- **WHY IT LOOKS UNPROFESSIONAL:** It breaks the "ledger, not dashboard" principle (DESIGN §4), and the glows edge towards the HUD styling the anti-patterns ban.
- **WHAT MUST BE PRESERVED:** Team colors on data, the H2H scores, driver headshots, the dot distribution concept, and the Overview / By Race views.
- **ROOT CAUSE:** Report CSS in `standings/tabs/quali-gaps.css` (and siblings) predates the editorial skin. `standings-editorial.css:151` removes radius and shadow from cards, but not from tracks or dots.
- **EXACT CHANGE:**
  - Pairings become rule-separated rows (1px `--st-border` top), not boxes.
  - Tracks: radius 0, background `color-mix(--st-text 3%)`.
  - Dots: solid team fill with a 1px `--bg-base` stroke, no glow.
  - Deltas in `--text-primary` with a sign, and "faster" marked by weight (600), not green/red.
  - Dot hit area ≥24px through a transparent pseudo-element.
  - Tooltip and names ≥12px.
- **LIKELY FILES:** `standings/tabs/quali-gaps.css`, `standings/tabs/lap1-gains.css`, `standings/tabs/pit-stops.css`, `standings/standings-editorial.css`
- **ACCEPTANCE CRITERIA:** In the quali panel, no computed box-shadow, no radius over 2px except on dots, and no text under 12px. Dot hit targets are ≥24×24. The same checks pass for lap1 and pit-stops.

#### P1-11 — At least eight button styles, with no shared primary
- **PAGE:** site-wide. **VIEWPORT:** all
- **OBSERVED:** Side by side on real pages:
  - the hero primary (ink block, 47px)
  - the contact submit (paper block, 48px, a different color in each theme)
  - `.cta-secondary` (underline)
  - the archive `.page-btn` (filled coral with an inset shadow)
  - the standings retry (coral text on a coral-tinted box; `state-standings-error-1440.png`)
  - share buttons (bordered squares)
  - filter disclosures (bordered with a shadow)
  - cookie buttons

  The primary style is defined only as `.home-page .cta-*`.
- **WHY IT LOOKS UNPROFESSIONAL:** The same action looks different on each page. The components look independently authored.
- **WHAT MUST BE PRESERVED:** The primary visual (ink block turning signal with ink text on hover), the secondary underline link, and 44px targets.
- **ROOT CAUSE:** Buttons were styled per route; there's no shared component in `styles/editorial.css`.
- **EXACT CHANGE:** Define three roles in `styles/editorial.css`, scoped `body.editorial-page`:
  - `.btn-primary`: the current hero primary spec, lifted out of `home.css`
  - `.btn-secondary`: 1px border, transparent, text primary; hover border and text accent
  - `.btn-text`: the current `.cta-secondary`

  Map every existing class onto them: `.cta-primary`, `.contact-submit`, `.retry-btn`, `.page-btn` (secondary, active = primary), `.filter-reset-btn`, `.cookie-btn`, `.accept-btn` (primary), share and utility buttons (secondary). Delete the per-route duplicates.
- **LIKELY FILES:** `styles/editorial.css`, `home.css`, `blog-module/blog/archive-editorial.css`, `standings/standings-editorial.css`, `standings/standings.css`, `styles/shared-nav.css`
- **ACCEPTANCE CRITERIA:** A computed-style inventory of all visible `button, .cta-button, a[class*=btn]` across the five routes yields ≤3 distinct (background, border, radius, font-weight) signatures per theme, plus the active pagination state.

#### P1-12 — Ink text on the signal bands fails WCAG AA
- **PAGE:** standings timing band, home paddock strip (light), stamps (decorative, exempt). **VIEWPORT:** all
- **OBSERVED:** `#20251f` on `#ed4c32` = **4.2:1** on 12px/500 text ("Live δεδομένα · Σεζόν 2026", "Μετά τον γύρο 11", paddock topics and link).
- **WHY IT LOOKS UNPROFESSIONAL:** It's an AA failure on primary status information.
- **WHAT MUST BE PRESERVED:** The full-bleed signal band, ink text on signal, and the palette. Neither color may change.
- **ROOT CAUSE:** Small text size on a mid-luminance fill.
- **EXACT CHANGE:** Raise band text to AA large-text size: ≥18.66px bold, where 3:1 applies. For example, set `.standings-sub` and `.paddock-strip a` to Barlow 700 at 1.2rem for Latin, or Plex 600 at 1.17rem for Greek. Alternatively, put the small meta on an ink chip (`--ink` background, `--paper` text) inside the band. Leave the band color untouched.
- **LIKELY FILES:** `standings/standings-editorial.css`, `home.css`
- **ACCEPTANCE CRITERIA:** axe or `qa:visual` contrast checks report no failures in the timing band or the paddock strip, in both themes.

---

### P2

#### P2-01 — CTA copy, voice and meta formats vary by component
- **PAGE:** home, blog, article. **VIEWPORT:** all
- **OBSERVED:** "Διάβασε την ιστορία" (hero, informal), "Συνέχεια ανάγνωσης" (home cards), "Διαβάστε περισσότερα" (archive, formal plural), "Διαβάστε" (related). "Εξερευνήστε το αρχείο" is formal, while "Γνώρισε την ομάδα" and "Άκου την παρέα" are informal. Dates are ISO `2026-09-20` in home meta and in words elsewhere.
- **WHY IT LOOKS UNPROFESSIONAL:** Editorial products keep one voice. Mixing formal and informal address reads as multiple authors writing UI copy.
- **WHAT MUST BE PRESERVED:** The conversational, informal voice, which dominates and is identity (KEEP).
- **ROOT CAUSE:** Copy is hard-coded in each renderer.
- **EXACT CHANGE:** Informal singular everywhere. Card CTA: "Διάβασε". Archive masthead link: "Εξερεύνησε το αρχείο". Home meta dates use the shared `el` date helper from P1-03.
- **LIKELY FILES:** `blog-module/blog-loader.js`, `blog-module/blog-index.js`, `blog-module/build/related.js`, `blog-module/blog/index.html`, `index.html`
- **ACCEPTANCE CRITERIA:** A text scan finds no second-person-plural imperatives (`-ήστε`, `-άστε`, `-ετε` imperative forms) in the UI chrome, and one card-CTA string site-wide.

#### P2-02 — Articles have three different left edges
- **PAGE:** article. **VIEWPORT:** 1440 (and 1200–1439)
- **OBSERVED:** Cover text starts at x=97, body text at x=236, the related-section heading at x=140, and related cards at x=152 (Bootstrap column padding). Evidence: `article-1440-dark--fold.png`, `v-related-1440-light.png`.
- **WHY IT LOOKS UNPROFESSIONAL:** Rhythm breaks when successive blocks don't share an axis. The 12px offset between the related heading and its cards looks like a mistake.
- **WHAT MUST BE PRESERVED:** A wide cover versus a narrow reading measure (a deliberate contrast), and the margin rail.
- **ROOT CAUSE:** The cover uses the container with 48px padding. The body grid is centered at 968px, and the related section at 1160px with Bootstrap `.col-md-4` gutters.
- **EXACT CHANGE:** Align the related section and comments to the body grid's outer width (968px, same left edge). Remove Bootstrap column padding in `.article-related-section` (`--bs-gutter-x:0`, and use `gap:32px` on the flex row). Optionally align the cover's text column to the body's left edge at ≥1200.
- **LIKELY FILES:** `blog-module/blog/article-editorial.css`
- **ACCEPTANCE CRITERIA:** The related heading's left edge equals the first card's left edge, which equals the body-text left edge (±1px), at 1200 and 1440.

#### P2-03 — The article rail repeats information and crowds icons
- **PAGE:** article. **VIEWPORT:** ≥992
- **OBSERVED:**
  - The category appears **four times** above the fold: the cover label "NEWS", the meta link "News", the rail "ΡΕΠΟΡΤΑΖ · News", and the rail "ΚΑΤΗΓΟΡΙΕΣ" chip. A fifth is in the mobile mini-bar.
  - Date and reading time appear in both the cover and the rail.
  - Seven boxed share icons sit in two rows, inside a bordered box in dark mode.

  Evidence: `article-1440-dark--fold.png`, `--article-body-grid.png`.
- **WHY IT LOOKS UNPROFESSIONAL:** Repetition and icon grids are over-design. The rail should hold notes, not duplicates.
- **WHAT MUST BE PRESERVED:** Share functions, the related list in the rail with `01–03` numbering, and the category link.
- **ROOT CAUSE:** `article-render.js` renders both the cover meta and `article-rail-meta` / `article-rail-tags`.
- **EXACT CHANGE:**
  - Remove the rail meta block and the rail category chip (the cover already has them).
  - Share: one row of 4 (Facebook, WhatsApp, native share, copy link). The others go behind native share.
  - Unboxed, 1px rules, like the other rail cards.
- **LIKELY FILES:** `blog-module/build/article-render.js`, `blog-module/blog/article-editorial.css`, `blog-module/blog/article-rail.css`, golden fixtures
- **ACCEPTANCE CRITERIA:** The category label is rendered at most twice per article (cover + mini-bar). The rail has ≤4 share buttons and no bordered wrapper.

#### P2-04 — The automatic lead paragraph misfires
- **PAGE:** article (e.g. `20250516G`). **VIEWPORT:** all
- **OBSERVED:** The `ΕΙΣΑΓΩΓΗ` label and the large 500-weight style get applied to a one-line lead-in ("Η Alpine A525 έλαβε δύο αναβαθμίσεις:") that sits under an h2 (`v-h2-1440-dark.png`).
- **WHY IT LOOKS UNPROFESSIONAL:** Labelling a colon sentence as an "introduction" shows the template doesn't understand the content.
- **WHAT MUST BE PRESERVED:** The lead-paragraph treatment on real standfirsts.
- **ROOT CAUSE:** `article-editorial.css` targets `.article-content > p:first-of-type` without any content condition.
- **EXACT CHANGE:** The build adds `class="article-lead"` only when the first block is a `<p>` that comes before any heading, is ≥140 characters, and doesn't end in ":". The CSS targets `.article-lead`.
- **LIKELY FILES:** `blog-module/build/article-render.js` (or `worker.js`), `blog-module/blog/article-editorial.css`, golden fixtures
- **ACCEPTANCE CRITERIA:** `20250516G` has no ΕΙΣΑΓΩΓΗ label. `20260920W` keeps it. Golden diffs are limited to the class attribute.

#### P2-05 — The archive excerpt clamp leaks a third line at tablet
- **PAGE:** blog archive. **VIEWPORT:** 768
- **OBSERVED:** The Colapinto card shows "…Έχει… / ταχύτητα, έχει…": an ellipsis mid-block followed by a leaked line (`blog-768-light--articles-grid.png`).
- **WHY IT LOOKS UNPROFESSIONAL:** It looks like a text rendering glitch.
- **WHAT MUST BE PRESERVED:** 2-line excerpts.
- **ROOT CAUSE:** Competing `-webkit-line-clamp` rules. `archive-editorial.css` sets `display:-webkit-box; -webkit-line-clamp:2` without `overflow:hidden` / `-webkit-box-orient`, while `blog-styles.css:1001` (`nth-child(n+6)`) sets different values.
- **EXACT CHANGE:** One rule in `archive-editorial.css`: `.archive-page .article-card-excerpt { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden }`. Remove the conflicting `blog-styles.css` excerpt clamps that the editorial skin already overrides.
- **LIKELY FILES:** `blog-module/blog/archive-editorial.css`, `blog-module/blog-styles.css`
- **ACCEPTANCE CRITERIA:** Every `.article-card-excerpt` has `scrollHeight > clientHeight` only when clamped, and a rendered height ≤ 2 × line-height at 390, 768 and 1440.

#### P2-06 — The dark-mode paddock strip loses the signal band
- **PAGE:** home. **VIEWPORT:** all, dark theme
- **OBSERVED:** Light mode shows the full-bleed signal band. Dark mode swaps it for a charcoal bar with a 4px signal side tab and coral text (`home-1440-dark--paddock-strip.png` vs light). The detector flags it as `side-tab`.
- **WHY IT LOOKS UNPROFESSIONAL:** An identity element shouldn't change shape between themes, and the side tab is a generic pattern.
- **WHAT MUST BE PRESERVED:** A full-bleed signal band with ink text (KEEP), the same as the standings timing band, which already stays signal in dark mode.
- **ROOT CAUSE:** `home.css:48-55` overrides the band in dark mode.
- **EXACT CHANGE:** Delete the dark override (`home.css:48-55`) so the band stays `--signal` with `--ink` text in both themes. Apply P1-12 sizing.
- **LIKELY FILES:** `home.css`
- **ACCEPTANCE CRITERIA:** The paddock strip's computed background is `rgb(237, 76, 50)` in both themes, with no `border-left`.

#### P2-07 — Shadows and legacy blue remain in a flat system
- **PAGE:** blog (controls, chip dropdown, pagination), standings (23 × `0 6px 16px` on chart rows), article (gallery arrows `0 8px 18px`, blue borders and gradients in `article-styles.css:714–874`), scroll-top. **VIEWPORT:** all
- **OBSERVED:** See `metrics.json` → `shadows`. The detector reports `thin-border-wide-shadow` and `dark-glow #41b6e6`.
- **WHY IT LOOKS UNPROFESSIONAL:** Stray elevation makes some controls float while the rest of the page is matte, which reads as components from different kits.
- **WHAT MUST BE PRESERVED:** Flat and matte (KEEP). Focus rings stay.
- **ROOT CAUSE:** Leftover legacy rules, plus editorial rules that re-add shadows (`archive-editorial.css` controls, `editorial.css:638` scroll-top).
- **EXACT CHANGE:**
  - Set `box-shadow:none` on archive controls, `.chip-scroll-frame` (keep a 1px border), `.page-btn`, standings chart rows, gallery arrows and scroll-top.
  - Remove the `rgba(65,182,230,…)` borders and gradients in `article-styles.css`, falling back to `--border`.
  - The only allowed shadow is the dropdown `.chip-scroll-frame` at `0 2px 0 var(--border)`, if separation is needed.
- **LIKELY FILES:** `blog-module/blog/archive-editorial.css`, `standings/standings.css`, `blog-module/blog/article-editorial.css`, `blog-module/blog/article-styles.css`, `styles/editorial.css`
- **ACCEPTANCE CRITERIA:** On the five routes, the computed-shadow inventory is empty except focus rings and at most one dropdown shadow. `grep 65,182,230` in public CSS returns 0 lines.

#### P2-08 — Radius drift
- **PAGE:** site-wide. **VIEWPORT:** all
- **OBSERVED:** Computed radii on the pages: 1px, 2px, 4px, 6px (`0 0 6px 6px`), 12px, 14px, 16px, 999px, 50%. Cut corners take 12, 18, 26, 28, 30, 32, 36, 38, 42, 44, 62, 64 and 72px.
- **WHY IT LOOKS UNPROFESSIONAL:** The single cut corner is identity, but ten sizes make it look arbitrary.
- **WHAT MUST BE PRESERVED:** 0–2px for controls, and one bottom-right cut corner on photos.
- **ROOT CAUSE:** Hand-picked values in each rule.
- **EXACT CHANGE:** Add tokens to `styles/editorial.css`:
  - `--radius-control:2px`
  - `--cut-sm:24px` (thumbnails, figures, cards, author box)
  - `--cut-md:40px` (secondary leads, related #3, mobile hero)
  - `--cut-lg:64px` (hero, archive lead)

  Replace every hand-picked cut-corner value with one of the three. Controls use `--radius-control`, and 1px becomes 2px. Remove 6px, 12px, 14px, 16px and 999px, except `50%` for avatars and dots.
- **LIKELY FILES:** `styles/editorial.css`, `home.css`, `blog-module/blog/archive-editorial.css`, `blog-module/blog/article-editorial.css`, `standings/standings-editorial.css`, `styles/authors.css`, `styles/legal.css`
- **ACCEPTANCE CRITERIA:** The computed radius inventory across the routes is a subset of {0, 2px, 50%, `0 0 24px`, `0 0 40px`, `0 0 64px`, and the paired `1px 1px Xpx 1px` forms}.

#### P2-09 — Type scale drift and text under 12px
- **PAGE:** site-wide, worst in standings reports. **VIEWPORT:** all
- **OBSERVED:**
  - Distinct computed text sizes: home 16, article 17–20, standings tyre 18.
  - Near-duplicate sizes: 12.0, 12.32, 12.48, 12.8, 12.96, 13.0, 13.12, 13.44, 13.76, 14.0, 14.4px.
  - Text under 12px: `.chart-pts-label` 9.9px, tyre labels 10.2–10.9px, quali tooltips 9.6px, the author number badge 9.9px (390), related date badges 11.5px.
- **WHY IT LOOKS UNPROFESSIONAL:** Micro-variations make the hierarchy mushy, and text under 12px on data is hard to read.
- **WHAT MUST BE PRESERVED:** The label size (.75rem = 12px) as the floor, and the display sizes.
- **ROOT CAUSE:** Values set per rule, with no scale tokens in the editorial layer.
- **EXACT CHANGE:** Add scale tokens: `--fs-label:.75rem`, `--fs-small:.875rem`, `--fs-body:1rem`, `--fs-read:1.125rem`, `--fs-deck:1.35rem`, `--fs-h3:1.25rem`, `--fs-h2:clamp(1.8rem,3vw,3rem)`. Snap values: .77/.78/.79/.8/.81/.82 → .75 or .875; .84/.85/.86/.87 → .875. Every data label and tooltip is ≥ `--fs-label`.
- **LIKELY FILES:** `styles/editorial.css`, all editorial route CSS, `standings/standings.css`, `standings/tabs/*.css`, `styles/authors.css`
- **ACCEPTANCE CRITERIA:** `metrics.json` shows `smallText` empty on all routes and ≤10 distinct text sizes per route.

#### P2-10 — Standings row hairlines look like broken borders
- **PAGE:** standings (drivers and constructors). **VIEWPORT:** all
- **OBSERVED:** Under each row a 1px team-colored line of varying length starts at x≈95. It looks like a partially drawn border (`standings-768-light--fold.png`, rows 2–4).
- **WHY IT LOOKS UNPROFESSIONAL:** Proportional bars that are too thin to read as data read as rendering errors.
- **WHAT MUST BE PRESERVED:** The points-proportion data and team color.
- **ROOT CAUSE:** `standings-editorial.css:106` sets `.st-bar-wrap { height:1px }`, which shrinks the legacy bar.
- **EXACT CHANGE:** Either make it a readable 3px bar aligned to the name column's left edge, sitting above the row rule, or remove it from the row (the chart section below already shows the same data). Recommended: remove it.
- **LIKELY FILES:** `standings/standings-editorial.css`, `standings/standings.css`
- **ACCEPTANCE CRITERIA:** There are no partial-width 1px lines between rows. If the bar is kept, its height is ≥3px and its start x equals the name column's start x.

#### P2-11 — Loading and error states are under-designed
- **PAGE:** standings (API failure), home (journal loading). **VIEWPORT:** 390, 1440
- **OBSERVED:**
  - Standings failure: a centered generic box with a ⚠ icon and a coral-tint retry button (another button style). An orphan 2px table rule sits above it, and there's no last-known-data fallback or timestamp (`state-standings-error-1440.png`).
  - Home loading on mobile: the journal collapses to intro → "Όλα τα άρθρα", with no visible skeleton (`state-home-loading-390.png`).
- **WHY IT LOOKS UNPROFESSIONAL:** States are where products show care. These look like defaults.
- **WHAT MUST BE PRESERVED:** The retry action, the Greek messages, and `aria-live`.
- **ROOT CAUSE:** Legacy `.standings-error` markup, and a skeleton at `min-height:0` on mobile (`home.css:342`).
- **EXACT CHANGE:**
  - Standings error: unboxed, set as a margin note. A 2px signal left rule, an h3 in Plex 600 ("Τα δεδομένα δεν φόρτωσαν"), a small line with the cache timestamp when `standings-cache.json` was available, and a `.btn-secondary` retry (P1-11). Hide the table's top rule while in the error state.
  - Home: give the skeleton the real layout (a 16/10 block plus 3 text lines in `--bg-surface`) with `min-height` matching the loaded lead.
- **LIKELY FILES:** `standings/standings-editorial.css`, `standings/core/rendering.js` (message markup), `home.css`, `blog-module/blog-loader.js`
- **ACCEPTANCE CRITERIA:**
  - The standings error state has no bordered box, uses the shared button, and shows a timestamp when a cache exists.
  - The home journal height changes by <10% between the loading and loaded states at 390.

#### P2-12 — The mobile menu has too many icons and duplicates
- **PAGE:** all (mobile menu). **VIEWPORT:** ≤991
- **OBSERVED:**
  - Every row has an icon, while the desktop nav has none.
  - "Δεδομένα" and "BetCast" share the same chart icon.
  - The theme toggle appears twice (bar and menu).
  - "Βαθμολογία" and "Δεδομένα" both go to `/standings/`.
  - The two external links (YouTube, BetCast) aren't marked.

  Evidence: `state-mobile-nav-390-dark.png`.
- **WHY IT LOOKS UNPROFESSIONAL:** Decorative icons plus a duplicate glyph read as a template menu.
- **WHAT MUST BE PRESERVED:** The row style (52px rows, signal left border on the active item), and the countdown.
- **ROOT CAUSE:** Menu markup is duplicated in each shell. Icons come from the legacy nav.
- **EXACT CHANGE:** CSS-only first:
  - Hide `.blog-nav-mobile-link .icon`.
  - Add a trailing `↗` (via `::after`) on `[target=_blank]` links.
  - Hide the in-menu theme row at widths where the bar toggle is visible.

  Optionally, in markup: merge "Δεδομένα" into "Βαθμολογία", or relabel it "Δεδομένα αγώνα" so the destinations differ.
- **LIKELY FILES:** `styles/editorial.css`, `styles/shared-nav.css`. Markup (optional): the 8 shells + `blog-module/blog/template.html`, with article migration via `article-editorial.mjs`
- **ACCEPTANCE CRITERIA:** At 390 the menu shows no leading icons, external links show ↗, and exactly one theme control is visible.

#### P2-13 — The authors page breaks the card and folio language
- **PAGE:** authors (and the home cast). **VIEWPORT:** all
- **OBSERVED:**
  - Profiles are fully bordered, filled boxes; every second one is translated 24px at 1440, which reads as misalignment inside boxes.
  - Labels are uppercase **700** ("ΕΠΑΝΑΛΑΜΒΑΝΟΜΕΝΗ ΣΤΗΛΗ", "ΟΛΑ ΤΑ ΑΡΘΡΑ ↗").
  - There's no folio line; the kicker is a plain eyebrow (detector: `hero-eyebrow-chip`).
  - The number badge is 9.9px.
  - Names are Latin.
  - On home, the portrait links to Instagram while the name links to /authors/: two destinations per person.

  Evidence: `authors-1440-light-fold.png` (baseline), `authors-390-dark--author-directory.png`, `authors-768-dark--fold.png`.
- **WHY IT LOOKS UNPROFESSIONAL:** It is the only route with boxed cards and bold uppercase labels, so it looks like a different author built it.
- **WHAT MUST BE PRESERVED:** Portraits, the number badges, the staggered rhythm (as an idea), the specialty and column info, the story list, and the cut corner on every third profile.
- **ROOT CAUSE:** `styles/authors.css` was written separately from the editorial cards.
- **EXACT CHANGE:**
  - Unbox the profiles: a 1px top rule, no fill, no side borders.
  - Keep the 24px stagger only at ≥1200 (it works once unboxed).
  - Labels at `.75rem/600/.12em`, typed caps.
  - Add the folio line (`F1 STORIES / ΟΙ ΑΝΘΡΩΠΟΙ` · `ΠΕΝΤΕ ΦΩΝΕΣ`).
  - Badge ≥12px.
  - Greek names (P1-03).
  - Home: point the portrait link at `/authors/?author=…` as well, and move Instagram into the profile.
- **LIKELY FILES:** `styles/authors.css`, `authors/index.html`, `scripts/authors.js`, `index.html` (cast links)
- **ACCEPTANCE CRITERIA:** `.author-profile` has no background and no left, right or bottom border. The folio line matches `.archive-edition`. No 700-weight labels. Every link in a cast member goes to the same destination.

#### P2-14 — Arrow glyphs render from system fallback fonts
- **PAGE:** site-wide (↗ ↙ → in links, masthead marks, contact). **VIEWPORT:** all
- **OBSERVED:** CDP shows "↗" rendered in **Hiragino Sans** (macOS); Windows falls back to Segoe. IBM Plex's shipped subsets don't cover U+2190–21FF. So stroke weight and size differ by platform, and the big masthead arrows look foreign.
- **WHY IT LOOKS UNPROFESSIONAL:** The arrows are an identity affordance (KEEP), but they render differently across platforms.
- **WHAT MUST BE PRESERVED:** The arrow glyph language and the diagonal hover nudges.
- **ROOT CAUSE:** `scripts/build/download-home-fonts.mjs` subsets exclude the Arrows block.
- **EXACT CHANGE:** Add U+2190–21FF (plus U+2733 ✳ for the paddock strip) to the IBM Plex latin subset and its `unicode-range`. Alternatively, replace the text arrows with the sprite's `fa-arrow-*` icons, but the font route keeps the markup intact.
- **LIKELY FILES:** `scripts/build/download-home-fonts.mjs`, `styles/home-fonts.css`, `assets/fonts/`
- **ACCEPTANCE CRITERIA:** CDP platform font for "↗" and "✳" is IBM Plex Sans on the 5 routes. The font payload grows by less than 4KB.

#### P2-15 — The Disqus embed is an unthemed 560–710px block
- **PAGE:** article. **VIEWPORT:** all
- **OBSERVED:** "Σχόλια" (the only section heading with a leading icon) is followed by a 558–709px third-party iframe that doesn't follow the editorial theme (`article-390-dark--article-comments.png`).
- **WHY IT LOOKS UNPROFESSIONAL:** A large foreign surface at the end of every article, after the related stories.
- **WHAT MUST BE PRESERVED:** Comments as a feature.
- **ROOT CAUSE:** `article-comments.js` auto-loads Disqus on scroll.
- **EXACT CHANGE:** Load on demand behind a `.btn-secondary` "Δες τα σχόλια (Disqus)" button, which also helps consent and performance. Remove the heading icon. Place comments **before** related stories, so the page ends on the editorial "next read".
- **LIKELY FILES:** `blog-module/blog/article-comments.js`, `blog-module/blog/template.html`, `blog-module/blog/article-editorial.css`, article migration
- **ACCEPTANCE CRITERIA:** No Disqus network request until the user clicks. The last content block before the footer is "Σχετικά άρθρα".

#### P2-16 — The standings tyre chart overflows without an affordance
- **PAGE:** standings `?tab=tyre-pace`. **VIEWPORT:** 390, 768
- **OBSERVED:** The chart body is 1893px wide, but only 3 driver columns are visible, with no scroll hint. Driver names are truncated ("George RUS…", "Charles LEC…") (`standings-tyre-390-dark--standings-panel-active.png`).
- **WHY IT LOOKS UNPROFESSIONAL:** Hidden content with no cue, and clipped names.
- **WHAT MUST BE PRESERVED:** The violin chart and horizontal scrolling on small screens.
- **ROOT CAUSE:** `standings/tabs/tyre-pace.css` fixes column widths. There is no edge fade or hint, and the full name renders under the column.
- **EXACT CHANGE:**
  - Add a right-edge fade (`mask-image` on the scroll shell) and a `.75rem` hint "Σύρε για όλους τους οδηγούς →", shown only when `scrollWidth > clientWidth`.
  - Under each column show the driver code only, with the full name in the tooltip.
  - Add `scroll-snap-type: x proximity` on columns.
- **LIKELY FILES:** `standings/tabs/tyre-pace.css`, `standings/tabs/tyre-pace.js`
- **ACCEPTANCE CRITERIA:** At 390 there is a visible scroll cue while overflow exists, and no ellipsized names in the chart footer.

---

### P3

#### P3-01 — The footer colophon has no brand and no sections
- **PAGE:** all. **VIEWPORT:** all
- **OBSERVED:** The footer is copyright + 5 social icons + 3 legal links (`home-390-light--footer.png`). There's no wordmark, section links or edition line.
- **WHY IT LOOKS UNPROFESSIONAL:** Editorial colophons usually close with the masthead and index. This one ends thin.
- **WHAT MUST BE PRESERVED:** The ink block in both themes, square social icons, and signal underlines.
- **ROOT CAUSE:** `partials/footer.html` is minimal.
- **EXACT CHANGE:** Add a first row to `partials/footer.html`: "F1 STORIES." wordmark (Barlow 700, 1.75rem, paper) plus a one-line mission in Plex. Add a second row with 5 section links (Άρθρα, Βαθμολογία, Συντάκτες, YouTube, BetCast) at `.75rem` tracked. Keep the existing rows.
- **LIKELY FILES:** `partials/footer.html`, `styles/editorial.css`; run `npm run build:html` so the includes expand
- **ACCEPTANCE CRITERIA:** The footer shows the wordmark and the section links on every route at 390 and 1440. Footer height is ≤360px at 1440.

#### P3-02 — The YouTube facade play button has no glyph
- **PAGE:** home. **VIEWPORT:** all
- **OBSERVED:** A coral disc with no triangle inside (`home-390-dark--latest.png`, `home-1440-dark--latest.png`).
- **WHY IT LOOKS UNPROFESSIONAL:** It's a broken affordance. It is P3 only because it may already be fixed on production (see root cause); **raise it to P1 if production shows the same**.
- **WHAT MUST BE PRESERVED:** The facade (no YouTube load until click) and the accent disc.
- **ROOT CAUSE:** `<use href="#fa-play">`, but the committed inline sprite in `index.html` (data-hash `94e0743f`) has no `fa-play` symbol. `build-icon-sprite.mjs` does detect `play` in a dry run, so the committed stamp is stale (see REDESIGN_BASELINE §3 ⚠️2).
- **EXACT CHANGE:** Regenerate the sprite and stamp as part of the stamp-normalising commit. Add a check to `check-generated-assets.mjs` that every `#fa-*` reference in a shell resolves to an inline `<symbol>`.
- **LIKELY FILES:** `scripts/build/build-icon-sprite.mjs`, `scripts/build/stamp-html.mjs`, `scripts/build/check-generated-assets.mjs`, `index.html` (generated region)
- **ACCEPTANCE CRITERIA:** Every `<use href="#fa-X">` in the 10 sprite targets has a matching `<symbol id="fa-X">`. The play triangle is visible.

#### P3-03 — Content hygiene reaches the design surface
- **PAGE:** home, blog, article. **VIEWPORT:** all
- **OBSERVED:** A duplicated word in the latest headline ("Michael Schumacher Schumacher"), which appears 4× on home and archive. An all-caps title ("CHARLES LECLERC Ο αιώνιος…"). Emoji in titles and h2s (🏁🇨🇦🔥🇬🇧).
- **WHY IT LOOKS UNPROFESSIONAL:** Headline typos and emoji break the editorial voice more than any CSS can fix.
- **WHAT MUST BE PRESERVED:** Author freedom in the body text.
- **ROOT CAUSE:** No title validation in the author tools.
- **EXACT CHANGE:** Add non-blocking warnings in `generate.html` / `scripts/author/article-source.js` for repeated adjacent words, >60% capitals in a title, and emoji in titles or headings. Fix `20260920W`'s title in source.
- **LIKELY FILES:** `scripts/author/article-source.js`, `scripts/author/generate-page.js`, `blog-module/blog-entries/20260920W/source.txt`
- **ACCEPTANCE CRITERIA:** The warnings appear in the author tool for these cases. The live latest title has no duplicate word.

#### P3-04 — Small alignment and rule-stacking issues
- **PAGE:** home, privacy, archive. **VIEWPORT:** 390
- **OBSERVED:**
  - The hero photo is inset 12px from the text column (`margin: 24px 0 33px 12px`), which reads as misalignment rather than asymmetry at this width.
  - "Όλα τα άρθρα" floats right between three rules within 80px.
  - The privacy intro ends with a widow ("μας.").
  - The archive "Όλες✓" has no gap before the check.
  - The home partners section is unnumbered between 03 and 04.
- **WHY IT LOOKS UNPROFESSIONAL:** Each is small, but together they read as unfinished.
- **WHAT MUST BE PRESERVED:** The asymmetric hero at ≥768, the right-aligned "all stories" link at ≥768, and the numbering sequence.
- **ROOT CAUSE:** Individual rules.
- **EXACT CHANGE:**
  - At ≤767, set the hero photo `margin-left:0`.
  - At ≤767, make "Όλα τα άρθρα" left-aligned, full width, and drop the `latest-footer-actions` top border.
  - Add `text-wrap: pretty` to intros and decks.
  - Chip `::after` gets `margin-left:.5em`.
  - Either number the partners "— / ΜΑΖΙ ΣΤΗΝ ΕΚΚΙΝΗΣΗ" or leave it unnumbered on purpose and move it after 05.
- **LIKELY FILES:** `home.css`, `styles/legal.css`, `blog-module/blog/archive-editorial.css`, `index.html`
- **ACCEPTANCE CRITERIA:** At 390 the hero photo's left edge equals the text left edge, there are no two rules within 24px of each other, and there are no single-word last lines in decks or intros.

#### P3-05 — "Closest battle" shows a meaningless 0-point tie
- **PAGE:** standings. **VIEWPORT:** all
- **OBSERVED:** "ΠΙΟ ΚΟΝΤΙΝΗ ΜΑΧΗ: Bottas vs Stroll · 0 βαθ. διαφορά", a tie at the bottom of the table (`standings-390-dark--fold.png`).
- **WHY IT LOOKS UNPROFESSIONAL:** A headline stat that says nothing undermines trust in the data desk.
- **WHAT MUST BE PRESERVED:** The context column.
- **ROOT CAUSE:** The closest-gap calculation ignores position and zero-point ties.
- **EXACT CHANGE:** Compute the closest battle among the top 10 with points > 0, and fall back to P1–P2.
- **LIKELY FILES:** `standings/core/rendering.js` (or `payloads.js`), `standings/core/__tests__/`
- **ACCEPTANCE CRITERIA:** A unit test with a zero-point tie at P19–P20 returns a top-10 pair. `npm run test:standings` passes.

---

## 3. Positive findings (keep and copy)

- **Folio lines and numbering** on home, archive, article and standings give the site a real publication feel. Copy them onto authors and legal (P1-07, P2-13).
- **The standings drivers ledger** (rule-divided context columns, a 2px top rule, large tabular numbers, team-color rules): the most professional surface on the site, and the model for the other reports (P1-10).
- **The archive masthead** ("JOURNAL." + stamp + deck) and the **home cover** at 390 and 1440 are distinctive and well composed.
- **The mobile archive** recomposition (a lead card, then thumbnail rows) and the **home cast** mobile rows are real re-compositions, not stacked desktop layouts.
- **Accessibility groundwork:** 44px targets in nav and editorial controls, a skip link, `prefers-reduced-motion` on every route, `lang="el"`, and correct uppercase handling of Greek.
- **No horizontal page overflow** on any route or viewport, and no JS errors.

## 4. Recommended order

1. **P0-01, P0-02**: mobile related cards and image resolution. Low risk, high visibility.
2. **P1-04, P1-05, P1-09, P1-12, P2-06**: collisions, contrast and a theme regression. Mostly single-file CSS.
3. **P1-01, P1-02, P1-06**: home and archive composition.
4. **P1-11, P2-07, P2-08, P2-09**: the shared button, shadow, radius and type tokens. This is the systemic cleanup that later fixes depend on.
5. **P1-07, P1-08, P1-10, P2-13**: bring the drifting components (legal, tables, reports, authors) onto the system.
6. **P1-03, P2-01**: the Greek-first taxonomy and copy pass. Touches data contracts and golden fixtures, so do it as its own PR.
7. The remaining P2 and P3 items.

**Constraint from the baseline.** Stage every change as a source-only diff. Don't run `build:assets` or stamp locally until the stamp-normalising commit lands (REDESIGN_BASELINE §3 ⚠️2), or the diffs will fill with unrelated churn.
