# Audience, acquisition and engagement models (I-04)

Status: **statically tested and `PRODUCTION_EXECUTED`, not production-validated.** On 2026-10-26 the owner executed
`20`–`29` in the BigQuery Console for 2026-10-19 → 22. The three attribution scopes each reconcile to 84 page-view
and 32 `session_start` events, and `29` shows no consent or host loss. The owner's `INFORMATION_SCHEMA` check found
`default_channel_group` as `STRING` in `events_20261022`, which resolves the I-04 schema risk for that table. The I-03
models have the same status ([editorial-model.md](editorial-model.md)). The I-02 record
([#353](https://github.com/georgiosbalatzis/f1StoriesPage/pull/353)) was closed without merging. The synthetic tests
prove nothing about production data. Results and outstanding items: [bigquery-validation.md](bigquery-validation.md).

## Architecture

The I-03 renderer and conventions are reused; there is no second framework.

```text
scripts/intelligence/editorial-model.mjs render <model> --project= --property=   (prints SQL; never queries)
  docs/intelligence/sql/models/2x-*.sql
    └─ {{AUDIENCE_BASE}} = audience-base.sql
         ├─ {{CLASSIFY_PATH}}      I-01 classify_path, copied verbatim from sql/02-event-inventory.sql
         ├─ {{AUDIENCE_FUNCTIONS}} audience-functions.sql (allowlist functions)
         ├─ window_bounds          same text as I-03 base.sql
         ├─ events                 one bounded scan; every raw string reduced here
         └─ site                   consented, https://f1-stories.gr, mature  ← every model except 29
```

The tests require `audience-base.sql` to keep the same window, table-suffix bound, host regex and consent filter as
`base.sql`, character for character. It is a separate fragment so that a missing GA4 record field fails the I-04
dry-run without breaking the I-03 models. Article-level metrics stay in I-03 (10–14). I-04 has no article id.

## Parameters and dry-run procedure

`@start_day`, `@end_day`, `@as_of_day` (DATE), and `@min_events` (INT64; not used by 29). The rules are those of
I-03:
- daily tables only, at most 90;
- nothing newer than `@as_of_day − 4` (the 72 h late-arrival window);
- a future `@as_of_day` aborts the query.

Every row carries `from_day` and `through_day`.

```sh
node scripts/intelligence/editorial-model.mjs render 20-daily-activity --project=f1-stories-analytics --property=485678890 > /tmp/m20.sql
bq query --location=EU --use_legacy_sql=false --dry_run \
  --parameter=start_day:DATE:2026-10-19 --parameter=end_day:DATE:2026-10-25 \
  --parameter=as_of_day:DATE:2026-10-29 --parameter=min_events:INT64:30 "$(cat /tmp/m20.sql)"
```

1. Dry-run each model and record the bytes. A dry-run failure on `collected_traffic_source` or
   `session_traffic_source_last_click` means the export lacks that record. Stop: there is no fallback.
2. Run with `--maximum_bytes_billed=104857600` (100 MB) by an authorized analyst.
3. Run **29-audience-coverage** with the same parameters and keep it next to every result.
4. Keep only the aggregate output, with `@as_of_day` recorded. Nothing runs automatically.

## Models

All counts are **event counts**. A page view is not a visitor; a `session_start` event is not an exact session
(lost beacons, consent given mid-session, sessions crossing midnight); a `first_visit` event is not an exact new
user. No user, session or document is identified or reconstructed.

| Model | Grain | Output columns |
| --- | --- | --- |
| `20-daily-activity` | day (every day of the window, 0 when none) | `page_view_events`, `session_start_events`, `first_visit_events` |
| `21-site-sections` | I-01 path class | `page_view_events`, `session_start_events` (landing-section proxy), `days_with_page_views` |
| `22-device-category` | `device_class`: desktop, mobile, tablet, smart_tv, other, (unknown) | `page_view_events`, `session_start_events` |
| `23-country` | country; countries under `@min_events` page views merged into `(other countries)` | `page_view_events`, `session_start_events`, `countries_in_row` |
| `24-acquisition-first-user` | `medium_class` × `source_family` × `has_campaign` | `first_visit_events`, `session_start_events`, `page_view_events` |
| `25-acquisition-collected` | `medium_class` × `source_family` × `has_campaign` × `click_id_present` | `session_start_events`, `page_view_events` |
| `26-acquisition-session` | `channel_class` × `medium_class` × `source_family` | `session_start_events`, `page_view_events` |
| `27-engagement-events` | event × breakdown | `events`, `days_with_events` |
| `28-internal-navigation` | source section × destination section × `link_section` | `click_events` |
| `29-audience-coverage` | event name | kept/dropped counts and unknown-field counts (below) |

Every model except 29 has `meets_min_events`: page views, or `session_start_events` in 26, or the row's events in
27 and 28, compared with `@min_events`. Device and country are separate models on purpose: there are no
device × country cells.

## Attribution scopes

The three scopes answer different questions. **Never add, compare or merge them as one total.**

| Scope | Field | Meaning | `unattributed` means |
| --- | --- | --- | --- |
| `first_user` (24) | `traffic_source.source/medium/name` | How GA4 first acquired the user, repeated on every later event | GA4 recorded nothing |
| `event_collected` (25) | `collected_traffic_source.manual_source/manual_medium/manual_campaign_name`, `gclid`/`dclid` presence | Campaign parameters on this event's own URL | No utm/click id on this event, which is normal for most events. It holds no referrer data, so it is never Direct |
| `session_last_click` (26) | `session_traffic_source_last_click.cross_channel_campaign.source/medium/default_channel_group` | GA4's own cross-channel last-click attribution of the event's session | GA4 supplied none |

**Classes.**
- Mediums: `unattributed`, `direct_or_unknown` (GA4 `(none)`), `not_set`, `data_deleted`,
  `organic_search_reported`, `referral`, `social`, `email`, `paid`, `other_tagged`.
- Channel classes (GA4 vocabulary): the same idea, plus `unassigned`, `organic_video_reported`,
  `organic_shopping_reported`, `other_reported` and `other`.
- Source families: `google`, `bing`, `duckduckgo`, `other_search_engine`, `facebook`, `instagram`, `threads`, `x`,
  `reddit`, `linkedin`, `youtube`, `whatsapp`, `telegram`, `tiktok`, `ai_assistant`, `self_referral`,
  `legacy_site`, `direct_or_unknown`, `not_set`, `data_deleted`, `unattributed` and `other_source`.

**Rules.**
- No source, medium, campaign, term, click id or referrer string is ever output; anything unlisted is
  `other_source` / `other_tagged` / `other`.
- GA4's Direct is labelled `direct_or_unknown`, because GA4 assigns it whenever no source data exists.
- `*_reported` marks GA4's own classification, which is not independent evidence of organic traffic.
- `first_user` is cookie-scoped under consent: a user who first accepted analytics on a later visit, or cleared
  cookies, is "first acquired" at that consented visit.
- `analytics.js` keeps only `utm_*`, `gclid`, `gbraid` and `wbraid` in `page_location`, so `event_collected` sees
  only those (`gbraid`/`wbraid` are not counted, and `srsltid` never reaches GA4).

## Engagement and navigation (27, 28)

| Event | What it is | What it is not |
| --- | --- | --- |
| `article_engaged` | One article document reached 30 visible, consented seconds and 50% scroll | Reading completion; a reader |
| `user_engagement` | GA4's automatic engagement ping | Engagement time, a session, bounce |
| `article_share` by `method` (`whatsapp`, `x`, `facebook`, `telegram`, `social_link`, `copy_link`, `native_share`, `other`, `(none)`) | A share action: share link opened, link copied, native sheet opened | A completed share |
| `outbound_click`, `sponsored` / `not_sponsored` | A click on an external link (`rel=sponsored` subset) | A delivered visit |
| `journal_search` | An edition-search pause (900 ms debounce) | A unique search; query text is never sent |
| `internal_page_click` (28) | An unmodified same-origin link click, by I-01 source and destination class | Complete navigation: typed URLs, history, modifier/middle clicks are absent; the destination may not have loaded |

No session duration, bounce rate, retention or engagement time is derived. `engagement_time_msec` is not read.

## Coverage, consent bias, unknown data

- **Consent bias.** As in the [metrics contract](metrics-contract.md#population-and-coverage-bias), only visitors who
  accepted analytics appear. Nothing here estimates all readers. The four tools are never source sections (they are
  untagged) but can be click destinations.
- **29-audience-coverage**, per event name:
  - `events_in_tables`, `consented_events`, `primary_host_events`, `site_events`;
  - among kept events: `device_unknown_or_other`, `country_unknown`, `first_user_source_unattributed_or_other`,
    `collected_source_unattributed`, `session_source_unattributed_or_other`,
    `session_channel_unattributed_or_other`, `enum_parameter_other`.

  A model whose field is mostly unknown is uninformative, not evidence of Direct traffic. If an automatic event
  (`session_start`, `first_visit`, `user_engagement`) lacks `page_location`, the host filter drops it, and 29 shows
  this as `site_events` far below `consented_events`. The consent filter is never relaxed to fill a model.
- **Unknown buckets are kept** in every model: `(unknown)`, `unattributed`, `not_set`, `other*`, `missing`.

## Sample size

- Use `@min_events = 30` before comparing rows. Do not show cells under 10 events outside the owner. Read 28-day
  windows first.
- Countries under `@min_events` are merged automatically.
- The owner's Console run of `20` gave 84 page-view events for 19–22 October, so most daily, source and navigation
  rows are flagged. The acquisition tables may still be dominated by `unattributed` / `direct_or_unknown`; the
  per-field counts were not reported.

## Checked by the owner's 19–22 Oct runs, and still unverified

Checked ([bigquery-validation.md](bigquery-validation.md#owner-reported-results-bigquery-console-2026-10-19--22-as_of_day--2026-10-26)):
- `collected_traffic_source` and `session_traffic_source_last_click` exist, because every I-04 model executed.
  `cross_channel_campaign.default_channel_group` is not on Google's published schema page
  ([bigquery-validation.md](bigquery-validation.md#schema-compatibility-from-googles-published-schema-not-from-the-dataset)),
  but it exists as `STRING` in `events_20261022`. Other tables were not inspected.
- `analytics_storage` and `page_location`: `29` lost no events through the consent or host filters among 168.
- Page views by device (81 mobile, 3 desktop) and country (Greece 84) have no unknowns.
- The property time zone: `America/Los_Angeles`.

Still unverified:
- Source and channel fill rates, and the GA4 channel vocabulary. The per-field counts from `29` were not reported.
- That property `485678890` is `G-X68J6MQKSM`.

## Tests

`npm run test:intelligence` runs the I-03 and I-04 tests on synthetic fixtures. I-04 covers:
- date, maturity, host and consent text identical to I-03, and the host rule executed;
- I-01 path classes, device and country, and all allowlist functions executed from the SQL;
- unknown/unattributed and the no-confirmed-direct or organic labels;
- untrusted-string handling and raw-leaf wrapping;
- field and parameter allowlists, and scope separation;
- event-only output naming and sample flags;
- coverage completeness;
- deterministic, read-only, single-scan rendering.

CI does not run these tests; the existing gates are unchanged.
