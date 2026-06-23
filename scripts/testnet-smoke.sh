#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$ROOT_DIR/node_modules/.bin:$PATH"
CORE_INDEX="${ROOT_DIR}/packages/core/dist/index.js"
CAATINGA_BIN="${ROOT_DIR}/packages/cli/dist/index.js"

: "${CAATINGA_CI_IDENTITY_ALIAS:?Set CAATINGA_CI_IDENTITY_ALIAS to a Stellar CLI identity alias provisioned in the runner config.}"
CI_IDENTITY="$CAATINGA_CI_IDENTITY_ALIAS"

APP_NAME="${1:-smoke-app}"
ARTIFACT_DIR="$ROOT_DIR/smoke-ci-out"
LOG_FILE="$ARTIFACT_DIR/${APP_NAME}-smoke.log"
CAATINGA_VERSION_FILE="$ARTIFACT_DIR/${APP_NAME}-caatinga-version.txt"
STELLAR_VERSION_FILE="$ARTIFACT_DIR/${APP_NAME}-stellar-version.txt"
COUNTER_APP="${APP_NAME}-counter"
LOCAL_CORE_DEP="file:${ROOT_DIR}/packages/core"
LOCAL_CLIENT_DEP="file:${ROOT_DIR}/packages/client"
LOCAL_CLI_DEP="file:${ROOT_DIR}/packages/cli"
export LOCAL_CORE_DEP LOCAL_CLIENT_DEP LOCAL_CLI_DEP

mkdir -p "$ARTIFACT_DIR"
: > "$LOG_FILE"

log() {
  { echo "[$(date -Iseconds)] $*"; } | tee -a "$LOG_FILE"
}

classify_and_exit() {
  local ec="$1"
  local title="$2"
  log "Step failed: ${title} (exit ${ec})"
  if node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { isTransientTestnetSmokeFailure } from '${CORE_INDEX}';
const log = readFileSync(process.argv[1], 'utf8');
process.exit(isTransientTestnetSmokeFailure(log) ? 0 : 1);
" "$LOG_FILE"; then
    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
      echo "transient=true" >> "$GITHUB_OUTPUT"
    fi
    exit 2
  fi
  exit 1
}

run_step() {
  local title="$1"
  shift
  log "=== ${title} ==="
  set +e
  { "$@" 2>&1; } | tee -a "$LOG_FILE"
  local ec=${PIPESTATUS[0]}
  set -e
  if [[ "$ec" -ne 0 ]]; then
    classify_and_exit "$ec" "$title"
  fi
}

patch_local_caatinga_dependencies() {
  node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const packageJsonPath = process.argv[1];
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

for (const [section, deps] of Object.entries({
  dependencies: {
    '@caatinga/core': process.env.LOCAL_CORE_DEP,
    '@caatinga/client': process.env.LOCAL_CLIENT_DEP
  },
  devDependencies: {
    '@caatinga/cli': process.env.LOCAL_CLI_DEP
  }
})) {
  if (!packageJson[section]) continue;
  for (const [name, value] of Object.entries(deps)) {
    if (Object.prototype.hasOwnProperty.call(packageJson[section], name)) {
      packageJson[section][name] = value;
    }
  }
}

writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
" "$1/package.json"
}

log "=== caatinga-version ==="
set +e
"$CAATINGA_BIN" --version 2>&1 | tee "$CAATINGA_VERSION_FILE" | tee -a "$LOG_FILE"
ec_kv=${PIPESTATUS[0]}
set -e
if [[ "$ec_kv" -ne 0 ]]; then
  classify_and_exit "$ec_kv" "caatinga-version"
fi

log "=== stellar-version ==="
set +e
stellar --version 2>&1 | tee "$STELLAR_VERSION_FILE" | tee -a "$LOG_FILE"
ec_sv=${PIPESTATUS[0]}
set -e
if [[ "$ec_sv" -ne 0 ]]; then
  classify_and_exit "$ec_sv" "stellar-version"
fi

assert_counter_artifacts_contract_id() {
  log "=== artifacts-contract-id-counter ==="
  set +e
  node --input-type=module -e '
import fs from "node:fs";
const artifacts = JSON.parse(fs.readFileSync("caatinga.artifacts.json", "utf8"));
const contractId = artifacts.networks?.testnet?.contracts?.counter?.contractId;
if (!/^C[A-Z0-9]{55}$/.test(contractId ?? "")) {
  console.error(`Invalid counter contractId: ${contractId}`);
  process.exit(1);
}
' 2>&1 | tee -a "$LOG_FILE"
  local ec=${PIPESTATUS[0]}
  set -e
  if [[ "$ec" -ne 0 ]]; then
    classify_and_exit "$ec" "artifacts-contract-id-counter"
  fi
}

rm -rf "$ROOT_DIR/$COUNTER_APP"

run_step "init-counter" "$CAATINGA_BIN" init "$COUNTER_APP" --template react-vite-counter
cd "$ROOT_DIR/$COUNTER_APP"
patch_local_caatinga_dependencies "$PWD"
run_step "install-counter-deps" npm install --no-audit --fund=false

run_step "build-counter" "$CAATINGA_BIN" build counter
run_step "deploy-counter" "$CAATINGA_BIN" deploy counter --network testnet --source "$CI_IDENTITY"

run_step "artifacts-exists-counter" test -f caatinga.artifacts.json

assert_counter_artifacts_contract_id

run_step "generate-counter" "$CAATINGA_BIN" generate counter --network testnet
run_step "generated-bindings-exists-counter" test -d src/contracts/generated
run_step "vite-build-counter" npm run build

INVOKE_OUT="$(mktemp)"
set +e
"$CAATINGA_BIN" invoke counter.increment --network testnet --source "$CI_IDENTITY" 2>&1 | tee "$INVOKE_OUT" | tee -a "$LOG_FILE"
INV_EC=${PIPESTATUS[0]}
set -e
if [[ "$INV_EC" -ne 0 ]]; then
  classify_and_exit "$INV_EC" "invoke"
fi
if ! grep -q "Invoke complete" "$INVOKE_OUT"; then
  echo "invoke output missing success marker" | tee -a "$LOG_FILE"
  classify_and_exit 1 "invoke-assert"
fi
rm -f "$INVOKE_OUT"

log "=== smoke complete ==="
exit 0
