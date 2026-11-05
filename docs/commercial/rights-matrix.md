# B-01 commercial rights matrix

This is the central licensing record for Phase 5. It was last verified on **2026-11-05** at baseline `a2f89c71`. Bracketed IDs point to [evidence-ledger.md](evidence-ledger.md).

**Readiness labels:**
- `CLEARED`: documented, affirmative authorisation for the specific commercial use. **No row is CLEARED.**
- `CONDITIONAL`: may proceed only after named conditions are met.
- `UNRESOLVED`: insufficient evidence or unsettled interpretation. This is the default.
- `PROHIBITED`: a directly applicable, verified restriction rules the use out, in the absence of a licence.

Where a row says `PROHIBITED (rights-holder policy)`, the restriction is the rights holder's published policy [P01, P02, P07]. Whether that policy is enforceable against F1 Stories is `REQUIRES_LEGAL_REVIEW`. The label means: do not do this without a licence. It does not mean a court has ruled.

Two further points apply to every row:
- **Readiness is about new commercial use only.** It is not a finding that current editorial publication is unlawful, and it is not an instruction to change the live site. See [b01-closeout.md](b01-closeout.md) Q4.
- **"Owner" means the person who decides the row.** "Site owner" decides business questions. "Counsel" means a qualified lawyer or tax adviser, who must advise before the site owner decides.

## 1. Brand, domains and Formula 1 marks

| Asset or right | Current usage | Proposed commercial usage | Rights holder | Evidence | Relevant terms | Readiness | Required action | Owner | Review date |
|---|---|---|---|---|---|---|---|---|---|
| Domain `f1-stories.gr` | Canonical site domain | Site carrying paid partners | F1 Stories registrant (`UNVERIFIED`, U13). Formula One Licensing B.V. holds the "F1" marks | R01, N01, P01 §4 Domains | F1 marks may not appear in domains of "commercialised websites". Non-commercial fan or news sites are tolerated at F1's discretion | `UNRESOLVED` | Counsel opinion on whether paid partners make the site "commercialised", and on the consequences. Owner confirms the registrant | Site owner + counsel | 2026-11-05 |
| Domain `f1stories.gr` (old) | Not used. Returned NXDOMAIN on 2026-10-24 and now resolves to Cloudflare | None proposed | Unknown | N02, `docs/r09-reliability-audit.md#L55` | Same domain clause. There is also a confusion risk if a third party holds it | `UNRESOLVED` | Owner checks the registry/WHOIS. Counsel advises before any recovery attempt, which could itself raise the domain clause | Site owner | 2026-11-05 |
| "F1 Stories" name, wordmark and logo | Site identity, OG/JSON-LD, social cards, favicon | Brand sold alongside sponsors | F1 Stories for its own artwork (authorship unrecorded, R03). Formula One Licensing B.V. for "F1" | R02, R03, R25, P01 §4 Variations / Names | Marks may not be incorporated into logos or used as a brand identity, company, product or service name | `UNRESOLVED` | Counsel on descriptive vs brand use under EU and Greek trademark law (U07). Possible rebrand or logo decision | Site owner + counsel | 2026-11-05 |
| Social handles containing "f1" | Footer and JSON-LD `sameAs` | Promoting sponsors from these accounts | Platform accounts held by F1 Stories (`OWNER_REPORTED`). Formula One Licensing B.V. for "F1" | R04, P01 §4 Social | Tolerated for non-commercial fan or news accounts. Business accounts are "generally" treated as commercial | `UNRESOLVED` | Counsel, same question as above | Site owner + counsel | 2026-11-05 |
| F1 word marks used descriptively in editorial copy | Throughout articles and titles | Unchanged editorial use beside paid placements | Formula One Licensing B.V. | P01 §1, §3 | "Inform, not brand". No false affiliation | `UNRESOLVED` for any use next to a sponsor | Labelling and separation standard (policy §3–4). Sponsor contract bars implying an F1 association | Site owner | 2026-11-05 |
| F1 logos | Not used by the site (`INFERENCE`; none found) | Any | Formula One Licensing B.V. | P01 §1, P02 | No use without an express written licence | `PROHIBITED` (rights-holder policy) | Do not use. A licence would be the only route | Site owner | 2026-11-05 |
| F1 marks combined with a sponsor (series name, lockup, "presented by", advertorial) | Not done | S2, S3, S5 naming | Formula One Licensing B.V. | P01 §4 Endorsement / Advertisements | No implied endorsement. No use alongside an unauthorised brand. No association in advertisements or advertorials | `PROHIBITED` (rights-holder policy) | Do not use without a licence | Site owner | 2026-11-05 |
| Grand Prix event titles | Article and hub titles, e.g. Race Desk GP hubs | Race-weekend sponsorship (S3) | Formula One Licensing B.V. Titles include title sponsors | R44, P01 §1 Event titles | Event titles are marks. Sponsored association with them is restricted | `PROHIBITED` (rights-holder policy) for "<GP> + sponsor" branding. `UNRESOLVED` for a separated "Χορηγία" label on general weekend coverage | Counsel on separation. No sponsor in event-title lockups | Site owner + counsel | 2026-11-05 |
| Site-level unofficial disclaimer | Missing | Prerequisite for any scenario | — | R05, P01 §4 Internet | The rights holder asks unofficial sites to carry a footer disclaimer. A disclaimer does **not** authorise commercial use | `UNRESOLVED` | Owner decides whether to add the P01 text (separate runtime PR, not B-01) | Site owner | 2026-11-05 |

