# F1 Stories Audience & Community — Phase 4

Status: **A-01 documentation only.** No runtime, analytics, consent, SQL, workflow, provider or production-data change.
Base: `origin/main` `58331f9fb` (2026-11-03). Investigation date: 2026-11-03 (UTC).

Phase 4 asks one question: **is F1 Stories building a genuinely returning audience, and how would we know, accurately and
without new tracking?** A-01 answers the measurement half. It records what exists, what the existing Intelligence system
can and cannot measure, the privacy boundaries, and the evidence each later Phase 4 PR needs before it starts.

## Scope of A-01

In scope: an evidence-cited audit of the current repository; an audience KPI contract that *extends*
[the Intelligence metrics contract](../intelligence/metrics-contract.md); a truthful partial baseline; a consent and
personal-data map; readiness gates for A-02..A-09.

Out of scope (non-goals): newsletter signup or delivery, collections or reading paths, race-weekend UI, reading list,
notifications, comments or a community platform, an experimentation engine, dashboards, new GA4 events or custom
dimensions, new BigQuery models or queries, authentication or backend services, provider selection or activation.
Any new event named in these documents is a **recommendation only**.

## Documents

| File | Answers | Owner |
|---|---|---|
| [infrastructure-audit.md](infrastructure-audit.md) | What exists today, where it lives, which phase owns it, what a Phase 4 feature would duplicate | A-01 |
| [measurement-contract.md](measurement-contract.md) | The 15 audience KPIs: definition, population, source, limits, evidence label. Also defines the [evidence labels](measurement-contract.md#evidence-labels) | A-01 |
| [baseline-evidence.md](baseline-evidence.md) | Which production evidence exists, which windows are mature, sample-size limits, what is still missing | A-01 |
| [privacy-data-flow.md](privacy-data-flow.md) | Consent, storage, processors and personal data today; review items for each future feature; rules for any new instrumentation | A-01 |
| [readiness-gates.md](readiness-gates.md) | Provisional A-02..A-09 order, prerequisites, GO / NO-GO conditions and owner decisions | A-01 |

Authoritative sources stay where they are. Phase 4 links them and never re-defines them:
Intelligence ([README](../intelligence/README.md), [metrics contract](../intelligence/metrics-contract.md),
[audience model](../intelligence/audience-model.md), [data quality](../intelligence/data-quality.md)), Editorial OS
([editorial review](../editorial-review.md)), Race Desk ([program](../race-desk-program.md)) and the
[privacy policy](../../privacy/privacy.html).

## Executive findings

1. **Returning readership is not measured today.** No Intelligence model reads a visitor or session identifier, by
   design ([metrics contract, data minimization](../intelligence/metrics-contract.md#data-minimization)). The only
   route within the current privacy contract is an aggregate GA4 report the owner reviews privately. That is
   `NOT_VERIFIED` until the owner records its definition and limits. Event subtraction (`page_view − first_visit`) is
   prohibited.
2. **What exists is consented event counts, not people.** Article views, the `article_engaged` threshold event (30
   visible seconds and 50% scroll), discovery clicks, acquisition classes and delayed Web Vitals observations. All 20
   Intelligence models are `PRODUCTION_EXECUTED`. None is `PRODUCTION_VALIDATED`.
3. **No 28-day baseline exists yet.** The export starts 2026-10-19. The first full 28-day window (2026-10-19..2026-11-15)
   matures at `as_of` 2026-11-19. The only recorded production aggregates are the owner's 19–22 October runs, and those
   samples are small (e.g. LCP n=26, INP n=7 against a floor of 30).
4. **Discovery is partly measurable.** Article→article clicks (`internal_page_click`, models 13 and 28) are click
   *intent*, not confirmed loads. Entity hubs already behave like approval-gated collections. NEXT UP is not an
   isolated placement, and GP hub paths fall into `other`, so article→GP-hub navigation cannot be isolated today.
   Clicks into standalone Race Desk tools are not verified tool usage.
5. **Newsletter and reading-list actions are `NOT_MEASURABLE`; audience notification outcomes have no established
   source.** The privacy policy states that the site has no newsletter. Email-classified traffic remains `PROXY_ONLY`
   (KPI 10). TEAM RADIO is an implemented private Formspree contact form: its mechanism is `VERIFIED_CODE`, while
   accepted-submission counts are `NOT_VERIFIED` (KPI 13). No custom GA4 submission outcome is emitted; automatic GA4
   form measurement settings are unverified ([measurement contract](measurement-contract.md#13-reader-participation),
   [contact handler](../../scripts/f1-optimized.js)).
6. **The privacy-respecting order is reuse first, personal data last.** Features that reuse existing consented
   aggregates and approval-gated content come before features that need new consent, storage, email or moderation.

Details and evidence: each linked document. Every claim there cites a repository path, PR or dated evidence record.

## Status

| Item | Status |
|---|---|
| Six A-01 documents | Draft for owner review |
| KPI coverage | See [measurement contract](measurement-contract.md) and [baseline](baseline-evidence.md) |
| Production validation of any audience KPI | None. Nothing in A-01 is `PRODUCTION_VALIDATED` |
| A-02..A-09 | Not started. Numbering is **provisional**; see [readiness gates](readiness-gates.md) |

## Unresolved owner decisions

The full numbered register is in [readiness-gates.md](readiness-gates.md#owner-decision-register). In summary:

1. Confirm or change the provisional A-02..A-09 mapping.
2. Decide whether an aggregate GA4 returning-users report, reviewed privately, satisfies the returning-readership
   question. Record its definition and limits without publishing private values.
3. Run the existing I-06C4 owner-local validation on a real snapshot (the
   [closeout checklist](../intelligence/i06c4-closeout.md#ordered-owner-checklist)), and run it again after the first
   mature 28-day window.
4. For each personal-data feature (newsletter, reading list, notifications, community): set a review process, an
   operational owner and a decision on DPIA/legal review before any design work starts.

## Handoff to later phases

- A-02..A-09 must cite a KPI from [measurement-contract.md](measurement-contract.md) or declare a gap, and must pass
  [readiness-gates.md](readiness-gates.md) before implementation.
- Six stale statements found in existing Intelligence and Race Desk documents are listed in
  [infrastructure-audit.md](infrastructure-audit.md#stale-statements-in-existing-documents) for separately owned
  follow-up. A-01 does not edit them.
- Article→GP-hub links do not exist in committed article pages today; GP hubs link to articles and tools, and the
  homepage links to selected hubs ([infrastructure audit, Race Desk](infrastructure-audit.md#phase-3-race-desk)).

## Rollback

A-01 adds only the six files under `docs/audience/`. To roll back, revert the merge commit or delete the directory.
No runtime, data, workflow or published-URL state depends on these files.
