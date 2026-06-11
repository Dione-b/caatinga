import { Command } from "commander";
import { generateBindingsGraph, loadConfig } from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate")
    .description("Generate TypeScript bindings for deployed contracts")
    .argument("[contract]", "Contract name (defaults to all deployed contracts)")
    .option("-n, --network <network>", "Configured network name")
    .action((contractName: string | undefined, options: {
      network?: string;
    }) => runCliAction(async () => {
      const config = await loadConfig();
      const { network, results } = await generateBindingsGraph({
        config,
        contractName,
        networkName: options.network
      });

      logger.success("Client generated");
      logger.info("");
      logger.info(`Network: ${network.name}`);
      for (const result of results) {
        logger.info("");
        logger.info(`Contract: ${result.contractName}`);
        logger.info(`Output: ${result.outputDir}`);
        logger.info(`Import path: ${result.importPath}`);
        if (result.legacyStubRemoved) {
          logger.info(`Removed legacy stub: ${config.frontend.bindingsOutput}/${result.contractName}.ts`);
        }
      }
      logger.info("");
      logger.info("Next: import bindings from the import path above, then run npm run dev");
    }));
}
