# Static Publishing Model

This is the maintainer guide for the F1 Stories repository. It documents how source files, generated files, author tools, CI, and GitHub Pages fit together.

## Operating Model

The repository is a static-first publishing system.

- Editable page templates live under `src/pages/`; shared tooling, styles, assets, and data sources remain in their dedicated repository directories.
- Some generated files are committed because local preview and review workflows need reviewable article output and data snapshots. Browser minification output is generated locally/publicly and is not tracked.
- Production is not served from the repository root. It is served from `dist/`, produced by `npm run build:public`.
- `dist/` is generated, validated, ignored by git, and uploaded as the GitHub Pages artifact.
- Author tools are local/editorial surfaces. They create content changes and pull requests, but they are not part of the production artifact or visitor navigation.

When in doubt, treat `npm run build:public` as the public boundary. Anything that reaches `dist/` must be intentional and visitor-facing.

## File Ownership

### Source Files

These files are edited by maintainers or author tooling and should be reviewed as source:

- `package.json` and `package-lock.json`
- `.github/workflows/*.yml`
- `partials/*.html`
- page templates under `src/pages/`, including `index.html`, `404.html`, and `offline.html`
- source CSS and JavaScript such as `home.css`, `theme-overrides.css`, `scripts/*.js`, `styles/*.css`, and `standings/**/*.js`
- blog build modules in `blog-module/build/`
- article template and runtime files in `blog-module/blog/`
- author-tool source in `src/pages/generate.html`, `src/pages/housekeeping.html`, `src/pages/statistics.html`, `scripts/author/`, and `styles/author/`
- public artifact and quality scripts in `scripts/build/`, `scripts/perf/`, and `scripts/quality/`
- policy docs in `docs/`

### Article Content

Article folders live under `blog-module/blog-entries/<entry-id>/`.

Tracked article content can include:

- exported text source used by the blog processor
- generated `article.html`
- optimized article media, primarily AVIF/WebP
- small data files used by a specific article, such as CSV input for tables

Raw JPG, JPEG, PNG, and GIF article originals are not default source assets. The current policy is zero tracked raw article images unless a review explicitly updates the media baseline. See `docs/article-media-policy.md`.

### Generated And Committed Files

These files are generated but intentionally committed:

- stamped HTML references in maintained shell pages
- `blog-module/blog-entries/*/article.html`
- `blog-module/blog-index-data.json`
- `blog-module/blog-index-page-1.json`
- `blog-module/blog-source-cache.json`
- `blog-module/home-latest.json`
- `assets/youtube-latest.json`
- `standings/standings-cache.json`
- `standings/dirty-air-cache.json`
- `standings/destructors-cache.json`
- `standings/debrief-cache.json`
- `sitemap.xml`

Minified siblings, source maps, compiled vendor CSS, and the asset manifest are generated into the local/public build graph and are intentionally ignored; they are not source-of-truth files.

Generated data contracts are documented in `docs/data-contracts.md` and checked by `npm run build:data-contracts`.

### Local Or Ignored Files

These files should not be reviewed as source and should not reach production:

- `node_modules/`
- `dist/`
- `perf/visual-qa/`
- `blog-module/blog-entries/*/extracted/`
- minified source maps
- local task notes such as `nextsteps.txt`, `laststeps.txt`, `appdev.txt`, and `context.md`
- imported DOCX working files unless a future policy explicitly changes that
- private/editorial tool state

The public artifact validator blocks many of these from `dist/`.

## Author Flow

Use `generate.html` for new article creation and `housekeeping.html` for edit/delete workflows. These pages are local-only and must be served with `node scripts/author/serve-tools.mjs`; they are never copied into `dist/`. Serve the repo locally instead of opening files with `file://`, because the tools and site use absolute paths.

```bash
node scripts/author/serve-tools.mjs
```

The local author flow is:

