# HASTOBEFIXED

Audit date: 2026-06-23

This file is a fresh professional polish roadmap for the repository after the previous cleanup work. It replaces the old step history with the remaining work that would make the project easier to maintain, easier to review, safer to publish, and more predictable in CI.

## Operating Constraints

- The site must stay a static website hosted on GitHub Pages.
- The reader experience must stay simple: article pages, index pages, standings pages, routing, and navigation should keep working without a backend.
- The author workflow must stay friendly: authors should still be able to generate, preview, edit, and publish blog entries without learning a heavyweight CMS.
- The right target is not a framework migration. The right target is a static source tree with deterministic generation, strong guards, clean ownership boundaries, and polished local author tools.

## Executive Read

The repo is already much better guarded than the original state: public artifacts are built into `dist/`, generated files are more clearly separated, author-only tools are no longer part of the published artifact, runtime and static checks exist, and deployment can stay GitHub Pages native.

The remaining polish is mostly about professional engineering hygiene:

- Make a clean checkout reproduce the same result as the current working tree.
- Remove hidden local dependencies from tests and build steps.
- Replace mtime-based generation decisions with content hashes.
- Shrink and modularize the author tools without changing their static/local nature.
- Finish source ownership cleanup so personal IDE files and private notes are not project source.
- Add explicit data contracts for generated JSON and cache files.
- Reduce raw `innerHTML` usage, inline scripts, and broad CSP allowances over time.
- Make standings and blog rendering code easier to test and reason about.
- Keep public artifact validation strict enough that GitHub Pages deploys cannot quietly publish broken output.

## Evidence Snapshot

These are the concrete observations from the current codebase scan.

- `.git` is about 850 MB, `node_modules` about 266 MB, `dist` about 101 MB, and `blog-module` about 181 MB.
- The public artifact is intentionally static, but currently large: the latest `dist` build is roughly 98 MB with more than 1,400 files.
- `blog-module/blog-entries/**` contains more than 2,100 tracked files, including generated article HTML, AVIF/WebP assets, raw image formats, source text files, and other article-adjacent files.
- `generate.html` is about 2,300 lines and `housekeeping.html` about 2,000 lines. They still contain large inline CSS/JS blocks and many browser `alert`, `confirm`, and `prompt` flows.
- `standings/standings.js` is about 1,400 lines. Several standings tab modules are also large: `dirty-air.js`, `track-dominance.js`, and `debrief.js` still mix data handling, rendering, state, and UI patterns.
- `blog-module/blog-styles.css` is more than 1,200 lines and still carries broad page-level styling responsibilities.
- `blog-module/build/__tests__/golden.js` reads `blog-module/blog-data.json`, but `blog-data.json` is now an ignored/generated artifact. This is a clean-checkout CI risk.
- `blog-module/build/shared.js` still uses mtime-based skip logic through `utils.shouldSkip()`. The workflow works around this by restoring git mtimes before running the blog processor.
- `.idea/**` files are tracked. `appdev.txt` and `context.md` are also tracked project files. Some may be intentional, but their ownership needs a clear decision.
- Public CSP is improved and no longer allows unpkg, Google Fonts, or CDNJS as runtime sources, but it still depends on inline script/style allowances that should be reduced in a final hardening pass.
- Many source files still contain `innerHTML` or HTML string rendering. Some usage is expected for generated article content, but raw sinks should be explicit, reviewed, and guarded.
- JSON/cache artifacts such as `standings/dirty-air-cache.json`, `standings/debrief-cache.json`, `blog-module/blog-source-cache.json`, and `blog-module/blog-index-data.json` are important runtime data, but their schemas are not fully enforced as contracts.

## Not In Scope

Do not solve these polish items by adding a backend, database, server-rendering platform, paid CMS, or SPA framework migration. Those would work against the current strengths of the project.

The professional version of this site should still be:

- Static files in GitHub Pages.
- Buildable locally with Node scripts.
- Publishable through GitHub Actions.
- Usable by authors through local/static author tools.
- Readable by users without client-side app complexity.

## Recommended Fix Order

### Step 1 - Make The Current Branch Reproducible

Priority: P0

Status: Completed on 2026-06-27.

Implemented:

- The cleanup state has been consolidated into an intentional source baseline.
- Public deploy output is generated into `dist/` with `npm run build:public`.
- Generated/minified assets, `dist/`, local authoring data, IDE metadata, raw logo source, and legacy unused image leftovers are excluded from source ownership.
- The deploy workflow builds and uploads the validated `dist/` artifact instead of publishing the repository root.
- Quality gates now include source guards, runtime CSP/public-artifact audits, author module tests, article-media budgets, public image budgets, consent checks, and Lighthouse budgets.
- The branch no longer depends on local `blog-module/blog-data.json` for tests.

Verified:

- `npm run build:public`
- `npm run quality:static`
- `npm run audit:runtime`
- `npm run test:blog`
- `npm run test:author`
- `npm run perf:budget`
- `npm run perf:article-media`
- `npm run perf:images`
- `npm run test:consent`
- `npm run perf:lighthouse`

Problem:

Before this baseline, the working tree contained a large cleanup state: deleted generated files, renamed archive files, new workflow files, new quality scripts, ignored generated files, and a local `blog-data.json`. That state had to be turned into a reproducible source baseline before deeper polish could continue.

Change:

- Review the current dirty tree as one release-quality cleanup set.
- Commit or intentionally discard only the cleanup changes that belong to this effort.
- Do not keep local-only files as silent dependencies.
- Run the full quality path from a clean working tree after the commit.
- Add a short migration note explaining that public output now comes from `dist/` and that author tools remain source/local only.

Done when:

- `git status --short` is clean after the intended commit.
- A fresh clone can run `npm ci` and the required build/test commands without relying on ignored local artifacts.
- `npm run build:check` passes after generation has no uncommitted drift.
- The deploy workflow can build `dist/` from source without manual local state.

### Step 2 - Fix The Clean-Checkout Blog Test Risk

Priority: P0

Status: Completed on 2026-06-23.

Implemented:

- `blog-module/build/__tests__/golden.js` no longer reads `blog-module/blog-data.json`.
- Classification guard coverage now uses `blog-module/build/__tests__/fixtures/classification-cache.json`, a small committed fixture that only contains the cached IDs needed by the test.
- `scripts/quality/static-source-guard.mjs` now rejects test code that references `blog-data.json`, `BLOG_DATA_PATH`, `OUTPUT_JSON`, or `CONFIG.OUTPUT_JSON`.

