import type { CaatingaConfig } from "@caatinga/core";
import { CaatingaError, CaatingaErrorCode } from "@caatinga/core";
import {
  assertDevCeremonyAllowed,
  isProductionNetwork,
  zkArtifactsDir,
  ZkError,
} from "@caatinga/zk";

export function listZkCircuitsForVerifier(
  config: CaatingaConfig,
  verifierContract: string
): string[] {
  const circuits = config.zk?.circuits ?? {};
  return Object.entries(circuits)
    .filter(([, circuit]) => circuit.verifierContract === verifierContract)
    .map(([name]) => name);
}

export function resolveContractNamesForDeploy(
  config: CaatingaConfig,
  contractName?: string
): string[] {
  if (contractName) {
    return [contractName];
  }
  return Object.keys(config.contracts);
}

export async function assertZkBuildNetworkAllowed(options: {
  networkName: string;
  allowDevCeremony: boolean;
}): Promise<void> {
  if (!isProductionNetwork(options.networkName) || options.allowDevCeremony) {
    return;
  }

  throw new ZkError(
    "`ctg zk build` is blocked when defaultNetwork is mainnet: it always runs a single-party development ceremony.",
    "ZK_DEV_CEREMONY_BLOCKED",
    "Set defaultNetwork to testnet, or pass --allow-dev-ceremony only for conscious testing."
  );
}

export async function assertZkVerifierDeployAllowed(options: {
  config: CaatingaConfig;
  contractNames: string[];
  networkName: string;
  allowDevCeremony: boolean;
}): Promise<void> {
  for (const contractName of options.contractNames) {
    const circuitNames = listZkCircuitsForVerifier(options.config, contractName);
    for (const circuitName of circuitNames) {
      await assertDevCeremonyAllowed({
        networkName: options.networkName,
        artifactsDir: zkArtifactsDir(circuitName),
        allowDevCeremony: options.allowDevCeremony,
        operation: `ctg deploy ${contractName}`,
      });
    }
  }
}

export function assertEmbedVkInvokeBlocked(embedVk: boolean): void {
  if (!embedVk) {
    return;
  }

  throw new CaatingaError(
    "`ctg zk invoke --embed-vk` is not supported yet.",
    CaatingaErrorCode.INVALID_CONFIG,
    "`--embed-vk` is experimental. Use the dynamic VK flow (`verification_key.json` + default `verify_proof`) for end-to-end verification today."
  );
}
