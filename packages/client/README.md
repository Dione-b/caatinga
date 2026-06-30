# @caatinga/client

Browser and Node integration layer for generated Soroban bindings, `caatinga.artifacts.json`, network config, and wallet adapters.

## Install

```bash
npm install @caatinga/client @caatinga/core
```

Optional wallet adapters:

```bash
npm install @stellar/freighter-api                    # Freighter
npm install @creit.tech/stellar-wallets-kit         # Stellar Wallets Kit
```

## Example

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

const value = await client.contract("counter").read<number>("get");
const result = await client.contract("counter").invoke<number>("increment");
```

React apps: `WalletProvider` and `useWallet` from `@caatinga/client/react`.

## Documentation

- [Client API](https://github.com/Dione-b/caatinga/blob/main/docs/client.md)
- [Wallets and adapters](https://github.com/Dione-b/caatinga/blob/main/docs/wallets.md)
- [Errors](https://github.com/Dione-b/caatinga/blob/main/docs/errors.md)

Single-invoker browser flows only until v1.0 — see [Client scope](https://github.com/Dione-b/caatinga/blob/main/docs/client.md#single-invoker-scope-until-v10).
