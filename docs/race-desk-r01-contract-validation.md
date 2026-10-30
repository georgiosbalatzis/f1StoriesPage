# R-01 master-brief contract follow-up

Baseline: `ee48967a312a3242a155d950bdd6e560eb8b9b00`, containing the already merged [R-01 #392](https://github.com/georgiosbalatzis/f1StoriesPage/pull/392). Branch: `feat/race-desk-r01-contract`, isolated from the owner's dirty main checkout. The exact follow-up head belongs to its draft PR. [Program status and dependency gates](race-desk-program.md) distinguish the merged foundation, this follow-up and parked R-02 draft #393.

## Contract choices

The master brief requires explicit ambiguous resolution, schedule chronology and a shared typed context. Sol independently approved the narrow design before writes. This change adds exact case-sensitive event-name selectors, optional season disambiguation, and a sorted `ambiguous` result; existing ID/provider selectors still fail closed on corrupt duplicate bindings. Name hints never match venues, display names or fuzzy aliases. Session resolution propagates race ambiguity rather than choosing a candidate based on session data.

Known canonical UTC starts must increase in recorded session-array order, including across null gaps. Missing starts, empty/incomplete session lists and historical sprint ordering remain valid. The new declaration module exports the actual ESM contract, including independent nullable per-driver laps and all resolver result variants. Static types do not replace runtime relationship/range checks or establish sample availability.

No registry schema, IDs, field claims or provider mappings changed. Stored v1 remains v1; the additive selector API and tightened chronology validation are documented in the [context contract](race-desk-context.md). Previously accepted contradictory schedules must be corrected against evidence before adopting this validator.

## Source evidence and deployment distinction

A fresh offline read of the exact source Git objects matched **16 revision/path blobs and 106 normalized field claims**. The source corpus is the one recorded in `registry.v1.json`; TYRES was read from an existing bare object repository holding its pinned commit, not the unrelated local TYRES checkout. JSON-pointer claims were compared directly, with documented session-kind and UTC normalization; Jolpica season/round came from the snapshot's standings table. This establishes source transcription integrity, not independent real-world truth, source authority, session existence, freshness or completeness. All six meeting keys and 30 OpenF1 session keys remain null.

The registry's Bahrain/Sepang association is the explicit recorded local-source event identity, not a guess from venue. The four committed round snapshots explicitly name Japan, Azerbaijan, Bahrain in Malaysia and Singapore. Historical Singapore and future Mexico retain null Jolpica mappings. No external service is needed by unit tests, validation or the public build.

Separate read-only remote diagnostics on 2026-10-30 observed these source heads. Heads are not asserted to be deployed versions:

| Application | Deployment source-lock code SHA | Remote default-branch head observed |
| --- | --- | --- |
| Telemetry | `38c3dd2018b810a5dce1add1f7663bcb199c845a` | `d08fb001eb06f9a4cf2746098b07c69365d53f02` |
| Ghost Car | `4d7a783d9866bce917f61ae6546e48bc0d38b622` | `91483ad74b7a5d0de747e1c8285187a987438580` |
| TYRES | `50e5f50be89e038257cbe3426b366810e0c1f59a` | `50e5f50be89e038257cbe3426b366810e0c1f59a` |
| BetCast | `74eeb98b4acb1b4e0ea45d4ab12f7fdf4e0c2650` | `58202f38c763ea2b4476c9b57d09f042e6805301` |

TYRES code is pinned, while its `data` input follows `main` and `weekend:update` refreshes during aggregate build. Equality at this observation does not guarantee future equality. The lock is unchanged; no production pin transition or aggregate deployment was performed. GitHub content metadata at the pinned revisions independently matched the documented Telemetry filter/link, Ghost Car helper and TYRES URL/schema blob IDs. The original pinned contract inventory remains in the evidence/context documents and the existing R-02 draft.

## Execution and local verification

Requested Terra 6.1 High evidence/test agents both returned usage-limit errors before delivering findings. The lead therefore owned implementation, evidence, fixtures and integration. Sol 6.1 Extra High performed separate read-only architecture and final review; no successful Terra implementation is claimed. No substitute model was silently used. No applicable `AGENTS.md` was found in the checkout or its ancestor paths during reconnaissance.

The clean baseline and proposed builds used Node **22.23.4** and `npm ci` with the unchanged lockfile. Logs and raw manifests use the local `/tmp/r01-contract-` prefix. These are local evidence paths, not public artifacts or remote CI claims.

| Check | Result | Local evidence suffix |
| --- | --- | --- |
| `npm run test:race-desk` | PASS, 18 tests (11 existing, 7 added), 0 skipped | `tests.log` |
| `npm run build:data-contracts` | PASS | `data-contracts.log` |
| `npm run quality:static` | PASS | `static.log` |
| `npm run build:public` | PASS, clean baseline and proposed | `baseline-build.log`, `build-public.log` |
| `npm run build:check` | PASS, generated artifacts synchronized | `build-check.log` |
| `npm run test:build` | PASS, 153 tests | `build-tests.log` |
| `npm run test:standings` | PASS, 21 tests | `standings.log` |
| `npm run test:deployment` | PASS, 62 tests | `deployment.log` |
| Existing R-02 test suite with updated core | PASS, 23 tests; temporary Node import resolver substitutes this core for draft #393's core without changing either branch | `r02-compat.log`, `compat-loader.mjs` |
| Declaration diagnostic | PASS, TypeScript 5.7.3, strict NodeNext/noEmit, positive selections/result narrowing and expected negative type cases | `types.mts`, `typecheck.log` |
| Source integrity cross-check | PASS, 16 blobs / 106 claims | `evidence.json` |
| Raw public artifact comparison | PASS, byte-identical manifests | `artifact-comparison.json`, `baseline-manifest.json`, `final-manifest.json` |

The optional declaration diagnostic uses TypeScript already installed in the sibling Telemetry checkout; no dependency was added and no new compiler gate is claimed in CI. Its exact invocation was `node /Users/giorgos/WebstormProjects/f1-telemetry-dashboard/node_modules/typescript/lib/tsc.js --strict --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 /tmp/r01-contract-types.mts`. Runtime fixtures are automatically included by the existing `test:race-desk` glob and the unconditional Site Quality contract-test step before change classification. `build:data-contracts` already calls the same registry validator, so package/build/workflow edits were unnecessary.

Added fixtures exercise cross-season and same-season name ambiguity, deterministic candidate ordering, exact-name trust boundaries, session ambiguity propagation, retained collision rejection, reversed/equal starts across null gaps, malformed timestamps without coercion, incomplete/all-null schedules, sprint-era independence, identity/session round trips and byte-identical repeated CLI output. Existing tests continue to cover the seed's Suzuka, Bahrain/Sepang, future, sprint/non-sprint and missing-provider cases, synthetic provider scope and independent laps. Synthetic data remains confined to tests.

Full `npm run verify`, Lighthouse, the full browser/visual matrix and a new aggregate build were not rerun locally: this is a build-time contract-only change with exactly unchanged visitor bytes. No new LCP/CLS, interaction, API request-count or performance improvement is claimed. The original R-01 local Lighthouse miss remains historical; neither its old remote pass nor R-02's old CI substitutes for a fresh run on this follow-up. Fresh draft CI must be reported against the new head.

## Public compatibility proof

The sorted path/byte-length/SHA-256 manifests have identical raw bytes: **4,235 files, 313,299,738 bytes**, SHA-256 **`e57163c9c50e31137fd2701d228e1241e9f21d5d55b16e1460f31d9ba8022293`**. There were no added, removed or changed public files and no public paths containing `race-desk`. No normalization was applied. This proof covers the main public artifact, not the aggregate's refreshed data or unobserved production state.

THE GRID and child calculations, URLs, embeddings, article authoring, sitemap, canonical/SEO HTML, design and deployment source pins are untouched. No public application or runtime code is added; dependency and visitor-runtime-byte deltas are zero. The bounded array filter replaces an array search only in the pure build-time resolver; no per-visitor work is introduced.

Exact changed files:

- `scripts/race-desk/core/index.mjs`
- `scripts/race-desk/core/index.d.mts`
- `scripts/race-desk/__tests__/contract.test.mjs`
- `docs/race-desk-context.md`
- `docs/race-desk-program.md`
- `docs/race-desk-r01-contract-validation.md`

## Final review and approval boundary

Sol's separate final verdict: **approve draft creation and stop at owner review; no correctness, security, type, provenance, compatibility or scope blockers**. The reviewer independently reran all 18 focused tests and all 23 existing R-02 compatibility tests on shell Node 26.12.1, supplementing the lead's Node 22.23.4 checks. Independent checks also passed 66 additional malformed-input/ordering probes, an in-memory TypeScript 5.7.3 positive/negative diagnostic, all 16 frozen source blobs and all 106 field claims. The reviewer compared both fresh raw manifests and hashed every current public file against the final manifest, independently confirming 4,235 files / 313,299,738 bytes and the stated manifest hash. The reviewer inspected the Node 22 build/static/regression logs and final program/validation documents. This verdict does not assert fresh remote CI, production state, Lighthouse or a new aggregate build.

This is the R-01 follow-up approval boundary. R-02 #393 is still draft and must be reconciled with the master brief after approval. R-03 through R-09 are not implemented here. No merge, deployment, auto-merge enablement, production-pin update or child-repository change occurred.
