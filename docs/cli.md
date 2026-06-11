# CLI

The CLI is intentionally thin. It delegates config, artifacts, command execution, and parser behavior to `@caatinga/core`.

## `caatinga init <projectName>`

Creates a project from a bundled template and writes `caatinga.artifacts.json`.

`init` validates `caatinga.template.json` before copying files and prints the selected template name and version.

## `caatinga build [contract]`

Builds the configured contract with `stellar contract build`.

## `caatinga doctor [--network testnet] [--source alice]`

Checks local setup before build, deploy, generate, or invoke. It validates Node.js, Stellar CLI,
Rust, `wasm32v1-none`, `caatinga.config.ts`, `caatinga.artifacts.json`, an optional configured
network, and an optional local Stellar CLI identity.

With `--network`, doctor also compares every contract in `caatinga.config.ts` against
`caatinga.artifacts.json` for that network. Each contract prints `✓` with its contract ID when
deployed, or `✗` with a suggested `caatinga deploy` command when missing. If any contract is
missing, doctor exits with code `1` and `CAATINGA_DOCTOR_PARTIAL_DEPLOY`.

## `caatinga deploy [contract] --source <identity> [--network testnet] [--force] [--no-deps] [--verify-deps] [--no-stale-check]`

Deploys one contract (or the full configured graph when `contract` is omitted) through Stellar
CLI and records contract IDs per network in `caatinga.artifacts.json`. Dependencies deploy first
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

## `caatinga generate [contract] [--network testnet]`

Generates TypeScript bindings from the deployed contract ID. The contract name is
optional: omit it to generate bindings for every contract already deployed on the
network (read from `caatinga.artifacts.json`), or pass a name to generate just that one.

## `caatinga invoke <contract.method> --source <identity> [args...]`

Invokes a deployed contract method. Extra args are forwarded to the Stellar implicit contract CLI.

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

See `docs/errors.md` for the full table.
