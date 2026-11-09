# B-01 risk register

Last verified 2026-11-05 at baseline `a2f89c71`. Bracketed IDs point to [evidence-ledger.md](evidence-ledger.md).

## How to read this register

- **Severity is not confidence.** *Potential impact* describes what could happen if the risk materialised. *Evidence confidence* describes how well the underlying facts are established. The two are reported separately.
- **No numeric scores.** No established scoring method exists for this site, so likelihood is given as a short qualitative judgement with its limits stated.
- **Likelihood is an `INFERENCE` throughout.** It is the auditors' reasoning, not a legal assessment.
- **Blocking status** records governance gates for the described scenario; apply the X1–X4 applicability matrix in [rights-matrix.md §4](rights-matrix.md#4-scenario-comparison), including its conditional triggers.
- **Two kinds of risk:**
  - `CR-` risks exist **today**, with no new sponsor. Recording one here is not a decision to change the live site; every change is a separate owner decision.
  - `BR-` risks arise only if new commercial activity starts.

## Summary

| ID | Risk | Potential impact | Evidence confidence | Blocks | Decision-maker |
|---|---|---|---|---|---|
| CR-01 | "F1" in the brand, logo, domain and handles while paid-looking partners are shown | High | High (facts) / open (law) | S1–S6: scenario-specific identity/association assessment (X1) | Site owner + counsel |
| CR-02 | Existing partner strip: undefined labels, no relationship or permission records, shown on recorded surfaces | Medium–High | High | S1 strip use; S2–S6 where existing marks/relationships or relevant co-placement obligations are included (X2) | Site owner |
| CR-03 | Non-commercial data licences next to the partner strip inside data tools | High | High (facts) / open (law) | S3/S4 affected uses; S1 distribution into tools; S2/S5 where data or tools are incorporated | Site owner + counsel; providers |
| CR-04 | Betting content: operator "favourites", enrichment wording, no age or responsible-gaming notices | High | High (facts) / open (law) | S6, and S1 near betting pages | Site owner + counsel |
| CR-05 | Article images and F1 assets with no rights record | Medium (editorial) / High (commercial reuse) | High | S1–S5 | Site owner + counsel |
| CR-06 | Old-domain redirect and separate domain-rights uncertainty | Medium | Medium | Advisory; separate identity/association assessment remains open (X1) | Site owner |
| CR-07 | No published publisher or provider identity | Medium | High (facts) / open (law) | S1–S6: publisher-information assessment; format-specific disclosures vary (X3) | Counsel |
| CR-08 | No separation between paid content and editorial approval (auto-merge) | Medium–High | High | S2/S5 paid editorial; S3/S6 where paid editorial is commissioned (X4) | Site owner |
| CR-09 | Data attribution gaps, mislabelled sources, committed derivatives without licence notice | Low–Medium | High | Affected provider uses, including S1 distribution and S2–S5 where relevant | Site owner |
| CR-10 | Contact-form and privacy-notice gaps for commercial processing | Medium | High (facts) / open (law) | S1–S6 | Counsel |
| CR-11 | Open-Meteo free tier excludes sites that show ads, and the site already shows an "ADVERTISING PARTNER" listing | Medium | High (facts) / open (law) | S4 on TYRES; S1 distribution into TYRES | Site owner + counsel |
| CR-12 | 3D car model in Ghost Car without the CC BY credit | Low–Medium | Medium | S4 | Site owner |
| BR-11 | Sponsor reporting overstating audience | Medium | High | S1, S4 | Site owner |
| BR-12 | Sponsor-category conflicts (official F1 partners, gambling, Pirelli, related parties) | Medium–High | Medium | S1–S6 | Site owner + counsel |
| BR-13 | Business registration, invoicing, VAT and contracts not documented in the repo | High | Medium | S1–S6 (any payment) | Tax adviser + counsel |
| BR-14 | Terms pages are undated and may change | Medium | High | All | Site owner |

## Detail

### CR-01: "F1" in the brand while commercial placements are shown

- **Description.** The name, logo wordmark, domain and social handles all contain "F1" [R01–R04], and the site carries a partner strip [R07]. F1's published guidelines say four things:
  - marks may not be used in domains of commercialised websites;
  - marks may not be used to build a brand identity, logo, name or handle;
  - non-commercial fan or news use is tolerated at F1's discretion;
  - unofficial sites should carry a footer disclaimer, and F1 Stories has none [R05].

  All four are in [P01].
- **Affected surface.** Every page, social cards, social accounts and the domain.
- **Likelihood and limits.** Unknown. The rights holder enforces a stated policy, but no enforcement history against comparable sites was researched. Taking paid sponsors plausibly raises exposure (`INFERENCE`).
- **Potential impact.** Demand to rebrand, transfer the domain or remove sponsors. Loss of brand equity.
- **Verified evidence.** R01–R05, P01, P02.
- **Uncertainty.** Two points are unsettled: whether the guidelines are enforceable, and whether EU or Greek trademark exceptions (descriptive or referential use) cover the name [U07].
- **Mitigation options.**
  - Counsel opinion on the brand and domain.
  - The owner decides whether to add the P01 disclaimer (a disclaimer is not permission and does not resolve remaining rights questions).
  - Option to approach Formula 1 brand protection for a licence or comfort; owner decision only.
  - Contingency rebrand assessment.
- **Decision-maker.** Site owner, on counsel advice.
- **Blocking status.** Scenario-specific brand/domain assessment remains required for use of the current identity in S1–S6 (X1). It does not predetermine that every format needs the same permission, or that descriptive editorial references are prohibited. CR-06 domain control is separate.
- **Residual risk.** Remains medium even with a disclaimer, until counsel advises.

### CR-02: Existing partner strip

- **Description.** The six listings carry undefined role labels that mix Greek and English, and nothing tells readers whether a listing is paid [R07].
  - The repo has no relationship record or logo permission [R10].
  - One logo file contains a third-party mark [R12].
  - The baseline records the strip on rendered articles and in Telemetry, Ghost Car and BetCast. On 2026-11-09 TYRES source and served HTML also showed it; Telemetry and Ghost Car suppress it in embed mode [R08, R09].
  - Any undisclosed consideration, money or in kind, could bring the placements within the commercial-communication rules [P12, P14, P15, P18]. Whether it does, under Greek law, is `REQUIRES_LEGAL_REVIEW` [U01].
  - The owner must also confirm whether any listing is a related party.
- **Affected surface.** Homepage, rendered articles, TYRES, BetCast, and non-embed Telemetry and Ghost Car [R08, R09].
- **Likelihood and limits.** It depends on facts only the owner holds.
- **Potential impact.** Consumer-law exposure for unclear labelling. Logo-permission disputes. Sponsors appearing next to gambling content without having agreed to it.
- **Verified evidence.** R07–R12, P11–P15, P18.
- **Uncertainty.** Whether the relationships are paid. How Greek law transposes Annex I point 11 [U01].
- **Mitigation options.**
  - The owner records each relationship privately.
  - Adopt the policy labels.
  - Decide whether the strip should appear in data tools and on betting pages.
  - Obtain written logo permission.

  Each runtime change is a separate PR.
- **Decision-maker.** Site owner.
- **Blocking status.** Gates S1's use of the existing strip and any actual reuse of existing partner marks or relevant placement obligations in S2–S6. Missing records for an unrelated existing partner do not automatically block a new sponsorship. New sponsor logo/placement permission remains required separately.
- **Residual risk.** Reassess after the relevant relationship records, permissions and labels are evidenced.

### CR-03: Non-commercial data licences next to commercial placements

- **Description.** OpenF1 and Jolpica license their data for non-commercial use only and ask commercial users to make contact [P03, P05, P06].
  - The partner strip already renders inside Telemetry and Ghost Car, which call OpenF1 directly, and on recorded site surfaces that also use Jolpica through the navigation countdown [R09, R28]. One of its listings is labelled "ADVERTISING PARTNER" [R07].
  - The repo's OpenF1 "approved" status is the site owner's acceptance of the non-commercial licence for one session. It is not a provider authorisation [R26].
  - FOM separately claims database rights in timing data [P01].
- **Affected surface.** THE GRID, the hubs, Telemetry, Ghost Car, the countdown in the navigation, and the committed caches and captures.
- **Likelihood and limits.** Unknown. No provider enforcement history was researched.
- **Potential impact.** If an applicable licence condition were breached, P06 §6(a) provides automatic termination; §6(b)(1)–(2) addresses reinstatement. B-01 did not establish that these provisions were triggered. Possible consequences include loss of licensed rights, access or takedown demands, subject to the actual terms and professional assessment.
- **Verified evidence.** R26–R31, P01, P03–P06.
- **Uncertainty.** B-01 did not establish how NonCommercial applies to these uses and did not conduct an exhaustive case-law search. FOM’s underlying-rights claim and application to intermediary data also require professional assessment.
- **Mitigation options.**
  - Counsel opinion.
  - Written provider terms (owner contact only).
  - Owner decision on whether the strip belongs inside data tools.
- **Decision-maker.** Site owner, on counsel advice and provider replies.
- **Blocking status.** Gates affected provider uses in S3/S4, S1 distribution into data tools, and S2/S5 if provider data or tools are incorporated. Existing navigation and placement exposure remains a current-state assessment; assess actual dependencies, including Jolpica in navigation.
- **Residual risk.** Medium until providers reply in writing.

### CR-04: Betting content

- **Description.** "Στοίχημα" is a public category with a published betting record [R38, R40].
  - One guide names three operators as favourites and uses enrichment wording [R39].
  - There is no 18+/21+, ΕΕΕΠ or helpline text anywhere [R38], and no operator links [R41].
  - The Greek gambling advertising rules forbid enrichment claims and require age and helpline marking, for licensed operators and their affiliates [P19, P20].
- **Affected surface.** The betting section, betting articles and BetCast.
- **Likelihood and limits.** Depends on the owner's answer about any past consideration from operators. The operators' licence status is unchecked [U11].
- **Potential impact.** Regulatory exposure if the content counts as commercial communication. Reputational exposure for any sponsor shown near it.
- **Verified evidence.** R38–R41, P19, P20.
- **Uncertainty.** Whether the rules reach a publisher's own unpaid editorial content is `REQUIRES_LEGAL_REVIEW`.
- **Mitigation options.**
  - The owner confirms the consideration history.
  - Counsel review of the guide [R39].
  - A voluntary responsible-gaming notice standard (owner decision).
  - Keep sponsors off betting pages until reviewed.
- **Decision-maker.** Site owner, on counsel advice.
- **Blocking status.** Blocks S6 entirely, and blocks S1 placements near betting pages.
- **Residual risk.** Medium.

### CR-05: Images and F1 assets with no rights record

- **Description.** The media register covers about 12% of article images and records no licence for any of them [R22].
  - The project already tracks an open rights queue, including an identifiable minor [R23].
  - Headshots and team logos are copied from `media.formula1.com`, whose terms allow personal, non-commercial use only [R24, P02].
  - Press portals commonly allow news reporting only [P09].
- **Affected surface.** Articles, cards, social cards, THE GRID and the homepage hero.
- **Likelihood and limits.** Editorial reliance on news-reporting and quotation exceptions is unverified [U05]. Commercial reuse is more exposed (`INFERENCE`).
- **Potential impact.** Infringement claims. Image takedowns.
- **Verified evidence.** R22–R25, P02, P09.
- **Uncertainty.** The scope of the exceptions under Greek law [U05].
- **Mitigation options.**
  - A rights ledger with a commercial-use column that defaults to "no".
  - Sponsored work uses first-party or licensed images only.
  - Counsel on the existing archive.
- **Decision-maker.** Site owner, on counsel advice.
- **Blocking status.** Blocks image reuse in S1–S5.
- **Residual risk.** Medium for the archive. Low for new sponsored work that follows the ledger.

### CR-06: Old-domain redirect and domain-rights uncertainty

- **2026-11-09 reconciliation.** The owner reports reacquisition and control of `f1stories.gr` through a registrar (OWNER_REPORTED). HTTP/HTTPS 301 checks preserved tested paths and queries (LIVE_VERIFIED). Registry details remain independently UNVERIFIED [N02, U13]. The historical 2026-11-05 DNS observation and unverified 2026-10-24 NXDOMAIN report remain in N02; Cloudflare DNS does not establish ownership.
- **Affected surface and risk.** Brand and possible confusion; Telemetry still trusts old-domain links [R50]. Domain control and redirect do not settle trademark or commercial domain-use permissions [CR-01].
- **Action.** Retain owner confirmation and redirect evidence; verify registry details independently if needed and seek counsel on domain and trademark use.
- **Decision-maker.** Site owner and counsel. **Blocking status.** Advisory for S1; separate brand rights remain unresolved.

### CR-07: No publisher or provider identity

- **Description.** The baseline policies name no publisher legal entity or person [R19]. P15 and P17 record potential publisher/provider-information requirements. Their applicability, scope and Greek implementation remain professional questions [U02]; the 2026-11-09 EUR-Lex reads were blocked.
- **Affected surface.** General publisher/provider information and identification of the contracting party, potentially independent of a particular paid-content format.
- **Potential impact.** Possible information-duty exposure if an applicable requirement is unmet, and inability to evidence the party contracting with a sponsor. A free-to-read site is not automatically outside the assessment.
- **Uncertainty.** Do not assume either present applicability or that duties begin only with the next sponsorship. Have counsel verify the scope and timing, including the different EMFA Art. 6 duties.
- **Mitigation options.** Obtain advice and complete the resulting information requirements in a separately approved implementation. Separately assess format-specific commercial disclosures under X3; policy adoption alone is not evidence of compliance.
- **Decision-maker.** Site owner, on counsel advice.
- **Blocking status.** Publisher-information and contracting-party assessment remains relevant to S1–S6. The required disclosures depend on the actual format; no single full policy/disclosure page is asserted here as a universal statutory prerequisite.
- **Residual risk.** Requires reassessment after the applicable requirements and resulting actions are evidenced; advice alone does not close it.

### CR-08: Paid content not separated from editorial approval

- **Description.** Author PRs auto-merge once CI passes, and human review is optional [R36]. No content flag exists for sponsored items.
- **Affected surface.** The publishing workflow.
- **Likelihood and limits.** High that a paid piece could publish without an explicit approval, if one were commissioned today (`INFERENCE`).
- **Potential impact.** An unlabelled advertorial [P12 Annex I point 11]. Loss of reader trust.
- **Verified evidence.** R36, P12, P13.
- **Uncertainty.** —
- **Mitigation options.**
  - The draft policy (§6), which is not approved, proposes separate commercial and human editorial approval for paid editorial content.
  - A later implementation PR would exclude paid editorial content from auto-merge and provide evidence of the approval step.
- **Decision-maker.** Site owner.
- **Blocking status.** Applies to S2 and S5, and S3/S6 where paid editorial is commissioned. Article auto-merge is not a direct blocker for a static S1 or S4 logo/link alone; those placements still need owner approval and their other gates.
- **Residual risk.** Reassess after the relevant approval process is approved and implemented; adopting a draft alone does not establish implementation.

### CR-09: Attribution and licence-notice gaps

- **Description.** Only the hub timeline and pace sections show the CC notice.
  - THE GRID, Telemetry and Ghost Car name their sources without the licence, and two THE GRID source labels are swapped [R31, R32].
  - Committed captures and derivatives carry no licence notice, and no repo has a LICENSE file [R30, R33].
  - Telemetry's footer says "all rights reserved" above OpenF1-derived output, which may conflict with ShareAlike [R49].
  - P06 contains attribution and adaptation conditions; OpenF1’s optional-credit FAQ [P03] needs provider clarification for the actual sharing and datasets. Do not infer a waiver or verified breach.
- **Affected surface.** THE GRID, Telemetry, Ghost Car, the public repos.
- **Likelihood and limits.** Unknown; no provider enforcement history or use-specific licence determination was established.
- **Potential impact.** Possible non-compliance with an applicable notice or adaptation condition, subject to assessment; this may add to CR-03 but is not an established breach.
- **Verified evidence.** R30–R33, P03, P06.
- **Uncertainty.** Whether the derivatives are "Adapted Material" or unprotected facts.
- **Mitigation options.** A separate copy-fix PR for the attribution and labels, and counsel on ShareAlike.
- **Decision-maker.** Site owner.
- **Blocking status.** Gates affected provider uses, including S1 distribution into tools and S2–S5 where data or tools are incorporated.
- **Residual risk.** Reassess for the actual use and applicable licence conditions.

### CR-10: Contact form and privacy notice

- **Description.** The form has no notice at the point of collection [R18].
  - The privacy notice describes sponsors through the invisible `rel` attribute [R19].
  - It does not cover sponsor reporting or international transfers [R19].
  - Retention for messages is vague [R19].
  - It mentions Jolpica/OpenF1 only for the standings page, while the navigation countdown calls Jolpica from every page [R51].
- **Affected surface.** The contact form, the privacy notice and any future sponsor report.
- **Likelihood and limits.** GDPR, ePrivacy and Greek texts were not retrieved [U06].
- **Potential impact.** Data-protection non-compliance.
- **Verified evidence.** R18, R19.
- **Uncertainty.** U06.
- **Mitigation options.** Counsel review of the notice before any sponsor report is shared.
- **Decision-maker.** Site owner, on counsel advice.
- **Blocking status.** Blocks S1–S6 sponsor reporting.
- **Residual risk.** Low after review.

### CR-11: Open-Meteo free tier while advertising is shown

- **Description.** P07 records a non-commercial free-service restriction. On 2026-11-09, TYRES's pinned source and served HTML were checked and showed the six-logo partner strip, including ADVERTISING PARTNER [R09, R34]. This supersedes the baseline claim that TYRES had no strip and the associated elsewhere-only premise. The source still uses public Open-Meteo endpoints for eligible non-held records.
- **Operational limit.** See the [REC-02 weather-hold reconciliation](evidence-ledger.md#rec-02-reconciliation-2026-11-09).
- **Affected surface.** TYRES and any S1/S4 placement distributed into it, including existing weather output.
- **Likelihood and limits.** No enforcement history, contractual breach or regulatory violation was established. Actual service/use, applicable terms and possible current exposure require assessment.
- **Potential impact.** Possible service-terms/licensing exposure or loss of access. CC BY data reuse and free-API service conditions are separate.
- **Verified evidence.** P07 historical terms checked 2026-11-05; R09/R34 reconciliation notes for source, served HTML and the limited request hold.
- **Required action.** Assess present usage and the proposed commercial scope; obtain suitable commercial access or provider confirmation where required, retain attribution, and separately assess any historical issue. No provider configuration or WEATHER_HOLD change is authorised by B-01.
- **Decision-maker.** Site owner, with counsel and provider input as required.
- **Blocking status.** Remains a gate for S4 on TYRES and S1 distribution into TYRES; the limited hold does not clear it.
- **Residual risk.** A suitable access arrangement can address future service access only within its scope; it does not by itself resolve historical usage, attribution, Pirelli/FOM rights or other scenario gates.

### CR-12: 3D car model credit missing in Ghost Car

- **Description.** TYRES credits a CC BY 4.0 car model. Ghost Car loads an `f1car.glb`. Reconciled 2026-11-09: deployed files differ in bytes; common provenance remains unverified, and no Ghost Car model credit or licence was found in the inspected README and licence paths [R47].
- **Affected surface.** Ghost Car.
- **Likelihood and limits.** Unknown; model provenance, applicable terms and deployed credit require verification.
- **Potential impact.** Possible attribution or licensing exposure if the identified model requires a credit that is absent; identity and licence must first be established.
- **Verified evidence.** R47.
- **Uncertainty.** The file's identity, and whether the credit exists at the deployed pin.
- **Mitigation options.** Compare the files, then add the credit in a separate Ghost Car PR (owner decision).
- **Decision-maker.** Site owner.
- **Blocking status.** Blocks S4 on Ghost Car.
- **Residual risk.** Low after the credit is added.

### BR-11: Sponsor reporting overstating audience

- **Description.** GA4 covers consenting visitors only [R15].
  - There are no impressions [R16].
  - Clicks are a floor [R14]. Listings are identifiable only by domain plus role label, and there is no placement ID [R14].
  - The historical inventory found no GA4 in the inspected tool snapshots; current tool coverage was not re-audited.
- **Mitigation options.** Any sponsor report states "consented visitors only, click intent, no impressions, no total audience". No audience-size claims.
- **Decision-maker.** Site owner.
- **Blocking status.** Blocks any S1 or S4 reporting promise.
- **Residual risk.** Low if the caveat is always stated.

### BR-12: Sponsor-category conflicts

- **Description.** Some sponsor categories conflict with the site's subject or with existing rules:
  - official F1 partners, such as F1's own betting partners [U10] and Pirelli;
  - gambling [P19];
  - alcohol, tobacco and crypto, which have their own rules [P18];
  - related parties.

  These raise ambush-marketing, regulatory and conflict-of-interest risks.
- **Mitigation options.** Policy §9 category review, and a written risk note per proposal.
- **Decision-maker.** Site owner, on counsel advice for restricted categories.
- **Blocking status.** Per proposal.
- **Residual risk.** Medium for borderline categories.

### BR-13: Business, tax and contract set-up

- **Description.** Reconciled 2026-11-09: No business-registration, invoicing, VAT or contract arrangements are documented in this public repo; whether arrangements exist outside it is UNVERIFIED. The questions are in the [legal-counsel-brief.md](legal-counsel-brief.md) tax section.
- **Mitigation options.** A tax adviser and counsel before the first payment or in-kind deal.
- **Decision-maker.** Tax adviser + site owner.
- **Blocking status.** Blocks accepting any consideration.
- **Residual risk.** Low after advice.

### BR-14: Source drift

- **Description.** The F1, OpenF1 and Open-Meteo pages are undated. Jolpica reserves the right to change its terms [P01, P03, P05, P07].
- **Mitigation options.** Re-verify every primary source before any decision or contract, and save dated copies privately.
- **Decision-maker.** Site owner.
- **Blocking status.** All.
- **Residual risk.** Low with re-checks.
