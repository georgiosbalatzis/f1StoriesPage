# F1Stories — design comparison

Three directions for the same publication. No ranking or winner is implied.

Open **http://127.0.0.1:4186/** for the local comparison. Start it with `python3 design-experiments/serve.py` from the repository root. The review offers synchronised homepage/article/Data Hub screenshots, mobile and desktop switches, direct page links, full-page screenshots and working 390/768/1440px iframe previews.

## A — Grand Prix Journal

**Thesis:** A Greek motorsport journal worth settling down to read, giving the human story the authority of a magazine cover.

Defining characteristics: centred magazine masthead, full-width photographic opening, offset paper headline, asymmetrical journal spread, text-only supporting index, generous section spacing, and a serif article with a quiet margin index. Media appears as an editorial spread; data reads like a statistical annual. Existing illustrated presenter avatars are presented without pretending they are portraits.

Typography: locally hosted GFS Didot, including Greek and Greek Extended, for display/body; IBM Plex Sans Greek/Latin for metadata and controls. The actual Mika Salo title, long Greek words, accented lowercase and mixed Latin/Greek names were inspected at 390, 768 and 1440px. This is a pronounced literary choice, with a different texture from the current site.

Hierarchy: cover → asymmetric Journal → technical feature → BetCast spread → championship reference → people → Team Radio/contact → real partners/footer.

Strengths: human editorial identity, distinct reading rhythm, meaningful photographic scale, clear separation between feature and supporting story. Long text is given generous line height and a constrained reading measure.

Tradeoffs: slower discovery of large numbers of stories; the pronounced Greek serif texture may feel formal to readers used to the current sans face. Wide covers require deliberate crop decisions. Data is comfortably legible but takes more vertical space than C.

Implementation complexity: **moderate**. Static templates fit the existing publishing architecture. Production work would concentrate on editorial placement rules, responsive image selection, additional article content types and testing the serif across the wider archive.

Still to design: archive filtering/search, article layouts with complex embeds and large tables, a real magazine commissioning/placement workflow, alternate cover ratios and a complete accessible dark edition if desired.

## B — Paddock

**Thesis:** A media house where written stories, BetCast and familiar voices belong to the same conversation.

Defining characteristics: compact station header, dark aubergine programming surface, story/programme co-lead, peach episode panel, compact news sequence, illustrated presenter roster, championship summary and an intentionally light reading canvas. BetCast is a single prominent programme destination rather than a repeated tile further down the page.

Typography: self-hosted Roboto 400/600/700 with native Greek and Greek Extended subsets. Bold sentence-case headlines give the Greek voice a direct character; article body text returns to a regular weight and open line height.

Hierarchy: lead story + BetCast → latest editorial sequence → technical/news pair → people → Data Hub summary → Team Radio/contact → partners/footer.

Strengths: immediate visibility for the media/community side of F1Stories; strong author and programme credits; good sequencing from listening to reading; substantial above-the-fold content. The article changes pace through a dedicated light reading surface.

Tradeoffs: a stronger visual atmosphere; more editorial responsibility to choose the right lead episode; illustrated avatars vary in source proportions. The dark/light surface transition is a fixed design decision, not a user-selectable theme.

Implementation complexity: **moderate to higher**. It requires robust episode selection/fallback rules, consent-aware embeds, and composition rules for weeks when a programme and lead story have different relevance. Live programming would need genuine status data before a live indicator could be used.

Still to design: programme archive, episode detail pages, future live/off-air states and moderation/contact workflows, richer presenter profiles, and accessibility testing of third-party playback across devices.

## C — Race Notebook

**Thesis:** An editorial notebook that links careful observation and human stories to the evidence behind a race.

Defining characteristics: persistent desktop section spine, compact editorial preamble, authored feature with abstract and inset photograph, a dated championship reference beside it, ruled article records and an annotated reading document. Tables, sources and report navigation share the same grammar as the journalism.

Typography: self-hosted IBM Plex Sans variable 400–600 with native Greek, using tabular numerals for data. Distinction comes from measure, scale and alignment rather than a decorative technical font. Headline wrapping and the smaller metadata were refined against real Greek content.

Hierarchy: notebook context → feature and championship reference → compact editorial index → technical feature → authored BetCast record → people → Team Radio/contact → partners/footer.

