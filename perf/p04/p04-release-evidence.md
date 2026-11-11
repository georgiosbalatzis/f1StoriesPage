# P-04 — release evidence

## Scope and outcome

- **A3: PASS** for the visual comparison; real playback remains unverified by that comparison.
- **D1: DESIGN ONLY** — runner changes and review are needed. No DNS, certificate or credential change was made.
- **D2: MEASURED** from the deployed aggregate artifact.
- **D3: INCONCLUSIVE** on the cause of LCP modes.
- Budgets are unchanged. Nothing was deployed as part of this work.

## A3 — audio button

The harness compared before `b0995928b` with after `7f4e0549c` on Home and Standings, in light and dark themes. Viewports were mobile 390×844, tablet 768×1024 and desktop 1440×900. Normal-colour states covered idle, simulated playing at progress 0, 0.25, 0.5, 0.75 and 1, hover and focus. Forced-colour states covered idle and simulated playing at 0.5.

All 120/120 button captures were pixel-identical; the accessible-name check reported no incorrect names. The before version had duplicate visible DOM text recorded by the harness. Playing was simulated using the active class and accessible label. Idle was the initial paused appearance, not a real pause transition. The source report therefore calls real playback verification INCONCLUSIVE. Playback behaviour is covered separately by `qa:audio-player`; this visual run does not establish that gate's result. Evidence archive: `a3/report.md`, `a3/report.json`, `a3/harness.mjs`.

## D2 — aggregate provenance

The frozen five-app aggregate was obtained from the deployed Pages artifact for run `42891877849`, artifact `13802175395`. The ZIP SHA-256 matched the GitHub digest, beginning `47b567a2`; it contained 5557 files. Its deployment manifest was byte-identical to the production manifest. The aggregate contains Main `7f4e0549c`, the pinned children and refreshed TYRES data.

Rebuilding the same bytes from source was not possible: TYRES data was refreshed live and the exact refreshed snapshot was unavailable for reproduction. The artifact expires `2026-11-11T20:42Z`; a local copy is kept in the evidence archive. Evidence archive: `CHECKPOINT.md`, `d/assemble-frozen.md`, `d/production-deployment-manifest.json`, `aggregate/site/`.

## D2 — aggregate results

The closed-proxy campaign used `npm run perf:lighthouse:rate-safe` at Main `7f4e0549c`, with `--label aggregate --attempts 3`. LCP is simulated in milliseconds. Ranges are the minimum and maximum of the valid attempts; scores are Lighthouse performance scores.

| Route | Valid attempts | Median LCP ms | LCP range ms | Median score | Score range |
|---|---:|---:|---:|---:|---:|
| Home | 3/3 | 2884.732 | 2883.547–3506.260 | 95 | 91–95 |
| Blog | 3/3 | 3184.081 | 2734.180–3185.093 | 93 | 93–96 |
| Standings | 3/3 | 901.617 | 901.379–1063.597 | 100 | 100–100 |
| Article | 3/3 | 3557.768 | 2957.135–3558.190 | 91 | 91–95 |

Remaining budget failures, exactly as logged:

- Home: `largest-contentful-paint: 2884.732 > 2500`
- Blog: `performance: 93 < 95`; `largest-contentful-paint: 3184.081 > 2500`
- Article: `performance: 91 < 95`; `largest-contentful-paint: 3557.768 > 2500`
- Standings: budgets passed.

Article third-party attribution is **BLOCKED-ORIGIN**: loopback differs from production HTTPS. The measured Article did not contain BetCast. Evidence archive: `aggregate/results/aggregate/results.json`, `logs/aggregate-run.log`.

## D1 — HTTPS measurement design

The proposed design serves the frozen aggregate on loopback TLS port 443 with the production hostname and a short-lived local certificate. A disposable Chrome profile uses a scoped SPKI exception and hostname resolver rule; no system trust root is installed. It must verify the exact HTTPS origin, loopback destination and closed egress. Provider requests retain their exact identities and use captured fixtures; unknown requests fail closed. The same-origin iframe document and populated BetCast rows require explicit readiness checks. The runner needs HTTPS, interception and assertion changes. Those changes need separate review and approval before execution, along with verified success fixtures and an orchestrator check of port and proxy behaviour. No DNS, production certificate, credential or host-file change is required. Evidence archive: `d/https-design.md`.

## D3 — LCP-mode reliability

The available evidence does not establish the cause of the observed LCP modes. Observed local network timings and simulated Lighthouse metrics cannot be combined as a causal waterfall. A long task in the simulated critical path is a HYPOTHESIS for the Blog controls, not a general explanation. A separately reviewed study should retain traces and task attribution and use randomized, interleaved matched runs under controlled host load. Gate attempts and thresholds remain unchanged. Evidence archive: `d/lcp-modes.md`.

## Limitations and sibling work

A3 did not measure real playing or pause transitions because captured podcast feed and audio bodies were unavailable. D2 is a loopback Lighthouse campaign, not a production HTTPS or embedded BetCast attribution measurement. D1 was not implemented or run. D3 does not establish a performance improvement.

- [BetCast Draft PR](https://github.com/georgiosbalatzis/BetCastVisualisation/pull/6): diagnostic; candidate rejected by CLS.
- [Telemetry pacer fix Draft PR](https://github.com/georgiosbalatzis/f1-telemetry-dashboard/pull/27): chartReady faster in all 9 matched cells; literal predeclared verdict REJECTED solely on +186 B gzip first-party bytes; owner decision. Pin unchanged.

## Deployment

This PR is documentation only. Merging to Main triggers the Pages deploy workflow, `publish-blog.yml` deploy job. Merge only with release authorization.
