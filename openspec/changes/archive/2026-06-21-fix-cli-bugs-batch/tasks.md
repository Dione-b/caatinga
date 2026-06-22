## 1. Bug #1 — zk init ENOENT on node_modules symlink

- [x] 1.1 In `packages/core/src/templates/create-project-from-template.ts`, make `replaceTemplateVariables` skip `TEMPLATE_COPY_EXCLUDED_DIRS` directories and use `lstat` instead of `stat` so symlinks are detected and skipped (not dereferenced).
- [x] 1.2 Add a unit test (alongside existing template tests) proving `zk init --force` / template substitution succeeds when the target dir contains a dangling symlink under `node_modules`.

## 2. Bug #2 — disclose the source-identity fallback

- [x] 2.1 In `packages/cli/src/commands/read.command.ts`, update the `-s/--source` help text to state that omitting it resolves `CAATINGA_SOURCE`, otherwise defaults to `alice`.
- [x] 2.2 Emit an informational `logger` notice naming the resolved identity and its origin (`CAATINGA_SOURCE` or built-in default) when `--source` is omitted; stay silent when it is explicit.
- [x] 2.3 Extend `read.command.test.ts` to cover: default→notice, `CAATINGA_SOURCE`→notice, explicit→no notice.

## 3. Bug #3 — single "dependencies not installed" line

- [x] 3.1 In `packages/cli/src/diagnostics/project-diagnostic.ts`, change `configDiagnostic` to return `Diagnostic | undefined` and return `undefined` for the `DEPENDENCIES_NOT_INSTALLED` branch.
- [x] 3.2 Confirm `run-all.ts` filters `undefined` (it does) and adjust types if needed.
- [x] 3.3 Add/extend a diagnostics test asserting the dependencies line appears exactly once before `npm install`.

## 4. Bug #4 — no false "network not found" before install

- [x] 4.1 In `networkDiagnostic` (`project-diagnostic.ts`), when `loadConfig` throws `DEPENDENCIES_NOT_INSTALLED` or `CONFIG_NOT_FOUND`, return `undefined` instead of reporting the network as missing.
- [x] 4.2 Add tests: deps-missing → no network line; config loads but network absent → still reports `✗ network <name> not found`.

## 5. Verification

- [x] 5.1 Run the CLI and core test suites for the touched packages and ensure they pass.
- [x] 5.2 Run lint/typecheck for `packages/cli` and `packages/core`.
