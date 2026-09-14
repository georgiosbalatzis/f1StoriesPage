# Visual Audit

## Executive Summary

The main site has a recognizable, coherent editorial identity: warm charcoal and paper surfaces, coral accents, strong mastheads, fine separators, and restrained card treatments. The homepage, archive, articles, authors, and standings generally belong to the same visual family. Mobile layouts have deliberate adaptations, including compact story rows, a navigation menu, archive filters, and a native report selector.

The most useful next work is repairing a few shared presentation defects. The floating back-to-top button overlaps reading content and controls; the cookie panel is missing some foundational layout styles; and the legal pages render a visibly different, partially unstyled masthead. Smaller issues concern article numbering, the homepage byline, inherited legal-section spacing, and unusually small author-card text. A second inspection also established an incorrectly aligned Tyre Pace chart scale, a homepage headline that grows at narrower breakpoints, and an exceptionally long paragraph in the current lead article. A redesign is unnecessary.

This consolidated backlog contains **19 tasks: 5 P1, 9 P2, and 5 P3**. No P0 issue was established. Tasks are scoped for GPT-5.6 Luna at LOW reasoning. Application files were not changed, builds were not run, and no form, comment, share, or external communication was submitted.

### Inspection scope and evidence

**Evidence provenance:** UI-001–UI-014 and their earlier evidence were already present in this report when it was updated during the current workspace session; they have been preserved. The additional independent pass served the unchanged repository at `http://127.0.0.1:4187/` using `PREVIEW_PORT=4187 node scripts/serve-site.mjs`, inspected the lead article `/blog-module/blog-entries/20260913W/article.html` as well as the templates below, and added UI-015–UI-019. Its screenshots are under `/tmp/f1-visual-audit-20260913/`. Common findings concerning the cookie header, footer overlap, mobile byline, legal shell/spacing, and author cards were corroborated rather than duplicated. The embed-code button was exercised locally and copied code; nothing was published or sent. Application files were not edited.

The requested four widths were exercised, with 320px used for the homepage/consent panel. Retained screenshots represent selected visual states; intermediate-width checks on several routes were rendered geometry checks, not a complete visual review of every page × width × theme combination. Both themes were sampled, including the Tyre Pace chart in dark desktop and light laptop layouts. The report should not be read as exhaustive device/browser certification.


- Inspected the checked-in static site at `http://127.0.0.1:4179/`, served directly with `PREVIEW_PORT=4179 node scripts/serve-site.mjs`. Running `npm run preview` would regenerate assets, so it was deliberately avoided.
- Browser inspection used Chrome through the chrome-devtools CLI in an isolated browser context. The existing browser tab was left alone.
- Main viewport sizes were **1440×1000, 1024×900, 768×1000, and 390×844**. A targeted **320×740** homepage geometry check confirmed the mobile byline problem without document-level horizontal overflow.
- Both themes were sampled across the principal templates. Screenshots cover selected top, body, footer, and interaction states; this was not an exhaustive page × viewport × theme permutation test.
- Legal and 404 pages received desktop/mobile visual inspection and intermediate-width rendered-layout checks. These intermediate checks were geometry checks, not complete screenshot reviews.
- Images and sections that were blank only in full-page captures were revisited at their actual scroll positions. Lazy images, YouTube, and homepage contact content subsequently rendered; those capture artifacts are **not** backlog defects.
- Standings initially displayed its bundled snapshot, then refreshed from the external source. Changing scores and replaced DOM rows during that refresh were not treated as visual bugs. Not every analytics tab was audited.
- Screenshots are temporary local evidence under `/tmp/f1-visual-audit/`. They are not committed repository assets and may expire. Each task describes the observation and reproduction independently of its screenshot.

| Representative type | Route inspected | Main observations/states |
| --- | --- | --- |
| Homepage | `/` | Hero, story feed, embedded episode, sponsors, team, contact, footer; mobile menu; theme toggle; cookie settings |
| Archive/search | `/blog-module/blog/index.html` | Masthead, lead/secondary cards, search, expanded mobile filters, empty results, pagination region |
| Long-form article with tables | `/blog-module/blog-entries/20250725G/article.html` | Long title, hero, reading column, rail, section headings, tables, author/sponsors, comments region |
| Author directory/profile | `/authors/` and `/authors/?author=georgios-balatzis` | Directory cards, focused profile, back link, desktop/mobile hierarchy, footer |
| Data dashboard | `/standings/` and `/standings/?tab=tyre-pace` | Snapshot/refresh, driver rows, chart, responsive report selector, analytics controls, footer |
| Legal document | `/privacy/privacy.html` | Header, document hierarchy, contents navigation, section spacing, themes; terms shares the relevant styles |
| Error page | `/404.html` | Standalone recovery layout and links; desktop/mobile composition |

The redirect bridges `/ghostcar/` and `/f1telemetry/` lead to separate applications and were not followed as additional site templates. Authoring utilities such as `generate.html`, `housekeeping.html`, and `statistics.html` were outside this public-site visual pass. The 404 design was opened directly because the local preview server returns plain text for an unknown path.

## Design System Observations

