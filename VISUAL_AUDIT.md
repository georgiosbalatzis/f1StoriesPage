# F1 Stories: Final Adversarial Visual Audit

**Date:** 2026-09-22
**Branch:** `claude-redesign` at `49c8169b2`
**Scope:** the local implementation only. No code was changed. The server was `node scripts/serve-site.mjs` on :4173, serving fresh `*.min.css` output.

**Constraints.** `DESIGN.md` and `KEEP.md` were treated as the specification. These traits are identity and are **not** flagged:
- the paper, ink and signal palette
- Barlow for Latin display words
- the numbered kickers
- the rotated stamps
- the signal bands
- the unboxed cards
- the single cut corner
- the curated 7 + 4 archive spread, including its empty 8th column

## Method

**Rendered sweep (Playwright).**
- 19 surfaces × 6 viewports (320×800, 390×844, 768×1024, 1024×768, 1440×900, 1920×1080) × 2 themes, for **228 page loads**.
- Each load captured a fold screenshot and a DOM probe covering:
  - document and element overflow
  - text under 12px
  - targets under 44px
  - widows
  - image resolution ratio
  - broken images
  - console and network errors
- **Output:** `audit/sweep/` (fold PNGs plus `metrics.json`).

**Scroll tours at real resolution.** Home, archive, article and standings at 390, 768, 1440 and 1920, plus 320 for home and archive, in `audit/tour/`.

**State tests.**
- Mobile nav open, Tab and Escape (390, 320, 1024), in `audit/states/`.
- Keyboard focus walk, 30 stops on each of 4 routes in both themes.
- Hover diffs.
- Theme toggle layout shift (none: 0px on every heading).
- `prefers-reduced-motion` (0 running animations on 4 routes).
- Standings with the APIs blocked.
- Standings timeline sampled every 250ms.
- Bridges rendered with the redirect suppressed.

**Contrast.** WCAG contrast was computed per text node in all 10 standings reports, in both themes.
- Results where the background was a semi-transparent tint were discarded as unreliable.
- Every contrast figure reported below is text on an **opaque** surface.

**Root cause.** Source was traced with `grep` to the owning rule or function. I did not use Graphify, because every problem traced to one file in a single step.

**Impeccable.** Its `audit.md` rubric and anti-pattern list were applied by hand. The `impeccable detect` entrypoint is not installed (`~/.claude/skills/impeccable/scripts/` is empty), so **no deterministic detector pass was run**.

**Production.** `https://f1stories.gr/` was not used; every finding comes from local rendering.

**Objective checks that passed:**
- No horizontal document overflow in any of the 228 loads (`docOverflow = 0`).
- No broken `<img>`.
- No layout shift on theme toggle.
- Reduced motion is honoured.
- The mobile menu toggles `aria-expanded` and closes on Escape.
- Every nav, CTA and card link shows a 2px focus outline in both themes.
- The only console errors are third-party `429 Too Many Requests` responses (OpenF1 and Jolpica, because the sweep made hundreds of requests) and one `/favicon.ico` 404 on `offline.html`.

**Evidence** is in `audit/`: named crops (`p0-…`, `p1-…`, `p2-…`), `audit/tour/`, `audit/sweep/` and `audit/states/`. The directory is about 200 MB and is **not git-ignored**.

---

# P0: Broken, misleading or inaccessible

### VIS-P0-01: Standings presents a month-old snapshot as "Live δεδομένα"
- **SURFACE:** `/standings/` (every report that reads driver or constructor standings)
- **VIEWPORT:** all
- **THEME:** both
- **STATE:**
  - first paint;
  - slow API;
  - API failed or rate-limited (`429` responses were observed during this audit).
- **OBSERVED:**
  - The timing band always reads `● Live δεδομένα · Σεζόν 2026 · Μετά τον γύρο N`.
  - The page first renders `standings/standings-cache.json`. That file is `generatedAt 2026-08-22T04:25`, **round 11**. The live API is at **round 14**.
  - Timeline sampled every 250ms:
    - At **1271ms**: band "γύρος 11", P1 Antonelli **219**, P2 **Hamilton 169**, closest battle "Gasly vs Lawson".
    - At **3783ms**: band "γύρος 14", P1 Antonelli **292**, P2 **Russell 211**, closest battle "Norris vs Hamilton".
    - The table reorders under the reader.
  - With `api.jolpi.ca` and OpenF1 blocked, the page **stays on round 11** under the "Live" band permanently. There's no stale notice. The only hint is "Πηγή: Jolpica F1 snapshot" in the context row.
  - During the swap, one viewport shows "Jolpica F1 snapshot" in the context row and "Jolpica F1 live" in the side panel at the same time.
- **EVIDENCE:**
  - `audit/p0-standings-stale-snapshot-labelled-live-390-light.png` (API blocked)
  - `audit/p0-standings-stale-first-paint-1440-light.png` and `audit/p0-standings-after-live-swap-1440-light.png`, captured 1s apart
  - `audit/tour/standings-390-dark-00…03.png`: the table says Hamilton is 2nd while the chart below says Russell is 2nd, because they were captured mid-swap.
- **WHY THIS IS A PROBLEM:** The page misstates the championship order for 2–4s on every visit, and indefinitely whenever the API is rate-limited, while telling the reader the data is live. That's the core product of the data hub.
- **WHAT MUST BE PRESERVED:**
  - the timing band (a full-bleed signal band)
  - the snapshot-first fast paint
  - the ledger layout
- **ROOT CAUSE:**
  1. `standings/index.html:199` hard-codes "Live δεδομένα" regardless of source.
  2. `standings/standings.js:1059-1063` and `:1539` render the snapshot, then silently re-render from the API.
  3. The committed snapshot is stale. The last `chore(data): refresh standings snapshots` commit on any local branch is `899e39d11` (2026-08-22), although `publish-blog.yml` schedules `npm run build:standings-data` twice daily.
- **LIKELY FILES:**
  - `standings/index.html`
  - `standings/standings.js`
  - `.github/workflows/publish-blog.yml`
  - `scripts/build/refresh-standings-data.mjs`
- **EXACT RECOMMENDED CHANGE:**
  - Render the band label from the data source:
    - while the snapshot is shown: `Στιγμιότυπο · ενημέρωση <date>`;
    - after the live data arrives: `Live δεδομένα`;
    - if the live request fails: `Στιγμιότυπο <date> · τα live δεδομένα δεν είναι διαθέσιμα`.
  - Show the same source word in the context row and the side panel.
  - Investigate why the scheduled refresh stopped committing after 2026-08-22.
- **ACCEPTANCE CRITERIA:**
  - With Jolpica blocked, `.standings-timing-band` text does not contain "Live" and does contain the snapshot date.
  - With the API available, the band, context row and side panel never show different sources within one frame (sample every 100ms from DOMContentLoaded until 6s).
  - `standings-cache.json` `generatedAt` is within 7 days of the latest completed round on `main`.

### VIS-P0-02: The Destructors report crowns the wrong team and its chart isn't sorted
- **SURFACE:** `/standings/?tab=destructors`
- **VIEWPORT:** all
- **THEME:** both
- **STATE:** loaded
- **OBSERVED:**
  - The summary says **"Haas lead the chart with $1,067,000."**
  - The bars run HAAS 1,067,000 → MERCEDES 1,057,000 → MCLAREN 791,000 → **RED BULL 1,407,000** → CADILLAC → WILLIAMS → **ALPINE 1,300,000** → …
  - Summing `standings/destructors-cache.json` gives red_bull **1,407,000**, alpine **1,300,000**, haas **1,067,000**.
  - The headline stat is false, and the bar order looks like a ranking but isn't one.
- **EVIDENCE:** `audit/p0-destructors-wrong-leader-1440-dark.png`
- **WHY THIS IS A PROBLEM:** A data report that states an incorrect fact in its lead sentence is misleading.
- **WHAT MUST BE PRESERVED:**
  - the team bars with driver segments
  - team colours on data
  - the flow view
- **ROOT CAUSE:**
  - `standings/tabs/destructors.js:25` defines a fixed `DESTRUCTORS_TEAM_ORDER`, and `:217` maps teams in that order.
  - `:399` takes the "leader" as the first non-zero team in the fixed order.
- **LIKELY FILES:** `standings/tabs/destructors.js`
- **EXACT RECOMMENDED CHANGE:** Sort `teams` by `total` descending (tie-break on name) before rendering and before choosing `leader`.
- **ACCEPTANCE CRITERIA:**
  - The rendered `.destructors-team-total` values are non-increasing top to bottom.
  - The summary names the team with the maximum total (Red Bull for the current cache).

### VIS-P0-03: Destructors chart text is invisible in light theme
- **SURFACE:** `/standings/?tab=destructors`
- **VIEWPORT:** all
- **THEME:** light
- **STATE:** loaded
- **OBSERVED:** These elements render **white on paper** at a contrast of **1.16:1**, so the chart has no readable team names or values:
  - the chart kicker "ΖΗΜΙΕΣ ΑΝΑ ΟΜΑΔΑ"
  - the chart title "Πρωτάθλημα Destructors 2026"
  - every team label (HAAS, MERCEDES…)
  - every total except the one drawn inside a bar
