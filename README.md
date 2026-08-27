# Caatinga

[![CI](https://img.shields.io/github/actions/workflow/status/Dione-b/caatinga/ci.yml?branch=main&label=CI&logo=github)](https://github.com/Dione-b/caatinga/actions)
[![npm](https://img.shields.io/npm/v/@caatinga/cli?label=%40caatinga%2Fcli&logo=npm)](https://www.npmjs.com/package/@caatinga/cli?activeTab=versions)

Deployment Orchestration + Versioned Artifacts for Soroban.

- Deploy multiple Soroban contracts.
- Track deployments in Git.
- Generate browser-ready TypeScript bindings.
- No hosted registry required.

```bash
npm install -g @caatinga/cli
npx ctg init my-dapp   # or: npx caatinga init my-dapp
```

> **v1.0 stable contract** on npm major `3.x`. Pin an exact version for reproducible installs. See [CHANGELOG](./packages/cli/CHANGELOG.md) and [Public API](./docs/public-api.md).

## Quick start

```bash
npm install -g @caatinga/cli
ctg doctor --network testnet --source alice   # verify prerequisites
ctg init my-dapp && cd my-dapp && npm install
ctg build counter
ctg deploy counter --network testnet --source alice
```

`deploy` writes the contract ID to `caatinga.artifacts.json` and generates TypeScript bindings (pass `--no-generate` to skip). Run `ctg doctor` to verify prerequisites.

**Docs:** start at [Getting started](./docs/getting-started.md). Optional walkthrough: [From Zero to Testnet](./docs/tutorials/from-zero-to-testnet.md).

## What you get after deploy

**`caatinga.artifacts.json`** — committed to Git, keyed per network:

```json
{
  "project": "my-dapp",
  "version": 2,
  "networks": {
    "testnet": {
      "contracts": {
        "counter": {
          "contractId": "CABCD...",
          "wasmHash": "a1b2c3..."
        }
      }
    }
  }
}
```

**Generated bindings + browser client** — type-safe calls from your frontend:

```typescript
import { caatingaClient } from "./caatinga";

const count = await caatingaClient.contract("counter").read<number>("get");
await caatingaClient.contract("counter").invoke("increment");
```

`@caatinga/client` wires contract IDs from artifacts, network config, and your wallet adapter — no copy/paste of IDs into `.env`. See [Client docs](./docs/client.md) and [Wallets](./docs/wallets.md).

## How it works

Caatinga orchestrates the official Stellar stack — build, deploy, and invoke still shell out to Stellar CLI;
`ctg generate` runs `npx @stellar/stellar-sdk generate`. Deployed contract IDs live in
`caatinga.artifacts.json`, committed to git, keyed per network. No mandatory hosted registry.
See [ADR 0002](./docs/adr/0002-local-artifacts-as-source-of-truth.md).

```
   caatinga.config.ts                    caatinga.artifacts.json
   (contracts, networks)                 (contractIds + wasmHash per network)
          │                                        ▲          │
          ▼                                        │          ▼
  ┌────────────────┐    ┌──────────────────┐  ┌─────────────────────────┐
  │ ctg build │ →  │ ctg deploy  │→ │ bindings auto-generated │
  │  (Stellar CLI) │    │ (graph-aware)    │  │ + freshness markers     │
  └────────────────┘    └──────────────────┘  └─────────────────────────┘
                                                          │
                              browser                     ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ @caatinga/client: bindings + artifacts + wallet adapter          │
  └──────────────────────────────────────────────────────────────────┘
```

## Requirements

- **Node.js** 22+
- **[Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)** 23.0.0+ on `PATH` (27.0.0 recommended)
- **Rust** 1.84.0+ with the `wasm32v1-none` target
- A funded local Stellar CLI identity (e.g. `alice`)

Run `ctg doctor` to check what is missing. Install prerequisites manually — see [Getting started](./docs/getting-started.md#prerequisites). See the [version contract](./docs/stellar-cli-version-contract.md).

## Documentation

- **Docs site:** [dione-b.github.io/caatinga](https://dione-b.github.io/caatinga/)
- [Getting started](./docs/getting-started.md) — install, scaffold, CLI-to-browser flow
- [Cheatsheet](./docs/cheatsheet.md) · [CLI reference](./docs/cli.md) · [Troubleshooting](./docs/troubleshooting.md)
- [Client](./docs/client.md) · [Wallets](./docs/wallets.md) · [Errors](./docs/errors.md)
- [Architecture](./docs/architecture.md) · [ADRs](./docs/adr/index.md)
- **Claude Code skill:** listed as a community skill on [skills.stellar.org](https://skills.stellar.org/) (source: [ctg-skills](https://github.com/Dione-b/caatinga-skill)). Teaches Claude Code Caatinga's rules (no raw `stellar` deploys, no manual `caatinga.artifacts.json`/bindings edits, `--source` as an identity alias only). Install with `/plugin marketplace add Dione-b/caatinga-skill` then `/plugin install caatinga-skill@caatinga-skill`.

## Project layout

```
my-dapp/
├── caatinga.config.ts        # contracts, WASM paths, networks
├── caatinga.artifacts.json   # deployed contract IDs per network
├── contracts/                # Rust Soroban contracts
└── src/                      # frontend/client from the selected template
    └── contracts/generated/  # TS bindings (auto-generated on deploy)
```

## Packages

| Package            | Role                                                                                                                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@caatinga/cli`    | `caatinga` / `ctg` command — init, build, deploy, upgrade, dev, doctor, generate, invoke, read, status, migrate, rollback, estimate, inspect, wire, sync-env, smoke, regression, ci, identity, zk, version |
| `@caatinga/core`   | Config, shell orchestration, Stellar CLI adapters, error catalog                                                                                                                                           |
| `@caatinga/client` | Browser/Node contract client, wallet adapters, React hooks                                                                                                                                                 |

Full export map: [Packages](./docs/packages.md). Public errors use stable `CAATINGA_*` codes — see [Errors](./docs/errors.md).

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR.

```bash
git clone https://github.com/Dione-b/caatinga.git && cd caatinga
pnpm install && pnpm build && pnpm test
pnpm dev init my-dapp   # run CLI from source
```

## License

[MIT](./LICENSE)
