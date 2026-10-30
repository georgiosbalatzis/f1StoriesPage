# Race Desk R-01 evidence inventory

The registry is a hand-reviewed sample, not a complete calendar. Its source records give the repository, exact commit, Git blob SHA-1, path, and review time for every claim. Git blob IDs describe the checked-in file bytes; the linked commit preserves the source snapshot. Review confirms the recorded source values, not that an event is final or that session data is available. Session starts are scheduled UTC instants, independently of the venue's IANA zone.

The production source lock at main commit `9f676e1f9a7d1be71691a78164af2f559befffca`, `scripts/deployment/sources.json` (blob `5a87814d7238e6fc88476602b65e42b901aa3da2`), pins TYRES code to `50e5f50be89e038257cbe3426b366810e0c1f59a`, but its data input tracks `main` and is refreshed during build. A read of remote `refs/heads/main` on 2026-10-30 resolved to that same commit. The registry freezes this observed data revision; future builds can consume different data without changing the code pin. See [the source lock](https://github.com/georgiosbalatzis/f1StoriesPage/blob/9f676e1f9a7d1be71691a78164af2f559befffca/scripts/deployment/sources.json) and the [TYRES snapshot](https://github.com/georgiosbalatzis/Tyres/tree/50e5f50be89e038257cbe3426b366810e0c1f59a/data).

| Registry event | Checked-in identity and schedule | Jolpica binding | OpenF1 |
| --- | --- | --- | --- |
| 2026 Japanese GP | `2026-jp`, Suzuka, Asia/Tokyo | round 3, Grid snapshot | unknown |
| 2026 Bahrain GP | `2026-bh`, Sepang, Asia/Kuala_Lumpur | round 16, Grid snapshot | unknown |
| 2026 Azerbaijan GP | `2026-az`, Baku, Asia/Baku | round 15, Grid snapshot | unknown |
| 2026 Singapore GP | `2026-sg`, Marina Bay, Asia/Singapore; sprint qualifying and qualifying are separate | round 17, Grid snapshot | unknown |
| 2025 Singapore GP | `2025-sg`, Marina Bay, Asia/Singapore | unknown | unknown |
| 2026 Mexican GP | `2026-mx`, Mexico City, America/Mexico_City; scheduled future race | unknown | unknown |

The independent Grid files `standings/rounds/2026-{3,15,16,17}.json` contain `raceName` and Jolpica standings table season/round. TYRES `data/generated/2026/` contains identity records for the 2026 sample; `data/overrides/2025/2025-sg.json` provides the historical identity. The corresponding `data/weekends/` records supply the recorded time zone and session starts. The Mexico calendar fixture reports round 19 and states a Jolpica cross-check, but the registry leaves that provider binding unresolved without a checked-in round-specific Jolpica snapshot. Likewise the 2025 Singapore TYRES override says round 18, but that alone does not establish a Jolpica binding.

The reviewed TYRES tree contains 19 weekend files for 2026 and two for 2025. The main checkout contains 18 2026 Grid round snapshots. These are source-corpus counts, not estimates of actual race coverage. The main `scripts/build/__tests__/fixtures/f1-2026-race-starts.json` (blob `0db7d7d2ae1507bd9e67a34a0a9f7603ee99d48d`) records race starts in local time, not complete session schedules; it explicitly calls round 16 Bahrain GP in Malaysia. TYRES `data/reference/weekend-venues.json` (blob `8252d3888bfcd67e8580459e8ac9d1268bbb6426`) also pairs Sepang with Bahrain and Asia/Kuala_Lumpur. Event identity and circuit identity therefore remain distinct.

Main `standings/dirty-air-cache.json` (blob `7591c3173d2dbb85614b4097e900dd155a62c516`) records year 2026, race session keys 11253, 11377 and 11388, and Suzuka, Baku and Marina Bay start times respectively. Those rows have empty meeting names and no meeting keys. Matching them to specific events from venue and time is an inference; they are not entered as verified session bindings. No OpenF1 meeting or session IDs are asserted in this sample. URLs inside transient datasets are not treated as frozen evidence.

To add a record, review the exact source snapshot and its field values, record a source and a claim for each material non-null binding and scheduled session value, and leave unverified provider keys null. Avoid inferring an event from a circuit, a round from an array position, or an OpenF1 identity from a transient URL. Re-review changes to source mappings instead of treating schema validation as proof.
