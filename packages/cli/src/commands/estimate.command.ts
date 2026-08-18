import { Command } from "commander";
import { estimateDeployCost, loadConfig } from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function registerEstimateCommand(program: Command): void {
  const estimate = program
    .command("estimate")
    .description("Estimate fees before submitting transactions");

  estimate
    .command("deploy")
    .description("Estimate deploy fees for a contract (advisory)")
    .argument("<contract>", "Contract name")
    .option("-n, --network <network>", "Configured network name")
    .requiredOption(
      "-s, --source <source>",
      "Stellar CLI identity alias used to build the deploy transaction"
    )
    .action((contractName: string, options: { network?: string; source: string }) =>
      runCliAction(async () => {
        const config = await loadConfig();
        const result = await estimateDeployCost({
          config,
          contractName,
          networkName: options.network,
          source: options.source,
        });

        logger.info(`Deploy estimate: ${result.contractName} (${result.network})`);
        logger.info(`WASM: ${result.wasmPath}`);
        if (!result.simulation.ok) {
          logger.warn(`Fee estimate unavailable: ${result.simulation.error}`);
          logger.warn(result.advisory);
          return;
        }
        logger.info(`Inclusion fee: ${result.inclusionFeeStroops} stroops`);
        if (result.resourceFeeStroops !== undefined) {
          logger.info(`Resource fee: ${result.resourceFeeStroops} stroops`);
        }
        logger.info(`Total (estimate): ${result.totalFeeStroops} stroops`);
        logger.warn(result.advisory);
      })
    );
}
