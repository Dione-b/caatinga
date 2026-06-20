import type { ContractArtifact, CaatingaArtifacts } from "./artifact.schema.js";

export function updateArtifact(
  artifacts: CaatingaArtifacts,
  networkName: string,
  contractName: string,
  contractArtifact: ContractArtifact,
  networkExtras?: { dependencyGraph?: Record<string, string[]> }
): CaatingaArtifacts {
  const existingNetwork = artifacts.networks[networkName] ?? { contracts: {}, dependencyGraph: {} };

  return {
    ...artifacts,
    networks: {
      ...artifacts.networks,
      [networkName]: {
        ...existingNetwork,
        dependencyGraph: networkExtras?.dependencyGraph ?? existingNetwork.dependencyGraph ?? {},
        contracts: {
          ...existingNetwork.contracts,
          [contractName]: contractArtifact,
        },
      },
    },
  };
}
