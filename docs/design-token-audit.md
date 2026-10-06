# Priority 4A token inventory

Audit of the main repository before normalization (2026-10-03). The repository
started clean. This is an inventory and disposition record, not a redesign plan.
The resulting normative contract is [design-tokens.md](design-tokens.md).

## Existing architecture

`styles/editorial.css` defines tokens on `body.editorial-page` and
`.editorial-preview`, with light overrides beneath `[data-theme="light"]`.
The default is dark. Variables are **not** defined globally on `:root`; older
root tokens in `styles.css` serve legacy structures and author tools. Load order
and ownership are recorded in [css-architecture.md](css-architecture.md).

Three current public palettes must be distinguished:

| Scope | Dark edition | Light edition | Disposition |
|---|---|---|---|
| Editorial base; THE GRID, authors, legal | Warm charcoal, cream text, sage metadata | Warm paper, dark ink | Canonical cross-product default |
| Journal and articles | Same base/surfaces, warmer text, stronger border, readable coral | Same core light values, different accent wash | Existing reading variant; retain, document separately |
| Homepage (`home.css`) | Cooler charcoal and coral, separate cover surface | Core light palette | Existing cover treatment; retain, do not export as the cross-product default |

The homepage dark overrides are `#181a1c`, `#222426`, `#2c2e30`, `#eee7dc`,
`#bcb8b0`, `#47494a`, `#ff826b`. They are real main-site values, not evidence
that the core contract should compromise with BetCast. Contact/partners remain
cream in both editions; the technical spread remains dark in both editions.

Existing generic colors: `--bg-base`, `--bg-surface`, `--bg-surface-alt`,
`--text-primary`, `--text-secondary`, `--text-tertiary`, `--border`, `--accent`,
`--accent-readable`, `--accent-hover`, `--accent-contrast`, `--accent-muted`,
`--signal`, `--signal-ink`, `--paper`, `--ink`. Tertiary and secondary are equal
in the base palette but distinct in dark reading pages. Readable accent equals
accent in the base palette but differs in dark reading pages.

Existing typography: `--font-body` is Plex with a metric-matched Arial/Helvetica
fallback; `--font-display` and `--font-editorial` alias it. `--font-brand` is
Barlow Condensed. The loaded faces are Plex 400–600 and Barlow 700. Roboto,
Outfit, system UI and Monaco stacks also exist in legacy/author/data code;
these are not alternative canonical editorial families.

Existing geometry: control/button radius 2px; media radius 4px; cut corners
24/40/64px; content shadows `none`. Root radius scales 6/8/12/16px and
9999px belong to legacy code. Repeated editorial rules are 1px, emphasis rules
2px, current-state/signal rules 3px. The Race Desk current bar is 3px.

Existing spacing: root `--space-2xs/xs/sm/md/lg/xl/2xl` =
4/8/12/16/24/36/56px at a 16px root. Only `md` and `lg` have direct CSS readers;
most route rhythm is intentionally literal/fluid. `--space-section` =
`clamp(40px, 6vw, 80px)` has no current reader. No new spacing scale is justified.
Containers use 48/32/22/17px gutters; home also uses a fluid gutter. Preserve these.

## Hard-coded color classification

The search covered first-party CSS, HTML (including generated articles and inline
team colors), JS/MJS, SVG/media references and build/render paths. Generated
minified CSS, Bootstrap, font assets, screenshots and dependencies are derived
or third-party inputs, not token owners. The first-party CSS search found **1,091
matching lines** (not 1,091 distinct colors). A companion JS search found 37
matching lines, including false positives such as `BetCast #264`; bare team hex
strings and RGB channel maps were separately inspected in standings metadata.

Classification:

- **A — generic primitive:** use a canonical token when the semantic role and
  theme behavior match. Existing fixed-edition artwork may retain exact values
  where dynamic inheritance would change its intended theme.
- **B — meaningful exception:** team/driver/tyre/category/author/status colors,
  photo scrims, masks, print inks, fixed-edition artwork, overlay opacity and
  decorative texture. Retain local ownership; numerical similarity is insufficient.
- **C — legacy/overridden/derived:** do not export; retain until its runtime owner
  is deliberately migrated. A CSS selector being overridden on public pages does
  not prove it is unused in author tools or embeds.