- **EVIDENCE:** `audit/p0-destructors-white-text-on-paper-1440-light.png`
- **WHY THIS IS A PROBLEM:** Content disappears in a supported theme. It's a WCAG 1.4.3 failure.
- **WHAT MUST BE PRESERVED:** the unboxed ledger treatment introduced by F-04
- **ROOT CAUSE:**
  - This is a regression from F-04.
  - `standings/standings-editorial.css:178` made `.destructors-card` transparent. It used to be a dark navy card.
  - The text colours inside it are still hard-coded for that dark card in `standings/tabs/destructors.css:75,81`: `#fff`, `rgba(255,255,255,.92)` and `.96`. The same goes for the `.destructors-card-kicker` and `.destructors-team-total` rules and for the flow node `fill:#fff`.
- **LIKELY FILES:**
  - `standings/standings-editorial.css`
  - `standings/tabs/destructors.css`
- **EXACT RECOMMENDED CHANGE:** In the editorial layer, map these to theme tokens:
  - kicker → `--text-secondary`
  - title, labels and totals → `--st-text`
  - flow `text` fill → `var(--st-text)`
- **ACCEPTANCE CRITERIA:** In light theme at 390 and 1440, every text node in `.destructors-wrap`, including the SVG flow labels, has contrast ≥4.5:1, or ≥3:1 for text ≥24px, against the page background.

---

# P1: Major professionalism problems

### VIS-P1-01: Team colours used as text colour fail contrast in the data reports
- **SURFACE:** standings: track dominance, pit stops, lap-1 gains
- **VIEWPORT:** all
- **THEME:** light (worst); dark partly
- **STATE:** loaded
- **OBSERVED:** Measured on opaque paper `#f2eee4` / `#e9e3d6`:

  | Report | Element | Colour | Contrast |
  |---|---|---|---|
  | Track dominance | lap time `1:35.587` (28.8px/800) | `#27f4d2` | **1.21:1** |
  | Track dominance | lap time `1:36.030` | `#05d2b0` | **1.67:1** |
  | Pit stops | P1 rank "1" | `#fbbf24` | 1.19:1 |
  | Pit stops | P2 rank "2" | slate `#94a3b8` | 1.65:1 |
  | Pit stops | P3 rank "3" | `#d97706` | 1.52:1 |
  | Pit stops | stop times | team colour | e.g. teal |
  | Lap-1 gains | "+n" pills (12px/800) | `#41b6e6` | **1.81:1** |
  | Lap-1 gains | "+n" pills | orange | 1.97:1 |
  | Lap-1 gains | "+n" pills | grey `#b6babd` | 1.53:1 |
  | Lap-1 gains | fallback bubbles "#43", "#12" | `#41b6e6` | 1.81:1 |

  The fallback-bubble blue is the retired legacy blue accent.
- **EVIDENCE:**
  - `audit/p1-trackdom-team-colour-lap-times-1440-light.png`
  - `audit/p1-pitstops-dashboard-rows-1440-light.png`
  - `audit/p1-lap1-bubble-chart-1440-light.png`
- **WHY THIS IS A PROBLEM:**
  - The key numbers of each report are the least legible text on the page.
  - It violates DESIGN §1, "Team colour never becomes UI chrome" (text colour is chrome), and WCAG 1.4.3.
- **WHAT MUST BE PRESERVED:** team colour on rules, bars, segments, the headshot base line and the track trace
- **ROOT CAUSE:**
  - `standings/tabs/track-dominance.css:62`: `.track-dom-team-time { color: rgb(var(--team-color)) }`
  - pit-stops rank and time colours in `standings/tabs/pit-stops.css`
  - `.lap1-gain-pill` and `.lap1-bubble-fallback` in `standings/tabs/lap1-gains.css`
  - None of these are overridden in `standings-editorial.css`.
- **LIKELY FILES:**
  - `standings/standings-editorial.css` (preferred: one override block)
  - `standings/tabs/{track-dominance,pit-stops,lap1-gains}.css`
- **EXACT RECOMMENDED CHANGE:**
  - Set text in these elements to `--st-text` (primary figures) or `--st-text-secondary` (secondary).
  - Carry team identity with a 2–3px team-colour rule or dot beside the value, as the drivers table already does.
  - Remove the gold, silver and bronze rank colours. Rank reads by position and weight.
- **ACCEPTANCE CRITERIA:** On all three tabs at 390 and 1440 in both themes:
  - Every text node over an opaque surface is ≥4.5:1, or ≥3:1 when it is ≥24px or ≥18.66px bold.
  - No element's computed `color` equals its `--team-color`.

### VIS-P1-02: Pit stops and lap-1 gains still read as a SaaS dashboard
- **SURFACE:** `/standings/?tab=pit-stops`, `?tab=lap1-gains`
- **VIEWPORT:** all
- **THEME:** both
- **STATE:** loaded
- **OBSERVED:**
  - **Pit stops:**
    - Every result row is a fully bordered box filled with a 4% team tint (mint, pink, blue).
    - Team names are grey pills ("Mercedes", "Red Bull Racing").
    - Ranks are podium-coloured.
    - The view switch is "🏁 Per Race / 🏆 Season Best", with icons and English labels.
  - **Lap-1 gains:**
    - The chart sits in a boxed, filled card.
    - It shows an "11 sessions" pill badge.
    - 9 of 11 bubbles are headshot-less fallbacks ("#11", "#16", "#87") in legacy blue.
    - The "+n" corner badges are clipped: "+1" renders as "+⁊".
    - Labels such as "#11 TIE" and "#55 TIE" appear.
  - This is the DESIGN §6 anti-pattern "SaaS dashboard components". DATA-04 and F-04 unboxed the outer cards but not the rows and chart inside them.
- **EVIDENCE:**
  - `audit/p1-pitstops-dashboard-rows-1440-light.png`
  - `audit/p1-lap1-bubble-chart-1440-light.png`
- **WHY THIS IS A PROBLEM:** Two of ten reports look like a different product from the ledger used in drivers, quali and debrief.
- **WHAT MUST BE PRESERVED:**
  - the data
  - the per-race and season-best capability
  - headshots
  - team colour on a rule
- **ROOT CAUSE:** Report CSS in `standings/tabs/pit-stops.css` and `lap1-gains.css` isn't covered by the editorial override lists in `standings/standings-editorial.css:178-190`. Those lists only target the outer `*-card` classes.
- **LIKELY FILES:**
  - `standings/standings-editorial.css`
  - `standings/tabs/pit-stops.{css,js}`
  - `standings/tabs/lap1-gains.{css,js}`
- **EXACT RECOMMENDED CHANGE:**
  - **Pit-stop rows:**
    - no background and no side or bottom borders;
    - a 1px `--st-border` rule between rows;
    - a 2px team-colour left rule, as on `.st-row`.
  - **Team pills:** plain `--st-text-secondary` text.
  - **View switch:** the existing underline-tab style, with Greek labels ("Ανά αγώνα / Καλύτερο σεζόν") and no emoji icons.
  - **Lap-1 chart:**
    - remove the card background and border;
    - render the badge as plain meta text ("11 συνεδρίες");
    - make the fallback bubble a neutral `--bg-surface-alt` disc with `--st-text` initials;
    - make the gain badges non-clipping (`overflow: visible` on the bubble, badge ≥ its text width).
- **ACCEPTANCE CRITERIA:**
  - In both tabs, no element wider than 300px has borders on all four sides.
  - No computed `border-radius` ≥ 8px apart from `50%` avatars.
  - No non-transparent background on rows.
  - No clipped text: `scrollWidth ≤ clientWidth` for every `.lap1-*` badge.
  - No `#41b6e6` computed anywhere in the panel.

### VIS-P1-03: English and developer copy leaks into the Greek data hub
- **SURFACE:** standings: quali, lap-1, tyre pace, dirty air, track dominance, pit stops, debrief, destructors
- **VIEWPORT:** all
- **THEME:** both
- **STATE:** loaded
- **OBSERVED:** Visible strings, taken from the text nodes:
  - **Quali:** "…ο συνολικά ταχύτερος **teammate** εμφανίζεται αριστερά και τα **rows** ταξινομούνται…"
  - **Lap-1:** "Για κάθε **completed** Grand Prix race ή sprint", "**Completed race και sprint sessions**", "**11 sessions**", "**Lap 1 Gain (Pos)**"
  - **Tyre pace / dirty air:** "Πηγή: OpenF1 **\`laps\` + \`stints\`**", "\`location\`, \`laps\`, \`session_result\` και \`race_control\`": raw API endpoint names in backticks.
  - **Track dominance:**
    - "Σύγκρινε το **fastest lap** … **completed session**"
    - "**Hover το track για live delta tooltip** · η **checkered** γραμμή δείχνει το **start/finish**", which is a hover instruction on touch devices
    - "**RUS ahead 90%**", "**on ANT**", "**peak swing**"
    - "**Source:** … Κάθε **selected driver** εκπροσωπείται από το **single fastest lap**"
  - **Pit stops:** "**Per Race / Season Best**", "**Lap 28 · Stop 2**"
  - **Debrief:** "**single-lap pace, long-run pace και tyre degradation**", "**6 laps**"
  - **Destructors:**
    - "**Team damage bars και driver-to-team flow chart σε ένα tabbed view**"
    - "**Latest available on F1 Top App (May 7, 2026)**"
    - "**Haas lead the chart…**"
    - the internal note "**Auto-refreshed from the F1 Top App HTML standings. A local snapshot is still required because the upstream page does not expose a stable browser-safe API.**"
