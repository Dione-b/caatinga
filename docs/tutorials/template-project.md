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

```bash
npx caatinga doctor --network testnet --source alice
npx caatinga build counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga status --network testnet
npm run dev
npx caatinga invoke counter.increment --network testnet --source alice
```

Run steps in order:

1. **`doctor`** — Node, Stellar CLI, Rust, config, artifacts, optional network and identity
2. **`build`** — compiles WASM only
3. **`deploy`** — writes `contractId` to `caatinga.artifacts.json` and **auto-generates TypeScript bindings** (pass `--no-generate` to skip)
4. **`status`** — shows deployed contracts and binding freshness
5. **`npm run dev`** — Vite dev server (needs a deployed `contractId` for on-chain reads/invokes)
6. **`invoke`** — state-changing contract calls from the CLI

Use `caatinga read <contract.method>` for read-only getters. Use `invoke` for increments, transfers, and other mutations.

## Recovery and common issues

**Placeholder bindings still in use** (`CAATINGA_PLACEHOLDER_BINDING`):

Deploy generates bindings automatically. If generation failed or you passed `--no-generate`:

```bash
npx caatinga generate counter --network testnet
```

Restart the dev server after bindings change.

**Contract not deployed in the UI:**

The frontend reads `contractId` from `caatinga.artifacts.json`. Deploy before `npm run dev`.

**`npm install` warnings or audit findings from wallet SDK transitives:**

The template ships npm `overrides` and optional `pnpm-workspace.yaml` blocks (**required**, not optional). The most common report is ~14 **high** findings from `ws` via Reown/viem — fixed by `"ws": "^8.21.0"`. Trezor/HOT are stubbed because Caatinga does not support hardware wallets yet. See [Templates — Install override contract](../internal/template-overrides.md) and [Wallets](../wallets.md#stellar-wallets-kit-bundler-workarounds).

## Next steps

- [Getting started](../getting-started.md) — install and CLI loop
- [Templates](../templates.md) — official template list and manifest schema
- [Client](../client.md) · [Wallets](../wallets.md)
