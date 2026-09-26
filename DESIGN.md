# F1 Stories — Design System (as implemented)

This file documents the **existing** design language. It was pulled from source on 2026-09-22 and updated on 2026-09-26 after the Journal rebuild (edited front page, archive ledger, one category ink map, author accents). It describes what the code does today. It is not a proposal.

Read `docs/static-publishing-model.md` and `docs/css-architecture.md` for architecture and build ownership, and `KEEP.md` for the traits that must survive any change.

Wherever this document and the CSS disagree, **the CSS wins**. Every value below is quoted from a source file, cited as `file:line` where useful.

**Scope.** The public design surface is the **editorial layer**:

- `styles/editorial.css`: shared tokens, masthead, footer, both themes
- `home.css`
- `blog-module/blog/archive-editorial.css`
- `blog-module/blog/article-editorial.css`
- `standings/standings-editorial.css`
- `styles/authors.css`
- `styles/legal.css`

It sits on top of a **legacy structural layer**: `styles.css`, `styles/shared-nav.css`, `blog-module/blog/article-styles.css`, `article-rail.css`, `standings/standings.css`, `standings-polish.css` and bootstrap.slim. The legacy layer supplies layout mechanics. The editorial layer re-skins it. The Journal (`archive-editorial.css`) no longer sits on the legacy layer: it loads only `styles.css`, shared-nav, editorial and its own stylesheet.

`theme-overrides.css`, `styles/fonts.css` (Roboto) and `critical-common.css` are loaded only by author tools. They are not part of the public identity.

Each section below is split in two:
- **A. Identity**: deliberate and consistent. Keep it.
- **B. Debt**: accidental drift. Fix it without changing the look.

---

## 1. Color

### A. Identity

**Brand constants** (`styles/editorial.css:6-8`):

| Token | Value | Role |
|---|---|---|
| `--paper` | `#e9e3d6` | Warm newsprint. Used for the light-mode masthead, light article cover, sponsor mat, and label tabs laid over photos |
| `--ink` | `#20251f` | Green-black ink. Used for light-mode text, the footer colophon background, and text on the signal color |
| `--signal` | `#12655f` light / `#6ec6bb` dark | F1 Stories teal (was racing red until 2026-09-26). Used for rules, underlines, dots, stamps, the reading-progress bar, the timing band, and the full stop that ends headlines. Text on it is `--signal-ink` (paper in light mode, ink in dark) |
| `--race` | `#ed4c32` | Racing red, kept for race status only: the next-race dot in the masthead |

**Themed surface tokens.** Dark is the default: `html` carries no `data-theme` attribute. Light is `html[data-theme="light"]`.

| Token | Dark (`editorial.css:9-21`) | Light (`:40-52`) |
|---|---|---|
| `--bg-base` (page) | `#1b1a19` | `#f2eee4` |
| `--bg-surface` (raised) | `#242321` | `#e9e3d6` (= paper) |
| `--bg-surface-alt` | `#2e2c29` | `#dfd9ca` |
| `--text-primary` | `#eee8db` | `#20251f` (= ink) |
| `--text-secondary` (muted) | `#b6bbac` | `#5b6256` |
| `--border` | `#4b5146` | `#c8c8b9` |
| `--accent` | `#6ec6bb` | `#12655f` |
| `--accent-hover` | `#8fd6cc` | `#0d4f4a` |
| `--accent-contrast` (text on accent) | `#20251f` | `#f2eee4` |

The neutrals are **warm and slightly green-leaning**, never cool grey. Light mode is paper, not white. Dark mode is warm charcoal, not blue-black.

The accent splits by theme. Dark mode uses a light teal (`#6ec6bb`, 8.6:1 on charcoal); light mode uses deep teal (`#12655f`, 5.9:1 on paper). `--signal` follows the same split. It is used for decorative marks and blocks, and whenever it carries text, that text is `--signal-ink` (ink on the light teal, paper on the deep teal). Racing red survives as `--race`, for race status only.

**Route variants** (deliberate "editions"):
- **Archive and article** (`editorial.css:57-89`) use a warmer charcoal set: `--text-secondary #b8b1a6`, `--text-tertiary #968f86`, `--border #6d6861`, `--accent-readable #ff9a89`. The comment in the file states the intent: "warmer charcoal dark theme".
- **Home, "Night edition"** (`home.css:12-36`): `--bg-base #181a1c`, `--accent #ff826b`, plus the `--home-cover-*` family for the cover band. In light mode the home cover is paper with ink text.

