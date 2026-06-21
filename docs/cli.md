# CLI

The CLI is intentionally thin. It delegates config, artifacts, command execution, and parser behavior to `@caatinga/core`.

## Supported today vs not yet

| Capability                        | Status                                                       |
| --------------------------------- | ------------------------------------------------------------ |
| Official frontend templates       | Vite + React only (`vite-react`)                             |
| `caatinga zk build`               | Single-party **dev** ceremony; blocked on mainnet by default |
| `caatinga zk invoke --embed-vk`   | **Not supported** (experimental / end-to-end incomplete)     |
| Browser `invoke` via wallet       | **Single-invoker only** until v1.0                           |
| Multi-signer / `signAuthEntry`    | Application code; `CAATINGA_MULTI_AUTH_REQUIRED`             |
| Production ZK (MPC powers-of-tau) | Out of scope; no Caatinga command for MPC ceremony           |

See [Client](./client.md#single-invoker-scope-until-v10) and [ZK module](./zk.md#production-guardrails) for details.

## `caatinga init <projectName>`

Creates a project from a bundled template and writes `caatinga.artifacts.json`.

`init` validates `caatinga.template.json` before copying files and prints the selected template name and version.

For a step-by-step guide, see [Template project](./tutorials/template-project.md). To compare template, minimal, and ZK scaffolds, see [Choosing a project scaffold](./tutorials/project-scaffolds.md).

Use `--minimal` (or `--empty`) to scaffold a CLI-only project with a Soroban contract stub — no React/Vite template, no wallet stubs:

```bash
caatinga init my-contract-app --minimal
```

## `caatinga build [contract]`

Builds one configured contract with `stellar contract build`. Omit `contract` to build **every**
contract listed in `caatinga.config.ts` (same batch semantics as `caatinga deploy` without a name).

## `caatinga doctor [--network testnet] [--source alice]`

Checks local setup before build, deploy, generate, or invoke. It validates Node.js, Stellar CLI,
Rust, `wasm32v1-none`, project npm dependencies (`node_modules/@caatinga/core`), `caatinga.config.ts`,
`caatinga.artifacts.json`, an optional configured network, and an optional local Stellar CLI identity.

With `--network`, doctor also compares every contract in `caatinga.config.ts` against
`caatinga.artifacts.json` for that network. Each contract prints `✓` with its contract ID when
deployed, or `✗` with a suggested `caatinga deploy` command when missing. Missing deploy coverage
is advisory only — it never flips doctor to `blocked` or changes the exit code.

When the deploy coverage check passes, doctor also prints a `Bindings (<network>)` section with
the freshness of each deployed contract's TypeScript bindings (`fresh`, `stale`, `missing`, or
`unknown`) and a suggested `caatinga generate` command for anything not fresh. Binding freshness
is advisory only — it never flips doctor to `blocked`.

## `caatinga deploy [contract] --source <identity> [--network testnet] [--force] [--no-deps] [--verify-deps] [--no-stale-check] [--no-generate] [--allow-dev-ceremony]`

Deploys one contract (or the full configured graph when `contract` is omitted) through Stellar
CLI and records contract IDs per network in `caatinga.artifacts.json`. Transient testnet failures
(for example transaction submission timeouts) are retried automatically with backoff before the
command exits with `CAATINGA_DEPLOY_FAILED`. Dependencies deploy first
when the selected contract lists `dependsOn`, unless `--no-deps` is passed (requires a single
contract name). Use `--force` to redeploy when an artifact already stores a contract ID.
Pass `--verify-deps` to confirm each dependency's contract ID exists on-chain (via
`stellar contract info interface`) before resolving deploy arguments.

When a contract already has a `contractId` in `caatinga.artifacts.json` for the selected network,
Caatinga prints `[skipped]` and does not call Stellar CLI unless `--force` is set. Newly deployed
contracts are labeled `[deployed]` with their contract IDs.

Before deploy, Caatinga compares the WASM file mtime with files under `contracts/<name>/src/` (best
effort). If sources look newer than the WASM, it prints a **warning** and continues deploy. Use
`--no-stale-check` to skip this check.

