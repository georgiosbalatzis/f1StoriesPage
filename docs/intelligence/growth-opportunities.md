# I-07D link graph and I-08C growth experiment candidates (2026-10-29)

Status: **read-only audit; proposals only.** Base `eb641a8342a0f31650f27eb60460db4bc7eb2306`. Built from committed
generated HTML and build code. No build, no live-site, Search Console, GA4 or BigQuery access. No traffic numbers,
search-impact estimates or causal claims. Every candidate needs owner approval as its own narrow PR, and any
experiment is registered in `experiments/editorial-growth/registry.json` (I-08A) before it starts.

Coordinator verification: the NEXT UP classification gap was checked directly. `scripts/analytics.js:139-140`
selects `.article-card, .blog-card-link, .article-nav-link, #prev/#next-article-link` and `.blog-posts,
#articles-grid, .article-navigation` as `article_link`; `.rr-next` recommendation anchors match neither.

## 1. I-07D — Link graph and SEO audit

An inbound link below means a distinct source HTML page containing an ordinary anchor to the destination. Repeated anchors from one page count once; self-links, sitemap entries and JSON-LD references do not count. Directory/index aliases and encoded article IDs were normalized for counting without changing their identities.

The graph covers committed Main-site sitemap pages. It does not represent the final assembled child-tool sites.

**How articles link**

| Surface | Repository evidence | Selection/order |
|---|---|---|
| NEXT UP | `blog-module/build/related-score.js`, `related.js` | Three stories. Shared human-approved substantive entities have the strongest weight; then weighted specific-tag overlap, category, author and nearby publication date. Ties prefer newer stories, then article ID. Recency supplies fallback candidates. Reused pictures are filtered. |
| Previous/next | `blog-module/build/nav.js`, `publish-order.js` | Neighbours in publication order, independently of subject. Same-day ordering uses publication-history evidence with fallbacks. |
| Contextual body links | `blog-module/build/body-links.js` | Authored links. The audit recommends useful earlier articles, approved hubs or categories; it does not insert anchors. |
| Article taxonomy links | `blog-module/build/article-render.js` | Primary-category breadcrumb, category links, author profile and approved topic links in the cover kicker. |
| Edition/category/archive | `blog-module/build/discovery.js` | Editorial front-page selection; category membership and chronological listings; paginated categories; complete monthly archives. |
| Entity hubs | `blog-module/build/entities/hubs.js` | Human-approved substantive membership and publication/introduction approval. Members appear newest first. |
| Author profiles | `blog-module/build/author-pages.js` | Published articles belonging to that author, preserving the supplied article order. |

**Counts and interpretation**

| Finding | Result |
|---|---:|
| Published articles absent from the Main sitemap | **0 — PASS** |
| Sitemap URLs without corresponding local HTML | **0 — PASS** |
| Articles with zero inbound linking pages | **0 — PASS** |
| Articles with only 1–2 inbound linking pages | **0** |
| Minimum inbound linking pages | **4** |
| Articles with at most two other articles linking to them | **89 — WARNING: weak article discovery** |
| Articles receiving no NEXT UP recommendation | **85** |
| Articles receiving neither a NEXT UP nor contextual-body link | **85** |
| Articles receiving no contextual-body article link | **408** |
| Articles with no outbound contextual article/hub/category link | **406** |
| Articles with one / at least two such outbound destinations | **8 / 1** |
| Broken internal body links found by the existing audit | **0 — PASS** |
| Article anchors targeting an absent/unpublished article in this graph | **0 — PASS** |

The chronological chain prevents strict orphans. It does not provide strong subject-based discovery: those 85 articles depend on chronological navigation and listings.

The existing body audit reports nine links to earlier articles, one to an approved hub, zero to category sections and fourteen to other site pages. Its contextual recommendation is advisory, not a quota.

**Entity hubs**

