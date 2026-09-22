# F1 Stories — Final Visual Critique

> **Status 2026-09-22:**
> - **Fixed:** F-01 to F-15 and F-17 to F-21. F-01 is fixed up to the documented 800w ceiling on grid cards.
> - **Owner decision:** F-16.
> - **Details:** `REDESIGN_VERIFICATION.md` (Round 1 and Round 2).

Reviewed 2026-09-22 on the local working tree: GLOBAL, HOME, BLOG, ARTICLE, DATA and AUTHORS work applied, nothing committed. The site was served with `node scripts/serve-site.mjs` on fresh `minify.mjs` output.

**Coverage.**
- **Viewports:** 390×844, 768×1024 and 1440×900, in dark and light themes.
- **Pages:** home, blog archive, article (`20260920W`, plus the table article `20250516G`), standings (all 10 reports) and authors.
- **Tools:** Playwright captures and DOM probes, plus the Impeccable detector.

> ⚠️ **Single-context review.** Impeccable prefers two isolated passes. This session doesn't spawn sub-agents unless asked, so the visual judgement came first and the detector output was checked against it afterwards.

**Evidence.** Everything is in `perf/visual-qa/final-critique/` (gitignored):
- Section crops: `<route>-<w>-<theme>--<section>.png`
- States: `state-*.png`
- Extra report views: `f-*.png`
- DOM metrics: `metrics.json`

The "Verify" line in each item is a measurable condition that fails today.

**Severity.**
- **P0:** broken.
- **P1:** clearly unprofessional, or damaging to the identity.
- **P2:** a noticeable inconsistency.
- **P3:** polish.

---

## 0. Verdict

The core editorial surfaces now hold together: the home cover and journal, the archive spread, the article reading column, the standings ledger and the authors directory. No P0 remains.

What still reads as hobby-built falls into three groups:
1. **Photography is still under-resolved.** One earlier change made it worse (F-01).
2. **Five of the ten standings reports were never brought onto the system.** They still have dashboard boxes, pills, cyan and green/red semantics, and mixed English (F-04, F-05, F-06).
3. **Small consistency leaks:** a name, the form voice, wrapped buttons, a stamp colliding with text, and a lead paragraph that is now over-applied.

## 1. Where earlier work damaged the identity

| ID | Change that caused it | Damage |
|---|---|---|
| F-01 | BLOG-01 (lead photo grows to fill the spread) | The archive lead photo is now drawn taller from the same 400px card image, so it is softer than before BLOG-01 |
| F-09 | ARTICLE-04 (lead-paragraph rule) | The standfirst treatment now lands on 215 articles, and on phones it becomes a 418px slab of heavy text. A signature detail turned into a block |
| F-15 | DATA-02 (arrow moved in-flow) | The standings masthead mark shrank from 5.5rem to 3rem (2.25rem at ≤1199). The hand-set gesture is diluted |
| F-16 | ARTICLE-03 (share trim) | Instagram DM, Threads and Telegram sharing were removed from every article. That was a functional reduction, not just visual. Confirm it was intended |

No other change altered palette, typefaces, logo, folio lines, numbering, stamps, bands or photography treatment. KEEP.md holds.

---

## P1

### F-01 — The archive lead photo is upscaled more than before (photography identity)
- **Where:** blog archive, curated lead card. **Viewport:** 768 and 1440, worst on 2× displays.
- **Observed:**

  | Viewport | Displayed size | Natural size | Resolution ratio |
  |---|---|---|---|
  | 1440 @1× | 771×646 | 400×300 | 0.46 |
  | 1440 @2× | 771×646 | 400×300 | 0.23 |
  | 768 @2× | 401×490 | 400×300 | 0.31 (height) |

  The ratio is measured on the height axis. Before BLOG-01 the slot was 771×482, a height ratio of 0.62. The photo is visibly soft (`blog-1440-light--articles-grid.png`).
- **Why it matters:** photography leads the site (KEEP §Photography). The largest image on the archive is its blurriest.
- **Cause:** BLOG-01 stretches the image with `object-fit: cover`, but RESP-02 (serving the 800px and 1600px variants through `srcset`) was never done.
- **Verify:** `naturalHeight / (renderedHeight × DPR) < 0.9` for `#articles-grid .article-card-img` (first). Same failure on the home journal lead and related cards: `naturalWidth / (cssWidth × DPR)` from 0.26 to 0.63.

