# Caatinga

[![CI](https://img.shields.io/github/actions/workflow/status/Dione-b/caatinga/ci.yml?branch=main&label=CI&logo=github)](https://github.com/Dione-b/caatinga/actions)
[![npm](https://img.shields.io/npm/v/@caatinga/cli?label=%40caatinga%2Fcli&logo=npm)](https://www.npmjs.com/package/@caatinga/cli?activeTab=versions)

Git-versioned Soroban deploy artifacts and multi-contract orchestration for TypeScript teams.

> Alpha (pre-1.0). The `3.x` npm major does not imply API stability. Pin an exact version for reproducible installs. See [CHANGELOG](./packages/cli/CHANGELOG.md).

## Table of Contents

- [Documentation](#documentation)
- [Install](#install)
- [Quick start](#quick-start)
- [Requirements](#requirements)
- [How it fits together](#how-it-fits-together)
- [Project layout](#project-layout)
- [Packages](#packages)
- [Contributing](#contributing)
- [License](#license)

## Documentation

- **Docs site:** [dione-b.github.io/caatinga](https://dione-b.github.io/caatinga/)
- [Getting started](./docs/getting-started.md) — install, scaffold, CLI-to-browser flow
- [From Zero to Testnet](./docs/tutorials/from-zero-to-testnet.md) — full walkthrough
- [CLI reference](./docs/cli.md) · [Cheatsheet](./docs/cheatsheet.md)
- [Architecture](./docs/architecture.md) · [ADRs](./docs/adr/index.md)
- [Client](./docs/client.md) · [Wallets](./docs/wallets.md) · [Errors](./docs/errors.md)
- [ROADMAP](./ROADMAP.md)

## Install

```bash
npm install -g @caatinga/cli
```

Or run without a global install: `npx caatinga init my-dapp`

## Quick start

```bash
npx caatinga init my-dapp
cd my-dapp
npm install

npx caatinga build counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga status --network testnet
```

`deploy` writes the contract ID to `caatinga.artifacts.json` and generates TypeScript bindings (pass `--no-generate` to skip). Run `caatinga doctor` if setup fails.

For scaffold options and a browser walkthrough, see [Getting started](./docs/getting-started.md) and [Project scaffolds](./docs/tutorials/project-scaffolds.md).

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

## How it fits together

Caatinga orchestrates the official Stellar stack — build, deploy, and invoke still shell out to Stellar CLI; `caatinga generate` runs `npx @stellar/stellar-sdk generate`. Deployed contract IDs live in `caatinga.artifacts.json`, committed to git, keyed per network. No mandatory hosted registry. See [ADR 0002](./docs/adr/0002-local-artifacts-as-source-of-truth.md).

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

Optional ZK workflow (Circom + Groth16 on Soroban): [ZK docs](./docs/zk.md).

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

| Package | Role |
| ------- | ---- |
| `@caatinga/cli` | `caatinga` command — init, build, deploy, wire, generate, status, doctor |
| `@caatinga/core` | Config, shell orchestration, Stellar CLI adapters, error catalog |
| `@caatinga/client` | Browser/Node contract client, wallet adapters, React hooks |
| `@caatinga/zk` | Circom Groth16 verifier workflow (niche) |

Full export map: [Packages](./docs/packages.md).

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
