# R-02C navigation integration

Base: `3608327e824b22b5d0e24436f7c2a8a948e0d476`, containing merged R-01 #394, R-02A #393 and R-02B #395, plus the owner's latest article and scheduled snapshots. Branch: `feat/race-desk-r02-navigation`, in an isolated worktree. The original checkout's unrelated changes were preserved. The owner authorized reviewed PR merges and automatic production deployment; evidence gates remain binding.

## User behavior and source boundary

THE GRID retains its existing four product links and visual hierarchy. A small Greek description below them explains which selection transfers. After an accepted Jolpica table renders, its own season/round selects a precomputed plan. A verified race opens the corresponding TYRES weekend. Telemetry and Ghost Car remain generic because no real OpenF1 meeting/session binding exists in the registry. Analytical tabs and unknown rounds explicitly use generic app links. These notices make no feed-availability, forecast-verification, participation or result claim.

Driver and constructor scopes come from their respective rendered `StandingsLists[0]` records, not shared header placeholders, pending URL parameters or a module's unresolved selection. Successful unchanged-data paths also publish accepted scope. OpenF1 table replacement clears it; a failed live refresh retains an old scope only when its old snapshot remains displayed. Existing standings calculations and data fetches are unchanged.

The main shell publishes only two `[season, round]` tuples and its native local `YEAR` into a small private replay bridge. The optional navigation entry loads after the existing standings promise resolves, skips initial embeds, and catches its own import/update errors without changing the original data error path. A fast snapshot cannot outrun subscription. The optional module observes the native selected tab's `aria-selected` state; no new history or click interception is introduced. Modified clicks and keyboard links remain ordinary anchors.

The compact projection is generated from the registry and `planToolLink`, with generic roots from the validated source lock. It contains no full evidence registry or guessed provider mapping. `buildYear` is an explicit UTC build input, not source freshness; a mismatched native browser year stays generic. `enabled: false` makes the controller leave original legacy links and notices untouched, preserving Main-only/rollback mode. No actual deployment flag or child pin was changed.

## Build and deterministic checks

Generation runs at the start of `build:assets`, before icon discovery bundles the standings graph. Direct minify/watch also ensures the projection; identical bytes do not rewrite it. Registry/source-lock edits trigger the existing watch loop. The generated ESM path is covered by drift checking, and `build:data-contracts` compares it with the expected registry/source-lock/build-year projection. Raw registry, Node helpers, fixtures and QA bundles remain outside the public artifact.

The new optional entry obeys the existing 34 KiB entry and 190 KiB combined lazy caps. The 48 KiB shell, 68 KiB initial graph and 12 KiB shared-chunk caps are unchanged. Two boundary/+1 regression fixtures ensure the optional entry cannot evade the old caps. No baseline or threshold was relaxed.

Three Terra 6.1 High owners worked on disjoint projection, controller and independent browser-fixture surfaces. The lead serialized main-shell, HTML/CSS, package, build, workflow, budget and documentation edits. Sol 6.1 Extra High approved architecture and separately reviewed the source and evidence. The initial eager implementation failed the fixed budgets; it was replaced with a genuinely deferred entry and shared native round parser, not a tiny entry shim hiding a large startup chunk.

## Local verification

Lead checks use Node 22.23.4 and the unchanged dependency lock. Independent Sol checks use Node 26.12.1 where stated. Logs use `/tmp/r02c-`; browser evidence is local `.build/race-desk-r02c-*`. Remote CI must be linked against the new exact head before merge.

| Check | Result before PR creation |
| --- | --- |
| `test:race-desk` | PASS, 65 tests including projection, loaded scope, disabled mode and replay bridge |
| `test:standings` | PASS, 21 tests |
| `test:deployment` | PASS, 62 tests |
| `test:build` | PASS, 153 tests before the final optional-entry budget enumeration change; later rerun is reported in the PR |
| `test:security` | PASS, 33 tests |
| Size-budget regression fixtures | PASS, 9 tests, including exact boundary and +1 failures |
| `quality:static`, `build:data-contracts` | PASS; final clean repeat is reported in the PR |
| `build:public` / public artifact validation | PASS; final optional entry and shared chunk included |
| `perf:budget` | PASS with every existing threshold unchanged |
| Deferred enabled browser matrix | PASS, 13 groups, zero page/CSP errors, 16 paired captures |
| Disabled browser fixture | PASS, preserved native links/notices through data, tabs, history and reload |
| Full local `verify` / clean `build:check` | Not yet run at report preparation; must be reported as actually executed, not inferred |
| Actual assembled child routes | Pending exact-head ecosystem CI; local Main-only dist is not evidence of child runtime selection |

The disabled browser run used an isolated copy with a disabled projection and matching fixture lock. It is explicitly a derived QA fixture, not an actual disabled production release or a byte-identical rollback. It changed neither the candidate artifact nor the production source lock.

The actual assembled gate requires both Japanese and Bahrain/Sepang TYRES paths to return 200 and select the expected native year/race ID, title and venue. It runs against the real assembled directory in Ecosystem rehearsal and before Pages upload. Site Quality runs the Main-only browser checks and uploads diagnostic reports. Provider reads are mocked in browser tests; the existing live diagnostic remains separate.

## Measurements and visual evidence

