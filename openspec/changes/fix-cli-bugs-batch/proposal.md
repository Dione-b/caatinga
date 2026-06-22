## Why

Four reported CLI bugs undermine the "honest guardrails" promise: a high-severity crash blocks `caatinga zk init --force` in real projects, and three diagnostic/source-resolution defects mislead users about what the CLI is actually doing. They are independent root causes but share one theme — the CLI must behave predictably and report the truth before and after `npm install`.

## What Changes

- **Fix `caatinga zk init --force` ENOENT crash (HIGH):** `replaceTemplateVariables` walks the entire target directory after copying. When merging ZK files into an existing project the target is the project root, so the walk descends into `node_modules` and follows a broken symlink (e.g. `node_modules/@hot-wallet/sdk`) with `stat`, throwing `ENOENT`. Exclude the same directories the copy step excludes (`node_modules`, `target`, `.git`, `test_snapshots`) and stop following symlinks during the walk.
- **Make the `alice` source fallback honest (MEDIUM):** `caatinga read` (via `resolveCliSource`) silently falls back to `CAATINGA_SOURCE` or a hardcoded `alice` identity when `-s/--source` is omitted. Document the fallback in the `read` flag help and emit an informational notice naming the resolved identity and its origin (explicit / `CAATINGA_SOURCE` / default) whenever the value is not explicitly provided.
- **De-duplicate the dependencies-missing diagnostic (LOW):** Before `npm install`, both `dependenciesDiagnostic` and `configDiagnostic` print `✗ Project dependencies not installed`. Let `dependenciesDiagnostic` own that line and have `configDiagnostic` skip it when the failure is `DEPENDENCIES_NOT_INSTALLED`.
- **Stop reporting a false missing network (MEDIUM):** When dependencies are not installed, `loadConfig` cannot run, so `networkDiagnostic` falsely reports `✗ network <name> not found`. Detect the `DEPENDENCIES_NOT_INSTALLED` / `CONFIG_NOT_FOUND` cause and skip the network check instead of blaming the network.

No breaking changes — all four are bug fixes that preserve existing happy-path behavior.

## Capabilities

### New Capabilities

- `cli-zk-scaffold`: Robustly scaffolding ZK files into a new or existing project, including `--force` merges, without crashing on unrelated project state such as `node_modules` symlinks.
- `cli-contract-source`: Transparent resolution of the Stellar source identity for `read`/`invoke`, including how defaults are chosen and disclosed to the user.
- `cli-doctor-diagnostics`: Accurate, non-duplicated `caatinga doctor` reporting that distinguishes "dependencies not installed" from unrelated config/network failures.

### Modified Capabilities

<!-- None: no existing specs in openspec/specs/. -->

## Impact

- `packages/core/src/templates/create-project-from-template.ts` — directory-walk exclusions and symlink handling (Bug #1).
- `packages/cli/src/commands/read.command.ts` and `packages/core/src/contracts/source-account.ts` — source-fallback disclosure (Bug #2).
- `packages/cli/src/diagnostics/project-diagnostic.ts` and `packages/cli/src/diagnostics/run-all.ts` — diagnostic de-duplication and network check guarding (Bugs #3, #4).
- Affected commands: `caatinga zk init`, `caatinga read`, `caatinga invoke`, `caatinga doctor`.
- No external API, dependency, or config-schema changes.
