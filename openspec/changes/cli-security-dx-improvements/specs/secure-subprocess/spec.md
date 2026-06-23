## ADDED Requirements

### Requirement: Verified downloads in setup

The CLI SHALL download and verify tools before execution instead of piping unverified shell scripts.

#### Scenario: rustup download with checksum

- **WHEN** `caatinga setup` needs to install Rust
- **THEN** the CLI downloads `rustup-init` via `https.get` and verifies SHA256 checksum before executing

#### Scenario: checksum mismatch

- **WHEN** the downloaded file checksum does not match the expected value
- **THEN** the CLI SHALL NOT execute the file and SHALL print an error with the mismatch details

### Requirement: Subprocess timeouts

All `execa` subprocess calls SHALL have a configurable timeout and cancel signal.

#### Scenario: cargo install times out

- **WHEN** `cargo install --locked stellar-cli` exceeds the timeout
- **THEN** the subprocess is killed and a timeout error is printed

#### Scenario: timeout env var

- **WHEN** `CAATINGA_SUBPROCESS_TIMEOUT` env var is set
- **THEN** the timeout value is read from the env var (in milliseconds)
- **WHEN** the env var is not set
- **THEN** timeout defaults to 600000ms (10 minutes)

### Requirement: Exit code consistency

The CLI SHALL use `process.exitCode = 1` instead of `process.exit(1)` everywhere.

#### Scenario: preflight failure

- **WHEN** `assertPreflight()` detects Node.js below minimum version
- **THEN** the CLI prints the error and sets `process.exitCode = 1` without calling `process.exit()`

#### Scenario: global catch

- **WHEN** an unhandled error reaches the global catch in `index.ts`
- **THEN** the error is logged via `runCliAction` error formatter and `process.exitCode = 1`
- **THEN** the error object is NOT logged directly via `console.error`
