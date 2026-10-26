-- I-03 model: article_engaged EVENTS beside page_view EVENTS per canonical article.
-- engaged_events_per_page_view_event is an EVENT-BASED PROXY: article_engaged means 30 visible consented seconds
-- and 50% scroll in one document. It is not reading completion, it is not matched to page views by session or
-- document, it is not a deduplicated reader rate, and it can exceed 1. Parameters: base + @min_events (INT64),
-- applied to page_view_events.
{{EDITORIAL_BASE}}
SELECT
  b.from_day,
  b.through_day,
  IFNULL(e.article_id, '(unmapped)') AS article_id,
  ANY_VALUE(e.title) AS title,
  ANY_VALUE(e.primary_category) AS primary_category,
  ANY_VALUE(e.author) AS author,
  COUNTIF(e.event_name = 'page_view') AS page_view_events,
  COUNTIF(e.event_name = 'article_engaged') AS article_engaged_events,
  SAFE_DIVIDE(COUNTIF(e.event_name = 'article_engaged'), COUNTIF(e.event_name = 'page_view')) AS engaged_events_per_page_view_event,
  COUNTIF(e.event_name = 'page_view') >= @min_events AS meets_min_events
FROM editorial e
CROSS JOIN window_bounds b
WHERE e.event_name IN ('page_view', 'article_engaged')
GROUP BY 1, 2, 3
ORDER BY page_view_events DESC, 3;
