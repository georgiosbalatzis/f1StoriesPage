# Mobile article tables — P2.1d

Baseline: `7734dfc164eac0600c9d4e45a195b3822ffb3c4b` (latest main on 22 October 2026).

The original mobile rule in `blog-module/blog/article-styles.css` has specificity `(0,4,0)` and hides every noncompact scroll table with `display:none!important`. The document-table exception has specificity `(0,3,0)`, so it loses. Document tables have no card alternative. Production computed styles confirmed `display:none` and zero-size tables in both an existing article and the author preview before editing.

The only CSS change excludes document tables from that hiding rule:

```diff
-.table-responsive-container:not(.table-compact) .table-container.scroll-view
+.table-responsive-container:not(.table-compact):not(.docx-table-container) .table-container.scroll-view
```

No new declaration, `!important`, renderer change, generated table markup change or preview-specific override is needed. The existing document-table scrolling rule applies normally.

## Browser regression results

The focused tests are in `scripts/author/__tests__/draft-workflow.test.mjs` and run under `npm run test:author`. They reuse its isolated local browser/server and exercise the real author iframe, the published Race Report article `20250405G`, and the existing production CSV generator/handlers. External network requests are blocked; no GitHub credentials or publishing are involved.

The new document-table test failed on baseline (`published/390/light: none !== block`) and passes with the selector correction. It asserts computed display, nonzero container/header/body-cell dimensions, visible readable cell text, actual horizontal scrolling and no document overflow. Both light and dark themes pass:

| Viewport | Published table before → after | Preview table before → after | Result |
| --- | --- | --- | --- |
| 390px | none, 0×0 → block, 346×228.81 | none, 0×0 → block, 346×157.13 | Visible cells; scrollLeft reaches 100px; document stays 390px wide |
| 576px | none, 0×0 → block, 532×212.02 | none, 0×0 → block, 532×118.64 | Visible at the inclusive mobile breakpoint |
| 577px | block → block, 533×212.02 | block → block, 533×118.64 | Breakpoint transition preserved |
| 1440px | block → block, 656×212.48 | block → block, 656×119.11 | Cell geometry/styles and table-region screenshots unchanged |

Heights above include the scroll indicator/container. Published and synthetic preview tables have different content and therefore different heights. Preview screenshots isolate the actual iframe-generated markup at the same viewport to capture only its table region; the browser assertions also exercise the real iframe.

CSV regression coverage uses unchanged production-generated markup. File-backed CSV remains a documented browser-preview limitation; the test injects those deterministic fixtures into the test DOM, then exercises the preview's real hydrate/toggle handler. It verifies:

- Noncompact CSV uses cards at 390/576px and retains its existing scroll view at 577/1440px.
- Compact CSV remains visible in its scroll view at all four widths.
- Desktop table/card controls work for both CSV variants in published and preview surfaces.
- Both themes pass. No CSV/compact CSS was changed.

## Table-region screenshots

Only table regions are captured. Desktop before/after PNG pixels matched exactly for both surfaces and themes; the committed WebP copies are lossless.

| Surface/theme | 390px before | 390px after | 1440px before | 1440px after |
| --- | --- | --- | --- | --- |
| Published/light | [before](screenshots/before-published-390-light.webp) | [after](screenshots/after-published-390-light.webp) | [before](screenshots/before-published-1440-light.webp) | [after](screenshots/after-published-1440-light.webp) |
| Published/dark | [before](screenshots/before-published-390-dark.webp) | [after](screenshots/after-published-390-dark.webp) | [before](screenshots/before-published-1440-dark.webp) | [after](screenshots/after-published-1440-dark.webp) |
| Preview/light | [before](screenshots/before-preview-390-light.webp) | [after](screenshots/after-preview-390-light.webp) | [before](screenshots/before-preview-1440-light.webp) | [after](screenshots/after-preview-1440-light.webp) |
| Preview/dark | [before](screenshots/before-preview-390-dark.webp) | [after](screenshots/after-preview-390-dark.webp) | [before](screenshots/before-preview-1440-dark.webp) | [after](screenshots/after-preview-1440-dark.webp) |

Manual inspection confirmed visible aligned cells, contained scrolling, and preserved typography, spacing, backgrounds and borders. On mobile, columns beyond the viewport remain accessible by horizontal scrolling.

## Public artifact and content protection

Clean baseline/candidate public builds each contain 4,104 files. Exactly 413 public paths differ:

- `blog-module/blog/article-styles.min.css`: the one selector exclusion; 23,880 → 23,907 bytes (+27 raw, +7 deterministic gzip).
- 410 existing `blog-module/blog-entries/*/article.html` files: stylesheet cache key `8f2b3e9e` → `4d9086da` and the identical selector correction in generated inline head CSS. After normalizing just those two CSS changes, all 410 files are byte-identical.
- `generate.html`: stylesheet cache key and lazy preview-bundle cache key updated.
- `scripts/author/article-preview.min.js`: only the embedded shared stylesheet URL hash changes; no browser logic changes.

Tracked article HTML changes are only the stylesheet-version reference. The public build adds the matching generated inline CSS correction. The template's stylesheet reference and editor references are included in a separate generated-artifact commit. Minified files are build outputs under the repository's existing ignore policy.

No article source, prose, metadata, canonical, taxonomy, search data, recommendations, entity hub, homepage, sitemap, RSS, draft persistence, renderer or workflow changed. Docs/screenshots are excluded from the public artifact. A full artifact hash comparison found no other public drift.

## Validation

- Focused document/CSV browser tests: 2 passed; document test demonstrated failure before the fix.
- `npm run test:blog`: 336 tests passed; golden snapshots matched.
- `npm run test:author`: 20 tests passed, including the new table tests and existing persistence/publishing regressions.
- `npm run build:public`: passed.
- `npm run build:check`: passed after committing generated stylesheet references.
- `npm run quality:static`: passed without guard/budget changes.
- `npm run perf:budget`: passed; no additional production JavaScript logic.

Verification used headless system Chrome on macOS. Physical iOS/Android devices and Safari/Firefox were not tested. No merge, deployment or real publishing was performed.