- **Framework/build:** static HTML and vanilla JavaScript, with a Node publishing pipeline and a slim Bootstrap dependency on several routes. No SPA router. `scripts/build/include.mjs` handles HTML includes; `scripts/build/stamp-html.mjs` stamps assets and updates article shells; `blog-module/build/` generates article content and indexes.
- **Shared identity:** `styles/editorial.css` defines warm dark surfaces around `#1b1a19`, `#242321`, and `#2e2c29`; light surfaces around `#f2eee4`, `#e9e3d6`, and `#dfd9ca`; coral/red accents, with darker red for light-theme readability. Archive/article tokens have slightly different muted colors. These differences look intentional.
- **Typography:** IBM Plex Sans handles the editorial body and Greek headings. Barlow Condensed supplies the Latin wordmark and display treatments such as JOURNAL, THE GRID, and ON AIR. Kicker text is uppercase, small, and letter-spaced. Long-form reading text is substantially larger than metadata.
- **Spacing/grid:** editorial containers use up to 1476px width, with approximately 48px desktop, 32px intermediate, and 22px mobile gutters. The homepage combines a lead story, secondary stories, and a narrow utility column. Articles use a narrower reading column and a separate rail.
- **Borders/radii/shadows:** thin dividers and mostly flat surfaces dominate. Buttons are nearly square. Some images and cards intentionally have a large bottom-right corner. The staggered author cards and asymmetrical archive lead layout appear deliberate, so no task proposes removing them.
- **Responsive behavior:** the main navigation collapses before tablet-sized layouts; homepage stories become compact mobile rows; author cards rearrange their portrait and text; dashboard tabs become a native selector. Article tables intentionally scroll horizontally rather than squeezing every column into the viewport.
- **Theme implementation:** `scripts/theme-init.js` applies a stored/preferred theme before paint; `scripts/shared-nav.js` toggles `data-theme="light"`. Dark is represented by the absence of that attribute. The legal pages still use the older `styles/fonts.css`/`theme-overrides.css` presentation instead of the editorial shell.
- **Shared components:** navigation is styled by `styles/shared-nav.css` plus editorial overrides; footer markup comes from `partials/footer.html`; consent behavior comes from `scripts/cookie-consent.js`. Homepage, archive, article, and authors each have additional route styles.

The latest lead photograph is visibly soft when enlarged: the current homepage image is a 474×316 source displayed substantially larger on desktop. Only that small source was identified for this entry. This is a content-asset limitation, not a request to upscale, synthesize, or replace editorial imagery. A sharper original would be needed before a reliable asset replacement task could be specified.

## Top Issues

1. **UI-015:** Tyre Pace uses different vertical coordinate areas for the data and its axis/grid, so the chart is visually misleading.
2. **UI-001:** the back-to-top button covers content and footer controls.
3. **UI-016:** the homepage headline grows when the viewport shrinks below 1200px, creating excessive wrapping and empty space beside it.
4. **UI-002:** the cookie panel lacks foundational control layout/reset rules.
5. **UI-003:** legal pages have a partially unstyled wordmark and an older visual shell.
6. **UI-004 / UI-005:** article margin numbering clips at narrower widths and duplicates authored numbering.
7. **UI-006:** the mobile homepage byline is auto-placed flush beneath the CTA.
8. **UI-017:** the current lead article contains a 4,475-character paragraph, nearly two desktop viewports tall.
9. **UI-010 / UI-011:** author cards expose a hidden return link and use unusually small desktop supporting text.
10. **UI-012:** global landing-section padding inflates gaps inside legal documents.

## Backlog

### Implementation conventions for every task

Use the unminified source files listed below. Do not hand-edit only a `.min.css`, `.min.js`, or one generated article. The future implementation pass should regenerate the affected output with the repository's existing asset/article pipeline and inspect that generated output in the browser. No regeneration was performed during this audit.

Each task is independently scoped unless its dependency field says otherwise. Preserve copy, article URLs, author identity, data calculations, analytics/consent behavior, and the existing design unless a task explicitly identifies a presentation change. Test both themes at the listed widths. Browser acceptance checks are more useful here than tests that merely assert CSS declarations.

### P0

None established.

### P1

#### UI-001 — Keep the floating back-to-top button clear of content and controls

- **PRIORITY:** P1
- **TYPE:** Bug
- **OBSERVED:** The bottom-left floating button sits over the privacy link on desktop footers, over article text at laptop/mobile widths, and over the left end of the mobile contact submit button.
- **LOCATION:** `/` contact/footer; article reading column; `/standings/` footer. Observed at 1440, 1024, 768, and 390px.
- **EVIDENCE:** [Desktop footer](</tmp/f1-visual-audit/03-home-bottom.png>), [mobile contact](</tmp/f1-visual-audit/06-home-mobile-full.png>), [article text](</tmp/f1-visual-audit/14-article-laptop-body-dark.png>), [standings footer](</tmp/f1-visual-audit/25-standings-tablet-chart-light.png>). Despite its filename, image 06 is the corrected viewport capture of the mobile contact form.
- **ROOT CAUSE:** `.scroll-to-top-btn` is fixed to the left edge with high-priority positioning rules. Visibility depends on scroll depth, without protecting narrow reading gutters or footer content.
- **FILES LIKELY INVOLVED:** `styles/shared-nav.css`, `styles/editorial.css`, `scripts/shared-nav.js`.
- **CHANGE:** Suppress the floating button at widths <=1199px, where the page gutter cannot accommodate its full width. At larger widths, suppress it while the footer intersects the viewport. Use the existing button and scroll handler; add footer intersection tracking if needed. Ensure the editorial `.visible` rule cannot override the suppressed state. A suppressed button must also be absent from keyboard navigation.
- **DO NOT CHANGE:** Button click behavior, article reading progress, main navigation positioning, or page gutters. Do not add another floating control.
- **ACCEPTANCE CRITERIA:** At 390/768/1024px the button does not overlay the page and is not focusable. At 1440px it remains available when scrolled in normal content, disappears when the footer enters view, and returns when scrolling away from the footer.
- **TEST VIEWPORTS:** 1440, 1024, 768, 390.
- **DEPENDENCIES:** None.
- **EFFORT:** S.

#### UI-002 — Restore the cookie panel's foundational control layout

