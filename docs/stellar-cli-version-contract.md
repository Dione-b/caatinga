# Stellar CLI Version Contract

Caatinga shells out to Stellar CLI for current build, deploy, and invoke commands. Binding generation uses `npx @stellar/stellar-sdk generate` (no Stellar CLI required). Future XDR or doctor commands must follow the same version contract when implemented.

## Hard Floor

- Minimum: `23.0.0`. 22.x cannot sign `stellar contract invoke` (xdr value invalid). Caatinga rejects it up front with `CAATINGA_UNSUPPORTED_CLI_VERSION`.

The hard floor is the only hard failure on the version axis. Versions below it must be upgraded before Caatinga will run.

## Advisory Last-Tested Version

- Last-tested: `25.2.0`

`25.2.0` is the highest Stellar CLI version Caatinga has validated against parser fixtures and smoke tests. It is **advisory only** — Caatinga does not hard-fail on newer versions.

### Runtime behavior

- Below the hard floor (`< 23.0.0`): fail with `CAATINGA_UNSUPPORTED_CLI_VERSION`.
- Above the last-tested version (`> 25.2.0`): emit a stderr advisory and continue. The advisory is non-fatal; the command exits 0 and the version gate does not block the requested operation.
- Within the supported range (`23.0.0`–`25.2.0`): silent, no warnings.

The advisory surfaces as a `Diagnostic.warnings` entry in `caatinga doctor` and as a stderr line in every Caatinga command that shells out to Stellar CLI.

### Warning shape

```text
Warning: Stellar CLI 26.0.0 is newer than the last-tested 25.2.0; proceeding without compatibility guarantees.
  Pin Stellar CLI to the last-tested version, or update Caatinga after re-running the parser fixtures.
```

## Compatibility Mechanism

`@caatinga/core` exports `evaluateStellarCliCompatibility({ version, features?, lastTestedVersion? })`, which returns a structured `CompatibilityReport`:

```ts
type CompatibilityStatus = "supported" | "untested" | "unsupported";

type CompatibilityReport = {
  version: string;
  status: CompatibilityStatus;
  minVersion: string;        // "23.0.0" — hard floor
  lastTestedVersion: string; // "25.2.0" — advisory only
  warnings: CompatibilityWarning[];
};
```

- `status === "unsupported"` => throw `CAATINGA_UNSUPPORTED_CLI_VERSION`.
- `status === "untested"` => emit warnings; do not throw.
- `status === "supported"` => proceed silently.

The optional `features` argument is a forward-compatible hook for future capability checks. When a feature is missing, the report is downgraded to `"untested"` and a `STELLAR_CLI_MISSING_FEATURE` warning is appended. No live probe is performed yet; the hook is wired through the API and tests only.

## Recommended Install

```bash
cargo install --locked stellar-cli --version 25.2.0
stellar --version
```

## Upgrade Process

1. Install the new Stellar CLI locally.
2. Capture `stellar --version` and update parser fixtures for build, deploy, bindings, and invoke output.
3. Run `pnpm test`.
4. Bump `STELLAR_CLI_LAST_TESTED_VERSION` in `packages/core/src/stellar-cli/compat.ts` and refresh the relevant `caatinga doctor` strings.
5. Document the new advisory boundary in the CLI README and the version contract doc.

## CI Rule

CI installs Stellar CLI via `stellar/stellar-cli@v25.2.0` in `.github/workflows/ci.yml` (adjust
the tag when raising `STELLAR_CLI_LAST_TESTED_VERSION`). Parser fixture tests run on every push
and pull request.
