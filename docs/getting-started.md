# Getting Started

Caatinga alpha supports the CLI path first, then optional browser/client integration through `@caatinga/client`.

During alpha, install published packages from npm. Use **`next`** for the current line (**`2.4.5`**); **`latest`** remains **`2.2.1`** until promoted. Pin an exact version in apps when you need reproducibility; see [Release process](./release.md).

## Prerequisites

- Node.js 22+
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

Confirm the resolved versions (`next` is currently **`2.4.5`**; `latest` is **`2.2.1`**):

```bash
npm view @caatinga/cli@next version
npm view @caatinga/core@next version
npm view @caatinga/client@next version
npm view @caatinga/zk version
```

Without a global CLI install, use `npx caatinga@latest` in the commands below.

## From the repository

```bash
pnpm install
pnpm build
pnpm --filter @caatinga/cli dev init my-dapp
```

## Choose your scaffold

Caatinga supports three starting paths: **template** (full dApp), **minimal** (CLI + contract only), and **ZK** (Circom + Groth16 verifier). See [Choosing a project scaffold](./tutorials/project-scaffolds.md) for a comparison table and links to step-by-step guides:

| Guide                                               | Command                                       |
| --------------------------------------------------- | --------------------------------------------- |
| [Template project](./tutorials/template-project.md) | `npx caatinga init my-dapp`                   |
| [Minimal project](./tutorials/minimal-project.md)   | `npx caatinga init my-contract-app --minimal` |
| [ZK project](./tutorials/zk-project.md)             | `npx caatinga zk init my-zk-dapp`             |

The default template flow (`react-vite-counter`) is summarized below. Minimal and ZK flows are documented in their dedicated guides.

## Generated app flow

After `caatinga init` (global CLI) or `npx caatinga@latest init`:

```bash
cd my-dapp
npm install
npx caatinga build counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga status --network testnet
npx caatinga invoke counter.increment --network testnet --source alice
```

For read-only calls (getters, pure queries), use `read` instead of `invoke` — it simulates without signing or submitting:

```bash
npx caatinga read counter.get --network testnet
```

Run the CLI steps in order: `build` → `deploy` → `invoke` (or `npm run dev` / `pnpm dev` after
deploy). `deploy` requires compiled WASM, writes the deployed `contractId` into
`caatinga.artifacts.json`, and **generates TypeScript bindings automatically** (pass
`--no-generate` to skip). `status` shows what's deployed and whether bindings are fresh.

`build` only compiles the WASM file. `deploy` is the step that writes the deployed `contractId` into `caatinga.artifacts.json`; browser clients and generated bindings need that contract ID before they can call the contract.

If bindings generation fails after a deploy (or you skipped it), recover with
`npx caatinga generate --network testnet`.

Use a local Stellar CLI identity alias for `--source`. Public `G...` addresses, secret keys, and seed phrases are rejected because deploy and invoke need a signer.

Template projects support `pnpm install` as well as npm — see [Templates — pnpm](./templates.md#pnpm-1026--11x).

## Browser client flow

After `deploy` (which generates the bindings), install the client packages (match the CLI version when possible):

```bash
npm install @caatinga/client @caatinga/core @creit.tech/stellar-wallets-kit
```

Register the generated bindings with `@caatinga/client`:

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
