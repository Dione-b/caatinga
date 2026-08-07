# @caatinga/cli

Developer toolkit for Stellar / Soroban dApps — `init`, `build`, `deploy`, `wire`, `sync-env`, `generate`, `status`, `smoke`, `regression`, `ci`, and `invoke`.

## Install

```bash
npm install -g @caatinga/cli
ctg --help   # standard command; caatinga is a legacy alias
```

Both `ctg` and `caatinga` resolve to the same CLI binary. Inside a generated project, prefer `npx ctg` (or `npx caatinga`) so the project-local workflow stays explicit.

## Requirements

Run `ctg doctor` on a fresh machine to verify prerequisites. Manual requirements:

- Node.js `>=22`
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) `>=23.0.0` on `PATH` (27.0.0 recommended)
- Rust 1.84.0+ with the `wasm32v1-none` target
- A funded local Stellar CLI identity for `deploy` and `invoke` (e.g. `alice`)

## Quick start

```bash
ctg init my-dapp
cd my-dapp && npm install

npx ctg build counter
npx ctg deploy counter --network testnet --source alice
npx ctg smoke --network testnet --source alice
npx ctg status --network testnet
```

Full onboarding: [Getting started](https://github.com/Dione-b/caatinga/blob/main/docs/getting-started.md).

## Commands

| Command                        | What it does                                            |
| ------------------------------ | ------------------------------------------------------- |
| `ctg init <dir>`               | Create a project from a bundled template                |
| `ctg doctor`                   | Check toolchain, config, artifacts, env drift, bindings |
| `ctg build [contract]`         | Compile contract WASM                                   |
| `ctg deploy [contract]`        | Deploy, record IDs in artifacts, auto-generate bindings |
| `ctg wire`                     | Run configured `postDeploy` + `postDeployRead` hooks    |
| `ctg sync-env`                 | Write frontend env vars from artifacts                  |
| `ctg generate [contract]`      | (Re)generate TypeScript bindings                        |
| `ctg status`                   | Show deployed contracts and binding freshness           |
| `ctg smoke`                    | Run configured read-only smoke checks                   |
| `ctg regression`               | test → build → deploy --if-changed → generate → smoke   |
| `ctg ci run`                   | `doctor` then `smoke` (CI helper)                       |
| `ctg identity export\|import`  | Export/import Stellar CLI config for CI secrets         |
| `ctg invoke <contract.method>` | Call a state-changing contract method                   |
| `ctg read <contract.method>`   | Simulate a read-only contract method                    |

Notable flags: `--if-changed`, `--strict-network`, `--strict` / `--strict-env` / `--strict-bindings` (doctor), `status --strict`, `read --expect`.

Command reference, flags, and error codes: [CLI docs](https://github.com/Dione-b/caatinga/blob/main/docs/cli.md) · [Cheatsheet](https://github.com/Dione-b/caatinga/blob/main/docs/cheatsheet.md).

## Browser apps

Use [`@caatinga/client`](https://www.npmjs.com/package/@caatinga/client) with generated bindings and `caatinga.artifacts.json`. Single-invoker scope until v1.0 — see [Client docs](https://github.com/Dione-b/caatinga/blob/main/docs/client.md#single-invoker-scope-until-v10).

## Relationship to `@caatinga/core`

The CLI delegates config, artifacts, orchestration, and errors to `@caatinga/core`. Prefer the CLI contract over importing core directly unless you are building advanced tooling.
