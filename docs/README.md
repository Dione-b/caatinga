# Caatinga Docs

**Published site:** [dione-b.github.io/caatinga](https://dione-b.github.io/caatinga/) — onboarding guides and reference with search.

Documentation index for the Caatinga toolkit. Start at the top if you're new.

## Start here

| Doc                                                             | What you get                                            |
| --------------------------------------------------------------- | ------------------------------------------------------- |
| [Getting started](./getting-started.md)                         | Install, scaffold, and the CLI → browser flow           |
| [Choosing a project scaffold](./tutorials/project-scaffolds.md) | Template vs minimal vs ZK — pick your starting path     |
| [Template project](./tutorials/template-project.md)             | `caatinga init` walkthrough                             |
| [Minimal project](./tutorials/minimal-project.md)               | `caatinga init --minimal` CLI-only                      |
| [ZK project](./tutorials/zk-project.md)                         | `caatinga zk init` walkthrough                          |
| [From Zero to Testnet](./tutorials/from-zero-to-testnet.md)     | Full walkthrough: scaffold → deploy → invoke on testnet |
| [Cheatsheet](./cheatsheet.md)                                   | The whole command loop and flags on one page            |

## Reference

| Doc                                 | What you get                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| [CLI](./cli.md)                     | Every command: init, doctor, build, deploy, wire, sync-env, generate, status, invoke, read, zk |
| [ZK module](./zk.md)                | Circom + Groth16 scaffold, build, prove, and verifier invoke                                   |
| [Config](./config.md)               | `caatinga.config.ts` schema: contracts, networks, frontend, `postDeploy`, workspace builds     |
| [Client](./client.md)               | `@caatinga/client`: read/simulate/invoke/XDR against generated bindings                        |
| [Soroban types](./soroban-types.md) | Symbol vs string and other binding footguns                                                    |
| [Wallets](./wallets.md)             | Adapter contract, Stellar Wallets Kit, wallet session, React hooks                             |
| [Templates](./templates.md)         | Official templates and their package-manager quirks                                            |
| [Errors](./errors.md)               | Every public `CAATINGA_*` error code with fixes                                                |
| [AI Reference](./for-llms.md)       | Self-contained reference optimized for LLM consumption (also at `/llms-full.txt`)              |

## Internals & process

| Doc                                                               | What you get                               |
| ----------------------------------------------------------------- | ------------------------------------------ |
| [Architecture](./architecture.md)                                 | Package layout, layering rules, data flow  |
| [Stellar CLI version contract](./stellar-cli-version-contract.md) | Supported Stellar CLI range and advisories |
| [Stellar SDK version contract](./stellar-sdk-version-contract.md) | Supported `@stellar/stellar-sdk` range     |
| [Signing strategy](./signing-strategy.md)                         | CLI and browser signing models             |
| [Production readiness](./production-readiness.md)                 | Pre-mainnet checklist                      |
| [Packages](./packages.md)                                         | What each npm package contains             |
| [ADRs](./adr/index.md)                                            | Architecture decision records              |
| [stellar-album case study](./case-studies/stellar-album.md)       | Multi-contract workflow with hooks and env |

For maintainers: release process, publish checklists, testing policy, and internal specs live in [`docs/internal/`](./internal/) and [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Quick orientation

- **CLI-first:** `init → doctor → build → deploy → status → dev`. Deploy records contract IDs in
  `caatinga.artifacts.json`, auto-generates TypeScript bindings, and can run configured
  `postDeploy` hooks plus frontend env sync after full graph deploys.
- **Client second:** `@caatinga/client` wires generated bindings + artifacts + a wallet adapter in
  the browser. React apps add `@caatinga/client/react` for `WalletProvider`/`useWallet`.
- **Errors are API:** automation should key on `CAATINGA_*` codes, never on message text.
