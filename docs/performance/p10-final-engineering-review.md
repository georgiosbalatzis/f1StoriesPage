# P-10 — Performance & Codebase Optimization Final Engineering Review

**PERFORMANCE & CODEBASE OPTIMIZATION 2.0 — ENGINEERING PROGRAM CLOSED WITH DISCLOSED RESIDUAL RISKS**

Classification applied by the owner's final disposition (2026-11-12) on merge of PR #482, conditional on the closure conditions recorded below: two clean deterministic builds, generated drift and incremental checks, bounded final smoke and the B-14 security review passed as recorded; green CI and a clean-build re-run on the exact final head, and the closing independent delta review, are recorded on PR #482 before merge. Before that disposition this record read "P-10 VALIDATION COMPLETE — PROGRAM CLOSURE PENDING". This is an evidence-based record, not a declaration that every program gate passed, and it is not an accessibility sign-off. Residual items are disclosed, formally dispositioned by the owner and tracked in [issue #483](https://github.com/georgiosbalatzis/f1StoriesPage/issues/483) and the per-item issues listed below. Full browser journeys and human accessibility acceptance remain unverified. P-01–P-09 established a baseline, made targeted accessibility, request-pacing, cache, identity and layout changes, and rejected changes without sufficient evidence. The frozen artifact has verified identity and public-file checks; release readiness remains conditional on the decisions below. No new production deployment or field performance measurement is claimed here; a current closed-proxy laboratory measurement is recorded below.

## Identity and provenance

Frozen Pages run `43131092903`: Main `2cdd77085cb740f5d1cf0fc90803995e2fe4e959`, Telemetry `82def832eec1a703e698511151d047b2941955bb`, Ghost Car `13fc12afb7c73ccbab6e71fc3d3210d922038d51`, TYRES code `249aa796a1981be4f70213c9f1973b4418faf3ca`, TYRES data `dbc69155aaa8e8c2af3556ef02ba18d54ad0ba0c`, data digest `2632578b4f4d073625075f35e039854910765b8d5c3a5ffaa505bdb369faeccd`, generated `2026-11-12T00:59:34.718Z`, BetCast `f039dc657a216b6c23582db3e7eab2f6d3991f81`. Manifest output digest `8e1d89b15c8d43cc392979151d039cb980b95198d70d3b01a80e40e464977f51`; ZIP SHA-256 `01c2f8d035773c8c96d77047601ce59dc9d64518636f75f43d922d31c5e191f1` matched the GitHub digest. These hashes describe different objects. P-08 identity and public checks passed; B-18/B-19 browser behavior remains unverified. Evidence: run `43131092903`, `p10/IDENTITY.md`, `p10/verify-43131092903.json` in the external evidence archive.

