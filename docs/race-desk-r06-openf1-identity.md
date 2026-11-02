# R-06 OpenF1 identity review: 2026 Singapore Grand Prix

This record is the registry source `openf1-2026-singapore-identity`. It approves OpenF1 identifiers for the reviewed race `2026-singapore-gp` only. The decision was reviewed independently on 2026-11-02 against code base `ecca0c94a8412f12cdb02af1954408b40f519ae1`, and the site owner approved the race and Sprint keys on 2026-11-02. It identifies provider records; it does not establish the completeness of race history or the truth of any provider observation.

## Captured evidence

Responses were captured from the public OpenF1 historical API on 2026-11-02 between 16:34:28Z and 16:34:58Z. They are kept as private review evidence, not published. The independent review recomputed each SHA-256 and size.

| Request | Bytes | Records | SHA-256 |
|---|---:|---:|---|
| `https://api.openf1.org/v1/meetings?year=2026` | 20557 | 27 | `83ddddecc637414e68371c692bfff56103dba006a3016e2881fbceb50e5ebe33` |
| `https://api.openf1.org/v1/sessions?year=2026&session_type=Race` | 11167 | 31 | `10bbf6bbd42f88bb105872591dd46161d405e530789b40c8e46660ea18d0927c` |
| `https://api.openf1.org/v1/sessions?session_key=11388` | 363 | 1 | `f5d774693cf0c7dd31ccc18cf172f2eb019b565b95b8de9230be2e611095cfa6` |

## 2026-singapore-gp-meeting

`meeting_key` **1296**, record index 20 of the 2026 meetings response: year 2026, `meeting_name` "Singapore Grand Prix", `meeting_official_name` "FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2026" (equal to the reviewed official hub title), location Marina Bay, circuit Singapore, country Singapore, `gmt_offset` 08:00:00 (agrees with the reviewed UTC+08:00 and Asia/Singapore). The meeting interval contains all five registry session starts. It is the only 2026 meeting that matches this identity.

## 2026-singapore-gp-race

`session_key` **11388**, record index 24 of the 2026 race-type sessions response and index 0 of the direct lookup (identical on every field): `session_name` "Race", `session_type` "Race", meeting 1296, start 2026-10-11T12:00:00Z (equal to the registry race start), end 2026-10-11T14:00:00Z. It is the only race-type session with this start, and the only session named Race in meeting 1296.

## 2026-singapore-gp-sprint

`session_key` **11383**, record index 23 of the 2026 race-type sessions response: `session_name` "Sprint", `session_type` "Race", meeting 1296, start 2026-10-10T09:00:00Z (equal to the registry Sprint start), end 09:30:00Z. The Sprint and the Race share a session type, so they are told apart by name, meeting and exact start. The v1 timeline publishes the race only.

## Boundaries

The registry validator checks structure, not provider semantics. This record is the semantic review. The other five registered races have equally exact candidate matches, but none is approved here. For `2026-bahrain-gp` (Bahrain Grand Prix in Malaysia, Sepang), the cancelled Sakhir meeting 1282 must be rejected, and the provider's country field must not establish the venue's country.
