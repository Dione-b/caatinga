## Breaking changes policy

## 2.4.2

### Patch Changes

- Sync all documentation with current codebase: add missing `read` command, ZK library API, config schema, subpath exports, CLI flags, error codes, and fix version references to 2.4.1.
- Updated dependencies
  - @caatinga/core@2.4.2

## 2.4.1

### Patch Changes

- Updated dependencies
  - @caatinga/core@2.4.1

## 2.4.0

### Minor Changes

- DX release for custom and minimal Soroban projects:

  - Add `caatinga init --minimal` / `--empty` (CLI + Soroban contract stub, no frontend template).
  - Add `caatinga read` for read-only contract simulation without signing.
  - Improve `caatinga doctor` with a dependencies check (`CAATINGA_DEPENDENCIES_NOT_INSTALLED`) before config parsing.
  - Harden subprocess PATH resolution so an older `stellar` in `~/.cargo/bin` does not shadow a newer CLI on PATH.
  - Default `--source-account` for `caatinga read` via `CAATINGA_SOURCE` or `alice`.
  - Export `@caatinga/client/vite` wallet stub helpers; update templates to use them.
  - Add read-call hints in CLI and client when `invoke()` targets a read-only method.
  - Add `assertSorobanSymbol` on `@caatinga/core/browser` and docs for Soroban types, project scaffolds, and client layout.

### Patch Changes

- Updated dependencies
  - @caatinga/core@2.4.0

## 2.3.1

### Patch Changes

- Add hybrid zk-starter browser verification, `@caatinga/zk/browser`, and unwrap Stellar `Result` values in client read/simulate flows.
- Updated dependencies
  - @caatinga/core@2.3.1

## 2.3.0

### Minor Changes

- Add ZK workflow support: publish `@caatinga/zk`, CLI commands (`zk-init`, `zk-build`, `zk-prove`, `zk-invoke`), and the `zk-starter` template for Circom Groth16 verifiers on Soroban.

### Patch Changes

- Unwrap Stellar SDK `Result<T>` values in `read()` / `simulate()` and call `simulate()` on bindings that do not expose `prepare()`.
- Updated dependencies
  - @caatinga/core@2.3.0

## 2.2.1

### Patch Changes

- Restore install-time dependency overrides in the `react-vite-counter` template so `npm install` and `pnpm install` no longer pull deprecated WalletConnect 2.11, Trezor Connect, HOT Wallet, Safe, and `uuid@8` transitives. Keep Vite aliases as a bundler safety net and add consumer CI checks for deprecated install warnings.
- Updated dependencies
  - @caatinga/core@2.2.1

## 2.2.0

### Minor Changes

- 9cc6a93: DX refactor: deploy auto-generates bindings, `caatinga status`, wallet sessions + React hooks.

  **Behavior change — `caatinga deploy` now generates TypeScript bindings automatically** for the
  contracts it deploys. Pass `--no-generate` to keep the old deploy-only behavior (recommended for
  CI jobs that deploy without binding prerequisites). A generation failure never fails the deploy:
  the CLI prints a warning and the recovery command (`npx caatinga generate --network <network>`).

  CLI:

  - New `caatinga status [--network <name>] [--json]` command: per-network table of deployed
    contracts, contract IDs, WASM hashes, dependencies, and binding freshness.
  - `caatinga doctor --network <name>` prints an advisory `Bindings (<network>)` section with
    per-contract freshness (never blocks).
  - `caatinga generate` (all-contracts mode) prints binding freshness before regenerating.

  Core:

  - Binding freshness tracking via a `.caatinga-bindings.json` sidecar marker written next to each
    generated binding package (records `contractId`, `wasmHash`, network, `generatedAt`). New
    exports: `evaluateBindingFreshness`, `evaluateBindingsFreshness`, `readBindingMarker`,
    `writeBindingMarker`, `collectProjectStatus`.
  - `generateBindingsGraph` accepts `contractNames` to regenerate a specific subset.

  Client:

  - `createWalletSession(adapter, options?)`: framework-agnostic wallet connection state
    (`disconnected`/`connecting`/`connected`), subscriptions, optional `localStorage` persistence,
    and silent `restore()` for page-load reconnects.
  - New `@caatinga/client/react` subpath with `WalletProvider`, `useWallet`, and
    `useWalletSession` (optional `react >= 18` peer dependency).
  - Stellar Wallets Kit adapter exposes `getWalletId()` so sessions can persist and re-select the
    chosen wallet.
  - The `react-vite-counter` template and `examples/counter-web` now use the provider/hook instead
    of a hand-rolled wallet context.
  - Stellar Wallets Kit adapter falls back to `fetchAddress()` when `getAddress()` has no cached
    address (custom wallet modal flow).
  - `react-vite-counter` template: `ContractNotDeployed` gate before wallet connect, custom
    `WalletModal`, Vite alias stubs for cross-package-manager installs, and corrected
    `caatinga:deploy` / `caatinga:generate` npm scripts.

