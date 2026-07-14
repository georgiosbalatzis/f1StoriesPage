# CSS Architecture

The site is intentionally split by runtime surface. Keep selectors in the narrowest owning file so visual polish stays predictable and generated pages do not pick up unrelated regressions.

## Ownership

- `styles.css`: global design tokens, base elements, shared footer, modals, generic utilities, and no page-specific layout.
- `styles/shared-nav.css`: navbar, mobile menu, theme toggle, scroll-to-top, and reading progress only.
- `home.css`: homepage hero, editorial modules, media/statistics/sponsor sections, and homepage-specific responsive layout.
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
- Light-mode fixes belong in `theme-overrides.css`; default theme styles belong in the owning page/component CSS.
- If a selector is needed by generated article HTML, update the template/build path first and let `npm run build:public` regenerate artifacts.
- Routine builds should not restamp every article runtime hash. Use `node scripts/build/stamp-html.mjs --stamp-articles` only for intentional article runtime migrations.
