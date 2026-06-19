# Contributing to Caatinga

Thank you for your interest in contributing. This document covers the essentials for getting your environment ready and submitting quality PRs.

## Prerequisites

- [Node.js](https://nodejs.org/) 22 or newer
- [pnpm](https://pnpm.io/) 9.15.4 (declared in `package.json#packageManager`)
- [Rust](https://www.rust-lang.org/tools/install) 1.84.0+ with the `wasm32v1-none` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) 23.0.0 or newer (25.2.0 recommended)

## Setup

```bash
git clone https://github.com/Dione-b/caatinga.git
cd caatinga
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

Run the CLI directly from source during development (`predev` builds `@caatinga/core` automatically):

```bash
pnpm dev init my-dapp
pnpm dev doctor --network testnet --source alice
```

From the repo root, pass CLI arguments directly after `pnpm dev` (do not insert an extra `--`; pnpm forwards args to the CLI script). After changing `packages/core`, rely on `predev` on the next `pnpm dev`, or run `pnpm --filter @caatinga/core build` manually.

## Project Structure

```
packages/
  core/       # Config loading, shell orchestration, error catalog, Stellar CLI integration
  client/     # Browser/Node contract-client helpers and wallet adapters
  cli/        # caatinga binary, command handlers
  templates/  # Scaffold templates used by `caatinga init`
docs/         # User-facing documentation and ADRs
scripts/      # CI helpers and consumer isolation tests
examples/     # Sample consumer applications
```

## Running Checks

| Command | What it does |
|---|---|
| `pnpm test` | Run all Vitest suites |
| `pnpm typecheck` | Run `tsc --noEmit` across all packages |
| `pnpm knip` | Detect unused files, exports, and dependencies |
| `pnpm build` | Build all packages via Turborepo |
| `pnpm ci:publish-matrix` | Full CI gate: build → test → snapshot pack → dry-run publish → consumer tests |

Always run `pnpm test` and `pnpm typecheck` before opening a PR. For changes that affect published packages, also run `pnpm ci:publish-matrix`.

### Package-scoped commands

```bash
pnpm --filter @caatinga/core test
pnpm --filter @caatinga/cli typecheck
```

## Tests

Tests are colocated with source files using the `*.test.ts` convention:

```
packages/core/src/config/load-config.ts
packages/core/src/config/load-config.test.ts
```

Add or update tests for every behavior change, especially error paths, config parsing, manifest compatibility, and CLI command behavior.

## Commit Style

This repository follows [Conventional Commits](https://www.conventionalcommits.org/):

```
fix(core): handle missing wasm target gracefully
feat(cli): add --dry-run flag to deploy command
docs: update getting-started guide
chore: bump stellar-cli tested max to 25.3.0
```

Use an appropriate scope (`core`, `cli`, `client`, `templates`, `ci`) when the change is limited to one package.

## Pull Requests

- Link the related issue (if any).
- Describe **what** changed and **why**.
- State whether there are breaking changes to public APIs, error codes, or file formats.
- For publish-impacting changes, update the relevant `package.json` versions and commit the updated `pnpm-lock.yaml`.

## Compatibility Contracts

The following are treated as **public contracts** — changes require a compatibility note and a rollback plan:

- `caatinga.artifacts.json` schema
- `caatinga.config.ts` shape
- Exported package paths (`exports` in each `package.json`)
- `CaatingaErrorCode` values in `@caatinga/core`

## Version Alignment

Before pushing changes that touch tooling or CI:

- Keep the `packageManager` field in root `package.json` as the canonical pnpm version source.
- Do not pin a separate pnpm version in workflow files; `pnpm/action-setup@v4` reads `packageManager` automatically.
- After dependency changes, run `pnpm install` locally and commit the updated `pnpm-lock.yaml`.
