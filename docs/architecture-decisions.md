# Architecture decisions

This document is the current architectural source of truth. Historical cleanup notes live under `docs/archive/` and are not operational instructions.

## ADR-001: Static hosting and production boundary

**Decision:** The site remains a static website deployed through GitHub Pages. Production is the validated `dist/` directory produced by `npm run build:public`; the repository root is never deployed directly.

**Consequences:** Runtime behavior must use browser JavaScript, public APIs, build-time generation, or committed snapshots. The public artifact is allowlisted and validated before upload. A root-level local preview is not evidence of what production contains.

## ADR-002: Author tools are publicly reachable but independently governed

**Decision:** `generate.html`, `housekeeping.html`, and `statistics.html` are public routes included in `dist/`, protected by a separate author CSP and session-only token policy. The local server remains available for development.

**Reason:** The pages are intentionally reachable, but GitHub Pages still provides no authentication. They therefore never ship credentials, never persist tokens in localStorage, and can publish only through branch-plus-PR workflows.

**Consequences:** Author dependencies and permissions are isolated from the visitor CSP. The privileged auto-publish workflow additionally requires a current quality run, an in-repository author branch, blog-entry-only changes, and either the `author-publish` label or the configured trusted maintainer account.

## ADR-003: Tracked generated files

**Decision:** Generated article HTML, blog index/source-cache/home-latest JSON, standings snapshots, YouTube snapshot, sitemap, and other browser data required for review or local preview remain tracked. `dist/`, `node_modules/`, extracted working files, minified siblings, source maps, compiled vendor CSS, manifests, and other transient build output remain ignored.

**Reason:** Tracked content output keeps publishing reviewable and rollback-friendly while the public artifact remains reproducible from source and snapshots.

**Consequences:** Maintainers edit source and rerun the owning generator. Generated diffs must be reviewed; generated files must not be hand-edited as the final change. The generated-drift guard remains required.

## ADR-004: Browser and module targets

**Decision:** Public runtime code targets modern browsers with service-worker support and is authored as browser-native ES modules where module loading is available. Node build tooling targets Node.js 20 in CI and Node.js 18 or newer locally until the engine declaration is intentionally raised.

**Consequences:** No frontend framework or server runtime is introduced. Browser fallbacks remain explicit for routes that require them. Build scripts and browser modules must not silently depend on developer-only globals.

## ADR-005: Network access

**Decision:** The normal build and tests are offline-capable and must not silently refresh external services. Network access is limited to explicitly named operations: scheduled YouTube refresh, standings/data snapshot refresh, public runtime API reads, and local author publishing to GitHub.

**Consequences:** A normal build consumes committed snapshots. Refresh commands may fail without corrupting the previous snapshot and must validate the replacement before writing it. CI separates offline quality jobs from network-backed maintenance jobs. Blog rebuild selection uses content hashes over entry inputs, templates, builder code, and configuration.

## Operational ownership

- `npm run build:public` owns the deployable artifact.
- `npm run build:check` owns generated drift detection.
- `npm run build:data-contracts` owns generated JSON shape validation.
- `npm run pages:guard`, `npm run quality:static`, and `npm run audit:runtime` enforce the public/private boundary.
- `npm run build:youtube` and `npm run build:standings-data` are explicit network-backed refresh operations.
- `node scripts/author/serve-tools.mjs` owns local editorial-tool serving.

When code, workflows, and documentation disagree, update them together or treat the change as an architecture decision rather than silently choosing one interpretation.
