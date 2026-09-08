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

## Rules

- Prefer tokens from `styles.css` before adding new raw colors, shadows, or radius values.
- Do not put page-specific selectors in `styles.css`.
- Do not put cross-site components in `home.css`, blog CSS, or standings CSS.
- Light-mode fixes belong in `theme-overrides.css`; default theme styles belong in the owning page/component CSS. Editorial routes own both theme palettes in `styles/editorial.css`.
- If a selector is needed by generated article HTML, update the template/build path first and let `npm run build:public` regenerate artifacts.
- Routine builds should not restamp every article runtime hash. Use `node scripts/build/stamp-html.mjs --stamp-articles` only for intentional article runtime migrations.
