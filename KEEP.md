# KEEP — traits implementation agents must preserve

Every item here exists in the current source. Values and locations are in `DESIGN.md`.

If a change would remove or dilute one of these traits, it is out of scope, whatever the reason given.

Fixing the **debt** listed in `DESIGN.md` is allowed only when the trait below still looks the same afterwards.

## Palette

- [ ] **Paper / ink / signal**:
  - `--paper #e9e3d6`
  - `--ink #20251f`
  - `--signal #ed4c32`
- [ ] **Warm neutrals only.**
  - Light mode is paper (`#f2eee4` base, `#e9e3d6` surface), never white.
  - Dark mode is warm charcoal (`#1b1a19` family), never blue-black or cool grey.
- [ ] **The accent splits by theme:** coral `#ff775f` in dark mode, oxide `#a82e1c` in light mode. `--signal` stays constant, and any text on it is ink.
- [ ] **Dark is the default theme.** Light is `html[data-theme="light"]`, and both themes are first-class.
- [ ] **Per-category signal colors:** technical teal, analysis oxide, history ochre, betting green, and the others, from one token map (`--category-*`) with a dark-readable variant. Used as punctuation only: the category word and small marks, never fills, pills or colored headlines.
- [ ] **Author accents are separate from category color:** a muted ink per writer, only in author blocks (the article's closing card, the Journal's writer view, `/authors/` badges).
- [ ] **Team and tyre colors stay attached to data only.** They are never used as UI chrome.
- [ ] **Sponsor logos keep their original colors** on one light mat, in both themes.
- [ ] **Paper grain** in light mode (noise at `.035`) and the faint warm radial washes.

## Logo and brand treatment

- [ ] The logo mark sits beside **"F1 STORIES."** in Barlow Condensed 700, including the trailing full stop.
- [ ] The logo rotates -8° on hover.
- [ ] The masthead is flat, with a 1px bottom rule and no blur or shadow.
- [ ] The active nav link has a **2px signal underline** covering part of its width.
- [ ] Barlow Condensed is used **only** for Latin caps display words: "JOURNAL.", "THE GRID.", "ON AIR.", "THE NUMBERS", "RACE. TALK. REPEAT." and the stamps.

## Typography

- [ ] **IBM Plex Sans is the one family** for all text, Greek and Latin. **Barlow Condensed** is the only second face. Don't add a third.
- [ ] Headlines are **mixed-case Plex 600 with tight tracking** (`-.018` to `-.035em`).
- [ ] **Headlines end in a signal-colored full stop** or Greek question mark (`.editorial-accent`, `.hero-period`).
- [ ] **Small labels:** `.75rem`, weight 500–600, wide tracking (`.08–.14em`), capitals.
- [ ] The article reading column is **1.125rem/1.75 at a 68ch measure**.
- [ ] The first article paragraph is a **lead** with an `ΕΙΣΑΓΩΓΗ` label and a category-colored left rule.
- [ ] **Tabular numerals** for the countdown, standings positions and points, and dates.

## Greek-first

- [ ] Every page is `lang="el"`. All UI copy, labels, alt text and ARIA labels are in Greek. English appears only as slogans and F1 jargon.
- [ ] **Uppercase Greek is typed without accent marks in the markup** (`ΤΟ ΑΡΧΕΙΟ ΜΑΣ`, `Η ΠΑΡΕΑ`), rather than produced by `text-transform` on accented text.
- [ ] The conversational, first-person-plural voice ("Άκου την παρέα", "Έχεις κάτι να πεις;").

## Editorial structure

- [ ] **The edition folio line:** a full-width 1px top rule with a label on each side (`F1 STORIES / …` · desk). It appears on home, the archive, articles and standings.
- [ ] **Section numbering:**
  - `01 / …` to `05 / …` home kickers
  - `01`–`05` cast counters
  - numbered author badges
  - article h2 numbers hung in the margin
  - `01 / ΜΕΣΑ ΣΤΗ ΔΡΑΣΗ` figure caption
  - numbered related rail
- [ ] The **eyebrow dot:** a 7px signal circle before a category label.
- [ ] **Rotated signal stamps** ("PURE RACING. REAL STORIES.", "RACING. WRITING. REPEAT."): 7°, ink border, Barlow caps.
- [ ] **Full-bleed signal bands:** the home paddock strip and the standings timing band.
- [ ] The **ink colophon footer** in both themes.
- [ ] **Arrow glyphs as affordances** (`↗`, `↙`, `→`) that nudge diagonally on hover.

## Layout and asymmetry

- [ ] **Asymmetric grids:** home hero 47/53 with the headline crossing the photo edge; journal main plus a 240px margin column; the Journal's 12-column front page (lead in 7, two stacked secondary stories) and the recent list beside the long reads.
- [ ] The **standings masthead** is 1fr + 270px, and the **article body** is 680px + a 190–240px margin rail.
- [ ] **Staggered portraits:** home cast (even items drop 54px) and author cards (even items drop 24px).
- [ ] **Container 1476px**, with padding of 48, 32, 22 and 17px at the four breakpoints.
- [ ] **Mobile re-composes rather than just stacking:** the home hero reorders its parts; the Journal goes lead story → 96px-thumbnail rows → numbered text rows → text-led long reads → text ledger with an occasional photo.

## Photography

- [ ] **Photography stays large and leads the page:** hero image about 53%, the Journal lead story 7 of 12 columns. Deeper in the archive, photographs are the exception (one row in eight), which keeps them special.
- [ ] **Desaturated at rest, full color on hover**, together with a slow scale of 1.045.
- [ ] **Square corners except one large bottom-right cut corner.**
- [ ] **Paper label tabs** laid over the top-left of photos.
- [ ] **Captions:** a 1px rule above, plus the category-colored `ΕΙΚΟΝΑ /` label. Galleries are headed `ΣΤΗΝ ΠΙΣΤΑ / ΦΩΤΟΓΡΑΦΙΚΟ ΑΡΧΕΙΟ`.
- [ ] Varied portrait crops in the cast (square, arched, cut corner). This is deliberate.

## Components

- [ ] **Unboxed cards:** photo → category/meta → title → excerpt, separated by 1px rules. No shadow, border or radius. The Journal's archive is a text ledger (date · category · headline · byline) under month rules.
- [ ] **Primary CTA:** a solid ink block (reversed in dark mode), 2px radius. On hover it turns **signal with ink text**. No lift, no shadow.
- [ ] **Secondary CTA:** text with a bottom rule.
- [ ] **Links in article text** use a 1px bottom border that takes the category signal on hover.
- [ ] **Standings as a ledger:** rule-divided context columns, a 2px heavy top rule on the table, a team-color rule on each row, large tabular numbers, and a headshot plate.
- [ ] **Underline tabs** (3px signal) instead of pills or segmented controls.
- [ ] **Underline-only form fields.**
- [ ] **44px minimum touch targets** throughout.

## Motion

- [ ] `--ease-editorial: cubic-bezier(.22,.68,0,1.02)`, short arrival rises (12–22px, stagger ≤ .24s), and small hover gestures (arrow nudge, icon tilt).
- [ ] `prefers-reduced-motion` disables all of it.

## Flat and matte

- [ ] No blur or glass.
- [ ] Shadows are `none` by default.
- [ ] Radii are 0–4px apart from the single cut corner.
