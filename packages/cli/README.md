# @caatinga/cli

Developer toolkit for Stellar / Soroban dApps — `setup`, `init`, `build`, `deploy`, `generate`, `status`, and `invoke`.

## Install

```bash
npm install -g @caatinga/cli
caatinga --help
```

Inside a generated project, prefer `npx caatinga` so the project-local workflow stays explicit.

## Requirements

Run `caatinga setup` on a fresh machine to install everything below automatically, or follow the manual steps:

- Node.js `>=22`
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) `>=23.0.0` on `PATH` (22.x breaks `caatinga invoke` signing)
- Rust 1.84.0 or newer with the `wasm32v1-none` target (contract builds)
- A funded Stellar CLI identity for `deploy` and `invoke` (for example `alice`)

```bash
rustup target add wasm32v1-none
stellar keys generate alice --fund --network testnet
```

Stellar CLI versions newer than the last-tested `25.2.0` are accepted with a non-fatal stderr advisory and a `caatinga doctor` warning; no override flag is required.

## Quick start

```bash
caatinga init my-dapp
cd my-dapp
npm install
# pnpm alternative: pnpm install (template includes pnpm-workspace.yaml for pnpm 10.26+/11)

npx caatinga build counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga status --network testnet
npx caatinga invoke counter.increment --network testnet --source alice
```

`build` only compiles the WASM file. `deploy` writes contract IDs to `caatinga.artifacts.json` and then generates TypeScript bindings automatically under the path configured in `caatinga.config.ts` (templates default to `contracts/generated/`); pass `--no-generate` to skip. `status` shows what's deployed per network and whether bindings are fresh.

## Commands

| Command                                                       | What it does                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `caatinga setup [--source alice] [--network testnet]`         | Install Node/Rust/Stellar CLI prerequisites and create a funded local identity             |
| `caatinga init <projectName>`                                 | Create a project from a bundled template and write `caatinga.artifacts.json`               |
| `caatinga doctor [--network <network>] [--source <identity>]` | Check local Node, Stellar CLI, Rust, config, artifacts, network, and source identity setup |
| `caatinga build [contract]`                                   | Compile contract WASM through Stellar CLI (default contract: `counter`)                    |
| `caatinga deploy [contract]`                                  | Deploy one contract or the full configured graph; record IDs in artifacts                  |
| `caatinga generate [contract]`                                | (Re)generate TypeScript bindings; omit the name to generate for all deployed contracts     |
| `caatinga status [--network <name>] [--json]`                 | Show deployed contracts and binding freshness per network                                  |
| `caatinga invoke <contract.method>`                           | Invoke a deployed contract method; extra args forward to Stellar CLI                       |
| `caatinga read <contract.method>`                             | Simulate a read-only contract method (no signing or submission)                            |

The supported CLI flow is `init -> build -> deploy (bindings auto-generate) -> invoke`.

### `setup`

- One-step bootstrap for a fresh machine: checks Node, installs/updates Rust via `rustup`, adds the `wasm32v1-none` target, installs the version-pinned Stellar CLI, and creates a funded local identity
- Each step is idempotent — anything already present and compatible is reported and skipped
- `--skip-rust`, `--skip-stellar`, `--skip-identity` skip individual steps
- Run it before `caatinga init` on a fresh machine; `caatinga doctor` is the read-only counterpart that checks the same prerequisites afterward

### `init`

- `-t, --template <name>` selects a bundled template (default: `react-vite-counter`)
- Official templates: `react-vite-counter` (single counter dApp); ZK projects use `caatinga zk init` with `zk-starter`
- `init` validates `caatinga.template.json` before copying files

### `build`

- `[contract]` defaults to `counter` when omitted
- prints a deploy reminder when the default network lacks a `contractId` in `caatinga.artifacts.json`; this warning does not fail the build

### `doctor`

- `-n, --network <network>` validates that the network exists in `caatinga.config.ts`
- `-s, --source <identity>` validates that the local Stellar CLI identity exists
- exits `0` when all diagnostics pass and non-zero when a blocking diagnostic fails

### `deploy`

- Omit `[contract]` to deploy the full configured dependency graph
- `-n, --network <network>` selects a network from `caatinga.config.ts` (for example `testnet`)
- `-s, --source <identity>` is required; must be a Stellar CLI identity alias that can sign (for example `alice`)
- `--force` redeploys even when artifacts already store a contract ID
- `--no-deps` skips dependency deployment for a single named contract (`--no-deps` requires `[contract]`)
- `--verify-deps` confirms each dependency's contract ID exists on-chain before resolving deploy arguments
- `--no-stale-check` skips the WASM-older-than-sources warning
- `--no-generate` skips the automatic bindings generation after deploy

