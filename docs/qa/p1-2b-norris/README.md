# P1.2b — publish the approved Lando Norris hub

Publication authorization: **human**, reviewer **georgiosbalatzis**, **2026-10-21**, exclusively `driver:lando-norris`. This records the owner's explicit authorization supplied for this change. Human PR review and merge are still required. No merge or deployment was performed; production HTTP/SEO verification is pending.

## Scope and eligibility

Based on clean `origin/main` `57789deb` (PR #314). Only Norris's `hub.review` changes in the registry. The approved introduction object (heading, wording, punctuation, paragraph break and review) is identical to the base. The introduction text SHA-256 remains `c22b63f39a6e9bd3eead29609d352bd1e3cc0a98623060634394dc5640e0c2d4`.

| Article | Role | Original publication date |
| --- | --- | --- |
| `20260725W` | primary | 2026-07-25 |
| `20260822W` | primary | 2026-08-22 |
| `20260824W` | primary | 2026-08-24 |
| `20260927G` | secondary | 2026-09-27 |

All four associations are substantive, `discipline: f1`, approved by human reviewer `georgiosbalatzis` on `2026-10-21`. Their recorded source evidence passes the existing association validator. All four articles are published, non-draft, non-future, indexable and have exactly one original canonical under `https://f1-stories.gr/blog-module/blog-entries/<ID>/article.html`. Generation order is `20260927G`, `20260824W`, `20260822W`, `20260725W`.

The association manifest is unchanged: six approved associations across Norris/Hamilton and 91 pending records. Norris `20260928G` remains excluded from membership as a pending candidate. Mentions, exclusions and unpublished articles never qualify; existing fixture tests retain these checks. Hamilton, Ferrari, McLaren, Singapore GP and Sepang still have pending hub reviews and generate no public pages.

## Exact public artifact comparison

The baseline was built from the clean main worktree before changing approval; its generated source had no Git drift. The candidate used that worktree with only the approval/test changes. Both ran the existing `npm run build:public` pipeline without changing inputs or environment between builds. Complete relative-path/SHA-256 comparisons cover every public file, including optimized media and generated social cards. The baseline artifact was frozen separately before the candidate build.

- Baseline: **4,082 files**; candidate: **4,083 files**.
- **Added:** `blog-module/blog/entities/drivers/lando-norris/index.html`.
- **Modified:** `sitemap.xml`, adding only the Norris URL, recorded `lastmod` `2026-10-21`, weekly frequency and priority `0.6`.
- **Removed:** none.
- No other public files differ. All existing article HTML and public metadata, images, recommendations, homepage, JavaScript and CSS remain byte-identical. Source article directories, source cache, compact article index, home data and associations also have zero Git diff.
- A full unchanged rebuild matches all **4,083** candidate paths/hashes.
- Withdrawing only Norris's hub approval and rebuilding removes its generated source page and yields an artifact identical to all **4,082** baseline files. Restoring approval and rebuilding restores the exact **4,083** candidate hashes.

Tree digest is SHA-256 of compact, key-sorted JSON mapping relative paths to SHA-256 hashes:

- Baseline: `0c1c78c881bda4215b5fc4f7ce06b869900f98eca6c239295ede08fea85e465e`.
- Candidate: `798c39866927ac2b736c6701a9eb1b97429a2e1ce5bacb7cdcada092ae6bf40f`.

[Machine-readable exact public difference](public-diff.json). QA documentation, screenshots and the smoke verifier do not ship in the public artifact.

## SEO and HTTP checks on the actual artifact

Canonical public URL: `https://f1-stories.gr/blog-module/blog/entities/drivers/lando-norris/`.

The local artifact responds HTTP 200. Exactly one title, one h1, Greek description, one self-canonical, Open Graph title/description/image/type/URL and Twitter summary/title/description/image all pass. Social metadata reuses the existing F1 Stories icon. BreadcrumbList positions and canonical items, CollectionPage language/date/references, and ItemList's four original URLs and ordering pass. There is no `noindex`, preview URL or loopback URL in the generated page; the local response has no blocking X-Robots-Tag.

The sitemap has exactly one entity URL: Norris, exactly once, with `lastmod: 2026-10-21` derived from the recorded human approvals rather than the build clock. Removing that XML entry yields the baseline sitemap byte-for-byte. `robots.txt` advertises the canonical sitemap. All four original article links respond HTTP 200 with unchanged canonicals locally. All other five entity routes respond HTTP 404 locally. Production results remain pending.

## Tests

| Command | Result |
| --- | --- |
| `npm run entities:validate` | pass |
| `npm run entities:report` | pass; only Norris eligible, four qualifying dates/articles |
| `npm run test:entities` | 55 passed |
| `npm run test:taxonomy` | 44 passed |
| `npm run test:blog` | 319 passed; golden snapshots match |
| `npm run test:build` | 131 passed |
| `npm run build:public` | baseline/candidate/rebuild/withdrawal/restoration all pass |
| `npm run build:check` | pass after committing generated outputs |
| `npm run quality:static` | pass |
| `npm run perf:budget` | pass; unchanged budgets |
| Focused entity generation/public artifact/routing tests | 53 passed |
| `python3 docs/qa/p1-2b-norris/verify-page.py http://127.0.0.1:18732` | pass against candidate `dist/` |

Focused command: `node --test blog-module/build/__tests__/entities-hubs.test.js scripts/build/__tests__/public-artifact-refs.test.mjs scripts/build/__tests__/publication-routing.test.mjs`.

The real-data publication regression checks the exact approval, four IDs, original titles/dates/URLs, pending exclusion, other five reviews, canonical, sitemap delta/lastmod, deterministic generation and safe approval withdrawal. Existing synthetic tests continue covering draft/future/noindex, mentions, exclusions, invalid canonical and cleanup boundaries.

## Visual QA

Inspected the generated `dist/` page in Chrome at **1440 × 1080** and emulated mobile **390 × 844**, verifying actual `innerWidth` rather than only window size. `scrollWidth` equals the viewport at both widths; no overflowing main-content elements at 390px. Greek heading and both approved paragraphs display correctly in IBM Plex Sans; all four responsive images decode successfully at both widths and retain dimension attributes. Article titles, dates, links and breadcrumbs match the existing records. The layout reuses the existing Edition shell, cards, responsive stacking, navigation, footer and consent UI; no browser code or styles were added. No browser console errors were observed. Screenshots show the page after declining optional analytics; the existing first-visit consent panel was also inspected.

- [Desktop, 1440px](desktop-1440.png)
- [Mobile, 390px](mobile-390.png)

## Performance

Fresh mobile simulated Lighthouse, three audits per route, median per metric. Temporary budget selections copy the existing Blog thresholds verbatim; no repository budget changes. Norris is a new route, so there is no previous Norris measurement. The existing Blog page is byte-identical across builds and supplies the relevant comparative check.

| Artifact / route | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Main baseline / Blog | 99 | 100 | 100 | 100 | 2178 ms | 0.004 | 0 ms |
| Candidate / Blog | 98 | 100 | 100 | 100 | 2178 ms | 0.000 | 22 ms |
| Candidate / Norris | 99 | 100 | 100 | 100 | 2027 ms | 0.000 | 0 ms |

All selected route gates pass, including LCP ≤2500 ms and CLS ≤0.02. Norris uses 14.3 KB transferred JavaScript, 84.9 KB inline CSS, 271 DOM elements and two third-party requests, all within unchanged thresholds. Existing article/home output remains byte-identical. The full Home/Article Lighthouse suite was not rerun; previously reported baseline LCP failures are neither fixed nor attributed to this change. Remote CI remains independently required.

## Rollback

Before merge, close this PR if publication is cancelled. After merge, withdraw only `driver:lando-norris.hub.review` to `{ "status": "pending" }`, keeping the approved introduction and associations intact. Run `npm run build:public`, review deletion of `blog-module/blog/entities/drivers/lando-norris/index.html` and removal of its single sitemap entry, and update the real-data tests to expect the revoked decision. Run the same tests/static checks, commit generated outputs, then run `npm run build:check`; submit that rollback for human review/deployment. Do not delete or modify the linked articles. The full-build withdrawal/restoration rehearsal above confirms this restores the original public artifact exactly.

## Production verification after human merge and successful Pages deployment

1. Confirm this PR has been human-reviewed/merged and the `Site Maintenance` / `Deploy Pages` workflow for the resulting main commit has succeeded, including the `github-pages` deployment. Do not treat a local build or PR check as deployment.
2. From the merged repository checkout, run:

   ```sh
   python3 docs/qa/p1-2b-norris/verify-page.py
   ```

   The default origin is `https://f1-stories.gr`. This read-only check requires hub HTTP 200, no blocking robots directive/header, the exact canonical and social metadata, valid collection/breadcrumb/article JSON-LD, one Norris sitemap entry with recorded lastmod, four working original article links/canonicals, and HTTP 404 for the other five hub routes. Any failed assertion or HTTP/network error fails the smoke test; do not report production success then.
3. Open the canonical hub at 1440px and 390px and confirm the four images and breadcrumbs. Record the deployed main SHA, workflow/deployment URL, verification time and smoke output in the PR.

**Current production verification status: pending human merge and deployment.** No P1.3 work is included.
