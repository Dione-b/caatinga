# Minimal Project

Use `caatinga init --minimal` when you want a Soroban contract and CLI workflow **without** a bundled frontend. You choose the UI stack later — React, Next.js, Svelte, or no browser at all.

Not sure this is the right path? See [Choosing a project scaffold](./project-scaffolds.md).

## When to use

- Contract and CLI first; frontend is a separate decision
- Integrating Caatinga into an existing app or monorepo
- Backend scripts, CI, or indexer workflows that only need deploy + read/invoke
- You do not want wallet stubs or Vite config copied into the repo on day one

For a ready-made Vite + React dApp, use [Template project](./template-project.md) instead.

## Scaffold

```bash
npx caatinga init my-contract-app --minimal
cd my-contract-app
npm install
npx caatinga doctor
```

`--empty` is an alias for `--minimal`.

## What gets generated

| Path / file | Purpose |
| --- | --- |
| `caatinga.config.ts` | Contract `app`, networks — **no** `frontend` block |
| `caatinga.artifacts.json` | Empty testnet entry until deploy |
| `contracts/app/` | Soroban stub: `hello()`, `version()` |
| `package.json` | Scripts: `build`, `deploy`, `doctor`, `read:hello`, `read:version` |

**Not included:** `src/`, Vite, React, wallet stubs, or TypeScript bindings.

## CLI workflow

```bash
npx caatinga build app
npx caatinga deploy app --network testnet --source alice
npx caatinga read app.version --network testnet
npx caatinga read app.hello --network testnet
```

Or use the npm scripts:

```bash
npm run build
npm run deploy
npm run read:version
npm run read:hello
```

Deploy writes the on-chain `contractId` to `caatinga.artifacts.json`. Reads and deploys need a local Stellar CLI identity (`--source alice`). Public `G...` addresses are rejected.

## Read vs invoke

The stub contract ships **read-only** methods:

- `hello()` — returns Soroban Symbol `hello`
- `version()` — returns `1`

Use `caatinga read` (or `client.read()` in the browser) for these methods. Use `caatinga invoke` only after you add state-changing methods to `contracts/app/src/lib.rs`.

For `caatinga read`, `--source` is optional on the CLI: Caatinga resolves `CAATINGA_SOURCE` or defaults to `alice`.

Soroban `Symbol` parameters are generated as TypeScript `string` values with host-specific restrictions — see [Soroban types](../soroban-types.md).

## Adding a frontend later

`init --minimal` does not pick a UI framework. After deploy, wire any stack you prefer:

1. **Config** — add `frontend.bindingsOutput` to `caatinga.config.ts` (`framework` is metadata only):

   ```ts
   frontend: {
     framework: "vite-react",
     bindingsOutput: "./src/contracts/generated"
   }
   ```

2. **Bindings** — `npx caatinga deploy app` generates bindings automatically, or recover with:

   ```bash
   npx caatinga generate app --network testnet
   ```

3. **Packages** — install `@caatinga/client`, `@caatinga/core`, and a wallet adapter (`@creit.tech/stellar-wallets-kit` or custom). See [Client](../client.md) and [Wallets](../wallets.md).

4. **Wiring** — keep a dedicated `src/caatinga.ts` with **static imports** of artifacts and generated bindings. Import that module from your UI. See [Project layout](../client.md#project-layout).

5. **Wallet stubs** — if you use Stellar Wallets Kit with Vite/webpack, apply helpers from `@caatinga/client/vite` (`walletStubViteAliases`, `walletStubOverrides`). Copy stub files from `react-vite-counter` or follow [Wallets — custom Vite projects](../wallets.md#custom-vite-projects).

6. **Read vs invoke in the browser** — use `client.contract("app").read()` for getters; `invoke()` only for state-changing methods. See [Read and Simulate](../client.md#read-and-simulate).

The `react-vite-counter` template is a full reference implementation, not a requirement.

## Next steps

- [Client](../client.md) — browser interop with generated bindings
- [Soroban types](../soroban-types.md) — Symbol vs string footguns
- [ZK project](./zk-project.md) — add Groth16 circuits to an existing minimal project with `caatinga zk init`
