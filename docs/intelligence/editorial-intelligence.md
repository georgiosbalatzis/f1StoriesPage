# Editorial intelligence

## I-07A — Offline input contract, version 1

Status: **offline contract and synthetic checks only**. No insights engine, live import, connection check,
query, decryption or dashboard change. The I-06D running-order dashboard remains the visual baseline.
Production reconciliation remains **NOT VERIFIED**; I-06C4 and I-06E exist at base commit
`eb641a8342a0f31650f27eb60460db4bc7eb2306`, but pipeline health does not establish analytical correctness.

`scripts/intelligence/editorial-inputs.mjs` exports:

- `EDITORIAL_INPUT_VERSION = 1`.
- `validateEditorialInputs(doc)` → `{ ok, errors: string[], warnings: string[] }`. No mutation or logging.
  `ok` means schema/provenance **PASS**, not that production measurements are verified. Errors are **FAIL**;
  limitations are **WARNING**. Any failed input must be excluded from conclusions.
- `canonicalArticleUrl(url)` → `{ url, articleId, status: 'mapped' | 'unmapped' }`.
  Invalid/off-host URLs throw; no address on the dead old domain is returned.
- `joinable(a, b)` → boolean for page-level **side-by-side display only**, described below.

No changes to the 400 MiB per-query or 1600 MiB daily guards; no new SQL, schedule, dependency or network client.

### Metric provenance

| Metric | Source | Population | Unit | Window | Lag / cadence | What it is NOT |
| --- | --- | --- | --- | --- | --- | --- |
| Search clicks | Search Console Performance, web | Google web-search interactions for the exact exported property/filter selection | clicks from Google results to the site | Exact inclusive export dates; `date: null` for period totals | Typically a few days; recent data can be preliminary; completeness NOT VERIFIED | GA4 page_view events, sessions, unique readers, all-site traffic |
| Search impressions | Same GSC export | Eligible result appearances under Google's search-result visibility rules | impressions | Same export selection | Same GSC lag | People, page loads; query-row sum is not guaranteed to equal report totals |
| Search CTR | Same GSC export | Clicks divided by impressions for this row's grain | ratio 0…1, not percent points | Same export selection | CSV percentages can be rounded | A site conversion rate; never average CTRs across rows |
| Search position | Same GSC export | Topmost result position per impression, averaged at the declared page/property aggregation | average position (1 is highest); null only without impressions | Same export selection | Same GSC lag | An exact daily rank for every search; never average row averages |
| Article page views | Snapshot model `10-article-pageviews` | Consented GA4 Main events with article identity; retired aliases resolve to survivors | `page_view` events | Latest ≤28 mature days, or all mature days since 2026-10-19 | Ends at `asOf − 4`; daily | Readers, sessions, unique document visits, whole audience |
| Category counts | Snapshot model `11-category-pageviews` | Same editorial event population, grouped by primary category | `page_view` events | Same primary window as model 10 | Same GA4 maturity; daily | Catalogue size or a count of people |
| Discovery clicks | Snapshot model `13-article-discovery` | Consented `internal_page_click` events with destination article key | click events | Primary window **of discovery's own asOf day** | Weekly; carried 1–7 days expected, 8–13 overdue, older rejected | Destination loads, visits, unique journeys; clicks do not prove the destination loaded |
| RUM assessment | Owner's local I-06C4 assessment of models `30-cwv-summary`, `33-rum-coverage` | Consented, revision-deduplicated `wv6.2.3-rum1` observations, keeping coverage classes separate | assessment about observations; v1 carries no p75 values | Primary window **of RUM's own asOf day** | Daily; may be carried exactly one day on discovery days | Whole-audience speed or a production PASS inferred from a valid input shape |
| Catalogue | Public compact v2 index and reviewed entity associations | Public article metadata at this checkout | articles | Observation date, normally `start = end = asOf` | Static; no analytics lag | Historical catalogue, demand, or evidence that an article was read |
| Internal links | Public built HTML, if supplied locally | Observed internal hyperlinks | directed edges | Observation date | Static; no analytics lag | Clicks, navigation journeys, link effectiveness |

