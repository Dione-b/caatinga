# Caatinga

[![CI](https://img.shields.io/github/actions/workflow/status/Dione-b/caatinga/ci.yml?branch=main&label=CI&logo=github)](https://github.com/Dione-b/caatinga/actions)
[![npm](https://img.shields.io/npm/v/@caatinga/cli?label=%40caatinga%2Fcli&logo=npm)](https://www.npmjs.com/package/@caatinga/cli?activeTab=versions)

Deployment Orchestration + Versioned Artifacts for Soroban.

> **v1.0 stable contract** on npm major `3.x`. Pin an exact version for reproducible installs. See [CHANGELOG](./packages/cli/CHANGELOG.md) and [Public API](./docs/public-api.md).

## Core Identity

- **Mission:** Simplify the development, deployment, and integration of Soroban contracts for TypeScript teams through robust local orchestration and deterministic artifact versioning.
- **Problem it Solves:** Fragmented deployment scripts and the difficulty of tracking and integrating contract IDs deployed across multiple environments (local, testnet, mainnet) into the frontend in a Git-friendly, deterministic way.
- **Key Differentiator:** Graph-aware local deployment orchestration with portable, Git-versioned artifact tracking (`caatinga.artifacts.json`), eliminating mandatory on-chain registry dependencies for basic development while providing auto-generated type-safe client bindings and direct browser wallet integration.

## Core Pillars

Every feature in Caatinga belongs to one of these four core pillars:

1. **Deployment**
   - **Local Orchestration:** Drive Stellar CLI contract builds and deployments locally.
   - **Dependency Graphs:** Model and deploy multi-contract structures using topological ordering (`dependsOn`).
   - **Reference Resolution:** Auto-resolve inter-contract references in configurations using placeholders like `${contracts.token.contractId}`.
   - **Lifecycle Hooks:** Execute post-deploy actions (`postDeploy`) automatically.

2. **Artifacts**
   - **Git-versioned State:** Store all deployment state (contract IDs, WASM hashes) per network in `caatinga.artifacts.json`.
   - **No Lock-in:** Use a portable registry that stays in your repository. No mandatory on-chain registry dependencies.
   - **Metadata Tracking:** Trace compiler settings, git commits, and versions directly inside the artifacts.

3. **Runtime**
   - **Type-safe Client:** Read state and invoke contract methods with `@caatinga/client` using auto-generated TypeScript bindings.
   - **Wallet Adapters:** Pluggable adapters for browser wallets (Freighter, Stellar Wallets Kit) with React bindings.
   - **Execution Pipeline:** Explicitly simulate, sign, submit, and watch transaction lifecycle states.

4. **Automation**
   - **Environment Diagnostics:** Check local environments, Rust compiler targets, and identity setups using `caatinga doctor` and `caatinga setup`.
   - **Regression & Smoke Checks:** Validate deployments with structured post-deploy checks (`postDeployRead`, `caatinga smoke`).
   - **Stable Logs:** Key automated pipelines on stable `CAATINGA_*` error codes rather than volatile stdout text.


## Table of Contents

- [Core Pillars](#core-pillars)
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
- [CLI reference](./docs/cli.md) · [Cheatsheet](./docs/cheatsheet.md) · [Troubleshooting](./docs/troubleshooting.md)
- [Architecture](./docs/architecture.md) · [ADRs](./docs/adr/index.md)
- [Client](./docs/client.md) · [Wallets](./docs/wallets.md) · [Errors](./docs/errors.md)
- [ROADMAP](./ROADMAP.md)

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

| Package            | Role                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `@caatinga/cli`    | `caatinga` command — init, build, deploy, wire, smoke, regression, ci, generate, status, doctor |
| `@caatinga/core`   | Config, shell orchestration, Stellar CLI adapters, error catalog                                |
| `@caatinga/client` | Browser/Node contract client, wallet adapters, React hooks                                      |
| `@caatinga/zk`     | Circom Groth16 verifier workflow (niche)                                                        |

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
