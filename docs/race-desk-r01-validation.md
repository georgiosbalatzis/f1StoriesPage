# R-01 implementation and validation record

Base: `9f676e1f9a7d1be71691a78164af2f559befffca` (`origin/main` at execution).
Branch: `feat/race-desk-r01`, in an isolated worktree so the owner's unrelated working changes remain intact.
The PR head is the commit containing this report; obtain its exact SHA from the draft PR.

## Contract and coverage

See [the v1 contract and compact architecture decisions](race-desk-context.md) for the exact schema, resolver signatures, failure semantics, aliases and migration policy. See [the evidence inventory](race-desk-evidence.md) and each registry source's revision-pinned URL for coverage and field-level references.

The reviewed sample contains six events, 30 documented scheduled sessions, and 16 pinned source files. All six OpenF1 meeting bindings and all 30 session bindings remain null. Jolpica is verified for 2026 Japan (3), Azerbaijan (15), Bahrain (16), and Singapore (17); historical 2025 Singapore and future 2026 Mexico remain unresolved for that provider. TYRES IDs/slugs are recorded for all six. Unknown optional bindings are reported without failing validation. Synthetic fixtures alone exercise verified OpenF1 identities and selected driver/lap scope.

An independent transcription check matched all 16 source revision/path Git blob IDs and 106 normalized field claims against frozen source bytes. The four Jolpica event labels were also inspected; Bahrain is explicitly labeled `Bahrain Grand Prix in Malaysia`. The TYRES dynamic data input was observed at the same revision as its code pin, but the registry freezes that observation rather than assuming future equality.

## Delegation and review

Sol 6.1 Extra High performed read-only architecture reconnaissance, approved the contract before implementation, and independently reviewed the final implementation. Three Terra 6.1 High roles handled evidence/data, pure core/tests, and CLI/build/CI/docs in exclusive file areas. The root agent integrated the changes and performed independent source and artifact checks. No model substitution was required.

Review found and fixed inherited-property alias lookup, malformed claim-field coercion, malformed-season coercion, URL-array coercion, and the CLI's accidental lexical reordering of session coverage. Regression tests cover the core defects. The reviewer independently ran all 11 focused tests and CLI on Node 22 and exercised 259 malformed JSON mutations with no unexpected throws. Sol's final review approved draft-PR creation with no implementation, evidence, or scope blockers, acknowledging the exact unrelated Lighthouse result below.

## Verification

Commands use Node `v22.23.4`, matching the CI major. Dependencies were installed from the existing lockfile with `npm ci`; no dependency or lockfile changes were made. Logs and raw manifests are retained locally in `/tmp/f1-race-desk-r01/`.

| Command / check | Result | Local evidence |
| --- | --- | --- |
| `npm run test:race-desk` | PASS, 11 tests | `test-race-desk.log` |
| `npm run validate:race-desk` | PASS, six events / 30 sessions; gaps listed | `validate-race-desk.log` |
| `npm run build:data-contracts` | PASS | `build-data-contracts.log` |
| `npm run test:build` | PASS, 153 tests | `test-build.log` |
| `npm run test:standings` | PASS, 21 tests | `test-standings.log` |
| `npm run test:deployment` | PASS, 62 tests | `test-deployment.log` |
| `npm run build:public` | PASS, baseline and modified builds | `baseline-node22-build-public.log`, `verify.log` |
| `npm run quality:static` | PASS, also rerun after final core fixes | `quality-static.log`, `verify.log` |
| `npm run build:check` | PASS, generated artifacts synchronized | `build-check.log` |
| `npm run verify` | FAIL at Blog Lighthouse LCP: 2565.698 ms > 2500 ms | `verify.log` |
| `npm run perf:cls-tablet` | PASS separately, both tablet sizes/themes; max cold CLS 0.004, font-swap CLS 0.000 | `cls-tablet.log` |
| CLI malformed JSON / `null` | PASS, isolated checks exit 1 | `cli-negative.log` |
| Source revision/blob/field cross-check | PASS, 16 blobs / 106 claims | `evidence-crosscheck.log` |
| Public artifact comparison | PASS, raw byte identity | `artifact-comparison.json` and both manifests |

The focused tests are network-free and cover direct and missing mappings, duplicate identity/provider keys, contradictory/missing provenance, malformed dates/zones/inputs, relocation, round changes, cross-season identity, sprint distinctions, session scope, driver-number reuse, four-driver limit, independent lap selections, context round trips, and ordering. CLI validation and core lookups use the same validator. Site Quality runs the focused tests unconditionally before change classification; build validation also checks the registry for all build paths.

Before stopping at Lighthouse, `verify` passed the public build, generated-file drift check, static/runtime guards, 436 blog tests and golden snapshots, 473 Edition checks (including legacy URLs and canonical behavior), author/standings/security tests, media and size budgets, consent checks, and all 72 visual captures. Home, standings and article Lighthouse budgets passed; the blog LCP miss is reported rather than hidden or fixed outside R-01. The measured public bytes exactly match the baseline, so this does not indicate an R-01 public-site regression. A separate baseline Lighthouse run was not performed, and this report makes no claim about a reproduced baseline timing failure.

Remote Site Quality and aggregate rehearsal results belong to the draft PR's checks and linked Actions runs; no remote result is asserted by this pre-PR local report. The aggregate workflow's path filter does not automatically include R-01, so a rehearsal can be dispatched explicitly against the feature branch. No production verification or deployment was performed.

## Public boundary and cost

The before/after sorted relative-path/byte-length/SHA-256 manifests match exactly: **4,235 files, 313,299,738 bytes**. Both raw manifest files have SHA-256 `2ff77fb0599760bf5002a2da4c3d77fa51e80bbd76bf2932898b1eb16db9d730`. No timestamp normalization was needed. There are no added, removed, or changed public files and no public `race-desk` paths. The Node 26 baseline also matched the Node 22 baseline, though the reported checks use Node 22.

The diff changes no deployment source pins, Pages settings, child repository files, routes, canonical metadata, article embeddings, UI, CSS, or existing algorithms. The measured main-site public artifact is unchanged; this does not assert byte identity for the five-application aggregate with its dynamic build-time inputs. No new dependencies or visitor runtime bytes are added; core validation cost is build/test only. The pure core imports no filesystem, process, network, browser storage, or runtime framework.

R-02 link adapters/navigation, a full calendar, live provider discovery, driver participation/lap availability validation, data lifecycle states, and R-08 remain deferred. Nothing is merged, deployed, or enabled for auto-merge. **DO NOT MERGE: owner review is required.**

Changed files are limited to:

- `data/race-desk/registry.v1.json`
- `scripts/race-desk/core/index.mjs`
- `scripts/race-desk/__tests__/registry.test.mjs`
- `scripts/race-desk/validate.mjs`
- `scripts/build/validate-data-contracts.mjs`
- `package.json`
- `.github/workflows/quality.yml`
- `docs/data-contracts.md`
- `docs/race-desk-context.md`
- `docs/race-desk-evidence.md`
- `docs/race-desk-r01-validation.md`
