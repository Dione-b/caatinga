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
- [Stellar CLI version contract](./stellar-cli-version-contract.md)
- [Stellar SDK version contract](./stellar-sdk-version-contract.md)
- [Signing strategy](./signing-strategy.md)
- [Production readiness](./production-readiness.md)
- [Packages](./packages.md)
- [ADRs](./adr/index.md)
- [stellar-album case study](./case-studies/stellar-album.md)

For maintainers: release process, publish checklists, testing policy, and internal specs live in [`docs/internal/`](./internal/) and [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Quick orientation

- **CLI-first:** `init → doctor → build → deploy → status → dev`. Deploy records contract IDs in
  `caatinga.artifacts.json`, auto-generates TypeScript bindings, and can run configured
  `postDeploy` hooks plus frontend env sync after full graph deploys.
- **Client second:** `@caatinga/client` wires generated bindings + artifacts + a wallet adapter in
  the browser. React apps add `@caatinga/client/react` for `WalletProvider`/`useWallet`.
- **Errors are API:** automation should key on `CAATINGA_*` codes, never on message text.
