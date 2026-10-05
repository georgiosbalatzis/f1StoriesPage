# Priority 6 deployment architecture

Decision recorded 2026-10-05 **before implementation**. Status: local preparation;
cutover is explicitly not authorized. No deployments, commits, PRs, DNS changes,
Pages setting changes, or legacy replacements are part of this work.

## Current topology (read-only GitHub REST Pages API)

All four repositories are public, default branch `main`.

| Repository | Live publisher | Live URL | Custom domain |
| --- | --- | --- | --- |
| f1StoriesPage | Actions (`deploy-pages.yml`, reusable by maintenance) | https://f1stories.gr/ | f1stories.gr |
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

Canonical origin: `https://f1stories.gr`. Canonical product paths are lowercase,
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
have distinct keys. Old github.io storage cannot be read from f1stories.gr; retain
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
