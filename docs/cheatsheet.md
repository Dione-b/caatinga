# Cheatsheet

The whole Caatinga loop on one page. Every command runs inside a generated project
(`caatinga init my-dapp`).

## The loop

```bash
caatinga init my-dapp && cd my-dapp && npm install   # scaffold
npx caatinga doctor --network testnet --source alice # verify environment
npx caatinga build counter                           # compile WASM
npx caatinga deploy counter --network testnet --source alice
#   ↳ writes contractId to caatinga.artifacts.json
#   ↳ auto-generates TypeScript bindings (skip with --no-generate)
npx caatinga status --network testnet                # what's deployed? bindings fresh?
npm run dev                                          # frontend against the deployed contract
npx caatinga invoke counter.increment --network testnet --source alice
```

`generate` is now a recovery/CI command — deploy runs it for you:

```bash
npx caatinga generate counter --network testnet   # regenerate one contract
npx caatinga generate --network testnet           # regenerate everything deployed
```

## Commands

| Command | What it does |
| --- | --- |
| `caatinga init <dir>` | Scaffold a project from a template |
| `caatinga doctor` | Check Node, Stellar CLI, Rust, config, artifacts, network, identity |
| `caatinga build [contract]` | Compile contract WASM via Stellar CLI |
| `caatinga deploy [contract]` | Deploy (graph-aware), record artifacts, auto-generate bindings |
| `caatinga generate [contract]` | (Re)generate TypeScript bindings from deployed contract IDs |
| `caatinga status` | Table of deployed contracts + binding freshness per network |
| `caatinga invoke <contract.method>` | Call a contract method from the CLI |

## Flags

| Flag | Commands | Description |
| --- | --- | --- |
| `--network <name>` | doctor, deploy, generate, status, invoke | Network from `caatinga.config.ts` |
| `--source <identity>` | doctor, deploy, invoke | Local Stellar CLI identity that signs (never a `G...` address) |
| `--force` | deploy | Redeploy even when artifacts already hold a contract ID |
| `--no-generate` | deploy | Skip automatic bindings generation (CI without binding needs) |
| `--no-deps` | deploy | Deploy a single contract without its `dependsOn` graph |
| `--verify-deps` | deploy | Confirm dependency contract IDs exist on-chain first |
| `--no-stale-check` | deploy | Skip the WASM-older-than-sources warning |
| `--json` | status | Machine-readable output for scripts |

## Binding freshness

`status`, `doctor --network`, and `generate` report binding state per contract:

| State | Meaning | Fix |
| --- | --- | --- |
| `fresh` | Bindings match the deployed `contractId` + `wasmHash` | — |
| `stale` | Contract redeployed since last generate | `caatinga generate <name> --network <net>` |
| `missing` | No bindings on disk (or contract not deployed) | deploy, or `caatinga generate` |
| `unknown` | Bindings exist but predate freshness tracking | regenerate once to start tracking |

Freshness is tracked by a `.caatinga-bindings.json` marker written next to each
generated binding package.

## Where things live

| File | Holds |
| --- | --- |
| `caatinga.config.ts` | Contracts, WASM paths, networks, bindings output dir |
| `caatinga.artifacts.json` | Deployed contract IDs + WASM hashes per network |
| `contracts/generated/<name>/` | Generated TypeScript bindings (+ freshness marker) |

Setup broken? `npx caatinga doctor --network testnet --source alice` tells you which layer.
Full reference: [CLI](./cli.md) · errors: [Errors](./errors.md).
