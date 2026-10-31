# R-02B validation record

Base: `c7140fd284beda526c1c909b7803d416f00dbac9`, containing merged R-02A #393 and R-01 follow-up #394. Branch: `feat/race-desk-r02-context`, isolated from the owner's dirty original checkout. Work began as an explicitly stacked branch at `9e049303c8993375d661f4abbd923cdd891d4e87`; after #393 merged it fast-forwarded to the main merge commit, whose tree is identical. No contract was copied to bypass a prerequisite.

On 2026-10-31, main advanced to `50c5e8021eb6b9d8a0611ae0a8caad543806fcf4` through an unrelated published article and scheduled snapshot updates. That main revision was merged without conflicts, preserving all incoming content. Registry, parser/planner, source pins, application code and workflow inputs were unchanged; a fresh Node 22.23.4 focused run again passed all 50 tests. The artifact sizes and manifests below describe the original isolated baseline comparison, not a fresh comparison of the later editorial data. CI for the integrated head is recorded separately in PR #395.

## Scope and design

[URL context and planning](race-desk-url-context.md) documents exact APIs, capability matrix, source semantics, trust boundaries, migration and remaining R-02C acceptance. This substep adds pure `parseToolUrl` and `planToolLink` APIs with explicit `preserved`, `dropped`, `unresolved` and `ambiguous` reports. It keeps `buildToolLink` unchanged. Unknown selections produce notices and fixed generic app destinations; differing Ghost Car laps never become a fabricated shared Telemetry lap.

This is a source-only contract PR. No public UI or runtime integration, native parser change, provider lookup, registry edit, source pin transition, dependency or public page is added. The complete R-02 milestone remains incomplete until the existing-interface integration and assembled browser/history acceptance pass in R-02C.

## Ownership and independent review

Sol 6.1 Extra High approved the architecture before implementation, then separately reviewed code, types, source parity and evidence. Terra 6.1 High availability had recovered: one implementation owner wrote only `core/navigation.mjs` / `.d.mts`; a separate fixture owner wrote only `__tests__/navigation.test.mjs` and its source inventory JSON. The lead owned docs, integration, build/CI evidence and final checks. There were no overlapping writes or package/build/workflow/schema edits.

The review process found and fixed native numeric-grammar mismatch, inherited-option fact bypass, omitted legacy origins, malformed encoded presentation data, TYRES ID aliases and ambiguity, inferred legacy driver counts, dashboard/publication scope confusion, and incomplete loss reports. Regression fixtures cover the confirmed defects. Synthetic OpenF1 identifiers and collision cases remain test-only.

Sol independently reran all **50 focused tests** on Node 26.12.1, passed **166 supplemental checks** (87 conversion-matrix, 53 hostile/encoding and 26 post-fix native/option/alias probes), and ran a no-emission TypeScript 5.7.3 positive/negative diagnostic. The separate final verdict is **approve PR creation and merge after successful fresh exact-head CI**, with no implementation, security, type, provenance or artifact blockers. The reviewer compared both raw manifests byte-for-byte and verified all 4,235 current public files against every recorded hash/size, independently confirming the stated totals and manifest hash. The reviewer also verified the identical base trees, seven-file scope and final documents. R-02C remains required before full R-02 completion.

## Local verification

Lead checks use Node **22.23.4**, `npm ci`, the unchanged lockfile and the `/tmp/r02b-` evidence prefix. Tests are deterministic and network-free. External reads below are separately reported diagnostics, never unit-test prerequisites.

| Check | Result | Local evidence suffix |
| --- | --- | --- |
| `npm run test:race-desk` | PASS, 50 tests, 0 skipped (30 prior, 20 navigation) | `tests.log` |
| `npm run build:data-contracts` | PASS | `contracts.log` |
| `npm run quality:static` | PASS | `static.log` |
| `npm run build:public` | PASS, clean baseline and proposed | `baseline-build-public.log`, `build-public.log` |
| `npm run build:check` | PASS, generated artifacts synchronized | `build-check.log` |
| `npm run test:build` | PASS, 153 tests | `build-tests.log` |
| `npm run test:standings` | PASS, 21 tests | `standings.log` |
| `npm run test:deployment` | PASS, 62 tests | `deployment.log` |
| TypeScript 5.7.3 strict NodeNext/noEmit diagnostic | PASS; discriminated parse results and exact/partial/generic notice types, positive/negative cases | `types.mts`, `typecheck.log` |
| Raw artifact comparison | PASS, byte-identical fresh manifests | `artifact-comparison.json`, `baseline-manifest.json`, `final-manifest.json` |

The declaration diagnostic uses the already installed sibling Telemetry compiler; no TypeScript dependency or compiler CI gate was introduced. The existing unconditional Site Quality `test:race-desk` glob includes the new tests. Fresh remote results belong to this PR's exact head; previous R-02A and R-01 green runs are not claimed as this PR's checks.

Full local `npm run verify`, Lighthouse and a new aggregate browser rehearsal were not rerun for this unshipped module: every visitor file is byte-identical, no new runtime is present, and the preceding integrated R-02A ecosystem rehearsal passed. R-02C must test the actual assembled bundle, navigation and visual control before claiming full R-02 completion. No new interaction, LCP/CLS or request-count measurement is claimed here.

## Source and compatibility evidence

The fixture inventory records full pinned revisions and paths for Telemetry filters/links/publication contract, Ghost Car helpers/figure/comparison selection, TYRES URL/schema/selection and main Grid round/report readers. Event identity is still determined from explicit registry source keys; names, countries and venue slugs are never inferred into OpenF1 identities. TYRES' explicit `id` / `year-key` aliases reproduce reviewed native lookup semantics and return ambiguity on cross-domain collisions rather than choosing a first record.

Real coverage remains six reviewed events, six TYRES mappings and four Jolpica round bindings. All real OpenF1 meeting/session bindings remain null. A parsed context or built URL does not certify route availability, driver participation, lap existence or feed freshness. Circuit-fact verification remains a caller's manual source-review boundary.

The fresh before/after sorted relative-path/byte-length/SHA-256 manifests have identical raw bytes: **4,235 files / 313,299,738 bytes**, manifest SHA-256 **`e57163c9c50e31137fd2701d228e1241e9f21d5d55b16e1460f31d9ba8022293`**. No timestamp normalization was used. No public paths containing `race-desk` were emitted. This is the main artifact proof, not an assertion about aggregate refreshed data or production cache state.

THE GRID calculations, child apps, editorial authoring, article routes/embeds, sitemap, canonical/SEO HTML, themes and source pins are unchanged. Dependency and visitor-runtime-byte deltas are zero. All parser/planner work is currently build/test-only and has no per-reader API cost.

Exact changed files:

- `scripts/race-desk/core/navigation.mjs`
- `scripts/race-desk/core/navigation.d.mts`
- `scripts/race-desk/__tests__/navigation.test.mjs`
- `scripts/race-desk/__tests__/fixtures/tool-urls.v1.json`
- `docs/race-desk-url-context.md`
- `docs/race-desk-r02b-validation.md`
- `docs/race-desk-program.md`

## Authorization and next gate

The owner explicitly authorized reviewed PR merges and normal automatic production deployment. R-01 #394 and R-02A #393 have merged; their exact CI and deployment states are separate from this proposed PR. This substep has not yet merged or deployed at preparation of this report. No child pin transition occurred. After independent final approval and fresh CI, the lead may merge it under the existing authorization, then continue R-02C without repeating routine permission requests. Evidence requirements and R-08's scientific GO/NO-GO gate remain binding.