### F-02 — The archive stamp covers the masthead text on phones
- **Where:** blog archive masthead. **Viewport:** 390, both themes.
- **Observed:** the rotated "RACING. WRITING. REPEAT." stamp sits on top of the deck line "…μέσα από τη δική μας ματιά" (`blog-390-light--fold.png`). A DOM intersection test hits `Αναλύσεις, πρόσωπα και στιγμές`.
- **Why it matters:** an identity element colliding with body text reads as accidental placement.
- **Verify:** the `.archive-stamp` bounding box intersects the client rects of `.archive-masthead-note > p + p` at 390. It doesn't at 768 or 1440.

### F-03 — Band text still fails WCAG AA in light mode
- **Where:** home paddock strip and standings timing band. **Viewport:** all, light theme.
- **Observed:** `#20251f` on `#ed4c32` is **4.22:1**, at 12px weight 600. The dark home theme passes at 4.77:1 because home redefines `--ink` as `#17191b`. The detector reports the same `low-contrast 4.2:1`.
- **Why it matters:** it's an AA failure on primary status text: "Live δεδομένα · Σεζόν 2026", "Μετά τον γύρο 11", "ΤΟ GRID ΣΕ ΑΡΙΘΜΟΥΣ". A11Y-01 is still open, and HOME-02 is waiting on it.
- **Verify:** `CONTRAST-BANDS` (to be implemented): every text node in `.standings-timing-band` and `.paddock-strip` is either ≥4.5:1, or ≥18.66px at weight ≥600 and ≥3:1.

### F-04 — Five standings reports are still dashboard cards
- **Where:** standings: tyre pace, dirty air, track dominance, debrief, destructors. **Viewport:** all.
- **Observed:** each report sits inside a fully bordered box, which reads as a card inside the panel:
  - `.tyre-pace-card`
  - `.dirty-air-card`
  - `.track-dom-card`, which also contains `.track-dom-team-card`, `.track-dom-vs-card` and `.track-dom-map-card`
  - `.debrief-table`
  - `.destructors-card`

  Inside those boxes:
  - `.track-dom-vs-card` uses a **20px** radius.
  - `.dirty-air-summary-bar` uses **999px** pills.
  - The debrief tyre badges ("SOFT") are pills.

  Evidence: `f-trackdom-1440-light.png`, `f-dirty-1440-dark.png`, `f-debrief-768-dark.png`, `standings-tyre-390-dark--standings-panel-active.png`.
- **Why it matters:** this contradicts the "ledger, not dashboard" rule (DESIGN §4) that quali, lap 1 and pit stops now follow. The reports look authored by two different people.
- **Verify:** in each of the five active panels there's at least one element wider than 300px with borders on all four sides. The computed radius set includes `20px` and `999px`. `RADIUS-SET` currently checks only the drivers tab, so extend it to all ten tabs.

### F-05 — Off-palette semantic colours in the reports
- **Where:** debrief, track dominance and dirty air. **Viewport:** all.
- **Observed:**
  - **Debrief:** the leader label "Πρώτος" is cyan `#06b6d4` (`.debrief-delta-leader`, which also still sets Outfit). The fast delta is `#34d399` and the slow one `#f87171`.
  - **Track dominance:** sector times and the lap time are coloured green or red to mean faster or slower (for example `29.167 / 34.661` in red).
  - Both are visible in `f-debrief-768-dark.png` and `f-trackdom-1440-light.png`.
- **Why it matters:** cyan, emerald and rose aren't brand colours. DATA-04 already replaced green/red deltas with weight in quali and lap 1, so the same meaning is now encoded two different ways on one page.
- **Verify:** computed `color` on `.debrief-delta-leader`, `.debrief-delta-fast` and `.debrief-delta-slow` and the track-dominance sector values is none of `--text-primary`, `--text-secondary` or a team colour. `grep -n "#06b6d4\|#34d399\|#f87171" standings/tabs/*.css` returns hits.

### F-06 — Text under 12px remains in five reports and the points chart
- **Where:** standings. **Viewport:** 390 and 1440.
- **Observed:**
  - tyre pace: 10.2–11.8px
  - dirty air: 10.2–11.5px
  - track dominance: 10.2–11.8px
  - debrief: 10.2–11.8px
  - destructors: 10.2–11.8px
  - the drivers' points chart, `.chart-pts-label`: **9.92px**
  - Examples: `.tyre-pace-summary-label` 10.24px, `.track-dom-vs-label` 10.24px, `.debrief-round-label` 10.88px.
- **Why it matters:** these are the smallest texts on the site, and they're data labels. A11Y-02 is still open.
- **Verify:** `TEXT-MIN` and `REPORT-LEDGER` in `checks.mjs` fail on those tabs.

