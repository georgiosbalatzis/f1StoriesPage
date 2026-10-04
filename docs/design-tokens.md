# Canonical F1Stories visual tokens

Priority 4A establishes **`styles/editorial.css` as the authoritative source**.
This document specifies its shared primitives; [design-tokens.json](design-tokens.json)
is a resolved-value snapshot, not another source. Run `npm run check:tokens`
to compare both documents with CSS. The [audit](design-token-audit.md) records
existing exceptions and retained legacy code.

Tokens currently live on `body.editorial-page` / `.editorial-preview`; dark is
the default and `[data-theme="light"]` supplies light values. Subapplications
may put the equivalent definitions on their own root. Theme **state** remains
the Priority 2 `f1stories-theme` contract; tokens do not read storage, resolve
system preference, fetch CSS or alter pre-paint behavior.

## Shared colors

Use these base values for BetCast, Telemetry and Ghost Car's ordinary UI.
The existing homepage night palette and reading variant below are local page
treatments, not alternative defaults for future products.

| Token | Light | Dark | Semantic purpose |
|---|---|---|---|
| `--bg-base` | `#f2eee4` | `#1b1a19` | Page canvas |
| `--bg-surface` | `#e9e3d6` | `#242321` | Panel/control surface; one step above canvas |
| `--bg-surface-alt` | `#dfd9ca` | `#2e2c29` | Further surface separation; not a text color |
| `--text-primary` | `#20251f` | `#eee8db` | Headlines, body, primary labels |
| `--text-secondary` | `#5b6256` | `#b6bbac` | Metadata, supporting copy, inactive UI |
| `--text-tertiary` | `#5b6256` | `#b6bbac` | Compatibility alias to secondary in the base theme |
| `--border` | `#c8c8b9` | `#4b5146` | Quiet structural rules; not the sole focus/control indicator |
| `--accent` | `#a82e1c` | `#ff775f` | Interactive/editorial accent, generic focus |
| `--accent-readable` | `#a82e1c` | `#ff775f` | Readable accent labels; alias to accent in the base theme |
| `--accent-hover` | `#8e281a` | `#ff947f` | Alternate accent interaction tone |
| `--accent-contrast` | `#f2eee4` | `#20251f` | Foreground on a solid accent fill |
| `--accent-muted` | `#ed4c3214` | `#ed4c3214` | Translucent accent wash; never an accessible indicator by itself |
| `--signal` | `#ed4c32` | `#ed4c32` | F1 emphasis marks, current-state bars, timing band, signal button state |
| `--signal-ink` | `#17191b` | `#17191b` | Text/icons on signal; 4.77:1, including small labels |
| `--paper` | `#e9e3d6` | `#e9e3d6` | Fixed paper ink/surface for editorial inversion; does not follow the canvas |
| `--ink` | `#20251f` | `#20251f` | Fixed dark ink/surface paired with paper |
| `--text-inverse-secondary` | `#c0bfb2` | `#c0bfb2` | Quiet text on ink, e.g. colophon metadata |
| `--border-inverse` | `rgba(233, 227, 214, 0.18)` | `rgba(233, 227, 214, 0.18)` | Quiet rule on ink; composited against its actual surface |

`accent` responds to theme and supports readable UI; `signal` retains the red
brand mark. Do not merge them. Use `signal-ink`, rather than paper/white or
ordinary ink, for small text on signal. Signal itself is not a general-purpose
small-text foreground. Inherited base light accent-muted really is red
`#ed4c3214`; preserve the source value rather than guessing from accent.

Primary/secondary text on the **base and surface** backgrounds passes 4.5:1
in both editions (secondary minimum: 4.94:1 on light surface). Accent-readable
passes on all three base surfaces (minimum: 4.85:1). Light secondary on
surface-alt is **4.48:1**, so this is not an approved small-text pairing; use
primary text there. Core inverse metadata on ink is 8.42:1. Border is decorative
structure, not an assertion of 3:1 control contrast. Validate actual composites,
font size, charts, hover/selected states and inverted panels in each product.

## Existing reading-page variant

`body.archive-page` and `body.article-page` keep these local overrides. Their
base/surface colors and signal remain the same as the core palette. Light
values below include inherited values for clarity. Other core tokens remain as
above. Do not automatically export this variant to data or betting interfaces.

