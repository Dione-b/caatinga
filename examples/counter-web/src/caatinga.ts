import { createCaatingaClient } from "@caatinga/client";
import { freighterWalletAdapter } from "@caatinga/client/freighter";
import type { CaatingaArtifacts } from "@caatinga/core";
import * as Counter from "./contracts/generated/counter.js";

const artifacts: CaatingaArtifacts = {
  version: 1,
  project: "counter-web",
  networks: {
    testnet: {
      contracts: {
        counter: {
          contractId: "CDUMMYCOUNTERCONTRACTIDFORLOCALUIEXAMPLE000000000000000000000",
          wasmHash: "example-wasm-hash",
          deployedAt: "2026-05-18T00:00:00.000Z",
          sourcePath: "contracts/counter",
          wasmPath: "target/wasm32v1-none/release/counter.wasm",
          dependencies: [],
          resolvedDeployArgs: {}
        }
      },
      dependencyGraph: {
        counter: []
      }
    }
  }
};

export const caatinga = createCaatingaClient({
  network: {
    name: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015"
  },
  artifacts,
  wallet: freighterWalletAdapter,
  contracts: {
    counter: {
      binding: Counter
    }
  }
});
