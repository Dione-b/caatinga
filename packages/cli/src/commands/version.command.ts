import { type Command } from "commander";
import { CAATINGA_CLI_VERSION } from "../version.js";
import { logger } from "../utils/logger.js";
import { runCliAction } from "../utils/errors.js";

export function registerVersionCommand(program: Command): void {
  program
    .command("version")
    .description("Show the version of Caatinga CLI")
    .action(() => {
      runCliAction(async () => {
        logger.info(`@caatinga/cli: ${CAATINGA_CLI_VERSION}`);
      });
    });
}
