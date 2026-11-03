# Curated collections (A-02)

Status: A-02 foundation, merged in #431 (2026-11-03). **No collection is approved or published.**
The two pilots in the manifest are `draft` with `review.status: "pending"` and are proposals for owner review
([pilots](#pilot-proposals)).

A collection is a human-curated, ordered editorial package of already-published F1 Stories articles, with an
introduction and an optional reason for each inclusion. It is not a tag, category, similarity or search result.
It complements [entity hubs](../entity-hubs.md) (one subject, newest first), the Edition Index sections, NEXT UP and
body links; it never changes an article, its canonical or its URL.

## Routes

- `/blog-module/blog/collections/` — index of eligible collections, generated only when at least one is eligible.
- `/blog-module/blog/collections/<slug>/` — one page per eligible collection, no pagination (3–12 articles).

The route follows the repository convention for generated discovery pages (`/blog-module/blog/section/…`,
`/blog-module/blog/entities/…`): same shell, assets, stamping profile and public CSP. A withdrawn collection's URL
returns the normal GitHub Pages 404; no redirect is required or created.

## Source and schema

Source of truth: [`data/audience/collections.v1.json`](../../data/audience/collections.v1.json). It is build input only:
`data/audience/` is never copied to `dist/` and the artifact validator rejects it there.

```json
{
  "version": 1,
  "collections": [{
    "slug": "ascii-kebab-case",
    "status": "draft | published | retired",
    "title": "Greek title (≤90)",
    "description": "Greek description (≤160)",
    "introduction": ["1–4 paragraphs (≤700 each)"],
    "items": [{ "position": 1, "articleId": "20260404G", "reason": "optional (≤280)" }],
    "revised": "YYYY-MM-DD",
    "review": { "status": "pending" },
    "retired": { "date": "YYYY-MM-DD", "reason": "…" }
  }]
}
```

- Keys are strict at every level; an unknown key is an error.
- `slug`: `^[a-z0-9]+(?:-[a-z0-9]+)*$`, at most 60 characters, unique across every record including retired ones.
- `items`: 3–12 entries; `position` runs 1..n in array order; `articleId` is a canonical article folder id
  (`^[\p{L}\p{N}_-]+$`, the same path-safe rule as [retired articles](../../blog-module/build/retired.js)), unique within
  the collection and present in the article archive. Members are referenced by id only: URLs are derived, so external,
  malformed or traversal URLs cannot be expressed.
- `revised`: the last meaningful editorial revision (membership, order, wording).
- `review` approved form: `{ "status": "approved", "kind": "human", "by": "<reviewer>", "date": "YYYY-MM-DD",
  "contentSha256": "<64 lowercase hex>" }`. `date` must not precede `revised`.
- `retired` is required exactly when `status` is `retired`.
- Strings must not have leading or trailing whitespace.

### Content digest

Approval binds the exact content and order. `contentSha256` is the SHA-256 (lowercase hex) of the UTF-8, compact
`JSON.stringify` of a new object with keys in this order: `slug`, `title`, `description`, `introduction`, `items`,
`revised`; each item is rebuilt as `position`, `articleId`, `reason` (omitted when absent). Nothing is trimmed, sorted or
Unicode-normalised: any change, including NFC↔NFD, requires a new review. Print it with
`npm run collections:validate -- --digest <slug>`.

## Editorial approval procedure

1. An editor adds or changes a collection with `status: "draft"` and `review: { "status": "pending" }`, bumps `revised`,
   and opens a PR. CI validates structure; the collection is withheld.
2. The owner or a named editor reviews it locally: `npm run build:public && npm run collections:preview`
   ([preview](#local-preview)).
3. To publish, the reviewer records **their own** approval in the PR: `status: "published"` and an approved `review`
   with their name, the actual approval day and the digest printed for the reviewed content. An agent never records
   an approval, and no approval is inherited from article, hub or Editorial OS approvals.
4. `npm run collections:validate -- --strict` must pass: it fails when a `published` collection would be withheld.
5. Merge and deployment follow the normal reviewed GitHub Pages process.

## Publication eligibility (fail closed)

The build **stops** on structural errors, so they are fixed in the PR that causes them: schema or key errors, duplicate
slug, duplicate member, unknown article, a retired article id (the message names the surviving article; the editor
replaces it, which changes the digest and requires re-approval — never substituted automatically), invalid dates,
incomplete approval records, or an approval dated before the revision.

Otherwise a collection is published only when every condition holds on the build's Athens publication day (injectable
for tests):

1. `status` is `published`;
2. the review is approved, human, named and dated no later than today;
3. `contentSha256` matches the current content;
4. `revised` is not in the future;
5. **every** member is a published article: valid nonfuture date, not draft/unpublished, an existing public page with
   exactly one matching canonical and no robots/googlebot noindex (the entity hub `isPublishedArticle` gate).

If any member fails, the **whole** collection is withheld and its reasons are reported; a curated sequence never
silently shrinks or reorders. Scheduled deployments do not fail for a withheld collection (they simply omit it);
`collections:validate --strict` and the CI test of the real manifest fail instead, so the PR that breaks a published
collection cannot pass quality checks.

## Build integration

- `build:blog` selects collections with the same publication day as the entity hubs, renders eligible pages with the
  discovery shell, the existing row/card markup and image variants, and removes obsolete generated collection pages
  (symlink-safe, owned paths only). Eligible collections add one "Συλλογές" block to the blog index aside; with none
  eligible, the blog index is unchanged.
- Sitemap: only eligible pages, `lastmod` = the latest of review date, revision date and member publication dates.
- `stamp-html` stamps the generated pages like other discovery pages; the drift guard treats them as generated.
- `public-artifact` copies only the files the eligibility gate allows; nothing else under `collections/` and nothing
  under `data/audience/`.
- `validate-public-artifact` recomputes the allowed set and checks the actual `dist/`: exact file set, exact sitemap URLs,
  every collection link targets an eligible page, each detail page lists exactly its members in curated order (visible
  list and `ItemList`) and each member is a published, self-canonical, indexable article page; the index lists exactly
  the eligible collections. Markup is read by a small dependency-free tokenizer shaped on HTML parsing
  (`blog-module/build/html-attributes.js`, shared with the entity hub gate): comments and script/style raw text are
  skipped, attribute quoting follows the HTML states and character references are decoded. Anything it cannot decode
  where it matters (a link `href`, a canonical, a robots meta), and any `<base>` element, fails the build instead of
  being guessed. Known limits (validator fidelity, not publication: the copy allowlist and sitemap come from the
  eligibility gate alone): it is a subset of HTML parsing, so hand-written markup can still disagree with a browser —
  links inside `<template>`, `<noscript>` or `<xmp>` count as present, the `ItemList` is read from any JSON-LD script, and
  whitespace follows JavaScript's definition. Write `&` in URLs as `&amp;` (a bare `&name;` with an unknown name fails
  the check). Generated pages never contain these forms.
- Presentation reuses the Edition row: the left column shows the reading order (`01`, `02`…, decorative; the `<ol>`
  carries the order for assistive technology), the row shows category, title, the human reason (unclamped), author,
  publication date and reading time, and the existing card thumbnail (first eager, the rest lazy). The index lists each
  collection's title, description and article count.
- Pages work without JavaScript; they omit the archive filtering runtime like entity hubs. No CSS, JavaScript,
  dependency or analytics was added.

Commands: `npm run test:collections`, `npm run collections:validate [-- --strict | --digest <slug>]`,
`npm run collections:preview [-- --build-only] [-- --slug <slug>]`.

## Local preview

`collections:preview` renders draft or pending candidates into a new OS temporary directory only, served on loopback
with `X-Robots-Tag: noindex, nofollow`, a noindex meta, loopback canonical/OG/schema URLs and a `Disallow: /` robots
file. It bypasses only `status`, approval and digest; every structural, article and date check still applies. It never
writes to the repository or `dist/` and never records an approval. A noindex preview is not publication.

## Removal and rollback

- **Withdraw one collection:** set `status: "retired"` with a `retired` block (date, reason). Keep the record forever: it
  reserves the slug. The next build removes the page, sitemap entry and links; the URL then returns 404. Verified in
  A-02: after a local publish, withdrawing and rebuilding returned `dist/` to byte-identity with the base artifact.
- **A member must go** (retired, unpublished or noindexed): the build withholds the collection until an editor edits the
  membership and a reviewer re-approves the new digest.
- **Emergency:** reverting the approval commit withdraws the page on the next deployment.
- **Remove the feature:** revert the A-02 merge commit. No article, canonical, URL or analytics state depends on it.

## Measurement

A-02 reuses the [A-01 measurement contract](measurement-contract.md); it adds no event, parameter, dimension, model,
query or identifier.

| Question | Existing source | Label |
| --- | --- | --- |
| Collection supply | The manifest and the eligible set in the build | `VERIFIED_CODE` |
| Clicks from a collection page to an article ([KPI 3](measurement-contract.md#3-article-to-article-discovery), [KPI 4](measurement-contract.md#4-curated-collections)) | Rows use `.blog-card-link`, so the existing consented `internal_page_click` records `link_section=article_link` and `source_path=/blog-module/blog/collections/<slug>/` ([analytics.js](../../scripts/analytics.js)). Models classify that path as `edition` (`classify_path`), so no model separates collections from other Edition pages. | Per collection: `NOT_VERIFIED` (raw export only; no query authorised). Aggregate: `PROXY_ONLY` |
| Collection page views | GA4 `page_view` exists for the path; model 21 groups it under `edition` | `PROXY_ONLY` |
| Reach, exposure, impressions, CTR | None | `NOT_MEASURABLE` |
| Collection completion or a reader's journey | None; clicks are intent, not loads; no visitor joins | `NOT_MEASURABLE` |
| Performance guardrail ([KPI 15](measurement-contract.md#15-core-web-vitals-guardrails)) | RUM covers Edition pages generally; no per-collection split | `PROXY_ONLY` |

Zero events are not zero readers; all GA4 data is consented-population data. If per-collection measurement becomes
necessary, it is a separate, privacy-reviewed proposal (for example an aggregate collection identifier), not part of A-02.

## Ownership and maintenance

- Editorial owner (selection, wording, approval, retirement): the site owner or a named editor — **owner to assign**.
- Code owner: the blog build (`blog-module/build/collections/`).
- Review cadence: when a member article is corrected, retired or unpublished, and at least each season for evergreen
  collections — **owner to confirm**.

## What A-03 consumes

A-03 (Article Reading Journeys) can reuse: the strict manifest pattern, the digest-bound approval, the whole-or-nothing
member gate, the page writer and the artifact checks. A collection is a thematic package with a suggested reading
order, read from its own page. Journey progression, entry points from inside articles and any progress state are A-03
decisions and are deliberately not implemented here.

## Deliberately not implemented

Article-page links to collections, search destinations for collections, homepage placement, social-card images,
pagination, per-collection analytics, personalisation, client-side behaviour, and any automatic membership.

## Pilot proposals

Both are `draft` / `pending` in the manifest. They are agent research proposals, **not editorial approvals**. Members
were checked on 2026-11-03 against the public article pages with the hub publication gate (all published, indexable,
self-canonical, none retired).

### 1. «2026: Η νέα τεχνική εποχή» — `2026-nea-techniki-epochi`

**Thesis:** the 2026 technical reset told in reading order: the rules, the cars as launched, and what the in-season
upgrades did or did not deliver. All nine are Technical-section articles.

| # | Article | Published | Why it is included | Evidence |
| --- | --- | --- | --- | --- |
| 1 | [20260404G](https://f1-stories.gr/blog-module/blog-entries/20260404G/article.html) FIA 2026: Διόρθωση κανονισμών… | 2026-04-04 | Frames the season: power units, active aero, energy management and the FIA's early rule correction | Opening paragraphs of the article |
| 2 | [20260402G](https://f1-stories.gr/blog-module/blog-entries/20260402G/article.html) Τεχνική Παρουσίαση του Williams FW48 | 2026-04-02 | A 2026 car section by section (monocoque to power unit) | Article's nine-part running order |
| 3 | [20260405G](https://f1-stories.gr/blog-module/blog-entries/20260405G/article.html) Audi R26 | 2026-04-05 | New works entrant: power unit, active aero, energy management | Article sections 2–5 |
| 4 | [20260422G](https://f1-stories.gr/blog-module/blog-entries/20260422G/article.html) Ferrari SF26 | 2026-04-22 | The counter-choice: evolution over revolution | Article introduction |
| 5 | [20260923-2G](https://f1-stories.gr/blog-module/blog-entries/20260923-2G/article.html) Η Audi δεν είναι πια η έκπληξη | 2026-09-23 | Returns to #3 fourteen races later | Opening paragraphs |
| 6 | [20260923G](https://f1-stories.gr/blog-module/blog-entries/20260923G/article.html) Το B-spec της Williams | 2026-09-23 | Returns to #2: the FW48's season and B-spec | Opening paragraphs |
| 7 | [20261006F](https://f1-stories.gr/blog-module/blog-entries/20261006F/article.html) Γιατί το νέο πάτωμα δεν έφερε τα δέκατα… | 2026-10-06 | A major upgrade that did not deliver | Opening paragraphs |
| 8 | [20261013G](https://f1-stories.gr/blog-module/blog-entries/20261013G/article.html) Mercedes W17, μα 388mm διαφορά… | 2026-10-13 | Direct follow-up to #7 | Opening paragraphs |
| 9 | [20261015G](https://f1-stories.gr/blog-module/blog-entries/20261015G/article.html) Όσο περισσότερο πιέζουν… | 2026-10-15 | Closes on setup sensitivity across the grid | Opening paragraphs |

Unresolved editorial concerns: the owner should confirm the factual figures in #4 before featuring it; the opinion
piece 20260408J and the Cadillac brake-duct analysis 20260928-2G were considered and left out (owner may add the
latter); the season is ongoing, so the collection needs a review after the final race.

### 2. «Οι μηχανικοί πίσω από τους θρύλους» — `michanikoi-piso-apo-tous-thrylous`

**Thesis:** the History section's 2025 series of engineer portraits, read roughly in chronological order of the
engineers' careers. Five are by Θέμης Χαρβάλης, one (#2) carries the F1 Stories byline.

| # | Article | Published | Why it is included | Evidence |
| --- | --- | --- | --- | --- |
| 1 | [20250819W](https://f1-stories.gr/blog-module/blog-entries/20250819W/article.html) Vittorio Jano | 2025-08-19 | Shaped Alfa Romeo, Lancia and Ferrari | Article introduction and sections |
| 2 | [20250810WF](https://f1-stories.gr/blog-module/blog-entries/20250810WF/article.html) Gioacchino Colombo | 2025-08-10 | Ferrari's first V12 at Enzo Ferrari's invitation | Section 3 heading |
| 3 | [20250816W](https://f1-stories.gr/blog-module/blog-entries/20250816W/article.html) Ρούντολφ Ούλενχαουτ | 2025-08-16 | Mercedes-Benz before and after the war; engineer and driver | Sections 1–4 |
| 4 | [20250815W](https://f1-stories.gr/blog-module/blog-entries/20250815W/article.html) Aurelio Lampredi | 2025-08-15 | The Ferrari V12s, then Fiat | Sections 2–3 |
| 5 | [20250822W](https://f1-stories.gr/blog-module/blog-entries/20250822W/article.html) Valerio Colotti | 2025-08-22 | Gearboxes, from Fangio's Maserati 250F on | Opening paragraphs |
| 6 | [20250905W](https://f1-stories.gr/blog-module/blog-entries/20250905W/article.html) Carlo Chiti | 2025-09-05 | Ferrari, Autodelta and the Brabham-Alfa Formula 1 project | Sections 2–4 |

Unresolved editorial concerns: the order is by career era as described in the articles, not by verified birth dates;
the related TAG-Porsche engine piece 20250807WF was left out because it profiles an engine, not a person; the articles
are short (2–4 minutes), so the owner should judge whether the package is substantial enough.
