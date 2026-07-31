# Cheatsheet

The whole Caatinga loop on one page. Every command runs inside a generated project.

`ctg` is a short alias for `caatinga` (`ctg build` ≡ `caatinga build`).

## Prerequisites

See [Getting started](./getting-started.md#prerequisites) for manual install instructions. Verify with `caatinga doctor`.

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
caatinga init my-dapp && cd my-dapp && npm install   # scaffold — see Getting started
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

### In-place upgrade (admin-gated contracts)

When the contract exposes `upgrade(new_wasm_hash)` with admin auth (same `contractId`, new WASM):

```bash
npx caatinga upgrade counter --network testnet --source alice
npx caatinga upgrade counter --if-changed --source alice --network testnet
npx caatinga upgrade counter --source alice --generate --sync-env   # optional post-steps
```

For a **new contract instance** (no in-place entrypoint), use redeploy history instead:

```bash
npx caatinga deploy counter --upgrade --network testnet --source alice
```

See [Contract upgrade](./tutorials/contract-upgrade.md).

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
npx caatinga smoke --network testnet --source alice  # read-only checks from config
npx caatinga regression --network testnet --source alice  # test → build → deploy --if-changed → generate → smoke
```

## CI and regression

```bash
npx caatinga doctor --network testnet --strict-bindings   # fail on stale bindings
npx caatinga status --network testnet --strict            # after deploy --no-generate
npx caatinga ci run --network testnet --source alice --strict  # doctor + smoke in CI
caatinga identity export > stellar-config.b64             # rotate CAATINGA_CI_STELLAR_CONFIG_B64
```

See [Production readiness](./production-readiness.md) and [Testing](./internal/testing.md) for workflow details.

## Commands

| Command                             | What it does                                                         |
| ----------------------------------- | -------------------------------------------------------------------- |
| `caatinga init <dir>`               | Scaffold a project from a template                                   |
| `caatinga doctor`                   | Check Node, Stellar CLI, Rust, config, artifacts, network, identity  |
| `caatinga build [contract]`         | Compile contract WASM; omit name to build all configured contracts   |
| `caatinga deploy [contract]`        | Deploy (graph-aware), record artifacts, auto-generate bindings       |
| `caatinga upgrade <contract>`       | In-place WASM upgrade on existing `contractId` (upload + invoke)     |
| `caatinga wire`                     | Run configured `postDeploy` hooks against deployed contracts         |
| `caatinga sync-env`                 | Write configured frontend env vars from deploy artifacts             |
| `caatinga generate [contract]`      | (Re)generate TypeScript bindings from deployed contract IDs          |
| `caatinga status`                   | Table of deployed contracts + binding freshness per network          |
| `caatinga smoke`                    | Run configured read-only smoke checks with expect DSL                |
| `caatinga regression`               | Full pipeline: test → build → deploy --if-changed → generate → smoke |
| `caatinga ci run`                   | CI helper: `doctor` then `smoke`                                     |
| `caatinga identity export\|import`  | Export/import Stellar CLI config as base64 tarball                   |
| `caatinga invoke <contract.method>` | Call a contract method from the CLI                                  |
| `caatinga read <contract.method>`   | Simulate a read-only contract method (no signing)                    |

## Flags

| Flag                    | Commands                                                                       | Description                                                    |
| ----------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `--network <name>`      | doctor, deploy, upgrade, generate, status, invoke, wire, smoke, regression, ci | Network from `caatinga.config.ts`                              |
| `--source <identity>`   | doctor, deploy, upgrade, invoke, wire, smoke, regression, ci, zk invoke        | Local Stellar CLI identity that signs (never a `G...` address) |
| `--force`               | deploy                                                                         | Redeploy even when artifacts already hold a contract ID        |
| `--upgrade`             | deploy                                                                         | Redeploy with upgrade history (new `contractId`)               |
| `--if-changed`          | deploy, upgrade, regression                                                    | Skip when local WASM hash matches artifact                     |
| `--expected-hash`       | upgrade                                                                        | Fail before upload if local WASM hash differs                  |
| `--no-build`            | upgrade                                                                        | Skip `caatinga build` before upload                            |
| `--generate`            | upgrade                                                                        | Regenerate bindings after successful in-place upgrade          |
| `--sync-env`            | upgrade                                                                        | Sync frontend env after successful in-place upgrade            |
| `--no-generate`         | deploy                                                                         | Skip automatic bindings generation (CI without binding needs)  |
| `--no-wire`             | deploy                                                                         | Skip automatic `postDeploy` hooks after a full graph deploy    |
| `--no-sync-env`         | deploy                                                                         | Skip automatic frontend env sync after a full graph deploy     |
| `--no-deps`             | deploy                                                                         | Deploy a single contract without its `dependsOn` graph         |
| `--verify-deps`         | deploy                                                                         | Confirm dependency contract IDs exist on-chain first           |
| `--no-stale-check`      | deploy                                                                         | Skip the WASM-older-than-sources warning                       |
| `--strict-network`      | generate                                                                       | Fail when network has no artifacts block                       |
| `--strict`              | status, doctor, ci run                                                         | status: fail on stale bindings; doctor/ci: strict env+bindings |
| `--strict-env`          | doctor                                                                         | Fail when frontend env file drifts from artifacts              |
| `--strict-bindings`     | doctor                                                                         | Fail when bindings are stale or missing                        |
| `--all-networks`        | doctor                                                                         | Report deploy/bindings matrix for every configured network     |
| `--expect <dsl>`        | read                                                                           | Assert stdout with postDeploy expect DSL                       |
| `--quiet` / `--summary` | read                                                                           | Compact output for large array payloads                        |
| `--json`                | status                                                                         | Machine-readable output for scripts                            |

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
| `caatinga.config.ts`          | Contracts, WASM paths, networks, bindings output dir, optional `buildRoot`, `postDeploy`, `postDeployRead`, `smoke`, and frontend env mapping                                                      |
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
