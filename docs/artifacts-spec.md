# Artifacts Specification

This document details the public API contract and schema for `caatinga.artifacts.json`. The artifacts file serves as the Git-versioned state registry of all deployments, bridging the compilation/deployment output of the Orchestration Engine with consumer libraries (like the Integration SDK) and generators.

---

## JSON Schema Details

The root of `caatinga.artifacts.json` is a JSON object with the following fields:

- **`project`** (string): The unique name of the Caatinga project.
- **`version`** (number): The schema version. Currently `2`.
- **`networks`** (object): A dictionary of network deployment scopes keyed by network name (e.g., `local`, `testnet`, `mainnet`).

### Network Scope Object

Each entry under `networks` contains:

- **`dependencyGraph`** (object): A dictionary mapping each contract name to an array of its direct dependency contract names, representing the topological deploy order.
- **`contracts`** (object): A dictionary of deployed contract configurations keyed by contract name.

### Contract Object

Each contract entry contains:

- **`contractId`** (string): The public, deployed contract address on the Stellar/Soroban network.
- **`wasmHash`** (string): The SHA-256 hash of the compiled WASM binary deployed for this contract.
- **`deployedAt`** (string): ISO-8601 Datetime string representing when the contract was deployed.
- **`sourcePath`** (string): Relative path to the Rust contract folder inside the repository.
- **`wasmPath`** (string): Relative path to the target WASM file compiled.
- **`dependencies`** (array of strings): The list of contract names this contract depends on.
- **`resolvedDeployArgs`** (object): A dictionary containing primitive argument values (`string`, `number`, `boolean`) passed during deployment with resolved placeholder variables.
- **`upgradeStrategy`** (string, optional): The strategy configured for redeploying/updating. One of: `in-place` or `redeploy`.
- **`history`** (array, optional): A chronological record of historical contract deployments superseded by the current one.

### History Entry Object

Each item in the `history` array represents a superseded deployment:

- **`contractId`** (string): The historic contract address.
- **`wasmHash`** (string): The historic WASM hash.
- **`deployedAt`** (string): ISO-8601 Datetime representing the original deployment time.
- **`supersededAt`** (string): ISO-8601 Datetime representing when this deployment was replaced.
- **`reason`** (string, optional): One of: `upgrade`, `rollback`, or `force-redeploy`.
- **`upgradeType`** (string, optional): One of: `in-place` or `new-contract`.

---

## Example `caatinga.artifacts.json`

```json
{
  "project": "my-dapp",
  "version": 2,
  "networks": {
    "testnet": {
      "dependencyGraph": {
        "token": [],
        "vault": ["token"]
      },
      "contracts": {
        "token": {
          "contractId": "CAS3JIO4YZHG45NVU...",
          "wasmHash": "a1b2c3d4e5f6...",
          "deployedAt": "2026-07-06T10:00:00Z",
          "sourcePath": "contracts/token",
          "wasmPath": "target/wasm32v1-none/release/token.wasm",
          "dependencies": [],
          "resolvedDeployArgs": {}
        },
        "vault": {
          "contractId": "CB4JIO7YZHG98NVU...",
          "wasmHash": "f6e5d4c3b2a1...",
          "deployedAt": "2026-07-06T10:05:00Z",
          "sourcePath": "contracts/vault",
          "wasmPath": "target/wasm32v1-none/release/vault.wasm",
          "dependencies": ["token"],
          "resolvedDeployArgs": {
            "token_address": "CAS3JIO4YZHG45NVU..."
          },
          "history": [
            {
              "contractId": "CBL3JIO0YZHG89NVU...",
              "wasmHash": "d4c3b2a1e5f6...",
              "deployedAt": "2026-07-05T12:00:00Z",
              "supersededAt": "2026-07-06T10:05:00Z",
              "reason": "upgrade",
              "upgradeType": "in-place"
            }
          ]
        }
      }
    }
  }
}
```
