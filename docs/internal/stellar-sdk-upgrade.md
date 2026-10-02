# Stellar SDK — maintainer upgrade process

## Upgrade process

1. Install the target SDK version in a sample project.
2. Run `ctg generate` against the sample project. SDK compatibility checks are covered by
   `packages/core/src/stellar-sdk/compat.test.ts`; there is no SDK fixture directory yet (only
   `packages/core/test/fixtures/stellar-cli/`), so create `packages/core/test/fixtures/stellar-sdk/`
   if you need to capture generated output as fixtures.
3. Run `pnpm test`.
4. Bump `STELLAR_SDK_LAST_TESTED_VERSION` in `packages/core/src/stellar-sdk/version.ts`.
5. Update this document and every workspace `@stellar/stellar-sdk` range together: both template
   `package.json` files and the `@caatinga/client` devDependency. The "workspace
   `@stellar/stellar-sdk` ranges" test in `compat.test.ts` fails if they drift from
   `^STELLAR_SDK_MIN_VERSION`.
