## Breaking changes policy

Public API contract and `CAATINGA_*` error code stability are documented in
[`docs/release/v1.0.0.md`](../../docs/release/v1.0.0.md) and [`docs/errors.md`](../../docs/errors.md).
Consult those documents when upgrading across minor versions during the `0.x` phase.

# @caatinga/core

## 0.2.1

### Patch Changes

- f0f3ed7: Fix official template `compatibleCore` ranges for core 0.2.x and add CI/tests so bundled templates stay aligned with `CAATINGA_CORE_VERSION`.

## 0.2.0

### Minor Changes

- Initial release of Caatinga — developer toolkit for building dApps on Stellar/Soroban.

## 0.1.4

## 0.1.3

### Patch Changes

- fix release validation so packed CLI tarballs must include bundled templates and consumer init is exercised without CAATINGA_TEMPLATES_DIR
- fix the generated contract build path to match the then-supported Stellar CLI flow again, keeping Caatinga aligned with the current maximum tested Stellar CLI version `25.2.0`

## 0.1.2

### Patch Changes

- fix: bump maximum tested Stellar CLI version to 25.2.0 to support modern installations out of the box.

## 0.1.1

### Patch Changes

- f93527c: Initial pre-v1 release (next tag). Validates metadata, consumer isolation, and core workflow.
- cf14f20: Publish consumer-facing package documentation and release-process alignment for the first public release track.
