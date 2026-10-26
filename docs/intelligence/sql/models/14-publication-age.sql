-- I-03 model: article page_view and article_engaged EVENTS by publication age and primary category.
-- age_days = event day (property time zone) minus the index publication date, so 'before_publication' can appear
-- from a time-zone offset or a re-dated article. Parameters: base parameters + @min_events (INT64).
{{EDITORIAL_BASE}}
SELECT
  b.from_day,
  b.through_day,
  CASE
    WHEN age_days IS NULL THEN 'unknown'
    WHEN age_days < 0 THEN 'before_publication'
    WHEN age_days < 1 THEN 'day_0'
    WHEN age_days < 2 THEN 'day_1'
    WHEN age_days < 7 THEN 'days_2_6'
    WHEN age_days < 30 THEN 'days_7_29'
    WHEN age_days < 90 THEN 'days_30_89'
    WHEN age_days < 365 THEN 'days_90_364'
    ELSE 'days_365_plus'
  END AS age_bucket,
  IF(article_id IS NULL, '(unmapped)', IFNULL(primary_category, '(unknown)')) AS primary_category,
  MIN(age_days) AS min_age_days,
  COUNTIF(event_name = 'page_view') AS page_view_events,
  COUNTIF(event_name = 'article_engaged') AS article_engaged_events,
  COUNT(DISTINCT IF(event_name = 'page_view', article_id, NULL)) AS articles_with_page_views,
  COUNTIF(event_name = 'page_view') >= @min_events AS meets_min_events
FROM (
  SELECT *, DATE_DIFF(event_day, published_day, DAY) AS age_days
  FROM editorial
  WHERE event_name IN ('page_view', 'article_engaged')
) e
CROSS JOIN window_bounds b
GROUP BY 1, 2, 3, 4
ORDER BY min_age_days IS NULL, min_age_days, 4;