Strengths: native Data Hub integration; strong scanning and content density; clear authorship/source context; mobile tables become useful early in the page. Photography supports editorial observation rather than always dominating it.

Tradeoffs: less theatrical photography; the section spine consumes desktop width; restrained typography can become too quiet if future editors flatten the hierarchy. Metadata must remain legible rather than becoming decorative microtype.

Implementation complexity: **moderate to higher**. The underlying static templates are simple, but production needs considered navigation across the existing reports and deliberate handling of contextual side notes, rich article embeds and very wide data.

Still to design: all advanced analytical reports, cross-report navigation, archive search, annotations for real technical articles with diagrams, and responsive layouts for irregular embedded media.

## Neutral comparison matrix

| Dimension | A · Grand Prix Journal | B · Paddock | C · Race Notebook |
|---|---|---|---|
| Editorial identity | Literary magazine; history and human stories | Media house; authors and conversation | Analytical publication; observation and provenance |
| Readability | Large serif text, narrow measure, spacious pacing | Regular sans reading canvas after a bold title stage | Disciplined sans measure with section index and annotations |
| Visual distinctiveness | Masthead, Greek serif, open photographic spreads | Story/programme co-lead, aubergine/peach, mixed reading surfaces | Desktop spine, authored records, source-led layouts |
| Mobile effectiveness | Image-first cover and generous reading sequence | Headline/image followed by a purpose-built compact programme | Abstract-first feature, inset image, compact data reference |
| Content density | Deliberately lower; changes with editorial priority | Medium/high; programme and story compete deliberately | Medium/high; controlled records rather than a card wall |
| Media integration | One editorial spread in the reading journey | First-class opening destination | Authored programme entry with explicit metadata |
| Data Hub integration | Statistical annual within a magazine | Results desk within a media property | Native reference material within the notebook |
| Scalability | Needs editorial layout and crop rules | Needs programming and media state rules | Needs disciplined report navigation and metadata rules |
| Implementation complexity | Moderate | Moderate to higher | Moderate to higher |

## Five weaknesses found and focused refinement

The initial six screenshot pairs per direction are retained in `design-experiments/screenshots/initial/`. Final captures are in `screenshots/final/`. Each pair includes a full-page image and a viewport image. The refinements below followed visual inspection of the actual browser captures, including page-length comparison and interior article text.

| Direction | Five weakest first-pass decisions | Focused changes |
|---|---|---|
| A | Inner-page masthead was too tall; Data Hub delayed the table; tiny lead-driver cutout floated in whitespace; roster images cropped the source illustrations; article hero and media frame were too aggressively cropped/intrinsically sized | Compact inner masthead; tighter annual heading and typographic leader summary; removed decorative leader cutout; contained avatars; narrower article photograph and explicit 16:9 player box |
| B | Intrinsic video size made the co-lead stage too tall; the same episode repeated in another large section; mobile episode lacked a clean credit/action sequence; illustrations were treated as photographic crops; article opening was too heavy | Fixed 16:9 programme frame; one prominent BetCast destination; compact mobile programme with visible credits; contained source avatars; regular-weight article opening and more deliberate inset hero |
| C | Branded preamble competed with the actual story; excess mobile gap before the image; metadata was too small; mobile report repeated season/date information; open article index pushed reading too far down | Reduced preamble; abstract/image spacing tightened; metadata enlarged; duplicate mobile report metadata removed; responsive index disclosure collapses at mobile, including when resizing |

Cross-cutting corrections: mapped Jolpica's `max_verstappen` and `arvid_lindblad` IDs to the repository's real `verstappen.webp` and `lindblad.webp` files. The reading index now reacts to viewport changes rather than only initial load. Screenshot capture resets scroll instantly, so a smooth-scroll transition cannot clip the header in the saved viewport.

## Diversity gate

Compared headers, homepages above the fold, full page rhythm, mobile compositions, article interiors and Data Hubs side by side. The directions are distinguishable even when ignoring their palettes: A has a centred masthead and photographic cover; B pairs the lead with programming and uses a light reading canvas; C uses a section spine, abstract and compact editorial index. The supporting story structures differ (asymmetric spread/text index, horizontal media-news sequence, ruled record list). Mobile preserves these differences. Turning one into another requires changing markup, sequence and page composition, not just CSS variables.

