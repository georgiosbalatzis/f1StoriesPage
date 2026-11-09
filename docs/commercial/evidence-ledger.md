# B-01 evidence ledger

This is the audit trail for every material claim in `docs/commercial/`. Other documents cite entries by ID (`R..`, `N..`, `P..`, `U..`). Each entry gives the smallest reference that is enough to check it. Long third-party text is paraphrased, not copied.

- **Baseline:** `georgiosbalatzis/f1StoriesPage` at `a2f89c7102dab158c77763559553f2245569943a` (origin/main, 2026-11-05).
- **Permalink base (main):** `https://github.com/georgiosbalatzis/f1StoriesPage/blob/a2f89c7102dab158c77763559553f2245569943a/`
- **Sibling repos** were read at their remote HEAD on 2026-11-05:

  | Short | Repo | Commit read | Deployed pin (`scripts/deployment/sources.json`) |
  |---|---|---|---|
  | `T/` | `f1-telemetry-dashboard` | `d08fb001eb06f9a4cf2746098b07c69365d53f02` | `38c3dd20` |
  | `G/` | `ghostcar` | `91483ad74b7a5d0de747e1c8285187a987438580` | `4d7a783d` |
  | `Y/` | `Tyres` | `50e5f50be89e038257cbe3426b366810e0c1f59a` | same |
  | `B/` | `BetCastVisualisation` | `58202f38c763ea2b4476c9b57d09f042e6805301` | `74eeb98b` |

  Sibling claims describe **remote HEAD source**, not necessarily the deployed apps. Only three files were also confirmed at the deployed pins: Telemetry `SiteFooter.tsx`, Ghost Car `SponsorSection.jsx` and BetCast `googleSheetService.js`. Treat every other sibling claim as "(HEAD)" until it is checked against the pin.
- **Last checked:** all entries 2026-11-05 unless stated.

**Labels:** `VERIFIED_REPOSITORY`, `VERIFIED_PRIMARY_SOURCE`, `OWNER_REPORTED`, `INFERENCE`, `UNVERIFIED`, `REQUIRES_LEGAL_REVIEW`, `REQUIRES_RIGHTS_HOLDER_APPROVAL`.

A primary source can show that a restriction exists. It does not show how that restriction applies to F1 Stories; that question is `REQUIRES_LEGAL_REVIEW` throughout.

## REC-02 reconciliation (2026-11-09)