Conditions: local static HTTP server, Chrome via the existing launcher/Playwright, explicit synthetic standings shaped like committed snapshots, one driver/constructor, fixed provider responses, widths 390/576/768/1440, light/dark, paired 4.2-second observation windows. These are fixture measurements, not production field telemetry or real classifications.

| Measurement | Baseline | Proposed |
| --- | ---: | ---: |
| Decoded HTML + JavaScript observed per paired sample | 307,316 B | 312,912 B |
| Local requests | 20 | 22 |
| Provider requests | 5 | 5 |
| Other third-party requests | 1 | 1 |
| Shell JavaScript | 49,097 B | 47,686 B |
| Complete initial static JavaScript graph | 69,100 B | 69,594 B |
| Optional navigation entry | absent | 4,157 B, one later request |

The increase is 5,596 decoded HTML/JS bytes and two local asset requests, with no added provider request in these matched observations. The initial graph has only **38 bytes** of headroom under its unchanged 69,632-byte cap. All startup-owner chunks are counted; the largest shared chunk remains 11,105 bytes. Combined lazy assets, including the named entry, total 184,177 bytes under the unchanged 194,560-byte cap. Single load/CLS observations varied; no speed, LCP or CLS improvement is claimed.

The final paired report is `.build/race-desk-r02c-deferred/browser-smoke.json`. Before/after captures are `baseline-{width}-{theme}.png` and `candidate-{width}-{theme}.png` in that directory. An early history harness incorrectly assumed tab clicks pushed history; it was corrected to seed genuine history entries without changing native replace-state behavior. The original failed report remains historical and is not a pass.

An independent 768px check found a real message-wrap shift. Reserving two desktop lines fixed it: Japanese → Bahrain → Japanese kept the title at 197px and notice height at 36px in both themes. Mobile reserves three lines. The lead and fixture owner inspected the sampled headers; no overlap or horizontal clipping was observed. Existing fonts, themes and focus styling remain authoritative.

The one mechanical design scan exited 2 with warnings against incumbent styles; it is not represented as a pass or as a whole-page accessibility certification. A separate computed-color check of the new notice passed AA text contrast: light 4.937:1 and dark 7.995:1. Keyboard descriptions, ordinary anchors and polite live updates are covered by the browser fixture. Same-document OpenF1 replacement has no current public UI trigger; source hook review and a reload/fallback case cover the reachable behavior without adding production test hooks.

## Public compatibility

Fresh sorted path/length/SHA-256 manifests compare the same editorial baseline: **4,245 files / 314,529,656 B** before and **4,247 files / 314,535,501 B** after, a 5,845-byte artifact increase. Two assets are added: the small shared bridge/round-parser chunk and optional navigation entry. Modified visitor files are standings HTML, its editorial CSS and entry, plus same-length compiled aliases in qualifying/lap-one entries. Their source calculations are unchanged. No artifact file was removed. Raw manifests and exact changes are in `/tmp/r02c-baseline-manifest.json`, `/tmp/r02c-final-manifest.json`, and `/tmp/r02c-artifact-comparison.json`.

No raw Race Desk source, test fixture or QA bundle leaked into the artifact. No public page route, article URL, sitemap/canonical metadata, authoring flow, consent setting, CSP rule, child app source or production pin changed. Existing aggregate old-link/embed smoke remains a separate required gate, in addition to this new component smoke. No new backend, framework, package, tracking service or per-reader provider fetch was introduced.

## Review and release gate

Sol's final source review found no remaining blocker for conditional draft creation after the budget and mode-aware test fixes. Independent checks include all 65 focused tests, nine budget tests, unchanged performance caps, eight wrapper probes, visual/geometry evidence and the actual startup graph. Final release approval remains conditional on final evidence review, clean repeat checks and successful fresh exact-head Site Quality plus actual assembled TYRES/legacy/embed acceptance. Nothing in this report asserts that pending CI passed or that this C change has already merged/deployed.

After those gates pass, existing owner authorization permits merge and its normal automatic deployment. Only then may R-02 be marked complete for its stated verified/available scope and R-03 implementation begin. Real OpenF1 mappings remain unavailable and must never be inferred to fill this coverage gap.

## Changed source files

- `.github/actions/build-pages/action.yml`
- `.github/workflows/aggregate-dry-run.yml`
- `.github/workflows/quality.yml`
- `.gitignore`
- `docs/race-desk-program.md`
- `docs/race-desk-r02c-validation.md`
- `docs/race-desk-url-context.md`
- `package.json`
- `scripts/build/generated-drift-guard.mjs`
- `scripts/build/minify.mjs`
- `scripts/build/public-artifact.mjs`
- `scripts/build/race-desk-links.mjs`
- `scripts/build/validate-data-contracts.mjs`
- `scripts/perf/__tests__/size-budget.test.mjs`
- `scripts/perf/size-guard.mjs`
- `scripts/race-desk/__tests__/bridge.test.mjs`
- `scripts/race-desk/__tests__/fixtures/browser-standings.v1.json`
- `scripts/race-desk/__tests__/nav.test.mjs`
- `scripts/race-desk/__tests__/projection.test.mjs`
- `scripts/race-desk/browser-smoke.mjs`
- `scripts/race-desk/projection.mjs`
- `standings/core/race-desk-bridge.js`
- `standings/core/race-desk-links.generated.js`
- `standings/core/race-desk-nav.js`
- `standings/index.html`
- `standings/race-desk-navigation.js`
- `standings/standings-editorial.css`
- `standings/standings.js`
