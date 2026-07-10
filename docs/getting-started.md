# Getting Started

## Prerequisites

- Node.js 22+
- Rust 1.84.0+ with the `wasm32v1-none` target
- Stellar CLI 23.0.0+ (27.0.0 recommended)
- A local Stellar CLI identity for deploy/invoke (e.g. `alice`)
- Optional: Freighter or Stellar Wallets Kit for browser `@caatinga/client` calls

On a fresh machine, run `caatinga setup` to install missing tools and fund a testnet identity:

```bash
npx caatinga setup   # Rust + wasm target + Stellar CLI + funded `alice` on testnet
```

See [`caatinga setup`](./cli.md#caatinga-setup-source-alice-network-testnet-skip-rust-skip-stellar-skip-identity) for flags. To verify an existing environment: `rustc --version`, `rustup target add wasm32v1-none`, `stellar --version`.

## Install

```bash
npm install -g @caatinga/cli
```

Use `npx caatinga` instead of a global install if you prefer. Pin an exact version for reproducible installs — see [Public API](./public-api.md).

From the repository:

```bash
pnpm install && pnpm build
pnpm --filter @caatinga/cli dev init my-dapp
```

## Choose your scaffold

| Guide                                               | Command                                       |
| --------------------------------------------------- | --------------------------------------------- |
| [Template project](./tutorials/template-project.md) | `npx caatinga init my-dapp`                   |
| [Minimal project](./tutorials/minimal-project.md)   | `npx caatinga init my-contract-app --minimal` |
| [ZK project](./tutorials/zk-project.md)             | `npx caatinga zk init my-zk-dapp`             |

See [Choosing a project scaffold](./tutorials/project-scaffolds.md) for a comparison table.

## CLI loop

After `init` and `npm install`:

```bash
npx caatinga doctor --network testnet --source alice
npx caatinga build counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga status --network testnet
npx caatinga read counter.get --network testnet
npx caatinga invoke counter.increment --network testnet --source alice
```

- **`build`** — compiles WASM only
- **`deploy`** — writes `contractId` to `caatinga.artifacts.json` and auto-generates bindings (pass `--no-generate` to skip)
- **`read`** — simulate read-only methods without signing
- **`invoke`** — state-changing calls from the CLI

Use `--source` with a local Stellar CLI identity alias, not a public `G...` address. If bindings generation fails: `npx caatinga generate --network testnet`.

For CI: `caatinga smoke`, `caatinga regression`, or `caatinga ci run`. See [Cheatsheet](./cheatsheet.md).

**Optional walkthrough:** [From Zero to Testnet](./tutorials/from-zero-to-testnet.md) — expected `doctor` output and testnet troubleshooting.

## Browser client

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
