# R-03 static GP pilot: acceptance record

## Scope and dependencies

Six static pages use `/race-desk/gp/{raceId}/`, with the canonical race ID retained across venue/name changes. Approved IDs: 2025 Singapore; 2026 Azerbaijan, Bahrain, Japanese, Mexican and Singapore GPs. Adding a registry record does not publish another page. Removing or changing approved identity/schedule values fails the publication gate. R-01 and R-02A/B are merged; this branch is stacked on R-02C #397, integrated head `b65a70f8`, and the deployed homepage fix `aec0cf22`. R-03 cannot release before R-02C acceptance. No child source or production pin is changed.

The six-link homepage discovery section sits below the existing four-product index. Each page reuses shared navigation, footer, consent, typography and themes. No GP-specific browser runtime, backend or provider request is introduced. Existing authoring and article association remain outside this milestone.

## Evidence and public claims

Registry blob/value integrity alone does not authorize public schedule claims. `data/race-desk/hub-evidence.v1.json` records six independently examined Formula 1 page captures: source/final URL, actual observation UTC, SHA-256, byte length, exact field references and the 30 session starts. `hub-publication.mjs` pins the reviewed capture fingerprints and permitted labels; invalid/missing evidence or registry drift fails before output writes. Raw HTML captures remain diagnostic material outside the public artifact.

Primary pages are `https://www.formula1.com/en/racing/2025/singapore` and the 2026 `japan`, `bahrain`, `azerbaijan`, `singapore`, `mexico` paths. Session names/starts come from their JSON-LD subevents; event/venue labels also use the recorded meeting/circuit fields. Bahrain's inconsistent JSON-LD address is explicitly excluded: no country assertion derives from it. Japanese public venue is “Suzuka Circuit”; Mexican public event is “Mexico City Grand Prix”. Original local aliases remain visible separately. IANA zones and app mappings retain their local-source attribution; an official GMT offset does not verify an IANA identifier.

The pages label these values as schedule records, not observed completion, live coverage, results, availability or data freshness. They display UTC, venue and Europe/Athens times. Missing times stay unavailable. Source observation dates are not sitemap lastmod or result timestamps. TYRES previews and their existing verification states are not promoted. No OpenF1 keys are invented: all Telemetry/Ghost links remain generic; six TYRES mappings and four Grid mappings use the existing verified local link contracts. Grid's exact link includes its required compact embed view and labels it accordingly.

## Implementation and ownership

Terra owners separately implemented the pure model/tests, renderer/CSS, independent browser QA and official-source evidence gate. Sol provided read-only architecture/provenance review and a separate final code/evidence review. The integration owner alone wired build, artifact allowlisting, sitemap, workflow, docs and shared fixture changes. Requested Terra 6.1 High and Sol 6.1 Extra High were available for these assignments.

The generator validates/prepares all models before writes, expands the existing shared includes and runs before final blog sitemap generation. Exactly six GP HTML paths and one stylesheet enter the artifact allowlist; raw registry/proof/scripts do not. Unknown routes remain 404. No automatic cleanup deletes unrelated output. Duplicate homepage markers, invalid roots and symlink outputs fail safely.

## Actual verification before final candidate

- Publication-gated build: PASS, 4,261 public files, approximately 301.38 MB (`/tmp/r03-publication-gated-build.log`).
- Domain/build fixture suites: 114/114 and 153/153 PASS (`/tmp/r03-gated-unit.log`, `/tmp/r03-gated-build-tests.log`). Includes missing/changed evidence, mappings, null schedules, chronology, DST/midnight, immutable routes, canonical/OG/sitemap, symlinks and deterministic output.
- Static source guard and size budgets: PASS (`/tmp/r03-gated-static.log`, `/tmp/r03-gated-budgets.log`). No thresholds relaxed.
- Final local browser report: `.build/race-desk-r03-publication-final/hub-browser.json`, 64 checks, 48 captures, zero failures in Chrome 156. Six pages with and without JavaScript; widths 390/576/768/1440, both themes; fonts, keyboard/skip/menu/theme/scroll/reload, canonical metadata, source roles, timezone text, unknown-route 404, zero CSP/page errors.
- Browser captures recorded 13 same-origin requests and 15 intercepted requests in total per capture. Same-origin decoded response bytes 208,041–208,674; HTML plus JavaScript 127,944–128,577 bytes. One incumbent shared-navigation calendar request is mocked, also present on the author baseline. These are measurements under that harness, not a speed improvement claim or field LCP/CLS.
- Sol independently checked all six raw capture fingerprints/lengths, URLs, observation instants, identity fields, GMT offsets and 30 starts, and ran 49 hub tests. Verdict: no blocking correctness/security/provenance/SEO finding; limited GO for the specified evidence-backed fields, conditional on dependency acceptance and final CI.

Final current-head build/idempotence, source/artifact comparison, Site Quality and assembled six-TYRES/four-Grid browser acceptance must be reported in the PR. Earlier local R-02C full verify had article visual overflow and a marginal article LCP miss; these remain historical disclosed observations, not R-03 passes. No whole verify success is claimed here.

## Release guarantees and gaps

R-03 adds six canonical routes; existing article/product paths, calculations, embed parameters, canonicals, consent and deployment pins remain regression-sensitive and covered by existing gates. Publication still uses the normal pinned aggregate workflow. There is no claim that a source capture proves telemetry exists or that scheduled sessions occurred. Results, timeline, pace, article associations and predictions await their separately reviewed milestones.

Do not infer merge/deployment from local green checks. Candidate PR, CI links, exact file list and final dependency state belong in the reviewable PR record. Normal owner-authorized merges/deployments of earlier milestones are historical facts; this R-03 pilot has not been deployed.

## Final local integration checks

After incorporating deployed main `aec0cf22` and R-02C `b65a70f8`, two consecutive `build:public` runs passed. Their complete 4,261-file content manifests were byte-identical (SHA-256 of the sorted file manifest: `c46cd7dd3fcc8d2c686510995d6f87610e4a83529bd550b409a50df3947cb45f`). Security 33/33 and static checks passed again. Logs: `/tmp/r03-build-public.log`, `/tmp/r03-build-public-second.log`, `/tmp/r03-security.log`, `/tmp/r03-static.log`.

Before the candidate commit, `build:check` reported exactly the seven intentionally changed generated HTML files (homepage and six GP pages), since that guard reads Git status. This is not a passed drift check; it must be repeated after committing the candidate.

Comparison to the available R-02C dist added only six GP pages and the Race Desk stylesheet, removed no files, and changed home CSS, homepage and sitemap. That baseline artifact predates the incorporated headline wrap fix, so its home CSS delta is not attributed to R-03. No improvement or exact current-baseline byte delta is inferred from that comparison.

Sol's final coordinated-drift probe found that capture fingerprints alone did not pin the extracted semantics. The bounded fix adds reviewed, canonical SHA-256 digests of each complete approval, including extracted starts, local identity, observation timestamp and labels. Sol independently recomputed all six digests, confirmed harmless JSON object-key reordering remains valid, and verified coordinated schedule/observation/timezone drift now fails. Final hub suite: 50/50 PASS under Node 22. Updating any legitimate approval now requires an explicit reviewed code change as well as evidence changes. This check records the reviewed claim set; it does not independently fetch or authenticate a website during deterministic builds.
