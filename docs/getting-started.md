# Getting Started

Caatinga alpha supports the CLI path first, then optional browser/client integration through `@caatinga/client`.

## Prerequisites

- Node.js 20+
- pnpm 9+ for repository development
- Rust 1.84.0 or newer with the wasm32v1-none target.
- Stellar CLI
- A local Stellar CLI identity for CLI deploy/invoke, for example `alice`
- Optional: Freighter or another wallet adapter for browser-side `@caatinga/client` calls

```bash
rustc --version
rustup target add wasm32v1-none
stellar --version
```

## From the repository

```bash
pnpm install
pnpm build
pnpm --filter @caatinga/cli dev init my-dapp
```

## Generated app flow

```bash
cd my-dapp
npm install
npx caatinga build counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga generate counter --network testnet
npx caatinga invoke counter.increment --network testnet --source alice
```

Use a local Stellar CLI identity alias for `--source`. Public `G...` addresses, secret keys, and seed phrases are rejected because deploy and invoke need a signer.

## Browser client flow

After `generate`, register the generated bindings with `@caatinga/client`:

```ts
import { createCaatingaClient } from "@caatinga/client";
import { freighterWalletAdapter } from "@caatinga/client/freighter";
import * as Counter from "./contracts/generated/counter";
import artifacts from "../caatinga.artifacts.json";

const client = createCaatingaClient({
  network: {
    name: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015"
  },
  artifacts,
  wallet: freighterWalletAdapter,
  contracts: {
    counter: { binding: Counter }
  }
});

const result = await client.contract("counter").invoke("increment", {
  debugXdr: true
});
```

Use `buildXdr()` when you need unsigned/prepared XDR without wallet signing.

Default local checks:

```bash
pnpm typecheck
pnpm build
pnpm test
```

See [`client.md`](./client.md) for the client contract and debug behavior.
