-- I-03 shared base of the editorial models. Not runnable alone: `scripts/intelligence/editorial-model.mjs render`
-- inserts it into a model and fills the article lookup from blog-module/blog-index-data.json.
-- Read-only, aggregate-only. Parameters: @start_day, @end_day, @as_of_day (DATE). @as_of_day is the run date in
-- the property time zone; it fixes the window so a re-run with the same parameters reads the same tables.
-- Daily tables only (digit suffixes exclude events_intraday_*), at most 90, and only days at least 4 days before
-- @as_of_day: a day closes at midnight and GA4 may still update its table for 72 h, so later days are immature.
-- Models read `editorial` (consented, primary-host events). Only 15-coverage reads `resolved`.
WITH article_lookup AS (
{{ARTICLE_LOOKUP}}
), article_alias AS (
{{ARTICLE_ALIAS}}
), window_bounds AS (
  SELECT
    @start_day AS from_day,
    IF(@as_of_day > DATE_ADD(CURRENT_DATE(), INTERVAL 1 DAY), ERROR('as_of_day is in the future'),
      LEAST(@end_day, DATE_ADD(@start_day, INTERVAL 89 DAY), DATE_SUB(@as_of_day, INTERVAL 4 DAY))) AS through_day
), events AS (
  SELECT
    PARSE_DATE('%Y%m%d', _TABLE_SUFFIX) AS event_day,
    event_name,
    privacy_info.analytics_storage AS analytics_storage,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_location,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'link_path') AS link_path,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'link_section') AS link_section,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'article_id') AS article_id_param
  FROM `{{PROJECT_ID}}.analytics_{{GA4_PROPERTY_ID}}.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', @start_day)
      AND FORMAT_DATE('%Y%m%d', LEAST(@end_day, DATE_ADD(@start_day, INTERVAL 89 DAY), DATE_SUB(@as_of_day, INTERVAL 4 DAY)))
    AND event_name IN ('page_view', 'article_engaged', 'internal_page_click')
), keyed AS (
  SELECT
    event_day, event_name, analytics_storage, link_section, article_id_param,
    -- Path of the page the event fired on; NULL for any host other than https://f1-stories.gr.
    REGEXP_EXTRACT(page_location, r'^https://f1-stories\.gr(/[^?#]*)') AS page_path,
    REGEXP_EXTRACT(REGEXP_EXTRACT(page_location, r'^https://f1-stories\.gr(/[^?#]*)'),
      r'^/blog-module/blog-entries/([^/]+)/(?:article\.html)?$') AS page_key,
    REGEXP_EXTRACT(link_path, r'^/blog-module/blog-entries/([^/]+)/(?:article\.html)?$') AS link_key
  FROM events
), resolved AS (
  SELECT
    k.event_day, k.event_name, k.analytics_storage, k.link_section, k.page_path, k.article_key,
    a.article_id, IFNULL(a.retired, FALSE) AS via_retired_url,
    l.title, l.published_day, l.primary_category, l.author
  FROM (
    SELECT *,
      -- Clicks are attributed to their destination; page views and engagement to the page itself.
      IF(event_name = 'internal_page_click', COALESCE(link_key, article_id_param), COALESCE(page_key, article_id_param)) AS article_key
    FROM keyed
  ) k
  LEFT JOIN article_alias a ON a.article_key = k.article_key
  LEFT JOIN article_lookup l ON l.article_id = a.article_id
  CROSS JOIN window_bounds b
  WHERE k.event_day <= b.through_day
), editorial AS (
  SELECT * FROM resolved
  WHERE analytics_storage = 'Yes' AND page_path IS NOT NULL AND article_key IS NOT NULL
)
