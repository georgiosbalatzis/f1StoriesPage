-- I-04 model: site-wide engagement EVENT counts. Article-level engagement stays in I-03 (12-article-engagement).
--   article_engaged  one document reached 30 visible consented seconds and 50% scroll; not reading completion
--   user_engagement  GA4's automatic engagement ping; a count of pings, not time, sessions or bounce
--   article_share    by method: a share ACTION (link opened, link copied, native sheet); not a completed share
--   outbound_click   split into sponsored / not_sponsored (rel=sponsored); a click, not a delivered visit
--   journal_search   edition search pauses (900 ms debounce); one search can emit several, so not unique searches
-- No durations, bounce or retention are derived. Parameters: audience-base parameters + @min_events (INT64).
{{AUDIENCE_BASE}}
SELECT
  b.from_day,
  b.through_day,
  s.event_name,
  CASE
    WHEN s.event_name = 'article_share' THEN s.share_method
    WHEN s.event_name = 'outbound_click' THEN IF(s.sponsored, 'sponsored', 'not_sponsored')
    ELSE 'all'
  END AS breakdown,
  COUNT(*) AS events,
  COUNT(DISTINCT s.event_day) AS days_with_events,
  COUNT(*) >= @min_events AS meets_min_events
FROM site s
CROSS JOIN window_bounds b
WHERE s.event_name IN ('article_engaged', 'user_engagement', 'article_share', 'outbound_click', 'journal_search')
GROUP BY 1, 2, 3, 4
ORDER BY 3, 5 DESC, 4;
