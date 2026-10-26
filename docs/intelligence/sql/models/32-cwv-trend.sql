-- I-05 model E: observations and exact p75 per NAVIGATION-date period (@period 'day' or 'week', ISO weeks), coverage
-- class and metric. Each period's p75 is recalculated from that period's observations; never average daily p75s.
-- period_complete is FALSE for a week cut by the cohort bounds. Late revisions of a navigation count toward its
-- navigation period, whichever export day they arrived in.
-- Parameters: rum-base parameters + @period (STRING) + @min_observations (INT64).
{{RUM_BASE}}
, periods AS (
  SELECT
    r.*,
    CASE @period
      WHEN 'day' THEN r.nav_day
      WHEN 'week' THEN DATE_TRUNC(r.nav_day, ISOWEEK)
      ELSE ERROR('period must be day or week')
    END AS period_start
  FROM rated r
)
SELECT DISTINCT
  b.from_day,
  b.through_day,
  b.extraction_through,
  @period AS period,
  p.period_start,
  @period = 'day' OR (p.period_start >= b.from_day AND DATE_ADD(p.period_start, INTERVAL 6 DAY) <= b.through_day) AS period_complete,
  p.coverage,
  p.metric,
  COUNT(*) OVER w AS observations,
  PERCENTILE_CONT(p.native_value, 0.75) OVER w AS p75,
  COUNT(*) OVER w >= @min_observations AS meets_min_observations
FROM periods p
CROSS JOIN window_bounds b
WINDOW w AS (PARTITION BY p.period_start, p.coverage, p.metric)
ORDER BY period_start, coverage, metric;
