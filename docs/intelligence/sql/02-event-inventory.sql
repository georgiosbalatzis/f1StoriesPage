-- I-01 read-only, aggregate-only event and parameter inventory. Dry-run first and record the bytes.
-- Placeholders as in 00-dataset-location.sql. Parameters: @start_day, @end_day (DATE, inclusive).
-- The scan is capped at 7 daily tables (@start_day .. @start_day + 6) whatever @end_day says; the digit-only
-- suffix bounds exclude events_intraday_*. Outputs carry no visitor, session, free-text or row-level field:
-- parameter values are returned only for the enumerated keys below.
-- '(event)' rows count events per host/path class; link_class is the destination class of internal_page_click.
CREATE TEMP FUNCTION classify_path(path STRING) AS (
  CASE
    WHEN path IS NULL THEN 'missing'
    WHEN path IN ('/', '/index.html') THEN 'home'
    WHEN STARTS_WITH(path, '/blog-module/blog-entries/') THEN 'article'
    WHEN STARTS_WITH(path, '/blog-module/blog/entities/') THEN 'entity_hub'
    WHEN STARTS_WITH(path, '/blog-module/blog/') THEN 'edition'
    WHEN STARTS_WITH(path, '/standings/') THEN 'standings'
    WHEN STARTS_WITH(path, '/authors/') THEN 'authors'
    WHEN STARTS_WITH(path, '/privacy/') THEN 'legal'
    WHEN STARTS_WITH(path, '/telemetry/') THEN 'tool_telemetry'
    WHEN STARTS_WITH(path, '/f1telemetry/') THEN 'tool_telemetry_stub'
    WHEN STARTS_WITH(path, '/ghostcar/') THEN 'tool_ghostcar'
    WHEN STARTS_WITH(path, '/tyres/') THEN 'tool_tyres'
    WHEN STARTS_WITH(path, '/betcast/') THEN 'tool_betcast'
    WHEN path IN ('/generate.html', '/housekeeping.html') THEN 'author_tool'
    ELSE 'other'
  END
);

WITH events AS (
  SELECT
    _TABLE_SUFFIX AS day,
    event_name,
    event_params,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_location,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'link_path') AS link_path
  FROM `{{PROJECT_ID}}.analytics_{{GA4_PROPERTY_ID}}.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', @start_day)
    AND FORMAT_DATE('%Y%m%d', LEAST(@end_day, DATE_ADD(@start_day, INTERVAL 6 DAY)))
), classified AS (
  SELECT
    day,
    event_name,
    event_params,
    CASE
      WHEN host IS NULL THEN 'missing'
      WHEN host = 'f1-stories.gr' THEN 'primary'
      WHEN host = 'www.f1-stories.gr' THEN 'www'
      WHEN host IN ('localhost', '127.0.0.1', '0.0.0.0', '[::1]') THEN 'local'
      WHEN ENDS_WITH(host, '.github.io') THEN 'github_io'
      ELSE 'other'
    END AS host_class,
    classify_path(IF(page_location IS NULL, NULL,
      COALESCE(REGEXP_EXTRACT(page_location, r'^[a-zA-Z][a-zA-Z0-9+.-]*://[^/?#]*(/[^?#]*)'), '/'))) AS path_class,
    IF(event_name = 'internal_page_click', classify_path(link_path), NULL) AS link_class
  FROM (SELECT *, LOWER(NET.HOST(page_location)) AS host FROM events)
)
SELECT
  host_class, path_class, event_name, link_class,
  '(event)' AS param_key,
  CAST(NULL AS STRING) AS value_type,
  CAST(NULL AS STRING) AS enum_value,
  COUNT(*) AS event_rows,
  COUNT(DISTINCT day) AS days_present,
  MIN(day) AS first_day,
  MAX(day) AS last_day
FROM classified
GROUP BY host_class, path_class, event_name, link_class
UNION ALL
SELECT
  host_class, path_class, event_name, CAST(NULL AS STRING),
  p.key,
  CASE
    WHEN p.value.string_value IS NOT NULL THEN 'string'
    WHEN p.value.int_value IS NOT NULL THEN 'int'
    WHEN p.value.double_value IS NOT NULL THEN 'double'
    WHEN p.value.float_value IS NOT NULL THEN 'float'
    ELSE 'null'
  END,
  IF(p.key IN ('metric_name', 'metric_rating', 'nav_type', 'page_group', 'viewport_category',
      'measurement_version', 'measurement_coverage', 'link_section', 'source_type', 'destination_type',
      'method', 'rating', 'sponsored', 'transport_type', 'engaged_seconds', 'scroll_depth'),
    COALESCE(p.value.string_value, CAST(p.value.int_value AS STRING)), NULL),
  COUNT(*), COUNT(DISTINCT day), MIN(day), MAX(day)
FROM classified, UNNEST(event_params) AS p
GROUP BY 1, 2, 3, 4, 5, 6, 7
ORDER BY event_name, host_class, path_class, param_key, enum_value;
