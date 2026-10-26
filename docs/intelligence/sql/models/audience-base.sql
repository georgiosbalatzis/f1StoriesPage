-- I-04 shared base of the audience, acquisition and engagement models. Not runnable alone:
-- `scripts/intelligence/editorial-model.mjs render` inserts it with I-01's classify_path (sql/02) and
-- audience-functions.sql. Parameters, window, maturity rule, consent filter and host rule are the same text as
-- base.sql (the tests require it): @start_day, @end_day, @as_of_day (DATE); daily tables only, at most 90, none
-- newer than @as_of_day - 4.
-- Raw strings never leave `events`: device, country, sources, mediums, channel groups and enumerated parameters are
-- reduced by allowlist functions there, and campaign names and click ids only as presence flags. Page and link
-- paths leave only through classify_path. Models read `site` (consented, primary-host, mature);
-- only 29-audience-coverage reads `events`.
{{CLASSIFY_PATH}}

{{AUDIENCE_FUNCTIONS}}

WITH window_bounds AS (
  SELECT
    @start_day AS from_day,
    IF(@as_of_day > DATE_ADD(CURRENT_DATE(), INTERVAL 1 DAY), ERROR('as_of_day is in the future'),
      LEAST(@end_day, DATE_ADD(@start_day, INTERVAL 89 DAY), DATE_SUB(@as_of_day, INTERVAL 4 DAY))) AS through_day
), events AS (
  SELECT
    PARSE_DATE('%Y%m%d', _TABLE_SUFFIX) AS event_day,
    event_name,
    privacy_info.analytics_storage AS analytics_storage,
    -- Path of the page the event fired on; NULL for any host other than https://f1-stories.gr.
    REGEXP_EXTRACT((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'),
      r'^https://f1-stories\.gr(/[^?#]*)') AS page_path,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'link_path') AS link_path,
    link_section_class((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'link_section')) AS link_section,
    share_method((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'method')) AS share_method,
    -- analytics.js sets `sponsored` only when true, so presence is the flag whatever type GA4 stores.
    EXISTS(SELECT 1 FROM UNNEST(event_params) WHERE key = 'sponsored') AS sponsored,
    device_class(device.category) AS device_class,
    country_label(geo.country) AS country,
    -- First-user scope: how GA4 first acquired the user. Not the session's or the event's source.
    medium_class(traffic_source.medium) AS first_user_medium_class,
    source_family(traffic_source.source) AS first_user_source_family,
    (traffic_source.name IS NOT NULL AND traffic_source.name NOT IN ('(direct)', '(organic)', '(referral)', '(none)', '(not set)', '(data deleted)')) AS first_user_has_campaign,
    -- Event scope: campaign parameters collected on this event's URL (utm_* and click ids kept by analytics.js).
    medium_class(collected_traffic_source.manual_medium) AS collected_medium_class,
    source_family(collected_traffic_source.manual_source) AS collected_source_family,
    (collected_traffic_source.manual_campaign_name IS NOT NULL) AS collected_has_campaign,
    (collected_traffic_source.gclid IS NOT NULL OR collected_traffic_source.dclid IS NOT NULL) AS collected_click_id,
    -- Session scope: GA4's cross-channel last-click attribution of the session this event belongs to.
    medium_class(session_traffic_source_last_click.cross_channel_campaign.medium) AS session_medium_class,
    source_family(session_traffic_source_last_click.cross_channel_campaign.source) AS session_source_family,
    channel_class(session_traffic_source_last_click.cross_channel_campaign.default_channel_group) AS session_channel_class
  FROM `{{PROJECT_ID}}.analytics_{{GA4_PROPERTY_ID}}.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', @start_day)
      AND FORMAT_DATE('%Y%m%d', LEAST(@end_day, DATE_ADD(@start_day, INTERVAL 89 DAY), DATE_SUB(@as_of_day, INTERVAL 4 DAY)))
    AND event_name IN ('page_view', 'session_start', 'first_visit', 'user_engagement', 'article_engaged',
      'article_share', 'internal_page_click', 'outbound_click', 'journal_search')
), site AS (
  SELECT events.*
  FROM events
  CROSS JOIN window_bounds
  WHERE analytics_storage = 'Yes' AND page_path IS NOT NULL AND event_day <= through_day
)
