## Breaking changes policy

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
