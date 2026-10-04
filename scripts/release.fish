#!/usr/bin/env -S fish --no-config
#
# Fish port of scripts/release.sh (for Arch/CachyOS setups where fish is the
# login shell). Cuts a new stable release branch from main and re-pins main's
# docker-compose.yml to it.
#
# Usage:
#   scripts/release.fish [-v <version>]
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
#      main's pinned GitHub ref (see release.sh for why it branches
#      straight off main instead of merging).
#   3. Warns if the current stable branch has content beyond that
#      docker-compose.yml line that main doesn't have (e.g. a hotfix
#      committed directly to stable) instead of silently discarding it.
#   4. Updates main's docker-compose.yml to pin the new stable branch.
#   5. Prints a summary and asks for confirmation before pushing anything.

function usage
    echo "Usage: scripts/release.fish [-v <version>]

  -v <version>   Custom version to release (e.g. 1.1.0). If omitted, the
                 patch number of the current stable/X.Y.Z branch is
                 bumped automatically.
  -h             Show this help."
end

function die
    echo "Error: $argv" >&2
    exit 1
end

function confirm --argument-names prompt
    read -l -P "$prompt [y/N] " answer
    string match -qr '^[Yy]$' -- $answer
end

argparse --name=release 'v/version=' 'h/help' -- $argv
or begin
    usage
    exit 1
end

if set -q _flag_help
    usage
    exit 0
end

set -l custom_version $_flag_version

set -l repo_root (git rev-parse --show-toplevel)
or die "not inside a git repository."
cd $repo_root

set -l current_branch (git rev-parse --abbrev-ref HEAD)
test "$current_branch" = main
or die "must be run from main (currently on '$current_branch')."

test -z "$(git status --porcelain)"
or die "working tree isn't clean. Commit or stash your changes first."

echo "==> Fetching origin..."
git fetch origin --prune --tags
or die "git fetch failed."

set -l stable_branches (
    git for-each-ref --format='%(refname:short)' 'refs/remotes/origin/stable/*' \
        | string replace -r '^origin/' ''
)
test (count $stable_branches) -gt 0
or die "no stable/* branch found on origin."

set -l current_version (
    printf '%s\n' $stable_branches \
        | string replace -r '^stable/' '' \
        | sort -V \
        | tail -1
)
set -l current_stable_branch stable/$current_version
echo "==> Current stable branch: $current_stable_branch"

set -l new_version
if test -n "$custom_version"
    set new_version $custom_version
    test "$new_version" != "$current_version"
    or die "$new_version is already the current stable version."
else
    set -l parts (string match -r '^(\d+)\.(\d+)\.(\d+)$' -- $current_version)
    or die "current stable version '$current_version' isn't a plain X.Y.Z" \
        "number, so it can't be bumped automatically. Pass -v explicitly."
    set new_version "$parts[2].$parts[3]."(math $parts[4] + 1)
end

set -l new_stable_branch stable/$new_version
echo "==> New stable branch: $new_stable_branch"

if git rev-parse --verify --quiet refs/heads/$new_stable_branch >/dev/null
    or git rev-parse --verify --quiet refs/remotes/origin/$new_stable_branch >/dev/null
    die "$new_stable_branch already exists locally or on origin."
end

echo "==> Checking for commits unique to $current_stable_branch..."
# git can't tell a routine cherry-pick (same content as a main commit, just a
# different hash) from a real hotfix committed straight to stable, so this is
# a heads-up for a human to judge rather than an automatic hard fail.
set -l stable_only_commits (
    git log --oneline origin/$current_stable_branch --not origin/main -- . ':!docker-compose.yml'
)
if test (count $stable_only_commits) -gt 0
    echo "Warning: $current_stable_branch has commits main doesn't have:" >&2
    printf '%s\n' $stable_only_commits >&2
    echo "This release branches fresh off main, so anything unique to those" \
        "commits won't carry over. If they're routine cherry-picks whose content" \
        "is already in main (check with git show <hash>), it's safe to continue." >&2
    if not confirm "Continue anyway?"
        echo "Aborted." >&2
        exit 1
    end
end

# fish has no `trap ERR`, so every step below bails out through this.
function fail --inherit-variable new_stable_branch
    echo "==> Something went wrong, restoring main." >&2
    git checkout main >/dev/null 2>&1
    git branch -D $new_stable_branch >/dev/null 2>&1
    exit 1
end

echo "==> Creating $new_stable_branch from origin/main..."
git checkout -b $new_stable_branch origin/main; or fail

# Every stable branch builds from its own checkout, never from main's
# pinned GitHub ref (main points at the previous stable branch, which
# would otherwise make this branch point at itself once main is re-pinned).
sed -i 's#^\( *context:\).*#\1 .#' docker-compose.yml; or fail
git add docker-compose.yml; or fail
git commit -m "Release $new_version

Branch $new_stable_branch from main; build from this branch's own
checkout instead of main's pinned ref."; or fail

echo "==> Updating main's docker-compose.yml pin to $new_stable_branch..."
git checkout main; or fail
sed -i "s#stable/$current_version#stable/$new_version#" docker-compose.yml; or fail
git add docker-compose.yml; or fail
git commit -m "Pin container build to the $new_stable_branch branch"; or fail

echo
echo "==> Ready to release $new_version:"
echo "    - $new_stable_branch created from main (docker-compose.yml build context kept local)"
echo "    - main now pins docker-compose.yml to $new_stable_branch"
echo

if confirm "Push $new_stable_branch and main to origin now?"
    git push origin $new_stable_branch; or die "push of $new_stable_branch failed."
    git push origin main; or die "push of main failed."
    echo "==> Pushed. Release $new_version is live."
else
    echo "==> Skipped push. Review the branches locally, then run:"
    echo "      git push origin $new_stable_branch"
    echo "      git push origin main"
end
