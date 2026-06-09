import { mkdir } from "node:fs/promises";
import path from "node:path";
import { readArtifacts } from "../artifacts/read-artifacts.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveNetwork } from "../networks/resolve-network.js";
import { checkBinary } from "../shell/check-binary.js";
import { runCommand } from "../shell/run-command.js";
import { buildStellarNetworkArgs } from "../stellar-cli/build-stellar-network-args.js";

export type GenerateBindingsOptions = {
  config: CaatingaConfig;
  contractName: string;
  networkName?: string;
  cwd?: string;
};

export async function generateBindings(options: GenerateBindingsOptions) {
  const cwd = options.cwd ?? process.cwd();
  const network = resolveNetwork(options.config, options.networkName);
  const artifacts = await readArtifacts(cwd);
  const contractArtifact = artifacts.networks[network.name]?.contracts[options.contractName];

  if (!contractArtifact) {
    throw new CaatingaError(
      `No deployed artifact found for "${options.contractName}" on "${network.name}".`,
      CaatingaErrorCode.ARTIFACT_NOT_FOUND,
      "Run caatinga deploy for this contract and network before generating bindings."
    );
  }

  await checkBinary("stellar", "Install Stellar CLI before running caatinga generate.");

  const outputDir = path.resolve(cwd, options.config.frontend.bindingsOutput, options.contractName);
  await mkdir(outputDir, { recursive: true });

  const result = await runCommand("stellar", [
    "contract",
    "bindings",
    "typescript",
    "--contract-id",
    contractArtifact.contractId,
    "--output-dir",
    outputDir,
    "--overwrite",
    ...buildStellarNetworkArgs(network)
  ], {
    cwd,
    failureCode: CaatingaErrorCode.BINDINGS_FAILED
  });

  return {
    contractName: options.contractName,
    network,
    outputDir,
    output: result.all || result.stdout
  };
}
