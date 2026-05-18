# __PROJECT_NAME__

Caatinga counter dApp for Stellar/Soroban.

## CLI Flow

```bash
npm install
npx caatinga build counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga generate counter --network testnet
npx caatinga invoke counter.increment --network testnet --source alice
npm run dev
```

Use a local Stellar CLI identity alias for `--source`; public `G...` addresses, seed phrases, and secret keys are rejected for signing operations.

## Client Smoke Path

After `caatinga generate`, wire generated bindings to the client:

```ts
import { createCaatingaClient } from "@caatinga/client";
import { freighterWalletAdapter } from "@caatinga/client/freighter";
import * as Counter from "./contracts/generated/counter";
import artifacts from "../caatinga.artifacts.json";

export const caatingaClient = createCaatingaClient({
  network: {
    name: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015"
  },
  artifacts,
  wallet: freighterWalletAdapter,
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

Invoke through Freighter:

```ts
const result = await caatingaClient.contract("counter").invoke("increment", {
  debugXdr: true
});
console.log(result.transactionHash);
```
