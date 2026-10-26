-- I-04 allowlist functions. Every raw device, country, acquisition and enumerated-parameter string passes through
-- one of these inside audience-base.sql, so no model can output an arbitrary or untrusted string.
-- Rules match LOWER(TRIM(value)); anything unlisted becomes a fixed bucket. NULL or blank is never "direct".
CREATE TEMP FUNCTION device_class(value STRING) AS (
  CASE
    WHEN value IS NULL OR TRIM(value) = '' THEN '(unknown)'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:desktop|mobile|tablet)$') THEN LOWER(TRIM(value))
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^smart ?tv$') THEN 'smart_tv'
    ELSE 'other'
  END
);

-- GA4 derives geo.country from the request, not from page input; only the country level is read.
CREATE TEMP FUNCTION country_label(value STRING) AS (
  CASE
    WHEN value IS NULL OR TRIM(value) = '' THEN '(unknown)'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^\(not set\)$') THEN '(unknown)'
    ELSE TRIM(value)
  END
);

-- Conservative medium classes. GA4's "(none)" means no source data, so it is direct OR unknown, never confirmed direct.
CREATE TEMP FUNCTION medium_class(value STRING) AS (
  CASE
    WHEN value IS NULL OR TRIM(value) = '' THEN 'unattributed'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^\(none\)$') THEN 'direct_or_unknown'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^\(not set\)$') THEN 'not_set'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^\(data deleted\)$') THEN 'data_deleted'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^organic$') THEN 'organic_search_reported'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^referral$') THEN 'referral'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:social|social[-_ ]?(?:network|media)|sm)$') THEN 'social'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:e[-_ ]?mail|newsletter)$') THEN 'email'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:cpc|ppc|cpm|cpv|cpa|display|banner|retargeting|paid[-_ ]?[a-z]*)$') THEN 'paid'
    ELSE 'other_tagged'
  END
);

-- Known source families only; the source string itself is never output.
CREATE TEMP FUNCTION source_family(value STRING) AS (
  CASE
    WHEN value IS NULL OR TRIM(value) = '' THEN 'unattributed'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^\(direct\)$') THEN 'direct_or_unknown'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^\(not set\)$') THEN 'not_set'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^\(data deleted\)$') THEN 'data_deleted'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:chatgpt\.com|chat\.openai\.com|chatgpt|openai|perplexity(?:\.ai)?|gemini\.google\.com|copilot\.microsoft\.com|claude\.ai)$') THEN 'ai_assistant'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:www\.)?f1-stories\.gr$') THEN 'self_referral'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:(?:www\.)?f1stories\.gr|georgiosbalatzis\.github\.io)$') THEN 'legacy_site'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:(?:[a-z0-9-]+\.)*google(?:\.[a-z]{2,3}){1,2}|google)$') THEN 'google'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:(?:[a-z0-9-]+\.)*bing\.com|bing)$') THEN 'bing'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:(?:[a-z0-9-]+\.)*duckduckgo\.com|duckduckgo)$') THEN 'duckduckgo'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:(?:[a-z0-9-]+\.)*(?:yahoo|yandex)(?:\.[a-z]{2,3}){1,2}|yahoo|yandex|(?:[a-z0-9-]+\.)*ecosia\.org|ecosia|search\.brave\.com)$') THEN 'other_search_engine'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:(?:[a-z0-9-]+\.)*facebook\.com|facebook|fb|fb\.me)$') THEN 'facebook'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:(?:[a-z0-9-]+\.)*instagram\.com|instagram|ig)$') THEN 'instagram'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:(?:[a-z0-9-]+\.)*threads\.(?:net|com)|threads)$') THEN 'threads'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:t\.co|(?:[a-z0-9-]+\.)*(?:twitter|x)\.com|twitter|x)$') THEN 'x'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:(?:[a-z0-9-]+\.)*reddit\.com|reddit)$') THEN 'reddit'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:(?:[a-z0-9-]+\.)*linkedin\.com|lnkd\.in|linkedin)$') THEN 'linkedin'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:(?:[a-z0-9-]+\.)*youtube\.com|youtu\.be|youtube)$') THEN 'youtube'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:(?:[a-z0-9-]+\.)*whatsapp\.com|wa\.me|whatsapp)$') THEN 'whatsapp'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:t\.me|(?:[a-z0-9-]+\.)*telegram\.(?:org|me)|telegram)$') THEN 'telegram'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:(?:[a-z0-9-]+\.)*tiktok\.com|tiktok)$') THEN 'tiktok'
    ELSE 'other_source'
  END
);

-- GA4's session default channel group, mapped onto the same conservative classes. "Direct" is direct OR unknown.
CREATE TEMP FUNCTION channel_class(value STRING) AS (
  CASE
    WHEN value IS NULL OR TRIM(value) = '' THEN 'unattributed'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^direct$') THEN 'direct_or_unknown'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^unassigned$') THEN 'unassigned'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^organic search$') THEN 'organic_search_reported'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^organic social$') THEN 'social'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^organic video$') THEN 'organic_video_reported'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^organic shopping$') THEN 'organic_shopping_reported'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^referral$') THEN 'referral'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^email$') THEN 'email'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:paid search|paid social|paid shopping|paid video|paid other|display|cross-network|audio)$') THEN 'paid'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:sms|mobile push notifications|affiliates)$') THEN 'other_reported'
    ELSE 'other'
  END
);

-- Enumerated by blog-fixes.js / analytics.js; anything else (for example injected events) is 'other'.
CREATE TEMP FUNCTION share_method(value STRING) AS (
  CASE
    WHEN value IS NULL OR TRIM(value) = '' THEN '(none)'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:whatsapp|x|facebook|telegram|social_link|copy_link|native_share)$') THEN LOWER(TRIM(value))
    ELSE 'other'
  END
);

CREATE TEMP FUNCTION link_section_class(value STRING) AS (
  CASE
    WHEN value IS NULL OR TRIM(value) = '' THEN '(none)'
    WHEN REGEXP_CONTAINS(LOWER(TRIM(value)), r'^(?:article_share|sponsor|social|cta|article_link|navigation|footer|page)$') THEN LOWER(TRIM(value))
    ELSE 'other'
  END
);
