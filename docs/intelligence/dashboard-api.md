# I-06A — Private Intelligence dashboard: authentication foundation

Status: **foundation only. Nothing is deployed and no analytics are served.** `/dashboard/` ships a login shell that
shows *«Ο πίνακας δεν είναι διαθέσιμος»* until the owner deploys and tests the API and then sets its origin in one
reviewed PR. Looker Studio is not used.

## Architecture

```text
https://f1-stories.gr/dashboard/            GitHub Pages: static shell, no key, token or data
  dashboard/index.html · dashboard.js · dashboard.css
  CSP: default-src 'none'; connect-src <API origin> (today: 'none')
        │  fetch(..., { credentials: 'include' }) — cross-origin, same-site
        ▼
https://<name>.f1-stories.gr                Cloud Run (EU), services/dashboard-api/server.mjs
  POST/GET/DELETE /api/session              key login, session check, logout
  GET /api/v1/*                             session required → 503 analytics_not_enabled (until I-06B)
        │  dedicated service account, read-only (I-06B, owner approval)
        ▼
BigQuery f1-stories-analytics.analytics_485678890 (EU) via the reviewed, server-held models 10–33
```

**Why a subdomain of f1-stories.gr, not `*.run.app`:** the session cookie is `SameSite=Strict`, so the browser
only sends it on same-site requests. `f1-stories.gr` → `dashboard-api.f1-stories.gr` is cross-origin but
same-site. A `run.app` URL is another site: the cookie would be a third-party cookie, which Safari and Firefox
block by default. The page script and the security-policy test both refuse any API origin that is not
`https://<label>.f1-stories.gr`.

## What this PR implements

| Piece | Where | Behavior |
| --- | --- | --- |
| Login shell | `dashboard/` | States: unavailable (default, also without JS), checking, login, signed in. Refuses to run framed. The key is read from the input on submit, which is then cleared. No Web Storage, no `document.cookie`, no `innerHTML`, no analytics or consent code. |
| Page CSP | `scripts/build/security-policy.mjs` `DASHBOARD_CSP` | `default-src 'none'`; own script, style, fonts and images only; `form-action 'none'` (a key can never be submitted as a URL); `connect-src` is exactly `DASHBOARD_API_ORIGIN`, or `'none'` while it is empty. |
| Key tool | `services/dashboard-api/keys.mjs` | `new "<label>"` prints the key once (stderr) and the store record (stdout). |
| API | `services/dashboard-api/server.mjs` | Node 22 standard library only; no dependencies. |
| Tests | `services/dashboard-api/test/auth.test.mjs`, `scripts/build/__tests__/security-policy.test.mjs` | `npm run test:dashboard` (in CI), `npm run test:security`. |
| Guards | `validate-public-artifact.mjs`, `static-source-guard.mjs` | `dist/` may not contain `services/`, a key or a verifier; Git may not contain a key or verifier; dashboard sources may not touch browser storage or cookies. |

### Dashboard Access Keys

- Format `f1sdk_<id>_<secret>`: an 8-character public id plus 32 random bytes (base64url). These keys are
  independent of GitHub. They are never a PAT, the publishing token or a repository credential.
- The server stores only `{ id, label, verifier: "sha256:<hex>", revoked }`. SHA-256 is sufficient for a
  256-bit random secret, whose preimage cannot be brute-forced. Slow KDFs (scrypt/argon2) exist to protect
  guessable passwords, and these keys are not guessable. The comparison is constant-time.
- The key store is a JSON file whose path is `DASHBOARD_KEYS_FILE`. In production it is a Secret Manager secret
  mounted as a volume. It is re-read on every authenticated request. If it is missing or malformed, **every key
  is denied** and every session ends.
- **Revocation:** set `"revoked": true` on a record, or delete it, and add a new secret version. The next request
  of any session opened with that key gets 401, because each request re-checks the session's key. Cloud Run
  reads a volume-mounted secret pinned to `latest` from Secret Manager when the file is read. Confirm during the
  smoke test that revocation takes effect without a redeploy. If it does not, redeploy.
