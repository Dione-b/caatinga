#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKED_DIR="${PACKED_DIR:-$ROOT_DIR/packed}"

shopt -s nullglob
CORE_TGZ=( "$PACKED_DIR"/caatinga-core-*.tgz )
CLIENT_TGZ=( "$PACKED_DIR"/caatinga-client-*.tgz )
if [[ ${#CORE_TGZ[@]} -eq 0 || ${#CLIENT_TGZ[@]} -eq 0 ]]; then
  echo "Missing packed tarballs in $PACKED_DIR (run pnpm ci:snapshot-pack or pnpm test:consumer first)." >&2
  exit 1
fi

run_fixture() {
  local name="$1"
  local src="$ROOT_DIR/scripts/consumer-client-bundlers/$name"
  local tmp="${TMPDIR:-/tmp}/caatinga-client-bundler-$name-$$"
  rm -rf "$tmp"
  cp -a "$src" "$tmp"
  cd "$tmp"
  npm install "${CORE_TGZ[0]}" "${CLIENT_TGZ[0]}"
  npm run build
  if grep -r 'execa' "$tmp/dist" >/dev/null 2>&1; then
    echo "execa leaked into client bundler output ($name)" >&2
    exit 1
  fi
  cd "$ROOT_DIR"
  rm -rf "$tmp"
}

run_fixture vite
run_fixture webpack

BARE_TMP="${TMPDIR:-/tmp}/caatinga-client-bare-$$"
rm -rf "$BARE_TMP"
mkdir -p "$BARE_TMP"
cd "$BARE_TMP"
npm init -y >/dev/null
npm install "${CORE_TGZ[0]}" "${CLIENT_TGZ[0]}"
node --input-type=module -e 'import { createCaatingaClient } from "@caatinga/client"; console.log(typeof createCaatingaClient)'
cd "$ROOT_DIR"
rm -rf "$BARE_TMP"

echo "consumer-client-bundlers-test: OK"
