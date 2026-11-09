# Commercial inventory

Internal documentation only; no commercial offer, price, or legal clearance. **2026-11-09.** No saleable capacity is confirmed. Evidence baseline: main repository `aa6744f0943736642dc67df4cea03d5f107cd0fe`; sibling deployment pins and the distinction between pinned source, served HTML and browser execution are recorded in [B-01 evidence ledger](evidence-ledger.md#rec-02-reconciliation-2026-11-09) (R07–R09, R34).

## Availability and counting

These are independent dimensions, not a sequence or mutually exclusive statuses:

- **OBSERVED:** present in source or verified production, with the evidence type stated.
- **OCCUPIED:** a listing appears; its commercial relationship is unknown.
- **CAPACITY_UNVERIFIED:** saleable capacity has not been established.
- **RIGHTS_GATED:** applicable rights and permissions remain unresolved.
- **NOT_FOR_SALE:** no current commercial offer is authorised.
- **ELIGIBLE_FOR_LATER_REVIEW:** a conditional candidate after required evidence and approvals; this is neither availability nor clearance.

The existing inventory is **one strip family with six occupied listing positions, P1–P6**, not separate products per surface, article or page view. The first five dimensions apply to the documented strip; later review depends on release or separately approved expansion and all applicable gates. No vacancy follows from markup. Occupied positions cannot be treated as available without an owner-approved release or expansion. Labels and `rel="sponsored"` establish neither payment nor adequate reader disclosure (R07, R10; [current-state audit](current-state-audit.md#1-sponsorship-section)).

## Observed surface register

All rows refer to the same family and observed P1–P6 listings, not additional capacity. Each requires owner confirmation of relationships, logo and placement permissions, intended distribution and release; applicable brand, provider, disclosure, privacy and business approvals remain open. The [rights matrix](rights-matrix.md#4-scenario-comparison) and [risk register](risk-register.md) govern the actual X1–X4, CR and BR gates. No row establishes availability. Measurement is limited as described in the [measurement table](pricing-methodology.md#performance-evidence-and-handoff).

| Surface and location | Format, rendering, control and distribution | Measurement | Particular rights and approval dependencies |
|---|---|---|---|
| Homepage, `#home-sponsors` | Static logo, role label and outbound link in homepage source; shared with generated article output. Source and served HTML observed (R07; `index.html:650`; `blog-module/build/article-render.js:99`). | Consented main-site outbound click emitter; no placement impression or reliable campaign identity. | F1 brand/domain and association, each logo and relationship, reader disclosure and navigation provider use (CR-01, CR-02, CR-05, CR-07, CR-09). |
| Generated articles, partner section | Same logo/label/link list extracted wholesale from homepage when generated; committed article copies persist until rebuilt (`blog-module/build/article-render.js:99`, `:603`; R08). | Main-site consented clicks subject to identity and coverage limits; no sponsor exposure measure. | Homepage dependencies plus article media and actual co-display/disclosure assessment (CR-02, CR-05, CR-08; X2). |
| Telemetry, footer | Separate static sibling source copy, suppressed in embed mode; pinned source and bundle evidence, no browser render verified (R09; `scripts/deployment/sources.json:14`). | No current sponsor-specific measurement established. | OpenF1 and actual media/geometry uses, attribution and commercial scope (CR-03, CR-09; R28, R46). |
| Ghost Car, sponsor section | Separate static sibling source copy, suppressed in embed mode; pinned source and bundle evidence, no browser render verified (R09; `scripts/deployment/sources.json:14`). | No current sponsor-specific measurement established. | OpenF1, geometry and model provenance/permissions (CR-03, CR-09; R46–R47). |
| TYRES, partner strip | Separate static sibling copy; pinned source and served HTML verified, separate embed output unverified (R09, R34). | No current sponsor-specific measurement established. | Open-Meteo service use, other data and media rights; the limited weather hold is not clearance (CR-03, CR-09; R34, P07). |
| BetCast, partner strip | Separate static sibling copy; pinned source and bundle evidence, no browser render verified; embed exclusion is a pinned-source finding (R09, R35). | No current sponsor-specific measurement established. | Separate betting-context/category and service assessment; own Sheet and proxy dependencies, not an inferred OpenF1 dependency (CR-04, BR-12; R35, P22). |

## Shared control and capacity prerequisite

The homepage and newly generated articles are coupled by extraction. Homepage-only isolation is **NOT IMPLEMENTED**. Before an offer restricted to the homepage and its `/index.html` alias, isolate the listing from article extraction, rebuild and inspect intended article output, and verify the selected built and deployed scope. Consider existing committed article copies and later rebuilds; editing individual generated articles is not a durable control. Race Desk and BetCast are outside that proposed scope, including free or substitute placements.

The four sibling lists are separate source copies with separate deployment pins; no common campaign switch is evidenced. Releasing a homepage position does not release sibling copies or authorise removal elsewhere. The owner must privately identify the position, authorised term, existing obligations and retained distribution. An expansion requires separate approval, design, costing and testing; it is not existing capacity. The fixed asset list and six-column layouts require review for expansion (`scripts/build/normalize-sponsors.mjs:9`; R11).

## Supporting capabilities and dependencies

The logo pipeline produces **160×80 1x and 320×160 2x** lossless WebP assets, preserving source colours; CSS can change presentation independently, and approval of existing treatments is unverified (`scripts/build/normalize-sponsors.mjs:9`; `blog-module/blog/article-editorial.css:1252`; R11–R12). Logo permission is use-specific.

Ordinary articles and discovery exist, and the homepage contact form provides an existing intake route; neither establishes a commercial placement or approval. Curated audience foundations are unapproved or unpublished, and newsletter delivery is disabled (`docs/audience/collections.md:3`; `docs/audience/newsletter-a06.md:3`; R18, R21). Funding controls, scheduling, homepage isolation and sponsor reporting are **NOT IMPLEMENTED**. The proposed S1/S2 boundaries and scenario gates belong in [packages](packages.md); all scenarios remain `UNRESOLVED`, with S6c separately `PROHIBITED`.

## Owner information required — blank private template

Complete and retain sensitive records privately, outside this public repository. Empty fields do not imply absence or approval.

- Position (P1–P6): ______
- Relationship, consideration, term, renewal and release/co-placement obligations: ______
- Logo ownership, permissions, source artwork and approved treatments: ______
- Proposed scope, retained distribution, capacity and expansion decision: ______
- Applicable brand, media, provider, disclosure and legal/privacy assessments: ______
- Operational owner, installation/removal, checks and approval records: ______
- Consent, reporting scope, evidence and retention decisions: ______
- Business, tax and contracting prerequisites: ______