| Source | Matching CSS lines | Classification and disposition |
|---|---:|---|
| `styles/editorial.css` | 129 | Canonical definitions; B category/author maps, texture, fixed paper partner mat; A repeated inverted footer metadata/rules; C fallback values in token reads |
| `home.css` | 45 | A repeated night technical surface/border, light contact button ink, partner label ink; B night cover, fixed light contact/partners, fixed dark technical spread, photo overlays |
| `styles/authors.css`, `styles/legal.css` | 0 | Already generic-token consumers; author signature values come from editorial map |
| `blog-module/blog/archive-editorial.css` | 2 | B opaque black in scroll masks; not visible text/background color |
| `blog-module/blog/article-editorial.css` | 13 | B fixed paper cover metadata/rules, photo/media scrims; light back-link red belongs to the fixed cover, not dynamic body accent |
| `blog-module/blog/article-rail.css` | 2 | A/C older rail surface and border, overridden by editorial treatment; avoid a layout/rail migration |
| `standings/standings-editorial.css` | 7 | B masks, team RGB, temporary feedback shadow; generic colors already tokenized |
| `standings/standings.css` | 31 | C legacy root palette/white light shell (public pages inherit editorial aliases); B feedback/legend semantics |
| `standings/standings-polish.css` | 6 | C older surface shadows and rank metals, public editorial rules supersede them |
| `standings/tabs/quali-gaps.css` | 36 | A/C old tooltip/surface decoration; B dot/team RGB, semantic chart state |
| `standings/tabs/lap1-gains.css` | 24 | A/C old fills/rules; B gain/loss, team/winner RGB |
| `standings/tabs/tyre-pace.css` | 8 | A/C old chart/tooltips; B tyre compound and trace semantics |
| `standings/tabs/dirty-air.css` | 23 | A/C old fills/rules; B dirty/clean-air and gain/loss semantics |
| `standings/tabs/track-dominance.css` | 30 | A/C old fills/rules; B team/advantage RGB and circuit semantics |
| `standings/tabs/pit-stops.css` | 25 | A/C old fills/rules; B crew/time/position/team semantics |
| `standings/tabs/debrief.css` | 50 | A/C old chart chrome; B chart/compound/positive/negative/point-hover semantics |
| `styles.css` | 68 | C older charcoal/blue palette, generic utilities, danger/success roles; do not migrate author tools in this task |
| `styles/shared-nav.css` | 76 | C non-editorial blue/pink nav/toggle defaults; public editorial styles own resolved colors; shell geometry preserved |
| `styles/layers.css` | 5 | C root fallback aliases (`--color-*`); root alias resolution does not inherit later body tokens |
| `theme-overrides.css` | 281 | C author-tool-only light skin; B tooling/status/artwork exceptions |
| `styles/critical-common.css`, `styles/critical-standings.css` | 62 / 27 | C legacy critical snapshots; not canonical token sources |
| `blog-module/blog/article-styles.css` | 79 | A/C legacy article/controls, superseded by article editorial CSS; B print inks/media/error semantics |
| `blog-module/blog-styles.css` | 15 | C author-preview-only table/figure styling; B error/print/media semantics |
| `styles/author/generate.css`, `styles/author/housekeeping.css` | 12 / 13 | B operation status colors, sunk editing surfaces, modal backdrop; isolated tooling |

JS/HTML findings: `standings/core/teams.js`, driver metadata and tab renderers
own team palettes and chart fallback colors (`#06b6d4`, `#f97316`), including
RGB channels injected into markup. `index.html`/`home-panels.js` embed team
colors as `--team`. Retain all of these (B). `embed-render.js` and author
`generate-page.js` retain external embed mats, authoring warnings and error
colors (B/C). `scripts/author/dialogs.js` already uses semantic variables with
legacy fallbacks; local-tool landing pages are separate from the public shell.
Image-ingest fixtures and sponsor normalization transparency are build/test
values, not UI tokens. Generated article colors mirror their render/template
owner; do not mass-edit generated story content. SVG brand/flag fills and images
retain their intrinsic color; icons generally use `currentColor`.

## Focus, controls and accessibility inventory

The shared public ring is `2px solid var(--accent)` at 5px offset. Light nav
uses ink on paper; dark nav uses readable accent. Local offsets range from
2–4px outside to negative offsets for clipped tabs/videos/partner mats.
THE GRID's switcher has an outward 2px offset; report tabs use -4px to avoid
clipping. Contact fields restore a 2px outline for `:focus-visible` after their
pointer-focus underline rule. Article author cards use readable accent at 3px.
The Journal search input suppresses the outline and only changes its 2px
underline color: add a keyboard outline. The light footer ring uses body accent
on dark ink (2.28:1); switch that ring to paper (12.20:1). These are the two
scoped keyboard-focus normalizations selected for 4A.
Do not remove `:focus-visible` outlines or native behavior generally.

Masthead/theme/hamburger, footer social/navigation, standalone author links,
Race Desk links and form controls already have approximately 44px targets.
Mobile nav rows are 52px; homepage primary controls are 47–48px; report tabs
are 57px. Desktop scroll-to-top has a 36px mark with an expanded 44px hit area.
Inline prose links are not forced into these geometries.

Overlay shadows are functional: consent `0 -3px 15px #00000012`, legacy
overlay `--shadow-lg: 0 8px 24px #00000012`, share feedback
`0 3px 14px #00000018`; author dialog overlays may be stronger. Content panels
use rules, surface contrast and flat geometry instead.

## Selected normalization

Keep definitions in `editorial.css`. Alias equal base tertiary/readable accent
and control radii; retain reading-page distinctions. Expose the existing 44px
control minimum in the editorial contract. Name the already-repeated inverted
footer metadata and rule primitives without changing values. Use equivalent
local surface/text/border tokens in home technical and contact/partner controls.
Add an explicit Journal keyboard outline and a readable light-footer ring.
Leave palette values, theme state,
Race Desk/global-shell architecture, domain colors and route rhythm intact.
