# Dogfood Multi-Contract (Sprint 42)

Validates **Deployment Graph**, `dependsOn`, `${contracts.token.contractId}` placeholders, upgrades, `wire`, and `smoke` — proving the simple counter path was not a special case.

## Contracts

| Contract | Role                                                                     |
| -------- | ------------------------------------------------------------------------ |
| `token`  | Standalone; exposes `supply` / `mint`                                    |
| `vault`  | Depends on `token`; constructor receives token `Address` via placeholder |

## Deploy graph

```bash
npx ctg build token
npx ctg build vault
npx ctg deploy --network testnet --source alice
# deploys token first, then vault with resolved token contract ID
```

## Upgrade path

```bash
npx ctg build token
npx ctg upgrade token --network testnet --source alice
```

## Wire and smoke

```bash
npx ctg wire --network testnet --source alice
npx ctg smoke --network testnet
```

## Config highlights

See [`caatinga.config.ts`](./caatinga.config.ts):

- `vault.dependsOn: ["token"]`
- `vault.deployArgs.token: "${contracts.token.contractId}"`
- `postDeploy` and `smoke` cover both contracts

## Case study

Full narrative: [docs/case-studies/multi-contract-dapp.md](../../docs/case-studies/multi-contract-dapp.md).

Install from packed tarballs per [dogfood-simple](../dogfood-simple/README.md).
