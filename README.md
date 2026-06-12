<div align="center">

<img src="https://img.shields.io/badge/-CAATINGA-2D7D46?style=for-the-badge&labelColor=1a1a1a" alt="Caatinga" />

### Developer toolkit for Stellar/Soroban dApps

**From Rust contract → typed bindings → wallet-ready client.** TypeScript-first, local-first, low-magic.

[![CI](https://img.shields.io/github/actions/workflow/status/Dione-b/caatinga/ci.yml?branch=main&label=CI&logo=github)](https://github.com/Dione-b/caatinga/actions)
[![npm](https://img.shields.io/npm/v/@caatinga/cli?label=%40caatinga%2Fcli&logo=npm)](https://www.npmjs.com/package/@caatinga/cli?activeTab=versions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#)

[Quick Start](#-quick-start) · [Why Caatinga](#-why-caatinga) · [Docs](#-docs) · [CLI](#-cli-reference)

</div>

---

```bash
npm install -g @caatinga/cli@next
caatinga init my-dapp
```

Caatinga standardizes contract builds, deployments, artifacts, typed bindings, and wallet-ready client integration — without hiding Stellar concepts like `contractId`, RPC URLs, network passphrases, signing identities, or XDR.

> [!WARNING]
> **Alpha software.** APIs and config formats may change before `v1.0.0`. Install from the npm **`next`** dist-tag (`2.2.1` today; `latest` may lag). Pin an exact version in apps and check the [CHANGELOG](./packages/cli/CHANGELOG.md) before upgrading.

<br />

## ✨ Features

|     | Feature | |
| --- | --- | --- |
| 🏗️ | **Scaffold** | Bootstrap a Soroban dApp from checked template manifests |
| 🔨 | **Build** | Compile configured contracts through Stellar CLI |
| 🚀 | **Deploy** | Ship one contract or a full dependency graph — bindings regenerate automatically |
| 🔗 | **Bind** | TypeScript bindings with freshness tracking (stale bindings get flagged, not shipped) |
| 📊 | **Status** | `caatinga status`: deployed contracts + binding freshness per network, `--json` for scripts |
| ⚡ | **Invoke** | Call contract methods straight from the CLI |
| 🌐 | **Connect** | Multi-wallet adapters, persistent wallet sessions, and React hooks via `@caatinga/client` |
| 🩺 | **Diagnose** | Catch setup problems early with `caatinga doctor` |

<br />

## 🌵 Why Caatinga?

Building Soroban dApps means juggling Rust contracts, WASM builds, Stellar CLI identities, deployments, network-specific contract IDs, TypeScript bindings, and frontend wallet integration.

Caatinga connects these steps with a standard project structure and CLI workflow — **without the magic.**

#### How it's different

- **🟦 npm-first, TypeScript toolchain** — ships as npm packages (`@caatinga/cli`, `@caatinga/core`, `@caatinga/client`) for teams who live in JS/TS, not as a Cargo-installed binary.
- **💾 Local state is the source of truth** — deployed contract IDs live in `caatinga.artifacts.json`, per network. No required on-chain or hosted registry.
- **🪄 No Rust macro layer** — Caatinga composes and organizes; it doesn't reimplement the Stellar SDK/CLI or add a custom contract model. Generated bindings stay the primary API.
- **👀 Mental model stays visible** — `contractId`, RPC URL, passphrase, identity, XDR, fees, and simulation remain explicit.
- **🧩 Bring your own scaffolding & frontend** — start from first-party templates; the client focuses on wallet adapters and explicit invoke/XDR, not a fixed full-stack UI.

> Want a Rust-centric workflow with an on-chain registry and a bundled full-stack frontend? Another tool may suit you better. Caatinga is for builders who want a **lightweight, transparent, TypeScript-native** path from contract to wallet-ready client.

<br />

## 🏛️ How it fits together

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

`caatinga status` reads the same artifacts and tells you, per network, what is deployed and whether bindings are still fresh.

<br />

## 📋 Requirements

- **Node.js** 20+
- **[Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)** 23.0.0+ on your `PATH` *(25.2.0 recommended; 22.x unsupported)*
- **Rust** 1.84.0+ with the `wasm32v1-none` target
- A funded local Stellar CLI identity (e.g. `alice`)

```bash
cargo install --locked stellar-cli --version 25.2.0
rustup target add wasm32v1-none
stellar keys generate alice --fund --network testnet
```

<details>
<summary><b>Stellar CLI version policy</b></summary>

<br />

Caatinga hard-fails on Stellar CLI versions below `23.0.0` (`CAATINGA_UNSUPPORTED_CLI_VERSION`).
Versions newer than the last-tested `25.2.0` run with a non-fatal stderr advisory and a `caatinga doctor` warning — no override flag required.
See the [version contract](./docs/stellar-cli-version-contract.md).

</details>

<br />

## 🚀 Quick Start

```bash
caatinga init my-dapp
cd my-dapp
npm install                # or: pnpm install

npx caatinga build  counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga status --network testnet
npm run dev
```

That's it. `deploy` writes the contract ID to `caatinga.artifacts.json` **and generates TypeScript bindings automatically** (pass `--no-generate` to skip). `status` shows what's deployed and whether bindings are fresh. Setup misbehaving? Run `npx caatinga doctor --network testnet --source alice`.

> 💡 No global install? Prefix every command with `npx caatinga`.

📖 **Full walkthrough:** [From Zero to Testnet →](./docs/tutorials/from-zero-to-testnet.md) · **One-pager:** [Cheatsheet →](./docs/cheatsheet.md)

<br />

## 📂 Project Layout

```
my-dapp/
├── caatinga.config.ts        # contracts, WASM paths, networks
├── caatinga.artifacts.json   # deployed contract IDs per network
├── contracts/                # Rust Soroban contracts
│   └── generated/            # TS bindings (auto-generated on deploy)
└── src/                      # frontend/client from the selected template
```

<br />

## ⌨️ CLI Reference

| Command | What it does |
| --- | --- |
| `caatinga init <dir>` | Create a project from a template |
| `caatinga doctor` | Check Node, Stellar CLI, Rust, config, artifacts, network & binding freshness |
| `caatinga build [contract]` | Compile contract WASM *(default: `counter`)* |
| `caatinga deploy [contract]` | Deploy, save `contractId` to artifacts, auto-generate bindings |
| `caatinga generate [contract]` | (Re)generate TS bindings — recovery/CI path, deploy does it for you |
| `caatinga status` | Show deployed contracts + binding freshness per network (`--json` for scripts) |
| `caatinga invoke <contract.method>` | Call a contract method |

**Common flags**

| Flag | Description |
| --- | --- |
| `--source` | Local Stellar CLI identity that can sign (e.g. `alice`). Public `G...` addresses are **not** accepted for signing. |
| `--network` | Network from `caatinga.config.ts` (e.g. `testnet`) |
| `--force` | Redeploy even if artifacts already hold a contract ID |
| `--no-generate` | Skip automatic bindings generation after deploy |

<br />

## 🌐 Browser Client

Use `@caatinga/client` (match your CLI version) with generated bindings, `caatinga.artifacts.json`, and a wallet adapter.
Not locked to Freighter — bring any adapter that implements the wallet contract.
Optional adapters ship for **Freighter** and **Stellar Wallets Kit** (use the latter for multi-wallet support).

```bash
npm install @caatinga/client @caatinga/core
```

```ts
import { createCaatingaClient } from "@caatinga/client";
import { createStellarWalletsKitAdapter } from "@caatinga/client/stellar-wallets-kit";
import * as Counter from "./contracts/generated/counter/src/index.js";
import artifacts from "../caatinga.artifacts.json";

const client = createCaatingaClient({
  network: {
    name: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
  artifacts,
  wallet: createStellarWalletsKitAdapter(),
  contracts: { counter: { binding: Counter } },
});

const before    = await client.contract("counter").read<number>("get");
const increment = await client.contract("counter").invoke<number>("increment");
```

**React apps** get wallet state, persistence, and silent reconnect from the `react` subpath — no hand-rolled context:

```tsx
import { WalletProvider, useWallet } from "@caatinga/client/react";

<WalletProvider adapter={createStellarWalletsKitAdapter()} options={{ persist: true }}>
  <App />
</WalletProvider>;

// anywhere below the provider:
const { publicKey, connected, connecting, connect, disconnect } = useWallet();
```

📖 Adapters, sessions, hooks & custom wallets: [Wallets](./docs/wallets.md) · invoke/XDR flows: [Client docs](./docs/client.md) · [examples/counter-web](./examples/counter-web)

<br />

## 🚦 Error Codes

Public CLI and client errors use stable `CAATINGA_*` codes with actionable fix guidance. Automation may parse the code (but not the prose). See [Errors →](./docs/errors.md)

<br />

## 🗺️ Roadmap

Currently **alpha.** The roadmap prioritizes CLI stability, docs, error contracts, consumer examples, and release automation before v1. See [ROADMAP.md →](./ROADMAP.md)

> The `Release Gate` GitHub Actions workflow validates release readiness (typecheck, docs, build, tests, snapshot packing, publish dry-run, consumer checks). It does **not** publish packages or create releases yet — those steps remain manual.

<br />

## 📚 Docs

Full index: [docs/README.md →](./docs/README.md)

| | |
| --- | --- |
| [Getting started](./docs/getting-started.md) | [From Zero to Testnet](./docs/tutorials/from-zero-to-testnet.md) |
| [Cheatsheet](./docs/cheatsheet.md) | [CLI reference](./docs/cli.md) |
| [Client](./docs/client.md) | [Wallets](./docs/wallets.md) |
| [Config](./docs/config.md) | [Errors](./docs/errors.md) |
| [Release process](./docs/release.md) | [Architecture](./docs/architecture.md) |

<br />

## 🤝 Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md), [Architecture](./docs/architecture.md), and [Testing](./docs/testing.md) before opening a PR. New public behavior should ship with tests and error-path coverage.

```bash
git clone https://github.com/Dione-b/caatinga.git && cd caatinga
pnpm install && pnpm build && pnpm test
pnpm --filter @caatinga/cli dev init my-dapp   # run CLI from source
```

<br />

## 📄 License

[MIT](./LICENSE) © Caatinga contributors

<div align="center">
<br />

**[⬆ Back to top](#)**

</div>