GSC records **exactly one** property identifier: `https://f1-stories.gr/` (URL-prefix property) or
`sc-domain:f1-stories.gr` (domain property). They have different scope and are **not interchangeable**.
V1 accepts only web search; the owner must confirm that selection before importing. Other search types,
localized CSV headers/numbers, additional report columns and filtered exports whose selection cannot be
represented by these dimensions are unsupported; do not label them as a complete unfiltered export.

GSC `aggregation: page` requires a page on every row. `aggregation: property` requires `page: null` and
`mapping: null`: a Queries export cannot acquire a page by matching query text to an article title.
Google normally attributes Performance data to its selected canonical URL; our repository mapping does not
prove Google's canonical selection. Page and property aggregation can count appearances differently.
Low-volume/anonymised queries may be omitted by Google; a null/omitted query is not proof of no query activity.
Export row limits and omitted queries mean that summing exported rows cannot establish the property's total.

### Calendar periods, maturity and missing data

Every supplied section carries `source`, `population`, `unit`, `period: { start, end }`, `timezone`,
`asOf`, `freshness: { cadence, carried, dataState }`, and `status`. Dates are exact inclusive `YYYY-MM-DD`
calendar dates in the declared IANA timezone, **not UTC timestamps**. `asOf` is the section's own extraction/
model day, not today's day substituted during import. Periods cannot end after that day.

`status` is `present`, `NOT VERIFIED` or `absent`. A missing optional section has no evidence; it is never a
zero. An explicitly unavailable section keeps its provenance and requested period but omits its data arrays
(or RUM `assessment`). Its unavailable state produces a warning. `freshness.dataState` is `final`,
`preliminary` or `NOT VERIFIED`; it describes maturity, not reconciliation. `final` is an owner's assertion,
not independently established by this validator. Defaults for imported GSC data are `NOT VERIFIED`.

GSC daily dates use `America/Los_Angeles`; recent days can be preliminary. The validator warns when the end
is newer than `asOf − 3`, and `joinable` refuses such a recent GSC period even if labelled final. This is a
conservative local display rule, **not a guarantee that three-day-old GSC data is complete**. Confirm the
export's data state locally. GSC lag is separate from GA4's documented late-arrival updates: the snapshot
requires the exact primary window from `windowFor(asOf)`, ending at `asOf − 4`, at most 28 days and never
before 2026-10-19. An immature or relabelled snapshot window is a FAIL.

The snapshot also holds `20-daily-activity`, `26-acquisition-session`, `28-internal-navigation` and
`29-audience-coverage`. Models 26/29 have a separate ≤7-day window; they are **not accepted as substitutes**
for this contract's primary-window article/category data. V1 does not carry these audience models.
Discovery model 13 has weekly provenance; model 28 is also weekly but is not part of this article input.
Preserve `modelWindows[model]` and its `asOf` for carried models; otherwise use the snapshot's primary
`window` and `asOf`. RUM and discovery must never inherit today's dates over older rows.

### Exact shape and units

The root requires `version` and boolean `synthetic`. `true` means **all measurements and query strings are
invented for a test**; it is an attestation, not a detection mechanism. Optional keys are `gsc`, `site`,
`catalogue`, `linkGraph`, `comparisons`. Unknown keys at every object level fail, including visitor-level
fields. No input is a raw dashboard payload or an encrypted envelope.

Fixed `(source, population, unit)` tuples:

| Section | Tuple | Cadence | Data required when `present` |
| --- | --- | --- | --- |
| `gsc` | `search-console`, `google-search`, `search-performance` | `daily` | `rows`; always declare `property`, `aggregation`, `searchType: web` |
| `site` | `ga4-bigquery`, `consented-ga4-events`, `events` | `daily` | `articles`, `categories` |
| `site.discovery` | `ga4-bigquery`, `consented-ga4-events`, `events` | `weekly` | `rows` |
| `site.rum` | `ga4-bigquery`, `consented-rum-observations`, `observations` | `daily` | `assessment`: `PASS`, `WARNING`, `FAIL`, `NOT VERIFIED` |
| `catalogue` | `repository`, `public-articles`, `articles` | `static` | `rows` |
| `linkGraph` | `repository`, `public-internal-links`, `edges` | `static` | `rows` |

