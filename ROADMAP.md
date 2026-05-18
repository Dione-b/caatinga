# Roadmap

Caatinga is alpha software. The current goal is to stabilize the developer workflow before expanding into larger wallet, indexer, and framework abstractions.

## Alpha

- Stabilize `init`, `doctor`, `build`, `deploy`, `generate`, and `invoke`.
- Improve README, tutorials, troubleshooting, and architecture docs.
- Keep `CAATINGA_*` errors documented and actionable.
- Add full counter-web browser example coverage.
- Publish GitHub releases for all public tags.

## Beta

- Generate XDR transaction flows for advanced wallet/debug use cases.
- Improve generated binding integration and stale-artifact detection.
- Document wallet adapter contracts beyond Freighter.
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
- React hooks package before the lower-level client contract stabilizes.
