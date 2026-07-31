# Getting Started

## Prerequisites

- Node.js 22+
- Rust 1.84.0+ with the `wasm32v1-none` target
- Stellar CLI 23.0.0+ (27.0.0 recommended)
- A local Stellar CLI identity for deploy/invoke (e.g. `alice`)
- Optional: Freighter or Stellar Wallets Kit for browser `@caatinga/client` calls

On a fresh machine, run `ctg doctor` to check what is missing, then install prerequisites manually:

```bash
npx ctg doctor --network testnet --source alice
```

Manual install: [Rust](https://rustup.rs) + `rustup target add wasm32v1-none`, [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli), and `stellar keys generate alice --fund --network testnet`. To verify: `rustc --version`, `rustup target list --installed`, `stellar --version`.

## Install

```bash
npm install -g @caatinga/cli
ctg --help
ctg --help   # standard command; caatinga is a legacy alias
```

Use `npx ctg` (or `npx caatinga`) instead of a global install if you prefer. Pin an exact version for reproducible installs — see [Public API](./public-api.md).

From the repository:

```bash
pnpm install && pnpm build
pnpm --filter @caatinga/cli dev init my-dapp
```

## Choose your scaffold

**New to Caatinga?** Start with the Template path — it scaffolds a complete dApp with Vite + React, wallet wiring, and a sample `counter` contract ready to build and deploy.

| Guide                                                  | Command                                  | Best for                                        |
| ------------------------------------------------------ | ---------------------------------------- | ----------------------------------------------- |
| [Template project](./tutorials/template-project.md) ⭐ | `npx ctg init my-dapp`                   | First Caatinga dApp — browser UI included       |
| [Minimal project](./tutorials/minimal-project.md)      | `npx ctg init my-contract-app --minimal` | Contract + CLI only; choose your UI stack later |
| [ZK project](./tutorials/zk-project.md)                | `npx ctg zk init my-zk-dapp`             | Groth16 proofs on Soroban                       |

See [Choosing a project scaffold](./tutorials/project-scaffolds.md) for a full comparison.

## CLI loop

This section follows the **Template scaffold** (`npx ctg init my-dapp`), which generates a `counter` contract by default. If you used `--minimal`, your contract is named `app` — replace `counter` with `app` in the commands below.

### 1. Scaffold and install

```bash
npx ctg init my-dapp
cd my-dapp
npm install
```

### 2. Verify the environment

```bash
npx ctg doctor --network testnet --source alice
```

### 3. Build, deploy, and interact

```bash
# Compile the counter contract to WASM
npx ctg build counter

# Deploy to testnet — writes contractId to caatinga.artifacts.json
# and auto-generates TypeScript bindings (pass --no-generate to skip)
npx ctg deploy counter --network testnet --source alice

# Check what is deployed and whether bindings are fresh
npx ctg status --network testnet

# Read a value without signing (simulation)
npx ctg read counter.get --network testnet

# Call a state-changing method (requires signing)
npx ctg invoke counter.increment --network testnet --source alice
```

**Command summary:**

- **`build`** — compiles WASM only
- **`deploy`** — writes `contractId` to `caatinga.artifacts.json` and auto-generates bindings (pass `--no-generate` to skip)
- **`read`** — simulate read-only methods without signing
- **`invoke`** — state-changing calls from the CLI

Use `--source` with a local Stellar CLI identity alias, not a public `G...` address. If bindings generation fails: `npx ctg generate --network testnet`.

For CI: `ctg smoke`, `ctg regression`, or `ctg ci run`. See [Cheatsheet](./cheatsheet.md).

**Optional walkthrough:** [From Zero to Testnet](./tutorials/from-zero-to-testnet.md) — expected `doctor` output and testnet troubleshooting.

## Browser client

**Prerequisites:** complete the CLI loop above — the contract must be deployed and bindings generated before this code runs. If you used the Template scaffold, the `src/caatinga.ts` file already contains this wiring. The snippet below is for reference or custom project setups.

After deploy, install client packages (match the CLI version when possible):

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

await client.contract("counter").read<number>("get");
await client.contract("counter").invoke<number>("increment");
```

See [Client](./client.md) and [Wallets](./wallets.md). React apps can use `WalletProvider` / `useWallet` from `@caatinga/client/react`.
