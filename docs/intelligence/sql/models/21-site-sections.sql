-- I-04 model: page_view and session_start EVENTS per site section (I-01 classify_path of the page path).
-- session_start events are counted on the page they fired on, a landing-section proxy, not a session count.
-- Parameters: audience-base parameters + @min_events (INT64), applied to page_view_events.
{{AUDIENCE_BASE}}
SELECT
  b.from_day,
  b.through_day,
  classify_path(s.page_path) AS section,
  COUNTIF(s.event_name = 'page_view') AS page_view_events,
  COUNTIF(s.event_name = 'session_start') AS session_start_events,
  COUNT(DISTINCT IF(s.event_name = 'page_view', s.event_day, NULL)) AS days_with_page_views,
  COUNTIF(s.event_name = 'page_view') >= @min_events AS meets_min_events
FROM site s
CROSS JOIN window_bounds b
WHERE s.event_name IN ('page_view', 'session_start')
GROUP BY 1, 2, 3
ORDER BY page_view_events DESC, 3;
