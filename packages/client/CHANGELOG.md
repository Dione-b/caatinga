## Breaking changes policy

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
