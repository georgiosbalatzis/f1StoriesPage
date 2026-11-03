# Article reading journeys (A-03)

Status: A-03 foundation, draft PR; base `a62152d68` (2026-11-03). **No journey is approved or published.** The two pilots
in the manifest are `draft` with `review.status: "pending"` ([pilots](#pilot-proposals)).

A reading journey is a short, explicitly curated series of already-published articles meant to be read in order: a
multi-part analysis, or a story told across several pieces. Each member article shows where it sits in the series and why
the next part follows. It is not a recommendation: membership and order are written and approved by a person. It does not
replace NEXT UP, the prev/next band, topic links, body links, entity hubs or [collections](collections.md), and it never
changes an article's body, metadata, canonical or URL.

| | Collection (A-02) | Journey (A-03) |
| --- | --- | --- |
| Where | its own page | inside each member article |
| Size | 3–12 articles | 2–6 articles |
| Reader question | "what is there to read on this theme?" | "what do I read next, and why?" |

## Source and schema

Source of truth: [`data/audience/reading-journeys.v1.json`](../../data/audience/reading-journeys.v1.json), build input only
(`data/audience/` is never copied to `dist/`).

```json
{
  "version": 1,
  "journeys": [{
    "slug": "ascii-kebab-case",
    "status": "draft | published | retired",
    "title": "Greek title (≤90)",
    "description": "why read these in this order (≤200)",
    "steps": [
      { "position": 1, "articleId": "20250424-2G", "transition": "why the next step follows (≤240)" },
      { "position": 2, "articleId": "20250506G" }
    ],
    "revised": "YYYY-MM-DD",
    "review": { "status": "pending" },
    "retired": { "date": "YYYY-MM-DD", "reason": "…" }
  }]
}
```

- Strict keys at every level; strings without surrounding whitespace or control characters.
- `slug` ASCII kebab case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤60), unique across every record, retired ones included (a
  retired slug is never reused).
- `retired` is present if and only if `status` is `retired`.
- `steps`: 2–6; `position` runs 1..n in array order; `articleId` is a canonical article id (path-safe), unique within the
  journey. Every step except the last has a `transition`; the last has none. Six is the ceiling because the component lists
  the whole series at the end of an article; a longer series should be split.
- An article may belong to **at most one `published` journey** (drafts may overlap). Two published journeys sharing an
  article stop the build: the editor resolves the overlap before publishing; nothing is chosen by file order.
- Approved review: `{ "status": "approved", "kind": "human", "by", "date" ≥ revised, "contentSha256" }`, the SHA-256 of the
  compact JSON of `slug, title, description, steps (position, articleId, transition), revised`. Any wording or order change
  needs a new review. Print it with `npm run journeys:validate -- --digest <slug>`.

## Approval procedure

1. An editor adds or edits a journey as `draft` / `pending`, bumps `revised`, opens a PR. CI validates the structure.
2. The reviewer reads the member articles in order and checks each transition sentence against the articles.
3. To publish, the reviewer records **their own** approval: `status: "published"` and an approved `review` with their name,
   the real date and the printed digest. Agents never record approvals; no approval is inherited from a collection, hub or
   article review.
4. `npm run journeys:validate -- --strict` must pass (it fails when a `published` journey would be withheld). The same PR
   commits the rebuilt member `article.html` files; `build:check` fails otherwise.
5. Merge and deployment follow the normal reviewed process.

## Publication eligibility (fail closed)

Structural errors stop the build (schema, duplicates, unknown or retired article ids — the message names the surviving
article, never substituted — invalid dates, partial approvals, transition rules, overlapping published journeys).

Otherwise a journey appears only when, on the build's Athens publication day: it is `published`; approved by a named human,
dated no later than today; the digest matches; `revised` is not in the future; and **every** member is a published,
indexable, self-canonical article. If any member fails, the whole journey is withheld everywhere; a series never shrinks
silently. Scheduled deployments omit a withheld journey; CI fails the PR that broke a published one.

## In the article

One component, placed at the end of the article text, before the author/share band (`rr-pitwall`), only on member articles
of an eligible journey:

- label «Ανάγνωση με σειρά · Μέρος N από M» (editorial position, not reader progress);
- the journey title (h2) and description;
- the whole series as an ordered list: the other parts are links, the current one is marked `aria-current="step"`;
- «Επόμενο: …» with the authored transition, or «Τέλος της σειράς.» on the last part.

It reuses the article text column, typography and both themes; no CSS, JavaScript, images, storage or cookies were added,
and the article template is unchanged. A reader landing on a middle part from search sees the whole series and its position.
The sector bar stops at the component (`data-article-end`).

## Build integration

`build:blog` selects journeys with the same publication day as hubs and collections and, after the article pages, NEXT UP,
topic links and the prev/next band are written, inserts or replaces the component in each member's `article.html` between
`<!-- f1s:journey:begin -->` and `<!-- f1s:journey:end -->`. The same pass walks every `article.html` on disk and strips a
stale component, so a withdrawn journey disappears on the next build. Files are written only when they change. With no
eligible journey the public artifact is byte-identical to the base.

A region is recognised only directly before the real pit-wall tag (located with the shared HTML tokenizer), so marker or
pit-wall strings inside comments, scripts or textareas are left alone. Every separator sits inside the markers: removing
the region restores the page byte for byte.

`validate-public-artifact` checks the actual `dist/`, after stamping: the component appears exactly once on each eligible
member and nowhere else (any marker string on a non-member fails, so the check errs towards a false alarm); inside it, n
list entries, n−1 links in authored order (whole URLs), one current step in the right place, the right wording; the
region is byte-identical to the renderer's output for the approved selection; every member is a published, direct,
indexable article.

Commands: `npm run test:journeys`, `npm run journeys:validate [-- --strict | --digest <slug>]`.

## Removal and rollback

- **Withdraw a journey:** `status: "retired"` with a `retired` block (keep the record; it reserves the slug). The next build
  removes the component from every member.
- **A member must go:** if it is unpublished or noindexed, the journey is withheld until an editor edits it and a reviewer
  re-approves. If the article is retired (listed in the retired-articles map), the build stops with a structural error
  naming the surviving article, so the editor must edit the journey in the same change.
- **Remove the feature:** member `article.html` files are tracked generated output (`build:check` covers them). While no
  journey has ever been published, reverting the A-03 merge commit is enough. Otherwise first retire every published
  journey and commit the rebuilt pages (the strip pass removes the regions), then revert: after the revert nothing strips
  a region left in a tracked page.

## Measurement

No event, parameter, dimension, model, query, identifier or storage is added ([A-01 contract](measurement-contract.md)).

| Question | Existing source | Label |
| --- | --- | --- |
| Clicks from a journey to the next part ([KPI 3](measurement-contract.md#3-article-to-article-discovery)) | Journey links are plain anchors: the existing consented `internal_page_click` records them as `link_section=page`, article source → article destination, not separable from other article→article clicks | `PROXY_ONLY` (aggregate); per journey `NOT_VERIFIED` |
| Sequence progression, completion, readers who finish a series ([KPI 5](measurement-contract.md#5-reading-paths)) | None; clicks are intent, not loads; no visitor joins or stored progress | `NOT_MEASURABLE` |
| Performance guardrail ([KPI 15](measurement-contract.md#15-core-web-vitals-guardrails)) | Article RUM, no per-journey split | `PROXY_ONLY` |

Feature acceptance (approved, accessible, correct) is separate from any claim of audience impact.

## Pilot proposals

Both `draft` / `pending`. Agent research proposals, **not approvals**. Members checked on 2026-11-03 against the
current article pages: published, indexable, self-canonical, not retired.

### 1. «McLaren MCL39 σε τέσσερα μέρη» — `mclaren-mcl39-se-tessera-meri`

The author's own four-part technical analysis (each title carries «Μέρος n/4»).

| # | Article | Published | Transition to the next part |
| --- | --- | --- | --- |
| 1 | [20250424-2G](https://f1-stories.gr/blog-module/blog-entries/20250424-2G/article.html) Τεχνική Ανάλυση Υψηλής Ακρίβειας (1/4) | 2025-04-24 | engine integration and packaging |
| 2 | [20250506G](https://f1-stories.gr/blog-module/blog-entries/20250506G/article.html) Ενσωμάτωση Κινητήρα & Συσκευασία (2/4) | 2025-05-06 | suspension and chassis behaviour |
| 3 | [20250508-3G](https://f1-stories.gr/blog-module/blog-entries/20250508-3G/article.html) Ανάρτηση, Σασί & Μηχανική Συμπεριφορά (3/4) | 2025-05-08 | brakes, cockpit, in-season development |
| 4 | [20250514-1G](https://f1-stories.gr/blog-module/blog-entries/20250514-1G/article.html) Φρένα, Cockpit & Εξέλιξη Σεζόν (4/4) | 2025-05-14 | (end) |

Value beyond NEXT UP: today **no part links to any other part**. On all four pages NEXT UP shows the same three other
McLaren pieces (20250522G, 20250510-1G, 20250507-1G) and the prev/next band follows site chronology. Overlap with A-02
collections: none. Concerns: the related brake-cooling piece 20250522G (2025-05-22) is a separate article, not part 5;
the owner should confirm the series is complete as published.

### 2. «Antonelli 2026: από την απόρριψη στον τίτλο» — `antonelli-2026-apo-tin-aporripsi-ston-titlo`

Six pieces by several authors that followed Kimi Antonelli's 2026, in publication order; the last explicitly refers back to
the first («Είχαμε γράψει σε προηγούμενο άρθρο … πώς τον «άφησε η Ferrari»»).

| # | Article | Published | Transition to the next part |
| --- | --- | --- | --- |
| 1 | [20260331J](https://f1-stories.gr/blog-module/blog-entries/20260331J/article.html) Ένας Ιταλός … που απορρίφθηκε από τη Ferrari | 2026-03-31 | Canada, when he stopped being «the future» |
| 2 | [20260525W](https://f1-stories.gr/blog-module/blog-entries/20260525W/article.html) Η στιγμή που ο Αντονέλι έπαψε να είναι «το μέλλον» | 2026-05-25 | Barcelona as the first big test |
| 3 | [20260614W](https://f1-stories.gr/blog-module/blog-entries/20260614W/article.html) Η Βαρκελώνη δεν ήταν ήττα | 2026-06-14 | the Silverstone answer against Hamilton |
| 4 | [20260704W](https://f1-stories.gr/blog-module/blog-entries/20260704W/article.html) Ο νέος κυρίαρχος της F1 | 2026-07-04 | a look back to the Monza 2024 debut |
| 5 | [20260803W](https://f1-stories.gr/blog-module/blog-entries/20260803W/article.html) Η αρχή είναι το ήμισυ του παντός; | 2026-08-03 | the end of the story that began with Ferrari's rejection |
| 6 | [20261102J](https://f1-stories.gr/blog-module/blog-entries/20261102J/article.html) «Είναι πολύ μικρός»… Τώρα είναι ο πρωταθλητής! | 2026-11-02 | (end) |

Value beyond NEXT UP: the first article's NEXT UP links none of the others, and where NEXT UP does link the pieces it is
in score order, not story order. Overlap with A-02 collections: none. Concerns: part 5 is a flashback (Monza 2024) placed
by publication date; part 3 is an informal first-person piece; the owner should confirm the tone fits a curated series.
