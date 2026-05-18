import { readArtifacts } from "../artifacts/read-artifacts.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { resolveNetwork, type ResolvedNetwork } from "../networks/resolve-network.js";
import { deployContract } from "./deploy-contract.js";
import { resolveDeployArgs } from "./resolve-deploy-args.js";
import { resolveDeployOrder } from "./resolve-deploy-order.js";

export type SkippedContract = {
  name: string;
  contractId: string;
  network: string;
  reason: "already-deployed";
};

export type DeployContractGraphResult = {
  network: ResolvedNetwork;
  deployedContracts: Array<{ name: string; contractId: string }>;
  skippedContracts: SkippedContract[];
};

export async function deployContractGraph(options: {
  config: CaatingaConfig;
  contractName?: string;
  networkName?: string;
  source?: string;
  cwd?: string;
  includeDependencies: boolean;
  force: boolean;
  allowUntestedStellarCli?: boolean;
}): Promise<DeployContractGraphResult> {
  const cwd = options.cwd ?? process.cwd();
  const network = resolveNetwork(options.config, options.networkName);
  const order = resolveDeployOrder({
    contracts: options.config.contracts,
    selectedContract: options.contractName,
    includeDependencies: options.includeDependencies
  });
  const deployedContracts: Array<{ name: string; contractId: string }> = [];
  const skippedContracts: SkippedContract[] = [];

  for (const contractName of order) {
    const artifacts = await readArtifacts(cwd);
    const existing = artifacts.networks[network.name]?.contracts[contractName];
    const contractConfig = options.config.contracts[contractName];
    const resolvedDeployArgs = resolveDeployArgs({
      deployArgs: contractConfig.deployArgs,
      artifacts,
      network: network.name
    });

    if (existing?.contractId && !options.force) {
      skippedContracts.push({
        name: contractName,
        contractId: existing.contractId,
        network: network.name,
        reason: "already-deployed"
      });
      continue;
    }

    const result = await deployContract({
      config: options.config,
      contractName,
      networkName: network.name,
      source: options.source,
      cwd,
      allowUntestedStellarCli: options.allowUntestedStellarCli,
      force: options.force,
      resolvedDeployArgs,
      dependencies: contractConfig.dependsOn
    });

    if (result.skipped) {
      skippedContracts.push({
        name: contractName,
        contractId: result.contractId,
        network: network.name,
        reason: "already-deployed"
      });
    } else {
      deployedContracts.push({ name: contractName, contractId: result.contractId });
    }
  }

  return {
    network,
    deployedContracts,
    skippedContracts
  };
}
