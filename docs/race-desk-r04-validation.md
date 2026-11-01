# R-04 results and championship context — draft contract

## Dependency and current scope

This isolated branch starts from R-03 `7b0ca4fa4b0641665e9a0d39b8e71c375f60158d` (draft #400). R-02C is merged as `f78ff614`. R-03 acceptance remains required before public hub integration. This commit stages independently useful pure adapters, source archives and numerical fixtures; it does not complete R-04 or publish a result section.

Sol approved the bounded contract after independently checking the actual source responses and all Japanese GP reference calculations. Three Terra 6.1 High owners held disjoint archive/docs, pure domain, and independent test surfaces. Lead owns shared integration; Sol 6.1 Extra High remains the independent reviewer.

## Source contract

`results.v1.json` binds four explicitly mapped races to 12 exact raw Jolpica captures (race, qualifying, sprint) and six existing championship snapshots. The archive includes three provider-empty sprint responses: emptiness is not proof of a non-sprint weekend. Nine nonempty sets each contain all 22 provider-reported entries. See [source evidence](race-desk-r04-evidence.md) for exact URLs, capture times, bytes, hashes, mappings and gaps.

The source is Jolpica, not an independently authenticated FIA-final classification. Capture time is not amendment time, effective time or race/session start. Final response URL was not recorded and remains null. Qualifying/sprint responses repeat the GP race date/time descriptor; the adapter does not use that as qualifying/sprint timing or infer OpenF1 keys. Existing reviewed registry schedule evidence remains separate.

Championship snapshots retain their own capture/generation timestamps, exact file revision and hashes. Both wrapper source URLs and embedded provider URLs remain visible in the source contract; their discrepancy in later snapshots is not concealed. Future changes to archived bytes or existing snapshots require reviewed manifest updates. There is no automatic live fallback or build network read.

## Pure APIs and arithmetic

`scripts/race-desk/results.mjs` exports:

- `adaptJolpicaClassification({ race, sessionKind, capture, raw })`: validates source bytes, provenance, endpoint, exact mapped race/circuit identity, pagination, unique driver identities and session-specific row shape.
- `adaptChampionshipSnapshot({ season, round, capture, raw })`: validates both driver and constructor tables, outer/nested identity, source URLs, generation timestamp, nonempty complete pagination, unique stable IDs, points and ranks.
- `compareChampionshipSnapshots({ before, after })`: requires consecutive same-season validated snapshots, joins stable IDs, preserves after-table order then before-only entries, and retains source rows.

Results discriminate `available`, `unavailable` and `invalid`. Missing/unmapped/uncaptured/provider-empty inputs remain explicit. Invalid expected archive input must fail integration rather than masquerade as an unavailable source. No filesystem, network, current clock or input mutation occurs in these pure functions.

Points use exact decimal strings and integer-coefficient arithmetic; computed zero has no negative sign. Missing participant or baseline means null change, never zero. Rank movement is before rank minus after rank only when both ranks exist. Actual round-one Stroll is unranked despite having known points: source index is not a rank. Equal points and tied ranks preserve the provider's order. Constructor changes use constructor totals directly. Sprint points are never added again to cumulative championship differences. Negative changes describe the difference between captures without inventing a penalty narrative.

Race/sprint status and position text are preserved without DNF/DSQ inference. Missing optional times stay null. Grid/laps accept nullable unsigned integer source strings, including zero. Qualifying Q2/Q3 gaps stay null and no points/status are manufactured.

## Actual verification and independent review

The final pure-domain suite passed 14/14 test groups on Node 22.23.4. Groups include all 22 Japan driver and 11 constructor expected rows, all four mapped pairs, all 12 captured sessions, source order/ties, decimal arithmetic, missing entities/ranks, constructors independent of current driver teams, source digest/identity/pagination tampering, empty snapshots, forged empty comparison inputs, zero/malformed grid/laps, invalid calendar timestamps, purity and determinism.

Sol independently validated all archive bytes/receipts and existing snapshot pins, reproduced all Japanese preflight rows with decimal arithmetic, and checked 205 extra decimal cases against Python Decimal. Two negative-probe findings (empty available standings and malformed grid/laps) were fixed and independently retested. The fresh final review supersedes its earlier pre-fix verdict: no remaining source blockers for a pure draft commit.

Reviewed SHA-256 values: domain `847d5be6fce75e1bb458e2c4c3e263b8205d2bb634155720cdacd3577b3c2ac4`; tests `c68fd82117d08ec89b4426279eeb6d4110636d65270049bdda8a2db63768004e`; manifest `8db4eb4808f99864ffa255ada5d507646e6ee92e8a039787210894380b72e604`.

No R-04 public integration, assembled browser test, artifact leak build, fresh CI, merge or deployment is claimed. Remaining work is the limited hub section with source labels/unavailable states, static/mobile/theme/accessibility QA, preservation of existing Grid calculations and article embeds, full applicable build/test gates and Sol final integration review.

## No-go claims

No official-final badge, inferred classification from standings deltas, invented session keys, amendment history from one capture, missing-as-zero comparison, race-only points from cumulative differences, or fictional session availability. No new backend, dependency, child code or production pin transition.
