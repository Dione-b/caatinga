## ADDED Requirements

### Requirement: Safe config merge

When adding ZK config to `caatinga.config.ts`, the CLI SHALL use a non-fragile merge strategy (improved regex or AST-based) that tolerates formatting variations.

#### Scenario: add zk config to standard config

- **WHEN** user runs `caatinga zk init` in a project with a standard `caatinga.config.ts`
- **THEN** ZK circuit and verifier config sections are injected without corrupting existing content

#### Scenario: zk config already present

- **WHEN** user runs `caatinga zk init` and ZK config already exists
- **THEN** the config file is not modified

#### Scenario: non-standard formatting

- **WHEN** `caatinga.config.ts` has non-standard spacing or formatting
- **THEN** the merge handles it gracefully or prints manual instructions instead of corrupting the file

#### Scenario: merge error fallback

- **WHEN** the merge logic cannot safely modify the config
- **THEN** the CLI prints clear instructions to manually add the ZK config section and does NOT modify the file
