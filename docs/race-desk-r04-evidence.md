# R-04 source capture evidence

This archive records Jolpica provider responses for a bounded draft. The observed classifications and standings are provider data; they are not independently authenticated sporting classifications. Retrieval timestamps record when the response was captured, not when a sporting decision took effect. The raw bytes, digests, lengths and identities are pinned in `data/race-desk/results.v1.json`. The request was recorded, but the final response URL was not, so `finalUrl` is null. UTC retrieval times below preserve the six fractional digits recorded by the probe; the HTTP Date is a separate provider response header.

| Hub race | Endpoint | Exact request URL | HTTP status | Retrieved UTC | HTTP Date | Rows |
| --- | --- | --- | ---: | --- | --- | ---: |
| 2026-japanese-gp | race | `https://api.jolpi.ca/ergast/f1/2026/3/results.json?limit=100` | 200 | `2026-11-01T07:13:37.502606Z` | Sun, 01 Nov 2026 07:13:37 GMT | 22 |
| 2026-japanese-gp | qualifying | `https://api.jolpi.ca/ergast/f1/2026/3/qualifying.json?limit=100` | 200 | `2026-11-01T07:13:38.986719Z` | Sun, 01 Nov 2026 07:13:38 GMT | 22 |
| 2026-japanese-gp | sprint | `https://api.jolpi.ca/ergast/f1/2026/3/sprint.json?limit=100` | 200 | `2026-11-01T07:13:40.243901Z` | Sun, 01 Nov 2026 07:13:40 GMT | 0 |
| 2026-azerbaijan-gp | race | `https://api.jolpi.ca/ergast/f1/2026/15/results.json?limit=100` | 200 | `2026-11-01T07:13:41.514082Z` | Sun, 01 Nov 2026 07:13:41 GMT | 22 |
| 2026-azerbaijan-gp | qualifying | `https://api.jolpi.ca/ergast/f1/2026/15/qualifying.json?limit=100` | 200 | `2026-11-01T07:13:42.974231Z` | Sun, 01 Nov 2026 07:13:42 GMT | 22 |
| 2026-azerbaijan-gp | sprint | `https://api.jolpi.ca/ergast/f1/2026/15/sprint.json?limit=100` | 200 | `2026-11-01T07:13:44.121134Z` | Sun, 01 Nov 2026 07:13:44 GMT | 0 |
| 2026-bahrain-gp | race | `https://api.jolpi.ca/ergast/f1/2026/16/results.json?limit=100` | 200 | `2026-11-01T07:13:45.467234Z` | Sun, 01 Nov 2026 07:13:45 GMT | 22 |
| 2026-bahrain-gp | qualifying | `https://api.jolpi.ca/ergast/f1/2026/16/qualifying.json?limit=100` | 200 | `2026-11-01T07:13:46.912640Z` | Sun, 01 Nov 2026 07:13:46 GMT | 22 |
| 2026-bahrain-gp | sprint | `https://api.jolpi.ca/ergast/f1/2026/16/sprint.json?limit=100` | 200 | `2026-11-01T07:13:48.160744Z` | Sun, 01 Nov 2026 07:13:48 GMT | 0 |
| 2026-singapore-gp | race | `https://api.jolpi.ca/ergast/f1/2026/17/results.json?limit=100` | 200 | `2026-11-01T07:13:49.313278Z` | Sun, 01 Nov 2026 07:13:49 GMT | 22 |
| 2026-singapore-gp | qualifying | `https://api.jolpi.ca/ergast/f1/2026/17/qualifying.json?limit=100` | 200 | `2026-11-01T07:13:50.790618Z` | Sun, 01 Nov 2026 07:13:50 GMT | 22 |
| 2026-singapore-gp | sprint | `https://api.jolpi.ca/ergast/f1/2026/17/sprint.json?limit=100` | 200 | `2026-11-01T07:13:51.941127Z` | Sun, 01 Nov 2026 07:13:51 GMT | 22 |

The three sprint responses with zero rows have `total=0` and an empty `Races` array. They establish only that these captures returned no results. Race and qualifying captures and the Singapore sprint capture each contain 22 rows. Race descriptors in qualifying and sprint responses identify the race; they do not establish session start times.

| Hub identity | Provider season / round | Provider descriptor | Circuit | Race date and time UTC | Standings comparison rounds |
| --- | --- | --- | --- | --- | --- |
| 2026-japanese-gp | 2026 / 3 | Japanese Grand Prix | suzuka | 2026-03-29 05:00:00Z | 2 → 3 |
| 2026-azerbaijan-gp | 2026 / 15 | Azerbaijan Grand Prix | baku | 2026-09-26 11:00:00Z | 14 → 15 |
| 2026-bahrain-gp | 2026 / 16 | Bahrain Grand Prix in Malaysia | sepang | 2026-10-04 07:00:00Z | 15 → 16 |
| 2026-singapore-gp | 2026 / 17 | Singapore Grand Prix | marina_bay | 2026-10-11 12:00:00Z | 16 → 17 |

The Bahrain hub identity is bound to the provider's reviewed “Bahrain Grand Prix in Malaysia” descriptor at Sepang. Unmapped registry events, including 2025 Singapore and 2026 Mexico, have no guessed provider binding.

The six existing standings files are pinned by their existing bytes, digest, path and reviewed repository revision `7b0ca4fa`. Their `generatedAt` values are snapshot generation times. The manifest separately retains wrapper and embedded URLs; round 16 and 17 embedded URLs are season-wide even though their wrapper URLs specify rounds. No standings rows are duplicated in this archive.

Raw responses and this manifest are source inputs for deterministic validation and must remain outside public build artifacts. No live request is needed for validation. These captures are individual observations, not an amendment history.
