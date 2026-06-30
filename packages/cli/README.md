# @caatinga/cli

Developer toolkit for Stellar / Soroban dApps — `setup`, `init`, `build`, `deploy`, `wire`, `sync-env`, `generate`, `status`, and `invoke`.

## Install

```bash
npm install -g @caatinga/cli@next
caatinga --help
```

Inside a generated project, prefer `npx caatinga` so the project-local workflow stays explicit.

## Requirements

Run `caatinga setup` on a fresh machine to install Node, Rust, Stellar CLI, and a funded local identity. Manual requirements:

- Node.js `>=22`
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) `>=23.0.0` on `PATH` (27.0.0 recommended)
- Rust 1.84.0+ with the `wasm32v1-none` target
- A funded local Stellar CLI identity for `deploy` and `invoke` (e.g. `alice`)

## Quick start

```bash
caatinga init my-dapp
cd my-dapp && npm install

npx caatinga build counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga status --network testnet
```

Full onboarding: [Getting started](https://github.com/Dione-b/caatinga/blob/main/docs/getting-started.md).

## Commands

| Command | What it does |
| ------- | ------------ |
| `caatinga setup` | Bootstrap Node, Rust, Stellar CLI, and a funded identity |
| `caatinga init <dir>` | Create a project from a bundled template |
| `caatinga doctor` | Check toolchain, config, artifacts, and network setup |
| `caatinga build [contract]` | Compile contract WASM |
| `caatinga deploy [contract]` | Deploy, record IDs in artifacts, auto-generate bindings |
| `caatinga wire` | Run configured `postDeploy` hooks |
| `caatinga sync-env` | Write frontend env vars from artifacts |
| `caatinga generate [contract]` | (Re)generate TypeScript bindings |
| `caatinga status` | Show deployed contracts and binding freshness |
| `caatinga invoke <contract.method>` | Call a state-changing contract method |
| `caatinga read <contract.method>` | Simulate a read-only contract method |

Command reference, flags, and error codes: [CLI docs](https://github.com/Dione-b/caatinga/blob/main/docs/cli.md) · [Cheatsheet](https://github.com/Dione-b/caatinga/blob/main/docs/cheatsheet.md).

## Browser apps

Use [`@caatinga/client`](https://www.npmjs.com/package/@caatinga/client) with generated bindings and `caatinga.artifacts.json`. Single-invoker scope until v1.0 — see [Client docs](https://github.com/Dione-b/caatinga/blob/main/docs/client.md#single-invoker-scope-until-v10).

## Relationship to `@caatinga/core`

The CLI delegates config, artifacts, orchestration, and errors to `@caatinga/core`. Prefer the CLI contract over importing core directly unless you are building advanced tooling.
