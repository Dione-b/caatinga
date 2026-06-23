# Choosing a Project Scaffold

Caatinga offers three ways to start a new project. Pick the path that matches how much UI and ZK tooling you want on day one.

Install the CLI and prerequisites first — see [Getting started — Prerequisites](../getting-started.md#prerequisites).

## Quick comparison

| Path            | Command                            | Frontend           | Soroban contract       | ZK (Circom/Groth16)      | Best for                                |
| --------------- | ---------------------------------- | ------------------ | ---------------------- | ------------------------ | --------------------------------------- |
| **Template**    | `caatinga init <dir>`              | Yes (Vite + React) | Yes (template default) | No                       | First dApp, wallet + bindings pre-wired |
| **Minimal**     | `caatinga init <dir> --minimal`    | No                 | Yes (`app` stub)       | No                       | CLI-first; you pick the UI stack later  |
| **ZK template** | `caatinga zk init <dir>`           | Yes (`zk-starter`) | Verifier contract      | Yes (multiplier example) | ZK dApp with hybrid CLI + browser flow  |
| **ZK minimal**  | `caatinga zk init <dir> --minimal` | No                 | Verifier contract      | Yes (identity circuit)   | ZK toolchain only; add UI yourself      |

Aliases:

- `caatinga init --empty` is the same as `--minimal`.
- `caatinga zk init` with **no** project name adds ZK files to the **current** directory (see [ZK project](./zk-project.md#add-zk-to-an-existing-project)).

## Decision guide

**Choose a template** when you want a working Vite + React browser dApp with a single-invoker wallet path — wallet modal, placeholder bindings, Vite dev server, and wallet SDK stubs already configured. Official Caatinga templates are **Vite + React only** (`vite-react`). Start with `react-vite-counter`.

**Choose minimal** when you want a Soroban contract and CLI workflow without committing to a frontend stack. You deploy and read from the terminal first, then wire `@caatinga/client` when you are ready (any UI framework).

**Choose ZK** when you need Groth16 proofs verified on Soroban (BLS12-381). Use the `zk-starter` template for an end-to-end multiplier demo with UI, or `zk init --minimal` for circuits + verifier only.

## Official templates

| Template                       | Command                           | Status                                     |
| ------------------------------ | --------------------------------- | ------------------------------------------ |
| `react-vite-counter` (default) | `npx caatinga init my-dapp`       | Stable — recommended for first walkthrough |
| `zk-starter`                   | `npx caatinga zk init my-zk-dapp` | Stable ZK example with Vite + React shell  |

See [Templates](../templates.md) for manifest details and package-manager notes.

## Step-by-step guides

| Guide                                     | What it covers                                        |
| ----------------------------------------- | ----------------------------------------------------- |
| [Template project](./template-project.md) | `caatinga init` — full dApp scaffold                  |
| [Minimal project](./minimal-project.md)   | `caatinga init --minimal` — CLI + contract only       |
| [ZK project](./zk-project.md)             | `caatinga zk init` — circuits, prove, on-chain verify |

## Related docs

- [From Zero to Testnet](./from-zero-to-testnet.md) — deep walkthrough of the default counter template on testnet
- [Getting started](../getting-started.md) — install, browser client overview
- [CLI](../cli.md) — every command and flag
- [ZK module](../zk.md) — ZK command reference and library API
