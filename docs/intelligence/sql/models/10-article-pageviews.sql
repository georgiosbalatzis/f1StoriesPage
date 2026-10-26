-- I-03 model: consented page_view EVENTS per canonical article. Not users, sessions or unique document visits.
-- Parameters: base parameters + @min_events (INT64). Rows below @min_events are flagged, never dropped.
-- article_id '(unmapped)' collects article URLs absent from the index; their keys are counted, never listed.
{{EDITORIAL_BASE}}
SELECT
  b.from_day,
  b.through_day,
  IFNULL(e.article_id, '(unmapped)') AS article_id,
  ANY_VALUE(e.title) AS title,
  ANY_VALUE(e.published_day) AS published_day,
  ANY_VALUE(e.primary_category) AS primary_category,
  ANY_VALUE(e.author) AS author,
  COUNT(*) AS page_view_events,
  COUNTIF(e.via_retired_url) AS via_retired_url_events,
  COUNT(DISTINCT e.event_day) AS days_with_events,
  COUNT(DISTINCT IF(e.article_id IS NULL, e.article_key, NULL)) AS unmapped_keys,
  COUNT(*) >= @min_events AS meets_min_events
FROM editorial e
CROSS JOIN window_bounds b
WHERE e.event_name = 'page_view'
GROUP BY 1, 2, 3
ORDER BY page_view_events DESC, 3;
