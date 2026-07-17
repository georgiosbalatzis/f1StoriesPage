# AGENTS.md

## Scope

These instructions apply to the entire `f1stories.github.io` repository. More specific `AGENTS.md` files, if added below this directory, override this file for their subtree.

## Project Model

- This is a static-first F1 publishing site built with HTML, CSS, vanilla JavaScript, and Node.js build scripts. Do not introduce a frontend framework, application server, or bundler without an explicit requirement.
- Production is the validated `dist/` artifact created by `npm run build:public`; the repository root is not the deployment boundary.
- Use Node.js 18 or newer and install locked dependencies with `npm ci`.
- Read `docs/static-publishing-model.md` before changing publishing, generated artifacts, public-file ownership, or deployment behavior.

## Repository Map

- `src/pages/`: editable HTML page templates. `partials/`, `scripts/`, `styles/`, `home.css`, and `theme-overrides.css`: shared browser assets and tooling.
- `config/site-config.json`: single source for public site/repository identity, authors, origins, routes, standings tabs, artifact ownership, and schema versions. Never place secrets here.
- `blog-module/build/`: blog build pipeline. `blog-module/blog/`: article runtime and templates. `blog-module/blog-entries/`: article sources, generated article HTML, and optimized media.
- `standings/`: standings page, runtime modules, tests, and generated data caches.
- `scripts/author/` and the author templates under `src/pages/`: local editorial tools; these are not public production pages.
- `scripts/build/`, `scripts/quality/`, and `scripts/perf/`: artifact generation, validation, security, quality, and performance gates.
- `docs/`: maintainer policies and architecture. Keep relevant documentation in sync with behavior changes.

## Source And Generated Files

- Edit source files and run the owning build command. Do not hand-edit minified assets, stamped asset hashes, generated blog indexes, generated cache data, `sitemap.xml`, or generated article HTML as the final solution.
- Generated article HTML, publishing data, and stamped source shells are intentionally committed. Minified browser assets, manifests, and other public-build output are ignored and must be reviewed through `dist/` instead.
- Never commit `dist/`, `node_modules/`, `perf/visual-qa/`, extracted article working files, local task notes, tokens, or private editorial state.
- Article media should be optimized AVIF/WebP. Do not add raw JPG, JPEG, PNG, or GIF article originals without a documented exception and an intentional media-budget update. See `docs/article-media-policy.md`.
- When a generated data contract changes, update both `scripts/build/validate-data-contracts.mjs` and `docs/data-contracts.md`.
- When public artifact ownership changes, update the artifact builder, its validator, and `docs/static-publishing-model.md` together.

## Implementation Conventions

- Preserve the existing no-framework, progressive-enhancement approach and browser compatibility of the surface being changed.
- New Node tooling uses ESM (`.mjs`); CommonJS remains only where worker/legacy compatibility requires it and should be migrated incrementally.
- Follow local formatting: two-space indentation is common in HTML, CSS, JSON, and JavaScript; use semicolons in JavaScript where surrounding code does.
- Prefer existing helpers and modules over duplicating logic. Keep modules concern-specific and avoid unrelated refactors.
- Treat external content and browser storage as untrusted. Preserve sanitization, URL validation, consent checks, and safe DOM construction. Do not add unsafe rendering sinks merely to satisfy a feature.
- Keep accessibility intact: semantic structure, keyboard operation, visible focus, control labels, reduced-motion behavior, and sufficient contrast.
- Use root-relative public URLs consistently with the existing page. Verify behavior through an HTTP server rather than opening pages with `file://`.

## CSS Ownership

- Put tokens, base elements, generic utilities, and truly shared components in `styles.css`.
- Put navigation UI only in `styles/shared-nav.css`; homepage layout in `home.css`; blog/archive styling in `blog-module/blog-styles.css`; article styling in the article CSS files; and standings styling in `standings/` CSS.
- Put light-theme overrides in `theme-overrides.css`, not default dark-theme declarations.
- Reuse design tokens before introducing raw colors, shadows, radii, or spacing values. See `docs/css-architecture.md` for the full ownership map.

## Build And Test Workflow

Run the smallest relevant checks while iterating, then expand verification in proportion to the change:

- Shared HTML/includes: `npm run build:html`.
- Blog pipeline or article rendering: `npm run build:blog` and `npm run test:blog`. Use `build:blog:force` only when incremental generation is insufficient.
- Author tooling: `npm run test:author`.
- Standings logic: `npm run test:standings`; refresh tracked data only when required with `npm run build:standings-data`.
- CSS/JS/public assets: `npm run build:assets`, then relevant quality or visual checks.
- Data caches/contracts: `npm run build:data-contracts`.
- Security or DOM-rendering changes: `npm run quality:static` and `npm run audit:runtime`.
- Article or public image changes: `npm run perf:article-media` and/or `npm run perf:images`.
- Public-boundary or deployment changes: `npm run build:public` and `npm run build:check`.
- Release-level or cross-cutting changes: `npm run verify`. This can be slow and requires a usable local Chromium installation for browser-based gates.

If a check cannot run because of network, browser, or environment limitations, report the exact command and limitation. Do not weaken budgets, baselines, or guards simply to make a check pass.

## Generated Diff Discipline

- Before building, inspect `git status` and preserve unrelated user changes.
- After building, inspect `git status` and `git diff`; ensure every generated change is explained by the source edit.
- Do not discard or overwrite user changes. Avoid broad cleanup, force rebuilds, and baseline updates unless the task calls for them.
- Update golden fixtures or performance baselines only when the output change is intentional, and review those updates as part of the implementation.

## Commit Guidance

- Keep commits focused and use the repository's conventional style where practical, such as `fix(scope): ...`, `feat(scope): ...`, `chore(scope): ...`, or `publish(blog): ...`.
- Do not add `[skip ci]` manually except for the automated generated-artifact maintenance flow that already owns that convention.
- Never commit credentials or GitHub author-tool tokens.
