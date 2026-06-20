#!/usr/bin/env bash
# scripts/pre-publish.sh
# Pre-publish validation orchestrator for the Caatinga monorepo.
#
# Runs all local, no-network checks before `pnpm publish -r`. Reuses the
# existing check-*.sh scripts and pnpm tasks; does not mutate the working tree.
#
# Usage:
#   pnpm pre:publish -- [--tag <tag>] [--keep-going] [--skip <stage>]... [--help]
#
# Stages (in order):
#   version-alignment, ci-stellar-pin, fixture-references, wasm-target-paths,
#   typecheck, lint, format, docs, build, test, publish-dry-run
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TAG="next"
KEEP_GOING=0
SKIP_STAGES=()

usage() {
  cat <<'EOF'
Usage: pre-publish.sh [--tag <tag>] [--keep-going] [--skip <stage>]... [--help]

Runs local, no-network pre-publish validation for the Caatinga monorepo.

Options:
  --tag <tag>        Dist tag passed to `pnpm publish --dry-run` (default: next).
  --keep-going       Do not stop at the first failing stage; report all failures.
  --skip <stage>     Skip a stage by name (may be repeated).
  --help, -h         Show this help and exit.

Stages:
  version-alignment   scripts/check-version-alignment.sh
  ci-stellar-pin      scripts/check-ci-stellar-pin.sh
  fixture-references  scripts/check-fixture-references.sh
  wasm-target-paths   pnpm check:wasm-targets
  typecheck           pnpm typecheck
  lint                pnpm lint
  format              pnpm format:check
  docs                pnpm docs:check
  build               pnpm build
  test                pnpm test
  publish-dry-run     pnpm publish -r --access public --dry-run --no-git-checks --tag <tag>
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --)
      shift
      ;;
    --tag)
      [[ $# -ge 2 ]] || { echo "--tag requires a value" >&2; exit 2; }
      TAG="$2"
      shift 2
      ;;
    --keep-going)
      KEEP_GOING=1
      shift
      ;;
    --skip)
      [[ $# -ge 2 ]] || { echo "--skip requires a value" >&2; exit 2; }
      SKIP_STAGES+=("$2")
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

check_prereqs() {
  if [[ ! -f "$ROOT_DIR/package.json" || ! -d "$ROOT_DIR/scripts" ]]; then
    echo "pre-publish: must run from the repository root (no package.json/scripts dir found at $ROOT_DIR)." >&2
    exit 2
  fi
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "pre-publish: pnpm not found in PATH." >&2
    exit 2
  fi
  if ! node -e 'const [major] = process.versions.node.split(".").map(Number); if (major < 22) process.exit(1)' >/dev/null 2>&1; then
    echo "pre-publish: Node >= 22 required (found $(node --version))." >&2
    exit 2
  fi
}

is_skipped() {
  local target="$1"
  for s in ${SKIP_STAGES[@]+"${SKIP_STAGES[@]}"}; do
    [[ "$s" == "$target" ]] && return 0
  done
  return 1
}

STAGES=()
STATUS=()

run_stage() {
  local name="$1"
  shift
  if is_skipped "$name"; then
    printf '  \u2298 %s (skipped)\n' "$name"
    STAGES+=("$name")
    STATUS+=("skipped")
    return 0
  fi
  printf '  \u25B6 %s\n' "$name"
  local rc=0
  ( "$@" ) || rc=$?
  if [[ $rc -eq 0 ]]; then
    printf '  \u2714 %s\n' "$name"
    STAGES+=("$name")
    STATUS+=("ok")
  else
    printf '  \u2716 %s (exit %s)\n' "$name" "$rc" >&2
    STAGES+=("$name")
    STATUS+=("fail")
    if [[ "$KEEP_GOING" != "1" ]]; then
      printf 'pre-publish: stage "%s" failed. Run with --keep-going to see all failures.\n' "$name" >&2
      exit "$rc"
    fi
  fi
}

summary() {
  local failed=0
  local skipped=0
  local ok=0
  local i
  printf '\n'
  printf '  %-20s %s\n' "STAGE" "STATUS"
  printf '  %-20s %s\n' "-------------------" "--------"
  for i in ${!STAGES[@]}; do
    printf '  %-20s %s\n' "${STAGES[$i]}" "${STATUS[$i]}"
    case "${STATUS[$i]}" in
      ok)      ok=$((ok + 1)) ;;
      fail)    failed=$((failed + 1)) ;;
      skipped) skipped=$((skipped + 1)) ;;
    esac
  done
  printf '\n'
  printf '  %d passed, %d skipped, %d failed\n' "$ok" "$skipped" "$failed"
  if [[ $failed -ne 0 ]]; then
    printf 'pre-publish: %d stage(s) failed. Fix the issues above before publishing.\n' "$failed" >&2
    exit 1
  fi
  printf 'pre-publish: all stages passed. Ready to publish with:\n'
  printf '  pnpm publish -r --access public --no-git-checks --tag %s\n' "$TAG"
}

check_prereqs

printf '\n'
printf 'pre-publish: validating monorepo (tag=%s, keep-going=%s)\n' "$TAG" "$([ "$KEEP_GOING" = "1" ] && echo yes || echo no)"
if [[ ${#SKIP_STAGES[@]} -gt 0 ]]; then
  printf 'pre-publish: skipping: %s\n' "${SKIP_STAGES[*]}"
fi
printf '\n'

run_stage "version-alignment"  bash scripts/check-version-alignment.sh
run_stage "ci-stellar-pin"     bash scripts/check-ci-stellar-pin.sh
run_stage "fixture-references" bash scripts/check-fixture-references.sh
run_stage "wasm-target-paths"  pnpm check:wasm-targets
run_stage "typecheck"          pnpm typecheck
run_stage "lint"               pnpm lint
run_stage "format"             pnpm format:check
run_stage "docs"               pnpm docs:check
run_stage "build"              pnpm build
run_stage "test"               pnpm test
run_stage "publish-dry-run"    pnpm publish -r --access public --dry-run --no-git-checks --tag "$TAG"

summary
