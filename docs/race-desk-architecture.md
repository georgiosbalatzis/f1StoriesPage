# Race Desk Architecture

Canonical names and navigation for the F1 Stories data products. Telemetry and Ghost Car adopt this next; this file is the reference.

## Hierarchy

```text
F1 STORIES
├── Editorial (articles, authors, YouTube)
├── RACE DESK                      umbrella: "F1 STORIES / RACE DESK"
│   ├── THE GRID.                  /standings/ (this repo)
│   ├── TELEMETRY.                 georgiosbalatzis.github.io/f1-telemetry-dashboard/
│   └── GHOST CAR.                 georgiosbalatzis.github.io/ghostcar/
└── BETCAST.                       sibling product, not part of Race Desk
```

| Level | Name | Where it appears |
|---|---|---|
| Global section | `Δεδομένα` | Global masthead nav (Priority 1). Unchanged. |
| Umbrella | `F1 STORIES / RACE DESK` | Kicker above each product title. Never a heading. |
| Products | `THE GRID.` `TELEMETRY.` `GHOST CAR.` | The product's H1, with the full stop in signal red. |
| Product sections | e.g. Οδηγοί, Κατασκευαστές, Ρυθμός ελαστικών | THE GRID's own report tabs. Functional Greek labels, not brands. |

## Rules

- **Global nav is stable.** It stays `Αρχική · Άρθρα · YouTube · Βαθμολογία · Δεδομένα · Συντάκτες · BetCast`. Race Desk, its products, and the product switcher never go in the masthead.
- **Race Desk nav is local.** It only appears inside a Race Desk product, as `<nav aria-label="Race Desk">` with exactly three links in this order: THE GRID, TELEMETRY, GHOST CAR. The current product carries `aria-current="page"`, and only one item is current.
- **BetCast is outside Race Desk on purpose.** It is a separate product with its own global nav entry. Do not add it to the switcher.
- **"Data Hub" and "Data Desk" are retired.** Use "Race Desk" for the family and the product name for a specific tool. Lowercase *δεδομένα* in prose is fine.
- **Product names stay in English.** Surrounding copy is Greek. Do not translate THE GRID, TELEMETRY or GHOST CAR.
- **Brand does not have to match the URL.** THE GRID lives at `/standings/`, and `?tab=` deep links keep working. Do not rename routes for branding.
- **SEO keeps the descriptive terms.** Titles pair the product with the search phrase, e.g. `THE GRID — Βαθμολογίες Πρωταθλήματος Formula 1 | F1 Stories`.

## Deployment boundaries

The GitHub Pages hosts for Telemetry and Ghost Car are temporary deployment boundaries, not separate brands. The switcher links to them as ordinary same-tab product navigation: no `target="_blank"`, no ↗, no iframe or proxy. When the products later move under f1stories.gr, only the `href`s change.

The `/f1telemetry/` and `/ghostcar/` pages in this repo are pre-existing redirect stubs. The switcher links straight to the live apps, not to the stubs.

| Product | Canonical URL |
|---|---|
| THE GRID | `https://f1stories.gr/standings/` (the main site uses `/standings/`) |
| TELEMETRY | `https://georgiosbalatzis.github.io/f1-telemetry-dashboard/` |
| GHOST CAR | `https://georgiosbalatzis.github.io/ghostcar/` |

## Reference implementation (THE GRID)

Markup is in `standings/index.html` and styles are in `standings/standings-editorial.css` (`.race-desk-nav`). The styles use only `styles/editorial.css` tokens (`--signal`, `--text-primary`, `--text-secondary`, `--border`, `--accent`, `--font-brand`), so both themes work without overrides.

```html
<div class="standings-edition">
    <span>F1 STORIES / RACE DESK</span>
    <nav class="race-desk-nav" aria-label="Race Desk" lang="en">
        <a href="/standings/" aria-current="page">THE GRID</a>
        <a href="https://georgiosbalatzis.github.io/f1-telemetry-dashboard/">TELEMETRY</a>
        <a href="https://georgiosbalatzis.github.io/ghostcar/">GHOST CAR</a>
    </nav>
</div>
<h1>THE GRID. …</h1>
```

- **Position.** The switcher shares the kicker's thin rule, above the H1. Desktop: kicker on the left, products on the right. Below 768px: the products wrap onto their own sub-rule.
- **Visual language.** Labels are Barlow Condensed 700 at 0.9375rem. Inactive labels use `--text-secondary`. The current product uses `--text-primary` plus a 3px signal bar on the rule, so the state does not depend on color alone. Focus is a 2px `--accent` outline. Each target is at least 44px tall. No pills, cards, logo or hamburger.
- **Hierarchy contrast.** Products are marked by a bar on the rule *above* them. THE GRID's report tabs (below the timing band) use an underline *below*, and on mobile they become a `<select>`. The two levels never look alike.
- **Other apps.** Telemetry and Ghost Car should reproduce the same three levels: kicker, product H1, and switcher with their own item current. Map the tokens to their `f1stories-theme` equivalents. Do not ship a shared package yet.
