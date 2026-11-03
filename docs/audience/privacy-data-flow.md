# Audience privacy and data flow

Status: A-01 audit; base `58331f9fb`; investigation 2026-11-03 UTC.
This is not a legal opinion; no compliance is certified.
[Evidence labels](measurement-contract.md#evidence-labels) describe evidence and do not
replace Intelligence statuses.

## Current data-flow map

The entries below describe source and repository disclosures, not a certification of
third-party practices.
Browser storage named here is the storage visible in the cited implementation or disclosure;
third parties may use other storage.

| Flow and processor | Data and trigger | Consent gate and browser storage | Retention disclosed in repository |
| --- | --- | --- | --- |
| Static hosting: GitHub Pages | Browser requests public pages; hosting may process technical request data. [Privacy page, sections 2 and 4](../../privacy/privacy.html); [Pages deployment](../../.github/workflows/deploy-pages.yml). | No analytics opt-in required to request a page. Storage by host: not stated in repo. | Technical logs: provider-determined, no duration stated in [section 6](../../privacy/privacy.html). |
| Essential choice: browser | Saving or changing the analytics choice writes a timestamp, essential flag and analytics choice. [Consent controller](../../scripts/cookie-consent.js). | Essential `localStorage`: `f1stories-cookie-consent-v1`. This local record is not itself a network transmission. | “μέχρι να αλλάξεις ή να διαγράψεις” — until changed or deleted. [Section 6](../../privacy/privacy.html). |
| Analytics: Google Analytics 4 | Consented page and custom events, including navigation intent and performance observations, are sent after opt-in. [Analytics emitter](../../scripts/analytics.js); [RUM contract](../../perf/rum-pilot/README.md). | Analytics must be explicitly true. Consent record above; GA cookies `_ga`, `_ga_*` may be set; code also attempts to clear `_gid` and `_gat` on withdrawal. [Privacy section 5](../../privacy/privacy.html); [analytics.js](../../scripts/analytics.js). | “καθορίζονται από τους αντίστοιχους παρόχους” — determined by the providers; no duration stated. [Section 6](../../privacy/privacy.html). |
| Export and reporting: Google BigQuery / encrypted dashboard | GA4 export feeds mature aggregate models; a scheduled workflow encrypts an aggregate snapshot for the dashboard. [Validation record](../intelligence/bigquery-validation.md); [snapshot design](../intelligence/dashboard-snapshots.md#how-it-works). | Source population is consented analytics; no separate browser storage required for export. Dashboard key is entered by an authorized user and handled in memory. | Export retention: not stated in repo. Workflow encrypted upload: one day; committed encrypted envelopes may remain in Git history. [Snapshot design](../intelligence/dashboard-snapshots.md#how-it-works), [encryption](../intelligence/dashboard-snapshots.md#encryption). |
| Contact: Formspree | A visitor submits contact fields through the Formspree endpoint in [index.html](../../index.html); [AJAX handler](../../scripts/f1-optimized.js) posts the form and supports native fallback. | Submission is a separate user action, not gated by analytics. Formspree browser storage: not stated in repo. | “μόνο για όσο χρόνο χρειάζεται” — only as long as needed for response, cooperation or security; no fixed duration. [Privacy sections 4 and 6](../../privacy/privacy.html). |
| Video and social embeds: YouTube and relevant social providers | Loading or playing embedded content may contact the provider and expose technical request data. [Privacy section 4](../../privacy/privacy.html); [CSP frame and script sources](../../scripts/build/security-policy.mjs). | Not governed by the analytics toggle as an embed gate; provider storage may be used. Exact names and retention: not stated in repo. | Not stated in repo; provider policy applies. [Privacy sections 4–6](../../privacy/privacy.html). |
| F1 data: Jolpica F1 and OpenF1 | Requests for public race data support Βαθμολογία & Στατιστικά. [Privacy section 4](../../privacy/privacy.html); [CSP connect sources](../../scripts/build/security-policy.mjs). | Functional requests are not analytics-consent gated; provider storage names not stated in repo. | Not stated in repo. |

Other first-party browser storage, none of it transmitted by these flows:

| Storage | Key and purpose | Source |
| --- | --- | --- |
| `localStorage` | `f1stories-theme`: theme preference | `scripts/shared-nav.js:6–10` |
| `sessionStorage` | `f1stories-audio`: podcast URL, playing state and position carried between pages | `scripts/shared-nav.js:119,162–172` |
| `sessionStorage` | `f1s-err-count`: per-tab error counter, incremented before the send-time consent check (the `js_error` send itself is consent-gated) | `scripts/perf/error-beacon.js:6,45–56` |
| IndexedDB `f1s-standings`, `sessionStorage` fallback | Cached public standings API responses | `standings/core/cache.js:1–14` |

CSP permission is not evidence that a request occurred, and the presence of a third-party
frame does not establish that a visitor interacted with it.
GA4 measures only its consented population; no absence of data proves zero readership.

## Consent model

- The two categories in [privacy section 5](../../privacy/privacy.html) are essential local
  choice storage and optional Google Analytics; the default analytics choice is false in
  [cookie-consent.js](../../scripts/cookie-consent.js).
- [analytics.js](../../scripts/analytics.js) initializes analytics storage as denied absent
  explicit opt-in, keeps advertising consent fields denied, and does not inject the Google
  script until analytics is granted. Article pages defer injection until load.
- The footer settings reopen the choice; reject or close saves analytics false. Withdrawal
  updates the same-tab consent state, disables GA and attempts to clear matching GA cookies.
  Deleting the local record is another choice-reset mechanism described by the [privacy
  page](../../privacy/privacy.html); cookie deletion across every domain/path is not
  established by the code.
- Cross-tab withdrawal is handled only for Web Vitals: the beacon and collector listen for
  `storage` events and stop telemetry when another tab withdraws consent
  (`scripts/perf/web-vitals-beacon.js:34`, `scripts/perf/web-vitals-collector.js:93`; local
  fixture `scripts/perf/__tests__/web-vitals.test.mjs:143`). The [consent
  controller](../../scripts/cookie-consent.js) and [analytics
  emitter](../../scripts/analytics.js) have no `storage` listener. Their custom events re-read
  the shared choice on later guarded calls, but immediate cross-tab GA reconfiguration, cookie
  clearing and stopping already loaded third-party code are **NOT VERIFIED**. A reload
  reinitializes from storage; do not promise instantaneous cross-tab withdrawal.
- The local controller and first-party page assets load before analytics consent. External
  video/social frames and functional API requests may also load independently; the analytics
  toggle is not a universal third-party consent gate. [Privacy sections
  4–5](../../privacy/privacy.html); [security
  policy](../../scripts/build/security-policy.mjs).
- [consent-guard.mjs](../../scripts/perf/consent-guard.mjs) checks analytics requests on
  representative built routes; [analytics event
  tests](../../scripts/perf/__tests__/analytics-events.test.mjs) exercise opt-in, decline
  and guarded events. These checks do not establish the behaviour of all third-party embeds
  or production configurations.
- Any future newsletter consent, notification permission or community consent must be
  assessed independently of analytics consent; none follows from the analytics toggle.

## Intelligence minimisation and security boundaries

Phase 1 constrains reporting outputs, not everything the underlying GA4 service may collect.
[Metrics contract: data minimization](../intelligence/metrics-contract.md#data-minimization)
permits bounded aggregate outputs and prohibits visitor-level extracts and joins, and
pseudonymous identifiers in outputs.
Do not add a visitor-level join to estimate return behaviour; an aggregate GA4 report
remains **NOT VERIFIED** until the owner establishes its definition and privacy-safe
availability.
The [data-quality contract](../intelligence/data-quality.md#outcomes-and-severities)
separates missing checks from passes; operational health is not analytical validation.

The [snapshot design](../intelligence/dashboard-snapshots.md#encryption) encrypts the
aggregate envelope and describes in-memory browser decryption; the authorized owner holds
the key.
An encrypted public artifact still exposes its envelope metadata, and old key holders can
decrypt historical envelopes sealed with that key. Follow the existing rotation and
disclosure constraints; do not publish plaintext snapshot rows.

[Security policy](../../scripts/build/security-policy.mjs) restricts `form-action` and
`connect-src` by origin; a proposed provider or endpoint needs a source-specific CSP review,
not an assumption that the existing policy allows it.
[Privacy section 4](../../privacy/privacy.html) describes static GitHub Pages hosting
without an F1 Stories backend: contact processing and data APIs are external flows.
[quality.yml](../../.github/workflows/quality.yml) grants `contents: read` to PR checks;
[intelligence-snapshot.yml](../../.github/workflows/intelligence-snapshot.yml) defaults to
no permissions and grants scoped job permissions, including publishing and dispatch only in
their respective jobs.
[deploy-pages.yml](../../.github/workflows/deploy-pages.yml) has call, dispatch and schedule
triggers, so a documentation PR does not itself deploy.

## Future-feature review matrix

Each cell is a review question, not a determination that a data protection impact assessment
(DPIA), data processing agreement (DPA), legal basis, or specific processor is required.
The owner must record scope, decision and rationale before implementation; consult legal
advice where needed.

| Feature | Personal data involved? | Browser storage? | Email handling? | New processor? | CSP / privacy page change? | Moderation? | DPIA / DPA evaluation? | Legal review? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Curated collections | Check existing public content and any proposed interaction data. | Check preferences. | None assumed. | Check. | Review disclosure and endpoints. | Editorial approval. | Evaluate if processing changes. | Evaluate. |
| Reading paths | Check interaction or progress data. | Check progress persistence and deletion. | None assumed. | Check. | Review both. | Editorial approval. | Evaluate. | Evaluate. |
| Race weekend | Check date/context and interactions. | Check preferences and expiry. | None assumed. | Check race-data flows. | Review endpoints and disclosure. | Editorial approval. | Evaluate. | Evaluate data and content rights. |
| Newsletter | Subscription and delivery data require review. | Check signup state. | Review collection, confirmation, unsubscribe and deletion. | Evaluate options without selecting one here. | Review both before launch. | Review reply handling. | Evaluate both. | Evaluate consent and notices. |
| Reading list | Check whether saved choices can reveal interests. | Review shared-origin exposure, persistence and removal. | None assumed. | Check sync proposal. | Review disclosure and any new endpoint. | No public content assumed. | Evaluate if processing changes. | Evaluate. |
| Notifications / push | Review permission, subscription and delivery data. | Review browser and service-worker storage, expiry and revocation. | None assumed. | Check push services. | Review both. | Review notification content. | Evaluate both. | Evaluate permission and notices. |
| Community participation / UGC | Review submitted content and contact data. | Check drafts and session state. | Review if used for replies. | Check hosting and moderation services. | Review both. | Define abuse, reporting, appeal and removal. | Evaluate both. | Evaluate publication rights and notices. |
| Audience intelligence | Review aggregate outputs and small-group disclosure. | Check dashboard handling. | None assumed. | Check existing versus proposed processing. | Review changes. | No UGC assumed. | Evaluate any new processing. | Evaluate. |

Same-origin storage can be accessible to scripts running on that origin; a local reading
list is not inherently private from those scripts.
Storage lifecycle, shared-device behaviour, deletion and failure handling need explicit
review even if no server sync is proposed.

## Restrictions on new instrumentation

1. A-01 adds no instrumentation. Any later event, dimension or model is a recommendation
  until separately approved and implemented. First identify the existing source checked, the
  unanswered question, the minimum extra data, and privacy and validation implications.
2. Analytics events must respect the existing explicit analytics consent gate, including
  withdrawal and route coverage. Feature consent and analytics consent remain independent.
3. Use bounded, allowlisted parameters and classifications; prohibit personal data in
  parameters, paths and query strings. Review generated URLs and third-party requests, not
  only explicit event payloads. [Analytics emitter](../../scripts/analytics.js); [metrics
  contract](../intelligence/metrics-contract.md#data-minimization).
4. Maintain Phase 1 aggregate-only output: no visitor-level extracts, pseudonymous
  identifiers in outputs or visitor-level joins. Small-group disclosure and retention need
  review.
5. Extend relevant `test:consent` node tests and [consent
  guard](../../scripts/perf/consent-guard.mjs) coverage for new routes and events; run the
  browser guard in an environment that supports it. Fixtures are not production evidence.
6. Update [privacy/privacy.html](../../privacy/privacy.html) before shipping a changed flow,
  and review CSP, retention, processor responsibilities, user controls and required legal
  decisions.
7. Validate the actual production measurement and intended reporting grain before claiming
  impact; a click intent is not a destination load, and an engagement threshold is not
  reading completion. See the [measurement contract](measurement-contract.md).

## Review record for a proposed flow

For each applicable matrix row, record:

- The feature purpose and whether an existing source already answers its measurement question.
- The data categories, collection trigger, recipients and responsibility for each processing step.
- The user control, default, withdrawal path and any independent consent or permission.
- Storage location, access scope, expiry, deletion and behaviour on a shared device.
- The expected retention and deletion process, including provider-held copies where applicable.
- Proposed processors, onward transfers and the outcome of DPA and DPIA evaluation.
- Required changes to the privacy page, endpoint allowlist and any other disclosures.
- Abuse reporting, moderation, appeals and content removal where participation is public.
- The responsible operator, failure response, rollback and incident escalation path.
- Evidence that tests cover the new route, consent state, payload and withdrawal behaviour.
- The legal-review decision, reviewer, date and any open questions.
- Which evidence is safe to publish as an aggregate and which remains unavailable.

Unresolved items remain review items; this checklist does not decide their legal outcome.
