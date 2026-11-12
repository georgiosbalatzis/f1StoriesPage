# P-10 — Performance & Codebase Optimization Final Engineering Review

**P-10 VALIDATION COMPLETE — PROGRAM CLOSURE PENDING**

This is an evidence-based validation record, not a declaration that every program gate passed. The bounded P-10 checks below are complete; delta review, browser journeys, human accessibility acceptance and other decisions remain open. P-01–P-09 established a baseline, made targeted accessibility, request-pacing, cache, identity and layout changes, and rejected changes without sufficient evidence. The frozen artifact has verified identity and public-file checks; release readiness remains conditional on the decisions below. No new production deployment or field performance measurement is claimed here; a current closed-proxy laboratory measurement is recorded below.

## Identity and provenance

Frozen Pages run `43131092903`: Main `2cdd77085cb740f5d1cf0fc90803995e2fe4e959`, Telemetry `82def832eec1a703e698511151d047b2941955bb`, Ghost Car `13fc12afb7c73ccbab6e71fc3d3210d922038d51`, TYRES code `249aa796a1981be4f70213c9f1973b4418faf3ca`, TYRES data `dbc69155aaa8e8c2af3556ef02ba18d54ad0ba0c`, data digest `2632578b4f4d073625075f35e039854910765b8d5c3a5ffaa505bdb369faeccd`, generated `2026-11-12T00:59:34.718Z`, BetCast `f039dc657a216b6c23582db3e7eab2f6d3991f81`. Manifest output digest `8e1d89b15c8d43cc392979151d039cb980b95198d70d3b01a80e40e464977f51`; ZIP SHA-256 `01c2f8d035773c8c96d77047601ce59dc9d64518636f75f43d922d31c5e191f1` matched the GitHub digest. These hashes describe different objects. P-08 identity and public checks passed; B-18/B-19 browser behavior remains unverified. Evidence: run `43131092903`, `p10/IDENTITY.md`, `p10/verify-43131092903.json` in the external evidence archive.

P-10 repository base is Main `2cdd77085cb740f5d1cf0fc90803995e2fe4e959`, branch `test/p10-final-regression`; this review and URL checker are uncommitted. No P-10 PR or head SHA exists yet.

## Phase status

| Phase | Classification and scope |
|---|---|
| P-01 | PASS: bounded five-app baseline; field and readiness gaps remain. |
| P-02 | PASS: generated coherence at tested SHA, calendar contrast and rate-safe measurement tooling; stale #462 superseded. |
| P-03 | PASS: attribution and scoped accessibility fixes; no unproven performance gain claimed. |
| P-04 | PASS for authorized Telemetry pacing correctness; literal performance criterion FAIL (gzip +186 B). BetCast real-world LCP improvement NOT MEASURED. |
| P-05 | KNOWN BASELINE LIMITATION: simulated LCP misses; #474 rejected. HTTPS tool #473 BLOCKED pending isolation and review. |
| P-06 | PASS: hygiene investigation; no deletion justified. |
| P-07 | PASS: TYRES restoration observed; end-to-end latency improvement NOT MEASURED. |
| P-08 | PASS: frozen artifact identity and contracts; browser B-18/B-19 NOT VERIFIED; B-14 trust proposal awaits independent review. |
| P-09 | PASS: fixture CLS improvement and deployed bundle identity; human screen-reader acceptance NOT VERIFIED. |
| P-10 | Bounded validation recorded and independently reviewed (two rounds); full integrated browser coverage remains open. Program closure pending. |

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
| test:build, test:incremental | Skipped: build workflow safety / build prerequisite; complete clean, repeated deterministic and generated-drift verification NOT VERIFIED. |
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
| Accessibility | NOT VERIFIED | Scoped fixes and proxy tests pass; human SR, forced colours and Blog heading order open. |
| Responsive/visual behavior | NOT VERIFIED | CI edition/tablet and local fixture checks; full viewport/theme matrix missing. |
| Main performance | READY WITH DISCLOSED LIMITATIONS | Current rate-safe run reproduces the known simulated-LCP misses (Home 2810, Blog 2734, Article 3332 ms; Article perf 92) with the same known simulated-budget failure pattern; no matched before/after regression or improvement established; Standings passes; field data unavailable. |
| Telemetry | READY WITH DISCLOSED LIMITATIONS | Pacing fix merged; provider and full selection journeys unverified. |
| Ghost Car | NOT VERIFIED | Pin and source contract verified, complete current journey not verified. |
| TYRES | READY WITH DISCLOSED LIMITATIONS | Identity and cache hits verified; refresh and data-change production paths not observed. |
| BetCast | READY WITH DISCLOSED LIMITATIONS | Fixture CLS and deployed bundle verified; human SR and current complete journey open. |
| Cross-app navigation | NOT VERIFIED | Source roundtrip passes; B-18/B-19 browser behavior open. |
| Embedded integrations | NOT VERIFIED | Embed dialog fixture passes; complete integration and embed suites skipped. |
| Publishing pipeline | READY WITH DISCLOSED LIMITATIONS | CI and build pass; current repeated deterministic/incremental checks and matched latency open. |
| Cache reliability | READY WITH DISCLOSED LIMITATIONS | Two production hits recorded; freshness and integrity controls retained; more paths require observation. |
| Analytics and consent | READY WITH DISCLOSED LIMITATIONS | Security and CI consent/RUM regressions pass; comprehensive current browser verification open. |
| Security | BLOCKED | #473 containment proof and independent security review outstanding; B-14 is an unapproved proposal. This does not establish a deployed security defect. |
| Artifact provenance | READY | Frozen source/data identities and ZIP digest verified for run `43131092903`; no fresh live assertion. |
| CI and rollback | READY WITH DISCLOSED LIMITATIONS | Supplied quality/release steps passed; P-10 delta review and complete integrated gates outstanding. Roll back P-10 by reverting its eventual commit; production rollback uses prior verified Pages artifact and pins under owner control. |

