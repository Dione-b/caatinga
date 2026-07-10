# From Zero to Testnet

Optional walkthrough: deploy and invoke a Soroban counter on Stellar testnet.

**Before you start:** complete [Getting started](../getting-started.md) — install, scaffold, and the basic CLI loop.

## Create the project

```bash
caatinga init my-dapp
cd my-dapp
npm install
```

`pnpm install` also works. See [Templates — pnpm](../templates.md#pnpm-1026--11x) for pnpm 10.26+/11.x.

## Verify the environment

```bash
npx caatinga doctor --network testnet --source alice
```

Expected shape:

```txt
Caatinga Doctor

✓ Node.js 22
✓ Stellar CLI 27.0.0
✓ Rust 1.84.0
✓ wasm32v1-none target installed
✓ caatinga.config.ts found
✓ caatinga.artifacts.json found
✓ network testnet found
✓ source identity alice found

Status: ready
```

A `STELLAR_CLI_UNTESTED_VERSION` warning is advisory and does not block deploys. See the [Stellar CLI version contract](../stellar-cli-version-contract.md).

## Build, deploy, invoke

```bash
npx caatinga build counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga invoke counter.increment --network testnet --source alice
npx caatinga status --network testnet
npx caatinga smoke --network testnet --source alice
npx caatinga read counter.count --network testnet --expect '{"matcher":"reachable"}'
```

`deploy` writes the `contractId` to `caatinga.artifacts.json` and auto-generates TypeScript bindings. Pass `--no-generate` to skip; recover with `npx caatinga generate --network testnet`.

To redeploy when an artifact already exists:

```bash
npx caatinga deploy counter --network testnet --source alice --force
```

## Browser client

After deploy:

```bash
npm install @caatinga/client @caatinga/core @creit.tech/stellar-wallets-kit
```

Browser `invoke` is single-invoker; see [Client — Single-invoker scope](../client.md#single-invoker-scope).

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

await client.contract("counter").read<number>("get");
await client.contract("counter").invoke<number>("increment");
```

See [Client](../client.md) and [Wallets](../wallets.md).

## Troubleshooting

For install warnings, audit findings, and `CAATINGA_*` errors on this walkthrough, see [Troubleshooting](../troubleshooting.md).

Common quick fixes:

- `CAATINGA_ARTIFACT_NOT_FOUND` — run `npx caatinga build counter` before deploy
- `CAATINGA_STELLAR_CLI_NOT_FOUND` — install Stellar CLI; ensure `stellar` is on `PATH`
- `CAATINGA_RUST_TARGET_NOT_FOUND` — `rustup target add wasm32v1-none`
- `CAATINGA_UNSAFE_SOURCE_ACCOUNT` — use a local identity such as `alice`, not a public `G...` address
