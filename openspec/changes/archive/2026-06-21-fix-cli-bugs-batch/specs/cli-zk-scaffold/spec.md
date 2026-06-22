## ADDED Requirements

### Requirement: ZK scaffolding ignores unrelated project state

When scaffolding ZK files into an existing project, the CLI SHALL only process the template-derived files and MUST NOT traverse build, dependency, or VCS directories of the host project. The post-copy template-variable substitution SHALL exclude the same directories the copy step excludes (`node_modules`, `target`, `.git`, `test_snapshots`).

#### Scenario: Project contains node_modules with a broken symlink

- **WHEN** a user runs `caatinga zk init --force` in a project whose `node_modules/@hot-wallet/sdk` is a broken (dangling) symlink
- **THEN** the command completes successfully and adds the ZK circuit and verifier scaffold
- **AND** it does not throw an `ENOENT` error from descending into `node_modules`

### Requirement: Directory walk does not follow symlinks

The template-variable substitution walk SHALL NOT follow symbolic links, so a dangling or cyclic symlink anywhere under the target directory cannot crash the command.

#### Scenario: Dangling symlink outside node_modules

- **WHEN** the project contains a dangling symlink in a directory that is otherwise eligible for substitution
- **THEN** the walk skips the symlink without attempting to read its missing target
- **AND** the command does not fail with `ENOENT`
