# Case Study: counter-web (internal reference)

> **Status:** Internal reference case study — not a third-party production testimonial. Replace with an external quote when available. See [outreach template](../internal/outreach-template.md).

## Project summary

| Field     | Value                                       |
| --------- | ------------------------------------------- |
| Project   | `examples/counter-web`                      |
| Contracts | 1 (`counter`)                               |
| Networks  | testnet                                     |
| Frontend  | Vite + React + `@caatinga/client`           |
| Wallet    | Stellar Wallets Kit (multi-wallet selector) |
| Team size | Maintainer reference implementation         |

`examples/counter-web` is a **UI-only** example. It has no `caatinga.config.ts` or `caatinga.artifacts.json`: `src/caatinga.ts` inlines a stub `CaatingaArtifacts` object with a placeholder `contractId`, and `src/contracts/generated/counter.ts` is a checked-in stand-in binding. To invoke on-chain, deploy from a Caatinga project and copy its artifacts and bindings in (see the [example README](../../examples/counter-web/README.md)). For the real artifacts-driven flow, scaffold the `react-vite-counter` template with `ctg init`.

## Problem

A TypeScript developer needs a working browser dApp that:

- Resolves `contractId` through a `CaatingaArtifacts` object (here an inline stub; in a real project, the committed `caatinga.artifacts.json`).
- Uses generated bindings for type-safe calls.
- Connects a wallet and invokes `increment` / reads `get`.

Without Caatinga, each step (deploy ID tracking, binding generation, wallet wiring) is manual and drifts across teammates.

## Setup timeline (approximate)

Times below are for the full flow with the `react-vite-counter` template, which produces the artifacts and bindings that counter-web expects to be copied in.

| Step                          | Time           | Notes                                                                                                                                                   |
| ----------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ctg init` from template      | ~5 min         | `react-vite-counter` scaffold                                                                                                                           |
| `build` + `deploy` on testnet | ~10 min        | Includes Stellar CLI identity funding                                                                                                                   |
| `npm run dev`                 | ~2 min         | WalletConnect needs `.env`                                                                                                                              |
| **Total to first invoke**     | **~1–2 hours** | Assumes Stellar CLI + Rust already installed; first-time toolchain setup adds 1–2 hours (install Rust + Stellar CLI manually, verify with `ctg doctor`) |

## What worked

- In the template project, `ctg deploy` wrote `caatinga.artifacts.json` and regenerated bindings in one step.
- `@caatinga/client/react` eliminated hand-rolled wallet context.
- In the template project, `ctg status` showed the recorded deploy and binding freshness before `npm run dev`.
- `CAATINGA_*` errors surfaced missing artifacts clearly in the browser UI.

## What broke or required workarounds

- **WalletConnect:** requires `VITE_WALLETCONNECT_PROJECT_ID` in `.env` — not auto-generated.
- **Checked-in stubs:** the monorepo example ships a stand-in `counter.ts` binding and inline artifacts with a placeholder `contractId` so CI can build it; real projects must use `ctg generate` output and the artifacts `ctg deploy` writes.
- **Single-invoker only:** contracts needing delegated auth are out of scope for this example.
- **No mainnet:** example targets testnet only.

## Commands used

Run from a Caatinga project (for example one scaffolded from `react-vite-counter`), not from `examples/counter-web`:

```bash
ctg build counter
ctg deploy counter --network testnet --source alice
ctg status --network testnet
ctg doctor --network testnet --source alice
```

## Metrics (not yet collected)

Future case studies should capture:

- Proof size / prove time (ZK projects)
- Deploy fee actual vs `ctg estimate deploy`
- Number of contracts and `dependsOn` depth
- CI pipeline duration

## External validation

No external team has confirmed production mainnet usage yet. If you ship with Caatinga, we'd like to hear from you — see [outreach template](../internal/outreach-template.md).

## Related docs

- [counter-web example](../../examples/counter-web/README.md)
- [From Zero to Testnet](../tutorials/from-zero-to-testnet.md)
- [Client](../client.md)
