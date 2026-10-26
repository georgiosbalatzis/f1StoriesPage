-- I-05 shared base of the Real User Performance models. Not runnable alone: `scripts/intelligence/editorial-model.mjs
-- render` inserts it and copies the revision rule (QUALIFY) verbatim from perf/rum-pilot/report.sql into `latest`.
-- Parameters: @start_day, @end_day (DATE, NAVIGATION cohort in @report_timezone), @as_of_day (DATE, extraction
-- cutoff), @report_timezone (STRING). Observations can be revised after their navigation day, so daily tables are
-- scanned from the day before the cohort (time-zone margin) through the extraction cutoff, not only the cohort days:
-- at most 121 tables, never newer than @as_of_day - 4 (immature), never events_intraday_*. Revisions are resolved
-- FIRST, then observations are filtered by navigation date. The cohort is capped at 90 days and never extends past
-- the extraction cutoff; window_bounds reports both caps.
-- Only consented, https://f1-stories.gr, measurement_version 'wv6.2.3-rum1' snapshots with an id and a revision are
-- eligible. metric_id is used only to resolve revisions and never leaves `latest`.
WITH window_bounds AS (
  SELECT
    from_day,
    LEAST(@end_day, DATE_ADD(from_day, INTERVAL 89 DAY), extraction_through) AS through_day,
    @end_day AS requested_through_day,
    extraction_through,
    LEAST(@end_day, DATE_ADD(from_day, INTERVAL 89 DAY), extraction_through) < @end_day AS cohort_truncated,
    DATE_DIFF(extraction_through, LEAST(@end_day, DATE_ADD(from_day, INTERVAL 89 DAY), extraction_through), DAY) AS late_revision_days
  FROM (
    SELECT
      @start_day AS from_day,
      IF(@as_of_day > DATE_ADD(CURRENT_DATE(), INTERVAL 1 DAY), ERROR('as_of_day is in the future'),
        LEAST(DATE_SUB(@as_of_day, INTERVAL 4 DAY), DATE_ADD(@start_day, INTERVAL 119 DAY))) AS extraction_through
  )
), events AS (
  SELECT
    event_timestamp,
    privacy_info.analytics_storage AS analytics_storage,
    -- Only tested for NULL: the page path is never output.
    REGEXP_EXTRACT((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'),
      r'^https://f1-stories\.gr(/[^?#]*)') AS page_path,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'measurement_version') AS version,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'metric_name') AS metric,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'metric_id') AS metric_id,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'metric_revision') AS revision,
    (SELECT value.int_value IS NULL FROM UNNEST(event_params) WHERE key = 'metric_revision') AS revision_not_int,
    (SELECT COALESCE(value.double_value, CAST(value.int_value AS FLOAT64), CAST(value.float_value AS FLOAT64)) FROM UNNEST(event_params) WHERE key = 'metric_value') AS value,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'nav_start_ms') AS nav_start_ms,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_group') AS page_group,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'viewport_category') AS viewport,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'nav_type') AS navigation_type,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'measurement_coverage') AS coverage,
    (SELECT COALESCE(value.int_value, CAST(value.double_value AS INT64)) FROM UNNEST(event_params) WHERE key = 'observation_start_ms') AS observation_start_ms,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'metric_rating') AS library_rating
  FROM `{{PROJECT_ID}}.analytics_{{GA4_PROPERTY_ID}}.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(@start_day, INTERVAL 1 DAY))
      AND FORMAT_DATE('%Y%m%d', LEAST(DATE_SUB(@as_of_day, INTERVAL 4 DAY), DATE_ADD(@start_day, INTERVAL 119 DAY)))
    AND event_name = 'web_vital'
), eligible AS (
  SELECT * FROM events
  WHERE analytics_storage = 'Yes' AND page_path IS NOT NULL
    AND version = 'wv6.2.3-rum1' AND metric_id IS NOT NULL AND revision >= 1
), snapshots AS (
  -- Copies of one (version, metric, metric_id, revision): equal values are transport duplicates; different values
  -- (or a mix of NULL and non-NULL) are a conflict. The revision rule below still picks one; it is flagged.
  SELECT *,
    COUNT(*) OVER snapshot AS snapshot_copies,
    (IFNULL(MIN(value) OVER snapshot != MAX(value) OVER snapshot, FALSE)
      OR COUNTIF(value IS NULL) OVER snapshot NOT IN (0, COUNT(*) OVER snapshot)) AS conflicted
  FROM eligible
  WINDOW snapshot AS (PARTITION BY version, metric, metric_id, revision)
), latest AS (
  -- One row per observation: the rum-pilot rule, highest revision then latest event_timestamp. Never MAX(value).
  SELECT * FROM snapshots
  WHERE TRUE
{{RUM_LATEST_REVISION}}
), rated AS (
  SELECT
    metric, page_group, viewport, navigation_type, coverage, nav_day, native_value, conflicted, snapshot_copies, library_rating,
    CASE
      WHEN metric = 'LCP' AND native_value <= 2500 THEN 'good'
      WHEN metric = 'LCP' AND native_value <= 4000 THEN 'needs_improvement'
      WHEN metric = 'LCP' THEN 'poor'
      WHEN metric = 'INP' AND native_value <= 200 THEN 'good'
      WHEN metric = 'INP' AND native_value <= 500 THEN 'needs_improvement'
      WHEN metric = 'INP' THEN 'poor'
      WHEN metric = 'CLS' AND native_value <= 0.1 THEN 'good'
      WHEN metric = 'CLS' AND native_value <= 0.25 THEN 'needs_improvement'
      WHEN metric = 'CLS' THEN 'poor'
      ELSE NULL
    END AS rating
  FROM (
    SELECT
      metric, page_group, viewport, coverage, conflicted, snapshot_copies, library_rating,
      IF(navigation_type IS NULL, '(missing)',
        IF(navigation_type IN ('navigate', 'reload', 'back-forward', 'back-forward-cache', 'prerender', 'restore'), navigation_type, 'other')) AS navigation_type,
      DATE(TIMESTAMP_MILLIS(nav_start_ms), @report_timezone) AS nav_day,
      IF(metric = 'CLS', value / 1000.0, value) AS native_value
    FROM latest
    WHERE value IS NOT NULL AND value >= 0 AND nav_start_ms IS NOT NULL
      AND metric IN ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')
      AND page_group IN ('home', 'edition', 'article', 'standings', 'other')
      AND viewport IN ('mobile_like', 'desktop_like')
      AND coverage IN ('delayed_existing', 'delayed_consent', 'bfcache_observed')
  ) o
  CROSS JOIN window_bounds b
  WHERE o.nav_day BETWEEN b.from_day AND b.through_day
)