### Patch Changes

- Updated dependencies [9cc6a93]
  - @caatinga/core@2.2.0

## 2.2.0

### Minor Changes

- Upgrade the optional Stellar Wallets Kit peer dependency to `^2.3.0` (Reown AppKit, WalletConnect 2.23).
- Adapt `createStellarWalletsKitAdapter` to SWK 2.x static API while keeping the Caatinga-facing surface (`openModal`, `WalletNetwork`, etc.) stable.
- Remove deprecated transitive installs (`@walletconnect/modal`, `@motionone/vue`, `lodash.isequal`, old `@walletconnect/sign-client`, `@safe-global/safe-gateway-typescript-sdk` via template npm/pnpm overrides).
- Block unused SWK direct deps (`@trezor/connect-web`, `@hot-wallet/sdk`) in the counter template so `npm audit` no longer reports critical `protobufjs` advisories from Trezor.

## 2.1.0

### Minor Changes

- Fail loudly when an app still uses scaffolded placeholder bindings, and surface the underlying cause on signing failures.

  - Add `CAATINGA_PLACEHOLDER_BINDING` error code. The binding adapter now throws it from `createClient` (before any wallet/RPC call) when bindings have not been generated, instead of letting a fake-XDR transaction reach the wallet and surface as a misleading `CAATINGA_XDR_SIGN_FAILED`.
  - The scaffolded placeholder stub (`react-vite-counter`) now throws `CAATINGA_PLACEHOLDER_BINDING` with a "run `caatinga generate`" hint instead of returning fake XDR.
  - Add `formatCaatingaError` (exported from `@caatinga/core` and `@caatinga/core/browser`), which renders `[code] message`, the hint, and `Details: <cause>` so the real wallet/RPC error is no longer hidden. The counter template and example now use it.
  - `caatinga deploy` output now prints a `Next: caatinga generate … / npm run dev` breadcrumb so the post-deploy step is no longer a dead end.

### Patch Changes

- Updated dependencies
  - @caatinga/core@2.1.0

## 2.0.2

### Patch Changes

- @caatinga/core@2.0.2

## 2.0.1

### Patch Changes

- Migrate the wallet flow to the npm-published @creit.tech/stellar-wallets-kit: connect-first UX with shared wallet context, installed-wallet selection modal, HOT Wallet/NEAR chain removed from the browser bundle, and a loading-modal overlay replacing the "Not loaded" flash.
  - @caatinga/core@2.0.1

## 2.0.0

### Major Changes

- feat(core)!: replace hard Stellar CLI upper bound with feature-aware compatibility

  The hard floor (`23.0.0`) is preserved because 22.x cannot sign
  `stellar contract invoke` (xdr value invalid). The tested maximum is now
  **advisory**; versions above the last-tested `25.2.0` are accepted with a
  non-fatal stderr advisory and a `caatinga doctor` warning. No override flag
  is required.

  ### Breaking changes (2.0.0)

  Removed public surface:

  - `STELLAR_CLI_TESTED_MAX_VERSION` export from `@caatinga/core`. Use the
    advisory `STELLAR_CLI_LAST_TESTED_VERSION` constant instead.
  - `assertSupportedStellarCliVersion` export. Use
    `evaluateStellarCliCompatibility` for the new feature-aware check.
  - `CAATINGA_UNTESTED_CLI_VERSION` error code. The hard floor error
    `CAATINGA_UNSUPPORTED_CLI_VERSION` is the only remaining hard failure.
  - `--allow-untested-stellar-cli` flag from `build`, `deploy`, `generate`,
    `invoke`, and `doctor` commands. The override is no longer required.
  - `allowUntestedStellarCli` field on `RunCommandOptions`,
    `BuildContractOptions`, `DeployContractOptions`,
    `DeployContractGraphOptions`, `VerifyDependencyContractOptions`,
    `VerifyDependencyContractsOptions`, `InvokeContractOptions`,
    `GenerateBindingsOptions`, and `RunAllDiagnosticsOptions`.

  ### Added

  - `evaluateStellarCliCompatibility({ version, features?, lastTestedVersion? })`
    returning a `CompatibilityReport` with `version`, `status` (`"supported" |
"untested" | "unsupported"`), `minVersion`, `lastTestedVersion`, and
    `warnings[]`. Stub `features` arg is wired through the API and tests but
    does not perform live probes yet.
  - `checkStellarCliVersion(options?)` exported from `@caatinga/core` for
    advanced integrations that want to drive the gate themselves.
  - `Diagnostic.warnings` on the doctor diagnostic type; the Stellar CLI
    diagnostic now reports advisory warnings (e.g.
    `STELLAR_CLI_UNTESTED_VERSION`, `STELLAR_CLI_MISSING_FEATURE`).

  ### Documentation

  - [Stellar CLI version contract](../docs/stellar-cli-version-contract.md)
    rewritten around the hard floor + advisory last-tested model.
  - [CLI reference](../docs/cli.md), [From Zero to Testnet](../docs/tutorials/from-zero-to-testnet.md),
    [Errors](../docs/errors.md), and the package READMEs updated to drop
    references to `--allow-untested-stellar-cli` and `CAATINGA_UNTESTED_CLI_VERSION`.

  ### Migration

  If you previously relied on `--allow-untested-stellar-cli` to bypass a
  newer-than-25.2.0 Stellar CLI, simply remove the flag — the new model
  accepts those versions by default with a non-fatal warning. If you depended
  on `CAATINGA_UNTESTED_CLI_VERSION` for CI gating, switch to
  `CAATINGA_UNSUPPORTED_CLI_VERSION` (the only remaining hard failure on the
  version axis).

