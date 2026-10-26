# Article URL policy

**Decision status (2026-10-26):**

| Scope | Status |
| --- | --- |
| Historical articles (413 published) | **KEEP** |
| Descriptive URLs for future articles | **DEFER** |
| Historical migration | not recommended; prerequisites below |

A recommendation, not an authorisation. Changing either status needs the owner's written approval in its own PR
([Approval before any migration](#approval-before-any-migration)). This document changes no public URL.

## Current policy

Every article has one public address, derived from its folder id:

```
https://f1-stories.gr/blog-module/blog-entries/<folder id>/article.html
```

- **Identity is the folder id**: date plus author code (`20260222T`, `20260610-2J`, older `20250505GF`, bare
  `20220101`). It is never derived from the title. The publication date is parsed from it (`shared.js` `parseDate`).
- **Encoding:** the id is percent-encoded in URLs and raw on disk. One id is not ASCII: `20260227Τ` (Greek capital Tau
  U+03A4) → `20260227%CE%A4`. Both forms resolve on GitHub Pages; Latin `20260227T` is a different, absent folder.
- **One address everywhere:** canonical, `og:url`, Article/NewsArticle `mainEntityOfPage`, the last BreadcrumbList item,
  the sitemap `loc`, the RSS `link` and `guid`, NEXT UP, prev/next, section, archive, author and hub links, the blog
  index search and the homepage. Root-relative or absolute; never relative.
- **The RSS GUID is the canonical URL** (`isPermaLink="true"`), so a title or excerpt edit never re-announces a story.
- **Tests:** `blog-module/build/__tests__/article-url-contract.test.js` (fixtures with Greek ids, then the built site).
  `validate-public-artifact.mjs` independently checks canonical = output route, `og:url`, JSON-LD, breadcrumb and
  sitemap presence on every build.

### Baseline (main f69700fe, 2026-10-25)

| Measure | Value |
| --- | --- |
| Published article pages / posts / sitemap article URLs | 413 / 413 / 413 (462 sitemap URLs in all) |
| Future-dated, draft or unpublished articles | 0 |
| Pages whose canonical, `og:url`, JSON-LD or breadcrumb disagree | 0 |
| RSS items (link = GUID = canonical) | 30 / 30 |
| Internal article links in the artifact | 3,849 (417 absolute, 3,432 root-relative, 0 relative, 0 broken) |
| Folder-relative asset references in article pages | 4,153, in all 413 pages |
| `/stories/` | absent from the artifact; 404 live |

### Known inconsistencies (recorded, not changed here)

1. **Duplicate article.** `20260227Τ` is a near-copy of `20260222T`: same title, same image files, 447 words, body
   text 2 characters apart. Both are self-canonical, so one story is indexable at two URLs. Tau is not an author code,
   so the copy shows the house byline. Owner decision: keep both, point one canonical at the other, or remove one.
2. **Sitemap encoding.** `sitemap.js` writes the Greek URL as raw Unicode while every other surface uses `%CE%A4`.
   The sitemaps protocol expects RFC 3986 URLs; the fix is one `encodeURIComponent` and changes one sitemap line.
3. **Mixed producers.** Encoded: `article-render.js`, `feed.js`, `body-links.js`, `entities/hubs.js`, `index.js`
   (hero), `scripts/author/article-index.js`, the validators. Raw interpolation: `sitemap.js`, `nav.js`, `worker.js`
   (`post.url`), `authors-page.js`, `author-pages.js`, `discovery.js` (`route.story`), `home-panels.js`,
   `blog-module/blog-index.js`. Equivalent for ASCII ids; browsers encode the one Greek id on request.
4. **The id was mutable (fixed).** Editing an article's date or author in the housekeeping tool renamed its folder:
   the URL changed and the old one returned 404 with no redirect. A published folder id is permanent, so the tool now
   shows date and author read-only, refuses a changed value at save, and never derives the folder from the form.
5. **No publication gate for pages.** The feed, hubs and NEXT UP skip future-dated, draft and unpublished articles;
   the article page, sitemap and indexes do not (`docs/rss-feed.md`). The contract test now fails the build if such an
   article is in the artifact, so a scheduled article must not reach main before its day.

## Options

### A. Keep legacy URLs

For: no work, no risk; every surface already agrees; RSS GUIDs stay stable; bookmarks and the few external links keep
working; nothing is layered over the 2026-10-14 domain move while it settles. Against: long, technical URLs that expose
the storage folder and its date and author code. The id must be made truly immutable (inconsistency 4).

### B. Descriptive URLs for future articles only

`/stories/<slug>/` served from `stories/<slug>/index.html`. Feasible on GitHub Pages **without redirects**: a new
article never had a legacy URL. It must be designed, not accidental:

- one URL helper for all producers in the matrix below, before any slug exists;
- the slug is a stored source field (not the H1), proposed by the author tool, checked for uniqueness against the
  repository and the slug history, editable until first publication, frozen after;
- page assets: all article pages use folder-relative image paths, so the page needs absolute asset URLs or its images
  published under its new path;
- two URL formats permanently; support, previews, analytics and validation handle both;
- rollback is effectively impossible: a published `/stories/` URL must stay.

### C. Migrate historical articles

**GitHub Pages cannot send per-article 301 or 308 redirects.** Its only redirects are host-level (`www`, `http`) and
the directory slash. Available on Pages, and none of them is an HTTP redirect:

- a stub page with an instant `<meta http-equiv="refresh">` or script at the old path; Google may treat an instant
  meta refresh as a redirect, feed readers, social previews and archives generally do not;
- `rel=canonical` on the old page pointing at the new one: a consolidation hint, not a redirect; both stay crawlable.

Real redirects need a hosting prerequisite: a proxy in front of `f1-stories.gr` with redirect rules (for example
Cloudflare), or a host that reads a redirects file (Cloudflare Pages, Netlify). That is a DNS/hosting change for the
owner; nothing is implemented here (compare `docs/security-headers.md`: `dist/_headers` is generated, and GitHub Pages
ignores it). A migration also needs a 413-entry redirect map, loop/chain checks, kept GUIDs, remapped entity evidence,
and the duplicate (inconsistency 1) resolved first.

## Recommendation and reasoning

**KEEP historical URLs. DEFER future descriptive URLs** until the prerequisites below are met and the observation
checkpoint shows a reason to proceed.

- **No measured benefit.** URL words are at most a light ranking signal. There is no Search Console, GA4 or ranking
  evidence in the repository for article URLs; no gain is assumed.
- **Measurement.** The domain moved on 2026-10-14 and the tools were consolidated on 2026-10-25. Another URL change
  now could not be told apart from either.
- **Little to protect, little to gain.** Ahrefs (2026-10-24) reported domain rating 0 and no backlinks. That makes C
  cheap in equity, but not free: without 301s it doubles the indexable URLs for an unknown period.
- **Cost of B is structural** (matrix): about fifteen producers, folder-relative assets, entity evidence, analytics
  and validation. The safeguards worth having anyway, under A too, are the identity and sitemap fixes listed under
  [Prerequisites](#prerequisites).

## SEO risks

| Risk | A | B (new only) | C (history) |
| --- | --- | --- | --- |
| Duplicate indexing | the known Tau pair only | none if the helper is used everywhere | old and new URLs until consolidated |
| Search Console canonical selection | stable | new URLs from day one | Google may keep old URLs selected |
| Migration fluctuation | none | none for history | likely; size unknown |
| External links and bookmarks | unchanged | unchanged | depend on stubs or a proxy |
| RSS readers | unchanged | new items only | duplicates unless GUIDs kept |
| Maintainability | one format | two formats forever | one format after a risky move |

No indexing, impression or click figures are given because none were available. Search Console is not required to
keep URLs. It is required before C, and before judging B.

## GitHub Pages behaviour (live, 2026-10-25)

| Request | Response |
| --- | --- |
| `…/<id>/article.html` | 200 |
| `…/<id>/article.html?utm_source=x` | 200, same page (the canonical names the clean URL) |
| `…/<id>/article.html/` | 404 |
| `…/<id>/` | 404 (no `index.html` in article folders) |
| `…/<id>` | 301 → `…/<id>/` → 404 |
| wrong case (`20260222t`) | 404 (paths are case-sensitive) |
| `20260227%CE%A4`, `20260227%ce%a4`, raw `20260227Τ` | 200; Latin `20260227T` 404 |
| unknown id | 404, `404.html` (no refresh, no script redirect) |
| `/stories/`, `/stories/<slug>/` | 404 |
| `https://www.…`, `http://…` | 301 to `https://f1-stories.gr/…` |
| a directory route without its slash (`/tyres`, `/authors/<slug>`) | 301 to the slash |

So a future `/stories/<slug>/` is a real `index.html` with a trailing-slash canonical; the no-slash form already
redirects. **No SPA fallback:** `404.html` must never route an indexable article. A removed article returns 404.

## Future slug rules (specified, not activated)

Implemented as pure checks in `blog-module/build/url-policy.js` (used by no build step) and tested in
`blog-module/build/__tests__/url-policy.test.js`.

- **Format:** lowercase ASCII words joined by single hyphens, `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 3–80 characters, at
  least one letter, never starting with eight digits (never mistaken for a folder id). Matches the entity hub slugs.
- **Transliteration, not Unicode.** A Greek slug is percent-encoded when copied (six bytes per letter), exists in NFC
  and NFD forms, and folds case differently on macOS and Linux file systems: the same failure class as the raw/encoded
  split above. An ASCII slug is the same string in the URL, on disk and in the sitemap. The author tool may *suggest*
  an ELOT 743 transliteration; the editor approves it.
- **Identity:** folder id plus stored slug. A title edit never changes the slug. Greek and Latin spellings are
  different slugs and identities (`liouis-chamilton` ≠ `lewis-hamilton`).
- **Unique and never reassigned:** checked against all current slugs and the history of every slug ever published,
  deleted articles included. The same headline on another date takes `-2`, `-3`.
- **Frozen at publication.** A correction before first publication is free; after it, a slug change is a migration of
  one article and needs approval.
- **Republication** keeps id and slug; a new story gets new ones.
- **Reserved first segments:** `telemetry`, `f1telemetry`, `ghostcar`, `tyres`, `betcast`, `authors`, `standings`,
  `privacy`, `blog`, `blog-module`, `entities`, `section`, `archive`, `page`, `stories`, `assets`, `images`, `scripts`,
  `styles`, `feed`, `sitemap`, `search`, `index`, `404` and the remaining live routes (a test keeps the list in step
  with the artifact).
- **Field name.** `home-latest.json` already uses `slug` for the folder id (and the homepage validator reads it), so
  the new source field needs another name or that field renamed first.

| Headline | Approved slug |
| --- | --- |
| Formula 1 | `formula-1` |
| Ferrari SF-26 | `ferrari-sf-26` |
| Λιούις Χάμιλτον | `liouis-chamilton` |
| Lewis Hamilton | `lewis-hamilton` |
| Grand Prix Σιγκαπούρης | `grand-prix-sigkapouris` |
| 2026 Power Unit | `2026-power-unit` |
| Ο Βερστάπεν «κλέβει» τη νίκη! | `o-verstapen-klevei-ti-niki` |
| Hamilton's last lap | `hamiltons-last-lap` |
| the same headline on a second date | `<slug>-2` |
| historical folder `20260227Τ` | no slug; keeps `/blog-module/blog-entries/20260227%CE%A4/article.html` |

## Compatibility requirements

- Immutable identity; every historical URL stays reachable.
- Canonical, `og:url`, JSON-LD, breadcrumb, sitemap (percent-encoded, exactly once, never a redirected URL), RSS link,
  related, prev/next, author, hub and search-index links name the same address.
- Internal navigation always links the canonical, never a redirect.
- Redirects, where real ones exist: one hop to a served page; no self-redirects, chains or loops; a redirected URL is
  never also served as a page. Stub pages are described as stubs, not as redirects.
- `datePublished`, `article:published_time` and the sitemap `lastmod` do not change with the URL (today they come
  from the folder name).

### RSS GUID stability

A GUID is the URL the item was first published with, forever. A new article's GUID is its first canonical URL. A
migrated article keeps its legacy GUID and marks it `isPermaLink="false"` while its `link` moves. The feed holds 30
items, so a GUID change re-announces up to 30 stories.

## Readiness matrix

From the code at f69700fe. B = new articles at `/stories/<slug>/`; C = historical articles moved there.

| Component | Today | B: new articles | C: history | Risk |
| --- | --- | --- | --- | --- |
| `article-render.js` | canonical, `og:url`, JSON-LD, share URLs from the encoded folder URL | route through the helper | same | low once centralised |
| article pages | 4,153 folder-relative asset refs | absolute asset URLs, or images under the new path | rewrite 413 pages | high |
| `worker.js` | `post.url` raw; date and author parsed from the folder name | add the stored slug; keep date from the source, not the path | same | medium |
| `sitemap.js` | raw id; no publication filter | helper, percent-encoding | drop legacy URLs | low |
| `feed.js` | GUID = canonical, `isPermaLink="true"` | new GUIDs are new URLs | keep legacy GUIDs, `isPermaLink="false"` | high for C |
| `nav.js` (prev/next) | literal legacy pattern, raw | helper | helper | low |
| `related.js` / `related-score.js` | `post.url`; images by folder | helper; images by folder | same | low |
| `discovery.js` `route.story` | `post.url`, raw | helper | helper | low |
| `entities/hubs.js` `articleUrl` | **throws** unless the path is the legacy pattern | accept `/stories/` | same | medium |
| `entities/associations.json` | evidence paths and line numbers in `blog-entries/<id>/` | none (sources stay in the folder) | none if folders stay | low |
| `author-pages.js`, `authors-page.js` | literal legacy pattern, raw | helper | helper | low |
| `body-links.js` | encoded and decoded legacy forms | accept story links | same | medium |
| `index.js`, `home-panels.js` | hero href encoded; panels compare `post.url` to the legacy pattern | helper | helper | low |
| `blog-index-data.json` + `blog-index.js` | browser builds the href from the id row | add the URL to the row | same | medium |
| `home-latest.json` | `slug` field holds the folder id | rename before adding slugs | same | medium |
| `scripts/analytics.js` | page type = path contains `/blog-module/blog-entries/` | add `/stories/` | same | low; silent data loss if missed |
| `validate-public-artifact.mjs` | route rule, JSON-LD article path regex, sitemap, hero link, published-URL set | accept story routes; check slugs | plus redirect map | medium |
| `validate-data-contracts.mjs` | article path and GUID = canonical | accept story routes | legacy GUID rule | medium |
| `public-artifact.mjs`, `article-scope.mjs`, `stamp-html.mjs` | copy and stamp `blog-entries/*/article.html` | also `stories/*/index.html` | same | medium |
| author tool (`generate-page.js`) | folder = date + author code, `-N` on collision | slug field, uniqueness check, preview | none | medium |
| housekeeping tool | keeps the folder; date and author read-only | freeze the slug after publication too | same | low |
| `404.html` / GitHub Pages | plain 404, no fallback | none | needs proxy or other host for 301s | **blocking for C** |
| Search Console | no data in the repository | baseline before launch | coverage and canonical baseline first | blocking for C |

## Prerequisites

Worth doing under A (each its own approved PR): freeze published folder ids in the housekeeping tool; percent-encode
the sitemap `loc`; decide the `20260227Τ` duplicate; decide whether scheduled articles may reach main.

Before B: one URL helper used by every producer in the matrix; slug field (not named `slug` while `home-latest.json`
uses it), author-tool assignment and uniqueness, frozen after publication; absolute asset URLs; validator, analytics
and artifact support for `/stories/`; a Search Console baseline.

Before C, in addition: real 301s (proxy or new host), a reviewed redirect map, legacy GUIDs, a Search Console coverage
and canonical export, and a rollback plan.

## Search Console observation checkpoint

Checkpoint, not deadline: 2–4 weeks after the 2026-10-25 tool consolidation (about 2026-11-08 to 2026-11-22). Export
from Search Console:

- indexed and not-indexed article URLs, with reasons;
- "Duplicate, Google chose different canonical than user" (especially `20260227Τ` / `20260222T`);
- impressions and clicks for article pages, by URL;
- crawl errors for `/blog-module/blog-entries/` paths.

Revisit this document with that data. Without it the status stays KEEP / DEFER.

## Rollback

- A: nothing to roll back.
- B: a published `/stories/` URL cannot be withdrawn without breaking it; the rollback is to stop assigning slugs. Pages
  already published keep their URLs.
- C: with a proxy, remove the rules and restore the legacy canonicals. Without real redirects, partial rollback leaves
  two URL sets; this is why C requires a proxy or host first.

## Approval before any migration

The owner approves, in writing and in a dedicated PR: the status change; the slug field and rules; the hosting change
(C); the redirect map (C); and the checkpoint data the decision rests on. Until then the contract tests keep every
article at its legacy URL and nothing at `/stories/`.

## Non-goals

No URL, canonical, title, date, text, JSON-LD, author, entity, sitemap, RSS, search, related, image, CSS, browser
JavaScript, tool or deployment change; no `/stories/` pages; no redirects or stubs; no `robots.txt` change; no new
hosting or dependency; no production slug generator.
