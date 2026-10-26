-- I-05 model A: Core Web Vitals summary per observation coverage class and metric. Every coverage x metric row is
-- shown, so a metric with no observations reads 0 / NULL p75, never 0 ms; missing INP is not a zero.
-- Counts are deduplicated OBSERVATIONS (one per metric id), not web_vital events, snapshots or visitors.
-- p75 is exact PERCENTILE_CONT over the observations' native values (CLS divided by 1000). Coverage classes are
-- kept apart as the rum-pilot report requires. FCP and TTFB are supporting diagnostics without a rating.
-- Parameters: rum-base parameters + @min_observations (INT64): rows below it keep their numbers and are flagged.
{{RUM_BASE}}
, per_metric AS (
  SELECT DISTINCT
    coverage,
    metric,
    COUNT(*) OVER w AS observations,
    PERCENTILE_CONT(native_value, 0.75) OVER w AS p75,
    COUNTIF(rating = 'good') OVER w AS good,
    COUNTIF(rating = 'needs_improvement') OVER w AS needs_improvement,
    COUNTIF(rating = 'poor') OVER w AS poor,
    COUNTIF(conflicted) OVER w AS conflicted_observations
  FROM rated
  WINDOW w AS (PARTITION BY coverage, metric)
)
SELECT
  b.from_day,
  b.through_day,
  b.requested_through_day,
  b.extraction_through,
  b.cohort_truncated,
  b.late_revision_days,
  coverage,
  metric,
  metric IN ('LCP', 'INP', 'CLS') AS core_web_vital,
  IFNULL(p.observations, 0) AS observations,
  p.p75,
  IF(metric IN ('LCP', 'INP', 'CLS'), IFNULL(p.good, 0), NULL) AS good,
  IF(metric IN ('LCP', 'INP', 'CLS'), IFNULL(p.needs_improvement, 0), NULL) AS needs_improvement,
  IF(metric IN ('LCP', 'INP', 'CLS'), IFNULL(p.poor, 0), NULL) AS poor,
  IF(metric IN ('LCP', 'INP', 'CLS'), SAFE_DIVIDE(p.good, p.observations), NULL) AS good_share,
  IFNULL(p.conflicted_observations, 0) AS conflicted_observations,
  IFNULL(p.observations, 0) >= @min_observations AS meets_min_observations
FROM window_bounds b
CROSS JOIN UNNEST(['delayed_existing', 'delayed_consent', 'bfcache_observed']) AS coverage
CROSS JOIN UNNEST(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']) AS metric
LEFT JOIN per_metric p USING (coverage, metric)
ORDER BY coverage, core_web_vital DESC, metric;
