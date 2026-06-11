# Templates

The MVP ships official templates:

- `react-vite-counter` — single Soroban counter dApp. **Stable** for the alpha flow.
- `marketplace-with-token` — **experimental** two-contract layout demonstrating `dependsOn` and `${contracts.token.contractId}` deploy args. See [ADR 0005](./adr/0005-multi-contract-dependency-deploy.md) for the contract-design rationale.

> **Status: experimental — `marketplace-with-token`** validates the multi-contract dependency graph in code and in the live testnet smoke workflow, but is not yet covered by the full browser/template consumer matrix. Use `react-vite-counter` for first-time Caatinga walkthroughs.

Every template must include `caatinga.template.json`:

```json
{
  "name": "react-vite-counter",
  "version": "0.1.0",
  "description": "Minimal Vite + React + Soroban counter dApp.",
  "caatinga": {
    "compatibleCore": "^0.2.0",
    "templateVersion": 1
  },
  "frontend": {
    "framework": "vite-react",
    "packageManager": "npm"
  },
  "contracts": {
    "path": "contracts",
    "default": "counter"
  },
  "files": {
    "config": "caatinga.config.ts",
    "artifacts": "caatinga.artifacts.json"
  }
}
```

`compatibleCore` is checked against the current `@caatinga/core` version before files are copied. Official templates in this repository must pin `compatibleCore` to `^<coreVersion>` (the same range `defaultCompatibleCoreRange()` derives from `CAATINGA_CORE_VERSION`); CI enforces that pin so a core bump cannot ship with stale template metadata. Missing manifests fail with `CAATINGA_TEMPLATE_MANIFEST_NOT_FOUND`; invalid manifests fail with `CAATINGA_INVALID_TEMPLATE_MANIFEST`; incompatible manifests fail with `CAATINGA_TEMPLATE_INCOMPATIBLE`.

Official templates are maintained in this repository. Community templates should be treated as executable source code: inspect the files before running install scripts or connecting wallets.

Generated projects include:

- `contracts/counter`
- `src`
- `caatinga.config.ts`
- `caatinga.artifacts.json`
- Vite and TypeScript config
- dependencies for generated bindings, `@caatinga/client`, and Stellar Wallets Kit smoke wiring

`caatinga generate` writes Stellar CLI TypeScript bindings as a subpackage at `{bindingsOutput}/{contractName}/src/index.ts`. Import from `./contracts/generated/counter/src/index.js` (or the matching contract name) rather than a flat `{contractName}.ts` file.

### pnpm 10.26+ / 11.x

`caatinga.template.json` declares `packageManager: "npm"`, but the `react-vite-counter` template also ships `pnpm-workspace.yaml` so generated apps can install with pnpm 10.26+ or 11.x:

```yaml
allowBuilds:
  esbuild: true

ignoredOptionalDependencies:
  - "@safe-global/safe-apps-provider"
  - "@safe-global/safe-apps-sdk"

overrides:
  uuid: "^14.0.0"
  "@reown/appkit-utils>@safe-global/safe-apps-sdk": "-"
  "@reown/appkit-utils>@safe-global/safe-apps-provider": "-"
  "@safe-global/safe-apps-sdk>@safe-global/safe-gateway-typescript-sdk": "-"
```

- `allowBuilds.esbuild: true` — pnpm blocks dependency lifecycle scripts by default; Vite pulls in esbuild. Without this, `pnpm install` fails with `ERR_PNPM_IGNORED_BUILDS`.
- `overrides.uuid` — avoids deprecated transitive `uuid@8` from optional wallet SDK dependencies. `package.json` also ships npm `overrides` for the same pin when using npm.
- Safe overrides — block optional EVM/Safe packages from Reown AppKit (transitive via Stellar Wallets Kit). Irrelevant for Stellar wallets; removes the deprecated `@safe-global/safe-gateway-typescript-sdk` warning on `npm install`. `package.json` ships equivalent nested npm `overrides` for npm users.
- Trezor/HOT overrides — SWK lists `@trezor/connect-web` and `@hot-wallet/sdk` as direct dependencies but does not register them in `defaultModules()`. npm `overrides` replace them with local stubs under `src/stubs/`; pnpm uses `"-"` path overrides in `pnpm-workspace.yaml`. This avoids critical `protobufjs` advisories (Trezor) and NEAR/`elliptic` noise (HOT) without affecting Freighter, LOBSTR, WalletConnect, etc.

The experimental `marketplace-with-token` template does not ship this file yet. If you use pnpm with that template, copy the same `pnpm-workspace.yaml` block from `react-vite-counter`.

Set `CAATINGA_TEMPLATES_DIR` during local development to point the CLI at a custom templates directory.

## Alpha smoke path

The official template documents both paths:

1. CLI: `build -> deploy -> generate -> invoke`
2. Browser/client: generated bindings + `caatinga.artifacts.json` + `@caatinga/client` + Stellar Wallets Kit adapter

The template includes wallet UI state for the generated app, but does not generate `caatinga generate --interop` output in alpha.

Browser-facing templates should import errors and artifact types from `@caatinga/core/browser` (see `react-vite-counter/src/caatinga.ts`). Keep the full `@caatinga/core` entry for Node-only config (`caatinga.config.ts`, CLI workflows).
