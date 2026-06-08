# __PROJECT_NAME__

Caatinga counter dApp for Stellar/Soroban.

## CLI Flow

```bash
npm install          # or: pnpm install
npx caatinga build counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga generate counter --network testnet
npx caatinga invoke counter.increment --network testnet --source alice
npm run dev          # or: pnpm dev
```

Run `build` before `deploy` (WASM required) and `deploy` before `generate` (contract ID required).

Use a local Stellar CLI identity alias for `--source`; public `G...` addresses, seed phrases, and secret keys are rejected for signing operations.

## Package managers

Templates default to npm, but pnpm 10.26+/11.x is supported via the shipped `pnpm-workspace.yaml` (`allowBuilds.esbuild: true`, `blockExoticSubdeps: false`).

Package scripts wrap the CLI:

```bash
npm run caatinga:build
npm run caatinga:deploy -- --network testnet --source alice
npm run caatinga:generate -- --network testnet
```

With pnpm, use `pnpm run caatinga:build` (and the same pattern for deploy/generate). `npx caatinga build counter` works without going through the package manager.

## Client Smoke Path

After `caatinga generate`, wire generated bindings to the client:

```ts
import { createCaatingaClient } from "@caatinga/client";
import { createStellarWalletsKitAdapter } from "@caatinga/client/stellar-wallets-kit";
import * as Counter from "./contracts/generated/counter";
import artifacts from "../caatinga.artifacts.json";

const wallet = createStellarWalletsKitAdapter();

export const caatingaClient = createCaatingaClient({
  network: {
    name: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015"
  },
  artifacts,
  wallet,
  contracts: {
    counter: {
      binding: Counter
    }
  }
});
```

Build XDR without wallet signing:

```ts
const tx = await caatingaClient.contract("counter").buildXdr("increment");
console.log(tx.preparedXdr);
```

Read the on-chain counter through simulation:

```ts
const count = await caatingaClient.contract("counter").read<number>("get");
console.log(count);
```

Invoke through a connected wallet:

```ts
const result = await caatingaClient.contract("counter").invoke("increment", {
  debugXdr: true
});
console.log(result.transactionHash);
```
