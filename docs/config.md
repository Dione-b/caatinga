# Config

Caatinga projects use `caatinga.config.ts`.

```ts
import { defineConfig } from "@caatinga/core";

export default defineConfig({
  project: "my-dapp",
  defaultNetwork: "testnet",
  contracts: {
    counter: {
      path: "./contracts/counter",
      wasm: "./contracts/counter/target/wasm32v1-none/release/counter.wasm",
    },
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
  frontend: {
    framework: "vite-react",
    bindingsOutput: "./src/contracts/generated",
  },
});
```

## Field reference

`caatinga.config.ts` has **no version field** (unlike `caatinga.artifacts.json`); do not look for one.

Root config:

| Field            | Type                             | Required | Default     | Notes                                       |
| ---------------- | -------------------------------- | -------- | ----------- | ------------------------------------------- |
| `project`        | string (min 1)                   | yes      | —           |                                             |
| `defaultNetwork` | string (min 1)                   | no       | `"testnet"` |                                             |
| `contracts`      | `Record<string, ContractConfig>` | yes      | —           | at least one entry                          |
| `networks`       | `Record<string, NetworkConfig>`  | yes      | —           | at least one entry                          |
| `frontend`       | `FrontendConfig`                 | no       | —           | optional frontend configuration (see below) |
| `zk`             | `ZkConfig`                       | no       | —           | ZK circuit configuration (see below)        |

`ContractConfig` (each value in `contracts`):

| Field        | Type                                          | Required | Default | Notes                                   |
| ------------ | --------------------------------------------- | -------- | ------- | --------------------------------------- |
| `path`       | string (min 1)                                | yes      | —       | contract source directory               |
| `wasm`       | string (min 1)                                | yes      | —       | compiled WASM path                      |
| `dependsOn`  | `string[]`                                    | no       | `[]`    | contract names deployed first           |
| `deployArgs` | `Record<string, string \| number \| boolean>` | no       | `{}`    | constructor args; supports placeholders |

`FrontendConfig` (optional root `frontend` field):

| Field            | Type           | Required | Default        | Notes                                                                      |
| ---------------- | -------------- | -------- | -------------- | -------------------------------------------------------------------------- |
| `framework`      | `"vite-react"` | no       | `"vite-react"` | Official templates are Vite + React only; no Next.js or Astro adapter yet. |
| `bindingsOutput` | string (min 1) | yes      | —              | path for generated bindings                                                |

`NetworkConfig` (each value in `networks`):

| Field               | Type               | Required | Notes |
| ------------------- | ------------------ | -------- | ----- |
| `rpcUrl`            | string (valid URL) | yes      |       |
| `networkPassphrase` | string (min 1)     | yes      |       |

`ZkConfig` (optional root `zk` field):

| Field         | Type                              | Required | Notes                      |
| ------------- | --------------------------------- | -------- | -------------------------- |
| `zk.circuits` | `Record<string, ZkCircuitConfig>` | yes      | at least one circuit entry |

`ZkCircuitConfig` (each value in `zk.circuits`):

| Field              | Type           | Required | Notes                                   |
| ------------------ | -------------- | -------- | --------------------------------------- |
| `path`             | string (min 1) | yes      | directory containing `.circom` files    |
| `protocol`         | `"groth16"`    | yes      | only Groth16 supported today            |
| `curve`            | `"bls12381"`   | yes      | only BLS12-381 supported today          |
| `verifierContract` | string         | no       | contract name for on-chain verification |

## Artifacts

Artifacts are network-scoped in schema `version: 1` so `counter` can have different contract IDs
on testnet and mainnet. Environments are intentionally not modeled yet; a future artifact schema
can distinguish `dev -> testnet`, `staging -> testnet`, and `production -> mainnet`.

Top-level shape: `project` (string), `version` (literal `1`), and `networks`
(`Record<network, { contracts, dependencyGraph }>`). `dependencyGraph` is
`Record<contractName, string[]>`. Before any deploy, `contracts` and
`dependencyGraph` are empty:

```json
{
  "project": "my-dapp",
  "version": 1,
  "networks": {
    "testnet": {
      "contracts": {},
      "dependencyGraph": {}
    }
  }
}
```

After a deploy, each contract is recorded under
`networks.<network>.contracts.<name>` as a `ContractArtifact`:

```json
{
  "project": "my-dapp",
  "version": 1,
  "networks": {
    "testnet": {
      "contracts": {
        "counter": {
          "contractId": "C...",
          "wasmHash": "...",
          "deployedAt": "2026-01-01T00:00:00.000Z",
          "sourcePath": "./contracts/counter",
          "wasmPath": "./contracts/counter/target/wasm32v1-none/release/counter.wasm",
          "dependencies": [],
          "resolvedDeployArgs": {}
        }
      },
      "dependencyGraph": {}
    }
  }
}
```

`ContractArtifact` fields:

| Field                | Type                                          | Required | Default | Notes                                    |
| -------------------- | --------------------------------------------- | -------- | ------- | ---------------------------------------- |
| `contractId`         | string (min 1)                                | yes      | —       | deployed on-chain ID                     |
| `wasmHash`           | string (min 1)                                | yes      | —       | hash of the deployed WASM                |
| `deployedAt`         | ISO 8601 datetime string                      | yes      | —       |                                          |
| `sourcePath`         | string (min 1)                                | yes      | —       |                                          |
| `wasmPath`           | string (min 1)                                | yes      | —       |                                          |
| `dependencies`       | `string[]`                                    | no       | `[]`    | resolved dependency contract names       |
| `resolvedDeployArgs` | `Record<string, string \| number \| boolean>` | no       | `{}`    | deploy args after placeholder resolution |

### Multi-contract dependencies

`dependsOn` lists contracts that must deploy before the current contract. `deployArgs` may use `${contracts.<name>.contractId}` placeholders, resolved from `caatinga.artifacts.json` after dependencies deploy:

```ts
contracts: {
  token: {
    path: "./contracts/token",
    wasm: "./contracts/token/target/wasm32v1-none/release/token.wasm"
  },
  marketplace: {
    path: "./contracts/marketplace",
    wasm: "./contracts/marketplace/target/wasm32v1-none/release/marketplace.wasm",
    dependsOn: ["token"],
    deployArgs: {
      tokenContractId: "${contracts.token.contractId}"
    }
  }
}
```

#### How resolution works

1. **Deploy order — topological sort** (`resolveDeployOrder`): a depth-first walk
   over `dependsOn`, marking each contract `visiting` then `visited`.
   - Re-entering a `visiting` node throws `CAATINGA_CONTRACT_DEPENDENCY_CYCLE`; the
     message lists the path, e.g. `a -> b -> a`.
   - A `dependsOn` entry that is not a configured contract throws
     `CAATINGA_CONTRACT_DEPENDENCY_NOT_FOUND`.
2. **Placeholder resolution** (`resolveDeployArgs`): a `deployArgs` value that is a
   string containing `${` must match exactly
   `${contracts.<name>.contractId}` (`/^\$\{contracts\.([A-Za-z0-9_-]+)\.contractId\}$/`).
   This is the **only** supported placeholder form — there is no `${env.*}` and no
   `$(...)` shell interpolation. Deploy args are data passed to the Stellar CLI, not a
   second templating language (see [ADR 0005](./adr/0005-multi-contract-dependency-deploy.md)).
   - A `${...}` value that does not match throws `CAATINGA_DEPLOY_ARG_PLACEHOLDER_INVALID`.
   - The `contractId` is read from `artifacts.networks[<network>].contracts[<name>].contractId`;
     when absent it throws `CAATINGA_CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND` (deploy the
     dependency first).
   - A placeholder still unresolved at deploy time throws
     `CAATINGA_DEPLOY_ARG_PLACEHOLDER_UNRESOLVED`.
3. **CLI flag derivation** (`toSnakeCaseFlag` / `formatConstructorCliArgs`): resolved
   args are passed to `stellar contract deploy` after a `--` separator. Each key is
   converted camelCase → snake*case (insert `*`before each uppercase letter, strip a
leading`\_`, lowercase). For example `tokenContractId`becomes`--token_contract_id`.

End-to-end: with `deployArgs: { tokenContractId: "${contracts.token.contractId}" }`,
`token` deploys first, its `contractId` is recorded in `caatinga.artifacts.json`, and the
`marketplace` deploy appends `-- --token_contract_id C<token-id>`.
