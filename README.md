<div align="center">

<h1>Caatinga</h1>

<p>CLI toolkit for Stellar / Soroban dApps — init, build, deploy, generate bindings, invoke.</p>

[![CI](https://img.shields.io/github/actions/workflow/status/Dione-b/caatinga/ci.yml?branch=main&label=CI&logo=github)](https://github.com/Dione-b/caatinga/actions)
[![npm](https://img.shields.io/npm/v/@caatinga/cli?label=%40caatinga%2Fcli)](https://www.npmjs.com/package/@caatinga/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#)

</div>

> **⚠️ Alpha software.** APIs, config formats (`caatinga.config.ts`, `caatinga.artifacts.json`), and exported package paths may change without notice before `v1.0.0`. Pin to an exact version and review the [CHANGELOG](./packages/cli/CHANGELOG.md) before upgrading.

## Install

```bash
npm install -g @caatinga/cli
```

**You also need:**

- Node.js 20+
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) 23.x–25.2.x on your `PATH` (22.x breaks `caatinga invoke`)
- Rust 1.84.0 or newer with the wasm32v1-none target.
- A funded Stellar CLI identity (e.g. `alice`)

```bash
cargo install --locked stellar-cli --version 25.2.0
stellar --version
stellar keys generate alice --fund --network testnet
```

Caatinga supports Stellar CLI 23.0.0 through 25.2.0. Versions below 23.0.0 fail with CAATINGA_UNSUPPORTED_CLI_VERSION. Versions above 25.2.0 fail with CAATINGA_UNTESTED_CLI_VERSION unless --allow-untested-stellar-cli is explicitly used for local experiments. Release and CI gates must not use that override.

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

`deploy` writes the contract ID to `caatinga.artifacts.json`. `generate` creates TypeScript bindings under `contracts/generated/`.

## Commands

| Command | What it does |
|---|---|
| `caatinga init <dir>` | Create a project from a template |
| `caatinga build [contract]` | Compile contract WASM (default: `counter`) |
| `caatinga deploy [contract] --source <identity> --network <name>` | Deploy and save `contractId` to artifacts |
| `caatinga generate <contract> --network <name>` | Generate TS bindings from a deployed contract |
| `caatinga invoke <contract.method> --source <identity> --network <name>` | Call a contract method |

**Common flags**

- `--source` — Stellar CLI identity that can sign (e.g. `alice`). Public `G…` addresses are not accepted.
- `--network` — Network from `caatinga.config.ts` (e.g. `testnet`)
- `--force` — Redeploy even if artifacts already have a contract ID

## Browser apps

Use `@caatinga/client` with generated bindings, `caatinga.artifacts.json`, and a wallet adapter (Freighter):

```ts
import { createCaatingaClient } from "@caatinga/client";
import { freighterWalletAdapter } from "@caatinga/client/freighter";
import * as Counter from "./contracts/generated/counter";
import artifacts from "../caatinga.artifacts.json";

const client = createCaatingaClient({
  network: {
    name: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
  artifacts,
  wallet: freighterWalletAdapter,
  contracts: { counter: { binding: Counter } },
});

await client.contract("counter").invoke("increment");
```

## Project layout

After `init`, you typically work with:

- `caatinga.config.ts` — contracts, WASM paths, networks
- `caatinga.artifacts.json` — deployed contract IDs per network
- `contracts/` — Rust Soroban contracts
- `contracts/generated/` — bindings (after `generate`)

## Docs

- [Getting started](./docs/getting-started.md)
- [CLI reference](./docs/cli.md)
- [Config](./docs/config.md)
- [Client](./docs/client.md)
- [Errors](./docs/errors.md)

## Develop this repo

```bash
git clone https://github.com/Dione-b/caatinga.git && cd caatinga
pnpm install && pnpm build && pnpm test
pnpm --filter @caatinga/cli dev init my-dapp   # run CLI from source
```

## License

MIT
