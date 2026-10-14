# Final release candidate — 14 October 2026

Prepared locally on `release/final-rc`, tracking `origin/ultrareview`. Integrated
baseline: `1491a21ade9a3b6a00800fa7420bc85a06d3cdf4`. Approved media source:
`release/editorial-media` at `fc182332ca3bf6ff8663bd9cc4aad49c87a3b777`, cherry-picked
as `869cb239`. The fetched `origin/main` at
`718cc3658f96ee58b2b53bee96ad8d243238b6c6` is already an ancestor of the baseline.
The candidate preserves all 398 published articles, including 13 October content.
No remote push, main merge, deployment, DNS or Pages setting change was performed.
The exact final candidate SHA and complete test evidence are recorded outside the
public artifact at `/Users/giorgos/.local/share/f1stories-final-rc/2026-10-14/`.

## Verification

Public build and validation pass; repeated public builds produce identical SHA-256
manifests for 3,568 files. Blog tests and golden snapshots, build tests, Edition QA
(358 checks), Media QA, author, standings, security, deployment, consent, generated
assets, static quality and runtime dependency checks pass. Targeted Chrome smoke
checks cover homepage → latest Race Report, Race Desk navigation and THE GRID
driver/constructor switching. All four Lighthouse route budgets pass. Public image
and article-media budgets pass. The size guard retains exactly the nine documented
inherited failures; no budgets were increased and there are no new failing paths.
All 44 remediated source files match the approved hashes, derivatives and metadata.
Withdrawn original and formerly optimized bytes are absent from output and the
production image cache. Earlier approved treatments and the provenance queue stay
unchanged. Hosted CI has not run for this local candidate.

## Primary domain and production blocker

The candidate uses `https://f1-stories.gr` in CNAME, canonical/Open Graph/social
URLs, JSON-LD, sitemap, robots, share/author links, embed/CSP allowlists, build
validators, disabled aggregation configuration and the live-header workflow.
Article paths and GitHub Pages directory routing are preserved. The complete
public output contains no references to the retired domain. There is no outgoing
article RSS/Atom feed; the unrelated YouTube RSS input remains unchanged. Three
dated historical architecture/performance records remain archival evidence and
are not shipped; their domain/cutover descriptions are superseded by this record.

Read-only GitHub API: Pages already has custom domain `f1-stories.gr`, publisher
`workflow`, source `main:/`, ownership state `unverified`, no HTTPS certificate and
HTTPS enforcement disabled. Cloudflare and Google public resolvers return NXDOMAIN;
the apex, www and ownership TXT cannot currently be confirmed. Repository migration
is complete locally; domain readiness is **not** complete. A checked-in CNAME does
not configure an Actions-published site's custom domain.

Owner actions: confirm registration and authoritative nameservers for
`f1-stories.gr` in Papaki; publish the GitHub account's verification TXT at
`_github-pages-challenge-georgiosbalatzis.f1-stories.gr` using the exact value GitHub
provides; verify the domain in account Settings → Pages. Configure apex A records
`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, and
`www` CNAME to `georgiosbalatzis.github.io`. Once DNS and certificate issuance
succeed, enable Enforce HTTPS and confirm `https://f1-stories.gr/` resolves.
See [GitHub domain configuration](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
and [ownership verification](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages).

## Editorial owner decisions

`20250409G/1` and its card/mobile derivatives still ship unchanged. The existing
approved media handoff describes this as an undocumented card photograph and
explicitly excludes it from the R6 acceptance blocker list. It does not establish
illegality or fabrication. Recommend recording its source/permission or separately
authorizing a neutral replacement; no additional withdrawal is included here.

Category C remains a source/rights documentation queue, not a finding of fabricated
or unlawful imagery: `20260329G/2`, `20260217T/2`, `20260222T/2`, `20260227Τ/2`,
`20260423G/5`, `20260626W/2`, `20260630W/2`, `20260928G/1`, `20260910-5G/1`,
`20260312J/2`, `20250926W/2`, `20260423G/1`. Recommend assigning source confirmation
and recording the owner's disposition. The scoped remediation does not clear the
wider archive or authorize restoring withheld originals.

All 44 withdrawn originals remain retrievable from the existing public remote Git
history. This candidate removes them from current deployment output, not history.
Owner must explicitly accept that historical exposure or commission a separately
approved history/visibility plan. No history rewrite, visibility change or additional
asset deletion was performed. Previous handoff:
`/Users/giorgos/.local/share/f1stories-release-prep/2026-10-14/HANDOFF.md`.

## Release mechanics and exact sequence

`main` pushes trigger Site Maintenance (`publish-blog.yml`), which regenerates blog
artifacts when needed and calls `deploy-pages.yml`. It uploads validated `dist/`
from the resulting main checkout; a manual Deploy Pages run explicitly checks out
`main`, regardless of the branch selected in the dispatch UI. `ultrareview` and the
candidate branch do not deploy on push. GitHub Actions is enabled. Deployment uses
`github-pages`, which permits `main`; the built-in `GITHUB_TOKEN`, `pages:write` and
OIDC `id-token:write` are sufficient. No custom deployment secret is required.
Setup installs Node 22 and locked dependencies; full Site Quality uses runner Chrome.

After domain readiness and owner editorial/historical-exposure GO: separately
authorize pushing `release/final-rc` and opening a PR to `main`. Run Site Quality
on the PR merge checkout, including the new primary-domain and approved-media
checks. Reconcile any newly published main content before release and rerun targeted
checks if it changes the candidate. After hosted CI success, separately authorize
merging that reviewed revision into `main`; the merge triggers production deployment.
Record the actual deployed SHA and validate HTTPS, article URLs and social previews.
Do not use manual Deploy Pages as a candidate-preview mechanism.

Aggregation stays disabled (`enabled:false`, `releaseReady:false`). Telemetry and
Ghost Car still publish independently from their repositories' `gh-pages:/` branches;
TYRES publishes with Actions in its own repository. Their Race Desk links retain
their existing github.io destinations. Any sibling source changes require their own
separately authorized deployments. None is included or deployed by this candidate.
