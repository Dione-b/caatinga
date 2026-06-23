# Stellar SDK Version Contract

Caatinga generates TypeScript bindings via `npx @stellar/stellar-sdk generate`. This document defines the supported SDK range and advisory boundaries.

## Hard Floor

- Minimum: `16.0.1` (Protocol 27, ESM-first bindings aligned with Caatinga templates).

Versions below the floor fail with `CAATINGA_UNSUPPORTED_SDK_VERSION` when checked at generate time or in `caatinga doctor`.

## Advisory Last-Tested Version

- Last-tested: `16.0.1`

Versions newer than the last-tested emit a non-fatal advisory. Binding output shape may differ; update fixtures after validation.

### Runtime behavior

- Below `16.0.1`: fail with `CAATINGA_UNSUPPORTED_SDK_VERSION`.
- Above `16.0.1`: stderr advisory + `caatinga doctor` warning; command continues.
- At `16.0.1`: silent.

## Compatibility mechanism

`@caatinga/core` exports `evaluateStellarSdkCompatibility({ version, lastTestedVersion? })` and `checkStellarSdkVersion({ cwd? })`.

Resolution order in `checkStellarSdkVersion`:

1. `node_modules/@stellar/stellar-sdk/package.json` in the project cwd.
2. `npm view @stellar/stellar-sdk version` (what `npx --yes` would resolve).

## Recommended pin

Official templates ship:

```json
"@stellar/stellar-sdk": "^16.0.1"
```

Pin explicitly in production projects and CI.

> **Maintainers:** upgrade steps live in [Stellar SDK upgrade process](./internal/stellar-sdk-upgrade.md).

## Related docs

- [Stellar CLI version contract](./stellar-cli-version-contract.md)
- [Production readiness](./production-readiness.md)
