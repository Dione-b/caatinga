# Workshop: Contract Deployment with Caatinga

Hands-on path to scaffold, build, deploy, read, and redeploy a Soroban contract on Testnet using Caatinga. Target length: about 60–75 minutes. Uses a **minimal** project (contract + CLI only, no frontend).

Core loop:

**setup → init → doctor → build → deploy → read → status → redeploy**

---

## What Caatinga is in this workshop

Caatinga does not replace Stellar or Soroban. It orchestrates the usual toolchain (Node, Rust, Stellar CLI) and keeps deployment state in the repo.

Two files define the project:

| File                      | Role                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| `caatinga.config.ts`      | Intent: contract names, WASM paths, networks                         |
| `caatinga.artifacts.json` | Reality: deployed `contractId` per network (commit this to Git)      |

After `deploy`, later commands such as `read` and `status` resolve the contract from artifacts, so you do not paste addresses by hand.

---

## 1. Environment

Need Node.js 22+. On a fresh machine, `setup` installs Rust, the WASM target, Stellar CLI, and funds a Testnet identity named `alice`:

```bash
node --version
npx caatinga setup
```

`--source alice` is a **local Stellar CLI identity alias**. Public `G…` addresses and secret `S…` keys are rejected on purpose.

---

## 2. Scaffold

Create a minimal app: stub contract `app` with read-only `hello` and `version` methods.

```bash
npx caatinga init my-contract-app --minimal
cd my-contract-app
npm install
```

What matters in the tree:

| Path                      | Purpose                                      |
| ------------------------- | -------------------------------------------- |
| `contracts/app/`          | Rust / Soroban source                        |
| `caatinga.config.ts`      | Declares contract `app` and networks         |
| `caatinga.artifacts.json` | Empty until the first successful deploy      |
| `package.json`            | Scripts for `build`, `deploy`, `read:*`      |

Minimal keeps the session on the contract lifecycle. For a Vite + React dApp later, use `caatinga init` without `--minimal` ([Template project](./template-project.md)).

---

## 3. Verify, build, deploy, read

### Doctor

Checks that the machine is ready for Testnet with identity `alice`:

```bash
npx caatinga doctor --network testnet --source alice
```

Expect checks for Node, Stellar CLI, Rust, WASM target, config, and identity. An untested Stellar CLI version warning is usually advisory.

### Build

Compiles contract `app` to WASM (name matches `caatinga.config.ts`):

```bash
npx caatinga build app
```

If deploy fails with a missing artifact, run `build` again first.

### Deploy

Uploads WASM to Testnet, creates the instance, and writes `contractId` into `caatinga.artifacts.json`:

```bash
npx caatinga deploy app --network testnet --source alice
```

Open `caatinga.artifacts.json` and confirm `contractId` under testnet / `app`. That file is the shared source of truth for teammates and CI.

### Read

Stub methods are read-only. `caatinga read` simulates the call (no fee / no signature on this path):

```bash
npx caatinga read app.version --network testnet
npx caatinga read app.hello --network testnet
```

State-changing methods use `caatinga invoke` and a signing identity. This stub does not need invoke.

### Status

Quick view of what is deployed on the network:

```bash
npx caatinga status --network testnet
```

---

## 4. Upgrades

Two strategies:

| Strategy     | Command                     | Effect                                      | `contractId`   |
| ------------ | --------------------------- | ------------------------------------------- | -------------- |
| **In-place** | `caatinga upgrade`          | New WASM on the same instance               | Unchanged      |
| **Redeploy** | `caatinga deploy --upgrade` | New instance; old ID kept in artifact history | New ID       |

In-place needs a contract entrypoint such as `upgrade` plus admin auth. The minimal stub does **not** implement that, so this workshop demonstrates **redeploy**:

```bash
npx caatinga build app
npx caatinga deploy app --upgrade --network testnet --source alice
npx caatinga status --network testnet
```

After redeploy, the active `contractId` in artifacts changes; the previous ID moves to history. Clients must follow the new ID — another reason to version artifacts in Git.

Details: [Contract upgrade](./contract-upgrade.md).

---

## 5. Error codes to recognize

Caatinga exposes stable `CAATINGA_*` codes for scripts, CI, and agents.

| Situation                            | Code                             | Fix                                              |
| ------------------------------------ | -------------------------------- | ------------------------------------------------ |
| Build artifact missing before deploy | `CAATINGA_ARTIFACT_NOT_FOUND`    | Run `caatinga build` first                       |
| `stellar` missing from `PATH`        | `CAATINGA_STELLAR_CLI_NOT_FOUND` | Install Stellar CLI or re-run `setup`            |
| `--source` is a public `G…` address  | `CAATINGA_SOURCE_IS_PUBLIC_KEY`  | Use an identity alias such as `alice`            |
| `--source` is a secret `S…` key      | `CAATINGA_SOURCE_IS_SECRET_KEY`  | Same: alias only; never paste keys on the CLI    |

Example of a rejected public `--source`:

```bash
npx caatinga read app.version --network testnet --source GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF
```

---

## Command checklist

```bash
node --version
npx caatinga setup

npx caatinga init my-contract-app --minimal
cd my-contract-app
npm install

npx caatinga doctor --network testnet --source alice
npx caatinga build app
npx caatinga deploy app --network testnet --source alice
npx caatinga read app.version --network testnet
npx caatinga read app.hello --network testnet
npx caatinga status --network testnet

npx caatinga build app
npx caatinga deploy app --upgrade --network testnet --source alice
npx caatinga status --network testnet
```

---

## Next steps

- [Cheatsheet](../cheatsheet.md) — command loop on one page
- [CLI reference](../cli.md) — flags and subcommands
- [Minimal project](./minimal-project.md) — what `--minimal` generates
- [From Zero to Testnet](./from-zero-to-testnet.md) — fuller walkthrough
- [Contract upgrade](./contract-upgrade.md) — in-place vs redeploy
- [Troubleshooting](../troubleshooting.md) — symptom-first fixes
