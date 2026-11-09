# Pricing methodology

Internal documentation only; no commercial offer, price, or legal clearance. This is a method, not a rate card. All unset inputs are **TBD — OWNER DECISION**; undefined inputs stop a quote. S1 and S2 remain `UNRESOLVED` and unavailable for offer. The proposed, uncosted S1 unit is one owner-released homepage listing for 28 calendar days; S2 is two new editor-selected technical articles in a four-week production window. These are proposed delivery units, not throughput or price benchmarks. S1 needs isolation, installation, removal and checks; S2 needs authoring, review, disclosure and archival acknowledgment. See [inventory](inventory.md) and [packages](packages.md).

## Cost, contribution and margin

Define the actual term, outputs, surfaces, revisions, creative, approvals, reporting and renewal obligations before estimating. Privately record quantities and rates, distinguishing one-time setup from recurring work and allocating shared setup to the relevant scope and term. Include editorial labour, design labour, technical effort, operations, quality assurance, reporting and direct expenses. Include rights, legal, editorial and commercial review effort in the appropriate category. Include allocated overhead in the base only if its method is documented.

On one consistent tax basis:

```text
B = editorial + design + technical + operations + QA + reporting
    + direct expenses + allocated overhead if chosen (excluding contingency)
C >= 0 = one contingency reserve for specified uncertainty on a stated eligible base
D = B + C
0 <= m < 1 = owner-chosen margin fraction
Q >= 0 = owner-chosen minimum contribution above D
P_net >= round_up_to_billing_increment(max(D / (1 - m), D + Q))
```

`D` is the delivery cost and cost floor; the rounded maximum is the minimum acceptable net price for all committed obligations. The billing increment must be positive and rounding must never reduce either minimum. Count contingency once, not also in labour or a premium for the same uncertainty. Tax collected cannot satisfy a pre-tax floor. Currency, tax basis, increment, `m` and `Q`: **TBD — OWNER DECISION**.

For price `P > 0`, margin on this cost basis is `(P − D) / P`. For `D > 0`, markup is `(P − D) / D`. With nonnegative markup `k`, `m = k / (1 + k)` and `k = m / (1 − m)`. Margin and contribution here are defined on this method's cost basis; they are not automatically accounting gross profit, accounting contribution or net profit. A zero-cost case requires explicit owner review and a positive commercial price before margin is evaluated; markup is undefined at zero cost. A margin of one is invalid.

Opportunity cost is the best feasible alternative forgone when scarce capacity is committed; assess it in `Q` or a documented adjustment, rather than silently treating it as cash cost. Recover a given overhead allocation in `B` or `Q`, not both. Do not count the same forgone opportunity, shared setup or uncertainty repeatedly across contribution and adjustments.

## Adjustments and comparison

Recalculate cost and capacity first when term, output, revisions, setup, rights or approval work, reporting or renewal obligations change. Then document any distinct adjustment for duration, exclusivity or scarcity, sponsor category, competitive restrictions, renewal potential, production burden and verified demand. The value and method for each, including duration and exclusivity, are **TBD — OWNER DECISION**. S1 and S2 include no exclusivity or renewal right; a changed entitlement needs new scope and gate review.

Compare candidates privately using scope, term, delivery units, hours and rates, expenses, allocated setup and overhead, contingency, capacity, rights, `m`, `Q`, adjustments and resulting minimum. Any future market comparison needs a source, date, comparable scope, audience definition and limitations; no benchmark is established here.

## Discounts, repricing and future publication

After all scope changes and adjustments, assess effective net consideration for the complete obligation, including discounts, credits, rebates, bundles, free extensions and renewal concessions, against the recomputed rounded minimum. Reject or reduce a concession, or rescope and recompute before agreement. **No below-floor override is authorised.** Discount authority, limits and expiry are **TBD — OWNER DECISION**.

Review and reprice for material changes to scope, term, deliverables, revisions, capacity, exclusivity, restrictions, input costs, allocation, contingency, rights or approval burden, reporting, tax treatment or renewal obligations; also review at renewal or when validated demand or comparable evidence changes. Changes require owner approval and the applicable agreement process.

