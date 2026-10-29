# I-06C4 — Evidence closeout (2026-10-29)

Status: **offline audit PASS; production snapshot reconciliation NOT VERIFIED**. This is a local owner runbook,
not evidence that an owner check has happened. Baseline: `eb641a8342a0f31650f27eb60460db4bc7eb2306`.
No key, credential, decrypted payload or production query result was accessed for this audit. No network call,
billable query, workflow dispatch or GitHub write was made. All examples below are instructions for the owner
on their own machine, outside chat, CI and agent sessions.

## Evidence matrix

PASS means only the specific recorded check passed, for its recorded window. It does not promote a model to
`PRODUCTION_VALIDATED`. NOT VERIFIED names missing evidence. EXPECTED LIMITATION is a known coverage, maturity or
sample constraint, not a successful validation. Runtime `WARNING`, `FAIL` and `NOT_VERIFIED` remain the validator's
outcomes; an expected limitation does not excuse a numerical mismatch.

| Item | Classification | Recorded evidence / exact missing evidence |
| --- | --- | --- |
| Offline validator and CLI | PASS (synthetic only) | [Validator](../../scripts/intelligence/validate-snapshot.mjs), [tests](../../scripts/intelligence/__tests__/validate-snapshot.test.mjs) and [command tests](../../scripts/intelligence/__tests__/validation-commands.test.mjs): targeted run on 2026-10-29, **32 passed, 0 failed, 0 skipped**. Includes generated-key encryption/decryption, redaction, wrong-key rejection, window/population guards and both rotation types. |
| All 20 models executed for 19–22 Oct | PASS (execution only) | [Owner Console record](bigquery-validation.md#owner-reported-results-bigquery-console-2026-10-19--22-as_of_day--2026-10-26), run date 2026-10-26, `as_of_day=2026-10-26`. This is a recorded owner report, not an independently rechecked result. |
| Selected 19–22 Oct reconciliations | PASS (reported, that window only) | [Reconciliations](bigquery-validation.md#reconciliations-passed-as-reported-by-the-owner): article/category and publication-age totals, audience device/country and acquisition scopes, RUM pipeline/coverage/library checks. No production values are repeated here. |
| Nine snapshot models executed in the pipeline | PASS (execution only) | [Production evidence](data-quality.md#production-evidence): run `40489852956` for the initial RUM pair; run `40830298650` for the seven discovery-day models, carrying RUM. Logs prove execution/cost/shape, not encrypted values. |
| Current committed snapshot period | PASS (public metadata inspection only) | Only the public envelope header was parsed locally: `generatedAt=2026-10-29T06:37:23.657Z`, `asOf=2026-10-28`, `start=2026-10-19`, `end=2026-10-24`. Header parsing alone does not authenticate it; the owner must open it with the key. It is not the 19–25 Oct snapshot. |
| Property time zone | PASS (owner record) | [I-05 record](bigquery-validation.md#i-05-3033) confirms `America/Los_Angeles`; [snapshot constants](../../scripts/intelligence/snapshot.mjs) use it. Athens is the scheduler/display zone, not the GA4 date boundary. |
| Session channel schema on one table | PASS (that table only) | [Dataset schema check](bigquery-validation.md#dataset-schema-check-owner): `default_channel_group` exists as `STRING` on `events_20261022`. Executed audience models establish compatibility for the tables they read, not every future table. |
| GA4 stream identity (Outstanding 1) | NOT VERIFIED | Owner GA4 Admin → property `485678890` → Data streams confirmation of `G-X68J6MQKSM`. Dataset numbering and repository tracking config do not establish this link. No credential or Admin screenshot is needed in public evidence. |
| Mature 19–25 Oct cohort (Outstanding 2) | NOT VERIFIED | All 20 model results and reconciliations for `start=2026-10-19`, `end=2026-10-25`, `as_of=2026-10-29`, with exact parameters recorded privately. The nine-model snapshot can validate only models actually present at those bounds; weekly/carried pairs can have earlier bounds. No later record closes this item. |
| Production offline validation | NOT VERIFIED | An owner-run report from the existing encrypted snapshot, with relevant checks actually present and PASS, and warnings reviewed locally. Exit 0 alone is insufficient: missing pairs and all external checks can remain NOT VERIFIED. |
| Console thresholds / trend periods | NOT VERIFIED | The [phase-1 parameters](bigquery-validation.md#phase-1-parameters) were planned, but the Console report did not restate `min_events`, `min_observations` or model 32's `period`. The repeat must record 30 and both `day` / `week` runs of 32. Snapshot code fixes both thresholds at 30; that does not prove the older Console settings. |
| All-model authenticated dry-runs and bytes | NOT VERIFIED | Successful dry-runs and estimates for each exact query/window in the owner checklist. The [phase-1 status](bigquery-validation.md#statuses) was BLOCKED in its validation environment; the later authenticated snapshot dry-run in [activation evidence](dashboard-snapshots.md) covered its own model set/window, not all final checks. |
| Exact I-01 inventory and field types (Outstanding 4) | NOT VERIFIED | Run [02-event-inventory.sql](sql/02-event-inventory.sql) as written, with documented identifier replacement only. Need actual types/presence for `metric_revision`, `nav_start_ms`, `observation_start_ms`, `sponsored`, and click fields including `page_location`, `link_path`, `link_section`, `article_id`, `source_path`, `source_type`, `destination_type`. An absent optional field is absence, not a type PASS. Adapted exploratory queries are not execution of repository 02. |
| Consent/host coverage for the final window | NOT VERIFIED | [15](sql/models/15-coverage.sql), [29](sql/models/29-audience-coverage.sql) and [33](sql/models/33-rum-coverage.sql) stage outputs at the comparison's exact bounds. The earlier owner report recorded no loss for its examined population; that is not proof about later exports or non-consenters. 02 classifies hosts but does not read `privacy_info.analytics_storage`; it cannot replace these coverage models. |
| Audience classification unknowns | NOT VERIFIED | Full 29 output for `device_unknown_or_other`, `country_unknown`, `first_user_source_unattributed_or_other`, `collected_source_unattributed`, `session_source_unattributed_or_other`, `session_channel_unattributed_or_other`, `enum_parameter_other`. The [production-check record](bigquery-validation.md#production-data-checks) did not report the per-field counts. The offline validator checks session gaps and discovery classes, not all these fields. Unknown, unattributed and other classes must remain explicit. |
| Kept click fields, mapping and carried labels | NOT VERIFIED | Owner outcomes for `discovery.fields`, `discovery.classes`, `discovery.unmapped`, `window.carried` and `window.rotation`; visual review of carried-date labels in the existing [running-order dashboard](dashboard-snapshots.md#i-06d--editorial-intelligence-interface-and-presentation). The [first discovery run](dashboard-snapshots.md#i-06c3--editorial-discovery-weekly-rotation) left those checks open. A click never proves a destination load. |
| Exact I-01 RUM integrity query | NOT VERIFIED | Run [03-web-vital-integrity.sql](sql/03-web-vital-integrity.sql) as written over a mature ≤ 7-day window; explain missing ids/revisions/values, non-integer revisions, duplicates/conflicts and legacy versions locally. Earlier adapted diagnostics and model 33 do not establish execution of repository 03. |
| Nonzero CLS conversion in production | NOT VERIFIED | The [I-05 record](bigquery-validation.md#i-05-3033) only exercised a zero p75; zero cannot demonstrate division by 1000. Synthetic conversion checks pass. A suitable nonzero, comparable production observation cohort is still needed; do not manufacture one or add a diagnostic query without a concrete need. |
| Export completeness | NOT VERIFIED | [01 metadata](sql/01-export-tables.sql) / per-day `bq show` evidence of table presence, row-count and modification history for the relevant scan. The pipeline checks table existence; a present but partial export and late arrivals remain possible. Metadata can flag anomalies, not prove all browser events arrived. |
| Full 28-day reference (Outstanding 5) | NOT VERIFIED | Owner comparison with [perf/rum-pilot/report.sql](../../perf/rum-pilot/report.sql), no earlier than **2026-11-19**, under [matching conditions below](#rum-reference-comparison). Matching counts do not validate pooled p75s. |
| Small samples and the 30 floor (Outstanding 3) | EXPECTED LIMITATION | [Sample policy](editorial-model.md#coverage-freshness-sample-counts) and [I-05 sample record](bigquery-validation.md#i-05-3033). Keep `min_events=min_observations=30`; flags keep rows visible. A larger sample has no guaranteed date. Abstain from rankings/comparisons framed as stable below the floor; do not lower it to obtain findings. |
| Four-day maturity lag | EXPECTED LIMITATION | [Window semantics](dashboard-snapshots.md#data) and SQL bases exclude days newer than `as_of_day − 4`. Mature does not mean delivery is complete. A missing table is not a zero day. |
| Weekly discovery / one-day carried RUM | EXPECTED LIMITATION | [Rotation](dashboard-snapshots.md#i-06c3--editorial-discovery-weekly-rotation): discovery carries its original window; RUM carries exactly yesterday on discovery days. Discovery age 1–7 days is expected, 8–13 warns, older than 13 must be dropped. Incorrect dates or rotation are defects, not expected limitations. |
| Consented Main population / delayed RUM (Outstanding 6) | EXPECTED LIMITATION | [Metrics contract](metrics-contract.md#population-and-coverage-bias-r), [performance model](performance-model.md): no total-reader denominator, no tool usage denominator and no full-navigation CWV. The validator's `external.consent-population` necessarily remains NOT VERIFIED. No BigQuery query can recover events never collected. |

## Audit against snapshot semantics

Scope read: `snapshot.mjs`, `validate-snapshot.mjs`, both targeted test files,
`__tests__/validation-fixture.mjs`, `__tests__/snapshot-fixture.mjs`, the nine model SQL files and shared bases,
[data-quality.md](data-quality.md), [dashboard-snapshots.md](dashboard-snapshots.md), and the model/metric docs.
The structural requirements, callers and fixtures need no change; no new runtime behavior, config or exports are
needed. Production numbers remain inaccessible to this audit.

- The nine-model contract, required columns, daily continuity, 30 thresholds, mature bounds, seven-day acquisition
  labels and weekly rotation agree with the current snapshot producer. `resultRows()` retains SQL output columns
  beyond the required-column list; their presence does not mean the validator checks them all.
- The reconciliation fixture aggregates synthetic events; the UI snapshot fixture deliberately has inconsistent
  article/category totals and is not reconciliation evidence. These tests do not execute BigQuery SQL. The command
  test's `Europe/Athens` value is a synthetic argument fixture, not the production time zone.
- The CLI already reads the key from the environment, not argv. Hidden entry with command-scoped assignment works
  without putting the literal key in shell history. **No key-input defect was proven; no code or regression-test
  change is needed.** Same-user/privileged process inspection can still read a process environment; use a trusted
  local terminal. Redaction is not a reason to run the validator in CI.
- `--redact` removes diagnostic details, but keeps dates, diagnostic counts, titles and actions; `--json --redact`
  also retains the report-level `counts`. Neither output is literally PASS/FAIL lines only. The sharing filter below
  emits only outcome and fixed check id; no CLI feature is needed.
- The original BigQuery note overstated how an `as_of=2026-10-29` snapshot closes the final cohort: carried pairs
  may refer to earlier days, and eleven of the 20 models are outside the snapshot allowlist.
- Cost-plan entries used `≤` on per-table planning floors and conflated the owner's run date with the reference
  report's extraction parameter. The first exact reference scan has 29 suffix dates, not 33. Real estimates must
  come from dry-runs; no planning figure here guarantees billed bytes.
- The original reference-comparison sentence omitted grain: the reference has a joint navigation/page/viewport
  breakdown, while model 30 groups only by coverage and metric. Zero consent/host exclusions alone cannot make
  those p75s comparable.

Factual corrections made alongside this guide:

1. `data-quality.md`: replace the unsupported reader-count description with low consented traffic; qualify key
   handling by hidden input/tracing, clarify residual redacted metadata, and link PASS/FAIL-only sharing.
2. `data-quality.md`: correct the 02/03 planning bounds and the reference extraction dates/table allowance.
3. `bigquery-validation.md`: qualify final-cohort coverage by each model's own window and the nine-model scope.
4. `bigquery-validation.md`: require identical reference scan bounds and matching grain; separate count agreement
   from p75 agreement. The historical owner-reported results are unchanged.

Local verification: the exact targeted `node --test scripts/intelligence/__tests__/validate-snapshot.test.mjs
scripts/intelligence/__tests__/validation-commands.test.mjs` run passed **32/32**, and `npm run test:intelligence`
passed **214/214**, with zero failures, skips or cancellations. The wrong-key error printed by the existing tests
is an expected negative case. All 63 local document links/anchors and the guide's `bash -n` syntax check passed.
A generated-key/synthetic-envelope self-check exercised the documented guide with hidden input substituted by
synthetic input: the sharing extract matched only fixed outcome/check-id lines and exit statuses 0/1/2 survived.
The interactive hidden prompt itself was not exercised; no production envelope was decrypted.

## Conditions for model comparisons

Use the exact event or observation unit, not display labels such as “sessions.” Both sides need the same mature
`start`, `end` and `as_of`/extraction cutoff, consent and host population, metadata/render commit where applicable,
and threshold configuration. Read each `modelWindows` entry before using the primary header dates: carried entries
have their own `asOf`, `start`, `end`, and shortened acquisition entries have their own `start`, `end`.
Missing models, incompatible dates or populations are NOT VERIFIED, never a fabricated PASS or mismatch.

| Models | Valid comparison | Conditions and limits |
| --- | --- | --- |
| [10](sql/models/10-article-pageviews.sql) / [11](sql/models/11-category-pageviews.sql) / [20](sql/models/20-daily-activity.sql) | Sum 10 article `page_view` events = sum 11; category totals agree per primary category. Article views ≤ sum 20 site page views. | Same primary window (≤ 28 mature days), `analytics_storage='Yes'`, primary HTTPS host. Editorial adds an article key, so it is a subset of the site population. Canonical/retired/unmapped mappings and render-time catalogue must agree. Neither count means unique readers; catalogue size is not traffic. |
| [26](sql/models/26-acquisition-session.sql) / [29](sql/models/29-audience-coverage.sql), with 20 | Sum 26 by event = 29 `site_events` for `session_start` and `page_view`; session gap classes reconcile. Compare each with 20 summed over **only the acquisition days**. | 26 is GA4 cross-channel session last click on events. 29's raw `events_in_tables` is not the kept population; use `site_events`. Snapshot acquisition is ≤ 7 days with the same mature end, not the entire 28-day primary total. Never sum first-user 24, collected-event 25 and session 26 scopes; never equate GA4 views with Search Console clicks. |
| [13](sql/models/13-article-discovery.sql) / [28](sql/models/28-internal-navigation.sql) | Article-destination `internal_page_click` events in 13 ≤ all internal clicks in 28, in total and by mapped source surface / link-section class. | Same weekly run or carried pair with identical original bounds and `asOf`. Map raw 13 `link_section` through 28's classifier first; fold unnamed source classes into `other`. 13 can resolve via `article_id`, so equality with 28's article-path destinations is not required. Clicks are not destination views, reconstructed journeys or causal evidence. |
| [30](sql/models/30-cwv-summary.sql) / [33](sql/models/33-rum-coverage.sql) | Sum 30 observations by coverage = 33 `coverage_distribution`; ratings sum to observations; pipeline stages remain consistent. | Both use `wv6.2.3-rum1`, highest revision then latest timestamp, the same navigation cohort/time zone and extraction cutoff. 33 scan events, eligible snapshots and resolved observations are different units; do not equate them. Keep all three coverage classes separate; CLS is native unitless, other p75s ms. If carried, both must retain yesterday's own dates. |

### RUM reference comparison

Earliest valid owner date: **2026-11-19**. For the first full cohort use:

| Setting | I-05 models 30 / 33 | Existing reference `report.sql` |
| --- | --- | --- |
| Cohort | `start_day=2026-10-19`, `end_day=2026-11-15` | `first_day=2026-10-19` (hard-coded 28 days) |
| Extraction | `as_of_day=2026-11-19` → cutoff 2026-11-15 | `as_of_day=2026-11-15`, **not** the owner run date |
| Scan start | 2026-10-18 (time-zone margin) | `deployment_day=2026-10-18` for identical scan bounds |
| Time zone | `America/Los_Angeles` | `report_timezone=America/Los_Angeles` |
| Version / coverage | official version; separate coverage classes | `version=wv6.2.3-rum1`, `coverage=all`, `navigation_type=all` (strata remain separate) |
| Floor | `min_observations=30` | apply the same interpretation floor to reference `samples` |

These are fixed comparison parameters even if the owner runs later. If later extraction cutoffs are chosen, both
queries must change together and their larger scans must be dry-run again. A carried RUM pair with an earlier
`asOf` is not this cohort. Do not create a missing pre-export margin table.

The reference has no consent or host filter. Require 33 to show no official-version consent/host exclusions over
the same scan before claiming matching populations; otherwise abstain. Check version, revision/conflict integrity
and native units as well. Only LCP/INP/CLS exist in the reference; FCP/TTFB are outside this comparison.

Sum reference `samples` across its disjoint navigation-type × page-group × viewport strata for each coverage/metric
and compare with 30's observation count (and 33's coverage totals across all five metrics only when appropriate).
Do not compare the three-metric reference total with 33's five-metric total. **Do not average or pool reference
p75s.** Exact p75 agreement can be checked only when there is one populated reference stratum for the corresponding
30 cell, or when separately reviewed work provides an identical-grain reference recomputed from observations.
With multiple strata the pooled p75 reference check stays NOT VERIFIED; matching counts do not close it. Model 31
also reports one dimension at a time, so it does not supply the joint reference grain automatically.

## Owner local validation

Use a trusted, non-recorded local terminal in your checkout. Use the existing encrypted
`dashboard/data/snapshot.json` (or pass a local encrypted-envelope path as the CLI's first positional argument).
No Google login or network is needed. Do not put a key, decrypted report, analytics number or query result in
chat, an agent prompt, a PR, CI logs or artifacts. Do not ask an agent to run this block with your key.

The following starts a clean Bash process from either Bash or zsh. `read` takes hidden input from the terminal,
not from the heredoc; the interactive shell records only the script, not the entered key. The key is an unexported
shell variable except for each validator child process. It is never a command argument or a literal assignment in
history. Tracing is disabled; the exit trap clears the variable. No key file or decrypted output file is created.

```sh
bash --noprofile --norc <<'OWNER_LOCAL_VALIDATION'
set +x
set +v
set -o pipefail
trap 'unset local_snapshot_key' EXIT
IFS= read -r -s -p 'Snapshot key (local only): ' local_snapshot_key </dev/tty || exit 2
printf '\n' >/dev/tty

# Review all outcomes/actions locally. This output is NOT the shareable extract.
DASHBOARD_SNAPSHOT_KEY="$local_snapshot_key" node scripts/intelligence/validate-snapshot.mjs --redact
local_validation_status=$?
if [ "$local_validation_status" -eq 2 ]; then exit 2; fi

# Only these PASS/FAIL lines may be shared; no details, dates, titles or counts.
DASHBOARD_SNAPSHOT_KEY="$local_snapshot_key" node scripts/intelligence/validate-snapshot.mjs --json --redact |
  node --input-type=module -e '
    let input = "";
    for await (const chunk of process.stdin) input += chunk;
    if (!input) process.exit(2);
    for (const { outcome, id } of JSON.parse(input).diagnostics) {
      if (outcome === "PASS" || outcome === "FAIL") console.log(outcome + " " + id);
    }
  '
OWNER_LOCAL_VALIDATION
```

The validator runs twice, offline and in memory. Exit status is 0 when no FAIL is found, 1 for a demonstrated FAIL,
2 if the file/key/envelope cannot be opened (the pipeline preserves a nonzero status). **Exit 0 is not full
validation**: inspect WARNING and NOT VERIFIED locally, and confirm each required comparison ran at the intended
model dates. The filtered extract deliberately omits those outcomes; it is not a complete report and must never
be described as “all checks passed.” Share only lines such as `PASS articles.totals` or `FAIL acquisition.coverage`;
keep all headers, summaries, JSON, errors, screenshots and diagnostic details local. Private review can use the
unredacted CLI report in the terminal if needed, never redirected or uploaded.

Hidden prompting is preferred. If a key is already held in a local file, keep it outside every repository with
mode `600` and a private parent directory; read it into the same unexported variable without printing it. Do not
create a key file in this worktree, use a literal key in argv/env assignments, or save one to a shell startup file.

## Existing owner checks, billing and scan bounds

These are a plan for the owner, **not authorization for an agent or CI to execute queries**. Use the owner's own
account, never the workflow service account. The existing [owner commands](bigquery-validation.md#owner-commands-free-metadata-and-dry-runs-only)
generate only free dry-runs. Rendering SQL locally is also free. Execute a billable query only after its real
dry-run and owner cost review, with the existing cap. No SQL, schedule, workflow or cost guard is added here.

| Item | Existing command / SQL | Billable? | Scan bound and comparison with 400 MiB cap | Earliest valid owner date |
| --- | --- | --- | --- | --- |
| Dataset location, schema | `bq show --format=prettyjson f1-stories-analytics:analytics_485678890`; `bq ls`; `bq show --schema` from [owner commands](bigquery-validation.md#owner-commands-free-metadata-and-dry-runs-only) | No; metadata API calls | Zero event tables; inspect schema on every relevant table if compatibility is uncertain | Now; final-window evidence after 2026-10-29 |
| Gaps, late updates, suspected partial tables | [01-export-tables.sql](sql/01-export-tables.sql), `start_day=2026-10-19`, `end_day=2026-10-25`; per-day `bq show` as in [quality plan](data-quality.md#optional-bigquery-checks-plan-only-nothing-executed) | No, metadata only | Zero event tables; no scan allowance needed. Presence/modification metadata cannot prove collection completeness | 2026-10-29 for a mature 19–25 Oct record |
| Field types, host/path and click classification | [02-event-inventory.sql](sql/02-event-inventory.sql), exact seven-day parameters above | Dry-run no; execution yes | ≤ 7 daily suffixes, no intraday. 70 MiB conservative per-table planning allowance, **not a measured upper bound**; existing execution cap `104857600` (100 MiB), below 400 MiB | 2026-10-29; query itself has no maturity guard |
| Version/id/revision/conflict integrity | [03-web-vital-integrity.sql](sql/03-web-vital-integrity.sql), same seven-day parameters | Dry-run no; execution yes | ≤ 7 daily suffixes; same planning allowance and 100 MiB execution cap as 02 | 2026-10-29; query itself has no maturity guard |
| Final 20-model check, consent/host and all classification unknowns | Existing `editorial-model.mjs dry-run-command all` and `render`, [model parameter matrix](bigquery-validation.md#phase-1-parameters), [production checks](bigquery-validation.md#production-data-checks); 15/29/33 are coverage companions | Render/dry-run no; execution yes | At fixed 19–25 Oct / `as_of=2026-10-29`: 7 suffixes per editorial/audience model; 8 per RUM model including pre-export margin. Planning allowances 70 / 80 MiB per query; existing manual cap 100 MiB is below 400 MiB. 32 needs `day` and `week` separately | 2026-10-29; min parameters 30, RUM time zone `America/Los_Angeles` |
| Full reference and matching 30/33 | [report.sql](../../perf/rum-pilot/report.sql), existing render/dry-run helper for 30/33; [exact parameters above](#rum-reference-comparison) | Dry-run no; execution yes | First cohort: 29 suffix dates for each query, including the margin. Conservative allowance 290 MiB each; use the existing full-window cap `419430400` (400 MiB), not the earlier seven-day 100 MiB cap. Actual bytes NOT VERIFIED | **2026-11-19**, never earlier |
| Stream identity / non-consenter denominator / sample accumulation | GA4 Admin / no query / existing models only | No BigQuery job for Admin or an unmeasurable denominator | No extra diagnostic SQL. Samples cannot be purchased into existence | Admin now; denominator unavailable by design; 30 observations has no guaranteed date |

For 02/03 and metadata SQL, replace only the documented project/property placeholders on the owner's machine;
use EU Standard SQL and the named date parameters. Their templates are not rendered by the model CLI. The adapted
inventory's historical byte estimate is not an estimate for repository 02. Record exact scan bounds and dry-run
bytes privately; stop if a query exceeds its stated cap. Never raise the cap, widen dates or rerun billable work
automatically to get a passing result.

The snapshot's **400 MiB per query / 1600 MiB per refresh** safeguards and seven-query rotation remain unchanged.
Manual `bq` commands do not inherit that preflight or daily accounting. Count manual work alongside scheduled
work in the owner's budget review; do not turn `all` into an unattended billable batch. A full-window normal
snapshot already plans 1560 MiB, so do not assume room for validation queries in that allowance. The EUR 10 alert
is not a hard total-cloud cap. All new query bytes in this plan remain NOT VERIFIED until actual dry-runs.

## Ordered owner checklist

1. **Now (2026-10-29):** confirm the GA4 stream locally in Admin. Keep confirmation evidence private; do not export
   credentials or production analytics to this public repository. Check the public snapshot header period before
   entering the key; this baseline ends 24 Oct, not 25 Oct.
2. **After the property day becomes 2026-10-29:** the 19–25 Oct cohort is mature. In the normal schedule its
   `as_of=2026-10-29` snapshot is expected at the **2026-10-30 03:00 Athens** run; delays can change that. Obtain the
   existing encrypted snapshot on your machine without dispatching another refresh. If its `asOf` or per-model
   windows differ, validate what it contains but leave the exact seven-day item open.
3. **With that encrypted snapshot available:** run the hidden-prompt local guide. Inspect all outcomes locally,
   including each carried pair's original bounds. A FAIL blocks editorial conclusions for the affected section;
   follow WARNING actions and leave NOT VERIFIED explicit. Review carried labels in the existing dashboard locally.
   Share only sanitized PASS/FAIL check lines; never publish metric values or the complete report.
4. **On/after 2026-10-29, before billable work:** use free metadata/schema checks and dry-run every outstanding
   exact query. Apply the cost table and stop for missing/partial tables, schema errors or excessive bytes. Owner
   approval of that concrete cost review is required by the existing [optional-check plan](data-quality.md#optional-bigquery-checks-plan-only-nothing-executed).
5. **After that review:** run repository 02 and 03 as written once, then the existing final-window models still
   missing evidence (all 20 are required for the broader closeout, not all nine snapshot models at today's header
   dates). Use fixed `as_of=2026-10-29`, thresholds 30 and the confirmed time zone; run 32 for day/week. Retain SQL
   revision, parameters, private aggregates and byte records locally. Resolve or explain consent/host exclusions,
   missing fields, unknown classes and integrity findings. Do not promote models using execution logs alone.
6. **Over following weeks:** let samples accumulate without lowering 30. Continue to abstain when samples are too
   small. Exact reconciliations can pass at small counts; that does not make an editorial before/after comparison
   causal or stable. No date guarantees enough LCP/INP observations in every coverage cell.
7. **On/after 2026-11-19:** review and run the first mature 28-day reference comparison using the exact parameters
   and cost bounds above. A corresponding scheduled snapshot would normally arrive **2026-11-20 03:00 Athens**;
   carried RUM may still refer to an earlier cohort. Record count agreement separately from any eligible p75 check;
   multiple reference strata leave pooled-p75 agreement NOT VERIFIED.
8. **Close only evidenced items:** keep a private record of snapshot identity, model windows, query parameters,
   checks actually run and unresolved limitations. The public follow-up contains only PASS/FAIL check lines without
   numbers. No production validation claim is added by this document; the broader outstanding items remain open
   until their specific evidence exists. No workflow integration or dashboard redesign is needed for this task.
