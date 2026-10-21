# Norris hub editorial preparation and P1.1e introduction approval

Entity: `driver:lando-norris`. Prepared from the editor's supplied Greek text on 2026-10-21. P1.1d recorded source review; the P1.1e owner approval of the exact heading/body is now recorded below. Permission to publish is still pending.

Approved heading: **Λάντο Νόρις — Formula 1, αναλύσεις και ιστορίες**.

The exact approved heading and body are stored once in [registry.json](registry.json), under this entity's `hub.introduction.heading` and `hub.introduction.text`. Their shared introduction review is `{ "status": "approved", "kind": "human", "by": "georgiosbalatzis", "date": "2026-10-21" }`. The body is unchanged from the owner-approved text, including its paragraph break. The separate `hub.review` remains exactly `{ "status": "pending" }`; no publication reviewer/date is recorded.

## Editorial adjustment

Replaced “τη δυσκολία να διατηρηθεί το πλεονέκτημα σε ολόκληρο το αγωνιστικό τριήμερο” with “τη δυσκολία να μετατραπεί η ταχύτητα των κατατακτήριων σε αποτέλεσμα στον αγώνα”. Zandvoort is a race preview, and the Baku account describes qualifying pace that did not translate into a race result; neither requires a sustained advantage throughout the weekend. The remaining wording is retained.

No new historical or statistical assertion was added. The introduction describes the coverage and its analytical questions. The source articles' championship/statistical statements have not been independently verified; the introduction does not repeat them. In particular, `20260822W:91` and `20260824W:7` use different championship wording, which this preparation does not resolve or silently repair.

## Statement evidence

Line references below are to `blog-module/blog-entries/<articleId>/source.txt`, checked at PR head `8d26330f7a73e9859ad47a10dcd3cad36eacbc9b`.

| Introduction statement | Supporting source context |
| --- | --- |
| Norris's speed, and the question of translating it into results | `20260725W:7,11,15` analyses his qualifying pace, control and precision; `20260822W:67,109` distinguishes pole position from a win or title challenge. The opening is an editorial assessment of this coverage. |
| The 2026 coverage includes Hungary and Zandvoort qualifying | `20260725W:7` explicitly names Hungary 2026 qualifying; `20260822W:5,7` centres on Norris's Zandvoort pole. Publication metadata dates are listed below. |
| Precision on the fast lap | `20260725W:5,11` discusses accuracy, corner entry and limited corrections. |
| Championship pressure | `20260822W:27,67,71` discusses the points gap and the need for sustained results. The introduction does not reproduce the numerical gap or championship claims. |
| Difficulty converting qualifying speed into a race result | `20260822W:45,57,109` treats race execution as a prospective challenge; `20260927G:15,17,30` discusses qualifying, lost positions and Norris's retirement. No Zandvoort race result is asserted. |
| A historical comparison with Mika Häkkinen and Norris's place in McLaren's story | `20260824W:3,21,41` establishes the comparison and its legacy theme. The introduction does not endorse the article's title/win/pole totals. |
| A difficult Baku weekend for McLaren | `20260927G:7,11,17,30` describes team difficulties, car limitations and Norris's race. |
| The British driver, driver performance, car capabilities and race decisions | `20260725W:7` identifies the British driver; `20260725W:9,11`, `20260822W:57` and `20260927G:17,19,30` discuss driver/car balance, tyre choices, strategy and timing. |

## Verified eligibility

The four articles are present in the public compact article index. Dates come from the committed publication metadata, not an inference from a race date. Their exact existing evidence quotes still match their recorded source lines. Every row is `discipline: f1`, `substantive: true`, and approved by human reviewer `georgiosbalatzis` on `2026-10-21`.

| Article | Publication date | Approved role | Existing evidence line |
| --- | --- | --- | ---: |
| `20260725W` | `2026-07-25` | `primary` | 7 |
| `20260822W` | `2026-08-22` | `primary` | 5 |
| `20260824W` | `2026-08-24` | `primary` | 7 |
| `20260927G` | `2026-09-27` | `secondary` | 30 |

Norris meets the minimum of three approved substantive F1 subjects and two publication dates: four subjects across four dates. Its unresolved `20260928G` candidate is excluded from the qualifying set. The introduction requirement is now satisfied. It remains ineligible for a public hub until the owner separately approves hub publication.

Hamilton remains pending with two approved substantive associations, below the three-subject minimum. Its registry entry is unchanged. All six article approvals, the other 91 pending associations, identities and Bahrain/Sepang flags are unchanged. No other introduction was added or approved.

## Outstanding publication decisions

1. **Completed:** explicit owner approval of the exact final introduction wording and heading in P1.1e, by human reviewer `georgiosbalatzis` on `2026-10-21`. No Greek copy was rewritten.
2. **Pending:** separate owner approval to publish the Norris hub. Introduction approval does not authorize publication or another entity's hub.

