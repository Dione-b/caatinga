## Breaking changes policy

Public API contract and `CAATINGA_*` error code stability are documented in
[`docs/release/v1.0.0.md`](../../docs/release/v1.0.0.md) and [`docs/errors.md`](../../docs/errors.md).
Consult those documents when upgrading across minor versions during the `0.x` phase.

# @caatinga/cli

## 0.2.1

### Patch Changes

- f0f3ed7: Fix official template `compatibleCore` ranges for core 0.2.x and add CI/tests so bundled templates stay aligned with `CAATINGA_CORE_VERSION`.
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

- Fix the published CLI version output and normalize absolute init paths to project directory names.
  - @caatinga/core@0.1.4

## 0.1.3

### Patch Changes

- fix release validation so packed CLI tarballs must include bundled templates and consumer init is exercised without CAATINGA_TEMPLATES_DIR
- update the generated contract build-path and Stellar CLI compatibility notes to match the then-supported Stellar CLI flow and the current maximum tested Stellar CLI version `25.2.0`
- Updated dependencies
  - @caatinga/core@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies
  - @caatinga/core@0.1.2

## 0.1.1

### Patch Changes

- 1e7c432: fix: bundle templates inside the CLI package so npx init can resolve them correctly.
- f93527c: Initial pre-v1 release (next tag). Validates metadata, consumer isolation, and core workflow.
- cf14f20: Publish consumer-facing package documentation and release-process alignment for the first public release track.
- Updated dependencies [f93527c]
- Updated dependencies [cf14f20]
  - @caatinga/core@0.1.1