The [live deployment manifest](https://f1-stories.gr/deployment-manifest.json) reports the following deployed values (`LIVE_VERIFIED` as manifest contents, not independent artifact provenance): F1 Stories `786765799f6526b2f70d7361ea38c22a8b3b56bd`; TYRES code `249aa796a1981be4f70213c9f1973b4418faf3ca`; TYRES data `dbc69155aaa8e8c2af3556ef02ba18d54ad0ba0c`; Ghost Car `13fc12afb7c73ccbab6e71fc3d3210d922038d51`. These match the owner-reported snapshot. Main `scripts/deployment/sources.json#L14-L50` agrees with the code pins; TYRES data tracks `main` rather than a fixed SHA there. Reconciled 2026-11-09: deployed code pins are Telemetry `38c3dd2018b810a5dce1add1f7663bcb199c845a`, Ghost Car `13fc12afb7c73ccbab6e71fc3d3210d922038d51`, TYRES `249aa796a1981be4f70213c9f1973b4418faf3ca` and BetCast `74eeb98b4acb1b4e0ea45d4ab12f7fdf4e0c2650`; these are deployment pins, not current sibling HEADs.

At these source snapshots, `scripts/build/refresh-standings-data.mjs#L233-L276` isolates optional dirty-air and debrief refresh failures while requiring the main snapshot. TYRES `Y/scripts/update-weekends.ts#L11-L12` and `#L81-L120` hold new weather requests for Las Vegas and Lusail; eligible non-held records can still request Open-Meteo. The weather hold for Las Vegas and Lusail limits new Open-Meteo requests. It does not resolve commercial rights for existing Open-Meteo usage elsewhere. TYRES data `data/tracks/las-vegas.json` and `data/tracks/lusail.json` contain centre-line geometry sourced to `us-2023` and `qa-2004` respectively, without elevation, sectors, direction or start/finish. Ghost Car `G/src/api.js#L87-L105` retries 429 responses and throws `API 429` when exhausted. Main `.github/workflows/aggregate-dry-run.yml#L7-L14` and `#L47-L55` run integration for source-pin PR changes; `.github/workflows/tyres-pin.yml#L70-L90` waits for Site Quality and Ecosystem dry run before merging. Universal branch protection was not inspected. These operational facts do not establish commercial rights.

## Repository evidence (main, `a2f89c71`)

All entries in the tables below are `VERIFIED_REPOSITORY` unless marked otherwise.

### Brand, identity and domains

| ID | Claim | Reference |
|---|---|---|
| R01 | The canonical domain is `f1-stories.gr`, and the sitemap uses it throughout | `CNAME#L1`, `index.html#L31`, `sitemap.xml` |
| R02 | The site name in title, OG, Twitter and JSON-LD is "F1 Stories" ("F1 Stories \| Formula 1 στα ελληνικά") | `index.html#L15`, `#L17`, `#L27`, `#L55-L78`; `partials/head-meta.html#L3` |
| R03 | The logo puts the "F1 STORIES" wordmark next to a red single-seater. The source file is gitignored, so its authorship is not recorded in the repo. `VERIFIED_REPOSITORY` (visual) / `UNVERIFIED` (authorship) | `images/icons/icon-512.png`, `images/logo-256.webp`, `images/logo-nav.webp`; `.gitignore#L53`; `scripts/build/optimize-logo.mjs` |
| R04 | Social handles contain "f1" | `partials/footer.html#L17-L19`; `index.html#L65-L69` |
| R05 | No site-level "unofficial / not associated with Formula 1" disclaimer exists. Terms §3 only says third-party and team logos are used for informational or quotation purposes | Repo search (unofficial, ανεπίσημ, affiliated, Formula One Licensing, trademark, εμπορικ σήμ); `privacy/terms.html#L127-L129` |
| R06 | The only "unofficial, not associated with Formula 1" wording is in the Race Desk timeline and pace sections, attached to OpenF1 data. Those sections also carry the CC BY-NC-SA notice | `scripts/race-desk/timeline-render.mjs#L47`, `scripts/race-desk/pace-render.mjs#L58` |
| R44 | Race Desk hub pages are titled with Grand Prix names | `race-desk/gp/2026-singapore-gp/index.html#L15`, `#L94` |
| R43 | 2026-11-05 baseline: BetCast is linked from the navigation and footer on every page Reconciled 2026-11-09: BetCast is linked from shared navigation and footer on pages including those partials; deployed 404.html does not include the link. | `partials/nav.html#L12`, `#L36`; `partials/footer.html#L13` |

### Partner strip and commercial infrastructure

| ID | Claim | Reference |
|---|---|---|
| R07 | The homepage section "ΜΑΖΙ ΣΤΗΝ ΕΚΚΙΝΗΣΗ" shows six partner logos with the labels ΧΟΡΗΓΟΣ, ΣΥΝΕΡΓΑΤΗΣ ×3, POWERED BY and ADVERTISING PARTNER. Every link has `target="_blank" rel="noopener sponsored"` | `index.html#L650-L663` |
| R08 | 2026-11-05 baseline: The build copies the same strip into every article. All rendered `article.html` files contain it (an orchestrator search for files without it returned none; Worker A counted 425) Reconciled 2026-11-09: At main commit 786765799, 429 committed article HTML files were counted using `git ls-tree -r --name-only 786765799 blog-module/blog-entries` filtered for `/article.html` paths; this is not a production-index count. | `blog-module/build/article-render.js#L99-L111`, `#L603` |
| R09 | Baseline source records the strip inside Telemetry, Ghost Car (non-embed) and BetCast. 2026-11-09 reconciliation: pinned TYRES source and served HTML show the six-logo strip, including ADVERTISING PARTNER (LIVE_VERIFIED); the prior omission was not evidence of absence. Telemetry and Ghost Car suppress the strip in embed mode; their and BetCast’s deployed bundles support injection but were not browser-rendered | Baseline references: `T/src/components/dashboard/SiteFooter.tsx#L4-L30`; `G/src/app/SponsorSection.jsx#L1-L8`; deployed Ghost Car 13fc12a `G/src/F1PhantomCars.jsx#L670`; `B/src/components/SponsorStrip.jsx#L3-L21`. TYRES `249aa796a1981be4f70213c9f1973b4418faf3ca`, `index.html#L88-L128`; https://f1-stories.gr/tyres/ checked 2026-11-09 |
| R10 | The repo holds no partner agreement, logo permission, payment record, rate card, media kit or sponsor report contract. Whether any exists outside the repo is `UNVERIFIED` | Searched docs, scripts, data and partials for sponsor, χορηγ, campaign, media kit, rate card and impressions |
| R11 | Logo normalisation trims and resizes ("contain"); it does not recolour the logos | `scripts/build/normalize-sponsors.mjs#L15-L23` |
| R12 | One partner logo file also contains a third-party equipment manufacturer's mark. `VERIFIED_REPOSITORY` (visual) | `images/sponsors/BalatzisDomika.webp` |
| R18 | The contact form posts to Formspree and collects name, email and message. There is no purpose or privacy notice at the point of collection. The form copy invites "συνεργασία" enquiries and says replies "usually" come within 48 hours | `index.html#L615-L649`; `scripts/f1-optimized.js#L114-L128` |
| R19 | The privacy page says sponsors appear as plain external links "με σήμανση sponsored" and that no ad network or retargeting is loaded. It lists Formspree, GA4, YouTube and OpenF1/Jolpica. It names a contact email but no legal entity. Last updated 2026-09-09 | `privacy/privacy.html#L104`, `#L114-L116`, `#L158-L163` |
| R20 | The terms have no advertising, sponsorship or editorial-independence clause. They do have a corrections section (§9) and a "not betting advice" statement | `privacy/terms.html#L121-L123`, `#L164-L167` |
| R21 | The newsletter is production-disabled, with no provider and no subscribers | `docs/audience/newsletter-a06.md#L3-L14` |
| R42 | `docs/` is not part of the public site artifact; it is published only through the public GitHub repo Reconciled 2026-11-09: The public artifact allowlist and output copy are referenced here. | `scripts/build/public-artifact.mjs#L391-L434`, `#L470-L479`; `scripts/build/public-artifact.mjs#L391-L434`, `#L470-L479` |

### Analytics

| ID | Claim | Reference |
|---|---|---|
| R13 | GA4 loads only after analytics consent, and its cookies are cleared on refusal. Consent Mode keeps `ad_storage`, `ad_user_data` and `ad_personalization` set to `denied` | `scripts/analytics.js#L34-L73`, `#L274-L299`; `scripts/cookie-consent.js#L13`, `#L195` |
| R14 | `outbound_click` sends `sponsored: true` and `link_section: sponsor` for partner links (`VERIFIED_REPOSITORY`). `link_text` records the role label rather than the brand, and two listings share one destination domain. Neither field identifies a listing on its own; today only the combination of domain and label does, and that breaks if labels change. There is no placement ID (`INFERENCE` from the code) | `scripts/analytics.js#L125-L136`, `#L176-L209`, `#L215-L216` |
| R15 | 2026-11-05 baseline: Every metric covers consented visits only. There is no denominator for all visitors Reconciled 2026-11-09: GA4 metrics cover consented main-site visits only; other sources have their own populations. GA4 has no all-visitor denominator. | `docs/intelligence/metrics-contract.md#L9-L12`; `docs/audience/privacy-data-flow.md#L41`; `docs/audience/measurement-contract.md#L24` |
| R16 | 2026-11-05 baseline: No impression measurement exists for any placement Reconciled 2026-11-09: The inspected public runtime event inventory contains no impression event; the measurement contract identifies missing denominators for the specified discovery placements. | `docs/audience/measurement-contract.md#L66`, `#L82`; `docs/intelligence/event-inventory.md#L17-L36` |
| R17 | No ad server, ad network, tracking pixel, heatmap or affiliate parameter is present. Matches for `connect.facebook.net` and `stats.g.doubleclick.net` are the Facebook embed SDK and the GA4 collection host in CSP and guard lists | Repo search for adsbygoogle, googlesyndication, gpt.js, prebid, fbq, TikTok/LinkedIn pixels, hotjar, clarity, taboola, outbrain |

### Media and image rights

| ID | Claim | Reference |
|---|---|---|
| R22 | 2026-11-05 baseline: The media register has 126 records for about 1,076 numbered article originals. No record has a `license` or `rights` value. Only 7 carry a credit, and 6 are documented AI-generated images. The schema has no field for rightsholder or first-party ownership Reconciled 2026-11-09: At deployed 786765799, 1,084 top-level numbered original image files matched numbered JPG, JPEG, PNG or WebP filenames; the register still had 126 records, 7 credits, 6 synthetic entries and no populated licence or rights values. | `blog-module/media-metadata.json`; `blog-module/build/media-meta.js#L21` |
| R23 | The project's own media policy says a credit or CDN URL does not establish permission. It also lists an open rights queue: 12 placeholdered assets, an identifiable minor, and a "Category C" source queue Reconciled 2026-11-09: The credit and permission discussion is at lines 138–154. | `docs/article-media-policy.md#L138-L159`; `docs/final-release-candidate.md#L56-L69`; `docs/article-media-policy.md#L138-L154` |
| R24 | THE GRID: 24 driver headshots and 12 team logos are downloaded from `media.formula1.com` by build scripts and self-hosted, with a remote fallback. Telemetry (HEAD): driver headshots are loaded at runtime from the `headshot_url` that OpenF1 returns, which points to `media.formula1.com`. No licence is recorded | `standings/core/drivers-meta.js#L8-L39`, `#L120-L125`; `scripts/build/fetch-driver-headshots.mjs`; `standings/core/teams.js#L9-L17`; `scripts/build/fetch-team-logos.mjs`; `T/src/components/dashboard/broadcast/DriverCards.tsx#L64-L66`; `T/src/components/dashboard/broadcast/TimingTower.tsx#L76-L78` |
| R25 | 2026-11-05 baseline: Social cards combine each article's own image with the F1 Stories logo. They carry no sponsor elements. The homepage card reads "ΑΝΕΞΑΡΤΗΤΗ ΕΚΔΟΣΗ FORMULA 1" and shows team and driver imagery Reconciled 2026-11-09: Article cards use their published OG image or a branded fallback and add the F1 Stories logo; the renderer adds no partner-strip placement. Source imagery can itself contain sponsor marks. | `scripts/build/social-cards.mjs#L16`; `docs/social-cards/README.md#L3`; `index.html#L21`; `scripts/build/social-cards.mjs#L142-L189`, `#L253-L276`; `docs/social-cards/README.md#L3-L9` |
| R45 | The author avatars are illustrations whose artist, tool and rights are not recorded. One appears to carry an F1 team's branding. `VERIFIED_REPOSITORY` (visual) / `UNVERIFIED` (provenance) | `images/avatars/`; `blog-module/taxonomy.js#L50-L105` |

### Race data

| ID | Claim | Reference |
|---|---|---|
| R26 | `publication-rights.v1.json` records OpenF1 as `approved` by the "site owner" on 2026-11-02 under CC BY-NC-SA 4.0. The pace scope is limited to the 2026 Singapore race (meeting 1296, session 11388). Jolpica is `unresolved` ("R-04 predates this record"). The file has no fields for provider authorisation or commercial scope | `data/race-desk/publication-rights.v1.json#L4-L27` |
| R27 | Only the hub timeline and pace builders read that record. Results, THE GRID and the sibling apps are not gated by it | `scripts/race-desk/timeline-files.mjs#L27-L31`; `scripts/race-desk/capture-openf1-pace.mjs#L30`; `docs/r09-reliability-audit.md#L27` |
| R28 | 2026-11-05 baseline: OpenF1 and Jolpica are called from the browser by THE GRID, by the countdown in the navigation on every page, and by Telemetry and Ghost Car Reconciled 2026-11-09: THE GRID calls OpenF1 and Jolpica; the navigation countdown calls Jolpica; Telemetry and Ghost Car call OpenF1 at deployed pins 38c3dd2 and 13fc12a. | `standings/standings.js#L43-L44`; `standings/tabs/quali-gaps.js#L27`; `standings/tabs/dirty-air.js#L24`; `standings/tabs/pit-stops.js#L236-L237`; `scripts/shared-nav.js#L755`; `T/src/api/openf1.ts#L9`; `G/src/api.js#L1` |
| R29 | Derived OpenF1 and Jolpica datasets are built, committed and served: the debrief cache, the dirty-air cache and the standings rounds | `standings/debrief-cache.js#L5`; `blog-module/dirty-air-cache.js#L6`; `scripts/build/refresh-standings-data.mjs#L10`; `.github/workflows/publish-blog.yml#L201-L208` |
| R30 | Raw OpenF1 and Jolpica API responses are committed to the public GitHub repo. They do not reach the site artifact | `data/race-desk/captures/`; `docs/race-desk-timeline.md#L20` |
| R31 | Attribution differs by surface. Hub timeline and pace show the full CC notice. Hub results show "Πηγή: Jolpica" only. THE GRID names Jolpica and OpenF1 without a licence notice. Telemetry and Ghost Car say "OpenF1" without a licence notice Reconciled 2026-11-09: The Jolpica label remains at line 173 at deployed main 786765799. | `scripts/race-desk/results-render.mjs#L23`; `standings/index.html#L173`, `#L383`; `T/src/copy.ts#L176`; `G/src/app/DeskHero.jsx#L29`; main 786765799 `standings/index.html#L173` |
| R32 | Two THE GRID tabs show the wrong data-source label (quali gaps and pit stops are swapped) | `standings/standings.js#L74`, `#L79-L80` vs `standings/tabs/quali-gaps.js#L410-L411`, `standings/tabs/pit-stops.js#L236` |
| R33 | None of the five F1 Stories repos has a LICENSE file. The GitHub API reports `license: null` | GitHub API, 2026-11-05 |
| R34 | TYRES transcribes facts from Pirelli press graphics without republishing the artwork. It takes weather from Open-Meteo at build time and shows an unofficial / no-affiliation notice. The 2026-11-09 strip finding is in R09; the limited weather hold and continued eligible requests are in the REC-02 reconciliation above | `Y/docs/DATA-SOURCES.md#L14`, `#L113-L116`, `#L141-L163`; `Y/src/ui/strings.ts#L376`, `#L495-L497`; `Y/README.md#L13-L15` |
| R35 | BetCast reads the owner's own Google Sheet, with corsproxy.io and allorigins as fallbacks. No race-data provider was found | `B/src/services/googleSheetService.js#L26-L34` |
| R46 | 2026-11-05 baseline: Telemetry and Ghost Car (both HEAD) commit circuit geometry taken from the MultiViewer API. Ghost Car's interface credits MultiViewer Reconciled 2026-11-09: The geometry and credit were checked at deployed Telemetry 38c3dd2 and Ghost Car 13fc12a. | `T/src/telemetry/singapore2026.ts#L4-L5`; `G/src/domain/bakuLandmarks.json#L3`; `G/src/features/analysis/AnalysisFigures.jsx#L204` |
| R47 | 2026-11-05 baseline: TYRES credits a CC BY 4.0 "Low Poly F1" 3D car model, which it recolours. It also credits MIT circuit outlines and flags and OFL fonts. Ghost Car (HEAD) loads `public/f1car.glb`, and no credit or licence text was found in the Ghost Car repo. That it is the same model is `INFERENCE` from the TYRES README; the files were not compared Reconciled 2026-11-09: The deployed model files are not byte-identical. TYRES README says they share a model, but common provenance remains unverified. No Ghost Car model credit or licence was found in the inspected README and licence paths. | `Y/src/ui/strings.ts#L495-L497`; `Y/README.md#L199-L202`; `G/src/scene/carModel.js#L69` |
| R48 | FIA documents are used as a data reference by Telemetry and in THE GRID debrief label ("FIA / OpenF1") | `T/src/telemetry/singapore2026.ts#L4`; `standings/standings.js#L80` |
| R49 | Telemetry's footer says "Με επιφύλαξη παντός δικαιώματος" ("all rights reserved") above OpenF1-derived output (HEAD) | `T/src/copy.ts#L177` |
| R50 | Telemetry still treats links from `f1stories.gr` as trusted (HEAD) | `T/src/embeds/links.ts#L34-L35` |
| R51 | The privacy notice mentions Jolpica/OpenF1 only in the context of the standings page. The navigation countdown, however, calls Jolpica from every page (R28) | `privacy/privacy.html#L162`; `scripts/shared-nav.js#L755` |

### Editorial process and betting content

| ID | Claim | Reference |
|---|---|---|
| R36 | Two-editor review is optional. Author PRs (`author/blog/**`, `author/import/**`, `author/edit/**`, `author/delete/**`) auto-merge once CI passes. CI success is explicitly "not editorial approval" | `docs/editorial-review.md#L1-L14`; `.github/workflows/auto-publish-author-pr.yml#L1-L14`, `#L129` |
| R37 | There is a structured corrections record (factual correction, substantial update) plus a "Στείλε διόρθωση" link on every article. No separate complaints process exists | `docs/article-corrections.md#L3-L15`; `privacy/terms.html#L164-L173` |
| R38 | "Στοίχημα" (Betting) is a public editorial category with its own section page. The repo has no 18+ or 21+ marker, no ΕΕΕΠ reference and no responsible-gaming text | `blog-module/taxonomy.js#L10-L48`; `blog-module/blog/section/betting/index.html#L16-L17`; repo search for 18+, 21+, ΕΕΕΠ, υπεύθυνο παιχνίδι, gamingcommission |
| R39 | A betting guide names three betting operators as the author's "favourite" and uses wording about filling one's pocket or wallet. It has no `source.txt` | `blog-module/blog-entries/20260224J/article.html#L179-L192`; `docs/article-corrections.md#L15` |
| R40 | BetCast snapshots and tables publish a betting record: bookmaker, odds, stake and profit/loss | `blog-module/betcast-snapshots/20261002J.json#L29-L83`; `blog-module/build/betcast.js#L214` |
| R41 | No hrefs to betting operators, operator logos or affiliate links were found | Repo search for about 20 operator names and affiliate parameters |

## Network observations

| ID | Claim | Label | Reference |
|---|---|---|---|
| N01 | `f1-stories.gr` resolves to 185.199.108–111.153, which are the GitHub Pages ranges | `VERIFIED` (dig); range attribution `INFERENCE` | `dig +short f1-stories.gr`, 2026-11-05 |
| N02 | On 2026-11-05 DNS returned Cloudflare-looking addresses; the earlier 2026-10-24 NXDOMAIN report is UNVERIFIED. On 2026-11-09 the owner reported reacquiring and controlling `f1stories.gr` through a registrar (OWNER_REPORTED). HTTP/HTTPS checks of both hostnames returned 301 to `f1-stories.gr`, preserving tested paths and queries (LIVE_VERIFIED). DNS and redirects do not establish registrant identity; current registry details are UNVERIFIED. Trademark and commercial domain-use permissions remain separate | OWNER_REPORTED / LIVE_VERIFIED / UNVERIFIED | `dig +short f1stories.gr`, 2026-11-05; `docs/r09-reliability-audit.md#L55`; owner report and redirect probes 2026-11-09; WHOIS returned .gr delegation, not registrant details |

## Primary external sources (accessed 2026-11-05)

Pages fetched through tooling are summarised before they reach the auditor, so short wording may be slightly paraphrased. Re-read the live page before quoting any of them in a contract or a legal letter.

### Formula 1 and image rights holders

| ID | Source | Publisher, date | Relevant clause (paraphrase) | Residual uncertainty |
|---|---|---|---|---|
| P01 | Guidelines, https://www.formula1.com/en/information/guidelines.4EOKE9RRqevL4niTK9kWyt | Formula One World Championship Ltd. No revision date; the page says it may be updated and lists event titles "as of November 2026" | **§1 Word marks:** F1, Formula 1, Grand Prix and others may "inform, not brand". **§1 Logos:** no use without an express written licence. **§1 Event titles:** include title sponsors. **§3 Editorial:** reporting is allowed, but must not brand a publication or section and must not create a false affiliation. **§4 Domains:** marks may not appear in domains of commercialised websites; non-commercial fan or news sites only at F1's discretion. **§4 Names and handles:** not in company, trade, product or service names or social handles; non-commercial fan and news handles are tolerated at F1's discretion. **§4 Variations:** not incorporated into logos or icons, and not used to create a brand identity. **§4 Endorsement and advertisements:** no implied affiliation, no use alongside an unauthorised third-party brand, no association in advertisements or advertorials. **§4 Internet:** a recommended footer disclaimer text for unofficial sites. **§2/§4 Timing data:** protected by copyright and database rights; incidental editorial use only, and no substantial or commercial reproduction. **§4 Still images:** need the owner's consent. **§5:** licensing requests go to F1 brand protection | This is the rights holder's stated policy, not a court ruling. Whether it binds F1 Stories is `REQUIRES_LEGAL_REVIEW` |
| P02 | Legal Notices, https://www.formula1.com/en/information/legal-notices.7egvZU48hzrypubGBNcQKt | Formula One Digital Media Ltd; no date | Site content is for personal, non-commercial use. F1 marks belong to Formula One Licensing B.V., and F1 logos may not be used | Covers formula1.com content, including `media.formula1.com` assets (R24) |
| P08 | Legal information, https://corporate.pirelli.com/corporate/en-ww/legal-information | Pirelli; clause marked ©1995–2018 | Site content may not be reproduced without written permission. Trademarks need consent. There is no press-specific clause, and press.pirelli.com shows no media terms | Whether this applies to facts taken from press graphics is `REQUIRES_LEGAL_REVIEW` |
| P09 | Media portal terms, https://media.haasf1team.com/ | Haas F1 Team; no date | Use is limited to news reporting. Any other use, commercial or not, needs prior written consent | One team's terms only; other teams were not checked |
| P10 | Commons: Reusing content outside Wikimedia, https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia | Wikimedia Commons | Licence and attribution duties apply. Trademark, personality and privacy restrictions apply separately | Read as a summarised fetch. No Commons files were identified in the repo |

### Race data and service providers

| ID | Source | Publisher, date | Relevant clause (paraphrase) | Residual uncertainty |
|---|---|---|---|---|
| P03 | OpenF1 site and docs, https://openf1.org/ and https://openf1.org/docs/ | OpenF1; no date | Footer: CC BY-NC-SA 4.0. FAQ: intended for education, personal projects, research and "non-commercial fan engagement", and other uses should contact OpenF1. FAQ: "credits are not required". OpenF1 does not claim ownership of F1 data and is not affiliated with Formula One Management. A paid tier is needed for live data | The FAQ's "credits not required" conflicts with licence §3(a). The paid tier is not described as a commercial licence (`INFERENCE`) |
| P04 | OpenF1 LICENSE, https://github.com/br-g/openf1/blob/cb0200ca49172c8b61dc7c35c11e346d6dbb3884/LICENSE | OpenF1 | The repo licence is the CC BY-NC-SA 4.0 legal code, covering the code as well; there is no separate open-source software licence | — |
| P05 | Jolpica TERMS.md, https://github.com/jolpica/jolpica-f1/blob/0fdc5a2584d6aae670d7b7b0188542493de2e437/TERMS.md | Jolpica; updated 2025-08-27 | Free for non-commercial use. Data is CC BY-NC-SA 4.0. Commercial use requires contacting Jolpica. Terms may change. Code is Apache-2.0 (GitHub metadata). Rate limits are set in a separate guide, https://github.com/jolpica/jolpica-f1/blob/0fdc5a2584d6aae670d7b7b0188542493de2e437/docs/rate_limits.md: 4 req/s burst and 500 req/h, unauthenticated | Silent on who owns the underlying data |
| P06 | CC BY-NC-SA 4.0 legal code, https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.en | Creative Commons, v4.0 | **§1(k):** NonCommercial means "not primarily intended for or directed towards commercial advantage or monetary compensation". **§2(a)(1):** rights granted for NonCommercial purposes only. **§2(b)(2):** no trademark licence. **§3(a):** attribution required when sharing. **§3(b):** ShareAlike applies to adapted material. **§4:** sui generis database rights. **§6(a):** rights terminate automatically on breach. Under §6(b)(1) they are reinstated if the breach is cured within 30 days of discovery; under §6(b)(2) the licensor can also reinstate them expressly | Application to these uses requires professional assessment; no exhaustive case-law search was performed and no breach or termination was established (2026-11-09 reconciliation) |
| P07 | Terms, https://open-meteo.com/en/terms and licence, https://open-meteo.com/en/licence | Open-Meteo; no date | 2026-11-05 baseline: “You may only use the free API services for non-commercial purposes.” Commercial examples include “Websites or apps that have subscriptions or display advertisements.” Data is CC BY 4.0 with attribution and a nearby link | The original elsewhere-only uncertainty is superseded by the 2026-11-09 R09/R34 in-app finding. Actual service use, commercial scope and possible exposure require assessment; data licence and service conditions are separate. No breach or affirmative clearance was established |
| P22 | corsproxy.io, https://corsproxy.io/ | corsproxy.io | The free tier may be used from production origins within monthly limits | Commercial use is not addressed |

### EU law and guidance

| ID | Source | Publisher, date | Relevant clause (paraphrase) | Residual uncertainty |
|---|---|---|---|---|
| P11 | Qualify outbound links, https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links | Google | `rel="sponsored"` is for advertisements and paid placements | Search-engine guidance only. It creates no consumer disclosure |
| P12 | UCPD 2005/29/EC, https://eur-lex.europa.eu/eli/dir/2005/29/oj (consolidated text CELEX 02005L0029-20220528) | EU | **Annex I point 11:** an advertorial is banned when the trader paid and this is not clear to the consumer. **Art. 7(2):** hiding commercial intent is a misleading omission. **Art. 2(b):** "trader" includes anyone acting on a trader's behalf | Greek transposition text not retrieved (U01) |
| P13 | Commission UCPD Guidance 2021/C 526/01, https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52021XC1229(05) | European Commission, OJ C 526, 29.12.2021 | **§2.9.2:** a discreet "in collaboration with" label was found insufficient in national cases. **§2.3:** point 11 itself is aimed at the paying trader (RLvS, C-391/12) | Not binding |
| P14 | CJEU C-371/20 Peek & Cloppenburg, https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62020CJ0371 | CJEU, 2 Sep 2021 | "Paid" includes any consideration with asset value, not only money | — |
| P15 | E-Commerce Directive 2000/31/EC, https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32000L0031 | EU | **Art. 6:** commercial communications must be identifiable, and so must the person on whose behalf they are made. **Art. 5(1):** the provider's identity must be accessible. **Art. 2(f):** independent communications compiled without consideration are not commercial communications | Greek PD 131/2003 not retrieved (U02). Applicability of "normally provided for remuneration" is `REQUIRES_LEGAL_REVIEW` |
| P16 | DSA Regulation 2022/2065, https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2065 | EU | The Art. 26 advertising labels apply to online platforms, with micro and small enterprises exempt under Art. 19 | `INFERENCE`: a publisher's own static site is not an online platform |
| P17 | EMFA Regulation 2024/1083, https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1083 | EU; applies from 8 Aug 2025 | **Art. 6:** news media service providers must disclose ownership and state advertising, and must safeguard editorial independence and disclose conflicts | Whether F1 Stories is a "media service provider" (which requires a professional activity) is `REQUIRES_LEGAL_REVIEW` |

### Greek self-regulation, gambling and tax

| ID | Source | Publisher, date | Relevant clause (paraphrase) | Residual uncertainty |
|---|---|---|---|---|
| P18 | Ελληνικός Κώδικας Διαφήμισης-Επικοινωνίας 2023 (ΕΚΔ-Ε), https://www.see.gr/wp-content/uploads/2024/12/EKDE_2023.pdf | ΣΕΕ (self-regulatory body); in force 15.06.2023 | **Art. 7(1):** advertising, including native advertising, in an editorial medium must be immediately recognisable. **Art. 7(2):** it must not pose as an independent review or blog. **Chapter Β, Art. Β12:** sponsorship must be recognisable as «χορηγία» and must not compromise editorial independence. **Art. Γ7:** age-restricted products, including gambling | Self-regulation: it binds participants (Art. 23) and is not state law |
| P19 | ΥΑ 79292 ΕΞ 2020, Gaming Regulation on Commercial Communication, ΦΕΚ Β' 3260/05.08.2020. English translation read: https://hgc.gov.gr/wp-content/uploads/2014/06/FEK_B_3260_2020_Commercial_Communication_EN.pdf. Greek original downloaded but not compared: https://hgc.gov.gr/wp-content/uploads/79292-%CE%95%CE%9E-2020-B-3260-05.08.2020.pdf | Ministry of Finance / ΕΕΕΠ | **Art. 1:** commercial communication includes sponsorship. **Art. 9.1, 9.7:** a communication needs an ΕΕΕΠ-approved plan, and advertising providers and affiliates must obtain the approval first. **Art. 4(j):** not on media mainly addressing minors. **Art. 8.3:** no "means of enrichment" claims. **Art. 8.9–8.11:** age limit, ΕΕΕΠ reference and helpline. **Art. 11:** no communication for unlicensed operators | Later amendments were not checked. Whether the rules reach a publisher's own unpaid editorial content is `REQUIRES_LEGAL_REVIEW` |
| P20 | ΕΕΕΠ Directive 3/2023 (ref. 13091/08.06.2023, online publication no. 9ΤΚ3ΙΜΛ-3Α2), marking requirements: https://hgc.gov.gr/wp-content/uploads/2014/06/DIRECTIVE_3_2023.pdf (English) | ΕΕΕΠ | Mandatory marking, e.g. "21+ \| ΕΕΕΠ \| risk of addiction \| helpline \| play responsibly", with size rules | — |
| P21 | ΑΑΔΕ page on the EU small-business VAT scheme: https://www.aade.gr/diethni-themata/enimerosi-epiheiriseon-shetika-me-neo-eidiko-kathestos-mikron-epiheiriseon-stin-ee-opos-tha-efarmostei-apo | ΑΑΔΕ; undated; scheme applies from 1.1.2025 | States the Greek threshold as €10,000 | The governing article number and any change to the threshold are `UNVERIFIED` |

EUR-Lex was read in a browser session, because automated fetches are challenged. OJ page references other than the 2021 Guidance were not re-checked.

## Not retrieved or not verified

None of the items below may be relied on as settled law or fact.

| ID | Item | Why |
|---|---|---|
| U01 | Greek Law 2251/1994, Art. 9α–9ΙΑ (UCPD transposition, as amended by Laws 3587/2007, 4933/2022 and 5317/2026), and which article holds the advertorial blacklist item | Only a secondary contents list was available; the full text is paywalled |
| U02 | Presidential Decree 131/2003 (e-commerce transposition) | Not retrieved |
| U03 | Law 5005/2022, the online press register (Μητρώο Ηλεκτρονικού Τύπου), and whether it matters for private advertising | Secondary sources only |
| U04 | ΕΕΕΠ decision 509/1/2020 (affiliate suitability licence) and 163/5/2015 (responsible gaming principles) | Existence confirmed; text not read |
| U05 | Directive 2001/29/EC Art. 5(3)(c)/(d) and Greek Law 2121/1993 (news-reporting and quotation exceptions) | EUR-Lex returned empty pages to the image worker |
| U06 | GDPR Art. 6/7, ePrivacy Directive Art. 5(3), Greek Law 4624/2019, Hellenic DPA cookie guidance | Not retrieved (EUR-Lex empty, dpa.gr 403) |
| U07 | EU Trade Mark Regulation 2017/1001 Art. 9 and 14, Directive 2015/2436 Art. 14, and any EU or Greek registrations of "F1" | Not retrieved; registries not searched |
| U08 | MultiViewer API terms | Not fetched |
| U09 | FIA media and brand terms | Not located |
| U10 | Identity of Formula 1's official betting partners | Secondary press report only |
| U11 | Whether the operators named in R39 and R40 hold an ΕΕΕΠ licence | Register not checked |
| U12 | The "Rights free for media use" footer on Pirelli graphics | Reported by the TYRES repo only |
| U13 | Registrant details for `f1-stories.gr` and `f1stories.gr` | Independently UNVERIFIED; the old-domain owner report and live redirect are separate [N02]. WHOIS on 2026-11-09 returned .gr delegation, not old-domain registrant details |
