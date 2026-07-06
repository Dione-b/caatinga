# Caatinga

[![CI](https://img.shields.io/github/actions/workflow/status/Dione-b/caatinga/ci.yml?branch=main&label=CI&logo=github)](https://github.com/Dione-b/caatinga/actions)
[![npm](https://img.shields.io/npm/v/@caatinga/cli?label=%40caatinga%2Fcli&logo=npm)](https://www.npmjs.com/package/@caatinga/cli?activeTab=versions)

Deployment Orchestration + Versioned Artifacts for Soroban.

- Deploy multiple Soroban contracts.
- Track deployments in Git.
- Generate browser-ready TypeScript bindings.
- No hosted registry required.

```bash
npm install -g @caatinga/cli
npx caatinga init my-dapp
```

> **v1.0 stable contract** on npm major `3.x`. Pin an exact version for reproducible installs. See [CHANGELOG](./packages/cli/CHANGELOG.md) and [Public API](./docs/public-api.md).

## Why Caatinga?

- Graph-aware deployment for multiple contracts.
- Git-versioned deployment artifacts.
- Auto-generated TypeScript bindings.
- Browser-ready runtime with wallet adapters.
- Built on top of the official Stellar toolchain.

## Install

```bash
npm install -g @caatinga/cli
```

Or run without a global install: `npx caatinga init my-dapp`

## Quick start

### Path A — Toolchain already installed (~10 minutes)

Requires Rust + `wasm32v1-none` + Stellar CLI 23+ and a funded identity `alice`.

```bash
npx caatinga init my-dapp
cd my-dapp && npm install

npx caatinga build counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga generate counter --network testnet   # if deploy used --no-generate
npx caatinga read counter.get --network testnet

npm run dev   # React template: wallet + @caatinga/client
```

### Path B — Fresh machine

```bash
npm install -g @caatinga/cli
caatinga setup --source alice --network testnet   # Rust, Stellar CLI, funded identity
caatinga init my-dapp && cd my-dapp && npm install
caatinga build counter
caatinga deploy counter --network testnet --source alice
```

`deploy` writes the contract ID to `caatinga.artifacts.json` and generates TypeScript bindings (pass `--no-generate` to skip). Run `caatinga doctor` if setup fails.

For scaffold options and a browser walkthrough, see [Getting started](./docs/getting-started.md) and [Project scaffolds](./docs/tutorials/project-scaffolds.md).

## What you get after deploy

**`caatinga.artifacts.json`** — committed to Git, keyed per network:

```json
{
  "project": "my-dapp",
  "version": 2,
  "networks": {
    "testnet": {
      "contracts": {
        "counter": {
          "contractId": "CABCD...",
          "wasmHash": "a1b2c3..."
        }
      }
    }
  }
}
```

**Generated bindings + browser client** — type-safe calls from your frontend:

```typescript
import { caatingaClient } from "./caatinga";

const count = await caatingaClient.contract("counter").read<number>("get");
await caatingaClient.contract("counter").invoke("increment");
```

Under the hood, `caatinga generate` produces a `Client` class from the official Stellar SDK generator. `@caatinga/client` wires contract IDs from artifacts, network config, and your wallet adapter — no copy/paste of IDs into `.env`.

## How it works

Caatinga orchestrates the official Stellar stack — build, deploy, and invoke still shell out to Stellar CLI;
`caatinga generate` runs `npx @stellar/stellar-sdk generate`. Deployed contract IDs live in
`caatinga.artifacts.json`, committed to git, keyed per network. No mandatory hosted registry.
See [ADR 0002](./docs/adr/0002-local-artifacts-as-source-of-truth.md).

For positioning vs Scaffold Stellar and other tools, see [Architecture — competitive stance](./docs/architecture.md#caatinga-vs-scaffold-stellar).

```
   caatinga.config.ts                    caatinga.artifacts.json
   (contracts, networks)                 (contractIds + wasmHash per network)
          │                                        ▲          │
          ▼                                        │          ▼
  ┌────────────────┐    ┌──────────────────┐  ┌─────────────────────────┐
  │ caatinga build │ →  │ caatinga deploy  │→ │ bindings auto-generated │
  │  (Stellar CLI) │    │ (graph-aware)    │  │ + freshness markers     │
  └────────────────┘    └──────────────────┘  └─────────────────────────┘
                                                          │
                              browser                     ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ @caatinga/client: bindings + artifacts + wallet adapter          │
  │   └─ wallet session (persist/restore) ─ @caatinga/client/react  │
  └──────────────────────────────────────────────────────────────────┘
```

`@caatinga/client` connects generated bindings, artifacts, network config, and a pluggable wallet adapter for single-invoker browser flows. See [Client docs](./docs/client.md) and [Wallets](./docs/wallets.md).

## Core Concepts

| Concept      | What it does                                                                 |
| ------------ | ---------------------------------------------------------------------------- |
| **Deployment** | Graph-aware orchestration over the official Stellar CLI.                   |
| **Artifacts**  | Git-versioned deployment metadata (`caatinga.artifacts.json`).           |
| **Runtime**    | Type-safe browser client generated automatically from deployed contracts.  |
| **Automation** | Diagnostics and CI-friendly workflows (`doctor`, `smoke`, stable errors). |

## Why not package.json scripts?

| Scripts approach              | Caatinga                              |
| ----------------------------- | ------------------------------------- |
| Manual deploy per contract    | Graph-aware deployment                |
| Manual contract ID tracking   | Versioned artifacts in Git            |
| Manual binding generation     | Generated automatically on deploy     |
| Shell glue between steps      | Orchestrated workflow                 |
| Copy/paste IDs into `.env`    | Artifacts synced to the browser client |

## Requirements

- **Node.js** 22+
- **[Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)** 23.0.0+ on `PATH` (27.0.0 recommended; 22.x unsupported)
- **Rust** 1.84.0+ with the `wasm32v1-none` target
- A funded local Stellar CLI identity (e.g. `alice`)

```bash
cargo install --locked stellar-cli --version 27.0.0
rustup target add wasm32v1-none
stellar keys generate alice --fund --network testnet
```

Run `caatinga setup` on a fresh machine to install the toolchain automatically. Stellar CLI versions below 23.0.0 hard-fail; versions above 27.0.0 run with an advisory warning. See the [version contract](./docs/stellar-cli-version-contract.md).

## Documentation

- **Docs site:** [dione-b.github.io/caatinga](https://dione-b.github.io/caatinga/)
- [Getting started](./docs/getting-started.md) — install, scaffold, CLI-to-browser flow
- [From Zero to Testnet](./docs/tutorials/from-zero-to-testnet.md) — full walkthrough
- [CLI reference](./docs/cli.md) · [Cheatsheet](./docs/cheatsheet.md) · [Troubleshooting](./docs/troubleshooting.md)
- [Architecture](./docs/architecture.md) · [ADRs](./docs/adr/index.md)
- [Client](./docs/client.md) · [Wallets](./docs/wallets.md) · [Errors](./docs/errors.md)
- [ZK workflow](./docs/zk.md) · [ROADMAP](./ROADMAP.md)

## Project layout

```
my-dapp/
├── caatinga.config.ts        # contracts, WASM paths, networks
├── caatinga.artifacts.json   # deployed contract IDs per network
├── contracts/                # Rust Soroban contracts
│   └── generated/            # TS bindings (auto-generated on deploy)
└── src/                      # frontend/client from the selected template
```

## Packages

| Package            | Role                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `@caatinga/cli`    | `caatinga` command — init, build, deploy, wire, smoke, regression, ci, generate, status, doctor |
| `@caatinga/core`   | Config, shell orchestration, Stellar CLI adapters, error catalog                                |
| `@caatinga/client` | Browser/Node contract client, wallet adapters, React hooks                                      |

Full export map: [Packages](./docs/packages.md). Niche packages (e.g. `@caatinga/zk`) are documented separately.

Public errors use stable `CAATINGA_*` codes — see [Errors](./docs/errors.md).

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR.

```bash
git clone https://github.com/Dione-b/caatinga.git && cd caatinga
pnpm install && pnpm build && pnpm test
pnpm dev init my-dapp   # run CLI from source
```

## License

[MIT](./LICENSE)
