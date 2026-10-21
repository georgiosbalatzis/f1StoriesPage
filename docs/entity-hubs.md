# Approval-gated entity hubs (P1.2)

No real entity is approved for publication in this change. Norris has four approved subjects and an approved introduction, but his separate hub publication review is pending. Hamilton has two subjects. Production therefore generates **zero entity hubs**.

## Architecture

`blog-module/build/entities/hubs.js` validates the P1.1 foundation before selecting membership. `build/index.js` passes the original article records into the gate and uses compact index records only for existing thumbnail paths and dimensions. It composes pages with the discovery shell, `leadHtml`, `rowHtml`, `pagination` and `headHtml`. The first four articles use existing section cards; remaining articles use native thumbnail rows. Pages contain 30 articles, newest publication date first, with ascending article ID as a deterministic tie break.

Supported routes:

- `/blog-module/blog/entities/drivers/{slug}/`
- `/blog-module/blog/entities/teams/{slug}/`
- `/blog-module/blog/entities/circuits/{slug}/`
- `/blog-module/blog/entities/grands-prix/{slug}/`
- Additional pages use `/page/2/`, etc., each with its own canonical and prev/next links.

Only eligible descriptors reach the existing sitemap renderer. HTML stamping recognizes the entity route shapes. The public artifact builder independently recalculates the approved path allowlist after stamping. Association evidence may cite article HTML line numbers, so it is validated before article rendering and again after stamping, when article HTML is stable. The artifact builder never broadly copies the entity directory. Drift checks recognize entity HTML. Cleanup removes obsolete `index.html` files only at recognized entity route depths and prunes only directories emptied by those deletions; other content and symlinks are preserved. Output through a symlink is rejected, including dangling file links.

The templates reuse existing CSS, fonts, image variants, header, footer and consent/navigation scripts. No CSS, browser JavaScript, dependencies or image derivatives were added. Hubs omit the archive filtering and taxonomy browser runtimes because these pages are static. Articles and their metadata are never modified by the hub generator.

## Fail-closed eligibility

All conditions must hold:

1. The complete registry and association manifest validate, including source evidence, references and human review records.
2. `entity.hub.review` independently records human publication approval with reviewer and valid date, no later than the build's publication day.
3. `entity.hub.introduction.review` independently records human approval, and the approved introduction has a nonempty heading. Heading and paragraphs are escaped, never rewritten.
4. At least three associations are human approved, `primary` or `secondary`, `substantive: true`, and `discipline: "f1"` or explicitly human-reviewed `"mixed"` context.
5. Included articles span at least two distinct valid publication days.
6. Each included source has a valid nonfuture publication date, no draft/unpublished state, an existing public article HTML file, exactly one matching existing canonical, and no robots/googlebot noindex directive.

Pending proposals, mentions and exclusions are never members. An unpublished source does not count. Missing publication approval never inherits approval from the introduction, article counts or coverage report. Invalid foundation data stops the build.

## Local Norris review

From this branch (Node 22+):

```sh
npm ci
npm run build:public
npm run entities:preview
```

Open <http://127.0.0.1:4174/blog-module/blog/entities/drivers/lando-norris/>. Review at 1440px desktop and 390px mobile; reject the normal consent prompt and scroll through all four cards. Article links retain their existing production canonicals.

The command writes only to a new OS temporary directory and prints its location. The loopback server overlays those files on the existing `dist/` for shared assets. It never writes a preview into the repository or `dist/`. Every response has `X-Robots-Tag: noindex, nofollow`; preview HTML also carries noindex and uses a loopback canonical/OG/schema URL. `robots.txt` disallows crawling. Ctrl+C stops the server; remove the printed temporary directory when finished.

`npm run entities:preview -- --build-only` creates review files without starting a server. The temporary directory also contains `expected-public-metadata.json` and `expected-sitemap.txt`: clearly labelled review fixtures showing the metadata and sitemap shape **if separately authorized later**. They are not a live sitemap or published HTML.

