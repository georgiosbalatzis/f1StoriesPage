# I-06B — Daily encrypted Intelligence snapshots

Project constraint: the owner's **total Google Cloud budget is 10 EUR/month** (all services, not per service).
Nothing in this workflow can enforce that total; see [Cost controls](#cost-controls).

Status: **enabled with owner approval (2026-10-27)**. GitHub environment `intelligence-snapshots`, Workload Identity Federation, and dataset-scoped BigQuery permissions were configured. An authenticated, no-charge BigQuery dry-run succeeded on 2026-10-27 (5 mature days, 2026-10-19 through 2026-10-23). No billable refresh or encrypted snapshot publication had succeeded at activation time. `scripts/intelligence/snapshot.mjs` ships with `ENABLED = true`.

This replaces the I-06A plan (a Cloud Run key/session API). That API was never deployed. Its code
(`services/dashboard-api`), its docs and the page's API wiring are removed. No Firebase, Cloud Run, load balancer
or API is involved: GitHub Pages serves one encrypted file, and the browser decrypts it.

## How it works

```
03:00 Europe/Athens (best effort)            .github/workflows/intelligence-snapshot.yml
  refresh  (contents: read, id-token: write; environment intelligence-snapshots; main only)
    plan      no network: mode, ENABLED, already published today?, configuration present and well-formed?
    auth      GitHub OIDC → Workload Identity Federation → short-lived token for one service account (no key file)
    refresh   daily tables exist → 4 dry-runs → cost preflight → 4 capped queries → validate → AES-256-GCM
    upload    the encrypted envelope only (1-day retention)
  publish  (contents: write; content-publishing lock)
    install   valid envelope for a NEWER as_of day → dashboard/data/snapshot.json, else unchanged
    commit    .github/actions/commit-and-push (paths: that file only)
  deploy   (actions: write) only after a changed commit
    dispatch  deploy-pages.yml on main → its build checks out main after the push → validated dist/ → Pages
browser  /dashboard/ fetches /dashboard/data/snapshot.json, the user types the key, Web Crypto decrypts in memory
```

## Data

| | |
| --- | --- |
| Models | `11-category-pageviews`, `20-daily-activity`, `30-cwv-summary`, `33-rum-coverage`, rendered by `editorial-model.mjs` (SQL not copied or changed) |
| Source | `f1-stories-analytics.analytics_485678890`, location `EU`, daily `events_YYYYMMDD` tables only |
| `@as_of_day` | today in the property time zone `America/Los_Angeles`, computed when the job runs |
| Window | `end_day = as_of_day − 4` (the models' maturity rule); `start_day = max(end_day − 27, 2026-10-19)`: the latest 28 mature days, or every mature day since the export began while there are fewer (1–28) |
| Samples | `@min_events = @min_observations = 30`; `meets_min_*` flags are kept and shown, never used to drop rows |

The export starts on 2026-10-19, so snapshots are useful as soon as the owner setup is done:

| `as_of_day` | Window | Days |
| --- | --- | --- |
| 2026-10-26 | 19 → 22 Oct | 4 |
| 2026-10-29 | 19 → 25 Oct | 7 |
| 2026-11-19 | 19 Oct → 15 Nov | 28 |
| 2026-11-20 and later | the latest 28 mature days | 28 |

No day before the export, no immature day (newer than `as_of_day − 4`) and no synthetic day is ever included. The
models' SQL, the RUM revision rule and the coverage-class separation are unchanged: the window only sets
`@start_day` and `@end_day`. The page states the number of days and, while it is under 28, that the window covers
everything since the export began.

The refresh fails closed when any daily table in the window is missing (a gap is never skipped or filled), a result
is incomplete (unfinished job, extra page, row count mismatch, including a daily result without exactly one row per
window day, or a missing column), a row does not cover exactly the requested window, or the RUM cohort is truncated.
The envelope check accepts only the window this rule gives for its `as_of_day`.

## Schedule, reruns and DST

- `cron: '0 3 * * *'` with `timezone: Europe/Athens`, plus `workflow_dispatch`. GitHub runs schedules on a best-effort
  basis: late (hours, in this repository's history) or occasionally not at all.
- One refresh per `as_of_day`: `plan` skips when the published snapshot already has today's `as_of_day`, before any
  credential is minted. A late, repeated or manual run is a no-op.
- BigQuery job ids are fixed per day, model and SQL (`f1s_snapshot_<as_of>_<model>_<sha256>`). A rerun after a
  failure later in the workflow finds the existing job (HTTP 409) and reads its results instead of billing a second
  query. A failed job is never resubmitted under that id.
- DST: 03:00 Athens does not exist on the spring-forward Sunday (no run, or a run GitHub shifts; the next day catches
  up) and occurs twice on the fall-back Sunday (the second run is the same `as_of_day`, so it does nothing). A run that
  starts after midnight Los Angeles (10:00/11:00 Athens) simply refreshes the next `as_of_day`, still 4 days mature.
- `concurrency: intelligence-snapshot` (no cancel) serializes runs. The publish job shares `content-publishing` with
  the blog and data publishers, and `commit-and-push` rebases if main moved.
- No failed or empty refresh can replace the published file: the envelope exists only after every check passed, publish
  runs only on success, and `install` accepts only a structurally valid envelope for a newer `as_of_day`.

## Cost controls

The owner's whole Google Cloud budget is **10 EUR/month**, and it is a project constraint. **These controls are not
a guaranteed 10 EUR total-cloud cap**, and nothing here can provide one: budget alerts only notify, and the limits
below apply only to this workflow's BigQuery queries.

| Control | Where |
| --- | --- |
| Owner-approved billable refreshes enabled; emergency disable remains tested | `snapshot.mjs` (`ENABLED = true`); the disabled-mode unit test |
| Manual runs default to `dry-run` (free) | workflow input |
| Four allowlisted models only; no client-supplied SQL | `SNAPSHOT_MODELS` |
| Mandatory dry-run of all four queries before any execution | `refresh()` |
| Conservative estimate per query: max(processed bytes rounded up to 1 MiB, 10 MiB × tables) | `conservativeBytes()` |
| Table count: max(tables the dry-run lists, daily tables the model's base scans), so one listed wildcard still counts 28/29 | `scannedTables()` |
| Per query: estimate ≤ 400 MiB, else nothing runs | `preflight()` |
| `maximumBytesBilled = 419430400` (400 MiB) on every query, enforced by BigQuery | `bigQuery().run()` |
| Combined daily ceiling 1600 MiB: the sum of estimates, checked before running; billed bytes, checked after each query | `DAILY_MAX_BYTES` |
| No billable retries: one insert per query, no retry loop; reruns reuse the same job id | `bigQuery().run()` |
| One successful refresh per `as_of_day`; one schedule per day | `plan()`, workflow |
| No browser query: the page has `connect-src 'self'` and fetches one static file | CSP, tests |

**Why 400 MiB.** On-demand pricing bills at least 10 MiB per referenced table. The editorial and audience models scan
the window's daily tables (28 at full length), and the RUM models also scan the day before (29). At the minimums, a
full refresh plans 280 + 280 + 290 + 290 = **1140 MiB**. That is under the 1600 MiB ceiling, and every query is under
400 MiB. The previous 100 MiB cap could never fit a 28-table scan. A dry-run may list a wildcard scan as a single
table, so the estimate never uses fewer tables than the base actually scans. Short windows plan less (4 days: 40 + 40 + 50 + 50 = 180 MiB).

**Expected volume.** About 1.1 GiB per day at the per-table minimums, ≈ 35 GiB per month. The caps allow at most
1600 MiB per day, ≈ 48 GiB per month. Both sit well inside BigQuery's monthly free on-demand allowance, *if* nothing
else in the billing account uses it, and are small at list price beyond it. Check the current EU on-demand price
and free tier on Google's pricing page; they are not restated as fact here.

Limitations:

- **Not a total-cost cap.** These limits do not cover storage, the GA4 export, other BigQuery users or projects,
  or any other Google service. They cannot keep the account under 10 EUR on their own.
- With four models, the 1600 MiB ceiling equals four full per-query caps. Its job is to bound the plan and to stop
  remaining queries once billed bytes pass it. It is not a tighter limit than the per-query caps combined.
- The dry-run estimate is processed bytes plus the per-table minimum, not billed bytes. `maximumBytesBilled` is
  the backstop: a query that would bill more fails, and failed queries are not billed.
- Billed bytes are checked only *after* a query. That stops later queries; it cannot undo one.
- A manual rerun on a new `as_of_day` is a new refresh. Only the owner and maintainers can dispatch.

### Custom BigQuery quota (additional safeguard, owner)

A custom daily query quota is an **additional safeguard**, not a billing cutoff. Once usage reaches it, BigQuery
refuses new on-demand queries for the rest of the day, for everyone it covers. It limits only query bytes, though,
not storage or other services. Usage accounting can lag, and the quota does not turn a budget into a hard limit.
In Google Cloud Console → IAM & Admin → Quotas & System Limits, filter by service **BigQuery API**:

- **Query usage per day per user**: at least 2 GiB, so a full refresh (≤ 1600 MiB) fits with room for a dry-run review.
  This limits the service account and each person.
- **Query usage per day** (project): e.g. 10 GiB, leaving room for your own Console analysis.

Quotas reset at midnight Pacific time. On 2026-10-27, both BigQuery quotas showed `Adjustable: No` in the owner's Google Cloud Console; the quota overrides above could not be configured. The workflow therefore relies on mandatory preflight, per-query caps, limited models and frequency, **not** a custom project quota. Keep a **budget alert** on the 10 EUR total budget (e.g. at 50%, 90%, 100%). It notifies; it does not stop spending.

## Encryption

- Key: `DASHBOARD_SNAPSHOT_KEY`, 32 random bytes in base64 (`openssl rand -base64 32`). It is independent of every
  GitHub token and of the retired I-06A Dashboard Access Keys. It is held as an environment secret and, separately, by
  the owner.
- Envelope (`dashboard/data/snapshot.json`, public):
  `{ "header": "<JSON text>", "iv": "<12 bytes, base64>", "data": "<ciphertext‖16-byte tag, base64>" }`.
  `header` = `{format: "f1s-dashboard-snapshot", v: 1, alg: "AES-256-GCM", generatedAt, asOf, start, end, keyCheck}`.
  Its exact bytes are the GCM additional data, so changing any date, the version or the key check breaks decryption.
- A fresh random nonce for every seal. The payload's window must also equal the header's after decryption.
- `keyCheck` = first 16 bytes of SHA-256("f1s-dashboard-snapshot-key-check-v1\0" ‖ key). It only lets the page tell
  "wrong key" from "damaged file". With a 256-bit random key it does not help an attacker.
- Public metadata: the update time and the coverage dates. Everything else (every row, category, count and p75) is
  encrypted. Logs print only byte counts, table counts and row counts. Rows, the key and the token are never printed,
  written in the repository, or uploaded unencrypted.
- **Key rotation**: set a new secret value. The next refresh seals with it. Git history keeps every earlier envelope,
  so **anyone who ever held an old key can still decrypt the snapshots sealed with it**. Rotation protects future
  snapshots only.

## Dashboard (`/dashboard/`)

- `noindex, nofollow`. Its own CSP: `default-src 'none'`, scripts and styles from self only, `connect-src 'self'`,
  no inline code, frames, workers or forms. It loads no analytics or consent code.
- States: loading, empty (no snapshot yet), unavailable (no Web Crypto, framed, unreadable or malformed file), locked
  (key form), wrong key / key format (inline error), damaged (right key, failed authentication: nothing shown), report.
- The key goes from the input to a non-extractable `CryptoKey`; the input is cleared and the raw bytes wiped. No
  Web Storage, cookies, IndexedDB or Cache API (a static guard enforces it). "Lock" removes every decrypted node.
- Everything is built with `textContent` and attributes; a guard bans HTML sinks in `dashboard/`.
- Shown: last successful update (Athens time), the coverage end date as the headline, a stale warning after 48 h,
  daily `page_view` events (small samples faded and labelled), article categories, LCP/INP/CLS observations, p75 and
  good share per coverage class (never pooled), RUM coverage checks with warnings. The notes say: consented visits only,
  event units (not visitors or exact sessions), and that rows under 30 are small samples.

## Public artifact

`public-artifact.mjs` copies only `dashboard/{index.html,dashboard.css,dashboard.js,snapshot-crypto.js,data/snapshot.json}`.
`validate-public-artifact.mjs` fails the build when:

- the snapshot is not a valid envelope, or any other file is under `dashboard/data/`;
- any public text file contains plaintext snapshot rows (model-name keys or the payload marker);
- any public text file contains a Google access token, a private key, a service-account or external-account
  credentials file, or a retired I-06A key/verifier.

`static-source-guard.mjs` applies the credential and plaintext checks to Git.

## One-time owner setup

Do these in order. Nothing in this PR performs them.

1. **Key.** Run `openssl rand -base64 32` on your own machine. Store the value in your password manager. Never paste
   it into an issue, PR or chat.
2. **GitHub environment** `intelligence-snapshots`, deployable from `main` only:
   ```sh
   gh api -X PUT repos/georgiosbalatzis/f1StoriesPage/environments/intelligence-snapshots \
     -F 'deployment_branch_policy[protected_branches]=false' -F 'deployment_branch_policy[custom_branch_policies]=true'
   gh api -X POST repos/georgiosbalatzis/f1StoriesPage/environments/intelligence-snapshots/deployment-branch-policies \
     -f name=main -f type=branch
   gh secret set DASHBOARD_SNAPSHOT_KEY --env intelligence-snapshots --repo georgiosbalatzis/f1StoriesPage   # paste when prompted
   ```
3. **Service account and Workload Identity Federation** (Cloud Shell or an authenticated `gcloud`):
   ```sh
   PROJECT=f1-stories-analytics
   PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
   SA="intelligence-snapshot@$PROJECT.iam.gserviceaccount.com"
   gcloud iam service-accounts create intelligence-snapshot --project="$PROJECT" \
     --display-name="F1 Stories dashboard snapshot (read-only)"
   gcloud iam workload-identity-pools create github --project="$PROJECT" --location=global --display-name="GitHub Actions"
   gcloud iam workload-identity-pools providers create-oidc f1-stories --project="$PROJECT" --location=global \
     --workload-identity-pool=github --issuer-uri=https://token.actions.githubusercontent.com \
     --attribute-mapping='google.subject=assertion.sub,attribute.repository=assertion.repository' \
     --attribute-condition="assertion.repository == 'georgiosbalatzis/f1StoriesPage' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == 'georgiosbalatzis/f1StoriesPage/.github/workflows/intelligence-snapshot.yml@refs/heads/main' && assertion.environment == 'intelligence-snapshots' && assertion.event_name in ['schedule', 'workflow_dispatch']"
   gcloud iam service-accounts add-iam-policy-binding "$SA" --project="$PROJECT" --role=roles/iam.workloadIdentityUser \
     --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/georgiosbalatzis/f1StoriesPage"
   ```
   The provider admits tokens only from this repository, `refs/heads/main`, this workflow file, the main-only
   environment, and schedule/manual events. Pull-request workflows never reach Google: no workflow other than this one
   authenticates (a test enforces it). Do not create a service-account key.
4. **Minimum BigQuery permissions** for the service account:
   ```sh
   gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role=roles/bigquery.jobUser
   ```
   Then grant read access on **the export dataset only**, in the BigQuery Console query editor (a DCL statement, not
   billed):
   ```sql
   GRANT `roles/bigquery.dataViewer` ON SCHEMA `f1-stories-analytics`.analytics_485678890
   TO "serviceAccount:intelligence-snapshot@f1-stories-analytics.iam.gserviceaccount.com";
   ```
   (Console alternative: dataset `analytics_485678890` → Sharing → Permissions → add the principal as BigQuery Data
   Viewer.) Do **not** grant project-wide `roles/bigquery.dataViewer`, `dataEditor`, `admin` or `user`. `jobUser`
   lets it run query jobs. `dataViewer` on one dataset lets it read those tables and table metadata. It holds no write
   role anywhere, so it cannot change data.
5. **Environment variables** (identifiers, not secrets):
   ```sh
   gh variable set INTELLIGENCE_WIF_PROVIDER --env intelligence-snapshots --repo georgiosbalatzis/f1StoriesPage \
     --body "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/f1-stories"
   gh variable set INTELLIGENCE_SERVICE_ACCOUNT --env intelligence-snapshots --repo georgiosbalatzis/f1StoriesPage --body "$SA"
   ```
6. **Quota and budget alert**: see [Custom BigQuery quota](#custom-bigquery-quota-recommended-owner).
7. **Dry-run (free)**: Actions → Intelligence Snapshot → Run workflow → branch `main`, mode `dry-run`. The log shows,
   per model, processed bytes, tables listed and tables counted, the conservative billed estimate, and then the preflight
   verdict. It covers every mature day since 2026-10-19, up to 28. A missing daily table is listed and fails the run.
8. **Enable** after reviewing the dry-run: a PR that sets `ENABLED = true` in `snapshot.mjs` and updates the test that
   pins it. Then wait for 03:00 Athens or dispatch with mode `refresh`.
9. **Verify** the first refresh: a `chore(intelligence)` commit touching only `dashboard/data/snapshot.json`, a
   Deploy Pages run dispatched by it, then `https://f1-stories.gr/dashboard/` → key → report with the expected
   coverage end date.

## Disable or roll back

- Stop billing runs: a PR setting `ENABLED = false`, or `gh workflow disable intelligence-snapshot.yml`.
- Revoke access: remove the `workloadIdentityUser` binding (or disable the provider), and the two BigQuery grants.
- Withdraw the data: commit the deletion of `dashboard/data/snapshot.json` (the page shows its empty state after the
  next deploy) and rotate the key. Earlier envelopes remain in Git history (see key rotation above).

## First production refresh

The initial authenticated dry-run succeeded on 2026-10-27, covering 5 days (2026-10-19 through 2026-10-23), with conservative estimates of 50 + 50 + 60 + 60 = **220 MiB** (versus 1600 MiB daily and 400 MiB per query). The owner approved enabling billable refreshes while accepting that these limits **do not guarantee** the total Google Cloud account stays below 10 EUR/month. Verify the first scheduled or manually dispatched `refresh` in GitHub Actions and confirm the encrypted envelope is deployed before declaring the dashboard live.

Open items inherited from [bigquery-validation.md](bigquery-validation.md) still apply, such as the unconfirmed
G-X68J6MQKSM stream mapping and the small LCP/INP samples.
