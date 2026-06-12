import type { CaatingaConfig } from "../config/config.schema.js";
import { readArtifacts } from "./read-artifacts.js";
import { resolveNetwork } from "../networks/resolve-network.js";
import {
  evaluateBindingFreshness,
  type BindingFreshness
} from "../bindings/binding-freshness.js";

export type ContractStatusEntry = {
  name: string;
  deployed: boolean;
  contractId?: string;
  wasmHash?: string;
  deployedAt?: string;
  dependencies: string[];
  bindings: BindingFreshness;
};

export type NetworkStatus = {
  network: string;
  contracts: ContractStatusEntry[];
};

export type ProjectStatus = {
  project: string;
  networks: NetworkStatus[];
};

export type CollectProjectStatusOptions = {
  config: CaatingaConfig;
  networkName?: string;
  cwd?: string;
};

export async function collectProjectStatus(
  options: CollectProjectStatusOptions
): Promise<ProjectStatus> {
  const cwd = options.cwd ?? process.cwd();
  const artifacts = await readArtifacts(cwd);

  let networkNames: string[];
  if (options.networkName) {
    networkNames = [resolveNetwork(options.config, options.networkName).name];
  } else {
    const fromArtifacts = Object.keys(artifacts.networks);
    const fallback = options.config.defaultNetwork ?? "testnet";
    networkNames = fromArtifacts.length > 0 ? fromArtifacts : [fallback];
    if (!networkNames.includes(fallback) && options.config.networks[fallback]) {
      networkNames.push(fallback);
    }
  }

  const networks: NetworkStatus[] = [];
  for (const networkName of networkNames) {
    const contracts: ContractStatusEntry[] = [];

    for (const name of Object.keys(options.config.contracts)) {
      const artifact = artifacts.networks[networkName]?.contracts[name];
      const bindings = await evaluateBindingFreshness({
        config: options.config,
        artifacts,
        networkName,
        contractName: name,
        cwd
      });

      contracts.push({
        name,
        deployed: Boolean(artifact),
        contractId: artifact?.contractId,
        wasmHash: artifact?.wasmHash,
        deployedAt: artifact?.deployedAt,
        dependencies: artifact?.dependencies ?? options.config.contracts[name].dependsOn ?? [],
        bindings
      });
    }

    networks.push({ network: networkName, contracts });
  }

  return { project: options.config.project, networks };
}
