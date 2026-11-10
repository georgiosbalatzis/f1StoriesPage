# P-01 handoff

| Baseline | Pinned code SHA |
|---|---|
| Main | `58273df6d753510605468c0787d9cdf04d6d398e` |
| Telemetry | `38c3dd2018b810a5dce1add1f7663bcb199c845a` |
| Ghost Car | `13fc12afb7c73ccbab6e71fc3d3210d922038d51` |
| TYRES | `249aa796a1981be4f70213c9f1973b4418faf3ca` |
| BetCast | `74eeb98b4acb1b4e0ea45d4ab12f7fdf4e0c2650` |

**Evidence date:** 2026-11-10 UTC. **Scope:** exact proposed P-02 entry point, evidence/check status and remaining coordinator/reviewer delivery duties. This report-writing pass ran no browser, localhost process, build or network request. It writes four new reports only and leaves the four existing reports unchanged.

**Evidence key:** `M:path:line` refers to Main at the pin above; child prefixes use their named pins. Identities/units: [baseline.json](../../perf/p01/baseline.json), [README](../../perf/p01/README.md); methods/counts: [matrix.json](../../perf/p01/matrix.json), [summary.tsv](../../perf/p01/summary.tsv); decisions: [findings.json](../../perf/p01/findings.json); checks/gates: [checks.tsv](../../perf/p01/checks.tsv), [gates.json](../../perf/p01/gates.json). `EV-*` resolves in `local-bundle:p01-evidence.tar.gz#work/s1/evidence-receipts.json`; [evidence-index.json](../../perf/p01/evidence-index.json) supplies entry hashes and retrieval status.

**Limitations:** local per-attempt identity is incomplete; useful-app/interaction coverage is limited; benchmark Lighthouse/screens are n=1. Field INP/CWV are unavailable. Existing check results below were read from retained evidence, not rerun here. Compact data links were checked in the integrated 3dca15331 review; later changes require their own review. Final PR scope, bundle retention, cleanup and Gate F review are not attested by these documents. Every unmeasured saving is **TBD — requires P-0X measurement**.

## Exact P-02 entry point

**Reproduce the three-path build:check drift first; then restore generated-output coherence and Blog calendar contrast, with a tooling-only repair of Lighthouse measurement prerequisites.** Start at the reviewed Main pin above, or explicitly rebaseline a later authorized SHA. P-01 does not begin P-02.

These are bounded quality defects: three generated paths drift, and six empty-month labels fail contrast in each of three Gate E runs. Runtime targets S-02/S-04/S-05 are supported investigations with unproved mechanisms; they follow in P-03/P-04. Their higher numeric scores do not override prerequisite gate recovery. See the [backlog](p01-prioritized-backlog.md).

Keep three changes independently reviewable and reversible:

| Change | Exact edit/addition scope | Inspection entry point at the baseline | Acceptance |
|---|---|---|---|
| A. Tooling-only measurement repair | Proposed additions `scripts/perf/p01-rate-safe-lighthouse.mjs` and `scripts/perf/p01-rate-safe-lighthouse.test.mjs`; reuse installed browser/CDP dependencies | `M:scripts/perf/lighthouse-guard.mjs:45` argument handling and `M:scripts/perf/lighthouse-guard.mjs:373` request rule; retained `work/a0/bench.mjs`, `provider.mjs`, `extra-phases.mjs` | Successful exact provider fixtures before relevant audited-page/frame/worker requests; fail closed on misses. Assert actual audited theme/viewport/consent/SW/analytics/required metrics and target identity. Preserve evaluator/budgets and real first-party assets. |
| B. Generated coherence, S-03 | Review generated changes only in `index.html`, `scripts/author/research-catalog.json`, `standings/index.html` | `M:scripts/build/generated-drift-guard.mjs:15`; `M:scripts/build/author-research.mjs:6`; `M:blog-module/build/home-panels.js:153`; `M:blog-module/build/home-panels.js:163`; `M:scripts/build/stamp-html.mjs:252` | Owner-approved data cut; normal generation; two final clean Node 22 builds each leave zero tracked drift and build:check exits 0. No guard exemption. |
| C. Scoped calendar contrast, S-01 | `blog-module/blog/archive-editorial.css`; normal generated derivative `blog-module/blog/archive-editorial.min.css`; expected hash stamps in the 40 consumers below | `M:blog-module/blog/archive-editorial.css:125`; calendar generation `M:blog-module/build/discovery.js:242`; existing `M:scripts/perf/edition-qa.mjs:1` | Every empty-month label ≥4.5:1, light/dark at 390/768/1440; Blog accessibility ≥98 in three clean canonical-route runs; preserve content/links/empty semantics/keyboard/layout. |