## Exact next P1.2 implementation scope

After the remaining explicit publication decision is recorded, implement one Norris hub only:

1. Select validated, human-approved primary/secondary, substantive F1 subjects from the currently published, non-draft, non-future article set. Start with the four verified articles above; never use pending proposals or mentions as membership.
2. Define one canonical Norris route from the stable registry identity/slug, reuse the existing discovery shell/cards/page descriptors, and render the approved heading/introduction plus the qualifying articles in deterministic date/ID order. Do not generate Hamilton or other entity hubs.
3. Add only that eligible route to the public artifact allowlist and sitemap, with canonical metadata and content-derived `lastmod`. Remove stale output if publication eligibility is withdrawn. No registry tooling or review records should ship to browsers.
4. Cover independent introduction/hub approvals, subject/date minimums, discipline/publication filtering, pending exclusion, escaping, deterministic output, route/canonical/sitemap consistency and stale-output cleanup. Run the existing required quality checks and unchanged performance budgets; compare public output and allow only the intended hub changes.

Navigation, search, related ranking, article bodies, broader registry expansion and other hubs remain outside this P1.2 scope. This preparation implements none of it and authorizes no merge or deployment.

## Quality status at preparation baseline

Latest main: `659074e6ff434538ff75f1cd3d178085a00015be`. Existing draft PR #313 head: `8d26330f7a73e9859ad47a10dcd3cad36eacbc9b`.

The required [Quality gates job](https://github.com/georgiosbalatzis/f1StoriesPage/actions/runs/39578151412/job/119148745569) passed on that head. It does not run Lighthouse. The separately recorded local Lighthouse failures remain unresolved (Home/Article candidate 2927/2926 ms; clean main 2928/2703 ms, unchanged 2500 ms limits). No gate or threshold is changed by this preparation.

## P1.1d validation

- Entity validation/report passed; 24 focused entity tests and all 288 blog tests passed. The final isolated blog run matched all golden snapshots. An earlier blog run overlapped `build:public` and reported five golden mismatches; the isolated rerun after the build passed without any snapshot update.
- The new focused test proves that pending copy cannot satisfy introduction review, and that introduction approval and hub approval are independent requirements. Its synthetic `fixture-editor` approvals exist only in cloned test data.
- Structural checks confirm that the manifest is byte-identical to `8d26330f`, all other registry fields/entities are unchanged, and Norris's only registry change is the pending introduction. Counts remain 6 approved and 91 unresolved/pending; all six hubs remain ineligible. Repeated JSON reports are byte-identical.
- `build:public` and `build:check` passed. Compared every public relative path and SHA-256 hash with the previous PR baseline: 4,082 files (456 HTML), zero additions/removals/changes. Tree digest remains `0c1c78c881bda4215b5fc4f7ce06b869900f98eca6c239295ede08fea85e465e`. No new public URLs, sitemap/navigation changes, article edits, search/related-ranking changes or generated-artifact drift.
- Full `verify` and Lighthouse were not rerun for this editorial preparation; no production rendering or quality-gate code changed. The earlier Lighthouse failure remains documented above. No introduction or publication approval was recorded.

## P1.1e approval validation

- Fetched PR #313 at `600db9537f4879312987d1a6c303778c3c54b65b` before recording the owner's explicit heading/introduction approval. The stored body matched the authorized text exactly; it was not edited. The approved heading is now stored in the optional, validated `hub.introduction.heading` field. The existing introduction review covers the exact heading/body pair.
- Entity validation/report passed; 25 focused entity tests and all 289 blog tests passed, with golden snapshots matching. The focused regression pins the exact heading, body SHA-256 (`c22b63f39a6e9bd3eead29609d352bd1e3cc0a98623060634394dc5640e0c2d4`) and human reviewer/date, and confirms independent publication approval is still required. Optional heading validation preserves existing heading-free fixture compatibility.
- Structural comparison with `600db953` confirms that only Norris's introduction heading and review changed in the registry. All other registry fields/entities and the complete association manifest are unchanged: exactly six approved article associations and 91 unresolved/pending associations. Norris has four qualifying subjects and approved copy, but its remaining reason is `Public hub approval pending`; no hub is eligible. Repeated reports remain deterministic.
- `build:public` and `build:check` passed. The public artifact comparison uses the prior PR's sorted relative-path/file-SHA-256 methodology: the same 4,082 files (456 HTML), zero additions, removals or byte changes. The tree digest remains `0c1c78c881bda4215b5fc4f7ce06b869900f98eca6c239295ede08fea85e465e`. No new public URLs or generated-artifact drift.
- Article bodies, titles, excerpts, dates, authorship, metadata, canonical URLs, recommendations, search, sitemap and navigation are untouched. No hub generation or P1.2 implementation is included. Lighthouse thresholds remain unchanged; full `verify` and Lighthouse were not rerun, and the previously recorded local Lighthouse failures remain unresolved.
