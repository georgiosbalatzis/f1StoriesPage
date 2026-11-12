# P-08 artifact contracts

The inventory classifies A-01–A-12 as 11 PARTIAL and one INTENTIONAL
DIFFERENCE; B-01–B-19 as 16 PARTIAL and three UNVERIFIED. These are
coverage classifications, not claims that every runtime behavior was tested.

Run identity mode from the repository root, after assembly has produced `dist`,
with the reviewed lock (the report directory must exist and stay outside `dist`):

```sh
mkdir -p reports
node scripts/deployment/verify-public.mjs --site dist --lock scripts/deployment/sources.json --report reports/p08.json
node scripts/deployment/verify-public.mjs --site dist
```

Identity mode (`--lock`) complements and does not replace the existing public
URL gate: keep both. Supply independently retained `--expected-main-sha` and
`--expected-tyres-data-sha` when available; omitted identities and browser
behavior remain NOT VERIFIED. Exit 0 means no checked contract failed, 1 means
a contract failed, and 2 means identity CLI/input/report error. A self-consistent
manifest and artifact do not establish provenance.

A-13 intentionally fails closed on hidden output paths: assembly omits the
known `.nojekyll` markers and rejects other hidden paths, so a future hidden
output path fails the release rather than vanishing from the upload. This is a
packaging policy, not universally behavior-preserving. The existing `--site`
syntax remains supported, but its hidden-file policy changed: it rejects
`.nojekyll` and other hidden entries, so standalone Main output containing that
marker fails; aggregate assembly omits the markers first. The old frozen manifest
must keep failing its output digest check; do not rewrite it to pass.

Negative tests cover hidden paths, altered or missing assets and manifest fields,
wrong identity, build, namespace, data and freshness, wrong canonical and retired
navigation, and child source leakage. CLI tests also reject report destinations
inside the artifact, report symlinks, symlinked parents into it and hard links;
they check outside reports and the unchanged tree when no report is requested.

For pinned consumer parser checks, provide clean checkouts matching the lock:

```sh
node --no-warnings scripts/race-desk/consumer-roundtrip.mjs --telemetry ../telemetry --ghostcar ../ghostcar --tyres ../tyres
```

This checks parser round trips, not browser state restoration. The proposal is to
run identity verification after the build step of `build-pages`, on the same
`dist` before upload, retaining the public URL gate and report outside `dist`.
One local real-artifact run took 0.986 s including startup; it is not a CI
estimate. The old frozen artifact failed as expected in that run.

Telemetry B-14 is a child-repository proposal for independent Sol High review of
parent trust policy, referrer fallback, message validation, compatibility and
browser threat fixtures. It does not authorize a security change here. Rollback:
revert the PR coherently, retaining existing release and security gates.
