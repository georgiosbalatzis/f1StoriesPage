# B-01 current-state audit

This audit records what exists today at baseline `a2f89c71` (2026-11-05). Bracketed IDs point to [evidence-ledger.md](evidence-ledger.md).

The repo shows that code and placements exist. It cannot show whether any business arrangement behind them exists. Anything about payments, agreements or permissions is marked as an owner fact or `UNVERIFIED`.

## 1. Sponsorship section

**What the code does (`VERIFIED_REPOSITORY`)**
- The homepage section `#home-sponsors`, headed "ΜΑΖΙ ΣΤΗΝ ΕΚΚΙΝΗΣΗ" ("together at the start"), shows six partner logos [R07]. They are referred to here as P1–P6, in page order; the names are on the live page:

  | # | Label shown | Note |
  |---|---|---|
  | P1 | ΧΟΡΗΓΟΣ | Shares a destination domain with P3 |
  | P2 | ΣΥΝΕΡΓΑΤΗΣ | — |
  | P3 | POWERED BY | Shares a destination domain with P1. Logo file contains a third-party manufacturer mark [R12] |
  | P4 | ΣΥΝΕΡΓΑΤΗΣ | — |
  | P5 | ADVERTISING PARTNER | — |
  | P6 | ΣΥΝΕΡΓΑΤΗΣ | — |

- Every link opens in a new tab with `rel="noopener sponsored"`. Google says this is the correct markup for paid placements [P11]. That guidance concerns search engines only; it does not make the placement visible to readers as advertising.
- The strip appears in four places beyond the homepage:
  - every rendered article [R08];
  - Telemetry [R09];
  - Ghost Car, when not embedded [R09];
  - BetCast [R09].

  It therefore appears next to OpenF1 data and next to betting content.

**What is missing**
- **No plain-language label.** The four role words (ΧΟΡΗΓΟΣ, ΣΥΝΕΡΓΑΤΗΣ, POWERED BY, ADVERTISING PARTNER) are undefined and mix Greek and English. Nothing tells a reader whether any of these is a paid relationship.
- **No relationship record.** Nothing in the repo says what each relationship is (paid, in kind, unpaid, related party) or that the brand allowed its logo to be used [R10].
- **A third-party mark inside one logo.** One logo file contains another manufacturer's mark [R12].

**Owner facts needed (`OWNER_REPORTED` pending)**
- For each of the six listings: the relationship type, the consideration (money or in kind), the date it started, whether there is written logo permission, and any related-party connection.
- Record these **privately, outside this public repo**. Only the public-facing classification belongs here.

## 2. Logo pipeline

- `scripts/build/normalize-sponsors.mjs` trims transparent margins and fits each logo into 320×160 (and a 1x variant) as lossless WebP. It does not recolour or crop the artwork [R11]. Several source files already carry a white outline that the pipeline did not add. Whether the brands approved that treatment is `UNVERIFIED`.
- The pipeline needs no change for B-01. No logo was modified in this audit.

## 3. Contact flow

- There is a single homepage form posting to Formspree. It collects name, email and message, uses a honeypot field, and says replies "usually" come within 48 hours. A mailto address is also shown [R18].
- The form already receives partnership ("συνεργασία") enquiries. This is enough for a first commercial conversation, so no new intake system is needed.
- **Gap:** there is no purpose or privacy notice at the point of collection. The privacy link is in the footer only [R18]. Whether the current notice is adequate is `REQUIRES_LEGAL_REVIEW` [U06].

## 4. Analytics coverage

- GA4 loads only after analytics consent. All advertising consent signals are permanently denied [R13].
- Partner clicks are recorded as `outbound_click` with `sponsored: true` [R14]. The event has three limitations:
  - `link_text` captures the role label, not the brand.
  - P1 and P3 share a destination domain, so listings are identifiable only by domain plus role label. That breaks if the labels change, and there is no placement ID.
  - Modified clicks (Ctrl/Cmd, middle button) are not counted.
- No impression measurement exists for any placement [R16].
- **Coverage boundary:** every metric describes consenting visitors only. There is no denominator for all visitors [R15].
  - Telemetry, Ghost Car, TYRES and BetCast carry no GA4 at all (`docs/intelligence/event-inventory.md#L93-L98`).
  - Any sponsor-facing number is therefore a floor of consented click intent. It is not audience size, reach or delivered visits.
- No ad server, ad network, tracking pixel, heatmap or affiliate tracking exists [R17].

## 5. Existing policies

