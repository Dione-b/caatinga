# Testing

## Contents

- [Default CI](#default-ci)
- [Deploy regression (testnet)](#deploy-regression-testnet)
- [Live testnet smoke (release gate)](#live-testnet-smoke-release-gate)
- [Smoke script exit codes](#smoke-script-exit-codes)
- [Smoke secrets handling](#smoke-secrets-handling)
- [Stellar CLI config blob format](#stellar-cli-config-blob-format)
- [Stellar CLI fixtures](#stellar-cli-fixtures)
- [Adding parser behavior](#adding-parser-behavior)
- [Adding `@caatinga/client` behavior](#adding-caatingaclient-behavior)

Default CI does not require testnet access, Freighter, or private keys. Tests use mocked command execution, mocked generated bindings, and checked-in Stellar CLI output fixtures.

## Default CI

The default GitHub Actions workflow (`.github/workflows/ci.yml`) runs, in the `ci` job: `pnpm lint`, `pnpm check:versions`,
`pnpm typecheck`, `pnpm docs:check`, `pnpm check:template-imports`, `pnpm build`, and `pnpm test`, with Stellar CLI
`28.0.0` installed. A separate `stellar-cli-matrix` job installs Stellar CLI `23.3.0` (minimum supported) and runs the
parser fixture matrix and live capability probe tests. No testnet access required.

## Deploy regression (testnet)

Workflow: `.github/workflows/testnet-deploy-regression.yml` — triggers: weekly schedule (Monday), `workflow_dispatch`.

Steps (on a copy of the `react-vite-counter` template): `ctg build counter` → `ctg deploy counter --if-changed` →
`ctg generate counter --strict-network` → `ctg doctor --strict-bindings`. The workflow does not run `ctg smoke`.

Local equivalent:

```bash
npx ctg regression --network testnet --source "$CAATINGA_CI_IDENTITY_ALIAS"
```

Use `ctg ci run --strict` in CI after restoring identity secrets when you only need doctor + smoke (no full regression).

## Live testnet smoke (release gate)

Workflow: `.github/workflows/testnet-smoke.yml` — triggers: daily cron, `workflow_dispatch`, GitHub Release `published`.

Required secrets: `CAATINGA_CI_IDENTITY_ALIAS`, `CAATINGA_CI_STELLAR_CONFIG_B64`.

### Smoke script exit codes

| Exit code | Meaning                                                       | Workflow behavior                    |
| --------- | ------------------------------------------------------------- | ------------------------------------ |
| `0`       | Success                                                       | Pass.                                |
| `1`       | Hard failure (Caatinga, parser, or Stellar CLI version error) | No workflow retry.                   |
| `2`       | Classified transient testnet failure                          | The workflow runs at most one retry. |

CI uploads the following artifacts: `smoke-ci-out/*-smoke.log`, `*-caatinga-version.txt`, `*-stellar-version.txt`, and each generated app directory’s `caatinga.artifacts.json`. The live smoke proves the `react-vite-counter` template end-to-end on testnet, including build, deploy, binding generation, Vite build, and invoke.

### Smoke secrets handling

Live testnet smoke uses `CAATINGA_CI_IDENTITY_ALIAS` and `CAATINGA_CI_STELLAR_CONFIG_B64`. Caatinga receives only the identity alias through `--source`; secret material is restored into the Stellar CLI config directory and deleted after the job.

> Prefer the config blob plus alias; **never pass raw secrets to `ctg --source`**.

### Stellar CLI config blob format

With Stellar CLI `28.0.0` (the CI pin), the safest secret format is a base64-encoded tar archive whose contents include `.config/stellar/config.toml` and `.config/soroban/identity/<alias>.toml`. The restore step still accepts the legacy plain `config.toml` payload, but that format can no longer recreate file-based identities by itself.

To refresh `CAATINGA_CI_STELLAR_CONFIG_B64` for the current CLI layout:

```bash
mkdir -p ci-stellar-config/.config
cp -R ~/.config/stellar ci-stellar-config/.config/stellar
cp -R ~/.config/soroban ci-stellar-config/.config/soroban
tar -C ci-stellar-config -czf stellar-ci-config.tgz .config
base64 -w0 stellar-ci-config.tgz
```

CI restores the secret with `bash scripts/restore-stellar-ci-config.sh`, which requires the archive
to contain a top-level `.config/` directory.

Do **not** use `ctg identity export` for this secret: it archives the contents of
`~/.config/stellar` without the `.config/` prefix (and without `soroban/`), so the restore script
rejects it. `ctg identity export` / `ctg identity import <file>` are for moving an identity between
local machines.

Before encoding, verify that `stellar keys public-key "$CAATINGA_CI_IDENTITY_ALIAS"` succeeds locally with the same files.

Before promoting a release to `latest`, confirm recent scheduled smoke runs are green (see the
[v1.0.0 observability plan](./release/v1.0.0.md#observability-plan) for the original criteria).

### Stellar CLI fixtures

Stellar CLI fixtures live under:

```txt
packages/core/test/fixtures/stellar-cli/
```

Use versioned directories such as `v26.0.0` when the output came from a known CLI version. Use `unknown` only for minimal parser edge cases.

New Stellar CLI version fixtures should include the CLI semver in the filename, for example `version.v22.0.1.fixture.txt`. Existing legacy `version.txt` fixtures remain valid until touched by parser fixture work. Other command-output fixtures may continue using existing names inside versioned directories.

See [Stellar CLI Version Contract](../stellar-cli-version-contract.md) for the supported version range and upgrade process.

### Adding parser behavior

`pnpm check:fixtures` (`scripts/check-fixture-references.sh`) fails on orphaned files under
`packages/core/test/fixtures/stellar-cli/`. It is not a step in `ci.yml`; it runs as part of `pnpm ci:publish-matrix`
and `pnpm pre:publish`, so run it locally when you add or remove fixtures.

1. Add the raw CLI output fixture.
2. Add a parser test that reads the fixture.
3. Include at least one failure fixture.
4. Assert the public `CAATINGA_*` error code.

### Adding `@caatinga/client` behavior

1. Use mocked generated bindings.
2. Use mocked wallet adapters.
3. Assert XDR is omitted unless `debugXdr` is enabled.
4. Assert raw output is omitted unless `debugRaw` is enabled.
5. Assert wallet and binding failures use public `CAATINGA_*` codes.