1. Open the generated local author URL.
2. Create or edit the article.
3. Add a fine-grained GitHub token when publishing.
4. Publish from the tool. The tool creates an `author/...` branch and opens a pull request through the GitHub API.
5. Review the PR like normal source work.
6. Merge to `main`.
7. The `Site Maintenance` workflow rebuilds generated blog artifacts and commits them back with `[skip ci]` when needed.
8. The Pages workflow deploys a validated `dist/` artifact after the maintenance run succeeds.

For manual local article work:

```bash
npm run build:blog
```

Use a full force rebuild only when the normal incremental path is not enough:

```bash
npm run build:blog:force
```

If article markup changes intentionally, update and review the golden fixtures:

```bash
node blog-module/build/__tests__/run-golden.js --update
npm run test:blog
```

## Build Flow

`config/site-config.json` is the single Node-owned manifest for site identity, repository metadata, authors, external origins, standings tabs, public routes, artifact ownership, and data-schema versions. `build:html` projects its secret-free browser subset to `scripts/site-config.js`; browser tools and the service worker consume that projection.

The documented local acceptance gate is:

```bash
npm run acceptance
```

It is the same logical sequence enforced by CI before an artifact can be deployed.

Author controllers are progressively decomposed around `scripts/author/core/`: draft state/validation, marker and image planning, preview rendering, ZIP import/export, and GitHub publishing. DOM controllers remain compatibility shells while each pure module gains focused tests.

The normal offline-capable build is:

```bash
npm run build
```

It expands shared HTML into the ignored `.build/pages/` staging tree, rebuilds the blog from local sources and snapshots, builds icons and Bootstrap, minifies browser assets, and stamps staged HTML references. It must not require network access. Blog rebuild selection uses content hashes over entry inputs, templates, builder code, and configuration.

Network-backed snapshot maintenance is explicit:

```bash
npm run refresh:data
```

`refresh:data` updates the YouTube and standings snapshots only; it is never part of `build`.

The publishable artifact build is:

```bash
npm run build:public
```

That command runs:

1. `npm run pages:guard`
2. `npm run build`
3. `npm run build:data-contracts`
4. `node scripts/build/public-artifact.mjs`
5. `node scripts/build/validate-public-artifact.mjs`

`public-artifact.mjs` assembles `dist/` from staged page shells, allowlisted public files, and referenced article/media assets. `validate-public-artifact.mjs` rejects private files, source files, stale references, missing required files, broken metadata URLs, bad sitemap links, stale service worker references, missing security policy output, and representative route failures.

## Deploy Flow

Production deploys use GitHub Actions.

- `.github/workflows/quality.yml` runs on pull requests and manual dispatch. It builds and validates, but it does not deploy.
- `.github/workflows/publish-blog.yml` owns generated content maintenance for blog artifacts, standings data, and the YouTube snapshot. It is the only workflow allowed to refresh external snapshots and commit their results.
- `.github/workflows/deploy-pages.yml` builds `dist/`, runs the deploy gate, uploads the Pages artifact, and deploys through `actions/deploy-pages`.

The deploy sequence is:

1. Source or generated maintenance changes land on `main`.
2. If article/build-source paths changed, `Site Maintenance` may rebuild generated artifacts and push a follow-up commit with `[skip ci]`.
3. `Deploy Pages` runs `npm run build:public`, `npm run quality:static`, and `npm run audit:runtime` against visitor-facing output. The broader performance and browser-interaction suite remains the release/quality workflow gate.
4. Only `dist/` is uploaded with `actions/upload-pages-artifact`.
5. GitHub Pages serves the uploaded artifact.

Never treat a root-level preview as proof that production will include the same files. Production includes what `dist/` includes.

## Quality Commands

Use the smallest command that covers the change while iterating, then use the full gate before release-level changes.

