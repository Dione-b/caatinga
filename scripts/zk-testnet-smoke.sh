#!/usr/bin/env bash
# Live-network smoke test for the Caatinga ZK flow on Soroban testnet.
#
# Covers the whole loop end to end: scaffold, compile, dev ceremony, deploy,
# prove, invoke, then a second pass where the dev ceremony is replaced by
# audited ceremony artifacts and the verifier is invoked again. `ctg doctor`
# is run in between to check that the ZK protocol pre-flight reports the
# network correctly.
#
# Negative cases run against the live verifier too (#301): an invalid proof,
# altered public inputs, a mismatched VK and swapped G2 limbs must all be
# rejected, and a tampered imported zkey must be refused before any
# transaction. `verify_proof` is read-only, so these are simulations and spend
# no XLM. Finally scripts/zk-verify-benchmark.mjs records the network's
# resource accounting per public-signal count.
#
# Opt-in: it needs a funded testnet identity and spends real testnet XLM.
#   CAATINGA_CI_IDENTITY_ALIAS=alice bash scripts/zk-testnet-smoke.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$ROOT_DIR/node_modules/.bin:$PATH"
CORE_INDEX="${ROOT_DIR}/packages/core/dist/index.js"
CAATINGA_BIN="${ROOT_DIR}/packages/cli/dist/index.js"

: "${CAATINGA_CI_IDENTITY_ALIAS:?Set CAATINGA_CI_IDENTITY_ALIAS to a funded testnet Stellar CLI identity.}"
CI_IDENTITY="$CAATINGA_CI_IDENTITY_ALIAS"

APP_NAME="${1:-zk-smoke-app}"
CIRCUIT_NAME="${2:-main}"
VERIFIER_CONTRACT="${3:-verifier}"
ARTIFACT_DIR="$ROOT_DIR/smoke-ci-out"
LOG_FILE="$ARTIFACT_DIR/${APP_NAME}-zk-smoke.log"
MPC_FIXTURE_DIR="$ARTIFACT_DIR/${APP_NAME}-ceremony"
LOCAL_CORE_DEP="file:${ROOT_DIR}/packages/core"
LOCAL_CLIENT_DEP="file:${ROOT_DIR}/packages/client"
LOCAL_CLI_DEP="file:${ROOT_DIR}/packages/cli"
export LOCAL_CORE_DEP LOCAL_CLIENT_DEP LOCAL_CLI_DEP

SNARKJS_BIN="${HOME}/.caatinga/zk-tools/snarkjs-0.7.5/node_modules/.bin/snarkjs"
export SNARKJS_BIN

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