- **Rotation:** to replace a key's secret but keep its id, give the record a new verifier. Each session is bound to
  the verifier that was active at login and rechecked on every request. Sessions opened with the old secret
  therefore get 401 on their next request, and the old secret can no longer log in.

### Sessions

- On login the server issues 32 random bytes in `__Host-f1s_dash=…; Path=/; Secure; HttpOnly; SameSite=Strict;
  Max-Age=1800`. Sessions are absolute: 30 minutes from login, never extended. Only a SHA-256 of the token is kept
  in memory.
- Logout (`DELETE /api/session`) deletes the server session and expires the cookie. The page returns to the form
  only after a confirmed 204.
- An expired session is deleted on its first use and never resumed. At most 200 live sessions exist.

### Request rules (default deny)

1. Only `GET /healthz` works without an `Origin`. Every other request must carry `Origin: https://f1-stories.gr`
   and, if present, `Sec-Fetch-Site: same-site`. Otherwise it gets 403 before routing. CORS echoes only that
   origin, with credentials.
2. Only `/api/session` and `/api/v1/*` exist. Everything else is 404.
3. Login accepts only `Content-Type: application/json` (this forces a CORS preflight), bodies up to 1 KiB, and
   one `key` string.
4. Login is rate limited to 5 attempts per client IP and 50 overall per 15-minute window. Attempts are counted
   before the key is checked, so a valid key also waits out the window. The response is 429 with `Retry-After`.
5. `/api/v1/*` answers 401 without a valid session and **503 `analytics_not_enabled`** with one. It accepts only
   `GET`.
6. Every response is `Cache-Control: no-store` and carries `CSP default-src 'none'; frame-ancestors 'none'`,
   `nosniff`, `no-referrer` and HSTS.

| Endpoint | Success | Failures |
| --- | --- | --- |
| `POST /api/session` `{ "key": "…" }` | 200 `{ expiresAt, label }` + cookie | 401 `invalid_key`, 400/413/415 `invalid_request`, 429, 503 `too_many_sessions` |
| `GET /api/session` | 200 `{ expiresAt, label }` | 401 |
| `DELETE /api/session` | 204, cookie cleared | — |
| `GET /api/v1/…` | (I-06B) | 401, 503 `analytics_not_enabled`, 405 |
| `GET /healthz` | 200 `{ ok: true }` | — |

## Future analytics API contract (I-06B, not implemented)

The API runs **only server-held SQL**, the reviewed models rendered by `scripts/intelligence/editorial-model.mjs`
(models 10–15, 20–29, 30–33). The client never sends SQL, column names, table names, filters or sort
expressions. The model files are not changed by the API. It renders them at build time and executes them with
BigQuery query parameters.

```text
GET /api/v1/reports/{reportId}?start=YYYY-MM-DD&end=YYYY-MM-DD[&period=day|week]
```

