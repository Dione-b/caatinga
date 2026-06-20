import { Command } from "commander";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function registerDevCommand(program: Command): void {
  const dev = program
    .command("dev", { hidden: true })
    .description("Reserved — not available in pre-v1")
    .action(() =>
      runCliAction(async () => {
        logger.error(
          "caatinga dev is not available yet. Use: caatinga build, deploy, generate, invoke."
        );
        process.exitCode = 1;
      })
    );

  dev.helpOption(false);
  dev.configureHelp({ visibleOptions: () => [] });
}
