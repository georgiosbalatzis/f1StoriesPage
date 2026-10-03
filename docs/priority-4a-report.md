# Priority 4A completion report

Completed 2026-10-03 in the main F1Stories repository. This is a validation
record for this change; the living contract is [design-tokens.md](design-tokens.md),
and **`styles/editorial.css` remains authoritative**.

## Architecture and contract

The audit found body-scoped editorial tokens, legacy root/tooling defaults,
an intentional reading-page dark variant, and the homepage's separate night
edition. Core light/dark colors are specified in the contract's paired table;
neither existing page variant was recolored or exported as the product default.

| Core role | Light | Dark |
|---|---|---|
| Base | `#f2eee4` | `#1b1a19` |
| Surface | `#e9e3d6` | `#242321` |
| Alternate surface | `#dfd9ca` | `#2e2c29` |
| Primary text | `#20251f` | `#eee8db` |
| Secondary text | `#5b6256` | `#b6bbac` |
| Border | `#c8c8b9` | `#4b5146` |
| Interactive accent | `#a82e1c` | `#ff775f` |
| Brand signal | `#ed4c32` | `#ed4c32` |

Typography remains IBM Plex Sans / its existing metric-matched fallback for
body, UI and editorial headings; Barlow Condensed 700 for brand/product labels.
`font-display` continues to alias Plex, not Barlow. No font assets changed.

The contract specifies 1px structural rules, 2px emphasis/focus and 3px signal
bars; square content surfaces, 2px controls, 4px media, and exceptional single
cut corners. Ordinary content shadows remain `none`; functional overlays keep
their existing shadows. Important targets use 44px minimum geometry, with
existing larger controls and expanded hit areas preserved. Existing spacing
rhythm/gutters remain; no new scale was imposed.

Default keyboard focus remains a 2px accent outline at 5px offset, with existing
surface-aware colors and clipping-safe local offsets. Two actual focus defects
were corrected: Journal search gains an outline (2px readable accent, 3px
offset), and the light inverted footer uses paper instead of body accent
(core contrast improves from 2.28:1 to 12.20:1). Neither changes ordinary views.

## Audit and consolidation

[design-token-audit.md](design-token-audit.md) inventories 1,091 first-party CSS
matching lines, JS/HTML render paths, inline team colors, fonts, spacing,
controls, focus, radii and shadows. It classifies generic primitives (A),
meaningful exceptions (B), and legacy/overridden/derived values (C).

Equivalent values consolidated:

- Base/light tertiary text and readable accent become secondary/accent aliases;
  the distinct dark reading-page values remain distinct.
- Button and shared legacy control radii derive from `radius-control`.
- Editorial 44px targets use the existing `control-height-md` name.
- Repeated footer metadata/rules now use `text-inverse-secondary` and
  `border-inverse`, with exactly the previous values.
- Homepage night technical surfaces/rules, contact button ink, partner label
  ink and small control radii use equivalent local/global tokens.

Retained raw colors include team/driver/tyre/chart/category/author/status inks,
photo scrims, masks, fixed light/dark artwork, overlay alpha/shadows, print
inks and legacy/tooling defaults. Similar numerical values with different roles
were not merged. The homepage night palette, reading palette, fixed paper
contact/partners and fixed dark technical spread remain intact.

A small resolved-value JSON manifest was created. The dependency-free
`check:tokens` guard compares CSS with both the manifest and the normative
document, including reading overrides, fonts, geometry and aliases. It runs in
`quality:static`. A clean temporary fixture passed; seven deliberate
CSS/specification/manifest/alias mismatches were correctly rejected.

## Validation

Passed: `build:public`, static quality/rendering/token checks, generated asset
validation, standings/build/security/blog/author tests, runtime audit, size
budget, article-media/image guards, author-image QA, consent/analytics checks,
data contracts and Pages source guard. `git diff --check` is clean.

The changed minified stylesheets add 825 bytes uncompressed, **61 bytes combined
after gzip** (editorial +47, home +8, archive +6). No browser JavaScript,
external style/font dependency, fetch or package dependency was introduced.

Representative visual matrix: home, THE GRID, latest article, authors and
Journal × 1440/390 × light/dark = **20 views with zero pixel differences**.
Desktop home is the 1440×900 cover view; other views are full-page. Across the
whole rendered pages, 8,376 visible elements have identical measured geometry,
colors, fonts, borders, radii, shadows and other recorded styles. The four
Race Desk keyboard-focus views are pixel-identical. Journal focus screenshots
show only the intended ring; browser focus probes also confirm the new light
footer color.

Capture conditions fix date/random selection, suppress external requests, load
local lazy media and wait for stable screenshots. Desktop home capture forces
painting of offscreen content in the browser only. Supplemental full-page home
captures still show inconsistent painting of offscreen Journal images at
y=1373–2093; their asset/font bytes and computed styles match exactly. Those
diagnostics were retained, not treated as product changes or refreshed baselines.

The existing 72-case visual QA matrix has **identical findings before/after**:
homepage figcaption overflow at 390/768 and light homepage video-control
contrast (1.21:1). Menu, consent and theme interactions pass.

Lighthouse retains exactly the baseline budget failures: homepage accessibility
97 < 98 and missing `dom-size` on all four routes. Baseline homepage text
contrast findings include technical faint metadata (3.27:1) and one writer-card
metadata pairing (4.42:1); these unrelated page treatments remain unchanged.
Final performance scores are home/blog/standings 98 and article 96;
Journal/standings/article accessibility is 100, and best practices/SEO are 100.

Before committing, `build:check` reported the expected **uncommitted generated
HTML hashes**; it passes with the reviewed generated files committed.
All 388 changed HTML files (379 articles and 9 shells/templates) differ only
in runtime asset hashes. Repeating HTML/blog/assets generation produced zero
additional changes. The previously mentioned unrelated blog-index drift was
not reproduced in this checkout. The generated files were reviewed before being included in the source commit.

Local evidence is under ignored `audit/priority4/`: `comparison.json`,
`focus-comparison.json`, `before/`, `after/`, `full-page-comparison.json`,
baseline/final QA reports, baseline/final Lighthouse JSON, individual test logs,
`validation.json` and `generated-html-review.json`.

## Files and future migrations

Hand-edited/added files:

- `styles/editorial.css`, `home.css`, `blog-module/blog/archive-editorial.css`
- `styles.css` (source-of-truth comment only)
- `package.json`, `scripts/quality/design-token-guard.mjs`
- `docs/css-architecture.md`, `docs/design-token-audit.md`
- `docs/design-tokens.md`, `docs/design-tokens.json`, this report

Generated shell/template/article HTML carries the new CSS hashes. Sponsor
normalization output from the build was restored to its original tracked bytes.
Theme persistence/pre-paint/state scripts, partials, global navigation,
Race Desk names/order/active state and all sibling repositories are untouched.

For Priority 4B and later: independently copy/map the **core** light/dark values
and shared typography/control/focus primitives; classify each existing token
as an exact match, semantic alias, legitimate product-specific role or accidental
divergence. BetCast converges to the warm core, not the home night edition.
Telemetry/driver/chart traces and Ghost Car track/car/3D semantics stay local.
Preserve layouts and `f1stories-theme` state behavior, and validate contrast and
keyboard clipping in both themes. Do not introduce remote CSS imports or a
distribution framework as part of these mappings.

**Priority 4A is complete**, with the baseline unrelated QA/Lighthouse failures
and supplemental full-page capture limitation explicitly recorded. No sibling
repositories were modified.
