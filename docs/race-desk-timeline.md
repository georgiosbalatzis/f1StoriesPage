# Race Desk race timeline (R-06)

A GP Hub may show a factual, chronological list of what the OpenF1 feed recorded during the race session: race-control messages (flags, Safety Car / VSC, session status, stewards' notices as the feed worded them) and pit-lane visits. It is historical and descriptive. It is not live tracking, pace analysis or prediction, and it never infers overtakes, incidents, penalties or strategy.

## Data rights

`data/race-desk/publication-rights.v1.json` records publication decisions per provider. On 2026-11-02 the site owner accepted the OpenF1 data licence, CC BY-NC-SA 4.0, for this use. A published timeline therefore shows: OpenF1 as the source with a link, that it is unofficial and not associated with Formula 1, the retrieval date, and that the derived timeline data is under CC BY-NC-SA 4.0. Any other provider stays `unresolved` until the owner decides. Jolpica (used by the R-04 results) carries the same licence; its entry is `unresolved` because R-04 predates this record, and recording it does not change R-04.

## Identity

Only the existing registry fields authorise a provider mapping: `sourceKeys.openf1MeetingKey` and the race session's `openf1SessionKey` in `data/race-desk/registry.v1.json`. A mapping needs receipted meeting and session records whose season, official name, venue, session name and start time match the reviewed race, plus an independent review. Name-only, round-only or venue-only matches are rejected. `2026-bahrain-gp` is the Bahrain Grand Prix held at Sepang and must never be remapped by name.

## Pipeline

1. `node scripts/race-desk/capture-openf1.mjs <raceId>` (run by a maintainer, never in CI) fetches `sessions`, `race_control` and `pit` for the approved race session, stores the exact bytes under `data/race-desk/captures/openf1/` and writes a receipt per response into `data/race-desk/timeline.v1.json` (URL, capture time, status, SHA-256, size, row count, returned identity, coverage, code revision).
2. `readTimelineInventory` / `readTimelineContexts` (`scripts/race-desk/timeline-files.mjs`) re-verify every receipt against the bytes and the registry. Any mismatch fails the build. `capture.mjs` and `capture-files.mjs` hold the byte/path checks shared with R-04.
3. `buildTimelineContext` (`scripts/race-desk/timeline.mjs`) is pure. It keeps observations inside the receipted session window, counts what falls outside it, collapses only exact duplicates within one response, and orders by exact microsecond instant. Equal instants keep race-control before pit and source order within a response. Pit rows report time in the pit lane (`lane_duration`) and, separately, stationary time (`stop_duration`); the deprecated `pit_duration` is only a lane-time fallback.
4. `renderTimelineSection` (`scripts/race-desk/timeline-render.mjs`) renders static HTML: counts, a closed native disclosure with the chronological list in Athens time, and the attribution. No runtime JavaScript.

Results and timeline are independent: a race may have results and no timeline. A timeline is `unavailable` (unmapped, uncaptured, or rights unresolved) or available with `full`, `partial` or `empty` coverage of the captured responses. `full` never means the complete history of the race. Raw captures, receipts and the inventory never reach `dist`.

## Status

R-06A adds the contract, provenance, reader, domain model, renderer and synthetic tests. The production inventory is empty and every registry key is null, so no public page changes. R-06B wires the section into the hubs and adds the first reviewed race.

The capture CLI validates a complete batch before writing, stages the response files, writes the inventory last and rolls back on a failed write. A process crash during the final renames can still leave a mixed archive; captures and the inventory are tracked in Git, so restore them with `git checkout -- data/race-desk` and capture again.