| Rule | Value |
| --- | --- |
| `reportId` | Fixed allowlist: `article-pageviews` (10), `category-pageviews` (11), `article-engagement` (12), `article-discovery` (13), `publication-age` (14), `editorial-coverage` (15), `daily-activity` (20), `site-sections` (21), `device-category` (22), `country` (23), `acquisition-first-user` (24), `acquisition-collected` (25), `acquisition-session` (26), `engagement-events` (27), `internal-navigation` (28), `audience-coverage` (29), `cwv-summary` (30), `cwv-breakdown` (31), `cwv-trend` (32), `rum-coverage` (33). Unknown → 404. |
| Parameters | Only `start`, `end` (ISO dates) and `period` (model 32 only). Any other parameter is rejected with 400. `@as_of_day` = the server's current date. `@min_events` / `@min_observations` and `@report_timezone` (`America/Los_Angeles`, the property time zone) are server constants that the client cannot lower. |
| Dates | `start ≤ end`, `start ≥ 2026-10-19` (first export day), at most 90 days. The models already cap at 89 days after `start` and drop the last 4 immature days. |
| Bytes | Each job is dry-run first and refused above the cap. Then it runs with `maximumBytesBilled` = 100 MB, because the 10 MB per-table billing minimum makes a KB-scale cap impossible (see [bigquery-validation.md](bigquery-validation.md)). |
| Frequency | Results are cached per `(reportId, start, end, period, as_of_day)` for 6 h. A cache miss counts against 1 query per report per session per minute and a global daily ceiling (proposed: 200 jobs per day). Over the limit → 429. |
| Output | `{ reportId, start, through, asOf, rows: [...], suppressed: n }`. Rows contain only the model's aggregate columns, with cells below the minimum-count threshold suppressed. No `user_pseudo_id`, `ga_session_id`, client IDs, raw events, IP or free-text query strings ever leave the server. |
| Errors | BigQuery error text is logged server-side and never returned. The client gets `{ error: "report_failed" }`. |

**Service identity (owner approval required, not created here):** a dedicated service account,
`dashboard-api@f1-stories-analytics.iam.gserviceaccount.com`, with:

- `roles/bigquery.jobUser` on the project;
- read access to the GA4 export dataset only, never project-wide `dataViewer`. Recommended alternative: grant it
  access only to a separate dataset of authorized aggregate views, so even a compromised service cannot read raw
  events;
- `roles/secretmanager.secretAccessor` on the key-store secret only.

It uses no user credentials, no JSON key file and no GitHub credential.

## Serving the API on an f1-stories.gr subdomain

Either option keeps the same-site requirement: the API must answer on `https://<label>.f1-stories.gr`. The
`*.run.app` URL must never be configured as `DASHBOARD_API_ORIGIN`. Neither option is provisioned by this PR.
Google's page [Mapping custom domains](https://docs.cloud.google.com/run/docs/mapping-custom-domains), read
2026-10-27, is the source for both.

| | Direct Cloud Run domain mapping | Global external Application Load Balancer |
| --- | --- | --- |
| Launch stage | **Preview.** Google: "not production-ready", not covered at GA, and "not recommended for production services" because of latency issues. | GA. The option Google recommends. |
| Setup | One domain mapping plus the DNS records Google shows. Lowest effort. | Serverless NEG, backend service, URL map, HTTPS proxy, certificate, a reserved global IP and an `A`/`AAAA` record. More infrastructure to own and review. |
| Cost | No extra Google Cloud resource. | Forwarding-rule and data-processing charges, separate from Cloud Run. Check current pricing before approving. |
| Regions | Only some regions. In the EU: `europe-north1`, `europe-west1`, `europe-west4`. | Any Cloud Run region. |
| TLS | Google-managed certificate only. Provisioning takes about 15 minutes, up to 24 hours. TLS 1.0/1.1 cannot be disabled. No own or wildcard certificates. | Google-managed or own certificate; an SSL policy can set the minimum TLS version. |
| Extra controls | None. | Cloud Armor (WAF and rate limiting at the edge) and logging. Set Cloud Run ingress to *internal and Cloud Load Balancing*, so the `run.app` URL cannot bypass the balancer. |
| `X-Forwarded-For` | The rightmost hop is the client, which matches `clientIp()` in `server.mjs`. | The balancer appends `<client>, <balancer>`, so the rightmost hop is the balancer. Change `clientIp()` to the second hop from the right **before** relying on the per-IP limit. Until then it acts as a second global limit. |

**Recommendation:** the load balancer for anything beyond a trial. Direct mapping is acceptable only for an owner-only
trial that accepts Preview latency and TLS limits, and it should be replaced before more readers get keys.

## Deployment prerequisites (owner; nothing here was run)

