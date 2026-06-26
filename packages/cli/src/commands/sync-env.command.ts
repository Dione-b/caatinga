import { Command } from "commander";
import { loadConfig, syncFrontendEnv } from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function registerSyncEnvCommand(program: Command): void {
  program
    .command("sync-env")
    .description("Write frontend environment variables from deployment artifacts")
    .option("-n, --network <network>", "Configured network name")
    .action((options: { network?: string }) =>
      runCliAction(async () => {
        const config = await loadConfig();
        const result = await syncFrontendEnv({
          config,
          networkName: options.network,
        });

        logger.success(`Frontend env written: ${result.envFile}`);
        for (const entry of result.entries) {
          logger.info(`  ${entry.key}`);
        }
      })
    );
}
