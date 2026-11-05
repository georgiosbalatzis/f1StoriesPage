# B-01 risk register

Last verified 2026-11-05 at baseline `a2f89c71`. Bracketed IDs point to [evidence-ledger.md](evidence-ledger.md).

## How to read this register

- **Severity is not confidence.** *Potential impact* describes what could happen if the risk materialised. *Evidence confidence* describes how well the underlying facts are established. The two are reported separately.
- **No numeric scores.** No established scoring method exists for this site, so likelihood is given as a short qualitative judgement with its limits stated.
- **Likelihood is an `INFERENCE` throughout.** It is the auditors' reasoning, not a legal assessment.
- **Blocking status** says which of the scenarios S1–S6 the risk blocks. The scenarios are defined in [rights-matrix.md §4](rights-matrix.md#4-scenario-comparison).
- **Two kinds of risk:**
  - `CR-` risks exist **today**, with no new sponsor. Recording one here is not a decision to change the live site; every change is a separate owner decision.
  - `BR-` risks arise only if new commercial activity starts.

## Summary

| ID | Risk | Potential impact | Evidence confidence | Blocks | Decision-maker |
|---|---|---|---|---|---|
| CR-01 | "F1" in the brand, logo, domain and handles while paid-looking partners are shown | High | High (facts) / open (law) | S1–S6 | Site owner + counsel |
| CR-02 | Existing partner strip: undefined labels, no relationship or permission records, shown everywhere | Medium–High | High | S1–S6 | Site owner |
| CR-03 | Non-commercial data licences next to the partner strip inside data tools | High | High (facts) / open (law) | S3, S4 | Site owner + counsel; providers |
| CR-04 | Betting content: operator "favourites", enrichment wording, no age or responsible-gaming notices | High | High (facts) / open (law) | S6, and S1 near betting pages | Site owner + counsel |
| CR-05 | Article images and F1 assets with no rights record | Medium (editorial) / High (commercial reuse) | High | S1–S5 | Site owner + counsel |
| CR-06 | Old domain `f1stories.gr` resolves under unknown control | Medium | Medium | S1 (brand confusion) | Site owner |
| CR-07 | No published publisher or provider identity | Medium | High (facts) / open (law) | S1–S6 | Counsel |
| CR-08 | No separation between paid content and editorial approval (auto-merge) | Medium–High | High | S2, S3, S5 | Site owner |
| CR-09 | Data attribution gaps, mislabelled sources, committed derivatives without licence notice | Low–Medium | High | S4 | Site owner |
| CR-10 | Contact-form and privacy-notice gaps for commercial processing | Medium | High (facts) / open (law) | S1–S6 | Counsel |
| CR-11 | Open-Meteo free tier excludes sites that show ads, and the site already shows an "ADVERTISING PARTNER" listing | Medium | High (facts) / open (law) | S4 (TYRES) | Site owner + counsel |
| CR-12 | 3D car model in Ghost Car without the CC BY credit | Low–Medium | Medium | S4 | Site owner |
| BR-11 | Sponsor reporting overstating audience | Medium | High | S1, S4 | Site owner |
| BR-12 | Sponsor-category conflicts (official F1 partners, gambling, Pirelli, related parties) | Medium–High | Medium | S1–S6 | Site owner + counsel |
| BR-13 | Business registration, invoicing, VAT and contracts not set up | High | Medium | S1–S6 (any payment) | Tax adviser + counsel |
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
  - The owner decides whether to add the P01 disclaimer (it does not cure commercial use).
  - Option to approach Formula 1 brand protection for a licence or comfort; owner decision only.
  - Contingency rebrand assessment.
- **Decision-maker.** Site owner, on counsel advice.
- **Blocking status.** Blocks offering any new commercial package (S1–S6).
- **Residual risk.** Remains medium even with a disclaimer, until counsel advises.

### CR-02: Existing partner strip

- **Description.** The six listings carry undefined role labels that mix Greek and English, and nothing tells readers whether a listing is paid [R07].
  - The repo has no relationship record or logo permission [R10].
  - One logo file contains a third-party mark [R12].
  - The strip renders on every article and inside Telemetry, Ghost Car and BetCast [R08, R09].
  - Any undisclosed consideration, money or in kind, could bring the placements within the commercial-communication rules [P12, P14, P15, P18]. Whether it does, under Greek law, is `REQUIRES_LEGAL_REVIEW` [U01].
  - The owner must also confirm whether any listing is a related party.
- **Affected surface.** Homepage, all articles, Telemetry, Ghost Car, BetCast.
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
- **Blocking status.** Blocks S1–S6.
- **Residual risk.** Low once the relationship records and labels exist.

### CR-03: Non-commercial data licences next to commercial placements

- **Description.** OpenF1 and Jolpica license their data for non-commercial use only and ask commercial users to make contact [P03, P05, P06].
  - The partner strip already renders inside Telemetry and Ghost Car, which call OpenF1 directly, and on every page that calls Jolpica through the countdown in the navigation [R09, R28]. One of its listings is labelled "ADVERTISING PARTNER" [R07].
  - The repo's OpenF1 "approved" status is the site owner's acceptance of the non-commercial licence for one session. It is not a provider authorisation [R26].
  - FOM separately claims database rights in timing data [P01].
- **Affected surface.** THE GRID, the hubs, Telemetry, Ghost Car, the countdown in the navigation, and the committed caches and captures.
- **Likelihood and limits.** Unknown. No provider enforcement history was researched.
- **Potential impact.** Under CC BY-NC-SA §6(a), the licence terminates automatically on breach. It is reinstated if the breach is cured within 30 days of discovery, or if the licensor reinstates it expressly [P06]. Loss of data access. Takedown requests.
- **Verified evidence.** R26–R31, P01, P03–P06.
- **Uncertainty.** Whether a sponsor-carrying free site is "primarily intended for commercial advantage" has never been adjudicated. FOM's reach over data obtained through intermediaries is also unsettled.
- **Mitigation options.**
  - Counsel opinion.
  - Written provider terms (owner contact only).
  - Owner decision on whether the strip belongs inside data tools.
- **Decision-maker.** Site owner, on counsel advice and provider replies.
- **Blocking status.** Blocks S3 (where tools are used) and S4.
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

### CR-06: Old domain under unknown control

- **Description.** `f1stories.gr` returned NXDOMAIN on 2026-10-24 and now resolves to Cloudflare addresses [N02]. The repo says it is not owned [N02].
- **Affected surface.** The brand, and search confusion. Telemetry also still treats `f1stories.gr` links as trusted [R50].
- **Likelihood and limits.** Unknown. The domain could be the owner's own new registration or a third party's.
- **Potential impact.** Impersonation or confusion while sponsors are being pitched.
- **Verified evidence.** N02.
- **Uncertainty.** The registrant [U13].
- **Mitigation options.** The owner checks the registry. Counsel advises before any recovery attempt.
- **Decision-maker.** Site owner.
- **Blocking status.** Not blocking. Advisory for S1.
- **Residual risk.** Low once identified.

### CR-07: No publisher or provider identity

- **Description.** Neither the privacy page nor the terms name a legal entity or person [R19]. The E-Commerce Directive requires provider identity for information-society services, and EMFA imposes ownership transparency on media service providers [P15, P17].
- **Affected surface.** Privacy, terms, any sponsor contract.
- **Likelihood and limits.** Whether these regimes apply to F1 Stories is unsettled [U02].
- **Potential impact.** Non-compliance once the site is remunerated. Sponsors unable to contract with an identifiable party.
- **Verified evidence.** R19, P15, P17.
- **Uncertainty.** The applicability tests: "normally provided for remuneration" (ECD) and "professional activity" (EMFA).
- **Mitigation options.** Counsel advice, then a publisher-identity statement (a separate PR).
- **Decision-maker.** Site owner, on counsel advice.
- **Blocking status.** Blocks S1–S6.
- **Residual risk.** Low after advice.

### CR-08: Paid content not separated from editorial approval

- **Description.** Author PRs auto-merge once CI passes, and human review is optional [R36]. No content flag exists for sponsored items.
- **Affected surface.** The publishing workflow.
- **Likelihood and limits.** High that a paid piece could publish without an explicit approval, if one were commissioned today (`INFERENCE`).
- **Potential impact.** An unlabelled advertorial [P12 Annex I point 11]. Loss of reader trust.
- **Verified evidence.** R36, P12, P13.
- **Uncertainty.** —
- **Mitigation options.**
  - The policy (§6) requires explicit human approval for paid content.
  - A later implementation PR would exclude paid content from auto-merge.
- **Decision-maker.** Site owner.
- **Blocking status.** Blocks S2, S3 and S5.
- **Residual risk.** Low after the policy is in place and the workflow is changed.

### CR-09: Attribution and licence-notice gaps

- **Description.** Only the hub timeline and pace sections show the CC notice.
  - THE GRID, Telemetry and Ghost Car name their sources without the licence, and two THE GRID source labels are swapped [R31, R32].
  - Committed captures and derivatives carry no licence notice, and no repo has a LICENSE file [R30, R33].
  - Telemetry's footer says "all rights reserved" above OpenF1-derived output, which may conflict with ShareAlike [R49].
  - CC BY-NC-SA requires attribution and ShareAlike on shared adaptations [P06]. OpenF1's FAQ says credit is optional [P03].
- **Affected surface.** THE GRID, Telemetry, Ghost Car, the public repos.
- **Likelihood and limits.** Low enforcement likelihood (`INFERENCE`).
- **Potential impact.** Licence breach, which compounds CR-03.
- **Verified evidence.** R30–R33, P03, P06.
- **Uncertainty.** Whether the derivatives are "Adapted Material" or unprotected facts.
- **Mitigation options.** A separate copy-fix PR for the attribution and labels, and counsel on ShareAlike.
- **Decision-maker.** Site owner.
- **Blocking status.** Blocks S4.
- **Residual risk.** Low.

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

- **Description.** Open-Meteo's free API is for non-commercial use, and its terms count "websites or apps that … display advertisements" as commercial [P07]. TYRES uses the free tier [R34]. The domain already shows a partner strip, one of whose listings is labelled "ADVERTISING PARTNER" [R07]. TYRES itself shows no strip [R34].
- **Affected surface.** TYRES.
- **Likelihood and limits.** Unknown. Whether a strip elsewhere on the domain affects a separate app is `REQUIRES_LEGAL_REVIEW`.
- **Potential impact.** Breach of the provider's terms. Loss of access.
- **Verified evidence.** R07, R34, P07.
- **Uncertainty.** Whether the clause applies site-wide or per app.
- **Mitigation options.** Counsel opinion. A paid plan before any sponsor appears in TYRES (owner decision).
- **Decision-maker.** Site owner, on counsel advice.
- **Blocking status.** Blocks S4 on TYRES.
- **Residual risk.** Low with a paid plan.

### CR-12: 3D car model credit missing in Ghost Car

- **Description.** TYRES credits a CC BY 4.0 car model. Ghost Car loads an `f1car.glb` with no credit found anywhere in the repo. That the two are the same model is `INFERENCE`; the files were not compared [R47].
- **Affected surface.** Ghost Car.
- **Likelihood and limits.** Low enforcement likelihood (`INFERENCE`).
- **Potential impact.** Breach of the attribution licence for that asset.
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
  - The tool apps have no GA4 at all.
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

- **Description.** No business-registration, invoicing, VAT or contract arrangements are documented. That is correct for a public repo, but it means nothing is in place. The questions are in the [legal-counsel-brief.md](legal-counsel-brief.md) tax section.
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