Only Norris is eligible and published: four approved articles, with links from all four article kickers and twelve edition/category pages—**16 distinct inbound pages** altogether. Only one member links to the hub within its body.

This is a contextual-placement opportunity, not an orphaned hub. The other five entities—Hamilton, Ferrari, McLaren, Sepang and Singapore—remain ineligible. Their missing publication/introduction approvals and/or insufficient qualifying membership must remain respected.

**Metadata**

- **PASS:** all 465 inspected pages have one canonical matching their sitemap URL and one description. All 415 articles have the expected article schema; article descriptions agree across HTML, Open Graph and schema. Accessible H1 text agrees with schema headlines after excluding decorative, `aria-hidden` periods.
- **WARNING:** seven articles share `Μέσα από το F1λτρο μου | F1 Stories`. This preserves a series identity but does not distinguish individual entries.
- **WARNING:** three article descriptions contain only 23–25 characters.
- **WARNING:** `authors/index.html` lacks `og:title`, `og:description`, `og:url` and `og:image`.
- Two legal pages have differing HTML/OG descriptions.
- Forty-two pages have no JSON-LD: nineteen category pages, eighteen archive pages, the blog index, authors directory, standings and two legal pages. Absence alone is not a structured-data failure or evidence of search loss.
- Search impressions, queries, indexing, chosen canonicals and snippet presentation are **NOT VERIFIED**.

**Concrete examples**

Paths below are repository-relative. Counts are distinct source pages.

| File/path | Evidence |
|---|---|
| `blog-module/blog-entries/20250301G/article.html` | Four inbound pages; only one other article links to it. Its recommendation and chronological source overlap. |
| `blog-module/blog-entries/20250303G/article.html` | FW47 overview: five inbound pages, two article sources, zero body/recommendation sources. |
| `blog-module/blog-entries/20250328G/article.html` | Mini-DRS article: five inbound pages, two article sources, zero body/recommendation sources. |
| `blog-module/blog-entries/20250422G/article.html` | FW47 Part 1: five inbound pages, two article sources, zero body/recommendation sources. Part 2 at `20250423-1G/article.html` offers a specific contextual-link opportunity. |
| `blog-module/blog-entries/20260719J/article.html` | Five inbound pages, zero body/recommendation sources; description is `Τα σημεια της εβδομαδας:`—24 characters. |
| `blog-module/blog-entries/20260502J/article.html` | Description is `BetCast 263: Προβλέψεις !`—25 characters. |
| `blog-module/blog-entries/20260415/article.html` | Description is `F1 Liveries για το 2026`—23 characters. |
| `blog-module/blog-entries/20260926D/article.html` | Shares the series title with six other articles; its body supplies a distinguishing Μπακού/VSC subject. |
| `blog-module/blog-entries/20260824D/article.html` | Another entry with the same series title. |
| `blog-module/blog/entities/drivers/lando-norris/index.html` | Four members and sixteen inbound source pages, but only one contextual-body source. |
| `authors/index.html` | Missing the four core OG fields listed above. |

Three recent articles—`20261026W`, `20261027W`, `20261028W`—also trigger the existing advisory for insufficient contextual linking. This is not permission to add irrelevant links.

**Analytics limitation**

Previous/next links and recognized article cards share `internal_page_click` with `link_section = article_link`, as documented in `docs/intelligence/event-inventory.md`.

There is **no dedicated NEXT UP event**. Current `.rr-next` recommendation anchors fall through `scripts/analytics.js classifyLink()` to `page`; previous/next anchors remain `article_link`. Body links can also be `page`, so existing aggregates cannot reliably isolate placement performance.

Tool URLs require deployment context: `scripts/deployment/assemble.mjs` rewrites legacy destinations in Main HTML/JS. Their presence in source files is not sufficient evidence of a live broken route. The assembled artifact was not inspected.

## 2. I-08C — Ranked experiment candidates

