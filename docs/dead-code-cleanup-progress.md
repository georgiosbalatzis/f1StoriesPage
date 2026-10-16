# Repository dead code cleanup — 2026-10-16

## Recovery checkpoint and current status

- Branch: `cleanup/repository-dead-code-20261015`.
- Baseline: `57b1231a`; verified cleanup commit: `6cb8282e`.
- Local recovery branch: `checkpoint/dead-code-cleanup-20261016` at `6cb8282e`.
- Worktree: `/Users/giorgos/WebstormProjects/f1StoriesPage-dead-code-cleanup`.
- The original `f1StoriesPage` worktree's pre-existing documentation and ignore-file edits/deletions were left untouched.
- Previous session: completed the removals, rebuilt committed outputs, and ran baseline, unit, integration, browser, and visual checks.
- Continuation: recovered the clean committed worktree; repeated dependency installation, all requested checks, artifact comparisons, and the final symbol/selector audit; completed the interrupted Lighthouse check. No additional source removals or regression fixes were needed.
- Source cleanup and local validation are complete. The final task response records the review PR and final branch head. No merge or deployment is part of this task.
- Local evidence, including baseline artifacts, logs, comparison scripts and screenshots: `/tmp/f1-dead-code-audit/`. These are validation artifacts, not repository dependencies.

## Scope and confidence

The audit covered the root shells, shared partials, frontend scripts, styles, author tools, blog build modules, standings core and lazy tabs, static resources, service-worker migration, SEO/security/consent code, package scripts, eight workflows and three composite actions. The initial inventory had 4,396 tracked files, including 463 HTML sources and 403 published article sources.

Reference checks included generated HTML, browser globals, DOM-created classes, dynamic imports, asset manifests, build entry points, npm commands, workflow callers and documented standalone tooling. Static non-reference results were candidates, not deletion decisions.

High-confidence removals were verified against the runtime/build graph and baseline artifact. Medium-confidence cases were investigated before deciding. Low-confidence compatibility and historical resources remain. Repeating the symbol, selector and keyframe audits after removal found no further confirmed safe removals within these checks.

## Every deleted tracked file

| File | Justification |
| --- | --- |
| `blog-module/blog/article-rail.js` | Its only feature populated `[data-rail-related]` from `.related-card-link`. No maintained page or template contains that target; current related stories are generated as `rr-next` markup. No published HTML loads the script. Removed its build, stamping and public-artifact registrations together. |
| `blog-module/blog/article-rail.css` | The obsolete side-rail stylesheet has no HTML load. Removed its companion runtime and obsolete injector, then rebuilt outputs through the existing pipeline. Its otherwise generic declarations were not loaded by the current pages. |

The two derived `article-rail.min.*` files disappear from a fresh `dist/`. Standings chunk filenames change through esbuild's normal content hashing. No page, article, historical image, editorial source, font, data snapshot or workflow was deleted.

## Other code removed

- `scripts/build/stamp-html.mjs`: `ensureArticleRailAssets`, its unused manifest requirements, parameters and call sites.
- `standings/core/cache.js`: uncalled `cacheDelete`; active expiry deletion, cache clearing, IndexedDB and storage migration remain.
- `standings/core/drivers-meta.js`: the permanently true `PREFER_LOCAL_HEADSHOT` setting and the unreachable configurable branch in `shouldPreferLocalHeadshot`. Local portrait preference and remote fallback behavior are unchanged. Added two regression tests covering aliases/cropping and unknown-driver fallbacks.
- `blog-module/build/index.js`: unused `AUTHORS` and `CARD_SIZES` imports.
- `blog-module/build/article-render.js`: a duplicate assignment of the mini-bar category; the identical later assignment remains.
- Obsolete selectors in `styles.css`, `theme-overrides.css`, `blog-module/blog-styles.css`, `blog-module/blog/article-styles.css`, `blog-module/blog/article-editorial.css` and `standings/standings.css`: former blog/episode cards, navigation aliases, CTAs/footer aliases, old article grid/rail, TOC/progress, related-card layouts, author links, section-tool aliases and an unused embed hint. Removed the newly orphaned `cardIn` animation on the second pass.
- Updated CSS ownership documentation. Regenerated the HTML asset references with the existing build pipeline; tracked HTML changes are exclusively asset hashes and generated modulepreloads.

Cleanup commit accounting: **893 source lines deleted, 52 added, net 841 source lines removed**, including the new tests. Across all files in that commit: 2,163 deleted and 1,321 added, net 842 lines removed. Generated reference replacement lines are not counted as eliminated source code. This audit report is additional documentation.

## Dependencies

**None removed.** Every direct dependency has an active caller:

| Dependency | Active use |
| --- | --- |
| `adm-zip`, `mammoth` | DOCX authoring/publishing pipeline |
| `sharp` | Image metadata, variants and public-artifact processing |
| `@fortawesome/fontawesome-free` | Build-time icon sprite sources |
| `bootstrap`, `sass` | Bootstrap stylesheet subset build |
| `esbuild`, `lightningcss` | Production JS/CSS generation; widget and source checks |
| `fast-xml-parser` | YouTube, telemetry and artifact validation |
| `chrome-launcher`, `playwright-core`, `puppeteer-core`, `lighthouse` | Active browser QA and performance tooling |