| Reading token | Light | Dark | Purpose |
|---|---|---|---|
| `--text-primary` | `#20251f` | `#eee8df` | Warmer reading text |
| `--text-secondary` | `#5b6256` | `#b8b1a6` | Warmer reading metadata |
| `--text-tertiary` | `#5b6256` | `#968f86` | Distinct quiet reading metadata |
| `--border` | `#c8c8b9` | `#6d6861` | Stronger reading-page rule |
| `--accent-readable` | `#a82e1c` | `#ff9a89` | Reading accent labels |
| `--accent-hover` | `#8e281a` | `#ffad9e` | Reading interaction tone |
| `--accent-contrast` | `#f2eee4` | `#1b1a19` | Foreground on reading accent |
| `--accent-muted` | `#a82e1c14` | `#ed4c3226` | Reading accent wash |
| `--paper` | `#e9e3d6` | `#eee8df` | Warmer reading paper |
| `--ink` | `#20251f` | `#1b1a19` | Reading charcoal |

Dark reading tertiary passes on base/surface, but is 4.35:1 on surface-alt;
use secondary/primary for small text on that background. Readable accent and
tertiary are genuine separate roles here, not globally interchangeable aliases.

## Typography

| Primitive | Resolved value | Use |
|---|---|---|
| `--font-body` | `'IBM Plex Sans', 'IBM Plex Sans Fallback', sans-serif` | UI, editorial/body copy, navigation, controls |
| `--font-display` | `'IBM Plex Sans', 'IBM Plex Sans Fallback', sans-serif` | Existing editorial headings; alias to body |
| `--font-editorial` | `'IBM Plex Sans', 'IBM Plex Sans Fallback', sans-serif` | Existing prose/headings; alias to body |
| `--font-brand` | `'Barlow Condensed', sans-serif` | Wordmarks, Latin display/product labels, THE GRID title and Race Desk labels |

Plex uses 400 for reading, 500 for UI/support, 600 for emphasis/buttons.
Barlow uses 700. Existing self-hosted faces are in `styles/home-fonts.css`;
Plex includes Greek, Latin, Latin-ext and arrows. The named fallback's
weight/subset-specific Arial/Helvetica metrics are defined at the top of
`editorial.css`; retain them when migrating that fallback name. Do not claim
the fallback exists without its `@font-face` declarations. No new font request
or dependency is needed.

Keep existing route hierarchy rather than imposing a universal size scale.
Common UI sizes are .75rem metadata/kickers, .875rem nav, 1rem body; kickers
use 500–600 and roughly .10–.13em tracking. Nav is Plex 500, active 600,
.875rem with zero tracking. Race Desk labels are Barlow 700, .9375rem,
.06em tracking; brand wordmarks 1.75rem with -.035em tracking. Product/display
labels may be uppercase; body/prose is not universally uppercased. Buttons
use Plex 500–600; tracked uppercase is an existing route choice. Numeric tables
and timers use tabular numerals. `font-display` intentionally means Plex,
not Barlow; use `font-brand` explicitly for condensed labels.

## Geometry, rules and shadows

| Primitive | Resolved value | Use |
|---|---|---|
| `--radius-control` | `2px` | Minimal button/control rounding |
| `--radius-media` | `4px` | Modest media/partner treatment |
| `--control-height-md` | `44px` | Minimum important control target; not a universal fixed height |
| `--cut-sm` | `24px` | Optional editorial single cut corner |
| `--cut-md` | `40px` | Optional medium cut corner |
| `--cut-lg` | `64px` | Optional large photographic cut corner |
| `--space-section` | `clamp(40px, 6vw, 80px)` | Existing fluid helper; currently unused, optional |
| `--shadow-sm` | `none` | Ordinary content surfaces |
| `--shadow-md` | `none` | Ordinary content surfaces |

Default panel/card geometry is square, unboxed or ruled. A 24/40/64px **single
photographic cut corner** is artwork, not permission to round every card.
Circles/pills are exceptions for icons, dots or specific compact UI, not the
default surface/control shape. Legacy root 6/8/12/16px radii and rounded-card
defaults are not canonical; do not copy them into sibling products.

Rules: 1px for structure/control borders; 2px for emphasis/underlines/focus;
3px for signal/current-state bars (including the Race Desk current bar).
Use existing semantic border/text/signal colors by role. There is no global
strong/subtle border scale: local data aliases may need a different role.

Panels use contrast, rules and surfaces, not floating-card shadows. Keep
functional overlays: consent `0 -3px 15px #00000012`, existing overlay helper
`--shadow-lg: 0 8px 24px #00000012`, standings feedback
`0 3px 14px #00000018`; dialogs can have local elevation. These shadow values
are local overlay treatments, not mandatory content tokens.

## Focus and control targets

