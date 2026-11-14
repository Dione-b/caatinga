## Breaking changes policy

## 3.13.0

### Minor Changes

- 6652eec: Imported ZK ceremonies are now pinned and verifiable, and ZK verification cost is measured on a live network.

  **Pinned ceremony artifacts.** `ctg zk import-ceremony` writes a version-2 `ceremony.json` recording the sha256 of the proving key, verification key, powers-of-tau, r1cs and wasm, plus provenance (`--source-url`, `--ceremony-name`, `--participants`, `--retrieved-at`). Mainnet `ctg deploy <verifier>` and `ctg zk invoke` re-hash the proving key, verification key and powers-of-tau and fail with the new `CAATINGA_ZK_CEREMONY_TAMPERED` if any changed since import. `--allow-dev-ceremony` does not waive this check, and an `mpc-multi-party` manifest without hashes is rejected too, so editing `ceremony.json` no longer lifts the mainnet block. **Compatibility:** an MPC manifest written by the earlier pre-release `import-ceremony` has no hashes and is rejected on mainnet until the ceremony is re-imported. Dev-ceremony manifests are unchanged.

  **New: `ctg zk verify-ceremony [circuit]`.** An offline, reproducible check: it re-hashes the pinned artifacts, runs `snarkjs zkey verify <r1cs> <ptau> <zkey>` when a powers-of-tau was imported, and checks that `verification_key.json` is the key exported from the zkey. On success it stamps `verifiedAt` in the manifest.

  **`ctg estimate verify` recalibrated against testnet.** The model was fitted to simulated `verify_proof` calls for 1 to 104 public signals: about 40.5M instructions plus 3.56M per public signal. The previous model under-estimated by up to 26%. The reference limits now match the network's `contract_compute_v0` settings on testnet and mainnet: 400M instructions and 40 MiB per transaction, up from 100M and 16 MiB. In practice, a circuit can expose about 100 public signals before verification exceeds the transaction limit.

  **Live-network ZK checks.** `scripts/zk-testnet-smoke.sh` now also checks that the live verifier rejects an invalid proof, altered public inputs, a mismatched verification key and swapped G2 limbs. It checks that a tampered imported zkey is refused both by `verify-ceremony` and on mainnet before any transaction, and it records verification cost per public-signal count with the new `scripts/zk-verify-benchmark.mjs`. The `zk-smoke` job now runs weekly. It also fixes the `workflow_dispatch` condition, which compared the boolean `zk` input to a string and therefore never ran.

  New error code (public API, additive): `CAATINGA_ZK_CEREMONY_TAMPERED`.

