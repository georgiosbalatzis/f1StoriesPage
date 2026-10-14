# Issue #279 — step 1 baseline (2026-10-14)

Source: `origin/main` @ `1dfccd3e`, `npm run build:public` (3574 files, 179.34 MB dist).
Latest article at capture time: `20261014G`.

## Lighthouse guard (`npm run perf:lighthouse`, mobile, simulated, median of 3)

Lantern simulation over the guard's HTTP/1.1 server. Use for budgets, not for critical-path decisions.

| Route | Perf | FCP | LCP | SI | TBT | CLS | DOM | Requests | Transfer |
|---|---|---|---|---|---|---|---|---|---|
| Home | 97 | 1653 | 2407 | 1653 | 0 | 0.004 | 974 | 31 | 279 KB |
| Blog (Edition index) | 99 | 1353 | 2103 | 1353 | 0 | 0.004 | 694 | 26 | 174 KB |
| Standings | 98 | 1653 | 2253 | 1653 | 0 | 0.000 | 1664 | 40 | 200 KB |
| Article (latest) | 97 | 1653 | 2403 | 1653 | 0 | 0.004 | 486 | 48 | 186 KB |

a11y / best-practices / SEO: 100 on all four. Guard result: **FAIL, pre-existing**, Article
`third-party-requests: 21 > 8` (the latest article's embeds).

## Real Chrome, HTTP/2 (production shape)

Local HTTP/2 + gzip + `cache-control: max-age=600` (what GitHub Pages serves, verified with
`curl -sI`), 390×844 @3×, CPU ×4, third parties unresolvable. Median of 6 cold loads, interleaved.
All times are in ms.

| Route | Slow 4G FCP=LCP | Fast 4G FCP=LCP | Last stylesheet done (Slow 4G) | DOM | Requests | Transfer | CSS (gz) |
|---|---|---|---|---|---|---|---|
| Home | 1700 | 644 | 1477 | 1012 | 28 | 469 KB | 26.8 KB / 6 files |
| Blog | 1652 | 572 | 1406 | 727 | 22 | 138 KB | 19.1 KB / 5 files |
| Article | 1788 | 608 | 1611 | 523 | 27 | 171 KB | 39.5 KB / 7 files |
| Standings | 1696 | 584 | 1564 | 1709 | 37 | 196 KB | 32.0 KB / 8 files |

LCP elements: Home `#hero-image`, Blog the lead card `<img>`, Article `.article-header-img`,
Standings `.standings-title-display` (text). TBT 0 and CLS ≤ 0.004 everywhere.

**FCP = LCP on every route, and both follow the last render-blocking stylesheet by roughly 130–190 ms.**
The paint is gated by the CSS round trip, not by the images or JS.

## Visual QA (`npm run qa:visual`, 9 routes × 4 viewports × 2 themes)

Interactions OK: mobile menu, cookie first visit + decline, theme toggle.
**FAIL, pre-existing, content-dependent**: Latest article, all 8 viewport/theme combinations,
`image-viewer: article image trigger missing`.

## Not covered here

Representative interaction traces (INP), standings tabs and data pipeline (steps 5–7, Codex),
and production network/cache measurements (step 9, integrator).
