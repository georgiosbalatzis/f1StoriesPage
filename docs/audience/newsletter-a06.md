# A-06 — Newsletter signup, consent and preferences (foundation)

Status: **engineering foundation, production-disabled.** Base `origin/main` `8af4f09e5` (2026-11-03).

| Item | Status |
| --- | --- |
| A-06 engineering foundation | Completed in this PR: domain contract, activation gate, local mock preview, tests |
| Provider | **Not selected.** Research only: [provider evaluation](newsletter-provider-evaluation.md) |
| Signup | **Not activated.** No public form, endpoint, script, CSP origin or privacy-page change |
| Subscribers | **None collected.** No newsletter address is processed anywhere in production (the separate TEAM RADIO contact form still sends its messages via Formspree, unchanged) |
| Emails | **None sent.** The mock provider has an in-memory outbox and no network access |
| A-07 (delivery) | **Not started.** Blocked by this gate and the [activation checklist](newsletter-activation-checklist.md) |

Merging A-06 does not launch a newsletter. The [privacy policy](../../privacy/privacy.html) still says the site has no
newsletter, and that stays true until an activation PR changes it.

## Scope

In scope: subscriber lifecycle and consent contract, input validation, a provider adapter interface with a disabled
adapter, a fail-closed activation gate and public-artifact guard, a loopback-only preview with an in-process mock
provider, and the documentation and owner decisions for activation.

Out of scope: choosing, buying or configuring a provider. Real endpoints, API keys or SDKs. A public form or page,
or any CSP or privacy-page change. Sending, scheduling or delivery tracking (A-07). Category preferences.
Newsletter analytics events.

## Architecture

```
data/audience/newsletter.v1.json   committed default: enabled false, provider null, every evidence item open
        │
        ▼
scripts/build/newsletter-gate.mjs  validateNewsletterConfig → rejects every enabled:true (production-adapter-unavailable)
        │                          validateNewsletterArtifact → scans dist/ for preview/form/mock/config leaks
        ├── npm run build:public            (newsletter:check runs before any build step)
        ├── validate-public-artifact.mjs    (config + artifact check on every validation run)
        └── .github/actions/build-pages     (final check on the uploaded dist/, incl. the assembled path)

blog-module/build/newsletter/model.js    lifecycle, validation, neutral public results, requestSignup()
blog-module/build/newsletter/adapter.js  provider adapter contract + createDisabledAdapter()

scripts/build/newsletter-preview/        LOCAL ONLY (never copied: no *.min.* names, not in any allowlist)
    server.mjs         127.0.0.1-only server, pure route(), Host/Origin checks, 4 KiB bodies, strict CSP
    mock-provider.mjs  in-memory provider: lifecycle via model.transition(), synthetic outbox, failure triggers
    ui/                render.mjs (signup, mock inbox, manage pages), styles.css, client.js
```