- **EVIDENCE:**
  - `audit/p1-quali-mixed-language-copy-390-dark.png`
  - `audit/p1-trackdom-hover-copy-and-same-team-colours-390-light.png`
  - `audit/p0-destructors-wrong-leader-1440-dark.png`
- **WHY THIS IS A PROBLEM:**
  - KEEP §Greek-first says English appears only as slogans or F1 jargon.
  - Developer notes and endpoint names on a public page read as unfinished.
  - DATA-07 is marked done but covered tab labels only. F-13 was fixed for debrief tabs only.
- **WHAT MUST BE PRESERVED:** F1 jargon that Greek readers use (pit stop, stint, Grand Prix, sprint, DRS), driver codes and team names
- **ROOT CAUSE:** Literal strings in `standings/tabs/*.js` renderers, plus `source.note` and `snapshotLabel` passed through from the caches (`standings/destructors-cache.json`, `debrief-cache.json`).
- **LIKELY FILES:**
  - `standings/tabs/quali-gaps.js`
  - `standings/tabs/lap1-gains.js`
  - `standings/tabs/tyre-pace.js`
  - `standings/tabs/dirty-air.js`
  - `standings/tabs/track-dominance.js`
  - `standings/tabs/pit-stops.js`
  - `standings/tabs/debrief.js`
  - `standings/tabs/destructors.js`
- **EXACT RECOMMENDED CHANGE:**
  - Translate the UI copy, for example:
    - "ταχύτερος συμπαίκτης"
    - "γραμμές"
    - "ολοκληρωμένοι αγώνες"
    - "Πέρασε πάνω από την πίστα (ή πάτησέ την)"
    - "RUS μπροστά 90%"
    - "έναντι ANT"
    - "Γύρος 28 · Στάση 2"
    - "6 γύροι"
  - Replace backticked endpoint lists with "Πηγή: OpenF1".
  - Never render cache `source.note` or `snapshotLabel` verbatim. Map them to a Greek template: "Στιγμιότυπο F1 Top App, 7 Μαΐου 2026".
- **ACCEPTANCE CRITERIA:**
  - A text-node scan of every `.standings-panel.active` for `/\b(Hover|completed|fastest|selected|rows|teammate|Source|ahead|Latest available|lead the chart|Per Race|Season Best|sessions|laps|Stop \d|tabbed|flow chart|snapshot|Auto-refreshed)\b|`/` returns 0 matches on all 10 tabs.

### VIS-P1-04: The mobile standings report bar pins 208px of chrome
- **SURFACE:** `/standings/` (all tabs)
- **VIEWPORT:** 320, 390 (≤767)
- **THEME:** both
- **STATE:** scrolled
- **OBSERVED:**
  - The sticky `.standings-report-select` is **140px tall**: "ΑΝΑΦΟΡΑ" label, the select, and a two-line source/meta line.
  - It sits under the 68px masthead, so **208px of an 844px viewport (24.6%) stays pinned** while reading the table.
  - At 320×800 that's 26%.
  - Section titles scroll underneath it: the chart title "Κατανομή βαθμών" is never visible while its bars are.
- **EVIDENCE:**
  - `audit/p1-standings-sticky-report-bar-390-dark.png`
  - `audit/tour/standings-390-dark-03.png`, where the chart is shown without its title
- **WHY THIS IS A PROBLEM:** On the most data-dense page the phone shows only about 7 table rows. Mobile chrome is heavier than the content.
- **WHAT MUST BE PRESERVED:**
  - the select as the mobile report switcher
  - the source attribution
- **ROOT CAUSE:** `standings/standings-editorial.css:230,241,263` make the whole select block sticky (`top: 68/76px`), including the label and the source meta line.
- **LIKELY FILES:**
  - `standings/standings-editorial.css`
  - `standings/index.html` (meta placement)
- **EXACT RECOMMENDED CHANGE:**
  - Keep only the `<select>` sticky, at 48px with 8px vertical padding.
  - Move the "ΑΝΑΦΟΡΑ" label and the source/meta line out of the sticky element, so they scroll away.
- **ACCEPTANCE CRITERIA:** At 390×844 after scrolling 1000px:
  - the sum of the heights of all `position: sticky/fixed` elements is ≤ 132px (68 masthead + ≤64 selector);
  - the `.chart-section` heading is fully visible when its first bar is at the top of the unobscured area.

### VIS-P1-05: The offline page is off-brand, English and system-font
- **SURFACE:** `/offline.html`
- **VIEWPORT:** all
- **THEME:** both (it doesn't theme)
- **STATE:** service-worker offline fallback
- **OBSERVED:**
  - All copy is English: "Offline", "No internet connection. Check your network and try again.", "Retry", "CACHED ARTICLES".
  - The fonts are `DM Sans` and `Outfit`, neither loaded, so the page renders in system `-apple-system`.
  - The button is a **legacy blue `#41b6e6` pill** with 10px radius.
  - The card is centred with a **20px radius**.
  - The page background is blue-black `#111113`.
  - `/favicon.ico` returns 404.
- **EVIDENCE:** `audit/p1-offline-page-off-brand-390-dark.png`
- **WHY THIS IS A PROBLEM:** It breaks most DESIGN §6 bans at once: the blue accent, cool surfaces, a third face, rounded cards and English UI. Every offline visitor sees it.
- **WHAT MUST BE PRESERVED:**
  - the retry behaviour
  - the cached-articles list (`scripts/offline-page.js`)
- **ROOT CAUSE:** `offline.html` inline styles predate the editorial layer and load no site CSS or fonts.
- **LIKELY FILES:**
  - `offline.html`
  - `scripts/offline-page.js`
- **EXACT RECOMMENDED CHANGE:**
  - Self-host the Plex and Barlow `@font-face` rules (as `404.html` does).
  - Use the `--bg-base` / `--paper` / `--ink` tokens, with dark by default.
  - Copy:
    - folio line `F1 STORIES / ΕΚΤΟΣ ΣΥΝΔΕΣΗΣ`
    - h1 `Χωρίς σύνδεση.` with a signal full stop
    - body copy in Greek
    - a primary CTA `Δοκίμασε ξανά` in the ink/paper block with 2px radius
    - list heading `ΑΠΟΘΗΚΕΥΜΕΝΑ ΑΡΘΡΑ`
  - Add a favicon link.
- **ACCEPTANCE CRITERIA:**
  - The computed `font-family` of every text node starts with `IBM Plex Sans` or `Barlow Condensed`.
  - No computed colour `rgb(65,182,230)`.
  - No `border-radius` > 4px.
  - Text-node scan finds no English UI words.
  - No 404 requests on load.

### VIS-P1-06: The 404 page is a separate design system
- **SURFACE:** `/404.html`
- **VIEWPORT:** all
- **THEME:** both
- **STATE:** static
- **OBSERVED:**
  - **Heading font:** the h1 "Λάθος στροφή." is set in **Barlow Condensed**, which has no Greek glyphs, at 144px with `text-transform: uppercase`. It renders in the OS fallback: Helvetica Bold on macOS, which differs per platform. That's a third typeface at the largest size on the site.
  - **Decoration:** concentric "radar" rings with "RED FLAG" (fake HUD styling, banned in DESIGN §6). The inner circle cuts through the "404" numerals.
  - **Small text:** 9.92px "F1 Stories" and "PURE RACING · REAL STORIES", 10.56px "RED FLAG", 11.2px "Σφάλμα πλοήγησης / 404".
  - **Chrome:**
    - no site masthead or nav;
    - the wordmark reads "F1 Stories" instead of "F1 STORIES.";
    - the brand link target is 38px tall;
    - in dark theme the primary CTA is a coral fill, not the ink/paper block.
- **EVIDENCE:**
  - `audit/p1-404-greek-in-barlow-fallback-1440-light.png`
  - `audit/p1-404-radar-decoration-390-dark.png`
  - `audit/sweep/metrics.json` → `404-*`.`smallText`
- **WHY THIS IS A PROBLEM:** KEEP says Barlow is Latin-only and there are 3 faces maximum. The HUD rings are an explicit anti-pattern. The page reads as a template.
- **WHAT MUST BE PRESERVED:**
  - the Greek copy and voice ("Λάθος στροφή.", "Εκτός διαδρομής")
  - the two CTAs
  - inline CSS with no external dependencies
- **ROOT CAUSE:** `404.html` inline `<style>`. The `h1` uses `font-family:"Barlow Condensed"` and `text-transform:uppercase`. The rings are a local SVG/CSS decoration.
- **LIKELY FILES:** `404.html`
- **EXACT RECOMMENDED CHANGE:**
  - Set the h1 in Plex 600, mixed case: `Λάθος στροφή` plus a signal `.`, at `clamp(2.5rem,6vw,4.5rem)` with `-.025em` tracking.
  - Delete the rings and the "RED FLAG" marker. If a numeral is wanted, keep "404" in Barlow (Latin digits are allowed).
  - Raise all labels to ≥12px.
  - Use the shared masthead markup, or at least "F1 STORIES." with the signal stop.
  - Primary CTA: ink/paper block.
