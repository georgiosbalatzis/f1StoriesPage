# B-06 measurement handoff

Reviewed against repository SHA `58273df6d753510605468c0787d9cdf04d6d398e`. This is owner-defined future scope for the minimum S2 and S1 fulfilment evidence, not implementation or approval. Work requires separate authorization. B-06 is not opened by this document; no ad analytics platform is proposed (`docs/commercial/packages.md:24`).

## 1. Future scope

The owner may select the minimum evidence and controls for approved obligations. Manual fulfilment comes first; analytics is optional and claim-specific. See [report acceptance](validation-contract.md#s2-report-acceptance) and [S1 acceptance](validation-contract.md#s1-report-acceptance).

## 2. Ranked gaps

### 1. Approved scope and manual fulfilment

- **Why:** Proposed duties need dated evidence against an approved scope (`docs/commercial/packages.md:24`).
- **Scope:** Both S1 and S2.
- **Manual evidence:** Sufficient when actual duties are approved and evidenced.
- **Instrumentation:** Not justified; no database or event is needed.
- **Privacy and consent:** Keep private records access-limited and retain only necessary evidence; analytics consent is not a substitute for permissions.
- **Document fields:** Version, obligation, canonical article or P-label, planned and actual dates and timezone, evidence revision/reference, met/unmet/unverified, exceptions, approver/date and retention.
- **Dependencies:** Owner-approved scope and responsible operations/editorial roles.
- **Validation tests:** Manually compare each obligation with dated evidence and resolve or record exceptions.
- **Business value:** Defensible delivery closeout.
- **Operational cost:** Ongoing recordkeeping and review effort.
- **Rights or professional gate:** Owner and applicable counsel review actual permissions and disclosures.

### 2. S2 funded-content approvals and disclosure

- **Why:** Effective funded-content identification, human routing, separate approvals and persistent disclosures are not implemented (`docs/commercial/packages.md:34`).
- **Scope:** S2.
- **Manual evidence:** Can document approvals and distribution checks, subject to effective controls.
- **Instrumentation:** Not justified for the evidence record.
- **Privacy and consent:** Restrict private approval records; use only necessary information and obtain required permissions.
- **Document fields:** Article identity, scope, separate editorial and commercial decisions, reviewer roles/dates, permissions, distribution surfaces, disclosure checks, exceptions and closeout reference.
- **Dependencies:** Owner and editor decide capacity, routing and responsible reviewers; effective safeguards and actual distribution are required.
- **Validation tests:** Manually check approvals, publication and disclosure on actual distribution surfaces, including after changes.
- **Business value:** Evidence of editorial control and delivery.
- **Operational cost:** Editorial, operations and review time.
- **Rights or professional gate:** Applicable rights-holder permission and counsel review; draft policy is not adopted.

### 3. S1 release and homepage-only control

- **Why:** All positions are occupied and homepage/article isolation is not implemented (`docs/commercial/packages.md:41`, `docs/commercial/packages.md:44`).
- **Scope:** S1.
- **Manual evidence:** Can record release and endpoint checks; records alone cannot remove rendering coupling.
- **Instrumentation:** No measurement instrumentation justified for fulfilment; effective isolation requires separately authorized control work.
- **Privacy and consent:** Keep relationship and capacity records private; avoid visitor data.
- **Document fields:** P-label, release decision, term endpoints/timezone, approved scope, build/deployment evidence, start/end checks, exceptions and operations closeout.
- **Dependencies:** Owner confirms release and capacity; operations establishes durable isolation and checks actual deployment.
- **Validation tests:** Inspect built and deployed homepage aliases and excluded article scope, then check installation and removal.
- **Business value:** Evidence for the agreed placement boundaries.
- **Operational cost:** Control work and manual deployment checks.
- **Rights or professional gate:** Owner, rights holders and applicable counsel review artwork, link, disclosure and included rights.

### 4. Existing-data validation for a selected statement

- **Why:** Execution alone does not validate a claim; relevant coverage and checks remain open (`docs/intelligence/bigquery-validation.md:19`, `docs/intelligence/bigquery-validation.md:264`).
- **Scope:** Both, only if an article, click or technical statement is selected.
- **Manual evidence:** Owner-local review and recorded outcomes can establish applicable checks; manual fulfilment remains independent.
- **Instrumentation:** New collection is not justified. Reuse model 10 first; model 12 is optional and separately cost-authorized if useful.
- **Privacy and consent:** Consented Main population only; minimize disclosure and apply suppression and the owner-local sharing limits.
- **Schema:** No new schema; record claim, source revision, model, population, unit, actual window/as-of, coverage, outcomes, limitations and approver/date.
- **Dependencies:** Owner selects a claim and follows [Stages B and C](validation-contract.md#stages-a-to-d); cloud work requires explicit authorization.
- **Validation tests:** Check relevant model/window/coverage, applicable PASS outcomes, warnings, suppression and approval; no promised adequate sample.
- **Business value:** A narrowly defensible statement if evidence supports it.
- **Operational cost:** Owner review and potentially separately authorized cloud work.
- **Rights or professional gate:** Owner approves the specified statement; privacy and professional review apply as relevant.

### 5. Conditional S1 click attribution

- **Why:** Existing fields and model 27 do not establish a sponsor-specific report (`scripts/analytics.js:189`, `docs/intelligence/sql/models/27-engagement-events.sql:9`).
- **Scope:** S1 only, after an owner chooses a real click-report obligation.
- **Manual evidence:** First assess a private effective-dated mapping and existing emitted fields; it must reliably distinguish the intended listing.
- **Instrumentation:** Stable non-personal IDs are a fallback only if mapping cannot be reliable; no implementation is authorized now.
- **Privacy and consent:** Consented click intent only; no full URLs, user IDs, cross-site tracking, free-text identity or retrospective reassignment of P1–P6.
- **Schema:** Private mapping fields: P-label, listing, destination domain, role, source, effective term/timezone, occupant changes, collisions and unassigned cases. If needed, a stable non-personal identifier must be separately specified and reviewed.
- **Dependencies:** Approved obligation, reliable mapping, narrow aggregate extraction and claim-specific validation.
- **Validation tests:** Check both home aliases, term boundaries, collisions, occupant changes and missing/unassigned cases against the mapping.
- **Business value:** Potentially attributable click intent with stated limits, not visits or conversions.
- **Operational cost:** Mapping maintenance, validation and possible separately authorized extraction.
- **Rights or professional gate:** Owner decision and applicable privacy/counsel review before any report.

## 3. Exclusions and return gates

Exposure and CTR lack measured [impressions](metrics-evidence.md#c08--sponsor-impressions); [total reach](metrics-evidence.md#c09--total-audience-reach), [unique users](metrics-evidence.md#c10--unique-users) and [cross-tool audience](metrics-evidence.md#c11--cross-tool-audience) are unsupported. [Referrals](metrics-evidence.md#c12--sponsor-referrals), [conversions](metrics-evidence.md#c13--external-conversions), [advertiser revenue](metrics-evidence.md#c14--advertiser-revenue) and [ROI](metrics-evidence.md#c15--return-on-investment) and causal analysis are excluded; a future claim needs its own evidence and approval. RUM is a separate technical dependency under [Stage D](validation-contract.md#stage-d--mature-rum-dependency), not a fulfilment project. S3–S6 classifications are unchanged ([packages](packages.md#other-scenarios-and-return-conditions)).