**Semantic, category color.** Every story category has its own ink, defined once in `styles/editorial.css` (`--category-*` and `--category-*-text`, per theme) and read through `--kind` / `--kind-text` on any element carrying `data-kind` (Journal) or `data-article-kind` (article, sticky mini-bar). In the Journal it colors only the category word and small marks (the active filter dot and underline, the archive head rule of a topic view, the headline underline on hover). On an article it colors the cover wash, the lead-paragraph rule, section numbers, list markers and figure labels. A story takes the ink of its primary category (the author's chosen one); secondary categories stay neutral text.

| Category | Light ink | Dark mark | Dark text |
|---|---|---|---|
| news (signal red) | `#a82e1c` | `#e2604a` | `#ff9a89` |
| analysis (oxide vermilion) | `#9a3d1c` | `#cf6a45` | `#f39370` |
| technical (muted teal) | `#12655f` | `#3c9990` | `#6ec6bb` |
| history (ochre) | `#7a5a14` | `#b08a36` | `#dcb468` |
| opinion (clay) | `#81452f` | `#b27a62` | `#d9a28d` |
| betting (racing green) | `#2c6a43` | `#4c9a68` | `#7ec99a` |
| drivers (steel blue) | `#3a5f86` | `#6e93bb` | `#a0c0e3` |
| teams (aubergine) | `#654a7d` | `#9580b0` | `#c2afdc` |
| season / 2026 (brass) | `#5f5d17` | `#a09c3e` | `#d4d06f` |

Text contrast is ≥4.5:1 on paper (`#f2eee4`, `#e9e3d6`) and charcoal (`#1b1a19`, `#242321`); dark marks are ≥4.3:1.

**Author accents.** Each writer has a muted signature ink (`[data-author-slug]` → `--author-accent`, `styles/editorial.css`): Georgios petrol, Giannis tobacco, Themis brick, Thanasis slate, Dimitris plum. It appears only in author blocks: the article's closing author card (3px rule), the Journal's writer view and the `/authors/` badges. It never colors a category label, and category ink never enters an author block.

**Data color.** Team and tyre colors belong to the data they represent (`standings-editorial.css:4`, "Team and tyre colors remain attached to the data they represent"). A team color appears on the row rule (`--team-color`), the headshot base line, a 7% row tint on hover, and the qualifying "instrument ring". Team color never becomes UI chrome.

**Sponsors.** Logos keep their original colors and sit on one continuous light mat (`#f2eee4`, border `#c8c8b9`) in **both** themes (`editorial.css:580-625`).

**Texture and washes.**
- A fractal-noise overlay at `.035` opacity, shown in light mode only (`editorial.css:92-103`). The home page lowers it to `.022`.
- Very faint radial washes (alpha `08`–`0a`) warm the flat surfaces: body, nav, home cover, footer.

These are the **only** gradients in the system. They are atmospheric tints that sit under the flat color. They are not colored gradients.

### B. Debt

1. **Three dark charcoals** for the same role. Editorial default is `#1b1a19`. Home is `#181a1c`, with surface `#222426` (cooler and greyer). The legacy `styles.css :root` is `#111113`, and it applies outside `.editorial-page` (404, offline).
2. ~~The category palettes diverge between archive and article.~~ Fixed 2026-09-26: one token map in `styles/editorial.css`.
3. **Hard-coded values bypass the tokens:**
   - `#565b50` countdown race name (`editorial.css:223`)
   - `#51584c` article cover meta (×4)
   - `#c0bfb2` and `#787e6e` footer links and separators
   - `#505649` home cover muted
   - `#32392f` hero placeholder
   - `#151713` video facade
   - `#e3ddce` sponsor hover
4. **Stale legacy aliases.** `editorial.css:519-567` redefines about 40 aliases (`--primary-blue`, `--accent-cyan`, `--blog-*`, `--st-*`) so that legacy components pick up the editorial palette. Some are redefined again in `standings-editorial.css:6-26`, with different mappings (`--st-accent` is `--accent` in one file and `--signal` in the other).
5. ~~An undefined token in `styles/authors.css`.~~ Fixed: the badge uses `--bg-base` on the author accent, and portraits sit on `--bg-surface`.
6. **The legacy `styles.css` root is still a blue/Roboto palette** (`--accent #8fb6cf`, `--font-body 'Roboto'`). It is invisible on editorial pages, but it is still the fallback everywhere else.

---

## 2. Typography

### A. Identity

**Families** (self-hosted, `styles/home-fonts.css`):

| Token | Family | Weights shipped | Use |
|---|---|---|---|
| `--font-body` (also `--font-display` and `--font-editorial`) | **IBM Plex Sans**, with Greek, Latin and Latin-ext subsets | 400, 600 (variable range) | Everything: body, headlines, UI |
| `--font-brand` | **Barlow Condensed** | 700 only | Wordmark, oversized Latin mastheads, stamps, slogans |

One grotesque carries every language and every role. The condensed face appears only in capitalised **Latin** display words:
- the wordmark "F1 STORIES."
- "JOURNAL."
- "THE GRID."
- "ON AIR."
- "THE NUMBERS"
- "RACE. TALK. REPEAT."
- the stamps

Barlow is never used for Greek running text.

**Greek-first behaviour:**
- Every page is `<html lang="el">`. All UI copy, labels, alt text and ARIA labels are in Greek. English appears only as brand slogans and F1 jargon, e.g. "TEAM RADIO", "JOURNAL", "RACE DESK".
- Uppercase Greek labels are **typed in capitals without accent marks** in the markup, e.g. `ΤΟ ΑΡΧΕΙΟ ΜΑΣ`, `Η ΠΑΡΕΑ`, `ΕΙΣΑΓΩΓΗ`, `ΕΙΚΟΝΑ /`. This follows Greek typographic convention, where capitals drop their accents.
- `lang="el"` also lets browsers drop accents correctly where CSS `text-transform: uppercase` is used.
- Mixed-case Greek headlines use the Plex Greek subset at 600 with tight tracking.

**Scale in use.** This is the scale as implemented; there are no tokens for it.

| Role | Spec | Where |
|---|---|---|
| Brand masthead | `700 clamp(4.5rem,7.4vw,6.5rem)/.8` Barlow, `-.035em` (4rem on phones) | Journal "JOURNAL." (compact: the first story leads the first screen) |
| | `700 clamp(5.5rem,10vw,9rem)/.9` Barlow | Standings "THE GRID." |
| Cover headline | `600 clamp(2.5rem,4.3vw,4.5rem)/1.15`, `-.025em` | Home hero h1 |
| | `600 clamp(2rem,3.8vw,4rem)/1.15`, `-.025em`, `text-wrap: balance` | Article title |
| Section h2 | `600 clamp(1.8rem,3vw,3rem)/1.2`, `-.025em` | `editorial.css:108` |
| Editorial deck / subtitle | `400 clamp(1.35rem,2vw,1.8rem)/1.4`, `-.025em` | Hero subtitle, archive subtitle |
| Article h2 | `400 clamp(1.9rem,2.8vw,2.65rem)/1.2`, `-.025em` | Light weight for in-text sections |
| Pull quote | `400 clamp(1.55rem,2.5vw,2.15rem)/1.45` | Article blockquote |
| Card title | `600 clamp(1.375rem,1.8vw,1.625rem)/1.3`, `-.018em` | Archive cards |
| Article body | `400 1.125rem/1.75`, measure `68ch` | `article-editorial.css` |
| Lead paragraph | `500 clamp(1.125rem,1.5vw,1.35rem)/1.65` | First `<p>` of an article, with an `ΕΙΣΑΓΩΓΗ` label |
| UI / secondary | `.875rem` | Excerpts, nav links, tabs |
| **Label / meta** | **`.75rem`, weight 500–600, tracking `.08–.14em`, uppercase (typed)** | Edition lines, kickers, captions, meta, chips |

**Line-height:** display `.79–.95` (Barlow), headlines `1.15–1.2`, decks `1.4`, body `1.65–1.75`.

**Tracking:** negative for anything large (`-.018` to `-.035em`), wide for small caps labels (`.08–.14em`), and zero for body text.

**Numerals:** `font-variant-numeric: tabular-nums` on the countdown, standings positions and points, and trust-panel dates.

### B. Debt

1. **The label size floor has been applied mechanically.** Dozens of rules set `.75rem`, often repeated at every breakpoint with the same value (home and archive media queries restate `font-size: .75rem` 20+ times). Near-duplicate sizes remain alongside it: `.72`, `.76`, `.77`, `.78`, `.79`, `.8`, `.81`, `.82`, `.84`, `.85`, `.86`, `.87rem`.
2. **The three font tokens are aliases of one family.** `--font-display` and `--font-editorial` are both IBM Plex Sans, but the CSS uses them as if they were different faces (e.g. `code { font-family: var(--font-display) }` in article CSS).
3. **GFS Didot is preloaded and never used.** `blog-module/blog/template.html` preloads `gfs-didot-400-greek.woff2` on every article, but no public CSS declares or uses GFS Didot.
4. **Unused font files ship in `assets/fonts/`:** DM Sans, Outfit, and Roboto. Roboto is used only by the author tools.
5. **The authors h1 breaks the masthead system.** It uses Plex `700 … -.045em` (`authors.css:273`) where every other route uses Barlow for its masthead.
6. ~~The legal pages have their own type rules.~~ Fixed 2026-09-26: `styles/legal.css` uses the shared type (Plex 600 display title with the teal full stop, typed-caps kicker behind a 2px signal rule).

---

## 3. Layout

### A. Identity

- **Container:** `max-width: 1476px`. Horizontal padding is **48px** (desktop), **32px** (≤1199px), **22px** (≤767px) and **17px** (≤359px) (`editorial.css:105, 488-490`).
- **Masthead height:** 75–76px on desktop, 67–68px at ≤991px. Page wrappers offset their content by these values.
- **Asymmetric editorial grids:**
  - Home hero: `47% / 53%`. The headline crosses the photograph's left edge.
  - Home journal: `1fr 240px` (main plus margin column), with stories set `1.35fr / .85fr`.
  - Journal: a compact masthead set as a dark, full-bleed nameplate (`1fr` + 27rem note), then a 12-column front page numbered `01`–`03`: the lead story in `1/8` (2:1 photo from 1200px with its headline left and deck + byline beside it, 5:2 below that, 4:3 on phones; headline, deck and byline fit the first screen), two stacked secondary stories in `9/-1`; below it the same split for «ΠΡΟΣΦΑΤΑ» (rows numbered in large Barlow figures) and «ΓΙΑ ΑΡΓΗ ΑΝΑΓΝΩΣΗ» (text-led long reads on a dark panel with a cut corner); then the archive under a display heading: tools and a ledger (date · category · headline · byline, separated by short timing rules) under 2px month rules, with a photograph every eighth row. The two dark grounds use warm black on paper and drop below the charcoal page in dark mode.
  - Standings masthead: `1fr 270px`. Standings layout: `1fr 255px` side panel.
  - Article: `minmax(0,680px) minmax(190px,240px)` body plus margin rail, max 968px wide. The cover is `1fr / 1.1fr` once its container is ≥1100px.
  - Authors: `.8fr / 1.2fr` intro, and a 2-column directory where every second card drops 24px.
  - Home cast: 5 columns, with every even portrait dropped 54px.
- **Article measure:** `68ch`, at 1.125rem/1.75.
- **Section rhythm:** `--space-section: clamp(40px, 6vw, 80px)`. In practice sections use 72–95px top and bottom on desktop and 34–54px on mobile.
- **Mobile layouts re-compose rather than just stack.**
  - The home hero reorders through `grid-template-areas` to: edition → title → subtitle → photo → description → byline → actions.
  - The Journal re-composes on phones: compact masthead (JOURNAL. at 4rem), lead story with a 4:3 photo, secondary stories as 96px-thumbnail rows, numbered recent rows, text-led long reads, then a text ledger (category + date, headline, byline) with an occasional full-width photo. Filters sit behind a «Φίλτρα» disclosure.
  - Cast members become `88–104px` portrait + text rows.

### B. Debt

1. **Breakpoint drift.** There's no single scale. Values in use: 359 / 359.98, 479.98 / 480, 520, 575.98 / 576, 767 / 767.98 / 768, 991 / 991.98 / 992, 1024, 1100, 1199 / 1199.98 / 1200, 1399.98, 1600. Both the Bootstrap `.98` convention and whole pixels appear, sometimes in the same file.
2. **Container padding is redeclared per route.** `home.css:259,308,382` and `standings-editorial.css:30,203` repeat the values from `editorial.css`.
3. **Masthead offsets are hard-coded in several places:** `margin-top: 76px` (home hero, article wrapper), `padding: 76px` (standings), `130px` (authors), `top: 76px` / `68px` (sticky tabs, mini-bars). There's also a `!important` override for the legacy nav offset (`home.css:275`).
4. **Section spacing values don't share a scale:** 72/82, 74/80, 80/95, 76/72, 36, 42, 45, 46, 58, 64, 72px. `--space-section` exists but nothing uses it.

---

## 4. Component language

### Navigation (masthead) — A

- A flat bar on the page's own ground (`--bg-base`) with no blur and no shadow, and a 1px `--border` bottom rule. One rule set serves both themes. It stays fixed at 75px (67px ≤991px); route offsets depend on that height.
- **Brand:** 36px logo mark + "F1 STORIES." in Barlow 700 at 1.75rem, the full stop in `--signal`. The logo rotates `-8deg` on hover.
- **Links:** five typed-caps labels (ΑΡΘΡΑ, ΒΑΘΜΟΛΟΓΙΑ, DATA, YOUTUBE ↗, ΣΥΝΤΑΚΤΕΣ), Plex 600 at .75rem with `.13em` tracking, pushed right, with no pill and no background. The active link has a **2px signal underline covering 40% of its width**. On hover the underline grows from the right to full width. The brand is the home link; BetCast lives in the colophon.
- **Right cluster:** race countdown after a 1px left rule: a 7px `--race` dot, flag, race name (hidden ≤1199px) and tabular timer on one line; a 44px theme toggle that rotates 16° on hover; a borderless hamburger with square strokes.
- **Mobile menu:** full-width rows 60px tall, set at 1.375rem Plex 600 and numbered `01`–`05` in the accent, like a contents page. The active row takes the accent colour.
- **Every route uses the same masthead,** from one partial (`partials/nav.html`, expanded at build time into every shell and article; the active section comes from the page context in `scripts/build/include.mjs`).

### Edition line — A (a signature element)

A full-width row with a 1px top rule and two .75rem/500 labels at `.11–.12em` tracking, one pushed left and one right. It appears on:
- the home hero: `F1 STORIES / ΕΛΛΗΝΙΚΗ F1 ΚΟΙΝΟΤΗΤΑ` · `ΤΕΧΝΙΚΗ ΜΑΤΙΑ · ΚΑΘΑΡΗ ΑΠΟΨΗ`
- the archive: `F1 STORIES / THE JOURNAL` · `ΙΣΤΟΡΙΕΣ ΑΠΟ ΤΟ PADDOCK`
- the article: `F1 STORIES / Η ΕΚΔΟΣΗ` · category desk
- standings: `F1 STORIES / RACE DESK` · `ΒΑΘΜΟΛΟΓΙΕΣ & ΑΝΑΛΥΣΗ`

This is the newspaper folio.

### Section kickers and numbering — A

- `.section-kicker`: .75rem/600, `.13em` tracking, `--text-secondary`, 22px below.
- Home kickers are **numbered in sequence**: `01 / ΤΟ JOURNAL`, `02 / ΤΟ F1 STORIES ΣΤΟ YOUTUBE`, `03 / F1 DATA HUB`, `04 / Η ΠΑΡΕΑ`, `05 / ΤΟ ΔΙΚΟ ΣΟΥ TEAM RADIO`.
- Numbering recurs throughout:
  - the hero figcaption `01 / ΜΕΣΑ ΣΤΗ ΔΡΑΣΗ`
  - cast members `01`–`05` via CSS counter, above a rule
  - author cards, with a square `01` badge on the portrait corner
  - article h2s, with a `01`, `02`… counter hung in the left margin at ≥1200px (suppressed when the author already numbered the heading)
  - the related rail `01`, `02`…
- An **eyebrow dot**: a 7px signal circle before a label (hero category, archive eyebrow). Standings report kickers use a 6px **square** signal mark instead.

### Headings — A

Headlines are mixed-case Plex, set tight, and **end in a signal-colored full stop** (`.hero-period`, `.editorial-accent`):
- "Η εβδομάδα στο grid**.**"
- "Εκτός πίστας. Εντός θέματος**.**"
- "Έχεις κάτι να πεις**;**" (the Greek question mark)
- "JOURNAL**.**"
- "THE GRID**.**"
- "Οι φωνές πίσω από το grid**.**"

### Buttons and links — A

- **Primary** (`.cta-primary`): a solid ink block with paper text (reversed in dark mode). 2px radius, 47px minimum height, `.78rem`/600. On hover it **turns signal red with ink text**, with no lift and no shadow. The trailing arrow icon moves 5px right.
- **Secondary** (`.cta-secondary`): text with a 1px bottom rule and no box. On hover the text and rule turn accent.
- **Text link with a glyph**: a label, a 1px bottom rule, and a large arrow glyph (`↗`, `↙`) that shifts diagonally on hover. Used for "Άκου την παρέα", "Εξερευνήστε το αρχείο" and "Γνώρισε την ομάδα ↗".
- **In-text article links:** `--accent-readable`, with a 1px solid bottom border (not `text-decoration`). On hover the text goes to primary and the border takes the category signal.
- **Utility buttons** (share, gallery arrows, pagination, scroll-top): square or 2px radius, 1px border, 44px targets. On hover they fill with accent.

### Rules — A

1px `--border` rules do most of the structural work: edition lines, card separators, the results row, pagination, the footer. Heavier rules carry meaning:
- 2px `--st-text` top rule on standings tables (a timing sheet)
- 2–4px signal or category left rules on lead paragraphs, pull quotes, summaries and the author box
- a 3px signal underline on the active tab
- a 3px h3 bar

### Cards — A

A card is **usually not a box**. Archive cards, home stories, related stories and cast members have **no border, no background, no shadow and no radius**. They are made of:
- a photo
- a .75rem meta line
- a Plex 600 title
- a clamped excerpt
- an arrow CTA
- separated by 1px rules

The Journal's story blocks follow the same grammar without a per-story arrow CTA: photo (lead and secondary only) → category word → headline → deck (lead, long reads) → byline. The archive ledger is text-first rows divided by 1px rules under month rules.

The article opens on a **dark plate** in both themes (`--plate-*`): folio, back link, the category in its dark-ground ink (`--kind-on-dark`), the headline in Plex 600 at up to 4.25rem, byline and timing-rule meta; the photograph sits whole beside it (capped in height, never cropped) with the cut corner, and bleeds edge to edge on phones. It ends on an **author card**: «ΓΡΑΦΕΙ» in the writer's accent, their illustrated sticker whole at 112px on a small plate, name, specialty, one line of biography, «Όλα τα άρθρα του …», a quiet Instagram link, on a surface with a left rule in the writer's accent. Related stories below are numbered 01–03.

Boxed surfaces are the exception:
- the opinion treatment
- the article's closing author card and the focused writer view on `/authors/`

Dark plates (`--plate-*` in `styles/editorial.css`) are the page-level counterpoint: the colophon on every page, the Journal nameplate and slow-reading panel, the article cover, the authors intro and the 404. Warm black on the light theme; a deeper black with a hairline edge on the dark one.

### Figures and photography — A

- Photography is large and leads the page: the hero image is 53% of the cover; the archive lead spans 7 of 12 columns.
- **Desaturated at rest, full color on hover:**
  - hero `saturate(.72) contrast(1.04)`
  - stories and related cards `saturate(.8)`
  - cast portraits `saturate(.45)`
  - on hover: `saturate(1–1.05)` plus `scale(1.045)` over `.6–.7s` with the editorial easing
- **One cut corner:** photos keep square corners except a single large bottom-right radius. Examples: hero `72px`, archive lead `62px`, home history treatment `64px`, cast #5 `44px`, article cover `32px`, figures `26px`, gallery `30px`, related #3 `36px`.
- **Captions** (`figcaption`): .75rem muted text with a 1px top rule, prefixed by a category-colored label `ΕΙΚΟΝΑ /`. Galleries are headed `ΣΤΗΝ ΠΙΣΤΑ / ΦΩΤΟΓΡΑΦΙΚΟ ΑΡΧΕΙΟ`, laid out like a printed contact sheet.
- **Label tab over a photo:** a paper block with ink text at .75rem in the top-left corner of the image (home lead story, related cards).
- The history treatment adds `sepia(.15–.18)`.

### Stamps — A

A rotated (`7deg`) signal block with a 1px ink border, set in Barlow 700 caps with ink text: "PURE RACING. REAL STORIES." on the home hero, "RACING. WRITING. REPEAT." on the archive masthead. It overlaps the edge of the photo or masthead. `aria-hidden`.

### Bands — A

- **Paddock strip** (home): full-bleed signal band, "RACE. TALK. REPEAT." in Barlow, a `✳` topic list, and an arrow link.
- **Timing band** (standings): full-bleed signal band with a live dot, season and round, and "Μετά τον γύρο N".

### Tables and data surfaces — A

The code describes these as "a broad ledger with margin notes, not a dashboard grid" (`standings-editorial.css:70`).
- Context cards are **columns divided by 1px left rules**, not boxes.
- Rows have no background. Positions and points are Plex 600 at 1.75rem with tabular numerals. P1's position is accent-colored.
- A 2px team-color rule sits on each row and grows to 4px on hover or expand.
- Headshots sit on a portrait-shaped plate (`22px 22px 1px 1px`) with a 2px team-color base line.
- Sub-report tabs are text with a 2px signal underline.
- Charts: flat bars with `0 2px 2px 0` ends. Report titles and section titles alternate between Plex 600 and editorial 400.

### Forms — A

The home contact form uses underline-only fields (1px bottom border, transparent, no radius). Labels are .75rem muted and sit above the field. Focus shows an accent border plus a 2px outline.

### Footer (colophon) — A

- The last page of the magazine: a dark spread in both themes (`#1b1a19`; in dark mode a deeper `#100f0e` with a hairline top rule), with paper text.
- The wordmark "F1 STORIES." set across the width in Barlow at up to 15.5rem, its full stop in teal.
- Below a rule, a 12-column row: the mission ("Τεχνική ανάλυση, άποψη και ιστορίες από το grid.") in 5 columns, then **ΠΛΟΗΓΗΣΗ** and **SOCIAL** as text-link columns (external links carry ↗).
- A rule-separated base row at .75rem: copyright, then privacy, terms, cookie settings and any route extras (standings' cache reset). Link underlines are teal and grow on hover.

### Motion — A

- `--ease-editorial: cubic-bezier(.22,.68,0,1.02)` for most movement. Nav and footer underlines use `cubic-bezier(.2,.7,.3,1)`.
- **Arrival animations** ("cover-arrive", "print-arrive", "grid-arrive"): 12–22px rises with short staggers (.05–.24s).
- **Micro-motion on hover:** arrows nudge, the logo turns -8°, social icons tilt -6°, the theme toggle turns 16°, images scale 1.045.
- `prefers-reduced-motion` turns animation off on every route.

### B. Component debt

1. **Buttons.** There are 20+ button class families (`.cta-button`, `.cta-primary`, `.cta-secondary`, `.cta-sm`, `.share-btn`, `.page-btn`, `.filter-reset-btn`, `.cookie-btn`, `.accept-btn`, `.reject-btn`, `.accept-selected-btn`, `.close-btn`, `.retry-btn`, `.pwa-banner-btn`, `.betcast-btn`, `.view-toggle-btn`, `.scroll-to-top-btn`, `.theme-toggle-*`…). Each is restyled separately per route. The primary CTA is defined on home only (`.home-page .cta-*`). Other routes have no shared primary button.
2. **Radii.**
   - Straight radii are 0 / 1px / 2px / 4px with no rule for choosing between 1px and 2px (controls use 1px on the archive and 2px elsewhere).
   - The cut corner is identity, but its size takes 10+ unrelated values (18, 26, 28, 30, 32, 36, 38, 42, 44, 62, 64, 72px).
   - The legacy layer still carries 8, 6, 5, 7, 10, 12px and `999px` pills. They are overridden in most places, but visible wherever they aren't.
3. **Shadows are creeping back into a system that is flat on purpose** (`--shadow-sm/md: none`):
   - archive controls `0 7px 18px #0000001c`
   - the search focus ring
   - the chip dropdown `0 18px 40px`
   - pagination `0 5px 14px`
   - dark-mode scroll-top `0 8px 22px #00000066`
   - gallery arrows `0 8px 18px`
4. ~~The legal pages don't use the editorial language.~~ Fixed 2026-09-26: a left-aligned hero, a flat rule-bounded contents bar pinned under the masthead, unboxed sections under 2px rules, ledger tables and accent-ruled callouts. No pills, no radii, no blur, no gradient. They stay deliberately quiet: no dark plate.
5. ~~Authors cards are boxed.~~ Fixed 2026-09-26: profiles are unboxed under a 3px rule in the writer's accent; the stickers show whole and in full colour. The focused writer view (`?author=`) is the one boxed surface: a warm card edged in the writer's accent.
6. ~~The authors page has no edition line.~~ Fixed: the intro opens with the folio line on a dark plate, like the Journal nameplate and the article cover.
7. **The cookie banner is styled twice,** identically, in `editorial.css:476-479` and `home.css:229-232`.
8. **`!important`:**
   - `editorial.css` 10: dark scroll-top
   - `shared-nav.css` 52
   - `standings.css` 18
   - `blog-styles.css` 15
   - `home.css` 2: video meta and hero offset
9. **The standings report skins are one selector list repeated across 8 report prefixes** (`quali-`, `lap1-`, `tyre-pace-`, `dirty-air-`, `track-dom-`, `pit-stops-`, `debrief-`, `destructors-`), because the report CSS never shared a class vocabulary.

---

## 5. Visual character (summary)

| Trait | How it shows |
|---|---|
| **Printed journal** | Edition folios, numbered sections, a colophon footer, the paper/ink palette, noise grain, "Η ΕΚΔΟΣΗ", contact-sheet galleries |
| **Asymmetry** | Uneven grid splits, a headline that crosses the photo edge, staggered cast and author cards, a margin rail, h2 numbers hung in the margin, the single cut corner |
| **Photography first** | Big crops, desaturated at rest and full color on hover, square corners except one, paper label tabs over the image |
| **Restrained accent** | Red appears as a full stop, a dot, a 2px underline, a stamp, or a band. It is never a big fill, except the two full-bleed bands and the stamp. |
| **F1 cues, typographic not illustrative** | Race countdown, "RACE DESK", "TEAM RADIO", "ON AIR.", timing band, tabular numbers, team-color rules on data rows, "Μετά τον γύρο 11". No checkered flags, no carbon-fibre textures, no speed lines, no HUD styling. The only flag glyph is the 🏁 fallback in the countdown. |
| **Voice** | Greek-first, conversational ("Έχεις κάτι να πεις;", "Άκου την παρέα"), with English only as slogans |
| **Flat and matte** | No blur, no glass, shadows set to none, 0–2px radii |

---

## 6. Anti-patterns — do not introduce

These go against the implemented language. Most of them are already cancelled out explicitly in the CSS (`backdrop-filter: none`, `box-shadow: none`, `border-radius: 0`).

- **Glassmorphism.** No `backdrop-filter` blur and no translucent frosted panels. The masthead is deliberately `backdrop-filter: none`.
- **Gradients unrelated to the brand.** Only the existing faint warm radial washes (alpha ≤ `0a`) and the article category wash are allowed. No colored, multi-stop or "hero glow" gradients.
- **Pill-heavy UI.** No `999px` chips, badges or buttons. Chips are 2px, tabs are underlines, and category labels are text with a rule.
- **Huge rounded cards.** Corners are 0–4px, plus **one** cut corner on photos. No uniformly rounded 12–24px cards.
- **Bento layouts everywhere.** Layouts are editorial and asymmetric (a lead story plus a margin column). No mosaics of equal tiles.
- **SaaS dashboard components.** No KPI tiles, stat cards with icons, donut charts or sidebar app shells. Data is a ledger with margin notes.
- **Fake telemetry or HUD styling.** No scanlines, neon, glowing grids, angled "racing" clip-paths, or LED counters. The countdown is plain tabular Plex.
- **Arbitrary monospace.** Numbers use `tabular-nums` on Plex. No mono for "technical" flavour.
- **Decorative Formula 1 clichés.** No checkered patterns, speed streaks, carbon textures, tyre-tread borders or car silhouettes as decoration. Photography carries the sport. (The legacy `.background` and `.streak` elements are hidden on editorial routes: `editorial.css:475`.)
- **Also out of scope:**
  - a third typeface
  - white (`#fff`) or cool-grey page surfaces
  - a blue accent (legacy)
  - drop shadows used to create elevation
  - `text-transform: uppercase` on Greek where accented capitals would be wrong. Type the capitals in the markup instead.

---

## 7. Where each primitive lives

| Primitive | Source of truth |
|---|---|
| Palette, both themes, container, masthead, footer, sponsor mat | `styles/editorial.css` |
| Fonts | `styles/home-fonts.css` (+ `assets/fonts/`) |
| Home cover, journal, cast, contact, primary/secondary CTA | `home.css` |
| Category ink map, author accent map | `styles/editorial.css` |
| Journal masthead, front page, recent list, long reads, archive tools, ledger, pagination | `blog-module/blog/archive-editorial.css` |
| Journal front selection | `blog-module/editorial-selection.json` (see `docs/static-publishing-model.md`) |
| Writers (names, slugs, portraits, specialty, bio, featured stories) | `blog-module/taxonomy.js` `AUTHORS` |
| Article cover, reading type, numbering, figures, gallery, rail, author card, related | `blog-module/blog/article-editorial.css` |
| Standings masthead, timing band, tabs, ledger, report skins | `standings/standings-editorial.css` |
| Authors directory | `styles/authors.css` |
| Legal pages (off-system) | `styles/legal.css` |
| Structural and legacy mechanics underneath | `styles.css`, `styles/shared-nav.css`, `blog-module/blog/article-styles.css`, `standings/standings.css` (the Journal uses none but `styles.css` and shared-nav) |