No current evidence requires a generator/drift-guard rewrite. First regenerate from approved tracked inputs. A newly isolated generator or product defect requires a separately reviewed scope change; do not alter inputs, thresholds or exemptions to hide it. `scripts/build/asset-manifest.json` is normal ignored generated output; do not newly track it.

### Exact stylesheet-hash consumers

These **40 existing HTML files** reference archive-editorial at the pinned SHA. Only the normal stylesheet hash stamp is within change C's expected scope. `M:path:line` identifies the existing link; line numbers can move during authorized generation. Refresh this list if starting from a different SHA. The source CSS/minified derivative, three B outputs and two proposed tooling files above are separate from these consumers.

- `M:blog-module/blog/archive/2025/03/index.html:37`
- `M:blog-module/blog/archive/2025/04/index.html:37`
- `M:blog-module/blog/archive/2025/05/index.html:37`
- `M:blog-module/blog/archive/2025/06/index.html:37`
- `M:blog-module/blog/archive/2025/07/index.html:37`
- `M:blog-module/blog/archive/2025/08/index.html:37`
- `M:blog-module/blog/archive/2025/09/index.html:37`
- `M:blog-module/blog/archive/2025/10/index.html:37`
- `M:blog-module/blog/archive/2026/02/index.html:37`
- `M:blog-module/blog/archive/2026/03/index.html:37`
- `M:blog-module/blog/archive/2026/04/index.html:37`
- `M:blog-module/blog/archive/2026/05/index.html:37`
- `M:blog-module/blog/archive/2026/06/index.html:37`
- `M:blog-module/blog/archive/2026/07/index.html:37`
- `M:blog-module/blog/archive/2026/08/index.html:37`
- `M:blog-module/blog/archive/2026/09/index.html:37`
- `M:blog-module/blog/archive/2026/10/index.html:37`
- `M:blog-module/blog/archive/2026/11/index.html:37`
- `M:blog-module/blog/archive/index.html:37`
- `M:blog-module/blog/entities/drivers/lando-norris/index.html:38`
- `M:blog-module/blog/index.html:39`
- `M:blog-module/blog/section/analysis/index.html:38`
- `M:blog-module/blog/section/analysis/page/2/index.html:38`
- `M:blog-module/blog/section/betting/index.html:37`
- `M:blog-module/blog/section/drivers/index.html:38`
- `M:blog-module/blog/section/drivers/page/2/index.html:38`
- `M:blog-module/blog/section/history/index.html:38`
- `M:blog-module/blog/section/history/page/2/index.html:39`
- `M:blog-module/blog/section/history/page/3/index.html:39`
- `M:blog-module/blog/section/history/page/4/index.html:38`
- `M:blog-module/blog/section/news/index.html:38`
- `M:blog-module/blog/section/news/page/2/index.html:39`
- `M:blog-module/blog/section/news/page/3/index.html:39`
- `M:blog-module/blog/section/news/page/4/index.html:39`
- `M:blog-module/blog/section/news/page/5/index.html:39`
- `M:blog-module/blog/section/news/page/6/index.html:38`
- `M:blog-module/blog/section/opinion/index.html:37`
- `M:blog-module/blog/section/teams/index.html:37`
- `M:blog-module/blog/section/technical/index.html:38`
- `M:blog-module/blog/section/technical/page/2/index.html:38`

