# CLI

The CLI is intentionally thin. It delegates config, artifacts, command execution, and parser behavior to `@caatinga/core`.

After `npm install -g @caatinga/cli` (or a local install), the package exposes two binaries that share the same entrypoint: **`ctg`** and **`caatinga`**. Docs and examples use `ctg`; `caatinga` is a legacy alias (`ctg doctor` ≡ `caatinga doctor`). Help text uses whichever name invoked the process.

## Supported today vs not yet

| Capability                        | Status                                                       |
| --------------------------------- | ------------------------------------------------------------ |
| Official frontend templates       | Vite + React only (`vite-react`)                             |
| `ctg upgrade`                     | In-place WASM upgrade (upload + invoke `upgrade`)            |
| `ctg deploy --upgrade`            | Redeploy with new `contractId` + artifact history            |
| `ctg zk build`                    | Single-party **dev** ceremony; blocked on mainnet by default |
| `ctg zk invoke --embed-vk`        | **Not supported** (experimental / end-to-end incomplete)     |
| Browser `invoke` via wallet       | **Single-invoker**; multi-auth is app-owned                  |
| Multi-signer / `signAuthEntry`    | Application code; `CAATINGA_MULTI_AUTH_REQUIRED`             |
| Production ZK (MPC powers-of-tau) | Out of scope; no Caatinga command for MPC ceremony           |

