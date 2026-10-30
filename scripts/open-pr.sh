#!/usr/bin/env bash
# Publish using the terminal gh/git CLIs. Run from any directory.
set -euo pipefail

repository='PSCatLabs/printshop'
base='main'
title='Build Printshop’s deterministic browser publishing MVP'
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo|--base)
      [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 1; }
      case "$1" in --repo) repository="$2" ;; --base) base="$2" ;; esac
      shift 2 ;;
    --help|-h)
      echo 'Usage: bash scripts/open-pr.sh [--repo OWNER/NAME] [--base main]'
      echo 'Runs checks, creates a public repository if missing, pushes, and opens or reuses a PR.'
      echo 'For a new repository, creates an empty main bootstrap and joins the feature history without rewriting it.'
      exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

fail() { echo "Error: $*" >&2; exit 1; }
for executable in git gh node npm; do
  command -v "$executable" >/dev/null || fail "Install $executable first."
done
[[ "$repository" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || fail 'Use an OWNER/NAME repository.'
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
if [[ -e "$root/.git" ]]; then
  git_cli() { command git -C "$root" "$@"; }
elif [[ -d "$root/.local-git" ]]; then
  git_cli() { command git --git-dir="$root/.local-git" --work-tree="$root" "$@"; }
else
  fail 'No Git metadata found (.git or .local-git).'
fi
github() { GH_HOST=github.com command gh "$@"; }
body_file="$root/.github/pull-request-mvp.md"
[[ -f "$body_file" ]] || fail 'The checked-in PR description is missing.'
git_cli check-ref-format --branch "$base" >/dev/null || fail 'Invalid base branch.'
head="$(git_cli symbolic-ref --quiet --short HEAD)" || fail 'Check out a feature branch first.'
[[ "$head" != "$base" ]] || fail 'Run this on the feature branch, not the base branch.'
[[ -z "$(git_cli status --porcelain)" ]] || fail 'Commit or stash local changes before publishing.'
node -e 'if (+process.versions.node.split(".")[0] < 22) { console.error("Node 22+ is required."); process.exit(1); }'
github auth status --hostname github.com || fail 'Run gh auth login --hostname github.com, then retry.'

echo "Checking $head before publication…"
npm test
npm run build
[[ -z "$(git_cli status --porcelain)" ]] || fail 'Checks changed tracked files; review and commit them first.'

scratch="$(mktemp -d "${TMPDIR:-/tmp}/printshop-pr.XXXXXX")"
cleanup() { local exit_status=$?; trap - EXIT; rm -rf "$scratch"; exit "$exit_status"; }
trap cleanup EXIT
repo_url="https://github.com/$repository"
created_repository=false
if ! github repo view "$repo_url" --json nameWithOwner > /dev/null 2>"$scratch/repository-error"; then
  # A connectivity/auth error must never be interpreted as a missing repo.
  if LC_ALL=C grep -Eq 'HTTP 404|Could not resolve to a Repository' "$scratch/repository-error"; then
    echo "Creating public repository ${repository}…"
    github repo create "$repository" --public --description 'Deterministic browser publishing powered by PSCat WebAssembly'
    created_repository=true
  else
    cat "$scratch/repository-error" >&2
    fail 'Cannot inspect the GitHub repository; check connectivity and authentication.'
  fi
fi

if git_cli remote get-url origin >/dev/null 2>&1; then
  # Check push destinations too; a separate push URL must not publish elsewhere.
  while IFS= read -r destination; do
    case "$destination" in
      "$repo_url"|"$repo_url.git"|"git@github.com:$repository"|"git@github.com:$repository.git"|"ssh://git@github.com/$repository"|"ssh://git@github.com/$repository.git") ;;
      *) fail 'origin points somewhere else. Review its URLs before publishing.' ;;
    esac
  done < <(git_cli remote get-url --all origin; git_cli remote get-url --push --all origin)
else
  git_cli remote add origin "$repo_url.git"
fi

if git_cli ls-remote --exit-code --heads origin "refs/heads/$base" >"$scratch/base"; then
  git_cli fetch origin "$base"
  base_commit="$(git_cli rev-parse FETCH_HEAD)"
  git_cli merge-base HEAD "$base_commit" >/dev/null || fail 'The remote base has unrelated history. Reconcile it before rerunning; no history was rewritten.'
else
  result=$?
  [[ "$result" -eq 2 ]] || fail 'Could not inspect remote branches. Check Git access.'
  if git_cli show-ref --verify --quiet "refs/heads/$base"; then
    base_commit="$(git_cli rev-parse "refs/heads/$base")"
  else
    # GitHub needs a shared base to compare this initial, already-committed app.
    # An empty bootstrap plus a merge preserves every existing feature commit.
    empty_tree="$(git_cli hash-object -t tree --stdin </dev/null)"
    base_commit="$(printf 'chore: initialize Printshop repository\n' | git_cli commit-tree "$empty_tree")"
    git_cli branch "$base" "$base_commit"
  fi
  if ! git_cli merge-base --is-ancestor "$base_commit" HEAD; then
    [[ -z "$(git_cli ls-tree "$base_commit")" ]] || fail 'Local base has unrelated content. Reconcile it before publishing.'
    git_cli merge --allow-unrelated-histories --no-edit -m 'chore: connect initial MVP history to repository bootstrap' "$base_commit"
  fi
  git_cli push origin "$base_commit:refs/heads/$base"
  if [[ "$created_repository" == true ]]; then
    github repo edit "$repo_url" --default-branch "$base"
  fi
fi

if git_cli diff --quiet "$base_commit"...HEAD; then
  fail "There are no changes to propose against $base."
fi
git_cli push --set-upstream origin "$head:refs/heads/$head"
existing="$(github pr list --repo "$repo_url" --state open --base "$base" --head "$head" --json url --jq '.[0].url // empty')"
if [[ -n "$existing" ]]; then
  echo "Updated existing PR: $existing"
else
  github pr create --repo "$repo_url" --base "$base" --head "$head" --title "$title" --body-file "$body_file"
fi
