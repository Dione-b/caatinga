import { Command } from "commander";
import { invokeContract, loadConfig, resolveNetwork } from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { confirmMainnetOperation } from "../utils/mainnet-guardrails.js";

export function registerInvokeCommand(program: Command): void {
  program
    .command("invoke")
    .description("Invoke a deployed contract function")
    .argument("<target>", "Invoke target in contract.method format")
    .argument("[args...]", "Arguments forwarded to Stellar CLI after the method name")
    .option("-n, --network <network>", "Configured network name")
    .requiredOption(
      "-s, --source <source>",
      "Stellar CLI identity alias that can sign (for example alice)"
    )
    .option("-y, --yes", "Automatically confirm mainnet transactions without interactive prompt")
    .action(
      (
        target: string,
        args: string[],
        options: {
          network?: string;
          source: string;
          yes?: boolean;
        }
      ) =>
        runCliAction(async () => {
          const config = await loadConfig();
          const { name: networkName, config: networkConfig } = resolveNetwork(config, options.network);

          await confirmMainnetOperation({
            operation: "invoke",
            networkName,
            networkConfig,
            target,
            source: options.source,
            yes: options.yes,
          });

          const result = await invokeContract({
            config,
            target,
            args,
            networkName: options.network,
            source: options.source,
          });

          logger.success("Invoke complete");
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
