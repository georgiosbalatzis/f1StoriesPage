# Generated Data Contracts

`npm run build:data-contracts` validates generated data after `npm run build` and before the public artifact is assembled.

Current checked contracts:

- `blog-module/blog-index-data.json`: compact blog index `v: 2`.
- `blog-module/blog-index-page-1.json`: first-page blog index payload.
- `blog-module/blog-source-cache.json`: source cache used by author/build tooling.
- `blog-module/home-latest.json`: homepage latest-articles payload, at most 4 posts: `[0]` is the cover story, `[1..3]` fill the journal. Optional `deck` (≤240 chars) and `lede` (≤320 chars) are whole sentences from the article's opening paragraph, used by the cover instead of the truncated `excerpt`.
- `assets/youtube-latest.json`: local YouTube snapshot.
- `standings/standings-cache.json`: Jolpica standings snapshot.
- `standings/dirty-air-cache.json`: dirty-air cache `version: 1` (build input, not published).
- `standings/dirty-air/index.json` + `standings/dirty-air/<session_key>.json`: the published split of the dirty-air cache: session metadata, then one file per session loaded on selection.
- `standings/destructors-cache.json`: destructors cache `version: 1`.
- `standings/debrief-cache.json`: Friday debrief cache `version: 2`.
- `manifest.json`, `scripts/build/asset-manifest.json`, and `sitemap.xml`.

When a versioned generated format changes, update the validator and record the migration here:

- `blog-index-data` `v: 2`: compact rows are `[id, title, authorIndex, date, thumbnailWidth, thumbnailHeight, excerpt, readingTime, categoryIndexes]`. Top-level `h` and `s` are run-length flag strings (comma-separated runs of a `0`/`1` marker plus a base36 length, covering every row): `h` = the `-card.webp` thumbnail exists; `s` = the folder has a `source.txt` the author tools can edit (source-less legacy articles are read-only there). `s` is optional for older payloads.
- `dirty-air-cache` `version: 1`: sessions contain normalized rows, proximity counts, and timeline segments.
- `destructors-cache` `version: 1`: drivers contain `acronym`, `fullName`, `teamKey`, and `damage`.
- `debrief-cache` `version: 2`: rounds contain driver and team-level Friday debrief arrays.