- **ACCEPTANCE CRITERIA:**
  - No Greek text node has a computed `font-family` starting with `Barlow`.
  - No text under 12px.
  - No element with `border-radius: 50%` wider than 100px.
  - Primary CTA background equals `--ink` (light) or `--paper` (dark).
  - Brand link ≥44px tall.

### VIS-P1-07: At ≥1600px the home cover pushes its CTA below the fold
- **SURFACE:** home hero
- **VIEWPORT:** 1600–1920+ (measured at 1920×1080)
- **THEME:** both
- **STATE:** first load
- **OBSERVED:**
  - At 1920×1080 the h1 is **88px** and runs **6 lines** in a 652px column.
  - The primary CTA sits at **top 1059 / bottom 1106**, below the 1080 fold.
  - The photo ends at y=676, leaving about **400px of empty right column** beside the headline.
  - The headline jumps from 68.8px at 1599px to 88px at 1600px, a +28% jump at a single breakpoint.
- **EVIDENCE:** `audit/p1-home-hero-cta-below-fold-1920-dark.png`
- **WHY THIS IS A PROBLEM:** On the most common desktop resolution the cover is lopsided, and the main action is off-screen.
- **WHAT MUST BE PRESERVED:**
  - the 47/53 split
  - the mixed-case Plex headline with a signal stop
  - the stamp over the photo
- **ROOT CAUSE:** `home.css:255-256`: `@media (min-width:1600px){ .hero-content h1 { font-size: clamp(3rem, 7vw, 5.5rem) } }` overrides `home.css:67` (`clamp(2.5rem,4.3vw,4.5rem)`).
- **LIKELY FILES:** `home.css`
- **EXACT RECOMMENDED CHANGE:** Delete the ≥1600 override. The base clamp already caps at 72px. Alternatively, cap it at `4.75rem`.
- **ACCEPTANCE CRITERIA:**
  - At 1920×1080 and 1600×900: `#hero .cta-primary` bottom ≤ viewport height, and h1 ≤ 5 lines.
  - Across 1580–1620px, h1 `font-size` changes by less than 4px.

> **Carried, not re-filed:** the legal pages still use the pre-editorial skin: a centred hero, a `999px` pill kicker, a 16px-radius boxed TOC that clips at "Cooki…" on 390, a bordered content card and pink mono code (`audit/p1-privacy-legacy-skin-390-light.png`). **POLISH-01** in `TASKS.md` already covers this and is still open.

---

# P2: Noticeable quality problems

### VIS-P2-01: The home cover's deck is the site tagline, and its excerpt is a truncated paragraph
- **SURFACE:** home hero
- **VIEWPORT:** all
- **THEME:** both
- **STATE:** static
- **OBSERVED:**
  - Under the story headline "Istanbul Park 2006: …Schumacher." the deck reads **"Τεχνική ανάλυση, άποψη και ελληνική F1 κοινότητα."**, which is the site slogan, not the story's standfirst.
  - It's followed by the article's first paragraph, cut mid-sentence: "…όχι μόνο για την απαιτητική χάραξη**...**".
  - The reader gets headline → brand slogan → truncated body text.
- **EVIDENCE:**
  - `audit/p2-home-hero-tagline-as-deck-1440-dark.png`
  - `audit/tour/home-390-dark-00.png`
- **WHY THIS IS A PROBLEM:**
  - It breaks the hierarchy: the second-largest text on the page isn't about the story.
  - An auto-truncated "..." on a cover is a template tell.
- **WHAT MUST BE PRESERVED:**
  - the cover structure (edition line, eyebrow, h1, deck, description, byline, CTAs)
  - the build-injected hero regions
- **ROOT CAUSE:**
  - `index.html:204`: the `.hero-subtitle` is hard-coded.
  - `index.html:205`: `f1s:hero-excerpt` is filled with a character-truncated body excerpt by the hero build step.
- **LIKELY FILES:**
  - `index.html` (source region)
  - the hero-injection build step that writes `f1s:hero-*` (`scripts/build/…`)
  - `blog-module` excerpt source
- **EXACT RECOMMENDED CHANGE:**
  - Inject the story's own deck or excerpt into `.hero-subtitle`, as a sentence-complete excerpt truncated at a sentence boundary of ≤160 characters.
  - Drop `.hero-description`, or fill it with a second complete sentence.
  - Move the slogan to the edition line, where "ΤΕΧΝΙΚΗ ΜΑΤΙΑ · ΚΑΘΑΡΗ ΑΠΟΨΗ" already carries it.
- **ACCEPTANCE CRITERIA:**
  - `.hero-subtitle` text ≠ "Τεχνική ανάλυση, άποψη και ελληνική F1 κοινότητα.".
  - No hero text node ends in `...` or `…` unless it is a complete sentence.

### VIS-P2-02: The hero byline carries a blurred text-shadow
- **SURFACE:** home hero
- **VIEWPORT:** all
- **THEME:** both; most visible in light
- **STATE:** static
- **OBSERVED:**
  - `#hero-story-byline` computes `text-shadow: rgba(0,0,0,.26) 0 1px 8px`.
  - On paper this halos the 12px caps "ΘΕΜΗΣ ΧΑΡΒΑΛΗΣ · 20 ΣΕΠΤΕΜΒΡΙΟΥ 2026", which look smudged.
  - Every other hero text element resets this shadow to `none`.
- **EVIDENCE:** `audit/p2-home-byline-text-shadow-320-light.png`, and the byline in `audit/tour/home-768-light-00.png`
- **WHY THIS IS A PROBLEM:** It's the one shadowed text on a system that is flat and matte on purpose (KEEP). It reduces legibility of 12px text.
- **WHAT MUST BE PRESERVED:** the byline content and size
- **ROOT CAUSE:**
  - Legacy `styles.css:161` sets `.hero-content p { text-shadow: 0 1px 8px rgba(0,0,0,.26) }`.
  - `home.css:72` (`.hero-story-byline`) is the only hero `p` without `text-shadow: none`. Compare `home.css:71` and `:73`.
- **LIKELY FILES:** `home.css`
- **EXACT RECOMMENDED CHANGE:** Add `text-shadow: none` to `home.css:72`.
- **ACCEPTANCE CRITERIA:** Every element in `#hero` computes `text-shadow: none`.

### VIS-P2-03: The contact heading outranks the cover headline
- **SURFACE:** home #contact
- **VIEWPORT:** all
- **THEME:** both
- **STATE:** static
- **OBSERVED:**
  - At 1440, "Έχεις κάτι να πεις;" is **69.1px**, the cover h1 is **61.9px**, and the other section h2s are 43.2px.
  - At 390 the sizes are **40px** against a 33.2px h1 and 30.4px h2s.
  - The page's last section has its biggest type.
- **EVIDENCE:**
  - `audit/p2-home-contact-h2-oversized-1440-dark.png`
  - `audit/tour/home-390-dark-end-00.png`
- **WHY THIS IS A PROBLEM:** It inverts the hierarchy. With colour removed, the contact form reads as the most important thing on home.
- **WHAT MUST BE PRESERVED:**
  - the informal copy
  - the signal "**;**"
  - the two-column contact composition
- **ROOT CAUSE:**
  - `home.css:213`: `.contact-block h2 { font-size: clamp(2.5rem, 4.8vw, 4.8rem) }`
  - `home.css:404`: `2.5rem` on mobile
  - Both exceed the hero clamp (`home.css:67`).
- **LIKELY FILES:** `home.css`
- **EXACT RECOMMENDED CHANGE:** Use the section h2 scale, `clamp(1.8rem,3vw,3rem)` (`editorial.css:108`). If emphasis is wanted, cap it at `clamp(2rem,3.4vw,3.4rem)`, always below the h1.
- **ACCEPTANCE CRITERIA:** At every viewport in the matrix, `.contact-block h2` font-size < `#hero h1` font-size.

### VIS-P2-04: On phones, the archive masthead folio wraps and the stamp floats orphaned
- **SURFACE:** blog archive masthead
- **VIEWPORT:** 320, 390 (≤767)
- **THEME:** both
- **STATE:** static
- **OBSERVED:**
  - **Folio:** the right label "ΙΣΤΟΡΙΕΣ ΑΠΟ ΤΟ PADDOCK" is forced onto 2 lines, with "PADDOCK" alone. At 320 the left label "F1 STORIES / THE JOURNAL" wraps too. No other route's folio wraps.
  - **Stamp:** since the F-02 fix, the stamp sits by itself in an 82px row (y 483–564 at 390), right-aligned below "Εξερεύνησε το αρχείο", attached to nothing.
- **EVIDENCE:**
  - `audit/p2-archive-masthead-folio-stamp-390-dark.png`
  - `audit/tour/blog-320-light-00.png`
- **WHY THIS IS A PROBLEM:**
  - The folio is a signature element, and a wrapped folio looks broken.
  - The orphaned stamp adds 82px of decoration before any content, on a page where the first story starts below the fold.
