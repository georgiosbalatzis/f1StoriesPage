# P2.3a validation and handoff

Baseline fetched from `origin/main`: `1538b2bf951581c73913603a29c83325cc36b18f`.
Branch: `feature/ai-research-poc`. Work performed in an isolated worktree; unrelated edits in the user's main checkout were left alone.

## Results (2026-10-23)

| Check | Result |
| --- | --- |
| `npm run test:research` | **31 passed**, no skipped tests; 22 server/provider/evidence tests and 9 browser tests |
| `npm run research:examples` | Four deterministic Greek UTF-8 dossiers generated; no provider calls |
| `npm run build:public` | Passed; validated 4,118 public files, 287.95 MB |
| Public artifact isolation | Inspected all 4,611 paths (including directories); no experiment/service/fixture/response/environment paths |
| `npm run test:author` | **41 passed**, including existing notebook browser and draft/publishing/preview tests |
| `npm run test:security` | **27 passed** |
| `npm run quality:static` | Passed: syntax, secrets/source boundaries, inline handlers, rendering sinks, CSS/token checks |
| `npm run build:check` | Passed; generated artifacts synchronized |
| `git diff --check` | Passed |
| LIVE research | **Not run: no `OPENAI_API_KEY` configured.** No actual live sources, token usage, latency or cost to report. Mocked adapter tests do not establish live quality or account/model access. |

No production article, index, taxonomy, homepage, RSS, sitemap, SEO, draft, notebook, preview or renderer file changed after the build. No merge or deployment was performed. The PR adds the offline test command to existing Site Quality CI; it grants no new permissions.

## Evidence and security behavior exercised

- DEMO works with no key. An ambient key alone leaves LIVE disabled. Both server/adapter activation and per-request activation are enforced; browser activation clears after use.
- Invalid/empty Greek inputs, excess fields (including draft/key/domain fields), oversized and chunked bodies, wrong content type, invalid season/category/session are rejected.
- Official-domain allowlist resists suffix tricks, userinfo, ports, alternate protocols, IP literals and private-network URL strings. The only outbound fetch destination is the fixed Responses endpoint; redirects are disabled.
- Host/Origin/fetch-metadata/CSRF rejection, restrictive CSP, absent permissive CORS, private file/author route denial and API-key isolation are checked.
- Fabricated IDs, invented official-looking URLs, duplicate IDs and invalid structured output cannot become accepted evidence. Real retrieved links alone never verify a claim. Exact citation offsets preserve an association without elevating verification.
- Failed retrieval records are ignored; actual completed open-page/search records and approved annotations retain URLs. Missing publication dates/titles remain unknown instead of using model inventions or retrieval dates.
- Unsupported technical explanations, predictions and calculated numbers are demoted. Contradictions remain explicit, including the real S3/S4 Q3-duration disagreement in the history fixture.
- Upstream cancellation and timeout, provider failure/refusal/truncation, bounded response size, single concurrency and the five-attempt allowance are tested with fake providers. Failed attempts consume the allowance; paid calls are never retried.
- Cost arithmetic distinguishes search actions from open-page calls; missing usage and unknown-model prices yield no guessed estimate.
- Browser tests exercise visible citations, expandable sections, loading/cancel/error states, Greek clipboard/download parity, explicit local article lookup and unchanged storage/IndexedDB sentinels. Request interception checks there are no external or GitHub publishing calls.
- Injection strings in question, claim and title fields remain literal text. No script elements are inserted or executed.

## Browser review

Screenshots were captured at 1440×1000 and 390×844 in both themes. Full-page captures include the complete demo dossier. Automated checks confirm no horizontal overflow, body/muted/link contrast above 4.5:1 against the base surface, visible controls, and successful rendering without browser exceptions. Visual inspection confirms the existing warm paper/charcoal palette, IBM Plex Sans, restrained borders and notebook vocabulary. The five-step editor and Race Report preview are not duplicated or modified.

- [Desktop dark](demo-1440-dark.png) · [Desktop light](demo-1440-light.png)
- [Mobile dark](demo-390-dark.png) · [Mobile light](demo-390-light.png)
- [Technical dossier](dossiers/technical.txt)
- [Strategy dossier](dossiers/strategy.txt)
- [History dossier, including source disagreement](dossiers/history.txt)
- [Insufficient-evidence dossier](dossiers/unsupported.txt)

## Evaluation limitation / next step

P2.3a verifies the local workflow and evidence guardrails, **not live research reliability**. All live substantive findings remain unverified because this adapter cannot independently inspect claim-to-page support from hosted source metadata. No provider publication date is trusted without evidence. Structured output plus citations does not solve entailment or prompt injection; the prototype limits capabilities and labels uncertainty.

For P2.3b, run one small explicitly authorized live evaluation first, then use human adjudication of sentence/source pairs before any broader paid experiments. Add an approved evidence-excerpt capture and review mechanism, measure citation precision and unsupported-claim rates, and retain public deployment/authentication and article integration as separate decisions.

## Exact changed files

- `.github/workflows/quality.yml`
- `package.json`
- `experiments/ai-research/.env.example`
- `experiments/ai-research/.gitignore`
- `experiments/ai-research/README.md`
- `experiments/ai-research/brief.mjs`
- `experiments/ai-research/evidence.mjs`
- `experiments/ai-research/evidence/demo-1440-dark.png`
- `experiments/ai-research/evidence/demo-1440-light.png`
- `experiments/ai-research/evidence/demo-390-dark.png`
- `experiments/ai-research/evidence/demo-390-light.png`
- `experiments/ai-research/evidence/dossiers/history.txt`
- `experiments/ai-research/evidence/dossiers/strategy.txt`
- `experiments/ai-research/evidence/dossiers/technical.txt`
- `experiments/ai-research/evidence/dossiers/unsupported.txt`
- `experiments/ai-research/evidence/source-review.md`
- `experiments/ai-research/evidence/validation.md`
- `experiments/ai-research/examples.mjs`
- `experiments/ai-research/fixtures.mjs`
- `experiments/ai-research/provider.mjs`
- `experiments/ai-research/public/app.css`
- `experiments/ai-research/public/app.js`
- `experiments/ai-research/public/index.html`
- `experiments/ai-research/schema.mjs`
- `experiments/ai-research/server.mjs`
- `experiments/ai-research/test/browser.test.mjs`
- `experiments/ai-research/test/research.test.mjs`
