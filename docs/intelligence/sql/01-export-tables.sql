-- I-01 read-only: export coverage and freshness from table metadata only (no event rows scanned).
-- Placeholders as in 00-dataset-location.sql. Parameters: @start_day, @end_day (DATE, inclusive).
-- Read: missing days = gaps; events_intraday_* present = streaming export on; last_modified well after
-- table_day = late updates; earliest day in a wide window = link date (no backfill).
-- pseudonymous_users_* / users_* rows only show that a user export exists; never query those tables.
SELECT
  table_id,
  REGEXP_EXTRACT(table_id, r'^(.*)_\d{8}$') AS family,
  SAFE.PARSE_DATE('%Y%m%d', REGEXP_EXTRACT(table_id, r'_(\d{8})$')) AS table_day,
  TIMESTAMP_MILLIS(creation_time) AS created_at,
  TIMESTAMP_MILLIS(last_modified_time) AS last_modified_at,
  row_count,
  size_bytes
FROM `{{PROJECT_ID}}.analytics_{{GA4_PROPERTY_ID}}.__TABLES__`
WHERE SAFE.PARSE_DATE('%Y%m%d', REGEXP_EXTRACT(table_id, r'_(\d{8})$')) BETWEEN @start_day AND @end_day
ORDER BY table_day, family;