## 2. Logos and images

| Asset or right | Current usage | Proposed commercial usage | Rights holder | Evidence | Relevant terms | Readiness | Required action | Owner | Review date |
|---|---|---|---|---|---|---|---|---|---|
| Six partner logos | Homepage, every article, Telemetry, Ghost Car, BetCast | S1 paid placement | Each partner brand | R07–R11, R10 | No permission or agreement is recorded | `UNRESOLVED` | Written logo-use permission and relationship record per partner, kept privately | Site owner | 2026-11-05 |
| Third-party mark inside one partner logo | Shown in the partner strip | S1 | That manufacturer | R12 | No record | `UNRESOLVED` (`REQUIRES_RIGHTS_HOLDER_APPROVAL`) | Partner confirms its right to use the mark, or supplies a clean logo | Site owner | 2026-11-05 |
| Article images without a register record (about 950) | Article bodies, cards, hero, social cards | Reuse in S2, S3 or S5, or sponsor material | Unknown per image | R22, R23 | Credit ≠ permission (own policy). Press and agency terms commonly limit use to news reporting [P09] | `UNRESOLVED` | Do not reuse in sponsored contexts. A rights ledger with a commercial-use column is a prerequisite | Site owner + counsel | 2026-11-05 |
| Credited agency or team press images (Getty/iStock, XPB, Ferrari press, etc.) | A few articles | Same | Named agency or team | R22, P09 | Typically news reporting only. Other uses need written consent (Haas example) | `UNRESOLVED`. Likely restricted for promotional use | Rights holder permission per image, or exclude | Site owner | 2026-11-05 |
| Withdrawn or placeholdered third-party images, still in Git history | Not rendered; retrievable from public history | None | Various | R23 | — | `UNRESOLVED` (current exposure) | Counsel on whether history exposure matters. The owner already tracks this | Site owner + counsel | 2026-11-05 |
| Identifiable minor in one placeholdered image | Placeholdered | None | Subject / guardian | R23 | Personal data and personality rights | `UNRESOLVED` | Counsel. Never use commercially | Site owner + counsel | 2026-11-05 |
| Driver headshots and team logos from `media.formula1.com` | THE GRID (self-hosted with remote fallback). Telemetry loads headshots at runtime (HEAD) | Any sponsor-visible use (S4, S2) | FOM / teams / drivers | R24, P02 | formula1.com content is for personal, non-commercial use. Team marks are separate trademarks | `UNRESOLVED`. `PROHIBITED` (rights-holder policy) as a sponsor-adjacent promotional asset | Rights holder permission, or replace in any sponsored surface | Site owner | 2026-11-05 |
| AI-generated article images (6 documented) | Labelled articles | Reuse in sponsored material | Unsettled (`REQUIRES_LEGAL_REVIEW`) | R22 | — | `UNRESOLVED` | Counsel on authorship and rights. Keep the AI label | Site owner + counsel | 2026-11-05 |
| Author avatars | Bylines and homepage | Sponsor materials | Unrecorded. One shows an F1 team's branding | R45 | — | `UNRESOLVED` | Record the artist or tool and the rights. Exclude team-branded variants from commercial use | Site owner | 2026-11-05 |
| Social cards | Every article and the homepage | Sponsor-branded cards | Inherits the article image's rights holder. Logo as above | R25 | Inherits the rights of the article image | `UNRESOLVED` | No sponsor elements on cards until image rights are documented | Site owner | 2026-11-05 |
| Embedded third-party video and social posts (YouTube, including F1's own channels; Instagram, X, Facebook) | Articles, via platform embeds | Embeds inside sponsored articles or series (S2, S3, S5) | The content owners. Platform embed terms apply | R19 (`privacy/privacy.html#L160-L161`) | Platform embed terms not reviewed | `UNRESOLVED` | Counsel and platform terms check before embedding third-party content in sponsored pieces | Site owner | 2026-11-05 |
| "Low Poly F1" 3D car model | TYRES (credited, CC BY 4.0, recoloured). Ghost Car loads `f1car.glb` with no credit found (HEAD; same model is `INFERENCE`) | S4 sponsor in TYRES or Ghost Car | The model's author (salasilma13 on Sketchfab, per TYRES credits) | R47 | CC BY 4.0 allows commercial use if attribution is kept. The CC licence grants no rights in any F1 livery or design the model depicts | TYRES: `CONDITIONAL` (credit retained, plus counsel on depicted design). Ghost Car: `UNRESOLVED` until the file is identified and credited | Compare the files. Add the credit to Ghost Car (a separate sibling PR) | Site owner | 2026-11-05 |
| Circuit outlines (bacinger/f1-circuits, MIT), flags (MIT), fonts (OFL) | TYRES (credited) | S4 | The respective authors | R47 | Permissive licences; licence notices must be kept | `CONDITIONAL` (notices retained). Circuit layouts may also raise FOM or circuit rights: `REQUIRES_LEGAL_REVIEW` | Keep the notices | Site owner | 2026-11-05 |

## 3. Race data: provider × product dependencies

Cell codes: **R** = browser runtime, **B** = build-time fetch, **C** = committed copy in a public repo, **S** = derived file served to visitors.

| Provider | THE GRID | Race Desk hubs | Site-wide (nav, articles) | Telemetry | Ghost Car | TYRES | BetCast |
|---|---|---|---|---|---|---|---|
| OpenF1 | R, B+C+S (debrief and dirty-air caches) | B+C (captures) → S (HTML) | R (embedded tools in about 11 articles) | R, C | R | — | — |
| Jolpica | R, B+C+S (rounds, standings cache) | B+C (captures) → S | R (nav countdown on every page) | — | — | — | — |
| FOM (`media.formula1.com`, formula1.com) | R/C (headshots, team logos) | links only | — | R (headshots via OpenF1 URLs, HEAD) | — | B (schedules) | — |
| FIA documents | label ("FIA / OpenF1") | — | — | reference (circuit length) | — | — | — |
| Pirelli press graphics | — | — | — | — | — | B, C (transcribed facts) | — |
| Open-Meteo | — | — | — | — | — | B+C+S | — |
| MultiViewer | — | — | — | C (corner geometry) | C (circuit geometry, HEAD) | — | — |
| 3D car model (CC BY 4.0); circuit outlines, flags (MIT); fonts (OFL) | — | — | — | — | C (`f1car.glb`, no credit found, HEAD) | C (credited) | — |
| Owner's Google Sheet + CORS proxies | — | — | — | — | — | — | R |

Evidence: R24, R27–R31, R34, R35, R46–R48. The full per-file references are in the ledger.

| Asset or right | Current usage | Proposed commercial usage | Rights holder | Evidence | Relevant terms | Readiness | Required action | Owner | Review date |
|---|---|---|---|---|---|---|---|---|---|
| OpenF1 data | See matrix | S4 sponsor in or on a tool. S3 weekend content with tools | OpenF1 (licensor). OpenF1 disclaims owning F1 data | R26–R31, P03, P04, P06 | CC BY-NC-SA 4.0: NonCommercial only, ShareAlike on adaptations, attribution when sharing. "Other use cases, please contact us". The repo's "approved" means the owner's acceptance of the NC licence for one session only | `UNRESOLVED` | Written commercial terms from OpenF1, plus the FOM question (next row), plus counsel on whether "NonCommercial" covers a sponsored free site | Site owner + counsel; provider | 2026-11-05 |
| Underlying F1 timing and results data | Via OpenF1 and Jolpica everywhere | S3, S4 | FOM claims copyright and database rights | P01 §2/§4 Timing data | Incidental editorial use only. No substantial or commercial reproduction | `UNRESOLVED`. `PROHIBITED` (rights-holder policy) for substantial commercial reproduction | Counsel on enforceability and "substantial". `REQUIRES_RIGHTS_HOLDER_APPROVAL` for any sponsored tool | Site owner + counsel | 2026-11-05 |
| Jolpica data | See matrix | S4, S3 | Jolpica (licensor) | R26, R28, R29, R31, P05 | CC BY-NC-SA 4.0. Free for non-commercial use. Commercial use: contact the provider. Terms may change. The rights file still says `unresolved` | `UNRESOLVED` | Written Jolpica commercial authorisation. Update the rights record wording (separate PR) | Site owner; provider | 2026-11-05 |
| Pirelli tyre facts | TYRES (facts only, no artwork) | S4 sponsor on TYRES | Pirelli | R34, P08, U12 | Corporate site content may not be reproduced without permission. The "rights free for media use" footer is repo-reported only. Pirelli is itself an F1 commercial partner | `UNRESOLVED` | Pirelli written confirmation. Counsel on the status of facts and database rights | Site owner; rights holder | 2026-11-05 |
| Open-Meteo weather | TYRES | S4 sponsor visible in TYRES | Open-Meteo (data CC BY 4.0) | R34, P07 | Free API is non-commercial. Sites or apps displaying advertisements count as commercial | `PROHIBITED` on the free tier when ads or sponsors are shown in the app. `CONDITIONAL` on a paid plan plus a retained CC BY credit | Choose a paid plan before any in-app sponsor. Counsel on whether the domain-wide strip affects TYRES today | Site owner | 2026-11-05 |
| MultiViewer circuit geometry | Telemetry and Ghost Car (committed, HEAD) | S4 | MultiViewer | R46, U08 | Terms not retrieved | `UNRESOLVED` | Read the terms | Site owner | 2026-11-05 |
| FIA documents | Telemetry reference; THE GRID label | S4 | FIA | R48, U09 | FIA terms not located | `UNRESOLVED` | Locate FIA document terms | Site owner | 2026-11-05 |
| formula1.com schedules (scraped) | TYRES build | S4 | FOM | R34, P02 | Site content is for personal, non-commercial use | `UNRESOLVED` | Counsel, or an alternative source | Site owner | 2026-11-05 |
| CORS proxies (corsproxy.io, allorigins) | BetCast runtime | S6 | Proxy operators | R35, P22 | The free tier allows production use within limits. Commercial use is not addressed | `UNRESOLVED` (low) | Read the terms before any commercial BetCast deal | Site owner | 2026-11-05 |
| Owner's own betting record (Google Sheet) | BetCast | S6 | Site owner (`OWNER_REPORTED`) | R35, R40 | No data-licence restriction found | `UNRESOLVED`: no data-licence blocker, but gambling rules apply (§4 S6) | See S6 | Site owner | 2026-11-05 |
| F1 Stories own code (5 repos) | Public, no LICENSE | — | Owner (default: all rights reserved) | R33 | Committed third-party captures and derivatives carry no licence notice | `UNRESOLVED` (ShareAlike / attribution notice on committed derivatives) | Counsel on ShareAlike duties for committed derivatives | Site owner + counsel | 2026-11-05 |

## 4. Scenario comparison

Every scenario also depends on four **cross-cutting blockers**. While any of these is unresolved, no scenario can be `CONDITIONAL` overall:

- **X1** Brand and domain question (§1 rows 1–4)
- **X2** Owner relationship records for the existing partners
- **X3** Approved disclosure policy ([editorial-independence-policy.md](editorial-independence-policy.md)) and publisher-identity advice
- **X4** Commercial approval kept separate from editorial approval, with no auto-merge for paid content [R36]

| Scenario | Technically possible today? | Scenario-specific blockers | Explicitly ruled out (absent licence) | Overall readiness |
|---|---|---|---|---|
| **S1 Website Partner**: paid logo and link in the existing strip | Yes. Strip, `rel="sponsored"` and the consented click event exist [R07, R14] | Written logo permission per partner. Plain "Χορηγία"/"Διαφήμιση" labelling (UCPD Art. 7(2) and ΕΚΔ-Ε Β12 [P12, P18]). The strip also renders inside data tools and BetCast [R09]. Reporting is limited to a consented click floor with no impressions [R15, R16] | Implying the partner is linked to F1 | `UNRESOLVED` |
| **S2 Technical Analysis Partner**: sponsor funds an engineering series | Yes (static pages) | Imagery limited to first-party or licensed images [R22, R24, P02, P09]. No sponsor pre-review of analysis (policy §2). Series label "Χορηγία: X" | A series name or lockup combining F1 marks with the sponsor [P01 §4] | `UNRESOLVED` |
| **S3 Race Weekend Partner**: sponsor supports one Grand Prix weekend | Yes | Event titles. Session data only incidental [P01 §2/§4]. No embedded OpenF1 tools inside sponsored pieces without provider authorisation [P03]. Promotional artwork free of F1, team or driver material | "<Grand Prix> presented by / powered by <sponsor>". Sponsor inside event-title lockups [P01] | `UNRESOLVED` |
| **S4 Race Desk Partner**: sponsor supports a data tool, visible in the app | Yes technically; the strip already renders in Telemetry and Ghost Car [R09] | OpenF1 and Jolpica non-commercial licences [P03, P05, P06]. FOM database-rights claim [P01]. Open-Meteo paid plan for TYRES [P07]. Pirelli confirmation [P08]. MultiViewer and FIA terms [U08, U09]. FOM headshots inside Telemetry [R24]. 3D model credit missing in Ghost Car [R47]. Attribution notices incomplete [R31] | Open-Meteo free tier with ads shown. Substantial commercial reproduction of FOM data (rights-holder policy) | `UNRESOLVED` |
| **S5 Sponsored Editorial Project**: commissioned article or project | Yes | "Χορηγούμενο περιεχόμενο" label above the title. "Σε συνεργασία με" alone is insufficient [P13 §2.9.2]. In-kind consideration counts as paid [P14]. A content flag and a human approval step are needed (none exist [R36]). Sponsor-supplied assets with documented rights | An advertorial that uses F1 marks, logos, images or data to promote the sponsor [P01 §4] | `UNRESOLVED` |
| **S6a BetCast**: statistical or editorial sponsorship by a **non-gambling** company | Yes; BetCast already shows the strip [R09] | Betting content today has no age or responsible-gaming notice and includes an operator-favourites guide [R38, R39]. Counsel on whether gambling rules reach editorial betting content [P19]. Category review (policy §9) | — | `UNRESOLVED` |
| **S6b BetCast**: sponsorship or promotion by a **licensed gambling operator** | Technically yes | ΕΕΕΠ-approved commercial-communication plan naming F1 Stories, obtained beforehand [P19 Art. 9]. Possible affiliate suitability licence [U04]. 21+ / ΕΕΕΠ / helpline marking [P20]. Audience must not mainly address minors; audience age is unknown [P19 Art. 4(j)]. The draft policy proposes excluding gambling altogether (owner decision) | Enrichment claims next to sponsorship [P19 Art. 8.3] | `UNRESOLVED` |
| **S6c**: commercial communication or sponsorship for an operator not licensed in Greece | — | — | Commercial communication and sponsorship for unlicensed operators [P19 Art. 11. Read in the official English translation; later amendments unchecked] | `PROHIBITED` |

**Result:** no scenario is `CLEARED` or `CONDITIONAL` overall. Each can become `CONDITIONAL` once X1–X4 are closed by owner decisions and counsel advice, and its own blockers are satisfied in writing.
