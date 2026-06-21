# Packages

| Package            | Role                                                       |
| ------------------ | ---------------------------------------------------------- |
| `@caatinga/cli`    | End-user CLI (`caatinga` binary)                           |
| `@caatinga/core`   | Config, artifacts, Stellar CLI orchestration               |
| `@caatinga/client` | Browser/client interop over generated bindings             |
| `@caatinga/zk`     | ZK proof serialization and Circom Groth16 workflow helpers |

Install for end users:

```bash
npm install -g @caatinga/cli
```

`latest` currently resolves to **`3.1.2`** on npm. The current **`3.3.0`** line is on **`next`** — use `@next` or `@3.3.0` when installing. Confirm with `npm view @caatinga/cli dist-tags`.

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
