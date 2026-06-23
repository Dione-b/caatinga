## ADDED Requirements

### Requirement: Progress indicators for long operations

Build, deploy, and setup steps SHALL show visual progress indicators.

#### Scenario: setup with progress

- **WHEN** `caatinga setup` installs Rust, WASM target, or Stellar CLI
- **THEN** each step shows a spinner or progress message

#### Scenario: build with feedback

- **WHEN** `caatinga build` compiles WASM
- **THEN** the CLI shows a status message indicating compilation is in progress

#### Scenario: deploy retry progress

- **WHEN** deploy hits a transient error and retries
- **THEN** the CLI shows retry count and cooldown timer

### Requirement: Semver validation

The `setup` command SHALL use the `semver` npm package for version comparison instead of custom parsing.

#### Scenario: version comparison

- **WHEN** comparing Rust version `1.80.0-beta` against minimum `1.75.0`
- **THEN** `semver` correctly handles the pre-release tag

#### Scenario: semver dependency

- **WHEN** `@caatinga/cli` is installed
- **THEN** `semver` is available as a runtime dependency
