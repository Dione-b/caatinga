# Packages

| Package            | Role                                                               |
| ------------------ | ------------------------------------------------------------------ |
| `@caatinga/cli`    | End-user CLI (`caatinga` binary)                                   |
| `@caatinga/core`   | Config, artifacts, Stellar CLI orchestration, verification helpers |
| `@caatinga/client` | Browser/client interop over generated bindings                     |
| `@caatinga/zk`     | ZK proof serialization and Circom Groth16 workflow helpers         |

Install for end users:

```bash
npm install -g @caatinga/cli
```

Monorepo development:

```bash
pnpm install
pnpm build
pnpm dev -- init my-app
```

The last command runs the CLI from source via `tsx` in `packages/cli`.

### Subpath exports

Each package exposes subpath exports for fine-grained imports:

| Package            | Subpath                  | Purpose                                                    |
| ------------------ | ------------------------ | ---------------------------------------------------------- |
| `@caatinga/core`   | `.`                      | Config, artifacts, shell, errors (Node)                    |
| `@caatinga/core`   | `./browser`              | Errors + artifact types only (Vite/webpack safe)           |
| `@caatinga/core`   | `./runtime/requirements` | Node/Rust version constants                                |
| `@caatinga/client` | `.`                      | Client root (createCaatingaClient, wallet session, etc.)   |
| `@caatinga/client` | `./freighter`            | Bundled Freighter adapter                                  |
| `@caatinga/client` | `./stellar-wallets-kit`  | Bundled Stellar Wallets Kit adapter                        |
| `@caatinga/client` | `./react`                | `WalletProvider` + `useWallet` hooks (optional React peer) |
| `@caatinga/client` | `./vite`                 | Vite bundler helpers for SWK stubs                         |
| `@caatinga/zk`     | `.`                      | ZK proof serialization + Circom workflow                   |
| `@caatinga/zk`     | `./browser`              | Browser-only ZK binding helpers                            |

### `@caatinga/core` tooling exports (Node)

For custom CI scripts and integrators:

| Export                                            | Purpose                                                               |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| `verifyExpect`, `parseExpectSpec`, `assertExpect` | Expect DSL used by postDeploy, smoke, and `read --expect`             |
| `evaluateEnvDrift`                                | Compare `frontend.envFile` to artifacts                               |
| `evaluateWasmDrift`                               | Compare local WASM hash to artifact record                            |
| `runSmokeReads`                                   | Execute configured smoke reads programmatically                       |
| `resolveMethodArgs`                               | Resolve `${source.address}`, aliases, and placeholders in method args |
| `summarizeReadOutput`                             | Compact read output for large payloads                                |

Browser-safe types and errors: import from `@caatinga/core/browser` only.
