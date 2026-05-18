#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKED_DIR="$ROOT_DIR/packed"
EXTRACT_DIR="$ROOT_DIR/packed-unpacked-package-jsons"
CHANGESET_DIR="$ROOT_DIR/.changeset"
BACKUP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/caatinga-ci-snapshot-pack.XXXXXX")"
CHANGESET_BACKUP_DIR="$BACKUP_DIR/.changeset"
CHANGESET_BACKUP_READY=0
CHANGESET_EXISTED=0
SNAPSHOT_CHANGESET_FILE=""
TEMPLATES_DIR="$ROOT_DIR/packages/templates"
source "$ROOT_DIR/scripts/lib/archive-contains-path.sh"
SNAPSHOT_RESTORE_FILES=(
  "$ROOT_DIR/packages/core/package.json"
  "$ROOT_DIR/packages/client/package.json"
  "$ROOT_DIR/packages/cli/package.json"
  "$ROOT_DIR/packages/core/CHANGELOG.md"
  "$ROOT_DIR/packages/client/CHANGELOG.md"
  "$ROOT_DIR/packages/cli/CHANGELOG.md"
)

cleanup() {
  local file
  local backup_path

  rm -rf "$EXTRACT_DIR"
  rm -rf "$ROOT_DIR/packages/cli/templates"

  for file in "${SNAPSHOT_RESTORE_FILES[@]}"; do
    backup_path="$BACKUP_DIR/${file#$ROOT_DIR/}"
    if [[ -f "$backup_path" ]]; then
      cp "$backup_path" "$file"
    fi
  done

  for template_pkg in "$TEMPLATES_DIR"/*/package.json; do
    backup_path="$BACKUP_DIR/${template_pkg#$ROOT_DIR/}"
    if [[ -f "$backup_path" ]]; then
      cp "$backup_path" "$template_pkg"
    fi
  done

  for template_manifest in "$TEMPLATES_DIR"/*/caatinga.template.json; do
    backup_path="$BACKUP_DIR/${template_manifest#$ROOT_DIR/}"
    if [[ -f "$backup_path" ]]; then
      cp "$backup_path" "$template_manifest"
    fi
  done

  if [[ "$CHANGESET_BACKUP_READY" == "1" && "$CHANGESET_EXISTED" == "1" && -d "$CHANGESET_BACKUP_DIR" ]]; then
    rm -rf "$CHANGESET_DIR"
    cp -R "$CHANGESET_BACKUP_DIR" "$CHANGESET_DIR"
  elif [[ "$CHANGESET_EXISTED" == "0" ]]; then
    rm -rf "$CHANGESET_DIR"
  fi

  rm -rf "$BACKUP_DIR"
}

trap cleanup EXIT

rm -rf "$PACKED_DIR" "$EXTRACT_DIR"
mkdir -p "$PACKED_DIR" "$EXTRACT_DIR"

pnpm --dir "$ROOT_DIR" build

if [[ -d "$CHANGESET_DIR" ]]; then
  cp -R "$CHANGESET_DIR" "$CHANGESET_BACKUP_DIR"
  if [[ ! -d "$CHANGESET_BACKUP_DIR" ]]; then
    echo "Failed to capture .changeset backup in $CHANGESET_BACKUP_DIR" >&2
    exit 1
  fi
  CHANGESET_EXISTED=1
fi
CHANGESET_BACKUP_READY=1

