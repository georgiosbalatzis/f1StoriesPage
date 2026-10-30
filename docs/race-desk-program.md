# Race Desk 2.0 approval gates

This record reconciles the 2026-10-30 master brief with the existing repository. The owner subsequently authorized necessary PR merges and automatic production deployments. That permission persists; each milestone still requires its evidence, tests and independent review. Evidence quality cannot be approved into existence.

## Observed baseline

Initial observed main was `ee48967a312a3242a155d950bdd6e560eb8b9b00`. [R-01 PR #392](https://github.com/georgiosbalatzis/f1StoriesPage/pull/392) was already merged on 2026-10-30 at 09:48:46 UTC before this execution. Its original report remains historical, including its local Lighthouse miss. The subsequently authorized follow-up merge is recorded below.

[R-01 follow-up #394](https://github.com/georgiosbalatzis/f1StoriesPage/pull/394) merged as `b462a27746c9e6dac04b8865510b6ae8a4e1044e` after independent review and successful Site Quality / ecosystem rehearsal runs. The normal main-push workflow owns production deployment; no separate release or pin transition was dispatched.

[R-02A #393](https://github.com/georgiosbalatzis/f1StoriesPage/pull/393) is a bounded strict outbound URL builder, now integrated with that R-01 follow-up. Its original head `228daac5e0702667259cf0ad93ada7cb6297dc8c` passed historical Site Quality and ecosystem rehearsal. Fresh integrated-head CI is reported in the PR. The new master brief also requires reverse parsing, loss reports, legacy/hostile URL fixtures, safe generic fallback messaging, navigation/history tests and an integration entry point. Existing green CI does not establish those capabilities. R-02A can merge as an independently useful substep after review; R-02 remains incomplete until those later substeps pass acceptance. Do not start R-03 by copying or bypassing the link contract.

R-02A subsequently merged as `c7140fd284beda526c1c909b7803d416f00dbac9` after fresh Site Quality and ecosystem rehearsal passed at `9e049303c8993375d661f4abbd923cdd891d4e87`. R-01's normal production run also succeeded; a direct public manifest read recorded main `b462a277` with unchanged child code pins. R-02B adds only the pure reverse parser, loss-aware planner, declarations and independent source fixtures. Its final evidence is in [R-02B validation](race-desk-r02b-validation.md). R-02C integration/browser acceptance remains required before R-03 implementation.

Sol's initial independent architecture review identified three R-01 gaps: name ambiguity results, ordered-session chronology and shared type declarations. This follow-up addresses only those foundation gaps. The registry, source mappings, public output, application code and deployment pins remain outside its write scope.

## Dependency and approval order

| Milestone | Prerequisites | Current gate |
| --- | --- | --- |
| R-01 | Existing merged foundation | Contract follow-up #394 merged |
| R-02 | Merged R-01 contract | R-02A #393 merged; R-02B parser/planner under review; R-02C integration remains |
| R-03 | R-01 and R-02 | Not started; no public GP routes generated |
| R-04 | R-01/R-03 and R-02 links where used | Not started |
| R-05 | R-01/R-03 and editorial ownership clearance | Not started; independent of R-04 when files permit |
| R-06 | R-01/R-03, R-04 for results | Not started |
| R-07 | R-01/R-03/R-04 | Not started; may parallel R-06 with disjoint ownership |
| R-08 | Actual evidence from R-04/R-06/R-07 | No GO decision; no predictive feature or backfill authorized |
| R-09 | Implemented scope for final integration | No new gates claimed; fixture research may precede integration |

The owner's merge/deployment authorization is recorded above and need not be requested again for routine reviewed work. Safe stacked work must name its exact base and remain draft until ready. Cross-repository changes require distinct linked PRs. Any production pin transition remains a separately reviewable release step. No child repository or pin change is part of R-02A.

## Initial R-01 agent availability and ownership

Requested models were selectable: Terra 6.1 High for two parallel read-only evidence/test audits and Sol 6.1 Extra High for architecture and a separate final review. Both Terra invocations failed before delivering findings with a usage-limit error. No Terra implementation or successful audit is claimed. The lead took evidence, implementation, fixtures, integration and verification ownership in the isolated `feat/race-desk-r01-contract` worktree; Sol retained independent read-only review. The original checkout's uncommitted changes were preserved.

Terra availability recovered for R-02B. One Terra 6.1 High owner implemented only the parser/planner module and declarations; another independently owned only URL fixtures/tests. Sol 6.1 Extra High retained separate architecture/final review, and the lead owned integration/docs/build evidence. No overlapping writes occurred. This supersedes the initial R-01 availability limitation for the later work; it does not change that historical record.