Ranks reflect evidence, reversibility and effort—not predicted traffic gains. All are proposals.

At roughly five consented visitors a day, use one change at a time and prioritize small usability checks. Existing GA4 counts describe consented events, not unique readers or sessions. Clicks do not establish destination loads.

For quantitative comparisons, retain mature, explicitly dated windows and distinguish weekly/carried data from current data. The repository’s 30-event threshold is a reporting floor, **not statistical power**. Below it, abstain from numeric findings; above it, before/after results remain observational. No candidate authorizes new SQL, schedules or workflows.

| Rank | Candidate | Specific scope | Effort | Conservative assessment |
|---:|---|---|:---:|---|
| 1 | Replace an uninformative description | BetCast `20260719J` | S | Clear copy defect; search effect unknown |
| 2 | Distinguish one series title | Opinion `20260926D` | S | Clear ambiguity; search effect unknown |
| 3 | Restore a useful series connection | FW47 Part 2 → Part 1 | S | Directly addresses weak contextual discovery |
| 4 | Add one contextual Norris hub link | `20260822W` → approved hub | S | Uses existing approved membership |
| 5 | Expose mobile archive access | Category-page masthead | M | Addresses a specific mobile navigation difference |
| 6 | Connect technical archive to data | Technical category → standings | S | Existing destination and navigation capability |
| 7 | Move existing related reading earlier | NEXT UP before partners | M | Reversible, but affects every article |
| 8 | Clarify placement measurement | Existing click instrumentation | S | Owner/privacy gate; enabling work |
| 9 | One owned-channel hub message | Norris collection | S | Owner approves every message |

**1 — BetCast description**

Evidence: `20260719J/source.txt` and its generated HTML provide the Spa subject, but the description only says “the week’s points.” Add an editorial excerpt through the existing description contract, for example: «Το BetCast #269 για το Grand Prix του Spa και τα σημεία της εβδομάδας.»

Failure mode: overstating the embedded episode’s content. Guardrails: editor confirmation, synchronized HTML/OG/Twitter/schema descriptions, unchanged canonical; no visual assets or runtime additions.

Measure copy comprehension and metadata consistency. Minimum: matching rendered fields and three readers identifying the subject without opening the article. Search learning additionally needs recrawl evidence and sufficiently informative owner-reviewed Search Console observations; currently **NOT VERIFIED**. Rollback: remove the excerpt and regenerate.

**2 — Distinguish the September series entry**

Evidence: `20260926D/source.txt` describes Μπακού, VSC and spectacle; its title repeats across seven entries. Pilot «Μέσα από το F1λτρο μου: Μπακού, VSC και θέαμα» through the existing title field.

Failure mode: losing the series identity or increasing headline wrapping. Preserve the series prefix, article ID and canonical; synchronize title/H1/OG/schema and check narrow-screen cover height and CLS.

Measure identification in an archive containing multiple entries. Minimum: three readers correctly choosing the intended entry, plus metadata/render checks. Search benefit requires separate Search Console evidence and remains **NOT VERIFIED**. Rollback: restore the original title.

**3 — Link FW47 Part 2 to Part 1**

Evidence: `20250423-1G/article.html` is explicitly Part 2; `20250422G/article.html` is Part 1 and receives no body/recommendation links. Add one editor-selected sentence: «Διάβασε το πρώτο μέρος για το σασί της FW47.»

Failure mode: an awkward insertion or an edit overwritten during regeneration. Modify the preserved authored body through the existing source-less article path and verify build persistence. Use an ordinary text anchor, existing typography and no injected media.

Measure whether readers can find the preceding instalment; existing destination discovery events offer only supporting aggregate evidence. Minimum: three successful usability tasks; quantitative observations require adequate relevant events across mature windows. Rollback: remove that sentence. No series-wide automatic insertion.

**4 — Norris hub from the Zandvoort article**

