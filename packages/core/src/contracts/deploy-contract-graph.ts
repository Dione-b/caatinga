import { readArtifacts } from "../artifacts/read-artifacts.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { resolveNetwork, type ResolvedNetwork } from "../networks/resolve-network.js";
import { deployContract, type DeployContractOptions } from "./deploy-contract.js";
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
  upgrade?: boolean;
  ifChanged?: boolean;
  checkStaleWasm?: boolean;
  verifyDeps?: boolean;
  onTransientDeployRetry?: DeployContractOptions["onTransientDeployRetry"];
}): Promise<DeployContractGraphResult> {
  const cwd = options.cwd ?? process.cwd();
  const network = resolveNetwork(options.config, options.networkName);
  const order = resolveDeployOrder({
    contracts: options.config.contracts,
    selectedContract: options.contractName,
    includeDependencies: options.includeDependencies,
  });
  const deployedContracts: Array<{ name: string; contractId: string }> = [];
  const skippedContracts: SkippedContract[] = [];
  const staleWasmWarnings: StaleWasmWarning[] = [];

  for (const contractName of order) {
    // Re-read per iteration on purpose: a dependency deployed earlier in this
    // loop writes its contractId, and a later contract's arg resolution
    // (`${contracts.<dep>.contractId}`) must see it — so this cannot be hoisted
    // out of the loop (#150).
    const artifacts = await readArtifacts(cwd);
    const existing = artifacts.networks[network.name]?.contracts[contractName];
    const contractConfig = options.config.contracts[contractName];

    // #150: decide the already-deployed skip up front. It only needs `existing`
    // and the flags, so doing it before dependency verification and arg
    // resolution avoids N pointless subprocess calls (resolveDeployArgs can
    // spawn `stellar keys address`) when redeploying an up-to-date graph.
    if (existing?.contractId && !options.force && !options.ifChanged) {
      skippedContracts.push(toSkippedContract(contractName, existing.contractId, network.name));
      continue;
    }

    if (options.verifyDeps && contractConfig.dependsOn.length > 0) {
      await verifyDependencyContracts({
        dependencies: contractConfig.dependsOn,
        artifacts,
        network,
        cwd,
      });
    }

    const resolvedDeployArgs = await resolveDeployArgs({
      deployArgs: contractConfig.deployArgs,
      artifacts,
      network: network.name,
      source: options.source,
      cwd,
    });

    const result = await deployContract({
      config: options.config,
      contractName,
      networkName: network.name,
      source: options.source,
      cwd,
      force: options.force,
      upgrade: options.upgrade,
      ifChanged: options.ifChanged,
      checkStaleWasm: options.checkStaleWasm,
      resolvedDeployArgs,
      dependencies: contractConfig.dependsOn,
      onTransientDeployRetry: options.onTransientDeployRetry,
    });

    if (result.staleWasmWarning) {
      staleWasmWarnings.push({
        contract: contractName,
        message: result.staleWasmWarning,
      });
    }

    if (result.skipped) {
      skippedContracts.push(toSkippedContract(contractName, result.contractId, network.name));
    } else {
      deployedContracts.push({ name: contractName, contractId: result.contractId });
    }
  }

  return {
    network,
    deployedContracts,
    skippedContracts,
    staleWasmWarnings,
  };
}
