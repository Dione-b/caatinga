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
    // Written on `ctg deploy` / `ctg sync-env`; read by src/network.ts.
    envFile: ".env.local",
    env: {
      network: "VITE_CAATINGA_NETWORK",
      rpcUrl: "VITE_CAATINGA_RPC_URL",
      networkPassphrase: "VITE_CAATINGA_NETWORK_PASSPHRASE",
    },
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
