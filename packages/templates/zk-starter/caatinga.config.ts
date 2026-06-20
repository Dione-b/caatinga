import { defineConfig } from "@caatinga/core";

export default defineConfig({
  project: "__PROJECT_NAME__",
  defaultNetwork: "testnet",
  contracts: {
    verifier: {
      path: "./contracts/verifier",
      wasm: "./contracts/verifier/target/wasm32v1-none/release/verifier.wasm",
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
    bindingsOutput: "./src/bindings",
  },
  zk: {
    circuits: {
      main: {
        path: "./circuits",
        protocol: "groth16",
        curve: "bls12381",
        verifierContract: "verifier",
      },
    },
  },
});
