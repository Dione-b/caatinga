import { readArtifacts } from "@caatinga/core";
import type { MainnetTargetDetails } from "./mainnet-guardrails.js";

/**
 * Reads the currently recorded deployment for a contract so the mainnet
 * confirmation banner can show what is about to be replaced or called.
 *
 * Returns the deployed contract ID and the WASM hash recorded for it — not the
 * hash of the local build, which is only known after the build/upload step and
 * would be a stale value at prompt time.
 */
export async function resolveDeployedTargetDetails(input: {
  networkName: string;
  contractName?: string;
}): Promise<MainnetTargetDetails> {
  if (!input.contractName) {
    return {};
  }

  const artifacts = await readArtifacts();
  const deployed = artifacts.networks[input.networkName]?.contracts[input.contractName];

  if (!deployed) {
    return {};
  }

  return {
    contractId: deployed.contractId,
    deployedWasmHash: deployed.wasmHash,
  };
}
