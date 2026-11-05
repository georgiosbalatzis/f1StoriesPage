# Phase 5 commercial governance

This folder is the evidence-based foundation for selling sponsorships on F1 Stories. It was created by **B-01 (Commercial Readiness, Intellectual Property & Rights Audit)** at baseline `a2f89c71` on 2026-11-05.

> These documents describe commercial readiness and open legal questions. They do **not** establish legal clearance, grant usage rights, authorise a commercial campaign or activate sponsorship functionality. Passing CI does not close any legal-review item.

## Scope

**Covered:**
- **Formula 1 marks:** the name, both domains and the social handles.
- **Partner logos:** the logos and the partner strip.
- **Editorial and promotional imagery.**
- **Race Desk data providers.** These are THE GRID, the hubs, Telemetry, Ghost Car and TYRES. BetCast is covered as a separate sibling product.
- **Commercial infrastructure and privacy.**
- **Editorial independence and disclosure.**
- **Gambling-related questions.**
- **Business and tax questions:** listed for professionals only, with no answers given.

**Not covered:**
- runtime changes, new features, pricing, or contacting any third party;
- legal conclusions;
- the live site and the sibling repos beyond their source code.

## Current readiness

| Area | State |
|---|---|
| Documentation (this folder) | Ready for owner review |
| Commercial use | **Not cleared.** No scenario is `CLEARED` or `CONDITIONAL` overall. See [rights-matrix.md §4](rights-matrix.md#4-scenario-comparison) |
| Existing editorial site | Unchanged by B-01. Current-state risks are recorded in [risk-register.md](risk-register.md) (`CR-` items) for owner decision |

## Documents

| File | Purpose |
|---|---|
| [current-state-audit.md](current-state-audit.md) | What exists today: the partner strip, the logo pipeline, contact, analytics, policies, Race Desk dependencies and the gaps |
| [rights-matrix.md](rights-matrix.md) | Per-asset and per-provider rights, readiness and required action, plus the scenario comparison S1–S6 |
| [risk-register.md](risk-register.md) | Prioritised risks, with severity separate from evidence confidence |
| [editorial-independence-policy.md](editorial-independence-policy.md) | Greek draft policy. **DRAFT — NOT YET APPROVED**; not published |
| [legal-counsel-brief.md](legal-counsel-brief.md) | Questions for a lawyer and a tax adviser |
| [evidence-ledger.md](evidence-ledger.md) | The source of every material claim, with dates |
| [b01-closeout.md](b01-closeout.md) | Owner-facing answers and next steps |

## Commercial activation boundaries

Until the conditions in [b01-closeout.md](b01-closeout.md) are met, do not do any of the following:
- sell or offer a new placement, series, weekend, tool or BetCast sponsorship;
- place a sponsor inside a data tool;
- combine F1, team or driver marks or imagery with a sponsor;
- accept anything of value from a betting operator;
- give sponsors audience figures beyond "consented-visitor click floor".

Existing placements stay as they are unless the owner decides otherwise in a separate PR.

## Decision ownership

| Decision | Owner |
|---|---|
| Business decisions (pricing, categories, whether to proceed, changes to the live site) | Site owner |
| Legal interpretation (trademark, licences, consumer and advertising law, gambling, privacy) | Qualified counsel |
| Tax and registration | Tax adviser |
| Permission to use marks, data or images | The relevant rights holder: Formula One Licensing B.V. / FOM, OpenF1, Jolpica, Pirelli, Open-Meteo, teams, agencies and partners |

Software agents prepare evidence only. They cannot approve anything.

## Relationship to later work

- **B-02.** Its scope is not defined in this repository. B-01 supports B-02 starting as **planning and documentation only**; see the closeout, Q7. Activating any commercial offer is a separate decision with separate preconditions.
- **Later implementation PRs**, if the owner approves them, each as its own PR:
  - disclaimer and labels;
  - a disclosure page;
  - excluding paid content from auto-merge;
  - attribution fixes;
  - a rights-ledger schema;
  - sponsor report definitions.
- **Maintenance.** Re-verify every primary source before any decision or contract, because several are undated [BR-14].
