# Optional editorial research notebook — P2.2b

Baseline: `d2bfbc01d257cb680247a2dae89e196018497e30` (latest main, fetched again before PR preparation).

Step 2 offers **Βρες σχετικά άρθρα** and **Έρευνα — προαιρετικά**. Both open the same notebook, and focus returns to the button that opened it. The notebook sits beside the writing area at wide desktop widths and above it on smaller screens. It uses the existing author controls and editorial tokens. Closing hides it without clearing notes. The five-step editor saves research only with an explicit local draft save.

## Author workflow

1. Enter a question or discovery keywords. **Εύρεση αναφορών** (or Enter) searches the public compact v2 index through the existing article decoder and taxonomy. The index loads on the first search and is reused while the page stays open.
2. Review the candidates, eight at a time (up to 24, via **Περισσότερα αποτελέσματα**). Only published stories are candidates: a real date not after today (Athens) on the permanent `/blog-module/blog-entries/<encoded id>/article.html` route. Retired IDs have no index row (`retired-articles.json`).
   - **Ranking:**
     - stories matching more of the query words come first;
     - each word then scores in the most telling field it appears in: headline 6, specific tag 3, excerpt 2, author 1;
     - a word of four or more letters with no digits can also match by its beginning, for half the points (Ουγγαρία / Ουγγαρίας);
     - the whole phrase in the headline (+10) or the excerpt (+4) adds a bonus;
     - an exact headline or ID comes first;
     - ties go newer first, then by ID.
   - **Never counted:** article bodies, categories, labels nearly every story shares (F1, Racing, News, GP, a season) and Greek/English articles and prepositions. Accents, case and final sigma are ignored. There are no cross-script equivalents or synonyms: "Hungary" does not find "Ουγγαρία".
   - **Each result shows:** title, category, date, author, excerpt, the words that matched and where, the article link and its canonical path.
   - A result is a candidate to read, not a confirmed relationship. Internal publications are not independent verification or primary sources.
3. To link a candidate, use **Αντιγραφή URL** (the canonical path) or **Αντιγραφή συνδέσμου Markdown**.
   - The Markdown link uses the phrase typed in **Φράση συνδέσμου**, or else the text selected in the article body. It never uses the old headline.
   - With neither, nothing is copied and the field is focused.
   - The notebook only reads the body's selection. The author pastes the link, and the draft never changes on its own.
   - A confirmation appears beside the button and in the status line.
   - The 2–3 contextual links advice remains advice. Nothing requires a link.
4. Optionally choose a season and an available round. The catalogue inventories actual files in `standings/rounds/`, not the presumed race calendar. It currently offers 2026 rounds 1–17. Only the selected file is loaded. There is no latest-round fallback, external API request or merged cross-round result.
5. Add structured notes. Each has text, section, type, source title/URL/date, event/session, verification status and limitations. Calculated statistics additionally require units, sample period, source, formula and operands. Confirmed facts require an explicit author verification decision and source/evidence fields. Unverified types/sections cannot be marked confirmed.
6. Copy an individual note, article reference or standings record; manually paste material where useful. **Αντιγραφή brief** copies the recorded notebook sections. Search results and displayed standings are not automatically added to the brief or article.
7. **Λήψη σημειώσεων** downloads readable UTF-8 `brief.txt`. Clipboard denial exposes a focused, selected, read-only textarea. Explicit clear asks for confirmation when notes or typed research text exist.

The brief has the editorial question followed by confirmed facts, sporting statistics, primary sources, technical interpretations, competing explanations, unverified claims and internal references. Empty sections contain “Δεν έχουν καταγραφεί στοιχεία.” No filler is generated.

BetCast, GridCast and AnalystCast remain article series. Their actual categories are preserved. Manual records distinguish odds, predictions, official outcomes and market settlement. Verified historical odds require market details, a source and an ISO timestamp with time zone; undated/unsupported observations carry an explicit limitation. No media workflows are added.

## Public examples and provenance

[public-examples.json](public-examples.json) records reproducible public-index search examples and a pinned record, without independently certifying their claims:

- `BetCast` finds `20261010J`, **Betcast #276 - Singapore GP**, Betting, 2026-10-10, Giannis Poulikidis.
- `GridCast` finds `20261022J`, **GridCast #02 | COTA: Μπορούμε να έχουμε Πρωταθλητή;**, Analysis, 2026-10-22.
- `AnalystCast` currently returns no published index matches. No placeholder article is invented.
- Selected snapshot: `standings/rounds/2026-17.json`, Singapore Grand Prix, generated `2026-10-12T11:47:19.828Z`. Its first driver entry reports Andrea Kimi Antonelli, position `1`, points `340`. These are copied recorded values, not newly calculated or independently verified conclusions.

Both driver and constructor tables must match the selected season and round at the table and list levels. The module rejects wrong scope, malformed rows, missing timestamps and missing/inconsistent Jolpica provenance. Every copied record retains season, round, race, subject, position, points, upstream URL and generation time. Records older than 24 hours carry a possible-amendment warning; this is a review cue, not proof that a historical record is wrong. All records remain labelled unofficial and subject to FIA decisions/amended classifications.

THE GRID, Telemetry, Ghost Car and TYRES links come from the existing approved tool manifest. Their limitations are visible: derived definitions/session context, incomplete engineering telemetry, interpolated comparisons without aerodynamic causation, and assessments/forecasts rather than measured outcomes. Opening a link is an explicit author action. The notebook does not fetch these applications.

## Isolation and security evidence

The notebook owns its panel and research state. Generate captures its validated snapshot alongside article drafts; the notebook itself does not access IndexedDB, credentials or publishing controls. The article body selection is read only to suggest link text.

`research-browser.test.mjs` saves a real local test draft, loads a dummy page-scoped GitHub token and then searches, reads a round, adds a note, copies, closes/reopens and reloads the notebook. Before/after comparisons prove:

- Exact equality of editor field values, author/category selections and image-input filenames.
- Exact equality of saved draft records, stable IDs and timestamps.
- Research edits mark the draft dirty; preview input excludes research.
- Unchanged local/session storage during research.
- Zero external requests, including zero `api.github.com` requests.
- Unsaved notebook edits disappear on reload; explicitly saved research returns when its draft is reopened.

Other focused tests cover unsafe URL schemes/credentials, hostile HTML in manual notes and index records, unsafe article IDs, malformed/wrong-round data, missing/offline resources, clipboard denial, UTF-8 downloads, clear cancellation/confirmation, cache reuse, and late search/round responses. External data is rendered through text nodes. Requests use approved same-origin paths, omit credentials, reject redirects and have timeouts; there is no arbitrary URL fetcher, AI service or analytics event.

## Validation

- `npm run test:author`: 41 passed, including 21 notebook logic/browser tests and existing local drafts, publishing mocks and mobile table regression checks.
- `npm run test:blog`: 336 passed; golden snapshots match.
- `npm run test:security`: 27 passed.
- `npm run build:public`: passed; generated-data and public-artifact validation passed.
- `npm run build:check`: checked on the committed candidate before PR publication.
- `npm run quality:static`: passed, including syntax, secrets, CSP sources, rendering sinks and token consistency.
- `npm run perf:budget`: passed without budget increases.
- Browser QA: 1440px and 390px, light/dark, keyboard focus/escape, source display and no horizontal overflow. Foreground and secondary notebook text must reach 4.5:1 contrast after existing theme transitions settle.

The mechanical design detector reported existing shared-page rules (legacy transitions, panels, preview styling), not new notebook rules. These unrelated styles were left unchanged. A notebook-scoped text color prevents inherited Bootstrap text from losing contrast.

Screenshots are compressed WebP captures of the tested viewports. A dummy token is used in isolated browser profiles; no credential value is shown. Public dataset records shown are not independent editorial verification. To reproduce PNG captures: `F1S_RESEARCH_QA_DIR=/tmp/f1-research-qa npm run test:author`.

| Viewport | Light | Dark | Light standings | Dark standings |
| --- | --- | --- | --- | --- |
| 1440 × 1000 | [Notebook](screenshots/1440-light.webp) | [Notebook](screenshots/1440-dark.webp) | [Record](screenshots/1440-light-standings.webp) | [Record](screenshots/1440-dark-standings.webp) |
| 390 × 1000 | [Notebook](screenshots/390-light.webp) | [Notebook](screenshots/390-dark.webp) | [Record](screenshots/390-light-standings.webp) | [Record](screenshots/390-dark-standings.webp) |

## Transfer sizes and published artifact

[transfer-sizes.json](transfer-sizes.json) records raw bytes and per-file gzip estimates. Actual HTTP compression and caching depend on the host.

