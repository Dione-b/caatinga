# From Zero to Testnet

This tutorial takes a new Caatinga project from scaffold to a deployed Soroban counter contract on Stellar testnet.

During alpha, use the npm **`next`** dist-tag for `@caatinga/cli`, `@caatinga/core`, and `@caatinga/client`. It tracks the latest release-gate validated build.

## Prerequisites

Install Node.js 20+ and Rust first. Then install the supported Stellar CLI and Wasm target:

```bash
npm install -g @caatinga/cli@next
cargo install --locked stellar-cli --version 25.2.0
rustup target add wasm32v1-none
stellar --version
rustc --version
```

Confirm the published `next` versions:

```bash
npm view @caatinga/cli@next version
npm view @caatinga/core@next version
npm view @caatinga/client@next version
```

Create and fund a local Stellar CLI identity:

```bash
stellar keys generate alice --fund --network testnet
```

`--source` must be a local Stellar CLI identity, not a public `G...` address. Caatinga rejects public addresses for deploy/invoke because those operations need a signer.

## Create the Project

```bash
caatinga init my-dapp
cd my-dapp
npm install
```

`pnpm install` also works. The default `react-vite-counter` template includes `pnpm-workspace.yaml` for pnpm 10.26+/11.x (see [Templates](../templates.md#pnpm-1026--11x)).

Without a global CLI install, run `npx caatinga@next init my-dapp` instead of `caatinga init`.

The default template creates:

- `caatinga.config.ts` with contracts, output paths, and networks.
- `caatinga.artifacts.json` for per-network deployed contract IDs.
- `contracts/` with Rust Soroban contract source.
- `src/` with frontend/client code.

## Verify the Environment

```bash
npx caatinga doctor --network testnet --source alice
```

Expected shape:

```txt
Caatinga Doctor

✓ Node.js 20.11.0
✓ Stellar CLI 25.2.0
✓ Rust 1.84.0
✓ wasm32v1-none target installed
✓ caatinga.config.ts found
✓ caatinga.artifacts.json found
✓ network testnet found
✓ source identity alice found

Status: ready
```

If Stellar CLI is missing, install it:

```bash
cargo install --locked stellar-cli --version 25.2.0
```

If the Wasm target is missing, install it:

```bash
rustup target add wasm32v1-none
```

## Build, Deploy, Generate, Invoke

```bash
npx caatinga build counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga generate counter --network testnet
npx caatinga invoke counter.increment --network testnet --source alice
```

`deploy` saves the deployed `contractId` under the selected network in `caatinga.artifacts.json`. `generate` reads that artifact and writes TypeScript bindings under the generated bindings directory configured in `caatinga.config.ts`.

To redeploy even when an artifact already contains a contract ID:

```bash
npx caatinga deploy counter --network testnet --source alice --force
```

## Use the Contract in a Client

After generation, install the browser packages from `next`:

```bash
npm install @caatinga/client@next @caatinga/core@next github:Creit-Tech/Stellar-Wallets-Kit#v0.0.7
```

Browser code can compose artifacts, generated bindings, network config, and a wallet adapter:

```ts
import { createCaatingaClient } from "@caatinga/client";
import { createStellarWalletsKitAdapter } from "@caatinga/client/stellar-wallets-kit";
import * as Counter from "./contracts/generated/counter";
import artifacts from "../caatinga.artifacts.json";

const wallet = createStellarWalletsKitAdapter();

const client = createCaatingaClient({
  network: {
    name: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
  artifacts,
  wallet,
  contracts: {
    counter: { binding: Counter },
  },
});

const before = await client.contract("counter").read<number>("get");
const increment = await client.contract("counter").invoke<number>("increment");
const after = increment.result ?? await client.contract("counter").read<number>("get");
```

## Troubleshooting

- `ERR_PNPM_IGNORED_BUILDS` (esbuild): pnpm 11 blocks lifecycle scripts by default. Ensure `pnpm-workspace.yaml` contains `allowBuilds.esbuild: true` (already in the official `react-vite-counter` template).
  If you ran `pnpm approve-builds` interactively, replace any placeholder value with the boolean `true` — incomplete approval leaves invalid YAML.
- `ERR_PNPM_EXOTIC_SUBDEP`: pnpm 10.26+/11.x refused a GitHub subdependency from `stellar-wallets-kit`. Ensure `pnpm-workspace.yaml` contains `blockExoticSubdeps: false` (shipped with the official counter template).
- `CAATINGA_ARTIFACT_NOT_FOUND` on deploy: WASM was not built yet. Run `npx caatinga build <contract>` before `deploy`.
  After a successful build, ensure `caatinga.config.ts` points to `target/wasm32v1-none/release/*.wasm`, or upgrade to `@caatinga/cli@next` (0.2.2+ resolves legacy `wasm32-unknown-unknown` paths automatically).
- `CAATINGA_DOCTOR_PARTIAL_DEPLOY`: one or more configured contracts lack a `contractId` on the selected network. Run the `caatinga deploy` commands printed by `caatinga doctor --network <name>`.
- `CAATINGA_STELLAR_CLI_NOT_FOUND`: install Stellar CLI and ensure `stellar` is on `PATH`.
- `CAATINGA_UNSUPPORTED_CLI_VERSION`: install Stellar CLI 23.0.0-25.2.0.
- `CAATINGA_UNTESTED_CLI_VERSION`: use a tested Stellar CLI version, or pass `--allow-untested-stellar-cli` only for local experiments.
- `CAATINGA_RUST_TARGET_NOT_FOUND`: run `rustup target add wasm32v1-none`.
- `CAATINGA_NETWORK_NOT_FOUND`: add the network to `caatinga.config.ts` or pass a configured `--network`.
- `CAATINGA_UNSAFE_SOURCE_ACCOUNT`: pass a local Stellar CLI identity such as `alice`, not a public `G...` address or secret.
