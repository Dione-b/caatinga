# Frequently Asked Questions (FAQ)

## Part 1 — Fundamentals (1–10)

### 1. What is Caatinga?

Caatinga is a toolkit for developing Soroban applications in TypeScript that implements the concept of **Deployment Orchestration + Versioned Artifacts**. It orchestrates the entire development cycle, from project scaffolding to generating TypeScript bindings and interacting with smart contracts.

---

### 2. What problem does Caatinga solve?

It eliminates the need to manually execute multiple steps of Soroban development by centralizing contract building, deployment, dependency management between contracts, bindings generation, and artifact versioning into a single workflow.

---

### 3. Does Caatinga replace the Stellar CLI?

No. Caatinga uses the Stellar CLI internally to execute operations such as building, deploying, uploading WASM, and invoking contracts. It acts as an orchestration layer on top of the CLI.

---

### 4. What does "Deployment Orchestration" mean?

It is the ability to automate the entire contract deployment process while respecting inter-contract dependencies, running post-deploy hooks, automatically generating bindings, and synchronizing information to the frontend when necessary.

---

### 5. What are Versioned Artifacts?

They are the deployment metadata stored in the `caatinga.artifacts.json` file, containing information such as:

* Contract ID
* WASM Hash
* Deployment date
* Dependencies
* Project paths
* Upgrade history

This file is versioned along with the source code in Git.

---

### 6. Does Caatinga rely on an on-chain registry?

No.

Its operation is based on local artifacts (`caatinga.artifacts.json`), requiring no mandatory registry on the blockchain.

---

### 7. What is the main development workflow?

The recommended workflow is:

1. Initialize the project (`init`)
2. Build contracts (`build`)
3. Deploy contracts (`deploy`)
4. Generate bindings (`generate`)
5. Invoke methods (`invoke`)
6. Perform reads (`read`)

---

### 8. How do I set up a new machine to use Caatinga?

After installing Node.js 22+, simply run:

```bash
npx caatinga setup
```

This command automatically installs:

* Rust
* The `wasm32v1-none` target
* Stellar CLI
* A funded local identity on Testnet

---

### 9. What are the official templates available?

Currently, there are two:

* **react-vite-counter** (default template)
* **zk-starter** (template for Zero Knowledge projects)

The only officially supported frontend is **Vite + React**.

---

### 10. Is Caatinga stable yet?

Not yet.

Although the packages use versions from the **3.x** series, the project remains in **Alpha (pre-1.0)**. This means the API may still undergo breaking changes before version 1.0.

## Part 2 — CLI and Workflow (11–20)

### 11. What does the `caatinga init` command do?

The `caatinga init` command creates a new Caatinga project from a template. By default, it uses the `react-vite-counter` template, but it also supports minimal templates (`--minimal`) or an empty project (`--empty`).

Example:

```bash
npx caatinga init my-project
```

---

### 12. What is the purpose of the `caatinga build` command?

The `build` command compiles one or more Soroban contracts using `stellar contract build`. If no contract is specified, all configured contracts will be compiled.

Example:

```bash
npx caatinga build counter
```

---

### 13. What happens during a `caatinga deploy`?

The deployment automatically performs several steps:

* deploys the contract;
* registers the contract in `caatinga.artifacts.json`;
* generates TypeScript bindings (by default);
* when run without specifying a contract, it also runs:

  * `wire`;
  * `sync-env`.

Thus, a single command can set up the entire application after deployment.

---

### 14. What is the difference between deploying a single contract and deploying the entire graph?

When you run:

```bash
caatinga deploy counter
```

only that specific contract is deployed.

When you run:

```bash
caatinga deploy
```

Caatinga:

* resolves dependencies (`dependsOn`);
* determines the correct order of deployment;
* executes `postDeploy` hooks;
* synchronizes frontend environment variables;
* automatically generates bindings.

This is the recommended mode for applications with multiple contracts.

---

### 15. When should I use `caatinga upgrade`?

Use `upgrade` when the contract already implements an administrative function `upgrade(new_wasm_hash)`.

In this mode:

* the `contractId` remains the same;
* only the WASM bytecode is replaced;
* the upgrade history is recorded in the artifacts.

---

### 16. What is the difference between `upgrade` and `deploy --upgrade`?

`caatinga upgrade`

* preserves the same `contractId`;
* uploads the new WASM bytecode;
* calls the contract's `upgrade` method.

