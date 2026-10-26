-- I-05 models B-D: observations and exact p75 per ONE dimension at a time (page_group, viewport_category or
-- nav_type), always within one coverage class and metric. Dimensions are never crossed here; the full
-- group x viewport x navigation x coverage table remains perf/rum-pilot/report.sql. viewport_category is a
-- width bucket (<768 CSS px), not a CrUX device class. Only combinations with observations appear.
-- Parameters: rum-base parameters + @min_observations (INT64).
{{RUM_BASE}}
, one_dimension AS (
  SELECT 'page_group' AS dimension, page_group AS dimension_value, coverage, metric, native_value, rating FROM rated
  UNION ALL
  SELECT 'viewport_category', viewport, coverage, metric, native_value, rating FROM rated
  UNION ALL
  SELECT 'nav_type', navigation_type, coverage, metric, native_value, rating FROM rated
)
SELECT DISTINCT
  b.from_day,
  b.through_day,
  b.extraction_through,
  b.cohort_truncated,
  d.dimension,
  d.dimension_value,
  d.coverage,
  d.metric,
  COUNT(*) OVER w AS observations,
  PERCENTILE_CONT(d.native_value, 0.75) OVER w AS p75,
  IF(d.metric IN ('LCP', 'INP', 'CLS'), COUNTIF(d.rating = 'good') OVER w, NULL) AS good,
  IF(d.metric IN ('LCP', 'INP', 'CLS'), COUNTIF(d.rating = 'needs_improvement') OVER w, NULL) AS needs_improvement,
  IF(d.metric IN ('LCP', 'INP', 'CLS'), COUNTIF(d.rating = 'poor') OVER w, NULL) AS poor,
  COUNT(*) OVER w >= @min_observations AS meets_min_observations
FROM one_dimension d
CROSS JOIN window_bounds b
WINDOW w AS (PARTITION BY d.dimension, d.dimension_value, d.coverage, d.metric)
ORDER BY dimension, dimension_value, coverage, metric;
