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
- Add `@caatinga/zk/browser` for browser-safe proof serialization and verifier binding args.
- Document compatibility with both `zk-starter` and the new minimal ZK scaffold.

### Patch Changes

- Updated dependencies
  - @caatinga/core@2.3.0

## 2.2.1

### Minor Changes

- Initial `@caatinga/zk` release: Circom Groth16 proof serialization, circuit build/prove helpers, and Soroban verifier invoke bridge for the Caatinga ZK workflow.
