# Canonical entity foundation (P1.1)

This is standalone, build-time editorial tooling. Neither the publisher nor browser imports it. It creates no pages, links, recommendations, metadata or public assets. The taxonomy API and compact article index are unchanged. There are no new dependencies or publishing steps.

```sh
npm run entities:validate
npm run entities:report
npm run --silent entities:report -- --json
node --test blog-module/build/__tests__/entities.test.js
```

Commands read committed article metadata/source and write only to stdout. The report has no clock, network access or file writes. Entity IDs, article IDs, tags and flags are sorted by code-point order. New matching articles appear as unresolved `not-yet-reviewed` candidates; they do not invalidate the existing manifest or acquire membership automatically.

## Data contract

`registry.json` contains exactly six initial identities. `id` is the permanent reference key; changing a name, sponsor, provider ID or display label must not change it. `type` and `slug` provide a future route key, not a public URL. `labelEl` is display copy, also pending editorial review. `providerIds` is optional: the four driver/constructor Jolpica IDs are present in `standings/standings-cache.json`; no event or circuit provider IDs have been guessed. No grid membership or event-to-venue relationships are stored.

Each alias has `value` and `scope`. Resolution requires whole-string equality after case/Unicode/whitespace/Greek-accent normalization; hyphens, underscores and Unicode dash separators are the only supported punctuation equivalence. Commas, periods and slashes are not stripped or split by the alias resolver. Candidate extraction reuses `getPostTaxonomy()` for the existing tag parsing contract.

- `article-tag`: explicitly named drivers, events or circuits.
- `f1-tag`: bare driver surnames and F1 team/legacy tags. Callers must request this scope explicitly. `McLaren history` is an individually registered legacy tag, not a general rule for extracting names from phrases.

The candidate scanner checks both tag scopes to build a review queue. A match in `f1-tag` does **not** assert the article's discipline. In particular, it cannot turn a brand in WEC, WRC or motorcycle coverage into an F1 constructor. It never examines body substrings, applies fuzzy spelling correction or uses current standings membership.

`associations.json` records one decision per `(articleId, entityId)`:

| Field | Meaning |
| --- | --- |
| `role` | Confirmed `primary`, `secondary`, `mention`, `excluded`, or `unresolved` |
| `proposedRole` | Agent proposal while review is pending; never confirmed membership |
| `review` | `pending`, or `approved` with `kind: human`, `by` and ISO calendar `date` |
| `discipline` | `f1`, `wec`, `wrc`, `motogp`, `other`, `mixed`, or `unknown`; supported by context, not merely a tag |
| `tags` | Exact metadata tags that raised the candidate; empty for a future manual association |
| `evidence` | Repository source path, 1-based line, exact quote and a role/context rationale |
| `flags` | Editorial questions; they do not create relationships or silently repair source claims |
| `substantive` | Human assessment required when confirming a primary/secondary subject |

The original 97 associations were seeded as unresolved agent proposals. **Six subject classifications now have explicit human approval; the remaining 91 retain `role: unresolved` and `review.status: pending`.** Historical factual claims have not been independently fact-checked. The validator verifies that evidence still occurs on the quoted source line; it cannot certify that the claim is true or that a reviewer identity represents a real approval.

To confirm an association, a human editor checks the source and context, selects `role`, adds their review identity/date and (for subjects) `substantive`. An exclusion is an explicit human decision and cannot be overridden by tag matching. Several primary/secondary subjects in one article are valid; two decisions for the same article/entity pair are not. Tag-only matches remain unresolved or become explicit exclusions after human review.

## Initial review queue

Counts are article/entity pairs, not distinct articles. Proposals are not confirmations. The detailed stdout report includes every article title/date, source line/quote, tags, proposal and editorial question.

| Entity | Candidates | Proposed primary | Proposed secondary | Proposed mention | Proposed excluded | Still undecided |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Lewis Hamilton | 10 | 3 | 3 | 2 | 2 | 0 |
| Lando Norris | 5 | 3 | 1 | 1 | 0 | 0 |
| Ferrari | 43 | 20 | 19 | 2 | 2 | 0 |
| McLaren | 31 | 16 | 7 | 6 | 1 | 1 |
| Singapore Grand Prix | 3 | 2 | 1 | 0 | 0 | 0 |
| Sepang International Circuit | 5 | 0 | 0 | 0 | 0 | 5 |

Confirmed primary/secondary counts are **1/1 for Hamilton** and **3/1 for Norris**; all other confirmed role counts are zero. All public hub approvals are pending; no reviewed introductions exist. Therefore **none is provisionally eligible**. Norris meets the subject-count/date criteria only; Hamilton has two qualifying subjects and does not meet the three-subject minimum.

## P1.1c human editorial approvals

Reviewer `georgiosbalatzis` explicitly authorized these six classifications on `2026-10-21`. Each has `review.status: approved`, `review.kind: human`, the reviewer/date above and `substantive: true`:

| Entity | Article | Role |
| --- | --- | --- |
| `driver:lewis-hamilton` | `20260608W` | `primary` |
| `driver:lewis-hamilton` | `20260929-2G` | `secondary` |
| `driver:lando-norris` | `20260725W` | `primary` |
| `driver:lando-norris` | `20260822W` | `primary` |
| `driver:lando-norris` | `20260824W` | `primary` |
| `driver:lando-norris` | `20260927G` | `secondary` |

