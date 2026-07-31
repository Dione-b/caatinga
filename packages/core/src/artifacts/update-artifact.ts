import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import type {
  ArtifactSupersedeReason,
  ArtifactUpgradeStrategy,
  ArtifactUpgradeType,
  CaatingaArtifacts,
  ContractArtifact,
} from "./artifact.schema.js";

export type UpdateArtifactOptions = {
  dependencyGraph?: Record<string, string[]>;
  supersedeReason?: ArtifactSupersedeReason;
  upgradeType?: ArtifactUpgradeType;
  upgradeStrategy?: ArtifactUpgradeStrategy;
};

function appendHistory(
  existing: ContractArtifact | undefined,
  reason: ArtifactSupersedeReason | undefined,
  upgradeType?: ArtifactUpgradeType
): ContractArtifact["history"] {
  if (!existing || !reason) {
    return existing?.history;
  }

  const supersededAt = new Date().toISOString();
  const entry = {
    contractId: existing.contractId,
    wasmHash: existing.wasmHash,
    deployedAt: existing.deployedAt,
    supersededAt,
    reason,
    ...(upgradeType ? { upgradeType } : {}),
  };

  return [...(existing.history ?? []), entry];
}

export function updateArtifact(
  artifacts: CaatingaArtifacts,
  networkName: string,
  contractName: string,
  contractArtifact: ContractArtifact,
  options: UpdateArtifactOptions = {}
): CaatingaArtifacts {
  const existingNetwork = artifacts.networks[networkName] ?? { contracts: {}, dependencyGraph: {} };
  const existingContract = existingNetwork.contracts[contractName];
  const history = appendHistory(existingContract, options.supersedeReason, options.upgradeType);

  const nextVersion = artifacts.version === 1 && options.supersedeReason ? 2 : artifacts.version;
  const upgradeStrategy =
    options.upgradeStrategy ??
    contractArtifact.upgradeStrategy ??
    existingContract?.upgradeStrategy;

  return {
    ...artifacts,
    version: nextVersion,
    networks: {
      ...artifacts.networks,
      [networkName]: {
        ...existingNetwork,
        dependencyGraph: options.dependencyGraph ?? existingNetwork.dependencyGraph ?? {},
        contracts: {
          ...existingNetwork.contracts,
          [contractName]: {
            ...contractArtifact,
            ...(upgradeStrategy ? { upgradeStrategy } : {}),
            history: history ?? contractArtifact.history,
          },
        },
      },
    },
  };
}

export function restoreArtifactFromHistory(input: {
  artifacts: CaatingaArtifacts;
  networkName: string;
  contractName: string;
  contractId: string;
}): CaatingaArtifacts {
  const network = input.artifacts.networks[input.networkName];
  const current = network?.contracts[input.contractName];

  if (!current) {
    throw new CaatingaError(
      `No artifact for "${input.contractName}" on "${input.networkName}".`,
      CaatingaErrorCode.ARTIFACT_NOT_FOUND,
      "Deploy the contract before attempting rollback."
    );
  }

  if (current.contractId === input.contractId) {
    return input.artifacts;
  }

  const fromHistory = (current.history ?? []).find(
    (entry) => entry.contractId === input.contractId
  );

  if (!fromHistory) {
    throw new CaatingaError(
      `Rollback target "${input.contractId}" was not found in artifact history for "${input.contractName}".`,
      CaatingaErrorCode.ROLLBACK_TARGET_NOT_FOUND,
      "Use ctg inspect to list prior contract IDs, or redeploy manually."
    );
  }

  const supersededAt = new Date().toISOString();
  const restoredArtifact: ContractArtifact = {
    contractId: fromHistory.contractId,
    wasmHash: fromHistory.wasmHash,
    deployedAt: fromHistory.deployedAt,
    sourcePath: current.sourcePath,
    wasmPath: current.wasmPath,
    dependencies: current.dependencies,
    resolvedDeployArgs: current.resolvedDeployArgs,
    history: [
      ...(current.history ?? []),
      {
        contractId: current.contractId,
        wasmHash: current.wasmHash,
        deployedAt: current.deployedAt,
        supersededAt,
        reason: "rollback",
      },
    ],
  };

  return {
    ...updateArtifact(input.artifacts, input.networkName, input.contractName, restoredArtifact),
    version: 2,
  };
}
