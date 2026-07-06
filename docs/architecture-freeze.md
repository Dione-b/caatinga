# Architecture Freeze Declaration

This document formally declares the **Architecture Freeze** for Caatinga v1.0. All structural schemas, packaging boundaries, command mappings, and execution contracts are sealed. Future sprints will focus strictly on Developer Experience (DX), CLI diagnostics, testing, reliability, and bug fixing.

---

## 1. Frozen Core Contracts & Limits

The following architectural designs are frozen and cannot be modified:

### 1. Core Identity

- **Definition:** Caatinga is defined exclusively as **Deployment Orchestration + Versioned Artifacts for Soroban**.
- **No Scope Bloat:** No on-chain registries, rust macro decorators, or custom test runners will be introduced.

### 2. Package Boundaries

- **Orchestration Engine (`@caatinga/core`):** The only package permitted to execute subprocesses (via `execa` in `run-command.ts`) and interact with Node.js filesystem APIs.
- **Integration SDK (`@caatinga/client`):** Consumes exclusively browser-safe subpaths (`@caatinga/core/browser`), containing only types and error definitions. No Node.js runtime code may bleed into this package.

### 3. Artifact Schema (`caatinga.artifacts.json`)

- **Version:** Fixed at version `2`.
- **Evolutions:** Only backward-compatible optional fields are permitted. Breaking changes requiring v3 are blocked until v2.0.
- **Guard:** The loader actively rejects files with `version > 2` to prevent older CLIs from corrupting registries.

### 4. Lifecycle Operations

- **Operations:** The behaviors of `deploy`, `upgrade` (in-place), `redeploy` (`--force`), and `rollback` (local registry shift) are locked.

---

## 2. Guidelines for Future Sprints

1. **Bug Fixes Only:** Any architectural issue discovered must be resolved via local bug fixes or DX refinements within the defined boundaries.
2. **No Refactoring:** Boy Scout rule applies locally, but large monorepo refactoring is prohibited.
3. **DX Focus:** Future sprints will focus on making errors human-readable, improving templates, optimizing bundler output, and increasing automated test coverage.