- **PRIORITY:** P1
- **TYPE:** Consistency
- **OBSERVED:** The close button is a gray browser-style box below the COOKIES heading. Desktop policy links run together. In expanded mobile settings, the close button occupies its own row and the action buttons are only about 34px high.
- **LOCATION:** `/`, fresh consent panel and footer → cookie settings; desktop and mobile.
- **EVIDENCE:** [Initial panel](</tmp/f1-visual-audit/01-home-desktop-dark.png>), [expanded mobile panel](</tmp/f1-visual-audit/32-cookie-settings-mobile.png>). Computed `.cookie-header` display was `block`; desktop footer spacing rules specify a gap without establishing flex/grid layout.
- **ROOT CAUSE:** Base flex/reset declarations exist in `styles/critical-common.css`, but the inspected homepage does not load that critical block. `styles.css` contains subsequent refinements that assume those base declarations exist.
- **FILES LIKELY INVOLVED:** `styles.css`, `styles/critical-common.css`; `index.html` for reference to the existing markup.
- **CHANGE:** Put the necessary standalone rules in `styles.css`: make `.cookie-header` flex with aligned center items and space-between; remove the heading margin; give `.cookie-header .close-btn` a transparent background, explicit border reset, inherited theme color, centered icon, and a 44×44px target. Establish flex/wrap layout on `.cookie-actions` and desktop `.cookie-footer` so their existing gaps work. Make mobile consent action targets at least 44px tall. Keep the current panel's internal scrolling when settings exceed the available height. Keep equivalent critical rules consistent where still used.
- **DO NOT CHANGE:** Consent defaults, copy, button meanings, show timing, analytics storage, or which choices are available in collapsed/expanded settings. Do not reintroduce the entire retired critical stylesheet to fix this component.
- **ACCEPTANCE CRITERIA:** Heading and close control share one row; no native gray close-button box remains; desktop legal links have distinct spacing; all expanded mobile actions are reachable and at least 44px tall; there is no viewport overflow at 320px.
- **TEST VIEWPORTS:** 1440, 768, 390, 320; collapsed and expanded settings.
- **DEPENDENCIES:** None.
- **EFFORT:** S.

#### UI-003 — Apply the existing editorial shell to the legal-page template

- **PRIORITY:** P1
- **TYPE:** Consistency
- **OBSERVED:** Privacy displays `F1 STORIES.` as a blue underlined link; its logo and wordmark stack on desktop. Its white/blue light theme and older fonts differ conspicuously from the paper/coral editorial pages reached through the same footer.
- **LOCATION:** `/privacy/privacy.html`, 1440 and 390px. `/privacy/terms.html` shares the relevant legal styles and shell pattern.
- **EVIDENCE:** [Legal mobile](</tmp/f1-visual-audit/28-legal-mobile-light.png>), [legal desktop](</tmp/f1-visual-audit/29-legal-desktop-dark.png>); compare the mastheads in images 07 and 13.
- **ROOT CAUSE:** Legal HTML uses the editorial wordmark markup without the editorial body class, font sheet, and shared editorial stylesheet. `styles/legal.css` also hardcodes the older font families and light-surface colors.
- **FILES LIKELY INVOLVED:** `privacy/privacy.html`, `privacy/terms.html`, `styles/legal.css`. References: `styles/editorial.css`, `styles/home-fonts.css`, `blog-module/blog/index.html` stylesheet ordering.
- **CHANGE:** Add the existing `editorial-page` body class and load the existing home-fonts/editorial styles in both legal documents, preserving their legal stylesheet after the shared identity styles. Match the archive's shared stylesheet ordering; remove reliance on the legacy theme override where it conflicts with these pages. Set legal body/title/section-heading font families to the existing editorial font variables. Replace the legal-only hardcoded light card/note/table/highlight colors with the corresponding existing surface/border/accent tokens. Retain the current legal document structure and dimensions.
- **DO NOT CHANGE:** Legal wording, links, section IDs, table contents, metadata, centered legal hero, document width, or consent behavior. Do not invent a new legal-page layout or global token palette.
- **ACCEPTANCE CRITERIA:** Logo and wordmark align horizontally at 1440/1024px; the wordmark is not blue or underlined; mobile menu and theme button match other editorial pages; both themes use the existing site fonts and palette; legal headings still retain their compact document hierarchy.
- **TEST VIEWPORTS:** 1440, 1024, 768, 390 on both privacy and terms.
- **DEPENDENCIES:** None.
- **EFFORT:** M.

#### UI-015 — Align Tyre Pace axis ticks and grid lines with the plotted lap times

- **PRIORITY:** P1
- **TYPE:** Bug
- **OBSERVED:** Horizontal grid lines and time labels extend down through the driver names, below the actual plot. The bottom of each violin is visibly above the corresponding minimum-time region on the axis; endpoint labels are also clipped. This affects interpretation of the chart, not just its appearance.
- **LOCATION:** `/standings/?tab=tyre-pace`, settled Madring race report, 1440px dark and 1024px light. During inspection the selected session was `tyreSession=11369`.
- **EVIDENCE:** [Dark desktop chart](</tmp/f1-visual-audit-20260913/22-tyre-desktop-chart.png>), [light laptop chart and local copy feedback](</tmp/f1-visual-audit-20260913/31-dashboard-embed-laptop.png>). At 1024px the axis/chart-body were 348px tall but `.tyre-pace-plot` was 286px tall: a 62px mismatch before SVG padding is considered.
- **ROOT CAUSE:** `renderTyrePaceTable` positions ticks/grid lines as percentages of the full chart body. CSS removes 62px from each plot for driver labels (58px on mobile). `buildTyrePaceSvg` additionally maps times into a 252-unit viewBox with 8-unit top/bottom padding. The scales therefore do not describe the same rectangle.
- **FILES LIKELY INVOLVED:** `standings/tabs/tyre-pace.js`, `standings/tabs/tyre-pace.css`.
- **CHANGE:** Introduce one local CSS custom property for the existing driver-label reserve: 62px desktop, 58px mobile. Give the axis tick layer and a dedicated grid-line layer the same top and bottom bounds as `.tyre-pace-plot`; keep names/codes/best-time labels outside those layers. Use the SVG's existing normalized mapping for axis/grid positions: `topFraction = (8 + ((maxTime - value) / range) * 236) / 252`, with the same `range` used by `timeToY`. Position tick labels and grid lines at that fraction of the plot layer, centering tick labels vertically. Keep sufficient outer padding for endpoint text instead of clipping it with `.tyre-pace-chart-scroll`. Share constants locally where practical so the SVG and HTML mapping cannot drift.
- **DO NOT CHANGE:** Lap filtering, session selection, time units, driver ordering, compound/team colors, violin distribution calculations, horizontal scrolling, or the intentional small swarm jitter.
- **ACCEPTANCE CRITERIA:** Grid lines and axis labels stop in the plotting area rather than crossing driver metadata. A lap at a given tick value lands on that line within the existing swarm jitter. Lowest/highest tick text is fully visible. Resizing between mobile and desktop retains alignment and keeps all drivers reachable by horizontal scrolling.
- **TEST VIEWPORTS:** 1440, 1024, 768, 390; both themes, default session and one second session.
- **DEPENDENCIES:** None.
- **EFFORT:** M.

