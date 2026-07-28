# Workshop: Contract deploy & orchestration

Facilitator script for a **60–75 minute** CLI workshop. Participants scaffold a minimal Soroban project, deploy to testnet, and walk the Caatinga orchestration loop — no browser or frontend.

::: tip Facilitator
Project this page during the session. Use **Replay** on the animated diagrams when revisiting a section. Deep reference: [CLI](../cli.md), [Errors](../errors.md), [Contract upgrade](./contract-upgrade.md).
:::

## Agenda

| Block | Time | Focus |
| ----- | ---- | ----- |
| 1. Setup + mental model | 10 min | Prerequisites, workflow, artifacts |
| 2. Scaffold + doctor | 10 min | `init --minimal`, environment check |
| 3. CLI loop + artifacts | 25 min | build → deploy → read → status |
| 4. Upgrade | 10 min | in-place vs redeploy |
| 5. Gotchas | 10 min | `--source`, common `CAATINGA_*` codes |
| 6. Wrap-up | 5 min | next steps |

---

## 1. Setup + mental model (10 min)

Caatinga orchestrates **build → deploy → bindings → read/invoke** and records deployed state in git-versioned `caatinga.artifacts.json`. It shells out to Stellar CLI — it does not replace it.

<WorkflowAnimation />

Fresh machine:

```bash
node --version          # expect v22+
npx caatinga setup      # Rust, wasm target, Stellar CLI, funded alice on testnet
```

Prerequisites: [Getting started](../getting-started.md#prerequisites).

---

## 2. Scaffold + doctor (10 min)

Use the **minimal** scaffold — contract + CLI only, no frontend.

```bash
npx caatinga init my-contract-app --minimal
cd my-contract-app
npm install
npx caatinga doctor --network testnet --source alice
```

Fix any doctor failure before continuing — [Troubleshooting](../troubleshooting.md). Details: [Minimal project](./minimal-project.md).

---

## 3. CLI loop + artifacts (25 min)

Core block. The minimal template ships contract `app` with read-only methods (`hello`, `version`).

```bash
npx caatinga build app
npx caatinga deploy app --network testnet --source alice
npx caatinga read app.version --network testnet
npx caatinga read app.hello --network testnet
npx caatinga status --network testnet
```

::: tip Facilitator
After deploy, open `caatinga.artifacts.json` and point out `networks.testnet.contracts.app.contractId`. Run `status` to show binding freshness when bindings exist.
:::

- **`build`** — compile WASM
- **`deploy`** — deploy, record `contractId`, auto-generate bindings when `frontend` is configured
- **`read`** — simulate read-only calls (no signing)
- **`invoke`** — state-changing calls; use after adding mutating methods to the contract

More commands and flags: [CLI](../cli.md), [From Zero to Testnet](./from-zero-to-testnet.md).

---

## 4. Upgrade (10 min)

Two strategies — pick based on contract design.

<UpgradeCompareAnimation />

| Strategy | Command | `contractId` |
| -------- | ------- | ------------ |
| In-place | `caatinga upgrade` | Preserved |
| Redeploy | `caatinga deploy --upgrade` | New ID |

The minimal stub has no in-place `upgrade()` — demo redeploy:

```bash
npx caatinga build app
npx caatinga deploy app --upgrade --network testnet --source alice
npx caatinga status --network testnet
```

Commit the updated `caatinga.artifacts.json`. Full guide: [Contract upgrade](./contract-upgrade.md).

---

## 5. Gotchas (10 min)

Automation must key on **`CAATINGA_*` codes**, not message text.

<SourceGotchaAnimation />

`--source` must be a **Stellar CLI identity alias** (e.g. `alice`). Never a `G...` address, `S...` secret, or seed phrase.

| Code | Quick fix |
| ---- | --------- |
| `CAATINGA_ARTIFACT_NOT_FOUND` | Run `build` before `deploy` |
| `CAATINGA_SOURCE_IS_PUBLIC_KEY` | Use identity alias, not `G...` |
| `CAATINGA_STELLAR_CLI_NOT_FOUND` | Install Stellar CLI; check `PATH` |

Deliberate failure demo:

```bash
npx caatinga read app.version --network testnet --source GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF
```

Full catalog: [Errors](../errors.md).

---

## 6. Wrap-up (5 min)

Participants scaffolded a minimal Soroban project, deployed to testnet, read on-chain state via CLI, and saw how artifacts track deploy history.

| Next | Link |
| ---- | ---- |
| Command cheat sheet | [Cheatsheet](../cheatsheet.md) |
| Full CLI reference | [CLI](../cli.md) |
| Browser client (separate path) | [Getting started](../getting-started.md) |
| Upgrade deep dive | [Contract upgrade](./contract-upgrade.md) |
