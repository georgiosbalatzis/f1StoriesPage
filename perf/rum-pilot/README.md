# Step 8 — consent-gated Web Vitals pilot

Status: candidate instrumentation; production reporting approval still requires a verified observation-level export. Nothing here enables an export, changes GA4 permissions, merges, or deploys.

Baseline: `db470668` (main, including #301, #303 and #304). The existing approximate reporter is replaced, not run alongside the official reporter. `web-vitals` **6.2.3**, standard build, exact npm lock, is bundled locally by esbuild. The shipped license is `/assets/licenses/web-vitals-Apache-2.0.txt`. No attribution build, CDN, new service, storage, visitor ID, or diagnostic payload is added.

## Collection and consent

The existing stamped `web-vitals-beacon.min.js` becomes a small loader. Only explicit `analytics: true` in the existing consent storage permits its one local module import, after document `load` and `requestIdleCallback` (3s timeout; timer fallback). The collector rechecks consent before installing observers and every callback. GA4 uses the existing `f1storiesAnalytics.trackEvent` pipeline. `analytics.js` and the banner are unchanged: #303's article GA download gate remains after document load.

All five official callbacks (`onLCP`, `onINP`, `onCLS`, `onFCP`, `onTTFB`) register once, using default reporting options. No custom metric calculation is used. CLS uses the library session-window metric and valid zero values are retained. INP uses the official interaction-count methodology; no interaction or no supported observation means **no INP row**, never an invented zero. Any zero supplied by an official callback is retained. Browser-provided timing restrictions, unsupported APIs, and background/prerender behavior remain subject to the library.

Callbacks can report revised CLS/INP after subsequent backgrounding; they must not freeze at the first hide. Changed values retain the official metric ID and increment `metric_revision`. Unchanged repeated callbacks and `pagehide` produce no duplicate snapshot. There is no separate pagehide reporter. The official library handles visibility and BFCache, including new metric IDs and navigation types for restored visits. A restoration never re-registers the observers. Viewport category resets at restoration, before library callbacks run.

Same-document withdrawal or cross-tab withdrawal permanently suppresses this collector's reporting for that document, including BFCache and later reacceptance. New document navigation can start afresh after consent. The official library has no observer disposal API: its in-memory observers remain until document destruction, but subsequent values are discarded and never queued/replayed. Withdrawing consent while the module is loading also prevents startup. No collector download or observation starts for a declined first visit. No new cookies/localStorage entries are written.

## Event contract

GA4 event remains `web_vital`. Explicitly filter `measurement_version = 'wv6.2.3-rum1'`; events lacking it are legacy approximations and must never enter this dataset.

| Parameter | Meaning |
| --- | --- |
| `metric_name` | Official `LCP`, `INP`, `CLS`, `FCP`, `TTFB` |
| `metric_value` | Official absolute value, milliseconds; **CLS × 1000**, retaining decimals and zero. Divide CLS by 1000 for reports. No delta summation. |
| `metric_id` | Library-generated ephemeral metric identity, not a user/session ID |
| `metric_rating` | Library `good`, `needs-improvement`, `poor` |
| `nav_type` | Official library navigation type, including `back-forward-cache` |
| `page_group` | `home`, `edition`, `article`, `standings`, `other` |
| `viewport_category` | `mobile_like` for inner viewport width <768 CSS px; otherwise `desktop_like`, fixed for each observed navigation |
| `measurement_version` | `wv6.2.3-rum1`; change when implementation/schema semantics change |
| `metric_revision` | 1-based snapshot revision within this metric ID; latest wins, including decreasing INP |
| `nav_start_ms` | Epoch milliseconds: `performance.timeOrigin` + the library's `navigationStartTime`; used for navigation-date cohorts |
| `measurement_coverage` | `delayed_existing`, `delayed_consent`, or `bfcache_observed` |
| `observation_start_ms` | Time after initial navigation when observation started; 0 for an already observed BFCache restoration |

The existing CLS ×1000 units are preserved; the new version retains official numeric precision instead of rounding to integers. The legacy `metric_delta` and redundant `page_path` parameters are removed.

`home` covers `/` and `/index.html`; `edition` covers `/blog-module/blog/` including archive/section pages; `article` covers `/blog-module/blog-entries/`, including source-less historical articles; `standings` covers `/standings/`. Everything else is `other`. Queries/hash, paths, element text, targets, entries, interactions, forms, user IDs and attribution traces are not added to this payload. Existing GA4 automatic parameters/privacy behavior are unchanged.

**Coverage is part of every result.** Initial navigations always have delayed coverage, even with returning consent. Buffered paint/navigation entries can recover earlier timing, but buffers can be incomplete/evicted, event counts can precede observation, and earlier visibility/interaction history may be unavailable. In particular, a buffered layout-shift batch spanning multiple session windows is not evidence of complete lifetime coverage. Do not relabel a delayed observation as complete because it contains an LCP or zero CLS. `bfcache_observed` means the collector was already registered at restoration and consent remained valid; it is still subject to browser support and delivery loss. It does not claim iframe coverage.

## Reporting feasibility and approval prerequisite

A read-only attempt to list GA4 properties on 2026-10-20 failed: the connected GSC Wizard tool returned `payment_required` / `subscription_required`. No property, custom definitions, BigQuery link, or private observations could be inspected. No credentials were requested and no account changes were made.

GA4 event delivery alone does **not** establish a usable RUM program. Standard eventCount counts snapshots, not metric observations. GA4 aggregated custom metrics/averages cannot reconstruct arbitrary p75 or distinguish revised observations. Registering metric IDs or exact numeric values as high-cardinality custom dimensions is not an acceptable workaround; reports can be sampled, thresholded or condensed into `(other)`. The current reporting access/setup is therefore **unverified and insufficient for production approval**.

The credible path is an **already authorized raw GA4 export**, such as an existing BigQuery daily export, or an equivalent authorized event-level extract containing every parameter above, timestamps and complete updates. An authorized property owner must confirm that export exists and that a permitted analyst can read it. If none exists, approval to enable a new export is a separate prerequisite; this PR does not enable one. Standard GA4 reports alone are not a substitute. Raw exports do not require registering these fields as custom definitions. Low-cardinality fields may optionally be registered for exploratory GA4 filtering, but that does not supply exact percentiles.

Before deployment approval, an authorized analyst should:

1. Verify the property/stream corresponds to the site's existing measurement ID; verify export coverage, timezone and retention. Confirm data is unsampled and no rows/updates are truncated. Do not copy visitor identifiers into the RUM extract.
2. Validate a small **authorized** production sample after a separately approved deployment: schema, units (CLS ×1000), version, consent, navigation dates and same-ID revisions. Local automated validation never sends events to the real property.
3. Use [report.sql](report.sql), replacing only the authorized dataset and query parameters. Scan daily tables from deployment through a stated analysis cutoff; use navigation dates for the cohort, and keep the highest revision per `(version, metric_name, metric_id)`. Do not use maximum value: official INP can decrease. Do not count revisions as visitors or observations. Remove duplicate transport copies by the same identity/revision.
4. Check extraction completeness, missing fields, unexpected cardinalities, duplicate/conflicting revisions, export freshness and GA4's late daily-table updates before publishing. State the cutoff: even the latest received revision can be censored by a still-open page or lost beacon. Re-run after late arrival and label revisions to the report.
5. Calculate exact `PERCENTILE_CONT(0.75)` across deduplicated absolute values; count non-null observations independently for LCP, INP and CLS. Apply date, group, viewport, version, coverage and navigation-type filters **after** resolving updates. Do not substitute an average or average daily p75 values.

The SQL is reviewable but has not run against private production data. Reporting access remains a separate prerequisite, not an assumed success.

Official references: [library version and lifecycle contract](https://github.com/GoogleChrome/web-vitals/tree/v6.2.3), [GA4 reporting schema](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema), [BigQuery export](https://support.google.com/analytics/answer/9358801), [export schema](https://support.google.com/analytics/answer/7029846).

## First 28 complete days

Use the GA4 property's timezone and the first midnight **after** deployment as day 1. Include 28 complete navigation-date days; record deployment timestamp/version and analysis cutoff. Allow daily export late arrivals (up to 72 hours) before the first report, then state any later snapshot/censoring limits. Long-lived visits can update outside their starting day, which is why extraction extends through the cutoff and dates are filtered after deduplication.

Produce the following table **separately for each coverage class**, with navigation-type breakdowns alongside it. Delayed rows are observed-portion results, not complete page-lifetime CWV. `other`, FCP and TTFB remain supporting diagnostics.

| Group | Device category | LCP p75 | INP p75 | CLS p75 | Sample counts (LCP / INP / CLS) |
| --- | --- | --- | --- | --- | --- |
| Home | Mobile-like / Desktop-like (separate rows) | — | — | — | — / — / — |
| Edition | Mobile-like / Desktop-like (separate rows) | — | — | — | — / — / — |
| Articles | Mobile-like / Desktop-like (separate rows) | — | — | — | — / — / — |
| Standings | Mobile-like / Desktop-like (separate rows) | — | — | — | — / — / — |

Good thresholds: **LCP ≤2500ms; INP ≤200ms; CLS ≤0.1**. Show counts for each metric and preserve missing cells as unavailable. A metric sample counts a measured navigation/metric, not a unique visitor. Do not infer no-interaction visit counts from missing INP alone; unsupported APIs, consent, delay, hidden initial load, blocked analytics and lost delivery also cause missing observations. There is no full-visitor denominator in this schema.

Report consent bias, unsupported browsers/APIs, missing/zero distinctions, missing iframe observations, delayed starts and buffer loss, BFCache differences, right censoring/last received snapshots, blocked/lost events, and small samples. Show the observed counts and uncertainty rather than inventing a minimum sample size. Do not pool sparse cells silently. Any confidence interval must state its estimator and independence assumptions (multiple visits by the same person cannot be identified here). This consent-gated cohort does not represent all visitors. Viewport groups are **not CrUX device classifications**, and these data are not interchangeable with CrUX.

## Reproduction

```sh
npm ci
npm run build:public
npm run test:consent
npm run test:rum:browser
# Separate clean baseline built from db470668:
node scripts/perf/rum-performance.mjs /path/to/baseline/dist /tmp/rum-performance.json 3
```

Tests use deterministic observer fixtures plus independent official callback registrations, and real Chrome lifecycle fixtures with mocked GA4. The browser fixture requires actual BFCache restoration, trusted input and actual tab visibility changes. The paired performance harness uses cold contexts, gzip, Slow 4G (1.6Mbps down, 750kbps up, 150ms RTT), CPU ×4, returning consent, three alternating pairs per viewport on five routes. External requests are locally fulfilled/blocked; this controls transport and does not benchmark Google's live response time. Do not run other browser benchmarks concurrently.