Only discovery and RUM can declare `carried: true`. Their own `asOf` must be older than `site.asOf`
exactly when carried, within their respective 13-day/1-day limits. Each retains its exact mature window.
Nested discovery/RUM sections are optional and have their own availability; an absent nested section must
not be inferred from another metric. An empty `present` array asserts that its supplied aggregate has no
rows, so use unavailable/omit the section when extraction did not happen.

Row schemas are illustrated completely below. GSC `query` alone is optional (string or null); the other
dimension keys are required and nullable. `date: null` means the full declared period, `country: null` and
`device: null` mean no exported breakdown. Device, when supplied, is `DESKTOP`, `MOBILE` or `TABLET`;
country is the exported nonempty country label/code. A non-null date must lie in the section's period.
Do not mix daily and whole-period rows. GSC dimensions retain their exported grain without summing or
joining by query. Counts are finite safe nonnegative integers; clicks cannot exceed impressions.
CTR is a finite ratio 0…1 (zero without impressions), and position is finite ≥1, or null with zero
impressions. Rounded CTR is preserved, not recomputed or forced to exact equality with clicks/impressions.

Site articles have `page`, `mapping`, `page_view_events`; categories have `category`, `page_view_events`.
Discovery rows additionally retain `source_surface` and `link_section` with `click_events`, preserving
their existing model-13 grain. The snapshot's `(unmapped)` aggregate uses `page: null, mapping: unmapped`;
do not fabricate a URL for its hidden keys or lose its count. Retain explicit `(unknown)`/`(unmapped)`
categories. Duplicate canonical article rows, categories, discovery grains or exact GSC exported grains
fail; no rows are silently summed. Different original GSC alias URLs remain separate exported rows.

Catalogue rows use `id`, `url`, `title`, `category`, `published`, `entities`. Derive metadata with the
existing `articleMetadata`/`buildMapping(readInputs())` helpers; use the build's encoded article URL helper.
`category` is the index row's first category (not alphabetically sorted). Public entity IDs come from
`blog-module/build/entities/associations.json` and its registry: only human-approved substantive primary/
secondary F1/mixed associations, as in entity hub selection, never tag candidates or pending proposals.
`entities: []` is valid. This validator checks identity/shape, not the truth of supplied titles or entity
membership. Link edges use `from`, `to`, `fromMapping`, `toMapping`; endpoints stay on the canonical host.
Known article endpoints must be canonical, and other resources remain `unmapped` rather than becoming articles.

### Article identity and joins

Identity imports `buildMapping` from `editorial-model.mjs` and the build's `retired.articleUrl`; no second
retirement map or slug inference. Only a known `/blog-module/blog-entries/<id>/article.html` is an article.
Query/fragment variations of a recognized article resolve to its encoded canonical address. Raw/encoded
Greek Tau alias `20260227Τ` resolves to `20260222T`; it is not Latin `20260227T`. `20260822G` resolves to
`20260822J`. Double encoding, unknown IDs, wrong case, directory URLs, assets and future `/stories/` paths
stay distinct, `unmapped`, with their original URL intact. No directory/asset is collapsed onto an article.
Off-host URLs, including the dead old domain, insecure URLs and embedded userinfo are rejected.

First require `validateEditorialInputs(doc).ok`. For an optional display join use:

```js
const a = { ...doc.gsc, ...doc.gsc.rows[0] };
const b = { ...doc.site, ...doc.site.articles[0] };
if (joinable(a, b)) {
    // Display separately labelled source metrics. No ratio, delta or reconciliation across instruments.
}
```

Both descriptors must be present/final, have compatible maturity, the **same mapped canonical page**, and
**identical inclusive calendar periods and timezone**. A dated GSC row's effective period is that single
day, so it cannot join a seven-day article aggregate. Two GSC descriptors additionally require the exact
same property identifier. Unknown pages, property-level Queries rows and unavailable/preliminary data do
not join. Static metadata association by article ID is separate from this metric-period gate.

