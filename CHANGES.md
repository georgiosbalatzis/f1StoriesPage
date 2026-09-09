# F1 Stories — Responsive Visual Polish

Visual review: 9 September 2026, using the local site in Chrome with responsive viewports and light/dark themes across the review.

| Mode | Viewports reviewed |
| --- | --- |
| Desktop | 1280 × 800, 1440 × 900, 1920 × 1080 |
| Tablet | 768 × 1024, 1024 × 768 |
| Mobile | 320 × 740, 390 × 844 |

Primary page: [article archive](blog-module/blog/index.html). Also visited the homepage, author directory, latest article (`20260909W`), and standings. Checked initial views, scrolled content, navigation menus, filters, search/empty results, sorting, pagination, cookie banners, and footers. These are proposed corrections; all remain unchecked.

## P1 — Layout corrections

- [x] **Mobile archive: restore the gutter beside cards 2 and 3.** Their bylines, titles, and read links touch the thumbnail edge at 320px and 390px. Restore the 17px column gap when these featured cards switch back to a grid, matching the subsequent article rows. Source: [archive-editorial.css](blog-module/blog/archive-editorial.css), first-three-card rules and the mobile `.article-card` override.

- [x] **Desktop/tablet archive: prevent overlapping filter menus.** Open “Συντάκτης,” then “Θέμα”: the second popover obscures the first and the active-filter summary. Both also remain open after Escape or clicking outside. Close the sibling disclosure when opening a menu, and support dismissal without leaving panels over the results. Sources: `.chip-scroll-frame` in [archive-editorial.css](blog-module/blog/archive-editorial.css) and disclosure handling in [blog-index.js](blog-module/blog-index.js).

- [x] **Mobile archive: make the filter-reset action visible.** Select an author/topic and enter a search with no results: “Καθαρισμός φίλτρων” stays invisible despite active filters. Override the inherited mobile `display: none` when the reset button is not hidden, and position it beside the active filters so empty results have an obvious recovery action. Sources: `.filter-reset-btn` in [blog-styles.css](blog-module/blog-styles.css) and [archive-editorial.css](blog-module/blog/archive-editorial.css).

- [x] **Mobile archive: fit the complete sort labels.** At 320px and 390px, “Νεότερα πρώτα” clips and “Παλαιότερα πρώτα” displays only “Παλαιότερα.” Remove the inherited `max-width: 9.6rem` restriction and reserve room for the 16px label plus dropdown arrow. Sources: `.blog-sort-control select` in [blog-styles.css](blog-module/blog-styles.css) and [archive-editorial.css](blog-module/blog/archive-editorial.css).

- [x] **Narrow mobile archive: separate the stamp from the introduction.** At 320px, the rotated “RACING. WRITING. REPEAT.” stamp grazes the paragraph text. Reserve space for its rotated bounds or move it below the copy at the narrow breakpoint. Source: `.archive-stamp` and `.archive-masthead-note` in [archive-editorial.css](blog-module/blog/archive-editorial.css).

- [x] **Homepage desktop/tablet: fix long headline wrapping and oversized cover height.** The current lead breaks “Τζιανκάρλο” into “Τζιανκάρλ” and an isolated “ο”; the final red dot can occupy a separate line. At 1440px, the headline is approximately 774px tall and the read action starts around 1278px down the page. Widen the headline measure, adjust its responsive size, avoid arbitrary breaks inside normal words, and bound the cover image height. Source: the hero headline's `max-width: 11ch`, wrapping, and image rules in [home.css](home.css).

- [x] **Tablet author directory: give profile text enough width.** At 768px, two-column cards retain a 150px portrait plus padding and gap, leaving approximately 114px for the text. Biographies and story titles collapse into one- or two-word lines. Introduce a tablet breakpoint with one card per row or a portrait-above-text layout. Source: `.author-directory` and `.author-profile` in [authors.css](styles/authors.css).

- [x] **Mobile author directory: let biography and story lists extend below the avatar.** At 390px, all content remains in the narrow column beside the portrait, leaving unused space underneath it. Restructure the card or its content layout so only the portrait/name block stays side by side and the biography, latest articles, and links use the full width. The current `grid-column` rules target elements nested inside `.author-profile__content`. Sources: [authors.css](styles/authors.css) and [authors/index.html](authors/index.html).

- [x] **Desktop article: move the vertical caption out of the metadata.** On the latest article at 1440px, “Η ΑΝΕΞΑΡΤΗΤΗ ΚΕΡΚΙΔΑ” crosses “Γράφει” and the calendar/date row near the bottom of the cover. Give the decoration a separate gutter or remove it where that space is unavailable. Source: `.article-header::after` and desktop grid placement in [article-editorial.css](blog-module/blog/article-editorial.css).

