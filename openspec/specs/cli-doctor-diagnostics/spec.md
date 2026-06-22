# cli-doctor-diagnostics Specification

## Purpose

Accurate, non-duplicated `caatinga doctor` reporting that distinguishes "dependencies not installed" from unrelated config/network failures.

## Requirements

### Requirement: Missing dependencies are reported exactly once

When project dependencies are not installed, `caatinga doctor` SHALL report `Project dependencies not installed` at most once. The dependencies diagnostic owns this line; the config diagnostic SHALL NOT emit a duplicate when the underlying failure is `DEPENDENCIES_NOT_INSTALLED`.

#### Scenario: doctor run before npm install

- **WHEN** a user runs `caatinga doctor` in a Caatinga project before running `npm install`
- **THEN** the line `✗ Project dependencies not installed` appears exactly once in the output

### Requirement: Network check does not blame the network when dependencies are missing

When the network diagnostic cannot evaluate the configured network because dependencies are not installed (or `caatinga.config.ts` cannot be loaded for that reason), `caatinga doctor` SHALL NOT report the network as "not found". It SHALL skip the network check so the missing-dependencies diagnostic remains the single, accurate signal.

#### Scenario: doctor with --network before npm install

- **WHEN** a user runs `caatinga doctor --network testnet` before running `npm install`
- **THEN** the output does not contain `✗ network testnet not found`
- **AND** the missing dependencies are reported instead

#### Scenario: Genuinely missing network after dependencies are installed

- **WHEN** a user runs `caatinga doctor --network ghostnet` with dependencies installed and `ghostnet` absent from `caatinga.config.ts`
- **THEN** the output reports `✗ network ghostnet not found` with a fix hint