| Resource | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| Initial page scripts, baseline | 110,331 | 36,559 |
| Initial page scripts, candidate | 137,732 | 46,571 |
| New notebook script, included above | 24,222 | 8,543 |
| Existing article-index decoder, newly loaded by editor | 3,179 | 1,469 |
| Author stylesheet, baseline | 18,689 | 4,226 |
| Author stylesheet, candidate | 21,220 | 4,707 |
| Catalogue, first open | 665 | 359 |
| Public article index, first search | 147,179 | 43,590 |
| Example round-17 snapshot, selection only | 12,944 | 2,155 |

No research datasets load at page startup. Successful reads are reused during the session; failed or invalid reads can be retried. Initial script totals exclude the existing on-demand article preview bundle. No dependencies were added. The notebook minifier emits UTF-8; other outputs retain their existing settings.

[artifact-comparison.json](artifact-comparison.json) compares SHA-256 hashes from clean baseline and candidate public builds:

- Baseline: 4,104 public files. Candidate: 4,106.
- 4,102 existing files are byte-identical, including all 410 published articles, homepage, RSS, sitemap, article/search indexes, entity pages and public article JavaScript/CSS.
- Changed: `generate.html`, `styles/author/generate.css`.
- Added: `scripts/author/research-assistant.min.js`, `scripts/author/research-catalog.json`.
- Removed: none. GitHub workflows are unchanged.
- Documentation, tests and screenshots are excluded from the public artifact.

## Exact source and evidence files

```text
generate.html
scripts/author/research-assistant.js
scripts/author/research-catalog.json
scripts/author/__tests__/research-assistant.test.mjs
scripts/author/__tests__/research-browser.test.mjs
scripts/build/asset-sources.mjs
scripts/build/author-research.mjs
scripts/build/generated-drift-guard.mjs
scripts/build/minify.mjs
scripts/build/public-artifact.mjs
styles/author/generate.css
docs/editorial-research-notebook/README.md
docs/editorial-research-notebook/artifact-comparison.json
docs/editorial-research-notebook/public-examples.json
docs/editorial-research-notebook/transfer-sizes.json
docs/editorial-research-notebook/screenshots/1440-dark.webp
docs/editorial-research-notebook/screenshots/1440-dark-standings.webp
docs/editorial-research-notebook/screenshots/1440-light.webp
docs/editorial-research-notebook/screenshots/1440-light-standings.webp
docs/editorial-research-notebook/screenshots/390-dark.webp
docs/editorial-research-notebook/screenshots/390-dark-standings.webp
docs/editorial-research-notebook/screenshots/390-light.webp
docs/editorial-research-notebook/screenshots/390-light-standings.webp
docs/editorial-research-notebook/screenshots/archive-1440-dark.webp
docs/editorial-research-notebook/screenshots/archive-1440-light.webp
docs/editorial-research-notebook/screenshots/archive-390-dark.webp
docs/editorial-research-notebook/screenshots/archive-390-light.webp
```

Minified JavaScript remains generated/ignored under the existing repository policy; CI rebuilds it. The original notebook PR changed no article, draft-system, preview-renderer or publishing implementation; E-01 (below) later connected the notebook to local drafts.

## Limits

Unsaved notes live only in this page's memory: refresh, closing the tab or navigating away loses anything not saved with **Αποθήκευση ως πρόχειρο** or exported. There is no sync between browsers or devices.

Metadata matching cannot answer arbitrary research questions or assess the truth of an article. Historical snapshot coverage is limited to files actually present. No latest-snapshot substitution, live data, FIA-document retrieval, source crawling, external tool ingestion, paid odds feed, AI API or backend is included. Manual verification remains the author's responsibility. No article was published and no live GitHub publication flow was exercised; publishing tests use mocks. The implementation PR must be reviewed and merged separately.

## E-01: local research workspaces

Research is held in memory until **Αποθήκευση ως πρόχειρο** saves it with the article. There is no autosave. Reopening that draft restores the notebook; reload alone does not save it. Drafts are specific to the browser and origin (protocol, host and port), and do not sync between devices. JSON import/export is an explicit notebook action; it does not publish or package research with an article. Clear, new draft and ZIP replacement change memory until the next save. Retain browser data and a private backup if a draft is unreadable; export readable notebooks before attempting recovery. Browser storage is not encrypted or protected from same-origin scripts.
