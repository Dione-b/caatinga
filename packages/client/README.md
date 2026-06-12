# @caatinga/client

## Install

```bash
pnpm add @caatinga/client
```

If you are using Freighter, add the optional adapter dependency:

```bash
pnpm add @stellar/freighter-api
```

```ts
import { createCaatingaClient } from "@caatinga/client";
import { freighterWalletAdapter } from "@caatinga/client/freighter";
```

The `@caatinga/client/freighter` subpath is optional and only needed when you want the bundled Freighter adapter.

For multi-wallet support, add Stellar Wallets Kit:

```bash
pnpm add @creit.tech/stellar-wallets-kit
```

```ts
import { createStellarWalletsKitAdapter } from "@caatinga/client/stellar-wallets-kit";
```

## What It Solves

`@caatinga/client` is the supported browser and Node integration layer for invoking generated Soroban bindings with Caatinga artifacts, network configuration, and a wallet adapter.

It connects:

- generated contract bindings
- `caatinga.artifacts.json`
- RPC URL and network passphrase
- wallet-backed signing for invocation and XDR preparation flows

## Supported Surface

Supported runtime root exports:

- `createCaatingaClient`
- `resolveContractId`
- `createDefaultBindingAdapter`
- `CaatingaContractClient`
- `buildXdr`
- `createWalletSession`
- `WALLET_SESSION_STORAGE_KEY`

Supported type-only root exports:

- `CaatingaBindingAdapter`
- `CaatingaClientConfig`
- `CaatingaContractRegistration`
- `CaatingaInvokeOptions`
- `CaatingaInvokeResult`
- `CaatingaInvokeStatus`
- `CaatingaNetwork`
- `CaatingaReadOptions`
- `CaatingaReadResult`
- `CaatingaWalletAdapter`
- `CaatingaWalletCapabilities`
- `CaatingaXdrBuildResult`
- `WalletSession`, `WalletSessionOptions`, `WalletSessionState`, `WalletSessionStatus`, `WalletSessionStorage`

Supported subpath exports:

- `@caatinga/client/freighter` -> `freighterWalletAdapter` (optional)
- `@caatinga/client/stellar-wallets-kit` -> `createStellarWalletsKitAdapter` (optional)
- `@caatinga/client/react` -> `WalletProvider`, `useWallet`, `useWalletSession` (optional, needs `react >= 18`)

Primary flow:

- `createCaatingaClient(...)`
- `client.contract(name).read(method, args?)`
- `client.contract(name).simulate(method, args?)`
- `client.contract(name).invoke(method, args?)`
- `client.contract(name).buildXdr(method, args?)`

## Counter Example

```ts
import { createCaatingaClient } from "@caatinga/client";
import { createStellarWalletsKitAdapter } from "@caatinga/client/stellar-wallets-kit";
import * as Counter from "./contracts/generated/counter/src/index.js";
import artifacts from "../caatinga.artifacts.json";

const wallet = createStellarWalletsKitAdapter();

const client = createCaatingaClient({
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

const before = await client.contract("counter").read<number>("get");
const increment = await client.contract("counter").invoke<number>("increment");
const after = increment.result ?? await client.contract("counter").read<number>("get");
```

## Wallet Adapter Contract

```ts
export interface CaatingaWalletAdapter {
  getPublicKey(): Promise<string>;

  signTransaction(input: {
    xdr: string;
    networkPassphrase: string;
  }): Promise<string>;
}
```

The default Freighter adapter is exported from `@caatinga/client/freighter`.

## Wallet Session and React Hooks

Wrap any adapter with connection state, persistence, and silent restore:

```ts
import { createWalletSession } from "@caatinga/client";

const session = createWalletSession(wallet, { persist: true });
await session.connect();   // modal when available, else getPublicKey()
await session.restore();   // silent reconnect on page load — never throws
session.subscribe(() => console.log(session.getState()));
```

React apps (optional `react >= 18` peer) use the `react` subpath instead of a hand-rolled context:

```tsx
import { WalletProvider, useWallet } from "@caatinga/client/react";

<WalletProvider adapter={wallet} options={{ persist: true }}>
  <App />
</WalletProvider>;

const { publicKey, connected, connecting, error, connect, disconnect } = useWallet();
```

Full guide: [docs/wallets.md](https://github.com/Dione-b/caatinga/blob/main/docs/wallets.md).

## Debug Output Rules

- XDR data is omitted by default
- `debugXdr: true` includes XDR snapshots such as unsigned, prepared, and signed values
- raw binding or submission output is omitted by default
- `debugRaw: true` includes raw binding or submission output

Consumers should treat debug fields as opt-in diagnostics, not part of the default happy-path payload.

## Errors

`@caatinga/client` emits documented `CAATINGA_*` codes for public failures. Consumers should key automation on the code, not the message text.

Common codes include:

- `CAATINGA_CONTRACT_ARTIFACT_NOT_FOUND`
- `CAATINGA_BINDING_CLIENT_NOT_FOUND`
- `CAATINGA_BINDING_METHOD_NOT_FOUND`
- `CAATINGA_WALLET_NOT_CONNECTED`
- `CAATINGA_XDR_BUILD_FAILED`
- `CAATINGA_XDR_PREPARE_FAILED`
- `CAATINGA_XDR_SIGN_FAILED`
- `CAATINGA_XDR_SUBMIT_FAILED`
- `CAATINGA_XDR_RESULT_FAILED`

## Limitations

- this package does not replace Stellar CLI, Stellar SDK, Soroban SDK, or generated bindings
- manual SCVal serialization and manual XDR parsing are out of scope
- multisig orchestration, backend signing, and non-documented wallet integrations are not part of the supported contract
- private module paths and undocumented helpers are less stable than the exports listed above