- 8631598: ZK deployment is now production-ready: audited ceremony artifacts can be imported, the embedded verification key path works end to end, and several guardrails report actionable errors instead of raw snarkjs stderr.

  **New: `ctg zk import-ceremony <circuit> --ceremony <path>`** (breaking the mainnet dead end). Point it at an external MPC ceremony's `circuit_final.zkey` + `verification_key.json`; Caatinga copies them in, records `type: "mpc-multi-party"` in `ceremony.json`, and lifts the mainnet dev-ceremony block for that circuit. The artifacts are validated against the compiled circuit by public-signal count, so a key from a different circuit fails with `CAATINGA_ZK_CEREMONY_INCOMPATIBLE` instead of an unexplained on-chain verification failure. `ctg zk build` now **reuses** imported artifacts rather than overwriting them with a fresh dev ceremony.

  **New: `ctg estimate verify <circuit>`** (advisory). Reports the CPU/memory budget for on-chain proof verification against the reference network limits and warns as the budget approaches them. With `--network`, the protocol pre-flight runs first.

  **New: ZK protocol pre-flight.** `ctg deploy <verifier>` and `ctg zk invoke` check the target network's protocol version via Soroban RPC `getNetwork` before building a transaction, failing with `CAATINGA_ZK_PROTOCOL_VERSION_UNSUPPORTED` when it is below 27 (the verifier is built with `soroban-sdk` 27, whose wasm declares protocol 27). `ctg doctor` reports each network's protocol version as an advisory.

  **Embedded VK works end to end.** `ctg zk build --embed-vk` generates `contracts/verifier/src/vk.rs` and the verifier scaffold gains a `verify_proof_embedded` entrypoint, so `ctg zk invoke <circuit> --embed-vk` now works. Because the key is compiled into the contract, enabling it needs new contract code on chain (`ctg upgrade verifier` for an upgradeable verifier, otherwise one `ctg deploy verifier --upgrade` with a new `contractId`); after `--embed-vk` on a dev ceremony, re-run `ctg zk prove`. `verify_proof` stays in the contract, so dynamic-VK callers keep working after the switch. The CLI rejects `--embed-vk` invokes while `vk.rs` is still the scaffold placeholder (`CAATINGA_ZK_EMBED_VK_UNSUPPORTED`).

  **`ctg zk build --network <name>`.** The mainnet dev-ceremony guard now checks the network the artifacts are meant for instead of only `defaultNetwork`, so a testnet default no longer hides a later mainnet deploy. Defaults to `defaultNetwork`; an unknown name fails with `CAATINGA_NETWORK_NOT_FOUND`.

  **`zk-starter` ships a `mainnet` network**, matching `react-vite-counter`, so `ctg deploy verifier --network mainnet` no longer fails with network-not-found in a fresh project.

  **Better input errors.** A malformed `circuits/input.json` (for example the multiplier scaffold's derived output `c`) is now reported as `CAATINGA_ZK_INPUT_CONTAINS_PUBLIC_SIGNALS`, naming the offending signal and how to fix it, instead of leaving the user to read raw snarkjs stderr.

  **ZK drift in `ctg status`.** Reports whether a circuit has been built, its ceremony type, and whether the circuit sources or `input.json` changed since the last prove/import. Additive to the existing output and `--json` payload; `--strict` still guards binding freshness only.

  **Checksum mismatches are actionable.** A `circom` binary failing its pinned SHA-256 now reports the pinned version, the download URL, and the GitHub release page, and points at the file holding the pin. It still never auto-retries.

  New error codes (public API, additive): `CAATINGA_ZK_PROTOCOL_VERSION_UNSUPPORTED`, `CAATINGA_ZK_INPUT_CONTAINS_PUBLIC_SIGNALS`, `CAATINGA_ZK_EMBED_VK_UNSUPPORTED`, `CAATINGA_ZK_CEREMONY_INCOMPATIBLE`. `ctg zk invoke --embed-vk` no longer reports `CAATINGA_INVALID_CONFIG`.

  Add `scripts/zk-testnet-smoke.sh` (opt-in, spends testnet XLM) and the `zk-smoke` CI job in `.github/workflows/testnet-smoke.yml`, triggered via `workflow_dispatch` with `zk: true`.

  Also fixes: the verification-key reader accepted only the legacy `vk_ic` spelling and now handles the `IC`/`nPublic` shape snarkjs actually exports; `snarkjs r1cs info` output was parsed with a non-existent `# of Public Signals` label, which made import validation always fail. A dry-run run-through of the full loop surfaced three more issues, all fixed: `ctg zk prove` now translates snarkjs stderr into `CAATINGA_ZK_INPUT_CONTAINS_PUBLIC_SIGNALS` instead of dumping raw stderr; `ctg zk build` no longer warns about a single-party dev ceremony when it reused imported MPC artifacts; and `ctg status` now reports `vk-changed` when the verification key swapped under a proof (for example after `ctg zk import-ceremony`), so a stale proof can't reach the verifier silently.

  CLI test isolation: `zk-guardrails`, `deploy`, and `estimate` tests no longer remove the shared `.artifacts/zk` tree while the suite runs in parallel, which surfaced as flaky `ENOTEMPTY` failures.

- d519194: **Internal restructuring of the ZK flow; no command changes behaviour.** Artifact file names and paths, file hashing, verification-key and `r1cs info` parsing, and the embedded-VK helpers each live in one module now instead of being repeated across build, prove, invoke, ceremony import/verify and status. `@caatinga/zk` additionally exports `zkArtifactPaths`, `embeddedVkSourcePath`, `isPlaceholderEmbeddedVk` and `CIRCUIT_INPUT_FILE`; every existing export is unchanged.

  **`ctg zk prove` and `ctg zk invoke` name the real problem when the config has no circuits.** They used to report `Circuit "undefined" not found`; all `ctg zk` commands now share one message, `No ZK circuits configured in caatinga.config.ts`, and `ctg zk invoke <name>` with an unknown name reports that the circuit was not found rather than that its verifier contract is missing.

- 688db16: **The ZK verifier can be upgraded in place.** The verifier scaffold (`ctg zk init`, `zk-starter`) now has `__constructor(admin: Address)`, `admin()` and an admin-gated `upgrade(new_wasm_hash)`, and its config entry passes the deploying identity as admin with `deployArgs: { admin: "${source.address}" }`. Enabling embedded VK is now `ctg zk build --embed-vk` → `ctg build verifier` → `ctg upgrade verifier --source <admin>`, keeping the `contractId`; `verify_proof` and `verify_proof_embedded` are unchanged.

  `ctg zk init` in an existing project adds the admin deploy arg to a `verifier` entry that points at `./contracts/verifier` and has no `deployArgs`, and warns when it cannot (for example a nested or computed entry). The `zk-starter` template gains a `caatinga:upgrade` script. The admin lives in instance storage, so it shares the contract instance's TTL. `admin()` and `upgrade` return the contract error `AdminNotSet` (code 1) instead of panicking when no admin is stored.

  **Breaking for existing verifier configs:** the verifier now requires a constructor argument. A config whose `verifier` entry has no `deployArgs: { admin: "${source.address}" }` fails to deploy the new contract code; add that line (or re-run `ctg zk init`). Deploying also needs `--source` (already required for deploy). Verifiers scaffolded before this release have no `upgrade` entrypoint; they need one `ctg deploy verifier --upgrade` after adopting the new contract code, and `ctg upgrade` afterwards. Rollback: remove the `deployArgs` entry and the constructor/`upgrade` functions to return to the previous, non-upgradeable verifier.

### Patch Changes

- 2f4b2cd: Fixes found by running the ZK flow end to end on testnet in fresh projects.

  **`ctg upgrade` no longer fails on every new WASM.** `stellar contract upload` logs the transaction hash on stderr ("Signing transaction: <hash>") before printing the WASM hash on stdout. Caatinga read the first 64-hex token from the combined output, compared the transaction hash with the local WASM hash, and failed with `CAATINGA_UPLOAD_FAILED` even though the upload had succeeded. The WASM hash is now read from stdout (and `parseWasmHash` takes the last hash in mixed output).

  **The embedded-VK flow is documented as it actually works.** Because the key is compiled into the contract, enabling `--embed-vk` needs new contract code on chain: `ctg upgrade verifier` for verifiers with the admin-gated `upgrade` entrypoint, or one `ctg deploy verifier --upgrade` (new `contractId`) for verifiers scaffolded without it. On a dev ceremony `ctg zk build` generates new keys, so `ctg zk prove` must run again; `ctg zk build` now says so. Docs, tutorial and cheatsheet are updated.

  **Clear error for a stale on-chain verifier.** `ctg zk invoke --embed-vk` against a verifier deployed before `vk.rs` was generated now reports `CAATINGA_ZK_EMBED_VK_UNSUPPORTED` with a hint naming the missing step instead of a raw `UnreachableCodeReached` VM trap.

  **`ctg status` no longer calls an imported ceremony "audited".** It shows `MPC (imported, verified <date>)` after `ctg zk verify-ceremony`, or `not verified` otherwise; the `--json` payload gains an additive `ceremonyVerifiedAt`.

- f2b6e2f: **`ctg zk init` no longer breaks a config whose verifier entry ends in a comment.** When adding `deployArgs: { admin: "${source.address}" }` to an existing `verifier` entry, the separating comma was appended to the end of the last line, so a trailing `// comment` swallowed it and the rewritten `caatinga.config.ts` failed to parse. The comma now goes after the last code token; comments stay in place.

  **The missing-admin warning now checks the verifier entry itself.** It used to look for any `deployArgs: { admin }` in the whole file, so another contract with an admin (a token, for example) silenced the warning for a verifier entry it could not rewrite. Commented-out `deployArgs` and paths that only appear in comments are ignored as well.

  **`ctg zk invoke --embed-vk` keeps the original trap.** The `CAATINGA_ZK_EMBED_VK_UNSUPPORTED` error now keeps the Stellar CLI failure as its cause and shows the trap lines in the hint, so a panic that is not the placeholder key is still diagnosable. Detection also follows re-wrapped errors down their cause chain, and recognizes the trap from the host error `Error(WasmVm, InvalidAction)` alone: Stellar CLI 28.1 prints the `UnreachableCodeReached` diagnostic event only with `-v`, so on testnet the trap previously fell through to a generic `CAATINGA_INVOKE_FAILED`.

- Updated dependencies [ba6c80f]
- Updated dependencies [d7eb132]
- Updated dependencies [2f4b2cd]
- Updated dependencies [6652eec]
- Updated dependencies [8631598]
- Updated dependencies [d519194]
- Updated dependencies [ca06250]
- Updated dependencies [ef7072f]
- Updated dependencies [688db16]
- Updated dependencies [6644b9d]
  - @caatinga/core@3.13.0

## 3.12.0

### Patch Changes

- Updated dependencies [21b518a]
- Updated dependencies [670f3aa]
- Updated dependencies [4615ed4]
- Updated dependencies [fb04f3e]
- Updated dependencies [94551d4]
  - @caatinga/core@3.12.0

## 3.11.0

### Patch Changes

- cae6cac: Point package `homepage` to https://caatinga.xyz.
- Updated dependencies [17c6027]
- Updated dependencies [cae6cac]
- Updated dependencies [88ba40f]
- Updated dependencies [e31535a]
  - @caatinga/core@3.11.0

## 3.10.3

### Patch Changes

- 292986b: Mainnet fixes from the readiness audit:

  - **Mainnet commands use the configured RPC** (#224). Configs matching the well-known mainnet network were passed to the Stellar CLI as `--network mainnet`, whose built-in entry has no RPC URL ("Bring Your Own"), so `read`, `invoke`, `deploy`, `upgrade` and friends failed on mainnet or silently used a locally added network. Mainnet now always gets explicit `--rpc-url` / `--network-passphrase` from `caatinga.config.ts`. Testnet keeps the `--network testnet` shorthand.
  - **No implicit `alice` on mainnet** (#226). `ctg read` and `ctg smoke` no longer fall back to the built-in `alice` identity on mainnet (by name or passphrase); pass `--source` or set `CAATINGA_SOURCE`, otherwise `CAATINGA_SOURCE_ACCOUNT_REQUIRED` is raised. `describeCliSource` / `resolveCliSource` accept an optional `{ network }`.
  - **ZK dev-ceremony block detects mainnet by passphrase** (#228). `ctg zk build`, `ctg zk invoke` and verifier `ctg deploy` now block single-party dev-ceremony artifacts on a mainnet network with a custom name (e.g. `pubnet`). `isProductionNetwork` and `assertDevCeremonyAllowed` accept an optional network config.

- Updated dependencies [292986b]
  - @caatinga/core@3.10.3

## 3.10.2

### Patch Changes

- Updated dependencies [d419145]
  - @caatinga/core@3.10.2

## 3.10.1

### Patch Changes

- Updated dependencies
- Updated dependencies [84a5940]
- Updated dependencies [fd55695]
  - @caatinga/core@3.10.1

## 3.10.0

### Patch Changes

- @caatinga/core@3.10.0

## 3.9.2

### Patch Changes

- Updated dependencies [4b382a9]
- Updated dependencies [6fc3b94]
- Updated dependencies [ae9a936]
- Updated dependencies [5c2157c]
- Updated dependencies [34f2e4e]
- Updated dependencies [9a942d0]
- Updated dependencies [85dd6ae]
- Updated dependencies [f4395b1]
  - @caatinga/core@3.9.2

## 3.9.1

### Patch Changes

- Error hints now reference the `ctg` binary name (`caatinga` remains a legacy alias).

### Patch Changes

- @caatinga/core@3.9.1

## 3.9.0

### Patch Changes

- @caatinga/core@3.9.0

## 3.8.0

### Patch Changes

- v1.0 contract milestone — aligned with `@caatinga/core@3.8.0`.
- Updated dependencies
  - @caatinga/core@3.8.0

## 3.7.0

### Patch Changes

- Updated dependencies [60954dd]
- Updated dependencies
  - @caatinga/core@3.7.0

## 3.6.1

### Patch Changes

- bump Stellar CLI last-tested to 27.0.0
- Updated dependencies
  - @caatinga/core@3.6.1

## 3.6.0

### Patch Changes

- Updated dependencies [cfac892]
  - @caatinga/core@3.6.0

## 3.5.1

### Patch Changes

- Updated dependencies
  - @caatinga/core@3.5.1

## 3.5.0

### Patch Changes

- Updated dependencies [6a3b25b]
  - @caatinga/core@3.5.0

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

  - Reposition README and architecture around git-driven artifacts and multi-contract deploy (ZK moved to Advanced section).
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
