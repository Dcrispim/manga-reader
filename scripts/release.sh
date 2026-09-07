#!/usr/bin/env bash
#
# Cuts a new stable release branch from main and re-pins main's
# docker-compose.yml to it.
#
# Usage:
#   scripts/release.sh [-v <version>]
#
#   -v <version>   Custom version to release (e.g. 1.1.0 or 1.1.0-beta).
#                  If omitted, the patch number of the current stable
#                  branch (stable/X.Y.Z) is bumped automatically.
#
# What it does:
#   1. Finds the current stable/* branch (highest semver on origin).
#   2. Creates stable/<new-version> from origin/main and re-applies the
#      one permanent difference between main and every stable branch:
#      docker-compose.yml builds from "context: ." there instead of
#      main's pinned GitHub ref (stable branches aren't cherry-picked
#      onto main, so `git merge` sees them as diverged and produces
#      false conflicts even when the content is identical; branching
#      straight off main avoids that entirely).
#   3. Aborts if the current stable branch has any content beyond that
#      docker-compose.yml line that main doesn't have (e.g. a hotfix
#      committed directly to stable) instead of silently discarding it.
#   4. Updates main's docker-compose.yml to pin the new stable branch.
#   5. Prints a summary and asks for confirmation before pushing anything.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/release.sh [-v <version>]

  -v <version>   Custom version to release (e.g. 1.1.0). If omitted, the
                 patch number of the current stable/X.Y.Z branch is
                 bumped automatically.
  -h             Show this help.
EOF
}

CUSTOM_VERSION=""
while getopts ":v:h" opt; do
  case "$opt" in
    v) CUSTOM_VERSION="$OPTARG" ;;
    h) usage; exit 0 ;;
    \?) echo "Unknown option: -$OPTARG" >&2; usage; exit 1 ;;
    :) echo "Option -$OPTARG requires an argument." >&2; usage; exit 1 ;;
  esac
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Error: must be run from main (currently on '$CURRENT_BRANCH')." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working tree isn't clean. Commit or stash your changes first." >&2
  exit 1
fi

echo "==> Fetching origin..."
git fetch origin --prune --tags

mapfile -t STABLE_BRANCHES < <(
  git for-each-ref --format='%(refname:short)' 'refs/remotes/origin/stable/*' \
    | sed 's#^origin/##'
)
if [[ ${#STABLE_BRANCHES[@]} -eq 0 ]]; then
  echo "Error: no stable/* branch found on origin." >&2
  exit 1
fi

CURRENT_VERSION="$(
  printf '%s\n' "${STABLE_BRANCHES[@]}" \
    | sed 's#^stable/##' \
    | sort -V \
    | tail -1
)"
CURRENT_STABLE_BRANCH="stable/$CURRENT_VERSION"
echo "==> Current stable branch: $CURRENT_STABLE_BRANCH"

if [[ -n "$CUSTOM_VERSION" ]]; then
  NEW_VERSION="$CUSTOM_VERSION"
  if [[ "$NEW_VERSION" == "$CURRENT_VERSION" ]]; then
    echo "Error: $NEW_VERSION is already the current stable version." >&2
    exit 1
  fi
else
  if [[ ! "$CURRENT_VERSION" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    echo "Error: current stable version '$CURRENT_VERSION' isn't a plain" \
      "X.Y.Z number, so it can't be bumped automatically. Pass -v explicitly." >&2
    exit 1
  fi
  MAJOR="${BASH_REMATCH[1]}"
  MINOR="${BASH_REMATCH[2]}"
  PATCH="${BASH_REMATCH[3]}"
  NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
fi

NEW_STABLE_BRANCH="stable/$NEW_VERSION"
echo "==> New stable branch: $NEW_STABLE_BRANCH"

if git rev-parse --verify --quiet "refs/heads/$NEW_STABLE_BRANCH" >/dev/null \
  || git rev-parse --verify --quiet "refs/remotes/origin/$NEW_STABLE_BRANCH" >/dev/null; then
  echo "Error: $NEW_STABLE_BRANCH already exists locally or on origin." >&2
  exit 1
fi

echo "==> Checking for commits unique to $CURRENT_STABLE_BRANCH..."
# git can't tell a routine cherry-pick (same content as a main commit, just a
# different hash) from a real hotfix committed straight to stable, so this is
# a heads-up for a human to judge rather than an automatic hard fail.
STABLE_ONLY_COMMITS="$(
  git log --oneline "origin/$CURRENT_STABLE_BRANCH" --not origin/main -- . ':!docker-compose.yml'
)"
if [[ -n "$STABLE_ONLY_COMMITS" ]]; then
  echo "Warning: $CURRENT_STABLE_BRANCH has commits main doesn't have:" >&2
  echo "$STABLE_ONLY_COMMITS" >&2
  echo "This release branches fresh off main, so anything unique to those" \
    "commits won't carry over. If they're routine cherry-picks whose content" \
    "is already in main (check with git show <hash>), it's safe to continue." >&2
  read -r -p "Continue anyway? [y/N] " CONTINUE_ANYWAY
  if [[ ! "$CONTINUE_ANYWAY" =~ ^[Yy]$ ]]; then
    echo "Aborted." >&2
    exit 1
  fi
fi

cleanup_on_failure() {
  echo "==> Something went wrong, restoring main." >&2
  git checkout main >/dev/null 2>&1 || true
  git branch -D "$NEW_STABLE_BRANCH" >/dev/null 2>&1 || true
}
trap cleanup_on_failure ERR

echo "==> Creating $NEW_STABLE_BRANCH from origin/main..."
git checkout -b "$NEW_STABLE_BRANCH" origin/main

# Every stable branch builds from its own checkout, never from main's
# pinned GitHub ref (main points at the previous stable branch, which
# would otherwise make this branch point at itself once main is re-pinned).
sed -i 's#^\( *context:\).*#\1 .#' docker-compose.yml
git add docker-compose.yml
git commit -m "Release $NEW_VERSION

Branch $NEW_STABLE_BRANCH from main; build from this branch's own
checkout instead of main's pinned ref."

echo "==> Updating main's docker-compose.yml pin to $NEW_STABLE_BRANCH..."
git checkout main
sed -i "s#stable/${CURRENT_VERSION}#stable/${NEW_VERSION}#" docker-compose.yml
git add docker-compose.yml
git commit -m "Pin container build to the $NEW_STABLE_BRANCH branch"

trap - ERR

echo
echo "==> Ready to release $NEW_VERSION:"
echo "    - $NEW_STABLE_BRANCH created from main (docker-compose.yml build context kept local)"
echo "    - main now pins docker-compose.yml to $NEW_STABLE_BRANCH"
echo

read -r -p "Push $NEW_STABLE_BRANCH and main to origin now? [y/N] " CONFIRM
if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
  git push origin "$NEW_STABLE_BRANCH"
  git push origin main
  echo "==> Pushed. Release $NEW_VERSION is live."
else
  echo "==> Skipped push. Review the branches locally, then run:"
  echo "      git push origin $NEW_STABLE_BRANCH"
  echo "      git push origin main"
fi
