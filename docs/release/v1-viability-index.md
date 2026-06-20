# v1 Viability Index

Track B in [`v1-readiness.md`](./v1-readiness.md) requires all five specs below to be **implemented and accepted** before `latest` is unfrozen.

| #   | Spec                              | Path                                                                                                                   | Status                           |
| --- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1   | Stellar CLI version contract      | [`../stellar-cli-version-contract.md`](../stellar-cli-version-contract.md)                                             | Accepted                         |
| 2   | Public `CAATINGA_*` error surface | [`../errors.md`](../errors.md), [`../adr/0004-error-codes-as-public-api.md`](../adr/0004-error-codes-as-public-api.md) | Accepted                         |
| 3   | npm publish & consumer isolation  | [`../testing.md`](../testing.md), [`publish-checklist.md`](./publish-checklist.md)                                     | Accepted                         |
| 4   | Live testnet smoke CI             | [`.github/workflows/testnet-smoke.yml`](../../.github/workflows/testnet-smoke.yml), [`../testing.md`](../testing.md)   | Accepted                         |
| 5   | Multi-contract dependency deploy  | [`../adr/0005-multi-contract-dependency-deploy.md`](../adr/0005-multi-contract-dependency-deploy.md)                   | Accepted (experimental template) |

Do not tag `v1.0.0` / publish `latest` until Track B evidence in [`v1-readiness.md`](./v1-readiness.md) is complete.
