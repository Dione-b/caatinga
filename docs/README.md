# Caatinga Docs

**Published site:** [dione-b.github.io/caatinga](https://dione-b.github.io/caatinga/) — onboarding guides and reference with search.

Documentation index for the Caatinga toolkit. Start at the top if you're new.

## Start here

- [Getting started](./getting-started.md) — install, scaffold, CLI-to-browser flow
- [Choosing a project scaffold](./tutorials/project-scaffolds.md) — template vs minimal vs ZK
- [Template project](./tutorials/template-project.md) — `caatinga init` walkthrough
- [Minimal project](./tutorials/minimal-project.md) — `caatinga init --minimal` CLI-only
- [ZK project](./tutorials/zk-project.md) — `caatinga zk init` walkthrough
- [From Zero to Testnet](./tutorials/from-zero-to-testnet.md) — scaffold, deploy, invoke on testnet
- [Cheatsheet](./cheatsheet.md) — command loop and flags on one page

## Reference

- [CLI](./cli.md) — init, doctor, build, deploy, wire, sync-env, generate, status, invoke, read, zk
- [ZK module](./zk.md) — Circom + Groth16 scaffold, build, prove, verifier invoke
- [Config](./config.md) — `caatinga.config.ts` schema
- [Client](./client.md) — `@caatinga/client` read/simulate/invoke/XDR
- [Soroban types](./soroban-types.md) — binding footguns
- [Wallets](./wallets.md) — adapters, Stellar Wallets Kit, React hooks
- [Templates](./templates.md) — official templates and package-manager quirks
- [Errors](./errors.md) — public `CAATINGA_*` error codes
- [LLM reference](./for-llms.md) — self-contained reference for LLM consumption (also at `/llms-full.txt`)

## Internals & process

- [Architecture](./architecture.md) — package layout, layering, data flow
- [Scope Policy](./scope.md) — feature classification and scope limits
- [Artifacts Specification](./artifacts-spec.md) — format and schema details
- [Artifacts Versioning](./artifacts-versioning.md) — evolution and compatibility rules
- [Deploy & Upgrade Specification](./deploy-upgrade-spec.md) — contract lifecycle operations
- [Architecture Freeze](./architecture-freeze.md) — formal architecture freeze declaration
- [Lifecycle & Hooks Specification](./lifecycle-hooks-spec.md) — execution phases and hook schemas
- [Network Setup Guide](./network-setup.md) — common Stellar network boilerplates and configurations
- [Runtime & Invoke Pipeline](./runtime-invoke-pipeline.md) — Runtime API, WalletAdapter contract, and invoke pipeline
- [Automation Pipeline](./automation.md) — doctor, smoke, and ci run commands
- [Conceptual Naming Policy](./conceptual-naming.md) — terminology and guidelines
- [Stellar CLI version contract](./stellar-cli-version-contract.md)
- [Stellar SDK version contract](./stellar-sdk-version-contract.md)
- [Signing strategy](./signing-strategy.md)
- [Production readiness](./production-readiness.md)
- [Release Candidate Checklist](./release-candidate-checklist.md) — v1.0 acceptance criteria
- [Packages](./packages.md)
- [ADRs](./adr/index.md)
- [stellar-album case study](./case-studies/stellar-album.md)

For maintainers: release process, publish checklists, testing policy, and internal specs live in [`docs/internal/`](./internal/) and [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Quick orientation

Caatinga operates strictly under four core pillars:

- **Deployment:** Powered by the **Orchestration Engine** (`init → build → deploy → status → dev`), managing topological graphs (`dependsOn`), placeholders, and lifecycle hooks.
- **Artifacts:** A portable, Git-versioned state contract (`caatinga.artifacts.json`) linking deployments to frontend consumers.
- **Runtime:** Managed by the **Integration SDK** (`@caatinga/client`) and its **Transaction Pipeline**, linking wallets, typescript bindings, and React hooks.
- **Automation:** Developer diagnostics (`doctor`, `setup`), regression suites (`smoke`), and CI/CD stable error APIs.
