#!/usr/bin/env bash
# Fetch pinned upstream repos into .upstream/ (local dev corpus; gitignored).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="${ROOT}/docs/upstream/UPSTREAMS.yaml"
UPSTREAM_DIR="${ROOT}/.upstream"

if [[ ! -f "$MANIFEST" ]]; then
  echo "error: missing manifest: $MANIFEST" >&2
  exit 1
fi

mkdir -p "$UPSTREAM_DIR"

parse_entries() {
  local key="" repo="" commit=""
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue
    if [[ "$line" =~ ^([a-z0-9-]+):$ ]]; then
      key="${BASH_REMATCH[1]}"
      repo="" commit=""
    elif [[ "$line" =~ ^[[:space:]]+repo:[[:space:]]+(.+)$ ]]; then
      repo="${BASH_REMATCH[1]}"
    elif [[ "$line" =~ ^[[:space:]]+commit:[[:space:]]+(.+)$ ]]; then
      commit="${BASH_REMATCH[1]}"
      if [[ -n "$key" && -n "$repo" && -n "$commit" ]]; then
        printf '%s\t%s\t%s\n' "$key" "$repo" "$commit"
        key="" repo="" commit=""
      fi
    fi
  done < "$MANIFEST"
}

fetch_one() {
  local name="$1" repo="$2" expected="$3"
  local dest="${UPSTREAM_DIR}/${name}"

  if [[ -d "${dest}/.git" ]]; then
    echo "== ${name}: already present, validating only"
    cd "$dest"
    git fetch --quiet origin 2>/dev/null || true
    git checkout --quiet "$expected" 2>/dev/null || git checkout --quiet "$expected"
  else
    echo "== ${name}: cloning"
    git clone --quiet "$repo" "$dest"
    cd "$dest"
    git checkout --quiet "$expected"
  fi

  local actual clean status
  actual="$(git rev-parse HEAD)"
  if [[ "$actual" != "$expected" ]]; then
    echo "error: ${name}: HEAD ${actual} != expected ${expected}" >&2
    return 1
  fi
  if [[ -n "$(git status --short)" ]]; then
    echo "error: ${name}: working tree is not clean" >&2
    git status --short >&2
    return 1
  fi
  echo "ok: ${name} @ ${actual}"
}

while IFS=$'\t' read -r name repo commit; do
  fetch_one "$name" "$repo" "$commit"
done < <(parse_entries)

echo "All upstream checkouts validated."
