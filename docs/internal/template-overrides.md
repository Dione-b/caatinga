# Install-time dependency overrides (maintainer contract)

Official browser templates (`react-vite-counter`, `zk-starter`) ship npm `package.json` **overrides** and a `pnpm-workspace.yaml` block that are **required** for clean `npm audit` results and working browser bundles. **Do not remove or weaken them** without updating the canonical helpers and CI checks listed below.

## Why they exist

Stellar Wallets Kit (SWK) 2.x depends on Reown AppKit (WalletConnect), which pulls EVM tooling into the install tree even when the dApp only uses Freighter or LOBSTR. Caatinga does not use Trezor, HOT, or Safe directly, but those packages still appear in SWK's dependency graph unless blocked at install time.

| Override                                                               | What breaks if removed                                                                                                     | Typical symptom                                                          |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `ws: "^8.21.0"`                                                        | Transitive `ws@8.0.0–8.20.1` via `viem` → Reown ([GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p)) | **~14 high** `npm audit` findings after `npm install`                    |
| `axios: "^1.17.1"`                                                     | Transitive `axios@1.0.0–1.17.0` via Coinbase CDP / Reown                                                                   | **High** `npm audit` findings in consumer isolation                      |
| Trezor stubs (`@trezor/connect-web`, `@trezor/connect-plugin-stellar`) | Real Trezor Connect → `protobufjs` advisories                                                                              | **Critical** audit noise; Caatinga does not support hardware wallets yet |
| HOT stub (`@hot-wallet/sdk`)                                           | NEAR/`randombytes` chain                                                                                                   | Browser bundle/runtime errors                                            |
| Safe / `uuid` overrides                                                | Optional EVM Safe packages, deprecated `uuid@8`                                                                            | Deprecated install warnings                                              |

## `ws` vulnerability chain (most common report)

This is the usual cause when users report "14 vulnerabilities" on a fresh `ctg init` + `npm install`. It is **not** Trezor:

```
@caatinga/client
  └── @creit.tech/stellar-wallets-kit
        └── @reown/appkit
              └── viem
                    └── ws@8.x  (vulnerable below 8.21.0)
```

npm audit repeats the same `ws` advisory across many Reown packages (`@reown/appkit-utils`, `@reown/appkit-common`, `@base-org/account`, etc.), which is why the count is ~14.

**Fix:** keep `"ws": "^8.21.0"` as a **top-level** npm override (and the same pin in `pnpm-workspace.yaml`). Verify with:

```bash
npm install && npm audit
npm ls ws
```

## Canonical source — keep files in sync

When editing overrides, update **all** of:

- [`packages/client/src/vite/wallet-stubs.ts`](../../packages/client/src/vite/wallet-stubs.ts) — `walletStubOverrides()`, `walletStubPnpmWorkspaceYaml()`
- [`packages/templates/react-vite-counter/package.json`](../../packages/templates/react-vite-counter/package.json) + [`pnpm-workspace.yaml`](../../packages/templates/react-vite-counter/pnpm-workspace.yaml)
- [`packages/templates/zk-starter/package.json`](../../packages/templates/zk-starter/package.json) + [`pnpm-workspace.yaml`](../../packages/templates/zk-starter/pnpm-workspace.yaml)

`pnpm build` copies `packages/templates/` into `@caatinga/cli/templates` automatically.

## CI and tests that enforce overrides

- [`scripts/consumer-isolation-test.sh`](../../scripts/consumer-isolation-test.sh) — runs `npm audit --audit-level=high` after scaffolding and installing the counter template
- [`packages/core/src/templates/create-project-from-template.test.ts`](../../packages/core/src/templates/create-project-from-template.test.ts) — asserts `ws`, `axios`, Trezor, and SWK nested overrides in template `package.json`
- [`packages/client/src/vite/wallet-stubs.test.ts`](../../packages/client/src/vite/wallet-stubs.test.ts)

If you bump `@creit.tech/stellar-wallets-kit`, Reown, or other wallet dependencies, run consumer isolation (or at minimum scaffold + `npm install && npm audit`) before merging.

## Trezor / HOT (intentionally excluded)

Caatinga **does not register** Trezor or HOT in `createStellarWalletsKitAdapter()`; install stubs replace their npm packages with empty local packages under `src/stubs/`. Do not delete those stubs to "fix" install warnings unless you are adding full hardware-wallet support and updating audit expectations. See [Wallets — Trezor / HOT](../wallets.md#trezor--hot-npm-overrides).