Dependencies listed in `dependsOn` deploy first unless `--no-deps` is set. Deploy args may reference `${contracts.<name>.contractId}` placeholders resolved from artifacts.

After a successful deploy, bindings generate automatically for the deployed contracts. A generation failure never fails the deploy — the CLI prints a warning plus the recovery command (`npx caatinga generate --network <network>`).

### `generate`, `status`, and `invoke`

- `-n, --network <network>` selects the network used to resolve deployed contract IDs
- `generate` prints binding freshness per contract before regenerating in all-contracts mode
- `status` prints a per-network table (contract ID, WASM hash, deployed, binding freshness, dependencies); `--json` emits the machine-readable structure
- `invoke` expects `<contract.method>` (for example `counter.increment`) and forwards `[args...]` to the underlying Stellar invocation
- `read` simulates a read-only method without signing; `--source` is optional (defaults to `alice`)

`caatinga dev` is reserved, hidden in pre-v1 builds, and not part of the stability promise. Use your frontend dev server (for example Vite) alongside the commands above.

## Supported inputs

- `--source` accepts a local Stellar CLI identity alias that can sign transactions; public `G...` addresses and secret keys are rejected
- `--network` must match a network defined in `caatinga.config.ts`
- Project commands require `caatinga.config.ts` in the working directory

Unsupported input posture:

- secret keys and seed phrases are not supported CLI inputs
- undocumented private flags, internal repo paths, and hidden commands are not part of the package contract

## Error behavior

`@caatinga/cli` emits documented `CAATINGA_*` error codes for automation. Match on the error code, not human-readable text.

Common codes:

- `CAATINGA_CONFIG_NOT_FOUND`, `CAATINGA_INVALID_CONFIG`
- `CAATINGA_STELLAR_CLI_NOT_FOUND`, `CAATINGA_UNSUPPORTED_CLI_VERSION`
- `CAATINGA_BUILD_FAILED`, `CAATINGA_DEPLOY_FAILED`, `CAATINGA_BINDINGS_FAILED`, `CAATINGA_INVOKE_FAILED`
- `CAATINGA_CONTRACT_ID_NOT_FOUND`, `CAATINGA_SOURCE_ACCOUNT_REQUIRED`, `CAATINGA_UNSAFE_SOURCE_ACCOUNT`
- `CAATINGA_CONTRACT_DEPENDENCY_NOT_FOUND`, `CAATINGA_CONTRACT_DEPENDENCY_CYCLE`
- `CAATINGA_DEPLOY_ARG_PLACEHOLDER_INVALID`, `CAATINGA_DEPLOY_ARG_PLACEHOLDER_UNRESOLVED`
- `CAATINGA_TEMPLATE_MANIFEST_NOT_FOUND`, `CAATINGA_TEMPLATE_INCOMPATIBLE`

Full table: [docs/errors.md](https://github.com/Dione-b/caatinga/blob/main/docs/errors.md)

## Browser and client apps

For single-invoker wallet-backed invocation in the browser, use [`@caatinga/client`](https://www.npmjs.com/package/@caatinga/client) with generated bindings and `caatinga.artifacts.json`. Multi-signer / `signAuthEntry` orchestration is not supported until v1.0 — see [Client docs](https://github.com/Dione-b/caatinga/blob/main/docs/client.md#single-invoker-scope-until-v10).

ZK workflows use dev-ceremony guardrails on mainnet — see [ZK module](https://github.com/Dione-b/caatinga/blob/main/docs/zk.md#production-guardrails).

## Relationship to `@caatinga/core`

`@caatinga/cli` is the supported end-user entrypoint. It stays thin and delegates config loading, artifacts, command orchestration, Stellar CLI version checks, and shared errors to `@caatinga/core`.

Prefer the CLI contract over importing `@caatinga/core` directly unless you are building advanced tooling on Caatinga internals.

## Versioning and stability

Stability applies to the documented commands, inputs, templates bundled with the published CLI, and `CAATINGA_*` error codes.

Undocumented internals, private module paths, and hidden commands such as `caatinga dev` are not part of the stability promise.

Further reference: [CLI docs](https://github.com/Dione-b/caatinga/blob/main/docs/cli.md), [config](https://github.com/Dione-b/caatinga/blob/main/docs/config.md), [Stellar CLI version contract](https://github.com/Dione-b/caatinga/blob/main/docs/stellar-cli-version-contract.md).