- **WHAT MUST BE PRESERVED:**
  - the folio line
  - the stamp (KEEP), overlapping an edge
- **ROOT CAUSE:**
  - `blog-module/blog/archive-editorial.css:380`: `.archive-edition > span:last-child { max-width: 16ch }` forces the wrap.
  - `:387`: `.archive-stamp { position: static; justify-self: end; margin: 6px 8px 4px 0 }` (from F-02).
- **LIKELY FILES:** `blog-module/blog/archive-editorial.css`
- **EXACT RECOMMENDED CHANGE:**
  - At ≤767, remove the 16ch cap and let the folio `flex-wrap` put the right label on its own full line, left-aligned. Better, hide the right label at ≤389 as standings does.
  - Place the stamp `position: absolute` over the top-right corner of the first card image. That's the "overlaps the edge of the photo" behaviour from DESIGN §4, and it avoids the deck text that F-02 protected.
- **ACCEPTANCE CRITERIA:**
  - At 320 and 390, each `.archive-edition` span is 1 line.
  - `.archive-stamp` doesn't intersect any text node's client rects, and adds 0px of flow height (the masthead is ≥60px shorter than now).

### VIS-P2-05: Archive card meta wraps badly and uses colour inconsistently
- **SURFACE:** blog archive cards (thumbnail rows especially)
- **VIEWPORT:** 320, 390
- **THEME:** both
- **STATE:** static
- **OBSERVED:**
  - **Wrapping:** in thumbnail rows the meta "Θέμης Χαρβάλης · 18 Σεπ 2026 · 7 λεπτά" breaks with the **separator stranded at the end of line 1**. It runs 2–4 line boxes at 390.
  - **Colour:** the **author name** takes the **category** colour (coral for Ειδήσεις, ochre for Ιστορία, blue for Οδηγοί, violet for Ομάδες). The category itself sits bottom-right in neutral grey with an underline.
  - **Weight:** reading time is weight 500, the date 400.
- **EVIDENCE:**
  - `audit/p2-archive-thumb-meta-wrap-320-light.png`
  - `audit/tour/blog-390-dark-01.png`
- **WHY THIS IS A PROBLEM:**
  - Colour encodes category but is attached to the author, so the same person appears in 4 colours.
  - Stranded separators and uneven weights are hobby-coded tells.
- **WHAT MUST BE PRESERVED:**
  - per-category signal colours (KEEP)
  - the .75rem meta size
  - the arrow CTA
- **ROOT CAUSE:**
  - `archive-editorial.css:295`: `.article-card-meta .author-tag { color: var(--card-signal-readable) }`
  - `:323`: `.author-tag` weight 500
  - The separators are separate flex items with `gap: 5px 8px` (`:322`), so they can end a line.
- **LIKELY FILES:**
  - `blog-module/blog/archive-editorial.css`
  - card renderer in `blog-module/` (meta markup)
- **EXACT RECOMMENDED CHANGE:**
  - Move the category signal to the category label, or to the arrow and a 7px dot.
  - Make the author name `--text-primary` at 500.
  - Put each separator inside the following item (`::before`) so it can't end a line.
  - Make the reading time weight 400.
- **ACCEPTANCE CRITERIA:**
  - For every card at 320 and 390, no line box ends with "·".
  - `.author-tag` computed colour is identical across categories.
  - All meta items share one font-weight.

### VIS-P2-06: Standings uses a different gutter from every other route at 768–1199
- **SURFACE:** `/standings/` masthead, band, tabs and content
- **VIEWPORT:** 768, 1024 (768–1199)
- **THEME:** both
- **STATE:** static
- **OBSERVED:**
  - The content edge is at **x=48** on standings.
  - It's **x=32** on home, archive, authors and privacy at the same widths.
  - Moving between nav items shifts the whole page edge by 16px.
- **EVIDENCE:**
  - `audit/p2-standings-gutter-48-vs-32-1024-light.png` against `audit/p2-archive-gutter-32-1024-light.png`
  - probe: `1024 /standings/ firstContainerContentLeft=48` against `32` elsewhere
- **WHY THIS IS A PROBLEM:** A container rule that differs by route is a hobby-coded tell. KEEP fixes padding at 48, 32, 22 and 17px.
- **WHAT MUST BE PRESERVED:** the 48px gutter at ≥1200
- **ROOT CAUSE:**
  - `standings/standings-editorial.css:30`: `.standings-header .container { padding-inline: 48px }`
  - Only `:250` (≤767) overrides it. There's no ≤1199 → 32px step. This is DESIGN §3 B2.
- **LIKELY FILES:** `standings/standings-editorial.css`
- **EXACT RECOMMENDED CHANGE:** Remove the `padding-inline` redeclarations at `:30` and `:250` and inherit the container padding from `styles/editorial.css`.
- **ACCEPTANCE CRITERIA:** At 768, 1024, 1440 and 390, the first content left edge on `/standings/` equals that on `/` (±1px).

### VIS-P2-07: Photography is upscaled in galleries and in cropped card slots
- **SURFACE:** article gallery; home journal lead; archive lead
- **VIEWPORT:** 768–1920
- **THEME:** both
- **STATE:** loaded, 1× DPR
- **OBSERVED:**
  - **Gallery:** in `20260920W`, `3.webp` (natural width 460) is drawn at **678–708px** wide, a 0.65–0.68 ratio even on 1× screens. It's visibly soft.
  - **Home journal lead at 1440:** `1-mobile.webp` (640×360) fills a 632×474 cover slot, 0.76 on height.
  - **Archive lead:** 0.64 at 768 and 0.70 at 1024, both on height.
- **EVIDENCE:**
  - `audit/p2-article-gallery-upscaled-1440-light.png`
  - `audit/sweep/metrics.json` → `lowres` for `article-*`, `home-1440-*`, `blog-768-*`, `blog-1024-*`
- **WHY THIS IS A PROBLEM:** KEEP says photography leads the page. The soft images are the largest ones.
- **WHAT MUST BE PRESERVED:**
  - `srcset` variants from RESP-02
  - cut corners
  - the desaturate-at-rest treatment
- **ROOT CAUSE:**
  1. Gallery frames are `width: 100%` of the 680px column with no cap at the natural width.
  2. `sizes` from `cardImageSrcset()` (`blog-module/taxonomy.js`) describes slot **width** only. When the slot is taller than the 16:9 source, `object-fit: cover` scales by height, so the chosen candidate is under-resolved.
- **LIKELY FILES:**
  - `blog-module/blog/article-editorial.css` (gallery)
  - `blog-module/taxonomy.js`
  - `home.css` / `archive-editorial.css` (slot aspect)
- **EXACT RECOMMENDED CHANGE:**
  - **Gallery:** `max-width: min(100%, var(--natural-w))` from the `width` attribute, centred on the contact-sheet ground. Alternatively, generate an 1400w variant at publish and add it to `srcset`.
  - **Cover slots:** scale `sizes` by `slotAspect / sourceAspect` (for example `sizes="(min-width:1200px) 845px, …"` for the 4:3 lead), or give the slots the source's 16:9 aspect.
- **ACCEPTANCE CRITERIA:** At 1440@1× and 768@2×, every content `<img>` wider than 300px has `min(naturalW/(renderW·dpr), naturalH/(renderH·dpr)) ≥ 0.9`, excluding sources whose original is smaller than the slot, which must then render at ≤ natural width.

### VIS-P2-08: Article photos ship with empty alt text
- **SURFACE:** articles (gallery images)
- **VIEWPORT:** all
- **THEME:** both
- **STATE:** static
- **OBSERVED:**
  - `20260920W`: both gallery photos have `alt=""`.
  - `20260415` (image-heavy): **9 of 18** content images have empty alt.
  - These are informative race photographs, not decoration.
- **EVIDENCE:**
  - `blog-module/blog-entries/20260920W/article.html` (`<img src="3.webp" alt="" …>`)
  - probe `imgsNoAlt: 9` on `20260415`
- **WHY THIS IS A PROBLEM:** WCAG 1.1.1. Screen-reader users skip the "ΣΤΗΝ ΠΙΣΤΑ / ΦΩΤΟΓΡΑΦΙΚΟ ΑΡΧΕΙΟ" gallery entirely.
- **WHAT MUST BE PRESERVED:** the gallery UI
- **ROOT CAUSE:** The author tool (`generate.html` → `scripts/author/`) emits `alt=""` when no caption or alt is given. There's no warning.
- **LIKELY FILES:**
  - `scripts/author/article-source.js`
  - `scripts/author/generate-page.js`
  - `blog-module/build/` (gallery renderer)
- **EXACT RECOMMENDED CHANGE:**
  - Add a non-blocking warning in the POLISH-04 `titleWarnings` pattern: "εικόνα χωρίς περιγραφή".
  - Fall back to `alt="Φωτογραφία από: <article title>, <n>/<N>"` when none is given.
- **ACCEPTANCE CRITERIA:**
  - New builds contain no `<img alt="">` inside `.article-content` or the gallery, unless the image is marked decorative.
  - A unit test in `scripts/author/__tests__/` covers the warning.