The data table remains a semantic table across all three so content parity and accessibility are preserved; its surrounding hierarchy, typography, density, report controls and explanatory context differ. Shared `content.json` and interaction handlers do not share visual layout CSS.

## Content and prototype boundaries

All three use the same six original article records, all 14 paragraphs of the representative article, its existing cover/gallery images, the same 22 driver and 11 constructor rows, the same BetCast episode, presenter assets and genuine partner links. Source paths and decisions are documented in `DESIGN_CONCEPTS.md` and `design-experiments/README.md`.

The article's two intermediate headings are editorial summaries based on the text; descriptive captions are prototype additions, not invented image credits. The pull excerpt is labelled as an excerpt of the author's text, not a driver's spoken quotation. The provenance disclosure explains the additions. No production article content was edited.

Only homepage, one article and the representative Data Hub are implemented for each direction. Other stories, full author pages and other statistical reports link to their existing production locations. No fake search, fake submission, fake statistics, invented programme or live indicator is present. YouTube only loads after a click; playback depends on YouTube availability. No contact message is submitted by these prototypes.

The site was studied in its existing light/dark treatments. The three exploration directions use their explicitly designed surfaces; there is no partially implemented global theme switch. A full redesign would require a separate decision about alternate themes.

## Validation and isolation

- Chrome DevTools browser audit: all nine concept pages at 390×844, 768×900 and 1440×900; no horizontal overflow, no broken local images, fonts loaded.
- 18 required final full-page screenshots, 18 viewport companions, six side-by-side comparison images.
- `node design-experiments/verify.mjs`: full article paragraphs preserved, fixed article selection present, complete data row counts, local assets resolve, one main heading per page, no production CSS/JS imports.
- The same verifier evaluates the **actual production `shouldCopy` predicate** in a read-only VM and checks every exploration file and both root design documents. Every exploration path is excluded; the production homepage remains allowed. It does not run a production build or alter deployment.
- Browser interaction checks cover keyboard navigation/menu, Escape/focus restoration, real report buttons, article disclosure, media activation and comparison controls. Paddock’s compact mobile episode expands to a 350×197px player on activation. Evidence lives in `design-experiments/interaction-audit.json`.
- Visible focus, native semantic controls, table row/column headers, descriptive links, native disclosure controls and reduced-motion styles are present. This is targeted prototype QA, not a claim of a complete WCAG conformance audit or cross-browser certification.
- No tracked production file changed. No package/dependency, workflow, production route, stylesheet, script, content/data source or deployment configuration changed. Nothing deployed.

## Final screenshot index

Each linked file is a full-page browser screenshot. A matching `-viewport.png` sits beside it. Comparison images read A, B, C from left to right.

| Concept | Homepage desktop | Homepage mobile | Article desktop | Article mobile | Data Hub desktop | Data Hub mobile |
|---|---|---|---|---|---|---|
| A | [View](design-experiments/screenshots/final/a-homepage-desktop.png) | [View](design-experiments/screenshots/final/a-homepage-mobile.png) | [View](design-experiments/screenshots/final/a-article-desktop.png) | [View](design-experiments/screenshots/final/a-article-mobile.png) | [View](design-experiments/screenshots/final/a-data-hub-desktop.png) | [View](design-experiments/screenshots/final/a-data-hub-mobile.png) |
| B | [View](design-experiments/screenshots/final/b-homepage-desktop.png) | [View](design-experiments/screenshots/final/b-homepage-mobile.png) | [View](design-experiments/screenshots/final/b-article-desktop.png) | [View](design-experiments/screenshots/final/b-article-mobile.png) | [View](design-experiments/screenshots/final/b-data-hub-desktop.png) | [View](design-experiments/screenshots/final/b-data-hub-mobile.png) |
| C | [View](design-experiments/screenshots/final/c-homepage-desktop.png) | [View](design-experiments/screenshots/final/c-homepage-mobile.png) | [View](design-experiments/screenshots/final/c-article-desktop.png) | [View](design-experiments/screenshots/final/c-article-mobile.png) | [View](design-experiments/screenshots/final/c-data-hub-desktop.png) | [View](design-experiments/screenshots/final/c-data-hub-mobile.png) |
