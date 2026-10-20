-- Read-only template for an ALREADY AUTHORIZED GA4 daily export. No export setup.
-- Replace PROJECT.DATASET; supply @deployment_day, @as_of_day, @first_day (DATE),
-- @report_timezone (STRING), @version = 'wv6.2.3-rum1',
-- @coverage and @navigation_type (STRING, 'all' to show separate strata).
-- @as_of_day includes later revisions to visits that started in the 28-day cohort.
-- Do not query intraday and daily copies together. Check late-arrival completeness.
WITH extracted AS (
  SELECT event_timestamp,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'metric_name') AS metric,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'metric_id') AS metric_id,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'measurement_version') AS version,
    (SELECT COALESCE(value.double_value, CAST(value.int_value AS FLOAT64), CAST(value.float_value AS FLOAT64)) FROM UNNEST(event_params) WHERE key = 'metric_value') AS value,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'metric_revision') AS revision,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'nav_start_ms') AS nav_start_ms,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_group') AS page_group,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'viewport_category') AS viewport,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'measurement_coverage') AS coverage,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'nav_type') AS navigation_type
  FROM `PROJECT.DATASET.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', @deployment_day) AND FORMAT_DATE('%Y%m%d', @as_of_day)
    AND event_name = 'web_vital'
), latest AS (
  SELECT * FROM extracted
  WHERE version = @version AND metric_id IS NOT NULL AND revision >= 1
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY version, metric, metric_id ORDER BY revision DESC, event_timestamp DESC
  ) = 1
), cohort AS (
  SELECT *, IF(metric = 'CLS', value / 1000.0, value) AS native_value
  FROM latest
  WHERE DATE(TIMESTAMP_MILLIS(nav_start_ms), @report_timezone) >= @first_day
    AND DATE(TIMESTAMP_MILLIS(nav_start_ms), @report_timezone) < DATE_ADD(@first_day, INTERVAL 28 DAY)
    AND metric IN ('LCP', 'INP', 'CLS') AND value IS NOT NULL AND value >= 0
    AND page_group IN ('home', 'edition', 'article', 'standings', 'other')
    AND viewport IN ('mobile_like', 'desktop_like')
    AND coverage IN ('delayed_existing', 'delayed_consent', 'bfcache_observed')
    AND (@coverage = 'all' OR coverage = @coverage)
    AND (@navigation_type = 'all' OR navigation_type = @navigation_type)
)
SELECT DISTINCT version, coverage, navigation_type, page_group, viewport, metric,
  COUNT(*) OVER sample AS samples,
  PERCENTILE_CONT(native_value, 0.75) OVER sample AS p75
FROM cohort
WINDOW sample AS (PARTITION BY version, coverage, navigation_type, page_group, viewport, metric)
ORDER BY coverage, navigation_type, page_group, viewport, metric;
-- Pivot into LCP/INP/CLS columns for presentation. Missing metric/group combinations
-- remain NULL/unavailable, never 0. Add daily/weekly views for sample accumulation;
-- recompute period p75 from observations, never from daily percentile summaries.
