# Repository Guidelines

## Project Structure & Module Organization

Caatinga is a pnpm workspace managed by Turbo. Main packages live under `packages/`:
`core` contains config, templates, shell orchestration, networks, and errors; `client`
contains browser/Node contract-client helpers and wallet adapters; `cli` contains the
`caatinga` command and handlers. Reusable templates live in `packages/templates/`.
Docs and ADRs live in `docs/`. Consumer and packaging checks live in `scripts/`, with
sample apps under `examples/`.

Tests are colocated with source files and use `*.test.ts`, for example `packages/core/src/config/load-config.test.ts`.

## Current release

Published on npm (confirm with `npm view @caatinga/cli dist-tags`):

- **`latest`**: **`3.1.2`** (last promoted stable on npm)
- **`next`**: **`3.3.0`** (current repo line; pre-release candidates until promoted to `latest`)

Repository packages are version **`3.3.0`**. After publish, promote `next` → `latest` per [docs/release/publish-checklist.md](docs/release/publish-checklist.md).

Highlights from the `3.0.0` line:

- Node floor raised to **22** (`.nvmrc`, `engines`, CI workflows) for `@stellar/stellar-sdk` v16.
- `caatinga generate` uses **`npx @stellar/stellar-sdk generate`** (no Stellar CLI for bindings).
- Templates (`react-vite-counter`, `zk-starter`) on **`@stellar/stellar-sdk ^16.0.1`**; import path is package root (`./contracts/generated/<contract>`).
- **`CAATINGA_MULTI_AUTH_REQUIRED`** for delegated AddressV2 / non-invoker auth entries.

Highlights from the `2.x` line:

- Replaces the hard Stellar CLI upper bound (`25.2.0`) with a feature-aware
  compatibility check: the hard floor (`23.0.0`) is the only hard failure, and the
  last-tested version is now advisory. See `docs/stellar-cli-version-contract.md`.
- `2.4.5`: feedback fixes — `--source` on `zk invoke`, multi-contract `build`, embedded VK generation, `CAATINGA_ZK_VERIFICATION_FAILED`
- `2.4.4`: align official templates with current core release, fix ci-snapshot-pack core version capture, narrow consumer isolation deprecated-dependency checks
- `2.4.0`: `init --minimal`, `caatinga read`, doctor dependencies check, `@caatinga/client/vite` wallet stubs, read-call hints, project scaffold docs
- `2.3.1`: hybrid zk-starter browser verify, `@caatinga/zk/browser`, client `Result` unwrap in read/simulate
- `2.3.0`: ZK workflow — `@caatinga/zk`, CLI `zk-*` commands, and `zk-starter` template for Circom Groth16 verifiers on Soroban
- `2.2.1`: restore template install-time overrides (clean `npm install` / `pnpm install` without deprecated wallet SDK transitives)
- `2.2.0`: `caatinga status`, deploy auto-generates bindings, binding freshness
  markers, `@caatinga/client/react` (`WalletProvider`/`useWallet`), and template DX
  (`ContractNotDeployed` gate, custom `WalletModal`, SWK `fetchAddress` fallback).

## Build, Test, and Development Commands

Use pnpm 9.15.4 and Node 22 or newer.

- `pnpm install --frozen-lockfile`: install exactly from `pnpm-lock.yaml`; this is CI behavior.
- `pnpm build`: build all packages through Turbo.
- `pnpm test`: run all Vitest suites.
- `pnpm typecheck`: run `tsc --noEmit` across packages.
- `pnpm dev`: run the CLI from source via `tsx` (`predev` builds `@caatinga/core` first; pass CLI args after `pnpm dev`, e.g. `pnpm dev init my-dapp`).
- `pnpm knip`: detect unused files, exports, and dependencies.
- `pnpm ci:publish-matrix`: run build, tests, package snapshots, dry-run publish, and consumer checks.

For package-specific work, use filters, for example `pnpm --filter @caatinga/core test`.

## Coding Style & Naming Conventions

This repository is TypeScript ESM-first with strict compiler settings. Keep code explicit,
typed, and small. Prefer named exports for reusable library APIs. Use kebab-case for command
and utility files (`load-config.ts`, `init.command.ts`) and PascalCase only for classes/types
that require it (`CaatingaError.ts`). Preserve public error codes and package exports as
compatibility contracts.

Run `pnpm format` before committing. The repository uses Prettier (`.prettierrc`) and ESLint (`eslint.config.js`) at the root; follow their rules and the existing two-space JSON style.

## Testing Guidelines

Vitest is the test framework. Add or update colocated `*.test.ts` files for behavior changes,
especially error paths, manifests, CLI behavior, config parsing, and template compatibility.
Run `pnpm test` and `pnpm typecheck` before submitting. For release-impacting changes, run
`pnpm ci:publish-matrix` when feasible.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commits: `fix:`, `fix(core):`, `docs:`, `test:`, and `chore:`. Keep commits scoped and imperative, for example `fix(cli): bundle templates during build`.

Pull requests should include motivation, behavior, tests, and release impact. Link issues or
specs. For publish/version changes, keep each package `package.json` aligned with intended
published versions and internal ranges, then update and commit `pnpm-lock.yaml`; CI uses
frozen lockfile installs.

### Version alignment before commit

Before committing changes that touch tooling, dependencies, or CI, verify that versions stay consistent across the repo. Mismatches often pass locally but fail in GitHub Actions.

- **pnpm**: Root `package.json` declares the canonical version in `packageManager` (currently
  `pnpm@9.15.4`). Do not also pin a different pnpm version in `.github/workflows/*` (for example
  `pnpm/action-setup` with `version: 9`); `pnpm/action-setup@v4` reads `packageManager` and errors
  on duplicate sources.
- **Node.js**: Workflows use Node 22; keep `engines` and any `.nvmrc` / `node-version` inputs aligned with that baseline.
- **Lockfile**: After dependency or `packageManager` changes, run `pnpm install` and commit `pnpm-lock.yaml` so CI `--frozen-lockfile` installs match.
- **Workspace linking**: Root `.npmrc` sets `prefer-workspace-packages=true` and `link-workspace-packages=true` so local `@caatinga/*` packages resolve from the monorepo before npm (needed when a version bump is not yet published).
- **Workspace packages**: When bumping published versions or internal `workspace:*` ranges, update all affected `package.json` files in the same change.

When in doubt, grep for version pins (`packageManager`, `version:`, `node-version`, `engines`) before pushing.

### Template install overrides

Browser templates ship **required** npm/pnpm overrides for `ws`, Trezor/HOT stubs, Safe, and
`uuid`. Removing them causes ~14 high `npm audit` findings (`ws` via Reown/viem) or critical
Trezor/`protobufjs` noise. Canonical definitions live in
`packages/client/src/vite/wallet-stubs.ts`; keep templates in sync. CI runs
`npm audit --audit-level=high` in `scripts/consumer-isolation-test.sh`. Full maintainer
contract:
[docs/templates.md — Install override contract](docs/templates.md#install-time-dependency-overrides-maintainer-contract).

## Security & Configuration Tips

Do not commit secrets, wallet keys, private artifacts, or local `.env` files. Treat
`caatinga.artifacts.json`, template manifests, exported package paths, and documented error
codes as public contracts; changing them requires a compatibility note and rollback plan.