### VIS-P2-09: In-article tables are titled from CSV filenames
- **SURFACE:** articles with data tables (23 articles)
- **VIEWPORT:** all
- **THEME:** both
- **STATE:** static
- **OBSERVED:**
  - The table titles are "**FL**", "**Q**", "**Fp2top5**", "**Redbull**", "**Top10**", "**Mclaren**".
  - The footer credits "**Πηγή: fl.csv**", "Πηγή: q.csv" and so on.
  - The headers are English ("Pos, No, Driver, Car, Lap, Time, Avg Speed (km/h)").
  - On mobile, a 1-row table becomes a 536px-tall key/value stack.
- **EVIDENCE:**
  - `audit/p2-article-table-csv-filename-title-1440-light.png`
  - `audit/p2-article-table-csv-filename-title-390-dark.png`
  - `grep -oh 'Πηγή: [^<]*\.csv'` → 23 articles
- **WHY THIS IS A PROBLEM:** A filename presented as a source citation looks unfinished. The ledger styling (ARTICLE-05) is undermined by its labels.
- **WHAT MUST BE PRESERVED:**
  - the ledger table styling
  - the table/card toggle
- **ROOT CAUSE:** `blog-module/build/csv-to-table.js` derives the `<h4 class="table-title">` and the footer from the CSV basename.
- **LIKELY FILES:** `blog-module/build/csv-to-table.js`
- **EXACT RECOMMENDED CHANGE:**
  - Use an optional caption and source from the author source (e.g. `[[table:fl.csv|Ταχύτερος γύρος|FIA]]`).
  - When absent, omit the title and footer rather than printing the filename.
  - Keep headers as authored.
  - At ≤767, render ≤2-row tables as the ledger table (with horizontal scroll) instead of the card stack.
- **ACCEPTANCE CRITERIA:**
  - No rendered article contains `.table-title` text matching a CSV basename.
  - No text node contains `.csv`.
  - Golden tests are updated.

### VIS-P2-10: The mobile article stacks two sticky bars (122px)
- **SURFACE:** article
- **VIEWPORT:** 320, 390
- **THEME:** both
- **STATE:** scrolled
- **OBSERVED:**
  - The masthead (68px) and `.article-mini-bar` (54px: category, short title, share) are both pinned.
  - That's **122px of 844 (14.5%)** during reading.
  - The mini bar repeats the category a third time.
- **EVIDENCE:** `audit/p2-article-sticky-chrome-390-dark.png`
- **WHY THIS IS A PROBLEM:** The reading column should be the calmest surface, and a double header reduces each screen by about 3 lines of body text.
- **WHAT MUST BE PRESERVED:**
  - the reading-progress bar
  - share access
- **ROOT CAUSE:** `.article-mini-bar` is sticky below a masthead that doesn't collapse (`blog-module/blog/article-editorial.css` / `article-styles.css`).
- **LIKELY FILES:**
  - `blog-module/blog/article-editorial.css`
  - article scroll script
- **EXACT RECOMMENDED CHANGE:** At ≤767, once the mini bar is active, make it **replace** the masthead (`transform: translateY(-68px)` on the masthead, mini bar at `top: 0`), or drop the mini bar and keep the progress bar only.
- **ACCEPTANCE CRITERIA:** At 390×844, scrolled 1500px into the body, the total height of pinned elements is ≤ 68px.

### VIS-P2-11: The homepage's only video shows a faded logo instead of the episode
- **SURFACE:** home "ON AIR." aside
- **VIEWPORT:** all
- **THEME:** both
- **STATE:** before play
- **OBSERVED:**
  - The facade shows `/images/logo-256.webp` (a square, 256px image) cropped to 16:9 at **22% opacity**.
  - It's upscaled to 346px (0.52 at 390@2×), with a play button on top.
  - It reads as a missing-image placeholder next to photographic story cards.
  - The meta line "ΓΙΑΝΝΗΣ ΠΟΥΛΙΚΙΔΗΣ · ΓΙΩΡΓΟΣ ΜΠΑΛΑΤΖΗΣ · 14:42" in coral caps wraps to 3 lines at 390, and "14:42" isn't labelled as a duration.
- **EVIDENCE:** `audit/p2-home-video-logo-placeholder-390-dark.png`
- **WHY THIS IS A PROBLEM:** The site is photography-led, and the one media slot looks unfinished.
- **WHAT MUST BE PRESERVED:**
  - the click-to-load facade (no third-party request before consent)
  - the play affordance
- **ROOT CAUSE:**
  - `index.html:251` uses the hard-coded logo.
  - `home.css:171` sets `opacity: .22`.
  - `scripts/build/fetch-youtube.mjs` already knows the video ID but doesn't write a thumbnail.
- **LIKELY FILES:**
  - `scripts/build/fetch-youtube.mjs`
  - `index.html` (source region)
  - `home.css`
- **EXACT RECOMMENDED CHANGE:**
  - At build time, download `i.ytimg.com/vi/<id>/hqdefault.jpg` into `/images/youtube/<id>.webp`. Self-hosting keeps the page free of third-party requests.
  - Render it at full opacity with the site `saturate(.8)` treatment.
  - Meta line: `Γ. Πουλικίδης · Γ. Μπαλατζής · 14:42 λεπτά`, in `--text-secondary`.
- **ACCEPTANCE CRITERIA:**
  - `.home-video-facade img` `currentSrc` isn't `logo-256`.
  - Computed opacity is 1.
  - Resolution ratio is ≥0.9 at 390@2×.
  - The meta line is ≤2 lines at 390.

### VIS-P2-12: The filtered author view keeps the generic directory header and floats in an unaligned box
- **SURFACE:** `/authors/?author=<slug>`
- **VIEWPORT:** 1440 (also 768)
- **THEME:** both
- **STATE:** filtered
- **OBSERVED:**
  - With one author selected, the h1 still says "Οι φωνές πίσω από το grid.", the folio says "ΠΕΝΤΕ ΦΩΝΕΣ", and the intro still says "Πέντε συντάκτες…".
  - The single profile sits in a centred ~960px block, x=240–1200.
  - Nothing else on the page aligns to that block. The container edge is x=48, and the red rule above the profile spans only 240–1200.
- **EVIDENCE:** `audit/p2-author-filtered-page-generic-1440-light.png`
- **WHY THIS IS A PROBLEM:** The page doesn't acknowledge its own state. The inset block breaks the page's left axis.
- **WHAT MUST BE PRESERVED:**
  - the profile content
  - the portrait with its number badge
  - "← Όλοι οι συντάκτες"
- **ROOT CAUSE:** `scripts/authors.js` filters the cards but doesn't update the intro. The single-profile layout rule in `styles/authors.css` sets a max-width and auto margins.
- **LIKELY FILES:**
  - `scripts/authors.js`
  - `styles/authors.css`
- **EXACT RECOMMENDED CHANGE:**
  - In the filtered state:
    - set the h1 to the author's name with the signal stop;
    - set the folio right label to the author's desk ("ΙΣΤΟΡΙΑ · ΟΔΗΓΟΙ");
    - hide the directory intro paragraph;
    - update `document.title`.
  - Lay the profile out on the container grid (left edge = container edge).
- **ACCEPTANCE CRITERIA:**
  - With `?author=georgios-balatzis`, the `h1` text contains "Μπαλατζής".
  - `.author-profile` left edge = `.authors-intro` left edge (±1px) at 768 and 1440.

### VIS-P2-13: Author "Επιλεγμένα άρθρα" lists the same title twice
- **SURFACE:** `/authors/` (Δημήτρης Κεραμιδιώτης)
- **VIEWPORT:** all
- **THEME:** both
- **STATE:** static
- **OBSERVED:**
  - The featured list shows "Μέσα από το F1λτρο μου" twice. The links are `20260824D` and `20260726D`: two issues of a recurring column with an identical title.
  - The column label above already says "Μέσα από το F1λτρο μου".
- **EVIDENCE:**
  - `audit/p2-authors-duplicate-story-titles-1440-dark.png`
  - `authors/index.html:221`
- **WHY THIS IS A PROBLEM:** It reads as a duplication bug, and the entries can't be told apart.
- **WHAT MUST BE PRESERVED:** 2 featured stories per author
- **ROOT CAUSE:** The featured-story selection takes the latest N by date without de-duplicating titles, and renders the title only.
- **LIKELY FILES:**
  - the build step that writes `authors/index.html` `author-profile__stories`
  - `scripts/authors.js`
- **EXACT RECOMMENDED CHANGE:** For entries whose title equals the column name or another entry, append the date ("· 24 Αυγ") or use the article's dek. Prefer one non-column article when one exists.
- **ACCEPTANCE CRITERIA:** No `.author-profile__stories` contains two links with identical text.

### VIS-P2-14: The quali-gap chart's scale hides the data, and its dots are 10px tap targets
- **SURFACE:** `/standings/?tab=quali-gaps`
- **VIEWPORT:** all; worst at 390
- **THEME:** both
- **STATE:** loaded
- **OBSERVED:**
  - Every pairing uses a fixed **±4.3s** axis, while the pairings' dots fall within about ±0.5s.
  - At 390 each team's ~20 dots pile into a ~40px blob in the centre of a 346px track, as with Ferrari and Mercedes.
  - Each dot is a `<button>` of **10×10px** with a tooltip. The buttons overlap, so the WCAG 2.5.8 spacing exception doesn't apply.
