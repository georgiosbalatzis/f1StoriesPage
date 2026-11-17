# Brand B (authentic artwork) — review evidence

Captured 2026-11-17 in Chrome (Playwright) from local builds of this branch; "before" is the live site
(https://f1-stories.gr) at main `fd063a403`. Each sheet stacks before/after pairs.

| File | What it shows |
| --- | --- |
| `header-desktop-before-after.jpg` | 1440/1024px headers, light, dark, OS light + manual dark, OS dark + manual light |
| `header-mobile-before-after.jpg` | 320–430px headers (home, article, 404, dashboard), open mobile menu, footer |
| `footer-before-after.jpg` | Footer brand mark, home and article, both themes |
| `apps-before-after.jpg` | Telemetry, Ghost Car, TYRES, BetCast mastheads at 1440/390px, both themes (assembled site) |
| `fidelity-rendered-vs-kit.jpg` | Rendered nav wordmark (2x) vs the kit Header PNG at the same height, light then dark, 3x zoom |
| `favicons-native-and-6x.jpg` | Shipped 16/32px and kit 48px favicons, light/dark, on light and dark tab colours |

Source artwork: owner-supplied `F1-Stories-B-Authentic-Brand-Kit` (original master SHA-256
`36301ea63d66c6b4a3aa2b8c8c57c83924585eeff332ea48335947abeb8ad8b3`). Derived files are produced by
`scripts/build/brand-assets.mjs <kitDir>`.
