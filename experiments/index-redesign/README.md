# THE INDEX — redesign exploration (prototypes only)

Status: **design exploration, not a redesign authorization.** Five browser-rendered prototypes of
`/blog-module/blog/` for the owner to compare. Nothing here is published: `scripts/build/public-artifact.mjs` copies an
allowlist and `experiments/` is not on it. Production THE INDEX, its templates, tokens and build are unchanged.

Open locally: `node scripts/serve-site.mjs`, then <http://127.0.0.1:4173/experiments/index-redesign/>.

## A. Design audit (2026-11-03, live site + repository)

**What makes F1 Stories recognisable (must stay consistent)**

- **Two typefaces with fixed roles.** Barlow Condensed 700 for English display words and numerals (`THE PADDOCK.`,
  `TECHNICAL.`, `THE GRID.`, wire dates, stat strips). IBM Plex Sans 400/500/600 for every Greek headline and all
  reading text ([home.css:91](../../home.css), [design-tokens.md](../../docs/design-tokens.md)).
- **The red full stop.** `--signal` (#ed4c32) closes every display word. It also appears as 3 px bars, the
  pull-quote rule and CTA fills. Elsewhere red is scarce.
- **Paper and ink.** Warm paper (`--paper` #e9e3d6) and ink (`--ink` #20251f). Theme-following surfaces come from
  `body.editorial-page` ([styles/editorial.css](../../styles/editorial.css)). The homepage *alternates* paper and
  fixed-ink chapters. That alternation is the page rhythm.
- **Photography as structure.** The homepage uses full-bleed and 16:9 leads, and article pages open on a full-bleed
  dark cover. Archive material uses a real grayscale treatment (`grayscale(1) contrast(1.06)`).
- **Editorial furniture.** Uppercase tracked kickers (Plex 600, .13–.14em), big condensed date numerals in the wire,
  the article stat strip (category / date / reading / words), 1 px rules, square surfaces, no shadows.

**What makes THE INDEX feel disconnected**

- **Scale.** The masthead and headlines are modest. The lead image is a small thumbnail, so nothing on the page
  reaches the homepage's or articles' display scale.
- **Surface.** It is paper only: no ink chapter and no photographic pause. The page has one tempo from top to bottom.
- **Furniture.** The tab strip with counts, the boxed "ΝΕΟ" badges, the right-column section table and the month grid
  make discovery read as administration rather than editorial curation
  ([archive-editorial.css](../../blog-module/blog/archive-editorial.css)).
- **Hierarchy.** Ten recent stories have equal weight. Sections, authors and months are presented as data, not as
  doorways into the writing.

**What can legitimately change:** composition, density, photographic prominence, pacing, which discovery function
leads, and the primary interaction.

**What cannot change:** real content, URLs, taxonomy, authors, search, monthly archive, tokens and typefaces.

## B. The five concepts

| | Concept | Defining idea | Primary interaction | Photography |
| --- | --- | --- | --- | --- |
| A | The Paddock Continuation | The next chapter of the homepage: ink lead, LATEST. wire, TECHNICAL. spread, ARCHIVE. directory | Desk anchors | Three deliberate image moments |
| B | The Cover Library | An article-style cover workspace with an asymmetric contact sheet | Select a cover to preview it | Dominant, whole images |
| C | The Reading Desk | The article reading environment applied to discovery: narrow measure, search first | Title search | None above the fold; authors band |
| D | The Newsroom | A dense, ranked front page: lead / reporting / analysis columns, archive band, departments | Department disclosures | One lead image, small archive images |
| E | The Chronicle | Publishing history as the architecture: recent feature, month ledger by day, year index | Choose a month | One interlude per month |

All five use the same shared shell (`shared/`) and the same real content (`shared/content.json`, built by
`build-content.cjs` from the tracked published metadata). Only the page design differs between them.