`comparisons` optionally records `{ left, right, operation }`; references are `gsc.clicks` or
`site.page_view_events`, operations `side-by-side`, `compare`, `reconcile`. A cross-instrument `compare`/
`reconcile` declaration produces a **WARNING** and is **never executable**, even with `ok: true`.
An insights engine must refuse it. GSC clicks and GA4 consented page_view events have different
populations/units; no ratio, difference, equality check or conversion claim between them is valid.
Before/after observations are not causal. At roughly five consented visitors per day, small samples call
for abstention, not invented rankings or evidence. Greek owner copy: «Μικρό δείγμα — δεν προκύπτει
ασφαλές συμπέρασμα.» / «Μη επαληθευμένα δεδομένα — δεν εξάγεται συμπέρασμα.»

### Owner-local import, optional and read-only

1. Use existing read-only access to Search Console Performance (no new ownership, API, Cloud service,
   credential or IAM grant). Whether this property is connected/access is available is **NOT VERIFIED**.
2. Locally select the exact property, web search, dates and unfiltered Pages **or** Queries tab. Export CSV
   using the English column/number format. Extract a downloaded export locally if it is a ZIP; pass the
   individual Pages/Queries CSV, not the ZIP. This CLI does not download anything.
3. Check the export's dates, data state, scope, omissions and row limits. The CSV itself does not prove
   property, filters, dates or completeness, so these are owner-supplied assertions. Pages becomes `page`
   aggregation; Queries becomes `property`. Country/device/date are null because these tab exports do not
   provide those breakdowns. Do not invent per-day values or pages for a Queries export.
4. Run locally, outside CI; use a new file in an existing private directory outside every repository.
   Replace these **synthetic example** dates with the exact dates you exported:

```sh
node scripts/intelligence/editorial-inputs-import.mjs \
  --csv="$HOME/private-intelligence/Pages.csv" \
  --property=https://f1-stories.gr/ --search-type=web \
  --start=2026-10-19 --end=2026-10-25 --as-of=2026-10-29 \
  --output="$HOME/private-intelligence/editorial-inputs.json"
```

Default output is `$HOME/f1stories-editorial-inputs.json`, outside the worktree. It must not already exist;
the CLI never overwrites files or symlinks and creates output with mode `0600`. Parent directories must
already exist. `--data-state=final` is optional **only after local confirmation**; without it maturity is
`NOT VERIFIED`. `--site=/private/path/site-aggregates.json` optionally accepts **only the `site` section**
in this contract, prepared locally by the owner from already-available aggregates. The tool neither
accepts keys nor decrypts/reads a dashboard payload. No decrypted dashboard file belongs in this process.

The importer supports BOM, CRLF, CSV quoting, commas in quoted fields and English numeric grouping.
Headers are exactly `Top pages` or `Top queries`, then `Clicks,Impressions,CTR,Position`. CTR uses `%` in
the CSV and becomes a ratio. Unsupported formats fail closed. Errors/logs do not echo row values,
query text, local paths, or parser exceptions. CLI success reports schema PASS and a warning count only;
inspect `validateEditorialInputs` results privately for detail. CI execution is refused, even for the CLI's
synthetic flag; automated tests invoke only synthetic inputs in temporary local subprocesses.

Writing in this worktree is refused unless **both** `--synthetic` and `--allow-repo-path` are given, and
then only a new `.json` under `scripts/intelligence/__tests__/fixtures/editorial-inputs/` is allowed.
Symlinked parent directories are resolved before enforcing this check. `--synthetic` never anonymises
real data: use it only for wholly invented fixtures.

### Privacy and outstanding verification

This is a PUBLIC repository. Real analytics counts and search queries **never** enter commits, issues,
PR text, CI, logs or artifacts; not even an allegedly anonymised export. Only invented fixtures and public
article identities are allowed here. Keep owner exports and outputs private/outside repos. No credentials,
decryption keys, decrypted dashboards, visitor IDs, session IDs or visitor-level joins. The strict schema
rejects extra fields, but cannot detect personal information disguised as allowed query text; the local
output is private and must not be published. Tests access only public repository metadata and invented data.

**NOT VERIFIED:** GSC property connection, permissions, export authenticity/completeness/filter selection,
Google-selected canonicals, real query suppression, real data freshness, GA4 stream/export completeness,
production I-06C4 reconciliation, RUM production assessment, and any actual editorial conclusion. The input
validator does not replace `validate-snapshot.mjs`; it validates this smaller input contract only.
No production data was accessed to implement I-07A.

### Complete synthetic example

