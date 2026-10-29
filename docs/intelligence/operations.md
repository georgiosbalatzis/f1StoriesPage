# I-06E — Intelligence operations

Use this runbook for pipeline health. [I-06C4](data-quality.md) answers analytical correctness: the owner must run
its validator with the dashboard key. A snapshot can be `HEALTHY` while analytical checks remain **NOT VERIFIED**
(`NOT_VERIFIED` in the validator). The watchdog never reads the key, decrypts a snapshot or runs BigQuery.

The implementation is [health-check.mjs](../../scripts/intelligence/health-check.mjs),
[Intelligence Health](../../.github/workflows/intelligence-health.yml),
[Intelligence Snapshot](../../.github/workflows/intelligence-snapshot.yml) and
[Deploy Pages](../../.github/workflows/deploy-pages.yml). Setup, encryption and snapshot shutdown procedures remain
in [dashboard-snapshots.md](dashboard-snapshots.md).

## Is it working?

1. Open Actions → **Intelligence Health** → latest run. Read **F1 Stories Intelligence Health** in the job summaries:
   `Overall`, the `UNKNOWN` component list, and **Component | Status | Last evidence**. Check the observation time.
   An old summary describes an old observation.
2. Read **Incident synchronization** in the `incidents` job. `COMPLETE` means synchronization finished;
   `DRY_RUN` means decisions were printed without writes. `UNKNOWN` means issue availability, reads or writes could
   not be confirmed. `NOT_REQUESTED` is normal in the separate `assess` job. Synchronization failure does not change
   the assessed health state or exit code: a green run does not prove issues were delivered.
3. In Issues, filter by label `intelligence-health`. An incident gives its category, first detection, latest
   observation, component under `Stage`, workflow URL, failure, next action and whether a previous envelope was
   observed. That availability statement proves only a well-formed envelope, not decryption or authenticity.

| State | Meaning and response |
| --- | --- |
| `HEALTHY` | Available evidence passed this component's checks. It does not establish analytical correctness. |
| `DEGRADED` | Attention needed: for example, delay or cost warning. Read the component and incident action. |
| `CRITICAL` | Confirmed failure or threshold exceeded. Diagnose the failing stage before recovery. |
| `UNKNOWN` | Evidence is missing, invalid or insufficient. Check collection and artifacts; never infer recovery. |

Overall uses the highest state in this order: `CRITICAL`, `DEGRADED`, `UNKNOWN`, `HEALTHY`. The checker exits 1 only
for `CRITICAL`; `UNKNOWN` and `DEGRADED` exit 0. Workflow infrastructure failures can still fail a job separately.

| Component name | What it checks |
| --- | --- |
| `schedule` | An execution since the expected schedule, or a successful manual `refresh` whose reporting day and repository snapshot cover it. A manual `dry-run` does not cover it. |
| `bigquery` | Structured stage failures, the named WIF authentication step, or seven selected queries with seven billed-byte records and seven attempts. It does not inspect SQL results. |
| `snapshot` | Public envelope shape, `f1s-dashboard-snapshot` format, version `1`, `AES-256-GCM`, dates, mature window and plausible generation time. Well-formed metadata is not cryptographic authentication. |
| `publication` | Envelope-upload and `Commit the encrypted snapshot` outcomes, default-branch metadata versus refresh evidence, and evidence of a repository regression. Healthy publication requires an observed successful/skipped publish job and a covering repository snapshot. An intentional no-op is allowed. |
| `pages` | Relevant direct and reusable-workflow Pages deployments, a successful `Deploy Pages artifact` job (including caller prefixes), matching public/repository `asOf` and `generatedAt`, and SHA-256 digests of canonical `{header, iv, data}`. Equal headers with different digests are immediately critical. Dispatch alone is insufficient. |
| `freshness` | Public generation age and reporting-day lag relative to the expected schedule, with the four-day maturity lag. |
| `discovery` | Model `13-article-discovery` and `28-internal-navigation` ages from matching publication telemetry/history; history can establish expiry only. Healthy status and recovery require both models in the current publication's run/carried evidence. RUM `30-cwv-summary` and `33-rum-coverage` carry ages are assessed at publication. No payload inspection. |
| `costGuard` | Estimates, actual billed bytes, query attempts, unchanged caps and complete, consistent telemetry. |
| `refresh` | Latest execution outcome and structured stage; successful completion or an intentional skip with a covering repository snapshot is required for healthy completion. |
| `repeated` | Two distinct consecutive completed refresh executions failing. Retried attempts of one run count once. Recovery requires a successful latest refresh; losing an older failed observation or insufficient mode/history evidence stays unknown. |

