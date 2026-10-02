# Stellar CLI — maintainer upgrade process

## Upgrade Process

1. Install the new Stellar CLI locally.
2. Capture `stellar --version` and update parser fixtures for build, deploy, bindings, and invoke output.
3. Run `pnpm test`.
4. Bump `STELLAR_CLI_LAST_TESTED_VERSION` in `packages/core/src/stellar-cli/version.ts` (re-exported from `compat.ts`) and refresh the relevant `ctg doctor` strings.
5. Document the new advisory boundary in the CLI README and the version contract doc.

## CI Rule

CI installs Stellar CLI with `bash scripts/install-stellar-cli.sh 28.0.0` in `.github/workflows/ci.yml` for the main
test job, restoring `~/.local/bin/stellar` from an `actions/cache` entry keyed
`stellar-cli-28.0.0-<os>-<arch>` and then verifying `stellar --version` matches.

When raising `STELLAR_CLI_LAST_TESTED_VERSION`, bump these pins together:

- the install argument, cache key, and version check in `.github/workflows/ci.yml`,
  `.github/workflows/testnet-smoke.yml`, and `.github/workflows/testnet-deploy-regression.yml`
- the expected version in `scripts/check-ci-stellar-pin.sh` (run by `pnpm ci:publish-matrix` and
  `pnpm pre:publish`), which fails if `ci.yml` does not install the pinned version

A separate **`stellar-cli-matrix`** job installs `23.3.0` (minimum supported version) and runs live capability probes plus parser fixture matrix tests (`stellar-cli-fixture-matrix.test.ts`). Parser fixture tests and latest version validation (`28.0.0`) also run on every push in the main `ci` job.
