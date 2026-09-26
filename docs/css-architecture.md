# CSS Architecture

The site is split by runtime surface. Each rule has one owner: put a selector in the narrowest file that owns it, and never add a stylesheet whose job is to override another one.

## Ownership

- `styles.css`: global base: reset, form-control font inheritance, the 16px form-text floor on touch screens, `.visually-hidden`, legacy tokens and generic utilities. No page-specific layout.
- `styles/shared-nav.css`: the masthead nav, mobile menu, theme toggle, scroll-to-top and reading progress, including their touch sizes and notch safe-area insets.
- `styles/editorial.css`: the editorial shell for every `body.editorial-page`: paper/ink/signal tokens and both themes, the **category ink map**, the **author accent map**, typography, container, footer (colophon), consent bar, motion rules, and the legacy aliases still read by article and standings CSS.
- `styles/home-fonts.css`: self-hosted Barlow Condensed and IBM Plex Sans.
- `home.css`: homepage cover, journal, podcast/data links, team, sponsors and contact.
- `blog-module/blog/archive-editorial.css`: the Journal (`/blog-module/blog/`): masthead, front page, recent list, long reads, archive tools and ledger. It depends on no legacy stylesheet and no Bootstrap.
- `blog-module/blog/article-styles.css`: article structural layout (legacy layer, shrinking).
- `blog-module/blog/article-rail.css`: desktop/tablet article rail.
- `blog-module/blog/article-editorial.css`: article cover, long-form typography, figures, embeds, related stories and the closing author card.
- `standings/standings.css`, `standings/standings-polish.css`, `standings/standings-editorial.css`: standings shell, interaction polish, editorial skin.
- `styles/authors.css`: `/authors/`.
- `styles/legal.css`: privacy and terms.
- `blog-module/blog-styles.css`: **author tools only** (`generate.html`, `housekeeping.html` article preview: CSV tables, YouTube embeds, figures). No reader-facing page loads it; it ships in `dist/` only alongside the author tools (`AUTHOR_TOOL_FILES` in `scripts/build/public-artifact.mjs`).
- `theme-overrides.css`, `styles/fonts.css`, `styles/critical-common.css`: author tools only.
- `styles/vendor/bootstrap.slim.css`: a generated subset. The Journal and `/authors/` do not load it. Article pages still use its grid (`.row`, `.col-*`, `.mb-4`), home's scripts `.col-md-6`, `.col-lg-4`, `.text-center` and `.alert-danger`, and the legal pages `.mt-5`/`.py-5`. Remove those uses before dropping it from a route.

## Semantic tokens

**Category inks** (`styles/editorial.css`). `blog-module/taxonomy.js` names each public category's kind (`categoryKind`: news, analysis, technical, history, opinion, betting, drivers, teams, season). Markup carries it as `data-kind` (Journal) or `data-article-kind` (article container and sticky mini-bar). The map sets two custom properties on those elements:

- `--kind`: the mark (rules, dots, underlines)
- `--kind-text`: the readable label colour (≥4.5:1 on paper and charcoal)

Light mode prints both in one ink per category; dark mode uses a lighter mark and a lighter text tone. A story's colour comes from its primary category (the author's chosen `category`, listed first in `blog-index-data.json`). Secondary categories stay neutral text. Never colour a headline, card background or button with a category ink.

**Author accents** (`styles/editorial.css`). `taxonomy.js` `AUTHORS[].slug` → `[data-author-slug]` → `--author-accent`, one value per theme. Used only in author blocks: the article's closing author card (3px bottom rule, name underline on hover), the Journal's writer view (top rule, selected-writer underline) and the `/authors/` number badge, selected-profile rule and link hovers. Never on category labels or archive bylines.

## Runtime layering

Load order per public route (minified, `?v=` stamped). `scripts/perf/error-beacon` and `scripts/theme-init` run in every `<head>`.

| Route | CSS, in load order |
|---|---|
| `/` | bootstrap.slim → `styles` → `styles/editorial` → `home` → `styles/shared-nav` → `styles/home-fonts` |
| `/blog-module/blog/` | home-fonts → `styles` → shared-nav → editorial → `blog/archive-editorial` |
| article (`template.html`) | home-fonts → bootstrap.slim → `styles` → `blog/article-styles` → `blog/article-rail` → shared-nav → editorial → `blog/article-editorial` |
| `/standings/` | home-fonts → bootstrap.slim → `styles` → shared-nav → `standings` → `standings-polish` → editorial → `standings-editorial` (+ lazy `standings/tabs/*.css`) |
| `/authors/` | `styles` → home-fonts → editorial → shared-nav → `styles/authors` |
| `/privacy/*.html` | home-fonts → bootstrap.slim → `styles` → shared-nav → editorial → `styles/legal.css` (unminified, no `?v=`) |

## Shared markup

The masthead nav and the footer are build-time partials: `partials/nav.html` and `partials/footer.html`, expanded by `scripts/build/include.mjs` into every public shell and every article (`<!-- @include partials/nav.html -->`). The active section comes from the page context in `include.mjs` (`navHome`, `navJournal`, `navStandings`, `navAuthors`); articles belong to the Journal. Change the nav or footer in the partial only; the next `npm run build:html` updates all pages. Articles rendered before the partial existed are migrated by `include.mjs` the first time it sees them.

## Rules

- One owner per rule. If a route needs a rule another stylesheet provides, move the rule to its owner rather than loading or overriding that stylesheet.
- Prefer tokens (`styles/editorial.css`) over raw colours. Category and author colours are only ever read through `--kind`, `--kind-text` and `--author-accent`.
- Do not put page-specific selectors in `styles.css`, or cross-site components in route stylesheets.
- Editorial routes own both theme palettes in `styles/editorial.css`; `theme-overrides.css` is for author tools only.
- If a selector is needed by generated article HTML, update the template/build path first and let `npm run build:public` regenerate artifacts.
- Every build restamps article runtime hashes (`scripts/build/stamp-html.mjs`), so a change to a shared stylesheet or script rewrites the `?v=` in every article that references it. Expect those article diffs in the same commit.
