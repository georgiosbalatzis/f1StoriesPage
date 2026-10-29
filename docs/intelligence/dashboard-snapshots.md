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
    refresh   daily tables exist → 7 dry-runs → cost preflight → 7 capped queries → validate → AES-256-GCM
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
| Models | `10-article-pageviews` (I-06C1), `11-category-pageviews`, `13-article-discovery` (I-06C3, weekly), `20-daily-activity`, `26-acquisition-session` (7 days), `28-internal-navigation` (I-06C3, weekly), `29-audience-coverage` (7 days), `30-cwv-summary`, `33-rum-coverage`, rendered by `editorial-model.mjs` (SQL not copied or changed). Seven run per refresh; see [I-06C3](#i-06c3--editorial-discovery-weekly-rotation) |
| Source | `f1-stories-analytics.analytics_485678890`, location `EU`, daily `events_YYYYMMDD` tables only |
| `@as_of_day` | today in the property time zone `America/Los_Angeles`, computed when the job runs |
| Window | Primary: mature rolling 28 days. Session acquisition + audience coverage: same mature end day but rolling **7 days** (or fewer since 2026-10-19). Both are separately labeled in the encrypted payload. |
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
| Nine allowlisted models, at most seven run per refresh; no client-supplied SQL | `SNAPSHOT_MODELS`, `schedule()` |
| Mandatory dry-run of every query of the day before any execution | `refresh()` |
| Conservative estimate per query: max(processed bytes rounded up to 1 MiB, 10 MiB × tables) | `conservativeBytes()` |
| Table count: max(tables the dry-run lists, daily tables the model's base scans), so one listed wildcard still counts 28/29 | `scannedTables()` |
| Per query: estimate ≤ 400 MiB, else nothing runs | `preflight()` |
| `maximumBytesBilled = 419430400` (400 MiB) on every query, enforced by BigQuery | `bigQuery().run()` |
| Combined daily ceiling 1600 MiB: the sum of estimates, checked before running; billed bytes, checked after each query | `DAILY_MAX_BYTES` |
| No billable retries: one insert per query, no retry loop; reruns reuse the same job id | `bigQuery().run()` |
| One successful refresh per `as_of_day`; one schedule per day | `plan()`, workflow |
| No browser query: the page has `connect-src 'self'` and fetches one static file | CSP, tests |

**Why 400 MiB.** On-demand pricing bills at least 10 MiB per referenced table. The editorial and audience models scan
the window's daily tables (28 at full length), and the RUM models also scan the day before (29). With I-06C1 and I-06C2, the full-window plan is 280 + 280 + 280 + 70 + 70 + 290 + 290 = **1560 MiB**, below the
unchanged 1600 MiB daily ceiling, and each query remains below 400 MiB. A dry-run may list a wildcard scan as a single
table, so the estimate never uses fewer tables than the base actually scans. A 4-day window plans 40 + 40 + 40 + 40 + 40 + 50 + 50 = 300 MiB.

**Expected volume.** About 1.52 GiB per day at the conservative per-table minimums (full windows), ≈ 47.2 GiB per 31-day month. The caps allow at most
1600 MiB per day, ≈ 48 GiB per month. Both sit well inside BigQuery's monthly free on-demand allowance, *if* nothing
else in the billing account uses it, and are small at list price beyond it. Check the current EU on-demand price
and free tier on Google's pricing page; they are not restated as fact here.

Limitations:

- **Not a total-cost cap.** These limits do not cover storage, the GA4 export, other BigQuery users or projects,
  or any other Google service. They cannot keep the account under 10 EUR on their own.
- With seven queries per refresh, the 1600 MiB daily ceiling is stricter than the combined per-query caps (2800 MiB).
  It preflights the entire plan and checks billed bytes after each query; it cannot undo a query already run.
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


## I-06C1 — Article performance expansion

I-06C is shipped in focused stages: **article performance**, then editorial discovery and audience/acquisition,
and finally full coverage validation. This stage reuses the existing reviewed SQL model
`10-article-pageviews` without changing its SQL or reporting rules. Its result is encrypted in the same AES-256-GCM
snapshot as the first four models.

The dashboard displays up to 15 recognized articles sorted by consented `page_view` event count. Titles and
categories are public article catalog metadata. It excludes the `(unmapped)` aggregate from the ranking and
reports its pageview count separately (no unmapped URL keys are exposed). All articles below the
30-event threshold are explicitly labeled as **small sample**, not hidden and not presented as a
reliable popularity ranking. These are *events*, not unique readers or views from the whole audience.

**Compatibility:** Existing four-model encrypted snapshots remain decryptable and continue to show the original
dashboard panels. The new ranking panel displays a pending message until the next successful five-model
snapshot. No new encryption key, service account, IAM grant, API, storage service or infrastructure is required.

**Cost:** This adds only one additional bounded query per daily refresh. The owner-approved 400 MiB maximum per
query and 1600 MiB total preflight/billed guard are unchanged. Its full 28-day conservative plan is 1420 MiB,
and the five-day plan is 270 MiB, not an exact billed-byte figure. The prior production four-model run on
2026-10-27 billed 40 MiB; a live five-model cost is **not validated yet**. Query caps and alerts are not
a guaranteed EUR 10 total Google Cloud billing limit.

**First live check after merge:** Review the five model dry-run estimates, the actual
`totalBytesBilled` in the snapshot logs, the produced encrypted-only artifact and the new article ranking.
If cost preflight refuses the expanded window, leave the previous snapshot published and investigate, without
raising the limits automatically.

## I-06C2 — Session acquisition with data-quality coverage

Uses the two **existing, unchanged, production-executed** I-04 models:
`26-acquisition-session` and `29-audience-coverage`. Both share a **7-day rolling mature window**
(or fewer while the export is young), ending on the same `as_of_day − 4` as the primary 28-day report.
The authenticated encrypted payload includes `modelWindows` for sub-windows, without modifying the public
envelope format or re-keying. Old four-/five-model envelopes remain decryptable; the acquisition panel
shows a pending message until its first successful snapshot.

**Interpretation:** `26` is GA4's own cross-channel session-last-click attribution, not first-user acquisition,
the event-scope collected UTM classification, Google Search Console clicks, inferred sessions or unique readers.
`session_start_events` and `page_view_events` are counts of consented GA4 events only. Classifications use
allowlisted channel, medium and source family, never raw source/campaign/click-id strings. At this readership,
most breakdowns are below the 30-event threshold and are labeled **small sample**. Unattributed and unknown
are not Direct. Model `29` reports unknown/unattributed counts and consent/host coverage for the same window;
both must succeed for any new snapshot to publish.

**Cost:** The primary five queries retain their 28-day mature window; the two I-06C2 queries each scan at most
7 daily tables. With the 10-MiB-per-table conservative assumption, the 28-day combined plan is **1560 MiB**
(1420 + 70 + 70), under the unchanged **1600 MiB per-day** preflight ceiling and **400 MiB per-query**
`maximumBytesBilled`. If actual dry-run bytes increase and preflight exceeds 1600 MiB, the workflow
fails closed without executing or publishing; never automatically relax limits. First actual totalBytesBilled
for the seven-model version remains unverified before rollout. The project budget alert of 10 EUR/month is **not**
an absolute spending cutoff and no custom BigQuery quota was configured.

No additional Cloud IAM, secrets, network endpoints, JavaScript storage, browser BigQuery access, or analytics
tracking are introduced. The previous encrypted snapshot remains public and valid if the new refresh fails.

## I-06C3 — Editorial discovery (weekly rotation)

Reuses two **existing, unchanged** models: `13-article-discovery` (I-03) and `28-internal-navigation` (I-04). No
SQL, source/section classifier, GA4 tracking or consent code changes.

**The cost conflict.** With d mature days (at most 28) and a acquisition days (at most 7), the seven daily models plan
10 · (5d + 2) + 20a MiB at the 10 MiB-per-table floor: **1560 MiB** at full length. That leaves 40 MiB under the
unchanged 1600 MiB ceiling. Each discovery model scans d tables (d · 10 MiB). Options considered:

| Design | Worst day (floor) | Discovery coverage | Verdict |
| --- | --- | --- | --- |
| Add 13 + 28 daily at 28 days | 2120 MiB | 28 days | exceeds 1600 |
| Add 13 + 28 daily within the 40 MiB headroom | 1600 MiB | **2 days** | misleading, rejected |
| Weekly: 13 + 28 over 7 days in place of the acquisition pair | 1560 MiB | 7 days | almost every row a small sample; acquisition stale weekly |
| Weekly: 13 + 28 over 28 days in place of 10 + 11 | 1560 MiB | 28 days | article rankings stale weekly |
| **Weekly: 13 + 28 over the primary window in place of the RUM pair (30 + 33)** | **1540 MiB** (normal days 1560) | **28 days** | **chosen** |
| Relax the per-table floor using observed billing | — | — | rejected: weakens the conservative estimate |

**Chosen design (`schedule()` in `snapshot.mjs`).**

- *Normal day:* 10, 11, 20, 26, 29, 30 and 33 run, as before. The most recent discovery results are carried from the
  previous snapshot and labelled with their own `as_of` day. Carried discovery older than 13 days is dropped, and
  the panel shows "pending".
- *Discovery day:* discovery is due when it is missing or at least 7 days old, **and** the previous snapshot is exactly
  yesterday's and contains both RUM models. That day, 10, 11, 13, 20, 26, 28 and 29 run. 30 and 33 are carried from
  yesterday and labelled in the Core Web Vitals and RUM panels.
- If RUM cannot be carried (a missed schedule, a rotated key, a damaged or legacy-shaped snapshot), discovery waits.
  It never runs at the cost of an unlabelled gap.
- Every day: seven queries, one refresh, every query dry-run and preflighted, `maximumBytesBilled` 400 MiB, and the
  1600 MiB ceiling. Nothing about the limits changed.
- Carried rows come from the previously published envelope. They are decrypted with the same key, authenticated by
  AES-GCM, and accepted only when every row covers exactly the window the rules give for its `as_of` day.

**Reporting windows.**

| Models | Window | Refresh |
| --- | --- | --- |
| 10, 11, 20 | primary: latest 28 mature days (fewer since 2026-10-19) | daily |
| 26, 29 | latest 7 mature days within the primary window | daily |
| 30, 33 | primary | daily, except discovery days (carried from the day before, labelled) |
| **13, 28** | **primary, as of their discovery day** | **weekly**, carried in between (labelled with their age) |

**Worst-case conservative cost** (10 MiB × scanned tables; RUM scans one extra day):

| Day type | Full window (d = 28) | 4-day window |
| --- | --- | --- |
| Normal | 280 + 280 + 280 + 70 + 70 + 290 + 290 = **1560 MiB** | 300 MiB |
| Discovery | 280 + 280 + 280 + 280 + 70 + 280 + 70 = **1540 MiB** | 280 MiB |

The maximum planned daily bytes stay at **1560 MiB** for every supported window (a test checks every window from 1 to
28 days and both day types). The only live evidence so far is one 4-model refresh on 2026-10-27. It billed **10.00 MiB per
query** against 50–60 MiB planned, so the wildcard appears to be billed as one table. That is a single observation;
the conservative floor is kept.

**What the panel shows** (`/dashboard/`, *Εσωτερική ανακάλυψη άρθρων*):

- **A. Where article clicks originate:** model 13 summed by `source_surface` (`home`, `article`, `edition`,
  `entity_hub`, `authors`, `standings`, `other`). Clicks to unmapped destinations are counted here and stated
  separately.
- **B. Which elements attract clicks:** model 28 summed by `link_section`, the I-04 allowlist of `analytics.js`
  `classifyLink()` values. `article_link` covers cards, grids **and** previous/next links. The tracking does not
  separate them, so the panel does not invent a "next up" class.
- **C. Most-clicked articles:** model 13 summed by canonical `destination_article_id`. The models map retired aliases
  to their live article, so nothing is double-counted. `(unmapped)` is excluded from the ranking, and the top 15 are
  shown.
- **D. Section to section:** model 28 summed by (`source_section`, `destination_section`), the I-01 `classify_path`
  classes. These are click pairs, not reconstructed journeys or sessions.
- Each class shows a Greek label next to its raw value. Unknown values are shown as is. Every row shows its count and
  a small-sample flag (sum < 30). There are no rates, conversions or session inferences. The Greek notes state that a
  click is not a page view or visit and does not prove the destination loaded, that clicks without consent,
  modifier/middle clicks and typed URLs are never recorded, and that zero does not prove non-use.

**Compatibility.** The envelope format and header are unchanged. Snapshots without discovery (4-, 5- and 7-model)
open as before and show the discovery panel as pending. Discovery appears on the first discovery day after merge:
the day after any snapshot with yesterday's RUM, normally the next scheduled run.

**Guards.** Both new model names are in the plaintext guards of `validate-public-artifact.mjs` and
`static-source-guard.mjs`; a test derives the required list from `SNAPSHOT_MODELS`. No new secret, IAM permission,
Google Cloud service, network origin or CSP change.

**Production validation still required:** the first discovery-day dry-run and its `totalBytesBilled` (expected ≤ 1540 MiB
planned, about 70 MiB billed if the 10 MiB-per-query pattern holds); that `internal_page_click` rows carry
`page_location`, `link_path` and `link_section` as `analytics.js` sends them (marked unverified in
editorial-model.md); and a check that carried Core Web Vitals labels appear on that day.


## I-06D — Editorial Intelligence interface and presentation

The I-06D redesign is **presentation-only**. It changes `dashboard/index.html`, `dashboard/dashboard.css`,
`dashboard/dashboard.js` and the synthetic Chrome regression. No BigQuery SQL model, scheduler, query budget, snapshot
schema, encryption primitive, IAM permission, browser network origin, CSP or consent behaviour changes.

**Form: the running order.** The page uses the F1 Stories article grammar rather than a control-room template:

- **Document band:** the site's black slab, `#0f100e`, in both themes. It holds the period, the last successful update
  and the stale warning.
- **"Με μια ματιά":** one factual line per section, with its period, linking to the section. This replaces KPI tiles.
- **Running-order rail:** a sticky rail at ≥ 1100 px, showing each section's status.
- **Sections:** each has a reading column and a margin where its caveats sit, next to the figure they qualify.

The visual system is IBM Plex Sans for all Greek text (sentence case, as on the site), Barlow Condensed only for the
band and section numerals (counts in tables are Plex with tabular figures), square edges, hairline rules and no gradients, shadows or cards.

**Chart grammar.**

- **Daily activity:** one accent column per export day, on a scale that always reaches the 30-event sample threshold,
  which is drawn as a labelled dashed line over the columns. A column under 30 is tinted and outlined, the same
  small-sample mark as the ranking bars; a day with zero views is a grey baseline tick. Square columns. Weekends (race
  weekends) are banded. The only line is the 7-day mean, drawn as a step per day from the seventh day on: nothing is
  interpolated between raw daily values. Pointer hover (or a tap) shows the day, its views and its 7-day mean. The
  columns sweep in once (not under reduced motion; a height-only resize does not replay it). The chart is drawn at its
  real pixel width, so labels stay 12 px at every size.
- **Rankings** (articles, channels, destination articles): classification tables. Each row has a position, the name
  with one meta line (raw class or category), and the count. Its accent bar sits on the same threshold scale, and a
  tick marks 30. A bar below the threshold is tinted and outlined, so the same series stays visible. Below the threshold
  is stated once in the notes, and per row only for assistive technology. No per-row "μικρό δείγμα" repetition.
- **Count ledgers** (categories, discovery surfaces, link sections): one dot per event in rows of 30 over an empty first
  row, so how far a count is from the threshold is visible. Above 90 the ledger falls back to the threshold scale.
- **Section to section:** a source × destination matrix of click counts, with a total column. Accent shading only helps
  find the larger cells, and empty pairs are dots.
- **Core Web Vitals:** bullet rows for every metric × coverage class (never pooled), p75 against the good,
  needs-improvement and poor zones in green, yellow and magenta-red (kept off the accent hue), always named in a key. The
  pointer marker is filled at 30 or more observations and hollow below.
- **RUM checks:** an OK / Προσοχή ledger.

The exact tables remain behind native `details` for every section.

**Colour discipline.** The accent (#366's, `--accent`) is the data colour and marks the running-order numbers.
Anything that needs action (a stale snapshot, data-quality warnings, an overdue weekly refresh) is a filled accent chip,
so an alert never reads as data. Carried and weekly states are information: prominent, but not a chip.

**Unchanged contracts.** Values are `textContent` or SVG attributes only. Locking empties every chart, table, list,
summary line and rail status. Snapshots with 4, 5, 7 or 9 models still render, with pending states for what is
missing. The weekly discovery age, the carried Core Web Vitals note and every unit, consent and small-sample note
remain.

**Release checklist.** Run the site quality gates and `npm run test:dashboard:browser`, which covers 390 px dark and
1280 px light with synthetic snapshots and key isolation. Visually review long Greek titles, a single-day window, a
missing acquisition model, pending discovery and the carried CWV note in both themes. Do not auto-merge; the owner
reviews the appearance first.