---

## P2

### F-07 — The same person has two names on home
- **Where:** home cast. **Viewport:** all.
- **Observed:** the cast shows **"2 Fast"**. The article byline, the archive meta, the authors page and the home journal meta all show **"Θέμης Χαρβάλης"**.
- **Why it matters:** it's the last naming inconsistency after GLOBAL-08. `AUTHOR-NAME-CONSISTENT` only looks for Latin names, which is why it missed this.
- **Verify:** `.team-member__name` text includes `2 Fast`, while `.author-profile__name` for the same slug `themis-charvalis` is `Θέμης Χαρβάλης`.

### F-08 — The contact form uses formal address and title case
- **Where:** home contact. **Viewport:** all.
- **Observed:** the placeholders are formal plural ("Το ονοματεπώνυμό σας", "Γράψτε το μήνυμά σας"), and the button is title-cased ("Αποστολή **Μ**ηνύματος"). The heading directly above is informal: "Έχεις κάτι να πεις;".
- **Why it matters:** two voices in one block. Greek UI copy doesn't title-case. `CTA-COPY` only scanned links and buttons for specific verbs, so it missed both.
- **Verify:** `#contact-form [placeholder]` contains `σας`, and `.contact-submit` text matches `/ [Α-Ω]/` after its first word.

### F-09 — The lead paragraph is over-applied and overweight on phones
- **Where:** article. **Viewport:** 390 (and 768).
- **Observed:** on `20260920W` the `.article-lead` is **418px tall** at 20.16px, weight 500, 312 characters: about nine lines of medium-weight type inside a left rule (`article-390-dark--article-body-grid.png`). 215 of the 352 articles now get this treatment.
- **Why it matters:** a standfirst should be a short, quiet opening. At this length and weight it's the heaviest block on the page, so the signature turns into noise.
- **Verify:** at 390, `.article-lead` height is over 3× that of the first following `<p>`, or it runs more than 6 lines. Count rendered leads longer than 240 characters.

### F-10 — Share and embed buttons wrap onto two lines on phones
- **Where:** standings panel tools (every report) and the drivers chart. **Viewport:** 390.
- **Observed:** "Ενσωμάτωση καρτέλας", "Κοινοποίηση γραφήματος" and "Ενσωμάτωση γραφήματος" each break onto two lines inside 44px-min bordered buttons (`standings-quali-390-light--standings-panel-active.png`, `standings-390-dark--chart-section.png`).
- **Why it matters:** wrapped button labels are a classic sign of a component nobody checked at phone width. The Greek labels are longer than the English ones they replaced.
- **Verify:** `Range.getClientRects()` on the button label returns more than one line top at 390.

### F-11 — Previous/next is a bare, one-sided link
- **Where:** article. **Viewport:** all.
- **Observed:** `.article-navigation` shows only "← Προηγούμενο", with no story title and no "Επόμενο" on the latest article. It sits between two full-width rules (`article-390-dark--article-navigation.png`).
- **Why it matters:** a 100px band holding one word looks unfinished next to the related stories below it.
- **Verify:** `.article-nav-link` contains no text beyond the direction label. A single visible link leaves the band otherwise empty.

### F-12 — Related-story rows don't align at tablet width
- **Where:** article related stories. **Viewport:** 768 (and 1440 with long titles).
- **Observed:** each card's footer (Διάβασε → plus the author) sits at a different height, depending on how long the title is. Differences reach about 145px at 768 (`article-768-dark--article-related-section.png`).
- **Why it matters:** in a three-up row the eye expects a shared baseline. Mixed heights look uncurated.
- **Verify:** at 768, the `.related-card-footer` `top` values across the three cards differ by more than 8px.

### F-13 — Debrief still mixes languages and leaks source prose
- **Where:** standings debrief. **Viewport:** all.
- **Observed:**
  - The tabs read "Γρήγορος γύρος · **Long Run** · Φθορά ελαστικών · Ιδανικός γύρος ομάδας · Στροφές · **Race Pace**", and the summary label is "Long Run".
  - The summary box prints the cache's English `source.note` ("Derived from completed OpenF1 Friday sessions…") in the page copy (`f-debrief-768-dark.png`).
- **Why it matters:** it's the last report where UI chrome switches language.
- **Verify:** `GREEK-LABELS-STANDINGS` (debrief) reports `Tyre @.debrief-summary-sub`. The view-tab text includes `Long Run` and `Race Pace`.

