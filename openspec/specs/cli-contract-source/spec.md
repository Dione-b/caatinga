# cli-contract-source Specification

## Purpose

Transparent resolution of the Stellar source identity for `read`/`invoke`, including how defaults are chosen and disclosed to the user.

## Requirements

### Requirement: Source identity fallback is disclosed

When `caatinga read` (or any command resolving the Stellar source via `resolveCliSource`) is invoked without an explicit `-s/--source`, the CLI SHALL resolve the identity from `CAATINGA_SOURCE` or fall back to the built-in `alice` default, and MUST disclose which identity it resolved and where that value came from. The `read` command's `-s/--source` help text SHALL document that omission falls back to `CAATINGA_SOURCE` then `alice`.

#### Scenario: read without --source uses default and announces it

- **WHEN** a user runs `caatinga read app.hello` with no `-s/--source` flag and no `CAATINGA_SOURCE` set
- **THEN** the command uses the `alice` identity
- **AND** it prints an informational notice stating the resolved identity is `alice` and that it came from the built-in default

#### Scenario: read without --source uses CAATINGA_SOURCE and announces it

- **WHEN** a user runs `caatinga read app.hello` with no `-s/--source` flag while `CAATINGA_SOURCE=bob` is set
- **THEN** the command uses the `bob` identity
- **AND** it prints an informational notice stating the resolved identity is `bob` and that it came from `CAATINGA_SOURCE`

#### Scenario: read with explicit --source is silent about defaults

- **WHEN** a user runs `caatinga read app.hello --source carol`
- **THEN** the command uses `carol`
- **AND** it does not print a fallback notice

#### Scenario: Help text documents the fallback

- **WHEN** a user runs `caatinga read --help`
- **THEN** the `-s/--source` option description states that omitting it resolves `CAATINGA_SOURCE` and otherwise defaults to `alice`
