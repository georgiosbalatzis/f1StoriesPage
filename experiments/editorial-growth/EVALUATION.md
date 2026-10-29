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

Unknown observation fields are rejected. NaN, infinity, negative counts, fractional
counts, zero/invalid denominators, numerators above denominators and duplicate
metric/period rows fail measurement. No visitor-level data is accepted or needed.
The proportion interpretation must be appropriate for the declared metric; unrelated
counts or a sample size attached to a primary p75 are not a supported outcome representation.
Primary p75/sample-size semantics need a registry schema extension before evaluation.

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
objects have a description and optional period/boolean major. Unknown dates or
severity are treated conservatively, not as proof of an unaffected window. An
explicitly major confounder overlapping either inclusive period caps the decision;
an event wholly in the gap or outside both periods does not. Explicitly minor events
are recorded without that cap. All supplied events remain visible. Event completeness
and the owner's classification remain NOT VERIFIED; there is no automatic event lookup.

### Decisions and precedence

| Decision | Meaning |
| --- | --- |
| `STOP_MEASUREMENT_FAILED` | Invalid registry/observations, substituted metric, source/unit/population mismatch, denominator representation mismatch, duplicate aggregates or wrong URL coverage. Takes precedence over recommendations from untrustworthy measurements. |
| `ROLLBACK_RECOMMENDED` | A usable comparison guardrail observation breaches an executable absolute threshold. Overrides primary sample insufficiency and confounders, without asserting a cause. Even a sparse observed breach is reported conservatively. A missing guardrail baseline does not hide an absolute comparison breach. No rollback executes. |
| `INCONCLUSIVE` | Insufficient evidence in either period, immature extraction/evaluation, unequal/overlapping/reversed periods, actual period mismatch, carried/weekly input, unknown URL coverage, incomplete or unsupported guardrail, confounding or unregistered secondary evidence. |
| `CONTINUE_OBSERVING` | Only a PROPOSED/APPROVED plan before baseline starts, with no observations and no other blocking condition. Does not override an immature observed window or a missing period after the plan starts. |
| `NO_DETECTABLE_CHANGE` | Exactly equal descriptive primary values in otherwise usable aggregates. Does not establish equivalence, adequate sensitivity or absence of a change. |
| `DESCRIPTIVE_CHANGE_OBSERVED` | Different descriptive primary values in otherwise usable aggregates. Direction alone is no success claim; there is no automatic keep/completion decision. |

The primary evidence floor is `experiment.evidenceFloor`, default 30, independently
in **each** period: numerator for counts, denominator for proportions. Samples are
never added together to reach the floor. A custom lower floor remains visible and
does not establish adequate sensitivity. Guardrail within-limit PASS also requires
sample counts meeting that floor; a millisecond value is never a sample count.

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
proportion when both denominators are supplied. Scalar guardrails report the
difference in their original units. There is no relative-change percentage.

With a zero baseline numerator, only raw counts and the count difference are
reported, even when denominators exist; no proportion or relative comparison is
computed. A malformed or non-comparable pair has a null difference. Small samples
may retain a descriptive difference but never override the INCONCLUSIVE decision.

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
