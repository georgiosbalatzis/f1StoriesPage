# Newsletter activation checklist (A-06)

Status: **every item open.** The newsletter is disabled. This checklist records what a future activation PR must prove.
It does not authorize activation, and a completed row is not legal advice.

## How the gate uses it

[`data/audience/newsletter.v1.json`](../../data/audience/newsletter.v1.json) holds one evidence item per key below.
[`scripts/build/newsletter-gate.mjs`](../../scripts/build/newsletter-gate.mjs) validates it on every `build:public`,
every artifact validation and every Pages upload.

- An item is `{ "status": "open" }` or `{ "status": "complete", "by", "date", "reference" }`.
- `by` is a named human. It is never an agent and never contains `SYNTHETIC`.
- `date` is `YYYY-MM-DD`, a real calendar day, not after today in Athens.
- `reference` is public-safe: a document title, PR number or ticket id. It contains no email address and no URL query.
  Store private evidence (contracts, DPA copies, provider screenshots) outside the repository.
- With `enabled: false`, completed items are allowed, so progress can be recorded.
- With `enabled: true`, the build fails while any item is open, `provider` is null or `review.status` is not
  `approved`. **In A-06 it always fails** with `production-adapter-unavailable`, because no production adapter exists.

Never edit the config to make the gate pass. Never complete an item on someone else's behalf, and never copy fixture
values into it.

## Evidence items

| Key | What must be true | Typical reviewer |
| --- | --- | --- |
| `provider-approval` | Owner chose the provider in writing, with reasons ([evaluation](newsletter-provider-evaluation.md)) | Owner |
| `provider-account-configuration` | The production account exists with owner-controlled login, 2FA and least-privilege users. List, form, sender and Greek confirmation/unsubscribe copy are configured. No API key is in the repo or in CI unless an adapter needs it and that need is reviewed | Account owner |
| `processor-dpa-transfer-review` | DPA accepted, sub-processor list reviewed, transfer mechanism assessed for any non-EU processing | Privacy/legal reviewer |
| `dpia-decision` | A recorded decision on whether a DPIA is required, with the reason; the DPIA itself if required | Privacy/legal reviewer |
| `legal-review-consent-privacy` | Lawful basis and electronic-marketing rules reviewed. Final Greek consent wording approved and given a policy version | Legal reviewer |
| `privacy-notice-update` | [privacy/privacy.html](../../privacy/privacy.html) updated in the activation PR: purpose, provider, retention, rights, withdrawal. "No newsletter" removed only then | Privacy/legal reviewer |
| `retention-deletion` | Pending-expiry period, retention after unsubscribe, suppression-record retention, access/deletion request procedure and response time | Operator + reviewer |
| `double-opt-in-verified` | On the real account: a request creates a pending contact, the confirmation arrives in Greek, and confirming produces provider-recorded active status. Tested with an owner-controlled test inbox | Operator |
| `unsubscribe-suppression-verified` | The unsubscribe link in every email works on mobile without analytics consent. It produces provider-recorded unsubscribed status. A suppressed or unsubscribed address cannot be silently re-added | Operator |
| `preference-management-verified` | The provider-hosted management page works through a scoped link only. Turning off the briefing equals unsubscribe | Operator |
| `csp-endpoint-review` | The exact provider origin(s) for `form-action` (and any `script-src` / `connect-src` / `frame-src`) are reviewed, with no wildcards, and redirect targets are known | Security reviewer |
| `domain-authentication` | SPF, DKIM and DMARC for the sending domain are published and verified by the provider. DNS owner named | DNS owner |
| `operator-incident-owner` | Named operator and incident owner; breach-notice path with the provider; how to take the form down quickly | Owner |
| `security-abuse-tests` | Enumeration (one neutral response for new / duplicate / suppressed), rate limiting / CAPTCHA, duplicate submits, timeouts, malformed responses and no-JS, tested against the real provider in a non-public way | Security reviewer |
| `accessibility-no-js` | The production form passes keyboard, screen-reader and no-JavaScript checks at 390 / 576 / 768 / 1440 in both themes | Accessibility reviewer |
| `aggregate-reporting` | Definitions for KPI 7–9 using provider aggregates only, and who may see them ([measurement contract](measurement-contract.md)). Opens are not readers | Owner |
| `rollback-plan` | Ordered rollback: remove form + CSP origin, keep unsubscribe working, stop sending, then export or delete at the provider | Owner |
| `launch-authorization` | Explicit owner authorization to start collecting addresses, dated after every other item | Owner |

## Activation PR (outline)

1. Complete the evidence above, recorded by named humans.
2. Add a reviewed production adapter or provider-native form. Replace the `production-adapter-unavailable` rule with a
   check that requires that adapter. Add tests against provider documentation fixtures; CI must never call a provider.
3. Add the reviewed CSP origin(s) and the public form, following the [A-06 contract](newsletter-a06.md). Update the
   privacy notice in the same PR.
4. Set `provider`, `review.status: "approved"` and `enabled: true`. The gate, artifact validation, browser QA and a fresh
   independent review must pass on the exact head.
5. After deploy, verify live: form present only where intended, exact CSP origin, privacy notice, and a real test
   signup by the operator that confirms and then unsubscribes.

A-07 (delivery) starts only after this PR is approved and live.

## Owner decisions

The register is in [newsletter-a06.md](newsletter-a06.md#owner-decisions-required) and in the readiness-gate
[decision register](readiness-gates.md#owner-decision-register) (item 7).
