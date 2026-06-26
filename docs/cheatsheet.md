# Cheatsheet

The whole Caatinga loop on one page. Every command runs inside a generated project.

## One-step environment setup

```bash
caatinga setup                         # install missing prerequisites (Rust, wasm target, Stellar CLI), fund `alice` on testnet
caatinga setup --source bob            # use a different identity alias
caatinga setup --skip-rust --skip-stellar  # only create the local identity
```

Run on a fresh machine before `init`. Idempotent — already-installed, compatible tools are skipped.

## Scaffold commands

```bash
caatinga init <dir>                    # template (default: react-vite-counter)
caatinga init <dir> -t <template>      # explicit template (e.g. react-vite-counter)
caatinga init <dir> --minimal          # CLI + Soroban stub (no frontend)
caatinga zk init <dir>                 # zk-starter template
caatinga zk init <dir> --minimal       # ZK-only scaffold (no frontend)
caatinga zk init                       # add ZK files to current project
```

See [Choosing a project scaffold](./tutorials/project-scaffolds.md) for when to use each path.

## The loop

```bash
caatinga init my-dapp && cd my-dapp && npm install   # scaffold
npx caatinga doctor --network testnet --source alice # verify environment
npx caatinga build counter                           # compile one contract WASM
npx caatinga build                                   # compile all configured contracts
npx caatinga deploy counter --network testnet --source alice
#   ↳ writes contractId to caatinga.artifacts.json
#   ↳ auto-generates TypeScript bindings (skip with --no-generate)
#   ↳ full graph deploys also run postDeploy hooks and sync frontend env when configured
npx caatinga status --network testnet                # what's deployed? bindings fresh?
npm run dev                                          # frontend against the deployed contract
npx caatinga invoke counter.increment --network testnet --source alice
```

`generate` is now a recovery/CI command — deploy runs it for you:

```bash
npx caatinga generate counter --network testnet   # regenerate one contract
npx caatinga generate --network testnet           # regenerate everything deployed
```

Multi-contract projects can configure `postDeploy` hooks and frontend env output:

```bash
npx caatinga deploy --network testnet --source alice # full graph: deploy + wire + sync-env
npx caatinga wire --network testnet --source alice   # re-run postDeploy hooks only
npx caatinga sync-env --network testnet              # rewrite frontend.envFile only
```

## Commands

| Command                             | What it does                                                              |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `caatinga setup`                    | Install missing prerequisites (Rust, wasm target, Stellar CLI) + identity |
| `caatinga init <dir>`               | Scaffold a project from a template                                        |
| `caatinga doctor`                   | Check Node, Stellar CLI, Rust, config, artifacts, network, identity       |
| `caatinga build [contract]`         | Compile contract WASM; omit name to build all configured contracts        |
| `caatinga deploy [contract]`        | Deploy (graph-aware), record artifacts, auto-generate bindings            |
| `caatinga wire`                     | Run configured `postDeploy` hooks against deployed contracts              |
| `caatinga sync-env`                 | Write configured frontend env vars from deploy artifacts                  |
| `caatinga generate [contract]`      | (Re)generate TypeScript bindings from deployed contract IDs               |
| `caatinga status`                   | Table of deployed contracts + binding freshness per network               |
| `caatinga invoke <contract.method>` | Call a contract method from the CLI                                       |
| `caatinga read <contract.method>`   | Simulate a read-only contract method (no signing)                         |

## Flags

| Flag                  | Commands                                       | Description                                                    |
| --------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| `--network <name>`    | doctor, deploy, generate, status, invoke, wire | Network from `caatinga.config.ts`                              |
| `--source <identity>` | doctor, deploy, invoke, wire, zk invoke        | Local Stellar CLI identity that signs (never a `G...` address) |
| `--force`             | deploy                                         | Redeploy even when artifacts already hold a contract ID        |
| `--no-generate`       | deploy                                         | Skip automatic bindings generation (CI without binding needs)  |
| `--no-wire`           | deploy                                         | Skip automatic `postDeploy` hooks after a full graph deploy    |
| `--no-sync-env`       | deploy                                         | Skip automatic frontend env sync after a full graph deploy     |
| `--no-deps`           | deploy                                         | Deploy a single contract without its `dependsOn` graph         |
| `--verify-deps`       | deploy                                         | Confirm dependency contract IDs exist on-chain first           |
| `--no-stale-check`    | deploy                                         | Skip the WASM-older-than-sources warning                       |
| `--json`              | status                                         | Machine-readable output for scripts                            |

## Binding freshness

`status`, `doctor --network`, and `generate` report binding state per contract:

| State     | Meaning                                               | Fix                                        |
| --------- | ----------------------------------------------------- | ------------------------------------------ |
| `fresh`   | Bindings match the deployed `contractId` + `wasmHash` | —                                          |
| `stale`   | Contract redeployed since last generate               | `caatinga generate <name> --network <net>` |
| `missing` | No bindings on disk (or contract not deployed)        | deploy, or `caatinga generate`             |
| `unknown` | Bindings exist but predate freshness tracking         | regenerate once to start tracking          |

Freshness is tracked by a `.caatinga-bindings.json` marker written next to each
generated binding package.

## Where things live

| File                          | Holds                                                                                                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `caatinga.config.ts`          | Contracts, WASM paths, networks, bindings output dir, optional `buildRoot`, `postDeploy`, and frontend env mapping                                                                                 |
| `caatinga.artifacts.json`     | Deployed contract IDs + WASM hashes per network                                                                                                                                                    |
| `frontend/.env.local`         | Optional generated view of artifacts for custom frontends when `frontend.envFile` is configured                                                                                                    |
| `contracts/generated/<name>/` | Self-contained binding package generated by `@stellar/stellar-sdk generate` (+ freshness marker); Caatinga patches `package.json` so Vite resolves `./src/index.ts` without a separate `tsc` build |

Setup broken? `npx caatinga doctor --network testnet --source alice` tells you which layer.

## ZK loop

> **Dev/testnet only:** `caatinga zk build` runs a single-party development ceremony. Mainnet deploy/invoke with those artifacts is blocked unless you pass `--allow-dev-ceremony` (not for production).

```bash
caatinga zk init my-zk-dapp && cd my-zk-dapp && npm install
npx caatinga build verifier
npx caatinga zk build main
npx caatinga deploy verifier --network testnet --source alice
npx caatinga zk prove main
npx caatinga zk invoke main --source alice
```

Full reference: [ZK module](./zk.md) · [ZK tutorial](./tutorials/zk-project.md) · [CLI](./cli.md) · [Errors](./errors.md).