- Updated dependencies [6aa89e1]
- Updated dependencies
  - @caatinga/core@2.0.0

## 0.2.4

### Patch Changes

- Add a `prepack` script to `@caatinga/cli` so every `pnpm pack` / `pnpm publish` tarball is built through the step that copies templates into the package. `caatinga init` now succeeds from a `file:`-tarball install of `@caatinga/cli` in a fresh project without `CAATINGA_TEMPLATES_DIR`, and the `TEMPLATE_NOT_FOUND` error message points at the new prerequisite. A `CAATINGA_DEBUG_TEMPLATE_RESOLUTION=1` env var prints the candidates tried when resolution still fails. CI gates in `ci-snapshot-pack` and `consumer-isolation` now require every `packages/templates/*` directory to appear in the CLI tarball, not only `react-vite-counter`.
- Updated dependencies
  - @caatinga/core@0.2.4

## 0.2.3

### Patch Changes

- Add first-class read-only contract calls with `contract(name).simulate()` and `contract(name).read()`, plus the `CAATINGA_READ_RESULT_MISSING` error code for simulated calls without a usable result.
- Add the optional `@caatinga/client/stellar-wallets-kit` adapter subpath and update counter examples/templates to read on-chain counter state instead of relying on local state.
- Updated dependencies
  - @caatinga/core@0.2.3

## 0.2.2

### Patch Changes

- Fix Soroban WASM artifact resolution for `wasm32v1-none` builds. Official templates now ship the current target path, legacy `wasm32-unknown-unknown` config paths resolve automatically after build and deploy, and CI blocks reintroducing the deprecated target in bundled templates.
- Updated dependencies
  - @caatinga/core@0.2.2

Public API contract and `CAATINGA_*` error code stability are documented in
[`docs/release/v1.0.0.md`](../../docs/release/v1.0.0.md) and [`docs/errors.md`](../../docs/errors.md).
Consult those documents when upgrading across minor versions during the `0.x` phase.

# @caatinga/client

## 0.2.1

### Patch Changes

- Updated dependencies [f0f3ed7]
  - @caatinga/core@0.2.1

## 0.2.0

### Minor Changes

- Initial release of Caatinga — developer toolkit for building dApps on Stellar/Soroban.

### Patch Changes

- Updated dependencies
  - @caatinga/core@0.2.0

## 0.1.4

### Patch Changes

- @caatinga/core@0.1.4

## 0.1.3

### Patch Changes

- fix release validation so packed CLI tarballs must include bundled templates and consumer init is exercised without CAATINGA_TEMPLATES_DIR
- Updated dependencies
  - @caatinga/core@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies
  - @caatinga/core@0.1.2

## 0.1.1

### Patch Changes

- f93527c: Initial pre-v1 release (next tag). Validates metadata, consumer isolation, and core workflow.
- cf14f20: Publish consumer-facing package documentation and release-process alignment for the first public release track.
- Updated dependencies [f93527c]
- Updated dependencies [cf14f20]
  - @caatinga/core@0.1.1
