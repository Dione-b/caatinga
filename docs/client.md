# Client (`@caatinga/client`)

`@caatinga/client` is the browser/client-side interop layer for generated Stellar CLI TypeScript bindings. It connects:

- generated contract bindings
- `caatinga.artifacts.json`
- RPC URL and network passphrase
- a wallet adapter

It does not replace Stellar CLI, Stellar SDK, Soroban SDK, generated bindings, or wallet signing. It does not serialize SCVal manually, parse XDR manually, or store secret keys.

## Scope

### Single-invoker scope

Browser wallet `invoke()` signs with one connected wallet as the transaction invoker. Multi-auth is application-owned — contracts requiring delegated AddressV2 / non-invoker `signAuthEntry` credentials fail with `CAATINGA_MULTI_AUTH_REQUIRED`.

Included:

- artifact-based `contractId` lookup
- generated binding registration
- `CaatingaWalletAdapter`
- Stellar Wallets Kit adapter
- Freighter adapter compatibility subpath
- `createWalletSession` — framework-agnostic connection state, persistence, silent restore
- `@caatinga/client/react` — `WalletProvider` + `useWallet` hooks (optional React peer)
- `read()`
- `simulate()`
- `invoke()`
- `buildXdr()`
- explicit `debugXdr` and `debugRaw`
- `CAATINGA_XDR_*`, binding, wallet, and artifact errors

Not included:

- CLI XDR commands
- `caatinga generate --interop`
- custom SCVal serialization
- multisig orchestration
- backend signing

## Install

```bash
pnpm add @caatinga/client @creit.tech/stellar-wallets-kit
```

`@caatinga/client` depends on `@caatinga/core` and imports only the browser-safe subpath
`@caatinga/core/browser` (errors and artifact types). That entry excludes Node-only modules such as
`execa`, so Vite and webpack bundles do not pull in the CLI shell layer.

Application code that needs the same types in the browser should import from `@caatinga/core/browser`
rather than the root `@caatinga/core` package entry.

## Counter Example

```ts
import { createCaatingaClient } from "@caatinga/client";
import { createStellarWalletsKitAdapter } from "@caatinga/client/stellar-wallets-kit";
import * as Counter from "./contracts/generated/counter";
import artifacts from "../caatinga.artifacts.json";

const wallet = createStellarWalletsKitAdapter();

const client = createCaatingaClient({
  network: {
    name: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
  artifacts,
  wallet,
  contracts: {
    counter: {
      binding: Counter,
    },
  },
});

const before = await client.contract("counter").read<number>("get");
const increment = await client.contract("counter").invoke<number>("increment");
const after = increment.result ?? (await client.contract("counter").read<number>("get"));
```

Minimal successful result:

```json
{
  "status": "confirmed",
  "contract": "counter",
  "method": "increment",
  "contractId": "C...",
  "transactionHash": "..."
}
```

If a contract ID is not passed explicitly, the client resolves it from:

```txt
artifacts.networks[network].contracts[contract].contractId
```

To override artifacts:

```ts
const client = createCaatingaClient({
  network,
  artifacts,
  wallet,
  contracts: {
    counter: {
      binding: Counter,
      contractId: "C...",
    },
  },
});
```

## Arguments

Arguments are forwarded as one object to the generated binding method:

```ts
await client.contract("token").invoke("transfer", {
  to: receiverAddress,
  amount: 100n,
});
```

## Read and Simulate

| API          | When to use                                                           |
| ------------ | --------------------------------------------------------------------- |
| `read()`     | Read-only methods; returns the parsed value directly                  |
| `simulate()` | Read-only methods when you need `status`, `contractId`, or `debugRaw` |
| `invoke()`   | State-changing methods that must be signed and submitted              |

Use `read()` for read-only contract methods when the UI only needs the returned value:

```ts
const value = await client.contract("counter").read<number>("get");
```

Use `simulate()` when the UI or diagnostics need metadata:

```ts
const result = await client.contract("counter").simulate<number>("get", {
  debugRaw: true,
});

console.log(result.status);
console.log(result.contractId);
console.log(result.result);
console.log(result.raw);
```

`simulate()` prepares the generated binding transaction and returns the parsed binding result. It calls
`wallet.getPublicKey()` to build the generated client, but it does not call `wallet.signTransaction()`.
If the simulated method does not expose a result, the client throws `CAATINGA_READ_RESULT_MISSING`.

Calling `invoke()` on a read-only binding method may fail with a hint to use `read()` or `simulate()` instead.

## Project layout

Keep Caatinga client wiring in a dedicated module with **static imports**:

```ts
// src/caatinga.ts — static imports only
import { createCaatingaClient } from "@caatinga/client";
import artifactsJson from "../caatinga.artifacts.json";
import * as Counter from "./contracts/generated/counter";
import { stellarWalletAdapter } from "./wallet.js";

export const caatingaClient = createCaatingaClient({
  /* ... */
});
```

```ts
// src/App.tsx — import the pre-built client
import { caatingaClient } from "./caatinga.js";
```

Avoid dynamic `import()` of bindings or `caatinga.artifacts.json` inside React components. Vite needs static import paths to bundle JSON artifacts and generated contract modules correctly. The official `react-vite-counter` template follows this pattern in `src/caatinga.ts`.

## XDR Debug

XDR is omitted by default and only returned when `debugXdr` is enabled.

```ts
const result = await client.contract("counter").invoke("increment", {
  debugXdr: true,
});

console.log(result.xdr?.unsigned);
console.log(result.xdr?.prepared);
console.log(result.xdr?.signed);
```

