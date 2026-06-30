# react-vite-counter

Caatinga counter dApp template — Vite, React, Soroban counter contract, and `@caatinga/client` wallet integration.

## CLI flow

```bash
npm install
npx caatinga build counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga generate counter --network testnet
npm run dev
```

Run `build` before `deploy` and `deploy` before `generate`. The checked-in binding stub under `src/contracts/generated/counter/` is a placeholder — run `caatinga generate` before `npm run dev`.

Use a local Stellar CLI identity alias for `--source`; public `G...` addresses and secret keys are rejected.

## Client integration

After `caatinga generate`, wire bindings via `@caatinga/client`. See [Client docs](https://github.com/Dione-b/caatinga/blob/main/docs/client.md) and [Template project tutorial](https://github.com/Dione-b/caatinga/blob/main/docs/tutorials/template-project.md).

Single-invoker browser flows only until v1.0 — see [Client scope](https://github.com/Dione-b/caatinga/blob/main/docs/client.md#single-invoker-scope-until-v10).

## Package managers

Templates default to npm. pnpm 10.26+/11.x is supported via the shipped `pnpm-workspace.yaml`.

```bash
npm run caatinga:build
npm run caatinga:deploy -- --network testnet --source alice
```

With pnpm: `pnpm run caatinga:build` (same pattern for deploy/generate).