expect_output_contains() {
  local title="$1"
  local needle="$2"
  local file="$3"
  if ! grep -q "$needle" "$file"; then
    log "Expected output of ${title} to contain: ${needle}"
    classify_and_exit 1 "${title}-assert"
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

# Runs a command that must fail; asserts its output carries `needle` and never
# claims the proof verified. Output goes to its own file so the assertion only
# sees this command.
expect_failure() {
  local title="$1"
  local needle="$2"
  shift 2
  local out="${ARTIFACT_DIR}/${APP_NAME}-${title}.log"
  log "=== ${title} (expected to fail) ==="
  set +e
  { "$@" 2>&1; } | tee "$out" | tee -a "$LOG_FILE"
  local ec=${PIPESTATUS[0]}
  set -e
  if [[ "$ec" -eq 0 ]] || grep -q "Proof verified for circuit" "$out"; then
    log "Expected ${title} to be rejected, but it succeeded"
    classify_and_exit 1 "${title}"
  fi
  if [[ -n "$needle" ]] && ! grep -q "$needle" "$out"; then
    log "${title} failed, but without ${needle} (see above)"
    classify_and_exit 1 "${title}-assert"
  fi
  rm -f "$out"
}

# Rewrites a JSON artifact in place with a JS expression over `j`, e.g.
#   mutate_json proof.json 'j.pi_a = j.pi_c'
mutate_json() {
  node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const file = process.argv[1];
const j = JSON.parse(readFileSync(file, 'utf8'));
${2};
writeFileSync(file, JSON.stringify(j));
" "$1"
}

# Each case mutates one artifact, expects the live verifier to reject the call,
# and restores the original before the next case.
run_negative_cases() {
  local dir=".artifacts/zk/${CIRCUIT_NAME}"
  local backup="${ARTIFACT_DIR}/${APP_NAME}-negative-backup"
  rm -rf "$backup"
  mkdir -p "$backup"
  cp "$dir/proof.json" "$dir/public.json" "$dir/verification_key.json" "$backup/"
  local invoke=("$CAATINGA_BIN" zk invoke "$CIRCUIT_NAME" --network testnet --source "$CI_IDENTITY")

  # Valid points, wrong proof: the pairing check must return false.
  mutate_json "$dir/proof.json" 'const a = j.pi_a; j.pi_a = j.pi_c; j.pi_c = a'
  expect_failure "zk-negative-invalid-proof" "CAATINGA_ZK_VERIFICATION_FAILED" "${invoke[@]}"
  cp "$backup/proof.json" "$dir/proof.json"

  mutate_json "$dir/public.json" 'j[0] = (BigInt(j[0]) + 1n).toString()'
  expect_failure "zk-negative-altered-public-input" "CAATINGA_ZK_VERIFICATION_FAILED" "${invoke[@]}"
  cp "$backup/public.json" "$dir/public.json"

  # A key from a different setup of the same circuit (the ceremony fixture).
  cp "$MPC_FIXTURE_DIR/verification_key.json" "$dir/verification_key.json"
  expect_failure "zk-negative-mismatched-vk" "CAATINGA_ZK_VERIFICATION_FAILED" "${invoke[@]}"
  cp "$backup/verification_key.json" "$dir/verification_key.json"

  # Fq2 limbs in the wrong order put B off the curve: the host must reject it
  # rather than verify against a different point.
  mutate_json "$dir/proof.json" 'j.pi_b[0] = [j.pi_b[0][1], j.pi_b[0][0]]'
  expect_failure "zk-negative-swapped-g2" "" "${invoke[@]}"
  cp "$backup/proof.json" "$dir/proof.json"

  rm -rf "$backup"
}

assert_circuit_artifacts() {
  run_step "zk-r1cs-exists" test -f ".artifacts/zk/${CIRCUIT_NAME}/main.r1cs"
  run_step "zk-zkey-exists" test -f ".artifacts/zk/${CIRCUIT_NAME}/circuit_final.zkey"
  run_step "zk-vk-exists" test -f ".artifacts/zk/${CIRCUIT_NAME}/verification_key.json"
  run_step "zk-wasm-exists" test -f ".artifacts/zk/${CIRCUIT_NAME}/main_js/main.wasm"
}

# Produces a {circuit_final.zkey, verification_key.json, powersOfTau.ptau} set
# that `ctg zk import-ceremony` can accept, by running the same phase-2 steps
# `ctg zk build` runs but as several independent contributions instead of one
# dev contribution. This exercises the import path and nothing more: it is not
# a substitute for a real multi-party ceremony, which is an offline process.
produce_ceremony_fixture() {
  local artifacts=".artifacts/zk/${CIRCUIT_NAME}"
  local out="$MPC_FIXTURE_DIR"

  rm -rf "$out"
  mkdir -p "$out"

  local ptau
  ptau="$(ls "${HOME}/.caatinga/zk-tools/ptau/bls12-381/" 2>/dev/null | grep '^pot.*_final\.ptau$' | head -n 1 || true)"
  if [[ -z "$ptau" ]]; then
    log "No cached powers-of-tau file found under ~/.caatinga/zk-tools/ptau/bls12-381."
    classify_and_exit 1 "ptau-missing"
  fi
  local ptau_path="${HOME}/.caatinga/zk-tools/ptau/bls12-381/${ptau}"

  run_step "ceremony-setup" "$SNARKJS_BIN" groth16 setup "$artifacts/main.r1cs" "$ptau_path" "$out/circuit_0000.zkey"

  # Entropy is passed as a flag rather than stdin so the exit status of the
  # command is not masked by the pipe.
  run_step "ceremony-contribute-1" "$SNARKJS_BIN" zkey contribute \
    "$out/circuit_0000.zkey" "$out/circuit_0001.zkey" -e="contributor-1-entropy"
  run_step "ceremony-contribute-2" "$SNARKJS_BIN" zkey contribute \
    "$out/circuit_0001.zkey" "$out/circuit_0002.zkey" -e="contributor-2-entropy"
  run_step "ceremony-beacon" "$SNARKJS_BIN" zkey beacon \
    "$out/circuit_0002.zkey" "$out/circuit_final.zkey" \
    0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20 10
  run_step "ceremony-export-vk" "$SNARKJS_BIN" zkey export verificationkey \
    "$out/circuit_final.zkey" "$out/verification_key.json"
  run_step "ceremony-copy-ptau" cp "$ptau_path" "$out/${ptau}"
}

run_step "zk-version" "$CAATINGA_BIN" --version
run_step "zk-stellar-version" stellar --version

rm -rf "$ROOT_DIR/$APP_NAME"

run_step "zk-init" "$CAATINGA_BIN" zk init "$APP_NAME" --minimal
cd "$ROOT_DIR/$APP_NAME"
patch_local_caatinga_dependencies "$PWD"
run_step "zk-install-deps" npm install --no-audit --fund=false

run_step "zk-build-verifier" "$CAATINGA_BIN" build "$VERIFIER_CONTRACT"
run_step "zk-build-circuit" "$CAATINGA_BIN" zk build "$CIRCUIT_NAME"
assert_circuit_artifacts

run_step "zk-deploy-verifier" "$CAATINGA_BIN" deploy "$VERIFIER_CONTRACT" --network testnet --source "$CI_IDENTITY"

run_step "zk-artifacts-exists" test -f caatinga.artifacts.json
run_step "zk-artifacts-verifier-id" node --input-type=module -e '
import fs from "node:fs";
const artifacts = JSON.parse(fs.readFileSync("caatinga.artifacts.json", "utf8"));
const contractId = artifacts.networks?.testnet?.contracts?.[process.argv[1]]?.contractId;
if (!/^C[A-Z0-9]{55}$/.test(contractId ?? "")) {
  console.error(`Invalid verifier contractId: ${contractId}`);
  process.exit(1);
}
' "$VERIFIER_CONTRACT"

# Protocol pre-flight is advisory, so doctor stays ready on an upgraded testnet
# and only warns on a lagging one. Assert the ZK section is reported.
DOCTOR_OUT="${ARTIFACT_DIR}/${APP_NAME}-doctor.log"
set +e
{ "$CAATINGA_BIN" doctor --network testnet 2>&1; } | tee "$DOCTOR_OUT" | tee -a "$LOG_FILE"
ec_doc=${PIPESTATUS[0]}
set -e
if [[ "$ec_doc" -ne 0 ]]; then
  classify_and_exit "$ec_doc" "zk-doctor"
fi
expect_output_contains "zk-doctor" "Protocol required for verification" "$DOCTOR_OUT"
# A numeric protocol proves the pre-flight request itself works (a malformed
# getNetwork once made every pre-flight report "unknown"). A slow RPC is not
# that bug, so a timeout only warns.
if ! grep -q "testnet: protocol [0-9]" "$DOCTOR_OUT"; then
  if grep -q "testnet: protocol unknown (.*timeout" "$DOCTOR_OUT"; then
    log "Warning: testnet RPC timed out during the doctor protocol check; not treating it as a failure."
  else
    log "Expected doctor to report a numeric testnet protocol version"
    classify_and_exit 1 "zk-doctor-assert"
  fi
fi
rm -f "$DOCTOR_OUT"

run_step "zk-prove" "$CAATINGA_BIN" zk prove "$CIRCUIT_NAME"
run_step "zk-proof-exists" test -f ".artifacts/zk/${CIRCUIT_NAME}/proof.json"
run_step "zk-public-exists" test -f ".artifacts/zk/${CIRCUIT_NAME}/public.json"

INVOKE_OUT="${ARTIFACT_DIR}/${APP_NAME}-invoke.log"
run_step "zk-invoke" "$CAATINGA_BIN" zk invoke "$CIRCUIT_NAME" --network testnet --source "$CI_IDENTITY"
tail -n 30 "$LOG_FILE" > "$INVOKE_OUT"
expect_output_contains "zk-invoke" "Proof verified for circuit" "$INVOKE_OUT"
rm -f "$INVOKE_OUT"

VERIFIER_ID="$(node --input-type=module -e '
import fs from "node:fs";
const artifacts = JSON.parse(fs.readFileSync("caatinga.artifacts.json", "utf8"));
process.stdout.write(artifacts.networks.testnet.contracts[process.argv[1]].contractId);
' "$VERIFIER_CONTRACT")"

# Measured right after deploy, so the fee is not inflated by restoring archived
# entries. Simulation only; 100 public signals is close to the 400M tx limit.
run_step "zk-benchmark" node "$ROOT_DIR/scripts/zk-verify-benchmark.mjs" \
  --contract-id "$VERIFIER_ID" --source "$CI_IDENTITY" --network testnet \
  --sizes "${CAATINGA_ZK_BENCHMARK_SIZES:-1,4,16,64,100}" \
  --out "$ARTIFACT_DIR/${APP_NAME}-zk-benchmark"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "### ZK verify_proof cost (testnet, simulated)"
    echo
    cat "$ARTIFACT_DIR/${APP_NAME}-zk-benchmark.md"
  } >> "$GITHUB_STEP_SUMMARY"