Verified:

- `npm run test:blog`
- `npm run test:blog` with `blog-module/blog-data.json` temporarily moved away for the command
- `npm run quality:static`

Problem:

`blog-module/build/__tests__/golden.js` reads `blog-module/blog-data.json`, but `blog-data.json` is now ignored/generated. Tests currently pass only because the file exists locally. In a clean checkout, CI can fail after the tracked deletion lands.

Change:

- Stop reading `blog-module/blog-data.json` from tests.
- Use `blog-module/blog-source-cache.json`, a committed fixture, or generated in-memory sample data for classification guard tests.
- Add a guard that fails if test code starts depending on ignored generated files again.
- Add a clean-checkout simulation to CI or a documented local command that removes ignored artifacts in a disposable clone and runs the quality suite.

Done when:

- `npm run test:blog` passes without `blog-module/blog-data.json` existing.
- `blog-data.json` can remain generated/ignored with no hidden test dependency.
- CI proves the repository is sufficient from tracked files alone.

### Step 3 - Replace Blog Mtime Skips With Content Hashes

Priority: P0

Status: Completed on 2026-06-23.

Implemented:

- `blog-module/build/shared.js` now computes a deterministic `_buildHash` from entry inputs and blog-rendering dependencies.
- `blog-module/build/index.js` stores `_buildHash` in `blog-source-cache.json` for freshly built posts and uses that cached hash when classifying source-backed entries.
- `blog-module/blog-source-cache.json` has been updated with `_buildHash` values for all 87 currently buildable cached posts.
- `.github/workflows/publish-blog.yml` no longer restores git mtimes before running the blog processor.
- The blog maintenance workflow now watches `blog-module/build/**`, so build-code changes can trigger generated blog artifact maintenance.

Verified:

- Synthetic hash-skip check returned `skip/build/build` for unchanged source, changed source, and missing hash cases.
- Dry classification with the updated cache reports the current source-backed entries as `source-backed:skip`.
- `npm run test:blog`
- `npm run test:blog` with `blog-module/blog-data.json` temporarily moved away for the command
- `npm run quality:static`

Problem:

The blog processor still decides whether to skip work with source/output mtimes. Git does not preserve mtimes, so the workflow has to restore git mtimes before running the processor. That is brittle and makes generation behavior harder to trust.

Change:

- Replace `utils.shouldSkip()` mtime logic with a content hash manifest.
- Hash the actual entry inputs: source text/doc files, images, CSV/embed files, template version, builder version, and relevant processor options.
- Store the per-entry hash in a generated manifest or inside the existing source cache structure.
- Rebuild an entry only when its input hash changes.
- Remove the workflow step that restores git mtimes once hashes are authoritative.

Done when:

- Blog generation produces the same output in a fresh clone, a CI runner, and a local machine.
- Touching a file without changing content does not force a rebuild.
- Changing any real entry input forces exactly the expected rebuild.
- The publish workflow no longer needs mtime restoration.

### Step 4 - Clean Source Ownership And Repo Hygiene

Priority: P1

Status: Completed on 2026-06-23.

Implemented:

- Added `.idea/`, `context.md`, `appdev.txt`, and `laststeps.txt` to `.gitignore`.
- Removed `.idea/**`, `appdev.txt`, and `context.md` from the git index with cached removal only, leaving the local files on disk.
- Kept `laststeps.txt` as a staged source deletion and added an ignore rule so it cannot come back as a task note.
- `scripts/quality/static-source-guard.mjs` now rejects tracked `.idea/**`, `context.md`, `appdev.txt`, `nextsteps.txt`, and `laststeps.txt`.
- Treated `context.md` as local AI/operator context, not project documentation.
- Treated `appdev.txt` as local mobile-app planning notes, not static-site source.

Verified:

- `git ls-files .idea appdev.txt context.md nextsteps.txt laststeps.txt` returns no tracked files.
- Local copies of `.idea/`, `context.md`, and `appdev.txt` still exist on disk.
- `npm run quality:static`

Problem:

Tracked IDE metadata and personal/internal notes make the repository look less professional and increase review noise. Some files may be useful, but their status must be intentional.

Change:

- Untrack `.idea/**` and add `.idea/` to `.gitignore`.
- Decide whether `context.md` is project documentation or personal working context.
- If `context.md` is project documentation, move it to a clear docs path such as `docs/engineering-context.md`.
- If it is personal context, untrack it and ignore it.
- Decide whether `appdev.txt` belongs in the repo. If not, untrack and ignore it.
- Extend source guard checks to reject personal IDE folders, scratch files, and known local-only notes.

Done when:

- Project source contains only files that another maintainer should inherit.
- Local IDE configuration can exist without showing in `git status`.
- CI fails if personal/scratch files are accidentally added later.

### Step 5 - Define The Article Media Storage Policy

Priority: P1

Status: Completed on 2026-06-23 for enforceable policy, guardrails, and author warnings. Historical raw-asset reduction remains a follow-up cleanup, not a blocker for the policy.

Implemented:

- Added `scripts/perf/article-media-guard.mjs` to inventory and budget tracked article media in `blog-module/blog-entries/**`.
- Added `perf/article-media-budget.json` as the first reviewed repo-media baseline.
- Added `npm run perf:article-media` and `npm run perf:article-media:update`.
- Added `npm run perf:article-media` to the full `npm run verify` chain.
- Added `docs/article-media-policy.md` to define source-vs-generated article media expectations.
- The media guard blocks silent new raw article image paths unless the baseline is intentionally updated.
- The current baseline records 1,808 tracked article media files, 146.66 MB total, 1,794 optimized AVIF/WebP files, and 14 reviewed raw source images.
- `generate.html` now warns authors when selected images are raw JPG/PNG/GIF inputs or larger than 1 MB before export/publish.
- The author warning explains that the tool publishes WebP files and that raw originals should not be added to the PR.

Verified:

- `npm run perf:article-media:update`
- `npm run perf:article-media`
- `npm run quality:static`

Follow-up cleanup:

- Review whether the 14 existing raw source images still need to stay in git.
- Consider lowering the repo media budget after historical raw assets are removed or archived.

Problem:

The static site can publish optimized article media, but the repository also carries many article files and some raw image formats. This increases clone size, review size, and long-term Git history weight.

Change:

- Define which article files are source of truth and which are generated outputs.
- Keep optimized public images in the static artifact path when needed for GitHub Pages.
- Move or remove raw original images that are no longer needed after AVIF/WebP generation.
- Add a repo media budget in addition to the existing public image budget.
- Teach author tooling to warn when raw image inputs exceed the source budget.
- Add a report listing the largest article assets and whether each one is source, generated, or obsolete.

Done when:

- A reviewer can tell why every large article asset exists.
- New articles cannot accidentally add oversized raw media without a warning or failing check.
- The static user experience is unchanged, but the repository stops growing unnecessarily.

### Step 6 - Modularize The Author Tools

Priority: P1

Status: Completed on 2026-06-27 for the maintainable static-author-tool baseline. The remaining native `alert`/`confirm`/`prompt` dialogs are behavior-preserving follow-up UX polish, not a blocker for source modularization.

Implemented:

- Added `scripts/author/media-policy.js` as the first extracted author-tool helper.
- `generate.html` now loads the helper and delegates media-format/size evaluation to it.
- The new helper exposes reusable media policy functions for future use by `housekeeping.html`.
- The author media warning behavior from Step 5 is preserved.
- Added `scripts/author/github-client.js` as a shared browser GitHub API client for author tools.
- `generate.html` and `housekeeping.html` now use the shared client for GitHub fetches, branch naming, tree commits, and PR creation.
- Added `scripts/author/__tests__/github-client.test.mjs` to verify the mocked branch/tree/commit/PR payload sequence without calling GitHub.
- Added `npm run test:author` and included it in `npm run verify`.
- Added `scripts/author/session-token.js` as a shared session-only token store.
- `generate.html` and `housekeeping.html` now use the shared token store while keeping their existing prompt copy.
- Added `scripts/author/__tests__/session-token.test.mjs` to verify session-only storage, legacy `localStorage` cleanup, and invalid-token removal.
- Added `scripts/author/image-tools.js` as a shared image helper for extension normalization, MIME mapping, WebP detection, and WebP conversion.
- `generate.html` and `housekeeping.html` now use the shared image helper for their author-side image normalization flow.
- Added `scripts/author/__tests__/image-tools.test.mjs` for pure image-helper behavior.
- Added `scripts/author/__tests__/media-policy.test.mjs` so the author media warning policy has direct coverage.
- Added `scripts/author/article-source.js` as a shared source package helper for ZIP path normalization, `source.txt` parsing, and `source.txt` serialization.
- `generate.html` and `housekeeping.html` now delegate `source.txt` parsing/building to the shared article-source helper while preserving their existing editor behavior.
- Added `scripts/author/__tests__/article-source.test.mjs` to cover source package parsing, hyphen decoding for Generate imports, fallback metadata, path normalization, and serialization.
- Added `base64ToUtf8()` to `scripts/author/github-client.js` and moved housekeeping's base64 blob/text conversion wrappers onto the shared GitHub helper.
- Added `scripts/author/article-folder.js` as a shared author-code and article-folder helper.
- `generate.html` and `housekeeping.html` now share one source for author codes, reverse author lookup, folder parsing, folder-name building, and current-date folder prefixes.
- Added `scripts/author/__tests__/article-folder.test.mjs` to cover author-code lookup, folder parsing, folder-name building, invalid folder detection, and date formatting.
- Added `scripts/author/dom-tools.js` as a shared DOM helper for SVG icons, icon+text buttons, status messages, and busy button states.
- `generate.html` and `housekeeping.html` now use the shared DOM helper for author-tool controls and progress states instead of rebuilding SVG strings inline.
- Added `scripts/author/__tests__/dom-tools.test.mjs` with a small fake DOM to verify icon, status, and button construction without a browser.
- Added `setTrustedHtml()` to `scripts/author/dom-tools.js`; it requires a short reason string before assigning trusted preview HTML.
- `generate.html` now routes article preview HTML through `setTrustedHtml()` instead of assigning `innerHTML` directly.
- Added `scripts/author/article-index.js` as a shared helper for compact blog-index expansion, legacy post extraction, newest-first sorting, filter option collection, and Housekeeping search/filter matching.
- `housekeeping.html` now delegates blog-index parsing, sorting, and filtering to the tested article-index helper.
- Removed Housekeeping's now-unused local compact-index expansion and HTML escaping helpers.
- Added `scripts/author/__tests__/article-index.test.mjs` to cover compact index expansion, fallback legacy shapes, sorting, filtering, filter options, and thumbnail URL generation.
- Extracted Generate's page-local application script to `scripts/author/generate-page.js`.
- Extracted Housekeeping's page-local application script to `scripts/author/housekeeping-page.js`.
- Extracted Generate's page-local styles to `styles/author/generate.css`.
- Extracted Housekeeping's page-local styles to `styles/author/housekeeping.css`.
- `generate.html` and `housekeeping.html` are now small static shells that load shared author helpers and page-owned author assets.
- Removed script `unsafe-inline` from both author-tool CSP declarations after externalizing their page scripts.

Verified:

- `node --check scripts/author/article-index.js`
- `node --check scripts/author/__tests__/article-index.test.mjs`
- `node --check scripts/author/dom-tools.js`
- `node --check scripts/author/media-policy.js`
- `node --check scripts/author/image-tools.js`
- `node --check scripts/author/article-source.js`
- `node --check scripts/author/article-folder.js`
- `node --check scripts/author/github-client.js`
- `node --check scripts/author/session-token.js`
- `npm run test:author`
- `node --check scripts/author/generate-page.js`
- `node --check scripts/author/housekeeping-page.js`
- `npm run quality:static`
- `npm run pages:guard`
- `npm run quality:rendering:update`
- `npm run quality:rendering`
- `git diff --check -- housekeeping.html scripts/author/article-index.js scripts/author/__tests__/article-index.test.mjs package.json HASTOBEFIXED.md`
- `git diff --check -- generate.html housekeeping.html scripts/author package.json HASTOBEFIXED.md`

Problem:

`generate.html` and `housekeeping.html` are useful author tools, but they are too large and too inline-heavy to maintain professionally. They also duplicate UI, GitHub API, validation, token handling, notification, and state-management patterns.

Change:

- Keep the tools static/local, but split their JavaScript into modules under `scripts/author/`.
- Move shared author styles into a dedicated source CSS file.
- Create a shared GitHub API client for branch creation, file updates, PR creation, and status messages.
- Create shared UI utilities for validation messages, confirmations, progress, and modal dialogs.
- Keep remaining `alert`, `confirm`, and `prompt` flows behavior-preserving for this baseline, with a separate follow-up to replace them with accessible in-page dialogs.
- Add tests for pure author-tool functions: slug creation, branch naming, file path generation, markdown/html extraction, GitHub payload shaping, and PR metadata.

Done when:

- `generate.html` and `housekeeping.html` are thin shells around maintainable modules.
- Common author flows behave the same or better than today.
- Token handling remains local to the browser and is clearly documented.
- New author features can be added without editing thousands of lines in one HTML file.
- The remaining native browser dialogs are isolated as follow-up UX polish.

### Step 7 - Add A Rendering Safety System

Priority: P1

Status: Completed for active source files on 2026-06-23. The baseline guard prevents new raw HTML sinks from being added silently, and remaining raw rendering is limited to named trusted helpers.

Implemented:

- Added `scripts/quality/rendering-sink-guard.mjs` to scan active source files for `.innerHTML =`, `.outerHTML =`, and `insertAdjacentHTML(...)`.
- Added `quality/rendering-sinks-baseline.json` as the first reviewed raw-rendering baseline.
- The rendering guard currently tracks 2 active source files with raw HTML sinks and excludes `archive/`, `blog-module/blog-entries/`, `dist/`, `node_modules/`, and the guard implementation file itself.
- Added `npm run quality:rendering` and `npm run quality:rendering:update`.
- `npm run quality:static` now runs both the existing static source guard and the rendering sink guard.
- New raw HTML sink growth now fails quality unless the sink is reviewed and the baseline is intentionally updated.
- Replaced simple author-tool raw rendering with DOM construction for Generate content-image controls and preview lightbox markup.
- Replaced simple Housekeeping raw rendering with DOM construction for article-list status messages, filter default options, article-card metadata, and article-card action buttons.
- Added a shared author DOM helper and moved Generate/Housekeeping progress-button rendering to DOM construction instead of `innerHTML` SVG strings.
- Lowered the reviewed baseline after the reductions: `generate.html` went from 14 to 1 raw sink and `housekeeping.html` went from 29 to 2 raw sinks.
- Replaced Housekeeping's remaining edit-image slot summaries with DOM construction.
- Lowered the reviewed baseline again: the guard now tracks 17 files with raw HTML sinks instead of 18, and `housekeeping.html` has 0 raw sinks.
- Routed Generate's article preview HTML through `authorDom.setTrustedHtml()` with an explicit reason, so author-page code no longer assigns raw HTML directly.
- Extended `scripts/quality/rendering-sink-guard.mjs` to scan tracked plus non-ignored untracked source files, so new helper files are covered before they are staged.
- Excluded the rendering guard implementation file from its own scan to avoid counting its internal bookkeeping properties as DOM sinks.
- Refreshed the baseline so the remaining author raw sink is the named trusted helper in `scripts/author/dom-tools.js`, not `generate.html` or `housekeeping.html`.
- Replaced `scripts/cookie-consent.js` simple-banner copy rendering with DOM/text-node construction while preserving the privacy-policy link.
- Replaced both `scripts/sw-register.js` PWA/update banner templates with DOM construction through a shared local banner builder.
- Refreshed the baseline again: `scripts/cookie-consent.js` and `scripts/sw-register.js` no longer appear in the raw-sink baseline, lowering the active sink file count from 17 to 15.
- Replaced `scripts/f1-optimized.js` contact-form error copy and video empty/error states with DOM/text-node construction.
- Lowered `scripts/f1-optimized.js` from 4 raw sinks to 1; the remaining sink is the escaped YouTube card-list renderer and should be handled in a focused card-renderer extraction.
- Replaced the remaining `scripts/f1-optimized.js` YouTube card-list renderer with DOM construction.
- Refreshed the baseline again: `scripts/f1-optimized.js` no longer appears in the raw-sink baseline, lowering the active sink file count from 15 to 14.
- Replaced `blog-module/blog-loader.js` homepage loading, empty, error, and article-card rendering with DOM construction while preserving the static JSON-driven homepage article preview.
- Refreshed the baseline again: `blog-module/blog-loader.js` no longer appears in the raw-sink baseline, lowering the active sink file count from 14 to 13.
- Replaced `blog-module/blog/article-script.js` table-of-contents and image-lightbox templates with DOM construction while leaving generated article body rendering untouched.
- Refreshed the baseline again: `blog-module/blog/article-script.js` no longer appears in the raw-sink baseline, lowering the active sink file count from 13 to 12.
- Replaced `blog-module/blog-index.js` category chips, pagination, article cards, and empty/error states with DOM construction while preserving the static first page, JSON hydration, lazy images, filters, and pagination behavior.
- Refreshed the baseline again: `blog-module/blog-index.js` no longer appears in the raw-sink baseline, lowering the active sink file count from 12 to 11.
- Replaced the `standings/index.html` `nomodule` fallback warning with DOM construction.
- Refreshed the baseline again: `standings/index.html` no longer appears in the raw-sink baseline, lowering the active sink file count from 11 to 10.
- Replaced `standings/tabs/destructors.js` loading and failure states with DOM construction; the remaining reviewed sink is the escaped chart/report renderer.
- Replaced `standings/tabs/debrief.js` loading and failure states with DOM construction; the remaining reviewed sink is the escaped Friday Debrief report renderer.
- Refreshed the baseline again: `standings/tabs/destructors.js` and `standings/tabs/debrief.js` are each down from 3 raw sinks to 1, while the active sink file count remains 10.
- Added `standings/core/rendering.js` as the single named trusted rendering helper for standings templates; every call must include a short reason.
- Routed the remaining direct standings analysis-tab renderers through `setTrustedHtml()` in `debrief`, `destructors`, `dirty-air`, `lap1-gains`, `pit-stops`, `quali-gaps`, `track-dominance`, and `tyre-pace`.
- Routed the lightweight `standings/standings.js` drivers/constructors tables, charts, skeletons, and error states through the same helper.
- Refreshed the baseline again: all direct standings page/module sinks are gone, and the reviewed baseline now contains only `scripts/author/dom-tools.js` and `standings/core/rendering.js`.