Raw binding or submit output is omitted unless `debugRaw` is enabled:

```ts
const result = await client.contract("counter").invoke("increment", {
  debugXdr: true,
  debugRaw: true,
});

console.log(result.raw);
```

## Build XDR Only

```ts
const tx = await client.contract("counter").buildXdr("increment");

console.log(tx.unsignedXdr);
console.log(tx.preparedXdr);
```

`buildXdr()` creates the generated binding client, so it may call `wallet.getPublicKey()`. It does not call `wallet.signTransaction()`.

## Implementing a wallet adapter

```ts
export interface CaatingaWalletAdapter {
  getPublicKey(): Promise<string>;

  signTransaction(input: { xdr: string; networkPassphrase: string }): Promise<string>;
}
```

Contract:

- **Reject on dismissal:** `getPublicKey` and `signTransaction` must reject when the user cancels or dismisses the wallet UI. Do not leave the promise pending indefinitely.
- **Adapter timeouts:** Your adapter may apply its own timeout before rejecting.
- **Caatinga timeout:** Caatinga does not impose a default timeout. Pass optional `walletTimeout`
  (milliseconds) on `CaatingaClientConfig` to cap `getPublicKey` and `signTransaction`; when exceeded,
  the client throws `CAATINGA_WALLET_TIMEOUT`.

The Stellar Wallets Kit adapter is exported from:

```ts
import { createStellarWalletsKitAdapter } from "@caatinga/client/stellar-wallets-kit";
```

The Freighter adapter remains available for compatibility:

```ts
import { freighterWalletAdapter } from "@caatinga/client/freighter";
```

For the full adapter guide — bundled adapters, custom adapters, capability methods, and Stellar
Wallets Kit bundler workarounds — see [Wallets](./wallets.md).

Vite apps using Stellar Wallets Kit get reusable bundler helpers from `@caatinga/client/vite`:
`walletStubViteAliases`, `walletStubOverrides`, and `walletStubPnpmWorkspaceYaml`. These avoid
copying 15+ lines of overrides by hand — see [Wallets — Adding SWK to a custom Vite app](./wallets.md#adding-swk-to-a-custom-vite-app).

## Wallet session

`createWalletSession(adapter, options?)` wraps any adapter with connection state
(`disconnected` / `connecting` / `connected`), subscriptions, optional persistence, and silent
restore — usable from any framework or plain TypeScript:

```ts
import { createWalletSession } from "@caatinga/client";

const session = createWalletSession(wallet, { persist: true });
session.subscribe(() => render(session.getState()));
await session.connect(); // modal when the adapter has one, else getPublicKey()
await session.restore(); // silent reconnect on page load — never throws
```

## React hooks

React apps (`react >= 18`, optional peer) get a provider and hook from the `react` subpath:

```tsx
import { WalletProvider, useWallet } from "@caatinga/client/react";

<WalletProvider adapter={wallet} options={{ persist: true }}>
  <App />
</WalletProvider>;

const { publicKey, connected, connecting, error, connect, disconnect, session } = useWallet();
```

`useWallet` is backed by `useSyncExternalStore`; `WalletProvider` restores persisted sessions on
mount automatically. Full reference and examples: [Wallets](./wallets.md#react-hooks-caatingaclientreact).

## Binding Contract

The default binding adapter expects generated bindings to:

1. export `Client`
2. accept `contractId`, `publicKey`, `rpcUrl`, and `networkPassphrase`
3. expose contract methods on the client instance
4. return a transaction-like object with `toXDR()`
5. optionally expose `prepare()`
6. expose `signAndSend({ signTransaction })`, where `signTransaction` returns `{ signedTxXdr }`

Caatinga adapts `CaatingaWalletAdapter.signTransaction({ xdr, networkPassphrase })` into generated transaction `signTransaction(xdr, opts)`, and does not parse XDR or serialize Soroban values.

If `@stellar/stellar-sdk generate` changes this generated shape, the compatibility fix belongs in the binding adapter/client integration layer, not in application code.

## SDK v16 transaction submission

`@caatinga/client` calls `assembledTx.signAndSend({ signTransaction })` on generated bindings. SDK v16 accepts optional `force`, `signTransaction`, and `watcher`; Caatinga passes only `signTransaction`.

The return is a `SentTransaction<T>`. Caatinga normalizes `sendTransactionResponse.hash` → `transactionHash` and reads the `result` getter → `result` on invoke responses.

Multi-auth: when a simulated transaction has unsigned non-invoker Soroban auth entries (delegated address credentials / "AddressV2"), signing raises `NeedsMoreSignaturesError`.
Caatinga surfaces `CAATINGA_MULTI_AUTH_REQUIRED`. Handle multi-signer flows in application code.

## Failure behavior

Client failures use public `CAATINGA_*` codes. The most common are:

- `CAATINGA_CONTRACT_ARTIFACT_NOT_FOUND`
- `CAATINGA_BINDING_CLIENT_NOT_FOUND`
- `CAATINGA_BINDING_METHOD_NOT_FOUND`
- `CAATINGA_WALLET_NOT_CONNECTED`
- `CAATINGA_WALLET_TIMEOUT`
- `CAATINGA_XDR_BUILD_FAILED`
- `CAATINGA_XDR_PREPARE_FAILED`
- `CAATINGA_XDR_SIGN_FAILED`
- `CAATINGA_XDR_SUBMIT_FAILED`
- `CAATINGA_XDR_RESULT_FAILED`
- `CAATINGA_READ_RESULT_MISSING`
- `CAATINGA_PLACEHOLDER_BINDING`

See [`errors.md`](./errors.md) for the full table.