#### UI-016 — Remove the intermediate-width increase in homepage headline size

- **PRIORITY:** P1
- **TYPE:** Bug
- **OBSERVED:** The current headline is larger and wraps into more lines on a 1024px laptop than on a 1440px desktop. The text column becomes much taller than the photograph, leaving a large unused area below the image and pushing the journal farther down.
- **LOCATION:** `/`, hero, 1024px; the same override also applies at tablet widths above the mobile layout.
- **EVIDENCE:** [1440px hero](</tmp/f1-visual-audit-20260913/01-home-desktop-initial.png>), [1024px full-page capture](</tmp/f1-visual-audit-20260913/04-home-laptop-light.png>). Despite its filename, image 04 is dark theme. Only its already-rendered hero is evidence; blank lower sections in that capture were animation artifacts.
- **ROOT CAUSE:** The base `h1` uses `clamp(2.5rem, 4.3vw, 4.5rem)`, but the <=1199px rule replaces it with `clamp(3.25rem, 7vw, 5.5rem)` and <=991px replaces it with another 7vw rule. This changes approximately 61.9px at 1440px to 71.7px at 1024px.
- **FILES LIKELY INVOLVED:** `home.css`.
- **CHANGE:** Remove the `.home-page .hero-content h1` font-size overrides inside the <=1199px and <=991px media blocks. Let the existing base clamp govern widths 768–1599px. Keep the existing <=767px mobile title override and >=1600px override. Do not compensate by changing the image or column widths.
- **DO NOT CHANGE:** Headline wording, hero grid proportions, CTA placement, photo aspect ratio/crop, or typography elsewhere.
- **ACCEPTANCE CRITERIA:** At the default root size, the headline is approximately 44px at 1024px and 40px at 768px. Shrinking from 1200 to 1199px produces no upward font-size jump. The current title wraps into fewer laptop lines, and the 1440/390px compositions retain their current type size.
- **TEST VIEWPORTS:** 1440, 1200, 1199, 1024, 991, 768, 390.
- **DEPENDENCIES:** None. UI-007 changes excerpt measure independently; verify the final hero after both.
- **EFFORT:** XS.

### P2

#### UI-004 — Hide article margin counters when the reading gutter is too narrow

- **PRIORITY:** P2
- **TYPE:** Bug
- **OBSERVED:** At 1024px the small decorative `01` beside the first section starts against/beyond the left viewport edge while the heading starts at the normal 32px gutter.
- **LOCATION:** `/blog-module/blog-entries/20250725G/article.html`, first body heading, 1024px.
- **EVIDENCE:** [Laptop reading column](</tmp/f1-visual-audit/14-article-laptop-body-dark.png>).
- **ROOT CAUSE:** `.article-content h2::before` and direct-child `h1::before` position counters at `right: calc(100% + 18px)` without reserving gutter space at narrower widths.
- **FILES LIKELY INVOLVED:** `blog-module/blog/article-editorial.css`.
- **CHANGE:** At <=1199px, set `content: none` on `.article-page .article-content h2::before` and `.article-page .article-content > h1::before`. Preserve the normal heading text and the desktop counters where a wide reading gutter exists.
- **DO NOT CHANGE:** Article text, heading IDs, table-of-contents links, reading-column width, or h3's short vertical accent rule.
- **ACCEPTANCE CRITERIA:** No partial counter appears at the left edge at 1024/768/390px. At 1440px counters for eligible headings remain inside the available margin and clear of the text.
- **TEST VIEWPORTS:** 1440, 1024, 768, 390.
- **DEPENDENCIES:** None.
- **EFFORT:** XS.

#### UI-005 — Suppress decorative counters on headings that already contain a number

- **PRIORITY:** P2
- **TYPE:** Consistency
- **OBSERVED:** The first section contains authored text `0. Σύνοψη σε 3 λεπτά` while the stylesheet adds `01` beside it. Later headings repeat the two numbering systems.
- **LOCATION:** The same long-form article, body headings; a template issue for pre-numbered articles.
- **EVIDENCE:** [Two numbering systems](</tmp/f1-visual-audit/14-article-laptop-body-dark.png>); the rendered heading text starts with `0.` and its pseudo-element uses `counter(editorial-section, decimal-leading-zero)`.
- **ROOT CAUSE:** The article stylesheet automatically numbers every eligible heading without distinguishing authored numbering.
- **FILES LIKELY INVOLVED:** `blog-module/blog/article-script.js`, `blog-module/blog/article-editorial.css`.
- **CHANGE:** During the existing article initialization, inspect only `.article-content h2` and `.article-content > h1`. Add `has-authored-section-number` when trimmed text begins with a numeric prefix followed by `.` or `)` and whitespace, using a pattern such as `^\d+[.)]\s`. Set that class's `::before` content to `none`. Keep the operation idempotent. This runtime approach also covers already-generated archived articles.
- **DO NOT CHANGE:** Authored text, its numbering, heading IDs, TOC labels, or decorative numbering on unnumbered headings.
- **ACCEPTANCE CRITERIA:** The sample's `0.`, `1.`, etc. appear once, with no competing margin number. An unnumbered heading still receives the existing decorative treatment on wide desktop. Reloading does not duplicate classes or modify heading text.
- **TEST VIEWPORTS:** 1440 and 1024; one numbered and one unnumbered heading.
- **DEPENDENCIES:** None; compatible with UI-004.
- **EFFORT:** S.

#### UI-006 — Give the homepage mobile byline an explicit grid position and gap

