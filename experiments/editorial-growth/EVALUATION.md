# I-08B — Offline before/after evaluation

## Evaluation

`scripts/intelligence/experiment-evaluate.mjs` builds on the unchanged
[schema v1 in README](README.md#schema-v1--technical-contract) and its registry
validator. There is no separate `SCHEMA.md` in I-08A. It imports the registry's
`DEFAULT_EVIDENCE_FLOOR` and `MATURITY_LAG_DAYS`, never the snapshot or a provider client.
It has no network calls, tracking changes, SQL, workflows or registry mutations.
Production reconciliation remains **NOT VERIFIED**.

### Input and reproducibility

```js
import { evaluateExperiment } from '../../scripts/intelligence/experiment-evaluate.mjs';

const result = evaluateExperiment(experiment, observations, { asOf: '2000-01-18' });
```

`experiment` is one complete schema v1 registry record, validated without rewriting it.
The function requires an explicit ISO calendar day `asOf`; it never reads the clock,
filesystem or environment. Same inputs produce byte-identical JSON and Markdown.
Inputs are not mutated and result objects do not retain mutable input references.

`observations` is an array with exactly one aggregate per metric and registered
period. Missing periods are absent evidence, never zero. Each observation contains:

| Field | Contract |
| --- | --- |
| `metric`, `unit`, `source`, `population` | Nonblank strings. Primary outcome metadata must exactly match the registry. Sources use the registry enum. Both periods must have identical source, unit and population, including source time zone, consent, filters and coverage in the population description. Labels are declarations, not external verification. |
| `period` | `{ start, end }`, real ISO days, inclusive. Must exactly equal baselinePeriod or comparisonPeriod; no rescaling, daily expansion, period selection or pooling. |
| `numerator` | Nonnegative safe integer count for primary/secondary outcomes. With a denominator it is a subset count. For numeric guardrails it is the supplied scalar aggregate (e.g. mobile LCP p75 in ms), finite and nonnegative; it is never divided by sample size. |
| `denominator?` | Positive safe integer. For primary/secondary outcomes: underlying observations/trials for a proportion; both periods must either supply it or omit it. For a scalar guardrail: underlying sample count, required in each period to mark a within-limit guardrail PASS. It is never inferred from the scalar value. |
| `asOf` | Actual extraction reference day, not later than evaluation asOf. Waiting cannot make an old, immature extraction mature: each observation must have been mature when extracted too. |
| `carried?` | Boolean, default false. True prevents use as current daily evidence. |
| `cadence?` | Observation-level extension: `daily` (default) or `weekly`. Weekly data abstains. Schema v1 has no registered metric cadence, so this harness cannot certify a weekly comparison. A seven-day period aggregated from daily data is valid; it is not automatically classified as weekly. |
| `urls?` / `url?` | Observation-level provenance extension. `urls` must exactly cover the experiment's URL set, without duplicates; `url` is shorthand for a single-URL experiment. Wrong, extra or missing members fail measurement. If neither is supplied, identity is NOT VERIFIED and the decision is INCONCLUSIVE. URL aliases/canonical tags are not resolved offline. |
| `role?` | Only `secondary` is supported, for additional metrics absent from the registry. An undeclared unknown metric is a measurement failure, preventing substituted primary metrics from silently becoming secondary evidence. |

Unknown observation fields are rejected. Non-numeric/non-finite numerators,
zero/invalid denominators, proportion numerators above denominators and duplicate
metric/period rows fail measurement. No visitor-level data is accepted or needed.

Primary outcomes require declared count or proportion semantics, independently of
whether a denominator happens to be supplied. Count units contain a count token
(`count(s)`, `event(s)`, `click(s)`, `page_view(s)`, `συμβάντα`, `κλικ`, `πλήθος`);
proportion units are explicitly `proportion`, `ratio`, `share` or `fraction`.
Scalar declarations in either metric or unit (e.g. `ms`, `unitless`, `p75`,
`average`/`avg`/`mean`, median/percentile, duration/latency, min/max or variance)
take precedence and are unsupported, as are unrecognized semantics. Finite primary
numerators that are not nonnegative safe integers also abstain. These cases return
INCONCLUSIVE with `UNSUPPORTED_OUTCOME`, a null difference and evidence NOT VERIFIED;
they never use a scalar value or its sample size as event evidence. A count with
denominators does not become a proportion; it likewise abstains. A declared
proportion needs a denominator in both periods. Mismatched representations between
periods remain measurement failures. Secondary comparisons apply the same semantic
checks using their declared observation metadata. Scalar p75 outcomes need a richer
registry contract before evaluation; numeric scalar guardrails remain supported.

To supply dated confounders, use an envelope instead of an array:

```json
{
    "asOf": "2000-01-18",
    "observations": [],
    "confounders": [
        {
            "description": "SYNTHETIC major F1 news",
            "period": { "start": "2000-01-08", "end": "2000-01-09" },
            "major": true
        }
    ]
}
```

The envelope `asOf` is the CLI reference day; the function's explicit option is
authoritative. Without envelope asOf, the CLI uses the latest valid extraction day,
never the machine date. Empty input therefore needs an envelope asOf for the CLI.
Confounders may also be strings. Registry strings are always retained, with unknown
dates and severity; they conservatively cap the decision at INCONCLUSIVE. Supplied
objects have a description, optional period, boolean `major` and boolean `permanent`.
For confounders, `period.start` is the occurrence/effect onset; optional `period.end`
is the last day affected for a transient event, not merely the date of an enduring
change. Both endpoints are inclusive. An absent end means the effect may persist;
`permanent: true` explicitly preserves that effect after the recorded occurrence
end (e.g. a canonical URL change dated on one day). The result retains `permanent`.
Unknown dates or severity are treated conservatively, not as proof of an unaffected
window. Major or unknown-severity effects overlapping baseline or comparison cap
the decision, including an open-ended or permanent change that begins in the gap
before comparison ends. A transient wholly in the gap is exempt only if an explicit
end precedes comparison start and it is not marked permanent. A transient affecting
baseline still caps the comparison; a confounder beginning after comparison ends
does not. `overlaps` describes effect overlap, not just the occurrence dates.
Explicitly minor events are recorded without that cap. All supplied events remain
visible. Event completeness and the owner's classification remain NOT VERIFIED;
there is no automatic event lookup.

### Decisions and precedence

| Decision | Meaning |
| --- | --- |
| `STOP_MEASUREMENT_FAILED` | Invalid registry/observations, substituted metric, source/unit/population mismatch, denominator representation mismatch, duplicate aggregates or wrong URL coverage. Takes precedence over recommendations from untrustworthy measurements. |
| `ROLLBACK_RECOMMENDED` | A usable comparison guardrail observation breaches an executable absolute threshold. Overrides primary sample insufficiency and confounders, without asserting a cause. Even a sparse observed breach is reported conservatively. A missing guardrail baseline does not hide an absolute comparison breach. No rollback executes. |
| `INCONCLUSIVE` | Unsupported outcome semantics/finite non-integer primary values, insufficient evidence in either period, immature extraction/evaluation, unequal/overlapping/reversed periods, actual period mismatch, carried/weekly input, unknown URL coverage, incomplete or unsupported guardrail, confounding or unregistered secondary evidence. |
| `CONTINUE_OBSERVING` | Only a PROPOSED/APPROVED plan before baseline starts, with no observations and no other blocking condition. Does not override an immature observed window or a missing period after the plan starts. |
| `NO_DETECTABLE_CHANGE` | Exactly equal descriptive primary values in otherwise usable aggregates. Does not establish equivalence, adequate sensitivity or absence of a change. |
| `DESCRIPTIVE_CHANGE_OBSERVED` | Different descriptive primary values in otherwise usable aggregates. Direction alone is no success claim; there is no automatic keep/completion decision. |

The effective evidence floor is `max(30, experiment.evidenceFloor ?? 30)`, independently
in **each** period: numerator for declared counts, denominator for declared proportions.
JSON exposes the original value as `declaredEvidenceFloor` and the effective value
as `evidenceFloor`; the Greek report shows both. A lower declared value produces
`LOW_DECLARED_EVIDENCE_FLOOR` as a warning reason only: adequate samples may still
be evaluated, but tiny samples cannot become sufficient by lowering the declaration.
A declared floor above 30 remains enforced. Samples are never added together to
reach the floor. Primary and secondary differences are null below the effective
floor; raw aggregates remain available. Guardrail within-limit PASS also requires
sample counts meeting that floor; a millisecond value is never a sample count.
Observed LCP/CLS breaches still recommend rollback despite sparse or unsupported
primary evidence; guardrail threshold comparison and precedence are unchanged.

All source lags come from the registry: GA4 4 days, GSC 3, RUM 4, repo 0. Exact
boundary days are accepted. The strictest source applies to registered windows;
each actual aggregate is also checked against its own extraction day. Temporal
window problems are INCONCLUSIVE, including for COMPLETED records, rather than
being hidden by a generic registry-validation failure. Other registry errors fail.

Executable guardrails have an entire threshold string in the grammar
`<|<=|>|>= nonnegative-number unit-token`, e.g. `<= 2500 ms` or `<= 0.1 unitless`.
The observation unit must exactly match. No conversion or parsing of Greek/English
policy prose occurs. A trailing qualification, missing unit or qualitative threshold
is NOT VERIFIED and requires owner review. Source is matched to the registry;
population must match between periods. Schema v1 does not register guardrail
population or unit separately, so the threshold unit and declared population cannot
be independently verified against a richer registry contract.

Secondary observations retain raw values and descriptive differences. Opposite
primary/secondary directions produce a reason naming both metrics. They cannot
support a success claim; schema v1 cannot preregister their expected directions or
interpret favorable versus unfavorable movement. Arbitrary decisionPolicy prose is
displayed for review, not interpreted as executable code.

### Descriptive differences and intervals

JSON preserves every accepted aggregate's numerator, optional denominator, actual
period, extraction day and provenance. The primary/secondary difference is
comparison count minus baseline count, or comparison proportion minus baseline
proportion for an explicitly declared proportion with both denominators supplied.
Both periods must meet the effective floor before either difference is computed,
including secondary differences. Scalar guardrails report the
difference in their original units. There is no relative-change percentage.

With a zero baseline numerator, no proportion or relative comparison is computed.
Raw counts remain visible; a count difference is available only when the underlying
sample counts meet the effective floor (possible for a declared proportion with
denominators). Otherwise the difference is null, including for 1/2 versus 2/2.
Malformed, unsupported or non-comparable pairs also have null differences. No
below-floor primary or secondary difference is computed before abstention.

**No interval method is applied in schema v1** (`interval: null` throughout,
including below the floor). Aggregate consented events do not establish independent
binary trials for Wilson intervals or an independent constant-rate count process
for exact Poisson intervals. The registry declares neither model, so selecting one
would invent an assumption. Supporting intervals requires preregistered outcome
semantics, sampling model and relevant exposure/independence checks. The numerical
floor alone does not justify an interval or resolve confounding.

### CLI, reports and privacy

Only run real aggregate evaluation through the owner's private local process.
This public repository's CI, logs and artifacts must contain synthetic inputs only.
The CLI refuses execution when either `CI` or `GITHUB_ACTIONS` is nonempty, before
reading registry or observation inputs, even with `--out`. It exits 1 with the same
generic FAIL message as other input/output errors and emits no aggregate values or
result files. The pure evaluator remains usable for synthetic unit tests in CI;
CLI subprocess tests explicitly remove both flags before selectively testing refusal.
The commands below use the committed **synthetic** fixtures:

```sh
node scripts/intelligence/experiment-evaluate.mjs \
  scripts/intelligence/__tests__/fixtures/experiment-evaluate/registry.json \
  EG-2000-001 \
  scripts/intelligence/__tests__/fixtures/experiment-evaluate/observations.json

# Parent directory must already exist. Both result files must be new.
node scripts/intelligence/experiment-evaluate.mjs \
  scripts/intelligence/__tests__/fixtures/experiment-evaluate/registry.json \
  EG-2000-001 \
  scripts/intelligence/__tests__/fixtures/experiment-evaluate/observations.json \
  --out=/private/tmp/synthetic-evaluation.json

npm run test:intelligence
```

Without `--out`, JSON goes to stdout and Greek Markdown to stderr. JSON contains
raw aggregate values and must stay private for real inputs. With `--out`, JSON is
written to that path and Markdown to the same basename with `.md` replacing `.json`
(or `.md` appended otherwise). Both files use mode 0600, exclusive creation and no
overwrite; no aggregate output goes to the console. Existing Markdown is preserved
and a newly created JSON file is removed if the paired Markdown cannot be written.
Output directories inside any Git worktree/repository, including resolved symlink
paths, are rejected. Input files and the registry are never rewritten.

The Greek report follows [result-report.md](templates/result-report.md), including
check statuses, guardrails, confounders, decision, limitations and human history/
rollback steps. Raw observation numbers and differences stay in JSON. Declared
registry metadata (including numeric thresholds) is still copied to Markdown:
owners must keep free-text metadata free of private measurements. Production
reconciliation, actual actions, review actor and new status stay NOT VERIFIED.
Rendered free text inserts U+200D after each `@`, neutralizing user/team mention
syntax when Markdown is pasted into GitHub. JSON retains the original text; this
protection applies to the Markdown report, not to raw JSON copied elsewhere.
PASS refers to a particular offline check; WARNING denotes a limitation, FAIL a
contract violation, and NOT VERIFIED an absent check or external evidence.

Exit 0 means a completed evaluation, including abstention or rollback recommendation;
it never means experimental success. Exit 1 means measurement failure or a CLI/input/
output error. Parser errors are generic and do not echo input contents or paths.
No credentials, decryption, production reads, provider requests or external writes
are part of this harness.

### Schema integration requests

No I-08A schema/template files were changed. Future schema work would be needed for
structured guardrail units/populations/rules (including qualitative owner checks),
registered metric cadence and outcome kind, dated/severity-tagged confounders,
preregistered secondary direction, or a defensible interval model. Observation URL
provenance is required to verify scope; it is absent from the original aggregate
shape and is documented above as an observation extension. Until those contracts
exist, the harness preserves limitations and abstains on ambiguous inputs.
