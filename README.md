<div align="center">

<h1>Caatinga</h1>

<p>Developer toolkit for Stellar/Soroban dApps.</p>

[![CI](https://img.shields.io/github/actions/workflow/status/Dione-b/caatinga/ci.yml?branch=main&label=CI&logo=github)](https://github.com/Dione-b/caatinga/actions)
[![npm](https://img.shields.io/npm/v/@caatinga/cli/next?label=%40caatinga%2Fcli%40next)](https://www.npmjs.com/package/@caatinga/cli?activeTab=versions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#)

</div>

> **Alpha software.** APIs, config formats (`caatinga.config.ts`, `caatinga.artifacts.json`),
> and exported package paths may change before `v1.0.0`. Install from the npm **`next`** dist-tag
> (the release-gate validated channel). Pin `@next` or an exact version in apps; review
> the [CHANGELOG](./packages/cli/CHANGELOG.md) before upgrading.
> See [GitHub Releases](https://github.com/Dione-b/caatinga/releases) and [Release process](./docs/release.md).
>
> **`v2.0.0` is in alpha.** It removed the `23.0.0–25.2.0` hard lock and the `--allow-untested-stellar-cli` flag. See the [Stellar CLI version contract](./docs/stellar-cli-version-contract.md) for the new feature-aware behavior.

Caatinga reduces the friction of building Stellar/Soroban dApps by standardizing contract builds, deployments, artifacts, typed bindings, and wallet-ready client integration.

## Why Caatinga?

Building Soroban dApps often requires coordinating multiple moving parts:

- Rust contracts
- WASM builds
- Stellar CLI identities
- contract deployment
- network-specific contract IDs
- TypeScript bindings
- frontend wallet integration

Caatinga provides a standard project structure and CLI workflow to connect these steps without hiding Stellar concepts such as `contractId`, RPC URLs, network passphrases, signing identities, or XDR.

## Features

- Scaffold a Soroban dApp from checked template manifests.
- Build configured contracts through Stellar CLI.
- Deploy one contract or a dependency graph and persist per-network artifacts.
- Generate TypeScript bindings from deployed contracts.
- Invoke contract methods from the CLI.
- Use `@caatinga/client` with generated bindings and wallet adapters in browser apps.
- Diagnose local setup with `caatinga doctor`.

## Requirements

- Node.js 20+
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) 23.0.0 or newer on your `PATH` (25.2.0 recommended; 22.x is unsupported)
- Rust 1.84.0 or newer with the `wasm32v1-none` target
- A funded local Stellar CLI identity, for example `alice`

```bash
cargo install --locked stellar-cli --version 25.2.0
rustup target add wasm32v1-none
stellar keys generate alice --fund --network testnet
```

Caatinga hard-fails on Stellar CLI versions below `23.0.0` (`CAATINGA_UNSUPPORTED_CLI_VERSION`).
Versions newer than the last-tested `25.2.0` run with a non-fatal stderr advisory and a
`caatinga doctor` warning; no override flag is required.

## Install

During alpha, prefer the **`next`** dist-tag on all published packages (`@caatinga/cli`,
`@caatinga/core`, `@caatinga/client`). It tracks the latest release-gate validated build.

```bash
npm install -g @caatinga/cli@next
```

Confirm the resolved version:

```bash
npm view @caatinga/cli@next version
npm view @caatinga/core@next version
npm view @caatinga/client@next version
```

Without a global install, prefix commands with `npx caatinga@next` (see Quick Start).

## Quick Start

```bash
caatinga init my-dapp
cd my-dapp
npm install
# pnpm alternative: pnpm install (template includes pnpm-workspace.yaml for pnpm 10.26+/11)

npx caatinga build counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga generate counter --network testnet
npx caatinga invoke counter.increment --network testnet --source alice
```

If you did not install the CLI globally, use `npx caatinga@next` instead of `caatinga` / `npx caatinga`.

`deploy` writes the contract ID to `caatinga.artifacts.json`. `generate` creates TypeScript
bindings under `contracts/generated/`. Run `npx caatinga doctor --network testnet --source alice`
when setup fails before build/deploy/generate/invoke.

For the complete zero-to-testnet path, see [From Zero to Testnet](./docs/tutorials/from-zero-to-testnet.md).

## Project Layout

After `init`, you typically work with:

- `caatinga.config.ts` — contracts, WASM paths, networks
- `caatinga.artifacts.json` — deployed contract IDs per network
- `contracts/` — Rust Soroban contracts
- `contracts/generated/` — bindings after `generate`
- `src/` — frontend/client code from the selected template

## CLI Commands

| Command                                                                  | What it does                                                                               |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `caatinga init <dir>`                                                    | Create a project from a template                                                           |
| `caatinga doctor [--network <name>] [--source <identity>]`               | Check local Node, Stellar CLI, Rust, config, artifacts, network, and source identity setup |
| `caatinga build [contract]`                                              | Compile contract WASM (default: `counter`)                                                 |
| `caatinga deploy [contract] --source <identity> --network <name>`        | Deploy and save `contractId` to artifacts                                                  |
| `caatinga generate <contract> --network <name>`                          | Generate TS bindings from a deployed contract                                              |
| `caatinga invoke <contract.method> --source <identity> --network <name>` | Call a contract method                                                                     |

**Common flags**

- `--source` — local Stellar CLI identity that can sign (for example `alice`). Public `G...` addresses are not accepted for signing operations.
- `--network` — Network from `caatinga.config.ts` (e.g. `testnet`)
- `--force` — Redeploy even if artifacts already have a contract ID

## Browser Client

Use `@caatinga/client@next` (or the same version as your CLI) with generated bindings,
`caatinga.artifacts.json`, and a wallet adapter. Caatinga is not limited to Freighter:
the client accepts any adapter that implements the wallet contract, and the package ships
optional adapters for Freighter and Stellar Wallets Kit. Use Stellar Wallets Kit when your
app should support multiple wallet providers from the same integration layer.

```bash
npm install @caatinga/client@next @caatinga/core@next
```

```ts
import { createCaatingaClient } from "@caatinga/client";
import { createStellarWalletsKitAdapter } from "@caatinga/client/stellar-wallets-kit";
import * as Counter from "./contracts/generated/counter";
import artifacts from "../caatinga.artifacts.json";

const client = createCaatingaClient({
  network: { name: "testnet", rpcUrl: "https://soroban-testnet.stellar.org", networkPassphrase: "Test SDF Network ; September 2015" },
  artifacts,
  wallet: createStellarWalletsKitAdapter(),
  contracts: { counter: { binding: Counter } },
});

const before = await client.contract("counter").read<number>("get");
const increment = await client.contract("counter").invoke<number>("increment");
```

For the full client contract, wallet adapter rules, XDR debug options, and the binding shape Caatinga expects, see [Client](./docs/client.md) and [examples/counter-web](./examples/counter-web).

## Error Codes

Public CLI and client errors use stable `CAATINGA_*` codes and actionable fix guidance. Automation may parse the code, but not the prose. See [Errors](./docs/errors.md).

## Roadmap

The current status is alpha. The roadmap prioritizes CLI stability, docs, error contracts,
consumer examples, and release automation before v1. See [ROADMAP.md](./ROADMAP.md).

The GitHub Actions workflow named `Release Gate` validates release readiness with typecheck,
docs, build, tests, snapshot packing, publish dry-run, and consumer checks. It does not publish
packages or create GitHub Releases yet; those steps remain manual until real release automation
is implemented.

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md), [Architecture](./docs/architecture.md), and [Testing](./docs/testing.md) before opening a PR. New public behavior should include tests and error-path coverage.

## Docs

- [Getting started](./docs/getting-started.md)
- [From Zero to Testnet](./docs/tutorials/from-zero-to-testnet.md)
- [CLI reference](./docs/cli.md)
- [Config](./docs/config.md)
- [Client](./docs/client.md)
- [Errors](./docs/errors.md)
- [Release process](./docs/release.md)

## Develop this repo

```bash
git clone https://github.com/Dione-b/caatinga.git && cd caatinga
pnpm install && pnpm build && pnpm test
pnpm --filter @caatinga/cli dev init my-dapp   # run CLI from source
```

## License

MIT
