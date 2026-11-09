# B-01 closeout

**Baseline.** `a2f89c71` (origin/main, 2026-11-05). Evidence IDs refer to [evidence-ledger.md](evidence-ledger.md).

**Method.** Five independent research workstreams ran in parallel and did not modify any files:

| Workstream | Subject |
|---|---|
| A | Trademarks and brand |
| B | Race data and software licences |
| C | Images and logos |
| D | Commercial infrastructure and privacy |
| E | Editorial independence and law |

The orchestrator then spot-checked the key facts and synthesised the findings. A separate reviewer, which wrote none of the findings, then ran an adversarial review:
- **Decision:** APPROVE WITH CHANGES.
- **Blocking objections (3), all addressed in this version:**
  - B1: missing or incorrect provider and asset dependencies in the matrix;
  - B2: the Open-Meteo exposure was filed as future-only;
  - B3: three statements were not labelled as legal conclusions or owner facts.
- **Checks the reviewer ran:** 29 ledger entries and 4 primary sources re-verified; corrections applied to R14, R18 and R21.
- **Remaining limits:** the reviewer could not verify everything; these items are listed in the PR description.

**Two decisions, kept separate:**

| Decision | Status |
|---|---|
| **Documentation ready for approval** | Ready for owner review |
| **Commercial use legally cleared for activation** | **No.** Nothing is cleared |

**The B-01 audit identified commercial, licensing and legal risks. It did not establish a verified contractual breach, regulatory violation, or judicial finding of unlawful conduct by F1 Stories.** See the [evidence, risk and clearance distinction](rights-matrix.md).

## 1. What did we confirm already exists?

- **Partner strip.** Six partner logos under "ΜΑΖΙ ΣΤΗΝ ΕΚΚΙΝΗΣΗ", with correct `rel="noopener sponsored"` links [R07]. The strip appears:
  - on the homepage;
  - on every article [R08];
  - in baseline source for Telemetry, Ghost Car and BetCast; on 2026-11-09 TYRES source and served HTML also showed the six-logo strip including ADVERTISING PARTNER. Telemetry and Ghost Car suppress it in embed mode [R09, R34].
- **Logo pipeline.** It trims and resizes the logos; it does not recolour them [R11].
- **Analytics.** Consent-gated GA4 with all advertising signals denied [R13]. A partner-click event exists [R14]. There is no impression tracking [R16] and no ad tech [R17].
- **Contact.** A Formspree contact form invites partnership enquiries [R18]; receipt of actual enquiries is UNVERIFIED.
- **Policies.** A privacy notice that mentions sponsors, a corrections process, and an optional editorial review [R19, R36, R37].
- **Rights records.** A media-rights register, which is sparse [R22]. A race-data rights record, which holds owner acceptance only [R26].

We did **not** confirm any business arrangement. The repo contains no partner agreement, logo permission or payment record [R10].

## 2. What commercial rights are established?

**No complete commercial scenario is evidenced as cleared.**

The recorded OpenF1 decision is the site owner's acceptance of a non-commercial licence, not provider-granted commercial authorisation [R26]. Published licences for particular assets may allow commercial use subject to conditions (for example the separately recorded CC BY, MIT and OFL assets [R47]); they do not clear an entire scenario or third-party marks/designs.

The audit did not evidence use-specific commercial authorisations for the proposed packages from the relevant Formula 1 rights holders, OpenF1/Jolpica, Pirelli, partner brands or the particular media owners whose permissions may be required. Open-Meteo's data licence and commercial API-service scope are separate [P07, CR-11]. Absence of a public record does not prove that private permissions do not exist. Collect required evidence privately and record only a non-sensitive status here.

## 3. Which proposed commercial uses are unresolved or restricted?

