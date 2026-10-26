# F1 Stories Intelligence — I-01 infrastructure and event inventory

Status: **inventory only.** Nothing here changes tracking, consent, deployment, GA4 settings or BigQuery. The SQL has
**not** been executed or dry-run against any project (see [validation.md](validation.md)).

Baseline: `main` at `5572beb7`, which is also the Main `sourceSha` in the live
`https://f1-stories.gr/deployment-manifest.json` (read 2026-10-26).

| Document | Contents |
| --- | --- |
| [event-inventory.md](event-inventory.md) | Every emitted event and parameter, page/path classification, article identity, `/telemetry/` `/ghostcar/` `/tyres/` `/betcast/` coverage |
| [metrics-contract.md](metrics-contract.md) | Metric definitions, units, versions, revision dedup, GA4 vs BigQuery, freshness, EU location, data minimization |
| [sql/](sql/) | Read-only, parameterized, suffix-bounded inventory queries |
| [validation.md](validation.md) | What was checked, unknowns, SQL dry-run status, public artifact impact, I-02 acceptance criteria and blockers |

The Web Vitals contract and its p75 report are owned by [perf/rum-pilot/](../../perf/rum-pilot/README.md) and are
referenced, not copied.

## Evidence labels

- **[R]** repository fact at `5572beb7` (or a child repository at its pinned lock SHA).
- **[L]** observed in live public HTML/JSON with plain GET requests on 2026-10-26 (no JavaScript executed, no events sent).
- **[U]** unverified: GA4 property settings, BigQuery link, export contents, freshness, location. Needs an authorized owner.

## Architecture

```text
Main page (one origin: f1-stories.gr)
 ├─ cookie-consent.js     localStorage `f1stories-cookie-consent-v1` = {ts, essential:true, analytics:bool}
 │                        dispatches `f1stories:cookie-consent-changed`
 ├─ analytics.js          gtag consent default/update; injects gtag.js ONLY when analytics:true
 │    ├─ page_view (GA4 config, automatic)
 │    ├─ internal_page_click · outbound_click · article_share · article_engaged
 │    └─ window.f1storiesAnalytics.trackEvent(name, params)   ← shared consent-checked pipe
 ├─ blog-fixes.js         article_share (copy_link / native_share)        → trackEvent
 ├─ blog-index.js         journal_search                                   → trackEvent
 ├─ error-beacon.js       js_error                                         → gtag directly
 └─ web-vitals-beacon.js  after consent + load + idle → web-vitals-collector.js → web_vital → trackEvent
                                   │
                                   ▼
                     GA4 property (measurement ID G-X68J6MQKSM) [R]
                                   │  BigQuery link: [U] existence, project, dataset, location, daily/streaming
                                   ▼
                     `{{PROJECT_ID}}.analytics_{{GA4_PROPERTY_ID}}.events_YYYYMMDD` [U]

/telemetry/ /ghostcar/ /tyres/ /betcast/ — separate repositories, assembled into the same Pages artifact.
No GA4, consent or Web Vitals reporting code in any of them [R][L].
```

Deployment boundary [R]: `scripts/deployment/sources.json` pins each child repository by SHA; `assemble.mjs` copies
child output into its namespace and does not inject Main scripts. `docs/deployment-architecture.md` records the
decision "do not inject [CSP] or analytics into child apps". Shared origin means shared `localStorage` and `_ga`
cookies are *readable* by child code, not that child pages are measured.