`caatinga deploy --upgrade`

* creates a new instance of the contract;
* generates a new `contractId`;
* registers the previous contract in the history;
* automatically implies `--force`.

The former is an "in-place" upgrade. The latter is a redeploy.

---

### 17. What does the `caatinga generate` command do?

It generates (or regenerates) TypeScript bindings from the contract's interface using:

```text
npx @stellar/stellar-sdk generate
```

These bindings are used by `@caatinga/client` for typed calls to the contracts.

---

### 18. What is the purpose of the `caatinga doctor` command?

It is Caatinga's diagnostic tool.

It checks:

* Node installation;
* Stellar CLI;
* Rust;
* project configuration;
* artifacts;
* bindings;
* Stellar identity;
* network connectivity.

It is the recommended command to run before making any changes to the deployment state.

---

### 19. What does the `caatinga status` command show?

`status` provides an overview of the deployed contracts for a given network.

The information displayed includes:

* deployed contracts;
* bindings freshness state;
* the network being used;
* support for JSON output (`--json`).

With `--strict`, the command returns exit code `1` if there are stale or missing bindings.

---

### 20. What is the difference between `invoke` and `read`?

`invoke`

* signs the transaction;
* sends it to the blockchain;
* modifies the contract's state.

Example:

```bash
caatinga invoke counter.increment --source alice
```

`read`

* only simulates execution;
* is not signed;
* does not send a transaction;
* does not modify the state.

Example:

```bash
caatinga read counter.get
```

Always use `read` for queries, and `invoke` only when it is necessary to modify the contract's state.

## Part 3 — Configuration and Deploy (21–30)

### 21. What is the `caatinga.config.ts` file?

It is the main configuration file of the project. In it, you define:

* project name;
* contracts;
* networks;
* frontend;
* deployment hooks;
* smoke tests;
* Zero Knowledge configurations.

The entire CLI uses this file as the single source of truth.

---

### 22. How is a contract defined in the configuration?

Each contract is registered under the `contracts` section, containing information such as:

* source code directory (`path`);
* path to the compiled WASM bytecode (`wasm`);
* dependencies;
* deployment arguments;
* compilation options.

Example:

```ts
contracts: {
  counter: {
    path: "./contracts/counter",
    wasm: "./contracts/counter/target/wasm32v1-none/release/counter.wasm"
  }
}
```

---

### 23. What is the purpose of `dependsOn`?

`dependsOn` declares that a contract depends on another to be deployed.

Example:

```ts
dependsOn: ["token"]
```

In this case, the `token` contract will be deployed before the current contract.

Additionally, Caatinga automatically validates:

* that the contract exists;
* that there are no circular dependencies;
* that all references are valid.

---

### 24. How does Caatinga automatically resolve deployment arguments?

Caatinga supports placeholders inside `deployArgs`.

Example:

```ts
deployArgs: {
  tokenContractId: "${contracts.token.contractId}"
}
```

During deployment, it automatically replaces this placeholder with the actual Contract ID retrieved from the artifacts.

---

### 25. Which placeholders are supported?

Currently, there are two main placeholders:

**Contract ID of another contract**

```text
${contracts.token.contractId}
```

**Address of the identity used for deployment**

```text
${source.address}
```

The latter automatically resolves the Stellar address associated with the alias provided in `--source`.

---

### 26. What happens if a placeholder cannot be resolved?

The deployment fails with a specific error code.

Some examples include:

* `CAATINGA_DEPLOY_ARG_PLACEHOLDER_UNRESOLVED`
* `CAATINGA_DEPLOY_ARG_PLACEHOLDER_INVALID`
* `CAATINGA_CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND`

This prevents inconsistent deployments.

---

### 27. What is `postDeploy`?

It is a list of calls executed automatically after deployment.

These hooks are typically used to:

* initialize contracts;
* configure administrators;
* register permissions;
* perform mandatory procedures right after deployment.

Example:

```ts
postDeploy: [
  {
    contract: "counter",
    method: "initialize"
  }
]
```

---

### 28. What is the difference between `postDeploy` and `postDeployRead`?

`postDeploy`

* executes signed calls (`invoke`);
* modifies the contract's state.

`postDeployRead`

* executes only simulations (`read`);
* does not modify the state;
* is typically used for automatic post-deployment validation.

---

### 29. What is `sync-env`?

`sync-env` synchronizes deployment information from the artifacts into a frontend `.env` file.

