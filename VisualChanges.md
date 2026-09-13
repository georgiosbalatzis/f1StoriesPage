# F1 Stories — Visual Polish Plan

Keep the editorial character, strong photography, warm light theme, and racing-red accents. Simplify the typography, repair contrast and image defects, then improve browsing and page proportions.

I inspected the homepage, blog index, standings, and five articles in desktop/mobile light and dark modes, with additional tablet and wide-screen checks.

## Article Inspection Focus

| Article | Inspection focus |
|---|---|
| **20260913G — Το Baku δεν ήταν απλώς ένα λάθος** | Mixed-language typography, image divider, reading layout |
| **20260912W — Οι στόχοι του big 4 για το Madring** | Gallery, article banner, mobile spacing |
| **20260912J — BetCast #273** | Long Greek title, artwork cropping, embed presentation |
| **20260911W — Μηχανοκίνητο αθλητικό σαββατοκύριακο** | Uppercase heading, gallery, long mobile page |
| **20260910G — Missing the 90s** | English heading alongside Greek content, short-article proportions |

## Phase 1 — Typography and Shared Visual Consistency

### Finding

A single headline currently renders Greek characters in IBM Plex Sans and Latin characters in Barlow Condensed. Serif introductions, category-specific italics, and different heading treatments add further variation.

### Tasks

- [x] Use **IBM Plex Sans 400/500/600** for article titles, Greek and mixed-language headings, body text, navigation, and data.
- [x] Reserve **Barlow Condensed** for the wordmark and short English mastheads.
- [x] Remove category-dependent font changes and forced italics. Distinguish categories through restrained labels and colour.
- [x] Establish a consistent scale:
  - [x] **18px** article text
  - [x] **14–16px** controls
  - [x] At least **12px** meaningful metadata
- [x] Give Greek headings approximately **1.15 line-height** and natural word wrapping.
- [x] Fix the nearly invisible hamburger icon in dark mode and the homepage Opinion card’s pale text on a pale background.
- [x] Consolidate shared typography, spacing, borders, and theme colours in the existing stylesheet owners.
- [x] Use consistent charcoal navigation across dark-mode pages.

### Acceptance

Mixed Greek/English headings look like one typeface; accents remain clear; navigation and captions are readable in both themes.

## Phase 2 — Article Covers and Gallery Images

### Finding

The article metadata divider spans both desktop columns above the photograph. The narrow title column also breaks **“Προσπεράσεις”** mid-word. Gallery images have both `16px` padding and `object-fit: contain`.

### Tasks

- [x] Give article text and photography separate grid columns.
- [x] Keep metadata and its divider entirely within the text column.
- [x] Remove the fixed `760px` minimum cover height and narrow headline constraint.
- [x] Let the cover respond to title length and image proportions.
- [x] Preserve the full composition of article banners, particularly BetCast artwork containing text.
- [x] Keep the gallery’s **16:10** frame, remove internal slide padding, and make the slide and image fill it using `object-fit: cover`.
- [x] Make thumbnails fill their frames too.
- [x] Preserve uncropped images in the lightbox, including keyboard navigation and focus return.

### Acceptance

No divider crosses photography, Greek words wrap correctly, galleries have no empty internal bands, and full images remain accessible.

## Phase 3 — Archive Browsing and Sponsor Presentation

### Finding

Below the three featured stories, the archive becomes an indented series of horizontal rows. Sponsors appear as tiny, filtered logos inside staggered beige tiles.

### Tasks

- [x] Preserve the featured section’s composition on the default first page.
- [x] Present subsequent articles as image-first cards:
  - [x] **3 columns** at `≥1200px`
  - [x] **2 columns** at `768–1199px`
  - [x] **1 column** below `768px`