The exact source membership is `20260725W`, `20260822W`, `20260824W`, `20260927G`. Visual source order is newest first. The registry's exact approved Greek heading and both introductory paragraphs are used. Preview bypasses only pending publication approval; all other eligibility conditions still apply.

## SEO and lastmod

Approved pages receive a distinct Greek title, description, self canonical, OG/Twitter metadata, BreadcrumbList, CollectionPage and an ItemList linking the original articles. Generic Grand Prix collections do not use SportsEvent. JSON-LD escapes HTML delimiters.

Lastmod is the latest real publication date or human review date for the introduction, hub publication or entity associations. Reviewed membership removals therefore advance it as well. Build timestamps, filesystem mtimes and cache-refresh times never drive lastmod. The source archive has no authoritative correction timestamp contract; a later correction that changes collection content needs a recorded editorial review date to advance lastmod.

## Verification and measured impact

Synthetic fixtures exercise all four entity types and the approval, source publication, membership, date, ordering, pagination, escaping, schema, sitemap and cleanup cases. They never approve a real entity.

```sh
npm run test:entities
npm run entities:validate
npm run entities:report
npm run test:taxonomy
npm run test:blog
npm run test:build
npm run build:public
npm run build:check
npm run verify
```

Clean baseline `910a4912` and candidate were built in separate worktrees with independent `npm ci` installations, the same lockfile, Node and machine. Initial cold public builds: baseline 50.09s, candidate 49.16s; this small difference is run noise, not evidence of a speedup. SHA-256 comparison of every public file found 4,082 files / 299,880,744 bytes each, with no added, removed or changed file. No article HTML, sitemap, production JS/CSS or other output changed. Final gate microbenchmark: 11.8ms cold, 5.4ms warm median (30 iterations); Norris render 2.0ms. Preview HTML is 120,061 bytes (26,244 gzip), including the reused shell. A later cached candidate public build took 13.22s and is not comparable with the cold baseline timing.

Current additional public asset count and JS/CSS bytes: zero. Current sitemap growth: zero. Norris would add one HTML page and one sitemap URL after separate approval; a collection with N members adds `ceil(N / 30)` pages/URLs. The preview's full HTML includes the reused shell's existing inlined CSS; it adds no stylesheet request.

Final focused checks: 50 entity tests (25 hub/integration cases plus 25 existing foundation tests), 44 taxonomy tests, 314 blog tests plus golden snapshots, and 131 build tests passed. Registry validation/report, public build, drift, static quality and tablet CLS checks passed. Standalone artifact assembly rejected an injected pending Norris file before cleanup; the subsequent build removed it. All four synthetic entity routes passed actual HTML stamping and repeat-stamp idempotence without requiring approval/evidence validation during transient HTML rendering.

`npm run verify` passed through media/static/runtime checks, edition browser QA (358/358 checks), author/standings/security tests, asset/media budgets, consent and the visual matrix (72 captures), then stopped at Lighthouse LCP. Separate sequential runs on unchanged budget thresholds:

| Route | Clean main LCP | Candidate LCP | Limit |
| --- | ---: | ---: | ---: |
| Home | 2927.357ms | 2926.804ms | 2500ms |
| Latest article | 2701.376ms | 2701.365ms | 2500ms |

Both builds passed Blog and Standings Lighthouse budgets; no threshold changed. Tablet CLS was run separately and passed. This change does not address the reproduced baseline LCP failures.

## Publishing Norris later

This PR does not authorize publication. After explicit human authorization, record a separate human review in **Norris's `hub.review`** with `status: "approved"`, `kind: "human"`, the actual reviewer in `by`, and the actual approval day in `date`. Keep the independently approved introduction and qualifying source associations intact. Re-run validation, tests and the public build; review the newly generated page, canonical and sitemap entry. Publication then requires a separately reviewed merge/deployment through the existing GitHub Pages process. No article edits, scheduled-workflow changes, search, navigation or recommendation enhancements are needed.
