# Stellar SDK — maintainer upgrade process

## Upgrade process

1. Install the target SDK version in a sample project.
2. Run `ctg generate` and capture output under `packages/core/test/fixtures/stellar-sdk/`.
3. Run `pnpm test`.
4. Bump `STELLAR_SDK_LAST_TESTED_VERSION` in `packages/core/src/stellar-sdk/version.ts`.
5. Update this document and template manifests.
