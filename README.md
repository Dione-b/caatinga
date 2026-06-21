<div align="center">

<img src="https://img.shields.io/badge/-CAATINGA-2D7D46?style=for-the-badge&labelColor=1a1a1a" alt="Caatinga" />

### The Hardhat of Soroban

**A TypeScript-native maestro that unifies Stellar's official tools into one predictable workflow.**

npm-first · git-driven · orchestrates `@stellar/stellar-sdk` · ZK-ready

[![CI](https://img.shields.io/github/actions/workflow/status/Dione-b/caatinga/ci.yml?branch=main&label=CI&logo=github)](https://github.com/Dione-b/caatinga/actions)
[![npm](https://img.shields.io/npm/v/@caatinga/cli?label=%40caatinga%2Fcli&logo=npm)](https://www.npmjs.com/package/@caatinga/cli?activeTab=versions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#)

[Quick Start](#-quick-start) · [Why Caatinga](#-the-problem) · [Docs](#-docs) · [CLI](#-cli-reference)

</div>

---

```bash
npm install -g @caatinga/cli
caatinga init my-dapp
```

The Stellar ecosystem ships powerful official pieces — Stellar CLI, `@stellar/stellar-sdk`, generated bindings — but TypeScript teams still had to wire them together by hand. Caatinga is the **workflow layer** that keeps a predictable path from contract to wallet-ready client: **init → build → deploy → generate → invoke → browser** — even when upstream tooling changes flags, stdout, or paths.

Caatinga does not reimplement Soroban. It composes the official stack and keeps the mental model visible: `contractId`, RPC URLs, network passphrases, signing identities, and XDR stay explicit (no magic).

> **One-line promise:** a reproducible workflow to create, compile, deploy, generate bindings, invoke, and wire browser clients for Soroban contracts — without hiding how Stellar works.

> [!WARNING]
> **Alpha software.** APIs and config formats may change before `v1.0.0`. Current npm **`latest`** release: **`3.1.2`**. Pin an exact version in apps and check the [CHANGELOG](./packages/cli/CHANGELOG.md) before upgrading.

<br />

## 🧩 The Problem

Building a Soroban application means stitching together **official SDF tools** that were never designed as a single TypeScript lifecycle:

- Rust contracts and WASM builds via Stellar CLI
- Deployments and contract IDs tracked out-of-band
- Bindings generated in isolation from deploy state
- Wallet integration and frontend wiring bolted on afterward

As projects grow — multiple contracts, multiple networks, CI pipelines — keeping these pieces synchronized becomes the real tax. Caatinga exists to **orchestrate** that lifecycle, not replace the tools underneath.

<br />

## 🎼 Orchestrates the official stack

You don't compete with the SDF; you conduct its orchestra.

- **`caatinga generate`** runs `npx @stellar/stellar-sdk generate` — the official JS binding generator, aligned with protocol releases instead of a forked pipeline.
- **Templates ship `@stellar/stellar-sdk ^16.0.1`** (Protocol 27, ESM-first).
- **Build, deploy, and invoke** still shell out to Stellar CLI — Caatinga absorbs flag and stdout drift in `@caatinga/core` adapters so your scripts don't break on every CLI bump.

Caatinga composes and organizes; it does not add a Rust macro layer or a custom contract model. Generated bindings stay the primary API.

<br />

## 💾 Git-driven by design

**Local state is the source of truth.** Deployed contract IDs live in `caatinga.artifacts.json`, committed to your repository, keyed per network. Caatinga deliberately ships **no required central registry**.

That matters for teams that want **full sovereignty** and **clean CI/CD**: deploy metadata travels through git, not a third-party service or mandatory on-chain registry.

- **No mandatory backend** — Caatinga runs offline against your local artifacts and the Stellar RPC.
- **No hosted registry** — contract IDs are version-controlled alongside your code.
- **No vendor lock-in** — your project stays portable; Caatinga can be removed without losing deployment history.
- **No exfiltration by default** — deploy metadata stays in your repo, not sent to a Caatinga-owned service.

Optional hosted services (dashboards, metadata indexes) may arrive later, but they will remain **optional** and never a hard dependency of `@caatinga/core` or `@caatinga/cli`. See [ADR 0002](./docs/adr/0002-local-artifacts-as-source-of-truth.md) for the full rationale.

> Want a Rust-centric workflow with an on-chain registry and a bundled full-stack frontend? Another tool may suit you better. Caatinga is for builders who want a **lightweight, transparent, TypeScript-native** path from contract to wallet-ready client.

<br />

## 🔐 Built-in ZK workflow

Zero-knowledge proofs on Soroban are still hard to bootstrap. **`@caatinga/zk`** is Caatinga's deepest differentiator for advanced teams — Circom, Groth16 (BLS12-381, Protocol 25+), and a Soroban verifier contract in one CLI workflow, without maintaining a separate toolchain.

```bash
caatinga zk init      # scaffold a verifier contract + circuit
caatinga zk build     # compile Circom, run dev trusted setup
caatinga zk prove     # generate proof.json + public.json
caatinga zk invoke --source alice    # serialize the proof and call verify_proof on-chain
```

See the [ZK docs](./docs/zk.md) and the [zk-starter template](./docs/tutorials/zk-project.md) for a working multiplier + verifier walkthrough.

<br />

## 🌐 End-to-end browser client

`@stellar/stellar-sdk` v16 brought Protocol 27 helpers for delegated authentication — but wiring **simulation, log extraction, and wallet signing** into a coherent browser flow still generates boilerplate.

`@caatinga/client` closes that gap: generated bindings + `caatinga.artifacts.json` + network config + a pluggable wallet adapter, with `read`, `simulate`, `invoke`, and `buildXdr` out of the box. React apps get `WalletProvider` / `useWallet`; Vite apps get bundler workarounds for Stellar Wallets Kit.

Multi-signer flows that require non-invoker `signAuthEntry` credentials still need application code today — Caatinga surfaces `CAATINGA_MULTI_AUTH_REQUIRED` when that happens.

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

const before = await client.contract("counter").read<number>("get");
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

Not locked to Freighter — optional adapters ship for **Freighter** and **Stellar Wallets Kit**. Vite apps get bundler workarounds from `@caatinga/client/vite` — see [Wallets](./docs/wallets.md#stellar-wallets-kit-bundler-workarounds).

📖 Adapters, sessions, hooks & custom wallets: [Wallets](./docs/wallets.md) · invoke/XDR flows: [Client docs](./docs/client.md) · [examples/counter-web](./examples/counter-web)

<br />

## 📊 Binding freshness

The official CLI generates bindings in isolation — it has no opinion about whether your TypeScript still matches the Rust you changed five minutes ago.

Caatinga tracks that gap:

- **`.caatinga-bindings.json` sidecar markers** written next to each generated binding package.
- **`caatinga status`** and **`caatinga doctor`** report per-network deploy state and per-contract binding freshness.
- **Stale bindings get flagged before you ship** — not silently deployed with outdated types.
- **`--json` output** on `status` for CI scripts and automation.

<br />

## ⚖️ Without Caatinga

Build contract → Deploy contract → Track contract ID → Generate bindings → Update frontend → Configure wallet integration → **Repeat for every environment.**

## ✅ With Caatinga

```bash
caatinga deploy counter --network testnet
```

Caatinga updates artifacts, regenerates bindings, validates deployment state, and keeps frontend integrations synchronized.

<br />

## ✨ Features

|     | Feature               |                                                                                  |
| --- | --------------------- | -------------------------------------------------------------------------------- |
| 🔨  | **Build**             | Compile one or all configured contracts through Stellar CLI                      |
| 🚀  | **Deploy**            | Ship one contract or a full dependency graph — bindings regenerate automatically |
| ⚡  | **Invoke / Read**     | Call contract methods from the CLI (state-changing or read-only simulation)      |
| 🩺  | **Diagnose**          | Catch setup problems early with `caatinga doctor`                                |
| 🏗️  | **Starter Templates** | Begin from checked template manifests when you need a project skeleton           |

<br />

## 🏗️ Built on Stellar CLI

The Stellar CLI is the foundation — you keep using it. Caatinga adds the workflow layer on top.

| Capability                 | Stellar CLI | Caatinga |
| -------------------------- | ----------- | -------- |
| Contract Build             | ✅          | ✅       |
| Contract Deploy            | ✅          | ✅       |
| Deployment Artifacts       | ❌          | ✅       |
| Typed Bindings Workflow    | ⚠️          | ✅       |
| Multi-Contract Deployments | ❌          | ✅       |
| Binding Freshness Tracking | ❌          | ✅       |
| Wallet Integration Layer   | ❌          | ✅       |
| React Hooks                | ❌          | ✅       |
| Multi-Wallet Support       | ❌          | ✅       |
| Project Diagnostics        | ❌          | ✅       |
| ZK Workflow                | ❌          | ✅       |

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
- **[Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)** 23.0.0+ on your `PATH` _(25.2.0 recommended; 22.x unsupported)_
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
npx caatinga init my-dapp
cd my-dapp
npm install                # or: pnpm install — template ships overrides for a clean wallet SDK tree

npx caatinga build  counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga status --network testnet
npm run dev
```

That's it. `deploy` writes the contract ID to `caatinga.artifacts.json` **and generates TypeScript bindings automatically** (pass `--no-generate` to skip). `status` shows what's deployed and whether bindings are fresh. Setup misbehaving? Run `npx caatinga doctor --network testnet --source alice`.

> 💡 The current release is **`3.1.2`** on npm **`latest`**. Use `npx caatinga` (or pin `npx caatinga@3.1.2`) for reproducible installs.

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

## ⌨️ CLI Reference

| Command                             | What it does                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `caatinga init <dir>`               | Create a project from a template                                               |
| `caatinga doctor`                   | Check Node, Stellar CLI, Rust, config, artifacts, network & binding freshness  |
| `caatinga build [contract]`         | Compile contract WASM _(default: `counter`)_                                   |
| `caatinga deploy [contract]`        | Deploy, save `contractId` to artifacts, auto-generate bindings                 |
| `caatinga generate [contract]`      | (Re)generate TS bindings — recovery/CI path, deploy does it for you            |
| `caatinga status`                   | Show deployed contracts + binding freshness per network (`--json` for scripts) |
| `caatinga invoke <contract.method>` | Call a state-changing contract method                                          |
| `caatinga read <contract.method>`   | Simulate a read-only contract method (no signing)                              |

**Common flags**

| Flag               | Description                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `--source`         | Local Stellar CLI identity that can sign (e.g. `alice`). Public `G...` addresses are **not** accepted for signing. |
| `--network`        | Network from `caatinga.config.ts` (e.g. `testnet`)                                                                 |
| `--force`          | Redeploy even if artifacts already hold a contract ID                                                              |
| `--no-generate`    | Skip automatic bindings generation after deploy                                                                    |
| `--no-deps`        | Deploy a single contract without its `dependsOn` graph                                                             |
| `--verify-deps`    | Confirm dependency contract IDs exist on-chain first                                                               |
| `--no-stale-check` | Skip the WASM-older-than-sources warning                                                                           |

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

|                                                          |                                                                      |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| [Getting started](./docs/getting-started.md)             | [Choosing a project scaffold](./docs/tutorials/project-scaffolds.md) |
| [Template project](./docs/tutorials/template-project.md) | [Minimal project](./docs/tutorials/minimal-project.md)               |
| [ZK project](./docs/tutorials/zk-project.md)             | [From Zero to Testnet](./docs/tutorials/from-zero-to-testnet.md)     |
| [Cheatsheet](./docs/cheatsheet.md)                       | [CLI reference](./docs/cli.md)                                       |
| [Client](./docs/client.md)                               | [Wallets](./docs/wallets.md)                                         |
| [Config](./docs/config.md)                               | [Errors](./docs/errors.md)                                           |
| [Release process](./docs/release.md)                     | [Architecture](./docs/architecture.md)                               |

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

Use the official SDK. Use Stellar CLI. Use your preferred wallet. Caatinga connects them.

<br />

## 📄 License

[MIT](./LICENSE) © Caatinga contributors

<div align="center">
<br />

**[⬆ Back to top](#)**

</div>