Full edit/inspect/ignored classifications remain in `local-bundle:p01-evidence.tar.gz#work/s1/p02-files.tsv`. The budget files, source lock, generators and existing guard are read-only inspection targets unless a later defect is separately substantiated.

## Prerequisites and owner decisions

Before P-02 implementation, the owner selects the authoritative tracked season/data cut and approves review of the generated round19→round20 changes. The audit explains observed drift; it does not independently decide sporting correctness. Approve the concrete three-change scope above, including the small tooling helper. P-01 authorization alone is not permission to implement it.

The coordinator must retain original failure evidence; prepare separate untouched reproduction and implementation contexts; freeze Main and aggregate artifacts independently; and record code/data/browser/Node/digest identity before and after each future series. Code pins do not freeze API or refreshed TYRES data. The observed local TYRES data SHA is `dbc69155aaa8e8c2af3556ef02ba18d54ad0ba0c`; preserve its separately refreshed overlay identity (`M:scripts/deployment/sources.json:1`; EV-MANIFEST).

Prepare complete successful local fixtures for exact provider queries exercised by all four Gate E routes and their frames, including the Jolpica race list. Fail closed on missing body/status/hash/query matches. Round17 recordings cannot certify round20 standings journeys. Record audited-page state and actual analytics transport; storage seeded on a separate page is insufficient. Consent stays ungranted, and no sign-in, form submission or dashboard decryption is permitted.

Main-only and aggregate need separate origins/identities/results. For aggregate embeds, use comparable same-origin local delivery or explicitly isolate the origin experiment without changing canonical URLs or request-count rules. Manifest outputDigest and complete-tree hash are different scopes/algorithms; a differing string does not alone prove mutation. Historical local attempts cannot be retroactively certified.

Owner decisions for later phases remain separate: child repository/release and Main pin changes; API/provider/cache freshness policy; visible image fidelity; historical URL/embed contracts; shell/runtime/repository boundaries; and CI build-sharing architecture. No new runtime dependencies, credentials, tracking or loosened budgets are proposed.

## Acceptance metrics and check sequence for P-02

These are future acceptance requirements, not results obtained by this report.

1. Preserve the original evidence and identify the starting source/toolchains. Reproduce drift in an isolated baseline context. After approved output/CSS changes are reviewed, **two final clean Node 22 builds must each leave zero tracked generated drift and build:check exit 0**. Keep incremental/deployment assertions; no generated exemptions.
2. Each failing label must have **contrast ≥4.5:1**, both themes, 390/768/1440. Canonical Blog accessibility must be **≥98 across three clean runs**. Retain calendar content/links/empty semantics, keyboard/focus and layout; run Edition and tablet checks.
3. Runtime audits must pass on **both separately identified Main and aggregate**. Assets/static/size/deployment/incremental checks retain their assertions. Keep expected generated CSS/hash stamps reviewable and unrelated product/content/SEO changes out.
4. Run the unchanged Lighthouse guard through the verified rate-safe helper: **three runs per canonical route** (`/`, `/blog-module/blog/index.html`, `/standings/`, latest article resolved from the frozen index). Run Main first; aggregate is a separately labelled target. Every previously blocked assertion must receive a real pass/failure. A clean new product failure requires its own reviewed fix or an explicitly incomplete phase, never a masked result.
5. Helper self-checks must cover exact fixture match/miss refusal, successful status/body delivery, actual audited-page assertions, denied-consent detection, null bytes, per-target identity and unchanged threshold evaluation. Reuse the existing runner/dependencies.