**Transport decision ([ADR](#architecture-decision-record)).** On a static host the provider must own collection,
confirmation and management. The order of preference at activation:

1. A provider-hosted page or a plain HTML form `POST`ed natively to the provider. This adds one exact `form-action`
   origin and no third-party script.
2. An embedded form using provider JavaScript, if (1) is not possible. This needs a separate `script-src` /
   `connect-src` / `frame-src` review.
3. Our own serverless proxy. Deferred: it brings a service, secrets, request processing and on-call ownership.

None of these can be built honestly before a provider exists, so A-06 ships only the contract and the mock.

## Subscriber lifecycle

States are **provider-authoritative**. The site never stores or asserts them.

| From | Event | To | Meaning |
| --- | --- | --- | --- |
| `none` | `request` | `pending` | Provider recorded a consented request and sends its confirmation email |
| `pending` | `request` | `pending` | Repeated request: provider may re-send (throttled); public response is unchanged |
| `active` | `request` | `active` | Already confirmed: nothing changes; public response is unchanged |
| `expired` / `unsubscribed` | `request` | `pending` | Fresh consent and a fresh confirmation |
| `pending` | `confirm` | `active` | Provider verified the double opt-in |
| `pending` | `expire` | `expired` | Confirmation deadline passed (provider-defined) |
| `pending` / `active` | `unsubscribe` | `unsubscribed` | Verified withdrawal |
| any | `suppress` | `suppressed` | Provider block (bounce, complaint, operator) |
| `suppressed` | `request` / `erase` | `suppressed` | No automatic exit; how long a suppression record is kept is an owner/provider decision |
| other | `erase` | `none` | Deletion is a retention operation, never a resubscription |

Every other pair is rejected (`invalid-transition`). The site can only observe **its own request outcome**: `idle`,
`invalid`, `submitting`, `neutral`, `unknown` (and `disabled` in production).

- A submitted request is not a subscriber. An HTTP 2xx or a success message is not provider acceptance.
- A clicked confirmation link is provider business. Only the provider's recorded status counts.
- `localStorage`, cookies and URLs never hold subscription state. Reports must come from provider aggregates
  ([KPI 7–9](measurement-contract.md)).

## Consent requirements

- One newsletter-only checkbox, **unchecked by default**. The server never re-checks it after an error. Only the
  boolean `true` counts (the form sends `consent=yes`; a JSON client must send `true`).
- The label states: the F1 Stories weekly briefing email, once a week, operator F1 Stories (f1-stories.gr),
  processing by the email provider, the confirmation email, unsubscribe at any time, and a link to the privacy notice.
- Independent of analytics consent ([cookie-consent.js](../../scripts/cookie-consent.js) handles only essential +
  analytics), the TEAM RADIO / Formspree contact form, sharing, journeys and general site use. Nothing is added to the
  cookie banner.
- The provider must retain the consent evidence: server-recorded UTC request time, newsletter identity, consent text
  and policy version (`policyVersion`), stable source-form id (`sourceForm`), confirmation state and time, and
  withdrawal/suppression evidence. The site passes only `policyVersion` and `sourceForm` with the address. It records
  no timestamps of its own.
- Never in browser storage, Git, CI logs, analytics or the public artifact: addresses, consent proofs, confirmation or
  management tokens, subscriber lists.

## Double opt-in and abuse resistance

Flow at activation: address + explicit consent → native `POST` to the approved provider → provider sends the
confirmation → reader confirms → provider records `active`. In A-06 the only implementation of this flow is the mock.

| Threat | Control | Enforced by |
| --- | --- | --- |
| Email enumeration | New, duplicate, pending, active and suppressed addresses all get one byte-identical neutral response | `publicSignupResult`; mock test compares bodies |
| Duplicate / rapid submits | Client ignores resubmits while pending; provider deduplicates and throttles confirmations | client + provider (mock throttles re-sends) |
| Automated signups | Provider rate limits / CAPTCHA. A static host cannot enforce them | provider (activation evidence `security-abuse-tests`) |
| Invalid address | Same rules on client and server; invalid input never reaches the adapter | `validateEmail` |
| Timeout / partial / malformed response | `unknown`, never auto-retried, never "subscribed" | `requestSignup` (AbortSignal timeout) |
| No JavaScript | Native form `POST` with a server-rendered result | preview no-JS test |
| CSRF on the preview | `Origin` must equal the loopback origin; `Host` checked | `route()` |

Neutral copy (Greek): «Αν η διεύθυνση μπορεί να εγγραφεί, θα λάβεις email επιβεβαίωσης. Η εγγραφή ολοκληρώνεται μόνο
όταν το επιβεβαιώσεις.» It never says "you are subscribed".

## Preferences and unsubscribe

- **One actionable preference: the weekly briefing.** Turning it off means unsubscribe. Turning it back on needs a
  new signup with fresh consent and confirmation (`resubscribe-requires-consent`). Topics, frequency choices and
  language are deferred: there is one weekly product and one language, so those choices would do nothing.
- Management happens on provider-hosted pages through a provider-verified, scoped authorization (an opaque handle from
  the email). There is no lookup by email, no site account, and no browser state. An invalid or expired authorization
  gets a neutral answer that reveals nothing. Suppression stays in effect.
- Unsubscribe must be in every email, work without analytics consent, work on mobile and give an authoritative
  outcome. **A-06 does not claim a working unsubscribe.** The mock exercises the transitions only. GitHub Pages gets
  no unsubscribe route.

## Disabled-mode behaviour

With the committed config, the build guarantees:

- no public form, endpoint, provider script, credential, newsletter storage or event;
- no CSP origin and no privacy-page change;
- no newsletter route, and the same public artifact.

`npm run newsletter:check` fails the build on any `enabled: true` or malformed config. It also fails, with
`--artifact`, on any preview marker, mock route, consent field or config file in `dist/`. Even with complete
evidence, A-06 rejects activation (`production-adapter-unavailable`): there is no production adapter to switch on.
Production entry points read only the fixed config path. No environment variable, fixture path or mock injection can
enable them.

**Byte identity.** The disabled build was compared with a clean build of the base: sorted relative paths and the SHA-256
of every file under `dist/`, including `_headers`, social cards and the sitemap. The evidence is in the PR.

## Local mock preview

`npm run newsletter:preview` (prints a `http://127.0.0.1:<port>` origin). It refuses any other bind address. It serves
in-memory pages and exact static routes only, sends `Cache-Control: no-store`, `X-Robots-Tag: noindex` and a
`default-src 'none'` CSP, and logs no bodies. It never contacts a network.

- `/` — the signup form (`?theme=light|dark`).
- `/mock/inbox` — the synthetic messages the mock "would" send. Confirm and manage are `POST` buttons, so tokens never
  appear in URLs.
- Only reserved-domain addresses are accepted. `suppressed@example.com` is seeded as suppressed.
  `timeout@example.com`, `error@example.com` and `malformed@example.com` simulate provider failures. More than five
  submissions per run returns `rate-limited`.

Nothing in the preview is evidence that a real provider behaves the same way.

## CSP requirements

Today the public `form-action` is `'self' https://formspree.io`, and `connect-src` lists only named services
([security-policy.mjs](../../scripts/build/security-policy.mjs)). A-06 adds nothing. At activation:

- a native POST adds the provider's exact form origin to `form-action` (no wildcard; the redirect targets are reviewed);
- a script/iframe embed needs a separate `script-src`, `connect-src` or `frame-src` review;
- GitHub Pages ignores `_headers`, so the emitted `<meta>` policy is what applies.

## Privacy and data-flow review record

This follows [privacy-data-flow.md](privacy-data-flow.md#review-record-for-a-proposed-flow). It is a record of open
questions, **not legal advice or a legal review**.

| Item | A-06 (disabled) | Required before activation |
| --- | --- | --- |
| Purpose | None processed | Sending the weekly briefing to confirmed readers who asked for it |
| Controller / processor | — | F1 Stories as controller (operator to be named); provider as processor under its DPA |
| Lawful basis / e-marketing | — | Reviewer to determine; designed for explicit, independent consent with double opt-in |
| Data | None | Email address, consent evidence, confirmation status, suppression; no profile or reading behaviour |
| Retention | None | Pending expiry, retention after unsubscribe, suppression-record retention, account closure |
| Access / deletion requests | — | Who handles them, through which provider tool, within what time |
| Sub-processors / transfers | — | Review the selected provider's list and any non-EU transfer ([evaluation](newsletter-provider-evaluation.md)) |
| DPA / DPIA | Not applicable while disabled | Reviewer records whether each applies, the decision and the date |
| Privacy notice | Unchanged ("no newsletter" is accurate) | Activation PR updates it before collection starts |
| Incident response | — | Named incident owner; provider breach-notice terms; how to disable the form |
| Admin access | — | Provider account owner, 2FA, least-privilege users, credential storage outside Git |
| Export / exit | — | Export format, migration, deletion at the old provider |

The A-05 exports remain content-only, and A-06 does not change briefing approval. Segmenting by reading behaviour is
excluded.

## Operational ownership

Each of these must be a named person before activation: provider account owner, privacy/legal reviewer, operator for
access/deletion requests, incident owner, and launch approver. Agents cannot hold any of these roles or record their
approvals.

## Activation evidence and process

The [activation checklist](newsletter-activation-checklist.md) lists the 18 evidence keys checked by
`validateNewsletterConfig`. A future activation PR must:

1. add a reviewed production adapter;
2. replace the `production-adapter-unavailable` rule with one that requires that adapter;
3. add the CSP origin;
4. update the privacy notice;
5. add the public form.

All of this happens only after the evidence is complete and recorded by named humans. CI success never counts as approval.

## Rollback

- **Now:** revert the A-06 merge commit. There are no subscribers to migrate and no public output to remove.
- **After activation:** remove the form and the CSP origin first (stop collection) and keep the provider's
  unsubscribe/removal working, then stop sending (A-07), then decide on export or deletion at the provider.

## A-07 dependency contract

A-07 (delivery) may start only after this gate's activation evidence is complete and the owner approves the consent and
unsubscribe flow ([readiness gates](readiness-gates.md#a-06-and-a-07--newsletter)). A-07 then:

- sends only to provider-confirmed (`active`) subscribers;
- reuses approved A-05 edition content without changing A-05 approval semantics;
- adds its own per-issue approval;
- includes the provider's unsubscribe in every email;
- reports only provider aggregates.

Opens are not reading. A-06 provides no send path, no job and no segmentation.

## Owner decisions required

1. Select a provider (or the selection process), weighing EU hosting against simplicity ([evaluation](newsletter-provider-evaluation.md)).
2. Name the operator, the privacy/legal reviewer, the incident owner and the launch approver.
3. Legal-review outcome for the lawful basis, consent wording and privacy notice; DPA acceptance; DPIA decision.
4. Retention: pending expiry, post-unsubscribe retention, suppression-record retention.
5. Sender domain and DNS authentication (SPF/DKIM/DMARC) for `f1-stories.gr`.
6. Cadence commitment shown in the consent text (weekly) and the editorial owner of each issue (A-07).
7. Aggregate reporting definitions for KPIs 7–9 and who may see them.
8. Explicit launch authorization, recorded in the activation PR.

## Architecture decision record

**Context:** static GitHub Pages, no backend, strict per-route CSP. The privacy notice says there is no newsletter, and
no provider is approved.

**Decision:** build a provider-authoritative contract, a fail-closed gate that rejects every activation in A-06, and a
loopback-only mock. Prefer a provider-hosted page or a native POST at activation. Defer a serverless proxy.

**Consequences:** nothing reaches readers, and the public artifact is unchanged. Activation is a separate PR with a
real adapter and named-human evidence.

**Review:** proposed and reviewed by Codex Sol (architect), then independently re-reviewed on the final head (see the PR).
