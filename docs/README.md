# Caatinga Docs

**Published site:** [dione-b.github.io/caatinga](https://dione-b.github.io/caatinga/) — onboarding guides and reference with search.

Start at [Getting started](./getting-started.md) if you're new.

## Start here

- [Getting started](./getting-started.md) — install, scaffold, CLI-to-browser flow
- [Choosing a project scaffold](./tutorials/project-scaffolds.md) — template vs minimal vs ZK
- [Template project](./tutorials/template-project.md) — `ctg init` walkthrough
- [Minimal project](./tutorials/minimal-project.md) — `ctg init --minimal` CLI-only
- [ZK project](./tutorials/zk-project.md) — `ctg zk init` walkthrough
- [Cheatsheet](./cheatsheet.md) — command loop and flags on one page

## Guides

- [From Zero to Testnet](./tutorials/from-zero-to-testnet.md) — optional full walkthrough after getting started
- [Workshop (60–75 min)](./tutorials/workshop.md) — CLI contract deploy & orchestration walkthrough
- [Integration guide (stellar-build)](./tutorials/integration-guide.md) — drive Caatinga from coding agents
- [Contract upgrade](./tutorials/contract-upgrade.md) — upgrade deployed contracts

## Reference

- [CLI](./cli.md) — init, doctor, build, deploy, wire, sync-env, generate, status, invoke, read, zk
- [Config](./config.md) — `caatinga.config.ts` schema
- [Client](./client.md) — `@caatinga/client` read/simulate/invoke/XDR
- [Wallets](./wallets.md) — adapters, Stellar Wallets Kit, React hooks
- [Templates](./templates.md) — official templates and package-manager quirks
- [Errors](./errors.md) — public `CAATINGA_*` error codes
- [Troubleshooting](./troubleshooting.md) — symptom-first fixes for common failures
- [Public API](./public-api.md) — v1.0 supported surface (Tier 1/2/3)
- [ZK module](./zk.md) — Circom + Groth16 scaffold, build, prove, verifier invoke
- [Soroban types](./soroban-types.md) — binding footguns

## Advanced

- [Architecture](./architecture.md) — package layout, layering, data flow
- [Signing strategy](./signing-strategy.md) — supported signing models
- [Production readiness](./production-readiness.md) — checklist before mainnet
- [Recovery scenarios](./recovery-scenarios.md) — interrupted deploy, invalid artifacts, RPC offline
- [ADRs](./adr/index.md) — architecture decision records
- [stellar-album case study](./case-studies/stellar-album.md)

## For LLMs & coding agents

Start with the **context primer** at [`/llms.txt`](../llms.txt) (repo root). Detailed reference: [`llms-full.txt`](../llms-full.txt) or [for-llms.md](./for-llms.md).

## Maintainers

Release process, publish checklists, testing policy, and internal specs live in [`docs/internal/`](./internal/) and [`CONTRIBUTING.md`](../CONTRIBUTING.md).
