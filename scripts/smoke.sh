#!/usr/bin/env bash
# Compare GET responses of two manga-reader server instances (e.g. the stable
# container on :3993 vs the monorepo-test image on :3994).
# GET only: never call POST routes (/bind, /upscale, /search/rebuild).
# JSON bodies are compared after `jq -S .`; images by status, content-type and
# sha256 of the body; "/" by status only (HTML may embed build-specific hashes).
# Usage: scripts/smoke.sh <baseA> <baseB>
set -euo pipefail

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
