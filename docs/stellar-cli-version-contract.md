# Stellar CLI Version Contract

Caatinga shells out to Stellar CLI for current build, deploy, and invoke commands. Binding generation uses `npx @stellar/stellar-sdk generate` (no Stellar CLI required). Future XDR or doctor commands must follow the same version contract when implemented.

## Hard Floor

- Minimum: `23.0.0`. 22.x cannot sign `stellar contract invoke` (xdr value invalid). Caatinga rejects it up front with `CAATINGA_UNSUPPORTED_CLI_VERSION`.

The hard floor is the only hard failure on the version axis. Versions below it must be upgraded before Caatinga will run.

## Advisory Last-Tested Version

- Last-tested: `27.0.0`

`27.0.0` is the highest Stellar CLI version Caatinga has validated against parser fixtures and smoke tests. It is **advisory only** — Caatinga does not hard-fail on newer versions.

### Runtime behavior

- Below the hard floor (`< 23.0.0`): fail with `CAATINGA_UNSUPPORTED_CLI_VERSION`.
- Above the last-tested version (`> 27.0.0`): emit a stderr advisory and continue. The advisory is non-fatal; the command exits 0 and the version gate does not block the requested operation.
- Within the supported range (`23.0.0`–`27.0.0`): silent, no warnings.

The advisory surfaces as a `Diagnostic.warnings` entry in `caatinga doctor` and as a stderr line in every Caatinga command that shells out to Stellar CLI.

### Warning shape

```text
Warning: Stellar CLI 28.0.0 is newer than the last-tested 27.0.0; proceeding without compatibility guarantees.
  Pin Stellar CLI to the last-tested version, or update Caatinga after re-running the parser fixtures.
```

The optional `features` argument lists **missing** capabilities. At runtime, `checkStellarCliVersion()` probes the installed binary for `contract-build`, `contract-deploy`, and `contract-invoke-sign` subcommands and appends any missing ids before evaluating compatibility.

## Version matrix

| Version | Status              | Build    | Deploy   | Invoke         | Bindings    | Fixture coverage      |
| ------- | ------------------- | -------- | -------- | -------------- | ----------- | --------------------- |
| 22.x    | **blocked**         | —        | parses\* | broken signing | —           | `v22.0.0/`            |
| 23.0.0  | supported (floor)   | ✓        | ✓        | ✓              | SDK (`npx`) | min-version gate only |
| 24.0.0  | supported           | ✓        | ✓        | ✓              | SDK         | `v24.0.0/`            |
| 25.2.0  | supported           | ✓        | ✓        | ✓              | SDK         | `v25.2.0/`            |
| 26.0.0  | supported           | fixtures | fixtures | fixtures       | SDK         | `v26.0.0/`            |
| 27.0.0  | **last-tested**     | ✓        | ✓        | ✓              | SDK         | `v27.0.0/` + CI pin   |
| 28.0.0+ | untested (advisory) | fixtures | fixtures | fixtures       | SDK         | —                     |

\*22.x deploy stdout still parses, but invoke signing fails — Caatinga hard-fails below 23.0.0 before any command runs.

Bindings generation uses `npx @stellar/stellar-sdk generate` — see [Stellar SDK version contract](./stellar-sdk-version-contract.md).

## Compatibility Mechanism

`@caatinga/core` exports `evaluateStellarCliCompatibility({ version, features?, lastTestedVersion? })`, which returns a structured `CompatibilityReport`:

```ts
type CompatibilityStatus = "supported" | "untested" | "unsupported";

type CompatibilityReport = {
  version: string;
  status: CompatibilityStatus;
  minVersion: string; // "23.0.0" — hard floor
  lastTestedVersion: string; // "27.0.0" — advisory only
  warnings: CompatibilityWarning[];
};
```

- `status === "unsupported"` => throw `CAATINGA_UNSUPPORTED_CLI_VERSION`.
- `status === "untested"` => emit warnings; do not throw.
- `status === "supported"` => proceed silently.

The optional `features` argument is a forward-compatible hook for capability checks. When a feature is missing, the report is downgraded to `"untested"` and a `STELLAR_CLI_MISSING_FEATURE` warning is appended. Live probes run in `checkStellarCliVersion()` unless `probeFeatures: false`.

## Recommended Install

```bash
cargo install --locked stellar-cli --version 27.0.0
stellar --version
```

> **Maintainers:** upgrade steps and CI matrix rules live in [Stellar CLI upgrade process](./internal/stellar-cli-upgrade.md).
