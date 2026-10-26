-- I-04 model: page_view, session_start and first_visit EVENTS per day, every day of the window shown (0 when none).
-- Event counts only: page views are not visitors; session_start events are not exact sessions (lost beacons,
-- consent given mid-session, sessions spanning midnight); first_visit events are not exact new users.
-- Parameters: audience-base parameters + @min_events (INT64), applied to page_view_events.
{{AUDIENCE_BASE}}
SELECT
  b.from_day,
  b.through_day,
  report_day AS event_day,
  IFNULL(s.page_view_events, 0) AS page_view_events,
  IFNULL(s.session_start_events, 0) AS session_start_events,
  IFNULL(s.first_visit_events, 0) AS first_visit_events,
  IFNULL(s.page_view_events, 0) >= @min_events AS meets_min_events
FROM window_bounds b
CROSS JOIN UNNEST(GENERATE_DATE_ARRAY(b.from_day, b.through_day)) AS report_day
LEFT JOIN (
  SELECT
    event_day,
    COUNTIF(event_name = 'page_view') AS page_view_events,
    COUNTIF(event_name = 'session_start') AS session_start_events,
    COUNTIF(event_name = 'first_visit') AS first_visit_events
  FROM site
  GROUP BY event_day
) s ON s.event_day = report_day
ORDER BY 3;
