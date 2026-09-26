# Protecting `main`: pull requests and Site Quality, without breaking publishing

Status: **plan, not applied.** Nothing in the repository settings was changed. The
workflow changes that ship with this plan (pinned actions, per-job tokens,
`persist-credentials: false`, `--match-head-commit`) are compatible with both
the current ruleset and the target one.

## Current state (read from the API on 2026-09-26)

Ruleset **Force Protection** (`id 14773308`, active, target `~DEFAULT_BRANCH`):

| Rule | Effect |
|---|---|
| `deletion` | `main` cannot be deleted |
| `non_fast_forward` | no force-push to `main` |
| bypass: Repository role **Admin** (`actor_id 5`), mode **always** | admins can delete or force-push `main` |

There is no pull-request rule and no required status check. Anyone with write
access can push straight to `main`: humans, every workflow's `GITHUB_TOKEN`
with `contents: write`, and the **authors' fine-grained PAT** (it has
`Contents: write` so it can create branches, which also lets it push to `main`).

## Who writes to `main` today

| Writer | How | Fits "require PR + Quality gates"? |
|---|---|---|
| Author tools (generate/housekeeping, author PAT) | branch `author/*` + PR | yes: PR events run Site Quality |
| **Publish Article** (`auto-publish-author-pr.yml`) | `gh pr merge --merge --match-head-commit` after Site Quality passed on that commit | yes, with 0 required approvals |
| **Scheduled Publish** (`scheduled-publish.yml`) | `gh pr merge --merge --match-head-commit` after the `Quality gates` check passed | yes, with 0 required approvals |
| **Site Maintenance** `publish_blog` | `git push origin HEAD:main` (generated artifacts) | **no**: direct push |
| **Site Maintenance** `refresh_youtube` | `git push origin HEAD:main` (`assets/youtube-latest.json`) | **no**: direct push |
| **Site Maintenance** `refresh_standings_data` | `git push origin HEAD:main` (standings caches) | **no**: direct push |
| Owner | merges PRs in the UI; admin bypass on force protection | yes |

The three direct pushes all go through `.github/actions/commit-and-push`.
Turning on "require a pull request" or "require status checks" before they
change would break every article publish (the generated `article.html`, index
and sitemap would never reach `main`) and every data refresh.

## Target ruleset

Keep it one ruleset, so the protection is reviewed in one place. Do **not**
add `github-actions`, a bot, or an app to the bypass list.

```json
{
  "name": "Force Protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request" }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["merge", "squash"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "Quality gates", "integration_id": 15368 }
        ]
      }
    }
  ]
}
```

Why each setting:

- **0 required approvals.** Publish Article and Scheduled Publish merge with
  `GITHUB_TOKEN`, which cannot approve. Requiring one approval would stop all
  automated publishing, and would not be stronger than the check it replaces:
  today nothing is required at all.
- **`Quality gates` pinned to integration 15368 (GitHub Actions).** Only the
  Site Quality job can satisfy it, not a commit status or another app with the
  same name.
- **Not strict (`strict_required_status_checks_policy: false`).** Author
  branches start from `main` when the PR is opened; scheduled PRs wait days.
  "Up to date with main" would make every scheduled publish fail at its slot.
  `--match-head-commit` already ties each merge to the tested commit.
- **Admin bypass `always` → `pull_request`.** Today an admin can force-push or
  delete `main`. With `pull_request`, the owner can still merge a PR while CI is
  broken (emergency path, recorded on the PR), but cannot push, force-push or
  delete directly. This is stricter than today.
- **Merge methods.** The workflows use `--merge`; recent human merges are merge
  commits too. `squash` stays for the owner; rebase is not needed.

Effect on the author PAT: once PRs are required, a leaked PAT can no longer
change `main` directly. It can still open author PRs, and Publish Article
auto-merges those that only touch `blog-module/blog-entries/**` after Site
Quality passes. That is the intended publishing model; see "Further hardening".

## Migration, in order

### Phase 1: already done (this change set)

