#!/usr/bin/env bash
# scripts/check-version-alignment.sh
# Verifies that all publishable package versions, internal dependencies, and
# templates point to the same version. Run this before publishing.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CORE_VERSION=$(node --input-type=module -e "
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('$ROOT_DIR/packages/core/package.json', 'utf8'));
process.stdout.write(pkg.version);
")

CLIENT_VERSION=$(node --input-type=module -e "
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('$ROOT_DIR/packages/client/package.json', 'utf8'));
process.stdout.write(pkg.version);
")

CLI_VERSION=$(node --input-type=module -e "
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('$ROOT_DIR/packages/cli/package.json', 'utf8'));
process.stdout.write(pkg.version);
")

FAILURES=0

fail() {
  echo "  ✖ $1" >&2
  FAILURES=$((FAILURES + 1))
}

echo ""
echo "Checking version alignment..."
echo ""
echo "  core:   $CORE_VERSION"
echo "  client: $CLIENT_VERSION"
echo "  cli:    $CLI_VERSION"
echo ""

# 1. All three publishable packages must share the same version (fixed group in changeset config)
if [[ "$CORE_VERSION" != "$CLIENT_VERSION" ]]; then
  fail "@caatinga/core ($CORE_VERSION) and @caatinga/client ($CLIENT_VERSION) versions differ."
fi
if [[ "$CORE_VERSION" != "$CLI_VERSION" ]]; then
  fail "@caatinga/core ($CORE_VERSION) and @caatinga/cli ($CLI_VERSION) versions differ."
fi

EXPECTED_RANGE="^$CORE_VERSION"

# 2. Internal dependencies in each package's package.json
check_dep() {
  local file="$1"
  local section="$2"
  local name="$3"
  local actual
  actual=$(node --input-type=module -e "
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('$file', 'utf8'));
process.stdout.write(pkg['$section']?.['$name'] ?? '');
")
  if [[ "$actual" != "$EXPECTED_RANGE" ]]; then
    fail "$file: $section.$name is \"$actual\", expected \"$EXPECTED_RANGE\""
  fi
}

check_dep "$ROOT_DIR/packages/client/package.json" "dependencies" "@caatinga/core"
check_dep "$ROOT_DIR/packages/cli/package.json"    "dependencies" "@caatinga/core"

# 3. Templates must reference the correct version range for all publishable packages
for template_dir in "$ROOT_DIR"/packages/templates/*/; do
  template_pkg="$template_dir/package.json"
  [[ -f "$template_pkg" ]] || continue

  for dep in "@caatinga/core" "@caatinga/client"; do
    actual=$(node --input-type=module -e "
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('$template_pkg', 'utf8'));
const val = pkg.dependencies?.['$dep'] ?? pkg.devDependencies?.['$dep'] ?? '';
process.stdout.write(val);
")
    [[ -z "$actual" ]] && continue
    if [[ "$actual" != "$EXPECTED_RANGE" ]]; then
      fail "$template_pkg: $dep is \"$actual\", expected \"$EXPECTED_RANGE\""
    fi
  done

  for dep in "@caatinga/cli"; do
    actual=$(node --input-type=module -e "
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('$template_pkg', 'utf8'));
const val = pkg.devDependencies?.['$dep'] ?? pkg.dependencies?.['$dep'] ?? '';
process.stdout.write(val);
")
    [[ -z "$actual" ]] && continue
    if [[ "$actual" != "$EXPECTED_RANGE" ]]; then
      fail "$template_pkg: $dep is \"$actual\", expected \"$EXPECTED_RANGE\""
    fi
  done

  # 4. caatinga.template.json must have compatibleCore aligned with the current core version
  template_json="$template_dir/caatinga.template.json"
  if [[ -f "$template_json" ]]; then
    compatible=$(node --input-type=module -e "
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('$template_json', 'utf8'));
process.stdout.write(manifest.caatinga?.compatibleCore ?? '');
")
    if [[ "$compatible" != "$EXPECTED_RANGE" ]]; then
      fail "$template_json: caatinga.compatibleCore is \"$compatible\", expected \"$EXPECTED_RANGE\""
    fi
  fi
done

echo ""
if [[ "$FAILURES" -ne 0 ]]; then
  echo "Version alignment check failed with $FAILURES error(s)." >&2
  echo "Update all references to match @caatinga/core version ($CORE_VERSION) and re-run." >&2
  echo ""
  exit 1
fi

echo "All versions are aligned. ✔"
echo ""
