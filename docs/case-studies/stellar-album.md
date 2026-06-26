# Case study: stellar-album

[stellar-album](https://github.com/stellar/stellar-album) is an educational Soroban dApp that
teaches the fungibility spectrum through a sticker-album game. It is the first multi-contract
project validated against Caatinga's extended workflow (workspace build, seven-contract deploy
graph, post-deploy wiring, and frontend env sync).

## Why it matters for Caatinga

| stellar-album need | Caatinga feature |
| ------------------ | ---------------- |
| 7 contracts, shared workspace WASMs | `buildRoot: "."` |
| Constructor args use deployer address | `${source.address}` |
| Cross-contract deploy order | `dependsOn` + `${contracts.*.contractId}` |
| Four `set_minter` / `set_burner` invokes | `postDeploy` + `caatinga wire` |
| Vite frontend with `VITE_*` env vars | `frontend.env` + `caatinga sync-env` |

## Typical workflow

From the project root (with Node 22+, Rust, Stellar CLI, and `wasm32v1-none` installed):

```bash
npm install
caatinga setup --source deployer --network testnet   # first machine only
caatinga build
caatinga deploy --source deployer --network testnet
caatinga generate --network testnet
cd frontend && npm install && npm run dev
```

A full `caatinga deploy` (no contract argument) already runs configured `postDeploy` hooks and
writes `frontend.envFile` when configured, unless `--no-wire` or `--no-sync-env` is passed.

`caatinga.config.ts` holds deploy args and wiring hooks that previously lived in `bootstrap.sh`.
`caatinga.artifacts.json` is the source of truth for contract IDs; `frontend/.env.local` is a
generated view for the custom React frontend (Stellar Wallets Kit + hand-rolled binding imports).

## Granular commands

```bash
caatinga build
caatinga deploy --source deployer --network testnet
caatinga wire --source deployer --network testnet
caatinga generate --network testnet
caatinga sync-env --network testnet
caatinga status --network testnet
caatinga doctor --network testnet --source deployer
```

## Frontend integration note

This project intentionally does **not** use `@caatinga/client`. Bindings land under
`frontend/src/contracts/<name>/` and the app reads IDs from `import.meta.env.VITE_*`. That is
supported: configure `frontend.bindingsOutput`, `frontend.envFile`, and `frontend.env` in
`caatinga.config.ts` and run the commands above.

See [ADR 0006](../adr/0006-post-deploy-hooks.md) for the design rationale.
