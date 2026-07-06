import { defineConfig } from "@caatinga/core";

export default defineConfig({
  project: "dogfood-multi",
  defaultNetwork: "testnet",
  contracts: {
    token: {
      path: "./contracts/token",
      wasm: "./contracts/token/target/wasm32v1-none/release/token.wasm",
      dependsOn: [],
      deployArgs: {},
    },
    vault: {
      path: "./contracts/vault",
      wasm: "./contracts/vault/target/wasm32v1-none/release/vault.wasm",
      dependsOn: ["token"],
      deployArgs: {
        token: "${contracts.token.contractId}",
      },
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
  postDeploy: [
    {
      contract: "vault",
      method: "token",
      args: {},
      expect: { matcher: "reachable" },
    },
  ],
  smoke: {
    reads: [
      { contract: "token", method: "supply", expect: { matcher: "reachable" } },
      { contract: "vault", method: "token", expect: { matcher: "reachable" } },
    ],
  },
});
