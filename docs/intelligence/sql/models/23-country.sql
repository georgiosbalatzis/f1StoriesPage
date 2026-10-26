-- I-04 model: page_view and session_start EVENTS per country (GA4 geo.country only; no region or city).
-- Countries below @min_events page views are merged into '(other countries)', so a small country is never
-- reported on its own. Kept separate from device. Parameters: audience-base parameters + @min_events (INT64).
{{AUDIENCE_BASE}}
SELECT
  b.from_day,
  b.through_day,
  IF(c.page_view_events >= @min_events OR c.country = '(unknown)', c.country, '(other countries)') AS country,
  SUM(c.page_view_events) AS page_view_events,
  SUM(c.session_start_events) AS session_start_events,
  COUNT(*) AS countries_in_row,
  SUM(c.page_view_events) >= @min_events AS meets_min_events
FROM (
  SELECT
    country,
    COUNTIF(event_name = 'page_view') AS page_view_events,
    COUNTIF(event_name = 'session_start') AS session_start_events
  FROM site
  WHERE event_name IN ('page_view', 'session_start')
  GROUP BY country
) c
CROSS JOIN window_bounds b
GROUP BY 1, 2, 3
ORDER BY 4 DESC, 3;
