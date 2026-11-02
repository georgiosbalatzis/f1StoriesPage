# CI/CD map

How checks reach a release, why each one exists, and what was deliberately not changed. Baseline numbers:
[baseline-2026-11-02.md](baseline-2026-11-02.md). Reproduce any timing with `scripts/ci/`.

## Flow

```
PR ──► Site Quality ─┬─ modules   build:public → contracts, research, standings, countdown, visual focus,
                     │            security, intelligence + dashboard, deployment, tablet CLS unit, consent/RUM*
                     ├─ built     build:public → author, publishing regressions, Race Desk navigation*
                     ├─ artifact  build:public → static, budgets, media, release media*, runtime audit*,
                     │            blog URL contracts, countdown QA, GP hubs*
                     ├─ browser   build:public* → Edition*, tablet CLS*
                     └─ gates     "Quality gates": success only if all four jobs succeeded
   └─(deployment/setup/build-pages/workflow paths)─► Ecosystem dry run (assembled rehearsal, reports only)

Quality gates success on author/* ──► Publish Article ─► guard + merge ─► Site Maintenance task=blog
Quality gates success on dependabot/** ──► Merge Dependency Updates ─► merge ─► Deploy Pages
push main ──► Site Maintenance ─► route ─► [publish blog: process, stamp, commit, build-pages] ─► Deploy Pages
schedules ──► Deploy Pages (TYRES) │ Site Maintenance (standings) │ Intelligence Snapshot ─► Deploy Pages
             Intelligence Health │ Security Headers

build-pages: restore/save image cache → aggregate build (5 apps, Node 22 + 24, Chromium) → static, media,
release media/domain, runtime audit → smoke (test:integration) → Race Desk navigation → GP hubs → upload
Deploy Pages: [gate] → build (or caller's ready artifact) → deploy (only job with pages: write / id-token)
```

`*` = full route only; PRs that change nothing outside `blog-module/blog-entries/**` skip it
(`scripts/build/classify-quality.mjs`, fail-closed: dispatch, missing history, empty or mixed diffs run everything).

## Classification

| Class | Checks | Protects |
| --- | --- | --- |
| **A** mandatory PR | classify, `build:public`, static guard, size budgets, media QA, blog URL contracts, countdown QA, Race Desk contracts, standings, security policy, deployment negative cases, publishing/workflow regressions, author tool, research prototype (mocked), intelligence + dashboard (synthetic keys), countdown/visual-focus/tablet-CLS units | Article build and URL contracts, CSP/security policy, workflow privileges, encrypted dashboard privacy, deploy refusal paths |
| **B** conditional PR | full route: release media/domain, runtime audit, Race Desk navigation, GP hubs, Edition, consent/RUM, tablet CLS browser. Ecosystem dry run on deployment/setup/build-pages/workflow paths | Code changes to public runtime, consent, navigation; assembled five-app integrity before merge |
| **C** release | `build-pages` (aggregate build, static/media/domain/audit gates, smoke, Race Desk navigation, GP hubs, upload), Deploy Pages deploy, Site Maintenance routing/commit, author PR guard + merge, Dependabot merge | The exact artifact that ships: source pins, canonical/sitemap/domain files, assembled navigation, CSP refusals, 404s |
| **D** scheduled | Deploy Pages TYRES refresh (6 h Thu–Mon, daily Tue–Wed), standings (Fri 23:59, Sat/Mon 07:01 Athens), Intelligence Snapshot (03:00) and Health (11:00/17:00), Security Headers (Mon) | Data freshness, live header drift, analytics pipeline health |
| **E** manual / diagnostic | Ecosystem dry run dispatch, Deploy Pages dispatch, Security Headers `--strict`, `npm run verify` extras (`qa:visual`, `perf:lighthouse`, `perf:images`, `perf:article-media`, `qa:author-images`), `qa:embeds`, `qa:audio-player`, `qa:embed-dialog`, `dashboard-browser.mjs --screenshots`, perf profilers (`global-runtime-profile`, `global-cues-profile`, `standings-performance`, `standings-dirty-air-performance`, `rum-performance`, `shared-nav-cues-qa`, `grid-round-pin-qa`) | Investigation; not merge gates |
| **F** removed | PR-title-gated I-06D screenshot capture/upload (its extra dashboard session now always runs). Already gone before this program: "Rehearsal - publish without mtime restore (temporary)", "Scheduled Publish" | — |
| **F** removed 2026-11-02 | YouTube channel snapshot (`fetch-youtube.mjs`, `assets/youtube-latest.json`, `images/youtube/`, Saturday refresh): no page read it; owner retired it. Channel links and article video embeds remain | — |