#473 blocks its own merge and phase closure, not this draft. Program closure requires execution or formal disposition of outstanding mandatory acceptance. Matched P-07 latency is optional follow-up measurement. No evidence here establishes a broken URL, exposed credential or incorrect frozen pin. Simulated LCP misses, incomplete field data and incomplete responsive coverage are disclosed limitations; they are not evidence of a reader-facing slowdown.

## Quantified results and engineering decisions

- Accessibility: P-03 Standings recorded three light Lighthouse scores of 100 and audio browser checks; no comparable current score or full accessibility acceptance is established (`p10/ACCEPTANCE-MATRIX.md`).
- Telemetry chart readiness: current comparable before/after NOT MEASURED in the supplied acceptance record. P-04 reduced superseded queued requests while retaining pacing and retry; its predeclared performance verdict failed on 186 B additional gzip, despite the accepted correctness trade.
- TYRES: historical 0/66 eligible cache hits; production hits observed in runs `43085879000` and `43123524652`. A stale release cache correctly missed. A hit job took 107 s versus prior median 230 s, but samples and queue delays are not comparable. Merge-to-live 434 s versus prior median 306 s is similarly confounded; end-to-end saving is UNMEASURED. Modelled 94–101 s per eligible hit is not observed saving (`p07r/TYRES-VALIDATION.md`, `CHECKPOINT.md`).
- BetCast: paired fixture mobile CLS 0.121 → 0.041; run `43123524652` served the measured bundle. This is a fixture result plus bundle identity, not a production field CLS measurement (`CHECKPOINT.md`).
- Main: `git diff --stat a26fbac5a 2cdd77085 -- '*.css' '*.js' '*.html' styles scripts/perf 'scripts/shared-nav*'` shows 54 HTML/test files, including generated homepage hero and preload changes; no runtime CSS/JS source change was identified. HTML and image changes can affect performance, so P-10 remeasured: a closed-proxy `perf:lighthouse:rate-safe` run on the frozen live artifact (3 attempts per route, all valid) gives simulated LCP Home 2810, Blog 2734, Article 3332 ms (Article performance 92), Standings within budget — same known simulated-budget failure pattern; no matched before/after regression or improvement established. P-05 observed loopback LCP 74–118 ms; simulated Home 2883/3505, Blog 2734/3184, Article 2957/3558 ms against 2500 ms. Simulation and observed paint are distinct; field LCP/CLS/INP NOT MEASURED (`p05/CONCLUSION.md`).
- Hygiene: P-06 found no safe deletion; gross duplicates are not realised savings. URL preservation adds deployment fixtures for input validation, resolution, containment and report destinations.

