## Breaking changes policy

## 3.4.2

### Patch Changes

- Fix `caatinga setup` DX from Ubuntu smoke-test findings: include `libssl-dev` in Stellar CLI build dependency hints, skip identity creation when Stellar CLI install fails, log compile-time expectations before `cargo install`, and expand post-setup next steps.
- Updated dependencies
  - @caatinga/core@3.4.2

## 3.4.1

### Patch Changes

- @caatinga/core@3.4.1

## 3.4.0

### Patch Changes

- @caatinga/core@3.4.0

## 3.3.1

### Patch Changes

- Updated dependencies [b7372f9]
  - @caatinga/core@3.3.1

## 3.3.0

### Minor Changes

- feat: production readiness, artifact history, and compatibility hardening

  **Positioning & docs**

  - Reposition README and architecture around git-driven artifacts, multi-contract deploy, and sovereignty (ZK moved to Advanced section).
  - Add signing strategy, production readiness checklist, contract upgrade tutorial, internal counter-web case study, and outreach template.

  **CLI**

  - Add `caatinga migrate artifacts` (schema v1 → v2).
  - Add `caatinga rollback <contract> --to <contractId>` (logical artifact restore; on-chain state unchanged).
  - Add `caatinga estimate deploy` and `deploy --dry-run` (advisory fee estimate via Stellar CLI build-only + simulate).
  - Add `caatinga inspect <contract>` (artifact vs on-chain reachability vs local WASM hash).
  - Add `deploy --upgrade` (semantic alias for `--force` with upgrade history reason).
  - Enrich `caatinga doctor` with `@stellar/stellar-sdk` compatibility, signing guidance, and production checklist link.

  **Core**

  - Artifact schema **v2** with deploy history on `--force` / `--upgrade`; new projects initialize at v2.
  - Stellar CLI live capability probes (`contract-build`, `contract-deploy`, `contract-invoke-sign`) in version gate.
  - `@stellar/stellar-sdk` version contract (`evaluateStellarSdkCompatibility`, check before `generate`).
  - New public error codes: `CAATINGA_UNSUPPORTED_SDK_VERSION`, `CAATINGA_STELLAR_SDK_VERSION_PARSE_FAILED`, `CAATINGA_ROLLBACK_TARGET_NOT_FOUND`, `CAATINGA_ESTIMATE_FAILED`.

  **CI**

  - Add `stellar-cli-matrix` job (fixtures + live probes for Stellar CLI 23.0.0, 24.0.0, 25.2.0).

  **Notes**

  - v1 `caatinga.artifacts.json` files remain readable; run `caatinga migrate artifacts` to bump the file version without redeploying.
  - Cost estimates are advisory only; mainnet signing, KMS, and multisig remain out of alpha scope (see `docs/signing-strategy.md`).

### Patch Changes

- Updated dependencies
  - @caatinga/core@3.3.0

## 3.2.0

### Minor Changes

- Add dev-ceremony manifest (`ceremony.json`) on `buildCircuit`, `assertDevCeremonyAllowed`, and `isProductionNetwork` exports for CLI guardrails.

### Patch Changes

- Updated dependencies
  - @caatinga/core@3.2.0

## 3.1.2

### Patch Changes

- Pin `ws@^8.21.0` and top-level Trezor/HOT stubs in official templates to clear ~14 high npm audit findings from the Reown/viem chain. Add ZK CLI install progress (circom download bar, phase messages), fix circom cache path reuse, and document the template override maintainer contract.
- Updated dependencies
  - @caatinga/core@3.1.2

## 3.1.1

### Patch Changes

- 54a0e4f: Patch generated Soroban bindings for Vite: normalize binding `package.json` to `./src/index.ts` and add a root `index.ts` re-export after `caatinga generate`. Harden `zk-starter` with `caatinga:zk:setup`, clearer ZK artifact docs, and CI vite build checks.
- Updated dependencies [54a0e4f]
  - @caatinga/core@3.1.1

## 3.0.2

### Patch Changes

- fix(core): correção
- Updated dependencies
  - @caatinga/core@3.0.2

## 3.0.1

### Patch Changes

- bac021e: feat: add local pre-publish validation orchestrator

  Adds `scripts/pre-publish.sh` and `pnpm pre:publish` / `pre:publish:keep-going` scripts at the repo root. Runs the existing local checks (version-alignment, ci-stellar-pin, fixture-references, wasm-target-paths, typecheck, lint, format, docs, build, test) followed by `pnpm publish -r --dry-run --tag <tag>`, with per-stage status, a summary table, fail-fast by default, and `--keep-going` / `--skip` / `--tag` flags. No network, no working-tree mutations — intended as a manual pre-flight before `pnpm publish -r`.

- Updated dependencies [bac021e]
  - @caatinga/core@3.0.1

## 2.4.5

### Patch Changes

- Address Caatinga usability feedback from ZK and CLI testing:

  - Standardize `caatinga zk invoke` on `--source` (aligned with deploy/invoke)
  - Build all configured contracts when `caatinga build` is run without a contract name
  - Generate real BLS12-381 coordinates in `vk.rs` with `caatinga zk build --embed-vk` (no `todo!()` stub)
  - Map on-chain ZK verification failures to `CAATINGA_ZK_VERIFICATION_FAILED` instead of `CAATINGA_UNEXPECTED_ERROR`

- Updated dependencies
  - @caatinga/core@2.4.5

## 2.4.4

### Patch Changes

- Align official templates with the current `@caatinga/core` release, fix `ci-snapshot-pack` core version capture, and narrow consumer isolation deprecated-dependency checks to wallet SDK packages only.
- Updated dependencies
  - @caatinga/core@2.4.4

## 2.4.3

### Patch Changes

- Updated dependencies
  - @caatinga/core@2.4.3

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
