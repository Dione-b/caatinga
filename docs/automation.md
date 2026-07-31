# Automation Pipeline

This document describes the three automation commands that form the Caatinga CI pipeline: `doctor`, `smoke`, and `ci run`.

---

## 1. `ctg doctor` (Sprint 26)

The `doctor` command runs a comprehensive set of local diagnostics against the current project. It checks:

| Check               | Description                                                        |
| ------------------- | ------------------------------------------------------------------ |
| Stellar CLI version | Verifies that the installed Stellar CLI meets the minimum version  |
| Deploy coverage     | Reports which contracts are deployed on the target network         |
| Binding freshness   | Verifies that generated bindings match the current WASM hashes     |
| Env sync            | Checks whether `CAATINGA_*` env vars in `.env` match the artifacts |
| Post-deploy hooks   | Validates that `expect` assertions in hooks would pass             |
| WASM drift          | Detects contracts whose on-chain WASM differs from the local build |

### Flags

| Flag                | Default                      | Description                               |
| ------------------- | ---------------------------- | ----------------------------------------- |
| `-n, --network`     | `defaultNetwork`             | Target network                            |
| `-s, --source`      | `CAATINGA_SOURCE` or `alice` | Stellar CLI identity                      |
| `--all-networks`    | `false`                      | Run checks across all configured networks |
| `--strict-env`      | `false`                      | Fail when env vars are missing or stale   |
| `--strict-bindings` | `false`                      | Fail when bindings are stale              |
| `--strict`          | `false`                      | Enable all strict checks                  |

### Exit Codes

- `0` — all diagnostics passed
- `1` — one or more hard failures detected

---

## 2. `ctg smoke` (Sprint 27)

The `smoke` command runs the read-only smoke checks defined under each contract's `smokeReads` in `caatinga.config.ts`. It simulates each read call against the target network and asserts the `expect` matchers.

### `smokeReads` in `caatinga.config.ts`

```ts
contracts: {
  counter: {
    smokeReads: [{ method: "get", expect: { gte: 0 } }];
  }
}
```

### Flags

| Flag            | Default                      | Description                     |
| --------------- | ---------------------------- | ------------------------------- |
| `-n, --network` | `defaultNetwork`             | Target network                  |
| `-s, --source`  | `CAATINGA_SOURCE` or `alice` | Identity for simulation context |

### Exit Codes

- `0` — all smoke reads passed
- `1` — one or more smoke reads failed

---

## 3. `ctg ci run` (Sprint 28)

The `ci run` command orchestrates the full CI recipe: `doctor` → `smoke`. It is designed for use in GitHub Actions and other CI environments.

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