The default is `:focus-visible { outline: 2px solid var(--accent);
outline-offset: 5px; }`. A visible outline is required in addition to a border
change. Keep native focus when no custom replacement exists. Surface-aware
exceptions: light masthead uses ink, dark masthead uses accent-readable, and
light inverted footer uses paper (12.20:1 against core ink). Controls on signal bands use
signal-ink (4.77:1), as accent on signal is below 3:1. Reading labels may
use accent-readable; the fixed dark technical spread uses its local readable
accent. Never apply the dark-page accent blindly to a fixed paper panel.

Use 2–4px outside offsets where space is tighter (Journal search/filters: 3px).
Inside scroll/overflow/clip containers use a visible inset outline or provide
real clearance; existing report tabs use -4px and video/partner controls use
inset rings. Race Desk links retain their 2px outward offset and existing
clearance. Test keyboard tab order and the entire ring, not just computed CSS.
Full-width mobile menu rows use a -5px inset to keep the complete 2px ring inside their scrollport.
THE GRID standings rows and the article gallery controls (stage arrows, thumb strip) sit flush with
their clip edge and use -2px; the row's team stripe paints below the ring (`z-index: -1` in the
isolated row), or it hides the ring's left edge. A container that only needs an x-overflow guard uses
`overflow-x: clip`: `hidden` computes `overflow-y` to `auto` and cuts the bottom of section-ending rings.
Do not suppress focus on a button, input or link without a visible replacement.

Use approximately 44px minimum target height/width for standalone important
controls and mobile targets. Existing mobile nav is 52px; homepage CTAs/forms
47–48px; report tabs 57px. A compact desktop mark can have an expanded hit area
(scroll-to-top: 36px mark, 44px hit area). Inline prose links remain inline.
Touch form text stays at least 16px to avoid browser zoom. Preserve existing
control padding and route density; geometry is a target principle, not a mandate
to stretch every desktop text link or chart point.

## Spacing and compatibility

No new spacing scale is introduced. Use the existing practical 4px rhythm
where appropriate; literal/fluid page dimensions remain valid. Legacy root
helpers are 4/8/12/16/24/36/56px (`space-2xs/xs/sm/md/lg/xl/2xl`), mostly unused
by modern routes and optional rather than mandatory. Current container gutters
are 48/32/22/17px at their existing breakpoints. Do not change page rhythm to
fit a theoretical scale.

`button-radius`, `blog-radius-sm`, `st-radius`, `st-radius-sm` alias
`radius-control` in the **shared editorial scope**. `--blog-*` and `--st-*`
surface/text/border aliases preserve older readers. In particular shared
`blog-text-tertiary` and `st-text-muted` intentionally mean secondary.
The standings route then redefines `st-accent` as signal, `st-accent-readable`
as readable accent, `st-border-strong` as secondary, `st-surface-raised` as
surface, and `st-radius` as zero. These local aliases are not permission to
globally equate signal with accent or strong border with ordinary border.
`--color-*` root aliases in `styles/layers.css` resolve in the old root scope;
do not use them as the public canonical contract. Root `danger/success` and
old blue/pink nav values are legacy/tooling semantics, not new brand colors.

## Product migration policy

1. Read this contract and `editorial.css`; use the **core** `themes` and
   `primitives` from the snapshot for independently built products. No runtime
   import from f1stories.gr, CDN, token JavaScript, package or theme API.
2. Classify each product value as exact canonical match, equivalent semantic
   alias, legitimate product-specific value, or accidental divergence. Map
   ordinary canvas/surface/text/border/action/focus/control/font primitives to
   the core values in **both themes**. BetCast's cooler palette must converge
   to the core warm palette; do not alter core to match it or copy home overrides.
3. Keep charts, timing states, teams, drivers, betting win/loss, telemetry
   traces and Ghost Car track/car/3D rendering colors local. Category and author
   signature inks also retain their meaning. Equal hex values do not imply
   equal semantics. Photo scrims, opaque masks and print ink are local treatments.
4. Retain product layouts, visualization geometry, navigation architecture and
   the Priority 2 theme state contract. Equivalent transitional aliases are
   acceptable; genuinely different roles need local names.
5. Verify text/control/focus contrast on actual surfaces, keyboard ring clipping,
   390/1440 views and both themes. `accent-contrast` and `signal-ink` are different
   foreground contracts; muted washes and structural rules do not replace focus.

Update the CSS first when deliberately changing a shared primitive, then review
the snapshot/specification and rerun `check:tokens` plus representative visual
checks. Main-site local editions are documented exceptions; any later decision
to converge them is separate visual work.
