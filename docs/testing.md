# Testing

Default CI does not require testnet access, Freighter, or private keys. Tests use mocked command execution, mocked generated bindings, and checked-in Stellar CLI output fixtures.

Live testnet smoke uses `CAATINGA_CI_IDENTITY_ALIAS` and `CAATINGA_CI_STELLAR_CONFIG_B64`. Caatinga receives only the identity alias through `--source`; secret material is restored into Stellar CLI config and deleted after the job.

Smoke script exit codes: `0` success; `1` hard failure (no workflow retry — includes Caatinga/parser/Stellar CLI version errors); `2` classified transient testnet failure (the workflow runs at most one retry). Artifacts uploaded from CI include `smoke-ci-out/*-smoke.log`, `*-caatinga-version.txt`, `*-stellar-version.txt`, and each generated app directory’s `caatinga.artifacts.json`. The live smoke now proves both official templates: `react-vite-counter` and `marketplace-with-token`, including on-chain verification that `marketplace.token_contract_id` matches the deployed token contract ID. Prefer the config blob plus alias; never pass raw secrets to `caatinga --source`. If you must use a raw `CAATINGA_CI_SECRET_KEY` (spec alternative), bake the identity into a local `config.toml` with the Stellar CLI, then base64-encode that file for `CAATINGA_CI_STELLAR_CONFIG_B64` — current `stellar keys add` does not accept a non-interactive inline secret in a way suitable for CI.

Stellar CLI fixtures live under:

```txt
packages/core/test/fixtures/stellar-cli/
```

Use versioned directories such as `v26.0.0` when the output came from a known CLI version. Use `unknown` only for minimal parser edge cases.

New Stellar CLI version fixtures should include the CLI semver in the filename, for example `version.v22.0.1.fixture.txt`. Existing legacy `version.txt` fixtures remain valid until touched by parser fixture work. Other command-output fixtures may continue using existing names inside versioned directories.

See [Stellar CLI Version Contract](./stellar-cli-version-contract.md) for the supported version range and upgrade process.

When adding parser behavior:

1. Add the raw CLI output fixture.
2. Add a parser test that reads the fixture.
3. Include at least one failure fixture.
4. Assert the public `CAATINGA_*` error code.

When adding `@caatinga/client` behavior:

1. Use mocked generated bindings.
2. Use mocked wallet adapters.
3. Assert XDR is omitted unless `debugXdr` is enabled.
4. Assert raw output is omitted unless `debugRaw` is enabled.
5. Assert wallet and binding failures use public `CAATINGA_*` codes.

The default GitHub Actions workflow runs typecheck, build, and tests.

## Live testnet smoke (release gate)

Workflow: `.github/workflows/testnet-smoke.yml` — triggers: daily cron, `workflow_dispatch`, GitHub Release `published`.

Required secrets: `CAATINGA_CI_IDENTITY_ALIAS`, `CAATINGA_CI_STELLAR_CONFIG_B64`.

Before tagging `v1.0.0`, verify three consecutive successful scheduled runs (see [v1.0.0 observability plan](./release/v1.0.0.md#observability-plan)).
