# Deploy & Upgrade Specification

This document details the specifications, behaviors, and transition rules for contract deployment and upgrade operations within the Caatinga platform. These rules govern command-line invocation, internal core actions, and the resulting state registry mutations in `caatinga.artifacts.json`.

---

## 1. Core Operations

### Deploy

- **Definition:** The initial upload and instantiation of a Soroban smart contract.
- **Behavior:**
  - Hashes the existing WASM file (deploy never builds; run `ctg build` first — a missing WASM fails with `CAATINGA_ARTIFACT_NOT_FOUND`).
  - Deploys the binary on-chain via the Stellar CLI.
  - Registers the new `contractId` and `wasmHash` inside `caatinga.artifacts.json`.
  - Resolves initialization arguments (`resolvedDeployArgs`).
- **Triggers:** `ctg deploy <contractName>` (when no prior deployment exists on the target network).

### Upgrade (In-place)

- **Definition:** The update of a contract's backing WebAssembly byte-code on-chain without altering its address (`contractId`).
- **Behavior:**
  - Uploads the new WASM binary to the network to obtain a new `wasmHash`.
  - Invokes the contract's `upgrade(new_wasm_hash)` entrypoint with the new WASM hash using administrator authorization (the method name is fixed in the CLI).
  - Builds first unless `--no-build` is passed.
  - Keeps the same `contractId` and appends the previous `wasmHash` to the contract's `history` block (reason `upgrade`, `upgradeType: "in-place"`).
  - Updates the active `wasmHash` and compilation metadata under the current contract entry.
- **Triggers:** `ctg upgrade <contractName> --source <identity>` (see [CLI — upgrade](./cli.md))

### Redeploy

- **Definition:** Deploying a brand new instance of a previously deployed contract, generating a new `contractId`.
- **Behavior:**
  - Instantiates a fresh copy of the contract on the network.
  - Pushes the previous contract instance representation (`contractId`, `wasmHash`, `deployedAt`, etc.) to the contract's `history` block in the artifacts file.
  - Replaces the active `contractId` and configurations with the newly deployed instance.
- **Triggers:** `ctg deploy <contractName> --force` (or `--upgrade` to mark as upgrade type).

### Rollback

- **Definition:** Reverting the active contract registration in the artifacts file to a prior deployment state saved in the history.
- **Behavior:**
  - Searches the `history` array of the target contract for a matching `contractId`.
  - Restores the matching contract state (contract ID, WASM hash, metadata) to the active contract entry.
  - Appends the superseded active instance to the `history` with reason `"rollback"`.
  - _Note:_ Rollback updates the local artifacts state registry. On-chain state restoration (e.g., re-running an on-chain upgrade to the old WASM hash) is an application concern.
- **Triggers:** `ctg rollback <contractName> --to <previousContractId>`

---

## 2. Operation Flags & Mutators

### Force (`--force`)

- **Purpose:** Bypasses state check optimizations.
- **Behavior:**
  - By default, `ctg deploy` skips any contract that already has a `contractId` in the artifacts for that network (`[skipped]`), regardless of the WASM hash.
  - `--force` redeploys anyway: it uploads and instantiates the current WASM (no compile step) and pushes the previous instance to `history`.

### If Changed (`--if-changed`)

- **Purpose:** Optimizes CI/CD pipelines and local DX by avoiding redundant deploy transactions.
- **Behavior:**
  - Compares the SHA-256 hash of the compiled WASM binary with the `wasmHash` stored in the current network scope of `caatinga.artifacts.json`.
  - If the hashes match, the deployment is skipped (`[skipped] unchanged`) without sending transactions to the network.
  - If they differ, Caatinga redeploys a **new instance** (new `contractId`) and records the previous one in `history`. Use `ctg upgrade --if-changed` for in-place replacement.

### Dry run (`--dry-run`)

- Estimates the deploy fee via simulation without submitting (same as `ctg estimate deploy`).

### Mainnet confirmation (`-y, --yes`)

- On mainnet (or a network with `requireConfirmation: true`), `deploy` and `upgrade` prompt before submitting. `-y, --yes` skips the prompt for CI.
