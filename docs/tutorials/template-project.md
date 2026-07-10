# Template Project

Full Soroban dApp scaffold with Vite + React, wallet wiring, and binding placeholders. Not sure this is the right path? See [Choosing a project scaffold](./project-scaffolds.md).

## When to use

- First Caatinga or Soroban dApp
- You want Vite + React, Stellar Wallets Kit, and `@caatinga/client` pre-configured
- You prefer learning the full loop: build → deploy → dev server → wallet → invoke

For CLI-only projects without a bundled UI, use [Minimal project](./minimal-project.md) instead.

## Scaffold

```bash
npx caatinga init my-dapp
cd my-dapp
npm install
```

Pick a different bundled template:

```bash
npx caatinga zk init my-zk-dapp
```

`pnpm install` also works. The `react-vite-counter` template ships `pnpm-workspace.yaml` for pnpm 10.26+/11.x — see [Templates — pnpm](../templates.md#pnpm-1026--11x).

Without a global CLI install, use `npx caatinga init my-dapp`.

## What gets generated

| Path / file                       | Purpose                                                        |
| --------------------------------- | -------------------------------------------------------------- |
| `caatinga.config.ts`              | Contracts, WASM paths, networks, `frontend.bindingsOutput`     |
| `caatinga.artifacts.json`         | Per-network deployed contract IDs (empty until deploy)         |
| `contracts/<name>/`               | Rust Soroban contract source                                   |
| `src/`                            | Vite + React app, wallet adapter, `caatinga.ts` client wiring  |
| `src/contracts/generated/`        | Placeholder bindings until deploy generates real ones          |
| `src/stubs/`                      | Wallet SDK stubs (Trezor, HOT, Safe) for clean browser bundles |
| `vite.config.ts`, `tsconfig.json` | Frontend toolchain                                             |

The default contract is `counter` in `react-vite-counter`.

## Standard workflow

Follow [Getting started — CLI loop](../getting-started.md#cli-loop), then start the UI:

```bash
npm run dev
```

`deploy` auto-generates bindings. Use `caatinga read` for getters and `invoke` for mutations. The Vite app needs a deployed `contractId` for on-chain calls.

## Recovery and common issues

**Placeholder bindings still in use** (`CAATINGA_PLACEHOLDER_BINDING`):

```bash
npx caatinga generate counter --network testnet
```

Restart the dev server after bindings change.

**Contract not deployed in the UI:** deploy before `npm run dev` — the frontend reads `contractId` from `caatinga.artifacts.json`.

**`npm install` warnings or audit findings:** the template ships required npm/pnpm overrides. See [Templates](../templates.md) and [Wallets — bundler workarounds](../wallets.md#stellar-wallets-kit-bundler-workarounds).

## Next steps

- [Templates](../templates.md) — official template list and manifest schema
- [Client](../client.md) · [Wallets](../wallets.md)
