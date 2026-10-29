# Local drafts and Race Report preview

Baseline: `bbe1d24b2bca1e7ee495eec8459911c4875ce99d` (latest main, checked again before preparing the PR).

The existing five-step author tool now offers **Δημοσίευση τώρα** and **Αποθήκευση ως πρόχειρο** at the final step. **Τα πρόχειρά μου** opens the local manager. ZIP import/export remains a separate, collapsed manual utility. Saving and opening drafts require neither a GitHub token nor ZIP files.

## Storage and restoration

IndexedDB database `f1stories-author-drafts`, version 1, contains one object store, `drafts`, with `id` as its key path. Each record contains:

- `version`, stable UUID `id`, ISO `createdAt` and `updatedAt` timestamps.
- Exact `title`, `author`, `category`, `tags` and `text` strings. Greek text, including decomposed accents, is not normalized.
- `metadata`: the current source metadata fields (`author`, `category`, `categories`, `tags`, `title`, `sources`, `updatedDateISO`, `debriefSeason`, `debriefRound`, `debriefLocation`, `homeImage`). An explicit field list excludes credentials and unrelated session state.
- `hero`, `banner`, and ordered `images`: Blob, filename, MIME type and dimensions. Array position maps content images to numbered slots 3 onward; image markers remain in the exact text.
- `editor`: step, Desktop/Κινητό choice and text selection.

Updates use the existing ID and preserve creation time. The UI reports success only after transaction completion; quota failures and aborted transactions do not produce a success message. Initialization, unsupported-browser and corrupt-record errors remain visible, and corrupt entries can be deleted with confirmation. The manager sorts newest modification first and supports untitled/incomplete drafts.

Opening a draft stages and decodes its images before replacing the editor, restores metadata and selections, rebuilds object URLs, refreshes validation/summary and regenerates preview. Older asynchronous image completions cannot overwrite a newly opened draft. Obsolete URLs are revoked. Restored image files also remain available in browsers that cannot programmatically assign file inputs.

Persistent storage is requested after a successful save where supported. Permission does not guarantee retention. Drafts stay in this browser/device, do not synchronize, and can be lost when site data is cleared. Neither records nor browser profiles enter the repository or public artifact.

| Draft manager | Desktop 1440px | Mobile 390px |
| --- | --- | --- |
| Dark | [Screenshot](screenshots/draft-manager-1440-dark.webp) | [Screenshot](screenshots/draft-manager-390-dark.webp) |
| Light | [Screenshot](screenshots/draft-manager-1440-light.webp) | [Screenshot](screenshots/draft-manager-390-light.webp) |

## Shared article preview

The browser preview bundles the unchanged production `parse-txt`, inline formatter, embed sanitizer, table/image helpers, `race-report` and `article-render` modules against a small virtual filesystem. It reads the article presentation from the actual current template and loads the existing article stylesheets. There is no second Race Report renderer or preview stylesheet system.

The renderer loads on the first preview action, not at editor startup. Each render captures current unsaved values. A sandboxed, script-disabled iframe provides actual 1440px and 390px viewports, so viewport media queries genuinely switch the layout. Parent-controlled table toggles and keyboard-focusable gallery filmstrips work without running author-supplied scripts. A final DOM allowlist supplements the production embed sanitization.

Existing verified image presentation metadata is recognized only by matching original image bytes with SHA-256. Ambiguous matches and internal editorial notes are omitted. New images receive no invented caption, credit or focus point.

### Published article comparisons

All five sources were restored through the local draft manager, including source images, and compared with their corresponding published article. Twenty combinations cover five categories × two widths × both themes. Assertions compare editorial prose, headings/running order, data and gallery counts, image counts, title wrapping/typography, cover variant, byline/specialty, timing-strip geometry, body measure/typography, paragraph spacing and author typography. Body heights matched in all twenty cases. Image geometry permits only a one-pixel rounding difference between published AVIF variants and original WebP files. Existing production QA thresholds were not changed.

Each cell links to native-resolution **published / preview** cover screenshots:

| Category / article | 1440 dark | 1440 light | 390 dark | 390 light |
| --- | --- | --- | --- | --- |
| News `20261005G` | [Published](screenshots/News-1440-dark-published.webp) / [Preview](screenshots/News-1440-dark-preview.webp) | [Published](screenshots/News-1440-light-published.webp) / [Preview](screenshots/News-1440-light-preview.webp) | [Published](screenshots/News-390-dark-published.webp) / [Preview](screenshots/News-390-dark-preview.webp) | [Published](screenshots/News-390-light-published.webp) / [Preview](screenshots/News-390-light-preview.webp) |
| Analysis `20261008J` | [Published](screenshots/Analysis-1440-dark-published.webp) / [Preview](screenshots/Analysis-1440-dark-preview.webp) | [Published](screenshots/Analysis-1440-light-published.webp) / [Preview](screenshots/Analysis-1440-light-preview.webp) | [Published](screenshots/Analysis-390-dark-published.webp) / [Preview](screenshots/Analysis-390-dark-preview.webp) | [Published](screenshots/Analysis-390-light-published.webp) / [Preview](screenshots/Analysis-390-light-preview.webp) |
| Technical `20261015G` | [Published](screenshots/Technical-1440-dark-published.webp) / [Preview](screenshots/Technical-1440-dark-preview.webp) | [Published](screenshots/Technical-1440-light-published.webp) / [Preview](screenshots/Technical-1440-light-preview.webp) | [Published](screenshots/Technical-390-dark-published.webp) / [Preview](screenshots/Technical-390-dark-preview.webp) | [Published](screenshots/Technical-390-light-published.webp) / [Preview](screenshots/Technical-390-light-preview.webp) |
| History `20261021W` | [Published](screenshots/History-1440-dark-published.webp) / [Preview](screenshots/History-1440-dark-preview.webp) | [Published](screenshots/History-1440-light-published.webp) / [Preview](screenshots/History-1440-light-preview.webp) | [Published](screenshots/History-390-dark-published.webp) / [Preview](screenshots/History-390-dark-preview.webp) | [Published](screenshots/History-390-light-published.webp) / [Preview](screenshots/History-390-light-preview.webp) |
| Betting `20261010J` | [Published](screenshots/Betting-1440-dark-published.webp) / [Preview](screenshots/Betting-1440-dark-preview.webp) | [Published](screenshots/Betting-1440-light-published.webp) / [Preview](screenshots/Betting-1440-light-preview.webp) | [Published](screenshots/Betting-390-dark-published.webp) / [Preview](screenshots/Betting-390-dark-preview.webp) | [Published](screenshots/Betting-390-light-published.webp) / [Preview](screenshots/Betting-390-light-preview.webp) |

Additional body and pit-wall comparisons:

- Technical desktop/light body: [published](screenshots/Technical-1440-light-body-published.webp) / [preview](screenshots/Technical-1440-light-body-preview.webp); author: [published](screenshots/Technical-1440-light-author-published.webp) / [preview](screenshots/Technical-1440-light-author-preview.webp).
- History mobile/light body: [published](screenshots/History-390-light-body-published.webp) / [preview](screenshots/History-390-light-body-preview.webp); author: [published](screenshots/History-390-light-author-published.webp) / [preview](screenshots/History-390-light-author-preview.webp).

The comparison test reproduces screenshots with `F1S_AUTHOR_QA_DIR=/tmp/f1-author-qa npm run test:author`. Tests use isolated Chrome profiles, local fixtures and mocked GitHub APIs; no real GitHub token is used. WebP evidence retains screenshot dimensions. Manager screenshots use local test drafts, not newly published articles.

## Publication and scheduling

Save makes no GitHub publishing requests, including when the page holds a dummy token in the regression test. Explicit Publish retains normal validation, today's folder date, collision protection, image preparation and an `author/blog/*` PR. Mocked API tests verify the branch, source category, commit and PR. A created PR is described as awaiting publication; the saved draft remains. Existing Site Quality, trusted author auto-merge and Pages/maintenance workflows are unchanged.

There were no open scheduled-author PRs or publication markers when checked before removal and again before preparing the PR. Removed:

- `.github/workflows/scheduled-publish.yml`.
- Scheduled date/time controls, validation, branch selection, marker generation/parsing, scheduled labels and housekeeping display.
- Scheduler-only test cases and obsolete README, branch-protection and RSS documentation.

Independent maintenance, standings/YouTube refresh, security-header schedules and dependency schedules remain intact.

## Validation and limits

