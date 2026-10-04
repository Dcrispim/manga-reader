#!/usr/bin/env bash
# Compare GET responses of two manga-reader server instances (e.g. the stable
# container on :3993 vs the monorepo-test image on :3994).
# GET only: never call POST routes (/bind, /upscale, /search/rebuild).
# JSON bodies are compared after `jq -S .`; images by status, content-type and
# sha256 of the body; "/" by status only (HTML may embed build-specific hashes).
# Usage: scripts/smoke.sh <baseA> <baseB>
#        scripts/smoke.sh --new-only <base>
# --new-only checks /api/health and /api/catalog on the new instance only: the
# stable container does not have these endpoints, so there is nothing to compare.
set -euo pipefail

if [ "${1:-}" = "--new-only" ]; then
  [ $# -eq 2 ] || { echo "usage: $0 --new-only <base>" >&2; exit 2; }
  N="${2%/}"
  nfails=0
  check() { # <description> <jq-filter> <file>
    if jq -e "$2" "$3" > /dev/null 2>&1; then echo "OK   $1"; else echo "FAIL $1"; nfails=$((nfails + 1)); fi
  }
  tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
  curl -sf "$N/api/list" > "$tmp/list.json" || { echo "base not responding" >&2; exit 2; }
  curl -sf "$N/api/health" > "$tmp/health.json" || { echo "FAIL /api/health unreachable"; exit 1; }
  check "/api/health version not empty" '(.version // "") | length > 0' "$tmp/health.json"
  check "/api/health features has catalog" '.features | index("catalog") != null' "$tmp/health.json"
  check "/api/health serverId present" '(.serverId // "") | length > 0' "$tmp/health.json"

  t0=$(date +%s.%N)
  curl -sf "$N/api/catalog?since=0" > "$tmp/full.json" || { echo "FAIL /api/catalog?since=0 unreachable"; exit 1; }
  t1=$(date +%s.%N)
  list_n=$(jq 'length' "$tmp/list.json")
  check "catalog allTitleNames count == /api/list ($list_n)" ".allTitleNames | length == $list_n" "$tmp/full.json"
  check "catalog every title has non-empty chapters" '(.titles | length > 0) and all(.titles[]; (.chapters | length) > 0)' "$tmp/full.json"
  st=$(jq -r '.serverTime' "$tmp/full.json")

  t2=$(date +%s.%N)
  curl -sf "$N/api/catalog?since=$st" > "$tmp/inc.json" || { echo "FAIL incremental unreachable"; exit 1; }
  t3=$(date +%s.%N)
  check "catalog?since=serverTime has empty titles" '.titles | length == 0' "$tmp/inc.json"

  awk -v a="$t0" -v b="$t1" 'BEGIN{printf "TIME catalog since=0: %.3f s\n", b-a}'
  awk -v a="$t2" -v b="$t3" 'BEGIN{printf "TIME catalog since=serverTime: %.3f s\n", b-a}'
  if [ "$nfails" -gt 0 ]; then echo "FAILED: $nfails checks"; exit 1; fi
  echo "ALL OK (new-only)"
  exit 0
fi

[ $# -eq 2 ] || { echo "usage: $0 <baseA> <baseB>" >&2; exit 2; }
A="${1%/}"; B="${2%/}"
fails=0

enc() { jq -rn --arg s "$1" '$s|@uri'; }

report() { # <ok|diff> <route>
  if [ "$1" = ok ]; then echo "OK   $2"; else echo "DIFF $2"; fails=$((fails + 1)); fi
}

# Normalized JSON (sorted keys) plus HTTP status, so 404s compare too.
json_sig() { # <base> <route>
  local body code
  body=$(mktemp)
  code=$(curl -s -o "$body" -w '%{http_code}' "$1$2" || true)
  echo "status=$code"
  jq -S . "$body" 2>/dev/null || cat "$body"
  rm -f "$body"
}

img_sig() { # <base> <route>
  local body hdr code
  body=$(mktemp); hdr=$(mktemp)
  code=$(curl -s -D "$hdr" -o "$body" -w '%{http_code}' "$1$2" || true)
  echo "status=$code"
  grep -i '^content-type:' "$hdr" | tr -d '\r' | tr 'A-Z' 'a-z' || true
  sha256sum < "$body"
  rm -f "$body" "$hdr"
}

status_sig() { curl -s -o /dev/null -w 'status=%{http_code}\n' "$1$2" || true; }

cmp_route() { # <json|img|status> <route>
  local fn="${1}_sig" a b
  a=$($fn "$A" "$2"); b=$($fn "$B" "$2")
  if [ "$a" = "$b" ]; then report ok "$2"; else report diff "$2"; fi
}

curl -sf "$A/api/list" > /dev/null || { echo "baseA not responding" >&2; exit 2; }
curl -sf "$B/api/list" > /dev/null || { echo "baseB not responding" >&2; exit 2; }

list=$(curl -sf "$A/api/list")
mapfile -t names < <(jq -r '[.[].name] | sort | .[]' <<< "$list")
n=${#names[@]}
[ "$n" -gt 0 ] || { echo "no titles in $A/api/list" >&2; exit 2; }

# first, middle and last title (deduplicated for tiny libraries)
mapfile -t picks < <(printf '%s\n' "${names[0]}" "${names[$((n / 2))]}" "${names[$((n - 1))]}" | awk '!s[$0]++')

cmp_route json /api/list
cmp_route json /api/categories
cat_id=$(curl -sf "$A/api/categories" | jq -r '.categories[0].id // empty')
[ -z "$cat_id" ] || cmp_route json "/api/categories/$(enc "$cat_id")"
cmp_route json "/api/search?q=$(enc "${names[0]:0:3}")"
cmp_route status /

for t in "${picks[@]}"; do
  et=$(enc "$t")
  cmp_route json "/api/metadata/$et"
  cmp_route json "/api/read/$et"
  first=$(curl -sf "$A/api/read/$et" | jq -r '.chapters[0] // empty')
  last=$(curl -sf "$A/api/read/$et" | jq -r '.chapters[-1] // empty')
  for c in $(printf '%s\n' "$first" "$last" | awk 'NF && !s[$0]++'); do
    ec=$(enc "$c")
    cmp_route json "/api/read/$et/$ec"
    cmp_route img "/api/read/$et/$ec/0"
    cmp_route img "/api/read/$et/$ec/thumb"
  done
done

if [ "$fails" -gt 0 ]; then echo "FAILED: $fails DIFF"; exit 1; fi
echo "ALL OK"