Public IDs/URLs below are real catalogue identities; **all titles, category labels and measurements are
invented**. This is the exact fixture `__tests__/fixtures/editorial-inputs/synthetic.json`, including carried
discovery and a RUM assessment left NOT VERIFIED.

```json
{
  "version": 1,
  "synthetic": true,
  "gsc": {
    "source": "search-console",
    "population": "google-search",
    "unit": "search-performance",
    "period": { "start": "2026-10-19", "end": "2026-10-25" },
    "timezone": "America/Los_Angeles",
    "asOf": "2026-10-29",
    "freshness": { "cadence": "daily", "carried": false, "dataState": "final" },
    "status": "present",
    "property": "https://f1-stories.gr/",
    "aggregation": "page",
    "searchType": "web",
    "rows": [
      {
        "date": null,
        "page": "https://f1-stories.gr/blog-module/blog-entries/20260222T/article.html",
        "mapping": "mapped",
        "query": null,
        "country": null,
        "device": null,
        "clicks": 1,
        "impressions": 4,
        "ctr": 0.25,
        "position": 3.5
      }
    ]
  },
  "site": {
    "source": "ga4-bigquery",
    "population": "consented-ga4-events",
    "unit": "events",
    "period": { "start": "2026-10-19", "end": "2026-10-25" },
    "timezone": "America/Los_Angeles",
    "asOf": "2026-10-29",
    "freshness": { "cadence": "daily", "carried": false, "dataState": "final" },
    "status": "present",
    "articles": [
      { "page": "https://f1-stories.gr/blog-module/blog-entries/20260222T/article.html", "mapping": "mapped", "page_view_events": 3 }
    ],
    "categories": [ { "category": "SYNTHETIC category", "page_view_events": 3 } ],
    "discovery": {
      "source": "ga4-bigquery",
      "population": "consented-ga4-events",
      "unit": "events",
      "period": { "start": "2026-10-19", "end": "2026-10-23" },
      "timezone": "America/Los_Angeles",
      "asOf": "2026-10-27",
      "freshness": { "cadence": "weekly", "carried": true, "dataState": "final" },
      "status": "present",
      "rows": [
        { "page": "https://f1-stories.gr/blog-module/blog-entries/20260222T/article.html", "mapping": "mapped", "source_surface": "home", "link_section": "article_link", "click_events": 1 }
      ]
    },
    "rum": {
      "source": "ga4-bigquery",
      "population": "consented-rum-observations",
      "unit": "observations",
      "period": { "start": "2026-10-19", "end": "2026-10-25" },
      "timezone": "America/Los_Angeles",
      "asOf": "2026-10-29",
      "freshness": { "cadence": "daily", "carried": false, "dataState": "final" },
      "status": "present",
      "assessment": "NOT VERIFIED"
    }
  },
  "catalogue": {
    "source": "repository",
    "population": "public-articles",
    "unit": "articles",
    "period": { "start": "2026-10-29", "end": "2026-10-29" },
    "timezone": "Europe/Athens",
    "asOf": "2026-10-29",
    "freshness": { "cadence": "static", "carried": false, "dataState": "final" },
    "status": "present",
    "rows": [
      { "id": "20260222T", "url": "https://f1-stories.gr/blog-module/blog-entries/20260222T/article.html", "title": "SYNTHETIC — δοκιμαστικό άρθρο", "category": "SYNTHETIC category", "published": "2026-02-22", "entities": [] }
    ]
  },
  "linkGraph": {
    "source": "repository",
    "population": "public-internal-links",
    "unit": "edges",
    "period": { "start": "2026-10-29", "end": "2026-10-29" },
    "timezone": "Europe/Athens",
    "asOf": "2026-10-29",
    "freshness": { "cadence": "static", "carried": false, "dataState": "final" },
    "status": "present",
    "rows": [
      { "from": "https://f1-stories.gr/blog-module/blog-entries/20260222T/article.html", "to": "https://f1-stories.gr/blog-module/blog-entries/20260822J/article.html", "fromMapping": "mapped", "toMapping": "mapped" }
    ]
  },
  "comparisons": [ { "left": "gsc.clicks", "right": "site.page_view_events", "operation": "side-by-side" } ]
}
```
