# Candidate validation — 2026-10-20

Baseline `db470668`; isolated worktrees `/tmp/f1-rum-baseline` and `/tmp/f1-rum-pilot`. The original checkout was not used for builds or edits. No production events were sent by these tests. Production reporting remains unverified; see [the reporting prerequisite](README.md#reporting-feasibility-and-approval-prerequisite).

## Consent, calculations and lifecycle

Eight deterministic unit tests use the actual bundled official library and separate reference callback registrations. They cover zero CLS versus missing INP; maximum CLS session windows (1-second gap and 5-second window); recent-input exclusion; the official INP interaction percentile including a decreasing value after 50 interactions; background/resume updates with the same metric ID and increasing revisions; fresh BFCache IDs/navigation timestamps; withdrawal/reaccept and storage-event withdrawal; supported/unsupported observers; schema allowlist, groups, viewport boundary, version; and consent/load/idle scheduling without duplicate imports.

Nine real-Chrome fixture scenarios plus the existing consent guards cover the ten requested cases: fresh decline and accept, returning consent, consent after load, withdrawal, normal article-link navigation, real backgrounding/pagehide, actual BFCache restoration, no input, and multiple interactions/layout shifts. Trusted mobile taps drive Event Timing. The fixture compares CLS/INP/LCP/FCP/TTFB with an independent official-library bundle, checks zero CLS, absent INP without input, unique `(metric_id, revision)` pairs, new BFCache IDs and correct coverage, and rejects JavaScript errors. All external requests are fulfilled locally or blocked. The real GA4 transport is never executed.

Initial metrics remain explicitly delayed, including results recovered from buffered entries. No test certifies complete initial-navigation coverage. In particular, batched/evicted pre-observation entries and interactions cannot be recovered reliably; the coverage labels and reporting strata are required.

## Performance

Real **Chrome 155.0.8059.85**, cold isolated contexts, viewport 390×844 and 1440×844, Slow 4G (1.6Mbps down, 750kbps up, 150ms RTT), CPU ×4. Gzipped public artifacts, alternating order, three baseline/candidate pairs per route and viewport: **60 navigations**. Recorded provider responses are used where available; other external transport is locally mocked. These are controlled laboratory medians, not field p75s or estimates of all visitors. Raw timing rows: [measurements.csv](measurements.csv).

Latest article: `/blog-module/blog-entries/20261019W/article.html`. Image-heavy article: `/blog-module/blog-entries/20260415/article.html` (31 image elements).

Mobile medians, baseline → candidate:

| Route | FCP (ms) | LCP (ms) | CLS |
| --- | --- | --- | --- |
| Home | 800 → 796 | 900 → 892 | 0 → 0 |
| Edition | 700 → 708 | 700 → 708 | 0 → 0 |
| Latest article | 768 → 768 | 828 → 828 | 0.0002111 → 0.0002111 |
| Image-heavy article | 768 → 768 | 832 → 820 | 0.0002840 → 0.0002840 |
| Standings | 776 → 764 | 776 → 764 | 0 → 0 |

Desktop medians, baseline → candidate:

| Route | FCP (ms) | LCP (ms) | CLS |
| --- | --- | --- | --- |
| Home | 1020 → 1020 | 2012 → 2012 | 0.0013803 → 0.0013803 |
| Edition | 692 → 692 | 748 → 752 | 0.0204433 → 0.0204433 |
| Latest article | 760 → 764 | 800 → 808 | 0.0012123 → 0.0012123 |
| Image-heavy article | 712 → 812 | 712 → 812 | 0.0009628 → 0.0004734 |
| Standings | 772 → 776 | 772 → 776 | 0.0079877 → 0.0079877 |

The desktop image-heavy result triggered a focused follow-up of **seven alternating pairs**, retaining all 14 rows in [heavy-desktop.csv](heavy-desktop.csv). Both versions exhibited the faster/slower paint and font/layout timing states. FCP/LCP medians were **772 → 784ms**, with identical median CLS **0.0004734**, zero long tasks and zero JS errors. The initial +100ms median was not stable under repetition; it is preserved above rather than omitted. This small local experiment does not prove an exact zero overhead or statistical equivalence.

The initial loader is **853 bytes raw / 498 bytes gzip**, versus **2267 bytes raw / 1106 bytes gzip** for the baseline. The local collector is **11103 bytes raw / 4318 bytes gzip**, fetched once only after consent/load/idle. CPU sampling attributed approximately **4–7ms total** to reporter code in the five-route candidate runs at ×4 CPU (baseline roughly 1–3ms); this is a sampling estimate, not an exact exclusive startup cost. No new long-task pattern appeared: one existing early Standings task per run in both versions, none on the other routes in the final matrix or focused repeat.

Every returning-consent candidate navigation requested the collector exactly once, after document load; article GA downloads remained after load. GA downloaded once per tested navigation. No collector request overlapped article LCP image/font downloads. Desktop Home painted its LCP just after load: the collector request could precede that paint, but its image/font resources had already finished (only the favicon overlapped). Delayed lazy Edition avatars were not LCP resources. No extra third-party download was added, and no JavaScript errors occurred in the 74 final/focused navigations.

No rendering, media, CSS, SEO, consent UI or performance budgets were changed. All 446 generated HTML changes were checked to contain only the beacon version-hash substitution; source-less historical article contents are preserved.

## Quality gates

- Production build and public artifact validation: pass, 3660 public files. Collector, loader and license are required artifacts; source/maps remain excluded.
- Build unit tests: 117 passed; affected artifact-reference tests were repeated after license/required-artifact registration and passed.
- Consent/analytics/RUM units: 15 passed (7 existing analytics + 8 RUM), plus existing real-browser consent guards.
- Real-Chrome RUM fixture: pass, including real BFCache, independent library comparison, mocked GA4 and no JS errors.
- Security: 27 passed. Runtime audit, static source guards and existing asset-size budgets: pass.
- Blog: 241 tests and golden snapshots passed; author: 6 passed; Standings: 21 passed.
- Lighthouse: all unchanged route/resource budgets passed, three runs per route. Median performance scores Home 99, Edition 99, Standings 99, latest article 98; accessibility/best-practices/SEO all 100. LCP medians 2102 / 2177 / 2102 / 2251ms respectively. No thresholds were adjusted.
- Visual smoke: all 72 route/theme/viewport captures passed (9 routes × 4 viewports × 2 themes), plus native menu/focus, cookie decline and theme interaction checks. Screenshots were inspected locally; no UI changes were introduced.
- Clean generated-drift verification: performed after committing the candidate and rebuilding, as required before opening the PR.

The final post-load bundle includes its Apache license notice; the license is self-hosted as a separate public text artifact and does not add a visitor network request. The focused desktop repetition used this final bundle.
