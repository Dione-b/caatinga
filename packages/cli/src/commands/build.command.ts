import { Command } from "commander";
import {
  buildContract,
  CaatingaError,
  CaatingaErrorCode,
  loadConfig,
  resolveDefaultContractName,
  type CaatingaConfig
} from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { evaluateDeployCoverage } from "./doctor-deploy-coverage.js";

export function registerBuildCommand(program: Command): void {
  program
    .command("build")
    .description("Build a configured Soroban contract")
    .argument("[contract]", "Contract name")
    .action((contractName: string | undefined) => runCliAction(async () => {
      const config = await loadConfig();
      const resolvedContractName = contractName ?? resolveDefaultContractName(config);
      const result = await buildContract({
        config,
        contractName: resolvedContractName
      });

      logger.success("Contract built");
      logger.info("");
      logger.info(`Contract: ${result.contract.name}`);
      logger.info(`WASM: ${result.contract.config.wasm}`);
      await warnIfDefaultNetworkNeedsDeploy(config);
    }));
}

async function warnIfDefaultNetworkNeedsDeploy(config: CaatingaConfig): Promise<void> {
  let missingDeployCommands: string[];

  try {
    const coverage = await evaluateDeployCoverage({ networkName: config.defaultNetwork });
    if (coverage.complete) {
      return;
    }

    missingDeployCommands = coverage.lines
      .filter((line) => !line.ok)
      .map((line) => line.fix?.replace(/^Run: /, ""))
      .filter((fix): fix is string => Boolean(fix));
  } catch (error) {
    if (!(error instanceof CaatingaError) || error.code !== CaatingaErrorCode.ARTIFACT_NOT_FOUND) {
      throw error;
    }

    missingDeployCommands = Object.keys(config.contracts).map(
      (name) => `caatinga deploy ${name} --network ${config.defaultNetwork} --source <identity>`
    );
  }

  if (missingDeployCommands.length === 0) {
    return;
  }

  logger.warn("");
  for (const command of missingDeployCommands) {
    logger.warn(`Next: ${command}`);
  }
  if (config.frontend) {
    logger.warn("The frontend needs contractId in caatinga.artifacts.json; build alone is not enough.");
  }
}
