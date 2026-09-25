# CSS Architecture

The site is intentionally split by runtime surface. Keep selectors in the narrowest owning file so visual polish stays predictable and generated pages do not pick up unrelated regressions.

## Ownership

- `styles.css`: global design tokens, base elements, shared footer, modals, generic utilities, and no page-specific layout.
- `styles/shared-nav.css`: navbar, mobile menu, theme toggle, scroll-to-top, and reading progress only.
- `styles/editorial.css`: shared paper/ink/vermilion tokens, both themes, typography, navigation, footer, consent and motion rules for `body.editorial-page`. Home, archive, standings and articles load this after structural styles.
- `styles/home-fonts.css`: self-hosted Barlow Condensed, GFS Didot and IBM Plex Sans, shared by the editorial routes.
- `home.css`: homepage cover, journal, podcast/data links, team, sponsors and contact layout.
- `blog-module/blog/archive-editorial.css`: archive masthead, search/filter controls, editorial story layout and pagination.
- `blog-module/blog/article-editorial.css`: article cover, long-form typography, reading rail, embeds and related stories.
- `standings/standings-editorial.css`: standings masthead, timing tables, controls and report skins.
- Editorial routes do not load `theme-overrides.css`; their palettes are owned by `styles/editorial.css`.
- `blog-module/blog-styles.css`: blog archive and homepage blog card components shared with the archive.
- `blog-module/blog/article-styles.css`: article page reading layout, article hero, body typography, related articles, comments, and article-only mobile behavior.
- `blog-module/blog/article-rail.css`: desktop/tablet article rail and rail-only related/tag presentation.
- `standings/standings.css`: standings shell, tables, report selector, and standings page layout.
- `standings/standings-polish.css`: standings interaction polish that depends on `standings-polish.js`.
- `theme-overrides.css`: light theme token overrides and unavoidable light-theme fixes. Do not add dark-mode defaults here.

## Runtime Layering

Load order per public route (minified, `?v=` stamped). Every page's `<head>` runs `scripts/perf/error-beacon` and `scripts/theme-init` first.

| Route | CSS, in load order |
|---|---|
| `/` | bootstrap.slim → `styles` → `styles/editorial` → `home` → `styles/shared-nav` → `styles/home-fonts` |
| `/blog-module/blog/` | home-fonts → bootstrap.slim → `styles` → `blog-module/blog-styles` → shared-nav → editorial → `blog/archive-editorial` |
| article (`template.html`) | home-fonts → bootstrap.slim → `styles` → blog-styles → `blog/article-styles` → `blog/article-rail` → shared-nav → editorial → `blog/article-editorial` |
| `/standings/` | home-fonts → bootstrap.slim → `styles` → shared-nav → `standings` → `standings-polish` → editorial → `standings-editorial` (+ lazy `standings/tabs/*.css`) |
| `/authors/` | `styles` → home-fonts → editorial → shared-nav → `styles/authors` |
| `/privacy/*.html` | home-fonts → bootstrap.slim → `styles` → shared-nav → editorial → `styles/legal.css` (unminified, no `?v=`) |

`theme-overrides.css`, `styles/critical-common.css` and `styles/fonts.css` are loaded only by the author tools (`generate.html`, `housekeeping.html`, `statistics.html`).

The `.blog-nav` markup is not a partial: it is copied into every shell page and baked into every committed `article.html`. Prefer CSS-only nav changes; a markup change means editing the shells plus `blog-module/blog/template.html` and migrating articles through `scripts/build/article-editorial.mjs`.

## Rules

- Prefer tokens from `styles.css` before adding new raw colors, shadows, or radius values.
- Do not put page-specific selectors in `styles.css`.
- Do not put cross-site components in `home.css`, blog CSS, or standings CSS.
- Light-mode fixes belong in `theme-overrides.css`; default theme styles belong in the owning page/component CSS. Editorial routes own both theme palettes in `styles/editorial.css`.
- If a selector is needed by generated article HTML, update the template/build path first and let `npm run build:public` regenerate artifacts.
- Every build restamps article runtime hashes (`scripts/build/stamp-html.mjs`), so a change to a shared stylesheet or script rewrites the `?v=` in every article that references it. Expect those article diffs in the same commit.
