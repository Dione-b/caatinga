# Spec 02 — CAATINGA_* Error Surface Completeness

## Status

Implemented on `master` (error codes in `packages/core/src/errors/`, static tests, `docs/errors.md`, `docs/release/error-code-policy.md`). Implementation plan: `docs/superpowers/plans/2026-05-13-caatinga-error-surface-completeness.md`.

> **Errata (2.0.0):** `CAATINGA_UNTESTED_CLI_VERSION` was removed in the `2.0.0`
> release. The hard floor `CAATINGA_UNSUPPORTED_CLI_VERSION` is the only
> remaining hard failure on the Stellar CLI version axis; newer-than-tested
> versions are accepted with a non-fatal `STELLAR_CLI_UNTESTED_VERSION`
> warning emitted from `evaluateStellarCliCompatibility`. See
> `docs/stellar-cli-version-contract.md` and the
> `.changeset/stellar-cli-dynamic-compat.md` entry.

## Problem

Error codes are public API. If user-facing errors are undocumented or unstable, CI scripts built on Caatinga cannot safely handle failures.

## Goal

Every user-facing failure path in `@caatinga/cli`, `@caatinga/core`, and `@caatinga/client` must expose a documented `CAATINGA_*` code.

## Scope

Audit:

```txt
packages/cli/src
packages/core/src
packages/client/src
```

Cover:

```txt
throw
process.exit
catch blocks
command failures
schema validation
missing files
Stellar CLI failures
template failures
artifact failures
client/XDR failures
wallet failures
```

## Required changes

### Error code rule

Every public error must use:

```ts
new CaatingaError(message, CaatingaErrorCode.SOME_CODE, hint)
```

Never use raw strings:

```ts
new CaatingaError(message, "CONFIG_NOT_FOUND")
```

### Semver rule

Document:

```txt
Adding a new CAATINGA_* code: minor change
Removing a CAATINGA_* code: major change
Renaming a CAATINGA_* code: major change
Changing the meaning of a code: major change
Changing message text only: patch change
```

## Required files

```txt
packages/core/src/errors/CaatingaError.ts
packages/core/src/errors/CaatingaErrorCode.ts
docs/errors.md
docs/release/error-code-policy.md
```

## Minimum code list

```txt
CAATINGA_CONFIG_NOT_FOUND
CAATINGA_INVALID_CONFIG
CAATINGA_COMMAND_FAILED
CAATINGA_STELLAR_CLI_NOT_FOUND
CAATINGA_STELLAR_CLI_VERSION_PARSE_FAILED
CAATINGA_UNSUPPORTED_CLI_VERSION
CAATINGA_UNTESTED_CLI_VERSION
CAATINGA_RUST_NOT_FOUND
CAATINGA_RUST_TARGET_NOT_FOUND
CAATINGA_CONTRACT_NOT_FOUND
CAATINGA_NETWORK_NOT_FOUND
CAATINGA_ARTIFACT_NOT_FOUND
CAATINGA_CONTRACT_ID_NOT_FOUND
CAATINGA_SOURCE_ACCOUNT_REQUIRED
CAATINGA_UNSAFE_SOURCE_ACCOUNT
CAATINGA_DEPLOY_FAILED
CAATINGA_BUILD_FAILED
CAATINGA_BINDINGS_FAILED
CAATINGA_INVOKE_FAILED
CAATINGA_TEMPLATE_MANIFEST_NOT_FOUND
CAATINGA_INVALID_TEMPLATE_MANIFEST
CAATINGA_TEMPLATE_INCOMPATIBLE
CAATINGA_XDR_BUILD_FAILED
CAATINGA_XDR_PREPARE_FAILED
CAATINGA_XDR_SIGN_FAILED
CAATINGA_XDR_SUBMIT_FAILED
CAATINGA_XDR_RESULT_FAILED
CAATINGA_BINDING_CLIENT_NOT_FOUND
CAATINGA_BINDING_METHOD_NOT_FOUND
CAATINGA_WALLET_NOT_CONNECTED
```

## Tests

Required tests:

```txt
all exported error codes start with CAATINGA_
every documented code exists in CaatingaErrorCode
every exported code appears in docs/errors.md
each public code has at least one test that triggers it
no CaatingaError is constructed with raw string codes
```

Implement static check:

```txt
grep or AST test for new CaatingaError(..., "RAW_CODE")
```

## docs/errors.md format

Each code must include:

```txt
Code
Meaning
Likely cause
Suggested fix
CI handling recommendation
Semver stability
```

## Acceptance criteria

```txt
No raw legacy error codes remain
100% of public error codes documented
All documented codes exist in implementation
Every code has at least one test
Error code semver policy documented
```
