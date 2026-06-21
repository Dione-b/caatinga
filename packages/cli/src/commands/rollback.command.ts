import { Command } from "commander";
import { loadConfig, resolveNetwork, rollbackContractArtifact } from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function registerRollbackCommand(program: Command): void {
  program
    .command("rollback")
    .description("Restore a prior contract ID in caatinga.artifacts.json (logical rollback)")
    .argument("<contract>", "Contract name")
    .requiredOption("--to <contractId>", "Historical contract ID to restore")
    .option("-n, --network <network>", "Configured network name")
    .action((contractName: string, options: { to: string; network?: string }) =>
      runCliAction(async () => {
        const config = await loadConfig();
        const { name: networkName } = resolveNetwork(config, options.network);

        const result = await rollbackContractArtifact({
          networkName,
          contractName,
          contractId: options.to,
        });

        logger.success("Artifact rollback complete");
        logger.info(`Network: ${networkName}`);
        logger.info(`Contract: ${contractName}`);
        logger.info(`Active contract ID: ${options.to}`);
        logger.info(`Updated: ${result.path}`);
        logger.warn(
          "On-chain state unchanged — previous deployments may remain as orphaned contracts."
        );
      })
    );
}
