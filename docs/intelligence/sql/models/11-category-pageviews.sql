-- I-03 model: consented article page_view EVENTS per primary category (categoryIndexes[0] of the index).
-- catalog_articles counts index articles published on or before through_day, from the index at render time
-- (not a historical catalog). Parameters: base parameters + @min_events (INT64).
{{EDITORIAL_BASE}}
SELECT
  b.from_day,
  b.through_day,
  category,
  IFNULL(v.page_view_events, 0) AS page_view_events,
  IFNULL(v.articles_with_events, 0) AS articles_with_events,
  IFNULL(c.catalog_articles, 0) AS catalog_articles,
  IFNULL(v.page_view_events, 0) >= @min_events AS meets_min_events
FROM (
  SELECT
    IF(article_id IS NULL, '(unmapped)', IFNULL(primary_category, '(unknown)')) AS category,
    COUNT(*) AS page_view_events,
    COUNT(DISTINCT article_id) AS articles_with_events
  FROM editorial
  WHERE event_name = 'page_view'
  GROUP BY category
) v
FULL JOIN (
  SELECT IFNULL(l.primary_category, '(unknown)') AS category, COUNT(*) AS catalog_articles
  FROM article_lookup l
  CROSS JOIN window_bounds w
  WHERE l.published_day IS NULL OR l.published_day <= w.through_day
  GROUP BY category
) c USING (category)
CROSS JOIN window_bounds b
ORDER BY page_view_events DESC, category;