- **PRIORITY:** P2
- **TYPE:** Bug
- **OBSERVED:** On mobile the byline appears immediately below the CTA row, visually attached to the button's bottom edge. It is separated from the excerpt differently than on desktop.
- **LOCATION:** `/`, hero, 390px; confirmed at 320px.
- **EVIDENCE:** [Mobile hero behind the open menu](</tmp/f1-visual-audit/07-mobile-menu-light.png>). At 320px, the CTA bottom and byline top both measured 686.30px: zero gap.
- **ROOT CAUSE:** Mobile `.hero-content` uses `display: contents`, but `.hero-shell` declares no named area for `.hero-story-byline`. The byline is auto-placed after the explicit areas.
- **FILES LIKELY INVOLVED:** `home.css`.
- **CHANGE:** In the <=767px hero rules, add a `byline` grid area between `description` and `actions`; assign `.hero-story-byline` to it. Use `margin: 0 0 16px` for that byline at this breakpoint. Keep the existing title, subtitle, photograph, and description order.
- **DO NOT CHANGE:** Desktop hero layout, byline content, CTA labels/destinations, image crop, or the narrow-screen rule that can hide the excerpt.
- **ACCEPTANCE CRITERIA:** At 390/320px the byline has its own row above the CTA with 16px space below it; neither CTA is displaced outside the viewport; desktop placement remains unchanged.
- **TEST VIEWPORTS:** 1440, 768, 390, 320.
- **DEPENDENCIES:** None.
- **EFFORT:** XS.

#### UI-007 — Widen the desktop homepage hero excerpt within its existing column

- **PRIORITY:** P2
- **TYPE:** Polish
- **OBSERVED:** The hero excerpt forms a narrow stack beneath a much wider title/subtitle, leaving unused space within the text column. This adds short lines and unnecessary height at laptop/tablet widths.
- **LOCATION:** `/`, hero, 1440/1024/768px.
- **EVIDENCE:** [Desktop hero](</tmp/f1-visual-audit/01-home-desktop-dark.png>), [tablet hero](</tmp/f1-visual-audit/05-home-tablet.png>).
- **ROOT CAUSE:** `.hero-description` is capped at `37ch`, then `32ch` in the intermediate-width override, despite having a wider grid column available.
- **FILES LIKELY INVOLVED:** `home.css`.
- **CHANGE:** For widths >=768px, use `max-width: min(100%, 52ch)` on `.home-page .hero-description` and remove/override the intermediate `32ch` restriction. Keep its existing font size, line height, and grid column.
- **DO NOT CHANGE:** Hero title size, photograph dimensions, desktop column proportions, or mobile description rules.
- **ACCEPTANCE CRITERIA:** The excerpt uses more of its available text column and wraps into fewer lines at 1440/1024px; it never touches the photograph; the 390px layout is unchanged.
- **TEST VIEWPORTS:** 1440, 1024, 768, 390.
- **DEPENDENCIES:** None.
- **EFFORT:** XS.

#### UI-008 — End generated article excerpts at a complete word

- **PRIORITY:** P2
- **TYPE:** Polish
- **OBSERVED:** The homepage lead excerpt ends `έδειχ...`; other visible feed excerpts also stop inside words. This makes the summaries look mechanically cut off.
- **LOCATION:** `/`, hero and story feed; downstream consumers of generated excerpts.
- **EVIDENCE:** [Hero excerpt](</tmp/f1-visual-audit/01-home-desktop-dark.png>), [feed excerpts](</tmp/f1-visual-audit/02-home-middle.png>).
- **ROOT CAUSE:** `blog-module/build/worker.js` constructs the fallback excerpt with `plainText.substring(0, 200) + '...'`. The homepage consumes the stored excerpt unchanged.
- **FILES LIKELY INVOLVED:** `blog-module/build/worker.js`; downstream verification in `blog-module/build/index.js` and `blog-module/blog-loader.js`.
- **CHANGE:** Keep the 200-character budget for generated fallback excerpts, but cut at the last whitespace boundary at or before that limit. Trim trailing whitespace and append a single ellipsis only if content was actually omitted. Preserve explicitly supplied editorial excerpts. Regenerate the affected generated data/HTML rather than patching the homepage text alone.
- **DO NOT CHANGE:** Full article content, authored excerpts, card line clamps, article ordering, or metadata contracts.
- **ACCEPTANCE CRITERIA:** Generated Greek and Latin excerpts end in a complete word; a short paragraph does not acquire an unnecessary ellipsis; the regenerated homepage lead and feed use the same corrected excerpt; supplied excerpts remain byte-for-byte unchanged.
- **TEST VIEWPORTS:** 1440 and 390 for visual consumers; inspect generated text for long Greek, long Latin, and short input.
- **DEPENDENCIES:** None.
- **EFFORT:** S.

#### UI-010 — Honor the hidden state of the author-directory back link

- **PRIORITY:** P2
- **TYPE:** Bug
- **OBSERVED:** `← ΟΛΟΙ ΟΙ ΣΥΝΤΑΚΤΕΣ` is visible above the complete directory even though the user is already viewing all authors.
- **LOCATION:** `/authors/`, desktop and mobile. The same link is correctly useful on a focused author profile.
- **EVIDENCE:** [Directory desktop](</tmp/f1-visual-audit/19-authors-desktop.png>), [directory mobile](</tmp/f1-visual-audit/22-authors-mobile.png>), [focused profile](</tmp/f1-visual-audit/34-author-profile-light.png>).
- **ROOT CAUSE:** The HTML link has `hidden`, but `.authors-directory-back { display: inline-flex; }` overrides the browser's default hidden styling. `scripts/authors.js` intentionally unhides it only for a valid selected profile.
- **FILES LIKELY INVOLVED:** `styles/authors.css`. Reference markup/behavior: `authors/index.html`, `scripts/authors.js`.
- **CHANGE:** Add `.authors-directory-back[hidden] { display: none; }` after its base display rule. Keep the current JavaScript selection logic.
- **DO NOT CHANGE:** Author ordering, profile query parameters, return URL, or focused-profile layout.
- **ACCEPTANCE CRITERIA:** No return link or reserved link spacing appears on `/authors/` or an unknown-author query. The link remains visible and usable for `?author=georgios-balatzis` and returns to the directory.
- **TEST VIEWPORTS:** 1440, 768, 390.
- **DEPENDENCIES:** None.
- **EFFORT:** XS.