Future publication of prices requires explicit owner approval, repeatable approved scope and capacity, complete cost and floor inputs and discount rules, validation for every measurement claim actually included, and applicable rights, disclosure, privacy, tax, contracting and business outcomes. B-01 gates remain open ([closeout](b01-closeout.md#8-is-any-commercial-activation-presently-justified); CR-10, BR-11). No prices are published by this document.

## Performance evidence and handoff

States are independent stages: **technically collected** means suitable source code exists, not proven production receipt; **production executed** means a relevant model was recorded as run, not that a particular campaign produced a row; **production validated** requires checks for the exact model, population and window; **sponsor-report ready** additionally requires an approved, privacy-reviewed report and reliable attribution; **not measured** means no suitable operational measure is evidenced, not a zero result. No candidate below is sponsor-report ready. Model execution was owner-reported and remains unvalidated (`docs/audience/measurement-contract.md:7`; `docs/intelligence/data-quality.md:173`).

| Exact candidate | Source capability | Recorded model execution | Validation/report status | Next dependency |
|---|---|---|---|---|
| Partner outbound clicks | Technically collected by consent-gated main-site emitter (`scripts/analytics.js:176`; R14). Domain plus role is fragile, especially after changes; no placement ID. | Production executed for sponsored aggregate model 27, not partner or campaign rows (`docs/intelligence/sql/models/27-engagement-events.sql:1`). | Not production validated or sponsor-report ready. Click is intent, not delivered visit. | B-03 validates identity, fields, coverage and exact window; proposed owner-defined B-06 may address attribution if needed. |
| Published deliverables | URLs and dated publication evidence can be manually audited. | No campaign register or relevant execution established. | Not measured as campaign delivery. | Approved scope and fulfillment record, then B-03 reconciliation. |
| Fulfilled editorial commitments | Manual comparison with approved obligations is possible. | None established. | Not measured as reconciled commitments. | Approved record and evidence, then B-03 reconciliation. |
| Campaign dates | Approved dates and start/end evidence can be recorded manually. | None established. | Not measured as agreed versus actual dates. | Record dates and time zone; B-03 verification. |
| Sponsor impressions | No suitable exposure event or denominator established (R16). | None established. | Not measured; no sponsor CTR denominator. | B-03 assesses any future definition and evidence. |
| All-visitor reach | Consent-limited events do not cover all visitors. | None established. | Not measured. | B-03 assesses source and population. |
| External conversions | Outbound click is not destination conversion. | None established. | Not measured. | B-03 assesses any independently supplied evidence and attribution. |
| Incremental advertiser revenue | No counterfactual or suitable revenue evidence established. | None established. | Not measured; no causal lift or ROI claim. | B-03 assesses evidence and causal design. |
| Article engagement proxy | Technically collected threshold event; not completion or sponsor engagement (`docs/audience/measurement-contract.md:46`). | Production executed for relevant aggregate models. | Not production validated or sponsor-report ready; no guarantee. | B-03 validates the exact cohort and semantics. |
| Cross-application unique users | No suitable cross-app identity measure; current contract prohibits visitor-level joins (`docs/intelligence/metrics-contract.md:77`). | None established. | Not measured. | B-03 assesses feasibility and lawful population. |

GA4 describes consenting main-site events only, with exact host, model, window, maturity and time zone stated. Declined or absent consent, modified clicks, blocked scripts and failed beacons create gaps; other applications are not established as covered. Do not silently combine historic and new occupants by domain and role. Page views are not sponsor impressions. No raw reader/contact data or visitor-level joins belong in reports, and encrypted snapshots are not validated audience evidence ([current-state audit](current-state-audit.md#4-analytics-coverage); CR-10, BR-11).

Manual fulfillment requires no new analytics or database: proposed S1 checks start and end with a term-end report; S2 uses internal publication checks and one production-window closeout, once approved records exist. B-03 is evidence validation under the B-02 brief. B-06 is not defined in the repository: any reporting or implementation responsibilities are **proposed and owner-defined**, with implementation separately authorised. Sponsor-specific reporting requires validated attribution, an approved report and privacy/quality review; a placement ID is conditional on the promise, not on displaying a logo.

## Private inputs outstanding

All values and decisions below are **TBD — OWNER DECISION**, retained privately where sensitive:

- Exact scope, surfaces, dates and time zone, frequency, deliverables, assets and ownership, producers, revisions, approvals, reporting cadence and renewal obligations; capacity, existing commitments, release or expansion, exclusions and category restrictions.
- Labour quantities and rates by editorial, design, technical, operations, QA, reporting and review; direct expenses; shared setup and overhead allocations; contingency base and reserve; opportunity cost and alternative capacity use.
- Currency, tax treatment, positive billing increment, target margin `m`, minimum contribution `Q`, adjustment methods and values, discount authority and limits, repricing and renewal rules.
- Stream identity, production export completeness, event fields and types, host and consent coverage, mature windows, quality checks, partner attribution, report privacy and small-sample rules; manual evidence, retention and approvers.
- Brand, logo, media and provider rights, distribution and disclosure decisions; legal/privacy review, business identity, tax and contracting outcomes; B-03 handoff and B-06 ownership, scope and sequencing.
