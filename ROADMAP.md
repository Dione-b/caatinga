# Roadmap

Caatinga is alpha software. The current goal is to stabilize the developer workflow before expanding into larger wallet, indexer, and framework abstractions.

## Alpha

- Stabilize `init`, `doctor`, `build`, `deploy`, `generate`, `invoke`, and `read`.
- Minimal project scaffold via `caatinga init --minimal` (shipped).
- ZK workflow via `@caatinga/zk` and `zk-*` commands (shipped).
- Improve README, tutorials, troubleshooting, and architecture docs.
- Keep `CAATINGA_*` errors documented and actionable.
- Add full counter-web browser example coverage.
- Publish GitHub releases for all public tags.
- Decouple the hard Stellar CLI version lock from the advisory last-tested version via `evaluateStellarCliCompatibility`; raise `STELLAR_CLI_LAST_TESTED_VERSION` without breaking consumer installs. (Shipped in `2.0.0`.)
- `@caatinga/client/react` with `WalletProvider` + `useWallet` hooks (shipped).
- Wallet adapter documentation beyond Freighter (shipped in `docs/wallets.md`).
- Multi-contract deploy with dependencies via `dependsOn` and deploy-arg placeholders (shipped, ADR 0005).

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

## Explicit Non-Goals for Alpha

- Mainnet by default.
- Backend signing.
- Multisig orchestration.
- Full indexer abstraction.
- Framework-owned web runtime.
