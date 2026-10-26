-- I-05 model F: aggregate coverage and integrity of the observation pipeline, stage by stage, for the same window as
-- models 30-32. It complements I-01 sql/03-web-vital-integrity.sql (per-version id/revision/value/conflict checks over
-- at most 7 days) with what 03 cannot show: version mix in the full scan, consent and host stages, dedup outcomes,
-- validity and cohort placement of final observations, and agreement with the library's own rating.
-- `count` is events in the 'scan' stages, snapshots in 'eligible', observations in the rest. No ids are output.
-- Parameters: rum-base parameters.
{{RUM_BASE}}
, final AS (
  SELECT
    l.*,
    DATE(TIMESTAMP_MILLIS(l.nav_start_ms), @report_timezone) AS nav_day
  FROM latest l
), checks AS (
  SELECT 'scan_version' AS stage,
    CASE WHEN version IS NULL THEN '(none: legacy)' WHEN version = 'wv6.2.3-rum1' THEN version ELSE 'other' END AS category
  FROM events
  UNION ALL
  SELECT 'scan_consent', IFNULL(analytics_storage, '(null)') FROM events WHERE version = 'wv6.2.3-rum1'
  UNION ALL
  SELECT 'scan_host', IF(page_path IS NOT NULL, 'primary', 'other_or_missing') FROM events WHERE version = 'wv6.2.3-rum1'
  UNION ALL
  SELECT 'scan_identity',
    CASE WHEN metric_id IS NULL THEN 'missing_metric_id' WHEN revision IS NULL OR revision < 1 THEN 'invalid_revision' ELSE 'identified' END
  FROM events WHERE version = 'wv6.2.3-rum1' AND analytics_storage = 'Yes' AND page_path IS NOT NULL
  UNION ALL
  SELECT 'scan_identity', 'revision_not_integer'
  FROM events WHERE version = 'wv6.2.3-rum1' AND analytics_storage = 'Yes' AND page_path IS NOT NULL AND revision_not_int
  UNION ALL
  SELECT 'eligible_snapshots', IF(snapshot_copies > 1, IF(conflicted, 'conflicting_copy', 'duplicate_copy'), 'single_copy') FROM snapshots
  UNION ALL
  SELECT 'observations', 'resolved' FROM final
  UNION ALL
  SELECT 'observations', 'revised_after_first_snapshot' FROM final WHERE revision > 1
  UNION ALL
  SELECT 'observations', 'final_snapshot_duplicated' FROM final WHERE snapshot_copies > 1 AND NOT conflicted
  UNION ALL
  SELECT 'observations', 'final_snapshot_conflicting' FROM final WHERE conflicted
  UNION ALL
  SELECT 'observation_validity',
    CASE
      WHEN metric IS NULL OR metric NOT IN ('LCP', 'INP', 'CLS', 'FCP', 'TTFB') THEN 'invalid_metric_name'
      WHEN value IS NULL OR value < 0 THEN 'missing_or_negative_value'
      WHEN nav_start_ms IS NULL THEN 'missing_nav_start'
      WHEN page_group IS NULL OR page_group NOT IN ('home', 'edition', 'article', 'standings', 'other') THEN 'invalid_page_group'
      WHEN viewport IS NULL OR viewport NOT IN ('mobile_like', 'desktop_like') THEN 'invalid_viewport'
      WHEN coverage IS NULL OR coverage NOT IN ('delayed_existing', 'delayed_consent', 'bfcache_observed') THEN 'invalid_coverage'
      ELSE 'valid'
    END
  FROM final
  UNION ALL
  SELECT 'observation_fields', 'missing_observation_start' FROM final WHERE observation_start_ms IS NULL
  UNION ALL
  SELECT 'observation_fields', 'nav_type_missing_or_unlisted' FROM final
  WHERE navigation_type IS NULL OR navigation_type NOT IN ('navigate', 'reload', 'back-forward', 'back-forward-cache', 'prerender', 'restore')
  UNION ALL
  SELECT 'cohort_placement',
    CASE WHEN f.nav_day < b.from_day THEN 'before_cohort' WHEN f.nav_day > b.through_day THEN 'after_cohort' ELSE 'in_cohort' END
  FROM final f CROSS JOIN window_bounds b WHERE f.nav_start_ms IS NOT NULL
  UNION ALL
  SELECT 'coverage_distribution', coverage FROM rated
  UNION ALL
  -- The collector also sends the library's rating; disagreement with the base thresholds is a defect to investigate.
  SELECT 'library_rating', IF(REPLACE(library_rating, '-', '_') = rating, 'agrees', 'disagrees_or_missing')
  FROM rated WHERE rating IS NOT NULL
)
SELECT
  b.from_day,
  b.through_day,
  b.requested_through_day,
  b.extraction_through,
  b.cohort_truncated,
  b.late_revision_days,
  c.stage,
  c.category,
  COUNT(*) AS count
FROM checks c
CROSS JOIN window_bounds b
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
ORDER BY 7, 8;
