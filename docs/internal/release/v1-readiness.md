# v1 Readiness

## Track A — Pre-v1 Public Publish (`0.x` / `next`)

- package metadata valid
- package READMEs complete
- Stellar CLI contract documented: Caatinga hard-fails on Stellar CLI versions below 23.0.0 (`CAATINGA_UNSUPPORTED_CLI_VERSION`; 22.x cannot sign `stellar contract invoke`). Versions newer than the last-tested 25.2.0 are accepted with a non-fatal stderr advisory and a `caatinga doctor` warning; no override flag is required.
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm test:consumer`
- release workflow aligned with pre-v1 `next` publishing policy in [`docs/internal/release/v1.0.0.md`](./v1.0.0.md#dist-tag-policy)

## Track B — Stable Release (`v1.0.0` / `latest`)

- live testnet smoke workflow configured with CI secrets; three consecutive green scheduled runs per [observability plan](./v1.0.0.md#observability-plan)
- Testnet smoke CI expects `CAATINGA_CI_IDENTITY_ALIAS` to name a Stellar CLI identity alias available after restoring `CAATINGA_CI_STELLAR_CONFIG_B64`. On May 18, 2026 we aligned the workflow with Stellar CLI `25.2.0`: the secret may still be a legacy base64 `config.toml`, but the preferred format is a base64 tar archive containing `.config/stellar/config.toml` plus `.config/soroban/identity/<alias>.toml`. Do not commit secret keys. Rotate the identity if the secret is exposed.
- all five v1 specs implemented and accepted, as listed in [`v1-viability-index.md`](./v1-viability-index.md)
- three consecutive successful scheduled smoke runs, verified with the procedure in [`docs/internal/release/v1.0.0.md`](./v1.0.0.md#observability-plan)
- no unretried smoke failure in the last 7 days, verified with the procedure in [`docs/internal/release/v1.0.0.md`](./v1.0.0.md#observability-plan)
- release evidence captured in `docs/internal/release/v1.0.0.md`

## Verification Log

2026-05-17 operational stability gate:

- `pnpm typecheck`: pass via `rtk proxy pnpm typecheck` (the `rtk pnpm typecheck` wrapper printed `TypeScript: No errors found` but exited 1)
- `pnpm build`: pass
- `pnpm test`: pass
- `pnpm test:consumer`: pass
- `pnpm test:consumer:client-bundlers`: pass
- `pnpm ci:publish-matrix`: pass
