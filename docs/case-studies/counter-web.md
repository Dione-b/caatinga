# Case Study: counter-web (internal reference)

> **Status:** Internal reference case study — not a third-party production testimonial. Replace with an external quote when available. See [outreach template](../outreach-template.md).

## Project summary

| Field     | Value                                       |
| --------- | ------------------------------------------- |
| Project   | `examples/counter-web`                      |
| Contracts | 1 (`counter`)                               |
| Networks  | testnet                                     |
| Frontend  | Vite + React + `@caatinga/client`           |
| Wallet    | Stellar Wallets Kit (multi-wallet selector) |
| Team size | Maintainer reference implementation         |

## Problem

A TypeScript developer needs a working browser dApp that:

- Reads `contractId` from committed artifacts (not hardcoded).
- Uses generated bindings for type-safe calls.
- Connects a wallet and invokes `increment` / reads `get`.

Without Caatinga, each step (deploy ID tracking, binding generation, wallet wiring) is manual and drifts across teammates.

## Setup timeline (approximate)

| Step                          | Time           | Notes                                                                                   |
| ----------------------------- | -------------- | --------------------------------------------------------------------------------------- |
| `caatinga init` from template | ~5 min         | `react-vite-counter` scaffold                                                           |
| `build` + `deploy` on testnet | ~10 min        | Includes Stellar CLI identity funding                                                   |
| `npm run dev`                 | ~2 min         | WalletConnect needs `.env`                                                              |
| **Total to first invoke**     | **~1–2 hours** | Assumes Stellar CLI + Rust already installed; first-time toolchain setup adds 1–2 hours |

## What worked

- `caatinga deploy` wrote `caatinga.artifacts.json` and regenerated bindings in one step.
- `@caatinga/client/react` eliminated hand-rolled wallet context.
- `caatinga status` confirmed deploy + binding freshness before `npm run dev`.
- `CAATINGA_*` errors surfaced missing artifacts clearly in the browser UI.

## What broke or required workarounds

- **WalletConnect:** requires `VITE_WALLETCONNECT_PROJECT_ID` in `.env` — not auto-generated.
- **Checked-in stub binding:** the monorepo example ships a stand-in `counter.ts` for CI; real projects must use `caatinga generate` output.
- **Single-invoker only:** contracts needing delegated auth are out of scope for this example.
- **No mainnet:** example targets testnet only.

## Commands used

```bash
caatinga build counter
caatinga deploy counter --network testnet --source alice
caatinga status --network testnet
caatinga doctor --network testnet --source alice
```

## Metrics (not yet collected)

Future case studies should capture:

- Proof size / prove time (ZK projects)
- Deploy fee actual vs `caatinga estimate deploy`
- Number of contracts and `dependsOn` depth
- CI pipeline duration

## External validation

No external team has confirmed production mainnet usage yet. If you ship with Caatinga, we'd like to hear from you — see [outreach template](../outreach-template.md).

## Related docs

- [counter-web example](../../examples/counter-web/README.md)
- [From Zero to Testnet](../tutorials/from-zero-to-testnet.md)
- [Client](../client.md)
