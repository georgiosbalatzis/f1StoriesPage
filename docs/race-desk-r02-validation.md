# R-02 validation record

PR 392 was merged by the owner. R-02 starts from `ee48967a312a3242a155d950bdd6e560eb8b9b00` on branch `feat/race-desk-r02` in a separate worktree; the owner's original checkout remains untouched. The PR head is the commit containing this report.

No separate R-02 brief was found in the repository, Downloads, or GitHub issues. Following the owner's request to continue, this step implements the next capability named by R-01: safe cross-tool link adapters. It adds a pure builder and its tests and documentation. It does not invent requirements for subsequent roadmap items.

## Contract and real coverage

The complete API, source contracts and architecture decisions are in [Race Desk link adapters](race-desk-links.md). `buildToolLink(registry, input, target, options)` returns a resolved canonical URL, a missing mapping, or an unsupported conversion. Missing and unsupported results contain no URL. Invalid registries, source facts, contexts and options throw the existing typed error.

| Target | Real registry coverage | Safety condition |
| --- | --- | --- |
| TYRES | Six exact season/slug routes | Race-only context; verified TYRES ID and slug |
| THE GRID | Four exact historical round links | Existing embed view, with `embed=1`; race-only context |
| Ghost Car | All six missing | No verified OpenF1 meetings/sessions in the real registry |
| Telemetry | All six missing | Also requires an independently reviewed matching circuit short-name fact |

The six TYRES routes include Bahrain at `/tyres/2026/sepang/`, and historical/current Singapore remain separate by season. Grid resolves Japan 2026 round 3, Azerbaijan 15, Bahrain 16, and Singapore 17. Historical Singapore and future Mexico retain unresolved Jolpica mappings. Existing destination defaults are guarded against: ordinary Grid pages ignore round pins, TYRES can fall back to latest, Ghost Car can fill slots or choose fastest laps, and Telemetry can choose another circuit/session. The adapter does not silently invoke those defaults to manufacture a requested selection.

Positive OpenF1 tests use a separate, explicitly synthetic source record. No synthetic IDs or circuit facts were added to the real registry. URL construction validates reviewed identity and selected scope; it does not establish route availability, driver participation or lap availability. The optional Telemetry circuit fact uses R-01's manual-source-review trust boundary; structural validation alone does not prove its contents.

## Delegation and review

Sol 6.1 Extra High approved the architecture before implementation and independently reviewed the final code, evidence, tests and artifact proof. Terra 6.1 High roles implemented the adapter/tests and researched/documented pinned source contracts with exclusive file ownership. The root agent handled integration, additional acceptance checks and build/artifact verification. No model substitution was required.

Review confirmed the Grid embed requirement, Telemetry's exact ASCII circuit-name contract and single-lap limit, Ghost Car's independent lap slots, and strict option/fact validation. One documentation correction distinguished stored `sourceKeys.jolpica: {season, round}` from resolver selector `jolpicaRound`. The reviewer independently ran the focused suite and 64 malformed options/fact probes; all failed closed as intended, with no outstanding implementation blockers.

## Local verification

The following checks used Node `v22.23.4` and the existing dependency lockfile. Logs, link-coverage output and both raw artifact manifests are in `/tmp/f1-race-desk-r02/`.

| Command / check | Result | Evidence |
| --- | --- | --- |
| `npm run test:race-desk` | PASS, 23 tests: 11 R-01 and 12 adapter tests | `test-race-desk.log` |
| `npm run validate:race-desk` | PASS; unchanged six events / 30 scheduled sessions | `validate-race-desk.log` |
| `npm run build:data-contracts` | PASS | `build-data-contracts.log` |
| `npm run test:build` | PASS, 153 tests | `test-build.log` |
| `npm run test:standings` | PASS, 21 tests | `test-standings.log` |
| `npm run test:deployment` | PASS, 62 tests | `test-deployment.log` |
| `npm run quality:static` | PASS | `quality-static.log` |
| `npm run build:public` | PASS before and after | `baseline-build-public.log`, `build-public.log` |
| `npm run build:check` | PASS, no generated drift | `build-check.log` |
| Real seed link coverage | Six TYRES / four Grid / zero OpenF1 links | `link-coverage.json` |
| Artifact manifest comparison | PASS, byte-identical | `artifact-comparison.json`, `baseline-manifest.json`, `final-manifest.json` |

Focused tests cover exact canonical URLs and reviewed source pins, real-seed relocation/year scoping, the actual Grid pin reader, all four targets using synthetic provider facts where required, unsupported driver/lap conversions, missing/wrong session scope, fact contradictions, malformed inputs, destination year/round bounds, deterministic ordering, and input immutability. The existing unconditional Site Quality test glob automatically includes these tests; no package or CI configuration change was needed.

Full `npm run verify`, its full visual matrix and Lighthouse measurements were not rerun in R-02: the adapter is source-only, relevant tests/build/static checks ran, and every visitor file is byte-identical to the baseline. The local R-01 Lighthouse budget miss remains a historical result in its own report; it is not represented as a fresh R-02 run or as a pass. Fresh Site Quality and aggregate rehearsal results belong to the new draft PR's linked Actions runs and are not asserted by this pre-PR local report. Production verification was not performed.

## Boundary and artifact evidence

Both sorted relative-path/byte-length/SHA-256 manifests have identical raw bytes and SHA-256 `2ff77fb0599760bf5002a2da4c3d77fa51e80bbd76bf2932898b1eb16db9d730`: **4,235 files / 313,299,738 bytes**, with no added, removed or changed public files. No normalization was necessary and no `race-desk` source paths appear in the artifact. This proof covers the main artifact, not the aggregate's dynamic build-time inputs.

Dependency and visitor-runtime-byte deltas are zero. The R-01 core/registry/schema, deployment source lock, package files, public builder, application parsers, UI, URLs/canonicals, embeddings and existing calculations are unchanged. The TYRES dynamic data ref was independently observed still at its reviewed `50e5f50be89e038257cbe3426b366810e0c1f59a` revision during this run.

Only these files are added:

- `scripts/race-desk/core/links.mjs`
- `scripts/race-desk/__tests__/links.test.mjs`
- `docs/race-desk-links.md`
- `docs/race-desk-r02-validation.md`

Public navigation wiring, new pages, runtime discovery of provider IDs, a full-calendar mapping, historical driver identities and later roadmap items remain outside this change. This step neither merges nor deploys changes.
