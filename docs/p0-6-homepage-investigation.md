# P0.6 homepage investigation

Investigated on 21 October 2026. The original working checkout was `8bb09bca`, with existing unrelated user changes left intact. Remote `main` had advanced to `c0422ef7`; the countdown, author-panel selection and editorial rules are unchanged between those revisions. The independent countdown fix is based on `c0422ef7`. P0.5's sitemap PR is separate and is not included.

Phase 1 changed no repository source files. It inspected source, published HTML, calendar fixtures, metadata and rendered article bodies; ran existing tests; and exercised fixed-clock fixtures in temporary files. Phase 2 implements only the confirmed countdown defects. No editorial content, ranking rule, canonical URL or article route changes.

## Findings and decisions

| Concern | Classification | Severity | Action / approval |
| --- | --- | --- | --- |
| A: “Σύντομα” without an event | Reproduces in the server HTML / before JavaScript; persistent failure was not reproduced in a healthy browser | Low for the initial placeholder; impact depends on persistence | No speculative loading-state rewrite. Original observation cannot be attributed to an API or parsing failure without its browser/network evidence. |
| A: invalid cache, missing start time, unordered calendar | Confirmed technical defects under fixed fixtures | Medium: wrong countdown or false season-end state | One countdown-only fix; no editorial approval required. |
| A: unavailable new-season calendar | Confirmed misleading terminal state under fixed fixtures | Medium when the fallback season expires | Distinguish unavailable schedule from a completed known season; derive next-year text instead of hardcoding 2027. |
| B: repeated homepage column titles | Intentional recurring series; distinct articles | Informational; optional discoverability improvement | Preserve titles. Added editorial labels/excerpts require editorial agreement. |
| B: a separate older identical-body pair | Duplicate content and conflicting author metadata confirmed; publication intent and historical cause unknown | Medium editorial/data-quality review | Editor must decide whether these are deliberate republications and identify authoritative attribution. No deletion, redirect or title change. |
| C: WEC story prominence | Expected automatic selection under current rules | No technical defect | Preserve placement. Changing sport preference or adding a general homepage override requires editorial approval. |

## A — next GP banner

### Observed behavior and evidence

The deployed homepage was inspected in a fresh isolated Chrome context at approximately **2026-10-21 05:31 UTC**. It showed **United States GP**, source `live`, approximately `4d 14h 29m`; the Jolpica request returned HTTP 200 with 23 races. No console errors or warnings were present. Its target was **2026-10-25 20:00 UTC**, displayed as **22:00 GMT+02:00** in the browser's Athens timezone, correctly reflecting the intervening DST change.

Fetching the raw published HTML in that same browser returned `Επόμενο GP` / `Σύντομα`. These strings originate in [partials/nav.html](../partials/nav.html). They remain visible with JavaScript disabled, a blocked/missing shared-nav asset, or an exception before countdown initialization. Those are possible explanations for the original observation, not established causes. Normal API failure does **not** leave “Σύντομα”: the countdown renders the embedded fallback synchronously before fetching.

### Data, time and refresh path

- [scripts/shared-nav.js](../scripts/shared-nav.js) owns the entire browser countdown. It starts from the embedded `FALLBACK_RACES` calendar for 2026 and then fetches `https://api.jolpi.ca/ergast/f1/<browser-calendar-year>.json`.
- Explicit UTC race starts are converted to epoch milliseconds and compared with `Date.now()`. Only the accessible target label uses the visitor's timezone. There is no date-only local-midnight conversion in event selection.
- `f1s-schedule-v2` in **sessionStorage** caches parsed races for six hours. The TTL is checked on page initialization; an already-open page does not periodically refetch. A new context, reload after expiry, or invalid cache triggers another request. Storage denial is caught.
- Countdown display ticks adapt to distance and page visibility. Selecting a new event at the current race's start is intentional: this is a next-start countdown, not a race-status feed.
- No build/deployment cron refreshes this calendar. `refresh-standings-data.mjs` refreshes standings snapshots and related data, not the nav calendar. The embedded calendar and its local-time fixture require a source update for a new season or schedule revision.
- Network/HTTP failure, malformed JSON structures and empty live arrays retain the named fallback. There is no network timeout, but a pending request cannot block the synchronous fallback display.

### Fixed-clock reproduction

The committed unit fixtures exercise the actual countdown section from the source; browser checks exercise the built, minified script in `dist`. Representative results at **2026-10-21 00:00 UTC**, unless specified:

| Fixture | Before | After |
| --- | --- | --- |
| Offline / HTTP failure / empty or malformed live response | `US GP`, `4d 20h 0m`, fallback | Same correct behavior |
| Valid live US start on 25 October, 20:00Z | `United States GP`, `4d 20h 0m` | Same correct behavior |
| Fresh cache containing `[]` or `[{}]` | “Η σεζόν ολοκληρώθηκε”; no fetch | Cache rejected; fetch attempted; named fallback retained if offline |
| Fresh previous-year cache at 2027-01-01 00:30Z | Old season-end state; no 2027 fetch | Cache rejected; 2027 endpoint fetched |
| Valid race date with missing start time | Invented 12:00Z; countdown eight hours early for the US fixture | Response rejected; explicit known fallback retained |
| Unsorted future calendar: Mexico before US | Later Mexico event chosen | Earliest future US start chosen |
| One second before US start / exact start | US with `0m 1s` / next Mexico event | Same intended boundary behavior |
| 2026-12-07, offline | Known 2026 calendar has no future starts; 2027 forthcoming | Same terminal state |
| 2027-01-01 or 2028-01-01, offline | Completed-season claim and hardcoded “2027 προσεχώς” | “Πρόγραμμα μη διαθέσιμο” / “Αναμονή προγράμματος”; mobile “Αναμονή” |

Root causes: cache admission checked only age and truthiness of `races`; `[]` is truthy and race records were not validated. Parsing substituted noon for missing `time`. Next-event selection returned the first future array element. Terminal text assumed every calendar represented the current season and hardcoded the next year.

Minimal fix: validate nonempty cache/live arrays, named race records, finite numeric timestamps and current-season membership; reject invalid/future cache timestamps; require actual UTC start times and real calendar days; choose the minimum future timestamp; distinguish absent current-season data from a known exhausted calendar. Invalid rows reject the response as a whole, avoiding silently skipping an unknown upcoming start. The original fallback calendar and its event times are unchanged.

Remaining limits: a semantically incomplete but structurally valid upstream calendar is still trusted. A deliberately partial fixture containing only a past Singapore race produces a terminal state even while the embedded calendar contains later starts; the captured live response was not partial. Validating upstream completeness metadata is a follow-up, rather than treating fallback-versus-live disagreements as proof that either source is wrong. The existing known-season terminal text also triggers at the **final race start**, not its finish; a live-race state or different terminal wording is a product decision. Unknown-season availability is fixed, but no 2027 calendar is fabricated and no background refresh policy is added.

Regression coverage: [countdown-schedule.test.mjs](../scripts/build/__tests__/countdown-schedule.test.mjs) covers parser/cache boundaries, six-hour expiry, blocked storage, unordered schedules, year rollover and start/terminal states. [race-calendar.test.mjs](../scripts/build/__tests__/race-calendar.test.mjs) checks the existing 23-event fallback against venue-local fixture times. [countdown-qa.mjs](../scripts/perf/countdown-qa.mjs) checks the built browser behavior, desktop/mobile outputs and timezone equivalence. CI now runs these checks without removing or weakening existing gates.

## B — repeated card titles

### Observed behavior, reproduction and root cause

The homepage writer spotlight for Dimitris Keramidiotis lists these three distinct canonicals:

- `/blog-module/blog-entries/20260926D/article.html`
- `/blog-module/blog-entries/20260824D/article.html`
- `/blog-module/blog-entries/20260726D/article.html`

Each is titled **“Μέσα από το F1λτρο μου”**, with its own visible date. Open the Dimitris spotlight in the rotating team panel, or inspect `.team-card__stories` in the generated HTML. Chrome confirmed the complete titles in the DOM, with `line-clamp: none`; this is not truncation or title generation. Source documents contain the same titles.

[taxonomy.js](../blog-module/taxonomy.js) explicitly names that author's recurring column “Μέσα από το F1λτρο μου”. The archive has **seven** exact-title entries in this series, with different openings and seven distinct normalized body hashes. [renderHomeTeam](../blog-module/build/authors-page.js) intentionally takes each writer's three newest articles and renders date + article title. It omits the available excerpt, reading time and detail tags. There is no structured event/subtitle field to substitute reliably; some older entries have only generic `F1` / `Racing` tags. Curated profile display-title overrides exist for selected stories, but are not general team-panel subtitles.

Minimal recommendation: keep the titles and dates. If editors want clearer episode differentiation, agree on a structured display label or use an existing excerpt in the card. Do not infer event names from prose, rename series entries or silently apply inconsistent subtitles. Regression plan: same-title articles with distinct IDs/bodies remain eligible, links and dates stay distinct, long titles render in full, and any approved display-label fallback is tested separately. Editorial approval is required for a new display-label convention or changed title treatment.

### Separate content anomaly requiring human review

Across **408** source-cache records there were **zero duplicate IDs or article URLs**, and two normalized exact-title groups: the seven series entries above and this pair:

- `20260222T`: “Παλιά κοιμόμασταν με ανοιχτά παράθυρα”, author **Thanasis Batalas**.
- `20260227Τ`: same title, author **F1 Stories Team**; its last character is Greek capital tau, not Latin T.

Both have separate self-canonicals. Their article bodies, after stripping markup and normalizing whitespace, are identical: 2,601 characters, SHA-256 `9a049e39f6f6f1f918af429cbe3efac114bfb5b71c7deade926a4eb8531427c9`. Both were already present in baseline commit `725fa7c5`; neither retains a source document. The ASCII author-code map does not equate Greek tau with Latin T, which explains why current author repair cannot reconcile that ID, but does not establish how the historical duplicate arose. Neither article is in the current homepage's selected spotlight rows. Editors must establish republication intent and correct attribution before any consolidation or route change.

Diagnostic guard proposal, **not implemented**: retain existing fatal duplicate-ID/index and duplicate-sitemap-URL checks; additionally check normalized canonical URL collisions and ID/route consistency. Report repeated normalized titles as nonblocking diagnostics with IDs, authors and dates. Classify same-author known-column titles with different bodies as recurring-series information; flag identical body hashes or unexpected cross-author reuse more prominently for review. Empty/placeholder-looking titles should warn unless they already violate existing required-title validation. Never fail a build solely because a title repeats. Test legitimate series, Unicode-distinct IDs, true URL collisions, identical-body pairs and ordinary repeated links to one story.

## C — non-F1 featured story

The WEC article is **“Toyota:Νίκη τίτλου στο WEC”**, ID `20261019W`, primary category `Analysis`, detail tags `WEC`, `Toyota`, `Champions`. On the captured homepage it is the **first secondary cover-frame image**, not the main headline: the main cover is the newer Ferrari 640 article dated 20 October. The WEC story also appears normally among its author's newest three articles.

Reproduce by passing the current ordered article/index records and [editorial-selection.json](../blog-module/editorial-selection.json) to [selectHomeStories / selectPaddock](../blog-module/build/index.js): cover `20261020W`, technical spread `20261015G`, first frame `20261019W`, second frame `20261018W`, feature `20261017W`. With the article list cut off at 19 October, the same newest-first rule would make WEC the cover; this is a deterministic rule reproduction, not evidence of a particular past deployment.

All selection fields are empty (`lead`, `secondary`, `deepReads`, `homeTech`): the WEC placement is **automatic**, not a manual pick. [publish-order.js](../blog-module/build/publish-order.js) orders by publication day, then main-line publication history, previous order and ID. `selectPaddock` takes the two newest unused image-bearing stories; its first unused feature is also image-driven. The slot's visual “analysis” class does not enforce an Analysis category. Sport tags are not used as ranking weights.

Category eligibility exists for particular desks: Technical spread, Opinion voices, History archive and News/Teams/Drivers wire. That is not an F1-versus-WEC preference. The supported manual override `homeTech` selects an eligible Technical story. `lead` overrides the week's lead on the **blog index**, not the homepage cover. `secondary` and `deepReads` are not consumed by the current homepage selector. There is no general homepage cover/frame override in this implementation.

Minimal recommendation: no code or content change. If desired, editors can approve a separate specification for sport preference or a general cover/frame override. Existing technical and weekly-lead overrides should remain intact. Regression plan: preserve the current mixed-sport chronology, same-day ordering, category eligibility and story deduplication; exercise existing valid/invalid overrides; add tests for any newly approved policy before implementation. Editorial approval is required before changing prominence rules or manually demoting this article.

## Validation and delivery

- Baseline read-only checks: 68 focused selection/calendar tests and 23 browser countdown checks passed.
- Updated checks: 131 build tests (including seven new countdown tests), 258 blog tests plus golden snapshots, and 28 countdown browser assertions against `dist` passed.
- `build:public` passed data contracts and validated all 4,082 public files. `quality:static`, `perf:budget`, `qa:media`, `audit:runtime`, `test:consent`, `test:standings` (21), `test:security` (27) and `test:author` (6) passed. Workflow routing checks also passed.
- The build changes 453 tracked HTML files only to refresh the shared-nav script's content hash. Each HTML diff was checked against its base with that one substitution; editorial text, article bodies, canonicals and routes are unchanged. Minified assets remain generated according to the existing build convention.
- One independent countdown PR accompanies this report. No B/C implementation PR, title rewrite, editorial-policy change, merge or auto-merge is authorized by this investigation.

The original persistent-placeholder report cannot be causally reconstructed from source alone. This investigation sampled the deployed page successfully; it does not establish that every earlier client had the same script, clock, cache or network state. No broad visual/Lighthouse audit was performed.
