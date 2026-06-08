import { readArtifacts } from "../artifacts/read-artifacts.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { resolveNetwork, type ResolvedNetwork } from "../networks/resolve-network.js";
import { deployContract } from "./deploy-contract.js";
import { resolveDeployArgs } from "./resolve-deploy-args.js";
import { resolveDeployOrder } from "./resolve-deploy-order.js";
import { toSkippedContract, type SkippedContract } from "./deploy-skip.js";
import { verifyDependencyContracts } from "./verify-dependency-contract.js";

export type { SkippedContract } from "./deploy-skip.js";

export type StaleWasmWarning = {
  contract: string;
  message: string;
};

export type DeployContractGraphResult = {
  network: ResolvedNetwork;
  deployedContracts: Array<{ name: string; contractId: string }>;
  skippedContracts: SkippedContract[];
  staleWasmWarnings: StaleWasmWarning[];
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
  checkStaleWasm?: boolean;
  verifyDeps?: boolean;
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
  const staleWasmWarnings: StaleWasmWarning[] = [];

  for (const contractName of order) {
    const artifacts = await readArtifacts(cwd);
    const existing = artifacts.networks[network.name]?.contracts[contractName];
    const contractConfig = options.config.contracts[contractName];

    if (options.verifyDeps && contractConfig.dependsOn.length > 0) {
      await verifyDependencyContracts({
        dependencies: contractConfig.dependsOn,
        artifacts,
        network,
        cwd,
        allowUntestedStellarCli: options.allowUntestedStellarCli
      });
    }

    const resolvedDeployArgs = resolveDeployArgs({
      deployArgs: contractConfig.deployArgs,
      artifacts,
      network: network.name
    });

    if (existing?.contractId && !options.force) {
      skippedContracts.push(
        toSkippedContract(contractName, existing.contractId, network.name)
      );
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
      checkStaleWasm: options.checkStaleWasm,
      resolvedDeployArgs,
      dependencies: contractConfig.dependsOn
    });

    if (result.staleWasmWarning) {
      staleWasmWarnings.push({
        contract: contractName,
        message: result.staleWasmWarning
      });
    }

    if (result.skipped) {
      skippedContracts.push(
        toSkippedContract(contractName, result.contractId, network.name)
      );
    } else {
      deployedContracts.push({ name: contractName, contractId: result.contractId });
    }
  }

  return {
    network,
    deployedContracts,
    skippedContracts,
    staleWasmWarnings
  };
}
