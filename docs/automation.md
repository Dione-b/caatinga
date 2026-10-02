# Automation Pipeline

This document describes the three automation commands that form the Caatinga CI pipeline: `doctor`, `smoke`, and `ci run`.

---

## 1. `ctg doctor` (Sprint 26)

The `doctor` command runs a comprehensive set of local diagnostics against the current project. It checks:

| Check             | Description                                                                          |
| ----------------- | ------------------------------------------------------------------------------------ |
| Toolchain         | Node.js, Stellar CLI (version + features), `@stellar/stellar-sdk`, Rust, WASM target |
| Project           | npm dependencies, `caatinga.config.ts`, `caatinga.artifacts.json`                    |
| Network / source  | Configured network exists; `--source` identity exists in the Stellar CLI keystore    |
| Deploy coverage   | Which configured contracts have an artifact on the network (always advisory)         |
| Binding freshness | Whether generated bindings match the artifact's `contractId` / `wasmHash`            |
| Env sync          | Whether `frontend.envFile` matches the `frontend.env` mapping and the artifacts      |
| Post-deploy hooks | Flags hook args that look like CLI identity aliases (advisory)                       |
| WASM drift        | Local WASM hash vs the artifact's `wasmHash` (no RPC call; advisory)                 |

Doctor makes no RPC calls: it does not check connectivity, balances, or on-chain state. Use
`ctg inspect <contract>` for an on-chain reachability check.

### Flags

| Flag                | Default                       | Description                               |
| ------------------- | ----------------------------- | ----------------------------------------- |
| `-n, --network`     | `defaultNetwork`              | Target network                            |
| `-s, --source`      | none (identity check skipped) | Stellar CLI identity to check             |
| `--all-networks`    | `false`                       | Run checks across all configured networks |
| `--strict-env`      | `false`                       | Fail when env vars are missing or stale   |
| `--strict-bindings` | `false`                       | Fail when bindings are stale              |
| `--strict`          | `false`                       | Enable all strict checks                  |

### Exit Codes

- `0` — all diagnostics passed
- `1` — one or more hard failures detected

---

## 2. `ctg smoke` (Sprint 27)

The `smoke` command runs read-only smoke checks from `smoke.reads` in `caatinga.config.ts`. When
`smoke.reads` is absent or empty, it falls back to the `postDeployRead` entries. Each read is
simulated against the target network and checked with the [expect DSL](./cli.md#expect-dsl)
(default `{ matcher: "reachable" }`).

### `smoke.reads` in `caatinga.config.ts`

```ts
smoke: {
  reads: [
    { contract: "counter", method: "get", expect: { matcher: "reachable" } },
    { contract: "counter", method: "get", expect: "0" },
  ],
  useFreshSymbol: false, // true: pass an ephemeral `symbol` arg to each read
},
```

`expect` is either a plain string (exact stdout match) or `{ matcher, value? }` with one of
`equals`, `reachable`, `isNull`, `isArray`, `minLength`, `maxLength`, `contains`, `matches`,
`jsonEquals`. Unknown keys (for example a per-contract `smokeReads`) are dropped by config
validation, and smoke then fails with "No smoke reads configured".

### Flags

| Flag            | Default                                               | Description                     |
| --------------- | ----------------------------------------------------- | ------------------------------- |
| `-n, --network` | `defaultNetwork`                                      | Target network                  |
| `-s, --source`  | `CAATINGA_SOURCE`, else `alice` (required on mainnet) | Identity for simulation context |

### Exit Codes

- `0` — all smoke reads passed
- `1` — one or more smoke reads failed

---

## 3. `ctg ci run` (Sprint 28)

The `ci run` command orchestrates the full CI recipe: `doctor` → `smoke`. It is designed for use in GitHub Actions and other CI environments. Each step re-runs the installed
`ctg` binary; the recipe stops at the first failing step and exits with its code.

### Execution Flow

```
ci run
  │
  ├─ doctor --network <name> [--strict]
  │
  └─ smoke --network <name> [--source <alias>]  (skipped with --skip-smoke)
```

### Flags

| Flag            | Default          | Description               |
| --------------- | ---------------- | ------------------------- |
| `-n, --network` | `defaultNetwork` | Target network            |
| `-s, --source`  | –                | Identity alias            |
| `--skip-smoke`  | `false`          | Skip smoke reads          |
| `--strict`      | `false`          | Pass `--strict` to doctor |

### GitHub Actions Example

```yaml
- name: Caatinga CI
  run: npx ctg ci run --network testnet --source ${{ secrets.CAATINGA_SOURCE }}
```