Information that can be exported includes:

* Contract ID;
* WASM Hash;
* RPC URL;
* Network Passphrase;
* Deployment date.

This eliminates the need to manually update environment variables after each deployment.

---

### 30. What is `smoke`?

`smoke` is a set of quick tests executed after deployment to verify that the contracts are working correctly.

It performs read calls (`read`) and validates the results using an Expect DSL.

These tests can verify, for example:

* if the contract responds;
* if a return value is an array;
* if a value is equal to what is expected;
* if a regular expression matches the result;
* if the returned JSON matches the expected structure exactly.

The corresponding command is:

```bash
npx caatinga smoke
```

It is also part of the `caatinga regression` workflow, allowing automatic validation of a deployment before it is considered complete.

## Part 4 — Client API and Artifacts (31–40)

### 31. What is `@caatinga/client`?

`@caatinga/client` is the library used by frontends to interact with Soroban contracts. It abstracts transaction building, contract reading, wallet integration, and the use of the automatically generated Caatinga bindings.

---

### 32. What does `createCaatingaClient()` do?

It is the function responsible for creating an instance of the application client.

It accepts:

* network configuration;
* `caatinga.artifacts.json`;
* a wallet adapter;
* generated bindings;
* options like wallet timeout.

Once created, this instance allows access to any configured contract.

---

### 33. Why does the client use `caatinga.artifacts.json`?

Because the artifacts store the metadata of the deployed contracts, including:

* Contract ID;
* WASM Hash;
* Network;
* Deployment history.

Thus, the frontend typically does not need to specify the Contract ID manually.

---

### 34. Which operations can be performed by the client?

Each contract supports four main operations:

* `read()`
* `simulate()`
* `invoke()`
* `buildXdr()`

Each serves a different interaction scenario with the contract.

---

### 35. What is the difference between `read()`, `simulate()`, and `invoke()`?

**`read()`**

* is not signed;
* does not send a transaction;
* returns only the processed value.

**`simulate()`**

* is not signed;
* does not send a transaction;
* returns complete simulation metadata.

**`invoke()`**

* signs the transaction;
* sends it to the blockchain;
* returns execution details, the transaction hash, and optionally, debugging data.

---

### 36. What is the purpose of `buildXdr()`?

`buildXdr()` generates the prepared transaction in XDR format, without signing or sending it to the network.

This feature is useful when:

* another application will perform the signing;
* you want to inspect the transaction details;
* the broadcast will happen later.

---

### 37. How does wallet integration work?

Caatinga uses a simple interface named `CaatingaWalletAdapter`.

It requires only two methods:

* `getPublicKey()`
* `signTransaction()`

Any wallet that implements this interface can be used by the client.

---

### 38. What rules must a Wallet Adapter follow?

The documentation defines two important rules:

* when a signature is canceled, the wallet must reject the Promise, never leave it pending;
* a timeout is not automatically enforced by Caatinga. If desired, it should be configured via `walletTimeout`.

---

### 39. What is `WalletSession`?

`WalletSession` manages the wallet connection state independently of the framework being used.

It offers features such as:

* connecting;
* disconnecting;
* restoring persisted sessions;
* observing state changes;
* retaining the connection across page reloads.

This allows reusing the same logic in React as well as other frontend frameworks.

---

### 40. What is the `caatinga.artifacts.json` file?

It is the official registry of the contracts deployed by the project.

For each network, it stores information such as:

* Contract ID;
* WASM Hash;
* deployment date;
* paths to source code and WASM bytecode;
* resolved dependencies;
* resolved deployment arguments;
* upgrade strategy;
* version history.

This file is versioned in Git and serves as the primary source of truth regarding the state of deployed contracts. Even if the project stops using Caatinga, the file remains useful as a historical record of deployments.

## Part 5 — Errors, ZK and Best Practices (41–50)

### 41. What is the `CAATINGA_*` error code system?

Caatinga standardizes all errors using codes in the format `CAATINGA_*`. These codes are part of the project's public API and are stable for automations.

The documentation recommends that scripts and tools **always inspect the error code**, never the error message text, as the message text may change between versions.

---

### 42. What are the most common configuration-related errors?

Some of the key errors are:

| Code | Meaning |
| --- | --- |
| `CAATINGA_CONFIG_NOT_FOUND` | `caatinga.config.ts` file not found |
| `CAATINGA_INVALID_CONFIG` | Invalid configuration |
| `CAATINGA_CONTRACT_NOT_FOUND` | Contract does not exist in the configuration |
| `CAATINGA_NETWORK_NOT_FOUND` | Specified network does not exist |
| `CAATINGA_ARTIFACT_NOT_FOUND` | Artifact does not exist |

These errors typically halt any CLI operation.

---

### 43. What rules exist for the `--source` parameter?

The `--source` parameter **must always** receive a Stellar CLI identity alias, for example:

```text
alice
```

It must never receive:

* a public key (`G...`);
* a secret key (`S...`);
* a seed phrase.

If this happens, Caatinga returns specific errors such as:

* `CAATINGA_SOURCE_IS_PUBLIC_KEY`
* `CAATINGA_SOURCE_IS_SECRET_KEY`
* `CAATINGA_SOURCE_IS_SEED_PHRASE`

This validation prevents security issues and standardizes integration with the Stellar CLI.

---

### 44. How does Caatinga validate dependencies between contracts?

Before any command is executed, the configuration loader checks:

* whether all contracts referenced in `dependsOn` exist;
* whether there are any dependency cycles;
* whether placeholders like `${contracts.*.contractId}` have their corresponding dependency declared.

If any of these validations fail, configuration loading is aborted immediately.

---

### 45. What is Binding Freshness?

Caatinga monitors whether the TypeScript bindings correspond to the currently deployed contract.

There are four possible states:

| State | Meaning |
| --- | --- |
| `fresh` | Binding is up to date |
| `stale` | Contract changed after the binding was generated |
| `missing` | Binding does not exist |
| `unknown` | Binding was created before the tracking mechanism was introduced |

This information is stored in the file:

```text
.caatinga-bindings.json
```

---

### 46. How do I fix out-of-date bindings?

The solution depends on the state:

**stale**

```bash
caatinga generate <contract> --network testnet
```

**missing**

```bash
caatinga generate
```

**unknown**

Regenerate the bindings once to create the freshness marker.

After that, the state will be monitored automatically.

---

### 47. What is Caatinga's support for Zero Knowledge?

Caatinga has built-in support for Circom circuits using Groth16.

The primary commands are:

* `caatinga zk init`
* `caatinga zk build`
* `caatinga zk prove`
* `caatinga zk invoke`

There is also a dedicated package:

```text
@caatinga/zk
```

for proof serialization and related utilities.

---

### 48. Are there any limitations for ZK features?

Yes.

The documentation lists some important limitations:

* `zk build` uses only a development ceremony (single-party);
* Mainnet deployment is blocked by default when using artifacts from the development ceremony;
* `--embed-vk` is experimental;
* production setups with MPC ceremonies are out of scope for the project.

To bypass the Mainnet protection (not recommended for production), you must use:

```bash
--allow-dev-ceremony
```

---

### 49. What best practices are recommended when working with Caatinga projects?

The documentation highlights the following recommendations:

* run `caatinga doctor` before changing the deployment state;
* follow the `build → deploy → generate → invoke` workflow;
* use Stellar CLI identity aliases in `--source`;
* always inspect `CAATINGA_*` error codes;
* version `caatinga.artifacts.json` in Git;
* use `read()` for queries and `invoke()` only for state modifications;
* regenerate bindings whenever the contract interface changes;
* pin exact package versions in CI/CD environments to guarantee reproducible builds.

---

### 50. What is the complete recommended workflow for Caatinga development?

The workflow suggested by the documentation is:

1. Create the project using `caatinga init`.
2. Set up the environment using `caatinga setup` (on a new machine).
3. Verify the environment using `caatinga doctor`.
4. Build the contracts using `caatinga build`.
5. Deploy using `caatinga deploy`.
6. Allow bindings to be generated automatically (or run `caatinga generate` when needed).
7. Execute `wire` hooks and synchronize the frontend (`sync-env`) in full-graph deployments.
8. Validate the deployment with `caatinga smoke` or `caatinga regression`.
9. Interact with contracts using:

   * `read` for queries;
   * `invoke` for operations that alter state;
   * `@caatinga/client` for frontend integration.
10. During contract updates:

    * use `caatinga upgrade` when the contract supports in-place upgrades;
    * use `caatinga deploy --upgrade` when a new contract instance needs to be created.

This workflow covers the entire lifecycle of a Soroban application using Caatinga, from project creation to maintenance, upgrades, and frontend integration.