1. **Approve** the Cloud Run service, the service account, the secret, the chosen domain option (with its cost) and
   the DNS records in `f1-stories-analytics`. These may incur cost.
2. **Region:** an EU Cloud Run region. With direct domain mapping it must be `europe-north1`, `europe-west1` or
   `europe-west4`. With a load balancer, any EU region. See *Serving the API on an f1-stories.gr subdomain*.
3. **Keys:** `node services/dashboard-api/keys.mjs new "owner"`. Keep the printed key in a password manager. Put
   `{"keys":[<record>, …]}` into a new secret, for example `dashboard-access-keys`. Never commit either.
4. **Deploy** from `services/dashboard-api` (the Dockerfile copies only `keys.mjs` and `server.mjs`) with:
   - `--region <EU region> --service-account dashboard-api@… --max-instances=1` (sessions and limits are in memory);
   - `--allow-unauthenticated` (the browser calls it; the app authenticates);
   - `--set-env-vars DASHBOARD_ALLOWED_ORIGIN=https://f1-stories.gr,DASHBOARD_KEYS_FILE=/secrets/keys.json`;
   - `--set-secrets /secrets/keys.json=dashboard-access-keys:latest`.

   The server refuses to start without both variables, or with any other origin.
5. **Domain:** serve `dashboard-api.f1-stories.gr` (or another single label) through the chosen option above.
   With the load balancer, also restrict Cloud Run ingress and fix `clientIp()`. Confirm HTTPS and that the
   certificate has been issued.
6. **Smoke test** against the deployed API. Cover each of the following:
   - `/healthz` returns 200;
   - a missing or wrong `Origin` gets 403;
   - no cookie gets 401 on `/api/session` and on `/api/v1/x`;
   - a wrong key gets 401;
   - six attempts get 429;
   - a valid key returns the `__Host-` cookie with every attribute;
   - `/api/v1/x` with a session returns 503;
   - logout, then 401;
   - revoke the key in a new secret version, then 401 with the old session;
   - rotate a key's verifier under the same id, then 401 with the old session and with the old secret;
   - wait past 30 minutes (or check `expiresAt`), then 401.
7. **Enable the page in one PR:** set `DASHBOARD_API_ORIGIN` in `security-policy.mjs`, the same value in
   `dashboard/index.html` `f1s-dashboard-api`, and add the origin to `APPROVED_CSP_EXTERNAL_SOURCES` in
   `static-source-guard.mjs`. Run `injectSecurityMeta` on the page source (the test names the mismatch). Then run
   `npm run test:security`, `npm run quality:static` and `npm run build:public`.
8. Analytics stay disabled until I-06B implements the contract above, with its own review and tests.

## Limitations

- **Single instance.** Sessions and rate limits are in memory, so `max-instances=1` is required. A restart signs
  everyone out, and the limits reset. Moving to several instances needs a shared store (Firestore or Memorystore),
  which is a later change.
- **Client IP.** The per-IP limit trusts the rightmost `X-Forwarded-For` hop. That is the client with direct domain
  mapping, but the balancer behind an Application Load Balancer, which needs the one-line change described above.
  The global limit and the 256-bit keys are the real brute-force defence.
- **Direct domain mapping is Preview.** Choosing it accepts Google's latency and TLS limitations (see the table
  above).
- **No clickjacking header on the page.** GitHub Pages cannot send `frame-ancestors`, and a meta CSP cannot carry
  it. The page refuses to run inside a frame instead. The API itself sends `frame-ancestors 'none'`.
- **Page integrity.** Anyone who can merge to `main` can change the shell's script. Branch protection and review
  remain the control. The API never trusts the page: it trusts only the key, the cookie and the origin.
- **No expiry per key** and no audit log beyond Cloud Run request logs, which record method, path, status and IP,
  never keys or cookies. Both can be added when there is more than one reader.
- **Logout is per session.** Revoking a key ends all of its sessions.