fi

assert_dev_ceremony_blocked_on_mainnet() {
  log "=== zk-dev-ceremony-mainnet-guard ==="
  set +e
  { "$CAATINGA_BIN" zk invoke "$CIRCUIT_NAME" --network mainnet --source "$CI_IDENTITY" --yes 2>&1; } | tee -a "$LOG_FILE"
  local ec=${PIPESTATUS[0]}
  set -e
  if [[ "$ec" -eq 0 ]]; then
    log "Expected the dev-ceremony guardrail to block a mainnet invoke"
    classify_and_exit 1 "zk-dev-ceremony-mainnet-guard"
  fi
  local last
  last="$(tail -n 30 "$LOG_FILE")"
  if ! grep -q "CAATINGA_ZK_DEV_CEREMONY_BLOCKED" <<<"$last"; then
    log "Mainnet invoke failed for an unexpected reason (see above)"
    classify_and_exit 1 "zk-dev-ceremony-mainnet-guard-assert"
  fi
}

assert_dev_ceremony_blocked_on_mainnet

run_step "ceremony-fixture" produce_ceremony_fixture

run_negative_cases

run_step "zk-import-ceremony" "$CAATINGA_BIN" zk import-ceremony "$CIRCUIT_NAME" --ceremony "$MPC_FIXTURE_DIR" \
  --ceremony-name "zk-smoke-fixture" --participants 2
