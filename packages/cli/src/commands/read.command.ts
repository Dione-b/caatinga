import { Command } from "commander";
import { loadConfig, readContract } from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function registerReadCommand(program: Command): void {
  program
    .command("read")
    .description("Simulate a read-only contract function without signing or submitting")
    .argument("<target>", "Read target in contract.method format")
    .argument("[args...]", "Arguments forwarded to Stellar CLI after the method name")
    .option("-n, --network <network>", "Configured network name")
    .option("-s, --source <source>", "Optional Stellar CLI identity alias for simulation context")
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .action(
      (
        target: string,
        args: string[],
        options: {
          network?: string;
          source?: string;
        }
      ) =>
        runCliAction(async () => {
          const config = await loadConfig();
          const result = await readContract({
            config,
            target,
            args,
            networkName: options.network,
            source: options.source,
          });

          logger.success("Read complete");
          logger.info("");
          logger.info(`Network: ${result.network.name}`);
          logger.info(`Contract: ${result.target.contractName}`);
          logger.info(`Method: ${result.target.method}`);

          if (result.result) {
            logger.info("");
            logger.info(result.result);
          }
        })
    );
}
