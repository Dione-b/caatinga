# Getting Started

Caatinga alpha supports the CLI path first, then optional browser/client integration through `@caatinga/client`.

During alpha, install published packages from the npm **`next`** dist-tag (release-gate validated). Pin `@next` or an exact version in apps; see [Release process](./release.md).

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

## Install from npm

```bash
npm install -g @caatinga/cli@next
```

Confirm the resolved versions (currently `2.2.0` on `@next`):

```bash
npm view @caatinga/cli@next version
npm view @caatinga/core@next version
npm view @caatinga/client@next version
```

Without a global CLI install, use `npx caatinga@next` in the commands below.

## From the repository

```bash
pnpm install
pnpm build
pnpm --filter @caatinga/cli dev init my-dapp
```

## Generated app flow

After `caatinga init` (global `@next` CLI) or `npx caatinga@next init`:

```bash
cd my-dapp
npm install
npx caatinga build counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga status --network testnet
npx caatinga invoke counter.increment --network testnet --source alice
```

Run the CLI steps in order: `build` → `deploy` → `invoke` (or `npm run dev` / `pnpm dev` after
deploy). `deploy` requires compiled WASM, writes the deployed `contractId` into
`caatinga.artifacts.json`, and **generates TypeScript bindings automatically** (pass
`--no-generate` to skip). `status` shows what's deployed and whether bindings are fresh.

`build` only compiles the WASM file. `deploy` is the step that writes the deployed `contractId` into `caatinga.artifacts.json`; browser clients and generated bindings need that contract ID before they can call the contract.

If bindings generation fails after a deploy (or you skipped it), recover with
`npx caatinga generate --network testnet`.

If the CLI is not installed globally, prefix each command with `npx caatinga@next` instead of `npx caatinga`.

### Using pnpm

Templates default to `npm` (`packageManager: "npm"` in `caatinga.template.json`), but `pnpm install` is also supported. The `react-vite-counter` template ships a `pnpm-workspace.yaml` with:

- `allowBuilds.esbuild: true` — pnpm 10.26+/11.x block lifecycle scripts by default; Vite depends on esbuild.
- `overrides.uuid` in `pnpm-workspace.yaml` (and npm `overrides` in `package.json`) — avoids deprecated transitive `uuid@8` from optional wallet SDK dependencies.
- Safe wallet overrides (`ignoredOptionalDependencies` + nested `overrides` in `pnpm-workspace.yaml`;
  npm `overrides` in `package.json`) — block optional EVM/Safe packages pulled by Reown AppKit through
  Stellar Wallets Kit. Stellar dApps do not use Safe; this removes the deprecated
  `@safe-global/safe-gateway-typescript-sdk` install warning.

Equivalent package-manager scripts:

```bash
pnpm install
pnpm run caatinga:build
pnpm run caatinga:deploy -- --network testnet --source alice
```

(`caatinga:generate` still exists as a recovery script; deploy generates bindings for you.)

`npx caatinga build counter` does not depend on your package manager. Use it directly when `pnpm install` or `pnpm run caatinga:build` fails but Rust and Stellar CLI are already healthy.

See [From Zero to Testnet](./tutorials/from-zero-to-testnet.md#troubleshooting) for pnpm install errors and [Templates](./templates.md#pnpm-1026--11x) for the workspace file details.

Use a local Stellar CLI identity alias for `--source`. Public `G...` addresses, secret keys, and seed phrases are rejected because deploy and invoke need a signer.

## Browser client flow

After `deploy` (which generates the bindings), install the client packages from `next` (match the CLI version when possible):

```bash
npm install @caatinga/client@next @caatinga/core@next @creit.tech/stellar-wallets-kit
```

Register the generated bindings with `@caatinga/client`:

```ts
import { createCaatingaClient } from "@caatinga/client";
import { createStellarWalletsKitAdapter } from "@caatinga/client/stellar-wallets-kit";
import * as Counter from "./contracts/generated/counter/src/index.js";
import artifacts from "../caatinga.artifacts.json";

const client = createCaatingaClient({
  network: { name: "testnet", rpcUrl: "https://soroban-testnet.stellar.org", networkPassphrase: "Test SDF Network ; September 2015" },
  artifacts,
  wallet: createStellarWalletsKitAdapter(),
  contracts: { counter: { binding: Counter } },
});

const before = await client.contract("counter").read<number>("get");
const increment = await client.contract("counter").invoke<number>("increment");
```

For `debugXdr`, `buildXdr()`, the wallet adapter contract, and the full binding shape Caatinga expects, see [Client](./client.md). React apps can skip hand-rolled wallet state with
`WalletProvider`/`useWallet` from `@caatinga/client/react` — see [Wallets](./wallets.md).

Default local checks:

```bash
pnpm typecheck
pnpm build
pnpm test
```

See [`client.md`](./client.md) for the client contract and debug behavior.
