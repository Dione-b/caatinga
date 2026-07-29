# Hands-On Workshop: Contract Deployment

Practical guide to scaffolding, building, deploying, reading, and upgrading a Soroban contract on Testnet using Caatinga.

---

## 1. Setup & Mental Model

Caatinga orchestrates scaffold, build, deployment, and contract calls, tracking deployed addresses in a Git-versioned `caatinga.artifacts.json`.

### Environment Setup

Ensure Node.js 22+ is installed, then run `setup` to install Rust, WASM target, Stellar CLI, and fund the `alice` identity on Testnet:

```bash
node --version
npx caatinga setup
```

---

## 2. Scaffold & Health Check

Initialize a minimal project (CLI + contract only) and verify environment readiness.

```bash
npx caatinga init my-contract-app --minimal
cd my-contract-app
npm install
```

Validate tooling, config, and `alice` identity:

```bash
npx caatinga doctor --network testnet --source alice
```

---

## 3. Build, Deploy & Interact

### Build WASM

```bash
npx caatinga build app
```

### Deploy to Testnet

Upload the contract and record `contractId` in `caatinga.artifacts.json`:

```bash
npx caatinga deploy app --network testnet --source alice
```

### Read On-Chain State

Simulate contract read calls (no transaction fee or signature required):

```bash
npx caatinga read app.version --network testnet
npx caatinga read app.hello --network testnet
```

### Check Deployment Status

```bash
npx caatinga status --network testnet
```

---

## 4. Contract Upgrades

Understand upgrade strategies for Soroban contracts:

- **In-place (`caatinga upgrade`)**: Keeps `contractId`, updates WASM hash (requires contract `upgrade` entrypoint).
- **Redeploy (`caatinga deploy --upgrade`)**: Deploys a new contract instance; stores former ID under artifact history.

### Redeploy Example

```bash
npx caatinga build app
npx caatinga deploy app --upgrade --network testnet --source alice
npx caatinga status --network testnet
```

Inspect `caatinga.artifacts.json` to verify that the active `contractId` updated and the previous ID was moved to `history`.

---

## 5. Common Gotchas & Error Codes

Automated flows should rely on stable `CAATINGA_*` error codes.

- **`--source` requirement**: Must be a valid Stellar CLI identity alias (e.g., `alice`). Passing a public address (`G...`) or secret key (`S...`) triggers `CAATINGA_SOURCE_IS_PUBLIC_KEY`.
- **`CAATINGA_ARTIFACT_NOT_FOUND`**: Missing build artifact. Run `caatinga build` first.
- **`CAATINGA_STELLAR_CLI_NOT_FOUND`**: `stellar` CLI missing from system `PATH`.

### Verify Error Code Handling

```bash
npx caatinga read app.version --network testnet --source GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF
```

---

## Next Steps

- Consult the [Cheatsheet](../cheatsheet.md) for quick command references.
- Review [CLI Reference](../cli.md) for available flags.
- Check [Contract Upgrade Guide](./contract-upgrade.md) for in-place migration patterns.


