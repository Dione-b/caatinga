# Packages

| Package | Role |
|---------|------|
| `@caatinga/cli` | End-user CLI (`caatinga` binary) |
| `@caatinga/core` | Config, artifacts, Stellar CLI orchestration |
| `@caatinga/client` | Browser/client interop over generated bindings |
| `@caatinga/zk` | ZK proof serialization and Circom Groth16 workflow helpers |

Install for end users:

```bash
npm install -g @caatinga/cli
```

`next` currently resolves to **`2.3.0`**; `latest` remains **`2.2.1`** until promoted.

Monorepo development:

```bash
pnpm install
pnpm build
pnpm dev -- init my-app
```

The last command runs the CLI from source via `tsx` in `packages/cli`.

Future names such as `@caatinga/react` are reserved in architecture docs and are not published yet.
