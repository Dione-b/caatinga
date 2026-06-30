# Contributing to Caatinga

This document covers environment setup and PR expectations. Repository layout, build commands, version alignment, and template overrides are in [AGENTS.md](./AGENTS.md).

## Prerequisites

- [Node.js](https://nodejs.org/) 22 or newer
- [pnpm](https://pnpm.io/) 9.15.4 (declared in `package.json#packageManager`)
- [Rust](https://www.rust-lang.org/tools/install) 1.84.0+ with the `wasm32v1-none` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) 23.0.0 or newer (27.0.0 recommended)

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

See [AGENTS.md — Project Structure & Module Organization](./AGENTS.md#project-structure--module-organization).

## Running Checks

| Command                  | What it does                                                                  |
| ------------------------ | ----------------------------------------------------------------------------- |
| `pnpm test`              | Run all Vitest suites                                                         |
| `pnpm typecheck`         | Run `tsc --noEmit` across all packages                                        |
| `pnpm knip`              | Detect unused files, exports, and dependencies                                |
| `pnpm build`             | Build all packages via Turborepo                                              |
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

See [AGENTS.md — Version alignment before commit](./AGENTS.md#version-alignment-before-commit).