See [Client — Single-invoker scope](./client.md#single-invoker-scope) and [ZK module](./zk.md#production-guardrails) for details.

## `ctg init <projectName>`

Creates a project from a bundled template and writes `caatinga.artifacts.json`.

`-t, --template <name>` selects the template (default: `react-vite-counter`). Official browser templates:

- `react-vite-counter` — single Soroban counter dApp (default)
- `zk-starter` — ZK dApp with Circom/Groth16 verifier (use `ctg zk init <projectName>`)

`init` validates `caatinga.template.json` before copying files and prints the selected template name and version.

For a step-by-step guide, see [Template project](./tutorials/template-project.md). To compare template, minimal, and ZK scaffolds, see [Choosing a project scaffold](./tutorials/project-scaffolds.md).

Use `--minimal` (or `--empty`) to scaffold a CLI-only project with a Soroban contract stub — no React/Vite template, no wallet stubs:

```bash
ctg init my-contract-app --minimal
```

## `ctg build [contract]`

Builds one configured contract with `stellar contract build`. Omit `contract` to build **every**
contract listed in `caatinga.config.ts` (same batch semantics as `ctg deploy` without a name).
When `buildRoot` is configured and `contract` is omitted, Caatinga runs a single
`stellar contract build` from that Cargo workspace root and then resolves each configured WASM.
Pass a contract name to keep the per-contract build behavior.

## `ctg doctor`

Flags: `--network`, `--source`, `--all-networks`, `--strict`, `--strict-env`, `--strict-bindings`

Checks local setup before build, deploy, generate, or invoke:

- Node.js, Stellar CLI, Rust, `wasm32v1-none`
- Project npm deps (`node_modules/@caatinga/core`)
- `caatinga.config.ts` and `caatinga.artifacts.json`
- Optional configured network and local Stellar CLI identity

With `--network`:

- Compares every contract in config against artifacts (`✓` deployed / `✗` missing with suggested deploy)
- **Deploy coverage is always advisory** — never blocks exit code, even with `--strict`
- Prints a `Bindings (<network>)` freshness section (`fresh`, `stale`, `missing`, `unknown`)

Strict flags:

- `--strict` enables both `--strict-env` and `--strict-bindings`
- `--strict-env` fails when `frontend.envFile` drifts from artifacts (fix with `ctg sync-env`)
- `--strict-bindings` fails when bindings are not `fresh`
- WASM drift and postDeploy alias advisories are **always advisory**

Use `--all-networks` for a per-network deploy/bindings matrix. Doctor may also print a version matrix including `soroban-sdk` from each contract's `Cargo.toml`.

## `ctg deploy`

Flags: `--source` (required), `--network`, `--force`, `--upgrade`, `--if-changed`, `--no-deps`, `--verify-deps`, `--no-stale-check`, `--no-generate`, `--no-wire`, `--no-sync-env`, `--allow-dev-ceremony`

Deploys one contract (or the full configured graph when `contract` is omitted) and records contract IDs in `caatinga.artifacts.json`. Transient testnet failures retry with backoff before `CAATINGA_DEPLOY_FAILED`.

Behavior:

- Dependencies deploy first when `dependsOn` is set (unless `--no-deps`, which requires a single contract name)
- `--force` redeploys when an artifact already stores a contract ID
- `--if-changed` skips when local WASM hash matches the artifact (`[skipped] unchanged`)
- `--verify-deps` confirms each dependency's contract ID exists on-chain before resolving deploy args
- Without `--force`, an existing `contractId` prints `[skipped]` and does not call Stellar CLI
- Before deploy, Caatinga warns if sources look newer than the WASM (skip with `--no-stale-check`)

After a successful deploy:

- **Auto-generates TypeScript bindings** (skip with `--no-generate`). Generation failure does not fail deploy — recovery: `npx ctg generate --network <network>`
- Full graph deploy also runs `postDeploy` wiring (`ctg wire`) and `sync-env` when configured (skip with `--no-wire` / `--no-sync-env`)

Use `deploy --upgrade` (alias for `--force` with upgrade history reason) when you want a **new
contract instance** and artifact history keyed by prior `contractId`. For admin-gated in-place WASM
replacement on the **existing** `contractId`, use `ctg upgrade` instead.

## `ctg upgrade <contract> --source <identity> [--network testnet] [--if-changed] [--expected-hash <hash>] [--no-build] [--generate] [--sync-env]`

Upgrades a deployed contract **in-place**: build (unless `--no-build`), `stellar contract upload`,
then `stellar contract invoke … upgrade --new_wasm_hash <hash>` on the artifact's current
`contractId`. The artifact keeps the same ID and records the previous `wasmHash` in `history[]`
with `upgradeType: "in-place"`.

Use `--if-changed` to skip when the local WASM hash already matches the artifact. Use
`--expected-hash` to fail before upload when the local hash does not match. Pass `--generate` or
`--sync-env` to refresh bindings or the frontend env after a successful upgrade (opt-in; unlike
full deploy, upgrade does not run these automatically).

Requires a contract that exposes an admin-gated `upgrade(new_wasm_hash)` entrypoint. If invoke
fails, the CLI hints to use `ctg deploy --upgrade` for redeploy-style upgrades. Upload
failures exit with `CAATINGA_UPLOAD_FAILED`; missing hash in CLI output uses
`CAATINGA_WASM_HASH_NOT_FOUND`.

## `ctg wire [--network testnet] --source <identity>`

Runs every `postDeploy` and `postDeployRead` hook from `caatinga.config.ts` in order. Each hook
calls a deployed contract method with resolved placeholders (`${contracts.*.contractId}`,
`${source.address}`). Hooks with `kind: "read"` (or entries in `postDeployRead`) simulate without
signing; default `kind: "invoke"` submits a signed transaction.

When `expect` is set, stdout is verified after each hook (string equality or structural matchers —
see [Expect DSL](#expect-dsl)). Mismatch fails with `CAATINGA_POST_DEPLOY_VERIFY_FAILED`.

Use after a full deploy when wiring was skipped with `--no-wire`, or to re-apply authority edges
on testnet after a partial failure.

Transient failures (TxBadSeq, timeouts, connection resets) are retried automatically with
exponential backoff (2s/5s default) before failing with `CAATINGA_INVOKE_FAILED`.

## `ctg sync-env [--network testnet]`

Writes `frontend.envFile` from `caatinga.artifacts.json` using the `frontend.env` mapping in
config. Contract keys map to deployed contract IDs; `rpcUrl` and `networkPassphrase` map to the
selected network config. Quoted values are emitted when the network passphrase contains spaces.

## `ctg generate [contract] [--network testnet] [--strict-network]`

Generates TypeScript bindings from the deployed contract ID via `npx @stellar/stellar-sdk generate` (Stellar CLI is not required). The contract name is
optional: omit it to generate bindings for every contract already deployed on the
network (read from `caatinga.artifacts.json`), or pass a name to generate just that one.
In all-contracts mode the command first prints the current freshness of each contract's
bindings (`[fresh]`, `[stale]`, `[missing]`, or `[unknown]` with the reason).

Each successful generation writes a `.caatinga-bindings.json` marker next to the bindings
recording the source `contractId`, `wasmHash`, and network. `status`, `doctor`, and `generate`
use that marker to detect stale bindings after a redeploy. Deleting a bindings directory simply
resets its state to `missing`.

After generation, Caatinga patches each binding package's `package.json` so bundlers (Vite) resolve
`./src/index.ts` directly — you do not need to run `tsc` inside the generated subpackage.

Pass `--strict-network` to fail when the selected network has no block in `caatinga.artifacts.json`.

## `ctg status [--network <name>] [--json] [--strict]`

Shows, per network, every configured contract with its deployed contract ID, WASM hash,
dependencies, and binding freshness in a table. Contracts not yet deployed on the network are
listed with `✗` so you can see what's left. Without `--network` it reports every network present
in `caatinga.artifacts.json` (falling back to `defaultNetwork` for empty projects).

For every deployed contract whose bindings are not fresh, status prints the exact
`ctg generate` command that fixes it. `--json` prints the full machine-readable structure
on stdout for scripts and CI.

`--strict` exits with code `1` when any **deployed** contract has bindings other than `fresh`.
Canonical CI check after `ctg deploy --no-generate`: run `ctg status --strict` and expect failure until `ctg generate` runs.

## `ctg smoke [--network testnet] [--source alice]`

Runs read-only smoke checks from `smoke.reads` or `postDeployRead` in config, using the same expect DSL as `postDeploy` (string equality or `{ matcher: "isArray" }`, etc.). Default expect is `{ matcher: "reachable" }` when omitted.

When `smoke.useFreshSymbol` is `true`, each read gets an ephemeral `symbol` arg for testnet writes that should not pollute shared state.

## `ctg regression --source <identity> [--network testnet] [--skip-test] [--skip-build] [--skip-deploy] [--skip-generate] [--skip-smoke]`

Orchestrates the recommended pipeline: `pnpm test` → `ctg build` → `ctg deploy --if-changed` → `ctg generate` → `ctg smoke`.

## `ctg ci run [--network testnet] [--source alice] [--strict] [--skip-smoke]`

CI helper: runs `ctg doctor` then `ctg smoke`. Intended for GitHub Actions after
restoring Stellar CLI identity secrets. `--strict` is forwarded to `doctor` only (enables
`--strict-env` and `--strict-bindings`); it does not run `status --strict`.

## `ctg identity export [--path ~/.config/stellar]`

Exports the Stellar CLI config directory as a base64 tarball on stdout (for
`CAATINGA_CI_STELLAR_CONFIG_B64`). Prefer this over hand-rolled tar commands — see
[Testing — Stellar CLI config blob](./internal/testing.md#stellar-cli-config-blob-format).

## `ctg identity import <archive-file> [--path ~/.config/stellar]`

Imports a base64-encoded tarball file produced by `ctg identity export` (not a raw binary path).

## `ctg invoke <contract.method> --source <identity> [--network testnet] [args...]`

Invokes a deployed contract method that **mutates state** or must be signed and submitted. Extra args are forwarded to the Stellar implicit contract CLI. CLI identity aliases in named args (for example `--owner alice`) are resolved to `G...` addresses before invoke.

If Stellar CLI reports that the target is a read-only method, Caatinga suggests `ctg read` (or `client.read()` / `client.simulate()` in browser code) instead of `force: true`.

## `ctg read <contract.method> [--network testnet] [--source alice] [--expect <dsl>] [--quiet] [--summary] [args...]`

Simulates a read-only contract method with `stellar contract invoke --send=no`. `--source` is optional; Caatinga resolves `CAATINGA_SOURCE` or defaults to `alice` for the simulation account.

Use `read` for getters and pure queries. Use `invoke` for increments, transfers, and other state-changing calls.

Named args in `read` and `invoke` resolve CLI identity aliases (≥3 characters, for example
`--owner alice`) to `G...` addresses before calling Stellar CLI. Prefer `${source.address}` in
config hooks over raw aliases. Unresolved aliases fail with `CAATINGA_ADDRESS_ALIAS_UNRESOLVED`.

`--expect` accepts the same DSL as `postDeploy` (plain string or JSON matcher). Mismatch fails with
`CAATINGA_POST_DEPLOY_VERIFY_FAILED`. `--summary` / `--quiet` print compact output for large array
payloads (see [Testnet hygiene](./internal/testnet-hygiene.md)).

## Expect DSL

Shared by `postDeploy`, `postDeployRead`, `smoke.reads`, `ctg read --expect`, and `ctg smoke`.

| Form                                            | Example                                | Meaning                                         |
| ----------------------------------------------- | -------------------------------------- | ----------------------------------------------- |
| Plain string                                    | `"42"` or `"${source.address}"`        | Exact stdout match after placeholder resolution |
| `{ matcher: "reachable" }`                      | default when `expect` omitted in smoke | Non-empty stdout                                |
| `{ matcher: "equals", value: "42" }`            | numeric/string equality                | Same as plain string                            |
| `{ matcher: "isArray" }`                        | list payloads                          | Parsed JSON is an array                         |
| `{ matcher: "isNull" }`                         | optional fields                        | stdout is `null` or empty                       |
| `{ matcher: "minLength", value: 1 }`            | array checks                           | Parsed JSON array length ≥ value                |
| `{ matcher: "maxLength", value: 10 }`           | bounded lists                          | Parsed JSON array length ≤ value                |
| `{ matcher: "contains", value: "abc" }`         | substring                              | stdout includes value                           |
| `{ matcher: "matches", value: "^C[A-Z0-9]+$" }` | regex                                  | stdout matches pattern                          |
| `{ matcher: "jsonEquals", value: "[1,2]" }`     | deep JSON                              | Parsed JSON deep-equals value                   |

CLI usage:

```bash
npx ctg read counter.get --network testnet --expect '{"matcher":"reachable"}'
npx ctg read token.list --network testnet --expect '{"matcher":"isArray"}' --summary
```

Full schema and config examples: [Config — postDeploy and smoke](./config.md#postdeploy-hooks-and-smoke).

## ZK commands

Circom Groth16 workflow (`ctg zk init`, `build`, `prove`, `invoke`). Full reference:
[ZK module](./zk.md).

| Command                                       | Purpose                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `ctg zk build [circuit] [--embed-vk]`         | Compile Circom and run **dev** trusted setup (`--embed-vk` experimental) |
| `ctg zk prove [circuit]`                      | Generate `proof.json` and `public.json`                                  |
| `ctg zk invoke [circuit] --source <identity>` | Call on-chain `verify_proof` (dynamic VK)                                |
| `ctg zk invoke [circuit] --network <name>`    | Target a configured network (not only `defaultNetwork`)                  |

Shared ZK flags:

- `--allow-dev-ceremony` — bypass mainnet guardrails for dev-ceremony artifacts (not for production)
- `--embed-vk` on `zk build` — experimental; writes `vk.rs` only. **`zk invoke --embed-vk` is blocked** until the embedded-VK contract path is complete.

When verification returns `false`, the CLI exits with `CAATINGA_ZK_VERIFICATION_FAILED`. Mainnet deploy/invoke with dev ceremony artifacts exits with `CAATINGA_ZK_DEV_CEREMONY_BLOCKED` unless `--allow-dev-ceremony` is set.

## Stellar CLI compatibility

Caatinga rejects Stellar CLI versions below `23.0.0` because 22.x cannot sign `stellar contract invoke`. Versions newer than the last-tested `27.0.0` are accepted with a non-fatal stderr advisory and a `ctg doctor` warning. See [Stellar CLI Version Contract](./stellar-cli-version-contract.md).

`ctg doctor` reports advisory warnings as a `(N warnings)` suffix on the relevant
diagnostic line plus a `code: message` bullet for each one. Common codes are
`STELLAR_CLI_UNTESTED_VERSION` (newer than the last-tested boundary) and
`STELLAR_CLI_MISSING_FEATURE` (a required feature was not advertised by the installed
CLI).

## Current limits

- `--source` must be a local Stellar CLI identity alias that can sign transactions. Public `G...` addresses, secret keys, and seed phrases are rejected.
- `ctg dev` is reserved and hidden. Use your frontend dev server (for example Vite) alongside `ctg build`, `deploy`, `generate`, and `invoke`.
- CLI XDR commands and `ctg generate --interop` are not implemented yet.

## Error codes

Caatinga emits public `CAATINGA_*` error codes for automation. Common examples:

- `CAATINGA_CONFIG_NOT_FOUND`
- `CAATINGA_INVALID_CONFIG`
- `CAATINGA_STELLAR_CLI_NOT_FOUND`
- `CAATINGA_CONTRACT_ID_NOT_FOUND`
- `CAATINGA_SOURCE_ACCOUNT_REQUIRED`
- `CAATINGA_TEMPLATE_MANIFEST_NOT_FOUND`
- `CAATINGA_TEMPLATE_INCOMPATIBLE`
- `CAATINGA_XDR_BUILD_FAILED`
- `CAATINGA_XDR_SIGN_FAILED`
- `CAATINGA_ZK_VERIFICATION_FAILED`

See [Errors](./errors.md) for the full table.
