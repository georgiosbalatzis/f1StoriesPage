# P-06 repository and artifact hygiene

**Verdict: no safe deletion or exclusion is established.** No product or source change is proposed. S-15 remains open as record-only: repeated bytes do not establish recoverable bytes, and published URL identity and protected media must be preserved (`docs/performance/p01-redundancy-ledger.md:50`; `docs/performance/p01-prioritized-backlog.md:149`).

Scope: offline inventory of the supplied revision and one local `build:public` run. Measurements below come from P-06 evidence (local, not committed), specifically `p06/INVENTORY.md`, `p06/ARTIFACT-HYGIENE.md` and the cited `p06/data/` files. Bytes are decimal unless labelled otherwise.

## Four separate measures

| Measure | Observation | Interpretation |
|---|---|---|
| Git storage | `git count-objects`: 5 packs, 484.54 MiB packed; 104 loose objects, 508 KiB. HEAD has 4,950 unique blobs / 240,946,745 logical bytes; blobs reachable through `--all` but absent from HEAD number 32,671 / 2,008,155,964 logical bytes. | Logical blob bytes are uncompressed object sizes, not pack costs or savings. Shared objects and packing prevent adding them as disk usage. History rewriting is out of scope. Evidence: `p06/data/git-count-objects.txt`, `p06/data/history-summary.json`. |
| Tracked working tree | 5,375 HEAD paths / 267,054,494 bytes, counting each path. Largest top-level directories: `blog-module` 222,631,290; `scripts` 13,224,070; `docs` 11,954,247; `standings` 7,296,588 bytes. Largest extensions: `.webp` 143,278,548; `.avif` 52,635,081; `.html` 28,284,199 bytes. | This excludes ignored build output and dependencies. Evidence: `p06/data/history-summary.json`, `p06/data/tree-by-dir.tsv`, `p06/data/tree-by-ext.tsv`. |
| Published artifact | One successful `build:public` produced 4,396 files / 328,862,992 bytes. Text files total 120,052,187 raw bytes; the sum of independently gzip-compressed files is 24,895,987 bytes. | The gzip sum is a file-size experiment, not transfer: requests, compression, caching and route use determine network bytes. Evidence: `p06/data/artifact-files.tsv`, `p06/INVENTORY.md`. |
| Network transfer | **UNMEASURED per route.** | Obtain route request traces and compression and cache headers before estimating transfer or savings. |

## Duplicate tracked content

There are 294 byte-identical groups, 719 paths and 26,107,749 gross repeated bytes. The conservative group split is 246 SAME-URL-REQUIRED, 4 BUILD-INTERNAL and 44 UNKNOWN (`p06/data/duplicates.tsv`). Artifact presence indicates distinct public URLs, not traffic or interchangeable URLs; protected paths and hashes are checked by `scripts/build/public-media-integrity.mjs:6`. The four BUILD-INTERNAL groups are documentation screenshots absent from this artifact, not proven safe to delete. Gross repeated bytes count copies without establishing which consumers or URLs can be removed, so they are not savings.

## Generated and source classes

These tracked classes overlap and must not be added together. Article HTML includes retained source-less historical pages; a guard entry is not proof it was rewritten during the run. Evidence: `p06/data/generated-summary.tsv`, `p06/data/generated-files.tsv`.

| Class | Files | Bytes | Build writer or guard |
|---|---:|---:|---|
| Version-stamped HTML | 500 | 28,242,272 | `scripts/build/stamp-html.mjs:650` writes stamped HTML. |
| Article HTML, generated or retained | 431 | 25,003,706 | `blog-module/build/index.js:887` retains or updates legacy articles. |
| Sitemap | 1 | 97,416 | `blog-module/build/sitemap.js:69` writes the sitemap. |
| Drift guard exact paths | 18 | 434,181 | `scripts/build/generated-drift-guard.mjs:15` lists guarded paths; their respective generators write them. |

Includes and minification also write build outputs (`scripts/build/include.mjs:192`; `scripts/build/minify.mjs:152`). No minified JS, CSS, maps or asset manifest are tracked in HEAD in this inventory; build success does not prove each class changed bytes.

## Artifact hygiene and aggregate preparation

The build/test/dev-only class is empty in this artifact: 0 files / 0 bytes. Classification is scoped to this build and its path patterns, not every future artifact (`p06/data/hygiene-totals.tsv`; `scripts/build/public-artifact.mjs:138`).

The 22 literal-search candidates / 197,041 bytes remain **UNPROVEN** (`p06/data/artifact-unreferenced-candidates.tsv`; `p06/data/hygiene-consumers.tsv`). Literal searches miss constructed, encoded, external, historical, direct and social URLs; inlined CSS and rewritten paths also complicate attribution. Some candidates are explicitly required by validation (`scripts/build/validate-public-artifact.mjs:70`). Earlier deployments and external clients were unavailable. Absence of a match is not evidence of safe deletion.

In a Main-only aggregate preparation rehearsal, the two standalone stubs `ghostcar/index.html` and `tyres/index.html` were removed by design after legacy-target checks; their namespace is occupied by child artifacts in a full aggregate (`scripts/deployment/assemble.mjs:54`). Another 496 files changed through canonicalisation: 109,585,851 original bytes were **replaced**, not recoverable savings (`p06/data/hygiene-aggregate.tsv`). Full aggregate and child artifacts were not measured.

## Build-time duplication and service worker

Image optimisation writes the same optimised buffer to the output and `.build/public-images` cache on a miss; social-card generation similarly writes cache and output (`scripts/build/public-article-images.mjs:32`; `scripts/build/social-cards.mjs:292`). These copies support reuse. One cold local build regenerated 431 cards with zero cache hits; its logged social-card phase was 47,760 ms, not isolated CPU time or a measured saving (`p06/data/build.log`). CI restores `.build/public-images` using prefix restore-keys in both `.github/actions/build-pages/action.yml:21` and `.github/actions/restore-article-images/action.yml:12`. Actual CI hit behaviour belongs to P-07.

`sw.js:1` is an unregister stub with no precache list; `scripts/sw-cleanup.js:8` removes legacy registrations and matching caches. Installed clients and historical cache contents were not inspected, so retirement of these migration paths is unproven.

## Proof required before any future deletion

S-22 rejects deletion on static absence (`docs/performance/p01-redundancy-ledger.md:64`). A future proposal needs complete generated and runtime consumers, every relevant tab, rank and responsive state, image-variant demand, historical deployments and hosting behaviour, direct and social URLs, old article fixtures, and protected-media hash tests. Preserve published URLs and existing gates. A future exclusion, only if justified by that proof, could use `shouldCopy` at `scripts/build/public-artifact.mjs:391` and a corresponding `FORBIDDEN_EXACT` assertion at `scripts/build/validate-public-artifact.mjs:37`; neither is proposed here.

## Limitations

The inventory and literal-reference searches are offline and bounded; they do not establish external or constructed consumers. The artifact and timing describe one local build, not CI cache behaviour or a representative performance distribution. Earlier deployed artifacts, installed clients, the full aggregate, and route-level transfers were unavailable or unmeasured. No deletion, artifact saving or speed-up is established.