The six records and their source evidence were rechecked against PR #313 at `09c11df5d0f03ba1a64f589e032564977770219b`; no material source changes were found. This approves subject associations only, not every factual assertion in the articles. All other decisions and registry identities remain unchanged. Hamilton `20261007W`, `20261011J` and `20260619W` remain pending. Bahrain/Sepang flags remain intact. No introduction or public hub publication is approved, and no P1.2 integration is included.

Important review questions:

- All five Sepang sources mix Bahrain event naming with Malaysia/Sepang, including an asserted relocation. Preserve their words and verify the claims before accepting venue associations; no Bahrain-to-Sepang relationship is established.
- Singapore history `20261009W` spans historical Thomson Road and modern Marina Bay. The event identity does not imply either circuit, nor that all historical coverage was F1.
- Hamilton `20260726W`/`20260701W`, Ferrari `20250513W`/`20261006G`, and McLaren `20261015G` are proposed exclusions based on tag/body mismatch. Ferrari-tagged `20250513W` concerns Lauda's 1984 McLaren season.
- Watson `20260508W` remains undecided for McLaren: the team tag lacks explicit team identification in the body.
- Mixed-discipline biographies need a human check that the proposed team evidence actually concerns F1. Current roster helpers must not map historical Sauber to Audi or motorcycle Honda/WEC Toyota to F1 identities.

## Release rule and P1.2 integration

Provisional eligibility requires at least three **substantive, human-reviewed subject articles**, on at least two publication dates, with F1 or explicitly reviewed mixed context, plus a useful human-reviewed introduction and explicit public hub approval. This is an editorial release rule, not a Google ranking threshold. An introduction's usefulness and factual accuracy require human judgment; nonempty text alone is insufficient. The approval record attests that review.

The report separates candidate publication dates from qualifying subject dates. It retains every pending association even when the proposed role is an exclusion. Unknown new candidates remain visible without blocking unrelated publishing. Registry/manifest validation rejects duplicate IDs/type-slugs, scoped alias collisions, bad review states, unknown references, contradictory duplicate pairs, missing fields and stale evidence. A taxonomy header cannot serve as article-context evidence, even with an approval record.

P1.2 may consume only human-approved subject associations, independently apply publication/draft and hub eligibility rules, and reuse `discovery.js` rendering/sitemap components. Human-reviewed contextual mentions are not subject membership. Hub generation, route allowlists, search and related scoring remain separate changes. Do not import these datasets into the existing public index just to expose entity IDs.

## P1.1d Norris editorial preparation

Norris now has a proposed Greek introduction in `hub.introduction.text`, with `review.status: pending`. Hub publication remains separately pending; no human reviewer/date is recorded for either decision. See [the editorial preparation](norris-editorial-preparation.md) for the proposed heading, wording adjustment, statement-level source evidence, verified publication dates, outstanding decisions and the bounded next P1.2 scope. The six article approvals and all other association decisions are unchanged. No public page generation is implemented.

## Original P1.1 validation

- Entity tests: 22 passed; taxonomy tests: 44 passed; build tests: 131 passed. Final blog suite: 286 passed and golden snapshots matched.
- `npm run verify` passed public build/validation, generated-drift, static/runtime, blog, Edition browser (358 checks), author, standings, security, asset/image budgets, consent and all 72 visual cases. It stopped at the unchanged Lighthouse LCP gate: Home 2927 ms and Article 2702 ms exceed 2500 ms. The clean `659074e6` baseline and a separate candidate retry reproduced Home 2928 ms and Article 2702 ms. The remaining tablet CLS gate passed separately in both themes at both viewports. This PR does not fix that existing local Lighthouse failure or adjust thresholds.
- Separate clean baseline/candidate `build:public` outputs contain the same 4,082 files, including 456 HTML files. Every relative path and SHA-256 hash matched: zero additions, removals or byte changes. No entity data/tooling ships publicly.
- Baseline public tree digest (SHA-256 over the sorted path-to-file-hash JSON): `0c1c78c881bda4215b5fc4f7ce06b869900f98eca6c239295ede08fea85e465e`.

## P1.1c validation

- `entities:validate` and `entities:report` passed: exactly 6 approved and 91 pending associations; all other association fields/decisions and the registry match the previous PR commit. The six reviewed article directories are byte-identical to that commit.
- Focused entity tests: 23 passed; taxonomy: 44 passed; blog: 287 passed with matching golden snapshots; build: 131 passed. Tests retain pending-review fixtures and assert the exact authorized approvals, reviewer/date, remaining queue and disabled hubs.
- `build:public` passed in separate candidate, previous-PR (`09c11df5`) and clean-main (`659074e6`) worktrees. The existing comparison of every relative path and SHA-256 file hash found the same 4,082 files (456 HTML), with zero additions, removals or changes against either baseline. The public tree digest matches the original P1.1 digest above. `build:check` passed; no generated artifacts changed and no new public URLs exist.
- Fresh Lighthouse runs used the unchanged budgets and three audits per route. Median LCP (candidate / clean main): Home **2927 / 2928 ms**, Article **2926 / 2703 ms**. Both exceed the **2500 ms** limit in both runs; Blog and Standings passed. The candidate Article median was 223 ms higher despite byte-identical public output. The performance gate remains failed; no threshold was changed and the PR remains draft.
- The full `verify` suite was not rerun for this data-only follow-up; its original run is recorded above. No merge, deployment, hub publication or P1.2 implementation is included.
