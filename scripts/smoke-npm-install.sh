#!/bin/sh
# Install, update and uninstall Produktiv through the real upstream skills CLI, once per host.
# Eval suites mock npx, so this is the proof that the pinned CLI actually runs. Needs network.
# By default it packs this checkout. PRODUKTIV_SMOKE_SPEC=produktiv@0.1.0 checks the registry instead.
set -eu

repo=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
export DISABLE_TELEMETRY=1 DO_NOT_TRACK=1

if [ -n "${PRODUKTIV_SMOKE_SPEC:-}" ]; then
  spec=$PRODUKTIV_SMOKE_SPEC
  echo "smoke: registry spec $spec"
else
  node "$repo/workflow/scripts/npm-package.mjs" --output "$work/package" >/dev/null
  mkdir "$work/pack"
  tarball=$(cd "$work" && npm pack "$work/package" --pack-destination "$work/pack" --silent)
  spec="$work/pack/$tarball"
fi

expected=$(ls "$repo/workflow/skills" | wc -l | tr -d ' ')

run() {
  # run <host> <command>: one installer command in that host's project, log kept on failure.
  (cd "$work/$1/project" && HOME="$work/$1/home" npm exec --yes --package "$spec" -- \
    produktiv "$2" --host "$1" --scope project --project . >"$work/$1/$2.log" 2>&1) || {
    cat "$work/$1/$2.log"
    echo "smoke: $1 $2 failed" >&2
    exit 1
  }
}

count() {
  if [ -d "$1" ]; then ls "$1" | grep -c '^pk-' || true; else echo 0; fi
}

for host in claude-code codex cursor; do
  project="$work/$host/project"
  mkdir -p "$project" "$work/$host/home"
  git -C "$project" init --quiet
  case "$host" in
    claude-code) skills="$project/.claude/skills" ;;
    *) skills="$project/.agents/skills" ;;
  esac
  for command in install update; do
    run "$host" "$command"
    found=$(count "$skills")
    if [ "$found" != "$expected" ]; then
      echo "smoke: $host $command left $found pk- skills, expected $expected" >&2
      exit 1
    fi
    test -f "$project/produktiv-lock.json"
  done
  mkdir -p "$project/.workflow"
  echo keep >"$project/.workflow/marker"
  run "$host" uninstall
  found=$(count "$skills")
  if [ "$found" != 0 ]; then
    echo "smoke: $host uninstall left $found pk- skills" >&2
    exit 1
  fi
  test -f "$project/.workflow/marker" || {
    echo "smoke: $host uninstall removed .workflow state" >&2
    exit 1
  }
  echo "smoke: $host ok ($expected skills, update and uninstall)"
done