| Command | Protects |
| --- | --- |
| `npm run pages:guard` | Author-only and private pages do not slip into public page ownership. |
| `npm run build` | Shared HTML, YouTube snapshot, blog output, minified assets, stamped refs. |
| `npm run build:public` | Full public artifact assembly and artifact validation. |
| `npm run build:data-contracts` | Generated JSON/cache schema and version expectations. |
| `npm run build:check` | Generated drift against tracked outputs. |
| `npm run quality:static` | Static source rules and raw HTML rendering sink policy. |
| `npm run audit:runtime` | Runtime dependency and browser-surface audit checks. |
| `npm run test:blog` | Blog golden output and article-rendering regression coverage. |
| `npm run test:author` | Author helper modules and publishing helpers. |
| `npm run test:standings` | Standings core module behavior. |
| `npm run perf:budget` | Critical CSS/JS size budget. |
| `npm run perf:article-media` | Repository-side article media budget and raw image policy. |
| `npm run perf:images` | Public image delivery budget. |
| `npm run test:consent` | Consent banner and analytics behavior. |
| `npm run qa:visual` | Critical-route visual, accessibility, focus, contrast, and 404 smoke checks. |
| `npm run perf:lighthouse` | Lighthouse performance/accessibility/SEO budgets over the built artifact. |
| `npm run verify` | Full release gate. |

For clean-checkout confidence, run the full gate from a fresh clone or temporary worktree:

```bash
npm ci
npm run verify
```

## Review Rules

- Review source files for intent.
- Review generated files for expected drift.
- Do not manually edit minified files, stamped hashes, generated blog indexes, or cache outputs unless repairing a generated artifact with a follow-up build immediately after.
- Do not commit `dist/` or `perf/visual-qa/`.
- Do not add raw article images without updating the article media baseline and explaining the exception.
- Do not bypass `build:public` for deploy validation.
- When a generated data format changes, update `scripts/build/validate-data-contracts.mjs` and `docs/data-contracts.md` in the same change.
- When public artifact ownership changes, update `scripts/build/public-artifact.mjs`, `scripts/build/validate-public-artifact.mjs`, and this guide.

## Decision Records

### DR-001: Static Hosting

Decision: The site remains a static site deployed through GitHub Pages.

Reason: The product needs fast public pages, simple hosting, low operational burden, and reviewable content changes more than it needs a server runtime.

Consequence: Dynamic behavior must use build-time generation, client-side enhancement, public APIs, or local cache files. Server-only assumptions do not belong in runtime code.

### DR-002: No Backend CMS

Decision: The repository and local author tools act as the CMS boundary.

Reason: The editorial flow benefits from pull requests, review history, generated artifacts, and plain files. A backend CMS would add operational state that the current team does not need.

Consequence: Author tools must stay understandable, token handling must remain local/session scoped, and publishing must produce normal git changes.

### DR-003: Generated Article Output Is Committed

Decision: Article `article.html` files and blog index payloads stay committed.

Reason: Committed output makes review, GitHub Pages compatibility, clean-checkout behavior, and rollback simpler for this static publishing model.

Consequence: Generator changes must include expected generated drift and blog golden test updates when output changes intentionally.

### DR-004: `dist/` Is The Public Boundary

Decision: Production deploys only the validated `dist/` artifact.

Reason: The repository root contains private notes, author tools, source documents, build scripts, tests, raw inputs, and generated intermediates that should not be served to readers.

Consequence: Public file ownership must be allowlisted and validated. New public routes or assets require build and artifact validator updates.

### DR-005: Author Tools Stay Local

Decision: `generate.html`, `housekeeping.html`, and `statistics.html` remain local/editorial tools, not production pages.

Reason: They require a GitHub token and perform repository write operations. Static hosting does not provide authentication or server-side authorization.

Consequence: Author pages can exist in the repo for local use, but `build:public` must exclude them, their scripts/styles, and their dependencies from `dist/`.

### DR-006: Public Runtime Uses Browser-Native Code

Decision: Public pages use HTML, CSS, and vanilla JavaScript instead of a framework runtime.

Reason: The site benefits from low payload size, direct static hosting, simple debugging, and predictable page output.

Consequence: Shared behavior must be kept modular through local helper files and build scripts rather than through a client-side app framework.

## Related Docs

- `docs/article-media-policy.md`
- `docs/data-contracts.md`
- `docs/release-checklist.md`
- `docs/security-headers.md`
- `docs/architecture-decisions.md`