run_step "zk-verify-ceremony" "$CAATINGA_BIN" zk verify-ceremony "$CIRCUIT_NAME"

# A swapped proving key must be refused on mainnet before any transaction is
# built, and flagged offline by verify-ceremony.
ZKEY=".artifacts/zk/${CIRCUIT_NAME}/circuit_final.zkey"
cp "$ZKEY" "${ZKEY}.orig"
printf 'x' >> "$ZKEY"
expect_failure "zk-negative-tampered-zkey-verify" "CAATINGA_ZK_CEREMONY_TAMPERED" \
  "$CAATINGA_BIN" zk verify-ceremony "$CIRCUIT_NAME"
expect_failure "zk-negative-tampered-zkey-mainnet" "CAATINGA_ZK_CEREMONY_TAMPERED" \
  "$CAATINGA_BIN" zk invoke "$CIRCUIT_NAME" --network mainnet --source "$CI_IDENTITY" --yes
mv "${ZKEY}.orig" "$ZKEY"

# The imported artifacts are what a build now reuses, so a rebuild must not
# overwrite them with a fresh dev ceremony.
run_step "zk-rebuild-with-mpc" "$CAATINGA_BIN" zk build "$CIRCUIT_NAME"
assert_circuit_artifacts

run_step "zk-prove-after-import" "$CAATINGA_BIN" zk prove "$CIRCUIT_NAME"
run_step "zk-invoke-after-import" "$CAATINGA_BIN" zk invoke "$CIRCUIT_NAME" --network testnet --source "$CI_IDENTITY"

# The last step's output is at the end of the shared log; assert on that tail so
# the marker is known to come from this run and not an earlier one.
tail -n 30 "$LOG_FILE" > "$ARTIFACT_DIR/${APP_NAME}-invoke-after-import.log"
expect_output_contains "zk-invoke-after-import" "Proof verified for circuit" \
  "$ARTIFACT_DIR/${APP_NAME}-invoke-after-import.log"
rm -f "$ARTIFACT_DIR/${APP_NAME}-invoke-after-import.log"

log "=== zk smoke complete ==="
exit 0