After a successful deploy, Caatinga **automatically generates TypeScript bindings** for the
contracts it just deployed. Pass `--no-generate` to skip (useful in CI jobs that only deploy).
If generation fails, the deploy still succeeds (exit code `0`) — the CLI prints a warning with
the recovery command `npx caatinga generate --network <network>`.

## `caatinga generate [contract] [--network testnet]`

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

## `caatinga status [--network <name>] [--json]`

Shows, per network, every configured contract with its deployed contract ID, WASM hash,
dependencies, and binding freshness in a table. Contracts not yet deployed on the network are
listed with `✗` so you can see what's left. Without `--network` it reports every network present
in `caatinga.artifacts.json` (falling back to `defaultNetwork` for empty projects).

For every deployed contract whose bindings are not fresh, status prints the exact
`caatinga generate` command that fixes it. `--json` prints the full machine-readable structure
on stdout for scripts and CI.

## `caatinga invoke <contract.method> --source <identity> [--network testnet] [args...]`

Invokes a deployed contract method that **mutates state** or must be signed and submitted. Extra args are forwarded to the Stellar implicit contract CLI.

If Stellar CLI reports that the target is a read-only method, Caatinga suggests `caatinga read` (or `client.read()` / `client.simulate()` in browser code) instead of `force: true`.

## `caatinga read <contract.method> [--network testnet] [args...]`

Simulates a read-only contract method with `stellar contract invoke --send=no`. `--source` is optional; Caatinga resolves `CAATINGA_SOURCE` or defaults to `alice` for the simulation account.

Use `read` for getters and pure queries. Use `invoke` for increments, transfers, and other state-changing calls.

## ZK commands

Circom Groth16 workflow (`caatinga zk init`, `build`, `prove`, `invoke`). Full reference:
[ZK module](./zk.md).

| Command                                            | Purpose                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| `caatinga zk build [circuit] [--embed-vk]`         | Compile Circom and run **dev** trusted setup (`--embed-vk` experimental) |
| `caatinga zk prove [circuit]`                      | Generate `proof.json` and `public.json`                                  |
| `caatinga zk invoke [circuit] --source <identity>` | Call on-chain `verify_proof` (dynamic VK)                                |
| `caatinga zk invoke [circuit] --network <name>`    | Target a configured network (not only `defaultNetwork`)                  |

Shared ZK flags:

- `--allow-dev-ceremony` — bypass mainnet guardrails for dev-ceremony artifacts (not for production)
- `--embed-vk` on `zk build` — experimental; writes `vk.rs` only. **`zk invoke --embed-vk` is blocked** until the embedded-VK contract path is complete.

When verification returns `false`, the CLI exits with `CAATINGA_ZK_VERIFICATION_FAILED`. Mainnet deploy/invoke with dev ceremony artifacts exits with `CAATINGA_ZK_DEV_CEREMONY_BLOCKED` unless `--allow-dev-ceremony` is set.

## Stellar CLI compatibility

Caatinga rejects Stellar CLI versions below `23.0.0` because 22.x cannot sign `stellar contract invoke`. Versions newer than the last-tested `25.2.0` are accepted with a non-fatal stderr advisory and a `caatinga doctor` warning. See [Stellar CLI Version Contract](./stellar-cli-version-contract.md).

`caatinga doctor` reports advisory warnings as a `(N warnings)` suffix on the relevant
diagnostic line plus a `code: message` bullet for each one. Common codes are
`STELLAR_CLI_UNTESTED_VERSION` (newer than the last-tested boundary) and
`STELLAR_CLI_MISSING_FEATURE` (a required feature was not advertised by the installed
CLI).

## Current limits

- `--source` must be a local Stellar CLI identity alias that can sign transactions. Public `G...` addresses, secret keys, and seed phrases are rejected.
- `caatinga dev` is reserved and hidden in pre-v1 builds. Use your frontend dev server (for example Vite) alongside `caatinga build`, `deploy`, `generate`, and `invoke`.
- CLI XDR commands and `caatinga generate --interop` are not implemented yet.

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

See `docs/errors.md` for the full table.