### F-14 — Tablet home cover is still a squeezed desktop layout
- **Where:** home hero. **Viewport:** 768.
- **Observed:** the two-column cover holds at 768. The headline wraps to about 7 lines beside a small photo, and "SCROLL TO EXPLORE" is still shown. RESP-01 is still open.
- **Verify:** at 768, `#hero-title` renders more than 4 lines and `.hero-scroll` is visible.

---

## P3

### F-15 — The standings masthead mark lost its scale
- **Where:** standings masthead. **Viewport:** 768 and 1440.
- **Observed:** the `.standings-masthead-mark` "↗" is 3rem (2.25rem at 768–1199); it used to be 5.5rem. It no longer collides with anything, but it now reads like an ordinary icon (`standings-1440-dark--fold.png`, `standings-768-light--fold.png`).
- **Verify:** computed `font-size` is below `4rem` at 1440.

### F-16 — The article share set was cut
- **Where:** article rail and toolbar. **Viewport:** all.
- **Observed:** only Facebook, WhatsApp, native share (hidden where unsupported) and copy link remain. Instagram DM, Threads and Telegram are gone from all 352 articles.
- **Verify:** `.share-btn.instagram, .share-btn.threads, .share-btn.telegram` count is 0. Flagged so the owner can confirm; this may be intended.

### F-17 — The home story meta runs the date into the label without a separator
- **Where:** home journal. **Viewport:** all.
- **Observed:** "Ομάδες 18 Σεπ 2026" and "Θέμης Χαρβάλης · Ιστορία 18 Σεπ 2026" rely on a gap alone. Elsewhere on the site `·` separates meta items.
- **Verify:** `.home-story-meta` has no separator node between `.home-story-meta__label` and `.home-story-meta__date`.

### F-18 — The footer colophon is still minimal
- **Where:** all pages. **Viewport:** all.
- **Observed:** copyright, five icons and three legal links. No wordmark, no section index (POLISH-02 is open; `home-390-dark--footer.png`).
- **Verify:** `footer .blog-nav-brand` (or a wordmark) is absent.

### F-19 — Icon noise in meta lines
- **Where:** article cover meta, related cards and archive cards. **Viewport:** all.
- **Observed:** there are calendar, tag and clock glyphs before date, category and reading time. Home, authors and standings meta use text only.
- **Verify:** `.related-date-badge .icon`, `.article-meta .icon` and `.article-card-reading-time .icon` are visible, while `.home-story-meta` has no icons.

### F-20 — Headline hygiene
- **Where:** home, archive and article. **Viewport:** all.
- **Observed:** the lead headline repeats a word ("Michael Schumacher **Schumacher**") in the hero, archive lead and article title. There's also an all-caps title ("CHARLES LECLERC Ο αιώνιος…"). POLISH-04 is open.
- **Verify:** `/\b(\w+)\s+\1\b/u` matches `#hero-title`.

### F-21 — The authors headline still differs from the other mastheads
- **Where:** authors. **Viewport:** all.
- **Observed:** the h1 is Plex **700** at `-.045em`. Every other masthead is either Barlow caps (JOURNAL., THE GRID.) or Plex 600 at `-.025em` (home cover, article). This is DESIGN §2 B5, not addressed.
- **Verify:** `.authors-intro h1` computed `font-weight` is 700 and `letter-spacing` is below `-0.03em`.

---

## Detector cross-check (`impeccable detect`, current markup)

| Rule | Verdict |
|---|---|
| `low-contrast 4.2:1` (standings) | **Real** → F-03 |
| `side-tab` on the article lead and h3 bar, `st-row` | Identity (category rules). The lead's weight is covered separately in F-09 |
| `dark-glow #8fb6cf` (article, standings) | **Real, minor:** a legacy `styles.css` value, `--accent #8fb6cf`, still reachable through legacy selectors. Fold into F-05's cleanup |
| `pulsing-dot .live-dot` | Minor. The editorial skin sets `animation: none` on the standings `.live-dot`. The detector reads the source rule. False positive in render |
| `numbered-section-labels`, `wide-tracking`, `all-caps-body`, `cramped-padding`, `broken-image` / `buried-raster` | False positives: numbering and tracked capitals are identity, and the archive images are lazy-loaded (verified earlier) |

## Suggested fix order

1. F-01 via RESP-02, then F-02 and F-03 (A11Y-01).
2. F-04, F-05 and F-06: bring the remaining five reports onto the system (extend DATA-04 and A11Y-02).
3. F-07, F-08, F-10, F-13: consistency leaks, mostly copy and one-line CSS.
4. F-09, F-11, F-12, F-14.
5. The P3 items, including owner decisions on F-15 and F-16.
