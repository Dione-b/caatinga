import { defineConfig } from "@caatinga/core";

export default defineConfig({
  project: "__PROJECT_NAME__",
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
    mainnet: {
      rpcUrl: "https://mainnet.sorobanrpc.com",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    },
  },
  frontend: {
    framework: "vite-react",
    bindingsOutput: "./src/contracts/generated",
  },
  postDeployRead: [
    {
      contract: "counter",
      method: "count",
      kind: "read" as const,
      args: {},
      expect: { matcher: "reachable" as const },
    },
  ],
  smoke: {
    useFreshSymbol: false,
    reads: [
      {
        contract: "counter",
        method: "count",
        expect: { matcher: "reachable" as const },
      },
    ],
  },
});
