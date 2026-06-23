<div align="center">

<img src="https://img.shields.io/badge/-CAATINGA-2D7D46?style=for-the-badge&labelColor=1a1a1a" alt="Caatinga" />

### Git-versioned Soroban deploy artifacts + multi-contract orchestration

**From `init` to wallet-ready browser client in one afternoon — without a hosted registry or hidden Stellar primitives.**

git-driven · multi-contract · npm-first · TypeScript-native

[![CI](https://img.shields.io/github/actions/workflow/status/Dione-b/caatinga/ci.yml?branch=main&label=CI&logo=github)](https://github.com/Dione-b/caatinga/actions)
[![npm](https://img.shields.io/npm/v/@caatinga/cli?label=%40caatinga%2Fcli&logo=npm)](https://www.npmjs.com/package/@caatinga/cli?activeTab=versions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Status: Alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#)

[Quick Start](#-quick-start) · [When it pays off](#-when-caatinga-pays-off) · [Docs](#-docs) · [CLI](#-cli-reference)

</div>

---

```bash
npm install -g @caatinga/cli
caatinga init my-dapp
```

TypeScript teams building on Soroban still wire Stellar CLI, bindings, and wallet integration by hand — and lose track of contract IDs across networks and teammates.

Caatinga keeps **deploy artifacts in git** (`caatinga.artifacts.json`), orchestrates **multi-contract deploy graphs**, and ships a **wallet-ready client** — without a mandatory registry or hidden Stellar primitives.

> **One-line promise:** version-controlled deployment artifacts + reproducible contract-to-browser workflow for teams that want sovereignty over their Soroban stack.

> [!WARNING]
> **Alpha software (pre-1.0 development line).** The `3.x` npm major does **not** imply API stability — formats may change before `v1.0.0`.
> Install with `npx caatinga@next` or pin an exact version; see the [CHANGELOG](./packages/cli/CHANGELOG.md).

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

> Want a Rust-centric workflow with an on-chain registry and a bundled full-stack frontend? Another tool may suit you better. Caatinga is for builders who want a **lightweight, transparent, TypeScript-native** path from contract to single-invoker wallet-ready client.

<br />

## 🌐 End-to-end browser client

`@stellar/stellar-sdk` v16 brought Protocol 27 helpers for delegated authentication — but wiring **simulation, log extraction, and wallet signing** into a coherent browser flow still generates boilerplate.

`@caatinga/client` closes that gap: generated bindings + `caatinga.artifacts.json` + network config + a pluggable wallet adapter, with `read`, `simulate`, `invoke`, and `buildXdr` for **single-invoker** flows.

React apps get `WalletProvider` / `useWallet`; Vite apps get bundler workarounds for Stellar Wallets Kit.

**Browser wallet support is single-invoker only until v1.0.** Contracts requiring delegated AddressV2 / non-invoker `signAuthEntry` credentials will fail with `CAATINGA_MULTI_AUTH_REQUIRED`; orchestration is application code today.

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

## 🎯 When Caatinga pays off

- **2+ contracts** with deploy dependencies (`dependsOn`, topological deploy order)
- **Multiple networks** (testnet, futurenet) tracked in git — not in a spreadsheet
- **Small TypeScript team** shipping a browser dApp without hand-parsing CLI stdout
- **CI/CD** that needs stable `CAATINGA_*` error codes and artifact-driven automation

## ⚖️ Without Caatinga

Build contract → Deploy contract → Track contract ID manually → Generate bindings → Update frontend imports → Configure wallet integration → **Repeat for every environment and every teammate.**

## ✅ With Caatinga

```bash
caatinga deploy counter --network testnet --source alice
```

Artifacts update in git, bindings regenerate, deployment state validates, and frontend integrations stay synchronized.

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

> 💡 Use `npx caatinga@next` or pin an exact version for reproducible installs.

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

| Command                               | What it does                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `caatinga init <dir>`                 | Create a project from a template                                               |
| `caatinga doctor`                     | Check Node, Stellar CLI, Rust, config, artifacts, network & binding freshness  |
| `caatinga build [contract]`           | Compile contract WASM _(default: `counter`)_                                   |
| `caatinga deploy [contract]`          | Deploy, save `contractId` to artifacts, auto-generate bindings                 |
| `caatinga generate [contract]`        | (Re)generate TS bindings — recovery/CI path, deploy does it for you            |
| `caatinga status`                     | Show deployed contracts + binding freshness per network (`--json` for scripts) |
| `caatinga invoke <contract.method>`   | Call a state-changing contract method                                          |
| `caatinga read <contract.method>`     | Simulate a read-only contract method (no signing)                              |
| `caatinga estimate deploy <contract>` | Estimate deploy fees (advisory)                                                |
| `caatinga inspect <contract>`         | Compare artifact state vs on-chain reachability and local WASM                 |
| `caatinga migrate artifacts`          | Upgrade `caatinga.artifacts.json` to schema v2                                 |
| `caatinga rollback <contract>`        | Restore a prior contract ID in artifacts (logical rollback)                    |

**Common flags**

| Flag               | Description                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `--source`         | Local Stellar CLI identity that can sign (e.g. `alice`). Public `G...` addresses are **not** accepted for signing.          |
| `--network`        | Network from `caatinga.config.ts` (e.g. `testnet`)                                                                          |
| `--force`          | Redeploy even if artifacts already hold a contract ID                                                                       |
| `--no-generate`    | Skip automatic bindings generation after deploy                                                                             |
| `--no-deps`        | Deploy a single contract without its `dependsOn` graph                                                                      |
| `--verify-deps`    | Confirm dependency contract IDs exist on-chain first                                                                        |
| `--no-stale-check` | Skip the WASM-older-than-sources warning                                                                                    |
| `--upgrade`        | Semantic alias for `--force` — redeploy with upgrade history (see [contract upgrade](./docs/tutorials/contract-upgrade.md)) |
| `--dry-run`        | Estimate deploy cost without submitting (alias for `caatinga estimate deploy`)                                              |

<br />

## 🔐 Advanced: ZK workflow

Zero-knowledge proofs on Soroban are a **niche** workflow — not required for most dApps. **`@caatinga/zk`** bundles Circom, Groth16 (BLS12-381, Protocol 25+), and a Soroban verifier contract in one CLI workflow.

**`caatinga zk build` runs a single-party development ceremony** suitable for testnet/dev only. Production requires an external MPC ceremony; mainnet deploy/invoke with dev artifacts is blocked by default (`CAATINGA_ZK_DEV_CEREMONY_BLOCKED`). `--embed-vk` is experimental and not end-to-end yet.

```bash
caatinga zk init      # scaffold a verifier contract + circuit
caatinga zk build     # compile Circom, run dev trusted setup
caatinga zk prove     # generate proof.json + public.json
caatinga zk invoke --source alice    # serialize the proof and call verify_proof on-chain
```

See the [ZK docs](./docs/zk.md) and the [zk-starter template](./docs/tutorials/zk-project.md) for a working multiplier + verifier walkthrough.

<br />

## 🚦 Error Codes

Public CLI and client errors use stable `CAATINGA_*` codes with actionable fix guidance. Automation may parse the code (but not the prose). See [Errors →](./docs/errors.md)

<br />

## 🗺️ Roadmap

Currently **alpha.** The roadmap prioritizes CLI stability, docs, error contracts, consumer examples, and release automation before v1. See [ROADMAP.md →](./ROADMAP.md)

> The `Release Gate` GitHub Actions workflow validates release readiness (typecheck, docs, build, tests, snapshot packing, publish dry-run, consumer checks). It does **not** publish packages or create releases yet — those steps remain manual.

<br />

## 📚 Docs

**Docs site:** [dione-b.github.io/caatinga](https://dione-b.github.io/caatinga/) · Repository index: [docs/README.md →](./docs/README.md)

|                                                               |                                                                      |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| [Getting started](./docs/getting-started.md)                  | [Choosing a project scaffold](./docs/tutorials/project-scaffolds.md) |
| [Template project](./docs/tutorials/template-project.md)      | [Minimal project](./docs/tutorials/minimal-project.md)               |
| [ZK project](./docs/tutorials/zk-project.md)                  | [From Zero to Testnet](./docs/tutorials/from-zero-to-testnet.md)     |
| [Cheatsheet](./docs/cheatsheet.md)                            | [CLI reference](./docs/cli.md)                                       |
| [Client](./docs/client.md)                                    | [Wallets](./docs/wallets.md)                                         |
| [Config](./docs/config.md)                                    | [Errors](./docs/errors.md)                                           |
| [Release process](./docs/internal/release.md)                 | [Architecture](./docs/architecture.md)                               |
| [Signing strategy](./docs/signing-strategy.md)                | [Production readiness](./docs/production-readiness.md)               |
| [Case study: counter-web](./docs/case-studies/counter-web.md) | [Contract upgrade](./docs/tutorials/contract-upgrade.md)             |

<br />

## 🤝 Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md), [Architecture](./docs/architecture.md), and [Testing](./docs/internal/testing.md) before opening a PR. New public behavior should ship with tests and error-path coverage.

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
