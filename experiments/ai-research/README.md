# AI Research — F1 Stories (P2.3a)

A local editorial research experiment, isolated from the five-step editor and publication pipeline. Start in DEMO, investigate a question in Greek, inspect the dossier and its citations, then copy or download `brief.txt`. No article generation, draft mutation or publishing capability.

## Run locally

Requires the repository's Node.js >=22 toolchain. From the repository root:

```sh
npm ci
npm run research:dev
```

Open **http://127.0.0.1:4317** (use that address, not `localhost`). Stop with Ctrl+C. DEMO is the default even when a key exists. No environment file is loaded automatically. No API key or GitHub token is required for DEMO.

Select one of the four investigations, then **Έναρξη έρευνας**. DEMO answers are deterministic, dated examples. Arbitrary questions or changed example scopes return insufficient evidence instead of an unrelated canned answer. Copy and download include all eleven dossier sections, source URLs, dates, evidence classifications and usage.

Only the explicit question, season, optional Grand Prix/session and category are sent in a LIVE request. Internal article lookup is a separate, author-triggered local operation over published title metadata; neither the index nor lookup results are sent to OpenAI.

## Evidence contract and its deliberate limit

This prototype **does not independently establish semantic support for live claims**. Hosted search supplies source records and citation annotations, not page bodies that this server has independently inspected. Therefore:

1. The provider must return the strict JSON Schema in `schema.mjs`; the same schema subset is validated on the server. Refusals, incomplete responses, malformed JSON, duplicate IDs and schema violations fail safely.
2. The source register is built exclusively from actual completed search actions or URL citation annotations. Invented URLs, model-only source records and unapproved domains cannot enter it. Original returned URLs are retained.
3. Model source IDs must map to those real records. An annotation can be associated with a claim only if its offsets lie within that exact, unique claim string in the provider's original JSON text. Nearby citations and references elsewhere in the JSON do not qualify.
4. A citation association is **not** an entailment check. Live factual candidates, statistics and causal explanations remain in the unverified section. Contradictions retain their own section, with explicit unverified labels. No live claim is automatically labelled verified.
5. Each moved claim retains its original section, classification, valid source links and reason. The UI distinguishes a provider citation from a model-only reference. A rejected citation is removed; the unsupported statement remains visibly unverified.
6. Only the specific static DEMO claim/source pairs reviewed during implementation can have `fixture_inspected` status. This means an inspected example, **not** a newly retrieved record or human editorial approval. See [source inspection notes](evidence/source-review.md).

Publication dates are not inferred from retrieval dates. The live source metadata used here does not establish publication dates; these remain `null` / «άγνωστη». Model-supplied titles/dates do not override source metadata. A provider title absent from annotations is marked unavailable. Retrieval times come from the server. Fixture inspection dates are fixed and explicitly labelled.

Every finding preserves one of: official record, source-supported report, calculated statistic, technical interpretation, prediction, unsupported hypothesis. Verification is a separate field; a model choosing `official_record` cannot verify itself. Statistics require value, unit, population, period/session, data source, method and exclusions; unsupported numbers are never promoted. Demo statistic sections are empty because these examples do not provide a defensible race dataset.

The scope comes from validated author inputs. Outline entries are editorial proposals for review, not evidence. External content and the question are untrusted data; instructions embedded in them must not change policy or invoke actions. The provider has only the restricted web-search tool, no shell, files, GitHub or publication tools.

## Real provider configuration

