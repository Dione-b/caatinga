# Release Candidate Checklist (v1.0)

This document defines the acceptance criteria that must be satisfied before Caatinga can be promoted from alpha (pre-1.0) to v1.0.

---

## Schema Freeze

- [x] `caatinga.artifacts.json` schema is versioned (`schema_version: 2`) and has a migration path from v1
- [x] `caatinga.config.ts` schema is validated by Zod with explicit error messages
- [x] `caatinga.template.json` manifest is versioned (`templateVersion: 1`)
- [x] All schema-breaking changes require an explicit migration or a new schema version increment

## API Freeze

- [x] All `CAATINGA_*` error codes are documented in `docs/errors.md`
- [x] Public exports of `@caatinga/core` are typed and stable (no `any` at boundaries)
- [x] Public exports of `@caatinga/client` are typed and stable
- [x] `CaatingaWalletAdapter` interface is frozen (no breaking changes without a major version)
- [x] `CaatingaClientConfig` interface is frozen

## CLI Surface Freeze

- [x] All commands and their flags are documented in `docs/cli.md`
- [x] Exit codes `0` (success) and `1` (failure) are consistent across all commands
- [x] `caatinga --help` shows all commands grouped by category
- [x] `caatinga version` outputs `@caatinga/cli@<version>` and the runtime Node.js version

## Reliability Criteria

- [x] All unit tests pass (`pnpm test`)
- [x] TypeScript compiles without errors (`pnpm typecheck`)
- [x] Build is reproducible (`pnpm build`)
- [ ] Integration tests pass against Stellar testnet (manual gate)
- [x] `caatinga doctor` correctly detects missing Stellar CLI, outdated versions, and stale bindings
- [x] `caatinga smoke` correctly asserts `expect` matchers
- [x] `caatinga setup` installs all prerequisites on a clean machine

## Documentation Criteria

- [x] `README.md` describes the problem, differentiator, and quick start in under 5 minutes
- [x] `docs/getting-started.md` guides a new user from zero to first deploy
- [x] `docs/errors.md` lists all `CAATINGA_*` error codes with descriptions
- [x] `docs/architecture.md` describes the package layout and data flow
- [x] `docs/network-setup.md` provides boilerplates for all major Stellar networks
- [x] `docs/runtime-invoke-pipeline.md` documents the full invoke pipeline
- [x] `docs/automation.md` documents doctor, smoke, and ci run

## Remaining Before v1.0

> [!CAUTION]
> The following items must be resolved before promoting to v1.0:

- [ ] Integration test suite passes against Stellar testnet
- [ ] All templates pinned to a stable `compatibleCore` range matching the v1.0 release
- [ ] CHANGELOG finalized with all breaking changes from alpha documented
- [ ] npm publish with `--tag latest` (currently on `next` channel)
