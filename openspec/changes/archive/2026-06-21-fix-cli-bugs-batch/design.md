## Context

Four independent bugs in `@caatinga/cli` and `@caatinga/core`, confirmed by reading the source:

- **Bug #1 (HIGH):** `createProjectFromTemplate` copies template files while excluding `node_modules`, `target`, `.git`, `test_snapshots` (`TEMPLATE_COPY_EXCLUDED_DIRS`). But its post-copy pass, `replaceTemplateVariables`, recursively walks the **whole** `targetDir` with `readdir` + `stat`. When `caatinga zk init --force` merges into an existing project, `targetDir` is the project root, so the walk enters `node_modules`. `stat` follows symlinks, so a dangling `node_modules/@hot-wallet/sdk` symlink throws `ENOENT`. (`packages/core/src/templates/create-project-from-template.ts:116-137`)
- **Bug #2 (MEDIUM):** `resolveCliSource` returns `explicit ?? process.env.CAATINGA_SOURCE ?? "alice"` (`packages/core/src/contracts/source-account.ts:22`). `read` passes `options.source` straight through, and its `-s/--source` help only says "Optional ... for simulation context" — the `alice`/`CAATINGA_SOURCE` fallback is undisclosed at the point of use.
- **Bug #3 (LOW):** Both `dependenciesDiagnostic` and `configDiagnostic` return the label `Project dependencies not installed` (`project-diagnostic.ts:18`, `dependencies-diagnostic.ts:33`). Before `npm install`, `runAllDiagnostics` prints both → the line appears twice.
- **Bug #4 (MEDIUM):** `networkDiagnostic` calls `loadConfig()`; when deps are missing, `loadConfig` throws `DEPENDENCIES_NOT_INSTALLED`, which is caught and rendered as `✗ network <name> not found` — a false cause.

Constraint: the project ships under an "honest guardrails" ethos (recent release work). Fixes must preserve happy-path output and add test coverage alongside the existing `*.test.ts` files.

## Goals / Non-Goals

**Goals:**

- `caatinga zk init --force` succeeds regardless of unrelated `node_modules`/symlink state.
- The source-identity fallback is documented and announced when used.
- `caatinga doctor` reports a missing-dependencies state exactly once and never as a phantom missing network.
- Each fix carries a focused unit test.

**Non-Goals:**

- Changing the default identity (`alice` stays the default) or the `CAATINGA_SOURCE` precedence.
- Reworking the diagnostics framework or doctor output ordering beyond the two targeted fixes.
- Touching `invoke`, whose `-s/--source` is already `requiredOption` (no silent fallback there).

## Decisions

**1. Bug #1 — exclude dirs + don't follow symlinks in `replaceTemplateVariables`.**
Reuse the existing `TEMPLATE_COPY_EXCLUDED_DIRS` set to skip excluded directories during the walk, and switch the per-entry `stat` to `lstat` so symlinks are detected and skipped (never dereferenced). This keeps the substitution scoped to real template files and makes a dangling symlink harmless.

- _Alternative considered:_ wrap `stat` in try/catch and swallow `ENOENT`. Rejected — it would still needlessly traverse `node_modules` and could mask genuine errors. Excluding the dirs is both faster and more correct.
- _Alternative considered:_ only walk the set of files that were copied. Cleaner long-term but a larger change to the copy/substitute contract; the exclusion+lstat fix fully resolves the reported bug with minimal blast radius.

**2. Bug #2 — disclose the fallback in `read`, not in core.**
Resolve the source in the `read` command (or a small CLI helper) so the command can emit a one-line `logger.info` notice naming the resolved identity and its origin (`explicit` → silent, `CAATINGA_SOURCE`, or `default alice`), and update the flag help text. Core's `resolveCliSource` keeps its behavior; disclosure is a CLI/UX concern and the command already owns user-facing logging.

- _Alternative considered:_ warn from inside `resolveCliSource` in core. Rejected — core is non-interactive library code used by multiple call sites (including `read-contract.ts`); printing from there couples the library to a logger and would fire in contexts that shouldn't print.

**3. Bug #3 — config diagnostic yields the dependencies line to the dependencies diagnostic.**
Change `configDiagnostic`'s return type to `Diagnostic | undefined` and return `undefined` for the `DEPENDENCIES_NOT_INSTALLED` branch. `runAllDiagnostics` already filters `undefined`, so `dependenciesDiagnostic` becomes the single owner of that line.

- _Alternative considered:_ dedupe by label in `runAllDiagnostics`. Rejected — brittle string matching; the source-of-line should be explicit.

**4. Bug #4 — skip the network check when the cause is missing dependencies / unloadable config.**
In `networkDiagnostic`, when `loadConfig` throws `DEPENDENCIES_NOT_INSTALLED` (or `CONFIG_NOT_FOUND`), return `undefined` so doctor stays silent about the network and lets the dependencies/config diagnostics carry the accurate signal. A genuinely missing network (config loads, network absent) still reports `✗ network <name> not found`.

## Risks / Trade-offs

- **`lstat` skips symlinked template files that legitimately need substitution** → Templates do not ship symlinked text files; substitution targets are regular files. Acceptable, and safer than crashing.
- **A new `read` notice adds a line to output that scripts might parse** → It is a `logger.info` line on stderr-style advisory output, only when `--source` is omitted; explicit-source runs (the scripted path) stay unchanged.
- **`configDiagnostic` returning `undefined`** → Verified `runAllDiagnostics` filters `undefined` already; the doctor "ready" calculation operates on the filtered array, so no false "ready".
- **Network check skipped could hide a real config issue** → No: the config diagnostic still reports config problems; only the redundant network line is suppressed, and only for the dependency/config-load failure causes.

## Migration Plan

Pure bug fixes, no schema/API/dependency changes and no data migration. Ship in the next patch release with updated unit tests; rollback is a straight revert of the touched files.