The adapter uses the [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create), current [`web_search`](https://developers.openai.com/api/docs/guides/tools-web-search), `filters.allowed_domains`, `include: ["web_search_call.action.sources"]`, and [strict structured output](https://developers.openai.com/api/docs/guides/structured-outputs). It uses Node's native `fetch`, with no SDK retry behavior or extra dependencies.

The fixed server-owned domains are `fia.com`, `formula1.com`, `pirelli.com`, including their subdomains as supported by the API. HTTPS URLs with credentials, alternate ports, deceptive suffixes or other hosts are rejected. Users cannot change this list. The service fetches only `https://api.openai.com/v1/responses`; it has no URL fetcher, DNS resolver or crawler for source pages. Source retrieval is delegated to the provider's filtered hosted tool. Successful source/annotation validation still does not establish support for a sentence.

Before testing LIVE, set a small provider-side spending limit in an existing OpenAI project. The current [official spend-limit instructions](https://developers.openai.com/api/docs/guides/spend-limits) are: Project settings → Limits → Spend → Edit spend limit → enter the monthly amount → enable **Enforce a hard limit** → Save. Configure an organization limit as appropriate. An alert alone does not stop requests, and enforcement can lag slightly. This tool does not create an account, key, project or paid service for you.

In the **server terminal**, configure an existing key without placing it in a command argument or shell history:

```sh
# zsh: enter the existing API key at the hidden prompt
read -rs 'OPENAI_API_KEY?OpenAI API key: '
export OPENAI_API_KEY
export OPENAI_MODEL=gpt-6.1-sol
export F1S_RESEARCH_MODE=LIVE
export F1S_MAX_LIVE_REQUESTS=1   # one limited evaluation; default is 5
export F1S_MAX_OUTPUT_TOKENS=5000
npm run research:dev
```

The browser still opens in DEMO. Choose LIVE and check the explicit paid-request activation box, then submit once. The box clears after submission. Without a key, the browser reports that live research is unavailable; direct live requests also fail. The adapter itself checks both activation gates. Use `unset OPENAI_API_KEY F1S_RESEARCH_MODE` afterward. Never paste keys in the browser, commit them, use GitHub credentials, or put secrets in research questions. `.env.example` is reference-only; experiment `.env*` files and `local-output/` are ignored by Git.

The default model is [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), whose official page lists Responses web-search and structured-output support. An explicit `OPENAI_MODEL` can select another compatible model available to your project; compatibility/account access is not assumed or silently substituted. Unknown model pricing returns an unavailable estimate.

For a single live evaluation, retain the exported brief privately in `local-output/`. It records the question/scope, selected model, source register/count (count the records), supported/unsupported classifications, contradictions, token usage, tool calls, elapsed time and estimated cost. Inspect every claimed association before editorial use. Do not automatically repeat a failure or truncation: it can still incur a charge. **No live test was performed during this implementation because no API key was configured.**

## Cost controls

| Control | Behavior |
| --- | --- |
| Default mode | DEMO; server LIVE plus per-request activation required |
| Live attempts | Default 5 per process; `F1S_MAX_LIVE_REQUESTS` can lower this to 1–5 |
| Concurrency | One live request; concurrent requests receive 429 |
| Output | `F1S_MAX_OUTPUT_TOKENS`, default 5000, range 1000–8000 |
| Tool budget | Maximum 3 hosted tool calls per response |
| Timeout | Fixed 60 seconds; upstream abort on timeout/client disconnect |
| Retries | None, including 429, timeout, invalid output and cancellation |
| Billing record | Provider-reported input/output and usage details, observed search/open/find calls, search actions, elapsed milliseconds |
| Retention | In-memory response and explicit browser export; `store: false` in Responses API |

The [pricing page](https://developers.openai.com/api/docs/pricing), checked 2026-10-23, lists standard short-context GPT-6.1 Sol at **$2 / million input tokens**, **$10 / million output tokens**, and **$10 / 1,000 web searches**, plus search content tokens at model rates. The request explicitly selects the standard/default service tier. The estimate is:

`input_tokens × 2 / 1,000,000 + output_tokens × 10 / 1,000,000 + search_actions × 0.01`

The estimate ignores cache discounts, assumes reported input usage covers billed search content, and is labelled an estimate, not a bill. Inspect provider billing for unreported search content or usage. Open/find actions are reported separately from search actions; they are not counted as additional searches in the estimate. Missing usage or unknown models yield `null`, never a fabricated zero. If cancellation prevents usage reporting, cost is unknown and may be nonzero. A cancelled or failed attempt consumes the local request allowance. Restarting the process resets the counter; it is **not a monetary cap**, nor does abort guarantee that remote billable work has stopped. No background or scheduled calls exist.

## Local security and isolation

- `127.0.0.1` binding, exact Host/Origin checks, same-origin fetch metadata, per-process CSRF nonce on POST, no permissive CORS.
- Fixed static-file allowlist; repo, environment, provider code and production author pages are not served. Local fonts are read from their fixed existing paths.
- JSON-only requests, 8 KiB body limit (including chunked bodies), question limit 1200 characters, bounded context/enums and unknown-field rejection.
- Request/header timeouts, fixed provider timeout, 512 KiB provider/JSON response limits, no redirects from the fixed API endpoint.
- Restrictive CSP, no frames, no remote scripts/styles/fonts, no HTML injection sinks; all generated text uses `textContent`.
- No logs of questions, responses, keys or request bodies. No access to editor modules, local drafts, GitHub token, article bodies or publishing routes. Internal lookup reads only the existing published index on demand.
- No persistent research database, draft schema change, telemetry integration, OpenF1 ingestion, cloud infrastructure or production credential changes.
- These loopback measures are **not sufficient for public deployment**. Authentication, authorization, abuse protection, durable quotas, privacy policy, monitoring and an independent evidence review design are separate future work.

## Tests and review evidence

```sh
npm run test:research      # DEMO + mocked provider; never uses an ambient API key
npm run research:examples  # regenerate deterministic Greek exports; never calls AI
npm run build:public
npm run quality:static
npm run build:check
npm run test:author
npm run test:security
```

Browser tests use the repository's `playwright-core` and installed Chrome (or `CHROME_PATH`). They intercept external browser traffic and fail on unexpected requests. All server tests pass explicit environments and fake providers; adapter tests pass a fake fetch. Adding a real shell API key cannot enable paid test calls.

The experiment remains outside the existing public-artifact allowlist. Its interface is reachable only from `research:dev`; no production author-page asset was modified to expose it. See [validation report](evidence/validation.md), the [four example dossiers](evidence/dossiers/), and screenshots:

| | Dark | Light |
| --- | --- | --- |
| Desktop 1440px | [Screenshot](evidence/demo-1440-dark.png) | [Screenshot](evidence/demo-1440-light.png) |
| Mobile 390px | [Screenshot](evidence/demo-390-dark.png) | [Screenshot](evidence/demo-390-light.png) |

## Architecture and P2.3b recommendation

`public/` → loopback `server.mjs` → DEMO fixtures **or** `provider.mjs` → strict schema → source/claim validator → Greek dossier and text export. An independent `/api/internal` lookup reads published metadata only. No research route writes repository or author state.

P2.3a demonstrates a local workflow, source provenance validation and conservative uncertainty handling. It does **not** demonstrate reliable autonomous factual verification or live model quality. For P2.3b, first run a small, explicitly budgeted evaluation set with human sentence-to-source adjudication. Measure unsupported-claim rate, missed contradictions, incorrect temporal scope, citation precision, latency and actual cost. Design an approved excerpt/page-evidence capture mechanism and an explicit author review action before allowing any live finding to become verified. Preserve the separation from drafts and publication; defer a public service and full CMS integration until those evaluations justify them.
