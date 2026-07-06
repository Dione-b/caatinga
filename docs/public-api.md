# Public API Manifest (v1.0)

This document is the authoritative tier list for Caatinga v1.0. **Breaking changes to Tier 1 require a major version bump** (after the v1.0 contract freeze, npm major remains `3.x` until an explicit `4.0.0`).

See also: [Architecture freeze](./architecture-freeze.md), [v1.0.0 Interface Contract](./internal/release/v1.0.0.md), [Errors](./errors.md).

---

## Tier 1 — Supported v1 (stable contract)

Automation and application code may depend on these surfaces without importing private paths.

### CLI (`@caatinga/cli`)

Supported flow: `init → build → deploy → generate → invoke`

| Domain                 | Commands                                                        |
| ---------------------- | --------------------------------------------------------------- |
| Scaffolding & Setup    | `init`, `setup`, `identity`                                     |
| Build                  | `build`                                                         |
| Deployment & Lifecycle | `deploy`, `upgrade`, `rollback`, `wire`                         |
| Query & Execution      | `read`, `invoke`, `estimate`, `dev`                             |
| Status & Diagnostics   | `status`, `inspect`, `doctor`, `sync-env`, `migrate`, `version` |
| Automation & CI        | `smoke`, `regression`, `ci`                                     |

All commands, flags, exit codes (`0` / `1`), and `CAATINGA_*` error codes are documented in [cli.md](./cli.md) and [errors.md](./errors.md).

ZK commands (`zk-init`, `zk-build`, `zk-prove`, `zk-invoke`) are **experimental** — see [scope.md](./scope.md).

### Runtime client (`@caatinga/client`)

Root exports:

- `createCaatingaClient`
- `resolveContractId`
- `createDefaultBindingAdapter`
- `CaatingaContractClient`
- `buildXdr`
- `createWalletSession`, `WALLET_SESSION_STORAGE_KEY`

Types: `CaatingaBindingAdapter`, `CaatingaClientConfig`, `CaatingaContractRegistration`, `CaatingaInvokeOptions`, `CaatingaInvokeResult`, `CaatingaInvokeStatus`, `CaatingaNetwork`, `CaatingaReadOptions`, `CaatingaReadResult`, `CaatingaWalletAdapter`, `CaatingaXdrBuildResult`, wallet session types.

Subpaths:

- `@caatinga/client/freighter` → `freighterWalletAdapter`
- `@caatinga/client/react` → React hooks and provider
- `@caatinga/client/stellar-wallets-kit` → Stellar Wallets Kit adapter
- `@caatinga/client/vite` → Vite plugin helpers

### Browser-safe core (`@caatinga/core/browser`)

- `CaatingaError`, `CaatingaErrorCode`, `toCaatingaError`, `formatCaatingaError`
- Types: `CaatingaArtifacts`, `ContractArtifact`, `ContractMetadata`
- `assertSorobanSymbol`

### Config (authoring)

- `defineConfig` from `@caatinga/core`
- `CaatingaConfig`, `ContractConfig`, `NetworkConfig` types
- `caatinga.config.ts` shape validated by `CaatingaConfigSchema`

### Artifacts (consumption)

- `caatinga.artifacts.json` schema version `2` (see [artifacts-spec.md](./artifacts-spec.md))
- `readArtifacts` for programmatic reads in Node tooling

### Errors

All `CAATINGA_*` codes in [errors.md](./errors.md). Enforced by `error-surface.test.ts`.

---

## Tier 2 — Published but advanced

Exported from `@caatinga/core` for power users and CI. **Additive changes are minor; removals or semantic changes are breaking.**

| Area          | Symbols                                                                                                                                                                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Artifacts     | `writeArtifacts`, `createInitialArtifacts`, `updateArtifact`, `restoreArtifactFromHistory`, `collectDeploymentMetadata`, `migrateArtifactsToV2`, `migrateArtifactsFile`, `rollbackContractArtifact`, `CURRENT_ARTIFACTS_SCHEMA_VERSION`, `collectProjectStatus` |
| Deployment    | `deployContract`, `deployContractGraph`, `upgradeContractInPlace`, `uploadWasm`, `buildContract`, `buildWorkspace`, `resolveDeployArgs`, `resolveDeployOrder`, `buildDependencyGraph`, `runPostDeployHooks`                                                     |
| Bindings      | `generateBindings`, `generateBindingsGraph`, `evaluateBindingFreshness`, `evaluateBindingsFreshness`, `readBindingMarker`, `writeBindingMarker`                                                                                                                 |
| Invoke / read | `invokeContract`, `readContract`, `estimateDeployCost`, `inspectContract`, `verifyExpect`, `runSmokeReads`                                                                                                                                                      |
| Networks      | `resolveNetwork`, `WELL_KNOWN_NETWORKS`                                                                                                                                                                                                                         |
| Config load   | `loadConfig`, `CaatingaConfigSchema`                                                                                                                                                                                                                            |
| Templates     | `createProjectFromTemplate`, `TemplateManifestSchema`                                                                                                                                                                                                           |

---

## Tier 3 — Internal (no stability guarantee)

Present in `@caatinga/core` for CLI and monorepo use. **Do not depend on these in application code.**

| Area                 | Examples                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| Shell                | `runCommand`, `checkBinary`, `resolveSubprocessEnv`, `isCargoBinMissingFromPath`                |
| Stellar CLI adapters | `parseContractId`, `parseWasmHash`, `checkStellarCliVersion`, `evaluateStellarCliCompatibility` |
| Scaffolds            | `createMinimalProject`, `createZkProject`                                                       |
| CI helpers           | `isTransientTestnetSmokeFailure`                                                                |
| Source validation    | `validateSourceShape`, `describeCliSource`                                                      |

---

## Regression enforcement

- `packages/core/src/public-api/export-manifest.test.ts` — Tier 1 client exports snapshot
- `packages/core/src/errors/error-surface.test.ts` — all `CAATINGA_*` codes documented and tested
- `packages/core/src/compat/exports-snapshot.test.ts` — package `exports` field snapshot
- `pnpm test:compat` — artifacts migration and consumer isolation

---

## Versioning note

**v1.0** is a **contract milestone**, not an npm major renumber. Packages ship as `@caatinga/*@3.x` with `latest` dist-tag when RC gates pass. Breaking changes to Tier 1 after v1.0 require `4.0.0`.
