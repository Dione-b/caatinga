# Deploy & Upgrade Specification

This document details the specifications, behaviors, and transition rules for contract deployment and upgrade operations within the Caatinga platform. These rules govern command-line invocation, internal core actions, and the resulting state registry mutations in `caatinga.artifacts.json`.

---

## 1. Core Operations

### Deploy
- **Definition:** The initial upload and instantiation of a Soroban smart contract.
- **Behavior:**
  - Compiles the WASM binary (if necessary).
  - Deploys the binary on-chain via the Stellar CLI.
  - Registers the new `contractId` and `wasmHash` inside `caatinga.artifacts.json`.
  - Resolves initialization arguments (`resolvedDeployArgs`).
- **Triggers:** `caatinga deploy <contractName>` (when no prior deployment exists on the target network).

### Upgrade (In-place)
- **Definition:** The update of a contract's backing WebAssembly byte-code on-chain without altering its address (`contractId`).
- **Behavior:**
  - Uploads the new WASM binary to the network to obtain a new `wasmHash`.
  - Invokes the contract's defined upgrade method (e.g., `upgrade`) with the new WASM hash using administrator authorization.
  - Pushes the previous `contractId` and `wasmHash` version to the contract's `history` block in the artifacts file.
  - Updates the active `wasmHash` and compilation metadata under the current contract entry.
- **Triggers:** `caatinga upgrade <contractName> --method <upgradeMethodName>`

### Redeploy
- **Definition:** Deploying a brand new instance of a previously deployed contract, generating a new `contractId`.
- **Behavior:**
  - Instantiates a fresh copy of the contract on the network.
  - Pushes the previous contract instance representation (`contractId`, `wasmHash`, `deployedAt`, etc.) to the contract's `history` block in the artifacts file.
  - Replaces the active `contractId` and configurations with the newly deployed instance.
- **Triggers:** `caatinga deploy <contractName> --force` (or `--upgrade` to mark as upgrade type).

### Rollback
- **Definition:** Reverting the active contract registration in the artifacts file to a prior deployment state saved in the history.
- **Behavior:**
  - Searches the `history` array of the target contract for a matching `contractId`.
  - Restores the matching contract state (contract ID, WASM hash, metadata) to the active contract entry.
  - Appends the superseded active instance to the `history` with reason `"rollback"`.
  - *Note:* Rollback updates the local artifacts state registry. On-chain state restoration (e.g., re-running an on-chain upgrade to the old WASM hash) is an application concern.
- **Triggers:** `caatinga rollback <contractName> --target <previousContractId>`

---

## 2. Operation Flags & Mutators

### Force (`--force`)
- **Purpose:** Bypasses state check optimizations.
- **Behavior:**
  - By default, Caatinga skips deployment or builds if the local WASM hash matches the registry (`ifChanged` strategy).
  - Activating `--force` overrides this check, forcing a fresh compile, upload, and deployment transaction, pushing the current registry state to the history.

### If Changed (`--if-changed`)
- **Purpose:** Optimizes CI/CD pipelines and local DX by avoiding redundant deploy transactions.
- **Behavior:**
  - Compares the SHA-256 hash of the compiled WASM binary with the `wasmHash` stored in the current network scope of `caatinga.artifacts.json`.
  - If the hashes match, the deployment is skipped, returning the existing deployment information without sending transactions to the network.