### Clocks, schedules and thresholds

Snapshot generation uses `cron: '0 3 * * *'`, `timezone: Europe/Athens`. Health uses `0 11 * * *` and `0 17 * * *`,
also `Europe/Athens`, plus manual `workflow_dispatch` with `dry-run: true` by default. Both health jobs run only on
`refs/heads/main`. Schedules are best effort, not a 03:00 delivery promise.

The schedule clock uses the most recent due Athens instant: 03:00 normally, the first valid instant after the spring
DST gap (04:00), and the first 03:00 occurrence on the autumn overlap. Its expected `asOf` is that instant's
`America/Los_Angeles` date. The producer uses the LA date when it runs, so a late execution can legitimately have a
newer `asOf`. GitHub timestamps are UTC.
The mature end is `asOf − 4 days`; the primary window is at most 28 days, acquisition at most 7, never before the
2026-10-19 export start. Compare dates in these zones, not against the Athens calendar alone.

| Check | Implemented boundary |
| --- | --- |
| Execution observed late | Delay strictly greater than 6 h after expected schedule → `DEGRADED`; a delay of 6 h is tolerated. |
| No scheduled or covering manual execution | Under 8 h → `HEALTHY` grace; at 8 h → `DEGRADED`; at 12 h → `CRITICAL`. A new day's grace carries an existing missing-run incident unchanged; only an observed execution can establish recovery. |
| Refresh still active | `UNKNOWN` through 12 h after expected schedule; strictly beyond 12 h → `DEGRADED`. |
| Completed refresh not in repository | `DEGRADED`; strictly more than 1 h after recorded refresh evidence → `CRITICAL`. A recorded upload/publish failure is immediately critical. |
| Pages evidence or public version has not reconciled | Through 1 h after repository `generatedAt` → `UNKNOWN`; strictly beyond 1 h → `DEGRADED`; strictly beyond 3 h → `CRITICAL`. A relevant failed deployment or equal headers with mismatching envelope digests is immediately critical. Missing API/job evidence otherwise stays unknown. |
| Public generation age | Strictly greater than 48 h → `CRITICAL`, matching the dashboard stale boundary. |
| Public reporting day behind expected schedule | Through 8 h after schedule, grace excuses only the currently due reporting day: the prior actual schedule's day must already be published. After grace, the currently due day is required. One required day behind → `DEGRADED`; more than one → `CRITICAL`, even if recently generated. A new day never clears an older missing day. |
| Future metadata | More than 5 minutes ahead, or an `asOf` later than today's LA date, is rejected. |
| Discovery carry | Rotation due at 7 days, supported carry through 13 days. Known age greater than 13 → `CRITICAL`, including historical evidence. Absent current models otherwise → `UNKNOWN`, even with recent historical dates; this cannot close `discovery-overdue`. Current carry ages 1, 7 and 13 do not cause daily watchdog warnings. |
| RUM carry | Ages 0 or 1 day at publication are accepted; negative, missing or greater than 1 day → `DEGRADED` when Discovery age evidence is available and within bounds. One-day carry on Discovery days is intentional. |

The collector reads up to 30 snapshot runs on `main` and up to 30 runs each for `deploy-pages.yml`, `publish-blog.yml`,
`auto-merge-dependencies.yml` and the nested article caller `auto-publish-author-pr.yml`, also on `main`. It fetches
operational artifacts/jobs for the first 10 snapshot runs and jobs for the first 5 runs of each Pages/caller workflow.
These are read-only Actions API requests using the existing `actions: read`; no new permission or Deployments API is
needed. Caller runs with no actual deploy or a skipped deploy are excluded. Deployment job start times determine
supersession when available, since callers can start earlier. Missing workflow-list evidence leaves Pages unknown.
Expired/missing artifacts or a history horizon that
cannot establish the expected execution leave checks `UNKNOWN`. Metadata reads have at most two attempts, 5 seconds per
attempt and a 2 MiB response limit. Incident writes are never retried within the check.

