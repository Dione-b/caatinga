## Breaking changes policy

## 3.9.0

## 3.8.0

### Minor Changes

- Add `docs/public-api.md` tier manifest and `export-manifest.test.ts` regression guard for `@caatinga/client` Tier 1 exports.
- Add compatibility suite: artifacts v1/v2 fixtures, `migrateArtifactsFile` disk tests, package exports snapshot (`pnpm test:compat`).
- Atomic `writeArtifacts` (temp file + rename) to prevent corrupted JSON on interrupted writes.
- Add `recovery-scenarios.test.ts` and `docs/recovery-scenarios.md`.
- Templates `compatibleCore` pinned to `^3.8.0`.

## 3.7.0

### Minor Changes

- Add in-place Soroban contract upgrades via `caatinga upgrade`.

  Orchestrates build, `stellar contract upload`, and admin-gated `upgrade(new_wasm_hash)` invokes while preserving the existing `contractId`. Records prior WASM hashes in artifact history (`upgradeStrategy: "in-place"`, `upgradeType: "in-place"`). Adds `uploadWasm`, `upgradeContractInPlace`, `parseWasmHash`, and error codes `CAATINGA_UPLOAD_FAILED` / `CAATINGA_WASM_HASH_NOT_FOUND`. Distinct from `deploy --upgrade`, which redeploys a new instance.

### Patch Changes

- 60954dd: Validate multi-contract dependency graphs while loading config.

  Caatinga now fails fast when `dependsOn` references are missing, dependency cycles exist, or `${contracts.<name>.contractId}` deploy arg placeholders are not declared in `dependsOn`.

## 3.6.1

### Patch Changes

- bump Stellar CLI last-tested to 27.0.0

## 3.6.0

### Minor Changes

- cfac892: Add Radox gap resolution features:

  - `buildFeatures` per contract for Cargo feature gates
  - `.wasmHash` suffix in `frontend.env` mappings for WASM hash sync
  - `source` override per `postDeploy` hook
  - `expect` assertion in `postDeploy` hooks with `POST_DEPLOY_VERIFY_FAILED` error
  - Validate per-hook `source` through `assertSafeSourceAccount`

## 3.5.1

### Patch Changes

- Retry transient post-deploy hook failures (TxBadSeq, timeouts, connection resets) with exponential backoff during `caatinga wire` and after `caatinga deploy`. Detects transient errors via `isTransientCommandFailure` and retries with configurable delays (2s/5s default).

## 3.5.0

### Minor Changes

- 6a3b25b: Add a declarative multi-contract workflow validated against stellar-album:

  - `${source.address}` placeholder for deploy/wire args, resolved via `stellar keys address <source>`.
  - `postDeploy` hooks in `caatinga.config.ts`, run by the new `caatinga wire` command and automatically after a full `caatinga deploy` (skip with `--no-wire`).
  - `frontend.envFile` + `frontend.env` mapping, written by the new `caatinga sync-env` command and automatically after a full deploy (skip with `--no-sync-env`).
  - `buildRoot` for Cargo workspaces: a single `stellar contract build` from the workspace root instead of per-crate builds.
  - New error code `CAATINGA_SOURCE_ADDRESS_UNRESOLVED`.

  See ADR 0006 and the stellar-album case study for the design rationale.

## 3.4.2

### Patch Changes

- Fix `caatinga setup` DX from Ubuntu smoke-test findings: include `libssl-dev` in Stellar CLI build dependency hints, skip identity creation when Stellar CLI install fails, log compile-time expectations before `cargo install`, and expand post-setup next steps.

## 3.4.1

### Patch Changes

- Version alignment for `@caatinga/cli` 3.4.1 security and DX release.

## 3.4.0

## 3.3.1

### Patch Changes

- b7372f9: Fix four CLI bugs across `zk init`, `read`, and `doctor`:

  - `caatinga zk init --force` no longer crashes with `ENOENT` when the project's `node_modules` contains a dangling symlink. The template-variable pass now skips excluded directories (`node_modules`, `target`, `.git`, `test_snapshots`) and uses `lstat`, so symlinks are never dereferenced.
  - `caatinga read` now discloses which Stellar source identity it resolved and where it came from (`CAATINGA_SOURCE` or the built-in `alice` default) when `-s/--source` is omitted, and the flag help documents the fallback. Explicit `--source` stays silent.
  - `caatinga doctor` reports `Project dependencies not installed` exactly once instead of twice before `npm install`.
  - `caatinga doctor` no longer falsely reports `network <name> not found` before `npm install`; the network check is skipped when the config cannot load due to missing dependencies.

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

## 3.2.0

### Minor Changes

- Add `CAATINGA_ZK_DEV_CEREMONY_BLOCKED` and map `ZK_DEV_CEREMONY_BLOCKED` from `@caatinga/zk`.
- Restrict `frontend.framework` schema to `vite-react` only (remove unused `next`/`astro` enum values).

## 3.1.2

### Patch Changes

- Pin `ws@^8.21.0` and top-level Trezor/HOT stubs in official templates to clear ~14 high npm audit findings from the Reown/viem chain. Add ZK CLI install progress (circom download bar, phase messages), fix circom cache path reuse, and document the template override maintainer contract.

## 3.1.1

### Patch Changes

- 54a0e4f: Patch generated Soroban bindings for Vite: normalize binding `package.json` to `./src/index.ts` and add a root `index.ts` re-export after `caatinga generate`. Harden `zk-starter` with `caatinga:zk:setup`, clearer ZK artifact docs, and CI vite build checks.

## 3.0.2

### Patch Changes

- fix(core): correção

## 3.0.1

### Patch Changes

