# BetCast article widget contract

The widget is an optional, separately built enhancement for chart-only article embeds. It does not depend on the CRA dashboard bundle or React. Existing `npm start`, `npm run build`, and deployment commands remain unchanged; `npm run build:betcast-widget` builds only `blog-module/widgets/betcast/widget.js` and its manifest.

The versioned host manifest is `/blog-module/widgets/betcast/manifest.json`. Schema version 1 declares an immutable build version, the exact same-origin entry path with that version in its query string, SHA-384 Subresource Integrity, raw and gzip byte counts, and API name. The article loader accepts only this versioned entry path and validates the manifest before adding one script per article. The script is loaded lazily when a chart is within 240 pixels of the viewport. If loading, parsing, or mounting fails, the server-rendered SVG and full-analysis link remain available.

The runtime exposes `F1StoriesBetCastWidget.mount(element, config)`. `config` contains pinned snapshot rows and a selected view (`budget`, `weeklyProfit`, `weeklyRoi`, or `winRate`). `mount` returns an idempotent unmount function. Selection, DOM, event handlers, and SVG live within that mount; it reads and writes no URL, page theme, storage, or network state. Several instances may use the same one-per-page runtime while retaining independent controls.

Authors can write `BETCAST_CHART:<snapshot-id>` or `BETCAST_CHART:<snapshot-id>|view=weeklyProfit` in a source article. The build validates the ID and snapshot through the same typed snapshot validator used for native tables. Only the chart widget is enhanced; native semantic BetCast tables are never replaced by an empty mount point. Snapshot rows and calculations remain the source of truth. The existing `BETCAST:<snapshot-id>` table shortcode is unchanged.

The bundle is built with the repository's existing esbuild development dependency. It has no runtime library requests. The build reports compressed-file byte size and stamps the manifest with integrity metadata; the first chart on a page causes one manifest request and one small runtime request.
