import { Command } from "commander";
import { loadConfig, runPostDeployHooks } from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function registerWireCommand(program: Command): void {
  program
    .command("wire")
    .description("Run configured post-deploy contract wiring hooks")
    .option("-n, --network <network>", "Configured network name")
    .requiredOption(
      "-s, --source <source>",
      "Stellar CLI identity alias that can sign (for example deployer)"
    )
    .action((options: { network?: string; source: string }) =>
      runCliAction(async () => {
        const config = await loadConfig();

        if (!config.postDeploy || config.postDeploy.length === 0) {
          logger.info("No postDeploy hooks configured in caatinga.config.ts.");
          return;
        }

        const results = await runPostDeployHooks({
          config,
          networkName: options.network,
          source: options.source,
          onTransientHookRetry: ({ hook, attempt, maxAttempts, delayMs }) => {
            logger.warn(
              `Post-deploy hook ${hook.contract}.${hook.method} hit a transient post-deploy error (attempt ${attempt}/${maxAttempts}). Retrying in ${Math.round(delayMs / 1000)}s...`
            );
          },
        });

        logger.success("Wire complete");
        for (const hook of results) {
          logger.info(`  ${hook.contract}.${hook.method}`);
        }
      })
    );
}
