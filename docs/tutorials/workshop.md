# Script: contract deploy with Caatinga

## 1. Opening and mental model (10 min)

This session covers a Soroban contract from scaffold to testnet using Caatinga.

Caatinga does not replace the Stellar CLI. It orchestrates scaffold, build, deploy, then read or invoke. Deployed state is recorded in a Git-versioned file: `caatinga.artifacts.json`. That file remains a portable map of on-chain IDs even if Caatinga is no longer used later.

<WorkflowAnimation />

The loop in practice: init, build, deploy, then read the contract.

Prerequisites: Node 22 or newer. On a clean machine, run setup — it installs Rust, the WASM target, Stellar CLI, and funds a testnet identity named `alice`.

```bash
node --version
npx caatinga setup
```

Continue once setup finishes.

---

## 2. Scaffold and doctor (10 min)

Next: a **minimal** project — contract and CLI only. No Vite, no React, no wallet. The contract name is `app`.

```bash
npx caatinga init my-contract-app --minimal
cd my-contract-app
npm install
```

Then doctor. It checks Node, Stellar CLI, Rust, config, and the `alice` identity. If doctor fails, stop and fix before deploy.

```bash
npx caatinga doctor --network testnet --source alice
```

Advance only when status is ready. On failure, check `stellar` on `PATH`, the identity, and the Node version.

---

## 3. CLI loop and artifacts (25 min)

Main block. The minimal stub exposes read-only methods: `hello` and `version`. Sequence: build, deploy, read. Invoke applies later, after state-changing methods exist on the contract.

Compile WASM first.

```bash
npx caatinga build app
```

Build shells out to Stellar CLI. Caatinga organizes the step.

Deploy next. This uploads the contract to testnet and writes `contractId` into artifacts. Binding generation applies when a frontend block is configured; on minimal, the important result is the `contractId` in the file.

```bash
npx caatinga deploy app --network testnet --source alice
```

Open `caatinga.artifacts.json`. Under `networks.testnet.contracts.app`, the `contractId` should appear — a long `C…` value. That file is the portable deploy map. Commit it after the session.

Read on-chain without signing. `read` only simulates.

```bash
npx caatinga read app.version --network testnet
npx caatinga read app.hello --network testnet
```

Then `status` — what is deployed and whether bindings are fresh when they exist.

```bash
npx caatinga status --network testnet
```

Summary so far: build compiles, deploy records the ID, read queries without signing, status shows the overview. State-changing calls use `invoke` with `--source` after mutating methods are added.

---

## 4. Upgrade (10 min)

Two upgrade paths. Differences first; then the path the minimal stub supports.

<UpgradeCompareAnimation />

**In-place** — `caatinga upgrade`. Same `contractId`; WASM hash changes. Requires an admin-gated `upgrade` entrypoint on the contract.

**Redeploy** — `caatinga deploy --upgrade`. New instance. Prior ID moves into artifact history. Use when the contract has no `upgrade()` — the minimal stub does not.

Demo: redeploy.

```bash
npx caatinga build app
npx caatinga deploy app --upgrade --network testnet --source alice
npx caatinga status --network testnet
```

Check artifacts again: new `contractId`, prior ID under `history`. Commit the file so the team keeps the on-chain map.

---

## 5. Gotchas (10 min)

Automation must key on **`CAATINGA_*` codes**, not message text. Messages may change; codes are public contract.

<SourceGotchaAnimation />

`--source` must be a **Stellar CLI identity alias** — for example `alice`. Not a public `G…` address, not an `S…` secret, not a seed phrase. Passing `G…` is rejected on purpose.

Other common codes: `CAATINGA_ARTIFACT_NOT_FOUND` — build before deploy. `CAATINGA_STELLAR_CLI_NOT_FOUND` — `stellar` missing from `PATH`.

Force the source error with an invented `G…` address and inspect the code.

```bash
npx caatinga read app.version --network testnet --source GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF
```

Expect `CAATINGA_SOURCE_IS_PUBLIC_KEY`. That rejection is correct.

---

## 6. Close (5 min)

This session covered: minimal scaffold, doctor, build, testnet deploy, CLI reads, artifact history after redeploy, and the `--source` rule.

Further reading: [Cheatsheet](../cheatsheet.md) for commands, [CLI](../cli.md) for flags, [Contract upgrade](./contract-upgrade.md) for upgrade detail. Browser and wallet wiring live under [Getting started](../getting-started.md) — a separate track.

Questions.
