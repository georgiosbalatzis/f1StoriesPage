# Publishing saved telemetry figures

The dashboard downloads one validated `<slug>.f1embed.json` bundle for a single speed or throttle/brake panel. Keep the bundle beside the article's TXT/DOCX source, or put it in that source folder's `embeds/` directory. Add one standalone marker to the article source:

```text
TELEMETRY:baku-pedals.f1embed.json
```

The article build reads only that local file. It validates the publication version, selection, driver order, plotted data, completeness metadata and SVG XML. Invalid/missing bundles stop the article build with the file path and reason. The builder emits escaped figure text, an analysis link, and four local SVG files named from the bundle's SHA-256 digest. Rebuilding an unchanged bundle keeps the same asset names; a new export makes a new revision.

The bundle is a saved snapshot. Its analysis link opens the selected race, session, drivers, lap and panel in the telemetry dashboard; it does not replace the figure's saved data. The article renderer chooses the narrow or wide image at the 700px viewport breakpoint and switches between light and dark pairs using the article root's `data-theme="light"` convention (dark is the root with no light attribute). Print always uses the light pair. The generated image variants are named with the first 20 hexadecimal characters of the bundle's SHA-256 digest.

Only the speed trace and throttle/brake telemetry panels have saved-figure support. For track maps, tables and other panels, keep using the explicitly labelled legacy iframe until that panel has its own publication representation. A malformed or missing bundle stops the article build with the source path and validation reason; fix or replace the bundle before rebuilding.

## Author workflow

1. In the dashboard, choose a supported telemetry panel and confirm the season, race, session, drivers and lap shown in the composer.
2. Write a specific figure title, an accessibility description, and a caption that explains how to read the traces. Check the preview at both widths.
3. If the composer identifies missing or incomplete drivers, review the plotted traces and acknowledge the partial comparison only when the caption explains the omission.
4. Download the `.f1embed.json` bundle. Keep it next to the TXT/DOCX source or under that article's `embeds/` directory. Copy the `TELEMETRY:<basename>.f1embed.json` marker and put it on a separate line where the figure belongs.
5. Build and preview the article. Verify the context and selected scope, both themes, narrow/wide layout and print output. If the selection changes, download a new revision and replace the old bundle and marker together.

The source-based pilot at `blog-module/blog-entries/20260927G/source.txt` has not been migrated. Its existing URL selects session 11377, drivers 1/43 and lap 36; the current OpenF1 roster resolves those numbers to Lando Norris and Franco Colapinto, while the nearby article text discusses Norris and Oscar Piastri (81). Norris also has no completed lap 36. Do not publish that selection into the story without an editorial decision about its driver scope. A separate local preview can validate the renderer without changing the published source.

`blog-module/build/__tests__/fixtures/telemetry-publication-v1.json` mirrors the telemetry repository's `src/embeds/__tests__/fixtures/publication-v1.json`. When changing schema v1, copy the fixture byte-for-byte in both directions and run each repository's focused embed tests. A breaking contract change needs a new schema version while keeping the v1 reader for existing articles.
