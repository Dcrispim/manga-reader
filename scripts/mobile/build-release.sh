#!/usr/bin/env bash
#
# Builds the Android release APK locally.
#
# Usage:
#   scripts/mobile/build-release.sh [-r <ref>] [-c] [-i] [-y]
#
#   -r <ref>  Build a branch/commit instead of the working tree. It is checked
#             out in a temporary worktree, so uncommitted changes stay out.
#   -c        Clean prebuild (regenerates apps/mobile/android from scratch).
#   -i        Install on the connected device afterwards (adb install -r, keeps
#             the app data). ANDROID_SERIAL picks the device when there are many.
#   -y        Do not stop on the unmerged-branches warning.
#
# Before building, it lists the local branches with commits that are not in
# what is about to be built: a feature left on its branch is the usual reason
# for "the new build lost a feature" (stable/* and milestone/* are skipped).
#
# Output: dist/mobile/manga-reader-<version>-<commit>[-dirty].apk
#
# Signing: the generated android/ project signs release with the debug key, so
# an APK from this script updates one built the same way on the same machine.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REF=""
CLEAN=""
INSTALL=""
YES=""

usage() { sed -n '3,22p' "$0" | sed 's/^# \{0,1\}//'; }

while getopts "r:ciyh" opt; do
  case "$opt" in
    r) REF="$OPTARG" ;;
    c) CLEAN="--clean" ;;
    i) INSTALL=1 ;;
    y) YES=1 ;;
    h) usage; exit 0 ;;
    *) usage >&2; exit 1 ;;
  esac
done

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$PATH:$ANDROID_HOME/platform-tools"

cd "$ROOT"
WORKTREE=""
cleanup() {
  if [ -n "$WORKTREE" ]; then git worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

if [ -n "$REF" ]; then
  COMMIT="$(git rev-parse --verify "$REF^{commit}")"
  SRC="$(mktemp -d "${TMPDIR:-/tmp}/manga-build.XXXXXX")"
  rmdir "$SRC"
  git worktree add --detach "$SRC" "$COMMIT" >/dev/null
  WORKTREE="$SRC"
  DIRTY=""
else
  COMMIT="$(git rev-parse HEAD)"
  SRC="$ROOT"
  DIRTY="$([ -n "$(git status --porcelain -- apps/mobile packages)" ] && echo "-dirty" || true)"
fi
SHORT="$(git rev-parse --short "$COMMIT")"

echo "==> Building $(git log -1 --format='%h %s' "$COMMIT")${DIRTY:+ (+ uncommitted changes)}"

# Features still waiting on their branch.
unmerged=""
while read -r branch; do
  case "$branch" in stable/*|milestone/*) continue ;; esac
  n="$(git rev-list --count "$COMMIT..$branch")"
  [ "$n" -gt 0 ] && unmerged+="    $branch ($n commits: $(git log -1 --format=%s "$branch"))"$'\n'
done < <(git for-each-ref --format='%(refname:short)' refs/heads/)
if [ -n "$unmerged" ]; then
  echo "!!  These branches have commits that are NOT in this build:"
  printf '%s' "$unmerged"
  if [ -z "$YES" ]; then
    read -r -p "Build anyway? [y/N] " answer
    [ "$answer" = "y" ] || [ "$answer" = "Y" ] || exit 1
  fi
fi

cd "$SRC"
pnpm install --frozen-lockfile
pnpm --filter @manga/mobile exec expo prebuild -p android $CLEAN --no-install
(cd apps/mobile/android && ./gradlew assembleRelease)

VERSION="$(node -p "require('./apps/mobile/app.json').expo.version")"
OUT_DIR="$ROOT/dist/mobile"
OUT="$OUT_DIR/manga-reader-$VERSION-$SHORT$DIRTY.apk"
mkdir -p "$OUT_DIR"
cp apps/mobile/android/app/build/outputs/apk/release/app-release.apk "$OUT"
echo "==> $OUT"

if [ -n "$INSTALL" ]; then
  adb ${ANDROID_SERIAL:+-s "$ANDROID_SERIAL"} install -r "$OUT"
fi
