# E-08 offline evaluation — 2026-10

Decision: retain the isolated experiment; **NO-GO for workspace import or production integration**. No import into Generate, claim mapping, draft mutation, token access or publication capability is authorized. Offline results cannot authorize integration.

## Set and adjudication

The fixed set in `test/fixtures/evaluation-2026-10.mjs` contains the 12 specified questions and 12 primary claim/source pairs, plus the second source for the Q3 disagreement. It records locators, bounded paraphrases, dates and proposed labels independently of `inspectedClaims`. The results table and timing extracts are explicitly synthetic; their URLs identify publishers, not retrieved evidence. Other paraphrases derive from the earlier implementation notes, which are not independent adjudication. No pages were fetched or verified for this evaluation. The synthetic 19/22 statement is a hypothetical example; arithmetic and exclusions are **NOT TESTED**.

**Human adjudication: 0/12 primary pairs signed off; 0/2 editors have independently labelled them.** All editor labels and resolutions remain UNADJUDICATED. Proposed targets are 3 supports, 7 insufficient and 2 out-of-scope; they are design targets, not human decisions. The second Q3 source is recorded to preserve both descriptions, but its independent pair judgement also remains UNADJUDICATED. No disagreement between editors has been established or resolved. Two independent editors must inspect the frozen material, label each pair supports / contradicts / insufficient / out-of-scope, record disagreements and resolve them explicitly. Missing material or decisions must stay UNADJUDICATED. An applicable versioned regulation and telemetry/counterfactual material are absent for the cases requiring them.

## Deterministic offline results

Run `node --test experiments/ai-research/test/evaluation.test.mjs`. The measurements below describe these exact synthetic cases, not model quality:

- DEMO: 12/12 insufficient-evidence responses, 0 source records and 0 provider calls. This is abstention, not coverage of useful answers.
- Schema: 12/12 independently designated valid dossiers accepted; 4/4 designated invalid variants rejected. This checks shape, not truth or arithmetic.
- Provenance: 2 true accepts, 3 true rejects, 0 false accepts, 0 false rejects (five constructed reference variants; not semantic support). An allowlisted but unobserved URL, an unapproved URL and a missing ID were rejected as references.
- Provider-style claims: 12/12 moved to unverified; 0/12 promoted. Citation offsets: 4/4 associations matched expectations (one exact association, three rejected offsets); even the exact association remained unverified. Association does not prove entailment.
- Dates: one synthetic known fixture date retained, one unknown fixture date retained as null, and one provider publication date remained null despite a model-supplied date. Retrieval dates are not publication dates.
- Scope: 2 proposed out-of-scope primary pairs, both unverified in provider-style output. **0/2 scope mismatches were detected or labelled by the classifier itself.** In a separate deliberately mislabelled fixture, 1/1 mis-scoped claim was promoted to `fixture_inspected`; this is an unsafe promotion under the proposed oracle and fails the zero-unsafe-promotion criterion. The fixture flag is an example classification, never editorial approval.
- Contradictions: 1/1 explicitly supplied disagreement retained with both values, both source references and an unverified label. With only a single candidate and the two source records, 0/1 disagreements were discovered. The classifier has no contradiction discovery capability.
- Coverage: 12/12 questions exercised with one primary claim each, 12/12 proposed primary judgements, 0/12 human-adjudicated primary pairs. One additional source is present for the Q3 contradiction; no claim is made that this sample covers all possible claims, sources or adversarial outputs.

Failure analysis: a general 2022 tyre passage cannot establish a 2026 rule, yet the fixture classifier trusts an `inspectedClaims` entry without checking the season. Likewise, a directory cannot settle the Q3 regulation, and a slower lap cannot establish brake pressure or aerodynamic setup. The provider path demotes these cases but supplies no semantic explanation or automatic scope detection. Retaining a supplied disagreement does not discover one. Labels have not been adjusted to match these limitations.

## Privacy and limits

Inputs and passages are synthetic or limited public-fact paraphrases; no real drafts, personal data, keys or paid data are included. The evaluation calls only pure local DEMO/schema/evidence functions, guards `fetch` against calls, checks that case input state remains unchanged, and does not open a server or invoke the provider. This establishes no mutation of the test cases during the tested flow; it is not a complete filesystem, browser, telemetry or public-artifact privacy audit. The coordinator must perform the broader privacy/state and artifact checks. DEMO provider expenditure is zero calls; it is not a live cost estimate.

Citation precision on live output, live unsupported-claim / missed-contradiction / scope-error rates, live latency, useful-answer rate, and actual live cost are **UNAVAILABLE**: no live provider was called and no live output or billing data exists.

Offline acceptance is **not met**: independent human adjudication is incomplete and the deliberate scope stress test exposes an unsafe fixture promotion. Complete independent labels, exact provenance/policy outcomes, zero unsafe promotions, zero fabricated-source acceptance and verified zero privacy/state mutation are prerequisites. A future live evaluation additionally requires explicit owner budget and spending controls, a fixed independently adjudicated source/claim set, and measurement of semantic citation precision, unsupported claims, missed contradictions, temporal scope errors, useful answers, latency and actual billed cost. Even a successful evaluation does not itself authorize integration.
