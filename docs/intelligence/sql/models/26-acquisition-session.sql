-- I-04 model, SESSION scope only: events grouped by GA4's own session attribution
-- (session_traffic_source_last_click.cross_channel_campaign: cross-channel last click, as GA4 computes it).
-- No session is reconstructed here: GA4 supplies the attribution on each event. session_start_events by this scope
-- approximates sessions by GA4 session source; it is still an event count. Never add to scopes 24 or 25.
-- If the export lacks this record, the dry-run fails: there is no fallback to another scope.
-- Parameters: audience-base parameters + @min_events (INT64), applied to session_start_events.
{{AUDIENCE_BASE}}
SELECT
  b.from_day,
  b.through_day,
  'session_last_click' AS attribution_scope,
  s.session_channel_class AS channel_class,
  s.session_medium_class AS medium_class,
  s.session_source_family AS source_family,
  COUNTIF(s.event_name = 'session_start') AS session_start_events,
  COUNTIF(s.event_name = 'page_view') AS page_view_events,
  COUNTIF(s.event_name = 'session_start') >= @min_events AS meets_min_events
FROM site s
CROSS JOIN window_bounds b
WHERE s.event_name IN ('session_start', 'page_view')
GROUP BY 1, 2, 3, 4, 5, 6
ORDER BY 7 DESC, 4, 5, 6;