## Intentional duplication

- Site Quality builds `dist/` in each suite job (up to four parallel builds). It's the price of latency: every suite sees the
  built tree it saw in the old single job (Sol review: identical test counts did not prove identical inputs).
- Race Desk browsers run on the standalone `dist/` (PR), the assembled rehearsal (dry run) and the assembled main
  artifact (release). Different inputs and stages, so not redundant.
- `test:deployment` runs in Site Quality and the dry run (1 s); the dry run can also be dispatched alone.
- The aggregate installs main twice (`setup` and the snapshot's `npm ci`, ~8 s each). The snapshot install is part of the
  hermetic release build.

## Considered and rejected

| Idea | Why not |
| --- | --- |
| npm download cache | `setup` incl. `npm ci` takes 14 s; the owner removed npm caching in #215 (817 MB of per-PR caches) |
| Node 24 only for aggregate callers | ~4 s per job; any missed caller fails the release toolchain |
| Skip scheduled deploys when main + TYRES SHAs match the live manifest | `weekend:update` fetches live schedules/forecasts and stamps `retrievedAt`; date-dependent main output (Sol: unsafe) |
| Release browser suites as parallel jobs | Modelled ~1.6 min gain over the image cache alone, for new smoke sections, exact-SHA checkouts and artifact hand-offs across three privileged workflows |
| Path-based skipping of suites | Most suites read all of `dist/` or cross modules; only ~30 s of narrow suites qualify |
| Running browser suites concurrently in one job | Fixed-window "nothing changed" assertions can pass falsely under CPU contention |

## Results (2026-11-02, real GitHub runs)

| Category | Before | After | Runs |
| --- | --- | --- | --- |
| Site Quality, full route | median 10.8 min (n=13); same-day 9.4 min ([41427402391](https://github.com/georgiosbalatzis/f1StoriesPage/actions/runs/41427402391)) | **4.6 min** ([41429759908](https://github.com/georgiosbalatzis/f1StoriesPage/actions/runs/41429759908)), 4.9 min ([41430539870](https://github.com/georgiosbalatzis/f1StoriesPage/actions/runs/41430539870)) | n=2 after: small sample |
| Site Quality, article-only | median 5.5 min (n=9 author PRs) | **3.6 min** ([41432822595](https://github.com/georgiosbalatzis/f1StoriesPage/actions/runs/41432822595), sandbox #413) | n=1 after |
| Site Quality job-minutes, full route | ~9.3 (one job) | ~15.0 (4 jobs: 2.9 + 4.4 + 4.2 + 3.4) | compute rises; not billed (public repo) |
| Aggregate main `build:public` (deploy) | 134 s cold ([41420752093](https://github.com/georgiosbalatzis/f1StoriesPage/actions/runs/41420752093)) | 58 s ([41432730312](https://github.com/georgiosbalatzis/f1StoriesPage/actions/runs/41432730312)), 57 s dry run | stale-cache prefix hit; fresh cache now saved |
| Deploy build job | 17.4 min (checkpoint, same gates) | 16.5 min | browser gates dominate (smoke 461–469 s) |
| Ecosystem dry run "Build the pinned aggregate" | median 4.68 min (n=20) | 3.4 min ([41429832795](https://github.com/georgiosbalatzis/f1StoriesPage/actions/runs/41429832795)) | n=1 after |
| Scheduled TYRES deploys | 28/week | 22/week | owner cadence |

The Deploy Pages and Site Maintenance medians in the baseline predate #402, which added Race Desk navigation and GP hub gates
(~3.7 min) to `build-pages`. Compare deploys only with runs that include them.

## Branch rules

Ruleset "Force Protection": deletion and non-fast-forward blocked; no required status checks. Owner approved requiring
**Quality gates** with the GitHub Actions integration as a bypass actor, but GitHub refuses that bypass on a
personal-account repository (HTTP 422, "Actor GitHub Actions integration must be part of the ruleset source or owner
organization"). Without it the rule would reject `commit-and-push` (blog artifacts, standings data,
intelligence snapshot), so the ruleset is unchanged. Open owner decision.