### Run-summary artifact

In **Intelligence Snapshot**, download `intelligence-operation-<run_id>-<run_attempt>` (21-day retention). Its file
is `intelligence-operation.json`, written through `SNAPSHOT_SUMMARY_PATH`. It normally contains version, observation time,
mode, window, stage, outcome, selected/carried model ids and dates, query-attempt count, estimates, billed bytes and caps.
It contains no rows, SQL, key, token or provider-error text. Envelope artifacts are separate:
`intelligence-snapshot-<run_id>-<run_attempt>`, retained for 1 day.

Producer summary writes and finalization are best effort: I/O or parse failures log a fixed message without paths,
error contents or analytics and never change plan/refresh exit codes. Both **Finalize operational metadata** and
**Upload operational metadata** run with `always()` and `continue-on-error: true`, so telemetry cannot block
production publication. Query execution, encrypted-envelope upload and publication failure gates remain enforced.

Stages are `plan_skipped`, `configuration`, `authentication`, `export_tables`, `dry_run`, `preflight`, `query`,
`result_validation`, `encryption`, `ok`. Outcomes are `pending`, `skipped`, `success`, `failure`, `unknown`.
`pending` means processing was not recorded as complete; `skipped` is an intentional plan no-op; `success` is
completion of that mode; `failure` records failure. `unknown` is recorded at `configuration` by `finalize-summary`
when no plan summary exists, such as when the plan step never ran. It must never be read as pending or healthy.
`runModels` lists the selection, not proof that every query completed; inspect stage, attempts and billed records.
Finalization overrides `unknown` if an authentication, plan or refresh step explicitly failed. Without a plan summary,
the fallback can also lack a valid mode; that artifact is rejected by the checker. A missing or invalid artifact
leaves the watchdog without execution evidence. A successful dry-run is not a published refresh.
A no-op may reuse matching published query/cost telemetry only when it is the most recent non-skipped refresh:
an intervening failure or missing artifact cannot be bypassed in favour of an older successful summary.

Health passes safe evidence between its two jobs as `intelligence-health-<run_id>-<run_attempt>` containing
`health-evidence.json`, retained for 7 days. The incident job reassesses this evidence; it does not execute an
artifact-supplied action plan. Envelope evidence retains dates and SHA-256 digests only, never ciphertext, nonces
or key checks, so a public/repository divergence survives reassessment without exposing envelope contents.

## Failure modes

Detection below assumes the watchdog runs and can read its evidence. Incidents open on the first observed
`DEGRADED` or `CRITICAL` state; there is no requirement for multiple observations except `repeated-failures`.

