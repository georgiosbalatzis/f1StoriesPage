# R-04 results and championship context — validation

## Dependency and current scope

R-03 is merged. The R-04 candidate integrates the archived adapter and six existing GP hubs on top of main `2fe5679c`; its implementation was tested at integrated commit `ad8086970d552ed6279d34cb4e126b82c6260caa`. Japan, Azerbaijan, Bahrain at Sepang and Singapore 2026 show validated classifications and championship comparisons. The 2025 Singapore and 2026 Mexico hubs show explicit unavailable states. The result sections are pre-rendered and make no runtime provider requests. This is a candidate for review, not a deployment or a claim of final sporting classification.

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

On the integrated candidate, `npm run test:race-desk` passed 138 tests, `npm run test:standings` passed 21 tests, and `npm run test:blog` passed 437 tests with matching goldens. `npm run quality:static`, `npm run build:public` (including public-artifact validation, 4,276 files) and `npm run build:check` passed. The first blog attempt ran concurrently before its generated asset manifest existed and failed; the post-build rerun passed.

The standalone GP hub browser suite passed 64 checks with 48 captures, covering the six pages across viewport sizes and themes; the Race Desk navigation browser smoke also passed. These checks use the local public artifact, not a deployed site. The pinned ecosystem rehearsal and independent integrated review are separate gates; their outcomes are not claimed here. No fresh CI, merge or deployment is claimed.

## No-go claims

No official-final badge, inferred classification from standings deltas, invented session keys, amendment history from one capture, missing-as-zero comparison, race-only points from cumulative differences, or fictional session availability. No new backend, dependency, child code or production pin transition.