P-10 repository base is Main `2cdd77085cb740f5d1cf0fc90803995e2fe4e959`. Review, URL checker and tests are contained in [PR #482](https://github.com/georgiosbalatzis/f1StoriesPage/pull/482), initially reviewed at head `1605c228bd90b9b77616df13a4e7674a7cf677fa`. The PR acquired subsequent documentation-only commits (owner closure dispositions, then closure acceptance results); the final merge SHA is recorded by GitHub, not inferred in this report.

## Phase status

| Phase | Classification and scope |
|---|---|
| P-01 | PASS: bounded five-app baseline; field and readiness gaps remain. |
| P-02 | PASS: generated coherence at tested SHA, calendar contrast and rate-safe measurement tooling; stale #462 superseded. |
| P-03 | PASS: attribution and scoped accessibility fixes; no unproven performance gain claimed. |
| P-04 | PASS for authorized Telemetry pacing correctness; literal performance criterion FAIL (gzip +186 B). BetCast real-world LCP improvement NOT MEASURED. |
| P-05 | KNOWN BASELINE LIMITATION: simulated LCP misses; #474 rejected. HTTPS tool #473 closed without merge (2026-11-12) and excluded from the release; isolated-VM verification tracked in [#484](https://github.com/georgiosbalatzis/f1StoriesPage/issues/484). |
| P-06 | PASS: hygiene investigation; no deletion justified. |
| P-07 | PASS: TYRES restoration observed; end-to-end latency improvement NOT MEASURED. |
| P-08 | PASS: frozen artifact identity and contracts; browser B-18/B-19 NOT VERIFIED. B-14 independently reviewed (Sol High, threat fixtures): no deployed defect established in the tested cases, informational; deferred hardening in [f1-telemetry-dashboard#28](https://github.com/georgiosbalatzis/f1-telemetry-dashboard/issues/28). |
| P-09 | PASS: fixture CLS improvement and deployed bundle identity; human screen-reader acceptance NOT VERIFIED. |
| P-10 | PASS with disclosed residual risk: bounded validation, closure checks (deterministic builds, drift, incremental, final smoke 55/55, B-14 review) and independent reviews complete; exhaustive browser coverage accepted as incomplete ([#489](https://github.com/georgiosbalatzis/f1StoriesPage/issues/489)). |

Detailed phase provenance and PR identifiers: external evidence `p10/ACCEPTANCE-MATRIX.md` and `CHECKPOINT.md`.

## Regression matrix

The local campaign used the frozen aggregate for artifact checks and source fixtures for source tests; a later Main-only `build:public` supplied generated inputs. A passing CI step demonstrates that step ran, not every possible journey. Details: external evidence `p10/run-suites.out.txt`, `p10/rerun-built.out.txt`, `p10/logs/`, `p10/data/ci-quality-43128837419-steps.tsv`, `p10/data/ci-release-43131092903-steps.tsv`.

| Suite or group | Evidence and result |
|---|---|
| research, taxonomy, collections, briefings, intelligence, dashboard, standings, race-desk, security, gateways, newsletter, deployment | Local PASS. Deployment after URL test: 89 tests PASS, 0 fail, 0 skipped (Node 22, corrected checker). |
| blog, journeys, entities, author | Initial environment failures from missing generated inputs; all PASS after `build:public`. CI `43128837419`: Build public artifact; Run blog module tests; Run author research notebook browser tests / Run author module tests. |
| check:assets, perf:budget, perf:images, RUM browser | Initial missing-build environment failures; all PASS after build. CI: Verify asset size budgets and Run consent and RUM regressions. |
| quality:static, check:tokens, audit:runtime, perf:article-media, qa:media | Local PASS; static/source checks and frozen artifact audit have distinct scopes. |
| P-08 identity and public, consumer roundtrip | Local PASS; identity also verified against live artifact record in run `43131092903`; browser B-18/B-19 not established. |
| Race Desk browser and hubs, embed dialog, dashboard browser, author images | Local PASS under fixture/interception conditions in runbook; not full live journeys. |
| test:integration | SKIP-UNCONTROLLED locally. Release run `43131092903` executed `test:integration` against the canonical `dist` artifact in FULL_RELEASE: Smoke test canonical artifact succeeded (270 s); Race Desk navigation succeeded (62 s); Grand Prix pilot pages succeeded (312 s). Nested action evidence: external `p10/data/release-43131092903-build.log`, lines 1826–2045. Smoke covers only its own assertions; complete child journeys remain NOT VERIFIED. |
| qa:visual | SKIP-UNCONTROLLED locally; CI `43128837419` Run visual focus capture regression passed; full visual suite equivalence not established. Blog heading-order baseline remains open. |
| qa:embeds, qa:audio-player | SKIP-UNCONTROLLED; no matching CI step established. NOT VERIFIED. |
| qa:edition | SKIP-UNCONTROLLED; CI Browser regressions: Run Edition discovery regression PASS. |
| qa:countdown | SKIP-UNCONTROLLED; CI Module suites: Run countdown schedule tests and Public artifact: Verify next-race countdown PASS; full browser equivalence not established. |
| test:consent | SKIP-UNCONTROLLED; CI Module suites: Run consent and RUM regressions PASS. |
| perf:cls-tablet | SKIP-UNCONTROLLED; CI Browser regressions: Run tablet CLS regression (both themes, edition font swap) and Module suites: Run tablet CLS guard tests PASS. |
| perf:lighthouse | Live-provider runner SKIP-UNCONTROLLED. Current closed-proxy `perf:lighthouse:rate-safe` on the frozen live artifact (fixture manifest, fail-closed requests, 3 attempts × 4 routes): 12/12 valid; Home LCP 2810 ms, Blog 2734 ms, Article perf 92 / LCP 3332 ms fail the unchanged budgets; Standings passes. Same pattern as P-05 → KNOWN BASELINE LIMITATION (simulated). |
| test:build, test:incremental | Initial P-10 campaign: skipped (build workflow safety / build prerequisite). Superseded at closure: two clean builds, `build:check` generated drift, `check:assets` and `test:incremental` PASS at `1605c228b` (see "Owner closure disposition"). The separate `test:build` suite was not executed. |
| baseline and budget update scripts | Intentionally skipped: would alter protected baselines or thresholds. |
| CI release | Run `43131092903` build-pages step PASS; frozen artifact identity separately verified. |
| URL preservation | Corrected checker (`scripts/deployment/url-preservation.mjs`) on the real artifacts: 514 → 516 URLs, 0 removed, 0 unresolved, +2 = the articles published 2026-11-11 (`p10/url-preservation-r2.json`; independently replayed in `p10/sol-review-r2.md`). Inputs: previous P-04 deployed aggregate, Pages run `42891877849`, artifact `13802175395`, Main `7f4e0549c`; current Pages run `43131092903`, Main `2cdd77085`, ZIP SHA-256 `01c2f8d035773c8c96d77047601ce59dc9d64518636f75f43d922d31c5e191f1`. External `p10/sol-review.md` and `CHECKPOINT.md` record provenance. This covers sitemap/file resolution, not all historical links or semantics. |

Browser coverage is partial: targeted local fixture runs and CI steps above do not establish a complete 390/768/1440 light/dark/system matrix across all apps. No current human screen-reader or forced-colours acceptance is claimed.

The rate-safe run used `throttlingMethod: simulate`, 12/12 valid attempts, in a closed-proxy loopback lab, not field conditions. Evidence: external `p10/reports/lighthouse-rate-safe/aggregate/{home,blog,article,standings}-{1,2,3}.json`, `results.json` and `p10/logs/lighthouse-rate-safe.log`.

| Route | Simulated LCP median (ms) | Range (ms) | Gate outcome |
|---|---:|---:|---|
| Home | 2810 | 2808–3581 | LCP fail |
| Blog | 2734 | 2734–2734 | LCP fail |
| Article | 3332 | 2732–3332 | LCP fail; median performance 92 |
| Standings | 902 | 901–902 | Pass |

Example from the repository root (the report parent must already exist):

```sh
node scripts/deployment/url-preservation.mjs --previous ../previous/site --current ../current/site --report ../reports/url-preservation.json
```

## Release-readiness decision matrix

READY WITH DISCLOSED LIMITATIONS means bounded evidence exists, not that every listed journey is verified. BLOCKED identifies a concrete unresolved dependency; NOT VERIFIED indicates insufficient coverage.

| Area | Decision | Basis / outstanding |
|---|---|---|
| Main editorial website | READY WITH DISCLOSED LIMITATIONS | Source and editorial suites pass; full integrated journeys unverified. |
| Historical article integrity | READY WITH DISCLOSED LIMITATIONS | Corrected sitemap/file comparison: 0 of 514 earlier URLs removed or unresolved; content and all links not exhaustively checked. |
| SEO and metadata | READY WITH DISCLOSED LIMITATIONS | Public artifact and CI media/domain checks pass; complete browser and external redirect audit unverified. |
| Accessibility | READY WITH DISCLOSED LIMITATIONS | Scoped fixes and proxy tests pass; rendered heading order 0 skips (Blog index, Home; 390/768/1440). Open: human screen reader ([BetCastVisualisation#8](https://github.com/georgiosbalatzis/BetCastVisualisation/issues/8)), original Blog heading-order finding not reproduced but not closed ([#486](https://github.com/georgiosbalatzis/f1StoriesPage/issues/486)), forced colours. |
| Responsive/visual behavior | READY WITH DISCLOSED LIMITATIONS | Final smoke: Home, Blog, article, Standings, BetCast × 390/768/1440 × light/dark/system — no horizontal overflow, mobile menu, theme persistence against each app's DOM contract. Full visual QA residual ([#489](https://github.com/georgiosbalatzis/f1StoriesPage/issues/489)). |
| Main performance | READY WITH DISCLOSED LIMITATIONS | Current rate-safe run reproduces the known simulated-LCP misses (Home 2810, Blog 2734, Article 3332 ms; Article perf 92) with the same known simulated-budget failure pattern; no matched before/after regression or improvement established; Standings passes; field data unavailable. |
| Telemetry | READY WITH DISCLOSED LIMITATIONS | Pacing fix merged; provider and full selection journeys unverified. |
| Ghost Car | READY WITH DISCLOSED LIMITATIONS | Pin and source contract verified; final smoke verified navigation, direct load and reload of `/ghostcar/`; complete data journey not verified ([#489](https://github.com/georgiosbalatzis/f1StoriesPage/issues/489)). |
| TYRES | READY WITH DISCLOSED LIMITATIONS | Identity and cache hits verified; refresh and data-change production paths not observed. |
| BetCast | READY WITH DISCLOSED LIMITATIONS | Fixture CLS and deployed bundle verified; human SR and current complete journey open. |
| Cross-app navigation | READY WITH DISCLOSED LIMITATIONS | Final smoke: aggregate navigation to all five apps and back, direct load/reload, Grand Prix hub generated deep links into child tools; source round-trip passes. Standings' race-specific TYRES link needs live schedule data (falls back to `/tyres/`, observed). |
| Embedded integrations | READY WITH DISCLOSED LIMITATIONS | Final smoke: embedded BetCast article loads data, posts a correctly sourced `betcast:resize` that the parent applies, child shows a light theme under a light parent and light OS scheme (parent-theme propagation against an opposite OS scheme is not asserted here; it was shown in the P-09 trusted-origin replay). Full embed/audio suites residual ([#489](https://github.com/georgiosbalatzis/f1StoriesPage/issues/489)). |
| Publishing pipeline | READY WITH DISCLOSED LIMITATIONS | CI and build pass; two clean builds byte-identical, generated-drift guard synchronized, incremental check passes; matched end-to-end latency unmeasured ([#485](https://github.com/georgiosbalatzis/f1StoriesPage/issues/485)). |
| Cache reliability | READY WITH DISCLOSED LIMITATIONS | Two production hits recorded; freshness and integrity controls retained; more paths require observation. |
| Analytics and consent | READY WITH DISCLOSED LIMITATIONS | Security and CI consent/RUM regressions pass; comprehensive current browser verification open. |
| Security | READY WITH DISCLOSED LIMITATIONS | B-14: no deployed defect established (Sol High, deterministic threat fixtures; informational; deferred hardening [f1-telemetry-dashboard#28](https://github.com/georgiosbalatzis/f1-telemetry-dashboard/issues/28)). #473 closed without merge, excluded ([#484](https://github.com/georgiosbalatzis/f1StoriesPage/issues/484)). Security policy suites pass. Production HTTP framing headers unmeasured. |
| Artifact provenance | READY | Frozen source/data identities and ZIP digest verified for run `43131092903`; no fresh live assertion. |
| CI and rollback | READY WITH DISCLOSED LIMITATIONS | Quality and release steps passed on the earlier PR #482 heads (`1605c228b`, `79f391312`); final-head CI is recorded on PR #482 before merge. Roll back P-10 by reverting its eventual commit; production rollback uses prior verified Pages artifact and pins under owner control. |

#473 was closed without merge, excluding the unverified HTTPS mode from Main. Every outstanding item is formally dispositioned by the owner and tracked in a GitHub issue with owner, severity, evidence and follow-up trigger (umbrella [#483](https://github.com/georgiosbalatzis/f1StoriesPage/issues/483)). Matched P-07 latency is follow-up measurement. No evidence here establishes a broken URL, exposed credential or incorrect frozen pin. Simulated LCP misses, incomplete field data and incomplete responsive coverage are disclosed limitations; they are not evidence of a reader-facing slowdown.

## Quantified results and engineering decisions

- Accessibility: P-03 Standings recorded three light Lighthouse scores of 100 and audio browser checks; no comparable current score or full accessibility acceptance is established (`p10/ACCEPTANCE-MATRIX.md`).
- Telemetry chart readiness: current comparable before/after NOT MEASURED in the supplied acceptance record. P-04 reduced superseded queued requests while retaining pacing and retry; its predeclared performance verdict failed on 186 B additional gzip, despite the accepted correctness trade.
- TYRES: historical 0/66 eligible cache hits; production hits observed in runs `43085879000` and `43123524652`. A stale release cache correctly missed. A hit job took 107 s versus prior median 230 s, but samples and queue delays are not comparable. Merge-to-live 434 s versus prior median 306 s is similarly confounded; end-to-end saving is UNMEASURED. Modelled 94–101 s per eligible hit is not observed saving (`p07r/TYRES-VALIDATION.md`, `CHECKPOINT.md`).
- BetCast: paired fixture mobile CLS 0.121 → 0.041; run `43123524652` served the measured bundle. This is a fixture result plus bundle identity, not a production field CLS measurement (`CHECKPOINT.md`).
- Main: `git diff --stat a26fbac5a 2cdd77085 -- '*.css' '*.js' '*.html' styles scripts/perf 'scripts/shared-nav*'` shows 54 HTML/test files, including generated homepage hero and preload changes; no runtime CSS/JS source change was identified. HTML and image changes can affect performance, so P-10 remeasured: a closed-proxy `perf:lighthouse:rate-safe` run on the frozen live artifact (3 attempts per route, all valid) gives simulated LCP Home 2810, Blog 2734, Article 3332 ms (Article performance 92), Standings within budget — same known simulated-budget failure pattern; no matched before/after regression or improvement established. P-05 observed loopback LCP 74–118 ms; simulated Home 2883/3505, Blog 2734/3184, Article 2957/3558 ms against 2500 ms. Simulation and observed paint are distinct; field LCP/CLS/INP NOT MEASURED (`p05/CONCLUSION.md`).
- Hygiene: P-06 found no safe deletion; gross duplicates are not realised savings. URL preservation adds deployment fixtures for input validation, resolution, containment and report destinations.

The program improved reproducible artifact identity and cross-app contract checks, rate-safe closed-proxy Lighthouse tooling, queue pacing, scoped accessibility, TYRES cache restoration, evidence retention and release validation. Two fresh clean builds of the reviewed head produced byte-identical `dist` trees.

Rejected: speculative media deletion would risk historical URLs and dynamic usage; font/preload ideas lacked demonstrated benefit; the BetCast intro replacement candidate increased CLS; navigation deferral #474 exceeded its Blog TBT guardrail; broad build sharing lacked measured benefit; permission increases lacked security authorization. Preserve controls and review evidence before revisiting any proposal.

## Residual risk and maintenance

Ranked residual risks (all tracked; umbrella [#483](https://github.com/georgiosbalatzis/f1StoriesPage/issues/483)):

| Rank | Item | Severity | Issue | Follow-up trigger |
|---|---|---|---|---|
| 1 | Human screen-reader acceptance of BetCast loading/error/Retry | Medium | [BetCastVisualisation#8](https://github.com/georgiosbalatzis/BetCastVisualisation/issues/8) | Within 30 days or before the next BetCast loading/error UI change |
| 2 | #473 HTTPS runner isolated-VM containment proof (closed, excluded) | Medium | [#484](https://github.com/georgiosbalatzis/f1StoriesPage/issues/484) | Before #473 is reopened or its results inform a release |
| 3 | Blog heading-order finding (not reproduced, not closed) | Low–medium | [#486](https://github.com/georgiosbalatzis/f1StoriesPage/issues/486) | Next Blog index template change or 30 days |
| 4 | P-07 matched end-to-end publication latency; TYRES refresh/data-change paths | Low | [#485](https://github.com/georgiosbalatzis/f1StoriesPage/issues/485) | After the next five normal article publications |
| 5 | Lighthouse simulated-LCP budget failures (budgets unchanged) | Low | [#487](https://github.com/georgiosbalatzis/f1StoriesPage/issues/487) | Field data available or budget review |
| 6 | Field Core Web Vitals not measured | Low | [#488](https://github.com/georgiosbalatzis/f1StoriesPage/issues/488) | When a field data source is approved |
| 7 | Exhaustive browser coverage (full visual/embeds/audio/countdown with complete fixtures) | Low | [#489](https://github.com/georgiosbalatzis/f1StoriesPage/issues/489) | Next change to embeds, audio player or visual QA tooling |
| 8 | B-14 Telemetry embed-origin hardening (no deployed defect) | Informational | [f1-telemetry-dashboard#28](https://github.com/georgiosbalatzis/f1-telemetry-dashboard/issues/28) | Before restricting Telemetry embedding or changing its message protocol |

Keep CI budgets and failure gates unchanged. Verify pins and artifact digests on each release, run cross-app contracts on pin changes, sample accessibility and responsive journeys periodically, monitor TYRES freshness and matched publishing timings, and retain reports and prior verified artifacts for rollback. Escalate production regressions with the affected run, source identities and reproducible evidence.

## Owner closure disposition

Independent review: external `p10/sol-review.md` (REQUIRED CHANGES R1–R5, addressed) and delta `p10/sol-review-r2.md` (R1/R2 closed). After the owner's final disposition, two further independent reviews occurred: the B-14 security review (Sol High, `p10/closure/B14-REVIEW.md`) and a Sol Medium delta review of the closure edits (external `p10/closure/sol-review-closure.md`: REQUIRED CHANGES R1–R4, addressed in this revision; the follow-up verdict is recorded on PR #482). No other review is implied.

Pull request: [#482](https://github.com/georgiosbalatzis/f1StoriesPage/pull/482). Initial reviewed PR head: `1605c228bd90b9b77616df13a4e7674a7cf677fa`; subsequent documentation edits and the final merge SHA are recorded on GitHub.

Closure acceptance conditions (owner, 2026-11-12). Builds ran at PR head `1605c228bd90b9b77616df13a4e7674a7cf677fa`; every later PR commit changes only this report (`git diff 1605c228b <final head> --stat`), and a re-run on the exact final head is recorded on PR #482. Smoke and security checks ran against the live artifact of Pages run `43131092903` (PR #482 changes no runtime code). Evidence: external archive `p10/closure/`.

| Condition | Result |
|---|---|
| Two clean deterministic builds | PASS — two fresh clones of the reviewed head, `npm run build:public` (79 s / 80 s), sorted SHA-256 manifests of `dist` identical. |
| Generated drift | PASS — `npm run build:check` (`scripts/build/generated-drift-guard.mjs`): generated artifacts synchronized. |
| Incremental checks | PASS — `npm run check:assets`; `npm run test:incremental` passed at HEAD (0 changed pages). |
| Bounded final smoke | PASS 55/55 — aggregate navigation to `/telemetry/`, `/ghostcar/`, `/tyres/`, `/betcast/`, Race Desk and back; Grand Prix hub generated deep links into child tools; embedded BetCast article (loaded data, correctly sourced resize applied by the parent, light child theme under a light parent and OS scheme); shared audio play/pause on `/`, `/authors/`, `/standings/` (synthetic feed and silent WAV; live podcast playback not tested); Home, Blog, article, Standings, BetCast × 390/768/1440 × light/dark/system (system = light OS preference, then an explicit toggle) with no horizontal overflow, mobile menu and theme persistence checked against each app's DOM theme contract. Requests: the `f1-stories.gr` origin was fulfilled locally from the artifact; exact frozen Sheets URLs and the synthetic RSS/WAV were served; all remaining requests were aborted. Standings' race-specific TYRES link falls back to `/tyres/` without live schedule data (observed, expected). |
| B-14 security review | NO DEPLOYED DEFECT ESTABLISHED, severity informational — independent Sol High review of Telemetry pin `82def832e` and the deployed bundle, with deterministic threat fixtures (hostile parent with normal, attribute-suppressed and header-suppressed referrer, invalid-theme-first; legitimate control; opaque sandbox unsupported). In the supported tested cases a hostile framer received only public `{type, height}` resize replies and could change its own embed's light/dark appearance and same-document theme URL parameter; no sensitive disclosure, XSS, storage/cookie change, navigation or attack-induced network request was observed (30 baseline OpenF1 requests were attempted and blocked by the harness). Not established: opaque-sandbox cases (app did not mount), production HTTP framing headers, other browsers. Deferred hardening: [f1-telemetry-dashboard#28](https://github.com/georgiosbalatzis/f1-telemetry-dashboard/issues/28). |
| CI on the reviewed head | Required green before merge (Site Quality and Ecosystem dry run). |

| Item | Mandatory vs optional | Current state | Evidence location | Owner action |
|---|---|---|---|---|
| #473 isolation/security | Mandatory for any future #473 merge | Closed WITHOUT merge; no HTTPS mode deployed | `p05/473-SECURITY-HANDOFF.md`; [#484](https://github.com/georgiosbalatzis/f1StoriesPage/issues/484) | Reopen only if necessary after isolated-VM containment and independent security review. |
| P-09 human screen-reader check | Formally deferred by owner | NOT VERIFIED | `p09/sol-review-r5.md`; [BetCastVisualisation#8](https://github.com/georgiosbalatzis/BetCastVisualisation/issues/8) | Conduct human loading, success, failure and recovery checks. |
| P-07 matched end-to-end latency and remaining cache paths | Formally deferred by owner | UNMEASURED latency; refresh/data-change paths unobserved | `p07r/TYRES-VALIDATION.md`; [#485](https://github.com/georgiosbalatzis/f1StoriesPage/issues/485) | Measure only on normal publishing runs, preserve permissions. |
| B-14 review | Completed | No deployed defect established (informational); hardening deferred, no security change adopted | `p10/closure/B14-REVIEW.md`; [f1-telemetry-dashboard#28](https://github.com/georgiosbalatzis/f1-telemetry-dashboard/issues/28) | Review again before restricting Telemetry embedding or changing its message protocol. |
| Complete integration/child journeys, embeds/audio/full visual QA | Formally deferred by owner | Bounded final smoke 55/55 PASS; exhaustive suites NOT VERIFIED | `p10/closure/final-smoke.json`; [#489](https://github.com/georgiosbalatzis/f1StoriesPage/issues/489) | No claim of full integration equivalence; give remaining suites complete fixtures. |
| Responsive, forced-colours and Blog heading order | Formally deferred by owner | Responsive/theme smoke PASS; Blog heading-order not reproduced (rendered 0 skips, 390/768/1440), not closed; forced colours NOT VERIFIED | `p10/closure/heading-order.txt`; heading order [#486](https://github.com/georgiosbalatzis/f1StoriesPage/issues/486), forced colours [#489](https://github.com/georgiosbalatzis/f1StoriesPage/issues/489) | Fix a real markup problem only after reproduction with `qa:visual` conditions. |
| Clean repeated deterministic build, generated drift and incremental checks | Completed | PASS (see table above) | `p10/closure/build-check.out.txt` | None. |
| Lighthouse simulated-LCP failures / field Core Web Vitals | Disclosed | Simulated failures remain; budgets unchanged; field data NOT MEASURED | [#487](https://github.com/georgiosbalatzis/f1StoriesPage/issues/487), [#488](https://github.com/georgiosbalatzis/f1StoriesPage/issues/488) | Revisit with field data. |

Owner explicitly approved finishing the program and dispositioning these residual checks. This report alone does not authorize any unrelated production change or child pin update. Normal Pages deployment follows the PR #482 merge.
