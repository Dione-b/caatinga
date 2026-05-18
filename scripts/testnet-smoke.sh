#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$ROOT_DIR/node_modules/.bin:$PATH"
CORE_INDEX="${ROOT_DIR}/packages/core/dist/index.js"

: "${CAATINGA_CI_IDENTITY_ALIAS:?Set CAATINGA_CI_IDENTITY_ALIAS to a Stellar CLI identity alias provisioned in the runner config.}"
CI_IDENTITY="$CAATINGA_CI_IDENTITY_ALIAS"

APP_NAME="${1:-smoke-app}"
ARTIFACT_DIR="$ROOT_DIR/smoke-ci-out"
LOG_FILE="$ARTIFACT_DIR/${APP_NAME}-smoke.log"
CAATINGA_VERSION_FILE="$ARTIFACT_DIR/${APP_NAME}-caatinga-version.txt"
STELLAR_VERSION_FILE="$ARTIFACT_DIR/${APP_NAME}-stellar-version.txt"
COUNTER_APP="${APP_NAME}-counter"
MARKETPLACE_APP="${APP_NAME}-marketplace"

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

log "=== caatinga-version ==="
set +e
caatinga --version 2>&1 | tee "$CAATINGA_VERSION_FILE" | tee -a "$LOG_FILE"
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

assert_marketplace_artifacts() {
  log "=== artifacts-contract-id-marketplace ==="
  set +e
  node --input-type=module -e '
import fs from "node:fs";
const artifacts = JSON.parse(fs.readFileSync("caatinga.artifacts.json", "utf8"));
const tokenId = artifacts.networks?.testnet?.contracts?.token?.contractId;
const marketplaceId = artifacts.networks?.testnet?.contracts?.marketplace?.contractId;
const resolvedTokenId = artifacts.networks?.testnet?.contracts?.marketplace?.resolvedDeployArgs?.tokenContractId;
const dependencies = artifacts.networks?.testnet?.contracts?.marketplace?.dependencies;
const dependencyGraph = artifacts.networks?.testnet?.dependencyGraph?.marketplace;
for (const [label, value] of Object.entries({ tokenId, marketplaceId, resolvedTokenId })) {
  if (!/^C[A-Z0-9]{55}$/.test(value ?? "")) {
    console.error(`Invalid ${label}: ${value}`);
    process.exit(1);
  }
}
if (resolvedTokenId !== tokenId) {
  console.error(`resolvedDeployArgs.tokenContractId mismatch: expected ${tokenId}, found ${resolvedTokenId}`);
  process.exit(1);
}
if (JSON.stringify(dependencies) !== JSON.stringify(["token"])) {
  console.error(`Unexpected marketplace dependencies: ${JSON.stringify(dependencies)}`);
  process.exit(1);
}
if (JSON.stringify(dependencyGraph) !== JSON.stringify(["token"])) {
  console.error(`Unexpected dependency graph entry: ${JSON.stringify(dependencyGraph)}`);
  process.exit(1);
}
' 2>&1 | tee -a "$LOG_FILE"
  local ec=${PIPESTATUS[0]}
  set -e
  if [[ "$ec" -ne 0 ]]; then
    classify_and_exit "$ec" "artifacts-contract-id-marketplace"
  fi
}

assert_marketplace_token_id_invoke() {
  local expected_contract_id
  expected_contract_id="$(node --input-type=module -e '
import fs from "node:fs";
const artifacts = JSON.parse(fs.readFileSync("caatinga.artifacts.json", "utf8"));
process.stdout.write(artifacts.networks.testnet.contracts.token.contractId);
')"

  local invoke_out
  invoke_out="$(mktemp)"
  set +e
  caatinga invoke marketplace.token_contract_id --network testnet --source "$CI_IDENTITY" 2>&1 | tee "$invoke_out" | tee -a "$LOG_FILE"
  local ec=${PIPESTATUS[0]}
  set -e
  if [[ "$ec" -ne 0 ]]; then
    classify_and_exit "$ec" "invoke-marketplace-token-contract-id"
  fi
  if ! grep -q "Invoke complete" "$invoke_out"; then
    echo "marketplace token_contract_id output missing success marker" | tee -a "$LOG_FILE"
    rm -f "$invoke_out"
    classify_and_exit 1 "invoke-marketplace-token-contract-id-assert"
  fi
  if ! grep -q "$expected_contract_id" "$invoke_out"; then
    echo "marketplace token_contract_id output missing expected token contract id ${expected_contract_id}" | tee -a "$LOG_FILE"
    rm -f "$invoke_out"
    classify_and_exit 1 "invoke-marketplace-token-contract-id-match"
  fi
  rm -f "$invoke_out"
}

rm -rf "$ROOT_DIR/$COUNTER_APP" "$ROOT_DIR/$MARKETPLACE_APP"

run_step "init-counter" caatinga init "$COUNTER_APP" --template react-vite-counter
cd "$ROOT_DIR/$COUNTER_APP"

run_step "build-counter" caatinga build counter
run_step "deploy-counter" caatinga deploy counter --network testnet --source "$CI_IDENTITY"

run_step "artifacts-exists-counter" test -f caatinga.artifacts.json

assert_counter_artifacts_contract_id

run_step "generate-counter" caatinga generate counter --network testnet
run_step "generated-bindings-exists-counter" test -d src/contracts/generated

INVOKE_OUT="$(mktemp)"
set +e
caatinga invoke counter.increment --network testnet --source "$CI_IDENTITY" 2>&1 | tee "$INVOKE_OUT" | tee -a "$LOG_FILE"
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

cd "$ROOT_DIR"

run_step "init-marketplace" caatinga init "$MARKETPLACE_APP" --template marketplace-with-token
cd "$ROOT_DIR/$MARKETPLACE_APP"

run_step "build-marketplace-token" caatinga build token
run_step "build-marketplace-contract" caatinga build marketplace
run_step "deploy-marketplace-graph" caatinga deploy --network testnet --source "$CI_IDENTITY"

run_step "artifacts-exists-marketplace" test -f caatinga.artifacts.json
assert_marketplace_artifacts

run_step "generate-marketplace-token" caatinga generate token --network testnet
run_step "generate-marketplace-contract" caatinga generate marketplace --network testnet
run_step "generated-bindings-exists-marketplace" test -d src/contracts/generated

assert_marketplace_token_id_invoke

log "=== smoke complete ==="
exit 0
