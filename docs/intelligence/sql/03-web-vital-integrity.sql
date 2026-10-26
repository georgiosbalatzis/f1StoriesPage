-- I-01 read-only: web_vital schema and revision integrity, to run BEFORE perf/rum-pilot/report.sql.
-- Placeholders as in 00-dataset-location.sql. Parameters: @start_day, @end_day (DATE); capped at 7 daily tables.
-- One row per measurement_version x metric_name. version '(none)' = legacy approximation, excluded from reports.
-- Expected for wv6.2.3-rum1: missing_* = 0, revision_not_int = 0, conflicting_snapshots = 0.
-- duplicate_copies > 0 is tolerated (same id/revision/value); dedup keeps one (rum-pilot rule).
WITH v AS (
  SELECT
    event_timestamp,
    IFNULL((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'measurement_version'), '(none)') AS version,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'metric_name') AS metric,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'metric_id') AS metric_id,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'metric_revision') AS revision,
    (SELECT value.int_value IS NULL FROM UNNEST(event_params) WHERE key = 'metric_revision') AS revision_not_int,
    (SELECT COALESCE(value.double_value, CAST(value.int_value AS FLOAT64), CAST(value.float_value AS FLOAT64))
      FROM UNNEST(event_params) WHERE key = 'metric_value') AS value,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'nav_start_ms') AS nav_start_ms
  FROM `{{PROJECT_ID}}.analytics_{{GA4_PROPERTY_ID}}.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', @start_day)
    AND FORMAT_DATE('%Y%m%d', LEAST(@end_day, DATE_ADD(@start_day, INTERVAL 6 DAY)))
    AND event_name = 'web_vital'
), per_row AS (
  SELECT version, metric,
    COUNT(*) AS rows_received,
    COUNTIF(metric_id IS NULL) AS missing_id,
    COUNTIF(revision IS NULL) AS missing_int_revision,
    COUNTIF(revision_not_int) AS revision_not_int,
    COUNTIF(value IS NULL OR value < 0) AS missing_or_negative_value,
    COUNTIF(nav_start_ms IS NULL) AS missing_nav_start,
    MIN(TIMESTAMP_MICROS(event_timestamp)) AS first_seen,
    MAX(TIMESTAMP_MICROS(event_timestamp)) AS last_seen
  FROM v
  GROUP BY version, metric
), snapshots AS (
  SELECT version, metric, metric_id, revision, COUNT(*) AS copies, COUNT(DISTINCT value) AS distinct_values
  FROM v
  WHERE metric_id IS NOT NULL AND revision IS NOT NULL
  GROUP BY version, metric, metric_id, revision
), per_snapshot AS (
  SELECT version, metric,
    COUNT(DISTINCT metric_id) AS observations,
    COUNT(*) AS snapshots,
    MAX(revision) AS max_revision,
    COUNTIF(copies > 1 AND distinct_values = 1) AS duplicate_copies,
    COUNTIF(distinct_values > 1) AS conflicting_snapshots
  FROM snapshots
  GROUP BY version, metric
)
SELECT *
FROM per_row
LEFT JOIN per_snapshot USING (version, metric)
ORDER BY version, metric;