Verified:

- `node --check scripts/author/dom-tools.js`
- `node --check scripts/author/__tests__/dom-tools.test.mjs`
- `node --check scripts/quality/rendering-sink-guard.mjs`
- `node --check scripts/cookie-consent.js`
- `node --check scripts/sw-register.js`
- `node --check scripts/f1-optimized.js`
- `node --check blog-module/blog-loader.js`
- `node --check blog-module/blog/article-script.js`
- `node --check blog-module/blog-index.js`
- `node --check standings/core/rendering.js`
- `node --check standings/standings.js`
- `node --check standings/tabs/destructors.js`
- `node --check standings/tabs/debrief.js`
- `node --check standings/tabs/dirty-air.js`
- `node --check standings/tabs/lap1-gains.js`
- `node --check standings/tabs/pit-stops.js`
- `node --check standings/tabs/quali-gaps.js`
- `node --check standings/tabs/track-dominance.js`
- `node --check standings/tabs/tyre-pace.js`
- `rg -n "\\.innerHTML\\s*=|\\.outerHTML\\s*=|insertAdjacentHTML\\s*\\(" blog-module/blog-loader.js` returned no matches.
- `rg -n "\\.innerHTML\\s*=|\\.outerHTML\\s*=|insertAdjacentHTML\\s*\\(" blog-module/blog/article-script.js` returned no matches.
- `rg -n "\\.innerHTML\\s*=|\\.outerHTML\\s*=|insertAdjacentHTML\\s*\\(" blog-module/blog-index.js` returned no matches.
- `rg -n "\\.innerHTML\\s*=|\\.outerHTML\\s*=|insertAdjacentHTML\\s*\\(" standings/index.html` returned no matches.
- `rg -n "\\.innerHTML\\s*=|\\.outerHTML\\s*=|insertAdjacentHTML\\s*\\(" standings scripts/author/dom-tools.js` now reports only the two named trusted helpers.
- `npm run test:author`
- `npm run quality:rendering:update`
- `npm run quality:rendering`
- `npm run quality:static`
- `npm run test:consent`
- `npm run pages:guard`
- `git diff --check -- standings/core/rendering.js standings/standings.js standings/tabs/debrief.js standings/tabs/destructors.js standings/tabs/dirty-air.js standings/tabs/lap1-gains.js standings/tabs/pit-stops.js standings/tabs/quali-gaps.js standings/tabs/track-dominance.js standings/tabs/tyre-pace.js quality/rendering-sinks-baseline.json HASTOBEFIXED.md`
- `rg -n "[ \\t]+$" standings/core/rendering.js standings/standings.js standings/tabs/debrief.js standings/tabs/destructors.js standings/tabs/dirty-air.js standings/tabs/lap1-gains.js standings/tabs/pit-stops.js standings/tabs/quali-gaps.js standings/tabs/track-dominance.js standings/tabs/tyre-pace.js quality/rendering-sinks-baseline.json HASTOBEFIXED.md` returned no matches.
- `git diff --check -- blog-module/blog-loader.js blog-module/blog/article-script.js blog-module/blog-index.js standings/index.html standings/tabs/destructors.js standings/tabs/debrief.js`
- `rg -n "[ \\t]+$" blog-module/blog-loader.js blog-module/blog/article-script.js blog-module/blog-index.js standings/index.html standings/tabs/destructors.js standings/tabs/debrief.js quality/rendering-sinks-baseline.json HASTOBEFIXED.md` returned no matches.
- `git diff --check -- blog-module/blog-loader.js quality/rendering-sinks-baseline.json HASTOBEFIXED.md`
- `git diff --check -- scripts/f1-optimized.js quality/rendering-sinks-baseline.json HASTOBEFIXED.md`
- `git diff --check -- housekeeping.html quality/rendering-sinks-baseline.json HASTOBEFIXED.md`
- `git diff --check -- generate.html housekeeping.html scripts/author scripts/quality/rendering-sink-guard.mjs quality/rendering-sinks-baseline.json package.json HASTOBEFIXED.md`

Problem:

Raw HTML rendering is now limited to named trusted helpers for author previews and standings templates. The remaining polish is to keep those helpers documented, keep call-site reasons specific, and avoid reintroducing direct sinks outside the helpers.

Change:

- Create a small rendering utility with explicit escaping helpers.
- Prefer DOM node construction or escaped template helpers for data-driven UI.
- Allow raw HTML only through named functions such as `setTrustedHtml()` or a similar project convention.
- Require a short justification near each raw HTML sink that must remain.
- Extend static checks to flag new `innerHTML` assignments unless they use the approved helper or appear in an approved allowlist.
- Add targeted tests for dangerous strings in blog cards, standings rows, search results, tags, author names, titles, and generated snippets.

Done when:

- New data-rendering code has a clear safe path.
- Raw HTML sinks are rare, named, and auditable.
- Static checks prevent accidental reintroduction of unsafe rendering patterns.

### Step 8 - Finish CSP Hardening

Priority: P1

Status: Completed on 2026-06-27 for script CSP hardening and public runtime safety. Public pages no longer need script `unsafe-inline`; remaining inline styles/JSON-LD are documented runtime realities and stay within the current style policy.

Implemented:

- Replaced the CDN `web-vitals` module import in `scripts/perf/web-vitals-beacon.js` with a self-hosted native `PerformanceObserver` reporter for LCP, INP, CLS, FCP, and TTFB.
- Kept the existing analytics consent behavior: the beacon still starts only after analytics opt-in and still sends GA4 `web_vital` events with the same route/metric fields.
- Fixed the beacon so a metric is not marked as reported until `gtag` is actually available and the event send is attempted.
- Removed `https://unpkg.com`, Google Fonts, Google font files, and CDNJS from `scripts/build/security-policy.mjs`.
- Kept `script-src-attr 'none'` explicit and made local-only font/style policy expectations more precise through `style-src-elem`, `style-src-attr`, and `font-src`.
- Updated `scripts/quality/static-source-guard.mjs` so unreviewed CSP source expansion still fails and stale font/CDN sources are treated as banned.
- Updated `scripts/perf/consent-guard.mjs` so the analytics network guard no longer treats unpkg web-vitals requests as acceptable analytics traffic.
- Updated `docs/security-headers.md` and `README.md` to document the self-hosted web-vitals runtime and the narrower CSP source set.
- Updated `perf/size-budget.json` for the new self-hosted web-vitals source and minified byte sizes.
- Added `scripts/theme-init.js`, a self-hosted theme initializer that applies the stored/preferred light theme before page paint without an inline script block.
- Added `scripts/theme-init.js` to the minification graph, HTML stamper article-runtime allowlist, and performance size guard.
- Replaced the repeated inline theme boot script with stamped `/scripts/theme-init.min.js?v=718dd2ec` references in `index.html`, `standings/index.html`, `blog-module/blog/index.html`, `blog-module/blog/template.html`, `privacy/privacy.html`, `privacy/terms.html`, `generate.html`, and `housekeeping.html`.
- Regenerated the blog golden expected article snapshots so new article builds use the external theme initializer.
- Updated 259 generated `blog-module/blog-entries/**/article.html` article shells so the current public article pages also use the external theme initializer. Article prose/content was not changed.
- Ran the asset minifier/stamper so shell pages, generated article pages, and generated article runtime hashes point at the current local minified assets.
- Updated `perf/size-budget.json` for the new `scripts/theme-init.js` and `scripts/theme-init.min.js` byte sizes.
- Added `scripts/hero-background-init.js`, a self-hosted homepage boot asset that selects the daily hero background, sets the responsive preload, and applies the hero image-position CSS variables before page paint.
- Replaced the homepage inline hero background selector/preload block with a stamped `/scripts/hero-background-init.min.js?v=f0de6eba` script reference.
- Added `scripts/hero-background-init.js` to the asset minification graph and performance size guard.
- Updated `perf/size-budget.json` for the new hero background source and minified byte sizes.
- Rebuilt the public artifact so `dist/index.html` uses the external hero initializer and the old inline hero selector is no longer shipped.
- Added `scripts/external-redirect.js`, a shared self-hosted redirect helper that reads a `f1s-redirect-target` meta tag and performs the client-side redirect while preserving each page's meta-refresh fallback.
- Replaced the inline redirect snippets in `ghostcar/index.html` and `f1telemetry/index.html` with stamped `/scripts/external-redirect.min.js?v=06bf3526` references.
- Added `scripts/offline-page.js`, a shared self-hosted offline helper for retry/reload controls and cached-article listing.
- Replaced the inline retry script in `404.html` and the inline retry/cache script in `offline.html` with stamped `/scripts/offline-page.min.js?v=d0e7c7ce` references.
- Added `standings/standings-nomodule.js`, a self-hosted legacy-browser fallback for the standings page.
- Replaced the inline `nomodule` fallback in `standings/index.html` with a stamped `standings-nomodule.min.js?v=c06e53db` reference.
- Added the new redirect, offline, and standings fallback scripts to the minification graph and performance size guard.
- Updated `perf/size-budget.json` for the new redirect, offline, and standings fallback source/minified byte sizes.
- Rebuilt the public artifact so `dist/404.html`, `dist/offline.html`, `dist/ghostcar/index.html`, `dist/f1telemetry/index.html`, and `dist/standings/index.html` no longer ship those inline runtime snippets.
- Added `blog-module/blog/article-comments.js`, a self-hosted article comments loader that keeps the existing lazy Disqus behavior and reads the article identifier from `#disqus_thread[data-article-id]`.
- Replaced the inline Disqus loader in `blog-module/blog/template.html` with `<div id="disqus_thread" data-article-id="ARTICLE_ID"></div>` plus a stamped `/blog-module/blog/article-comments.min.js?v=d0d3b81d` script reference.
- Added the article comments loader to the minification graph, article runtime stamper allowlist, public artifact allowlist, and performance size guard.
- Updated `perf/size-budget.json` for the new article comments source/minified byte sizes.
- Regenerated the article golden snapshots so tested article output uses the external comments loader.
- Updated all 259 generated `blog-module/blog-entries/**/article.html` shells so they no longer contain the inline Disqus loader block and instead carry `data-article-id` plus the external comments runtime. Article prose/content was not changed by this mechanical comments-loader rewrite.
- Ran the blog build after the template hash change; it rebuilt 63 source-backed entries, reused 196 metadata-only cached entries, refreshed `blog-source-cache.json`, index/home JSON artifacts, sitemap data, and standings/debrief cache files.
- Rebuilt the public artifact and fixed `scripts/build/public-artifact.mjs` so `dist/blog-module/blog/article-comments.min.js` is published with the article pages that reference it.
- Externalized Generate and Housekeeping page scripts into `scripts/author/generate-page.js` and `scripts/author/housekeeping-page.js`.
- Removed script `unsafe-inline` from the local author-tool CSP declarations.
- Extracted Generate and Housekeeping page-local CSS into `styles/author/`.
- Switched self-hosted font faces to `font-display: optional` in `styles/fonts.css` and `scripts/build/download-fonts.mjs`, preventing web-font swaps from causing Blog layout shift.
- Fixed `scripts/build/public-artifact.mjs` so all approved homepage hero backgrounds (`bg1` through `bg5`, desktop and mobile, AVIF and WebP) are copied into `dist/`.
- Updated `scripts/build/validate-public-artifact.mjs` so those approved hero background files are required in the public artifact.

Verified:

- `node --check scripts/perf/web-vitals-beacon.js`
- `node --check scripts/theme-init.js`
- `node --check scripts/build/security-policy.mjs`
- `node --check scripts/perf/consent-guard.mjs`
- `node --check scripts/quality/static-source-guard.mjs`
- `node --check scripts/build/minify.mjs`
- `node --check scripts/build/stamp-html.mjs`
- `node --check scripts/perf/size-guard.mjs`
- `node --check scripts/hero-background-init.js`
- `node --check scripts/external-redirect.js`
- `node --check scripts/offline-page.js`
- `node --check standings/standings-nomodule.js`
- `node --check blog-module/blog/article-comments.js`
- `node --check scripts/build/public-artifact.mjs`
- `rg -n "unpkg\\.com|web-vitals@|CDN_URL" . --glob '!node_modules/**' --glob '!blog-module/blog-entries/**' --glob '!archive/**' --glob '!dist/**' --glob '!*.min.js' --glob '!HASTOBEFIXED.md'` returned no matches.
- `rg -n "sessionStorage\\.getItem\\('f1stories-theme'\\)|var s = sessionStorage|getItem\\('f1stories-theme'\\)|getItem\\(\\"f1stories-theme\\"\\)" --glob '!node_modules/**' --glob '!dist/**' --glob '!archive/**' .` now only reports `scripts/theme-init.js`.
- `rg -n "sessionStorage\\.getItem\\('f1stories-theme'\\)|var s = sessionStorage|getItem\\('f1stories-theme'\\)|getItem\\(\\"f1stories-theme\\"\\)" dist` returned no matches after rebuilding the public artifact.
- `rg -n "window\\.__F1StoriesHeroBackgrounds|<script(?![^>]*\\bsrc=)(?![^>]*type=[\\"']application/ld\\+json[\\"'])" --pcre2 index.html scripts/hero-background-init.js --glob '!*.min.js'` now reports only the external helper source, not an inline homepage script block.
- `rg -n "window\\.__F1StoriesHeroBackgrounds|/scripts/hero-background-init|<script(?![^>]*\\bsrc=)(?![^>]*type=[\\"']application/ld\\+json[\\"'])" --pcre2 dist/index.html dist/scripts/hero-background-init.min.js index.html scripts/hero-background-init.js --glob '!*.map'` shows the stamped external script in source and `dist`, plus the minified helper body.
- `rg -n -P "<script(?![^>]*\\bsrc=)(?![^>]*type=[\\"']application/ld\\+json[\\"'])" --glob '*.html' --glob '!blog-module/blog-entries/**' --glob '!dist/**' --glob '!archive/**' --glob '!node_modules/**' .` no longer reports `404.html`, `offline.html`, `ghostcar/index.html`, `f1telemetry/index.html`, or `standings/index.html`; remaining active hits are the author tools and blog article/comment template fixtures.
- `rg -n -P "<script(?![^>]*\\bsrc=)(?![^>]*type=[\\"']application/ld\\+json[\\"'])" dist/404.html dist/offline.html dist/ghostcar/index.html dist/f1telemetry/index.html dist/standings/index.html` returned no matches.
- `rg -n "window\\.disqus_config|f1stories-gr\\.disqus\\.com/embed\\.js|ARTICLE_ID_JSON" blog-module/blog/template.html blog-module/build/__tests__/golden-expected blog-module/blog-entries --glob '*.html'` returned no matches.
- `rg -n "window\\.disqus_config|f1stories-gr\\.disqus\\.com/embed\\.js|ARTICLE_ID_JSON" dist/blog-module/blog-entries --glob 'article.html'` returned no matches.
- `rg -n "article-comments\\.min\\.js" dist/blog-module/blog-entries --glob 'article.html' | wc -l` returned `259`.
- `ls -l dist/blog-module/blog/article-comments.min.js` confirms the comments runtime is included in the public artifact.
- `npm run build:assets:minify && node scripts/build/stamp-html.mjs`
- `node scripts/build/stamp-html.mjs` after the blog build was idempotent.
- `npm run build:blog`
- `node scripts/build/public-artifact.mjs && node scripts/build/validate-public-artifact.mjs`
- `npm run test:blog -- --update`
- `npm run test:blog`
- `npm run quality:static`
- `npm run pages:guard`
- `npm run test:consent -- --timeout-ms 60000`
- `npm run perf:budget`
- `npm run perf:images`
- `npm run perf:lighthouse`
- `npm run audit:runtime`
- `git diff --check -- blog-module/blog/article-comments.js blog-module/blog/template.html blog-module/build/__tests__/golden-expected scripts/build/minify.mjs scripts/build/stamp-html.mjs scripts/build/public-artifact.mjs scripts/perf/size-guard.mjs perf/size-budget.json HASTOBEFIXED.md`
- `git diff --check -- blog-module/blog-entries`
- `rg -n "[ \\t]+$" blog-module/blog/article-comments.js blog-module/blog/template.html blog-module/build/__tests__/golden-expected scripts/build/minify.mjs scripts/build/stamp-html.mjs scripts/build/public-artifact.mjs scripts/perf/size-guard.mjs perf/size-budget.json HASTOBEFIXED.md` returned no matches.
- `rg -n "[ \\t]+$" blog-module/blog-entries --glob 'article.html'` returned no matches.
- `git diff --check -- scripts/external-redirect.js scripts/offline-page.js standings/standings-nomodule.js 404.html offline.html ghostcar/index.html f1telemetry/index.html standings/index.html scripts/build/minify.mjs scripts/perf/size-guard.mjs perf/size-budget.json HASTOBEFIXED.md`
- `rg -n "[ \\t]+$" scripts/external-redirect.js scripts/offline-page.js standings/standings-nomodule.js 404.html offline.html ghostcar/index.html f1telemetry/index.html standings/index.html scripts/build/minify.mjs scripts/perf/size-guard.mjs perf/size-budget.json HASTOBEFIXED.md` returned no matches.
- `git diff --check -- scripts/hero-background-init.js scripts/hero-background-init.min.js scripts/hero-background-init.min.js.map index.html scripts/build/minify.mjs scripts/perf/size-guard.mjs perf/size-budget.json scripts/build/asset-manifest.json HASTOBEFIXED.md`
- `rg -n "[ \\t]+$" scripts/hero-background-init.js scripts/hero-background-init.min.js scripts/hero-background-init.min.js.map index.html scripts/build/minify.mjs scripts/perf/size-guard.mjs perf/size-budget.json scripts/build/asset-manifest.json HASTOBEFIXED.md` returned no matches.
- `git diff --check -- scripts/theme-init.js scripts/perf/web-vitals-beacon.js scripts/build/security-policy.mjs scripts/perf/consent-guard.mjs scripts/quality/static-source-guard.mjs scripts/build/minify.mjs scripts/build/stamp-html.mjs scripts/perf/size-guard.mjs docs/security-headers.md README.md perf/size-budget.json index.html standings/index.html blog-module/blog/index.html blog-module/blog/template.html generate.html housekeeping.html privacy/privacy.html privacy/terms.html blog-module/build/__tests__/golden-expected HASTOBEFIXED.md`
- `git diff --check -- blog-module/blog-entries`
- `rg -n "[ \\t]+$" scripts/theme-init.js scripts/perf/web-vitals-beacon.js scripts/build/security-policy.mjs scripts/perf/consent-guard.mjs scripts/quality/static-source-guard.mjs scripts/build/minify.mjs scripts/build/stamp-html.mjs scripts/perf/size-guard.mjs docs/security-headers.md README.md perf/size-budget.json index.html standings/index.html blog-module/blog/index.html blog-module/blog/template.html generate.html housekeeping.html privacy/privacy.html privacy/terms.html blog-module/build/__tests__/golden-expected HASTOBEFIXED.md` returned no matches.
- `rg -n "[ \\t]+$" blog-module/blog-entries --glob 'article.html'` returned no matches.