## P2 — Readability and visual refinement

- [x] **Archive, all sizes: increase supporting text to a readable scale.** Desktop metadata is approximately 9.9px and category labels 9.3px; mobile metadata drops to 8.8px and read links to 9.8px. Establish a larger minimum, approximately 12–14px for these labels, and rebalance wrapping and spacing around the headlines. Include the similarly tiny article trust labels. Sources: `.article-card-meta`, `.article-card-cat`, `.article-card-read` in [archive-editorial.css](blog-module/blog/archive-editorial.css), and `.article-trust__label` in [article-editorial.css](blog-module/blog/article-editorial.css).

- [x] **Dark archive/article: brighten category-colored text.** History and Betting bylines visibly fade into the archive background; History labels in the article's trust block do the same. The archive's current History and Betting colors measure approximately 3.2:1 and 3.0:1 against the base background. Define readable dark-theme text variants while retaining category colors for decorative rules and accents. Sources: `--card-signal` in [archive-editorial.css](blog-module/blog/archive-editorial.css) and `--article-signal` in [article-editorial.css](blog-module/blog/article-editorial.css).

- [x] **Archive desktop/tablet/mobile: bring the first headline into view sooner.** At 1440 × 900, the lead image starts around 648px and its headline around 1271px; at 390 × 844, the first image starts around 694px. Tighten masthead spacing and adjust the lead image's responsive height so shorter screens reveal meaningful story content sooner while retaining the JOURNAL hierarchy. Source: `.archive-masthead` and the first-card image rules in [archive-editorial.css](blog-module/blog/archive-editorial.css).

- [x] **Desktop archive: tighten the regular article rows.** After the opening three stories, short excerpts leave large empty areas above read links aligned to the bottoms of tall thumbnails. Reduce thumbnail height or revise row/footer alignment so related text and actions remain visually grouped and the archive takes less scrolling to scan. Source: `.article-card`, `.article-card-img-wrap`, and `.article-card-footer` in [archive-editorial.css](blog-module/blog/archive-editorial.css).

- [x] **Archive desktop/mobile: preserve useful image composition.** The desktop BetCast #272 thumbnail cuts off artwork at the sides; the mobile Russell card's square crop removes much of its headline artwork and faces. Provide suitable thumbnail variants or per-image focal positions, and use a less aggressive fit for images containing text. Sources: card image rules in [archive-editorial.css](blog-module/blog/archive-editorial.css), card generation in [blog-index.js](blog-module/blog-index.js), and the initial-card renderer in [build/index.js](blog-module/build/index.js).

- [x] **Archive search, all sizes: show one clear control and one focus treatment.** Typing a query displays both the native search-cancel X and the custom clear button. The input's focus outline also protrudes beyond the outer field border. Keep a single visible clear action and style focus coherently around the field shell while preserving keyboard visibility. Sources: `#blog-search` in the [archive index](blog-module/blog/index.html), search styles in [archive-editorial.css](blog-module/blog/archive-editorial.css), and shared focus styling in [editorial.css](styles/editorial.css).

- [x] **Technical article cards: balance Greek and Latin headline typography.** In filtered Technical results, “Ferrari SF26” and “Audi R26” render much heavier and narrower than the surrounding Greek text. Use compatible display-font coverage or matched fallback weights so mixed-language headlines retain consistent visual weight. Sources: technical/analysis title rules in [archive-editorial.css](blog-module/blog/archive-editorial.css) and font declarations in [home-fonts.css](styles/home-fonts.css).

- [x] **Archive desktop/tablet: keep reading-time labels consistent after interaction.** Initial cards show compact labels such as “6 λεπ”; filtering or pagination rebuilds them as “6 λεπτά ανάγνωσης,” changing the metadata width and wrapping. Choose one display format and use it in both renderers. Sources: `formatReadingTime` in [blog-index.js](blog-module/blog-index.js) and the initial-card renderer in [build/index.js](blog-module/build/index.js).

## P3 — Finishing detail

- [x] **Mobile archive: remove the stray dot beside the filter icon.** “Φίλτρα +” has an extra grey dot, which also moves with the close state. The legacy `.blog-archive-mini-bar span::after` rule reaches the nested icon span; scope the separator or disable it there. Sources: [blog-styles.css](blog-module/blog-styles.css) and the mini-bar overrides in [archive-editorial.css](blog-module/blog/archive-editorial.css).

When implementing, recheck the affected states at the viewport sizes above in both themes, especially 320px, 768px, and the transition back to desktop navigation. No document-wide horizontal overflow was observed in the sampled routes; standings had no confirmed visual correction from this pass.
