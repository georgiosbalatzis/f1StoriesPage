# R-05 editorial association evidence

The source manifest records three reviewed article-to-edition associations. The source files were independently read at `bceff750ed0431cc151d3677d77b3fd5519bada3`; their whole-file SHA-256 digests match the earlier source review at `b960b6a91333009473a69de550c2b31fcf30180a`. The Git change and evidence record the curation decision; they do not claim a separate human approval.

| Article | Association | Context and boundary |
| --- | --- | --- |
| `20261008J` | `2026-singapore-gp` | Body lines 7 and 13 establish the 2026 championship and upcoming weekend, and line 15 names Singapore Grand Prix 2026. The 2025 comparison and historical results do not establish additional associations. |
| `20261012W` | `2026-singapore-gp` | Body lines 7, 13 and 17 describe the Singapore weekend and current season. The reviewed 2026-10-12 publication day and the registry race date provide the year for that relative language. |
| `20261031J` | `2026-mexican-gp` | Body lines 8, 10, 12 and 14 describe Mexico practice and upcoming qualifying and race. Its reviewed 2026-10-31 publication day falls within the registry weekend. This is a betting preview, not a result or a verified prediction. |

These decisions establish article identity in relation to a race edition, not the truth of sporting claims or predictions. All three retain `sessions: null`: neither mentioned sessions nor provider keys are separately approved. The other four existing hubs have no curated association from this pilot. No association follows automatically from a keyword, tag, title, entity, nearby date or historical mention.

Each manifest record pins the exact owned `source.txt` bytes and quotes on 1-based body lines. A change anywhere in a source requires re-review even if a quoted phrase survives; a change to the reviewed publication day also requires re-review because date is part of the context for two records. The current canonical page, publication status and metadata must be checked at integration time; this evidence does not replace those gates. Source-less articles can remain unassociated and readable, or be separately reviewed against the contract's extracted published passages. No author source, draft, cache or entity decision is changed by this manifest.
