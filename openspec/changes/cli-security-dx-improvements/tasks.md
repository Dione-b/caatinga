## 1. Subprocess Security

- [x] 1.1 Add `semver` dependency to `packages/cli/package.json`
- [x] 1.2 Replace `parseSemver`/`semverAtLeast` with `semver.satisfies` / `semver.gte` in `setup.command.ts`
- [x] 1.3 Add `AbortSignal.timeout()` and `cancelSignal` to all `execa()` calls in `setup.command.ts`
- [x] 1.4 Add configurable timeout env var `CAATINGA_SUBPROCESS_TIMEOUT` reading in setup
- [x] 1.5 Replace `curl | sh` pipe with `https.get` + SHA256 checksum verification for rustup

## 2. Input Validation

- [x] 2.1 Add Stellar contract ID format validation (`^C[A-Z2-7]{55}$` or 64-char hex) to `rollback.command.ts --to`
- [x] 2.2 Remove `.allowUnknownOption(true)` and `.allowExcessArguments(true)` from `invoke.command.ts`
- [x] 2.3 Add explicit validated arg forwarding in `invoke.command.ts`
- [x] 2.4 Remove `.allowUnknownOption(true)` and `.allowExcessArguments(true)` from `read.command.ts`
- [x] 2.5 Add explicit validated arg forwarding in `read.command.ts`

## 3. Process Exit Cleanup

- [x] 3.1 Replace `process.exit(1)` with `process.exitCode = 1` in `preflight.ts`
- [x] 3.2 Replace `console.error(error)` with structured error formatting in `index.ts` global catch

## 4. Config Merge Safety (zk init)

- [x] 4.1 Improve `mergeZkIntoConfigSource()` regex to be whitespace-tolerant
- [x] 4.2 Add fallback: print manual instructions when merge cannot safely modify config
- [x] 4.3 Add test for non-standard config formatting in zk-init

## 5. Doctor Reliability

- [x] 5.1 Refactor `runAllDiagnostics` to return the loaded config alongside diagnostics
- [x] 5.2 Remove second `loadConfig()` call in `doctor.command.ts` and reuse config from `runAllDiagnostics`
- [x] 5.3 Add skip transparency messages when `networkDiagnostic` returns undefined
- [x] 5.4 Add skip transparency messages when `sourceDiagnostic` returns undefined
- [x] 5.5 Replace hardcoded Stellar CLI version string in `stellar-diagnostic.ts` with `STELLAR_CLI_LAST_TESTED_VERSION` constant

## 6. Setup UX

- [x] 6.1 Add status/progress callbacks to Rust install step
- [x] 6.2 Add status/progress callbacks to WASM target install step
- [x] 6.3 Add status/progress callbacks to Stellar CLI install step
- [x] 6.4 Remove unused `results.push()` that accumulates data never displayed in `runSetup()` — nodeResult now included

## 7. Template Resolution

- [x] 7.1 Reduce directory walk depth from 8 to 5 in `template-path.ts` (safe minimum for monorepo layout)
- [x] 7.2 Replace `process.stderr.write()` with `logger.muted()` in debug template resolution
