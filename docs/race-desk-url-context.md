# R-02B URL context and loss-aware planning

This is the pure parser/planner substep of R-02, following merged strict outbound builders in [R-02A #393](https://github.com/georgiosbalatzis/f1StoriesPage/pull/393). It adds no visitor code, UI, public page, registry binding, child changes or production pin transition. R-02C still needs an actual integration entry point and assembled browser/history acceptance. The full R-02 milestone is not complete merely because these functions pass tests.

## APIs and trust boundary

Import `parseToolUrl` and `planToolLink` from `scripts/race-desk/core/navigation.mjs`; shared declarations are beside it in `navigation.d.mts`. Both receive the registry instead of loading it and require explicit `options.currentYear` (1950–2100). No clock, network, filesystem, browser state or dependency is used.

Options may also contain a reviewed `telemetryCircuit` fact with the same six fields as the strict builder: `season`, `openf1MeetingKey`, `circuitShortName`, `sourceId`, `reference`, `status: "verified"`. It must identify an existing registry source; its meeting/season must match the requested race and session. This is a manual source-review boundary. Shape checks do not establish that a cited fact is true. Missing facts never trigger venue-name inference. Required option fields must be own properties; inherited facts cannot bypass validation.

`parseToolUrl(registry, absoluteUrl, options)` returns:

- `{status: "resolved", tool, context, report}` only when the selected identity is verified within the registry.
- `{status: "missing" | "ambiguous" | "unsupported" | "invalid", tool, reason, report}` otherwise. `tool` is null when no accepted tool is identified. These results contain no trusted context or navigation URL.

Bad external URLs produce structured failures. Invalid registries and programmer options throw `RegistryValidationError`. A resolved context establishes representability and reviewed identity, not a successful HTTP route, provider sample availability, driver participation, lap availability, freshness or completeness. Callers must not automatically navigate from untrusted input.

`planToolLink(registry, contextInput, target, options)` preserves the existing strict `buildToolLink` behavior and returns one of:

- `{kind: "exact", url, notice: null, report}` when every selected semantic field is represented.
- `{kind: "partial", url, notice, report}` for a verified race-only Grid/TYRES link with explicit session/driver/lap omissions.
- `{kind: "generic", url, notice, report}` when the destination cannot safely express the context. Its URL is the fixed canonical app root without query or hash. It makes no claim about which default selection the app may show.

Partial and generic plans always have a non-null notice code. A caller must show its corresponding explanation before navigation. Codes are stable machine values, not raw HTML or user-facing copy. Different Ghost Car laps produce a generic Telemetry destination; the planner never picks the first driver's lap, adds a second driver or selects a fastest lap.

Every report contains `preserved`, `dropped`, `unresolved`, and `ambiguous` arrays. Entries have `field`, `reason`, and optional sorted `candidates`. Arrays use codepoint field/reason order; driver order remains the user's selected order. Reports contain no raw query values. Unknown query names are redacted. Presentation fields and hashes are explicitly reported as omitted rather than forwarded.

## Consumer semantics

| Tool | Resolution and conversion boundary |
| --- | --- |
| THE GRID | Embedded drivers/constructors views honor season/round pins; an omitted tab means the native drivers default. Ordinary pages and qualifying/report selections are not resolved from a standings round. Grid's native trimmed 1–4-digit token grammar and season/round bounds apply. A bad or missing year is not silently replaced with the current year. |
| TYRES | Query year/race precedence follows the pinned parser. A query year suppresses the path race; overridden path selections are reported. A year alone does not establish a selected race. Query aliases use explicit verified TYRES slugs/IDs and the pinned `year-key` recipe, with all candidate records considered. Cross-domain alias collisions return ambiguity instead of the native first match. |
| Ghost Car | Matching year/meeting/session, 2–4 contiguous unique driver/lap pairs. Absent version is legacy v1; explicit v1/v2 are supported. Missing `nd` is inferred from valid slots, as in the pinned consumer; contradictory counts, missing concrete laps and unknown/empty versions fail closed. |
| Telemetry | Matching reviewed circuit short name, meeting, year and session; 1–4 unique drivers with one shared concrete lap. Supported dashboard tabs preserve semantic context while their view selection is reported as dropped. This context reader does not grant publication-panel approval or replace the stricter existing embed-publication validator. |

Accepted canonical bases come from `scripts/deployment/sources.json`. Exact, evidenced legacy rules cover GitHub Pages Telemetry/Ghost Car/TYRES paths, the canonical `/f1telemetry/` redirect and Telemetry's historical `f1stories.gr` / `www.f1stories.gr` bases. Origins and paths are stored separately: aggregate `prepareMain` rewrites complete legacy URLs in JavaScript, so a concatenated allowlist constant would be unsafe. Final assembled-browser acceptance belongs to R-02C.

Input URLs are bounded to 8,192 characters. HTTPS origin/path matching rejects lookalike origins, credentials, unexpected origins/ports, malformed encodings, decoded controls/backslashes, and raw/encoded traversal before normalization. Query keys are decoded once; repeated keys and conflicting aliases fail closed. Documented HTML query separators (`&amp;`, `&#38;`, `&#x26;`) are normalized once in the raw query. Encoded data is never reparsed as another query. Unknown parameters fail rather than being copied. No input hash or query is blindly forwarded.

## Source inventory and actual coverage

The committed fixture inventory records full source revisions and paths in `scripts/race-desk/__tests__/fixtures/tool-urls.v1.json`. Relevant source contracts are:

- Telemetry `38c3dd2018b810a5dce1add1f7663bcb199c845a`: filters, links and publication contract.
- Ghost Car `4d7a783d9866bce917f61ae6546e48bc0d38b622`: URL helper, figure state and comparison selectors.
- TYRES `50e5f50be89e038257cbe3426b366810e0c1f59a`: URL state, selection and schema.
- Main `9e049303c8993375d661f4abbd923cdd891d4e87`: Grid URL/report state and round-pin reader.

The real registry remains six reviewed events, six TYRES routes and four Jolpica round bindings, with zero OpenF1 meeting/session bindings. Japan and Bahrain/Sepang resolve through explicit existing mappings; provider examples and alias collisions use clearly labeled synthetic fixtures. Synthetic IDs and circuit facts are never promoted into the registry. No current source head is substituted for a deployment code pin, and the TYRES dynamic data input remains separate from its code pin.

## Migration and completion

The registry schema, existing strict builder, existing public URLs and native child parsers remain unchanged. Existing consumers may adopt the new APIs incrementally. Render notices through fixed copy/text nodes; never interpolate report fields into HTML. Do not treat `resolved` as an availability badge or use generic destinations to imply preserved selections.

R-02C must integrate one small existing-interface entry, show loss/unavailable notices, verify direct load/refresh/history after asynchronous state settles, exercise canonical and legacy routes against the assembled bundle, and measure runtime bytes/requests without relaxing budgets. Only then can the complete R-02 acceptance gate unblock R-03.

The R-02C implementation and its remaining assembled acceptance gate are recorded in [navigation validation](race-desk-r02c-validation.md). It transfers only an actually rendered driver/constructor standings race to TYRES when verified. Analytical tabs stay generic, and no real OpenF1 identity is inferred. This bounded UI does not make every app an interactive context producer; the pure APIs retain the broader representable-context contract.
