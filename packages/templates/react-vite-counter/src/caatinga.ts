import { createCaatingaClient } from "@caatinga/client";
import { freighterWalletAdapter } from "@caatinga/client/freighter";
import type { CaatingaArtifacts } from "@caatinga/core/browser";
import artifactsJson from "../caatinga.artifacts.json";
import * as Counter from "./contracts/generated/counter.js";

const artifacts = artifactsJson as CaatingaArtifacts;

export const caatingaClient = createCaatingaClient({
  network: {
    name: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015"
  },
  artifacts,
  wallet: freighterWalletAdapter,
  contracts: {
    counter: { binding: Counter }
  }
});
