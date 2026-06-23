## ADDED Requirements

### Requirement: Single config load in doctor

The `doctor` command SHALL load `caatinga.config.ts` exactly once.

#### Scenario: doctor runs diagnostics

- **WHEN** `caatinga doctor` runs
- **THEN** `loadConfig` is called once and the result is reused for all diagnostics that need it

### Requirement: Diagnostic skip transparency

When a diagnostic is skipped (returns `undefined`), the user SHALL be informed.

#### Scenario: network check skipped

- **WHEN** `--network` is not provided to doctor
- **THEN** the network diagnostic is clearly skipped with a note saying "pass --network to validate"

#### Scenario: source check skipped

- **WHEN** `--source` is not provided to doctor
- **THEN** the source identity diagnostic is skipped with a note saying "pass --source to validate"

### Requirement: Version freshness

Stellar CLI and SDK version references SHALL use constants, not hardcoded strings.

#### Scenario: doctor shows Stellar CLI version

- **WHEN** doctor runs and Stellar CLI version is below minimum
- **THEN** the fix message references `STELLAR_CLI_LAST_TESTED_VERSION` constant, not a hardcoded string
