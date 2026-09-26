# Home V2 — design prototype

An isolated redesign of the homepage, rendered from the site's real data. It does not replace `/` and is not published: `scripts/build/public-artifact.mjs` does not copy `home-v2/` into `dist/`, and the page carries `noindex, nofollow`.

## Preview

```bash
npm run build:home-v2   # re-render home-v2/index.html from the committed data
npm run preview         # then open http://127.0.0.1:4173/home-v2/
```

## Keeping it current

`home-v2/index.html` is a generated artifact, like `index.html`:

- `npm run build` and `npm run build:public` render it after the blog build.
- The Site Maintenance workflow (`publish-blog.yml`) re-renders and commits it whenever it publishes articles, refreshes the YouTube snapshot or refreshes the standings and Friday debrief caches.
- `scripts/build/generated-drift-guard.mjs` lists it, so `npm run build:check` fails if the committed copy no longer matches the data.

Its output depends only on committed data files and the current year, so the same inputs always render the same file.

`npm run preview` builds the minified assets the rest of the site needs; the prototype itself loads unminified source files (`/styles/home-fonts.css`, `/scripts/shared-nav.js`, `/scripts/f1-optimized.js`), so a plain `node scripts/serve-site.mjs` also works.

## Files

| File | Role |
|---|---|
| `scripts/build/home-v2.mjs` | Generator. One render function per section: `HeaderV2`, `HeroV2`, `RaceStrip`, `EditorialGrid`, `TechnicalFeature`, `VideoFeature`, `DataPreview`, `AuthorsV2`, `ContactV2`, `PartnersV2`, `FooterV2`. |
| `home-v2/index.html` | Generated output. Edit the generator, not this file. |
| `home-v2/home-v2.css` | Tokens and section styles. Loads no other site stylesheet. |
| `home-v2/home-v2.js` | Episode facade and the race-strip pause control. |

Reused, unchanged: `scripts/shared-nav.js` (menu toggle, race countdown: same element ids), `scripts/f1-optimized.js` (contact form → Formspree), the icon sprite and partner links read from `index.html`, `blog-module/taxonomy.js` (authors, category labels), `standings/core/teams.js` (team colours).

## Data

| Section | Source | Rule |
|---|---|---|
| Hero | `blog-module/home-latest.json[0]` | Same cover story as production. |
| Technical spread | `blog-index-data.json` | Newest `Technical` story whose photograph is ≥ 1000px wide. |
| Telemetry panel | `standings/debrief-cache.json` (latest round) | Only when the story names a team in the debrief; otherwise the panel is left out. |
| Journal | `blog-index-data.json` | Lead: newest remaining story with a ≥ 1200px photograph. Then two with photographs, then four text rows. |
| On Air | `assets/youtube-latest.json` | Three newest episodes. Duration and hosts only where production already prints them (`EPISODE_NOTES`). |
| The Numbers | `standings/standings-cache.json`, `debrief-cache.json` | Top five drivers and constructors; Friday race-pace prediction. |
| The team | `taxonomy.js` `AUTHORS` | The technical story's writer is featured; the rest form the roster. |

## Visual system

- **Rhythm:** ivory cover → dark strip → ivory journal → dark technical spread → ivory On Air → paper data desk → ivory team → quiet contact and partners → dark colophon.
- **Colour:** paper/ink neutrals from `styles/editorial.css`; the technical teal (`#12655f`, `#6ec6bb` on dark) as the brand accent; signal red only for race status (countdown dot, new episode).
- **Type:** IBM Plex Sans for everything, Barlow Condensed only for Latin display words (ON AIR., THE NUMBERS., TECHNICAL DEEP DIVE., the wordmark). No monospace: numbers use tabular figures.
- **Light only.** The homepage is the paper edition: it sets `data-theme="light"`, loads no theme script and has no theme toggle, whatever the visitor chose elsewhere on the site. The rest of the site keeps both themes.
