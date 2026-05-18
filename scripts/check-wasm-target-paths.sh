#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LEGACY_TARGET="wasm32-unknown-unknown"
CURRENT_TARGET="wasm32v1-none"
failed=0

check_tree() {
  local label="$1"
  local tree="$2"

  if [[ ! -d "$tree" ]]; then
    echo "check-wasm-target-paths: skip missing $label ($tree)" >&2
    return 0
  fi

  if command -v rg >/dev/null 2>&1; then
    if matches="$(rg -n --fixed-strings "$LEGACY_TARGET" "$tree" 2>/dev/null || true)"; then
      if [[ -n "$matches" ]]; then
        echo "Legacy Rust wasm target found in $label:" >&2
        echo "$matches" >&2
        failed=1
      fi
    fi
  else
    if grep -RIn --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=target -F "$LEGACY_TARGET" "$tree" >/tmp/check-wasm-target-paths.txt 2>/dev/null; then
      echo "Legacy Rust wasm target found in $label:" >&2
      cat /tmp/check-wasm-target-paths.txt >&2
      rm -f /tmp/check-wasm-target-paths.txt
      failed=1
    fi
  fi

  local config_count=0
  local current_count=0
  while IFS= read -r -d '' config_file; do
    config_count=$((config_count + 1))
    if grep -q "target/${CURRENT_TARGET}/release/" "$config_file"; then
      current_count=$((current_count + 1))
    else
      echo "Missing ${CURRENT_TARGET} wasm path in $config_file" >&2
      failed=1
    fi
  done < <(find "$tree" -name 'caatinga.config.ts' -print0)

  if [[ "$config_count" -eq 0 ]]; then
    echo "check-wasm-target-paths: no caatinga.config.ts files under $label ($tree)" >&2
    failed=1
  fi
}

check_tree "official templates" "$ROOT_DIR/packages/templates"
check_tree "bundled CLI templates" "$ROOT_DIR/packages/cli/templates"

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

echo "check-wasm-target-paths: OK"
