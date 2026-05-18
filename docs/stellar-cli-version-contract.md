# Stellar CLI Version Contract

Caatinga shells out to Stellar CLI for current build, deploy, bindings, and invoke commands. Future XDR or doctor commands must follow the same version contract when implemented. Unsupported CLI versions are not assumed safe.

## Supported Range

- Minimum: `23.0.0` (22.x cannot sign `stellar contract invoke`; Caatinga rejects it up front)
- Tested maximum: `25.2.0`

Pinned install:

```bash
cargo install --locked stellar-cli --version 25.2.0
stellar --version
```

Caatinga supports Stellar CLI 23.0.0 through 25.2.0. Versions below 23.0.0 fail with CAATINGA_UNSUPPORTED_CLI_VERSION. Versions above 25.2.0 fail with CAATINGA_UNTESTED_CLI_VERSION unless --allow-untested-stellar-cli is explicitly used for local experiments. Release and CI gates must not use that override.

Runtime behavior:

- Below the minimum: fail with `CAATINGA_UNSUPPORTED_CLI_VERSION`.
- Above the tested maximum: fail with `CAATINGA_UNTESTED_CLI_VERSION`.
- Local override: pass `--allow-untested-stellar-cli`.
- CI must not use the override.

### Local override examples

Run these only on a developer machine when you accept compatibility risk:

- `caatinga build counter --allow-untested-stellar-cli`
- `caatinga deploy counter -s <identity> --allow-untested-stellar-cli`
- `caatinga generate counter --allow-untested-stellar-cli`
- `caatinga invoke counter.increment -s <identity> --allow-untested-stellar-cli` (replace `<identity>` with your local Stellar CLI identity alias)

## Upgrade Process

1. Install the new Stellar CLI locally.
2. Capture `stellar --version` in a versioned fixture.
3. Add or update parser fixtures for build, deploy, bindings, and invoke output.
4. Run `pnpm test`.
5. Raise `STELLAR_CLI_TESTED_MAX_VERSION` only after fixtures and smoke validation pass.

## CI Rule

CI installs Stellar CLI via `stellar/stellar-cli@v25.2.0` in `.github/workflows/ci.yml` (adjust the tag when raising `STELLAR_CLI_TESTED_MAX_VERSION`). Parser fixture tests run on every push and pull request. The override flag is for local experiments only because CI is the release boundary.
