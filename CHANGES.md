# F1 Stories — Dark-mode polish

Visual review: 9–10 September 2026, using the local site in Chrome at 320 × 740, 390 × 844, 768 × 1024, and 1440 × 900 in both themes.

Reviewed the [blog index](blog-module/blog/index.html) and exactly three articles: [Alain Prost — History](blog-module/blog-entries/20260610W/article.html), [Russell — News](blog-module/blog-entries/20260909J/article.html), and [Sauber C45 — Technical](blog-module/blog-entries/20250404G/article.html). Inspection was limited to these pages and their relevant shared styles and behavior.

Approved direction: warm charcoal, soft off-white text, and restrained racing-red accents, retaining the editorial typography. Completed items are checked; remaining work stays unchecked.

## P1 — Core corrections

- [x] **Make navigation and article covers fully dark.** Replace the cream navigation, mobile menu, and article-header backgrounds with dark surfaces. Update their titles, metadata, icons, dividers, and focus outlines together. The sampled articles currently retain the same cream cover when switching themes.

- [x] **Introduce a coherent charcoal palette.** Use `#1b1a19` for the page, `#242321` for surfaces, and `#2e2c29` for raised panels; pair these with warm off-white headings and softer body text. Scope the changes to archive and article pages.

- [x] **Fix remaining category-text contrast.** Technical bylines and labels currently measure approximately 2.75:1; several History labels also fall below 3:1. Apply readable category tokens consistently to bylines, introductions, trust labels, sidebar labels, and author descriptions. Target at least 4.5:1 for small text while retaining separate decorative colors.

- [x] **Make selected text visible.** The current selection background matches the dark page background. Introduce a distinct warm selection fill with a readable foreground across article text and archive content.

- [x] **Replace the default-blue author links.** Author names currently inherit Bootstrap blue, measuring approximately 3.08:1 against their cards. Use the editorial text palette with an underline and clear hover/focus treatment.

## P2 — Visual and interaction polish

- [x] **Give archive controls stronger definition.** Use raised surfaces for search, sorting, and filter popovers. Separate subtle editorial dividers from control borders; target 3:1 contrast where borders identify controls.

- [x] **Make selected filters unmistakable.** Add a clear selected fill and checkmark alongside the existing pressed state. Give filter removal, reset, pagination, and keyboard focus consistent visual treatments.

- [x] **Remove the dark-mode grain overlay.** Disable the fixed texture over dark pages so text, photographs, and controls render cleanly.

- [x] **Improve small supporting labels.** Raise introduction labels, sidebar labels, and captions to at least 12px, and trust-block copy to 13px. Maintain readable spacing and wrapping on narrow screens.

- [x] **Unify secondary controls and panels.** Give gallery arrows, related-story overlays, and the scroll-to-top button dark surfaces with readable icons. Keep sponsor logos legible inside compact light mats where their artwork requires them.

## Validation and implementation defaults

- [x] **Recheck the same four pages** at 320px, 390px, 768px, and 1440px in both themes. Cover filters, empty results, pagination, mobile navigation, article contents, author cards, and keyboard focus.

- [x] **Verify contrast and theme continuity.** Check text selection, hover/selected/focus states, reload persistence, and archive-to-article navigation. Preserve the existing stored preference and implicit-dark theme convention.

- [ ] **Check loaded external widgets separately.** Verify the Russell chart and article comments during loading and theme switching. External requests were blocked during this review, so their rendered appearance remains unverified.

Use the [shared editorial](styles/editorial.css), [archive](blog-module/blog/archive-editorial.css), and [article](blog-module/blog/article-editorial.css) stylesheets for future implementation; regenerate their published assets through the existing build pipeline.
