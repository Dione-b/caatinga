# Caatinga Docs

Documentation index for the Caatinga toolkit. Start at the top if you're new.

## Start here

| Doc | What you get |
| --- | --- |
| [Getting started](./getting-started.md) | Install, scaffold, and the CLI → browser flow |
| [From Zero to Testnet](./tutorials/from-zero-to-testnet.md) | Full walkthrough: scaffold → deploy → invoke on testnet |
| [Cheatsheet](./cheatsheet.md) | The whole command loop and flags on one page |

## Reference

| Doc | What you get |
| --- | --- |
| [CLI](./cli.md) | Every command: init, doctor, build, deploy, generate, status, invoke |
| [ZK module](./zk.md) | Circom + Groth16 scaffold, build, prove, and verifier invoke |
| [Config](./config.md) | `caatinga.config.ts` schema: contracts, networks, frontend |
| [Client](./client.md) | `@caatinga/client`: read/simulate/invoke/XDR against generated bindings |
| [Wallets](./wallets.md) | Adapter contract, Stellar Wallets Kit, wallet session, React hooks |
| [Templates](./templates.md) | Official templates and their package-manager quirks |
| [Errors](./errors.md) | Every public `CAATINGA_*` error code with fixes |

## Internals & process

| Doc | What you get |
| --- | --- |
| [Architecture](./architecture.md) | Package layout, layering rules, data flow |
| [Visão geral do sistema (PT)](./visao-geral-sistema.md) | Architecture overview in Portuguese |
| [Testing](./testing.md) | Test layers and how to run them |
| [Release process](./release.md) | Changesets, dist-tags, release gate |
| [Stellar CLI version contract](./stellar-cli-version-contract.md) | Supported Stellar CLI range and advisories |
| [Packages](./packages.md) | What each npm package contains |
| [ADRs](./adr/) | Architecture decision records |

## Quick orientation

- **Current release:** `2.2.1` (`@caatinga/cli`, `@caatinga/core`, `@caatinga/client`, `@caatinga/zk`; `latest` = `next`).
- **CLI-first:** `init → doctor → build → deploy → status → dev`. Deploy records contract IDs in
  `caatinga.artifacts.json` and auto-generates TypeScript bindings.
- **Client second:** `@caatinga/client` wires generated bindings + artifacts + a wallet adapter in
  the browser. React apps add `@caatinga/client/react` for `WalletProvider`/`useWallet`.
- **Errors are API:** automation should key on `CAATINGA_*` codes, never on message text.