| Policy | Status |
|---|---|
| Privacy notice (updated 2026-09-09) | Lists Formspree, GA4 (with ad signals denied), YouTube, social embeds, OpenF1/Jolpica, and partners "με σήμανση sponsored". Names a contact address but no publisher or legal entity [R19] |
| Terms | Has a not-betting-advice statement and a corrections section. Has no advertising, sponsorship or editorial-independence clause [R20] |
| Corrections | A structured record plus a per-article "Στείλε διόρθωση" link [R37] |
| Complaints | No separate process [R37] |
| Editorial approval | Two-editor review is optional. Author PRs auto-merge once CI passes, and CI is explicitly "not editorial approval" [R36] |
| Media policy | Exists and separates credit from permission. The rights register is sparse (126 of about 1,076 images, with no licence values) [R22, R23] |
| Brand disclaimer | No site-level "unofficial / not associated with Formula 1" notice exists [R05]. The Race Desk OpenF1 sections describe their data *source* as unofficial; that is not a site disclaimer [R06]. The TYRES app carries its own app-level disclaimer [R34] |
| Commercial policy, sponsor contract template, rate card, media kit, sponsor reporting definition | None exist [R10] |
| Newsletter | Production-disabled, with no subscribers [R21] |

## 6. Race Desk dependencies (summary)

The full provider × product matrix is in [rights-matrix.md §3](rights-matrix.md#3-race-data-provider--product-dependencies).

- **OpenF1** (CC BY-NC-SA 4.0, non-commercial) feeds THE GRID tabs, the debrief and dirty-air caches, the hub timeline and pace sections, Telemetry and Ghost Car [R28, R29, P03].
- **Jolpica** (CC BY-NC-SA 4.0, non-commercial) feeds THE GRID standings and pit stops, the hub results, and the countdown in the site navigation on every page [R28, P05].
- **TYRES** depends on Pirelli press graphics (facts transcribed), Open-Meteo (non-commercial free tier) and formula1.com schedules [R34, P07, P08].
- **BetCast** uses only the owner's own spreadsheet [R35].
- **Rights record:** `publication-rights.v1.json` holds the site owner's acceptance of the OpenF1 non-commercial licence for one session. It holds no provider authorisation. Jolpica is `unresolved` there, even though Jolpica's terms are now verified [R26, P05]. Only the timeline and pace builders are gated by this record [R27].
- **Committed data:** raw API captures and derived datasets are committed to the public repos. No repo has a LICENSE file [R29, R30, R33].

## 7. Brand and domains

- **Brand:** the name, the logo wordmark, the domain `f1-stories.gr` and the social handles all contain "F1" [R01–R04].
- **Old domain:** `f1stories.gr` returned NXDOMAIN on 2026-10-24. On 2026-11-05 it resolves to Cloudflare addresses, and its controller is unknown [N02].
- F1's published guidelines address domains, brand identity and disclaimers [P01]. The analysis is in [risk-register.md](risk-register.md) CR-01 and [rights-matrix.md §1](rights-matrix.md#1-brand-domains-and-formula-1-marks).

## 8. Betting content

- "Στοίχημα" is a public editorial category with a published betting record that includes bookmakers, odds and stakes [R38, R40].
- One guide names three operators as favourites and uses wording about enrichment [R39].
- There is no age, ΕΕΕΠ or responsible-gaming notice anywhere [R38].
- There are no operator links, operator logos or affiliate links [R41].
- **Owner fact needed:** whether any betting operator has ever given anything of value (money, free bets, accounts, invitations, goods).

## 9. Missing capabilities (for later phases, not built in B-01)

| Missing | Needed for |
|---|---|
| Plain-language commercial labels and one defined set of relationship types | S1–S6 |
| Public "Χορηγοί & συνεργασίες" disclosure page and publisher identity | S1–S6 (subject to counsel) |
| Separate commercial approval, and a human editorial approval step for paid content (no auto-merge) | S2, S3, S5 |
| A content or metadata flag for sponsored items | S2, S3, S5 |
| Rights ledger with a "commercial use" column (images, logos, F1 and team assets, avatars, site logo) | S1–S5 |
| Provider register for every data source, with written commercial authorisations | S3, S4 |
| Sponsor report definition (consented-cohort caveat, click floor, no impressions) | S1, S4 |
| Per-placement identifier in the existing click event | S1, S4 |

Everything in this table is a later decision that needs owner approval. No item requires a commercial backend: each fits the existing static site, the existing click event and the existing contact form.
