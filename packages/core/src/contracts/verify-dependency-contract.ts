import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CaatingaArtifacts } from "../artifacts/artifact.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import type { ResolvedNetwork } from "../networks/resolve-network.js";
import { runCommand } from "../shell/run-command.js";
import { buildStellarNetworkArgs } from "../stellar-cli/build-stellar-network-args.js";
import { TRANSACTION_TIMEOUT_MS } from "../shell/command-timeouts.js";

export async function verifyDependencyContract(options: {
  dependencyName: string;
  contractId: string;
  network: ResolvedNetwork;
  cwd?: string;
}): Promise<void> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-contract-fetch-"));
  const outFile = path.join(tempDir, "contract.wasm");
  try {
    await runCommand(
      "stellar",
      [
        "contract",
        "fetch",
        "--id",
        options.contractId,
        "--out-file",
        outFile,
        ...buildStellarNetworkArgs(options.network),
      ],
      {
        cwd: options.cwd,
        failureCode: CaatingaErrorCode.DEPENDENCY_CONTRACT_NOT_FOUND,
        timeout: TRANSACTION_TIMEOUT_MS,
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
        [
          "Deploy the dependency on this network, fix caatinga.artifacts.json, or omit --verify-deps.",
          error.hint ? `Stellar CLI diagnostics:\n${error.hint}` : undefined,
        ]
          .filter(Boolean)
          .join("\n\n"),
        error.cause
      );
    }

    throw error;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
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