#### UI-011 — Raise the smallest author-card supporting text to a readable scale

- **PRIORITY:** P2
- **TYPE:** Accessibility
- **OBSERVED:** Desktop author-card kickers, column labels, dates, specialty text, and action links look miniature beneath normal-sized names. The directory has enough room to improve them without changing its composition. Mobile already raises several of these labels to 12px.
- **LOCATION:** `/authors/`, cards at 1440/1024px; compare mobile labels.
- **EVIDENCE:** [Desktop cards](</tmp/f1-visual-audit/19-authors-desktop.png>), [laptop cards](</tmp/f1-visual-audit/20-authors-laptop.png>), [mobile card](</tmp/f1-visual-audit/22-authors-mobile.png>).
- **ROOT CAUSE:** `styles/authors.css` assigns several metadata selectors `.58rem`–`.70rem`, and the main card bio `.78rem`.
- **FILES LIKELY INVOLVED:** `styles/authors.css`.
- **CHANGE:** Set the base font size to `.75rem` for `.author-profile__kicker`, `.author-profile__specialty`, `.author-profile__column`, `.author-profile__column strong`, `.author-profile__stories-head strong`, `.author-profile__stories-head span`, `.author-profile__archive`, and `.author-profile__social`. Set `.author-profile__bio` to `.875rem`. Preserve existing weights, colors, and mobile 44px action targets. Allow natural card-height growth.
- **DO NOT CHANGE:** Portrait sizes, two-column directory layout, intentional alternating vertical offset, names, or article-link text.
- **ACCEPTANCE CRITERIA:** Listed supporting text computes to at least 12px at the default root size, bio text to 14px; metadata and links remain inside each card at 1024/390px; no text is clipped or forcibly truncated.
- **TEST VIEWPORTS:** 1440, 1024, 768, 390.
- **DEPENDENCIES:** None.
- **EFFORT:** S.

#### UI-012 — Remove inherited landing-section padding from legal document sections

- **PRIORITY:** P2
- **TYPE:** Bug
- **OBSERVED:** The first legal heading starts unusually far below the card's top rule, and a large empty area follows its contact link before the next section. Later sections have similarly inflated vertical spacing.
- **LOCATION:** `/privacy/privacy.html`, first and subsequent document sections; shared legal template.
- **EVIDENCE:** [Desktop legal spacing](</tmp/f1-visual-audit/29-legal-desktop-dark.png>), [mobile legal spacing](</tmp/f1-visual-audit/28-legal-mobile-light.png>).
- **ROOT CAUSE:** Global `section { padding: var(--section-pad-y) 0; border-top: ... }` applies to `.legal-section`. The legal stylesheet adjusts sibling top padding but never resets inherited bottom padding or the first section's padding/border.
- **FILES LIKELY INVOLVED:** `styles/legal.css`. Reference: the global `section` rule in `styles.css`.
- **CHANGE:** Add a base `.legal-section { padding: 0; border-top: 0; }`. Preserve the existing `.legal-section + .legal-section` separator, top margin, and top padding: 2rem on desktop, 1.5rem on mobile. Leave card padding responsible for the document's outer inset.
- **DO NOT CHANGE:** The global section rule, homepage section spacing, legal paragraph line height, card width, or legal content.
- **ACCEPTANCE CRITERIA:** The first heading starts after only the card's intended padding; sections have no extra inherited bottom padding; subsequent sections retain exactly one separator and their explicit legal spacing.
- **TEST VIEWPORTS:** 1440, 1024, 768, 390, on privacy and terms.
- **DEPENDENCIES:** UI-003 recommended first, to verify the final legal cascade once.
- **EFFORT:** XS.

#### UI-017 — Split the lead article's oversized paragraph at existing topic transitions

- **PRIORITY:** P2
- **TYPE:** Polish
- **OBSERVED:** The lead Márquez story becomes an uninterrupted wall of text in the middle. One paragraph contains 4,475 characters and is 1,858.5px tall in the 680px desktop reading column; it requires substantially more scrolling on a phone.
- **LOCATION:** `/blog-module/blog-entries/20260913W/article.html`, middle body, 1440px and mobile.
- **EVIDENCE:** [Desktop reading section](</tmp/f1-visual-audit-20260913/13-article-desktop-body.png>). The existing body text is 18px/31.5px and readable; the missing paragraph boundaries are the issue.
- **ROOT CAUSE:** `source.txt` has many single line breaks inside one long block. The publisher correctly joins those lines into one HTML paragraph because there are no blank-line paragraph boundaries.
- **FILES LIKELY INVOLVED:** `blog-module/blog-entries/20260913W/source.txt`; generated output `blog-module/blog-entries/20260913W/article.html`.
- **CHANGE:** Insert a blank line before each of these existing sentence starts: `Και ο Marc μπροστά, ατάραχος.`, `Και αυτός ο Márquez είναι διαφορετικός`, `Πριν από λίγα χρόνια, πολλοί είχαν αρχίσει`, `Σήμερα μάλιστα δεν ήταν μόνος.`, `Αλλά το πιο ενδιαφέρον δεν είναι το αποτέλεσμα.`, `Ίσως γι' αυτό οι νίκες του σήμερα`, and `Γιατί τώρα ο άνθρωπος που κάποτε κυνηγούσε`. Preserve every character of the sentences themselves. Regenerate this article with the existing publisher so the breaks become separate paragraphs.
- **DO NOT CHANGE:** Editorial wording, facts, punctuation, title, paragraph order, images, font size, line height, reading-column width, or the global source parser. Do not automatically split other articles.
- **ACCEPTANCE CRITERIA:** The former long block renders as eight paragraphs separated by the template's existing paragraph margin. Concatenating the affected paragraph text with normalized whitespace yields the same text as before. Images and gallery remain in their original order.
- **TEST VIEWPORTS:** 1440, 768, 390; both themes.
- **DEPENDENCIES:** None.
- **EFFORT:** XS.

### P3

#### UI-009 — Use Greek display dates in article metadata and related cards