- bac021e: feat: add local pre-publish validation orchestrator

  Adds `scripts/pre-publish.sh` and `pnpm pre:publish` / `pre:publish:keep-going` scripts at the repo root. Runs the existing local checks (version-alignment, ci-stellar-pin, fixture-references, wasm-target-paths, typecheck, lint, format, docs, build, test) followed by `pnpm publish -r --dry-run --tag <tag>`, with per-stage status, a summary table, fail-fast by default, and `--keep-going` / `--skip` / `--tag` flags. No network, no working-tree mutations — intended as a manual pre-flight before `pnpm publish -r`.

## 2.4.5

### Patch Changes

- Address Caatinga usability feedback from ZK and CLI testing:

  - Standardize `caatinga zk invoke` on `--source` (aligned with deploy/invoke)
  - Build all configured contracts when `caatinga build` is run without a contract name
  - Generate real BLS12-381 coordinates in `vk.rs` with `caatinga zk build --embed-vk` (no `todo!()` stub)
  - Map on-chain ZK verification failures to `CAATINGA_ZK_VERIFICATION_FAILED` instead of `CAATINGA_UNEXPECTED_ERROR`

## 2.4.4

### Patch Changes

- Align official templates with the current `@caatinga/core` release, fix `ci-snapshot-pack` core version capture, and narrow consumer isolation deprecated-dependency checks to wallet SDK packages only.

## 2.4.3

### Patch Changes

- Fix CLI `--version` to read the version from `package.json` instead of a hardcoded constant, preventing published versions from reporting the wrong version number.

  Fix `@caatinga/core` `CAATINGA_CORE_VERSION` to read from `package.json` as well, and update official templates to `^2.4.2` so they stay compatible with the current core version.

  Avoid mentioning the frontend in the post-build deploy warning when the project has no `frontend` configuration.

## 2.4.2

### Patch Changes

- Sync all documentation with current codebase: add missing `read` command, ZK library API, config schema, subpath exports, CLI flags, error codes, and fix version references to 2.4.1.

## 2.4.1

### Patch Changes

- Resolve WASM artifacts under `CARGO_TARGET_DIR` when the configured path is missing.
- Fix minimal and zk-minimal scaffold deploy/doctor npm scripts (`--network`, `--source`).

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

## 2.3.1

### Patch Changes

- Add hybrid zk-starter browser verification, `@caatinga/zk/browser`, and unwrap Stellar `Result` values in client read/simulate flows.

## 2.3.0

### Minor Changes

- Add ZK workflow support: publish `@caatinga/zk`, CLI commands (`zk-init`, `zk-build`, `zk-prove`, `zk-invoke`), and the `zk-starter` template for Circom Groth16 verifiers on Soroban.
- Add a programmatic minimal ZK scaffold API and allow ZK-only configs without `frontend`.

## 2.2.1

### Patch Changes

- Restore install-time dependency overrides in the `react-vite-counter` template so `npm install` and `pnpm install` no longer pull deprecated WalletConnect 2.11, Trezor Connect, HOT Wallet, Safe, and `uuid@8` transitives. Keep Vite aliases as a bundler safety net and add consumer CI checks for deprecated install warnings.

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

## 2.1.0

### Minor Changes

- Fail loudly when an app still uses scaffolded placeholder bindings, and surface the underlying cause on signing failures.

  - Add `CAATINGA_PLACEHOLDER_BINDING` error code. The binding adapter now throws it from `createClient` (before any wallet/RPC call) when bindings have not been generated, instead of letting a fake-XDR transaction reach the wallet and surface as a misleading `CAATINGA_XDR_SIGN_FAILED`.
  - The scaffolded placeholder stub (`react-vite-counter`) now throws `CAATINGA_PLACEHOLDER_BINDING` with a "run `caatinga generate`" hint instead of returning fake XDR.
  - Add `formatCaatingaError` (exported from `@caatinga/core` and `@caatinga/core/browser`), which renders `[code] message`, the hint, and `Details: <cause>` so the real wallet/RPC error is no longer hidden. The counter template and example now use it.
  - `caatinga deploy` output now prints a `Next: caatinga generate … / npm run dev` breadcrumb so the post-deploy step is no longer a dead end.

## 2.0.2

### Patch Changes

- fix(generate-bindings): align generated bindings layout with Stellar CLI output, remove legacy flat stubs, and print the correct import path after `caatinga generate`.

## 2.0.1

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

## 0.2.4

### Patch Changes

- Add a `prepack` script to `@caatinga/cli` so every `pnpm pack` / `pnpm publish` tarball is built through the step that copies templates into the package. `caatinga init` now succeeds from a `file:`-tarball install of `@caatinga/cli` in a fresh project without `CAATINGA_TEMPLATES_DIR`, and the `TEMPLATE_NOT_FOUND` error message points at the new prerequisite. A `CAATINGA_DEBUG_TEMPLATE_RESOLUTION=1` env var prints the candidates tried when resolution still fails. CI gates in `ci-snapshot-pack` and `consumer-isolation` now require every `packages/templates/*` directory to appear in the CLI tarball, not only `react-vite-counter`.

## 0.2.3

### Patch Changes

- Add `CAATINGA_READ_RESULT_MISSING` to the public error-code surface for browser client read/simulate calls that complete simulation without returning a usable result.
- Update official template compatibility ranges for core `0.2.3`.

## 0.2.2

### Patch Changes

- Fix Soroban WASM artifact resolution for `wasm32v1-none` builds. Official templates now ship the current target path, legacy `wasm32-unknown-unknown` config paths resolve automatically after build and deploy, and CI blocks reintroducing the deprecated target in bundled templates.

Public API contract and `CAATINGA_*` error code stability are documented in
[`docs/internal/release/v1.0.0.md`](../../docs/internal/release/v1.0.0.md) and [`docs/errors.md`](../../docs/errors.md).
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
