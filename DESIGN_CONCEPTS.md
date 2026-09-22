# F1Stories — three design directions

Defined before prototype implementation, 16 September 2026. This is a local design exploration, not a production redesign. No preferred direction is selected.

## Product study and implementation boundary

Inspected https://f1stories.gr/ and the live article, standings and author surfaces; ran the actual static site at localhost:4185. Browser study covers homepage, full article, Data Hub, author directory and journal archive at 390 and 1440 pixels, plus homepage/article/data at 768. Evidence is in `design-experiments/research/`.

The product is a Greek editorial/community publication with historical portraits, technical journalism, opinion, recognizable authors, YouTube/BetCast, extensive statistical reports, partner relationships and contact. The current identity uses a small illustrated logo, Barlow Latin wordmark, IBM Plex Sans Greek text, paper/ink surfaces, orange-red punctuation, asymmetrical split heroes, rounded image corners and light/dark modes. Articles have bylines, reading time, editorial provenance, images/galleries and related reading. The Data Hub offers drivers, constructors, quali gaps, lap-one gains, tyre pace, dirty air, track dominance, pit stops, debrief and destructors. Team Radio currently means the contact invitation; it does not establish a currently live stream. Presenter and author profiles use existing illustrated avatars, with different asset mappings; the prototypes preserve those mappings.

Architecture: static HTML/CSS/vanilla JS, generated article HTML and compressed article index, cached data and self-hosted fonts. Production publishing uploads only `dist/`; `scripts/build/public-artifact.mjs:shouldCopy` explicitly allows public paths and returns false for other roots. `design-experiments/` and these Markdown documents are outside that allowlist. No workflow, package scripts, production CSS/JS, route or source content will change. A separate Python standard-library server binds only to 127.0.0.1:4186, serves the experiments and permits read-only access to existing image/font assets. No production styles, scripts, service worker, analytics or contact submission code are imported.

Only content extraction, semantic helpers and interaction behavior may be shared. Each concept gets separately authored page composition and a standalone stylesheet; there is no shared component layout CSS or theme-variable mechanism that transforms one concept into another.

## Fixed comparison content

- Lead and full reading specimen: **Mika Salo: Ο οδηγός που πάντα πρόσφερε.**, Themis Charvalis, 14 September 2026, History, 3 minutes. Source: `blog-module/blog-entries/20260914W/`. Keep all article paragraphs; use its existing cover and gallery photography. Section headings may reuse exact phrases from the text; pull text is editorial emphasis, not an invented spoken quotation. Prototype captions describe the pictured subject and identify the existing article gallery, without invented photo credits.
- Supporting articles: the same source records for FAIL MADRID, Mark Marquez, Το Baku δεν ήταν απλώς ένα λάθος, Οι στόχοι του big 4 για το Madring, and the recent Technical article selected from the index. Original Greek titles, author spellings, categories, dates and images are preserved.
- Media: `assets/youtube-latest.json`, BetCast #270 Hungaroring, published 25 July 2026. Presenter names and description from the existing homepage. No invented live state, view count or upload freshness. External YouTube link and click-to-load player.
- Data specimen: drivers and constructors from `standings/standings-cache.json`, season 2026, round 11, cache generated 22 August 2026. It is an explicitly dated repository snapshot, not independently verified present-day standings. Same complete rows in all three; any totals/differences are calculated from those rows. No synthetic statistics or requests to mutate the data.
- People, partners, social/contact destinations: existing homepage and author directory. Other stories and production-only reports link to their real production destinations; the three prototype surfaces stay within their chosen concept.

## A — Grand Prix Journal

**Thesis:** F1Stories becomes a Greek motorsport journal worth settling down to read, with human stories and photography given the authority of a magazine cover.

