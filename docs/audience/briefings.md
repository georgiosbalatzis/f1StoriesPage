# Weekly briefing (A-05)

Status: A-05 technical foundation; base `5caa70031` (2026-11-03). **No edition is approved or published.** The two
candidate editions in the manifest are `draft` with `review.status: "pending"` ([candidates](#candidate-editions)).
Merging the foundation publishes nothing; only an approved edition does. The [readiness gate](readiness-gates.md#a-05--weekly-briefing-editorial-foundation)
defines scope and GO / NO-GO.

A weekly briefing is a human-written editorial edition for one ISO week: an opening, ordered sections of selected
published articles, a written reason for every article and an optional closing. It answers *what happened, what matters,
and what should an F1 Stories reader understand this week*. It is **not** a digest of every article, not an RSS
replacement and **not a newsletter**: there is no signup, subscriber list, email, provider or unsubscribe. The
[content exports](#content-exports) are content only, kept for a later, separately approved A-06/A-07.

| | Collection (A-02) | Briefing (A-05) |
| --- | --- | --- |
| Unit | a theme, timeless | one ISO week |
| Structure | one ordered list | opening, ordered sections, closing |
| Route | `/blog-module/blog/collections/<slug>/` | `/blog-module/blog/briefing/<id>/` |

## Source and schema

Source of truth: [`data/audience/briefings.v1.json`](../../data/audience/briefings.v1.json), build input only
(`data/audience/` is never copied to `dist/`). It holds editorial text and choices only; article title, author, date and
URL always come from the article's own metadata and public page.

```json
{
  "version": 1,
  "editions": [{
    "id": "2026-w44",
    "status": "draft | published | retired",
    "title": "Greek title (≤90)",
    "description": "deck and meta description (≤160)",
    "opening": ["1–3 paragraphs (≤700 each)"],
    "sections": [
      { "heading": "≤80", "intro": "optional (≤400)", "items": [
        { "articleId": "20261029G", "rationale": "why this article, human-written (≤320)" },
        { "articleId": "20250424-2G", "rationale": "…", "context": true }
      ] }
    ],
    "closing": ["optional, 1–2 paragraphs (≤500 each)"],
    "revised": "YYYY-MM-DD",
    "review": { "status": "pending" },
    "retired": { "date": "YYYY-MM-DD", "reason": "…" }
  }]
}
```

- **Edition id** = ISO-8601 week, `YYYY-wNN` (two digits). The week runs Monday–Sunday and is read as Athens calendar
  days: `2026-w44` = 26 October – 1 November 2026. Year boundaries follow ISO rules: `2026-w53` exists
  (28 December 2026 – 3 January 2027) and `2027-w01` starts on 4 January 2027. Ids are unique across every record,
  retired ones included, and never reused.
- 1–6 sections, 1–6 articles each, 2–15 in total; an article appears at most once per edition (it may appear in other
  editions). Every article has a written `rationale`.
- **Dates:** an article published inside the week is ordinary. An older article may be included only with
  `"context": true` (exactly `true`) and a rationale that says why; it is labelled «Για αναδρομή». An article published
  after the week, or `context` on an in-week article, is a structural error. Membership is never derived from tags,
  categories, titles or the week itself.
- Strict keys at every level; strings checked as stored (no trimming), without surrounding whitespace or control
  characters; limits are JavaScript string lengths; optional fields, when present, must be non-empty.

## Approval and digest

An approved review is `{ "status": "approved", "kind": "human", "by", "date", "contentSha256" }`:

- `date` on or after `revised` **and** after the week has ended (the following Monday or later); not in the future at
  build time.
- `contentSha256` = SHA-256 of the compact JSON of `id, title, description, opening, sections (heading, intro, items
  (articleId, rationale, context)), closing, revised`, rebuilt in that key order, absent optionals omitted, text exactly
  as stored. Any change to the title, description, opening, a section, membership, order, a rationale, a context flag or
  the closing needs a new review. Article titles and authors are not part of the digest: they stay the article's current
  metadata. Print it with `npm run briefings:validate -- --digest <id>`.

Procedure:

1. An editor writes or edits an edition as `draft` / `pending`, bumps `revised` and opens a PR. CI validates structure.
2. The reviewer reads every linked article and checks each sentence of the opening, rationales and closing against them.
   No result, quote, statistic, ranking or claim that the linked articles do not support; betting and opinion pieces named
   as such; no audience or popularity claims.
3. To publish, the reviewer records **their own** approval (`status: "published"`, their name, the real date, the printed
   digest). Agents never record approvals; an approval of a collection, journey, gateway or article is not an approval of
   an edition.
4. `npm run briefings:validate -- --strict` must pass. The same PR commits the rebuilt generated pages under
   `blog-module/blog/briefing/` and the edition index; `build:check` fails otherwise.
5. Merge and deployment follow the normal reviewed process.

## Publication eligibility (fail closed)

**Structural errors stop the build:** schema, limits, duplicates, invalid ISO week, dates, partial approval, approval-date
rules, unknown or retired article (the message names the surviving article; it is never substituted), date/context rules.
Retired editions keep schema validation and reserve their id, but their articles are not resolved.

**Otherwise the whole edition is withheld** unless, on the build's Athens publication day, all hold. Reason codes, in order:

| Code | Withheld when |
| --- | --- |
| `status` | not `published` |
| `approval` | review pending |
| `approval-date` | review dated after today |
| `digest` | content digest does not match |
| `revised` | `revised` is after today |
| `member` | any article is future-dated, unreleased, or its page is missing, not self-canonical, noindex, or a redirect |

One `today` is used for selection, page generation, the public-artifact allowlist and validation: `build:blog` records
the Athens day it generated with in the ignored `.build/briefings/publication-day`, and the later `build:public` stages
(separate processes) reuse it, so a build that crosses midnight stays consistent.

## Public pages

Only eligible editions produce output, and with none there is nothing at all: no archive, no aside link, no sitemap URL;
the public artifact is byte-identical to the base (all paths and SHA-256).

- **Edition** `/blog-module/blog/briefing/<id>/`: kicker «F1 STORIES — WEEKLY BRIEFING», one H1, the week
  («Εβδομάδα 44 · 26 Οκτωβρίου – 1 Νοεμβρίου 2026»), opening, each section as h2 with an ordered list of article rows
  (original title linked to its canonical URL, author and date from the article, the rationale above the meta line),
  closing. Breadcrumbs Αρχική / Άρθρα / Εβδομαδιαία ενημέρωση / edition. Canonical, Open Graph and JSON-LD
  (BreadcrumbList, ItemList of all articles in reading order, CollectionPage). Sitemap entry with `lastmod` = the latest
  valid date among revision, approval and member publication.
- **Archive** `/blog-module/blog/briefing/`: eligible editions, newest first, with week and description.
- **Discovery:** one aside block on the Edition front («Εβδομαδιαία ενημέρωση»: all editions, newest edition), only while
  at least one edition is eligible. feed.xml, search, homepage panels and NEXT UP are unchanged.
- Existing classes and the standard site shell only: no new CSS, JavaScript, images, forms or storage; works without
  JavaScript. The shell is the same as on collections and topic hubs (consent-gated analytics, consent banner, shared
  navigation); A-05 adds no event, parameter, cookie or storage.

## Content exports

`npm run briefings:export -- --id <id> [--out <dir>]` writes `edition.html` and `edition.txt` from one normalised
document, so both carry the same text in the same order:

- title, week, opening, section headings and intros, for each article its title, author, date, rationale and absolute
  canonical HTTPS URL, closing;
- HTML: a minimal complete document (`<!doctype html>`, `lang="el"`, UTF-8, title) so it opens correctly on its own,
  with headings, paragraphs, ordered lists and links only; escaped; no scripts, styles, images,
  forms, tracking or provider or unsubscribe placeholders;
- text: UTF-8, LF line endings, same reading order, links written out;
- an edition that is not eligible is marked «ΠΡΟΣΧΕΔΙΟ — δεν έχει εγκριθεί για δημοσίευση» at the top of both files.

Exports are content only, not send-ready email. They are written to a new directory that must resolve outside the repository, symlinks and `TMPDIR` included
(default: a fresh temporary directory), never over an existing file, never into `dist/`. Only editions whose sole blockers are
`status`, `approval` or `digest` (or eligible ones) can be exported; retired editions cannot. Nothing is sent anywhere.

## Draft preview

`npm run briefings:preview [-- --build-only] [--id <id>]` (after `npm run build:public`) renders candidate editions with a
visible draft banner into a temporary directory and serves them on `127.0.0.1` only: GET/HEAD, `noindex` and `no-store`
headers, a disallow-all robots.txt, files served only from the temporary directory or `dist/` (real-path contained), and
analytics/consent scripts removed from preview pages. Candidates are the same as for exports. Nothing is written to the
repository or `dist/`.

`npm run briefings:validate [-- --strict | --digest <id>]` lists every edition with its eligibility and reason codes.
`npm run test:briefings` runs the suites (they also run in `test:blog` and CI).

## Build integration

`build:blog` selects briefings with the same Athens day as hubs, collections and journeys, after the article pages are
rendered, writes the eligible pages (and removes stale ones), adds the aside block and the sitemap pages. `stamp-html`
stamps the owned briefing pages like other discovery pages; the generated-drift guard tracks them;
`public-artifact` copies only the exact eligible files; `validate-public-artifact` checks the real `dist/`: exactly the
eligible files, sitemap URLs equal to them, visible and ItemList order equal to the selection, every member a direct
published story, discovery links into the archive only to approved pages, and no manifest internals.

## Withdrawal and rollback

- **Withdraw an edition:** `status: "retired"` with a `retired` block (the id stays reserved). The next build removes its
  page, archive row, aside link and sitemap URL; the archive disappears with the last eligible edition. Commit the rebuilt
  pages.
- **A linked article must go:** if it is unpublished, noindexed or redirected, the edition is withheld until edited and
  re-approved. If it is retired, the build stops with a structural error naming the surviving article.
- **Remove the feature:** while no edition has been published, revert the merge commit. Otherwise retire every edition,
  deploy, then revert. Article URLs and feed are unaffected.

## Measurement and privacy

No event, parameter, dimension, model, query, identifier, cookie, storage, email address, contact list, provider or form
is added ([A-01 contract](measurement-contract.md), [privacy data flow](privacy-data-flow.md)). The privacy page's
statement that the site has no newsletter remains true.

| Question | Existing source | Label |
| --- | --- | --- |
| Clicks from an edition to its articles ([KPI 3](measurement-contract.md#3-article-to-article-discovery)) | The reused article rows are classified by the existing consented `internal_page_click` as `link_section=article_link`, with `source_path` = the edition path; no existing model reports them per edition | `PROXY_ONLY` (aggregate); per edition `NOT_VERIFIED` |
| Engagement on linked articles ([KPI 2](measurement-contract.md#2-engaged-sessions-and-article-engagement)) | Article engagement events, not attributable to the edition | `PROXY_ONLY` |
| Reach, completion, returning readers, subscribers, opens, deliveries | None | `NOT_MEASURABLE` |
| Performance guardrail ([KPI 15](measurement-contract.md#15-core-web-vitals-guardrails)) | Lab measurement; field RUM only where the shell already emits it | `PROXY_ONLY` |

## A-06/A-07 handoff

A-07 may reuse an approved edition's content through the same document and exports. It must add, under its own approval:
independent newsletter consent and signup (A-06), subscriber storage and retention, a provider, delivery, unsubscribe,
issue approval and any email-specific markup. A-05 provides none of these and nothing in A-05 sends mail.

## Candidate editions

Both are `draft` / `pending` proposals for the owner to approve, edit or reject; this foundation approves nothing.
Verified against `blog-source-cache.json` and the article texts on base `5caa70031`.

### `2026-w43` — «Η εβδομάδα του Όστιν: σενάρια τίτλου και ιστορία»

- **Period:** 19–25 October 2026 (Grand Prix of the United States, COTA).
- **Thesis:** how the editorial team prepared the COTA weekend, plus history that gives it depth.
- **Order:** Πριν από το COTA — `20261022J` GridCast #02 (title scenario as the article states it), `20261024J`
  BetCast #277 (betting article, named as such), `20261023G` history of the US Grand Prix · Από το αρχείο —
  `20261020W` Ferrari 640 / F1-89, `20261021W` Olivier Panis, Monaco 1996.
- **Left out:** `20261019W` (Toyota, WEC) and non-F1 history pieces of the week, to keep the edition on Formula 1.
- **Open questions:** the COTA result is not covered by an in-week article, so the edition does not mention it.

### `2026-w44` — «Η εβδομάδα του Μεξικού: προετοιμασία, ρυθμός και αρχείο»

- **Period:** 26 October – 1 November 2026 (Grand Prix of Mexico on 1 November).
- **Thesis:** the build-up to Mexico, two analyses of how performance is read, two pieces from the archive.
- **Order:** Ο δρόμος προς το Μεξικό — `20261029G` GridCast #03, `20261031J` BetCast #278 (betting article) ·
  Ανάλυση — `20261031W` McLaren MCL40, `20261028W` Verstappen vs Ferrari points 2022–2023 · Από το αρχείο —
  `20261030W` Rosberg/Ricciardo, Singapore 2016, `20261027W` Heinz-Harald Frentzen.
- **Left out:** WRC and MotoGP pieces of the week; the race result and the championship articles were published on
  2 November (week 45), so the closing points to the next edition instead of restating a result.
- **Open questions:** `20261027W` states that Frentzen won two races in 1997; the owner should check the article before
  approving an edition that links it (the edition's rationale does not repeat the claim).

### Owner decisions

1. Approve, edit or reject each candidate (copy, membership, order), in a separate PR with your own review record.
2. Cadence and ownership of editions (every week, or only selected weeks).
3. Whether the Edition front aside should link the archive (implemented; appears only with an eligible edition).
4. When, if ever, A-06/A-07 start; A-05 does not decide it.
