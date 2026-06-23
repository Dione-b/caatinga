## ADDED Requirements

### Requirement: Safe config merge in zk init

The `caatinga zk init` command SHALL merge ZK configuration into `caatinga.config.ts` without fragile regex.

#### Scenario: add zk config to clean config

- **WHEN** user runs `caatinga zk init` in a project with a standard `caatinga.config.ts`
- **THEN** the ZK circuit and verifier config sections are added without corrupting existing content

#### Scenario: zk config already present

- **WHEN** user runs `caatinga zk init` and ZK config already exists
- **THEN** the config is not modified

#### Scenario: non-standard config formatting

- **WHEN** user runs `caatinga zk init` and `caatinga.config.ts` has non-standard spacing
- **THEN** the merge still works correctly (toastable regex or AST-based approach)

#### Scenario: merge failure fallback

- **WHEN** the merge logic cannot safely modify the config
- **THEN** the CLI prints instructions to manually add ZK config and does NOT modify the file
