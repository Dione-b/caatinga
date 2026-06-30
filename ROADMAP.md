# Roadmap

Caatinga is alpha software. The current goal is to stabilize the developer workflow before expanding into larger wallet, indexer, and framework abstractions.

## Alpha (in progress)

- Stabilize `init`, `doctor`, `build`, `deploy`, `generate`, `invoke`, and `read`.
- Improve README, tutorials, troubleshooting, and architecture docs.
- Keep `CAATINGA_*` errors documented and actionable.
- Add full counter-web browser example coverage.
- Publish GitHub releases for all public tags.

## Production Readiness (in progress)

- Artifact history and `caatinga migrate artifacts` (schema v2).
- `caatinga estimate deploy` — pre-deploy cost advisory.
- `caatinga inspect` — on-chain vs local artifact comparison.
- `caatinga rollback` — logical artifact restore.
- [Signing strategy](docs/signing-strategy.md) and [production readiness checklist](docs/production-readiness.md).
- Stellar CLI and SDK version matrices with CI validation.

## Beta

- Generate XDR transaction flows for advanced wallet/debug use cases.
- Improve generated binding integration and stale-artifact detection.
- Add integration tests against testnet where deterministic enough.
- Add template variants only after two real template use cases exist.

## v1.0

- Stable `caatinga.config.ts` format.
- Stable `caatinga.artifacts.json` format.
- Stable package exports.
- Documented migration and breaking-change policy.
- Release automation that creates a GitHub Release for every public tag.
- **Candidate:** multisig / `signAuthEntry` orchestration in `@caatinga/client` (see [Client scope](docs/client.md#single-invoker-scope-until-v10)).

## Explicit Non-Goals for Alpha

- Mainnet by default.
- Backend signing.
- Multisig orchestration (browser `signAuthEntry` — single-invoker only until v1.0; see [docs/client.md](docs/client.md#single-invoker-scope-until-v10)).
- Full indexer abstraction.
- Framework-owned web runtime.

## Shipped (reference)

Already available in current releases: `init --minimal`, ZK workflow (`@caatinga/zk`, `zk-*` commands), `@caatinga/client/react`, multi-contract deploy with `dependsOn`, Stellar CLI feature-aware compatibility (ADR 0001), wallet adapter docs. See [CHANGELOG](./packages/cli/CHANGELOG.md) and [ADRs](./docs/adr/index.md).
