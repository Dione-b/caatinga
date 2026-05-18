# @caatinga/cli

Developer toolkit for Stellar / Soroban dApps — `init`, `build`, `deploy`, `generate`, and `invoke`.

## Install

```bash
npm install -g @caatinga/cli
caatinga --help
```

Inside a generated project, prefer `npx caatinga` so the project-local workflow stays explicit.

## Requirements

- Node.js `>=20`
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) `>=23.0.0` and `<=25.2.0` on `PATH` (22.x breaks `caatinga invoke` signing)
- Rust 1.84.0 or newer with the `wasm32v1-none` target (contract builds)
- A funded Stellar CLI identity for `deploy` and `invoke` (for example `alice`)

```bash
rustup target add wasm32v1-none
stellar keys generate alice --fund --network testnet
```

If your machine runs a newer Stellar CLI, `--allow-untested-stellar-cli` is the local-only escape hatch. CI and release workflows must stay on the supported range.

## Quick start

```bash
caatinga init my-dapp
cd my-dapp
npm install

npx caatinga build counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga generate counter --network testnet
npx caatinga invoke counter.increment --network testnet --source alice
```

`deploy` writes contract IDs to `caatinga.artifacts.json`. `generate` creates TypeScript bindings under the path configured in `caatinga.config.ts` (templates default to `contracts/generated/`).

## Commands

| Command | What it does |
| --- | --- |
| `caatinga init <projectName>` | Create a project from a bundled template and write `caatinga.artifacts.json` |
| `caatinga doctor [--network <network>] [--source <identity>]` | Check local Node, Stellar CLI, Rust, config, artifacts, network, and source identity setup |
| `caatinga build [contract]` | Compile contract WASM through Stellar CLI (default contract: `counter`) |
| `caatinga deploy [contract]` | Deploy one contract or the full configured graph; record IDs in artifacts |
| `caatinga generate <contract>` | Generate TypeScript bindings from a deployed contract ID |
| `caatinga invoke <contract.method>` | Invoke a deployed contract method; extra args forward to Stellar CLI |

The supported CLI flow is `init -> build -> deploy -> generate -> invoke`.

### `init`

- `-t, --template <name>` selects a bundled template (default: `react-vite-counter`)
- Official templates: `react-vite-counter` (single counter dApp), `marketplace-with-token` (experimental multi-contract layout with `dependsOn` and deploy-arg placeholders)
- `init` validates `caatinga.template.json` before copying files

### `build`

- `[contract]` defaults to `counter` when omitted
- `--allow-untested-stellar-cli` allows a Stellar CLI newer than Caatinga's tested maximum (local only)

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
- `--allow-untested-stellar-cli` for local experiments only

Dependencies listed in `dependsOn` deploy first unless `--no-deps` is set. Deploy args may reference `${contracts.<name>.contractId}` placeholders resolved from artifacts.

### `generate` and `invoke`

- `-n, --network <network>` selects the network used to resolve deployed contract IDs
- `invoke` expects `<contract.method>` (for example `counter.increment`) and forwards `[args...]` to the underlying Stellar invocation
- Both accept `--allow-untested-stellar-cli` for local experiments only

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
- `CAATINGA_STELLAR_CLI_NOT_FOUND`, `CAATINGA_UNSUPPORTED_CLI_VERSION`, `CAATINGA_UNTESTED_CLI_VERSION`
- `CAATINGA_BUILD_FAILED`, `CAATINGA_DEPLOY_FAILED`, `CAATINGA_BINDINGS_FAILED`, `CAATINGA_INVOKE_FAILED`
- `CAATINGA_CONTRACT_ID_NOT_FOUND`, `CAATINGA_SOURCE_ACCOUNT_REQUIRED`, `CAATINGA_UNSAFE_SOURCE_ACCOUNT`
- `CAATINGA_CONTRACT_DEPENDENCY_NOT_FOUND`, `CAATINGA_CONTRACT_DEPENDENCY_CYCLE`
- `CAATINGA_DEPLOY_ARG_PLACEHOLDER_INVALID`, `CAATINGA_DEPLOY_ARG_PLACEHOLDER_UNRESOLVED`
- `CAATINGA_TEMPLATE_MANIFEST_NOT_FOUND`, `CAATINGA_TEMPLATE_INCOMPATIBLE`

Full table: [docs/errors.md](https://github.com/Dione-b/caatinga/blob/main/docs/errors.md)

## Browser and client apps

For wallet-backed invocation in the browser, use [`@caatinga/client`](https://www.npmjs.com/package/@caatinga/client) with generated bindings and `caatinga.artifacts.json`.

## Relationship to `@caatinga/core`

`@caatinga/cli` is the supported end-user entrypoint. It stays thin and delegates config loading, artifacts, command orchestration, Stellar CLI version checks, and shared errors to `@caatinga/core`.

Prefer the CLI contract over importing `@caatinga/core` directly unless you are building advanced tooling on Caatinga internals.

## Versioning and stability

Stability applies to the documented commands, inputs, templates bundled with the published CLI, and `CAATINGA_*` error codes.

Undocumented internals, private module paths, and hidden commands such as `caatinga dev` are not part of the stability promise.

Further reference: [CLI docs](https://github.com/Dione-b/caatinga/blob/main/docs/cli.md), [config](https://github.com/Dione-b/caatinga/blob/main/docs/config.md), [Stellar CLI version contract](https://github.com/Dione-b/caatinga/blob/main/docs/stellar-cli-version-contract.md).
