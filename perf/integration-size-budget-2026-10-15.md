# Sprint 279 integration size-budget provenance

Baseline checkout: /Users/giorgos/WebstormProjects/f1StoriesPage-vqa-fix, based on main f08cd0df; fd0f4166 changes only visual QA harness.
Integration checkout: /Users/giorgos/WebstormProjects/f1StoriesPage-perf-integration, head 90053762.
Guard counts uncompressed filesystem sizes in checkout, not transferred/gzipped bytes or only dist. There is no --root flag. Existing +10% budgets are unchanged.

| File | Budget baseline B | Allowed B (+10%) | Main checkout B | Integration checkout B | Integration delta B | Main dist B | Integration dist B |
|---|---:|---:|---:|---:|---:|---:|---:|
| standings/standings.css | 25177 | 27694 | 29860 | 29860 | 0 | excluded | excluded |
| standings/standings.js | 73348 | 80682 | 84004 | 84004 | 0 | excluded | excluded |
| standings/core/format.js | 568 | 624 | 1583 | 1583 | 0 | excluded | excluded |
| scripts/shared-nav.js | 18571 | 20428 | 35239 | 35239 | 0 | excluded | excluded |
| blog-module/build/embed-render.js | 17459 | 19204 | 19453 | 19453 | 0 | excluded | excluded |
| standings/standings.min.css | 20505 | 22555 | 23688 | 23688 | 0 | 23688 | 23688 |
| standings/standings.min.js | 43331 | 47664 | 49097 | 49097 | 0 | 49097 | 49097 |
| scripts/shared-nav.min.js | 9454 | 10399 | 17619 | 17619 | 0 | 17619 | 17619 |
| scripts/sw-cleanup.min.js | 718 | 789 | 809 | 809 | 0 | 809 | 809 |

All 9 integration failures have identical source bytes/content on the fresh main checkout. All public-dist copies that exist are also byte-identical. These are existing main budget overruns, not Step 2/3 integration growth.

No budget updates or runtime changes were made.

Fresh-main reproduction: `node scripts/perf/size-guard.mjs` in the visual QA checkout exits 1 with the same 9 file overruns; complete output is `/tmp/f1-279-main-size-budget.log`.

## PR #282 original mergeability provenance

The existing main-sync commit is 8855ac06, with parents 717b1ccf (Step 2) and f08cd0df (main). Re-running `git merge-tree --write-tree 8855ac06^1 8855ac06^2` exits 0 without conflicts and returns tree 2a0b40abded3747e5f4db62eaddef85a41e0ccb4, exactly equal to `git rev-parse 8855ac06^{tree}`. Thus this branch update required no conflict resolutions and exactly matches Git's automatic merge.

GitHub branch-protection API returns `Branch not protected` for main. The only active repository ruleset, "Force Protection" (#14773308), prevents deletion and non-fast-forward pushes to the default branch; it contains no required-check, strict-up-to-date, review, or pull-request rule. The PR remains draft=true, which itself prevents merging until marked ready. Its current GitHub mergeability is MERGEABLE/CLEAN, with all quality checks passing.

The historical GitHub mergeability response before Claude's update was not preserved. Evidence rules out merge conflicts in #282 and a branch-protection up-to-date requirement; the draft state is a confirmed merge restriction. A transient/stale GitHub mergeability calculation may have contributed to the earlier report, but cannot be confirmed retrospectively.