Problem:

The current CSP is improved, but it still relies on allowances that are broader than a mature static site should need long term.

Change:

- Self-host third-party helper scripts where practical, especially small utilities such as web-vitals.
- Externalize remaining inline boot scripts where possible.
- For inline JSON-LD or unavoidable inline snippets, generate deterministic CSP hashes during the build.
- Reduce inline style usage and style attributes where practical.
- Keep `script-src-attr 'none'` and continue banning inline event attributes.
- Move toward removing `unsafe-inline` from `script-src` first, then reduce `style-src` once styling is practical.
- Narrow image/connect/script hosts to the actual domains used by the static site.

Done when:

- Public pages run without inline event attributes.
- CSP no longer needs `unsafe-inline` for scripts.
- Remaining inline styles are limited to the current explicit style policy, and JSON-LD is the only allowed inline script type.
- Runtime audit confirms pages still work under the hardened policy.

### Step 9 - Professionalize The Standings Dashboard Code

Priority: P2

Problem:

The standings area is valuable, but several modules are still large and blend fetching, caching, data transforms, rendering, empty states, charts, table behavior, and UI lifecycle work.

Change:

- Extract shared table, chart, card, loading, error, and empty-state primitives.
- Separate pure data transforms from DOM rendering.
- Add unit tests for standings calculations and formatting.
- Give each tab a clear lifecycle: initialize, load data, render, refresh, and cleanup.
- Standardize fetch timeout, retry, cache, and fallback behavior.
- Add lightweight schema checks for API/cache data before rendering.

Done when:

- Standings tab modules are easier to review independently.
- Data calculations can be tested without a browser.
- Rendering failures show controlled empty/error states instead of partial broken UI.

### Step 10 - Add Data Contracts For Generated JSON And Caches

Priority: P2

Problem:

The static site depends on generated JSON and cache files, but their structure is not enforced as a stable contract. A malformed generated file can pass through until runtime.

Change:

- Define schema validators for `blog-index-data.json`, `blog-source-cache.json`, standings caches, YouTube snapshots, sitemap data, and public manifest data.
- Keep validators lightweight and compatible with the existing Node build.
- Validate schema version fields where they already exist.
- Fail the build when required fields are missing, wrong type, too large, or inconsistent.
- Add migration notes when a schema version changes.

Done when:

- Generated data breaks during build, not after deploy.
- Cache format changes are intentional and reviewed.
- Runtime code can assume validated data shapes.

### Step 11 - Harden Public Artifact QA

Priority: P2

Problem:

Public artifact validation already catches many bad files and references. The next polish layer is to validate page-level consistency and offline/deploy behavior.

Change:

- Validate canonical URLs, Open Graph URLs, JSON-LD URLs, sitemap entries, and actual output paths against each other.
- Validate that required files such as `404.html`, `robots.txt`, `sitemap.xml`, `CNAME`, icons, service worker, and manifest files are present when expected.
- Validate service worker precache/runtime references against files that actually exist in `dist/`.
- Add a small static route crawler over representative pages: home, blog index, article page, standings, contact, about, 404.
- Check that no author-only files, private notes, source maps, unminified generated assets, or scratch files can appear in `dist/`.

Done when:

- A bad internal link, missing social image, broken canonical URL, or stale service worker reference fails before deploy.
- GitHub Pages deploys only from a validated static artifact.

### Step 12 - Polish Visual, Accessibility, And Release Checks

Priority: P2

Problem:

The site has performance and runtime checks, but professional polish also needs repeatable visual and accessibility coverage for the pages users actually read.

Change:

- Keep Lighthouse and budget checks, but add a small Playwright smoke pass for critical routes.
- Check desktop and mobile viewports for article readability, navigation, consent UI, standings tabs, and 404 behavior.
- Add basic accessibility assertions for headings, landmark structure, focus order, visible labels, and contrast-critical controls.
- Keep visual screenshots as generated/ignored artifacts unless the team intentionally wants baselines.
- Add a manual release checklist for visual checks that are too subjective or flaky for CI.

Done when:

- Major UI regressions are caught before deployment.
- Manual QA is short, repeatable, and focused on high-value pages.
- Generated QA artifacts do not pollute source control.

### Step 13 - Document The Static Publishing Model

Priority: P2

Problem:

The repository now has a more professional split between source, generated files, author-only tools, public artifact output, and GitHub Actions. That split needs to be documented so future changes do not blur the boundaries again.

Change:

- Add or update a concise maintainer guide.
- Document which files are source, which are generated, and which are local-only.
- Document the author flow from local generation to PR publishing.
- Document the deploy flow from source to `dist/` to GitHub Pages.
- Document the quality commands and what each one protects.
- Add short decision records for important constraints: static hosting, no backend CMS, generated article output, public artifact validation, and local author tools.

Done when:

- A new maintainer can understand the project without reading old audit notes.
- A new author can create or edit an article without touching deployment internals.
- A reviewer can tell whether a changed file is source, generated, or local-only.

## Suggested Quality Gate

After each major step, the repository should be able to pass the relevant parts of this gate:

```bash
npm run build:public
npm run quality:static
npm run audit:runtime
npm run build:check
npm run test:blog
npm run test:author
npm run perf:budget
npm run perf:article-media
npm run perf:images
npm run test:consent
npm run perf:lighthouse
```

For the clean-checkout problems, run the same gate in a disposable fresh clone or temporary worktree, not in the current dirty development directory.

## Professional End State

The polished version of the project should feel like this:

- Readers still get a fast static site with normal pages and simple navigation.
- Authors still get approachable local/static tools for creating and maintaining articles.
- Maintainers get deterministic builds, clear source ownership, and smaller reviews.
- CI proves that the site can be rebuilt from tracked source alone.
- GitHub Pages receives only a validated `dist/` artifact.
- Security posture improves without sacrificing the static hosting model.
- Future work becomes smaller because large monoliths, hidden generated dependencies, and unclear file ownership have been removed.
