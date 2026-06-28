# Counter Example

This directory is a placeholder. The counter example is generated from the bundled `react-vite-counter` template via `caatinga init`.

## Generate

```bash
caatinga init counter --template react-vite-counter
cd counter
npm install
```

## Workflow

```bash
# 1. Build the Soroban counter contract
caatinga build counter

# 2. Deploy to testnet (requires a Stellar CLI identity)
caatinga deploy counter --network testnet --source <identity>

# 3. Generate TypeScript bindings from the deployed contract
caatinga generate counter --network testnet

# 4. Invoke the increment method
caatinga invoke counter.increment --network testnet --source <identity>
```

`--source` must be a local Stellar CLI identity that can sign, for example `alice`; public `G...` addresses are rejected for deploy/invoke.

## Browser Client

After running `caatinga generate`, wire the generated bindings with `@caatinga/client`:

```ts
import { createCaatingaClient } from "@caatinga/client";
import { freighterWalletAdapter } from "@caatinga/client/freighter";
import * as Counter from "./contracts/generated/counter";
import artifacts from "../caatinga.artifacts.json";

const client = createCaatingaClient({
  network: {
    name: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
  artifacts,
  wallet: freighterWalletAdapter,
  contracts: {
    counter: { binding: Counter },
  },
});

await client.contract("counter").invoke("increment");
```

## Requirements

- Node.js ≥ 22
- Rust 1.84.0 or newer with the `wasm32v1-none` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) `>=23.0.0` and `<=27.0.0`
- A Stellar CLI identity for deploy/invoke operations