for file in "${SNAPSHOT_RESTORE_FILES[@]}"; do
  mkdir -p "$BACKUP_DIR/$(dirname "${file#$ROOT_DIR/}")"
  cp "$file" "$BACKUP_DIR/${file#$ROOT_DIR/}"
done

mkdir -p "$CHANGESET_DIR"
SNAPSHOT_CHANGESET_FILE="$(mktemp "$CHANGESET_DIR/__ci_snapshot__.XXXXXX.md")"

cat > "$SNAPSHOT_CHANGESET_FILE" <<'EOF'
---
"@caatinga/cli": patch
---

chore: ci snapshot for pack validation (do not commit)
EOF

pnpm --dir "$ROOT_DIR" exec changeset version --snapshot smoke

for template_pkg in "$TEMPLATES_DIR"/*/package.json; do
  mkdir -p "$BACKUP_DIR/$(dirname "${template_pkg#$ROOT_DIR/}")"
  cp "$template_pkg" "$BACKUP_DIR/${template_pkg#$ROOT_DIR/}"
done

for template_manifest in "$TEMPLATES_DIR"/*/caatinga.template.json; do
  mkdir -p "$BACKUP_DIR/$(dirname "${template_manifest#$ROOT_DIR/}")"
  cp "$template_manifest" "$BACKUP_DIR/${template_manifest#$ROOT_DIR/}"
done

node --input-type=module -e '
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.argv[1];
const templatesDir = path.join(rootDir, "packages/templates");
const packageVersions = {
  "@caatinga/core": JSON.parse(readFileSync(path.join(rootDir, "packages/core/package.json"), "utf8")).version,
  "@caatinga/client": JSON.parse(readFileSync(path.join(rootDir, "packages/client/package.json"), "utf8")).version,
  "@caatinga/cli": JSON.parse(readFileSync(path.join(rootDir, "packages/cli/package.json"), "utf8")).version
};
const sections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
];

for (const entry of readdirSync(templatesDir)) {
  const templateDir = path.join(templatesDir, entry);
  if (!statSync(templateDir).isDirectory()) {
    continue;
  }

  const packageJsonPath = path.join(templateDir, "package.json");
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));

  for (const section of sections) {
    for (const name of Object.keys(pkg[section] ?? {})) {
      if (Object.hasOwn(packageVersions, name)) {
        pkg[section][name] = `^${packageVersions[name]}`;
      }
    }
  }

  writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
}
' "$ROOT_DIR"

pnpm --dir "$ROOT_DIR" --filter @caatinga/cli build

( cd "$ROOT_DIR/packages/core" && pnpm pack --pack-destination "$PACKED_DIR" )
( cd "$ROOT_DIR/packages/client" && pnpm pack --pack-destination "$PACKED_DIR" )
( cd "$ROOT_DIR/packages/cli" && pnpm pack --pack-destination "$PACKED_DIR" )

