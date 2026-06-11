import { createCaatingaClient } from "@caatinga/client";
import type { CaatingaArtifacts } from "@caatinga/core/browser";
import artifactsJson from "../caatinga.artifacts.json";
import * as Counter from "./contracts/generated/counter/src/index.js";
import { stellarWalletAdapter } from "./wallet.js";

const artifacts = artifactsJson as CaatingaArtifacts;

export const caatingaClient = createCaatingaClient({
  network: {
    name: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015"
  },
  artifacts,
  wallet: stellarWalletAdapter,
  contracts: {
    counter: { binding: Counter }
  }
});