All six scenarios are **`UNRESOLVED`**. The full comparison is in [rights-matrix.md §4](rights-matrix.md#4-scenario-comparison).

**Restricted/do-not-proceed uses:** the rights matrix records published-policy gates for the identified F1 logo/association/data uses and Open-Meteo free-service commercial use. These are governance holds, not findings of infringement or breach. Any permission must cover the actual use and does not settle unrelated rights. Unlicensed-operator commercial communication remains separately restricted under the recorded P19 gambling gate; no private IP licence overrides a regulatory requirement, and current-law verification remains open.

**X1–X4 are scenario-specific:** use the explicit applicability matrix in [rights-matrix.md §4](rights-matrix.md#4-scenario-comparison). X1 assesses current identity/association separately from domain control; X2 concerns existing marks/relationships actually relevant to the package; X3 separates general publisher information from format-specific disclosures; X4 governs paid editorial approval rather than every static logo. No scenario becomes cleared because a blocker was narrowed.

## 4. Which existing activities should remain unchanged?

B-01 changes nothing. The following continue as they are:
- editorial publishing;
- the Race Desk tools;
- THE GRID;
- TYRES;
- BetCast;
- analytics;
- the contact form;
- the existing partner strip.

The audit found current-state risks [CR-01 to CR-12]. Each is an owner decision, taken on counsel advice where marked. None is an automatic instruction to disable or change the site. Four are the most time-sensitive for the owner:
1. the strip, including an "ADVERTISING PARTNER" listing, inside the OpenF1-powered tools [CR-03];
2. the verified in-app TYRES strip alongside Open-Meteo usage; the limited hold does not resolve rights elsewhere [CR-11; REC-02 evidence](evidence-ledger.md#rec-02-reconciliation-2026-11-09);
3. the betting guide that names operators [CR-04];
4. the remaining identity, trademark and domain-use questions [CR-01, CR-06]. The owner reports old-domain reacquisition and control through a registrar (OWNER_REPORTED); 2026-11-09 redirects were checked (LIVE_VERIFIED), while registry details remain UNVERIFIED [N02, U13]. Control does not settle trademark or commercial domain-use rights.

## 5. What decisions must the owner make? (business decisions)

1. **Record the six partner relationships privately.** For each one: paid, in kind or unpaid; related-party or not; logo permission held or not.
2. **Engage counsel** using [legal-counsel-brief.md](legal-counsel-brief.md), and choose the scope of that engagement.
3. **Approve, amend or reject the draft policy**, including the category exclusions (gambling, tobacco, politics).
4. **Decide whether the partner strip belongs** inside data tools and on betting pages (a later runtime PR if changed).
5. **Decide whether to add** F1's recommended unofficial-site disclaimer (a later runtime PR). A disclaimer is not permission and does not resolve the remaining rights questions.
6. **Retain the old-domain owner confirmation and 2026-11-09 redirect evidence.** Independently verify registry details if needed; continue the separate brand/domain-use assessment [CR-01, CR-06, N02, U13].
7. **Decide whether and when to contact rights holders and providers.** These are Formula 1 brand protection, OpenF1, Jolpica, Pirelli and Open-Meteo. B-01 contacted no one.
8. **Decide what to do about the betting guide** [R39], after counsel advice.

## 6. Which decisions require qualified legal or tax advice?

- Brand and domain lawfulness.
- Whether the site is "commercial(ised)" under the F1 guidelines and the CC licences.
- The effect of the existing strip on the OpenF1 and Jolpica licences.
- The scope of the copyright exceptions for the image archive.
- The Greek UCPD transposition and label adequacy.
- Provider identity under ECD and EMFA.
- Whether gambling rules reach editorial content.
- Business registration, invoicing and VAT.
- Contract terms.
- The privacy notice for sponsor reporting.

All of these are listed in the [counsel brief](legal-counsel-brief.md) §2–3.

## 7. Can B-02 safely proceed as planning and documentation?

**Yes**, as long as B-02:
- changes no runtime;
- offers nothing to sponsors;
- states no prices publicly;
- contacts no rights holders without owner approval;
- treats every row in the rights matrix as not cleared.

B-02's scope is not defined in this repository, so this answer applies to planning and documentation only.

## 8. Is any commercial activation presently justified?

**No.** No new sponsorship should be offered or activated until three things are true:
- the selected format's applicable X1–X4 gates and triggered conditional gates have documented outcomes, including required professional assessment and actual permissions where needed; a narrower blocker or advice alone is not clearance;
- the chosen scenario's own blockers are satisfied in writing;
- business, tax and contract set-up is in place [BR-13].

## 9. What should explicitly remain out of scope?

- Changes to the runtime, HTML, CSS, JS, data or workflows.
- Changes to `publication-rights.v1.json`.
- Any change to the partner logos.
- New analytics events.
- Domain changes.
- Contacting third parties.
- Licences or contracts.
- Pricing and media kits.
- A commercial backend or dashboard.
- Legal conclusions.

## 10. What is the smallest next action with genuine business value?

The owner takes two steps:
1. Records the six existing partner relationships privately (an hour of owner time; no code).
2. Sends [legal-counsel-brief.md](legal-counsel-brief.md) to one Greek lawyer, with question groups A, B and E first.

The answers to brand/domain (A) and disclosure (B) decide whether any sponsorship model is viable under the current name.
