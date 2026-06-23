## ADDED Requirements

### Requirement: Contract ID validation on rollback

The `rollback` command SHALL validate `--to <contractId>` format before calling core.

#### Scenario: valid contract ID

- **WHEN** user runs `caatinga rollback app --to CABC123...` (56-char Soroban contract StrKey) or a 64-char hex contract ID
- **THEN** the contract ID passes format validation

#### Scenario: invalid contract ID format

- **WHEN** user runs `caatinga rollback app --to invalid`
- **THEN** the CLI prints a validation error and does not call core

### Requirement: Explicit arg validation for invoke/read

The `invoke` and `read` commands SHALL validate forwarded arguments instead of using `allowUnknownOption`/`allowExcessArguments`.

#### Scenario: invoke with valid args

- **WHEN** user runs `caatinga invoke app.method --arg value`
- **THEN** known flags are parsed by Commander and extra args are validated and forwarded to stellar CLI

#### Scenario: invoke with obviously invalid flag

- **WHEN** user runs `caatinga invoke app.method --typo`
- **THEN** Commander catches the unknown flag and prints a validation error
