# Step 4: icon sprite and repeated HTML evaluation

Decision: retain the existing inline, per-page sprite subsets. A versioned external
subset saves roughly 3 KB on a subsequent navigation that reuses its cached
sprite, but does not materially reduce cold transfer or parsing time. It adds a
request before icons can render. That tradeoff does not justify changing the
publishing pipeline and reference handling in this sprint.

## Measurement scope

Measured the Step 4 worktree's generated `dist/`, based on `f08cd0df`, on
2026-10-15. The homepage contains the concurrent Step 4 CLS work; no sprite or
runtime JavaScript changes were applied. This is a focused byte/DOM/cache probe,
not a repeat Lighthouse comparison. Byte counts below are bytes, not KB.

The artifact contains 449 HTML documents, of which 445 include an inline sprite.
The other four (`404.html`, `f1telemetry/index.html`, `ghostcar/index.html`, and
`tyres/index.html`) have neither a sprite block nor local `#fa-*` references.

Across the 445 pages, HTML occupies 26,632,593 uncompressed bytes. Sprite blocks
occupy 4,946,364 of those bytes (18.6%). Removing the complete sprite blocks from
each document reduces the sum of independently compressed HTML bodies by
1,894,270 gzip bytes or 1,626,291 Brotli bytes. These are **marginal compressed
HTML sizes**, not separate sprite compression sizes or observed production
transfers; compression contexts differ.

| Page | HTML raw | HTML gzip | Inline block raw | Symbols | Block DOM elements | Marginal gzip bytes | Marginal Brotli bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 87,828 | 19,227 | 9,916 | 20 | 42 | 3,652 | 3,186 |
| Blog index | 51,417 | 11,384 | 6,885 | 13 | 28 | 2,839 | 2,462 |
| Standings | 60,416 | 14,253 | 18,222 | 35 | 72 | 6,249 | 5,356 |
| Authors | 35,059 | — | 6,627 | 12 | 26 | 2,740 | 2,441 |

The existing subsets already avoid shipping the whole icon catalog. The source
sprite is 30,653 raw / 9,783 gzip / 8,370 Brotli bytes. Making that whole sprite
external would increase a cold homepage's body transfer by about 6 KB gzip,
before request overhead and longer references are considered.

There are only ten distinct inline subset contents in the artifact: 391 articles
share a 23-symbol subset, and 39 archive/section/blog/privacy documents share a
13-symbol subset. Eight articles share another subset; the remaining seven
subsets occur once each. Caching potential is real, especially between articles.

## External subset prototype

An ephemeral server tested a SHA-256-content-versioned external sprite for each
subset. No generated or source page was changed on disk. Static `<use>` links
became `/sprite-HASH.svg#fa-name`; runtime-needed symbols stayed inline. The
external SVG omitted the inline-only `display:none` attribute and used
`image/svg+xml`. HTML had `Cache-Control: no-store`; hashed SVGs had
`Cache-Control: public, max-age=31536000, immutable`.

Runtime references cannot simply be rewritten in HTML. `stamp-html.mjs` discovers
icon literals in loaded scripts and follows imports, including lazy standings
tabs. The probe followed the same dependency rule. It retained three home
symbols (`calendar-alt`, `play`, `youtube`), twenty standings symbols, and five
article symbols (`check`, `chevron-left`, `chevron-right`, `link`, `times`).
Removing those local definitions would break dynamically created fragment-only
references. No Codex-owned runtime file was edited.

| Page | Existing HTML gzip | Hybrid HTML gzip | External SVG gzip | Cold body delta gzip / Brotli | Cached-navigation HTML saving gzip / Brotli |
| --- | ---: | ---: | ---: | ---: | ---: |
| Home | 19,227 | 16,191 | 3,031 | −5 / +53 | 3,036 / 2,621 |
| Blog index | 11,384 | 8,586 | 2,631 | −167 / −128 | 2,798 / 2,449 |
| Standings | 14,253 | 11,628 | 2,904 | +279 / +321 | 2,625 / 2,212 |
| Article `20250302G` | 16,104 | 12,605 | 3,519 | +20 / +59 | 3,499 / 3,024 |
| Article `20261014W` | 14,170 | 10,730 | 3,462 | +22 / +84 | 3,440 / 2,943 |

Cold deltas include both compressed response bodies and the longer HTML links.
They exclude protocol headers. Chrome's network events observed exactly one
initial sprite request per candidate, with about 230 additional response-header
bytes on this local HTTP server. The same sprite was served from browser cache
with zero encoded network bytes on the next document navigation. Header costs
on the production protocol may differ. Different subset hashes require separate
initial requests; going from home to blog to article does not reuse one sprite.

## DOM, parsing, and rendering

Chrome 155.0.8059.80, local headless desktop, 51 paired `DOMParser` samples after
five warm-up pairs, with scripts inert:

| Page | Existing HTML DOM elements | Hybrid HTML DOM elements | Median parse ms, existing → hybrid |
| --- | ---: | ---: | ---: |
| Home | 1,000 | 966 | 0.6 → 0.6 |
| Blog index | 735 | 707 | 0.6 → 0.5 |
| Standings | 549 | 519 | 0.4 → 0.4 |
| Article `20250302G` | 614 | 578 | 0.5 → 0.4 |
| Article `20261014W` | 429 | 395 | 0.3 → 0.3 |

These counts cover the parsed HTML document, not post-hydration/runtime nodes.
The 0–0.1 ms differences are at the timer's observed resolution and do not show
a material parse improvement. This probe does not claim a CPU-throttled load
time benefit.

For each of the five candidate subsets, the probe rendered **every symbol** in
both dark and light inherited text colors. Pixel buffers were identical between
inline and external versions in all ten comparisons; `fill:currentColor` was
preserved. SVG width, height, `viewBox`, IDs, paths, and symbol ordering were
unchanged. This directly verifies Chrome rendering/color inheritance, not
Safari or Firefox compatibility. Existing local references remain unchanged in
the shipped implementation.

## Reproduction notes

For byte counts, read each generated HTML file as UTF-8, match the block between
`<!-- f1s:icon-sprite:begin -->` and `<!-- f1s:icon-sprite:end -->`, and compare
`Buffer.byteLength(html)` with `Buffer.byteLength(block)`. Compress whole HTML
before and after block removal using Node's `gzipSync` and
`brotliCompressSync` with default parameters; sum the size differences across
documents. Do not add standalone compressed block sizes to compressed HTML.

For the candidate, preserve symbols found by the loaded-script/import traversal
described above, replace only static references to the moved symbols, and hash
the external SVG content. Compare original compressed HTML with candidate HTML
plus the compressed external SVG for the first load, and candidate HTML alone
once that exact hash is cached. Element counts use `querySelectorAll('*')` on
the parsed whole documents. Network cache evidence uses Chrome CDP
`requestServedFromCache` and `loadingFinished.encodedDataLength`; rendering
evidence compares decoded screenshot pixel buffers after the SVG load completes.

No template, publishing rule, asset budget, runtime script, or icon reference was
changed for this evaluation. A later article/media phase can reconsider the
repeat-navigation saving alongside its larger asset changes and browser matrix.
