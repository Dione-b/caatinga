# Contract Upgrade

Soroban contracts are immutable on-chain. Upgrading contract logic means **deploying a new instance** and updating your artifacts — not patching the existing `contractId`.

## Recommended workflow

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

`--upgrade` is a semantic alias for `--force` that records the prior `contractId` in artifact history (schema v2).

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
          "history": [
            {
              "contractId": "COLD...",
              "wasmHash": "...",
              "deployedAt": "...",
              "supersededAt": "...",
              "reason": "upgrade"
            }
          ]
        }
      }
    }
  }
}
```

Migrate existing projects without redeploying:

```bash
caatinga migrate artifacts
```

## Logical rollback

Restore a prior `contractId` in artifacts (does **not** change on-chain state):

```bash
caatinga rollback counter --to COLD... --network testnet
```

The previous on-chain deployment remains — only your **git-tracked artifact entry** changes. Frontend bindings may need regeneration:

```bash
caatinga generate counter --network testnet
```

## Orphan contracts

Each redeploy creates a new on-chain contract. Old instances are **orphaned** — they still exist but are no longer referenced in `caatinga.artifacts.json`. Plan for:

- Migrating user state (if your protocol stores data in the old contract)
- Communicating contract ID changes to integrators
- Monitoring costs of abandoned instances (rent/storage)

## When to use `--force` vs `--upgrade`

| Flag        | History reason   | Use case                                |
| ----------- | ---------------- | --------------------------------------- |
| `--upgrade` | `upgrade`        | Intentional contract version bump       |
| `--force`   | `force-redeploy` | Recovery, accidental redeploy, CI reset |

## Related docs

- [Production readiness](./production-readiness.md)
- [Config — artifacts](../config.md)
- [CLI reference](../cli.md)
