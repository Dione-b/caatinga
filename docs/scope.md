# Scope Policy

This document establishes the official feature categorization and scope limits for Caatinga to stabilize the platform. Features are classified under four clear taxonomies: **Core**, **Nice to Have**, **Experimental**, and **Out of Scope**.

---

## 1. Core

Core features define what Caatinga is at its heart. These are fully supported, guaranteed to remain stable, and represent the primary value proposition:

- **Deployment Orchestration (Local Engine):**
  - Project scaffolding (`ctg init`).
  - Rust contract compilation driver (shelling out to Stellar CLI).
  - Graph-aware deployments with topological sorting based on dependencies (`dependsOn`).
  - In-configuration placeholder resolution (e.g. `${contracts.token.contractId}`).
  - Execution of post-deployment lifecycle hooks (`postDeploy`).
- **Versioned Artifacts:**
  - Local state tracking via the per-network `caatinga.artifacts.json` file.
  - Storage of contract IDs, compiler versions, and WASM hashes.
  - Complete integration and versioning via Git (no mandatory on-chain registry dependencies).
- **Runtime Client Library:**
  - Strongly typed client consumer helpers in `@caatinga/client`.
  - Pluggable wallet adapters (Freighter, Stellar Wallets Kit) and React context bindings (`@caatinga/client/react`).
  - Standard transaction pipeline orchestration (simulate → sign → submit → watch).
- **Automation & Diagnostics:**
  - Workspace requirements diagnostics (`ctg doctor`).
  - CLI logs and stable error APIs using `CAATINGA_*` error codes.

---

## 2. Nice to Have

Nice to Have features are quality-of-life enhancements or platform operations that improve stability and visibility, but do not alter the main execution pipeline:

- **Artifact History & Schema Migration:**
  - Tracking artifact histories and providing migrations between format versions (`ctg migrate artifacts`).
- **Cost Advisory:**
  - Simulating deployment transactions to advise on resource consumption and fees (`ctg estimate deploy`).
- **State Inspection:**
  - Comparing local artifact states with deployed on-chain contract states (`ctg inspect`).
- **Logical Rollbacks:**
  - Restore contract state reference locally or update the deployed configuration references dynamically (`ctg rollback`).

---

## 3. Experimental

Experimental features are kept isolated and are subject to deprecation or removal if they prove to add excessive complexity or divert focus from the core mission:

- **ZK Workflow:**
  - Circom + Groth16 verifier compiling and on-chain verification workflow (`@caatinga/zk`). This is treated as a niche/experimental module.
- **Agent Integrations:**
  - Custom adapters or instructions for external AI coding tools/agents (e.g. `stellar-build` integrations).

---

## 4. Out of Scope

These features are explicitly rejected from Caatinga's design. Any implementation of these concepts will be deferred to downstream applications or secondary toolchains:

- **Backend Signing:**
  - Caatinga will never store private keys, manage credentials, or perform automated transaction signing on server environments. Signing is strictly delegated to client-side wallets or official Stellar CLI configurations.
- **Mainnet by Default:**
  - The CLI and client will never defaults to Stellar mainnet, preventing accidental gas consumption or contract deployments.
- **Ecosystem Indexer:**
  - Caatinga does not provide full indexer abstractions or query engines for ledger history. It only tracks deploy metadata.
- **Custom Web Framework:**
  - Caatinga does not compile or manage a proprietary frontend runtime framework. It ends at generating client-ready TypeScript bindings and wallet adapters for standard projects.
