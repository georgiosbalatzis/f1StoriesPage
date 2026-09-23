# Repository Cleanup Report

Pass date: 2026-09-23. Base: `main` at `96e70a7aa` (clean working tree, in sync with `origin/main`).
This pass first cleaned the **current tree only** and reviewed it with no commits or pushes. The owner then chose to keep only the current product, so the result was published as a clean-baseline root commit. See "Outcome".

Companion plan for history size: [`HISTORY_REWRITE_PLAN.md`](./HISTORY_REWRITE_PLAN.md).

## Before

| Measure | Value |
|---|---|
| Checkout on disk (`du -sh .`) | 3.2 GB (includes `.git` 1.4 GB, `node_modules` 279 MB, ignored `perf/visual-qa/` 532 MB, ignored `dist/` 183 MB) |
| `.git` | 1.4 GB (`size-pack` 1.35 GiB, 79,640 packed objects, 3 packs) |
| Tracked files | 5,592 files, 855.5 MB |
| Largest tracked groups | `audit/` 463.1 MB (729), `blog-module/` 298.8 MB (4,386), `design-experiments/` 80.4 MB (141), `images/` 4.0 MB, `standings/` 3.3 MB, `graphify-out/` 2.9 MB |
| Branches | local `main` only; remote `main` only (ruleset "Force Protection"); `claude-redesign` and `visuals/polish` already deleted on GitHub; 0 open PRs; 0 tags; 0 forks |
| GitHub-reported repo size | 1,417,609 KB |

## Build contract (as verified)

```
SOURCE (hand/author-tool edited)
  partials/, root shells, *.css / *.js sources, blog-module/build/, blog/template.html,
  blog-entries/<id>/source.txt + media + csv, scripts/**, standings/**, workflows, docs/
        │
        ├─ build:html (include.mjs) ─────────────┐
        ├─ build:blog (blog-module/build) ───────┤→ GENERATED-AND-TRACKED
        ├─ build:youtube / build:standings-data ─┤   shell HTML include/stamp/sprite regions, blog-entries/*/article.html,
        └─ build:assets (sprite, bootstrap,      │   blog-index-data.json, blog-index-page-1.json, home-latest.json,
             minify, stamp-html) ────────────────┘   blog-source-cache.json, sitemap.xml, sw.js, assets/youtube-latest.json,
                                                     standings/*-cache.json
        └─ BUILD OUTPUT (ignored): *.min.css/js, *.map, asset-manifest.json, bootstrap.slim.css, sprite.svg, blog-data.json
                │
npm run build:public = pages:guard → build → data-contracts → public-artifact.mjs (allowlist) → validate-public-artifact.mjs
                │
              DIST (ignored) ──► deploy-pages.yml (upload-pages-artifact: dist) ──► GitHub Pages (build_type: workflow)
```

`public-artifact.mjs` walks the whole repo but copies only allowlisted/referenced files, so nothing under `audit/`, `design-experiments/`, `graphify-out/` or the root Markdown files ever reached production.

## Removed from current tree

Total: **960 tracked files removed, 556.3 MB** (553.4 MB deleted + 2.9 MB untracked but kept on disk).

Production equivalence proof: `dist/` was built with `node scripts/build/public-artifact.mjs` before and after the removals, and every file was hashed with SHA-256. **All 2,779 files are byte-identical**, and the file list is identical.

### 1. `audit/`: 729 files, 463.08 MB
- **Why it existed:** screenshot evidence for agent visual audits (`sweep/`, `final-sweep/`, `after/`, `tour/`, `states/`, `p0-*/p1-*/p2-*` PNGs), committed during the "Claude Rework" / "Complete Rework" commits.
- **Why not required:** nothing in scripts, workflows, HTML, JSON, the service worker or the build references `audit/`. The only references were in the audit Markdown documents removed below.
- **Verification:** `git grep` for `audit/` outside Markdown gave no hits, and no `path.join(…, 'audit')` exists in any script. `public-artifact.mjs` never copied it. The dist hash diff is identical.
- **Risk:** none for the site. The evidence remains in git history (and in the pre-rewrite backup, if history is later rewritten).
- **Prevention:** `.gitignore` now has root-anchored `/audit/`.

