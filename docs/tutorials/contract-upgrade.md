# Contract Upgrade

Caatinga supports two upgrade strategies. Choose based on whether your contract implements an admin-gated `upgrade(new_wasm_hash)` entrypoint.

| Strategy | Command | On-chain effect | `contractId` |
| -------- | ------- | --------------- | -------------- |
| **In-place** | `caatinga upgrade` | Replaces WASM on the existing instance | **Preserved** |
| **Redeploy** | `caatinga deploy --upgrade` | Deploys a new instance | **New ID** |

## In-place upgrade (admin-gated contracts)

Use when the contract calls `env.deployer().update_current_contract_wasm()` behind admin auth (for example stellar-album-style `upgrade()` helpers).

```bash
# Build, upload WASM, invoke upgrade(), update artifacts (same contractId)
caatinga upgrade sticker --network testnet --source deployer

# Skip when local WASM hash already matches artifacts
caatinga upgrade sticker --if-changed --source deployer --network testnet

# Optional: regenerate bindings and sync frontend env
caatinga upgrade sticker --source deployer --network testnet --generate --sync-env

# Fail early if local WASM hash does not match an expected value
caatinga upgrade sticker --source deployer --expected-hash abc123... --network testnet
```

Requirements:

- Contract already deployed (`caatinga.artifacts.json` has a `contractId`)
- Contract exposes `upgrade(new_wasm_hash)` (Caatinga default; admin must authorize)
- `--source` must be the admin identity that can sign the upgrade transaction

Artifact history records prior WASM hashes with the **same** `contractId` and `upgradeType: "in-place"`. Rollback to a prior WASM hash via `caatinga rollback` is not supported for in-place history yet — rebuild from git and run `caatinga upgrade` again.

## Redeploy upgrade (new contract instance)

Use when the contract has **no** in-place upgrade entrypoint, or when you intentionally migrate to a new instance.

```bash
# 1. Build new WASM
caatinga build my-contract

# 2. Estimate fees (advisory)
caatinga estimate deploy my-contract --network testnet --source alice

# 3. Redeploy with upgrade history
caatinga deploy my-contract --network testnet --source alice --upgrade

# 4. Verify state
caatinga inspect my-contract --network testnet
caatinga status --network testnet
```

`deploy --upgrade` is a semantic alias for `--force` that records the prior `contractId` in artifact history (schema v2). It does **not** call `upgrade()` on the existing contract.

## Artifact history

After the first `--upgrade` or `--force` redeploy on a v1 artifacts file, Caatinga bumps the file to **schema v2** and appends history entries:

```json
{
  "version": 2,
  "networks": {
    "testnet": {
      "contracts": {
        "counter": {
          "contractId": "CNEW...",
          "upgradeStrategy": "redeploy",
          "history": [
            {
              "contractId": "COLD...",
              "wasmHash": "...",
              "deployedAt": "...",
              "supersededAt": "...",
              "reason": "upgrade",
              "upgradeType": "new-contract"
            }
          ]
        }
      }
    }
  }
}
```

In-place upgrades keep the same `contractId` and set `upgradeStrategy: "in-place"` with history entries that share that ID but record the previous `wasmHash`.

Migrate existing projects without redeploying:

```bash
caatinga migrate artifacts
```

## Logical rollback (redeploy only)

Restore a prior `contractId` in artifacts after a **redeploy** upgrade (does **not** change on-chain state):

```bash
caatinga rollback counter --to COLD... --network testnet
```

The previous on-chain deployment remains — only your **git-tracked artifact entry** changes. Frontend bindings may need regeneration:

```bash
caatinga generate counter --network testnet
```

## Orphan contracts (redeploy)

Each redeploy creates a new on-chain contract. Old instances are **orphaned** — they still exist but are no longer referenced in `caatinga.artifacts.json`. Plan for:

- Migrating user state (if your protocol stores data in the old contract)
- Communicating contract ID changes to integrators
- Monitoring costs of abandoned instances (rent/storage)

In-place upgrades avoid orphan instances because the `contractId` stays the same.

## When to use each command

| Command / flag | History reason | Use case |
| -------------- | -------------- | -------- |
| `caatinga upgrade` | `upgrade` + `upgradeType: in-place` | Admin-gated WASM replacement on existing ID |
| `deploy --upgrade` | `upgrade` + `upgradeType: new-contract` | Intentional version bump via new instance |
| `deploy --force` | `force-redeploy` | Recovery, accidental redeploy, CI reset |

## Related docs

- [Production readiness](../production-readiness.md)
- [Config — artifacts](../config.md)
- [CLI reference](../cli.md)
