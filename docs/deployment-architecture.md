# Priority 6 deployment architecture

> **Update 2026-10-25 (SEO PR 5): four tools, TYRES added.** The primary domain is now
> `https://f1-stories.gr` (the `f1stories.gr` names below are historical). The section
> [Four-tool aggregate](#four-tool-aggregate-seo-pr-5) supersedes the ownership map,
> toolchain and old-URL notes where they differ.

Decision recorded 2026-10-05 **before implementation**. Status: local preparation;
cutover is explicitly not authorized. No deployments, commits, PRs, DNS changes,
Pages setting changes, or legacy replacements are part of this work.

## Current topology (read-only GitHub REST Pages API)

All four repositories are public, default branch `main`.

| Repository | Live publisher | Live URL | Custom domain |
| --- | --- | --- | --- |
| f1StoriesPage | Actions (`deploy-pages.yml`, reusable by maintenance) | https://f1-stories.gr/ | f1-stories.gr |
| f1-telemetry-dashboard | branch `gh-pages:/` | https://georgiosbalatzis.github.io/f1-telemetry-dashboard/ | none |
| ghostcar | branch `gh-pages:/` | https://georgiosbalatzis.github.io/ghostcar/ | none |
| BetCastVisualisation | branch `gh-pages:/` | https://georgiosbalatzis.github.io/BetCastVisualisation/ | none |

Main is a **project site with its own apex custom domain**, not the account site.
The `georgiosbalatzis.github.io` repository API returned 404; no accessible user-site
repository was found. Live configuration takes precedence over checked-in child
Actions workflows. Telemetry and Ghost Car have `deploy.yml` Actions deployments
in source despite live branch publishing. BetCast uses `gh-pages -d build` locally.
Main has a CNAME file; it is redundant for its Actions publisher. All sites enforce
HTTPS. Main's certificate is approved for the apex, expires 2027-01-02.
A records currently resolve to GitHub's four Pages IPs. `www` does not resolve in
this audit. The account verification TXT query returned no answer: verification
status is not proven by repository/API evidence and must be checked by the owner.

## Official constraints verified on 2026-10-05

- [Custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages): account-site custom domains are inherited by public project sites at repository-name paths; individual project domains override inheritance.
- [Domain management](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site): branch publishing creates/uses CNAME; custom Actions publishing ignores it. HTTPS is a Pages setting.
- [Domain troubleshooting](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages): a custom domain must be unique across Pages sites. Do not assign the apex to every repository.
- [Publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site): one artifact can be uploaded and published by Actions; a repository CNAME does not change Actions domain settings.
- [Limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits): published site maximum 1 GB; deployment timeout 10 minutes (build is a separate job).
- [Verification](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages): account-level ownership verification protects domains. Preserve its TXT record. Never add wildcard DNS.

## Alternatives and decision

**A — one aggregated Pages artifact: chosen.** Main owns the deployment and apex.
Build each independently maintained child source at a pinned SHA, target its
product subpath, inventory outputs, fail on collisions, then upload one artifact.
Static apps with query/hash state fit Pages without a proxy. No domain duplication,
repository rename, runtime cross-repository dependency, new hosting dependency,
or DNS change is needed. All code remains in its original repository.

**B — user-site inheritance: rejected.** GitHub supports it, but would produce
`/f1-telemetry-dashboard/` and `/BetCastVisualisation/`, require repository renames
or additional assembly to obtain the requested URLs, transfer domain ownership,
and disrupt Main/SEO without solving a problem Option A cannot solve.

**C — subdomains: rejected.** Feasible with extra domain/DNS work but each subdomain
is a different browser origin and does not share localStorage with Main.

**D — other static hosting/proxy: unnecessary.** No Pages limitation currently
requires Cloudflare, Netlify, Vercel, proxies, or edge workers.

## Ownership and URLs

Main owns `/`, editorial directories, `/standings/`, root robots/sitemap/favicon,
and the sole root 404. Telemetry owns `/telemetry/**`; Ghost Car owns
`/ghostcar/**`; BetCast owns `/betcast/**`. Main's existing `/ghostcar/index.html`
redirect is excluded from the aggregate's Main input **before** collision testing;
that single declared ownership transfer is not permission to overwrite other files.
`/f1telemetry/` remains a compatibility entry to `/telemetry/`, preserving query/hash.

Canonical origin: `https://f1-stories.gr`. Canonical product paths are lowercase,
trailing-slash `/standings/`, `/telemetry/`, `/ghostcar/`, `/betcast/`.
Race Desk order remains THE GRID, TELEMETRY, GHOST CAR; BetCast remains a sibling.
Internal canonical navigation uses root-relative paths; metadata/sitemaps use
absolute URLs. Share/embed links use the current page origin/path so independent
local previews still work. Child legacy bases remain buildable during transition.

## Reproducibility, credentials, triggers

Use a checked-in source lock with full child commit SHAs; the Main SHA is the
checked-out deployment revision, recorded alongside child SHAs in public deployment
metadata. Lockfiles and production builds apply. A local dirty-tree dry run must
identify itself as non-release and record source fingerprints, never claim its
HEAD SHAs fully represent uncommitted code. Production rejects dirty/mismatched
sources. No secrets go into metadata. Public read-only git checkout needs no PAT.
Build code runs without Pages-write/OIDC privileges; deployment is a separate job.

First cutover: a separate manual `workflow_dispatch` dry-run workflow has no deploy
job. Production remains disabled in the source lock until reviewed migration
revisions are committed, pinned, and explicitly activated. Existing
Main deployment must reuse the same assembler once aggregation is activated;
maintenance must not subsequently overwrite the aggregate with Main-only output.
Cross-repo triggering is separate: later consider a narrowly scoped GitHub App,
or scheduled read-only freshness reports; neither is required for this migration.
No long-lived PAT is introduced.

## Storage, security, consent

Only `f1stories-theme` is intentionally shared. Product preferences/caches must
have distinct keys. Old github.io storage cannot be read from f1-stories.gr; retain
normal first-load rules, and honor an existing valid canonical preference. Add no
bridges, cookies, theme forwarding, or live-sync requirement.

All products become one browser trust boundary: every script can read origin
storage, same-origin frames can access parents, and host/root cookies accompany
child requests. Path boundaries are organizational, not security boundaries.
Child code must not store credentials. Main author tools currently keep GitHub
tokens in closure memory and remove legacy stored copies; historical browser
copies cannot be ruled out from source inspection. Before cutover the owner must
clear/revoke historical author-tool tokens and avoid framing credential-bearing
author tools in child content. Preserve Main's CSP; do not inject it or analytics
into child apps. Children retain their existing analytics behavior (none found).
Main consent and analytics cookies now share the host; no duplicate child pageview
code is introduced. Main's retired root-worker cleanup must not unregister future
product workers. No child active service worker was found.

## Old URLs, cutover, rollback

Old standalone applications stay live throughout preparation. After the canonical
artifact is deployed and production checks pass, separately publish minimal static
redirects at the exact old Pages URLs. Pages offers no arbitrary server-side 301
rules here: canonical + immediate meta refresh + JS preserving query/hash + visible
fallback is a static fallback with weaker SEO than HTTP redirects. Do not replace
legacy apps before canonical production is proven. Historical gallery links may
continue to use the old origin until that separate redirect phase.

Rollback preserves domain ownership/settings/DNS: restore the recorded Main-only
artifact/revision and keep child Pages applications unchanged. Retain the previous
artifact as an immutable release backup and record successful deployment ID/SHA
at cutover time (live audit snapshot is only today's baseline). If old redirects
have later been enabled, restore their saved child artifacts first. Detailed
operational checklist and local evidence are recorded in the Priority 6 report.

## Four-tool aggregate (SEO PR 5)

| Owner | Path | Build | Node |
| --- | --- | --- | --- |
| Main | `/` (editorial, `/standings/`, `/authors/`, root robots/sitemap/404) | `build:public` | 22 |
| Telemetry | `/telemetry/**` | `build:f1stories` | 22 |
| Ghost Car | `/ghostcar/**` | `build:f1stories` | 22 |
| TYRES | `/tyres/**` | `build:f1stories` | 24 (its `engines`) |
| BetCast | `/betcast/**` | `build:f1stories` | 22 |

`scripts/deployment/sources.json` is the reviewed lock; `release.mjs` enforces it
(order, paths, full SHAs, Node majors, data policy, `enabled` only after
`releaseReady`). Main's `/ghostcar/` and `/tyres/` redirect stubs are removed by
`prepareMain` only when they are the audited stubs; `/f1telemetry/` stays as the
query/hash-preserving entry to `/telemetry/`. Standalone `npm run build:public` is
unchanged and keeps every stub.

**Toolchain.** Each application builds under its declared Node major; `build.mjs`
checks `node --version` per application and records it in
`deployment-manifest.json`. CI keeps Node 22 as the default. The shared setup action
provisions the extra major (24) only once the lock is release-ready or enabled, and
passes it as `--node-bin 24=<dir>`. TYRES renders social cards and panel images with
its own Playwright Chromium; the aggregate job installs the browser's system
libraries before building.

**Canonical policy.** `build:f1stories` declares `https://f1-stories.gr/<tool>/`
(TYRES race pages: their own `/tyres/{season}/{slug}/`). Standalone github.io builds
declare their own github.io page, where they are served until the hand-over, so
child merges never point search engines at a page that does not exist yet. Every
child page is either self-canonical (and listed in the sitemap once, no `lastmod`)
or `noindex` (TYRES embeds and 404). Assembly fails otherwise.

**Data freshness.** Telemetry, Ghost Car and BetCast read live public APIs in the
browser; pinning their code freezes no data. TYRES is static: code is pinned, while
`data/` comes from the reviewed default branch at build time (bot PRs are merged by
a person) and is recorded by commit and digest. Its own `weekend:update` then
refreshes schedules and forecasts, exactly as TYRES' Pages deployment does, keeping
dated snapshots and labelling forecasts older than 24 h as stale in the UI. Assembly
fails when the TYRES data snapshot was not generated by the build and reports old
forecasts in the manifest. `deploy-pages.yml` rebuilds every 6 h, the TYRES cadence,
but its gate skips scheduled runs while `enabled` is false.

**Old URLs.** GitHub Pages cannot send a 301 for these project paths. After the
aggregate is live and verified, `redirects.mjs` prepares compatibility pages for the
old github.io sites: canonical to the new URL, immediate meta refresh plus script
preserving query and hash, and a visible link. That is a client-side transition,
not an HTTP redirect. The old deployments stay untouched until then.

**Activation** (all must hold): reviewed upstream commits merged and pinned;
`releaseReady:true`; the manual Ecosystem dry run passes on CI (build, 4 tool roots,
canonicals, sitemap, assets, freshness, browser smoke); then `enabled:true` in its own
reviewed commit, published by the existing Deploy Pages workflow.

**Rollback.** Set `enabled:false` (revert the activation commit) and run Deploy Pages
manually: it publishes the Main-only artifact, including the `/ghostcar/` and
`/tyres/` stubs, from the same reviewed sources. No DNS, domain, HTTPS or child Pages
setting changes; no article or author page is removed, since Main's standalone
artifact contains them all. Old github.io deployments remain live throughout.

**After activation** check: each tool URL serves its app (not Main's stub); assets,
chunks, `/tyres/` race and embed pages and `/telemetry/interactive/` load; live
canonical and `og:url` match; the sitemap lists the four tools once; article and
author pages still load; Main pages request no tool assets; live data loads in each
tool. Then inspect the four tool URLs in Search Console. Indexing and consolidation
of old links are not guaranteed and take time.

## Release readiness and cutover (SEO PR 5.1)

**Status: activation proposed** (`releaseReady:true`, `enabled:true` in the
activation PR; until it merges, Deploy Pages publishes Main alone). The final run,
[40197365952](https://github.com/georgiosbalatzis/f1StoriesPage/actions/runs/40197365952),
builds, assembles, browser-tests and passes every publisher gate on the merged
commits below: 5,240 files, 372.0 MB, 487 sitemap URLs.

Earlier evidence (GitHub-hosted, ubuntu24 20261023.334.3, Node 22.23.3 + 24.21.0):
- [run 40180388440](https://github.com/georgiosbalatzis/f1StoriesPage/actions/runs/40180388440):
  merged pins, before the publisher gates were added to the dry run: build,
  integrity and browser suite pass.
- [run 40184161016](https://github.com/georgiosbalatzis/f1StoriesPage/actions/runs/40184161016):
  merged pins, publisher gates included: all pass except the runtime audit
  (inline pre-paint scripts in Telemetry, Ghost Car, BetCast; BetCast's Google
  Fonts) and the primary-domain test (a retired-domain comment in Ghost Car).
- [run 40184154325](https://github.com/georgiosbalatzis/f1StoriesPage/actions/runs/40184154325):
  the same with the three open fix PRs pinned on a throwaway branch (evidence
  only): **every step passes**, publisher gates included; 5,240 files, 372.0 MB.

**Hosted dry run.** `Ecosystem dry run` (`aggregate-dry-run.yml`; manual, and on
PRs that change the deployment) on `ubuntu-latest` with Node 22 and the lock's
Node 24, Chromium plus system libraries: `build.mjs --rehearsal` (the pinned
release build, allowed before `releaseReady`, never used by a publisher), public
URL integrity, the browser suite, then every gate `build-pages` runs on an
enabled aggregate, a live read-only API probe (informational) and a step summary.
It uploads reports only; it has no Pages, OIDC or write permission.

**Pinned sources** (merged `main` commits; each tree identical to its reviewed PR
head, directly on the previous pin): Telemetry
`38c3dd2018b810a5dce1add1f7663bcb199c845a` (#22, #23), Ghost Car
`4d7a783d9866bce917f61ae6546e48bc0d38b622` (#21, #22), TYRES
`c780d95ffb678f9be710d5e92fce77ac997e0d9a` (#19, squash), BetCast
`74eeb98b4acb1b4e0ea45d4ab12f7fdf4e0c2650` (#2, #3). TYRES data follows its reviewed
`main` (`7748aef9` in the final run, with Pirelli update #15); its code, including
Dependabot bumps #17/#18, stays at the pin until re-pinned and re-validated.

**Re-pinning later:** pin only merged commits whose tree equals the reviewed head,
and require a green `Ecosystem dry run` on that commit before marking readiness.

**Freshness evidence:** three hosted builds with the same TYRES data commit
(`c780d95f`, digest `02bc0a5e5135` before refresh) each refreshed schedules and
forecasts (digests after `70b8704960d8`, `e6b668f85f7d`, `6309a2e17f2d`); the current
race was a live forecast, past races archived forecasts, none stale. The final run
took newer reviewed data (`7748aef9`, digest `f62d7c95a25a`) with the code still
pinned, validated it with the pinned schemas and refreshed it. GitHub had not yet
started a scheduled Deploy Pages run when this was written (the 12:41 UTC slot
after #333 had not fired 40 minutes later; GitHub cron is best-effort); the gate
logic is covered by `pages-preparation.test.mjs`.

**Readiness** (set in SEO PR 5.1 after the green dry run on the final pins):
`releaseReady:true` only. It changes no deployment: Deploy Pages still publishes
Main alone while `enabled:false`; the setup action provisions Node 24 alongside
Node 22 in every workflow. Any later re-pin needs a green dry run again.

**Activation PR** (separate, approved, quiet window): `enabled:true` in its own
commit. Expected artifact: about 5,240 files and 370–380 MB (Main 4,152 files;
Telemetry 185, Ghost Car 23, TYRES 837, BetCast 42), 487 sitemap URLs, report in
the run's `deployment-manifest.json`. Merging publishes it: the main push runs
Site Maintenance, whose `build-pages` now builds the aggregate (expect about 10–13
minutes instead of 1–2; job limit 25). Rollback reference recorded before the
activation PR: Pages deployment 7314387873, source `9c04f4ae`, Main only (Site
Maintenance run 40201907576, 2026-10-25 14:23 UTC).

**First production deployment checks** (live, after the Deploy Pages run):
`curl -sI https://f1-stories.gr/{telemetry,ghostcar,tyres,betcast}/` are 200;
each page's `<link rel="canonical">` and `og:url` are `https://f1-stories.gr/<tool>/`
(TYRES race pages: their own URL); `/deployment-manifest.json` shows the pinned
SHAs; `/f1telemetry/?…#…` lands on `/telemetry/` with query and hash; the sitemap
lists each tool once; an article, an author page and `/standings/` load unchanged;
each tool loads live data; BetCast article embeds resize and follow the theme.

**Rollback.** Revert the activation commit (`enabled:false`) and run Deploy Pages
manually; it publishes the Main-only artifact again, stubs included. No DNS,
domain, HTTPS or child Pages change; no content is deleted.

**Old github.io sites** stay deployed and unchanged through all of this. Publish
the prepared compatibility pages (`node scripts/deployment/redirects.mjs --site
<artifact>`: per page, canonical + refresh + script keeping path, query and hash;
not HTTP 301s) only after the first production deployment has passed the checks
above, in each child repository, as a separately reviewed change.
