# P-07 publication latency — 2026-11-11

## Scope & method

Offline Actions, job/step logs, PR and Pages deployment exports cover 2026-09-01..2026-11-11 UTC; stage timings supply aggregate internals. Seconds are elapsed unless stated. Medians use sorted index floor(p*n). Evidence is identified by run ID below; workflow routing is in `.github/workflows/auto-publish-author-pr.yml:1` and `.github/workflows/deploy-pages.yml:1`.

Quality branch/time matching does not prove the final PR head; merge-job interval and Pages deployment matches are temporal candidates, not proof of trigger or checkout SHA. End-to-end results are conditional on both links. Deploy-job created→started is not the workflow-level `pages` concurrency wait: that queue is **UNMEASURED**.

## BEFORE — measured

Article PRs since 2026-11-04, seven matched candidates; medians are per-stage, so do not sum them. Quality is the last matching run; job durations are started→completed. Aggregate is a log group; TYRES and main are separately timed components, not additive medians.

| Stage | Median seconds (n=7) | Evidence / interpretation |
| --- | ---: | --- |
| Quality | 176 | Last matching Quality; e.g. 42999801849 |
| Merge job | 14 | Publish Article candidate, e.g. 43000284577 |
| `publish_blog` | 54 | Processor and stamp, before deploy build |
| Deploy build | 230 | Includes aggregate and release checks |
| Aggregate build | 157.7 | TYRES miss 103.702; main 50.339, stage-timing medians |
| Deploy job | 9 | Pages candidate success follows; job queue is not workflow queue |
| Merge → candidate live | 306 | Seven candidates |
| PR created → candidate live | 501 | Seven candidates |

2026-10-27..11-03 candidates were slower: 832–1144 s merge→live (nine runs); 41714560498 took 1144 s, versus 304 s for 41915343500 on November 4. The latter two aggregate groups were 213.8 and 155.5 s, while build jobs were 867 and 224 s. The improvement is observed; its cause is **UNMEASURED** given missing older logs and unmatched modes.

Full-release candidate created→live medians: main push 885 s (n=113), schedule 865 s (n=34), dispatch 1047 s (n=20); these populations are not article fast-path comparisons. Across successful parallel Quality runs, Public artifact was last in 72 runs (median run start→suite end 452 s); Author and publishing suites were last in 11 (191 s). These bound the gate prerequisite, including job queue, not a savings estimate.

## Finding

Stage reports show TYRES cached **0/66** across recorded article, full-release and dry-run builds; 62 other rows had no timings and two lacked logs. Restore is attempted before the snapshot exists (`scripts/deployment/build.mjs:53`); the TYRES freshness probe created a temporary directory in its absent parent and swallowed ENOENT as a miss (`scripts/deployment/release.mjs:219`, `scripts/deployment/release.mjs:245`). Other children do not run that probe and restore creates their target parents (`scripts/deployment/release.mjs:228`). A `workflow_run` cache-save denial, “token has no writable scopes”, was observed; token scopes were not changed.

## Change

The existing one-line fix creates the probe parent (`scripts/deployment/release.mjs:218`); the regression test exercises an absent parent, six-hour boundary, data SHA, pin and tampering (`scripts/deployment/assemble.test.mjs:320`). The focused test failed before and passed after; full assemble (60), deployment (67) and static checks passed in the recorded local verification.

Provenance, source pin, data ref/SHA/digest, refresh digest, file inventory and hashes, strict under-six-hour freshness, assemble-time freshness, retries and release gates remain. A hit skips `weekend:update`; data is under six hours old at build time. Scheduled builds always refresh (`scripts/deployment/build.mjs:53`); TYRES' separate stale-forecast label is 24 h (`scripts/deployment/release.mjs:99`).

## AFTER — MODEL ONLY

| Counterfactual | Model hits | Modeled TYRES time per hit | Interpretation |
| --- | ---: | ---: | --- |
| Article fast path | 4/7 | 94.0 s | 375.912 s total modeled component time |
| Full release | 24/31 | 100.8 s | 2419.504 s total modeled component time |

Model uses prior successful cache-saving builds (push, schedule, dispatch), the nine TYRES `main` commit times since 2026-11-01 as data-change dates (latest 2026-11-09T16:12:28Z), and six-hour eligibility; scheduled builds are excluded because they always refresh. These are gross component times, not net critical-path or runner-minute savings: restore, validation and cache availability matter. **Not measured; confirm on post-merge builds via build-report timings (`tyres.cached`).**

## Rejected / not pursued

| Candidate | Decision and reason |
| --- | --- |
| Shared Quality build | **NEEDS-EXPERIMENT**: compare complete inputs, tested SHA, transfer and critical path; parallel work overlaps. |
| Image/child cache tuning | **NEEDS-EXPERIMENT**: isolated save and matched-run net savings unmeasured; retain freshness and SHA checks. |
| Reuse pre-merge artifact or remove release gates | **REJECT**: different inputs and targets; fresh-main and assembled checks must remain. |
| Change `workflow_run` token scopes | Security decision for repository owner; denial observed, no scope change proposed. |
| Earlier alternatives | npm cache, Node-only caller, skipping unchanged schedules, path skipping, concurrent browser suites and parallel release jobs remain rejected: setup benefit is small or freshness, timing and artifact guarantees are at risk (`docs/ci/README.md:54`). |

## Post-merge verification

- Inspect post-merge build reports by run ID and mode: `tyres.cached` should become true on eligible non-scheduled builds; continued 0 hits with available fresh matching cache refutes the fix's operational effect.
- Compare matched hit/miss TYRES, aggregate, build and merge→candidate-live times; compare runner-minutes separately. Test the modeled 4/7 and 24/31 eligibility and roughly 94/101 s component figures against observed samples, without treating them as guaranteed savings.
- Confirm scheduled builds refresh, six-hour boundary and changed pin/data or tampered files miss, all gates pass, and deployment SHA/source and freshness are verified. Record actual trigger linkage and workflow queue if available; otherwise retain the attribution limits above.
