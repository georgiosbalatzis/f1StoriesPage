-- I-03 model: internal_page_click EVENTS whose destination is an article, by destination article, source surface
-- (path of the page clicked from) and link_section (enumerated by analytics.js). Clicks, not visits: modifier and
-- middle clicks and non-link navigation are never emitted. Parameters: base parameters + @min_events (INT64).
{{EDITORIAL_BASE}}
SELECT
  b.from_day,
  b.through_day,
  IFNULL(e.article_id, '(unmapped)') AS destination_article_id,
  ANY_VALUE(e.title) AS title,
  ANY_VALUE(e.primary_category) AS primary_category,
  CASE
    WHEN REGEXP_CONTAINS(e.page_path, r'^/(?:index\.html)?$') THEN 'home'
    WHEN REGEXP_CONTAINS(e.page_path, r'^/blog-module/blog-entries/') THEN 'article'
    WHEN REGEXP_CONTAINS(e.page_path, r'^/blog-module/blog/entities/') THEN 'entity_hub'
    WHEN REGEXP_CONTAINS(e.page_path, r'^/blog-module/blog/') THEN 'edition'
    WHEN REGEXP_CONTAINS(e.page_path, r'^/authors/') THEN 'authors'
    WHEN REGEXP_CONTAINS(e.page_path, r'^/standings/') THEN 'standings'
    ELSE 'other'
  END AS source_surface,
  IFNULL(e.link_section, '(none)') AS link_section,
  COUNT(*) AS click_events,
  COUNT(*) >= @min_events AS meets_min_events
FROM editorial e
CROSS JOIN window_bounds b
WHERE e.event_name = 'internal_page_click'
GROUP BY 1, 2, 3, 6, 7
ORDER BY click_events DESC, 3, 6, 7;
