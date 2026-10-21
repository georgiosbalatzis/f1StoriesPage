# Sitemap modification dates

The P0.5 baseline at `8bb09bca` contains **450 URLs, 444 with lastmod** (rather than the hypothesized 449/443). The generator is `blog-module/build/sitemap.js`, called by `processBlogEntries` in `blog-module/build/index.js`.

| Previously undated URL | Authoritative source | Result |
| --- | --- | --- |
| `/` | Published article records passed to the generator; the newest story supplies the homepage cover and latest stories | `2026-10-20` |
| `/blog-module/blog/index.html` | The same article records supply the archive/index data and Edition pages | `2026-10-20` |
| `/privacy/privacy.html` | The page's explicit “last updated: 9 September 2026” statement | `2026-09-09` |
| `/privacy/terms.html` | The page's explicit “last updated: 9 September 2026” statement | `2026-09-09` |
| `/standings/` | Jolpica driver/constructor snapshots in `standings/standings-cache.json`, plus other standings caches and browser fetches | Omitted: `refresh-standings-data.mjs` sets `generatedAt` on every fetch, without comparing content or recording the upstream modification time. Race dates also do not establish when results/corrections changed. |
| `/authors/` | Biographies and curated story selections in `blog-module/taxonomy.js`, rendered by `authors-page.js` | Omitted: no explicit modification metadata for profiles or selections. A new unrelated article does not establish a directory change. |

Listing dates use the maximum valid publication day, excluding future days (in the publishing timezone, Europe/Athens), drafts and unpublished records. The current pipeline derives publication days from article folder names and preserves them in blog metadata. Empty listings receive no date. Dates do not depend on input order, filesystem times, cache refresh times, deployment time or build time.

The legal pages now encode their existing visible dates in `<time datetime="YYYY-MM-DD">` inside `p.legal-meta`. When the policy or terms change significantly, update both this explicit date and its visible text. The sitemap reads the machine-readable value from that statement; missing or invalid metadata produces no lastmod. Footer dates are ignored.

These are publication-based listing dates, not a complete modification history. Existing article and Edition dates remain unchanged. Older article corrections, editorial selection changes, profile edits, YouTube/standings refreshes and template changes have no reliable source modification contract here; this change does not invent dates for them. Extending coverage requires explicit significant-content modification metadata, or a persisted data-change timestamp maintained by the relevant producer.

## Before/after

- URL count, order and canonical routes: **450 → 450**, no changes.
- Entries with lastmod: **444 → 448**; undated entries: **6 → 2**.
- Sitemap diff: **four inserted lastmod lines, zero removals**. All 444 existing timestamps and all existing changefreq/priority values are unchanged.
- Legal markup: semantic time elements around existing text; no new visible dates.
- Only the build-time sitemap generator's byte budget is remeasured; no browser payload or global tolerance change.

## Validation

`blog-module/build/__tests__/sitemap.test.js` covers XML syntax and namespace, real calendar dates and timezone-qualified timestamp formatting, unique canonical URLs and existing HTML targets, publication-driven updates, explicit legal updates, missing metadata, draft/future exclusions, stable URL order and existing hints, unchanged later builds, ignored cache/build metadata and filesystem timestamp changes.

Two unchanged `npm run build:public` runs produced identical sitemap bytes and identical SHA-256 hashes for all **4,082 public files**. Both runs passed data contracts and public artifact validation. The sitemap before/after comparison verified the exact four-line addition and unchanged loc values.

Passing checks: `test:blog` (259 tests plus golden snapshots), `test:build` (124), `test:standings` (21), `test:author` (6), `test:security` (27), `test:consent`, `quality:static`, `qa:media`, `audit:runtime`, and the scoped size-budget check.

Full builds also expose unrelated generated-source drift in the existing source cache and an archived article. Those changes are excluded from this PR. Live-site URL crawling and browser visual/Lighthouse tests were not run; local canonical targets and the complete deployable artifact are validated.