| Failure | Detected automatically? | Check / category id | What the owner sees | Action |
| --- | --- | --- | --- | --- |
| Refresh fails or is cancelled | yes | `refresh` / `refresh-failed` | Critical execution/stage and workflow link | Diagnose the stage; use the recovery cases below. |
| Expected schedule never starts | yes | `schedule` / `schedule-missing` | Warning at 8 h, critical at 12 h | Check Actions and covering manual runs before dispatch. |
| Schedule starts late | yes | `schedule` / `schedule-missing` | Degraded beyond 6 h, even if refresh succeeds | Reconcile reporting day; do not rerun a published day. |
| WIF, export table, SQL/schema, query or result validation fails | yes | `bigquery` / `bigquery-failed`; `refresh-failed` | Named structured stage; auth step can identify failure without artifact | Fix the cause; never blindly rerun queries. |
| Key missing, malformed or rotated | partially | `refresh` / `refresh-failed` on configuration failure; `discovery-overdue` may follow lost carry | Configuration failure, or apparently healthy pipeline with unavailable carry | Owner checks environment/key lifecycle; watchdog cannot establish which key opens the file. |
| Preflight refusal or observed byte-guard violation | yes | `costGuard` / `cost-preflight` | Critical refusal/guard evidence | Review estimates and caps; keep limits. |
| Billed telemetry missing | partially | `costGuard`, `bigquery` | `UNKNOWN`, no inferred cost/recovery | Inspect operational artifact and stage. |
| Upload/commit failure or publication lag | yes | `publication` / `publication-failed` | Critical recorded failure, or lag escalation after 1 h | Recover publication from existing envelope if safe. |
| Deployment failure/cancellation, or older public version | partially | `pages` / `pages-failed` | Critical relevant failure, or reconciliation lag after 1 h / 3 h | Check superseding deployment and public metadata; deploy current main. Unreadable evidence stays unknown. |
| Snapshot too old / reporting day behind | yes | `freshness` / `snapshot-stale` | Generation age, expected day, mature end | Diagnose the upstream failure. |
| Discovery does not rotate | partially | `discovery` / `discovery-overdue` | Critical known age beyond 13 days; unknown if age cannot be established | Inspect rotation prerequisites; restore daily RUM first. |
| Two consecutive completed refreshes fail | yes | `repeated` / `repeated-failures` | Critical consecutive-execution incident | Investigate the common stage; avoid repeated billable dispatches. |
| Malformed repository/public envelope | yes | `publication-failed` for repository; `snapshot-stale` for public corruption | Critical malformed/implausible metadata | Restore the exact known-good encrypted file. |
| Structurally valid ciphertext is damaged | partially | `pages` / `pages-failed` when public/repository digests differ with equal headers | Immediate critical divergence; identical damage in both copies remains undetectable without authentication | Compare digests and deploy the intact repository copy; preserve/restore a known-good envelope if both are damaged. |
| Endpoint missing, inaccessible or API permission/read failure | partially | Affected components | `UNKNOWN`; no incident resolution on missing evidence | Check collection, access and endpoint; inspect the summary directly. |
| GitHub Actions itself down or disabled | no | No independent check | No new health run; old summary/issues remain | Inspect Actions availability/settings independently. |
| Watchdog workflow disabled | no | Watchdog cannot monitor its own absence | No new health observation | Check Actions → Intelligence Health and re-enable when intended. |
| Notifications not delivered | no | No delivery receipt check | Issue may exist without email/web/mobile notification | Check subscriptions and notification settings. |
| Cloud bill beyond job bytes | no | No Cloud Billing integration | Only snapshot query estimates/billed bytes | Keep the separate €10 budget alert and review billing as owner. |
| Analytical correctness | no | I-06C4 owner-run validator, a different question | `NOT VERIFIED` in health summary | Owner runs [data-quality.md](data-quality.md#run-it) with their key. |

## Safe recovery

Preserve the previous valid `dashboard/data/snapshot.json`. Never delete it to force a refresh, edit its header,
raise caps, remove locks, change job ids or expose plaintext/key material in an issue. A failed refresh normally
leaves that file in place. Before acting, compare the workflow, operational artifact, default-branch metadata and
public metadata; a newer queued/running execution may already be recovering.

For recovery that needs queries, use Actions → **Intelligence Snapshot** → **Run workflow** → branch `main`, mode
`dry-run` first. Review table availability and all seven conservative estimates/preflight. Only after diagnosing
the failure and reviewing that evidence should the owner dispatch the same existing workflow with mode `refresh`.
Billable work goes only through this `workflow_dispatch` path and its mandatory preflight, never direct CLI or
Console queries, a new workflow, or **Re-run all jobs**. A dry-run still authenticates and reads table metadata;
it does not execute billable queries or publish an envelope.

A refresh for an already published `as_of` is a no-op by design, before credentials are minted. Job ids are
deterministic: `f1s_snapshot_<YYYYMMDD>_<model_with_underscores>_<16_hex_digest>`, derived from day, model, rendered
SQL and parameters. HTTP 409 reuses the existing job/results; a failed job is never resubmitted under that id.
Changing SQL/parameters can create new ids and new charges: do not do that merely to force a retry. See
[Schedule, reruns and DST](dashboard-snapshots.md#schedule-reruns-and-dst).

Keep `intelligence-snapshot` concurrency with `cancel-in-progress: false`, the publish job's `content-publishing`
lock with `queue: max`, and Pages group `pages` with `cancel-in-progress: true`. Keep the 400 MiB per-query and
1600 MiB per-refresh caps. Non-billable publication/deployment job recovery must use the existing jobs and locks;
do not restart successful query jobs.

### Missing GA4 daily export

**Symptoms:** `export_tables` failure, `bigquery-failed`, older snapshot retained. **Diagnosis:** read the missing
`events_YYYYMMDD` day in the refresh log for `f1-stories-analytics.analytics_485678890` in `EU`; distinguish absence
from unreadable metadata. **Recovery:** the owner checks the GA4 daily export/link and dataset access using the
[existing setup](dashboard-snapshots.md#one-time-owner-setup). Wait for the real table, then use the manual recovery
path above. Never substitute zeros, skip a missing day, or read an immature table.

### Schedule delay or missing execution

**Symptoms:** `schedule-missing`, with no run or a delay greater than 6 h. **Diagnosis:** check the 8 h / 12 h missing-run
boundaries, Actions enablement, queued runs and successful manual coverage. Compare Athens, LA and UTC clocks.
**Recovery:** wait within grace if a run is queued; otherwise use the manual path after confirming no covering
refresh. A delayed successful publication needs no query rerun. A newer LA day can legitimately cover the schedule.
A new day's grace does not resolve an open `schedule-missing` incident: its state is carried without a close or
an unchanged-state comment until a scheduled execution or successful covering manual refresh is observed.

### Expired or invalid WIF

**Symptoms:** failed **Authenticate to Google Cloud (Workload Identity Federation, no key file)** step or
`authentication` stage, `bigquery-failed`. **Diagnosis:** check `INTELLIGENCE_WIF_PROVIDER`,
`INTELLIGENCE_SERVICE_ACCOUNT`, the `intelligence-snapshots` main-only environment and the existing trust binding.
The workflow requests a short-lived access token for `1800s`; it uses no service-account key file. **Recovery:**
the owner repairs the existing configuration through [owner setup](dashboard-snapshots.md#one-time-owner-setup),
retaining its repository/ref/workflow/environment/event restrictions and minimum roles. Do not widen IAM or add a
key file. Verify with manual dry-run before any refresh; never paste a token into a report.

### Missing or rotated snapshot key

**Symptoms:** `configuration` failure for a missing/malformed secret; a valid rotation can instead produce no
Discovery carry. An old file may still need the old key. **Diagnosis:** the owner checks secret
`DASHBOARD_SNAPSHOT_KEY` in environment `intelligence-snapshots` against their private key record. The watchdog
cannot check possession or decryptability. **Recovery:** restore the intended secret or follow
[Encryption / key rotation](dashboard-snapshots.md#encryption). Keep the 32-random-byte base64 format and old key
record for old envelopes. A valid rotation takes effect on the next refresh; same-day dispatch does not reseal an
already published day. It may need a normal daily RUM refresh before Discovery can resume. Old keys still open old
envelopes in Git history; rotation protects future snapshots only.

### BigQuery schema change

**Symptoms:** `dry_run`, `query` or `result_validation` failure, `bigquery-failed`. **Diagnosis:** inspect the named
model and stage for missing columns, incomplete results or a window/row-contract failure. **Recovery:** have the
owner review a compatible SQL/schema correction and synthetic tests; do not suppress validation or publish partial
results. Use manual dry-run/preflight before an approved refresh. A failed deterministic query job cannot be
re-executed under its old id; any SQL change needs deliberate cost review.

### Query exceeds caps

**Symptoms:** `cost-preflight` critical at `preflight`, or a query/billed-byte failure after execution starts.
**Diagnosis:** compare each estimate, the total estimate and recorded billed bytes; incomplete telemetry is not
zero cost. **Recovery:** keep the previous snapshot and caps. Investigate the scan/plan with the existing manual
dry-run and seek a reviewed fix within the approved windows/models. Never raise limits or add retries based on a
cheap earlier run. Queries already completed cannot be undone; check existing job ids before further work.

### Failed publication

**Symptoms:** `publication-failed`, failed **Upload the encrypted envelope** or **Commit the encrypted snapshot**,
or a completed refresh not reaching the repository. **Diagnosis:** check the 1 h publication boundary, envelope
artifact, current main and `content-publishing` queue. **Recovery:** if only the publish job failed, its encrypted
artifact still exists and no newer snapshot supersedes it, rerun that failed job with its existing artifact/outputs.
The envelope artifact lasts 1 day. Upload is inside **Query and encrypt**, not a separate recoverable job: do not
rerun that query job merely to retry upload. If publication cannot reuse the artifact, retain the old file and use
the manual snapshot path only after investigation.
`install` accepts only a valid envelope for a newer `asOf`; an unchanged equal/newer file is legitimate and dispatches
no deployment. If main is already correct but dispatch failed, use the Pages recovery below.

### Cancelled deployment

**Symptoms:** cancelled Deploy Pages run or `pages-failed`. **Diagnosis:** group `pages` cancels older work when a
new run supersedes it. Check direct deployments and reusable calls from **Site Maintenance**, **Merge Dependency
Updates** and **Publish Article**. Find the newest relevant **Deploy Pages artifact** job (possibly prefixed, such as
`Deploy site once / Deploy Pages artifact`) and its deployment start time, then compare public/repository metadata
and digests. A later successful actual deployment with matching digests supersedes a cancelled direct run; an older
success, caller-only success, or skipped deploy does not. **Recovery:** let a newer active deployment finish.
A later successful scheduled gate also cannot erase an unresolved failure; recovery needs a successful actual
deployment after that failure and matching public/repository digests.
If no successful replacement serves the committed snapshot, Actions → **Deploy Pages** → **Run workflow** on `main`.
This builds current main and does not query BigQuery. Keep the Pages concurrency policy and confirm the endpoint.

### Stale snapshot

**Symptoms:** `snapshot-stale`; public generation age greater than 48 h or reporting day behind the scheduled day
beyond grace. **Diagnosis:** compare last refresh, publication and deployment, `asOf`, generation timestamp and
mature end. A four-day data lag is expected. **Recovery:** fix the first failing upstream stage. If main already has
fresh metadata, deploy it; if generation is missing, use the manual snapshot path. Never relabel an old envelope
or run extra queries just to clear the stale notice.
The next day's grace excuses only its newly due day. Any reporting day already overdue stays unhealthy until a
public snapshot covers it; neither waiting for a new schedule nor a new generation timestamp alone is recovery.

### Discovery not rotating

**Symptoms:** `discovery-overdue` beyond 13 days, `UNKNOWN` ages, or a pending dashboard panel. **Diagnosis:** inspect
run/carried model ids and dates. Discovery is due when absent or at least 7 days old, but needs yesterday's valid
snapshot with both RUM models. Missed days, a rotated key, damaged or legacy data can prevent carry. The producer
drops Discovery older than 13 days; validated historical carried-model dates retain its last known age even when
the original execution is outside collected history. These historical dates can establish expiry, but cannot prove
that Discovery exists in the current snapshot. After key rotation, absent current run/carried evidence stays
`UNKNOWN` unless history confirms expiry; it cannot mark Discovery healthy or close an existing incident. Recovery
requires both models in the current publication's run or carried evidence.
**Recovery:** restore normal daily publication and yesterday's usable RUM; let the existing rotation choose the next
Discovery day. Do not add models, a second daily refresh, or a same-day forced query. The owner can use I-06C4 to
inspect carried-window correctness; that validator's 8–13 day warning is separate from watchdog health.

### Corrupted snapshot file

**Symptoms:** malformed-envelope critical state, `pages-failed` for equal headers with different envelope digests,
or the dashboard's damaged-file state despite identical repository/public copies.
**Diagnosis:** distinguish repository damage, public-only damage and cryptographic failure. The watchdog cannot
verify the authentication tag or analytics. **Recovery:** preserve available valid encrypted copies; restore the
exact newest known-good envelope from a trusted artifact/history through a reviewed file repair, checking that it
does not overwrite a newer valid publication. Do not edit dates/ciphertext or delete the current file to bypass
dedupe. A malformed committed file can block both `plan` and `install`, so repair it before dispatch. For a valid
same-day header with damaged ciphertext, a rerun is still a no-op; restore the intact copy rather than forcing
queries. Deploy repaired main if needed and keep all key material private.

### Pages serves an older version

**Symptoms:** main has newer `asOf`/`generatedAt`, but public metadata differs; `pages-failed` after lag thresholds.
Equal headers with different SHA-256 envelope digests instead produce immediate critical publication/Pages divergence.
**Diagnosis:** compare `https://f1-stories.gr/dashboard/data/snapshot.json` metadata and canonical-envelope digest with main and the relevant
**Deploy Pages artifact** job. A successful dispatch or gate is not proof of deployment or endpoint version.
The Deploy Pages schedule `41 */6 * * *` has a **Scheduled refresh gate** controlled by
`scripts/deployment/sources.json` `enabled`; do not rely on it to repair the snapshot. **Recovery:** dispatch
**Deploy Pages** on `main`, wait for deployment, then recheck public metadata and digest without credentials or decryption.
Do not regenerate an already correct repository snapshot.

## Costs, notifications and owner configuration

`costGuard` compares the larger of estimate and billed total with 1600 MiB. At 50% (800 MiB), it adds an `INFO`
note; with complete telemetry the state remains healthy until 80% (1280 MiB), which is `DEGRADED`. At 100%
(1600 MiB) or above it is `CRITICAL`. Guard violations or a failed preflight are also critical; incomplete telemetry
otherwise stays unknown. Violations include changed caps, a per-query estimate/billed value greater than 400 MiB,
total estimate/billed bytes greater than 1600 MiB, or more attempts than selected models. Complete cost evidence
requires all seven queries and matching sums. These defaults are in `CONFIG`; changing them requires a code review.

The producer accepts an estimate equal to its cap and stops when totals exceed it; the watchdog deliberately
alerts at the full daily allowance. Estimates are conservative planning figures, `totalBytesBilled` is observed
query usage, and neither is money. In particular, 1600 MiB per refresh is not a total Cloud billing limit. Storage,
GA4 export, other users and services are outside this telemetry. Keep the **separate €10/month budget alert**
required by [Cost controls](dashboard-snapshots.md#cost-controls); it notifies and does not stop spending.
Cloud Billing integration would be a separate owner-approved enhancement. The watchdog runs no BigQuery work.

Before relying on alerts, the owner must:

1. Keep repository Issues enabled and verify that the incident job can create the `intelligence-health` label and
   create/comment/close issues. Read `Incident synchronization`; a failed write is not proof of notification.
2. Set repository **Watch → Custom → Issues** (or all activity), and configure their GitHub notification channels
   for watched repositories. A new incident can notify repository issue watchers; comments and closure can notify
   subscribers to that thread. The bot does not assign or mention the owner. See
   [GitHub notification settings](https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications).
3. Enable GitHub Actions email/web notifications, optionally failures only, on the account receiving scheduled
   workflow notifications. Failed-schedule emails go to the user who last modified the cron syntax (initially its
   creator); re-enabling a disabled schedule can move notifications to the re-enabling user. They do not necessarily
   go to every maintainer or repository watcher. See
   [workflow notifications](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs).
4. Verify receipt using the synthetic-first plan below. Creating an issue or failing a workflow does not guarantee
   email, web or mobile delivery. No run means no failed-run email; `DEGRADED`/`UNKNOWN` health alone does not fail a run.

The bot keeps one open incident per category when starting without duplicates. Unchanged severity creates no
comment or reminder; a severity transition adds a comment. An open incident closes only on positive evidence of
recovery for exactly what failed, recorded by `recoveryObserved: true` on that category's healthy assessment.
A `HEALTHY` label alone, grace, a new day, missing observations/artifacts or `UNKNOWN` cannot establish recovery.
Qualifying evidence adds recovery information and closes the incident; `UNKNOWN` neither closes it nor creates one.
For `schedule-missing`, grace alone is not recovery: retain the existing incident without comments until a scheduled
run or successful covering manual refresh is observed. A fresh grace period with no open incident creates none.
Read the latest summary for current evidence:
the issue's original body and unchanged observations are not rewritten on every check. Manually closing an active
incident allows a later check to create another one.

Both health jobs have `contents: read`, `actions: read`; only `incidents` has `issues: write`. Top-level permissions
are `{}`. Neither job has `id-token: write`, Google credentials, a dashboard secret or a Cloud environment. Health
uses concurrency group `intelligence-health`, `cancel-in-progress: false`; job timeouts are 8 minutes (`assess`) and
5 minutes (`incidents`). Snapshot permissions remain per job: refresh `contents: read`, `id-token: write`; publish
`contents: write`; dispatch `actions: write`. Deploy Pages build has `contents: read`, `pages: read`; its deploy job
has `pages: write`, `id-token: write` in `github-pages`.

GitHub-only monitoring shares GitHub Actions failures with generation. If Actions is down/disabled, or the watchdog
is disabled, neither a new summary nor an issue may appear. This provides periodic checks, not continuous or
immediate alerting. An external uptime check of a public operational endpoint could provide an independent signal;
it is optional, proposed only, and **not configured**. It would not establish analytics or the Cloud bill.

## Disable or roll back monitoring

In Actions → **Intelligence Health**, use **Disable workflow**, or revert the watchdog changes from the monitoring PR
through normal review. Retain the snapshot workflow's producer summary steps when preparing that revert; reverting
the entire PR unchanged would also remove those steps. Close open issues labelled `intelligence-health` when
retiring monitoring. Do not disable **Intelligence Snapshot** or change its schedule/key/Cloud access to silence the
watchdog. Disabling only the watchdog leaves snapshot generation and its run-summary artifact working.
Snapshot shutdown/withdrawal is a separate owner action under
[Disable or roll back](dashboard-snapshots.md#disable-or-roll-back).

## Production verification plan — synthetic incidents first

This is an owner verification plan, not a record of production execution. No artificial failures go into the real
snapshot workflow, and no article publication, billable query or production key is needed to test monitoring.

1. Run `npm run test:intelligence` and `npm run quality:static` locally. The synthetic health tests use generated
   keys, fake BigQuery and mocked GitHub responses: missing expected execution, stage failures, malformed/old
   snapshots, normal/Discovery days, clocks/DST, no-op skips, incident dedupe, transitions and recovery. Confirm the
   missing-summary path records `unknown`, never healthy completion.
2. Once the workflow is available on `main`, Actions → **Intelligence Health** → **Run workflow** on `main`, leave
   **dry-run** true. Inspect both summaries, component timestamps, safe evidence artifact and printed issue decisions.
   This reads real operational metadata and issue state but writes no issues and runs no queries. A branch dispatch
   does not exercise the jobs; they are main-only.
3. Verify from the synthetic tests that a missing run warns/escalates after grace, a synthetic failure gets the right
   category, an unchanged incident produces no duplicate/comment, recovery closes only with positive healthy
   evidence, and healthy normal/Discovery days are not reported broken. Verify API failures remain unknown and the
   tests use neither paid queries nor a production key. There is no synthetic-incident workflow input; do not alter
   production runs to manufacture these cases.
4. The owner verifies Issues access and their notification settings separately. After reviewing the dry-run plan,
   use a normal watchdog dispatch with **dry-run** false only for real observed incidents, or test issue delivery in
   a separate owner-controlled test repository with synthetic evidence. Confirm one creation, no repeated noise,
   severity-transition comments and recovery/closure. No delivery check has been performed by this documentation.
5. Observe the next real scheduled watchdog checks at 11:00/17:00 Athens: schedules may be late. Compare against
   actual snapshot/publication/Pages evidence, confirm manual/no-op and weekly carry are handled, then check receipt
   of any genuine incident notification. Record safe operational evidence only. Do not fail or cancel the snapshot
   workflow for this exercise, rerun billable jobs, decrypt production data, merge or deploy as part of this plan.
