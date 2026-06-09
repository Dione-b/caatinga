import { Command } from "commander";
import { deployContractGraph, CaatingaError, CaatingaErrorCode, loadConfig } from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function registerDeployCommand(program: Command): void {
  program
    .command("deploy")
    .description("Deploy one or all configured Soroban contracts")
    .argument("[contract]", "Contract name")
    .option("-n, --network <network>", "Configured network name")
    .requiredOption("-s, --source <source>", "Stellar CLI identity alias that can sign (for example alice)")
    .option("--force", "Redeploy contracts even if artifacts already contain contract IDs")
    .option("--no-deps", "Do not deploy missing dependencies for a selected contract")
    .option("--no-stale-check", "Do not warn when WASM may be older than contract sources")
    .option("--verify-deps", "Verify dependency contract IDs exist on-chain before deploy")
    .action((contractName: string | undefined, options: {
      network?: string;
      source: string;
      force?: boolean;
      deps?: boolean;
      staleCheck?: boolean;
      verifyDeps?: boolean;
    }) => runCliAction(async () => {
      if (options.deps === false && !contractName) {
        throw new CaatingaError(
          "`--no-deps` requires a contract name.",
          CaatingaErrorCode.INVALID_CONFIG,
          "Select a single contract or omit `--no-deps` to deploy the full graph."
        );
      }

      const config = await loadConfig();
      const result = await deployContractGraph({
        config,
        contractName,
        networkName: options.network,
        source: options.source,
        includeDependencies: options.deps !== false,
        force: options.force === true,
        checkStaleWasm: options.staleCheck !== false,
        verifyDeps: options.verifyDeps === true
      });

      for (const warning of result.staleWasmWarnings) {
        logger.warn(warning.message);
      }

      logger.success("Deploy complete");
      logger.info("");
      logger.info(`Network: ${result.network.name}`);
      for (const skipped of result.skippedContracts) {
        logger.info(`[skipped] ${skipped.name} — already deployed on ${result.network.name}`);
        logger.info(`  Contract ID: ${skipped.contractId}`);
      }
      for (const contract of result.deployedContracts) {
        logger.info(`[deployed] ${contract.name}`);
        logger.info(`  Contract ID: ${contract.contractId}`);
      }
      logger.info("Artifacts updated: caatinga.artifacts.json");
    }));
}
