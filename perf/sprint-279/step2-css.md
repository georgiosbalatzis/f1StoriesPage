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

## Strategy decision: A (full inline) vs B (critical + external) vs C (articles external)

Same harness, interleaved, median of 3 per cell, FCP / LCP in ms. Revalidation rows serve `max-age=0` + ETag, so every
cached file revalidates with a 304, as GitHub Pages does once its 10-minute `max-age` has passed.

- **B** inlines critical CSS that is extracted automatically from real rendering (rules matching elements in the first
  viewport, union over 4 viewports × 2 themes, one set per template). The full sheets move to the end of `<body>`.
  The CSP's `script-src-attr 'none'` rules out the `onload` swap.
- **C** is A for Home, Edition and Standings, with articles keeping their `<link>`s.

### Slow 4G (562 ms RTT, 1.47 Mbps)

| Scenario | Base | **A** | B | C |
|---|---|---|---|---|
| Cold Home | 1696 / 1696 | **1600 / 1600** | 1484 / 1484 (CLS 0.958) | 1596 / 1596 |
| Cold Edition | 1644 / 1644 | **1520 / 1520** | 1472 / **4372** (CLS 0.096) | 1520 / 1520 |
| Cold Article | 1792 / 1792 | **1556 / 1556** | 1504 / 1504 (CLS 0.035) | 1788 / 1788 |
| Cold Standings | 1700 / 1700 | **1460 / 1460** | 1404 / 1404 (CLS 0.093) | 1460 / 1460 |
| Home → Article A | 1392 / 1392 | **840 / 1296** | 692 / 1284 | 1520 / 1520 |
| Home → Standings | 1392 / 1392 | **800 / 800** | 708 / 724 (CLS 0.061) | 804 / 804 |
| Article A → B → C (C measured) | 652 / 1772 | 816 / 1860 | 700 / 1844 | 652 / 1776 |
| … → back to Article A | 708 / 708 | 820 / 844 | 696 / 724 | 708 / 708 |
| Home → Article A, after expiry | 1468 / 1468 | **1440 / 1440** | 1332 / 1340 (CLS 0.035) | 1564 / 1564 |
| Article A → B → C, after expiry | 1412 / 2088 | 1440 / **1856** | 1328 / 2008 (CLS 0.036) | 1420 / 2096 |

### Fast 4G (165 ms RTT, 9 Mbps)

| Scenario | Base | **A** | B | C |
|---|---|---|---|---|
| Cold Home | 648 | **616** | 556 (CLS 0.878) | 620 |
| Cold Edition | 568 | **552** | 552 / 1344 (CLS 0.065) | 548 |
| Cold Article | 604 | **556** | 544 (CLS 0.019) | 608 |
| Cold Standings | 592 | **540** | 528 (CLS 0.093) | 536 |
| Article A → B → C | 288 / 472 | 344 / 524 | 352 / 536 | 272 / 476 |
| Article A → B → C, after expiry | 472 / 516 | **460 / 480** | 496 / 548 (CLS 0.028) | 488 / 520 |

### Transfer for the measured page (HTML / CSS, KB on the wire)

| Scenario | Base | A | B | C |
|---|---|---|---|---|
| Cold Home | 19.1 / 26.9 | 42.9 / 0 | 29.8 / 27.0 | 42.9 / 0 |
| Cold Article | 17.6 / 39.6 | 53.2 / 0 | 31.3 / 39.7 | 17.6 / 39.6 |
| Home → Article A | 17.5 / 21.1 | 53.2 / 0 | 31.3 / 21.1 | 17.5 / 39.6 |
| Article → Article (CSS cached) | 17.4 / 0 | 53.1 / 0 | 31.1 / 0 | 17.4 / 0 |

Artifact: base 179 MB, **A 257 MB**, B ≈ 207 MB (estimated: ~66 KB of critical CSS × 400 articles), C 183 MB.
TBT is 0 in real Chrome for base, A and C; B shows 11–20 ms on warm navigations.

### Why A

- **B is rejected on correctness, not speed.** Its first paint is the fastest, but:
  - CLS reaches 0.958. A viewport-based critical set drops the rules that *hide* elements (here
    `nav.page-index`), and any extractor has this blind spot.
  - Edition LCP goes to 4.4 s, and DCL moves 3–4 s later: body-end stylesheets are fetched behind the images, and
    every deferred script waits for them.
  - Standings appends its tab CSS to `<head>`, so the core sheets would then cascade after the tab CSS.
  - It needs headless Chrome in the build. Making it safe would cost more than the ~100 ms it gains over A.
- **C gives back A's largest wins.** A cold article stays at base (−236 ms vs A), and Home → Article becomes *slower
  than base* (1520 vs 1392 ms): the homepage no longer warms the shared CSS that articles use.
- **A wins every cold load and every cross-template navigation.** It loses only fresh same-template chains within the
  10-minute cache: +164 ms FCP / +88 ms LCP on Slow 4G, +56 / +52 ms on Fast 4G. After expiry that chain is a tie on
  FCP, and A is best on LCP.

Kept as implemented; no code change from this experiment.

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
