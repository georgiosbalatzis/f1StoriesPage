-- I-04 coverage: per event name, what the consent/host/maturity filter keeps, and how often each I-04 field is
-- missing or unrecognised among kept events. Needed because I-01 02 inventories event_params only, and I-03 15 covers
-- three events and no record fields. Run it with every I-04 result: a high unknown/unattributed/other count means
-- the corresponding model is uninformative, not that the traffic is Direct or absent. Event counts only.
-- `kept` repeats the `site` filter of audience-base.sql (the tests require it). Parameters: audience-base parameters.
{{AUDIENCE_BASE}}
SELECT
  from_day,
  through_day,
  event_name,
  COUNT(*) AS events_in_tables,
  COUNTIF(analytics_storage = 'Yes') AS consented_events,
  COUNTIF(page_path IS NOT NULL) AS primary_host_events,
  COUNTIF(kept) AS site_events,
  COUNTIF(kept AND device_class IN ('(unknown)', 'other')) AS device_unknown_or_other,
  COUNTIF(kept AND country = '(unknown)') AS country_unknown,
  COUNTIF(kept AND first_user_source_family IN ('unattributed', 'other_source')) AS first_user_source_unattributed_or_other,
  COUNTIF(kept AND collected_source_family = 'unattributed') AS collected_source_unattributed,
  COUNTIF(kept AND session_source_family IN ('unattributed', 'other_source')) AS session_source_unattributed_or_other,
  COUNTIF(kept AND session_channel_class IN ('unattributed', 'other')) AS session_channel_unattributed_or_other,
  COUNTIF(kept AND (share_method = 'other' OR link_section = 'other')) AS enum_parameter_other
FROM (
  SELECT events.*, from_day, through_day,
    (analytics_storage = 'Yes' AND page_path IS NOT NULL AND event_day <= through_day) AS kept
  FROM events
  CROSS JOIN window_bounds
)
GROUP BY 1, 2, 3
ORDER BY 3;