Preserve the exact budget files. SHA-256 for `perf/lighthouse-budget.json` is `61680ea406e95116bbe7676522d7fc6f887bb377cdbbfb1d560272d92f58a434`; for `perf/size-budget.json`, `b68b9784a68236f3124401e557960d2d9c0f5a066bef932543998e0cf30bc05e`. Common lab thresholds: performance/accessibility/best-practices/SEO **95/98/100/100**, LCP **≤2500 ms**, CLS **≤0.02**, TBT **≤100 ms**, third-party requests **≤8**; route-specific DOM/JS/external-CSS/raw-inline-CSS and independent graph limits stay as stored (`M:perf/lighthouse-budget.json:1`; `M:perf/size-budget.json:1`; `M:scripts/perf/size-guard.mjs:170`). No time/byte gain is promised: **TBD — requires P-0X measurement**.

## Reproduction commands and toolchains

Commands below are instructions for an authorized coordinator in disposable contexts, not commands executed in this report pass. Work from the pinned source and extracted evidence; bind `P01_*` variables to the owner's chosen locations. No workstation path is part of the public contract. Use isolated outputs and capture each command's exit/log independently.

| Tool / environment | Recorded identity / requirement |
|---|---|
| Host | Apple M3 Pro, arm64, 36 GiB RAM, Darwin 27.0.0; battery/thermal/contention limits remain recorded |
| Main, Telemetry, Ghost Car, BetCast build/check | Node 22.23.4; CI default major 22 (`M:.github/actions/setup/action.yml:19`) |
| TYRES aggregate build | Node 24.22.2, code/data identity separate (`M:scripts/deployment/release.mjs:77`) |
| Host/collector provenance | Host/default Node: 26.13.0; retained collection runner selects Node 22.23.4; actual collection-process Node was not captured per attempt and is unverified. |
| Browser | Chrome for Testing 158.0.8127.18, SHA-256 `6ac929cf1af41969ed0de43ac88a015ae4b70f92dcc1bfb60871bfa7f141e96d`; set `CHROME_PATH` to the verified executable |
| Locked QA packages | Lighthouse 13.6.0, playwright-core 1.65.0, puppeteer-core 25.16.0, chrome-launcher 1.2.3; use existing lockfile (`M:package-lock.json:2847`; `M:package-lock.json:3400`; `M:package-lock.json:3432`; `M:package-lock.json:2151`) |
| Offline analysis | Python 3 standard library, Git for pinned source reads; no Python package install needed |
| CDP profile | 390×844/DPR3 mobile, 768×1024/DPR2 tablet, 1440×900/DPR1 desktop; 150 ms, 200000 B/s down, 93750 B/s up, CPU ×4 |
| Lighthouse profile | Separate simulated 150 ms RTT/1600 Kbit/s/CPU ×4; benchmark n=1 diagnostics differ from existing Gate E n=3 mobile medians |

### Offline evidence verification

Keep the original archive immutable and outside git. In an extracted disposable review copy, bind `P01_REVIEW` to its root and `P01_SOURCE` to a clean checkout at the Main baseline; `P01_BUNDLE` and `P01_SITE_BUNDLE` name the two retained archives. Verify the archive's owner-recorded checksum and receipt entry hashes before analysis.

```sh
mkdir -p "$P01_REVIEW"
tar -xzf "$P01_BUNDLE" -C "$P01_REVIEW"
tar -xzf "$P01_SITE_BUNDLE" -C "$P01_REVIEW"
git -C "$P01_SOURCE" rev-parse HEAD
git -C "$P01_SOURCE" status --short
python3 "$P01_REVIEW/work/g/analyze-lighthouse.py" \
  "$P01_REVIEW/evidence/gate-lighthouse" \
  > "$P01_REVIEW/lighthouse-recomputed.json"
```

The retained synthesis scripts bind one capture-machine `SOURCE` assignment. The following changes only that binding **in memory** to the chosen pinned checkout, preserving their checks/calculations. It writes recomputed outputs beside the scripts in the disposable extraction; retain the original archive/receipts. The full local-site tree and listed duplicate files are prerequisites, not optional inputs.