### 2. `design-experiments/`: 141 files, 80.41 MB
- **Why it existed:** a local 3-concept design exploration (concept-a/b/c HTML/CSS, Python loopback server on :4186, screenshots, research captures), described as "not a production redesign".
- **Why not required:** the redesign shipped inside the existing identity (PRs #185/#187/#188). No build, workflow or runtime file references the folder, and `public-artifact.mjs` excluded it by design.
- **Verification:** `git grep design-experiments` outside Markdown gave no hits. The Graphify graph shows its scripts (`serve.py`, `verify.mjs`, `interactions.js`, …) have no inbound edges from site code. The dist hash diff is identical.
- **Risk:** none for the site. It remains in history.

### 3. Obsolete root and perf documents: 10 files, 0.42 MB

| File | Class | Reason |
|---|---|---|
| `TASKS.md` (178 KB) | DELETE | Implementation plan for the redesign: 73 of 74 tasks are marked done. The one open item (POLISH-01, legal pages re-skin) is already recorded as design debt in `DESIGN.md` §B.4. |
| `VISUAL_AUDIT.md` | DELETE | One-off adversarial audit of branch `claude-redesign`. All findings were tracked and closed in TASKS.md Phase 6. |
| `REDESIGN_AUDIT.md` | DELETE | Audit source for TASKS.md. Its evidence lived in gitignored `perf/visual-qa/`. |
| `REDESIGN_VERIFICATION.md` | DELETE | Verification log for completed fixes. |
| `FINAL_VISUAL_CRITIQUE.md` | DELETE | Critique whose items were closed (F-16 was an owner decision). |
| `F1STORIES_AUDIT.md` | DELETE | 2026-09-16 audit. Its repo-junk items CLEAN-001–003 were already done; CLEAN-004 (duplicate media) was resolved in this pass (see "Kept"). |
| `DESIGN_CONCEPTS.md`, `DESIGN_COMPARISON.md` | DELETE | Documentation of the `design-experiments/` concepts removed above. |
| `REDESIGN_BASELINE.md` | ARCHIVE → removed; knowledge moved | This was a snapshot at `8932a1d50`. Its unique maintainer knowledge was moved into canonical docs (below). |
| `perf/phase9-visual-qa.md` | DELETE | One-off QA run log (2026-06-01) pointing to gitignored screenshots. |

Knowledge preserved before removal:
- `docs/css-architecture.md` gained a **Runtime Layering** section (per-route CSS load order, author-tool-only legacy CSS) and the **"nav is not a partial"** maintenance rule, both from REDESIGN_BASELINE §1–2.
- `docs/static-publishing-model.md` and `README.md` were corrected. REDESIGN_BASELINE §3 ⚠️1 showed that both claimed `*.min.*` and `asset-manifest.json` are committed, but `.gitignore` excludes them and `git ls-files '*.min.*'` is 0.
- `DESIGN.md` now points to the canonical docs instead of `REDESIGN_BASELINE.md`.

### 4. Raw article originals: 14 files, 6.41 MB
- `blog-module/blog-entries/20250403G/2.png` (164531 B)
- `blog-module/blog-entries/20260403W/1.jpg` (47252 B)
- `blog-module/blog-entries/20260405G/1.png` (1219445 B)
- `blog-module/blog-entries/20260407W/1.jpeg` (18113 B)
- `blog-module/blog-entries/20260408J/1.jpg` (128226 B)
- `blog-module/blog-entries/20260409W/1.jpg` (24204 B)
- `blog-module/blog-entries/20260414W/1.jpg` (360691 B)
- `blog-module/blog-entries/20260416G/1.jpg` (46719 B)
- `blog-module/blog-entries/20260416W/1.jpg` (1078224 B)
- `blog-module/blog-entries/20260417W/1.jpg` (199529 B)
- `blog-module/blog-entries/20260418W/1.jpg` (115634 B)
- `blog-module/blog-entries/20260420W/1.jpg` (133258 B)
- `blog-module/blog-entries/20260421-2J/1.jpg` (25380 B)
- `blog-module/blog-entries/20260423G/1.png` (3158868 B)

- **Why they existed:** upload originals for hero/background slots 1/2 before conversion.
- **Why not required:** every one has `N.webp`, `N.avif`, `N-mobile.*` and `N-card.webp` siblings.
  - `CONFIG.IMAGE_FORMATS` is `['webp','jpg','jpeg','png','gif']`, so `findImageByBaseName` always picks the `.webp`.
  - `convertHeroImages()` reads a raw file only when `N.webp` is missing.
  - `generate-image-variants.js` reads only `.webp`.
  - No `article.html`, index JSON or manifest references them (the one apparent hit, `2.png`, was a substring of `favicon-32.png`).
  - `docs/static-publishing-model.md` and `docs/article-media-policy.md` already state that the policy is **zero tracked raw article images**.
- **Verification:** reference scan, processor/variant-script code review, dist hash diff identical. `perf:article-media` only fails on growth, and shrinking cannot trip it.
- **Risk:** re-encoding a hero from the original is no longer possible from the current tree. The originals remain in history/backup.

### 5. Unused content images in source-less legacy articles: 40 files, 2.88 MB
- `20250329G/`: 4.webp 4.avif 4-sm.webp 4-sm.avif
- `20250403G/`: 3/4/5 × (.webp, .avif, -sm.webp, -sm.avif)
- `20250523W/`: 3 × 4 variants
- `20250529W/`: 3 × 4 variants
- `20250612W/`: 3/4 × 4 variants
- `20260326W/`: 1000005583 × 4 variants (byte-identical copy of that folder's `3.webp`)
- `20260329G/`: 4 × 4 variants

- **Why they existed:** gallery/content uploads for articles whose committed HTML never used them.
- **Why not required:**
  - None of the 7 `article.html` files reference them (each uses only its hero, or `3.*`).
  - No index JSON, sitemap or `blog-source-cache.json` field points at them.
  - None of the 7 folders has a `source.txt`/`.docx`, and all 7 are in `blog-source-cache.json`. `classifyEntry()` therefore returns `cached-only / reuse-cached` regardless of `hasGalleryImages`, so the files can never feed a rebuild.
  - `public-artifact.mjs` did not ship them.
- **Verification:** as above, plus dist hash diff identical.
- **Risk:** low. The editorial content survives in history.

### 6. Unused image variants: 11 files, 0.15 MB
- `images/icons/{apple-touch-icon,favicon-16,favicon-32,icon-192,icon-512}.webp`: every page, `manifest.json` and `sw.js` reference the `.png` icons only.
- `images/sponsors/{Balatzis,BalatzisDomika,GrandRealm,am,bedhome,ps}.avif`: the homepage uses `images/sponsors/normalized/*.webp`, which `normalize-sponsors.mjs` builds from the sibling `.webp` (kept).
- **Verification:** no full-filename reference anywhere. No script constructs these paths (checked every `${…}.webp|avif` builder and every `.replace(…webp|avif…)`). Not copied into dist.

### 7. Dead scripts: 2 files
- `scripts/build/migrate-fa-markup.mjs`: completed one-shot Font Awesome `<i>` → SVG sprite migration. No `<i class="fa…">` remains in sources, and nothing references the script.
- `blog-module/convert-to-avifwebp.sh`: a macOS/Homebrew converter that was superseded by `generate-image-variants.js` and the processor. It is not wired into any npm script or workflow, and it uses GNU-only `find -printf`. The README mentions were removed.

### 8. `graphify-out/`: 13 files, 2.93 MB, **untracked, not deleted**
- This is the local code-graph cache. Its stat index holds machine-specific mtimes, and it was built at `8932a1d5`, which is already stale.
- Removed from the index with `git rm --cached`, so the local copy remains for `/graphify`. `.gitignore` now has `graphify-out/`.

### `.gitignore` changes
```
# Local QA / audit evidence (screenshots, probes) — never source
perf/visual-qa/
/audit/

# Local code-graph cache (graphify); regenerate with /graphify
graphify-out/
```
This also fixes a misplaced comment ("Public deploy artifact" was sitting above `perf/visual-qa/`). No broad patterns were added.

## Kept despite appearing generated or redundant

| Item | Why it stays |
|---|---|
| 353 `blog-entries/*/article.html` | Checked by `generated-drift-guard.mjs` (`article.html` regex), and the only copy of the body for ~203 source-less articles (DR-003). |
| Shell HTML include/stamp/sprite regions, `sw.js`, `sitemap.xml` | Listed in `GENERATED_EXACT` in the drift guard, and required by `validate-public-artifact.mjs`. |
| `blog-index-data.json`, `blog-index-page-1.json`, `home-latest.json`, `blog-source-cache.json` | Data contracts (`validate-data-contracts.mjs`). `blog-source-cache.json` drives `cached-only` classification in CI, where `blog-data.json` does not exist. |
| `standings/*-cache.json`, `assets/youtube-latest.json` | Committed by `Site Maintenance` jobs and required in dist. |
| All `1/2` hero variants (`-mobile`, `-card`, full), including 1,248 not named in any `article.html` | Derived at runtime by `cardImageSrcset()` (taxonomy.js) and shipped by the `public-artifact.mjs` sibling rules. |
| `-sm` content variants | Emitted into `srcset` by `buildPictureHtml()`, and counted in the article media budget. |
| 602 byte-identical media groups (63.5 MB checkout duplication, e.g. `1.webp == 2.webp`) | Required by the naming convention (thumbnail vs background slot), and each copy is referenced. **Git already stores identical content as one blob, so deduplicating would save 0 bytes of `.git`** while forcing article HTML rewrites. |
| `images/sponsors/*.webp` | Input to `normalize-sponsors.mjs`, which runs on every `build:assets`. |
| `images/drivers/*.webp`, `images/teams/*.webp` | Dynamic paths (standings), shipped by the `public-artifact.mjs` rules. |
| `assets/fonts/licenses/*-OFL.txt` | OFL licence obligation, shipped by an explicit rule. |
| `styles/layers.css`, `styles/critical-*.css` | `@import`ed by `styles.css`, or wired into `stamp-html.mjs`, `minify.mjs` and the size budget. |
| `DESIGN.md`, `KEEP.md` | Active design specification and preservation checklist (root placement expected by design tooling). |
| `docs/*.md`, `perf/baseline-2026-04-20.md` | Canonical maintainer docs. The baseline is referenced by README's performance section. |
| `perf/*.json`, `quality/rendering-sinks-baseline.json` | Guard baselines read by the scripts. |

## Uncertain candidates (left untouched)

| Item | Why it was left |
|---|---|
| `blog-module/blog-entries/20250421J/F1 Stories Πρόσφυση.odt` (22 KB) | Not a build input (`.odt` isn't a source type), but it is the only original source for that article. The owner should decide. |
| `scripts/build/split-standings-css.mjs` | A one-shot splitter that is documented as safely re-runnable and cited in every `standings/tabs/*.css` header. Removal is a judgement call. |
| `scripts/build/optimize-logo.mjs` (`npm run build:logo`) | Its input `images/logo.png` is gitignored and local only, so it cannot run from a clean clone. Removing it would change `package.json` (`build:images`). |
| `styles/critical-standings.css` | "No longer inlined" per the earlier baseline, but still wired into `stamp-html.mjs`, `minify.mjs`, `size-guard.mjs` and the budget. Removal changes the build contract. |
| Stale doc statement DR-005 ("author tools are excluded from dist") | `pages-source-guard.mjs` requires the opposite, and `dist/` does contain them. This is a policy/doc decision, so the doc wasn't changed. |

Local-only space that is ignored and not part of the repo, left alone:
- `perf/visual-qa/`: 532 MB of QA screenshots, plus local audit tooling that exists nowhere else.
- `dist/`: 183 MB, regenerable.
- `node_modules/`: 279 MB, regenerable.
- `.git/filter-repo/analysis/`: 5 MB, created by this pass's read-only `git filter-repo --analyze`. Safe to `rm -rf .git/filter-repo`.

## After

| Measure | Value |
|---|---|
| Checkout on disk | 2.7 GB (was 3.2 GB) |
| `.git` | 1.4 GB, unchanged: deleted files remain in history until the history plan is executed |
| Tracked files | 4,632 files, 299.2 MB (was 5,592 / 855.5 MB) → **556.3 MB removed from the tracked tree** |
| Public artifact | 2,779 files, byte-identical to before |

### Verification

`npm ci` passed.

`npm run verify`: **FAIL, pre-existing, not caused by the cleanup.** Each failing gate was reproduced on a pristine `git worktree` of `96e70a7aa`, with identical results.

| Gate | Result | Cause |
|---|---|---|
| `build:public` (pages:guard, build, data-contracts, public-artifact, validator) | PASS | |
| `build:check` | FAIL, pre-existing | A fresh build drops 4 unused icon symbols (`fa-eye`, `fa-pen`, `fa-telegram-plane`, `fa-threads`) from the inline sprite in 10 committed shells. The pristine HEAD produces a **byte-identical** drift diff. The drift was reverted, so it is not part of this change. Fix: commit the rebuilt shells. |
| `quality:static`, `audit:runtime` | PASS | |
| `test:blog`, `test:author`, `test:standings` | PASS | |
| `perf:budget` | FAIL, pre-existing | `shared-nav.js` +12.5%, `shared-nav.min.js` +11.5%, `blog-loader.js` +11.6%, `build/index.js` +11.1%, `fetch-youtube.mjs` +18.1%. Identical on pristine HEAD, and none of these files were touched. Budgets were **not** updated. |
| `perf:article-media` | FAIL, pre-existing | Totals exceed the 2026-09-13 baseline, and `20260918W/1.webp` and `9.webp` exceed 1 MB. The pristine HEAD fails the same way at 3,756 files / 267.5 MB. The cleanup **reduced** this to 3,702 files / 258.2 MB. |
| `perf:images`, `test:consent`, `qa:visual` | PASS | |
| `perf:lighthouse` | FAIL, pre-existing | Performance 79–86 < 95, LCP 3.6–3.9 s > 2.5 s, standings CLS 0.146. It runs against `dist/`, which is byte-identical to the pre-cleanup artifact, so the cleanup cannot affect it. |

No guard, test, budget or validation was weakened.

## Branch recommendations

| Branch | State | Recommendation |
|---|---|---|
| `main` (local + origin) | Only branch. Ruleset "Force Protection" (id 14773308) blocks deletion and non-fast-forward; Repository Admin bypass is `always`. | Keep. |
| `claude-redesign` | **Already deleted on GitHub** (last merged via PR #188). No local copy. | Nothing to delete. |
| `visuals/polish` | **Already deleted on GitHub.** No local copy. | Nothing to delete. |
| `refs/pull/*` (188 read-only GitHub refs) | Cannot be deleted by the owner. They keep all old objects alive server-side. | See `HISTORY_REWRITE_PLAN.md` §Remote references. |

`git fetch --prune` already removed the stale remote-tracking refs locally. No remote branch deletions are needed.

## Outcome

On owner instruction ("preserve only the current working product"), this cleaned tree was published as a **clean baseline**: a single root commit that replaces all previous history on `main`.
- The baseline also includes the refreshed icon-sprite shells (the 10 files flagged by `build:check`), so the new root commit passes the drift guard.
- The full pre-baseline history is kept offline at `~/Backups/f1stories-20260923/`. See `HISTORY_REWRITE_PLAN.md` → Execution record.