- **EVIDENCE:**
  - `audit/p2-quali-dots-collapsed-scale-390-dark.png`
  - `audit/sweep/metrics.json` → `st-quali-390-*`.`targets` (`10x10 button.quali-dot`)
- **WHY THIS IS A PROBLEM:** The chart can't show the relationship it exists for, the spread of gaps. The per-session values can't be reached on touch.
- **WHAT MUST BE PRESERVED:**
  - the dot-strip idea
  - team colour
  - the H2H counts
- **ROOT CAUSE:** `standings/tabs/quali-gaps.js` takes the axis extent from the global maximum gap across all pairs. The dot size is set in `quali-gaps.css`.
- **LIKELY FILES:**
  - `standings/tabs/quali-gaps.js`
  - `standings/tabs/quali-gaps.css`
- **EXACT RECOMMENDED CHANGE:**
  - Scale each pairing to its own max(|gap|) rounded up to 0.25s, and label the axis ends with that value. Alternatively, clamp the scale at ±1.0s and show outliers as an arrow.
  - Wrap each dot in a transparent 24×24 hit area. Keep the 10px visual dot.
  - On touch, show the per-session values in the "Ανά αγώνα" list instead of tooltips.
- **ACCEPTANCE CRITERIA:**
  - At 390, the horizontal spread of dots in each pairing is ≥40% of the track width, whenever that pairing has ≥2 non-identical gaps.
  - Every `.quali-dot` hit area is ≥24×24.

### VIS-P2-15: Same-team comparisons on track dominance are indistinguishable
- **SURFACE:** `/standings/?tab=track-dominance`
- **VIEWPORT:** all
- **THEME:** both
- **STATE:** default selection (RUS vs ANT, both Mercedes)
- **OBSERVED:**
  - The map trace, the advantage bar and the legend dots use `#27f4d2` against `#05d2b0`.
  - The legend "RUS ahead 90% / ANT ahead 10%" and the map can't be told apart, and the default view is a same-team pair.
- **EVIDENCE:** `audit/p1-trackdom-hover-copy-and-same-team-colours-390-light.png`
- **WHY THIS IS A PROBLEM:** The chart's single question, who is ahead where, can't be answered.
- **WHAT MUST BE PRESERVED:** team colour for cross-team comparisons
- **ROOT CAUSE:** `standings/tabs/track-dominance.js` assigns `--team-color` per driver with no same-team fallback.
- **LIKELY FILES:**
  - `standings/tabs/track-dominance.js`
  - `standings/tabs/track-dominance.css`
- **EXACT RECOMMENDED CHANGE:** When both drivers share `teamKey`, draw driver 2 in `--st-text` (ink or paper) with a dashed trace and a dashed legend swatch, and keep driver 1 in the team colour.
- **ACCEPTANCE CRITERIA:** For a same-team pair, the two driver colours have a contrast ratio of ≥3:1 with each other, and the legend swatches differ in pattern.

### VIS-P2-16: The Ghost Car and Telemetry bridges flash an unstyled English page
- **SURFACE:** `/ghostcar/`, `/f1telemetry/`
- **VIEWPORT:** all
- **THEME:** both (white only)
- **STATE:** during redirect, or when JS or `meta refresh` is blocked
- **OBSERVED:**
  - The page is `lang="en"`, with a default-serif "Redirecting..." h1 and "If you are not redirected automatically, **click here**".
  - It's white on dark-theme visits.
  - The markup still contains the template comment `<!-- Optional: You can add some content here if needed -->`.
  - The `<title>` is "Ghost Car", with no brand.
- **EVIDENCE:**
  - `audit/p2-bridge-ghostcar-unstyled-390.png`
  - `audit/p2-bridge-telemetry-unstyled-390.png`
- **WHY THIS IS A PROBLEM:**
  - A white, English, Times flash between two dark Greek pages.
  - "click here" is non-descriptive link text (WCAG 2.4.4).
- **WHAT MUST BE PRESERVED:**
  - the instant redirect
  - canonical and OG tags
  - `noindex`
- **ROOT CAUSE:** Both bridge files are unstyled boilerplate (`ghostcar/index.html`, `f1telemetry/index.html`).
- **LIKELY FILES:**
  - `ghostcar/index.html`
  - `f1telemetry/index.html`
- **EXACT RECOMMENDED CHANGE:**
  - Set `lang="el"`.
  - Add an inline `<style>` with `background: #1b1a19; color: #eee8db; font-family: "IBM Plex Sans", system-ui`, respecting `theme-init`.
  - Copy: `Μεταφορά στο Ghost Car…` plus a link `Άνοιξε το Ghost Car ↗`.
  - Title: `Ghost Car | F1 Stories`.
  - Remove the template comment.
- **ACCEPTANCE CRITERIA:**
  - With the redirect suppressed:
    - `html[lang="el"]`;
    - body background isn't `rgb(255,255,255)`;
    - no text node contains "click here" or "Redirecting".
  - The title ends in `| F1 Stories`.

---

# P3: Micro-polish

### VIS-P3-01: The home journal has an unexplained 45px column offset and stacked rules
- **SURFACE:** home #latest
- **VIEWPORT:** 768, 1440
- **THEME:** both
- **STATE:** static
- **OBSERVED:**
  - At 1440 the lead image top is y=1243 and the first secondary image top is y=1288, a **45px** offset (also at 768).
  - "Όλα τα άρθρα →" sits between a full-width rule (y≈2067) and its own 1px underline about 61px below.
- **EVIDENCE:** `audit/p2-home-journal-offsets-1440-dark.png`
- **WHY THIS IS A PROBLEM:** The offset is too small to read as a deliberate stagger and too large to read as alignment.
- **WHAT MUST BE PRESERVED:** the 1.35fr / .85fr split
- **ROOT CAUSE:** Secondary column top spacing in `home.css`, around the `.home-secondary-stories` block, plus `.latest-footer-actions`, which is still bordered at ≥768.
- **LIKELY FILES:** `home.css`
- **EXACT RECOMMENDED CHANGE:**
  - Align the first secondary image top to the lead image top (offset 0), or make the offset a deliberate ≥96px stagger.
  - At ≥768, remove the `.latest-footer-actions` top border, as POLISH-03 did for mobile.
- **ACCEPTANCE CRITERIA:**
  - At 1440, |leadImg.top − firstSecImg.top| ≤ 1px (or ≥ 96px if a stagger is chosen).
  - No two horizontal rules within 64px in `#latest`.

### VIS-P3-02: The paddock strip wraps both halves at 320
- **SURFACE:** home paddock strip
- **VIEWPORT:** 320
- **THEME:** both
- **STATE:** static
- **OBSERVED:**
  - "RACE. TALK. REPEAT." breaks to 2 lines, and "ΤΟ GRID ΣΕ ΑΡΙΘΜΟΥΣ" breaks to 2 lines.
  - The ↗ is detached at the far right.
- **EVIDENCE:** `audit/p2-paddock-strip-wrap-320-light.png`
- **WHY THIS IS A PROBLEM:** The band is a signature element and should hold one line each side.
- **WHAT MUST BE PRESERVED:** the band, the slogan and the link
- **ROOT CAUSE:** Fixed slogan size with no ≤359 step in `home.css`.
- **LIKELY FILES:** `home.css`
- **EXACT RECOMMENDED CHANGE:** At ≤359:
  - slogan `font-size: 1.05rem`;
  - link text shortened to "ΑΡΙΘΜΟΙ ↗" via a `<span class="sr-only">`-backed short label, or placed on its own line under the slogan.
- **ACCEPTANCE CRITERIA:** At 320, the slogan is 1 line and the link text plus arrow is 1 line.

### VIS-P3-03: The home cast grid leaves an orphan at 768
- **SURFACE:** home #about
- **VIEWPORT:** 768
- **THEME:** both
- **STATE:** static
- **OBSERVED:** Five people in a 2-column list put #05 alone with an empty right half. The section ends in 135px of empty space.
- **EVIDENCE:** `audit/p2-home-cast-orphan-768-light.png`
- **WHY THIS IS A PROBLEM:** It looks unfinished at the tablet breakpoint.
- **WHAT MUST BE PRESERVED:** the numbered rows, portraits and names
- **ROOT CAUSE:** `home.css` cast grid at 576–991 is `repeat(2,1fr)`.
- **LIKELY FILES:** `home.css`
- **EXACT RECOMMENDED CHANGE:** At 576–991, use a single column (the mobile row pattern), or `grid-column: 1/-1` for the last odd item.
- **ACCEPTANCE CRITERIA:** At 768, no cast grid row has an empty cell.

### VIS-P3-04: Photo corners follow three different rules
- **SURFACE:** archive, article related, home
- **VIEWPORT:** all
- **THEME:** both
- **STATE:** static
- **OBSERVED:**
  - Archive card images have a **4px radius on all corners**, except the lead's cut corner.
  - Home journal images are square except the lead's cut corner.
  - The article's related card #2 has its cut corner at **bottom-left** (40px). KEEP specifies bottom-right.
