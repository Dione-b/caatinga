# Stellar CLI — maintainer upgrade process

## Upgrade Process

1. Install the new Stellar CLI locally.
2. Capture `stellar --version` and update parser fixtures for build, deploy, bindings, and invoke output.
3. Run `pnpm test`.
4. Bump `STELLAR_CLI_LAST_TESTED_VERSION` in `packages/core/src/stellar-cli/compat.ts` and refresh the relevant `ctg doctor` strings.
5. Document the new advisory boundary in the CLI README and the version contract doc.

## CI Rule

CI installs Stellar CLI via `stellar/stellar-cli@v27.0.0` in `.github/workflows/ci.yml` for the main test job (adjust
the tag when raising `STELLAR_CLI_LAST_TESTED_VERSION`).

A separate **`stellar-cli-matrix`** job installs `23.0.0`, `25.2.0`, and `27.0.0` and runs live capability probes plus parser fixture matrix tests (`stellar-cli-fixture-matrix.test.ts`). Parser fixture tests also run on every push in the main `ci` job.