- **PRIORITY:** P3
- **TYPE:** Consistency
- **OBSERVED:** The Greek archive displays dates such as `13 Σεπτεμβρίου 2026`, while article metadata uses `July 25, 2025` and related cards use `23 Aug 2025`. These are presentation differences within the same editorial journey.
- **LOCATION:** Archive → article header/rail → related articles.
- **EVIDENCE:** [Archive metadata](</tmp/f1-visual-audit/09-archive-laptop-results.png>), [article header](</tmp/f1-visual-audit/13-article-desktop-light.png>), [mobile article](</tmp/f1-visual-audit/17-article-mobile-top.png>); related-card English dates were also present in the rendered accessibility tree.
- **ROOT CAUSE:** Article generation uses `toLocaleDateString('en-US', ...)`; related-card generation uses `en-GB`.
- **FILES LIKELY INVOLVED:** `blog-module/build/worker.js`, `blog-module/build/related.js`.
- **CHANGE:** Use `el-GR` for article `displayDate`, retaining numeric day, long month, and numeric year. Use `el-GR` with a short month for related cards. Keep machine-readable dates unchanged. Regenerate through the existing publishing pipeline; do not patch only the inspected article.
- **DO NOT CHANGE:** `date`, `dateISO`, sorting, URL dates, JSON-LD, source publication dates, or the homepage's compact ISO date treatment in this task.
- **ACCEPTANCE CRITERIA:** Header and rail show the same Greek date; related cards use compact Greek month names; dates wrap cleanly on mobile; machine-readable dates and chronological ordering are unchanged.
- **TEST VIEWPORTS:** 1440 and 390.
- **DEPENDENCIES:** None.
- **EFFORT:** S.

#### UI-013 — Expose the legal contents bar's horizontal scrolling affordance

- **PRIORITY:** P3
- **TYPE:** Polish
- **OBSERVED:** At 390px the contents strip shows the introductory label and links through Cookies; the remaining destination is outside the visible strip, with no scrollbar or clear continuation cue.
- **LOCATION:** `/privacy/privacy.html`, mobile contents navigation.
- **EVIDENCE:** [Mobile contents strip](</tmp/f1-visual-audit/28-legal-mobile-light.png>).
- **ROOT CAUSE:** `.legal-toc` combines `white-space: nowrap` and horizontal overflow with `scrollbar-width: none` and a hidden WebKit scrollbar.
- **FILES LIKELY INVOLVED:** `styles/legal.css`.
- **CHANGE:** Remove scrollbar suppression from `.legal-toc`; use a thin theme-colored horizontal scrollbar and enough bottom padding to separate it from the links. Preserve the existing horizontal strip and 44px mobile link targets. Do not add another menu or rewrite its contents.
- **DO NOT CHANGE:** Link labels, destination IDs, sticky navigation behavior, or desktop document width.
- **ACCEPTANCE CRITERIA:** On browsers with visible scrollbars, overflow has a clear thin scroll track; touch/trackpad users can reach the final item; keyboard focus brings each link into view; no document-level horizontal scrolling is introduced.
- **TEST VIEWPORTS:** 768, 390, 320; include keyboard traversal.
- **DEPENDENCIES:** UI-003 recommended first for final colors.
- **EFFORT:** XS.

#### UI-014 — Show article-table scrolling guidance only when the table overflows

- **PRIORITY:** P3
- **TYPE:** Polish
- **OBSERVED:** At 768px the first three-column article table fits visibly across the reading column, but still displays `Σύρετε για περισσότερα`. At 390px the same instruction is useful because the third column extends beyond the viewport.
- **LOCATION:** `/blog-module/blog-entries/20250725G/article.html`, first upgrades summary table.
- **EVIDENCE:** [Fully visible tablet columns](</tmp/f1-visual-audit/15-article-tablet-table.png>), [overflowing mobile table](</tmp/f1-visual-audit/16-article-mobile-table.png>).
- **ROOT CAUSE:** `blog-module/build/csv-to-table.js` emits `.table-scroll-indicator` for tables. Its runtime visibility is not reliably tied to actual overflow at the inspected width; `article-script.js` already contains table-indicator handling.
- **FILES LIKELY INVOLVED:** `blog-module/blog/article-script.js`, `blog-module/blog-styles.css`; generated markup reference: `blog-module/build/csv-to-table.js`.
- **CHANGE:** Extend the existing table-indicator handling so each scroll container shows its indicator only when `scrollWidth > clientWidth + 1`. Recalculate after initialization and container resizing, preferably with a ResizeObserver. Preserve any existing behavior that dismisses the cue after the user scrolls. Ensure a hidden indicator does not leave an empty row.
- **DO NOT CHANGE:** Table data, column widths, horizontal scrolling, row striping, or mobile table/card-view selection.
- **ACCEPTANCE CRITERIA:** The cue disappears when all columns fit; it appears on the overflowing 390px table; resizing between the widths updates it without reloading; all columns remain accessible.
- **TEST VIEWPORTS:** 1440, 768, 390.
- **DEPENDENCIES:** None.
- **EFFORT:** S.

#### UI-018 — Avoid duplicating terminal punctuation in the homepage headline

