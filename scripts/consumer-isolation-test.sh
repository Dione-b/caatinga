#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKED_DIR="${PACKED_DIR:-$ROOT_DIR/packed}"
SKIP_PACK="${SKIP_PACK:-0}"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/caatinga-consumer-test.XXXXXX")"
NPM_CACHE_DIR="$TMP_DIR/.npm-cache"
NPM_USERCONFIG="$TMP_DIR/.npmrc"
RESOLVE_ABS_PATH_CMD='import path from "node:path"; process.stdout.write(path.resolve(process.argv[1]));'

source "$ROOT_DIR/scripts/lib/archive-contains-path.sh"

cleanup() {
  rm -rf "$ROOT_DIR/packages/cli/templates"
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

unset CAATINGA_TEMPLATES_DIR

mkdir -p "$NPM_CACHE_DIR"
cat > "$NPM_USERCONFIG" <<EOF
cache=$NPM_CACHE_DIR
prefer-offline=true
audit=false
fund=false
progress=false
update-notifier=false
EOF

export NPM_CONFIG_CACHE="$NPM_CACHE_DIR"
export npm_config_cache="$NPM_CACHE_DIR"
export NPM_CONFIG_USERCONFIG="$NPM_USERCONFIG"
export npm_config_userconfig="$NPM_USERCONFIG"

if [[ "$SKIP_PACK" != "1" ]]; then
  rm -rf "$PACKED_DIR"
  mkdir -p "$PACKED_DIR"
  pnpm --dir "$ROOT_DIR" build
  rm -rf "$ROOT_DIR/packages/cli/templates"
  cp -r "$ROOT_DIR/packages/templates" "$ROOT_DIR/packages/cli/templates"
  ( cd "$ROOT_DIR/packages/core" && pnpm pack --pack-destination "$PACKED_DIR" )
  ( cd "$ROOT_DIR/packages/client" && pnpm pack --pack-destination "$PACKED_DIR" )
  ( cd "$ROOT_DIR/packages/cli" && pnpm pack --pack-destination "$PACKED_DIR" )
else
  mkdir -p "$PACKED_DIR"
fi

shopt -s nullglob
for t in "$PACKED_DIR"/*.tgz; do
  if ! tar -xOf "$t" package/package.json 2>/dev/null | node --input-type=module -e '
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(0, "utf8"));
const sections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
];

for (const section of sections) {
  for (const [name, value] of Object.entries(pkg[section] ?? {})) {
    if (/^(workspace:|link:|file:)/.test(value)) {
      console.error(`${section}.${name}=${value}`);
      process.exit(1);
    }
  }
}
'; then
    echo "Packed package $t contains a monorepo-only dependency reference." >&2
    exit 1
  fi
done

_kcore=( "$PACKED_DIR"/caatinga-core-*.tgz )
_kclient=( "$PACKED_DIR"/caatinga-client-*.tgz )
_kcli=( "$PACKED_DIR"/caatinga-cli-*.tgz )

if [[ ${#_kcore[@]} -ne 1 ]]; then
  echo "Expected exactly one core tarball in $PACKED_DIR, found ${#_kcore[@]}" >&2
  exit 1
fi

if [[ ${#_kclient[@]} -ne 1 ]]; then
  echo "Expected exactly one client tarball in $PACKED_DIR, found ${#_kclient[@]}" >&2
  exit 1
fi

if [[ ${#_kcli[@]} -ne 1 ]]; then
  echo "Expected exactly one CLI tarball in $PACKED_DIR, found ${#_kcli[@]}" >&2
  exit 1
fi

ROOT_TEMPLATES_DIR="$ROOT_DIR/packages/templates"
if [[ ! -d "$ROOT_TEMPLATES_DIR" ]]; then
  echo "Expected templates directory at $ROOT_TEMPLATES_DIR" >&2
  exit 1
fi

for template_name in "$ROOT_TEMPLATES_DIR"/*; do
  if [[ ! -d "$template_name" ]]; then
    continue
  fi
  template_name="$(basename "$template_name")"

  if ! archive_contains_path "${_kcli[0]}" "package/templates/${template_name}/caatinga.template.json"; then
    echo "CLI tarball is missing bundled template manifest: package/templates/${template_name}/caatinga.template.json in ${_kcli[0]}" >&2
    exit 1
  fi
done

_read_template_range() {
  local section="$1"
  local name="$2"
  tar -xOf "${_kcli[0]}" package/templates/react-vite-counter/package.json | node --input-type=module -e '
import { readFileSync } from "node:fs";

const [section, name] = process.argv.slice(1);
const templatePkg = JSON.parse(readFileSync(0, "utf8"));
const value = templatePkg[section]?.[name];

if (!value) {
  console.error(`Bundled react-vite-counter template is missing ${section}.${name}.`);
  process.exit(1);
}

process.stdout.write(value);
' "$section" "$name"
}

export EXPECTED_CORE_RANGE="$(_read_template_range dependencies '@caatinga/core')"
export EXPECTED_CLIENT_RANGE="$(_read_template_range dependencies '@caatinga/client')"
export EXPECTED_CLI_RANGE="$(_read_template_range devDependencies '@caatinga/cli')"

cd "$TMP_DIR"
npm init -y >/dev/null
npm install --no-audit --fund=false --prefer-offline "${_kcore[0]}" "${_kclient[0]}" "${_kcli[0]}"

CAATINGA_BIN="$TMP_DIR/node_modules/.bin/caatinga"
if [[ ! -x "$CAATINGA_BIN" ]]; then
  echo "Expected local CLI binary at $CAATINGA_BIN" >&2
  exit 1
fi

node --input-type=module -e '
import { defineConfig } from "@caatinga/core";

if (typeof defineConfig !== "function") {
  console.error(`Expected defineConfig to be a function, found ${typeof defineConfig}`);
  process.exit(1);
}
'
node --input-type=module -e '
import { createCaatingaClient } from "@caatinga/client";

if (typeof createCaatingaClient !== "function") {
  console.error(
    `Expected createCaatingaClient to be a function, found ${typeof createCaatingaClient}`
  );
  process.exit(1);
}
'
"$CAATINGA_BIN" --version
"$CAATINGA_BIN" init test-app --template react-vite-counter
test -f test-app/caatinga.config.ts
test -f test-app/caatinga.artifacts.json

node --input-type=module -e '
import { readFileSync } from "node:fs";

const pj = JSON.parse(readFileSync("test-app/package.json", "utf8"));
const expected = {
  dependencies: {
    "@caatinga/core": process.env.EXPECTED_CORE_RANGE,
    "@caatinga/client": process.env.EXPECTED_CLIENT_RANGE
  },
  devDependencies: {
    "@caatinga/cli": process.env.EXPECTED_CLI_RANGE
  }
};

for (const [section, values] of Object.entries(expected)) {
  for (const [name, version] of Object.entries(values)) {
    if (pj[section]?.[name] !== version) {
      console.error(
        `Generated app manifest mismatch for ${section}.${name}: expected ${version}, found ${pj[section]?.[name] ?? "missing"}`
      );
      process.exit(1);
    }
  }
}
'

cd test-app

export CAATINGA_PATCH_CORE="file:$(node --input-type=module -e "$RESOLVE_ABS_PATH_CMD" "${_kcore[0]}")"
export CAATINGA_PATCH_CLIENT="file:$(node --input-type=module -e "$RESOLVE_ABS_PATH_CMD" "${_kclient[0]}")"
export CAATINGA_PATCH_CLI="file:$(node --input-type=module -e "$RESOLVE_ABS_PATH_CMD" "${_kcli[0]}")"

node --input-type=module -e "
import { readFileSync, writeFileSync } from \"node:fs\";
const pj = JSON.parse(readFileSync(\"package.json\", \"utf8\"));
pj.dependencies[\"@caatinga/core\"] = process.env.CAATINGA_PATCH_CORE;
pj.dependencies[\"@caatinga/client\"] = process.env.CAATINGA_PATCH_CLIENT;
if (pj.devDependencies && Object.prototype.hasOwnProperty.call(pj.devDependencies, \"@caatinga/cli\")) {
  pj.devDependencies[\"@caatinga/cli\"] = process.env.CAATINGA_PATCH_CLI;
}
if (pj.dependencies && Object.prototype.hasOwnProperty.call(pj.dependencies, \"@caatinga/cli\")) {
  pj.dependencies[\"@caatinga/cli\"] = process.env.CAATINGA_PATCH_CLI;
}
writeFileSync(\"package.json\", JSON.stringify(pj, null, 2) + \"\\n\");
"

npm install --no-audit --fund=false --prefer-offline
npm run build

if ! grep -r 'createCaatingaClient' dist/ >/dev/null 2>&1; then
  echo "Bundled template dist missing createCaatingaClient" >&2
  exit 1
fi

cd "$TMP_DIR"

"$CAATINGA_BIN" init market-app --template marketplace-with-token
test -f market-app/caatinga.config.ts
test -f market-app/caatinga.artifacts.json
test -f market-app/src/App.tsx
test -f market-app/contracts/token/src/lib.rs
test -f market-app/contracts/marketplace/src/lib.rs

cd market-app

node --input-type=module -e "
import { readFileSync, writeFileSync } from \"node:fs\";
const pj = JSON.parse(readFileSync(\"package.json\", \"utf8\"));
pj.dependencies[\"@caatinga/core\"] = process.env.CAATINGA_PATCH_CORE;
pj.dependencies[\"@caatinga/client\"] = process.env.CAATINGA_PATCH_CLIENT;
if (pj.devDependencies && Object.prototype.hasOwnProperty.call(pj.devDependencies, \"@caatinga/cli\")) {
  pj.devDependencies[\"@caatinga/cli\"] = process.env.CAATINGA_PATCH_CLI;
}
if (pj.dependencies && Object.prototype.hasOwnProperty.call(pj.dependencies, \"@caatinga/cli\")) {
  pj.dependencies[\"@caatinga/cli\"] = process.env.CAATINGA_PATCH_CLI;
}
writeFileSync(\"package.json\", JSON.stringify(pj, null, 2) + \"\\n\");
"

npm install --no-audit --fund=false --prefer-offline
npm run build
cd "$TMP_DIR"