The program improved reproducible artifact identity and cross-app contract checks, rate-safe closed-proxy Lighthouse tooling, queue pacing, scoped accessibility, TYRES cache restoration, evidence retention and release validation. Deterministic build controls exist, but a fresh repeated P-10 build is not established by these records.

Rejected: speculative media deletion would risk historical URLs and dynamic usage; font/preload ideas lacked demonstrated benefit; the BetCast intro replacement candidate increased CLS; navigation deferral #474 exceeded its Blog TBT guardrail; broad build sharing lacked measured benefit; permission increases lacked security authorization. Preserve controls and review evidence before revisiting any proposal.

## Residual risk and maintenance

1. High: #473 remains draft until OS-enforced isolated testing, forced-termination lifecycle, owner acceptance and independent security review; never run its live harness on the owner's account (`p05/473-SECURITY-HANDOFF.md`).
2. High: obtain a delta review of this change and complete or formally disposition missing integrated browser/consent/security and generated-build gates before closure.
3. Medium: conduct P-09 human screen-reader checks for loading, success, failure and recovery; review B-14 separately with threat fixtures.
4. Medium: measure matched publication latency and observe TYRES scheduled refresh/data-change misses; retain six-hour freshness and SHA/digest controls.
5. Medium: obtain representative field metrics if available without changing consent; investigate Blog heading order and complete responsive, forced-colours and cross-app browser checks.

Keep CI budgets and failure gates unchanged. Verify pins and artifact digests on each release, run cross-app contracts on pin changes, sample accessibility and responsive journeys periodically, monitor TYRES freshness and matched publishing timings, and retain reports and prior verified artifacts for rollback. Escalate production regressions with the affected run, source identities and reproducible evidence.

## Owner checkpoint

Independent review: external `p10/sol-review.md` (REQUIRED CHANGES R1–R5, addressed) and delta `p10/sol-review-r2.md` (R1/R2 closed; stale comparison-status text corrected in this revision).

Delta review: <to be added>

Draft PR: <to be added>

Exact committed head: pending creation.

| Item | Mandatory vs optional | Current state | Evidence location | Owner action |
|---|---|---|---|---|
| #473 isolation/security | Mandatory for #473 merge/phase closure | Blocked; does not block this draft | `p05/473-SECURITY-HANDOFF.md` | Require isolation, lifecycle proof and independent security review before its merge. |
| P-09 human screen-reader check | Mandatory acceptance or formal disposition | Not verified | `p09/sol-review-r5.md` | Arrange human loading, success, failure and recovery checks or formally disposition. |
| P-07 matched end-to-end latency and remaining cache paths | Matched latency optional measurement; required cache acceptance needs disposition | Unmeasured latency; refresh/data-change paths unobserved | `p07r/TYRES-VALIDATION.md`, `CHECKPOINT.md` | Decide measurement and disposition remaining paths. |
| B-14 review | Mandatory proposal review before adoption | Pending | `p10/sol-review.md`, P-08 evidence | Commission independent threat-fixture review or reject/defer proposal. |
| Complete integration/child journeys, embeds/audio/full visual QA | Mandatory acceptance or formal disposition | Smoke passed its assertions; full journeys not verified | `p10/data/release-43131092903-build.log`, `p10/run-suites.out.txt` | Execute missing suites or formally disposition each gap. |
| Responsive, forced-colours and Blog heading order | Mandatory acceptance or formal disposition | Incomplete | `p10/ACCEPTANCE-MATRIX.md` | Complete checks or formally disposition gaps. |
| Clean repeated deterministic build, generated drift and incremental checks | Mandatory acceptance or formal disposition | Not verified | `p10/run-suites.out.txt` | Run clean repeated checks or formally disposition. |

No deployment, pin change or closure is authorized by this report.