- **PRIORITY:** P3
- **TYPE:** Bug
- **OBSERVED:** The featured title ends with its own full stop followed immediately by the orange decorative full stop, visibly producing `λυγίσει..`.
- **LOCATION:** `/`, hero, desktop and mobile.
- **EVIDENCE:** [Desktop headline](</tmp/f1-visual-audit-20260913/01-home-desktop-initial.png>), [320px headline above consent](</tmp/f1-visual-audit-20260913/30-cookie-narrow-settings.png>).
- **ROOT CAUSE:** `index.html` places `.hero-period` after the generated title slot. `syncHeroStory` in the homepage loader also unconditionally appends that period after assigning the complete post title.
- **FILES LIKELY INVOLVED:** `index.html`, `blog-module/blog-loader.js`, `blog-module/build/index.js` (homepage title-slot generation). Reference: `.hero-period` in `home.css`.
- **CHANGE:** Apply the same display-only punctuation rule in generated homepage HTML and runtime hero synchronization. If the trimmed title ends in a single full stop, move that final stop into the existing orange span instead of adding another. If it ends in other terminal punctuation (`!`, `?`, `;`, or `…`), keep that punctuation and hide/omit the decorative period. For an unpunctuated title, retain the existing decorative period and mark it `aria-hidden="true"`. Never modify the stored post title.
- **DO NOT CHANGE:** Article titles, metadata, archive card titles, source documents, title font size, or the orange accent color.
- **ACCEPTANCE CRITERIA:** The current title ends in one orange full stop before and after JavaScript initializes. A question/exclamation title gains no extra dot. Reload and subsequent hero synchronization do not accumulate punctuation.
- **TEST VIEWPORTS:** 1440, 1024, 390, 320; initial generated HTML and settled runtime.
- **DEPENDENCIES:** None; compatible with UI-016.
- **EFFORT:** S.

#### UI-019 — Label the static author story picks as selected articles

- **PRIORITY:** P3
- **TYPE:** Consistency
- **OBSERVED:** Author cards say `Τελευταία άρθρα`, but Georgios's profile lists July 27/24 stories while the homepage/archive show his September 13 Baku article. Themis's card similarly starts at September 9 despite the September 13 lead story. The label promises a current list that the static picks do not provide.
- **LOCATION:** `/authors/` and `/authors/?author=georgios-balatzis`, story lists, compared with the homepage/archive.
- **EVIDENCE:** [Author directory](</tmp/f1-visual-audit-20260913/23-authors-desktop-dark.png>), [focused profile](</tmp/f1-visual-audit-20260913/26-author-profile-desktop.png>), [current homepage stories](</tmp/f1-visual-audit-20260913/02-home-middle-dark.png>).
- **ROOT CAUSE:** `authors/index.html` contains manually selected article links and a hardcoded latest-articles heading; `scripts/authors.js` only selects a profile and does not populate a latest feed.
- **FILES LIKELY INVOLVED:** `authors/index.html`.
- **CHANGE:** Change the `Τελευταία άρθρα` heading inside each existing `.author-profile__stories-head` to `Επιλεγμένα άρθρα`. Keep the current links and year label. This is a bounded copy correction for the current static component.
- **DO NOT CHANGE:** Author names, biographies, selected article URLs/order, profile routing, article data, or the publishing pipeline. Do not add a fetching mechanism or a new feed.
- **ACCEPTANCE CRITERIA:** Directory and focused profiles describe the fixed story lists as selected articles; all existing destinations still work; the slightly longer label does not collide with the year at 390px.
- **TEST VIEWPORTS:** 1440, 1024, 390.
- **DEPENDENCIES:** None; verify wrapping after UI-011 if it has been applied.
- **EFFORT:** XS.

## Systemic Findings

1. **Some component refinements depend on missing base styles.** The consent panel is the clearest example: useful declarations remain in a retired critical block while the synchronously loaded stylesheet assumes them. UI-002 makes that component self-contained without restoring the old page shell.
2. **Shared floating controls need layout-aware visibility.** The same fixed left position causes overlap on several templates. UI-001 addresses that once, rather than separately changing homepage, article, and footer padding.
3. **Editorial and legacy styling coexist.** The legal pages use newer wordmark markup with older styling. UI-003 addresses the shared legal template; UI-012 independently removes inherited document spacing. Avoid a repository-wide CSS refactor to solve these local problems.
4. **Generated content needs presentation-aware formatting.** Excerpts and dates are generated once and consumed by multiple rendered surfaces. UI-008 and UI-009 belong in the publishing source, not scattered generated HTML patches.
5. **Responsive display rules can defeat semantic markup.** The authors back link already has the correct `hidden` state; its CSS overrides it. UI-010 is a selector fix, not a routing rewrite.
6. **Decorative article numbering assumes uniform content and generous gutters.** Archived article headings do not all follow that assumption. UI-004 and UI-005 address the two conditions without changing editorial content.

7. **Chart decorations must use the data plot's coordinate system.** UI-015 corrects one shared chart renderer across screen widths; individual driver columns do not need separate fixes.
8. **Intermediate media queries still contain older hero values.** UI-016 removes two contradictory font-size overrides. UI-007 and UI-006 address separate excerpt/byline constraints in that same component.
9. **Formatting fixes belong at their actual source.** UI-017 is a single article's paragraph-boundary correction, UI-018 affects only homepage display punctuation, and UI-019 corrects a static card label. None calls for changing all editorial content or introducing dynamic features.

The archive's asymmetrical lead layout, staggered author cards, dark footer in light mode, red stamps, and selective rounded corners were not classified as bugs merely because a different composition is possible. The contact fields rendered with visible labels and 16px mobile input text. The inspected mobile menu and search/filter empty state were usable. The 404 page retained a clear recovery hierarchy and did not establish a necessary visual fix.

## Quick Wins

- **UI-016:** remove two media-query font-size overrides to restore proportional laptop headlines.
- **UI-019:** correct the heading on existing static author story picks.

- **UI-010:** one hidden-state selector removes a visibly redundant navigation link.
- **UI-006:** one explicit grid area restores the mobile hero's metadata spacing.
- **UI-004:** a narrow-width pseudo-element rule removes clipped section numbers.
- **UI-012:** a scoped section reset removes inherited legal-document whitespace.
- **UI-007:** widening one text measure reduces awkward hero wrapping without changing the layout.

## Suggested Implementation Order

**UI-015 → UI-001 → UI-016 → UI-002 → UI-003 → UI-012 → UI-010 → UI-006 → UI-004 → UI-005 → UI-007 → UI-011 → UI-017 → UI-008 → UI-009 → UI-018 → UI-019 → UI-013 → UI-014**

Implement and visually accept each task before moving on. The order fixes shared obstructions and the visibly inconsistent shell first, then low-risk layout corrections, then text formatting and smaller affordances. Rebuild generated assets as required by the touched sources; perform one final cross-template check after the batch. None of these tasks authorizes redesign, backend changes, new product features, or replacement of editorial imagery.
