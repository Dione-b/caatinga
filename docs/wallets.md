# Wallets

Adapter contract, bundled Freighter and Stellar Wallets Kit adapters, wallet session, React hooks, and bundler workarounds.

## The adapter contract

Everything builds on one minimal interface:

```ts
export interface CaatingaWalletAdapter {
  getPublicKey(): Promise<string>;

  signTransaction(input: { xdr: string; networkPassphrase: string }): Promise<string>;
}
```

Rules every adapter must follow:

- **Reject on dismissal:** `getPublicKey` and `signTransaction` must reject when the user cancels
  or dismisses the wallet UI. Never leave the promise pending indefinitely.
- **Adapter timeouts:** an adapter may apply its own timeout before rejecting.
- **Caatinga timeout:** Caatinga imposes no default timeout. Pass `walletTimeout` (milliseconds) on
  `CaatingaClientConfig` — or `timeout` on `createWalletSession` — to cap wallet calls; on expiry
  the client throws `CAATINGA_WALLET_TIMEOUT`.

## Bundled adapters

### Stellar Wallets Kit (multi-wallet)

“Multi-wallet” here means **choosing among wallet providers** (Freighter, xBull, etc.) via Stellar Wallets Kit — not Soroban multi-invoker / `signAuthEntry` orchestration. Browser `invoke` is **single-invoker** ([Client scope](./client.md#single-invoker-scope)).

```bash
npm install @caatinga/client @creit.tech/stellar-wallets-kit
```

```ts
import {
  createStellarWalletsKitAdapter,
  WalletNetwork,
} from "@caatinga/client/stellar-wallets-kit";

export const stellarWalletAdapter = createStellarWalletsKitAdapter({
  network: WalletNetwork.TESTNET,
});
```

The adapter wraps SWK 2.x static methods and adds:

- `openModal()` — opens the wallet-selection modal (only installed/available wallets), sets the
  chosen wallet active, resolves with the connected address, rejects on dismissal.
- `setWallet(walletId)` / `getWalletId()` — select a wallet programmatically / read the currently
  selected wallet id (`undefined` before any selection).
- `getSupportedWallets()` and `disconnect()`.
- `kit` — exposes the underlying static `StellarWalletsKit` class for advanced usage.
- Optional WalletConnect support via `walletConnectMetadata` (needs a WalletConnect `projectId`).

Exported types from `@caatinga/client/stellar-wallets-kit`:

| Type                                | Purpose                                          |
| ----------------------------------- | ------------------------------------------------ |
| `StellarWalletsKitAdapter`          | Return type of `createStellarWalletsKitAdapter`  |
| `StellarWalletsKitAdapterOptions`   | Options for adapter creation (network, metadata) |
| `StellarWalletsKitMetadata`         | WalletConnect metadata shape                     |
| `StellarWalletsKitOpenModalOptions` | Options for `openModal()`                        |
| `WalletNetwork`                     | Enum of supported network passphrases            |

### Freighter (single wallet)

```bash
npm install @caatinga/client @stellar/freighter-api
```

```ts
import { freighterWalletAdapter } from "@caatinga/client/freighter";
```

Both peer dependencies are optional: install only the one your app uses.

## Wallet session (framework-agnostic)

`createWalletSession` wraps any adapter with connection state, events, and optional persistence.
It works in plain TypeScript, Vue, Svelte, or React — no framework required.

```ts
import { createWalletSession } from "@caatinga/client";
import { stellarWalletAdapter } from "./wallet.js";

const session = createWalletSession(stellarWalletAdapter, { persist: true });

const unsubscribe = session.subscribe(() => {
  console.log(session.getState()); // { status, publicKey, error }
});

await session.connect(); // modal when available, else getPublicKey()
await session.restore(); // silent reconnect from persisted state
await session.disconnect(); // resets state and clears persistence
```

States: `disconnected` → `connecting` → `connected`. A failed `connect()` returns to
`disconnected` with `error` set and rethrows; UI can use either signal.

### Persistence and restore

With `persist: true`, a successful connect stores `{ v: 1, walletId? }` under the
`caatinga:wallet-session` localStorage key (injectable via `storage`/`storageKey` options).
`restore()` then reconnects silently on page load:

- resolves the public key on success;
- resolves `null` when nothing was persisted or reconnection failed;
- never rejects and never sets `state.error` — no error toast on page load;
- clears stale persistence after a failed attempt.

### Capabilities

The session detects optional adapter methods and uses them when present:

```ts
export interface CaatingaWalletCapabilities {
  openModal?(): Promise<string>; // connect() prefers the modal
  disconnect?(): Promise<void>; // disconnect() calls through
  setWallet?(walletId: string): void; // restore() re-selects the persisted wallet
  getWalletId?(): string | undefined; // persisted so restore can re-select
}
```

The Stellar Wallets Kit adapter implements all four. A minimal custom adapter implements none and
still works — `connect()` falls back to `getPublicKey()`.

## React hooks (`@caatinga/client/react`)

The `react` subpath ships `WalletProvider` + `useWallet` so apps stop hand-rolling a wallet
context. React `>=18` is an optional peer dependency — non-React consumers pull nothing extra.

```tsx
import { WalletProvider, useWallet } from "@caatinga/client/react";
import { stellarWalletAdapter } from "./wallet.js";

export default function App() {
  return (
    <WalletProvider adapter={stellarWalletAdapter} options={{ persist: true }}>
      <Body />
    </WalletProvider>
  );
}

function Body() {
  const { publicKey, connected, connecting, error, connect, disconnect } = useWallet();

  if (connecting) return <p>Connecting…</p>;
  if (!connected) {
    return (
      <>
        <button onClick={() => void connect().catch(() => {})}>Connect</button>
        {error ? <p role="alert">{error.message}</p> : null}
      </>
    );
  }

  return <button onClick={() => void disconnect()}>{publicKey}</button>;
}
```

- `useWallet()` returns `{ status, publicKey, connected, connecting, error, connect, disconnect, session }`
  backed by `useSyncExternalStore` — no tearing, no manual subscriptions.
- `WalletProvider` accepts either `adapter` (it creates the session) or a pre-built `session`
  shared with non-React code.
- `autoConnect` defaults to true when `persist` is enabled: the provider runs `session.restore()`
  once on mount, silently.
- `useWalletSession()` exposes the underlying session for advanced flows.

The `react-vite-counter` template and `examples/counter-web` both use this provider.

## Custom adapters

Implement the two-method contract and pass the object anywhere an adapter is accepted:

```ts
import type { CaatingaWalletAdapter } from "@caatinga/client";

export const myAdapter: CaatingaWalletAdapter = {
  async getPublicKey() {
    return myWallet.requestAccess(); // must reject on user dismissal
  },
  async signTransaction({ xdr, networkPassphrase }) {
    return myWallet.sign(xdr, networkPassphrase); // resolve signed XDR
  },
};
```

Add any of the capability methods above to opt into modal connect, disconnect, or wallet-id
persistence in sessions and hooks.

## Stellar Wallets Kit bundler workarounds

SWK pulls optional wallet SDKs that misbehave in browser bundles. The official
`react-vite-counter` template ships these workarounds preconfigured; copy them if you wire SWK
into your own app.

### Adding SWK to a custom Vite app

`@caatinga/client/vite` exports reusable helpers so you do not copy 15+ lines of overrides by hand:

```ts
import { defineConfig } from "vite";
import {
  walletStubViteAliases,
  walletStubOverrides,
  walletStubPnpmWorkspaceYaml,
} from "@caatinga/client/vite";
import { fileURLToPath } from "node:url";

const stubsDir = fileURLToPath(new URL("./src/stubs", import.meta.url));

export default defineConfig({
  resolve: { alias: walletStubViteAliases(stubsDir) },
});
```

Also apply install overrides:

- npm `package.json`: merge `walletStubOverrides("./src/stubs")` into `overrides`
- pnpm: write `walletStubPnpmWorkspaceYaml()` into `pnpm-workspace.yaml`

Copy the stub files from `react-vite-counter/src/stubs/` (`hot-wallet.ts`, `empty-wallet-dep/`, `hot-wallet-sdk/`). Projects created with `caatinga init --minimal` do not need wallet stubs until you add `@creit.tech/stellar-wallets-kit`.

### HOT Wallet stub

SWK's HOT Wallet module (NEAR-based) pulls `@hot-wallet/sdk` → `@near-js/crypto` → `randombytes`,
which references the Node `global` and breaks in the browser. The Caatinga adapter already filters
the module out of the wallet list; additionally alias `@hot-wallet/sdk` to a stub in your bundler
so the NEAR chain is never bundled:

```ts
import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@hot-wallet/sdk": path.resolve(__dirname, "src/stubs/hot-wallet.ts"),
    },
  },
});
```

### Trezor / HOT npm overrides

SWK lists `@trezor/connect-web` and `@hot-wallet/sdk` as direct dependencies but does not register
them in `defaultModules()`. Replace them with local stubs to avoid critical `protobufjs`
advisories (Trezor) and NEAR/`elliptic` noise (HOT):

- npm: `overrides` in `package.json` pointing at stub packages (see
  `packages/templates/react-vite-counter/src/stubs/`).
- pnpm: `"-"` path overrides in `pnpm-workspace.yaml`.

Freighter, LOBSTR, WalletConnect, and the other modules are unaffected. Caatinga also filters Trezor and HOT out of the wallet modal (`createStellarWalletsKitAdapter()`).

### `ws` npm override (Reown / viem audit findings)

SWK 2.x → Reown AppKit → `viem` → `ws`. Versions of `ws` below **8.21.0** trigger high-severity DoS advisories ([GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p)). npm audit typically reports **~14** duplicated findings across Reown packages — this is **not** Trezor/`protobufjs`.

Pin at the **top level** of npm overrides (and in `pnpm-workspace.yaml`):

```json
"overrides": {
  "ws": "^8.21.0"
}
```

Use `walletStubOverrides()` from `@caatinga/client/vite` so the pin stays aligned with official
templates. **Do not remove** without running `npm audit` on a scaffolded project and updating
[`scripts/consumer-isolation-test.sh`](../scripts/consumer-isolation-test.sh). Details:
[Templates — Install override contract](./internal/template-overrides.md).

### Safe / uuid overrides

Reown AppKit (transitive via SWK) pulls optional EVM/Safe packages and a deprecated `uuid@8`.
The template blocks them with `ignoredOptionalDependencies` + `overrides` (pnpm) and nested npm
`overrides`. Details and the exact YAML block: [Templates](./templates.md#pnpm-1026--11x).

### Monorepo `.pnpmfile.cjs`

This repository's own `.pnpmfile.cjs` strips the same unused SWK dependencies at install time so
workspace installs stay clean. App projects do not need it — the template overrides above cover
the generated-app case.

## See also

- [Client](./client.md) — invoke/read/simulate/XDR flows that consume the wallet adapter.
- [Templates](./templates.md) — what the official templates preconfigure.
- [Errors](./errors.md) — `CAATINGA_WALLET_*` codes.