`package.json` and `package-lock.json` are unchanged. Temporary audit parsers were installed outside the repository only.

## Artifact and visual comparisons

| Emitted artifact class | Baseline bytes | Cleaned bytes | Reduction | Reduction in summed per-file gzip bytes |
| --- | ---: | ---: | ---: | ---: |
| JavaScript | 809,606 | 808,851 | 755 | 439 |
| CSS | 505,933 | 483,072 | 22,861 | 4,199 |
| HTML, including inline CSS | 108,907,716 | 101,672,803 | 7,234,913 | 1,246,920 |

These are artifact totals, not the transfer cost of one page. HTML savings largely come from removing obsolete styles repeated inline across articles.

- All **451 published HTML files** retain the same markup after accounting for rebuilt style blocks, asset hashes and modulepreloads.
- All **3,077 media/font/data/SEO/text files** compared with the baseline are byte-identical. All article URLs remain present.
- A paired browser comparison covered 14 routes at 390, 768 and 1440 pixels in both themes: **84/84 computed-style comparisons identical**, with no new page errors. External services were stubbed, time/randomness fixed, animations disabled and external frames masked for this comparison.
- **83/84 full-page screenshot pairs were pixel-identical on the first final capture**. The remaining standings capture was pixel-identical on repeat; a separate baseline control also passed. Earlier GPU image-raster differences reproduced with baseline-versus-baseline captures; final comparisons used software rendering.
- Repository visual QA: **72/72 captures plus all three interaction checks passed**, including mobile navigation, consent rejection and theme switching. This also checks page/console errors under the QA script's existing filters.

## Executed validation

Node **26.11.1** satisfies the Node 22+ requirement. `npm ci` succeeded in both sessions. The continuation reran every check in the first table against the recovered commit.

| Check | Baseline | Cleanup / continuation |
| --- | --- | --- |
| `build:public` | Pass | Pass; committed outputs synchronized |
| `build:check` | Pass | Pass |
| `check:assets` | Pass | Pass |
| `quality:static` | Pass | Pass |
| `audit:runtime` | Pass | Pass |
| `test:blog` | Pass | 241 tests plus golden snapshots pass |
| `test:author` | Pass | 6 tests pass |
| `test:standings` | Pass | 21 tests pass, including two added tests |
| `test:security` | Pass | 27 tests pass |
| `test:build` | Pass | 95 tests pass |
| `test:deployment` | Pass | 9 tests pass |
| `perf:budget` | Fail: 10 existing over-budget files | Same 10 files exceed existing limits; budgets were not relaxed |
| `verify` | Stops at existing `perf:budget` failure | Same stop; subsequent checks executed separately |

Additional completed checks:

- `qa:media`, `perf:article-media`, `perf:images`, `qa:author-images`: pass.
- `qa:edition`: 358/358 pass.
- `test:consent`: pass.
- `qa:audio-player`: pass.
- `qa:embed-dialog`: 136 checks pass.
- `qa:countdown`: 23 checks pass.
- `qa:visual`: pass as described above.
- Recorded-provider standings interaction QA: 7/7 cases pass across themes and widths.
- `perf:cls-tablet`: pass, including cold loads and edition-font swaps; all within 0.02.
- `qa:embeds`: 76/90 pass on both baseline and cleanup. All 14 failing cases and messages are identical: qualifying tooltip gutters at 320 pixels, and missing qualifying/tyre chart swipe hints. Live providers were reachable. These are existing failures, not waived passing checks.
- `perf:lighthouse`: the interrupted run was repeated to completion and **all route budgets passed**. Performance scores: Home 98, Blog 99, Standings 99, Article 97. Every route scored 100 for accessibility, best practices and SEO.

## Intentionally retained and follow-up

- Runtime-constructed standings rank classes, author image states and all lazy-loaded tabs remain; literal searches alone incorrectly suggest some are unused.
- Mixed `:is()` selector branches remain where deletion could alter specificity. Shared design tokens and escaping helpers with different behavior were not consolidated speculatively.
- Historical media, fallback portraits, image variants, font aliases, standalone profiling/authoring commands and opt-in cross-project deployment tooling remain. Missing direct imports do not establish that these resources are dead.
- `sw.js` and `scripts/sw-cleanup.js` remain: returning visitors still need the old worker/cache migration URL. No caching behavior was changed.
- Article migration/normalization paths, analytics compatibility selectors, security policies, consent and embed bridges remain.
- The existing size-budget failures and embed QA issues need separate fixes. `npm ci`/`npm audit` reports seven unchanged dependency advisories (three moderate, four high); dependency upgrades are outside this removal-only change.
- No regression was confirmed by the completed checks. Live provider coverage and the finite route/viewport matrix cannot prove every possible external-service state.
- Changes are for PR review only. Nothing has been merged or deployed.