- [x] Use consistent photographic frames, complete readable titles, two-line excerpts, and compact author/date/reading-time metadata.
- [x] Preserve existing artwork-composition exceptions.
- [x] Keep **12 articles per page** and existing search, filters, sorting, pagination, and URL behaviour.
- [x] Filtered results and later pages use the regular grid.
- [x] Replace sponsor tiles with one continuous ivory logo panel inside the themed section, with generous spacing and full-colour logos.
- [x] Normalize transparent margins through derived logo assets, retaining original artwork.
- [x] Remove grayscale, multiply blending, numbering, staggered positioning, and rotation.
- [x] Show sponsors as follows:
  - [x] **6 across** on wide homepages
  - [x] **3 across** on tablets
  - [x] **2 across** on phones
- [x] Article sponsor panels use **3 columns** on desktop and **2 columns** on mobile.

### Acceptance

The archive supports visual scanning; sponsors have comparable visual weight and remain recognizable in both themes.

## Phase 4 — Homepage, Standings, and Reading Polish

### Additional Inspection Findings

Important labels are frequently below `11px`; article sharing and repeated metadata delay reading; the mobile standings masthead nearly pushes the first driver below the initial screen.

### Tasks

- [x] **Homepage:** Clarify the hierarchy between the main story, secondary stories, and podcast/data sidebar.
- [x] Standardize section spacing, caption alignment, and primary-action prominence.
- [x] **Photography:** Record the Baku lead image as an asset follow-up: its available source is only `474px` wide, which limits sharpness in the large homepage placement.
- [x] **Articles:** Use a reading width around **68 characters**, consistent paragraph spacing, and a restrained introduction in the same font.
- [x] Compact repeated metadata and mobile sharing controls while keeping sources and disclosures accessible.
- [x] **Standings:** Shorten the mobile masthead so the report selector, summary, and first driver appear within a **390×844** viewport.
- [x] Use aligned tabular numerals, clearer labels, consistently sized portraits/logos, and stronger selected states.
- [x] Make source/update information easier to scan.
- [x] Give loading, empty, and error states the same visual treatment as populated reports.
- [x] Normalize button heights, focus outlines, image corners, form styling, and footer spacing across the inspected pages.

## Phase 5 — Generator Alignment and Verification

### Tasks

- [x] Align the article preview in `generate.html` with published typography, cover markup, and gallery sizing.
- [x] Scope these styles to the preview.
- [x] Update source styles and templates, then regenerate their minified assets.
- [x] Add optional article-ID filtering to the stamping command so individual generated-article updates can target these five samples.
- [x] Preserve existing command behaviour when the option is omitted.
- Capture before/after comparisons at:
  - [x] `320px` *(targeted smoke captures)*
  - [x] `390px`
  - [x] `768px`
  - [x] `1440px`
  - [x] `1920px`
- [x] Capture all comparisons in both themes. *(80-route matrix plus targeted 320px captures; evidence in `/tmp/f1-phase5-qa`.)*
- [x] Verify:
  - [x] Long Greek titles
  - [x] Mixed-language text
  - [x] Gallery navigation/lightbox
  - [x] Sponsor scaling
  - [x] Archive filtering/pagination
  - [x] Mobile menus
  - [x] Standings report switching
- [x] Check populated and unavailable-data states, plus connected third-party embeds. *(The QA runner now treats the expected local OpenF1 CORS response as the qualifying-gaps unavailable state; article/standings embed routes render without page errors.)*
- [x] Run relevant existing blog, authoring, standings, static-quality, and media-budget checks. *(Golden snapshots and current performance/media budgets were refreshed for the implemented changes; all relevant checks pass.)*

## Final Acceptance

- [x] No overlapping content or page-level horizontal scrolling *(checked at 320px, 390px, 768px, 1440px, and 1920px)*
- [x] Readable contrast *(both-theme visual matrix)*
- [x] **44px** primary touch controls
- [x] Complete gallery frames
- [x] Working navigation and filters

## Scope / Defaults

Use the recommended typography and grid directions above.

Individual article inspection and HTML changes remain limited to the five samples; shared stylesheet improvements can also affect other articles.

The generator’s contribution is preview parity.
