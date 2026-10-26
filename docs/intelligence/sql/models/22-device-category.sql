-- I-04 model: page_view and session_start EVENTS per coarse GA4 device category (desktop, mobile, tablet,
-- smart_tv, other, (unknown)). Kept separate from country: no device x country cells.
-- Parameters: audience-base parameters + @min_events (INT64), applied to page_view_events.
{{AUDIENCE_BASE}}
SELECT
  b.from_day,
  b.through_day,
  s.device_class,
  COUNTIF(s.event_name = 'page_view') AS page_view_events,
  COUNTIF(s.event_name = 'session_start') AS session_start_events,
  COUNTIF(s.event_name = 'page_view') >= @min_events AS meets_min_events
FROM site s
CROSS JOIN window_bounds b
WHERE s.event_name IN ('page_view', 'session_start')
GROUP BY 1, 2, 3
ORDER BY page_view_events DESC, 3;
