import { createCaatingaClient } from "@caatinga/client";
import type { CaatingaArtifacts } from "@caatinga/core/browser";
import artifactsJson from "../caatinga.artifacts.json";
import * as Verifier from "./bindings/verifier";
import { appNetwork } from "./network.js";
import { stellarWalletAdapter } from "./wallet.js";

const artifacts = artifactsJson as CaatingaArtifacts;

export const caatingaClient = createCaatingaClient({
  network: appNetwork,
  artifacts,
  wallet: stellarWalletAdapter,
  contracts: {
    verifier: { binding: Verifier },
  },
});
