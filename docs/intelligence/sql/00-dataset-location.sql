-- I-01 read-only: location of an ALREADY LINKED GA4 export dataset. Metadata only; no event table is read.
-- Placeholders (replace by hand, never commit real values):
--   {{PROJECT_ID}}       Google Cloud project holding the export
--   {{GA4_PROPERTY_ID}}  numeric GA4 property id; the export dataset is analytics_<id>
-- Zero rows means the dataset is not in the EU multi-region: rerun with the region shown on the dataset
-- (for example `region-europe-west1`). Any non-EU location is a blocker (metrics-contract.md#eu-location).
SELECT schema_name, location, creation_time, last_modified_time
FROM `{{PROJECT_ID}}`.`region-eu`.INFORMATION_SCHEMA.SCHEMATA
WHERE schema_name = 'analytics_{{GA4_PROPERTY_ID}}';
