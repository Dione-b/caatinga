<div align="center">

<img src="https://img.shields.io/badge/-CAATINGA-2D7D46?style=for-the-badge&labelColor=1a1a1a" alt="Caatinga" />

### The TypeScript-native workflow for Soroban

**Scaffold a dApp in 2 minutes. Deploy in 1 command. Connect any wallet in 3 lines. Auto-generate bindings.**

TypeScript-first · local-first · low-magic

[![CI](https://img.shields.io/github/actions/workflow/status/Dione-b/caatinga/ci.yml?branch=main&label=CI&logo=github)](https://github.com/Dione-b/caatinga/actions)
[![npm](https://img.shields.io/npm/v/@caatinga/cli?label=%40caatinga%2Fcli&logo=npm)](https://www.npmjs.com/package/@caatinga/cli?activeTab=versions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#)

[Quick Start](#-quick-start) · [Why Caatinga](#-why-caatinga) · [Docs](#-docs) · [CLI](#-cli-reference)

</div>

---

```bash
npm install -g @caatinga/cli
caatinga init my-dapp
```

Go from a Rust contract to a wallet-ready frontend without juggling WASM, identities, contract IDs, and bindings by hand. Caatinga wires build, deploy, artifacts, typed bindings, and wallet adapters into one workflow — while keeping `contractId`, RPC URLs, network passphrases, signing identities, and XDR explicit (no magic).

> **Caatinga is a workflow layer for Soroban development.** It connects contracts, deployments, bindings, artifacts, and wallets into a single developer experience.

> [!WARNING]
> **Alpha software.** APIs and config formats may change before `v1.0.0`. Current npm **`next`** release: **`2.4.5`** (`latest` remains **`2.4.1`** until promoted). Pin an exact version in apps and check the [CHANGELOG](./packages/cli/CHANGELOG.md) before upgrading.

<br />

## 🧩 The Problem

Building a Soroban application usually means stitching together multiple tools and workflows:

- Rust contracts
- WASM builds
- Stellar CLI deployments
- Contract IDs
- Generated bindings
- Wallet integrations
- Frontend configuration

As projects grow, keeping these pieces synchronized becomes increasingly difficult.

Caatinga provides a unified workflow that keeps contracts, deployments, bindings, artifacts, and wallets aligned — without hiding how Stellar works.

<br />

## ⚖️ Without Caatinga

Build contract → Deploy contract → Track contract ID → Generate bindings → Update frontend → Configure wallet integration → **Repeat for every environment.**

## ✅ With Caatinga

```bash
caatinga deploy counter --network testnet
```

Caatinga updates artifacts, regenerates bindings, validates deployment state, and keeps frontend integrations synchronized.

<br />

## 🌵 Why Caatinga?

Caatinga is designed for teams building real Soroban applications.

Instead of solving a single problem such as deployment, bindings, or wallet integration, Caatinga manages the entire contract lifecycle — from local development to production deployment — and connects these steps with a standard project structure and CLI workflow, **without the magic.**

#### How it's different

- **🟦 npm-first, TypeScript toolchain** — ships as npm packages (`@caatinga/cli`, `@caatinga/core`, `@caatinga/client`, `@caatinga/zk`) for teams who live in JS/TS, not as a Cargo-installed binary.
- **🪄 No Rust macro layer** — Caatinga composes and organizes; it doesn't reimplement the Stellar SDK/CLI or add a custom contract model. Generated bindings stay the primary API.
- **👀 Mental model stays visible** — `contractId`, RPC URL, passphrase, identity, XDR, fees, and simulation remain explicit.
- **🧩 Bring your own scaffolding & frontend** — start from first-party templates; the client focuses on wallet adapters and explicit invoke/XDR, not a fixed full-stack UI.

#### No Hidden Blockchain Magic

Caatinga does not abstract away Stellar.

Contract IDs, RPC endpoints, passphrases, XDR, fees, and simulation remain visible so developers always understand what happens under the hood.

<br />

## 💾 Why no registry?

**Local state is the source of truth.** Deployed contract IDs live in `caatinga.artifacts.json`, committed to your repository, keyed per network. Caatinga deliberately ships **no required central registry**.

A hosted registry would introduce trust, availability, supply-chain, and governance dependencies that are inappropriate for core deploy/operate flows. Instead:

- **No mandatory backend** — Caatinga runs offline against your local artifacts and the Stellar RPC.
- **No hosted registry** — contract IDs travel through git, not a third-party service.
- **No vendor lock-in** — your project stays portable; Caatinga can be removed without losing your deployment history.
- **No exfiltration by default** — deploy metadata stays in your repo, not sent to a Caatinga-owned service.

Optional hosted services (dashboards, metadata indexes) may arrive later, but they will remain **optional** and never a hard dependency of `@caatinga/core` or `@caatinga/cli`. See [ADR 0002](./docs/adr/0002-local-artifacts-as-source-of-truth.md) for the full rationale.

> Want a Rust-centric workflow with an on-chain registry and a bundled full-stack frontend? Another tool may suit you better. Caatinga is for builders who want a **lightweight, transparent, TypeScript-native** path from contract to wallet-ready client.

<br />

## ✨ Features

|     | Feature | |
| --- | --- | --- |
| 🔨 | **Build** | Compile one or all configured contracts through Stellar CLI |
| 🚀 | **Deploy** | Ship one contract or a full dependency graph — bindings regenerate automatically |
| 🔗 | **Bind** | TypeScript bindings with freshness tracking (stale bindings get flagged, not shipped) |
| 📊 | **Status** | `caatinga status`: deployed contracts + binding freshness per network, `--json` for scripts |
| ⚡ | **Invoke** | Call contract methods straight from the CLI (state-changing or read-only) |
| 🌐 | **Connect** | Multi-wallet adapters, persistent wallet sessions, and React hooks via `@caatinga/client` |
| 🔐 | **ZK** | Circom Groth16 workflow (`zk init`, `zk build`, `zk prove`, `zk invoke`) via `@caatinga/zk` |
| 🩺 | **Diagnose** | Catch setup problems early with `caatinga doctor` |
| 🏗️ | **Starter Templates** | Begin from checked template manifests when you need a project skeleton |

<br />

## 📊 Caatinga vs. Stellar CLI

The Stellar CLI is the foundation Caatinga builds on — you keep using it. Caatinga adds the workflow layer that connects build, deploy, bindings, artifacts, and wallets.

| Capability | Stellar CLI | Caatinga |
| --- | --- | --- |
| Contract Build | ✅ | ✅ |
| Contract Deploy | ✅ | ✅ |
| Deployment Artifacts | ❌ | ✅ |
| Typed Bindings Workflow | ⚠️ | ✅ |
| Multi-Contract Deployments | ❌ | ✅ |
| Binding Freshness Tracking | ❌ | ✅ |
| Wallet Integration Layer | ❌ | ✅ |
| React Hooks | ❌ | ✅ |
| Multi-Wallet Support | ❌ | ✅ |
| Project Diagnostics | ❌ | ✅ |
| ZK Workflow | ❌ | ✅ |

<br />

## 🔐 Zero-Knowledge Ready

Caatinga includes an integrated Circom/Groth16 workflow, so you can build privacy-preserving applications without maintaining a separate toolchain.

```bash
caatinga zk init      # scaffold a verifier contract + circuit
caatinga zk build     # compile Circom, run dev trusted setup
caatinga zk prove     # generate proof.json + public.json
caatinga zk invoke --source alice    # serialize the proof and call verify_proof on-chain
```

This functionality ships through `@caatinga/zk`. See the [ZK docs](./docs/zk.md) and the [zk-starter template](./docs/tutorials/zk-project.md) for a working multiplier + verifier walkthrough.

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

- **Node.js** 22+
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
npx caatinga@next init my-dapp
cd my-dapp
npm install                # or: pnpm install — template ships overrides for a clean wallet SDK tree

npx caatinga@next build  counter
npx caatinga@next deploy counter --network testnet --source alice
npx caatinga@next status --network testnet
npm run dev
```

That's it. `deploy` writes the contract ID to `caatinga.artifacts.json` **and generates TypeScript bindings automatically** (pass `--no-generate` to skip). `status` shows what's deployed and whether bindings are fresh. Setup misbehaving? Run `npx caatinga doctor --network testnet --source alice`.

> 💡 The current release ships on the **`next`** dist-tag (`2.4.5`); `latest` lags behind at `2.4.1` until promoted. Use `npx caatinga@next` (or pin an exact version like `npx caatinga@2.4.5`) to get the newest release.

📖 **Choose your scaffold:** [Project scaffolds →](./docs/tutorials/project-scaffolds.md) · **Full walkthrough:** [From Zero to Testnet →](./docs/tutorials/from-zero-to-testnet.md) · **One-pager:** [Cheatsheet →](./docs/cheatsheet.md)

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

## 🌱 Built For Growing Projects

Caatinga was designed for applications that evolve beyond a single contract.

Features such as:

- dependency-aware deployments
- deployment artifacts
- binding freshness validation
- multi-network support
- wallet abstraction

help teams maintain consistency across development, staging, and production environments.

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
| `caatinga invoke <contract.method>` | Call a state-changing contract method |
| `caatinga read <contract.method>` | Simulate a read-only contract method (no signing) |

**Common flags**

| Flag | Description |
| --- | --- |
| `--source` | Local Stellar CLI identity that can sign (e.g. `alice`). Public `G...` addresses are **not** accepted for signing. |
| `--network` | Network from `caatinga.config.ts` (e.g. `testnet`) |
| `--force` | Redeploy even if artifacts already hold a contract ID |
| `--no-generate` | Skip automatic bindings generation after deploy |
| `--no-deps` | Deploy a single contract without its `dependsOn` graph |
| `--verify-deps` | Confirm dependency contract IDs exist on-chain first |
| `--no-stale-check` | Skip the WASM-older-than-sources warning |

<br />

## 🌐 Browser Client

Use `@caatinga/client` (match your CLI version) with generated bindings, `caatinga.artifacts.json`, and a wallet adapter.
Not locked to Freighter — bring any adapter that implements the wallet contract.
Optional adapters ship for **Freighter** and **Stellar Wallets Kit** (use the latter for multi-wallet support).

```bash
npm install @caatinga/client @caatinga/core @creit.tech/stellar-wallets-kit
```

```ts
import { createCaatingaClient } from "@caatinga/client";
import { createStellarWalletsKitAdapter } from "@caatinga/client/stellar-wallets-kit";
import * as Counter from "./contracts/generated/counter";
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
const { publicKey, connected, connecting, connect, disconnect, session } = useWallet();
```

Vite apps using Stellar Wallets Kit get bundler workarounds from `@caatinga/client/vite` (`walletStubViteAliases`, `walletStubOverrides`, `walletStubPnpmWorkspaceYaml`) — see [Wallets](./docs/wallets.md#stellar-wallets-kit-bundler-workarounds).

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
| [Getting started](./docs/getting-started.md) | [Choosing a project scaffold](./docs/tutorials/project-scaffolds.md) |
| [Template project](./docs/tutorials/template-project.md) | [Minimal project](./docs/tutorials/minimal-project.md) |
| [ZK project](./docs/tutorials/zk-project.md) | [From Zero to Testnet](./docs/tutorials/from-zero-to-testnet.md) |
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

## 🧭 Philosophy

Caatinga complements the Stellar ecosystem.

Use the official SDK. Use Stellar CLI. Use your preferred wallet.

Caatinga focuses on the workflow that connects these tools together.

<br />

## 📄 License

[MIT](./LICENSE) © Caatinga contributors

<div align="center">
<br />

**[⬆ Back to top](#)**

</div>