| Dimension | Direction |
|---|---|
| Personality | Reflective, cultured, confident, warm; never precious. |
| Editorial philosophy | Lead with the person and the story; separate cover, journal, conversation and reference material through pacing. |
| Density | Low at the cover and in reading; moderate in supporting lists. No repeated card wall. |
| Typography | GFS Didot Greek/Greek Extended/Latin for display and reading; IBM Plex Sans for navigation, captions and metadata. Real accented Greek headlines tested in the browser; no all-caps serif paragraphs. |
| Grid | 1280px maximum; centred magazine masthead, wide photograph, off-centre cover title; asymmetric two-column journal; 680px reading measure with quiet margin notes. |
| Photography | Generous 16:9/2:1 covers, original colour, hard corners, crop follows subject. Interior gallery opens into the page. |
| Colour | Near-white warm paper #f7f5ef, charcoal #242520, burgundy #7d302b; colour primarily comes from photographs. |
| Navigation | Masthead above horizontal editorial navigation; simple disclosure navigation on mobile. Full logo retained. |
| Homepage hierarchy | Masthead → photographic cover → Journal feature and text index → BetCast editorial spread → standings reference → authors/contact → partners/footer. |
| Article | Centred serif title, byline, wide hero, large serif opening, narrow body with section breaks and an actual excerpt; related reading at the end. |
| Data | Statistical annual: spare rules, clear table, small typographic summary and a supporting chart; sources sit alongside the explanation. |
| YouTube / live | A deliberate change in editorial pace: still image, episode title, presenter credit, play affordance. Team Radio is a letter/contact invitation. |
| Motion | 160ms underline/colour feedback, no movement of editorial content. |
| Mobile | Compact masthead; image precedes full-width cover headline; useful excerpt and byline, generous reading measure; table merges team into driver cell. |
| Dark / light | Intentional paper edition only for this exploration; no incomplete global theme toggle. |
| Unique | Magazine masthead, serif Greek voice, photography as a spread, long-form rhythm. |
| Avoids | Existing split hero, newspaper columns, bordered cards, faux print texture, racing decoration. |

Prototype system: spacing 8/16/24/40/64/96; 1px rules only at editorial divisions, radius 0; body 21px/1.75 desktop and 19px/1.7 mobile; display about 64px desktop and 40px mobile. Touch targets ≥44px, focus outline with offset. Below 900px masthead navigation collapses; below 600px the cover becomes a dedicated mobile sequence.

## B — Paddock

**Thesis:** F1Stories becomes a recognisable media house where the written story, the episode and the voices behind them belong to the same conversation.

| Dimension | Direction |
|---|---|
| Personality | Social, direct, assured, energetic without shouting. |
| Editorial philosophy | Connect a headline to a voice and an episode; sequence programming and journalism rather than presenting a news dashboard. |
| Density | Medium-high above the fold, alternating dense editorial rows with open people/media sections. |
| Typography | Roboto Greek/Greek Extended/Latin in 400/600/700; heavy, compact sentence-case headlines and generous regular body text. No Latin-only condensed Greek fallback. |
| Grid | 1328px content width; compact horizontal station header; story and media share a wide stage; reading canvas contrasted with contextual sidebar. |
| Photography | Bold cover crop paired with original episode artwork; presenters have meaningful image scale and labels. All source photography stays photographic. |
| Colour | Deep aubergine #241e29, warm white #faf8f4, peach #efab87; restrained salmon panels for programming, not glowing effects. |
| Navigation | Compact persistent brand row, direct Journal / BetCast / Data / people destinations, large mobile disclosure. |
| Homepage hierarchy | Lead story + featured BetCast → latest story strip → presenters and conversation → Data Hub score summary → remaining journal → Team Radio → partners/footer. |
| Article | Dark title stage, landscape hero, light dedicated reading surface; author/media context in adjacent rail. Mobile puts reading before supplemental programming. |
| Data | Broadcast results desk with lead-driver summary, complete table and compact chart; exact source/date retained. |
| YouTube / live | Episode is first-class navigation and above-the-fold content; play opens a real player only when requested. Team Radio invites conversation; no fake live indicator. |
| Motion | 180ms colour/background feedback on actions; player replacement without autoplay; no ticker or auto-carousel. |
| Mobile | Story headline and photograph followed by compact programme block; journal becomes horizontal editorial rows, cast a two-column roster. |
| Dark / light | Fixed dual-surface identity: dark programming shell and light article body. This is not a global dark theme. |
| Unique | Media co-lead, visible presenters, programme sequencing, compact robust Greek sans headlines, mixed dark/light reading surface. |
| Avoids | HUD, esports, F1.com/ESPN/Twitch imitation, fake breaking news, status dots, endless video cards. |

