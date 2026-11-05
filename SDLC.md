---
sdlcify_version: 1
repo: PSCatLabs/print-shop
default_branch: main
generated: 2026-11-04
quality_gate: "npm test && npm run build && npm run issues:publish -- --dry-run"
merge_policy:
  mode: agent-full
required_status_checks:
  - test
branch_protection:
  required_approving_review_count: 0
  require_up_to_date: false
  enforce_admins: false
  allow_force_pushes: false
  allow_deletions: false
merge_button:
  squash_merge: true
  merge_commit: false
  rebase_merge: false
  delete_branch_on_merge: true
---

# SDLC — print-shop

This file is generated and owned by the `sdlcify` skill. It's both the
human-readable description of how this repo's software development
lifecycle works *and* the config `sdlcify` reads on every re-run — edit
the frontmatter above to change policy, then re-run `sdlcify` to apply
it to GitHub.

## Lifecycle

1. **Issue first.** Nontrivial work gets a `gh issue create` before any
   code — what and why, even a few sentences.
2. **Feature branch, not `main` directly.**
   `git checkout -b feature/<slug>` (`fix/<slug>` for bugs).
3. **Plan, reviewed before implementation starts.** Write the approach
   down; get it reviewed (by `advisor` or an equivalent second opinion)
   before writing code — catch a bad approach while it's still cheap to
   change.
4. **Implement**, commit at coherent checkpoints, not one giant commit.
5. **Quality gate clean before opening a PR**: `npm test && npm run build
   && npm run issues:publish -- --dry-run` — the same checks CI runs
   (`.github/workflows/ci.yml`), so the PR isn't the first place a break
   shows up. (CI runs them as separate steps, in its own order; the string
   is what to run locally, with the same result.) When a browser is
   available, also run `npm run test:browser` (see `AGENTS.md`); CI does
   not run it.
6. **Diff reviewed** before the PR is called done — a second look at the
   actual changes, not just the plan.
7. **Open the PR**, referencing the issue (`Closes #N`; `Refs #N` for
   partial or related work, since GitHub closes an issue on any closing
   keyword, even in "does not fix #N"), with a summary and a test plan.
8. **Independent review** — a reviewer with no context from
   implementation checks the diff cold. In this repo that is Codex
   (`codex exec` / `codex review` against the PR branch, run with
   `< /dev/null`), the same independent-review step pscat uses. Must come
   back clean (Codex agrees) to proceed.
9. **Merge**, per the policy above:
   - `human-only`: a human merges every PR, always.
   - `agent-full`: an agent may merge any PR once CI is green and
     independent review is clean.
   - `size-and-risk-bar`: an agent may merge if CI is green, review is
     clean, the diff is under `max_changed_lines` (excluding doc-only
     files), and touches none of `sensitive_paths`. Otherwise, falls
     back to a human — and the agent should say explicitly which
     condition it missed.
10. **Post-merge cleanup**: delete the remote branch, remove the local
    worktree if one was used, confirm the issue auto-closed.

## Branch protection (enforced on GitHub, not just convention)

`main` requires: a PR before merging, the `test` check passing, `0`
approving reviews, no force-pushes, no deletions. Admin bypass is `on` —
see the frontmatter above for the exact values currently applied; this
prose is a summary, not the source of truth.

**Admin bypass stays on, by the owner's decision** (`enforce_admins:
false`). The owner is this repo's only real user, and bypass is the
owner's escape hatch for self-rescue only. Normal work always goes
through a feature branch and a PR, whoever does it: the owner, Codex,
Claude or any other agent. An agent never uses admin bypass to push to
`main`, merge a PR before its checks pass, or skip independent review,
even when its credentials would allow it.

**Up-to-date branches are not required** (`require_up_to_date: false`,
GitHub's `required_status_checks.strict`). A PR may merge while it is
behind `main`, so a PR's last green CI run is not re-run against a moving
`main`. Strict mode forces an update-branch-and-rerun cycle (one full CI
run) on almost every PR when several agents merge in parallel. The safety
net is CI on every push to `main`: after merging, the merger checks that
the push run for its merge commit went green and stops and reports if it
did not. The intended long-term replacement is a merge queue; when this
repo adopts one, add a `merge_group:` trigger to the CI workflow.

## Labels

`in-progress` (claimed, being worked), `in-review` (PR open, awaiting
merge decision) — set by whatever drives the issue→PR loop for this repo,
and removed once the merge is verified.

## Regenerating this file

Run the `sdlcify` skill again. It re-scans current repo state, diffs
against this file's frontmatter, and only changes what's out of sync —
safe to run as often as you like.
