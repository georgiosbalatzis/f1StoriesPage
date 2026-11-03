# Race weekend reader gateway (A-04)

Status: A-04 technical foundation, draft PR; base `c0b643a9f` (2026-11-03). **No gateway is approved or published.** The
two pilots in the manifest are `draft` with `review.status: "pending"` ([pilots](#pilot-proposals)). Merging this
foundation does not make the gateway live; only an approved record does.

A gateway is a short, human-written reading guide at the top of an existing GP Hub (`/race-desk/gp/<raceId>/`). It helps a
reader find their way through the hub from three fixed reading perspectives:

| Perspective | Reader question | May point to |
| --- | --- | --- |
| **Πριν από τον αγώνα** | What context helps before this race? | associated articles; schedule, stories and sources sections; TYRES (a preview) |
| **Το αγωνιστικό τριήμερο** | Where are the sessions, results and tools? | schedule and results sections; any Race Desk tool |
| **Μετά τον αγώνα** | What evidence and analysis explain what happened? | associated articles; results, timeline, pace, stories and sources sections; any Race Desk tool |

The perspectives are reading perspectives, not a statement about the race's state. The gateway never computes or prints
whether a session is upcoming, live or finished, and it renders the same way for a race from last season.

## Ownership: Race Desk stays authoritative

The GP Hub remains the single page for a registered Grand Prix. A-04 adds no route, race registry, schedule, results
resolver, cache, fetch or source registry. The gateway stores **editorial choices only** (copy, which existing resources,
in which order). Every URL, title, date, tool context and availability is resolved at build time from the existing Race
Desk model:

| Gateway shows | Comes from |
| --- | --- |
| Race identity, hub path | [registry](../../data/race-desk/registry.v1.json) via `createPublicationModels` and `PUBLIC_RACE_IDS` ([hub-publication](../../scripts/race-desk/hub-publication.mjs)) |
| Article title, URL, date | the R-05 editorial selection ([race-desk-editorial](../race-desk-editorial.md)) for that exact `raceId` |
| Tool URL, label, exact / partial / generic note | the hub model's `tools`, from `planToolLink` ([link contract](../race-desk-links.md)); the note is the same `toolNote` the tools section prints |
| Section availability | the validated schedule, results, timeline, pace and stories contexts already rendered on the hub |

No schedule or result table is repeated. Existing sections, their numbering, provenance statements, tools, stories,
sources, the homepage GP discovery block, the sitemap and canonicals are unchanged.

## Source and schema

Source of truth: [`data/audience/race-gateways.v1.json`](../../data/audience/race-gateways.v1.json), build input only
(`data/audience/` is never copied to `dist/`).

```json
{
  "version": 1,
  "gateways": [{
    "raceId": "2026-singapore-gp",
    "status": "draft | published | retired",
    "title": "Greek headline (≤90)",
    "intro": "one or two sentences (≤280)",
    "perspectives": [
      { "kind": "before | weekend | after", "text": "human-written context (≤320)", "links": [
        { "ref": "article", "articleId": "20261008J" },
        { "ref": "section", "section": "schedule | results | timeline | pace | stories | sources" },
        { "ref": "tool", "target": "grid | telemetry | ghostcar | tyres", "kind": "exact | partial | generic" }
      ] }
    ],
    "revised": "YYYY-MM-DD",
    "review": { "status": "pending" },
    "retired": { "date": "YYYY-MM-DD", "reason": "…" }
  }]
}
```

- Strict keys at every level; strings are checked as stored (no trimming), without surrounding whitespace or control
  characters; limits are JavaScript string lengths.
- `raceId` must exist in the validated registry and is unique across every record, retired ones included.
- `perspectives`: 1–3, in the order before → weekend → after, each kind at most once; 1–5 links each, no duplicate
  link within a perspective (a tool is identified by its target). The table above is enforced per perspective.
- An `article` link requires an existing R-05 association of that article with that race. A historical mention, shared tag
  or entity is never enough; a new association goes through the [R-05 procedure](../race-desk-editorial.md#associating-a-new-article) first.
- A `tool` link records the **approved expectation** of the planner result. If the planner later returns a different kind,
  the gateway is withheld, so a link approved as race-specific can never silently become generic (or the reverse).
- Approved review: `{ "status": "approved", "kind": "human", "by", "date" ≥ revised, "contentSha256" }`, the SHA-256 of the
  compact JSON of `raceId, title, intro, perspectives (kind, text, links), revised`. Any change to the copy, the order of
  links, a tool expectation or `revised` needs a new review. Print it with
  `npm run gateways:validate -- --digest <raceId>`.
- `retired` is present if and only if `status` is `retired`.

## Approval procedure

1. An editor adds or edits a gateway as `draft` / `pending`, bumps `revised`, opens a PR. CI validates the structure.
2. The reviewer opens the generated hub, reads every linked article and section, and checks each sentence against them:
   no result, interpretation or claim the linked evidence does not show; no time-relative wording (σήμερα, τώρα, ζωντανά,
   σε εξέλιξη); betting previews and opinion pieces named as such; editorial interpretation kept apart from recorded
   observations.
3. To publish, the reviewer records **their own** approval: `status: "published"` and an approved `review` with their name,
   the real date and the printed digest. Agents never record approvals. An R-05 association clearance, an A-02 collection
   or A-03 journey approval does not approve gateway copy, order or interpretation.
4. `npm run gateways:validate -- --strict` must pass (it fails when a `published` gateway would be withheld). The same PR
   commits the rebuilt hub `index.html` (tracked; `build:check` fails otherwise).
5. Merge and deployment follow the normal reviewed process.

## Publication eligibility (fail closed)

**Structural errors stop the build:** schema, limits, duplicates, an unknown `raceId`, invalid dates, partial approvals,
review dated before `revised`, perspective order, links not allowed in a perspective, an article link without an R-05
association. An invalid R-05 selection still stops the build exactly as before; the gateway never substitutes an empty
selection. Retired records keep strict schema validation and reserve their race, but their links are not resolved.

**Otherwise the whole gateway is withheld** (never partially shown) unless, on the build's Athens publication day, all of
these hold. Reason codes, in this order:

| Code | Withheld when |
| --- | --- |
| `status` | not `published` |
| `approval` | review pending |
| `approval-date` | review dated after today |
| `digest` | content digest does not match |
| `revised` | `revised` is after today |
| `hub` | the race is registered but has no published GP Hub |
| `evidence` | a linked section has no available evidence (no sessions; no available classification; timeline or pace not `available`; no curated stories), or a linked article is not in the race's current selection |
| `tool` | the tool's planned kind differs from the approved expectation, or its URL is unsafe |

`today` is captured once per build and also gives the default build year. Scheduled deployments omit a withheld gateway;
CI fails the PR that broke a published one (`--strict`).

## On the hub

One `<section class="race-desk-section race-desk-gateway">` directly after the hero, before «01 / ΠΡΟΓΡΑΜΜΑ»:

- kicker «ΟΔΗΓΟΣ ΑΝΑΓΝΩΣΗΣ» (unnumbered, so the existing 01–07 numbering is unchanged), the headline (h2) and intro;
- per approved perspective: its fixed heading (h3), the human text and a short list of links. Article links show the
  original title and publication date; section links name the existing section heading and say it is on this page; tool
  links use the product name and the exact note the tools section prints (e.g. «Γενική προβολή · επίλεξε αγώνα μέσα στο
  εργαλείο.», and for TYRES «Προεπισκόπηση TYRES, όχι μετρημένα αποτελέσματα αγώνα.»);
- a fixed closing line: the guide is editorial, states nothing about the race's current state, and each section below
  carries its own evidence and sources; and, when fewer than three perspectives are approved, a line saying the guide
  covers only the perspectives with approved content. An empty perspective is omitted, never filled.

Section links target the section element (`#gateway-target-<section>`), which already clears the fixed navigation
(`.editorial-page section { scroll-margin-top }`). Those ids are added only on a hub with an eligible gateway, and only to
the referenced sections. It reuses existing Race Desk classes: no CSS, JavaScript, images, storage or cookies were added.
It works with JavaScript disabled; headings stay h1 → h2 → h3; links are descriptive; product names carry `lang="en"`.

## Build integration

`writeRaceDeskHubs` (the existing single writer, called by `build:blog` and standalone by
`node scripts/build/race-desk-hubs.mjs`) prepares the hub models, selects gateways **before preparing any page**, and
passes each eligible view to `renderHub`. A structural error therefore writes nothing. The homepage GP discovery marker is
written by the same pass, unchanged. With no eligible gateway every generated file is byte-identical to the base.

`validateHubOutput` runs on the source tree (`build:data-contracts`) and on the real `dist/` (`validate-public-artifact`,
with the published article pages as the public root). It requires the gateway section exactly as rendered from the
approved selection, in its place, with exactly the referenced target ids, and none of either elsewhere; it scopes the
existing tool-plan checks to the tools section, so a gateway link cannot stand in for a missing tool link; and it checks
that no gateway internals leak (manifest path, `"contentSha256"`, approval digests).

Commands: `npm run test:gateways`, `npm run gateways:validate [-- --strict | --digest <raceId> | --day YYYY-MM-DD]`.

## Removal and rollback

- **Withdraw a gateway:** `status: "retired"` with a `retired` block (the record keeps the race reserved). The next build
  removes the section and the target ids; the hub returns byte for byte to its no-gateway form.
- **Evidence or a tool changes:** the gateway is withheld with a reason code until an editor edits it and a reviewer
  re-approves. An unpublished associated article stops the R-05 selection, as it always did.
- **Remove the feature:** hub pages are tracked generated output. While no gateway has ever been published, reverting the
  A-04 merge commit is enough. Otherwise first retire every published gateway and commit the rebuilt hubs, then revert.
  Hub URLs and homepage discovery are unaffected either way.

## Measurement

No event, parameter, dimension, model, query, identifier, cookie or storage is added ([A-01 contract](measurement-contract.md)).

| Question | Existing source | Label |
| --- | --- | --- |
| Race-weekend activity ([KPI 6](measurement-contract.md#6-race-weekend-behaviour)) | Daily site totals in a registry session window; no race dimension | `PROXY_ONLY` |
| Hub → article / tool clicks ([KPI 14](measurement-contract.md#14-article-to-race-desk-navigation)) | Gateway links are plain anchors. Article and tool links (all on `f1-stories.gr`, the tools through their existing routes) are recorded by the existing consented `internal_page_click` as `link_section=page` from the hub path, not separable from the same link elsewhere on the hub; in-page section links are not recorded | `PROXY_ONLY` (aggregate); per gateway `NOT_VERIFIED` |
| Tool use, successful loads, returning readers, finishing a perspective | None. A click is intent; child tools are outside the main property; no visitor identity | `NOT_MEASURABLE` |
| Performance guardrail ([KPI 15](measurement-contract.md#15-core-web-vitals-guardrails)) | GP hubs have no RUM emitter; lab measurement only | `NOT_MEASURABLE` in the field |

Any future measurement change needs its own proposal and privacy review. Feature acceptance (approved, accessible,
correct) is separate from any claim of audience impact.

## Editorial maintenance

The editorial owner owns the manifest and every approval. Race Desk owns identity, evidence, tools and the hub. A Race
Desk change that alters a linked section's availability or a tool's kind withholds the gateway automatically; the next
editorial pass re-approves or retires it. Nothing changes a gateway's copy automatically.

## Pilot proposals

Both are `draft` / `pending` in the manifest. They are proposals for the owner to approve, edit or reject; this PR approves
nothing. Evidence verified on base `c0b643a9f` with the build of 2026-11-03.

### 1. Singapore Grand Prix 2026 — `2026-singapore-gp`

- **Identity:** registered, published GP Hub (`/race-desk/gp/2026-singapore-gp/`), round 17, a Sprint weekend; official
  schedule evidence read 2026-10-31.
- **Evidence on the hub:** recorded schedule; Jolpica race, qualifying and Sprint classifications and championship
  snapshots; OpenF1 race timeline (partial coverage); pace and stints (partial coverage, lap sample unsuitable for pace
  comparison — the section says so); two R-05 associated articles.
- **Tools:** THE GRID exact (round 17 embed), TYRES exact (`2026/marina-bay`), TELEMETRY and GHOST CAR generic (not linked
  by the pilot).
- **Headline:** «Singapore Grand Prix 2026: πριν, κατά τη διάρκεια και μετά».
- **Before:** `20261008J` GRIDCAST #02 (preview analysis of the circuit and the Sprint weekend); TYRES (exact, preview).
- **Weekend:** schedule, results sections; THE GRID (exact).
- **After:** results, timeline, pace sections; `20261012W` (the editorial's race analysis, presented as interpretation).
- **Limits:** the copy restates no result or lap statistic, so evidence changes cannot make it stale; the timeline and
  pace sections carry their own coverage qualifications.

### 2. Mexico City Grand Prix 2026 — `2026-mexican-gp` (narrower)

- **Identity:** registered, published GP Hub (`/race-desk/gp/2026-mexican-gp/`); official schedule evidence read
  2026-10-31.
- **Evidence on the hub:** recorded schedule only. Results are unmapped, the timeline and pace have no approved source
  mapping, and THE GRID is generic. One R-05 association: `20261031J`, BetCast #278, a betting preview written after FP2.
- **Proposal:** **before** and **weekend** only; no «Μετά τον αγώνα» perspective, because there is no recorded result,
  timeline, pace or post-race article to point to. The hub states the guide covers only approved perspectives.
- **Before:** `20261031J`, named in the copy as a betting article with the editorial's picks, not a result or verified
  prediction; TYRES (exact, preview).
- **Weekend:** schedule section; THE GRID (generic, labelled as such).
- **Limits:** a single article is not weekend coverage; the pilot does not claim it is.

### Owner decisions

1. Approve, edit or reject each pilot (copy, links, order). Approval is the owner's own `review` record in a separate PR.
2. Whether Mexico should publish in its reduced form or wait for results/timeline evidence.
3. Whether a GP-hub section class for analytics is wanted later (a separate, privacy-reviewed proposal).