shopt -s nullglob
core_tarball=( "$PACKED_DIR"/caatinga-core-*.tgz )
client_tarball=( "$PACKED_DIR"/caatinga-client-*.tgz )
cli_tarball=( "$PACKED_DIR"/caatinga-cli-*.tgz )
if [[ ${#core_tarball[@]} -ne 1 ]]; then
  echo "Expected exactly one core tarball in $PACKED_DIR, found ${#core_tarball[@]}" >&2
  exit 1
fi

if [[ ${#client_tarball[@]} -ne 1 ]]; then
  echo "Expected exactly one client tarball in $PACKED_DIR, found ${#client_tarball[@]}" >&2
  exit 1
fi

if [[ ${#cli_tarball[@]} -ne 1 ]]; then
  echo "Expected exactly one CLI tarball in $PACKED_DIR, found ${#cli_tarball[@]}" >&2
  exit 1
fi

if ! archive_contains_path "${cli_tarball[0]}" "package/templates/react-vite-counter/caatinga.template.json"; then
  echo "CLI tarball is missing bundled templates: ${cli_tarball[0]}" >&2
  exit 1
fi

echo "CLI template evidence: package/templates/react-vite-counter/caatinga.template.json"

if ! archive_contains_path "${cli_tarball[0]}" "package/templates/react-vite-counter/package.json"; then
  echo "CLI tarball is missing bundled template package.json: ${cli_tarball[0]}" >&2
  exit 1
fi

echo "CLI template package evidence: package/templates/react-vite-counter/package.json"

packed_core_version="$(tar -xOf "${core_tarball[0]}" package/package.json | node --input-type=module -e 'import { readFileSync } from "node:fs"; const pkg = JSON.parse(readFileSync(0, "utf8")); process.stdout.write(pkg.version);')"
packed_client_version="$(tar -xOf "${client_tarball[0]}" package/package.json | node --input-type=module -e 'import { readFileSync } from "node:fs"; const pkg = JSON.parse(readFileSync(0, "utf8")); process.stdout.write(pkg.version);')"
packed_cli_version="$(tar -xOf "${cli_tarball[0]}" package/package.json | node --input-type=module -e 'import { readFileSync } from "node:fs"; const pkg = JSON.parse(readFileSync(0, "utf8")); process.stdout.write(pkg.version);')"
core_runtime_version="$(node --input-type=module -e '
import { readFileSync } from "node:fs";

const source = readFileSync(process.argv[1], "utf8");
const match = source.match(/CAATINGA_CORE_VERSION\s*=\s*"([^"]+)"/);
if (!match) {
  console.error("Could not read CAATINGA_CORE_VERSION.");
  process.exit(1);
}

process.stdout.write(match[1]);
' "$ROOT_DIR/packages/core/src/version.ts")"

export EXPECTED_PACKED_INTERNAL_VERSIONS="$(node --input-type=module -e '
import { readFileSync } from "node:fs";
import path from "node:path";

const [rootDir, coreVersion, clientVersion, cliVersion] = process.argv.slice(1);
const packageVersions = {
  "@caatinga/core": coreVersion,
  "@caatinga/client": clientVersion,
  "@caatinga/cli": cliVersion
};
const packageJsonPaths = [
  path.join(rootDir, "packages/core/package.json"),
  path.join(rootDir, "packages/client/package.json"),
  path.join(rootDir, "packages/cli/package.json")
];
const sections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
];
const expectedByPackage = {};

for (const packageJsonPath of packageJsonPaths) {
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const expected = {};

  for (const section of sections) {
    for (const [name, value] of Object.entries(pkg[section] ?? {})) {
      if (Object.hasOwn(packageVersions, name)) {
        expected[name] = {
          section,
          value: value.replace(/^([\^~])?\d+\.\d+\.\d+(?:[-+][^\\s]+)?$/, (_, prefix = "") => `${prefix}${packageVersions[name]}`)
        };
      }
    }
  }

  expectedByPackage[pkg.name] = expected;
}

process.stdout.write(JSON.stringify(expectedByPackage));
' "$ROOT_DIR" "$packed_core_version" "$packed_client_version" "$packed_cli_version")"

export EXPECTED_TEMPLATE_INTERNAL_RANGES="$(node --input-type=module -e '
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const templatesDir = process.argv[1];
const sections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
];
const expected = {};

for (const entry of readdirSync(templatesDir)) {
  const templateDir = path.join(templatesDir, entry);
  if (!statSync(templateDir).isDirectory()) {
    continue;
  }

  const packageJsonPath = path.join(templateDir, "package.json");
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const templateExpected = {};

  for (const section of sections) {
    for (const [name, value] of Object.entries(pkg[section] ?? {})) {
      if (name.startsWith("@caatinga/")) {
        templateExpected[name] = { section, value };
      }
    }
  }

  if (Object.keys(templateExpected).length > 0) {
    expected[entry] = templateExpected;
  }
}

process.stdout.write(JSON.stringify(expected));
' "$TEMPLATES_DIR")"

for t in "$PACKED_DIR"/*.tgz; do
  base="$(basename "$t" .tgz)"
  mkdir -p "$EXTRACT_DIR/$base"
  tar -xzf "$t" -C "$EXTRACT_DIR/$base" package/package.json
  if ! node --input-type=module -e '
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(process.argv[1], "utf8"));
const sections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
];
const expectedInternalVersions = JSON.parse(process.env.EXPECTED_PACKED_INTERNAL_VERSIONS ?? "{}");
const expectedForPackage = expectedInternalVersions[pkg.name] ?? {};

for (const section of sections) {
  for (const [name, value] of Object.entries(pkg[section] ?? {})) {
    if (/^(workspace:|link:|file:)/.test(value)) {
      console.error(`${section}.${name}=${value}`);
      process.exit(1);
    }

    const expectedDependency = expectedForPackage[name];
    if (expectedDependency && value !== expectedDependency.value) {
      console.error(
        `${section}.${name} expected ${expectedDependency.value} but found ${value}`
      );
      process.exit(1);
    }
  }
}

for (const [name, expectation] of Object.entries(expectedForPackage)) {
  const actualValue = pkg[expectation.section]?.[name];
  if (actualValue !== expectation.value) {
    console.error(
      `${expectation.section}.${name} expected ${expectation.value} but found ${actualValue ?? "missing"}`
    );
    process.exit(1);
  }
}
' "$EXTRACT_DIR/$base/package/package.json"; then
    echo "Packed package $t failed dependency validation." >&2
    cat "$EXTRACT_DIR/$base/package/package.json" >&2
    exit 1
  fi
done

mapfile -t bundled_template_names < <(node --input-type=module -e '
const expectedInternalRanges = JSON.parse(process.env.EXPECTED_TEMPLATE_INTERNAL_RANGES ?? "{}");
for (const templateName of Object.keys(expectedInternalRanges)) {
  console.log(templateName);
}
')

for template_name in "${bundled_template_names[@]}"; do
  if ! tar -xOf "${cli_tarball[0]}" "package/templates/${template_name}/caatinga.template.json" | node --input-type=module -e '
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(0, "utf8"));
const coreVersion = process.argv[1];
const expectedRange = `^${coreVersion}`;
const compatibleCore = manifest.caatinga?.compatibleCore;
const templateVersion = manifest.caatinga?.templateVersion;

if (compatibleCore !== expectedRange) {
  console.error(
    `${process.argv[2]}: compatibleCore expected ${expectedRange} but found ${compatibleCore ?? "missing"}`
  );
  process.exit(1);
}

if (templateVersion !== 1) {
  console.error(
    `${process.argv[2]}: templateVersion expected 1 but found ${templateVersion ?? "missing"}`
  );
  process.exit(1);
}
' "$core_runtime_version" "$template_name"; then
    echo "Bundled CLI template manifest failed compatibility validation." >&2
    tar -xOf "${cli_tarball[0]}" "package/templates/${template_name}/caatinga.template.json" >&2 || true
    exit 1
  fi

  if ! tar -xOf "${cli_tarball[0]}" "package/templates/${template_name}/package.json" | node --input-type=module -e '
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(0, "utf8"));
const templateName = process.argv[1];
const expectedInternalRanges = JSON.parse(process.env.EXPECTED_TEMPLATE_INTERNAL_RANGES ?? "{}");
const expected = expectedInternalRanges[templateName] ?? {};
const sections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
];

for (const section of sections) {
  for (const [name, value] of Object.entries(pkg[section] ?? {})) {
    if (/^(workspace:|link:|file:)/.test(value)) {
      console.error(`${templateName}:${section}.${name}=${value}`);
      process.exit(1);
    }
  }
}

for (const [name, expectation] of Object.entries(expected)) {
  const actualRange = pkg[expectation.section]?.[name];
  if (actualRange !== expectation.value) {
    console.error(
      `${templateName}:${expectation.section}.${name} expected ${expectation.value} but found ${actualRange ?? "missing"}`
    );
    process.exit(1);
  }
}
' "$template_name"; then
    echo "Bundled CLI template package.json failed internal dependency validation." >&2
    tar -xOf "${cli_tarball[0]}" "package/templates/${template_name}/package.json" >&2 || true
    exit 1
  fi
done

echo "ci-snapshot-pack: OK"
