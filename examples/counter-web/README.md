# Counter Web Example

Vite + React + TypeScript example for `@caatinga/client`, generated bindings, artifacts, and the Stellar Wallets Kit adapter.

## Setup

Install dependencies from the example directory:

```bash
cd examples/counter-web
npm install
```

In the monorepo, install from the repository root first:

```bash
pnpm install
pnpm --filter counter-web build
```

You need a funded Stellar CLI identity and a deployed counter contract on testnet before the app can invoke on-chain methods. See [From Zero to Testnet](../../docs/tutorials/from-zero-to-testnet.md).

## Deploy and generate

From a Caatinga project with a counter contract configured:

```bash
ctg build counter
ctg deploy counter --network testnet --source alice
ctg generate counter --network testnet
```

Copy the generated binding and `caatinga.artifacts.json` into this example, or point the app at your project artifacts.

The checked-in `src/contracts/generated/counter.ts` is a small stand-in so the example compiles in this repository. In a real app, replace it with bindings from `ctg generate`.

## Run app

```bash
cd examples/counter-web
npm run dev
```

In the monorepo:

```bash
pnpm --filter counter-web dev
```

Copy `.env.example` to `.env` and set `VITE_WALLETCONNECT_PROJECT_ID` before using WalletConnect.

## What this shows

- Select xBull, Albedo, Freighter, Rabet, or WalletConnect.
- Switch between testnet and public wallet networks.
- Display the public address.
- Load contract artifacts.
- Register generated counter bindings.
- Instantiate `@caatinga/client`.
- Call `counter.increment`.
- Read `counter.get` through `client.contract("counter").read("get")`.
- Display loading and `CAATINGA_*` errors.

Browser code imports artifact types from `@caatinga/core/browser`, the package entry that excludes Node-only modules such as `execa`.
