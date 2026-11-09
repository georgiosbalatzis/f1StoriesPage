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
- At the 2026-11-05 baseline the strip was recorded in these places beyond the homepage:
  - every rendered article [R08];
  - Telemetry, when not embedded [R09];
  - Ghost Car, when not embedded [R09];
  - BetCast [R09].

  On 2026-11-09, the six-logo strip including ADVERTISING PARTNER was also verified in TYRES pinned source and served HTML [R09, R34]. Telemetry and Ghost Car suppress it in embed mode; their and BetCast’s bundles were checked without a browser render. The placements raise OpenF1, Open-Meteo and betting-context questions.

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
- The inspected runtime event inventory has no impression event; specified discovery placements lack exposure denominators [R16].
- **Coverage boundary:** GA4 metrics describe consenting main-site visitors only, with no all-visitor denominator; other sources have their own populations [R15].
  - The 2026-11-05 inventory records no GA4 in inspected Telemetry, Ghost Car, TYRES and BetCast snapshots; this does not establish their present state (`docs/intelligence/event-inventory.md#L91-L98`).
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
| Media policy | Exists and separates credit from permission. The rights register is sparse (126 records for 1,084 numbered originals at deployed 786765799, with no licence values) [R22, R23] |
| Brand disclaimer | No site-level "unofficial / not associated with Formula 1" notice exists [R05]. The Race Desk OpenF1 sections describe their data *source* as unofficial; that is not a site disclaimer [R06]. The TYRES app carries its own app-level disclaimer [R34] |
| Commercial policy, sponsor contract template, rate card, media kit, sponsor reporting definition | None exist [R10] |
| Newsletter | Production-disabled, with no subscribers [R21] |

## 6. Race Desk dependencies (summary)

The full provider × product matrix is in [rights-matrix.md §3](rights-matrix.md#3-race-data-provider--product-dependencies).

- **OpenF1** (CC BY-NC-SA 4.0, non-commercial) feeds THE GRID tabs, the debrief and dirty-air caches, the hub timeline and pace sections, Telemetry and Ghost Car [R28, R29, P03].
- **Jolpica** (CC BY-NC-SA 4.0, non-commercial) feeds THE GRID standings and pit stops, the hub results, and the countdown in the site navigation on every page [R28, P05].
- **TYRES** depends on Pirelli press graphics (facts transcribed), Open-Meteo (non-commercial free tier) and formula1.com schedules [R34, P07, P08]. The limited weather hold and existing-use rights are reconciled in [the REC-02 evidence](evidence-ledger.md#rec-02-reconciliation-2026-11-09).
- **BetCast** uses only the owner's own spreadsheet [R35].
- **Rights record:** `publication-rights.v1.json` holds the site owner's acceptance of the OpenF1 non-commercial licence for one session. It holds no provider authorisation. Jolpica remains `unresolved` in that record [R26]; verifying published terms [P05] does not resolve publication rights or establish commercial authorisation. Only the timeline and pace builders are gated by this record [R27].
- **Committed data:** raw API captures and derived datasets are committed to the public repos. No repo has a LICENSE file [R29, R30, R33].

## 7. Brand and domains

- **Brand:** the name, the logo wordmark, the domain `f1-stories.gr` and the social handles all contain "F1" [R01–R04].
- **Old domain:** N02 retains the 2026-11-05 DNS observation and unverified earlier NXDOMAIN report. On 2026-11-09 the owner reported reacquisition and control through a registrar (OWNER_REPORTED); HTTP/HTTPS checks verified 301 redirects preserving tested paths and queries (LIVE_VERIFIED). Registry details remain UNVERIFIED [N02, U13]. Domain control does not resolve trademark or commercial domain-use permissions.
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
| Visible relationship/format disclosures | Assess the selected S1–S6 format under X3; wording and legal sufficiency require review |
| General publisher/provider information and identifiable contracting party | Separate applicability/scope assessment [CR-07, U02]; do not infer that only paid editorial triggers it |
| Proposed public disclosure page and full draft policy | Owner governance choice, with counsel review; not asserted as a universal statutory prerequisite |
| Separate commercial and human editorial approval, plus paid-content identification | S2/S5 and S3/S6 where paid editorial is commissioned [CR-08]; article auto-merge is not automatically a static-logo blocker |
| Use-specific media/logo rights records | Every scenario using those assets; no archive-wide clearance inferred [CR-02, CR-05] |
| Provider permission/scope evidence | Actual affected provider uses, including S1 distributed into tools and S2/S5 incorporating data [CR-03, CR-09, CR-11] |
| Reporting scope and privacy review | Any scenario promising reports; only evidenced consented-click claims [CR-10, BR-11] |
| Per-placement click identifier | Needed only for a reporting promise the current event cannot support; not required merely to render a static placement |

Assess the selected scenario using the [X1–X4 applicability matrix](rights-matrix.md#4-scenario-comparison). Any implementation is a later owner decision; these assessments do not require a commercial backend.
