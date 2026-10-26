-- I-04 model, EVENT scope only: events grouped by the campaign parameters collected on that event
-- (collected_traffic_source: utm_* and click ids that analytics.js keeps in page_location). It holds no referrer
-- information, so 'unattributed' here means "no campaign parameters on this event", never Direct.
-- Never add to the first-user or session scopes (24, 26).
-- Parameters: audience-base parameters + @min_events (INT64), applied to page_view_events.
{{AUDIENCE_BASE}}
SELECT
  b.from_day,
  b.through_day,
  'event_collected' AS attribution_scope,
  s.collected_medium_class AS medium_class,
  s.collected_source_family AS source_family,
  s.collected_has_campaign AS has_campaign,
  s.collected_click_id AS click_id_present,
  COUNTIF(s.event_name = 'session_start') AS session_start_events,
  COUNTIF(s.event_name = 'page_view') AS page_view_events,
  COUNTIF(s.event_name = 'page_view') >= @min_events AS meets_min_events
FROM site s
CROSS JOIN window_bounds b
WHERE s.event_name IN ('session_start', 'page_view')
GROUP BY 1, 2, 3, 4, 5, 6, 7
ORDER BY 9 DESC, 4, 5, 6, 7;
