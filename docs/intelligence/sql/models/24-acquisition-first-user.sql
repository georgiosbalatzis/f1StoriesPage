-- I-04 model, FIRST-USER scope only: events grouped by how GA4 first acquired the user (traffic_source).
-- This is user-level first touch carried on every event. It is not the source of the session or of the event, and
-- it must never be added to the event or session scopes (25, 26). first_visit_events approximates new consented
-- users by first source; it is an event count, not a deduplicated user count.
-- Parameters: audience-base parameters + @min_events (INT64), applied to page_view_events.
{{AUDIENCE_BASE}}
SELECT
  b.from_day,
  b.through_day,
  'first_user' AS attribution_scope,
  s.first_user_medium_class AS medium_class,
  s.first_user_source_family AS source_family,
  s.first_user_has_campaign AS has_campaign,
  COUNTIF(s.event_name = 'first_visit') AS first_visit_events,
  COUNTIF(s.event_name = 'session_start') AS session_start_events,
  COUNTIF(s.event_name = 'page_view') AS page_view_events,
  COUNTIF(s.event_name = 'page_view') >= @min_events AS meets_min_events
FROM site s
CROSS JOIN window_bounds b
WHERE s.event_name IN ('first_visit', 'session_start', 'page_view')
GROUP BY 1, 2, 3, 4, 5, 6
ORDER BY page_view_events DESC, 4, 5, 6;
