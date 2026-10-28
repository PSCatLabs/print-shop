#!/bin/sh
# Normal checkouts use normal Git. This initial managed workspace reserves .git.
set -eu
cd "$(dirname "$0")/.."
if [ -e .git ]; then exec git "$@"; fi
exec git --git-dir="$PWD/.local-git" --work-tree="$PWD" "$@"
