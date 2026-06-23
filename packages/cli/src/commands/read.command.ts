import { Command } from "commander";
import { describeCliSource, loadConfig, readContract } from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function registerReadCommand(program: Command): void {
  program
    .command("read")
    .description("Simulate a read-only contract function without signing or submitting")
    .argument("<target>", "Read target in contract.method format")
    .argument("[args...]", "Arguments forwarded to Stellar CLI after the method name")
    .option("-n, --network <network>", "Configured network name")
    .option(
      "-s, --source <source>",
      "Stellar CLI identity alias for simulation context (defaults to CAATINGA_SOURCE, otherwise alice)"
    )
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

          const resolvedSource = describeCliSource(options.source);
          if (resolvedSource.origin !== "explicit") {
            const originLabel =
              resolvedSource.origin === "env" ? "from CAATINGA_SOURCE" : "built-in default";
            logger.info(
              `Using source identity "${resolvedSource.source}" (${originLabel}). Pass --source to override.`
            );
          }

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
