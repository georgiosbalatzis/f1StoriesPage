# Editorial data model (I-03)

Status: **statically tested and `PRODUCTION_EXECUTED`, not production-validated.** On 2026-10-26 the owner executed
`10`–`15` against `f1-stories-analytics.analytics_485678890` in the BigQuery Console, for 2026-10-19 → 22. The
reported reconciliations passed: 40 article page-view events across 11 articles, and no unexplained unmapped
events. The synthetic tests check identity mapping, SQL text and SQL rules executed in JavaScript, and they prove
nothing about production data. The I-02 record ([#353](https://github.com/georgiosbalatzis/f1StoriesPage/pull/353))
was closed without merging. Results and outstanding items: [bigquery-validation.md](bigquery-validation.md).

## Architecture

```text
blog-module/blog-index-data.json   (compact v2, existing; docs/data-contracts.md)
blog-module/retired-articles.json  (existing)
        │  scripts/intelligence/editorial-model.mjs   (reads only; never queries)
        ├─ metadata → { articles, aliases, summary }    JSON on stdout
        └─ render <model> --project= --property=      SQL on stdout
              docs/intelligence/sql/models/<model>.sql
                └─ {{EDITORIAL_BASE}} = models/base.sql
                      article_lookup  ← inline literal from the index (id, title, published_day, primary_category, author)
                      article_alias   ← inline literal: URL key → canonical id (raw, %XX, %xx; retired → target)
                      window_bounds   ← @start_day, @end_day, @as_of_day
                      events → keyed → resolved → editorial   (consented, https://f1-stories.gr only)
```

There is no new article database: the lookup is regenerated from the committed index at render time, so it matches
the commit you render from. Nothing is uploaded to BigQuery. The I-01 queries ([02](sql/02-event-inventory.sql),
[03](sql/03-web-vital-integrity.sql)) remain the inventory and integrity checks; the models do not repeat them.

## Article metadata mapping

| Field | Source (compact row) | Missing → |
| --- | --- | --- |
| `article_id` | `row[0]`, the folder name | row rejected |
| `title` | `row[1]` | `NULL` |
| `published_day` | `row[3]`, validated `YYYY-MM-DD` | `NULL` (age bucket `unknown`) |
| `primary_category` | `c[row[8][0]]`, the build's primary | `NULL` (`(unknown)`) |
| `author` | `a[row[2]]` | `NULL` (`(unknown)`); no house-byline guess |

The output is sorted by id, with no timestamps, so it is deterministic. Duplicate ids, retired ids that are still
live, retired targets missing from the index, and URL keys mapping to two articles all fail loudly. At `7d55c67a`: 412
articles, 416 keys (4 retired), no missing field (`node scripts/intelligence/editorial-model.mjs metadata`).

**Identity from URLs.** Only `https://f1-stories.gr` paths matching `/blog-module/blog-entries/<key>/` or
`.../<key>/article.html` count. Assets, nested paths, other hosts, `http:`, `www.` and previews are excluded. The
fallback is the emitted `article_id` parameter: page views and engagement use the page path; clicks use their
destination `link_path`. BigQuery has no URL decoding, so `<key>` is matched against every form an id can take: raw,
percent-encoded upper-case (browser form) and lower-case. The two retired ids map to their survivors:
`20260227Τ` (`%CE%A4`) → `20260222T` and `20260822G` → `20260822J`. Unknown keys are reported as `(unmapped)` with
a key count, never listed.

## SQL contracts

Render, then dry-run and run by hand in the EU dataset, with maximum bytes billed of 100 MB:

```sh
node scripts/intelligence/editorial-model.mjs render 10-article-pageviews --project=f1-stories-analytics --property=485678890 > /tmp/m10.sql
```

Parameters, all models: `@start_day`, `@end_day`, `@as_of_day` (DATE). Models 10–14 also take `@min_events` (INT64).
Every row carries `from_day` and `through_day`.

| Model | Grain | Counts |
| --- | --- | --- |
| `10-article-pageviews` | article | `page_view_events`, `via_retired_url_events`, `days_with_events`, `unmapped_keys` |
| `11-category-pageviews` | primary category | `page_view_events`, `articles_with_events`, `catalog_articles` (index articles published ≤ `through_day`) |
| `12-article-engagement` | article | `page_view_events`, `article_engaged_events`, `engaged_events_per_page_view_event` |
| `13-article-discovery` | destination article × source surface × `link_section` | `click_events` |
| `14-publication-age` | age bucket × primary category | `page_view_events`, `article_engaged_events`, `articles_with_page_views`, `min_age_days` |
| `15-coverage` | event × `analytics_storage` × primary host × article status | `events`, `days_with_events`, before the consent/host filter |

Age buckets: `before_publication`, `day_0`, `day_1`, `days_2_6`, `days_7_29`, `days_30_89`, `days_90_364`,
`days_365_plus`, `unknown`. Source surfaces: `home`, `article`, `entity_hub`, `edition`, `authors`, `standings`,
`other`.

**Filters (base.sql).**
- Events `page_view`, `article_engaged` and `internal_page_click` only.
- `privacy_info.analytics_storage = 'Yes'`.
- `page_location` starts with `https://f1-stories.gr/`.
- Daily tables only (no `events_intraday_*`), at most 90.
- Days after `@as_of_day − 4` are excluded as immature: GA4 may update a table for 72 h after the day closes.
- `@as_of_day` more than a day in the future aborts the query.

The same parameters re-read the same tables. Only late arrivals inside already-mature tables could change a result.

## What the counts are

All counts are **events**. They are not users, sessions, unique document visits or readers. `articles_with_*` counts
articles. No query reads visitor, session, device, geography, referrer or free-text fields. Every output is an
aggregate, and no raw rows leave BigQuery.

**Engagement proxy.** `engaged_events_per_page_view_event` divides two event counts over the same window. An
`article_engaged` event means one document reached 30 visible, consented seconds and 50% scroll. It is not reading
completion, and it is not matched to page views by session or document. It is not a deduplicated reader engagement
rate, and it can exceed 1 (for example after a lost `page_view` beacon). Call it "engaged events per page-view event".

## Coverage, freshness, sample counts

- **Coverage.** The data covers consented Main-site visits only ([metrics contract](metrics-contract.md#population-and-coverage-bias)).
  The four tools are not in it. Run `15-coverage` with every model result and state what the filter dropped.
- **Freshness.** `through_day` ≤ `@as_of_day − 4`. Record `@as_of_day` with every result. The catalog is the index at
  the render commit: articles published later are absent, and retired articles appear only through their survivor.
- **Sample counts.** `meets_min_events` flags rows; nothing is dropped. Use `@min_events = 30` before ranking
  articles, comparing categories or quoting the engagement ratio. Do not show cells under 10 events outside the
  owner. The owner reported 84 page views for 19–22 October (closed #353), so most article rows will be flagged. Read categories and age
  buckets over 28-day windows first.

## Known limitations

- Each article has a single primary category; secondary categories are not attributed.
- `scripts/author/article-index.js` `expandCompactPosts` re-sorts categories into taxonomy order, so its `category`
  differs from `categoryIndexes[0]` for 30 articles. The model follows the data contract. The author tool is
  unchanged and is not used here.
- `published_day` is the editorial date, while the event day is in the property time zone (unknown), so
  `before_publication` rows can be offset artefacts.
- `analytics_storage` values, `page_location` on `article_engaged` and `internal_page_click`, and the property time
  zone are unverified. If `15-coverage` shows no `'Yes'`, the models return nothing rather than unconsented data.
- Locally, only the regular expressions and CASE rules are executed. Joins, `GROUP BY` and BigQuery type checks are
  first exercised by an analyst dry-run.

## Still blocked

I-02 (#353) was closed without merging. The owner's 19–22 Oct Console runs (`as_of_day = 2026-10-26`) cover the
first execution. The owner reported 219.08 KB for `10`; no figure is recorded for the other models. Still open (see
[bigquery-validation.md](bigquery-validation.md#outstanding)):
- The 2026-10-19 → 25 validation; that window is not mature before 2026-10-29.
- GA4 Admin confirmation that property `485678890` is `G-X68J6MQKSM`.
- Larger samples: 40 article page views in four days. Only aggregate results are recorded, with no
  production-validated claim before these items close.

## Tests

`npm run test:intelligence` uses synthetic fixtures. It covers compact-row decoding, missing metadata, percent-encoded
and retired keys, URL parsing with the base regexes, surface and age classification, catalog aggregates, literal
escaping, read-only/bounded/consent/host contracts for every model, and deterministic rendering. It also checks the
invariants of the committed index. CI does not run it; the existing gates are unchanged.