```sh
python3 - <<'PY'
import os, pathlib, re, subprocess
review = pathlib.Path(os.environ['P01_REVIEW']).resolve()
source = pathlib.Path(os.environ['P01_SOURCE']).resolve()
baseline = '58273df6d753510605468c0787d9cdf04d6d398e'
assert subprocess.check_output(
    ['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True
).strip() == baseline
for name in ('recompute.py', 'synthesize.py'):
    script = review / 'work' / 's1' / name
    code, replacements = re.subn(
        r'^SOURCE = pathlib\.Path\(.+\)$',
        'SOURCE = pathlib.Path(os.environ["P01_SOURCE"]).resolve()',
        script.read_text(), flags=re.M
    )
    assert replacements == 1
    exec(compile(code, str(script), 'exec'), {
        '__file__': str(script), '__name__': '__main__', 'os': os
    })
PY
```

Admission is the **354 retained attempt IDs**; do not admit the other 73 runs or discarded attempts. Assertions verify null handling, n=5 primary cells, medians, aliases/scores, listed duplicate hashes and saved Gate E audits. They do not prove fixture completeness, archive-search completeness, final PR safety or field performance.

### Existing build/check entry commands

Put Node 22.23.4 first on the process path, set the verified browser executable where required, and use an isolated baseline checkout. These existing commands are defined at `M:package.json:9`. Builds regenerate tracked output; preserve the failure diff outside git instead of committing it in P-01. Record failures independently so build:check exit 1 does not erase the later check results.

```sh
cd "$P01_SOURCE"
node --version
npm ci --no-audit --no-fund
npm run build:icons
npm run build:bootstrap
npm run build:assets:minify
npm run build:public
npm run build:check
npm run check:assets
npm run quality:static
npm run audit:runtime
npm run perf:budget
npm run test:deployment
npm run test:incremental -- --ref 58273df6d753510605468c0787d9cdf04d6d398e
```

For an authorized P-02 branch, the incremental `--ref` becomes its approved prechange SHA. Main and aggregate runtime audits need separate disposable repository contexts whose `dist/` contains the frozen target. The audit resolves dist relative to its script, with no arbitrary-root CLI (`M:scripts/quality/runtime-audit.mjs:10`):

```sh
(cd "$P01_MAIN_CHECKOUT" && npm run audit:runtime)
(cd "$P01_AGGREGATE_CHECKOUT" && npm run audit:runtime)
```

After helper A has verified successful-response interception, it must orchestrate these unchanged guard invocations with the chosen Main/aggregate snapshots, `CHROME_PATH` and separate external output directories:

```sh
npm run perf:lighthouse -- --root "$P01_MAIN_ARTIFACT" \
  --output-dir "$P01_EVIDENCE/gate-main" --keep-json
npm run perf:lighthouse -- --root "$P01_AGGREGATE_ARTIFACT" \
  --output-dir "$P01_EVIDENCE/gate-aggregate" --keep-json
npm run qa:edition
npm run perf:cls-tablet
```

**A clean rate-safe Gate E replay is not yet supported by an existing verified helper.** Those browser commands are conditional on helper A and audited-page state verification, not permission to run unrestricted providers or use the previous DNS failures as a successful fixture. The helper filenames are proposals, not implemented commands. Edition/tablet checks also need the same safe fixture discipline.

### Retained runtime collector

Use `local-bundle:p01-evidence.tar.gz#work/a0/` and its README/matrix with the captured fixtures and `work/e/app-probes.json`. The retained `bench-run.sh` contains machine-specific bindings; use the underlying collector with explicit paths and capture its actual process exit status. This portable cold-series invocation shows the existing interface:

```sh
node "$P01_REVIEW/work/a0/bench.mjs" \
  --environment production --phase cold \
  --repo "$P01_SOURCE" --chrome "$CHROME_PATH" \
  --matrix "$P01_REVIEW/work/a0/matrix.json" \
  --probes "$P01_REVIEW/work/e/app-probes.json" \
  --fixtures "$P01_REVIEW/evidence/fixtures" \
  --evidence "$P01_NEW_EVIDENCE"
```

