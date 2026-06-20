import type { CaatingaArtifacts } from "../artifacts/artifact.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import type { ResolvedNetwork } from "../networks/resolve-network.js";
import { runCommand } from "../shell/run-command.js";
import { buildStellarNetworkArgs } from "../stellar-cli/build-stellar-network-args.js";

export async function verifyDependencyContract(options: {
  dependencyName: string;
  contractId: string;
  network: ResolvedNetwork;
  cwd?: string;
}): Promise<void> {
  try {
    await runCommand(
      "stellar",
      [
        "contract",
        "info",
        "interface",
        "--contract-id",
        options.contractId,
        ...buildStellarNetworkArgs(options.network),
      ],
      {
        cwd: options.cwd,
        failureCode: CaatingaErrorCode.DEPENDENCY_CONTRACT_NOT_FOUND,
      }
    );
  } catch (error) {
    if (
      error instanceof CaatingaError &&
      error.code === CaatingaErrorCode.DEPENDENCY_CONTRACT_NOT_FOUND
    ) {
      throw new CaatingaError(
        `Dependency "${options.dependencyName}" is not deployed on "${options.network.name}" (contract ID ${options.contractId}).`,
        CaatingaErrorCode.DEPENDENCY_CONTRACT_NOT_FOUND,
        "Deploy the dependency on this network, fix caatinga.artifacts.json, or omit --verify-deps.",
        error.cause
      );
    }

    throw error;
  }
}

export async function verifyDependencyContracts(options: {
  dependencies: string[];
  artifacts: CaatingaArtifacts;
  network: ResolvedNetwork;
  cwd?: string;
}): Promise<void> {
  for (const dependencyName of options.dependencies) {
    const contractArtifact =
      options.artifacts.networks[options.network.name]?.contracts[dependencyName];

    if (!contractArtifact?.contractId) {
      throw new CaatingaError(
        `No dependency artifact found for "${dependencyName}" on "${options.network.name}".`,
        CaatingaErrorCode.CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND,
        "Deploy the dependency first or run deploy without --no-deps."
      );
    }

    await verifyDependencyContract({
      dependencyName,
      contractId: contractArtifact.contractId,
      network: options.network,
      cwd: options.cwd,
    });
  }
}