- **EVIDENCE:**
  - `audit/tour/blog-390-dark-02.png`
  - `audit/tour/article-390-dark-08.png`
  - probe `wrap r=4px`, `0px 0px 0px 40px`
- **WHY THIS IS A PROBLEM:** "Square corners except one large bottom-right cut" is identity, and it's applied inconsistently.
- **WHAT MUST BE PRESERVED:** the single cut corner
- **ROOT CAUSE:**
  - `archive-editorial.css` card image wrapper radius
  - `article-editorial.css` related `:nth-child` cut-corner selector
- **LIKELY FILES:**
  - `blog-module/blog/archive-editorial.css`
  - `blog-module/blog/article-editorial.css`
- **EXACT RECOMMENDED CHANGE:**
  - Archive image wraps: `border-radius: 0`, except the cut-corner card.
  - Related cut corner: `border-bottom-right-radius`, on the card DESIGN names (#3).
- **ACCEPTANCE CRITERIA:** Every card image wrapper computes either `0px` or `0 0 R 0` (bottom-right only).

### VIS-P3-05: Redundant and English chrome copy outside the data hub
- **SURFACE:** home hero; article cover and TOC
- **VIEWPORT:** all
- **THEME:** both
- **STATE:** static
- **OBSERVED:**
  - "SCROLL TO EXPLORE" (English, in the tab order) on the home hero at ≥768.
  - The TOC label "Περιεχόμενα / Contents".
  - The article cover shows the category twice ("ΕΙΔΗΣΕΙΣ" label and "Ειδήσεις" in the meta line), and the folio desk says "ΡΕΠΟΡΤΑΖ".
- **EVIDENCE:**
  - `audit/tour/home-1440-dark-00.png`
  - `audit/tour/article-390-dark-00.png`
  - The TOC label is set at runtime by `blog-module/blog/article-script.js:324`, so it appears on every article with a TOC (e.g. `20250615G`, `20250303G`)
- **WHY THIS IS A PROBLEM:** Greek-first, and three category mentions in one cover.
- **WHAT MUST BE PRESERVED:** the folio and the category link
- **ROOT CAUSE:**
  - `index.html` hero scroll link
  - the TOC label in `blog-module/blog/article-script.js:324`
  - `.article-meta` category item
- **LIKELY FILES:**
  - `index.html`
  - `blog-module/blog/article-script.js`
  - `blog-module/blog/template.html`
- **EXACT RECOMMENDED CHANGE:**
  - "ΣΥΝΕΧΙΣΕ ΠΑΡΑΚΑΤΩ" (or remove it; the fold is obvious).
  - TOC label "Περιεχόμενα".
  - Drop the category from the meta line.
- **ACCEPTANCE CRITERIA:**
  - No text "SCROLL TO EXPLORE" or "/ Contents".
  - The `.article-header` contains the category name once as a link.

### VIS-P3-06: The underlined category in archive cards looks like a separate link
- **SURFACE:** blog archive cards
- **VIEWPORT:** all
- **THEME:** both
- **STATE:** static
- **OBSERVED:** The bottom-right category ("Οδηγοί", "Ιστορία") carries a 1px underline, but it's inside the card's single `<a>`, so it isn't separately clickable.
- **EVIDENCE:** `audit/tour/blog-1440-dark-02.png`
- **WHY THIS IS A PROBLEM:** It promises a category filter link that doesn't exist.
- **WHAT MUST BE PRESERVED:** the category label position
- **ROOT CAUSE:** Underline rule on the category span in `archive-editorial.css`.
- **LIKELY FILES:** `blog-module/blog/archive-editorial.css`
- **EXACT RECOMMENDED CHANGE:** Remove the underline, and show it as a signal-coloured label per VIS-P2-05.
- **ACCEPTANCE CRITERIA:** Non-link text inside `.article-card` has no `border-bottom` or `text-decoration: underline`.

### VIS-P3-07: Footer, byline and cast links are 24px-tall targets
- **SURFACE:** footer (every route); article byline; home cast names; authors links
- **VIEWPORT:** 390
- **THEME:** both
- **STATE:** static
- **OBSERVED:** Measured sizes:
  - "Πολιτική Απορρήτου": 110×24
  - "Όροι Χρήσης": 69×24
  - "Ρυθμίσεις cookies": 98×24
  - `.footer-wordmark`: 103×28
  - cast name links: ~150×24
  - `.authors-directory-back`: 143×19
- **EVIDENCE:** `audit/sweep/metrics.json` → `*-390-*`.`targets`
- **WHY THIS IS A PROBLEM:** KEEP §Components requires 44px minimum targets. These pass WCAG 2.5.8 (24px), but they miss the project's own rule. The 19px back link fails both.
- **WHAT MUST BE PRESERVED:** the visual size of the links
- **ROOT CAUSE:** Inline links with no padding (`styles/editorial.css` footer rules, `styles/authors.css`).
- **LIKELY FILES:**
  - `styles/editorial.css`
  - `styles/authors.css`
  - `home.css`
- **EXACT RECOMMENDED CHANGE:** Add `padding-block: 10px` (or `min-height: 44px; display: inline-flex; align-items: center`) to footer links, legal links and `.authors-directory-back`.
- **ACCEPTANCE CRITERIA:** At 390, every `a`/`button` outside running text is ≥44px tall.

### VIS-P3-08: The archive search focus state is a 1px hue change
- **SURFACE:** blog archive toolbar
- **VIEWPORT:** all
- **THEME:** both
- **STATE:** keyboard focus
- **OBSERVED:**
  - `.blog-search-input:focus-visible { outline: none }` removes the focus outline.
  - The only cue is the shell border moving from `#b8b1a6` to `#ff9a89` (dark), plus a 2px ring at 15% alpha.
  - Every other control on the page gets a 2px outline with 3–5px offset.
- **EVIDENCE:**
  - `audit/p2-search-focus-weak-1440-dark.png` against `audit/states/search-unfocused-1440-dark.png`
- **WHY THIS IS A PROBLEM:** It's the weakest focus indicator on the site, and it uses a shadow in a no-shadow system (DESIGN §4 B3).
- **WHAT MUST BE PRESERVED:** the boxed search shell
- **ROOT CAUSE:** `blog-module/blog/archive-editorial.css:126-127` and the shell `:focus-within` rule.
- **LIKELY FILES:** `blog-module/blog/archive-editorial.css`
- **EXACT RECOMMENDED CHANGE:** `.blog-search-shell:focus-within { outline: 2px solid var(--accent); outline-offset: 3px; box-shadow: none }`
- **ACCEPTANCE CRITERIA:**
  - When the input is focused via keyboard, the shell computes `outline-width: 2px`.
  - `box-shadow: none`.

### VIS-P3-09: The home cover h1 is smaller at 1024 than at 768
- **SURFACE:** home hero
- **VIEWPORT:** 768 / 1024
- **THEME:** both
- **STATE:** static
- **OBSERVED:** The h1 is **46.1px at 768** (single column) and **44.0px at 1024** (in a 464px column, 4 lines).
- **EVIDENCE:** probe `{"w":1024,"h1fs":"44.032px"}` against `{"w":768,"h1fs":"46.08px"}`
- **WHY THIS IS A PROBLEM:** The type scale shrinks as the viewport grows.
- **WHAT MUST BE PRESERVED:** the tablet recomposition (RESP-01)
- **ROOT CAUSE:** `home.css:314` (≤991, `clamp(2.5rem,6vw,3.4rem)`) against `home.css:67` (`4.3vw`) above 991.
- **LIKELY FILES:** `home.css`
- **EXACT RECOMMENDED CHANGE:** Raise the base clamp floor so 992px yields ≥46px (e.g. `clamp(2.9rem,4.3vw,4.5rem)`), or make the ≤991 clamp top out at 2.75rem.
- **ACCEPTANCE CRITERIA:** Hero h1 font-size is non-decreasing across 320, 390, 768, 1024, 1440 and 1920.

---

## Observations not filed as tasks

These are subjective, or outside this repo.
- **The archive grid below the curated spread is a uniform 3-up card grid for all 30 pages.** It's allowed by DESIGN (unboxed cards), but it's the most "templated" stretch of the site. No concrete acceptance criterion can be set without a redesign decision.
- **The external targets of the bridges** (`georgiosbalatzis.github.io/ghostcar`, `/f1-telemetry-dashboard`) aren't in this repo:
  - Telemetry is entirely English.
  - Ghost Car opens with a 7-step onboarding modal over the controls, uses 36px buttons and 9–11px labels, and shows "Γκραν Πρι" as a select placeholder.
  - Telemetry shows "Loading session…" and "No telemetry data" at the same time.
  - Evidence: `audit/sweep/ghostcar-390-dark--fold.png`, `audit/sweep/telemetry-390-dark--fold.png`.
- **Article content** (emoji in titles, "Mercedes , ο") is already handled by POLISH-04's warnings and isn't re-filed.

## Summary

| Priority | Count | IDs |
|---|---|---|
| P0 | 3 | VIS-P0-01 … 03 |
| P1 | 7 | VIS-P1-01 … 07 (plus POLISH-01 carried) |
| P2 | 16 | VIS-P2-01 … 16 |
| P3 | 9 | VIS-P3-01 … 09 |