The intended protocol listed `record`, `pilot`, `cold`, `screens`, `warm`, `interactions`, `real`, `offline`, `lighthouse`, `summarize`. The executed full series ran local-built first, then production: cold, screens, warm, interactions, offline, Lighthouse and real; later Lighthouse and interaction reruns also ran local-built then production. See [methodology deviations](p01-runtime-baseline.md#methodology-deviations) and retained `run-all-series.sh` and `run-rerun.sh`. For local-built, use `--environment local-built --origin "$P01_LOCAL_ORIGIN"` with the same paths and a frozen artifact served by retained `serve-artifact.mjs --root <artifact> --port <chosen-port>`; terminate the task-owned server afterward. Do not overwrite original evidence. Revalidate a current live release and split changed identities; a future collection is not the original baseline. Preserve collection Node identity, fixtures/replay/unknown status, consent denial and provider rate/stop rules. Fix readiness/identity/context gaps before using new data for acceptance.

## Gate A–F position

These are evidence assessments, not an independent verdict or a claim that all P-01 completion criteria are met.

| Gate | Current position | Evidence / remaining duty |
|---|---|---|
| A — Baseline integrity | RECORDED WITH LIMITATIONS | Main/child pins, source lock, budgets, historical audits and supplied initial clean audit status recorded. Local ref named main was different; use pinned SHA. Local attempt identities lack complete bracketing. Coordinator verifies final integration provenance. [baseline.json](../../perf/p01/baseline.json) |
| B — Measurement integrity | PARTIAL; GAPS EXPLICIT | Eleven routes covered; 8 primary × 2 devices × 5 CDP samples/environment; cold/warm/API/screens/Lighthouse separate. Readiness, round fixtures, interaction assertions, n=1 escalation and field data remain open. [matrix.json](../../perf/p01/matrix.json), [runtime baseline](p01-runtime-baseline.md) |
| C — Codebase coverage | MAPPED WITH LIMITATIONS | Main/shared runtime/CSS/data/publishing and four children mapped. Dead-code candidates classified; exhaustive cascade/dynamic reachability and emitted-library attribution not proved. [inventory](p01-codebase-inventory.md), [ledger](p01-redundancy-ledger.md) |
| D — Correctness and safety | REPORT PASS SCOPE LIMITED; FINAL DIFF CHECK PENDING | This pass adds four reports, preserving four existing files; no product changes, deletion, URL/SEO/consent/dependency/workflow/budget changes, Git mutation or deployment. Coordinator/reviewer must verify the full integrated allowlist and public-safe data before delivery. |
| E — Reproducibility | MIXED; NOT ALL GREEN | Named checks below retain PASS, BASELINE FAILURE and BLOCKED outcomes. Runtime audit passed on Main and aggregate. Generated drift and Blog contrast fail; seven other Lighthouse assertions are blocked for clean attribution. |
| F — Independent review | **APPROVED WITH FINDINGS** | First review: CHANGES REQUIRED at 6e252ae8d; correction 3dca15331 was APPROVED with zero findings. The later digest and README changes at 7af4622ae were not covered; delta review at 7af4622ae7d7321c6315c1c4ede99011af2ff4d8. The closure commit requires its own final review, recorded in the PR #461 description. |

## Checks summary

These are retained baseline results at the Main pin under Node 22.23.4; this pass ran none. The initial pre-launch Lighthouse block remains historical; the subsequent guarded command ran and exited 1. No NEW FAILURE is established by report writing, and no required named check is silently marked NOT APPLICABLE.

| Command / assertion | Exit / classification | Evidence and practical limit |
|---|---|---|
| `npm ci --no-audit --no-fund`; icons/Bootstrap/minify preparation | 0 each / PASS | `evidence/gate-logs/{install,icons,bootstrap,minify}.log`; second install also PASS |
| `npm run build:public` | 0 / PASS | Main-only, 23.923 s, n=1; not remote aggregate build time |
| `npm run build:check` | 1 / **BASELINE FAILURE** | Three paths, 60+/60−; independent cold incremental build repeats paths, no second exact diff |
| `npm run check:assets` | 0 / PASS | Retained assets.log |
| `npm run quality:static` | 0 / PASS | Retained static.log |
| `npm run audit:runtime`, Main | 0 / PASS | Main tree `sha256-tree-v1:e4783025995f00ce2616d28b668ad5dbf6e883462be9324e019404fe198aef3e`; runtime-main.log |
| `npm run audit:runtime`, aggregate | 0 / PASS | Separate frozen aggregate log, 03:23:10–03:23:11 UTC; log itself has no cryptographic target digest |
| `npm run perf:budget` | 0 / PASS | Current budget.log; historical overage counts do not replace it |
| `npm run test:deployment` | 0 / PASS | Retained deployment.log |
| `npm run test:incremental -- --ref <baseline>` | 0 / PASS | Assertions passed independently of cold build's recorded drift |
| `npm run perf:lighthouse` | 1 / **BLOCKED command with mixed assertions** | Three runs/four canonical routes, guarded aggregate; contrast BASELINE FAILURE, seven other failed assertions blocked as below |
| Additional P-02 helper/Edition/tablet checks | NOT RUN in this report pass | Future acceptance work, not a current PASS or a silent Gate E waiver |

| Failed Lighthouse assertion | Observation, n=3 | Classification |
|---|---|---|
| Four route best-practices assertions ≥100 | 96/96/96 on Home, Blog, Standings, Article | Four BLOCKED product attributions: wrapper-induced Jolpica DNS console error |
| Blog accessibility ≥98 | 96/96/96, six contrast nodes/run, 3.58:1 vs 4.5:1 | **BASELINE FAILURE**, independent of provider guard |
| Home LCP ≤2500 ms | 2627.098/2873.889/2626.307 ms; median 2627.098 | BLOCKED clean attribution under guarded local aggregate/simulated delivery |
| Article LCP ≤2500 ms | 2554.348/2732.991/2551.550 ms; median 2554.348 | BLOCKED clean attribution under same setup |
| Article third-party requests ≤8 | 14/14/14; ten production-origin BetCast requests external to loopback | BLOCKED normal-delivery assertion; failed provider still counted; subtraction is not a rerun |

The aggregate runtime PASS supersedes G's earlier “not run” narrative. Benchmark Lighthouse remains **n=1 with providers blocked**, separate from these gates. Standings pit-stops/session remain **NOT MEASURED**, not failed product interactions or zero latency. Field INP and Core Web Vitals remain unavailable. [checks.tsv](../../perf/p01/checks.tsv) must carry the reconciled aggregate result.

## Evidence retention and public delivery

**Evidence retrieval:** obtain both archives from the owner outside git: `p01-evidence.tar.gz` (SHA-256 `4b700e8c42095443afee1ce21e6b228965651b85a483f3632a6d0bf0ab5ccaac`, bytes `153982635`) and `p01-local-site.tar.gz` (SHA-256 `5dcaa188c862e7252b687219698014411be2d70185e46d8f8dd6bcba2293083e`, bytes `296448112`). Extract both into the same fresh root R; the latter supplies `evidence/local-site`. Verify both archive hashes and run `python3 R/work/data/verify-bundle.py R CHECKOUT`, using the extraction root and a checkout containing `docs/performance` and `perf/p01`. For repackaging from an extraction, copy the coordinator-written `evidence-bundle.json` into R; it is not an archive member. The index records the archived evidence members and grouped digests. Two archives are kept outside git on the owner’s machine, with one known copy; independent backup status: BLOCKED — no independent backup destination; one known copy on the owner's machine. Retention and verification remain coordinator duties; do not remove original evidence before verification succeeds.

| Required retained entry | SHA-256 |
|---|---|
| `evidence/attempts.jsonl` | `0133e6720dac62640ab2c77c049883a019e44607c794ef2b7b571926c97a8a35` |
| `evidence/network.tsv` | `d826236a2582c614900495eeef69fc50bd7f8c640bc37cb3dfa59e9066897336` |
| `evidence/gate-build-check-drift.diff` | `de83f1ba190f3b22e6ba26d3f1437f7a921afc37ca1ee5895b5b05826cc8691f` |
| `evidence/gate-logs/runtime-main.log` | `e48091e83d4082c519c7e4e709736f739d01ff1c7aa1f8e2f5a42110e81387df` |
| `evidence/gate-logs-aggregate/runtime-aggregate.log` | `7773f7ded15201857f20849b8abe9495795c386d72a849ee37694cb61abf2191` |
| `evidence/gate-logs-lh/lighthouse.log` | `427803585f8e10545a38c5f2a05a6770c6f3a244ce769f63da7daded008788cb` |
| `work/f/duplicates.tsv` | `3b02a6621f1e3765b23d3998121eb720407359cb5b9bdf8838dca31100190e81` |

Do not commit raw evidence, dist/.build/node_modules, toolchains/browser binaries, child clones, caches/profiles or large file inventories. Preserve executable reproduction inputs outside git where scripts require them; a compact table alone cannot rehash absent media. Check public data for personal/contact/commercial information and absolute machine paths; partners appear only as P1–P6. Do not publish raw logs merely because the repository is public.

The 3dca15331 review checked integrated compact data, aliases and links; the coordinator must verify any later changes and final delivery. Plan guidance is ≤2 MiB total uncompressed new compact data, target ≤1 MiB, ≤256 KiB/file; this is audit artifact hygiene, not a relaxed product budget. This workspace intentionally contains reports only, so those targets are not verified here. Retain full evidence externally rather than silently truncate measurements to fit.

## Scope, delivery and cleanup

This pass adds `p01-redundancy-ledger.md`, `p01-risk-register.md`, `p01-prioritized-backlog.md` and this handoff under `docs/performance/`. The executive summary, runtime baseline, codebase inventory and build pipeline reports remain unchanged. No production behavior, article/media, canonical/redirect/SEO, analytics/consent, dependency, architecture, workflow or budget change is part of P-01. No source is deleted; no sibling repository is changed. No commit, push, PR mutation, merge or deployment is performed by this pass.

For final coordinator delivery, inspect the full diff/status, include only intended P-01 documentation/compact evidence and any separately justified read-only tooling, and exclude generated product drift. Confirm the dedicated `audit/p01-performance-baseline` branch, base main and actual PR head SHA. The requested one Draft PR title is `perf(audit): P-01 performance X-ray and codebase baseline`. PR #461 exists; its final head and remote status require coordinator verification. Preserve the exact visible statement:

**DRAFT — AUDIT ONLY — NOT APPROVED FOR MERGE OR DEPLOYMENT**

Keep auto-merge disabled and do not trigger deployment. Gate F delta review is **APPROVED WITH FINDINGS** at 7af4622ae7d7321c6315c1c4ede99011af2ff4d8; the closure commit requires its own final review recorded in the PR #461 description. Report existence alone does not complete P-01.

Cleanup is **not yet globally attested**. This report pass created no server/browser/build process, toolchain, temporary worktree or branch and deletes nothing. After verifying owner retention and final review artifacts, the coordinator must stop only task-owned benchmark/server/browser processes; remove only disposable task-created profiles/builds/child clones/worktrees and temporary worker branches; confirm no task-owned leftovers remain; and preserve unrelated work plus the Draft PR head branch until the PR is merged or closed. Do not delete a branch referenced by an open PR, rewrite history or remove evidence before checking archive retrieval. Record actual cleanup results in the final coordinator handoff; these instructions are not evidence that cleanup occurred.
