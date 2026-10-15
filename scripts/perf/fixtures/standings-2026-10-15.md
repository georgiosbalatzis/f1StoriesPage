# Recorded standings responses

`standings-2026-10-15.json.gz` contains unchanged raw response bodies, provider URLs,
capture timestamps, HTTP status, record counts and SHA256 checksums. Captured on
2026-10-15 with at most two simultaneous requests and a 30-second request timeout.
Every recorded response returned HTTP 200.

The interaction check derives a session list containing completed races 11731
(2026-10-04) and 11388 (Singapore), plus qualifying 11384. It derives a Jolpica schedule
containing Singapore round 17. Responses retain their real session/driver keys.
Lap-one and qualifying analytics exercise Singapore only; these fixtures do not
claim coverage of complete-season results. No fabricated laps or drivers are used.

Track map samples cover the actual fastest-lap windows of Ferrari drivers 16 and
44 in session 11388, matching the module's default comparison. Location data for
other drivers is intentionally omitted. Dirty-air, debrief and pinned-round snapshots
come from the built site's committed data.

Run from the repository root after building the public artifact:

```sh
node scripts/perf/standings-interactions-qa.mjs --root=dist
```

This is a deterministic functionality check, not a performance benchmark or a
replacement for production request inspection. It makes no live provider requests.