Prototype system: spacing 6/12/20/32/48/72; hard rectangular surfaces with 0 radius; 1px separators only for index rows; 18px/1.75 article body; desktop display 52–60px, mobile 35–38px. Images primarily 16:9, people 1:1 (existing illustrated avatars). Mobile nav collapses below 900px; focus uses contrasting outline, never colour alone.

## C — Race Notebook

**Thesis:** F1Stories becomes an editorial notebook where careful observation links the human story to the evidence behind the race.

| Dimension | Direction |
|---|---|
| Personality | Exact, curious, quiet, approachable. |
| Editorial philosophy | Make authorship, category, source and context legible; allow stories and analytical references to inform one another. |
| Density | Medium, controlled; compact metadata beside substantial editorial text. Whitespace aligns rather than decorates. |
| Typography | IBM Plex Sans variable 400–600 throughout, with Greek subsets and tabular numerals. Small sentence-case labels; no random monospace. |
| Grid | Desktop left navigation spine and main 12-column editorial field, title/metadata above compact image and abstract; ruled index rows and aligned annotations. |
| Photography | Documentary evidence at moderate scale, unfiltered colour; inset rather than dominating every story. Reference numbers only where identifying real gallery items. |
| Colour | Cool paper #f1f4f2, near-black #20312e, deep green #285d4b, pale sage #dbe6df; borders #bacac1. |
| Navigation | Persistent labelled section spine at desktop; compact top bar and intentional disclosure panel on mobile. Local page index on reading and data. |
| Homepage hierarchy | Editorial notebook title → feature abstract/photo and dated data reference → compact article index → analytical article → BetCast transcript-like programme entry → people/contact → partners/footer. |
| Article | Title plus document metadata, image with descriptive caption, body with desktop margin index and pull excerpt; mobile index becomes an in-flow disclosure. |
| Data | Most native expression: report navigation, source/date, tabular drivers/constructors and aligned quantitative graphic; explanations clarify what the rows represent. |
| YouTube / live | Episode treated as another authored record: title, presenters, publication date, image and player link. Team Radio is a small correspondence section. |
| Motion | Short 100ms state feedback; no scrolling decoration. |
| Mobile | Navigation spine becomes compact bar; title/abstract then inset photograph; small editorial rows, readable table with driver/team combined. |
| Dark / light | Cool light workspace only in this prototype; no dashboard-like dark variant. |
| Unique | Persistent navigation spine, abstract-first editorial treatment, structured index, marginal commentary and native data vocabulary. |
| Avoids | Telemetry software, fake units, charts as decoration, terminal aesthetics, arbitrarily numbered section labels. |

Prototype system: spacing 4/8/12/24/36/56; width constrained by 184px spine plus 1136px main; 1px alignment rules, 0 radius; 18px/1.8 reading body; 44px desktop and 32px mobile headline. Images 16:9 or original aspect ratio; no rounded thumbnails. Collapse spine below 1000px and explicitly recompose at 600px.

## Acceptance and review

Each direction receives separate home/article/data HTML, complete mobile design at 390×844, desktop at 1440×900 and sensible 768px layouts. Required interactions: keyboard/mobile navigation, active page, menu Escape/focus return, data report switching, click-to-load media and reduced-motion handling. No dead prototype controls or fake submissions.

Capture an initial set of six screenshots per direction, inspect the actual images, document five weaknesses, then make one focused refinement pass. Capture final full-page screenshots plus viewport crops and compare all three side by side. The review page offers consistent page/viewport controls, working previews and screenshots without rankings. Complete browser overflow, resource, keyboard, interaction and content-parity checks. Record limitations honestly in DESIGN_COMPARISON.md.
