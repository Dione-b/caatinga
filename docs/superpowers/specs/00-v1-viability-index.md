# v1 Viability Index

Track B in [`docs/release/v1-readiness.md`](../../release/v1-readiness.md) requires all five specs below to be **implemented and accepted** before `latest` is unfrozen.

| # | Spec | Path | Status |
|---|------|------|--------|
| 1 | Stellar CLI version contract | [`docs/stellar-cli-version-contract.md`](../../stellar-cli-version-contract.md) | Accepted |
| 2 | Public `CAATINGA_*` error surface | [`docs/errors.md`](../../errors.md), [`docs/adr/0004-error-codes-as-public-api.md`](../../adr/0004-error-codes-as-public-api.md) | Accepted |
| 3 | npm publish & consumer isolation | [`docs/superpowers/plans/2026-05-13-npm-publish-consumer-isolation.md`](../plans/2026-05-13-npm-publish-consumer-isolation.md) | Accepted |
| 4 | Live testnet smoke CI | [`.github/workflows/testnet-smoke.yml`](../../../.github/workflows/testnet-smoke.yml), [`docs/testing.md`](../../testing.md) | Accepted |
| 5 | Multi-contract dependency deploy | [`docs/adr/0005-multi-contract-dependency-deploy.md`](../../adr/0005-multi-contract-dependency-deploy.md) | Accepted (experimental template) |

Implementation history: [`docs/superpowers/plans/2026-05-12-v1-viability.md`](../plans/2026-05-12-v1-viability.md).

Do not tag `v1.0.0` / publish `latest` until Track B evidence in [`docs/release/v1-readiness.md`](../../release/v1-readiness.md) is complete.