Evidence: `20260822W` is an approved hub member and links in its kicker, but not contextually within the body. Add one useful sentence linking «Περισσότερες ιστορίες για τον Λάντο Νόρις».

Failure mode: a redundant interruption. Choose a relevant passage; retain all membership/publication approvals and the current kicker. Keep the addition static and text-only.

Measure hub discovery in three reading tasks. Existing internal-click aggregates cannot separate this body link from every other hub placement, so do not present a placement CTR. Quantitative evidence needs sufficient relevant aggregate events and explicit attribution limits. Rollback: remove the sentence.

**5 — Mobile category-to-archive shortcut**

Evidence: `archive-editorial.css` hides `.ed-contents` on mobile category pages; its replacement category rail omits the archive. Search remains available. Add one static «Αρχείο ανά μήνα» link near the search form on category pages.

Failure mode: masthead crowding or pushing content downward. Reuse existing type and focus styles, maintain a comfortable touch target, render the link in initial HTML and check narrow screens, zoom and CLS.

Measure a “find an older month” task. Minimum: three mobile participants, comparing task completion and wrong turns with the baseline. Existing aggregate navigation counts are supporting evidence only. Rollback: remove the link and its narrowly scoped styling.

**6 — Technical archive to standings data**

Evidence: `discovery.js` already renders a technical-category aside; `/standings/?tab=tyre-pace` is an existing navigation destination. Add one relevant aside link: «Ρυθμός ελαστικών στη βαθμολογία».

Failure mode: implying current tool data explains an older article or historical season. Label the destination clearly and verify the selected tab. Use a static anchor with no prefetch, embedded tool or new assets.

Measure whether three participants can reach the intended data view from `/blog-module/blog/section/technical/`. Existing click aggregates can support broad navigation observations but do not prove loads or exact placement attribution. Numeric learning requires adequate relevant events. Rollback: remove the aside link.

**7 — NEXT UP before partners**

Evidence: `blog-module/blog/template.html` places `.rr-partners` before `.rr-next`. Move the existing NEXT UP block immediately before partners; retain its ranking, three recommendations and chronological navigation.

Failure mode: reduced partner visibility or an awkward article ending. This reaches all 415 articles, so review both short and long pages. Preserve image dimensions, lazy loading, keyboard order and the existing editorial design; check CLS, LCP and INP before release.

Minimum evidence: representative mobile/desktop checks and three reading tasks. Existing source-article discovery aggregates permit only broad observational comparison; placement-specific measurement needs candidate 8. Rollback: restore the original block order.

**8 — Measurement clarification, owner gate**

Evidence: `scripts/analytics.js`, `related.js` and the event inventory show the classification overlap described above.

First clarify reporting labels. If the owner approves instrumentation work after consent/privacy review, propose a bounded placement parameter on the existing `internal_page_click` event. Preserve `article_link` compatibility; do not invent a NEXT UP event or collect queries, visitor IDs or new free text.

Failure mode: silently changing historical comparability. Minimum evidence: synthetic selector tests, consent-denied tests and owner verification of the approved parameter’s availability before reporting it. Behavioral conclusions still need adequate samples. No runtime dependencies or layout changes. Rollback: remove the parameter and mark the collection boundary.

**9 — One owned-channel Norris message**

Evidence: the approved hub contains four substantive articles. Prepare one message such as «Τέσσερις ιστορίες για τον Λάντο Νόρις σε μία σελίδα.» The owner approves and sends every message; nothing is sent by this audit.

Failure mode: repetitive promotion or unsupported claims. Use the canonical hub URL, no tracking pixel or recipient identifiers, and no site assets or scripts.

Measure voluntarily supplied feedback and mature aggregate hub page-view/article-discovery events. Minimum: three substantive responses for qualitative learning; sufficient consented events for any numeric description. Attribution to the message remains **NOT VERIFIED** without suitable evidence. Rollback: stop further messages and remove the post where the channel permits.