- Every external action pinned to a verified commit SHA; Dependabot keeps pins current.
- `GITHUB_TOKEN` scoped per job; `pages: write` and `id-token: write` only on the deploy job.
- Checkouts use `persist-credentials: false`; `commit-and-push` receives the token as an input and uses it only for its own `fetch`/`push`.
- Publish Article merges only the commit Site Quality tested (`--match-head-commit`).

### Phase 2: move the three direct pushes to pull requests (no bypass)

Change `.github/actions/commit-and-push` to, instead of `git push origin HEAD:main`:

1. push the commit to a fresh branch `automation/<workflow>-<run_id>-<attempt>`;
2. `gh pr create --base main --head <branch>` (the job needs `pull-requests: write`);
3. `gh workflow run quality.yml --ref <branch>` (the job needs `actions: write`).
   PRs opened with `GITHUB_TOKEN` do not trigger `pull_request` workflows, but
   `workflow_dispatch` is the documented exception, so Site Quality really runs
   and attaches `Quality gates` to the branch head;
4. wait for that run (`gh run watch --exit-status`);
5. `gh pr merge --merge --delete-branch --match-head-commit <sha>`.

Keep `concurrency: content-publishing` so generated-artifact PRs never overlap.
The deploy job keeps running after the merge, as today. Cost: one Site Quality
run (about 4 to 7 minutes) between an author merge and the deploy, and before each
data refresh lands.

Repository setting needed for step 2: **Settings → Actions → General →
Workflow permissions → "Allow GitHub Actions to create and approve pull
requests"**. With 0 required approvals this adds no approval power that
matters; turn it off again if approvals are ever required.

Alternative (not recommended unless latency matters): a dedicated GitHub App
installed on this repository only, token minted per run with
`actions/create-github-app-token`, so bot PRs trigger Site Quality normally
and can use auto-merge. It avoids the dispatch step, but adds a long-lived
private key as a repository secret. It must still **not** be a bypass actor.

### Phase 3: rehearse on a canary branch

1. Create branch `protection-canary` from `main`.
2. Create a second ruleset, identical to the target above, but targeting `refs/heads/protection-canary`.
3. Run the Phase 2 `commit-and-push` against the canary: a `workflow_dispatch` input `target_branch`, default `main`, used for the base and the merge.
4. Check that the bot PR is created, Site Quality runs and `Quality gates` is green on it, the PR merges, and a direct `git push` to the canary is rejected.
5. Open a test author PR against the canary from `generate.html`, or with the PAT, and check that it merges only after Site Quality.

### Phase 4: switch `main`

1. Merge the Phase 2 workflow change (at this point it still works without the new rules).
2. Watch one real cycle of each writer: an author publish, a scheduled publish, a YouTube refresh (dispatch `task=youtube`), and a standings refresh (dispatch `task=standings`).
3. Edit **Force Protection** to the target JSON (Settings → Rules → Rulesets, or `PUT /repos/{owner}/{repo}/rulesets/14773308`).
4. Repeat the four cycles from step 2.
5. Delete the canary ruleset and branch.

### Rollback

If publishing breaks after Phase 4, set the ruleset's enforcement to
**Disabled** (one click; it restores today's behaviour, not less), fix the
workflow, and re-enable it. Never add a bypass actor as the fix.

## Further hardening (optional, owner decisions)

- Publish Article trusts any same-repo `author/*` PR that touches only
  `blog-module/blog-entries/**`. Checking the PR author's login against an
  allowlist before merging would stop a leaked PAT from publishing articles
  with no human in the loop.
- Settings → Actions → General: allow only actions created by GitHub (all
  actions in use are `actions/*`), and turn on **require actions to be pinned
  to a full-length commit SHA**.
- Settings → Actions → General → Workflow permissions: **read repository
  contents** as the default. Every workflow now declares its own permissions.
- Settings → Environments → `github-pages`: deployment branches limited to `main`.
- Settings → Code security: Dependabot alerts and security updates, secret
  scanning and push protection.
