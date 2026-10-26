# Event inventory

Labels: [R] repository at `5572beb7`, [L] live public HTML 2026-10-26, [U] unverified. See [README](README.md).

## Collection gate [R]

- No gtag.js request, cookie or event before explicit `analytics: true` (`scripts/analytics.js` `configureAnalytics`).
  Consent Mode defaults: `analytics_storage` from the choice; `ad_storage`, `ad_user_data`, `ad_personalization`
  always `denied`; `ads_data_redaction` true. Because the tag is never loaded on decline, there are **no cookieless
  pings**: declined and undecided visitors produce zero rows anywhere.
- Article pages inject gtag.js only after `window.load` (#303). Earlier queued commands are replayed by gtag.js.
- Withdrawal: `consent update` denied, `ga-disable-G-X68J6MQKSM = true`, `_ga*`/`_gid`/`_gat` cookies cleared. The
  already-loaded script stays in that document.
- Every custom event re-reads consent at send time. `trackEvent` adds `transport_type: 'beacon'`; `js_error` bypasses
  `trackEvent` and has no `transport_type`.
- GA4 `config` sets `page_location` to origin + path + only `utm_source|medium|campaign|term|content`, `gclid`,
  `gbraid`, `wbraid`. Hash and all other query parameters are dropped. `page_referrer` is not overridden [R]; what GA4
  stores there is [U].

## Events

| Event | Emitter [R] | Fires | Parameters [R] |
| --- | --- | --- | --- |
| `page_view` (+ GA4 automatic `session_start`, `first_visit`, `user_engagement`) | GA4 `config` in `analytics.js` | Once per consented document load / on consent | GA4 automatic; `page_location` reduced as above. Enhanced-measurement events (`scroll`, `click`, `view_search_results`, `file_download`, form events) depend on property settings [U] |
| `internal_page_click` | `analytics.js` | Unmodified primary click on a same-origin page link (not hash-only, not media/pdf/zip/csv/mp3) | `link_url` (origin+path), `link_path`, `link_text` (aria-label/text/img alt, ≤120 chars), `link_section`, `source_path`, `source_type`, `destination_type`, `transport_type`, `article_id` (destination, optional) |
| `outbound_click` | `analytics.js` | Unmodified click on a cross-origin http(s) link outside `.share-buttons` | `destination_domain`, `link_section`, `link_text`, `source_path`, `source_type`, `transport_type`, `sponsored` (only when `rel=sponsored`), `article_id` (source, optional) |
| `article_share` (social link) | `analytics.js` | Cross-origin link inside `.share-buttons` | outbound params + `method` ∈ `whatsapp`, `x`, `facebook`, `telegram`, `social_link` |
| `article_share` (copy/native) | `blog-module/blog-fixes.js` | Copy-link success / native share | `method` ∈ `copy_link`, `native_share`; `article_id`; `transport_type` |
| `article_engaged` | `analytics.js` | Once per article document after ≥30 visible, consented seconds **and** ≥50% max scroll | `article_id`, `engaged_seconds` = 30, `scroll_depth` = 50, `transport_type`. The numbers are **constant thresholds**, not measurements: the event is a boolean |
| `journal_search` | `blog-module/blog-index.js` | 900 ms after typing pauses in the edition search, non-empty query | `query_length`, `result_count`, `transport_type`. Query text is never sent. One search session can emit several events |
| `js_error` | `scripts/perf/error-beacon.js` | Uncaught error / unhandled rejection; first per tab session always, later ones 10% sampled | `message` (≤140, URLs reduced to path), `source`, `lineno`, `colno`, `stack` (first frame, ≤220), `page_path`, `rating` ∈ `first`, `sampled` |
| `web_vital` | `scripts/perf/web-vitals-collector.js` | Official `web-vitals` 6.2.3 callbacks after consent + load + idle | Owned by [perf/rum-pilot/README.md](../../perf/rum-pilot/README.md#event-contract): `metric_name`, `metric_value`, `metric_id`, `metric_rating`, `nav_type`, `page_group`, `viewport_category`, `measurement_version` = `wv6.2.3-rum1`, `metric_revision`, `nav_start_ms`, `measurement_coverage`, `observation_start_ms` |

`link_section` values [R]: `article_share`, `sponsor`, `social`, `cta`, `article_link`, `navigation`, `footer`, `page`.

No other `gtag('event')` or `trackEvent` caller exists in public runtime code [R] (Standings, article embeds and the
BetCast widget emit nothing).

## Which pages carry the tags [R][L]

Of 479 committed public-candidate HTML files: `analytics.js` 467, `cookie-consent.js` 470, `error-beacon.js` 471,
`web-vitals-beacon.js` 458. All 412 articles carry all four.

- GA4 but **no Web Vitals**: `/authors/**` (7 pages) and `/privacy/privacy.html`, `/privacy/terms.html`.
- No GA4: `404.html`, author tools (`generate.html`, `housekeeping.html`), redirect stubs (`/f1telemetry/`,
  standalone-build `/ghostcar/` and `/tyres/` stubs), retired-article stubs (no script by design).
- Entity hubs (`/blog-module/blog/entities/**`) are generated from the edition shell and keep its scripts.
- Live: `/` and `/standings/` reference gtag, analytics, consent, Web Vitals and error beacon. The `/f1telemetry/`
  stub's only `googletagmanager` match is its CSP allowlist, not a tag.

## Page / path classification

Three taxonomies exist and **disagree** [R]:

| Path | `source_type` / `destination_type` (`analytics.js`, substring match) | `page_group` (`web_vital`, prefix match) | Inventory `path_class` (SQL, from `page_location`) |
| --- | --- | --- | --- |
| `/`, `/index.html` | `home` | `home` | `home` |
| `/blog-module/blog-entries/**` | `article` | `article` | `article` |
| `/blog-module/blog/entities/**` | `blog_index` | `edition` | `entity_hub` |
| `/blog-module/blog/**` | `blog_index` | `edition` | `edition` |
| `/standings/**` | `standings` | `standings` | `standings` |
| `/authors/**` | `page` | (no Web Vitals) | `authors` |
| `/privacy/**` | `legal` | (no Web Vitals) | `legal` |
| `/telemetry/` `/ghostcar/` `/tyres/` `/betcast/` | `page` | (not loaded) | `tool_*` |
| anything else | `page` | `other` | `other` |

Rule for I-02: classify from the `page_location` path (and `link_path` for click destinations) with one SQL function,
as [sql/02-event-inventory.sql](sql/02-event-inventory.sql) does. Treat emitter-side types as hints only. Paths are
case-sensitive on Pages (`/Tyres/` ≠ `/tyres/`).

Host contamination [R]: the measurement ID is hard-coded, `analytics.js` has no host check, and the Web Vitals loader
and error beacon exclude only `file:`, so local previews (`localhost`, `127.0.0.1`) and any copy served elsewhere send to the production property once consent is
stored there. Filter `host = 'f1-stories.gr'`; the inventory reports host classes so the size of this is measurable [U].

## Article identity [R]

- Canonical id = the folder name in `/blog-module/blog-entries/<id>/article.html`, which is row field 0 of
  `blog-module/blog-index-data.json` (`v: 2`, key `p`; [data contracts](../data-contracts.md)). At `5572beb7`: 412 index
  rows = 412 article folders, all ids ASCII, no case-only collisions.
- `article_id` is emitted only by click, share and `article_engaged` events, and is extracted from `location.pathname` /
  `URL.href`, i.e. **percent-encoded**. `page_view` and `web_vital` carry no article id; derive it from the
  `page_location` path.
- Historical rows may contain retired ids: Greek `20260227Τ` (as `20260227%CE%A4`) → `20260222T`, and `20260822G` →
  `20260822J` (see [article URL policy](../search/article-url-policy.md)). Map them through
  `blog-module/retired-articles.json` (surviving `target`) before joining. Retired stubs carry no analytics, so new rows for them are not expected.
- `article_id` is only extracted from `.../article.html` URLs; a directory-style URL yields `path_class = article` with no
  id.

## Product coverage: `/telemetry/`, `/ghostcar/`, `/tyres/`, `/betcast/`

Shared origin ≠ shared instrumentation. Checked at the pinned lock SHAs and on the live landing pages:

| Tool | Repository @ lock SHA [R] | GA4 / consent / beacon in source [R] | Live landing HTML [L] | Measured today |
| --- | --- | --- | --- | --- |
| Telemetry | `f1-telemetry-dashboard` @ `38c3dd20` | none | 0 tags | Only entry clicks from Main |
| Ghost Car | `ghostcar` @ `4d7a783d` | none | 0 tags | Only entry clicks from Main |
| TYRES | `Tyres` @ `c780d95f` | none | 0 tags | Only entry clicks from Main |
| BetCast | `BetCastVisualisation` @ `74eeb98b` | CRA `reportWebVitals()` called **without a callback**, so `web-vitals` 2.x is never imported | 0 tags | Only entry clicks from Main |

What *is* measurable [R]: `internal_page_click` from a consented Main page whose `link_path` starts with a tool prefix
(`destination_type = 'page'`). Not measurable: tool page views, time in tool, in-tool navigation, Web Vitals, errors,
deep links/shares arriving directly at a tool, or entries from external referrers. Child-to-Main clicks arrive as a
Main `page_view` with a tool `page_referrer` only if GA4 records it [U]. The BetCast article widget runs inside Main
articles and emits nothing [R].
