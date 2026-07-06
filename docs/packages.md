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

---

## Package Boundaries & Isolation Rules

To maintain high stability and prevent architectural regression, the following package boundaries must be strictly enforced:

### 1. CLI Isolation Rule

- `@caatinga/cli` consumes `@caatinga/core` directly for orchestrating commands.
- **Rule:** Under no circumstances should `@caatinga/core`, `@caatinga/client`, or `@caatinga/zk` import or depend on `@caatinga/cli`. The core logic must never reference CLI argument parsing, console output formats, or terminal-specific APIs.

### 2. Client Browser-Safety Rule

- `@caatinga/client` connects smart contract bindings, local artifacts, and browser wallets. It is designed to be bundled safely by bundlers like Vite, Webpack, and Turbopack.
- **Rule:** `@caatinga/client` must never import from the root of `@caatinga/core` (which contains Node-specific dependencies like `execa` or `fs`). It can only import browser-safe symbols from the `@caatinga/core/browser` subpath.
- **Rule:** `@caatinga/client` must not contain direct filesystem access or child process orchestration.

### 3. Template Independence Rule

- `packages/templates` contains Vite and React project scaffolds.
- **Rule:** Templates are target output configurations. They must not contain compiler logic or depend on the monorepo core tools except as consumer dependencies (e.g. `@caatinga/client`, `@caatinga/cli`).

### 4. ZK Isolation Rule

- `@caatinga/zk` encapsulates the Circom and Groth16 cryptographic operations.
- **Rule:** This module operates independently and does not depend on `@caatinga/cli` or `@caatinga/client` code directly.
