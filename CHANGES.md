# Changes Against Main

Comparison point: `origin/main` at `361771ac` (`chore(blog): auto-build generated artifacts [skip ci]`), fetched on 2026-07-01.

Current branch: `development`, including the article sync described below.

Before this file was added, the working tree differed from `origin/main` by 489 tracked files: 48 added, 345 modified, and 96 deleted, with 20,621 insertions and 58,752 deletions.

## Latest Main Articles Integrated

The latest article folders from `origin/main` were imported and rebuilt through this branch's blog pipeline:

| Entry | Title | Source from main | Current difference from main |
| --- | --- | --- | --- |
| `20260627G` | Cadillac και Audi: Η F1 γίνεται ξανά πόλεμος κατασκευαστών | `source.txt`, `1.webp` | `article.html` regenerated with this branch's hardened template |
| `20260627J` | Betcast: 267 Austria GP: Προβλέπουμε χαμό ; .. | `source.txt`, `1.webp` | `article.html` regenerated with this branch's hardened template |
| `20260628W` | O Ai Ogura και μια νίκη που δεν ήρθε από τύχη | `source.txt`, `1.webp`, `2.webp`, `3.webp` | `article.html` regenerated with this branch's hardened template |
| `20260630W` | Επιστρέφει η Red Bull στη μάχη της κορυφής | `source.txt`, `1.webp`, `2.webp`, `3.webp`, `4.webp` | `article.html` regenerated with this branch's hardened template |
| `20260701D` | Μέσα από το F1λτρο μου | `source.txt`, `1.webp` | `article.html` regenerated with this branch's hardened template |

Generated blog surfaces were refreshed after the import:

- `blog-module/blog/index.html`
- `blog-module/blog-index-data.json`
- `blog-module/blog-index-page-1.json`
- `blog-module/home-latest.json`
- `sitemap.xml`

The visible blog count changed from 91 to 96 posts. Recent article pages also changed where prev/next navigation and related article cards now include the imported posts.

Two existing optimized media files remain intentionally different from `main`: `blog-module/blog-entries/20260622W/3.webp` and `blog-module/blog-entries/20260626W/1.webp`. The `main` versions are larger, while this branch keeps the optimized media policy.

## Site Build And Deployment

- Adds a validated GitHub Pages artifact flow through `.github/workflows/deploy-pages.yml`.
- Expands `.github/workflows/quality.yml` so pull requests exercise the static build and quality gates.
- Introduces `npm run build:public` as the production boundary for `dist/` generation and validation.
- Adds public artifact validation, source ownership checks, generated drift checks, and data contract validation.
- Removes editor/project-local files from source control, including `.idea/*`.

## Blog Publishing Pipeline

- Reworks the blog generator around modular build code in `blog-module/build/`.
- Adds hardened article rendering for safer embeds, related links, prev/next links, image fallbacks, heading structure, and article metadata.
- Adds committed compact index payloads and source-cache handling for deterministic article output.
- Deletes legacy generated source such as `blog-module/blog-data.json`, `blog-module/blog-processor.legacy.js`, and checked-in minified browser outputs from `main`.
- Removes raw article image files that violate the media policy, while keeping optimized WebP/AVIF article media.
- Updates golden fixtures and blog tests for the new article output.

## Author Tools

- Converts `generate.html` and `housekeeping.html` into generated shells backed by modules under `scripts/author/`.
- Adds author helper modules for article folders, article source parsing, DOM helpers, image handling, media policy checks, GitHub publishing, dialogs, and session tokens.
- Adds focused Node test coverage for the author helper modules.
- Adds dedicated author styles in `styles/author/`.

## Standings

- Replaces the monolithic legacy standings script with smaller runtime modules and core helpers.
- Adds `standings/core/lifecycle.js`, `standings/core/payloads.js`, and `standings/core/rendering.js`.
- Adds `standings/standings-nomodule.js` for fallback loading.
- Updates standings tabs for safer rendering, payload handling, and cache reuse.
- Adds standings core tests.
- Keeps generated cache timestamps stable when cache content is unchanged.

## Runtime, Accessibility, And Performance

- Updates root, blog, standings, privacy, offline, and 404 page shells for the current static build model.
- Adds theme initialization, offline-page behavior, external redirect handling, and hero background initialization.
- Tightens cookie consent, service worker registration, shared navigation, and performance beacon behavior.
- Adds static rendering-sink checks, runtime audits, visual QA, article media budgets, public image checks, and Lighthouse guards.
- Updates size and media budgets in `perf/`.

## Documentation

- Adds `HASTOBEFIXED.md` as the completed roadmap record.
- Adds maintainer documentation:
  - `docs/static-publishing-model.md`
  - `docs/release-checklist.md`
  - `docs/data-contracts.md`
  - `docs/article-media-policy.md`
- Updates `README.md` and `docs/security-headers.md` for the new static publishing model.

## Removed Or Reclassified Assets

- Removes tracked local notes such as `appdev.txt` and `laststeps.txt`.
- Removes old raw background/logo/avatar assets from tracked source where they are no longer part of the validated public artifact.
- Removes checked-in minified JS/CSS artifacts that `main` tracked directly; this branch treats generated browser assets as build output.
- Removes the old SVG icon sprite in favor of the current generated asset flow.

## Verification Status

The article sync was rebuilt with:

```bash
npm run build:blog
```

The previous full roadmap state on this branch passed:

```bash
npm run verify
```

After the article sync, the focused blog build completed successfully and refreshed derived blog, sitemap, dirty-air, destructors, and debrief cache outputs.
