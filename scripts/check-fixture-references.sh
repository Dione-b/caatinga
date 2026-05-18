#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE_ROOT="$ROOT_DIR/packages/core/test/fixtures/stellar-cli"
SEARCH_ROOT="$ROOT_DIR/packages/core"

missing=0

fixture_referenced_in_tests() {
  local needle="$1"
  if command -v rg >/dev/null 2>&1; then
    rg -q --fixed-strings "$needle" "$SEARCH_ROOT" --glob '*.test.ts' 2>/dev/null
    return $?
  fi
  grep -rq --include='*.test.ts' -F "$needle" "$SEARCH_ROOT" 2>/dev/null
}

while IFS= read -r -d '' fixture; do
  rel="${fixture#"$FIXTURE_ROOT/"}"
  base="$(basename "$rel")"
  if fixture_referenced_in_tests "$rel"; then
    continue
  fi
  if fixture_referenced_in_tests "$base"; then
    continue
  fi
  echo "Orphan fixture (no reference in packages/core/**/*.test.ts): $rel" >&2
  missing=1
done < <(find "$FIXTURE_ROOT" -type f ! -name '.gitkeep' -print0)

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

echo "check-fixture-references: OK"
