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
      wasm: "./contracts/counter/target/wasm32v1-none/release/counter.wasm"
    }
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015"
    }
  },
  frontend: {
    framework: "vite-react",
    bindingsOutput: "./src/contracts/generated"
  }
});
```

## Artifacts

Artifacts are network-scoped in schema `version: 1` so `counter` can have different contract IDs
on testnet and mainnet. Environments are intentionally not modeled yet; a future artifact schema
can distinguish `dev -> testnet`, `staging -> testnet`, and `production -> mainnet`.

Current shape (optional fields omitted when empty):

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
