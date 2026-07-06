# Dogfood Backlog (Sprint 41–42)

Issues found during dogfooding with **public APIs only**. Core changes are deferred until after v1.0 RC unless marked critical.

| ID     | Sprint | Severity | Description   | Workaround | Core change? |
| ------ | ------ | -------- | ------------- | ---------- | ------------ |
| DF-001 | 41     | —        | (placeholder) | —          | No           |

## Rules

1. Build dApps using `npm install @caatinga/*` from packed tarballs — never `workspace:*`.
2. Do not modify `packages/core`, `packages/client`, or `packages/cli` during dogfood sprints.
3. File issues here with reproduction steps and `CAATINGA_*` codes.
4. Only DX fixes (docs, templates, CLI messages) ship before RC.

## Install from packed tarballs

From the repository root after `pnpm build && pnpm pack:packages`:

```bash
mkdir -p /tmp/caatinga-dogfood && cd /tmp/caatinga-dogfood
npm init -y
npm install /path/to/caatinga/packed/caatinga-core-3.8.0.tgz \
  /path/to/caatinga/packed/caatinga-client-3.8.0.tgz \
  /path/to/caatinga/packed/caatinga-cli-3.8.0.tgz
npx caatinga init my-dapp --template react-vite-counter
```

See [examples/dogfood-simple/README.md](../examples/dogfood-simple/README.md) for the full timed walkthrough.
