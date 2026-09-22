# Local F1Stories design exploration

Run from the repository root:

```sh
python3 design-experiments/serve.py
```

Open http://127.0.0.1:4186/. This server binds only to loopback. It serves the exploration and reads existing images/fonts under the `/source/` alias. The normal site can independently run with `PREVIEW_PORT=4185 node scripts/serve-site.mjs` without running the mutating production build.

## Files

- `concept-a/`, `concept-b/`, `concept-c/`: independent CSS plus home, article and Data Hub HTML. No shared layout CSS.
- `content.json`: fixed extracted repository content, no runtime live statistics. Identical source across the three concepts.
- `build.py`: regenerate only the nine prototype HTML files. It does not regenerate styles or modify production.
- `interactions.js`: shared menu/disclosure behavior, click-to-load YouTube, driver/constructor switching.
- `index.html`: neutral comparison page, equal viewport screenshots, direct links and sized working previews.
- `preview.html`: real 390/768/1440px iframe preview, scaled only to fit the reviewer's available screen.
- `screenshots/initial/`: first-pass evidence. `screenshots/final/`: final full-page and viewport screenshots plus six comparison sheets.
- `capture.py`: reproducible Chrome DevTools CLI captures and viewport audit. The optional second argument selects a browser page ID. Requires the installed CLI/browser; does not spawn an agent or install packages.
- `check-interactions.py`: real pointer/keyboard checks for menus, Escape, report selection, media activation and the comparison frame.
- `verify.mjs`: content parity, local resources, actual public-artifact exclusion and browser audit checks. Uses Node built-ins.
- `make-comparisons.mjs`: screenshot contact sheets using the repository's existing Sharp dependency.
- `research/`: existing product screenshots and browser snapshots.
- `refinement` history is documented in `../DESIGN_COMPARISON.md`.

## Reproduce

```sh
python3 design-experiments/build.py
python3 design-experiments/capture.py final 1
node design-experiments/make-comparisons.mjs
node design-experiments/verify.mjs
```

Browser page ID 1 must exist; choose a dedicated browser tab for capture because it navigates that tab. The live comparison page uses final screenshots; regenerate those after a prototype design change.

## Source manifest

| Content | Source |
|---|---|
| Six selected records | `blog-module/blog-index-data.json` (decompressed into `content.json`) |
| Latest headline/excerpt context | `blog-module/home-latest.json` |
| Complete Mika Salo article | `blog-module/blog-entries/20260914W/article.html`, 14 original paragraphs |
| Lead / article / gallery images | `20260914W/{1,2,3,4}.webp` |
| Other article images | Original `1.webp` under each selected article slug |
| Technical analysis | `20260422G`, Ferrari SF26, Georgios Balatzis, 22 April 2026 |
| Driver/constructor rows | `standings/standings-cache.json`, 2026/round 11, generated 2026-08-22 |
| BetCast | First entry of `assets/youtube-latest.json`, `l0vNNK6FO3g`, 25 July 2026 |
| Episode artwork | Existing episode thumbnail, downloaded unchanged from `https://i.ytimg.com/vi/l0vNNK6FO3g/hqdefault.jpg` into `assets/betcast-270.jpg` |
| Presenter assets | Existing `images/authors/{giannis,georgios,dimitris,thanasis}.webp` illustrations and homepage names/roles |
| Representative author | `authors/index.html`, Themis Charvalis and `images/avatars/AS.webp` |
| Partner marks/destinations | Existing homepage sponsor links and `images/sponsors/normalized/` |
| Fonts | Existing `assets/fonts/` files. GFS Didot, IBM Plex Sans, Roboto and their Greek subsets; no new downloads or font dependency |

Captions and two section headings are limited descriptive prototype additions and identified by the article provenance disclosure. No invented photo attribution or spoken quotation. The source article's wording and source taxonomy are preserved, including the published spelling “Mark Marquez.”

## Production safety

All exploration code lives under `design-experiments/`; the two requested Markdown documents are at the repository root. The existing `public-artifact.mjs` allowlist rejects every such path. The verifier executes that actual predicate without building/publishing. No deployment settings were changed. Do not replace the existing allowlisted publishing pipeline with a repository-root upload.

No production scripts/styles, analytics, service workers, credentials or contact submission handlers are loaded. The only external request initiated by prototype interaction is the requested YouTube player. Ordinary external links use the actual public destinations. Statistics remain a dated snapshot throughout the comparison.
