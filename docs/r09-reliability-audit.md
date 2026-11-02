# R-09 reliability certification and Race Desk release runbook

Certification baseline: main `4301e13e` (R-07B), audited 2026-11-02. Fixes: #426 (R-09A), #427 (R-09B). This replaces the earlier gap inventory written at `2fe5679c`.

Evidence labels: **LOCAL** (coordinator machine), **CI** (Site Quality / Ecosystem dry run on the PR head), **PROD** (https://f1-stories.gr). A dry run is a read-only rehearsal, not a deployment; a successful Pages job alone does not certify every route.

## Verdict

**Conditionally certified.** No P0/P1 defect was reproduced. The P2 defects found were fixed. The conditions are the documented limitations below; none is concealed by a passing gate.

## Findings and disposition

| ID | Sev | Finding | Evidence | Disposition |
| --- | --- | --- | --- | --- |
| ARCH-01 | P2 | `deployment-manifest.json` `outputDigest` and byte totals hashed the pre-copy inventory, not the final files (sitemap is extended after copying). | In-memory synthetic assembly: sitemap 61 B reported vs 173 B published; new test fails before the fix (digest `7bcc01f5…` ≠ recomputed `6999c681…`). | Fixed #426; test recomputes digest, per-application files/bytes and total from the assembled files. Pages and source SHA were never affected. |
| D-02 | P2 | Synthetic 22×62 pace test only printed sizes. | Test body had no assertion. | Fixed #427: asserts 22 disclosures × 62 = 1,364 lap rows. |
| A-01 | P2 | Jolpica is `unresolved` in `data/race-desk/publication-rights.v1.json`, but four hubs publish R-04 results and THE GRID uses Jolpica; no gate consumes the record for R-04. | `readResultsContexts` returns `available` classifications while the record says `unresolved`. | **Owner decision 2026-11-02: documented limitation.** R-04 publishes under a legacy exception that predates the record. There is no universal fail-closed rights gate; only OpenF1 (R-06/R-07) is gated. |
| ARCH-02 | P2 | "Latest main always deploys" has an exception: re-running only the *Deploy Pages artifact* job of an older run republishes that run's artifact. | `deploy-pages.yml` deploys the run's existing artifact. `upload-pages-artifact` default retention is 1 day. | **Owner decision: document, no production rehearsal.** See rollback. Unverified end to end. |
| TB-01 | P3 | The Singapore hub labelled the OpenF1 identity document "Στιγμιότυπο THE GRID". | `hub-render.mjs` labelled every main-repository source that way. | Fixed #427 (label by path; one anchor text regenerated). |
| D-01 | P3 | No GP-page size guard; SIN26 grew 50,990 → 292,908 B raw (11,898 → 31,285 B gzip) from R-04 to R-07. | Size guard covers no `race-desk/gp/` path. | Not added: no measured regression (PROD below). Revisit if a hub is added or SIN26 grows again. |
| G-01 | P3 | A pinned THE GRID embed whose round fails to load still shows the build-time "Δεδομένα έως Γύρο 18" footer beside the error. | PROD: `/standings/?…&round=30` with providers blocked. The error is shown; round 30 is never claimed. | Open, nonblocking. |
| C-02 | P3 | Reopening cookie settings from the footer leaves focus on the footer button; the non-modal banner precedes the footer in DOM order. | PROD probe. | Open, nonblocking. |
| D-03 | P2 gap | No deterministic 429/503/timeout/malformed/empty injection for Telemetry, Ghost Car and BetCast. Standings has a 503 fallback test only. | `smoke.mjs` serves recorded 200 responses. | Open coverage gap; child tools are separate repositories pinned in `scripts/deployment/sources.json`. |

Checked and sound (no defect reproduced): workflow trust boundaries (no `pull_request_target`; `workflow_run` consumers do not execute PR code; PR jobs `contents: read`; image cache restore-only on PRs); source-SHA recording and fresh `ref: main` builds; child-pin fetch fails without substitution; TYRES data ref recorded with sha, digest and refresh time; public-artifact and aggregate leak rules; redirect stubs use a fixed origin; R-04/R-06/R-07 receipts reject digest, identity, session-kind and other-hub reassignment; Sprint kept separate and disclosed in championship deltas; SIN26 R-07 independently spot-checked (#5 s1, #81 s2, #43 s1 count/min/median match raw receipts); zero eligible laps is the reviewed policy.

## Production evidence (PROD, before the R-09 merges)

- Live manifest: mode `release`, main `4301e13e`, `dirty: false`; child SHAs equal `sources.json`; TYRES data `main` @ `50e5f50b`.
- All 506 sitemap URLs: 200 (one transient 503 that returned 200 on recheck); 0 canonical mismatches; 0 foreign origins. Unknown GP/app routes return 404. `data/race-desk/*`, captures, `docs/`, `perf/`, `scratchpad/`, `.github/`, `package.json` and `.env` return 404.
- Headers: CSP/Referrer-Policy via `<meta>`. HSTS, X-Content-Type-Options and Permissions-Policy cannot be served by GitHub Pages (host limit). HTTP → HTTPS 301.
- SIN26 at 390/576/768/992/1280/1440 px (desktop Chrome, **unthrottled**): 10,564 elements; DOMContentLoaded 146–163 ms; opening all 22 pace disclosures 33–37 ms with 0 long tasks; 1,287 table rows; no horizontal page overflow; JS heap 1.5 MB.
- Keyboard: pace summary reachable by Tab, visible 2 px focus, Enter opens, table region scrolls with arrow keys.
- THE GRID pinned round 17 from the hub persists on reload; the live link drops the pin. An invalid season is not treated as a pin.
- Consent from a clean profile: no Google Analytics request before a choice. Reject persists across reload. Customize → enable → save persists and loads GA. Settings → reject persists. JS off: banner hidden, noscript notice shown, content and 22 disclosures present. 404 with JS off: 404 status, recovery links 200.

## Limitations (not certified)

- Jolpica publication rights: unresolved (A-01).
- Rollback by retained artifact: unrehearsed, 24 h window (ARCH-02).
- Provider failure UX of child tools: not injected (D-03).
- Performance: no throttled-mobile or low-end-device measurement; Lighthouse was not part of this audit.
- Accessibility: automated probes plus keyboard/consent flows; no screen-reader or full WCAG audit.
- Byte-identical rebuilds: not possible from source SHAs alone, because TYRES data follows a moving ref and is refreshed at build time.
- Old domain `f1stories.gr`: not owned or verified; no redirect is claimed.
- Monitoring: no uptime or content monitor exists for the site or Race Desk. Intelligence Health watches the analytics snapshot pipeline only; Security Headers runs weekly.

## Release runbook

### Every Race Desk / deployment PR
1. Site Quality "Quality gates" green on the exact head (source, built, artifact and browser jobs).
2. Ecosystem dry run green when `scripts/deployment/**`, the Pages actions or workflows change, or when generated hubs change (dispatch with `gh workflow run aggregate-dry-run.yml --ref <branch>`).
3. Locally, when hubs change: `npm run build:public` (stamped output; never commit unstamped `node scripts/build/race-desk-hubs.mjs` output), `npm run build:check`, `npm run test:race-desk`, `npm run test:race-desk:hubs`.
4. Never run `perf:budget:update`; budget changes need an explicit owner decision.

### Data refresh policy
- R-04 results, R-05 associations, R-06 timeline and R-07 pace are receipted captures. Recapture only through the capture scripts, review the receipt diff, and keep OpenF1 to the approved SIN26 race session 11388 scope in `publication-rights.v1.json`. Provider bytes change after release (SIN26 stints changed between 2026-10-15 and 2026-11-02), so the publication stays tied to the receipted bytes.
- Standings snapshots: Site Maintenance cron (Fri 23:59 and Mon/Sat 07:01 UTC; Athens DST handled by the workflow).
- TYRES data: refreshed on every Deploy Pages build from the `main` ref (cron every 6 h Thu–Mon, daily Tue–Wed). The manifest records sha, digest and refresh time.

### After every merge to main
1. `gh run list --workflow publish-blog.yml --limit 3`: the Site Maintenance push run must finish *Build Pages artifact* and *Deploy Pages artifact*.
2. `curl -s https://f1-stories.gr/deployment-manifest.json`: `applications[0].sourceSha` equals the merge commit, `dirty: false`, and child SHAs equal `sources.json`.
3. Smoke test: the six `/race-desk/gp/<id>/` pages return 200 with kickers 01–07; SIN26 has 22 pace disclosures; an unknown GP returns 404; `/standings/?tab=drivers&embed=1&season=2026&round=17` shows round 17; a clean-profile consent check shows no GA before a choice.

### Rollback
- **Normal path:** a reviewed revert PR on main, merged, then the standard deploy. This restores code, not TYRES data (moving ref).
- **Within 24 h of a bad deploy only:** re-run just the *Deploy Pages artifact* job of the last good run while its `github-pages` artifact is unexpired (`gh api repos/georgiosbalatzis/f1StoriesPage/actions/runs/<id>/artifacts`). The next push or scheduled deploy republishes current main, so revert main as well. Unrehearsed.
- Never force-push main. Do not roll back automatically for noncritical issues.

### Periodic, not per PR
Full `npm run verify`, `perf:lighthouse`, `qa:visual`, a live sitemap crawl, `npm run security:headers`, and the production browser probes above. Run them before each milestone release.
