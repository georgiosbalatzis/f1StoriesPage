-- I-03 coverage: what the `editorial` filter keeps and drops, so every model result can state its coverage.
-- Needed because privacy_info.analytics_storage values are unverified (I-02). Reads `resolved` (before the consent
-- and host filters). Event counts only. Parameters: base parameters.
{{EDITORIAL_BASE}}
SELECT
  b.from_day,
  b.through_day,
  r.event_name,
  IFNULL(r.analytics_storage, '(null)') AS analytics_storage,
  r.page_path IS NOT NULL AS primary_host,
  CASE
    WHEN r.article_key IS NULL THEN 'not_article'
    WHEN r.article_id IS NULL THEN 'article_unmapped'
    WHEN r.via_retired_url THEN 'article_retired_url'
    ELSE 'article_mapped'
  END AS article_status,
  COUNT(*) AS events,
  COUNT(DISTINCT r.event_day) AS days_with_events
FROM resolved r
CROSS JOIN window_bounds b
GROUP BY 1, 2, 3, 4, 5, 6
ORDER BY 3, 4, 5, 6;
