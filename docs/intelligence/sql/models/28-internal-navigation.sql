-- I-04 model: internal_page_click EVENTS by source section (page clicked from), destination section (link_path)
-- and link_section, all I-01 classes. Per-article destinations stay in I-03 (13-article-discovery).
-- Clicks are not complete navigation: modifier/middle clicks, prevented clicks, typed URLs, history and non-link
-- navigation are never emitted, and a click does not prove the destination loaded.
-- Parameters: audience-base parameters + @min_events (INT64).
{{AUDIENCE_BASE}}
SELECT
  b.from_day,
  b.through_day,
  classify_path(s.page_path) AS source_section,
  classify_path(s.link_path) AS destination_section,
  s.link_section,
  COUNT(*) AS click_events,
  COUNT(*) >= @min_events AS meets_min_events
FROM site s
CROSS JOIN window_bounds b
WHERE s.event_name = 'internal_page_click'
GROUP BY 1, 2, 3, 4, 5
ORDER BY 6 DESC, 3, 4, 5;
