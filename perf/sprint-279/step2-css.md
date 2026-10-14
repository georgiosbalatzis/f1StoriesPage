# Issue #279 — step 2: render-blocking CSS (2026-10-14)

**Change:** public pages in `dist/` inline their complete head stylesheets (`scripts/build/inline-head-css.mjs`,
called from `public-artifact.mjs`). Each `<link rel="stylesheet">` to a local file in `<head>` becomes a `<style>`
holding that whole file, at the same position, so precedence is unchanged and nothing is subset. Tracked sources keep
their links, the CSS files are still published, and the author tools (`generate.html`, `housekeeping.html`) keep their links.

## Why

The baseline (`baseline.md`) shows FCP = LCP on every route, landing about 130–190 ms after the last render-blocking
stylesheet. On HTTP/2 the 5–8 stylesheets already download in parallel, so the cost is the round trip, not the
file count.

## Measurement

Real Chrome, local HTTP/2 + gzip + `max-age=600` (GitHub Pages shape), 390×844 @3×, CPU ×4, third parties blocked.
Variants interleaved across rounds; median of 6 per cell; times in ms (FCP / LCP).

### Cold load, Slow 4G (562 ms RTT, 1.47 Mbps)

| Route | Base | One bundle per route | **Inline** |
|---|---|---|---|
| Home | 1700 / 1700 | 1748 / 1748 | **1600 / 1600** |
| Blog | 1652 / 1652 | 1640 / 1640 | **1508 / 1508** |
| Article | 1788 / 1788 | 1752 / 1752 | **1548 / 1548** |
| Standings | 1696 / 1696 | 1776 / 1776 | **1460 / 1460** |

### Cold load, Fast 4G (165 ms RTT, 9 Mbps)

| Route | Base | **Inline** |
|---|---|---|
| Home | 644 | **616** |
| Blog | 572 | **548** |
| Article | 608 | **556** |
| Standings | 584 | **540** |

### Second page in the same session (HTTP cache warm from the first)

| Navigation | Slow 4G base | Slow 4G inline | Fast 4G base | Fast 4G inline |
|---|---|---|---|---|
| Home → Article | 1396 / 1396 | **820 / 1288** | 464 / 464 | **268 / 388** |
| Home → Standings | 1392 / 1392 | **792 / 792** | — | — |
| Article → Blog | 1284 / 1300 | **712 / 1192** | — | — |
| Article → another article (same CSS) | 656 / 1500 | 820 / **1384** | 268 / 408 | 288 / 412 |
| Blog → News section (same CSS) | 704 / 1244 | 708 / 1308 | 316 / 428 | 304 / 440 |

Navigations between pages with identical CSS are the cost. Each repeats about 36 KB gz (article) or 17 KB gz (Edition)
of CSS that the base serves from cache. That costs up to +164 ms FCP on Slow 4G and is neutral on Fast 4G. Base serves
CSS from cache only within GitHub Pages' 10-minute `max-age`; after that it revalidates every stylesheet (an extra
round trip), a case not measured here.

**Rejected: one bundled stylesheet per route.** It is neutral to worse cold and worse warm, because it stops sharing
`styles`/`editorial`/`shared-nav` across routes.

The shipped build (not the prototype) confirmed the cold Slow 4G medians back to back against the base:
Home 1700→1600, Blog 1656→1508, Article 1792→1552, Standings 1696→1472, with real-Chrome TBT 0 on both.

### Lighthouse guard (simulated mobile, median of 3), base → inline

| Route | Perf | FCP | LCP | TBT |
|---|---|---|---|---|
| Home | 97 → 98 | 1653 → 1502 | 2407 → 2252 | 0 → 45 |
| Blog | 99 → 99 | 1353 → 1351 | 2103 → 2026 | 0 → 21 |
| Standings | 98 → 99 | 1653 → 1426 | 2253 → 2101 | 0 → 0 |
| Article | 97 → 98 | 1653 → 1502 | 2403 → 2252 | 0 → 0 |

Lantern attributes the inline CSS parse to the HTML parse task (Home/Blog TBT within the 100 ms budget); real Chrome
measured no long task.

## Cost

- `dist/` grows from 179.3 MB to 256.9 MB (+78 MB, mostly 399 articles × ~190 KB raw CSS). Page weight on the wire
  is about +27–39 KB gz per HTML response, offset by 5–8 fewer requests.
- The Lighthouse guard's `route-css-bytes` now reads near 0; the bytes moved into the document.

## Regression checks (inlined `dist/`)

- `qa:visual` (9 routes × 4 viewports × 2 themes) is pixel-identical to the baseline outside the noise floor measured
  base-vs-base back to back. That noise is a ~44–176 px time-dependent nav element and sub-visible gradient/dither
  phase on decorative backgrounds. Interactions OK: mobile menu, cookie decline, theme toggle.
- `validate-public-artifact` now accepts each editorial stylesheet either as a link to the current hash or as an
  inline copy that is byte-identical to the current file (still exactly one).
- Pass: `test:build` (91), `test:security` (27), `quality:static`, `qa:media`, release media + primary-domain tests,
  `qa:edition` (358/358), `test:consent`, `qa:audio-player` (106), `qa:embed-dialog` (136).
- Pre-existing, unaffected: `qa:embeds` serves sources, not `dist/` (14 standings-embed findings); `qa:visual`
  latest-article image-viewer finding; Lighthouse Article `third-party-requests` 21 > 8.

## Guards in the inliner

The build fails, instead of shipping a page that behaves differently, when a stylesheet contains `</style`, uses
`@import`, or has a `url()` that is not `data:`, `http(s):` or root-absolute: relative URLs and `#fragment`s resolve
against the page once inlined. Unit test: `scripts/build/__tests__/inline-head-css.test.mjs`.