- `npm run test:author`: 18 passed, including CRUD, Greek/Blob persistence, incomplete/multiple drafts, ID stability, refresh/restart, corruption, quota/abort, unsaved-change/delete confirmations, token exclusion, stale image loads and file-input fallback.
- `npm run test:blog`: 336 passed; golden snapshots match.
- `npm run qa:author-images`: 16 fixtures passed.
- Publishing routing, security policy, icon and maintenance checks: 36 passed.
- `npm run build:public`, `npm run build:check`, `npm run quality:static`, `npm run perf:budget`: passed locally.
- Clean baseline/candidate SHA-256 comparison: all 410 published article pages are byte-identical. Article index, RSS, sitemap, canonicals, homepage, entity hubs and public article browser assets are unchanged.
- Public changes are limited to the author pages, their source/minified scripts and CSS, three new author modules, and the author security-header policy. The existing default author portrait remains in the artifact. Screenshot evidence is excluded from the public artifact.
- Repeated builds are byte-identical across all 4,104 public files.
- Initial local scripts referenced by `generate.html`: 114,857 → 110,331 bytes raw; summed per-file gzip 38,211 → 36,559 bytes. The shared preview bundle adds 143,413 bytes raw / 52,412 gzip only when preview is opened. Published article/homepage JavaScript and CSS are unchanged. The size-budget gate passes; no field-performance or Lighthouse claim is made.

Exact changed public paths (13):

```text
_headers
generate.html
housekeeping.html
scripts/author/article-preview.min.js
scripts/author/draft-manager.min.js
scripts/author/generate-page.js
scripts/author/generate-page.min.js
scripts/author/github-client.js
scripts/author/github-client.min.js
scripts/author/housekeeping-page.js
scripts/author/housekeeping-page.min.js
scripts/author/local-drafts.min.js
styles/author/generate.css
```

Genuine differences/limits:

- Preview is an unpublished draft, labelled outside the article. Its date means publication today. There is no draft canonical URL, sharing target, fabricated related content, view count or publication navigation. Public-site chrome and runtime reading-progress behavior are outside this article preview.
- Approved embeds retain the production allowlist and composition, but scripts do not execute inside the sandbox. Live tools/social content need build/publication verification. File-backed widgets, CSV and BetCast/telemetry snapshots show an explicit limitation instead of invented data.
- Responsive image variants are produced at publication. Verified media annotations require identical registered bytes; a new publication still follows the repository's existing per-article editorial metadata policy.
- Local storage is device-specific and can be cleared by the browser/user. Persistent-storage approval is advisory. There is no cloud recovery or synchronization.
- GitHub publication was tested with mocked APIs, not a live article PR. No article was published, and no merge/deployment was requested.

## Source files

New runtime/build sources: `scripts/author/local-drafts.js`, `scripts/author/draft-manager.js`, `scripts/author/article-preview.js`, `scripts/author/preview-environment.js`, `scripts/build/author-preview.mjs`.

Modified runtime/UI sources: `generate.html`, `housekeeping.html`, `styles/author/generate.css`, `scripts/author/generate-page.js`, `scripts/author/github-client.js`, `scripts/author/housekeeping-page.js`.

Build wiring/security: `scripts/build/asset-sources.mjs`, `scripts/build/minify.mjs`, `scripts/build/icon-sources.mjs`, `scripts/build/public-artifact.mjs`, `scripts/build/security-policy.mjs`.

Tests: new `scripts/author/__tests__/draft-workflow.test.mjs`; updated `scripts/author/__tests__/github-client.test.mjs`, `scripts/build/__tests__/maintenance-schedules.test.mjs`, `scripts/build/__tests__/quality-routing.test.mjs`, `scripts/build/__tests__/security-policy.test.mjs`.

Documentation: `README.md`, `docs/branch-protection-plan.md`, `docs/rss-feed.md`, and this report with its screenshots. Only the article scheduler workflow is deleted. Production article renderer/template/CSS sources are unchanged.

## E-01: research workspaces

Version 1 records optionally contain a validated research snapshot alongside the article; old records without it open as empty. Saving is explicit and atomic, and clearing the notebook takes effect in storage only after saving. Research JSON is a separate, author-controlled import/export, never article metadata or an automatic publishing attachment. Drafts remain browser- and origin-specific and do not sync. If research is unreadable, opening or overwriting that draft is refused: retain browser data and a private backup for recovery, and export readable notebooks first.
